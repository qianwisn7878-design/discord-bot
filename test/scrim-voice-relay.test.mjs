import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeScrimVoice} from '../scrim-voice-relay.mjs';
const guild='1492461447568162876',category='1523985107881300038',event='11111111-2222-4333-8444-555555555555',a='111111111111111111',b='222222222222222222';
function fixture(){
 const members=Array.from({length:10},(_,n)=>({user:{id:String(300000000000000000n+BigInt(n)),username:'synthetic'},roles:[n<5?a:b]})),states=new Map(members.map(m=>[m.user.id,{channelId:'lobby'}])),calls=[];
 const channels=[{id:'lobby',type:2,parent_id:category,name:'스크림 대기실 · 상급1 vs 상급2 · '+event.slice(0,8)}],roles=[{id:a,name:'상급1',permissions:'0'},{id:b,name:'상급2',permissions:'0'}];let n=0;
 const client={isReady:()=>true,guilds:{cache:new Map([[guild,{voiceStates:{cache:states}}]])},rest:{get:async path=>{calls.push(['GET',path]);if(path==='/channels/'+category)return {type:4,guild_id:guild};if(path.endsWith('/roles'))return roles;if(path.endsWith('/channels'))return channels;if(path.includes('/members?'))return members;throw Error('unexpected path');},post:async(path,{body})=>{calls.push(['POST',path]);const c={...body,id:'team-'+(++n)};channels.push(c);return c;},patch:async(path,{body})=>{calls.push(['PATCH',path]);states.get(path.split('/').at(-1)).channelId=body.channel_id;return {};}}};
 const job={kind:'scrim-voice',action:'begin-match',guildId:guild,eventId:event,teamIds:[a,b],actorId:members[0].user.id,lobbyId:'lobby'};
 return {client,job,members,roles,channels,calls,states};
}
test('ten-player match starts inside one bot task, uses live voice cache and reuses rooms on retry',async()=>{
 const f=fixture(),result=await executeScrimVoice(f.client,f.job);assert.equal(result.teams.a.length,5);assert.equal(result.teams.b.length,5);assert.equal(f.calls.filter(c=>c[0]==='POST').length,2);assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,10);assert(!f.calls.some(c=>c[1].includes('/voice-states/')));
 await executeScrimVoice(f.client,f.job);assert.equal(f.calls.filter(c=>c[0]==='POST').length,2);assert.equal(f.calls.filter(c=>c[0]==='PATCH').length,10);
});
test('foreign guild, lost team membership, elevated roles, wrong lobby and absent opponents never create or move channels',async()=>{
 for(const change of [f=>f.job.guildId='999999999999999999',f=>f.members[0].roles=[],f=>f.roles[0].permissions='8',f=>f.channels[0].parent_id='wrong',f=>{for(const m of f.members.slice(5))f.states.get(m.user.id).channelId='elsewhere';}]){
  const f=fixture();change(f);await assert.rejects(executeScrimVoice(f.client,f.job));assert(!f.calls.some(c=>['POST','PATCH'].includes(c[0])));
 }
});
