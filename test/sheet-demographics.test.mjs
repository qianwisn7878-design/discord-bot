import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {BIRTH_YEARS,installDemographicSync} from '../demographic-sync.mjs';
const require=createRequire(import.meta.url);
const {fromRoles,resolveSheetDemographics,createSheetSyncRunner}=require('../legacy/systems/sheet-demographics.cjs');
const user='111111111111111111';
const member=(names)=>({id:user,roles:{cache:new Map(names.map((name,i)=>['new-'+i,{id:'new-'+i,name}]))}});
test('new role IDs and the full configured 1990–2013 birth-year range resolve without hardcoded IDs',()=>{
 for(const year of [1990,1997,1998,2009,2011,2012,2013]){
  for(const name of [year+'년생',String(year%100).padStart(2,'0')+'년생']){
   assert.deepEqual(fromRoles(member([name,'여자'])),{age:String(year%100).padStart(2,'0'),gender:'여자'});
  }
 }
 assert.deepEqual(fromRoles(member(['2013 년생','남성'])),{age:'13',gender:'남자'});
});
test('fresh website snapshots override lagging or conflicting Discord roles',async()=>{
 const person=member(['10년생','11년생','여자']);
 const client={__getCommunityDemographicProfile:()=>({profile:{birthYear:2009,gender:'male'},fetchedAt:Date.now()}),__legacyBridge:()=>{throw Error('must reuse snapshot');}};
 assert.deepEqual(await resolveSheetDemographics(client,person),{age:'09',gender:'남자'});
});
test('expired snapshots fetch canonical data and failed fetches do not substitute blanks',async()=>{
 let calls=0;const client={__getCommunityDemographicProfile:()=>({profile:{birthYear:2000,gender:'male'},fetchedAt:Date.now()-300001}),__legacyBridge:async(path,body)=>{calls++;assert.equal(body.userId,user);return {profile:{birthYear:2013,gender:'female'}};}};
 assert.deepEqual(await resolveSheetDemographics(client,member([])),{age:'13',gender:'여자'});assert.equal(calls,1);
 client.__legacyBridge=async()=>{throw Error('temporary network failure');};
 await assert.rejects(resolveSheetDemographics(client,member(['09년생','남자'])),/temporary/);
});
test('explicit departure clears fields, while not-yet-migrated users retain role-derived fields',async()=>{
 const client={__legacyBridge:async()=>({profile:null,clear:true})},person=member(['09년생','남자']);
 assert.deepEqual(await resolveSheetDemographics(client,person),{age:'',gender:''});
 client.__legacyBridge=async()=>({profile:null,clear:false});
 assert.deepEqual(await resolveSheetDemographics(client,person),{age:'09',gender:'남자'});
 client.__legacyBridge=async()=>({profile:{birthYear:2013}});
 await assert.rejects(resolveSheetDemographics(client,person),/응답/);
});
test('a failed Discord role update still exposes the saved profile to the sheet and schedules changed data once',async()=>{
 const client=new EventEmitter(),roles=new Map(BIRTH_YEARS.map(y=>['birth-'+y,{id:'birth-'+y,name:y+'년생',managed:false}]));
 roles.set('male',{id:'male',name:'남자'});roles.set('female',{id:'female',name:'여자'});
 const held=new Map([['1566010351177175040',{id:'1566010351177175040',name:'가입자'}],['1566006162112122942',{id:'1566006162112122942',name:'동의'}]]);
 const person={id:user,user:{bot:false},roles:{cache:held,add:async()=>{throw Error('synthetic role update failure');},remove:async()=>{}}};
 const guild={id:'1554439098490429442',roles:{fetch:async()=>roles},members:{fetch:async()=>person}};
 person.guild=guild;client.guilds={cache:new Map([[guild.id,guild]])};client.isReady=()=>true;
 let events=0;client.on('etg:demographics-synced',()=>events++);
 const sync=installDemographicSync(client,async(path,body)=>body.action==='sync'?{eligible:true}:{profile:{birthYear:2013,gender:'female'},clear:false});
 try{
  await assert.rejects(sync.sync(user),/synthetic/);
  assert.deepEqual(client.__getCommunityDemographicProfile(user).profile,{birthYear:2013,gender:'female'});
  assert.deepEqual(await resolveSheetDemographics(client,person),{age:'13',gender:'여자'});assert.equal(events,1);
  await assert.rejects(sync.sync(user));assert.equal(events,1);
 }finally{sync.stop();}
});
test('sheet runner coalesces events, prevents concurrent writes and retries transient failures',async()=>{
 const timers=[],errors=[];let runs=0,active=0,max=0,release;
 const runner=createSheetSyncRunner({setTimer:(fn,ms)=>{const t={fn,ms,unref(){}};timers.push(t);return t;},clearTimer:t=>t.cancelled=true,onError:e=>errors.push(e.message),run:async()=>{runs++;active++;max=Math.max(max,active);try{if(runs===1)await new Promise(r=>release=r);if(runs===2)throw Error('synthetic quota');}finally{active--;}}});
 runner.request();runner.request();assert.equal(timers.length,1);
 const first=timers.shift().fn();runner.request();runner.request();assert.equal(runs,1);release();await first;assert.equal(timers.length,1);
 await timers.shift().fn();assert.equal(runs,2);assert.equal(timers[0].ms,5000);assert.deepEqual(errors,['synthetic quota']);
 await timers.shift().fn();assert.equal(runs,3);assert.equal(max,1);assert.equal(timers.length,0);runner.stop();
});
