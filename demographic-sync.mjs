const COMMUNITY='1554439098490429442';
export const DEMOGRAPHIC_GUILDS=[COMMUNITY,'1554439352652922891','1563217788288499813','1492461447568162876'];
export const BIRTH_YEARS=Array.from({length:23},(_,i)=>2012-i);
export function birthYearOfRole(role){const m=/^(?:(19|20))?(\d{2})년생$/.exec(String(role.name||'').replace(/\s/g,''));if(!m)return null;const year=m[1]?Number(m[1]+m[2]):Number(m[2])>=90?1900+Number(m[2]):2000+Number(m[2]);return BIRTH_YEARS.includes(year)?year:null;}
export async function ensureDemographicRoles(guild){
 const roles=await guild.roles.fetch(),years=new Map();for(const role of roles.values()){const year=birthYearOfRole(role);if(year&&!role.managed&&!years.has(year))years.set(year,role);}
 for(const year of BIRTH_YEARS)if(!years.has(year))years.set(year,await guild.roles.create({name:String(year%100).padStart(2,'0')+'년생',permissions:0n,mentionable:false,hoist:false,reason:'커뮤니티 가입 정보 출생연도 연동'}));
 const genders=new Map();for(const [key,name]of [['male','남자'],['female','여자']]){let role=[...roles.values()].find(r=>!r.managed&&r.name===name);if(!role)role=await guild.roles.create({name,permissions:0n,mentionable:false,hoist:false,reason:'커뮤니티 가입 정보 성별 연동'});genders.set(key,role);}return {years,genders};
}
export function installDemographicSync(client,bridge){
 const catalogs=new Map(),catalogJobs=new Map(),jobs=new Map(),pending=new Set();
 const error=e=>console.error('[가입 정보 역할 연동]',e.code?'Discord 오류 '+e.code:e.status?'홈페이지 오류 '+e.status:e.message);
 async function catalog(guild){if(catalogs.has(guild.id))return catalogs.get(guild.id);if(catalogJobs.has(guild.id))return catalogJobs.get(guild.id);const p=ensureDemographicRoles(guild).then(result=>{catalogs.set(guild.id,result);return result;}).finally(()=>catalogJobs.delete(guild.id));catalogJobs.set(guild.id,p);return p;}
 async function apply(member,profile){
  const roles=await catalog(member.guild),wanted=new Set();if(profile){const age=roles.years.get(profile.birthYear),gender=roles.genders.get(profile.gender);if(age)wanted.add(age.id);if(gender)wanted.add(gender.id);}
  const managed=[...member.roles.cache.values()].filter(r=>birthYearOfRole(r)||['남자','여자','남성','여성'].includes(r.name));
  const remove=managed.filter(r=>!wanted.has(r.id)).map(r=>r.id),add=[...wanted].filter(id=>!member.roles.cache.has(id));
  for(const id of add)await member.roles.add(id,'커뮤니티 가입 정보 자동 연동');for(const id of remove)await member.roles.remove(id,'가입 정보와 일치하지 않는 역할 정리');
 }
 async function sync(userId){
  const response=await bridge('/api/discord-bot/community-registration',{action:'demographics',guildId:COMMUNITY,userId,at:Date.now()});
  for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;try{const member=await guild.members.fetch({user:userId,force:true});if(!member.user.bot&&(response.profile||response.clear))await apply(member,response.profile);}catch(e){if(e.code!==10007)throw e;}}
  pending.delete(userId);
 }
 function schedule(userId){pending.add(userId);if(jobs.has(userId))return jobs.get(userId);const p=sync(userId).finally(()=>jobs.delete(userId));jobs.set(userId,p);p.catch(error);return p;}
 client.__syncCommunityDemographics=schedule;
 client.on('roleDelete',role=>{if(DEMOGRAPHIC_GUILDS.includes(role.guild.id))catalogs.delete(role.guild.id);});
 client.on('guildMemberAdd',member=>{if(DEMOGRAPHIC_GUILDS.includes(member.guild.id)&&!member.user.bot)schedule(member.id).catch(()=>{});});
 client.on('guildMemberRemove',member=>{if(member.guild.id===COMMUNITY)pending.add(member.id);});
 client.once('clientReady',()=>{(async()=>{const users=new Set();for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;try{await catalog(guild);const members=await guild.members.fetch();for(const member of members.values())if(!member.user.bot)users.add(member.id);}catch(e){error(e);}}for(const id of users)await schedule(id).catch(()=>{});})().catch(error);});
 const timer=setInterval(()=>{for(const id of pending)schedule(id).catch(()=>{});for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(guild&&!catalogs.has(id))catalog(guild).catch(error);}},60000);timer.unref?.();
 return {stop(){clearInterval(timer);},sync:schedule};
}
