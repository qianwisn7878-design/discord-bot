import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executePremierChannels} from '../premier-channels.mjs';
const guild='1492461447568162876',role='111111111111111111',manager='222222222222222222';
const job={kind:'premier-channels',guildId:guild,roleId:role,teamName:'중상급1',action:'ensure'};
function fixture(){
 let seq=300000000000000000n;const channels=[],roles=[{id:role,name:'중상급1'},{id:manager,name:'매니저'}],calls=[];
 const client={user:{id:'444444444444444444'},rest:{
  get:async p=>structuredClone(p.endsWith('/roles')?roles:channels),
  post:async(p,{body})=>{calls.push(['POST',body]);const c={...structuredClone(body),id:String(seq++),guild_id:guild};channels.push(c);return c;},
  patch:async(p,{body})=>{const c=channels.find(c=>p.endsWith(c.id));Object.assign(c,structuredClone(body));return c;},
  delete:async p=>{calls.push(['DELETE',p]);const n=channels.findIndex(c=>p.endsWith(c.id));if(n>=0)channels.splice(n,1);}
 }};return {client,channels,roles,calls};
}
test('creates photo layout privately for team and managers; repeated and concurrent calls reuse IDs',async()=>{
 const f=fixture(),a=await executePremierChannels(f.client,job);
 assert.equal(f.channels.length,7);assert.deepEqual(f.channels.map(c=>c.type),[4,0,15,0,0,0,2]);
 for(const c of f.channels){const o=c.permission_overwrites;assert.equal(o.find(o=>o.id===guild).deny,'1024');assert(BigInt(o.find(o=>o.id===role).allow)&1024n);assert(BigInt(o.find(o=>o.id===manager).allow)&1024n);assert.equal(o.length,4);}
 const both=await Promise.all([executePremierChannels(f.client,job),executePremierChannels(f.client,job)]);assert.deepEqual(both,[a,a]);assert.equal(f.channels.length,7);
 await executePremierChannels(f.client,{...job,action:'delete',channels:a});assert.equal(f.channels.length,0);
 await executePremierChannels(f.client,{...job,action:'delete',channels:a});assert.equal(f.channels.length,0);
});
test('rejects wrong guild, role, foreign category and missing manager without creating channels',async()=>{
 for(const altered of [{guildId:manager},{teamName:'Admin'},{roleId:manager}]){const f=fixture();await assert.rejects(executePremierChannels(f.client,{...job,...altered}));assert.equal(f.channels.length,0);}
 const f=fixture();f.roles.pop();await assert.rejects(executePremierChannels(f.client,job));assert.equal(f.channels.length,0);
 const g=fixture();g.channels.push({id:'foreign',name:job.teamName,type:4,permission_overwrites:[]});await assert.rejects(executePremierChannels(g.client,job));assert.equal(g.channels.length,1);
});
test('partial creation resumes and delete refuses untracked channels before any deletion',async()=>{
 const f=fixture(),original=f.client.rest.post;let calls=0;
 f.client.rest.post=async(...args)=>{if(++calls===4)throw Error('network');return original(...args);};
 await assert.rejects(executePremierChannels(f.client,job));assert.equal(f.channels.length,3);
 f.client.rest.post=original;const manifest=await executePremierChannels(f.client,job);assert.equal(f.channels.length,7);
 f.channels.push({id:'foreign',parent_id:manifest.categoryId,name:'별도 채널',type:0});
 await assert.rejects(executePremierChannels(f.client,{...job,action:'delete',channels:manifest}));assert.equal(f.channels.length,8);assert(!f.calls.some(c=>c[0]==='DELETE'));
});
test('deletion rejects channels moved outside the category',async()=>{
 const f=fixture(),manifest=await executePremierChannels(f.client,job);f.channels[1].parent_id='foreign';
 await assert.rejects(executePremierChannels(f.client,{...job,action:'delete',channels:manifest}));assert(!f.calls.some(c=>c[0]==='DELETE'));
});
