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
 const collection={filter:fn=>({sort:compare=>new Map(people.filter(fn).sort(compare).map(p=>[p.id,p]))})};
 const client={guilds:{fetch:async()=>({members:{fetch:async()=>{},cache:collection}})},__legacyStatus:{errors:[]},__legacyBridge:async()=>{if(state.failProfile)throw Error('synthetic profile outage');return {profile:{birthYear:2009,gender:'female'},clear:false};}};
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
