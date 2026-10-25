import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isTeamScrimInteraction,handleTeamScrimInteraction,parseScrimKoreanDate,syncTeamScrimPanels,TEAM_SCRIM_CATEGORY} from '../premier-scrims.mjs';
const guild='1492461447568162876',user='111111111111111111';
const fixture=()=>({myTeam:{id:'a',name:'상급1'},items:[{id:'item',revision:4,hostTeam:{id:'b',name:'상급2'},guestTeam:null,status:'open',startsAt:new Date(Date.now()+86400000).toISOString(),map:'협의',note:'연습',createdAt:new Date().toISOString()}]});
function interaction(id){const result={id:'222222222222222222',guildId:guild,user:{id:user,username:'user'},customId:id,outputs:[],isChatInputCommand:()=>false,isButton:()=>true,isStringSelectMenu:()=>false,isModalSubmit:()=>false,deferReply:async data=>{result.flags=data.flags;},editReply:async data=>{result.outputs.push(data);},showModal:async data=>{result.modal=data;}};return result;}
test('Korean dates are exact and invalid calendar days are rejected',()=>{assert.equal(parseScrimKoreanDate('2026-10-26 20:00'),'2026-10-26T11:00:00.000Z');for(const bad of ['2026-02-31 20:00','2026-10-26 25:00','2026-10-26','bad'])assert.throws(()=>parseScrimKoreanDate(bad));});
test('recognizes only its command and component namespace',()=>{assert(isTeamScrimInteraction(interaction('etgp:list:0')));assert(!isTeamScrimInteraction(interaction('etg:join:1')));assert(isTeamScrimInteraction({...interaction(''),isChatInputCommand:()=>true,commandName:'스크림'}));});
test('detail shows confirmation before posting an action with trusted Discord identity',async()=>{
 const calls=[],bridge=async(path,body)=>{calls.push(body);assert.equal(path,'/api/discord-bot/action');assert.equal(body.userId,user);assert.equal(body.guildId,guild);assert.equal(body.path,'/api/premier/scrims');return fixture();};
 let i=interaction('etgp:view:item');await handleTeamScrimInteraction(i,bridge,64);assert.equal(i.flags,64);assert(i.outputs[0].components[0].components.some(b=>b.custom_id==='etgp:confirm:join:item:4'));
 i=interaction('etgp:confirm:join:item:4');await handleTeamScrimInteraction(i,bridge,64);assert(calls.every(c=>c.method==='GET'));assert(i.outputs[0].components[0].components.some(b=>b.custom_id==='etgp:execute:join:item:4'));
 i=interaction('etgp:execute:join:item:4');await handleTeamScrimInteraction(i,bridge,64);assert.deepEqual(calls.at(-1).data,{action:'join',id:'item',revision:4});assert.deepEqual(i.outputs[0].allowedMentions,{parse:[]});
 await assert.rejects(()=>handleTeamScrimInteraction(interaction('etgp:confirm:join:item:3'),bridge,64),/변경/);
});
test('modal acknowledges immediately and submits fields to the shared API',async()=>{
 const i=interaction('etgp:create');await handleTeamScrimInteraction(i,()=>{throw Error('should not fetch before modal');},64);assert.equal(i.modal.custom_id,'etgp:submit');assert.equal(i.flags,undefined);
 const submit=interaction('etgp:submit');submit.fields={getTextInputValue:key=>({startsAt:'2026-10-26 20:00',map:'어센트',note:'연습'}[key])};let captured;
 await handleTeamScrimInteraction(submit,async(path,body)=>{captured=body;return fixture();},64);assert.equal(captured.data.action,'create');assert.equal(captured.data.startsAt,'2026-10-26T11:00:00.000Z');assert.equal(captured.userId,user);
});
test('list pagination and absent team hide creation controls',async()=>{const data=fixture();data.myTeam=null;data.items=Array.from({length:26},(_,n)=>({...data.items[0],id:String(n)}));const i=interaction('etgp:list:0');await handleTeamScrimInteraction(i,async()=>data,64);assert.equal(i.outputs[0].components[0].components[0].options.length,25);assert(!JSON.stringify(i.outputs).includes('etgp:create'));assert(JSON.stringify(i.outputs).includes('etgp:list:25:active'));});
test('channels are inside the requested category and shared messages update without duplicates',async()=>{
 const calls=[],messages=new Map;let seq=0;const client={user:{id:'bot'},rest:{
  get:async path=>{calls.push(['GET',path]);if(path==='/channels/'+TEAM_SCRIM_CATEGORY)return {type:4,guild_id:guild};if(path==='/guilds/'+guild+'/channels')return [];if(path.includes('/messages?'))return [];throw Error(path);},
  post:async(path,{body})=>{calls.push(['POST',path,body]);const id=String(++seq);if(path.endsWith('/channels')){assert.equal(body.parent_id,TEAM_SCRIM_CATEGORY);assert.equal(body.type,0);}else{assert.deepEqual(body.allowed_mentions,{parse:[]});messages.set(id,body);}return {id};},
  patch:async(path,{body})=>{calls.push(['PATCH',path,body]);return {};}
 }};
 const result=await syncTeamScrimPanels(client,fixture());assert.equal(result.version,'team-scrims-v1');assert.equal(calls.filter(c=>c[0]==='POST'&&c[1].endsWith('/channels')).length,2);assert.equal(messages.size,2);
 const before=calls.length;await syncTeamScrimPanels(client,fixture());assert.equal(calls.length,before,'unchanged shared panels do not make REST writes');
 const changed=fixture();changed.items[0].guestTeam={id:'a',name:'상급1'};changed.items[0].status='confirmed';await syncTeamScrimPanels(client,changed);assert(calls.at(-1)[0]==='PATCH');
});
