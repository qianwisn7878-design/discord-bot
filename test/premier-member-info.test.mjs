import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncPremierMemberInfo,memberInfoBody,activityText,MEMBER_SLOTS} from '../premier-member-info.mjs';
const guild='1492461447568162876',role='111111111111111111',category='222222222222222222',channel='333333333333333333',user='444444444444444444',bot='555555555555555555',manager='666666666666666666';
function fixture(){
 let seq=700000000000000000n;const messages=[],writes=[],members=new Map([[user,{roles:[role]}]]),overwrites=[{id:guild,type:0,deny:'1024',allow:'0'},{id:role,type:0,allow:'1024',deny:'0'},{id:manager,type:0,allow:'1024',deny:'0'}];
 const channels=[{id:category,type:4,name:'상급1',permission_overwrites:structuredClone(overwrites)},{id:channel,type:0,name:'팀원정보',parent_id:category,permission_overwrites:structuredClone(overwrites)}],roles=[{id:role,name:'상급1',permissions:'0'},{id:manager,name:'매니저',permissions:'0'}];
 const team={name:'상급1',roleId:role,slots:{'main-0':{id:user,name:'홍길동',positions:[{name:'타격대',agents:['제트','레이즈']},{name:'척후대',agents:['소바']}],activityDays:{mon:{status:'available',start:'22:00',end:'02:00',startCondition:'after-school'},tue:{status:'unavailable'}}}}},payload={version:'premier-member-info-v1',teams:[team]};
 const client={user:{id:bot},rest:{
  get:async path=>{
   if(path==='/guilds/'+guild+'/roles')return structuredClone(roles);
   if(path==='/guilds/'+guild+'/channels')return structuredClone(channels);
   if(path.startsWith('/guilds/'+guild+'/members/')){const m=members.get(path.split('/').at(-1));if(!m)throw Object.assign(Error('gone'),{status:404});return structuredClone(m);}
   if(path.startsWith('/channels/'+channel+'/messages?')){const before=new URL('https://test'+path).searchParams.get('before');return structuredClone(messages.filter(m=>!before||BigInt(m.id)<BigInt(before)).sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1).slice(0,100));}
   throw Error('Unexpected GET '+path);
  },
  post:async(path,{body})=>{writes.push(['POST',path,body]);const m={...structuredClone(body),id:String(seq++),author:{id:bot}};messages.push(m);return m;},
  patch:async(path,{body})=>{writes.push(['PATCH',path,body]);const m=messages.find(m=>path.endsWith('/'+m.id));assert(m);Object.assign(m,structuredClone(body));return m;}
 }};
 return {client,payload,team,messages,writes,members,channels,roles};
}
test('creates all nine named slots including empty coach/subcoach/six; full positions then seven-day schedule',async()=>{
 const f=fixture(),result=await syncPremierMemberInfo(f.client,f.payload);assert.deepEqual(result,{updated:9,errors:[]});
 assert.deepEqual(f.messages.map(m=>m.embeds[0].title.split(' · ')[0]),MEMBER_SLOTS.map(s=>s[1]));
 const m=f.messages[2];assert.match(m.embeds[0].fields[0].value,/타격대.*제트 · 레이즈/);assert.match(m.embeds[0].fields[0].value,/척후대.*소바/);
 const activity=m.embeds[0].fields[1].value;assert.match(activity,/학교 마치고 · 22:00 ~ 02:00 \(다음 날 종료\)/);assert.match(activity,/화요일: 활동 불가/);assert.equal(activity.split('\n').length,7);
 assert(f.messages.every(m=>m.allowed_mentions.parse.length===0));
});
test('edits same message for changed information and clears removed member; restart and concurrent calls do not duplicate',async()=>{
 const f=fixture();await syncPremierMemberInfo(f.client,f.payload);const original=f.messages[2].id;
 assert.equal((await syncPremierMemberInfo(f.client,structuredClone(f.payload))).updated,0);
 f.team.slots['main-0'].positions[0].agents=['네온'];const changes=await syncPremierMemberInfo(f.client,f.payload);assert.equal(changes.updated,1);assert.equal(f.messages[2].id,original);assert.match(f.messages[2].embeds[0].fields[0].value,/네온/);
 await Promise.all([syncPremierMemberInfo(f.client,f.payload),syncPremierMemberInfo(f.client,f.payload)]);assert.equal(f.messages.length,9);
 f.members.get(user).roles=[];assert.equal((await syncPremierMemberInfo(f.client,f.payload)).updated,1);assert.equal(f.messages[2].embeds[0].title,'주전 1 · 미배정');assert(!JSON.stringify(f.messages[2]).includes('홍길동'));
});
test('missing slot message is recreated, human messages stay untouched, partial failures resume',async()=>{
 const f=fixture();const post=f.client.rest.post;let count=0;f.client.rest.post=async(...args)=>{if(++count===4)throw Error('network');return post(...args);};
 assert.equal((await syncPremierMemberInfo(f.client,f.payload)).errors.length,1);assert.equal(f.messages.length,3);
 f.client.rest.post=post;await syncPremierMemberInfo(f.client,f.payload);assert.equal(f.messages.length,9);
 const removed=f.messages.splice(5,1)[0];f.messages.push({...removed,id:'800000000000000000',author:{id:user}});
 const result=await syncPremierMemberInfo(f.client,f.payload);assert.equal(result.updated,1);assert.equal(f.messages.filter(m=>m.author.id===bot).length,9);assert.equal(f.messages.find(m=>m.author.id===user).id,'800000000000000000');
});
test('refuses public channels, outsiders, wrong categories and role mismatches',async()=>{
 for(const mutate of [f=>f.channels[1].permission_overwrites=[],f=>f.channels[1].permission_overwrites.push({id:user,type:1,allow:'1024'}),f=>f.channels[1].parent_id=user,f=>f.roles[0].name='상급2']){
  const f=fixture();mutate(f);assert.equal((await syncPremierMemberInfo(f.client,f.payload)).errors.length,1);assert.equal(f.writes.length,0);
 }
 const f=fixture();f.roles.shift();assert.deepEqual(await syncPremierMemberInfo(f.client,f.payload),{updated:0,errors:[]});assert.equal(f.writes.length,0);
 assert.deepEqual(await syncPremierMemberInfo(f.client,null),{updated:0,errors:[]});
});
test('long custom conditions fit Discord limits without omitting days or sending mentions',()=>{
 const days=Object.fromEntries(['mon','tue','wed','thu','fri','sat','sun'].map(day=>[day,{status:'available',start:'18:00',end:'23:00',startCondition:'other',customCondition:'*'.repeat(100)}]));
 const body=memberInfoBody({roleId:role},'coach','코치',{id:user,name:'@everyone',positions:[],activityDays:days});
 assert(body.embeds[0].fields.length>2);assert(body.embeds[0].fields.every(f=>f.value.length<=1024));assert.match(body.embeds[0].fields.map(f=>f.value).join('\n'),/일요일:/);assert.deepEqual(body.allowed_mentions,{parse:[]});assert.match(activityText({}),/미설정/);
});
test('message discovery paginates past human chatter and preserves existing IDs',async()=>{
 const f=fixture();await syncPremierMemberInfo(f.client,f.payload);
 for(let i=0;i<120;i++)f.messages.push({id:String(900000000000000000n+BigInt(i)),author:{id:user},content:'일반 메시지'});
 const ids=f.messages.slice(0,9).map(m=>m.id);assert.equal((await syncPremierMemberInfo(f.client,f.payload)).updated,0);assert.deepEqual(f.messages.slice(0,9).map(m=>m.id),ids);assert.equal(f.messages.length,129);
});
