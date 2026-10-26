import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executeRelayJob,installDiscordRelay} from '../discord-relay.mjs';
const waitFor=async fn=>{const until=Date.now()+2000;while(!fn()){if(Date.now()>until)throw Error('timed out');await new Promise(r=>setTimeout(r,5));}};
test('channel read reuses validation response without a second Discord request',async()=>{
 let calls=0;const client={rest:{get:async()=>{calls++;return {id:'1523985190790369331',guild_id:'1492461447568162876',type:0,name:'스크림 일정'};}}};
 const result=await executeRelayJob(client,{kind:'rest',method:'GET',path:'/channels/1523985190790369331'});assert.equal(result.status,200);assert.equal(calls,1);
});
test('completed small jobs are delivered while a slow job is still running; failed delivery never repeats the mutation',async()=>{
 let release;const slow=new Promise(r=>release=r),sent=[],calls=[];let initial=true,failDelivery=true;
 const client={isReady:()=>true,rest:{get:async path=>{calls.push(path);if(path==='/users/@me')await slow;if(path.startsWith('/channels/'))return {id:'1523985190790369331',guild_id:'1492461447568162876',type:0,name:'스크림 일정'};return {id:'bot',flags:0};},post:async path=>{calls.push('POST '+path);return {id:'message'};}}};
 const bridge=async(path,body)=>{assert.equal(path,'/api/discord-bot/relay/exchange');assert(body.capacity>=0&&body.capacity<=4);if(initial){initial=false;return {jobs:[{id:'slow',kind:'rest',method:'GET',path:'/users/@me'},{id:'fast',kind:'rest',method:'POST',path:'/channels/1523985190790369331/messages',body:{content:'synthetic'}}]};}if(body.results.length&&failDelivery){failDelivery=false;throw Error('synthetic network loss');}sent.push(...body.results.map(r=>r.id));return {jobs:[]};};
 const relay=installDiscordRelay(client,bridge,{idleMs:5,retryMs:5});
 try{await waitFor(()=>sent.includes('fast'));assert(!sent.includes('slow'));assert.equal(calls.filter(p=>p==='POST /channels/1523985190790369331/messages').length,1);release();await waitFor(()=>sent.includes('slow'));assert.equal(client.relayStatus.processed,2);}finally{release();relay.stop();}
});
