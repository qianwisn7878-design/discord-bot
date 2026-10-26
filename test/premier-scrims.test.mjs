import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isTeamScrimInteraction,handleTeamScrimInteraction,parseScrimKoreanDate,syncTeamScrimPanels,TEAM_SCRIM_CATEGORY,teamScrimPostPayload} from '../premier-scrims.mjs';
const guild='1492461447568162876',user='111111111111111111';
const fixture=()=>({mapPool:['바인드','어센트','스플릿'],myTeam:{id:'a',name:'상급1'},items:[{id:'item',revision:4,hostTeam:{id:'b',name:'상급2'},guestTeam:null,status:'open',startsAt:new Date(Date.now()+86400000).toISOString(),map:'협의',note:'연습',createdAt:new Date().toISOString()}]});
function interaction(id){const result={id:'222222222222222222',guildId:guild,user:{id:user,username:'user'},customId:id,outputs:[],reply:async data=>{result.outputs.push(data);},isChatInputCommand:()=>false,isButton:()=>true,isStringSelectMenu:()=>false,isModalSubmit:()=>false,deferUpdate:async()=>{},deferReply:async data=>{result.flags=data.flags;},editReply:async data=>{result.outputs.push(data);},showModal:async data=>{result.modal=data;}};return result;}
test('draft dropdown changes update the originating message without a new reply',async()=>{
 const source=interaction('etgp:create-mode:veto');let updates=0;source.deferUpdate=async()=>updates++;
 await handleTeamScrimInteraction(source,async()=>fixture(),64);assert.equal(updates,1);
 const id=source.outputs[0].components[0].components[0].custom_id.split(':')[2];
 for(const [field,value] of [['region','AP'],['rounds','24'],['count','3']]){
  const i=interaction('etgp:draft-option:'+id+':'+field);i.values=[value];i.deferUpdate=async()=>updates++;i.deferReply=async()=>{throw Error('must edit original message');};
  await handleTeamScrimInteraction(i,async()=>{throw Error('draft settings are local');},64);assert.equal(i.outputs.length,1);
 }
 assert.equal(updates,4);
});
test('Korean dates infer the next year and reject invalid calendar days',()=>{const now=Date.parse('2026-10-25T11:00:00Z');assert.equal(parseScrimKoreanDate('01월 01일 00:20',now),'2026-12-31T15:20:00.000Z');assert.equal(parseScrimKoreanDate('10월 26일 20:00',now),'2026-10-26T11:00:00.000Z');assert.equal(parseScrimKoreanDate('02월 29일 20:00',now),'2028-02-29T11:00:00.000Z');for(const bad of ['02월 31일 20:00','10월 26일 25:00','2026-10-26','bad'])assert.throws(()=>parseScrimKoreanDate(bad,now));});
test('recognizes only its command and component namespace',()=>{assert(isTeamScrimInteraction(interaction('etgp:list:0')));assert(!isTeamScrimInteraction(interaction('etg:join:1')));assert(isTeamScrimInteraction({...interaction(''),isChatInputCommand:()=>true,commandName:'스크림'}));});
test('detail shows confirmation before posting an action with trusted Discord identity',async()=>{
 const calls=[],bridge=async(path,body)=>{calls.push(body);assert.equal(path,'/api/discord-bot/action');assert.equal(body.userId,user);assert.equal(body.guildId,guild);assert.equal(body.path,'/api/premier/scrims');return fixture();};
 let i=interaction('etgp:view:item');await handleTeamScrimInteraction(i,bridge,64);assert.equal(i.flags,64);assert(i.outputs[0].components[0].components.some(b=>b.custom_id==='etgp:confirm:join:item:4'));
 i=interaction('etgp:confirm:join:item:4');await handleTeamScrimInteraction(i,bridge,64);assert(calls.every(c=>c.method==='GET'));assert(i.outputs[0].components[0].components.some(b=>b.custom_id==='etgp:execute:join:item:4'));
 i=interaction('etgp:execute:join:item:4');await handleTeamScrimInteraction(i,bridge,64);assert.deepEqual(calls.at(-1).data,{action:'join',id:'item',revision:4});assert.deepEqual(i.outputs[0].allowedMentions,{parse:[]});
 await assert.rejects(()=>handleTeamScrimInteraction(interaction('etgp:confirm:join:item:3'),bridge,64),/변경/);
});
test('list pagination and absent team hide creation controls',async()=>{const data=fixture();data.myTeam=null;data.items=Array.from({length:26},(_,n)=>({...data.items[0],id:String(n)}));const i=interaction('etgp:list:0');await handleTeamScrimInteraction(i,async()=>data,64);assert.equal(i.outputs[0].components[0].components[0].options.length,25);assert(!JSON.stringify(i.outputs).includes('etgp:create'));assert(JSON.stringify(i.outputs).includes('etgp:list:25:active'));});
test('channels are inside the requested category and shared messages update without duplicates',async()=>{
 const calls=[],messages=new Map;let seq=0;const client={user:{id:'bot'},rest:{
  get:async path=>{calls.push(['GET',path]);if(path==='/channels/'+TEAM_SCRIM_CATEGORY)return {type:4,guild_id:guild};if(path==='/guilds/'+guild+'/channels')return [];if(path.includes('/messages?'))return [];throw Error(path);},
  post:async(path,{body})=>{calls.push(['POST',path,body]);const id=String(++seq);if(path.endsWith('/channels')){assert.equal(body.parent_id,TEAM_SCRIM_CATEGORY);assert.equal(body.type,0);}else{assert.deepEqual(body.allowed_mentions,{parse:[]});messages.set(id,body);}return {id};},
  patch:async(path,{body})=>{calls.push(['PATCH',path,body]);return {};},delete:async path=>{calls.push(['DELETE',path]);}
 }};
 const result=await syncTeamScrimPanels(client,fixture());assert.equal(result.version,'team-scrims-v1');assert.equal(calls.filter(c=>c[0]==='POST'&&c[1].endsWith('/channels')).length,2);assert.equal(messages.size,3);
 const before=calls.length;await syncTeamScrimPanels(client,fixture());assert.equal(calls.length,before,'unchanged shared panels do not make REST writes');
 const changed=fixture();changed.items[0].guestTeam={id:'a',name:'상급1'};changed.items[0].status='confirmed';await syncTeamScrimPanels(client,changed);assert(calls.at(-1)[0]==='DELETE');
});

test('fixed recruitment dropdowns preserve AP, 24R, game count and ordered maps through modal submission',async()=>{
 const captured=[],bridge=async(_,body)=>{if(body.data)captured.push(body.data);return fixture();};
 const start=interaction('etgp:create-mode:fixed');await handleTeamScrimInteraction(start,bridge,64);const id=start.outputs[0].components[0].components[0].custom_id.split(':')[2];
 for(const [field,value] of [['region','AP'],['rounds','24'],['count','2']]){const i=interaction('etgp:draft-option:'+id+':'+field);i.values=[value];await handleTeamScrimInteraction(i,bridge,64);}
 const next=interaction('etgp:draft-next:'+id);await handleTeamScrimInteraction(next,bridge,64);assert.equal(next.outputs[0].components[0].components[0].options.length,3);
 for(const value of ['어센트','스플릿']){const i=interaction('etgp:draft-map:'+id);i.values=[value];await handleTeamScrimInteraction(i,bridge,64);}
 const modal=interaction('etgp:draft-modal:'+id);await handleTeamScrimInteraction(modal,bridge,64);assert.equal(modal.modal.components[0].components[0].placeholder,'01월 01일 00:20');
 const submit=interaction(modal.modal.custom_id);submit.fields={getTextInputValue:key=>key==='startsAt'?'01월 01일 00:20':'연습'};await handleTeamScrimInteraction(submit,bridge,64);
 assert.deepEqual(captured[0].maps,['어센트','스플릿']);assert.equal(captured[0].region,'AP');assert.equal(captured[0].rounds,24);assert.equal(captured[0].matchCount,2);
});
test('veto setup restricts dropdown to BO1 and BO3; expired or foreign drafts cannot be submitted',async()=>{
 const i=interaction('etgp:create-mode:veto');await handleTeamScrimInteraction(i,async()=>fixture(),64);const menu=i.outputs[0].components[2].components[0];assert.deepEqual(menu.options.map(o=>o.value),['1','3']);
 const id=menu.custom_id.split(':')[2],other=interaction('etgp:draft-modal:'+id);other.user.id='another';await assert.rejects(()=>handleTeamScrimInteraction(other,async()=>fixture(),64),/만료/);
 const select=interaction(menu.custom_id);select.values=['3'];await handleTeamScrimInteraction(select,async()=>fixture(),64);const modal=interaction('etgp:draft-modal:'+id);await handleTeamScrimInteraction(modal,async()=>fixture(),64);const submit=interaction(modal.modal.custom_id);submit.fields={getTextInputValue:key=>key==='startsAt'?'01월 01일 00:20':''};let saved;await handleTeamScrimInteraction(submit,async(_,body)=>{saved=body.data;return fixture();},64);assert.equal(saved.bestOf,3);assert.equal(saved.mapMode,'veto');
});
test('confirmed unspecified recruitment selects every game map with Discord dropdowns',async()=>{
 const data=fixture();Object.assign(data.items[0],{mapMode:'later',status:'confirmed',matchCount:2,guestTeam:{id:'a',name:'상급1'}});let saved;const bridge=async(_,body)=>{if(body.data)saved=body.data;return data;};
 const first=interaction('etgp:map-start:item');await handleTeamScrimInteraction(first,bridge,64);let id=first.outputs[0].components[0].components[0].custom_id;
 for(const value of ['어센트','바인드']){const i=interaction(id);i.values=[value];await handleTeamScrimInteraction(i,bridge,64);}
 assert.deepEqual(saved.maps,['어센트','바인드']);assert.equal(saved.action,'choose-map');
});

test('challenge button joins immediately using fresh revision and trusted Discord identity',async()=>{
 const calls=[],state=fixture(),i=interaction('etgp:challenge:item');
 await handleTeamScrimInteraction(i,async(_,body)=>{calls.push(body);return body.data?{...state,items:[{...state.items[0],status:'confirmed',guestTeam:state.myTeam,revision:5}]}:state;},64);
 assert.equal(calls.length,2);assert.deepEqual(calls[1].data,{action:'join',id:'item',revision:4});assert.equal(calls[1].userId,user);assert.match(i.outputs[0].content,/확정/);assert(!JSON.stringify(i.outputs).includes('etgp:confirm:join'));
});
test('recruitment message exposes one direct challenge button and disables it after matching',()=>{
 const item=fixture().items[0],open=teamScrimPostPayload(item);assert.equal(open.components[0].components[0].label,'맞짱 까기');assert.equal(open.components[0].components[0].custom_id,'etgp:challenge:item');assert.equal(open.components[0].components[0].disabled,false);
 const closed=teamScrimPostPayload({...item,status:'confirmed',guestTeam:{id:'a',name:'상급1'}});assert.equal(closed.components[0].components[0].disabled,true);assert.match(closed.embeds[0].title,/상급2 vs 상급1/);assert.deepEqual(open.allowed_mentions,{parse:[]});
});
test('individual posts survive restart without duplication and closed posts are deleted and stale snapshots cannot recreate them',async()=>{
 const channels=[{id:'guide',type:0,parent_id:TEAM_SCRIM_CATEGORY,name:'스크림-안내'},{id:'board',type:0,parent_id:TEAM_SCRIM_CATEGORY,name:'스크림-모집'}],messages=new Map,patches=[];let seq=0;
 const client={user:{id:'bot'},rest:{get:async path=>{if(path==='/channels/'+TEAM_SCRIM_CATEGORY)return {type:4,guild_id:guild};if(path==='/guilds/'+guild+'/channels')return channels;const channel=path.split('/')[2];return [...messages.values()].filter(m=>m.channel===channel).reverse();},post:async(path,{body})=>{const id=String(++seq);messages.set(id,{...body,id,channel:path.split('/')[2],author:{id:'bot'}});return {id};},patch:async(path,{body})=>{const id=path.split('/').at(-1);patches.push(id);Object.assign(messages.get(id),body);return {};},delete:async path=>{messages.delete(path.split('/').at(-1));}}};
 const state=fixture();state.items.push({...state.items[0],id:'second',hostTeam:{id:'c',name:'상급3'}});
 const initial=await import('../premier-scrims.mjs?posts-initial');await initial.syncTeamScrimPanels(client,state);assert.equal(messages.size,4);
 const posts=[...messages.values()].filter(m=>m.embeds?.[0].footer?.text.startsWith('ETG 스크림 모집글 · '));assert.equal(posts.length,2);const target=posts.find(m=>m.embeds[0].footer.text.endsWith('item')).id;
 const restarted=await import('../premier-scrims.mjs?posts-restarted');await restarted.syncTeamScrimPanels(client,state);assert.equal(messages.size,4);
 state.items[0]={...state.items[0],status:'cancelled',revision:5};await restarted.syncTeamScrimPanels(client,state);assert.equal(messages.size,3);assert.equal(messages.has(target),false);
 await restarted.syncTeamScrimPanels(client,{items:[{...state.items[0],revision:4,status:'open'}]});assert.equal(messages.has(target),false);
});

test('confirmed, cancelled, expired and completed recruitments are not posted',async()=>{
 const mod=await import('../premier-scrims.mjs?closed-only'),state=fixture(),writes=[];
 state.items=['confirmed','cancelled','expired','completed'].map((status,n)=>({...state.items[0],id:'closed-'+n,status}));
 const client={user:{id:'bot'},rest:{get:async path=>path==='/channels/'+TEAM_SCRIM_CATEGORY?{type:4,guild_id:guild}:path==='/guilds/'+guild+'/channels'?[{id:'g',parent_id:TEAM_SCRIM_CATEGORY,type:0,name:'스크림-안내'},{id:'b',parent_id:TEAM_SCRIM_CATEGORY,type:0,name:'스크림-모집'}]:[],post:async(_,body)=>{writes.push(body.body);return {id:String(writes.length)};},patch:async()=>{},delete:async()=>{throw Error('nothing to delete');}}};
 const result=await mod.syncTeamScrimPanels(client,state);assert.equal(writes.length,2);assert.equal(result.postCount,0);
});

test('participant can start a scrim from a schedule button and save imported results through the same bridge',async()=>{
 const state=fixture();state.items[0].guestTeam=state.myTeam;state.items[0].status='confirmed';let saved;
 const i=interaction('etgp:run:start:item');await handleTeamScrimInteraction(i,async(_,body)=>{if(body.data)saved=body.data;return state;},64);assert.deepEqual(saved,{action:'start',id:'item',revision:4});assert.match(i.outputs[0].content,/시작/);
 state.items[0].status='playing';state.items[0].run={gameStartedAt:'now',series:{sets:[{number:1,result:null}]}};
 const view=interaction('etgp:view:item');await handleTeamScrimInteraction(view,async()=>state,64);assert(JSON.stringify(view.outputs).includes('etgp:run:import-set:item'));
});
