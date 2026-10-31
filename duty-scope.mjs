export const COMMUNITY_GUILD='1554439098490429442';
export const DEPARTMENTS=['홍보','행정','신고 문의','내전','음성 채팅 관리','대회 이벤트','봇 기술 관리'];
const GUILDS=['1554439098490429442','1492461447568162876','1554439352652922891','1563217788288499813'];
export function communityOnlyDuty(name){return /담당(?:\s*(?:총관리자|관리자))?$/.test(name)||name==='부서 총관리자';}
export function rosterSnapshot(guild,members,removed=false){return {guildId:guild.id,occurredAt:Date.now(),roles:[...guild.roles.cache.values()].map(r=>({id:r.id,name:r.name,position:r.position,managed:!!r.managed,permissions:String(r.permissions.bitfield)})),members:members.filter(m=>!m.user.bot).map(m=>({id:m.id,name:m.displayName,roles:[...m.roles.cache.keys()],avatar:m.displayAvatarURL({extension:'png',size:128}),removed}))};}
export async function enforceDutyScope(client,bridge){
 const status={complete:false,removed:0,protected:[],errors:[]};client.dutyScopeStatus=status;
 for(const id of GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;
  try{await guild.roles.fetch();
   if(id===COMMUNITY_GUILD){status.duplicateLeaders=await cleanupEmptyDuplicateLeaders(client,guild);for(const department of DEPARTMENTS){const name=department+' 담당';if(![...guild.roles.cache.values()].some(r=>r.name===name&&!r.managed))await guild.roles.create({name,permissions:0n,mentionable:false,hoist:false});}}
   else for(const role of [...guild.roles.cache.values()]){if(role.managed||!communityOnlyDuty(role.name))continue;if(role.permissions.bitfield!==0n){status.protected.push({guild:id,name:role.name});continue;}await role.delete('공통 담당 역할은 커뮤니티 서버에서만 관리');status.removed++;}
   await bridge('/api/discord-bot/rosters-refresh',rosterSnapshot(guild,[]));
  }catch(error){status.errors.push({guild:id,message:String(error.message).slice(0,150)});}
 }
 status.complete=!status.errors.length&&!status.protected.length;status.at=new Date().toISOString();return status;
}

export async function cleanupEmptyDuplicateLeaders(client,guild){
 if(guild.id!==COMMUNITY_GUILD)return {removed:[],protected:[]};
 const roles=await client.rest.get('/guilds/'+guild.id+'/roles'),channels=await client.rest.get('/guilds/'+guild.id+'/channels'),members=[];let after='0',complete=false;
 for(let page=0;page<20;page++){const batch=await client.rest.get('/guilds/'+guild.id+'/members?limit=1000&after='+after);members.push(...batch);if(batch.length<1000){complete=true;break;}after=batch.at(-1).user.id;}
 if(!complete)throw Error('회원 전체 확인 전에는 중복 역할을 삭제할 수 없습니다.');
 const result={removed:[],protected:[]};
 for(const name of ['커뮤니티 총관리자','발로란트 클랜 총관리자','배그 클랜 총관리자']){
  const target=roles.find(r=>r.name===name.replace(/ 총관리자$/,' 총괄')&&!r.managed);if(!target)continue;
  for(const role of roles.filter(r=>r.name===name)){
   if(role.managed||BigInt(role.permissions||'0')!==0n||members.some(m=>m.roles.includes(role.id))||channels.some(c=>(c.permission_overwrites||[]).some(o=>o.id===role.id))){result.protected.push(name);continue;}
   await client.rest.delete('/guilds/'+guild.id+'/roles/'+role.id,{reason:'기존 총괄 역할과 중복인 빈 총관리자 역할 정리'});result.removed.push(name);
  }
 }
 return result;
}
