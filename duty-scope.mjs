export const COMMUNITY_GUILD='1554439098490429442';
export const DEPARTMENTS=['홍보','행정','인사','신고 문의','내전','음성 채팅 관리','대회 이벤트','감사','사법','봇 기술 관리'];
const GUILDS=['1554439098490429442','1492461447568162876','1554439352652922891','1563217788288499813'];
export function communityOnlyDuty(name){return /담당(?:\s*(?:총관리자|관리자))?$/.test(name)||name==='부서 총관리자';}
export function rosterSnapshot(guild,members,removed=false){return {guildId:guild.id,occurredAt:Date.now(),roles:[...guild.roles.cache.values()].map(r=>({id:r.id,name:r.name,position:r.position,managed:!!r.managed,permissions:String(r.permissions.bitfield)})),members:members.filter(m=>!m.user.bot).map(m=>({id:m.id,name:m.displayName,roles:[...m.roles.cache.keys()],avatar:m.displayAvatarURL({extension:'png',size:128}),removed}))};}
export async function enforceDutyScope(client,bridge){
 const status={complete:false,removed:0,protected:[],errors:[]};client.dutyScopeStatus=status;
 for(const id of GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;
  try{await guild.roles.fetch();
   if(id===COMMUNITY_GUILD){for(const department of DEPARTMENTS){const name=department+' 담당';if(![...guild.roles.cache.values()].some(r=>r.name===name&&!r.managed))await guild.roles.create({name,permissions:0n,mentionable:false,hoist:false});}}
   else for(const role of [...guild.roles.cache.values()]){if(role.managed||!communityOnlyDuty(role.name))continue;if(role.permissions.bitfield!==0n){status.protected.push({guild:id,name:role.name});continue;}await role.delete('공통 담당 역할은 커뮤니티 서버에서만 관리');status.removed++;}
   await bridge('/api/discord-bot/rosters-refresh',rosterSnapshot(guild,[]));
  }catch(error){status.errors.push({guild:id,message:String(error.message).slice(0,150)});}
 }
 status.complete=!status.errors.length&&!status.protected.length;status.at=new Date().toISOString();return status;
}
