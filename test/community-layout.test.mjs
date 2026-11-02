import test from 'node:test';import assert from 'node:assert/strict';import {ensureCommunityLayout,COMMUNITY_LAYOUT_GUILD} from '../community-layout.mjs';
test('adds community spaces once, preserves quarantine and user edits, resumes partial failure',async()=>{
 let state={},seq=1,fail=true;const channels=[{id:'chat',type:4,name:'채팅',permission_overwrites:[{id:'quarantine',type:0,allow:'0',deny:'3072'}]},{id:'voice',type:4,name:'통화방',permission_overwrites:[{id:'quarantine',type:0,allow:'0',deny:'3072'}]}],created=[];
 const rest={get:async path=>{assert(path.includes(COMMUNITY_LAYOUT_GUILD));return channels.map(c=>({...c}));},post:async(path,{body})=>{if(fail&&created.length===4){fail=false;throw Error('retry');}const c={...body,id:String(seq++)};created.push(c);return c;}};
 const options={read:()=>structuredClone(state),write:s=>state=structuredClone(s)};
 await assert.rejects(()=>ensureCommunityLayout(rest,'bot',options),/retry/);channels.push(...created);await ensureCommunityLayout(rest,'bot',options);assert(state.complete);assert.equal(new Set(created.map(c=>c.type+':'+c.name)).size,created.length);assert(created.filter(c=>c.type===4).every(c=>c.permission_overwrites.some(p=>p.id==='quarantine')));const count=created.length;created[0].name='사용자가 수정';await ensureCommunityLayout(rest,'bot',options);assert.equal(created.length,count);
});
