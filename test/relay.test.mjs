import {test} from 'node:test';import assert from 'node:assert/strict';import {executeRelayJob,validateRelayJob} from '../discord-relay.mjs';
const guild='1492461447568162876',channel='1523985190790369331',user='111111111111111111';
const client={user:{id:'bot'},rest:{get:async path=>path.endsWith('/roles')?[{id:'admin',permissions:'8'},{id:'team',permissions:'0',name:'상급1'}]:path.includes('/messages/')?{author:{id:'human'}}:path.startsWith('/channels/')?{id:channel,guild_id:guild,type:0,name:'스크림 일정'}:{id:user},post:async()=>({id:'new-message'})}};
test('relay enforces guild, endpoint and role permission boundaries',async()=>{
 const job={kind:'rest',path:'/guilds/'+guild+'/roles',method:'POST',body:{name:'상급8',permissions:'0'}};await validateRelayJob(client,job);
 for(const invalid of [{...job,path:'/guilds/999999999999999999/roles'},{...job,body:{permissions:'8'}},{...job,path:'/guilds/'+guild+'/bans/'+user},{...job,path:'/guilds/'+guild+'/members/'+user+'/roles/admin',method:'PUT'},{...job,path:'/channels/'+channel+'/webhooks',method:'POST'},{...job,path:'/channels/'+channel+'/messages/123',method:'DELETE'}])await assert.rejects(()=>validateRelayJob(client,invalid));
 const result=await executeRelayJob(client,{kind:'rest',path:'/channels/'+channel+'/messages',method:'POST',body:{content:'synthetic'}});assert.equal(result.status,200);assert.equal(result.body.id,'new-message');
});
test('relay cannot fetch URLs, local files, private backup paths or unapproved DM history',async()=>{
 for(const path of ['https://evil.example','/../../secret','/users/@me/../x','/channels/'+channel+'/messages#x','/api/discord-bot/legacy-state'])assert.equal((await executeRelayJob(client,{kind:'rest',path,method:'GET'})).status,403);
});

