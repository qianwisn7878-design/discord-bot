import test from 'node:test';import assert from 'node:assert/strict';import {createSupportTickets,TICKET_CATEGORY,ticketPermissionsMatch,preserveTicketDenies} from '../support-tickets.mjs';
const guild='1554439098490429442',bot='111111111111111111',owner='222222222222222222',admin='333333333333333333',community='444444444444444444';
function setup(){let seq=500000000000000000n;const channels=[],roles=[{id:'r1',name:'Admin'},{id:'r2',name:'커뮤니티 총 관리자'},{id:'r3',name:'발로란트 클랜 부관리자'},{id:'r4',name:'신고 문의 담당'}],members={[owner]:[],[admin]:['r1'],[community]:['r2']};const rest={async get(path){if(path==='/channels/'+TICKET_CATEGORY)return {type:4,guild_id:guild};if(path.endsWith('/roles'))return roles;if(path.endsWith('/channels'))return channels;if(path.includes('/members/'))return {roles:members[path.split('/').at(-1)]||[]};if(path.includes('/messages'))return [];return channels.find(x=>x.id===path.split('/').at(-1));},async post(path,{body}){if(path.endsWith('/channels')){const c={...body,id:String(seq++),guild_id:guild};channels.push(c);return c;}return {};},async patch(path,{body}){Object.assign(channels.find(x=>x.id===path.split('/').at(-1)),body);},async delete(path){if(path.includes('/permissions/')){const parts=path.split('/'),c=channels.find(x=>x.id===parts[2]);c.permission_overwrites=c.permission_overwrites.filter(x=>x.id!==parts.at(-1));return;}channels.splice(channels.findIndex(x=>x.id===path.split('/').at(-1)),1);}};rest.put=async(path,{body})=>{const parts=path.split('/'),channel=channels.find(c=>c.id===parts[2]),id=parts.at(-1);channel.permission_overwrites=channel.permission_overwrites.filter(x=>x.id!==id);channel.permission_overwrites.push({id,...body});};return {s:createSupportTickets(rest,bot),channels,rest};}
const input=(n,kind='report',scope='community')=>({userId:owner,kind,scope,number:String(600000000000000000n+BigInt(n)),title:'제목',details:'내용'});
test('3 per requester and kind across scopes, concurrent creation cannot exceed limit',async()=>{const {s,channels}=setup();const results=await Promise.allSettled([s.create(input(1)),s.create(input(2,'report','pubg')),s.create(input(3,'report','valorantClan')),s.create(input(4))]);assert.equal(results.filter(x=>x.status==='fulfilled').length,3);await s.create(input(5,'question'));assert.equal(channels.length,4);});
test('closed tickets retained; reopening respects cap; only community leads can delete',async()=>{const {s,channels}=setup();const a=await s.create(input(1));await assert.rejects(()=>s.canDelete(a.channelId,community),/먼저 닫/);await s.transition(a.channelId,owner,true);await s.create(input(2));await s.create(input(3));await s.create(input(4));await assert.rejects(()=>s.transition(a.channelId,owner,false),/최대 3/);await assert.rejects(()=>s.canDelete(a.channelId,admin),/커뮤니티|담당 운영진/);await s.canDelete(a.channelId,community);const c=channels.find(x=>x.id===a.channelId);assert(c.permission_overwrites.some(x=>x.id==='r2'&&(BigInt(x.allow)&1024n)));for(const role of ['r1','r3','r4'])assert(!c.permission_overwrites.some(x=>x.id===role&&(BigInt(x.allow)&1024n)));assert(c.permission_overwrites.some(x=>x.id===guild&&(BigInt(x.deny)&1024n)));await s.remove(a.channelId,community);assert.equal(channels.length,3);});
test('same interaction replay returns same channel without making another',async()=>{const {s,channels}=setup();const a=await s.create(input(1)),b=await s.create(input(1));assert.equal(a.channelId,b.channelId);assert.equal(channels.length,1);});


test('privacy verification accepts Discord-normalized unrelated permission bits and safe extra denies',()=>{
 const expected=[{id:guild,type:0,allow:'0',deny:'1024'},{id:owner,type:1,allow:'68608',deny:String(16n|268435456n)}];
 const actual={guild_id:guild,parent_id:TICKET_CATEGORY,permission_overwrites:[{id:owner,type:'1',allow:'68608',deny:'0'},{id:guild,type:0,allow:'0',deny:'1024'},{id:'extra',type:0,allow:'0',deny:'1024'}]};
 assert(ticketPermissionsMatch(actual,expected,guild));
 actual.permission_overwrites[2].allow='1024';assert(!ticketPermissionsMatch(actual,expected,guild),'unexpected viewers rejected');
 actual.permission_overwrites.pop();actual.permission_overwrites[1].deny='0';assert(!ticketPermissionsMatch(actual,expected,guild),'public access rejected');
 actual.permission_overwrites[1].deny='1024';actual.parent_id='wrong';assert(!ticketPermissionsMatch(actual,expected,guild),'wrong category rejected');
});

test('failed private-channel verification does not publish contents or leave a new orphan',async()=>{
 const {s,rest,channels}=setup(),get=rest.get.bind(rest),post=rest.post.bind(rest);let posted=false;
 rest.get=async path=>{const value=await get(path);if(value?.permission_overwrites)return {...value,permission_overwrites:value.permission_overwrites.map(x=>x.id===guild?{...x,deny:'0'}:x)};return value;};
 rest.post=async(path,body)=>{if(path.includes('/messages'))posted=true;return post(path,body);};
 await assert.rejects(()=>s.create(input(1)),/비공개 권한/);assert.equal(posted,false);assert.equal(channels.length,0);
});
test('one mismatched permission snapshot is repaired and rechecked before posting',async()=>{
 const {s,rest,channels}=setup(),get=rest.get.bind(rest);let changed=false;
 rest.get=async path=>{const value=await get(path);if(value?.permission_overwrites&&!changed){changed=true;return {...value,permission_overwrites:[]};}return value;};
 await s.create(input(1));assert(changed);assert.equal(channels.length,1);
});

test('quarantine deny overwrites survive ticket permission updates',()=>{
 const base=[{id:guild,type:0,allow:'0',deny:'1024'},{id:'staff',type:0,allow:'3072',deny:'0'}],security=[{id:'quarantine',type:0,allow:'0',deny:'3072'},{id:'staff',type:0,allow:'0',deny:'2048'}];
 const next=preserveTicketDenies(base,security);assert.deepEqual(next.find(x=>x.id==='quarantine'),security[0]);assert.equal(next.find(x=>x.id==='staff').allow,'1024');assert.equal(next.find(x=>x.id==='staff').deny,'2048');assert.equal(base[1].allow,'3072');
 const unsafe=preserveTicketDenies(base,[{id:'unrelated',type:0,allow:'1024',deny:'0'}]);assert(!unsafe.some(x=>x.id==='unrelated'));
});
test('create, close and reopen retain quarantine without replacing the full overwrite list',async()=>{
 const {s,rest,channels}=setup(),get=rest.get.bind(rest),patch=rest.patch.bind(rest);const quarantine={id:'quarantine',type:0,allow:'0',deny:'3072'};
 rest.get=async path=>{const result=await get(path);return path==='/channels/'+TICKET_CATEGORY?{...result,permission_overwrites:[quarantine]}:result;};
 rest.patch=async(path,options)=>{assert(!Object.hasOwn(options.body,'permission_overwrites'));return patch(path,options);};
 const result=await s.create(input(1));for(const closed of [true,false]){await s.transition(result.channelId,owner,closed);assert.deepEqual(channels[0].permission_overwrites.find(e=>e.id==='quarantine'),quarantine);}
});

test('only community leads plus the selected organization leads can view each scope',async()=>{
 const {s,rest,channels}=setup();const roles=await rest.get('/guilds/'+guild+'/roles');roles.push({id:'pubg',name:'배그 클랜 총관리자'},{id:'team',name:'발로란트 프리미어 팀 부관리자'},{id:'communitySub',name:'커뮤니티 부관리자'});
 const scopes=['community','pubg','valorantClan','valorant'];for(let i=0;i<scopes.length;i++){const result=await s.create(input(20+i,i===3?'question':'report',scopes[i])),c=channels.find(x=>x.id===result.channelId),viewers=c.permission_overwrites.filter(x=>Number(x.type)===0&&(BigInt(x.allow)&1024n)).map(x=>x.id).sort();assert.deepEqual(viewers,['r2','communitySub',...({pubg:['pubg'],valorantClan:['r3'],valorant:['team']}[scopes[i]]||[])].sort());}
});
test('existing broad Admin and other-clan viewer overwrites are removed without touching quarantine',async()=>{
 const {s,rest,channels}=setup();const result=await s.create(input(1)),c=channels[0];c.permission_overwrites.push({id:'r1',type:0,allow:'3072',deny:'0'},{id:'r3',type:0,allow:'3072',deny:'0'},{id:'quarantine',type:0,allow:'0',deny:'3072'});
 await s.transition(result.channelId,owner,true);assert(!c.permission_overwrites.some(x=>x.id==='r1'||x.id==='r3'));assert(c.permission_overwrites.some(x=>x.id==='quarantine'&&x.deny==='3072'));
});
