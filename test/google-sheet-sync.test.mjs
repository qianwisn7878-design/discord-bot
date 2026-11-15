import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),file=new URL('../legacy/systems/googleSheetSyncSystem.cjs',import.meta.url);
function fixture(useRealAdapter=false){
 const writes=[],reads=[],people=[{id:'111111111111111111',user:{username:'synthetic',bot:false},roles:{cache:new Map()},joinedTimestamp:1}];
 const state={failWrite:false,failProfile:false},sheet={spreadsheets:{values:{
  clear:async()=>{throw Error('must never clear the live sheet');},
  get:async request=>{reads.push(request);return {data:{values:Array.from({length:5},()=>['previous'])}};},
  update:async request=>{if(state.failWrite)throw Error('synthetic sheets outage');writes.push(request);return {data:{}};}
 }}};
 const collection=new Map(people.map(p=>[p.id,p]));
 const client={guilds:{fetch:async()=>({members:{fetch:async()=>{throw Error('Gateway opcode 8 must never be used for sheet synchronization');},list:async()=>collection,cache:new Map()}})},__legacyStatus:{errors:[]},__legacyBridge:async()=>{if(state.failProfile)throw Error('synthetic profile outage');return {profile:{birthYear:2009,gender:'female'},clear:false};}};
 const adapterContext={module:{exports:{}},require,Buffer,URLSearchParams,AbortSignal,fetch:async(url,options)=>{
  if(options.method==='GET'){reads.push({url});return {ok:true,json:async()=>({values:Array.from({length:5},()=>['previous'])})};}
  assert.equal(options.method,'PUT');if(state.failWrite)return {ok:false,status:503};
  const body=JSON.parse(options.body);writes.push({range:body.range,requestBody:body,valueInputOption:new URL(url).searchParams.get('valueInputOption')});return {ok:true};
 }};
 if(useRealAdapter)vm.runInNewContext(readFileSync(new URL('../legacy/google-client.cjs',import.meta.url),'utf8'),adapterContext);
 const context={module:{exports:{}},console:{log(){},error(){}},__dirname:path.dirname(file.pathname),Buffer,setTimeout,clearTimeout,setInterval,require:name=>{
  if(name==='fs')return {existsSync:()=>false};
  if(name==='path')return path;
  if(name==='../google-client.cjs')return {google:{auth:{GoogleAuth:class{async token(){return 'synthetic-test-token';}}},sheets:useRealAdapter?adapterContext.module.exports.google.sheets:()=>sheet}};
  if(name==='./sheet-demographics.cjs')return require('../legacy/systems/sheet-demographics.cjs');
  throw Error('Unexpected require '+name);
 }};
 vm.runInNewContext(readFileSync(file,'utf8'),context,{filename:file.pathname});
 return {client,writes,reads,state,api:context.module.exports};
}
test('one RAW update retains leading-zero birth years and clears only stale trailing rows, without clear()',async()=>{
 const f=fixture();await f.api.syncGoogleSheet(f.client);
 assert.equal(f.writes.length,1);const r=f.writes[0];
 assert.equal(r.valueInputOption,'RAW');assert.equal(r.requestBody.values[1][1],'09');assert.equal(r.requestBody.values[1][4],'여자');
 assert.equal(r.requestBody.values.length,5);assert(r.requestBody.values.slice(2).every(row=>row.length===10&&row.every(cell=>cell==='')));
 assert.equal(r.range,'정보!A1:J5');assert(f.client.__legacyStatus.sheetSyncAt);
});
test('profile and write failures cannot clear the sheet or claim a successful sync',async()=>{
 const f=fixture();f.state.failProfile=true;
 await assert.rejects(f.api.syncGoogleSheet(f.client),/profile outage/);assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);assert(!f.client.__legacyStatus.sheetSyncAt);
 f.state.failProfile=false;f.state.failWrite=true;
 await assert.rejects(f.api.syncGoogleSheet(f.client),/sheets outage/);assert.equal(f.writes.length,0);assert(!f.client.__legacyStatus.sheetSyncAt);
 f.state.failWrite=false;await f.api.syncGoogleSheet(f.client);assert.equal(f.writes.length,1);
});
test('simultaneous sync requests share the same in-flight write',async()=>{
 const f=fixture();await Promise.all([f.api.syncGoogleSheet(f.client),f.api.syncGoogleSheet(f.client)]);assert.equal(f.writes.length,1);
});
test('actual Google adapter supports sheet reads and bounded RAW writes without a trailing clear request',async()=>{
 const f=fixture(true);await f.api.syncGoogleSheet(f.client);
 assert.equal(f.reads.length,1);assert.equal(f.writes.length,1);
 assert.equal(f.writes[0].range,'정보!A1:J5');assert.equal(f.writes[0].valueInputOption,'RAW');
 assert.equal(f.writes[0].requestBody.values[1][1],'09');assert.equal(f.writes[0].requestBody.values[1][4],'여자');
 f.state.failWrite=true;await assert.rejects(f.api.syncGoogleSheet(f.client),/HTTP 503/);
 assert.equal(f.writes.length,1);
});
test('REST pagination uses all current members rather than partial or departed gateway cache entries',async()=>{
 const f=fixture(),requests=[];
 const people=Array.from({length:1001},(_,i)=>({id:String(300000000000000000n+BigInt(i)),user:{username:'synthetic-'+i,bot:i===999},roles:{cache:new Map()},joinedTimestamp:1001-i}));
 f.client.guilds.fetch=async()=>({members:{fetch:async()=>{throw Error('Gateway fetch is forbidden');},cache:new Map([['departed',{user:{username:'stale'}}]]),list:async options=>{requests.push(options);return new Map((options.after==='0'?people.slice(0,1000):people.slice(1000)).map(p=>[p.id,p]));}}});
 await f.api.syncGoogleSheet(f.client);assert.equal(requests.length,2);assert.equal(requests[1].after,people[999].id);
 const rows=f.writes[0].requestBody.values;assert.equal(rows.length,1001);assert.equal(rows[1][0],'synthetic-1000');assert(!rows.some(r=>r[0]==='stale'||r[0]==='synthetic-999'));
});
test('failed or repeating member pages preserve the previous sheet without writing partial rows',async()=>{
 for(const repeat of [false,true]){
  const f=fixture();let calls=0;const people=Array.from({length:1000},(_,i)=>({id:String(300000000000000000n+BigInt(i)),user:{username:'synthetic',bot:false},roles:{cache:new Map()}}));
  f.client.guilds.fetch=async()=>({members:{list:async()=>{if(++calls>1&&!repeat)throw Error('temporary member listing outage');return new Map(people.map(p=>[p.id,p]));}}});
  await assert.rejects(f.api.syncGoogleSheet(f.client));assert.equal(f.writes.length,0);assert.equal(f.reads.length,0);assert(!f.client.__legacyStatus.sheetSyncAt);
 }
});
test('bursts and failures cannot start another automatic sheet run within the minimum interval',async()=>{
 const {createSheetSyncRunner}=require('../legacy/systems/sheet-demographics.cjs');let clock=0,runs=0,release;const timers=[];
 const runner=createSheetSyncRunner({minIntervalMs:30000,now:()=>clock,setTimer:(fn,ms)=>{const timer={fn,ms,unref(){}};timers.push(timer);return timer;},clearTimer(){},run:async()=>{runs++;if(runs===1)await new Promise(resolve=>release=resolve);if(runs===2)throw Error('synthetic outage');}});
 runner.request(0);assert.equal(timers[0].ms,0);const first=timers.shift().fn();clock=500;runner.request(0);runner.request(0);release();await first;
 assert.equal(timers[0].ms,29500);clock=30000;await timers.shift().fn();assert.equal(runs,2);assert.equal(timers[0].ms,30000);
 clock=60000;await timers.shift().fn();assert.equal(runs,3);assert.equal(timers.length,0);runner.stop();
});

