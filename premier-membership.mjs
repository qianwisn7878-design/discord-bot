import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const PREMIER_MEMBERSHIP={team:'1492461447568162876',community:'1554439098490429442',allTerms:'1552414388491911199',pending:'1566006110593359883',approved:'1566289898120548453',member:'1566291062476251156'};
export const PREMIER_CONSENT={terms:'1552414580926455860',termsMissing:'1552411367137349713',privacy:'1552414582402711623',privacyMissing:'1552414146732236830'};
export const PHONE_ROLE_NAMES={entered:'전화번호 입력',missing:'전화번호 미입력'};
export function premierMembershipPlan(hasAllTerms,hasCommunityTeam,hasPhone=false){
 const approved=!!hasCommunityTeam;
 return {approved,pending:!approved,member:!!hasAllTerms&&approved&&!!hasPhone};
}
export function phonePresence(data,id){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('전화번호 저장 파일 형식을 확인하세요.');
 const record=data.users?.[id]??data[id];
 if(!record||typeof record!=='object')return false;
 // A deliberately cleared canonical field must not resurrect an old alias.
 for(const key of ['phone','연락처','전화번호','phoneNumber']){
  if(!Object.hasOwn(record,key))continue;
  const value=record[key];
  if(typeof value!=='string'&&typeof value!=='number')return false;
  const text=String(value).trim();
  return text!==''&&!['없음','미입력','null','undefined','-'].includes(text.toLowerCase());
 }
 return false;
}
export function readPhonePresence(id,file=new URL('./legacy/data/userInfo.json',import.meta.url)){
 let data;try{data=JSON.parse(fs.readFileSync(file,'utf8'));}
 catch{throw Error('전화번호 비공개 저장 파일을 읽지 못했습니다. 역할 확인을 재시도합니다.');}
 return phonePresence(data,id);
}
function userData(file){
 try{const data=JSON.parse(fs.readFileSync(file,'utf8'));if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}
 catch{throw Error('비공개 가입 상태 파일을 확인하지 못했습니다.');}
}
export function createConsentStorage(file=new URL('./legacy/data/userInfo.json',import.meta.url)){
 return {
  read(id){const data=userData(file);return data.users?.[id]?.premierConsent??data[id]?.premierConsent??null;},
  write(id,value){
   const data=userData(file);let record;
   if(data.users?.[id]&&typeof data.users[id]==='object')record=data.users[id];
   else if(data[id]&&typeof data[id]==='object')record=data[id];
   else{data.users??={};data.users[id]={};record=data.users[id];}
   record.premierConsent={terms:!!value.terms,privacy:!!value.privacy,compacted:!!value.compacted};
   const target=file instanceof URL?fileURLToPath(file):path.resolve(file);
   fs.writeFileSync(target+'.tmp',JSON.stringify(data),{mode:0o600});fs.renameSync(target+'.tmp',target);
  }
 };
}
export async function ensurePremierPhoneRoles(guild){
 if(guild.id!==PREMIER_MEMBERSHIP.team)throw Error('프리미어 서버를 확인하세요.');
 const roles=await guild.roles.fetch(),result={};
 for(const [kind,name] of Object.entries(PHONE_ROLE_NAMES)){
  let role=[...roles.values()].find(r=>!r.managed&&r.name===name);
  if(role&&BigInt(role.permissions?.bitfield??role.permissions??0)!==0n)throw Error('전화번호 상태 역할의 권한은 없음으로 설정하세요.');
  if(!role)role=await guild.roles.create({name,permissions:0n,hoist:false,mentionable:false,reason:'프리미어 전화번호 입력 상태 자동 확인'});
  result[kind]=role.id;
 }
 return result;
}
export function installPremierMembership(client,{readPhone=readPhonePresence,ensurePhoneRoles=ensurePremierPhoneRoles,consents=createConsentStorage()}={}){
 const C=PREMIER_MEMBERSHIP,T=PREMIER_CONSENT,queues=new Map(),dirty=new Set(),retry=new Set();
 let timer,stopped=false,sweeping=false,roleCache=null,phoneCache=null,phoneJob=null;
 const gone=e=>e.status===404||e.code===10007||e.code===10004;
 async function phoneRoles(guild){
  if(phoneCache&&Date.now()-phoneCache.at<60000)return phoneCache.roles;
  if(phoneJob)return phoneJob;
  phoneJob=ensurePhoneRoles(guild).then(roles=>{phoneCache={roles,at:Date.now()};return roles;}).finally(()=>{phoneJob=null;});
  return phoneJob;
 }
 async function communityRole(){
  if(roleCache&&Date.now()-roleCache.at<60000)return roleCache.id;
  const roles=await client.rest.get('/guilds/'+C.community+'/roles');
  const role=roles.find(r=>r.name.replace(/\s+/g,'')==='발로란트프리미어팀'&&!r.managed);
  roleCache={id:role?.id||null,at:Date.now()};return roleCache.id;
 }
 function consentOf(member){
  const stored=consents.read(member.id);
  if(stored&&typeof stored.terms==='boolean'&&typeof stored.privacy==='boolean')return stored;
  const roles=member.roles.cache;
  return {terms:!roles.has(T.termsMissing)&&(roles.has(T.terms)||roles.has(C.allTerms)),privacy:!roles.has(T.privacyMissing)&&(roles.has(T.privacy)||roles.has(C.allTerms)),compacted:false};
 }
 function persistConsent(id,value){
  const old=consents.read(id);
  if(!old||old.terms!==value.terms||old.privacy!==value.privacy||old.compacted!==value.compacted)consents.write(id,value);
 }
 async function consentRoles(state,compact,add,remove){
  if(compact){for(const role of [T.terms,T.termsMissing,T.privacy,T.privacyMissing,C.allTerms])await remove(role);return;}
  await remove(state.terms?T.termsMissing:T.terms);await add(state.terms?T.terms:T.termsMissing);
  await remove(state.privacy?T.privacyMissing:T.privacy);await add(state.privacy?T.privacy:T.privacyMissing);
  if(state.terms&&state.privacy)await add(C.allTerms);else await remove(C.allTerms);
 }
 async function reconcile(id){
  const guild=await client.guilds.fetch(C.team);let member;
  try{member=await guild.members.fetch({user:id,force:true});}catch(e){if(gone(e)){retry.delete(id);return true;}throw e;}
  if(member.user.bot)return true;
  const phone=await phoneRoles(guild),present=await readPhone(id),has=new Set(member.roles.cache.keys()),reason='프리미어 가입·전화번호 조건 자동 확인';
  const remove=async role=>{if(has.has(role)){await member.roles.remove(role,reason);has.delete(role);}};
  const add=async role=>{if(!has.has(role)){await member.roles.add(role,reason);has.add(role);}};
  // Never retain member access while the source contact field is empty.
  if(!present)await remove(C.member);
  await remove(present?phone.missing:phone.entered);
  await add(present?phone.entered:phone.missing);
  const consent=consentOf(member);
  if(!present||!consent.terms||!consent.privacy){
   await remove(C.member);persistConsent(id,{...consent,compacted:false});await consentRoles(consent,false,add,remove);
  }
  const roleId=await communityRole();let community=null;
  if(roleId)try{community=await client.rest.get('/guilds/'+C.community+'/members/'+id);}catch(e){if(!gone(e))throw e;}
  const p=premierMembershipPlan(consent.terms&&consent.privacy,!!roleId&&!!community?.roles?.includes(roleId),present&&has.has(phone.entered));
  persistConsent(id,{...consent,compacted:p.member});
  for(const [role,wanted]of [[C.member,p.member],[C.approved,p.approved]])if(!wanted)await remove(role);
  if(p.pending)await add(C.pending);
  if(p.approved)await add(C.approved);
  await consentRoles(consent,p.member,add,remove);
  if(p.member)await add(C.member);
  if(!p.pending)await remove(C.pending);
  retry.delete(id);return true;
 }
 function schedule(id){
  if(stopped)return Promise.resolve(false);dirty.add(id);
  if(queues.has(id))return queues.get(id);
  const job=(async()=>{let ok=true;while(dirty.delete(id)&&!stopped){try{await reconcile(id);}catch(e){retry.add(id);ok=false;console.error('[프리미어 가입 역할]',id,e.code||e.status||e.message);break;}}return ok;})();
  queues.set(id,job);job.finally(()=>{queues.delete(id);if(dirty.has(id)&&!stopped)void schedule(id);});return job;
 }
 async function sweep(){
  if(stopped||sweeping||!client.isReady())return;sweeping=true;
  try{
   const guild=await client.guilds.fetch(C.team);await phoneRoles(guild);
   let after='0',complete=false;
   for(let page=0;page<20;page++){
    const members=await client.rest.get('/guilds/'+C.team+'/members?limit=1000&after='+after);
    if(!Array.isArray(members))throw Error('프리미어 명단 응답을 확인하세요.');
    for(const m of members)if(!m.user.bot)await schedule(m.user.id);
    if(members.length<1000){complete=true;break;}
    const next=members.reduce((max,m)=>BigInt(m.user.id)>BigInt(max)?m.user.id:max,after);
    if(next===after)throw Error('프리미어 명단 페이지가 반복되었습니다.');after=next;
   }
   if(!complete)throw Error('프리미어 명단을 모두 확인하지 못했습니다.');
   for(const id of [...retry])await schedule(id);
  }catch(e){console.error('[프리미어 가입 역할] 전체 확인 대기',e.code||e.status||e.message);}finally{sweeping=false;}
 }
 // The scoped legacy client inherits these hooks; no phone value leaves local storage.
 client.__ensurePremierPhoneRoles=phoneRoles;
 client.__syncPremierMembership=schedule;
 client.__setPremierConsent=(id,kind,value,member)=>{
  if(!['terms','privacy'].includes(kind)||typeof value!=='boolean')throw Error('동의 상태를 확인하세요.');
  const old=consents.read(id)||(member?consentOf(member):{terms:false,privacy:false,compacted:false});
  consents.write(id,{...old,[kind]:value});
 };
 client.on('guildMemberAdd',member=>{
  if(member.user.bot)return;
  if(member.guild.id===C.team)void (async()=>{
   try{consents.write(member.id,{terms:false,privacy:false,compacted:false});}catch{console.error('[프리미어 가입 역할] 재입장 동의 상태 저장 대기');}
   try{const phone=await phoneRoles(member.guild);await member.roles.add([C.pending,phone.missing],'팀 서버 입장 기본 미승인·전화번호 미입력 역할');}
   catch(e){retry.add(member.id);console.error('[프리미어 가입 역할] 기본 역할 지급 대기',e.code||e.status||e.message);}
   await schedule(member.id);
  })();
  else if(member.guild.id===C.community)void schedule(member.id);
 });
 client.on('guildMemberUpdate',(oldMember,member)=>{
  if(member.user.bot)return;
  if(member.guild.id===C.team){
   const watched=[C.allTerms,C.pending,C.approved,C.member,...Object.values(T),...Object.values(phoneCache?.roles||{})];
   if(watched.some(role=>oldMember.roles.cache.has(role)!==member.roles.cache.has(role)))void schedule(member.id);
  }else if(member.guild.id===C.community&&(oldMember.roles.cache.size!==member.roles.cache.size||[...oldMember.roles.cache.keys()].some(role=>!member.roles.cache.has(role))))void schedule(member.id);
 });
 client.on('guildMemberRemove',member=>{if(member.guild.id===C.community&&!member.user.bot)void schedule(member.id);});
 for(const event of ['roleCreate','roleUpdate','roleDelete'])client.on(event,(oldRole,newRole)=>{
  const role=newRole||oldRole;
  if(role.guild.id===C.community){roleCache=null;void sweep();}
  else if(role.guild.id===C.team&&(Object.values(PHONE_ROLE_NAMES).includes(role.name)||Object.values(phoneCache?.roles||{}).includes(role.id))){phoneCache=null;void sweep();}
 });
 client.once('clientReady',()=>{void sweep();timer=setInterval(()=>void sweep(),60000);timer.unref?.();});
 return {schedule,sweep,stop(){stopped=true;clearInterval(timer);}};
}
