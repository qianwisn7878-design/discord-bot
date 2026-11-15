import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {loadConfig,createBridge,handleInteraction,isSupported,CLIENT_ID,GUILDS} from '../core.mjs';
import {cleanup} from '../cleanup.mjs';
const env={DISCORD_BOT_TOKEN:'synthetic-token',ETG_INHOUSE_BRIDGE_SECRET:'s'.repeat(40)};
test('fixed identity, HTTPS origin and separate secret are required',()=>{
 assert.equal(loadConfig(env).clientId,CLIENT_ID);
 for(const values of [{DISCORD_BOT_TOKEN:''},{ETG_INHOUSE_BRIDGE_SECRET:'short'},{DISCORD_CLIENT_ID:'1550151990900686939'},{ETG_SITE_URL:'https://evil.example'},{ETG_SITE_URL:'https://enjoythegame.kr/else'}])assert.throws(()=>loadConfig({...env,...values}));
});
test('bridge signs exact bytes and does not transmit the bot token',async()=>{
 const config=loadConfig(env);let request;
 const bridge=createBridge(config,{now:()=>1234567890123,nonce:()=> '12345678-1234-1234-1234-123456789012',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({saved:true})};}});
 await bridge('interaction',{userId:'123'});
 const {options:o}=request,path='/api/discord-bot/inhouse/interaction';
 assert.equal(o.headers['X-ETG-Signature'],createHmac('sha256',config.secret).update(`1234567890123\n${o.headers['X-ETG-Nonce']}\nPOST\n${path}\n${o.body}`).digest('hex'));
 assert.ok(!JSON.stringify(request).includes(config.token));assert.equal(o.redirect,'error');
 await assert.rejects(()=>bridge('action',{}));
});
test('join forwards Discord identity, acknowledges first and uses original custom id',async()=>{
 const order=[],id='11111111-1111-1111-1111-111111111111';
 const i={guildId:GUILDS[0],isChatInputCommand:()=>false,isStringSelectMenu:()=>false,isButton:()=>true,customId:'etg:join:'+id,id:'111111111111111111',user:{id:'222222222222222222',username:'test'},deferReply:async()=>order.push('ack'),editReply:async()=>order.push('reply')};
 assert.ok(isSupported(i));
 await handleInteraction(i,async(action,data)=>{order.push('request');assert.equal(action,'interaction');assert.equal(data.userId,i.user.id);assert.equal(data.customId,i.customId);return {text:'완료',url:'https://enjoythegame.kr/home'};},64);
 assert.deepEqual(order,['ack','request','reply']);assert.equal(isSupported({...i,guildId:'1492461447568162876'}),false);
});
test('list and selected event work with current state',async()=>{
 const replies=[],event={id:'11111111-1111-1111-1111-111111111111',title:'내전',status:'모집 중',count:10,url:'https://enjoythegame.kr/home'};
 const i={guildId:GUILDS[0],commandName:'내전',isChatInputCommand:()=>true,isStringSelectMenu:()=>false,isButton:()=>false,deferReply:async()=>{},editReply:async v=>replies.push(v)};
 await handleInteraction(i,async()=>({events:[event]}),64);
 assert.equal(replies[0].components[0].components[0].options.length,1);
 await handleInteraction({...i,isChatInputCommand:()=>false,isStringSelectMenu:()=>true,customId:'etgi:pick',values:[event.id]},async()=>({events:[event]}),64);
 assert.equal(replies[1].components[0].components[0].label,'예약 신청');
});
test('cleanup moves spectators before deleting and rejects unrelated rooms',async()=>{
 const job={guildId:GUILDS[1],eventId:'11111111-1111-1111-1111-111111111111',lobbyId:'111111111111111111',channelIds:['222222222222222222']},cache=new Map([['3',{id:'333333333333333333',channelId:job.channelIds[0]}]]),calls=[];
 const client={isReady:()=>true,guilds:{cache:new Map([[GUILDS[1],{voiceStates:{cache}}]])},rest:{get:async path=>({id:path.split('/').at(-1),guild_id:GUILDS[1],type:2,parent_id:'1566303694104952872',name:'내전 11111111'}),patch:async(path,{body})=>{calls.push('move');cache.get('3').channelId=body.channel_id;},delete:async()=>calls.push('delete')}};
 await cleanup(client,job);assert.deepEqual(calls,['move','delete']);
 await assert.rejects(()=>cleanup(client,{...job,channelIds:[job.lobbyId]}));
 client.rest.get=async()=>({guild_id:GUILDS[1],type:2,parent_id:'999999999999999999',name:'unrelated'});
 await assert.rejects(()=>cleanup(client,job));
});
