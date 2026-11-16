import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {installPremierMembership,premierMembershipPlan,phonePresence,readPhonePresence,ensurePremierPhoneRoles,createConsentStorage,PREMIER_MEMBERSHIP as C,PREMIER_CONSENT as T} from '../premier-membership.mjs';
const PHONE={entered:'phone-entered',missing:'phone-missing'};
test('approval follows community team alone; member requires consent and phone too',()=>{
 for(const terms of [false,true])for(const community of [false,true])for(const phone of [false,true]){
  const p=premierMembershipPlan(terms,community,phone);
  assert.equal(p.approved,community);assert.equal(p.pending,!community);assert.equal(p.member,terms&&community&&phone);
 }
});
test('phone presence supports legacy aliases and treats explicit clear as missing',()=>{
 const id='10000000000000001';
 for(const value of [undefined,null,'','   ','미입력','없음'])assert.equal(phonePresence({users:{[id]:{phone:value}}},id),false);
 assert.equal(phonePresence({users:{[id]:{phone:'010-0000-0000'}}},id),true);
 assert.equal(phonePresence({[id]:{연락처:'010-0000-0000'}},id),true);
 assert.equal(phonePresence({users:{[id]:{phone:'',연락처:'010-0000-0000'}}},id),false);
 assert.equal(phonePresence({users:{}},id),false);
});
function setup({phone=false,community=true,terms=false}={}){
 const events=new Map(),roles=new Map([[C.pending,{}]]),changes=[],stored=new Map();let failed=false;
 if(terms)roles.set(C.allTerms,{});
 const consents={read:id=>stored.get(id),write:(id,state)=>stored.set(id,{...state})};
 const member={id:'10000000000000001',user:{bot:false},roles:{cache:roles,
  add:async value=>{for(const id of Array.isArray(value)?value:[value]){roles.set(id,{});changes.push(['add',id]);}},
  remove:async id=>{roles.delete(id);changes.push(['remove',id]);}}};
 const guild={id:C.team,members:{fetch:async options=>{assert.equal(typeof options.user,'string','never use full Gateway fetch');return member;}}};member.guild=guild;
 const client={on:(name,fn)=>{events.set(name,fn);},once:()=>{},isReady:()=>true,guilds:{fetch:async()=>guild},rest:{get:async p=>{
  if(p.startsWith('/guilds/'+C.team+'/members?'))return [{user:{id:member.id,bot:false}}];
  if(p.endsWith('/roles'))return [{id:'community-team',name:'발로란트 프리미어 팀'}];
  if(failed)throw {status:503};if(!community)throw {status:404};return {roles:['community-team']};
 }}};
 const app=installPremierMembership(client,{readPhone:()=>phone,ensurePhoneRoles:async()=>PHONE,consents});
 return {app,client,member,roles,changes,stored,events,setPhone:v=>phone=v,setCommunity:v=>community=v,setFailed:v=>failed=v};
}
test('existing empty phone removes stale input/member roles and gives missing automatically',async()=>{
 const s=setup({terms:true});s.roles.set(PHONE.entered,{});s.roles.set(C.member,{});s.roles.set('unrelated',{});
 await s.app.sweep();assert(s.roles.has(PHONE.missing));assert(!s.roles.has(PHONE.entered));assert(!s.roles.has(C.member));
 assert(s.roles.has(C.approved));assert(!s.roles.has(C.pending));assert(s.roles.has('unrelated'));s.app.stop();
});
test('complete member compacts consent roles, stays stable, and restores them when phone disappears',async()=>{
 const s=setup({phone:true,terms:true});await s.app.schedule(s.member.id);
 assert(s.roles.has(C.member));assert(s.roles.has(C.approved));assert(s.roles.has(PHONE.entered));
 for(const id of [...Object.values(T),C.allTerms])assert(!s.roles.has(id));
 const count=s.changes.length;await s.app.schedule(s.member.id);assert.equal(s.changes.length,count,'hidden consent roles must not cause a loop');
 s.setPhone(false);await s.app.schedule(s.member.id);
 assert(!s.roles.has(C.member));assert(s.roles.has(PHONE.missing));assert(s.roles.has(T.terms));assert(s.roles.has(T.privacy));assert(s.roles.has(C.allTerms));
 s.setPhone(true);await s.app.schedule(s.member.id);assert(s.roles.has(C.member));for(const id of [...Object.values(T),C.allTerms])assert(!s.roles.has(id));s.app.stop();
});
test('withdrawing one consent restores correct mixed consent roles and removes member',async()=>{
 const s=setup({phone:true,terms:true});await s.app.schedule(s.member.id);
 s.client.__setPremierConsent(s.member.id,'terms',false);await s.app.schedule(s.member.id);
 assert(!s.roles.has(C.member));assert(s.roles.has(C.approved));assert(s.roles.has(T.termsMissing));assert(s.roles.has(T.privacy));assert(!s.roles.has(C.allTerms));
 s.client.__setPremierConsent(s.member.id,'terms',true);await s.app.schedule(s.member.id);assert(s.roles.has(C.member));s.app.stop();
});
test('community departure restores terms indicators but makes approval pending',async()=>{
 const s=setup({phone:true,terms:true});await s.app.schedule(s.member.id);s.setCommunity(false);await s.app.schedule(s.member.id);
 assert(!s.roles.has(C.member));assert(!s.roles.has(C.approved));assert(s.roles.has(C.pending));assert(s.roles.has(T.terms));assert(s.roles.has(T.privacy));s.app.stop();
});
test('community API failure preserves established approval and retries successfully',async()=>{
 const s=setup({phone:true,terms:true});await s.app.schedule(s.member.id);s.setFailed(true);
 assert.equal(await s.app.schedule(s.member.id),false);assert(s.roles.has(C.approved));assert(s.roles.has(C.member));
 s.setFailed(false);assert.equal(await s.app.schedule(s.member.id),true);s.app.stop();
});
test('new arrival receives missing as a default and approval independent of local terms',async()=>{
 const s=setup();s.events.get('guildMemberAdd')(s.member);await new Promise(r=>setImmediate(r));await s.app.schedule(s.member.id);
 assert(s.roles.has(PHONE.missing));assert(s.roles.has(C.approved));assert(!s.roles.has(C.member));assert(s.roles.has(T.termsMissing));assert(s.roles.has(T.privacyMissing));s.app.stop();
});
test('phone role creation uses zero permissions and reuses existing roles',async()=>{
 const roles=new Map(),created=[],guild={id:C.team,roles:{fetch:async()=>roles,create:async options=>{created.push(options);const role={id:'role-'+created.length,name:options.name,permissions:{bitfield:0n}};roles.set(role.id,role);return role;}}};
 const a=await ensurePremierPhoneRoles(guild),b=await ensurePremierPhoneRoles(guild);assert.deepEqual(a,b);assert.equal(created.length,2);assert(created.every(x=>x.permissions===0n&&!x.mentionable));
 roles.get(a.entered).permissions.bitfield=8n;await assert.rejects(()=>ensurePremierPhoneRoles(guild));
});
test('private source persists compacted consent without losing phone or other users; corruption fails closed',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etg-phone-')),file=path.join(dir,'userInfo.json'),id='10000000000000001';
 try{
  fs.writeFileSync(file,JSON.stringify({users:{[id]:{phone:'010-0000-0000',gender:'synthetic'},other:{age:20}}}));
  const storage=createConsentStorage(file);storage.write(id,{terms:true,privacy:true,compacted:true});
  assert.equal(readPhonePresence(id,file),true);assert.equal(storage.read(id).compacted,true);
  const data=JSON.parse(fs.readFileSync(file));assert.equal(data.users.other.age,20);assert.equal(data.users[id].gender,'synthetic');
  fs.writeFileSync(file,'{broken');assert.throws(()=>readPhonePresence(id,file));assert.throws(()=>storage.write(id,{terms:false,privacy:false}));assert.equal(fs.readFileSync(file,'utf8'),'{broken');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('missing contact or withdrawn consent revokes member even during community API outage',async()=>{
 for(const kind of ['phone','terms']){
  const s=setup({phone:true,terms:true});await s.app.schedule(s.member.id);s.setFailed(true);
  if(kind==='phone')s.setPhone(false);else s.client.__setPremierConsent(s.member.id,'terms',false);
  await s.app.schedule(s.member.id);assert(!s.roles.has(C.member));assert(s.roles.has(C.approved));
  assert(s.roles.has(kind==='terms'?T.termsMissing:T.terms));assert(s.roles.has(T.privacy));s.app.stop();
 }
});
test('consent persistence never shadows legacy flat phone records with empty wrapped users',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etg-flat-phone-')),file=path.join(dir,'userInfo.json'),id='10000000000000001';
 try{fs.writeFileSync(file,JSON.stringify({users:{},[id]:{phone:'010-0000-0000'}}));createConsentStorage(file).write(id,{terms:true,privacy:true,compacted:true});assert.equal(readPhonePresence(id,file),true);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
