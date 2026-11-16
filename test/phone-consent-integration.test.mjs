import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installPremierMembership,PREMIER_MEMBERSHIP as C,PREMIER_CONSENT as T} from '../premier-membership.mjs';
function cjs(name,{dirname,requireImpl,extra=''}={}){
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(new URL('../legacy/systems/'+name,import.meta.url),'utf8')+'\n'+extra,{module,exports:module.exports,require:requireImpl||(()=>({Events:{}})),console:{log(){},error(){}},__dirname:dirname,Map,Set,Date,Intl,setInterval,clearInterval});return module.exports;
}
test('actual legacy consent reactions keep hidden consent source and restore the right roles',async()=>{
 const id='10000000000000001',cache=new Map([[T.terms,{}]]),store=new Map();
 const guild={id:C.team,members:{fetch:async()=>member}};
 const member={id,guild,user:{bot:false,tag:'synthetic'},send:async()=>{},roles:{cache,add:async v=>cache.set(v,{}),remove:async v=>cache.delete(v)}};
 const client={on(){},once(){},guilds:{fetch:async()=>guild},rest:{get:async p=>p.endsWith('/roles')?[{id:'team',name:'발로란트 프리미어 팀'}]:{roles:['team']}}};member.client=client;
 const app=installPremierMembership(client,{readPhone:()=>true,ensurePhoneRoles:async()=>({entered:'phone-entered',missing:'phone-missing'}),consents:{read:id=>store.get(id),write:(id,s)=>store.set(id,{...s})}});
 const handlers=cjs('termsSystem.cjs',{extra:'module.exports.testHandlers={agreePrivacy,disagreeTerms,agreeTerms};'}).testHandlers;
 await handlers.agreePrivacy(member);assert.equal(store.get(id).terms,true,'existing terms not lost during first privacy reaction');assert(cache.has(C.member));assert(!cache.has(T.privacy));assert(!cache.has(C.allTerms));
 await handlers.disagreeTerms(member);assert(!cache.has(C.member));assert(cache.has(T.termsMissing));assert(cache.has(T.privacy));assert(!cache.has(C.allTerms));
 await handlers.agreeTerms(member);assert(cache.has(C.member));assert(!cache.has(T.termsMissing));assert(!cache.has(T.privacy));app.stop();
});
test('phone modal acknowledges then saves private data before immediate membership sync',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etg-phone-modal-')),systems=path.join(dir,'systems'),data=path.join(dir,'data');fs.mkdirSync(systems);fs.mkdirSync(data);
 const file=path.join(data,'userInfo.json'),id='10000000000000001';fs.writeFileSync(file,JSON.stringify({users:{other:{age:20}}}));
 try{
  const module=cjs('phoneSystem.cjs',{dirname:systems,requireImpl:name=>name==='fs'?fs:name==='path'?path:{}}),order=[];let result;
  const interaction={guildId:C.team,user:{id},fields:{getTextInputValue:()=> '01000000000'},deferReply:async()=>order.push('ack'),editReply:async r=>{order.push('reply');result=r;},client:{__syncPremierMembership:async user=>{order.push('sync');assert.equal(user,id);assert.equal(JSON.parse(fs.readFileSync(file)).users[id].phone,'010-0000-0000');return true;}}};
  await module.handlePhoneModal(interaction);assert.deepEqual(order,['ack','sync','reply']);assert(result.content.includes('등록'));assert.equal(JSON.parse(fs.readFileSync(file)).users.other.age,20);
  fs.writeFileSync(file,'{broken');order.length=0;await module.handlePhoneModal(interaction);assert.deepEqual(order,['ack','reply']);assert.equal(fs.readFileSync(file,'utf8'),'{broken');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('legacy join defaults include the dynamic missing-phone role and finish by reconciling',async()=>{
 let listener,ensured=0,reconciled=0;const added=[],cache=new Map();
 const client={on:(name,fn)=>{listener=fn;},__ensurePremierPhoneRoles:async()=>{ensured++;return {missing:'missing'};},__syncPremierMembership:async()=>{reconciled++;}};
 const guild={id:C.team,members:{me:{roles:{highest:{position:100}}}},roles:{cache:{get:id=>({id,name:id,position:1})}}};
 const member={id:'10000000000000001',guild,user:{bot:false,tag:'synthetic'},roles:{cache,add:async r=>{added.push(r.id);cache.set(r.id,r);}}};
 cjs('autoRoleSystem.cjs',{requireImpl:()=>({Events:{GuildMemberAdd:'guildMemberAdd'}})}).startAutoRoleSystem(client);
 await listener(member);assert.equal(ensured,1);assert(added.includes('missing'));assert.equal(reconciled,1);
});
