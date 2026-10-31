const PREMIER='1492461447568162876';
export const STAFF_ROLE_NAMES=['Owner','Admin','Sub Admin','Moderator'];
export function mergedDepartmentName(name){return String(name).replace(/(^| )(인사)(?=(?: 담당|팀|부)?(?: |$))/g,'$1홍보').replace(/(^| )(감사|사법)(?=(?: 담당|팀|부)?(?: |$))/g,'$1신고 문의');}
export function installStaffStructure(client){
 let running=null;
 async function sync(){
  const guild=client.guilds.cache.get(PREMIER);if(!guild)return;
  const roles=await guild.roles.fetch(),aliases={'오너':'Owner','어드민':'Admin','서브 어드민':'Sub Admin','서브어드민':'Sub Admin','모더레이터':'Moderator','매니저':'Moderator'};
  for(const old of [...roles.values()]){
   if(old.managed)continue;const name=aliases[old.name]||mergedDepartmentName(old.name);if(name===old.name)continue;
   if([...roles.values()].some(role=>role.id!==old.id&&role.name===name)){console.info('[팀 운영진 이름 통합] 기존 동명 역할 유지 · '+old.name);continue;}
   const updated=await old.setName(name,'요청된 팀 운영진·담당 명칭 통합');roles.set(updated.id,updated);
  }
  for(const name of STAFF_ROLE_NAMES)if(![...roles.values()].some(role=>!role.managed&&role.name===name)){const role=await guild.roles.create({name,permissions:0n,mentionable:false,hoist:false,reason:'프리미어 팀 운영진 등급 명칭 추가'});roles.set(role.id,role);}
 }
 function run(){if(!running)running=sync().catch(error=>console.error('[팀 운영진 명칭]',error.code||error.message)).finally(()=>{running=null;});return running;}
 client.once('clientReady',run);const timer=setInterval(run,300000);timer.unref?.();return {run,stop(){clearInterval(timer);}};
}
