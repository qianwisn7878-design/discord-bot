const COMMUNITY='1554439098490429442';
export const DEMOGRAPHIC_GUILDS=[COMMUNITY,'1554439352652922891','1563217788288499813','1492461447568162876'];
export const BIRTH_YEARS=Array.from({length:24},(_,i)=>2013-i);
export function birthYearOfRole(role){const m=/^(?:(19|20))?(\d{2})년생$/.exec(String(role.name||'').replace(/\s/g,''));if(!m)return null;const year=m[1]?Number(m[1]+m[2]):Number(m[2])>=90?1900+Number(m[2]):2000+Number(m[2]);return BIRTH_YEARS.includes(year)?year:null;}
export async function ensureDemographicRoles(guild){
 const roles=await guild.roles.fetch(),years=new Map();for(const role of roles.values()){const year=birthYearOfRole(role);if(year&&!role.managed&&!years.has(year))years.set(year,role);}
 for(const year of BIRTH_YEARS)if(!years.has(year))years.set(year,await guild.roles.create({name:String(year%100).padStart(2,'0')+'년생',permissions:0n,mentionable:false,hoist:false,reason:'커뮤니티 가입 정보 출생연도 연동'}));
 const genders=new Map();for(const [key,name]of [['male','남자'],['female','여자']]){let role=[...roles.values()].find(r=>!r.managed&&r.name===name);if(!role)role=await guild.roles.create({name,permissions:0n,mentionable:false,hoist:false,reason:'커뮤니티 가입 정보 성별 연동'});genders.set(key,role);}return {years,genders};
}
export async function refreshCommunityEligibility(client,bridge,userId){
 const guild=client.guilds.cache.get(COMMUNITY);if(!guild)return;
 let member;try{member=await guild.members.fetch({user:userId,force:true});}catch(e){if(e.code===10007)return;throw e;}
 if(member.user.bot)return;
 const state=await bridge('/api/discord-bot/community-registration',{action:'sync',guildId:COMMUNITY,userId,agreed:member.roles.cache.has('1566006162112122942'),at:Date.now()});
 if(state.ignored)return;
 if(typeof state.eligible!=='boolean')throw Error('커뮤니티 가입 조건 응답을 확인하지 못했습니다.');
 const add=state.eligible?'1566010351177175040':'1566049064527855666',remove=state.eligible?'1566049064527855666':'1566010351177175040';
 if(!member.roles.cache.has(add))await member.roles.add(add,'나이 예외 및 커뮤니티 가입 조건 재확인');
 if(member.roles.cache.has(remove))await member.roles.remove(remove,'나이 예외 및 커뮤니티 가입 조건 재확인');
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
  await refreshCommunityEligibility(client,bridge,userId);
  const response=await bridge('/api/discord-bot/community-registration',{action:'demographics',guildId:COMMUNITY,userId,at:Date.now()});
  if(!Object.hasOwn(response,'profile')||(response.profile!==null&&(!BIRTH_YEARS.includes(response.profile?.birthYear)||!['male','female'].includes(response.profile?.gender))))throw Error('가입 정보 응답을 확인하지 못했습니다. 기존 역할을 유지합니다.');
  const errors=[];for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;try{const member=await guild.members.fetch({user:userId,force:true});if(!member.user.bot)await apply(member,response.profile);}catch(e){if(e.code!==10007)errors.push(e);}}if(errors.length)throw errors[0];
  pending.delete(userId);
 }
 function schedule(userId){pending.add(userId);if(jobs.has(userId))return jobs.get(userId);const p=sync(userId).finally(()=>jobs.delete(userId));jobs.set(userId,p);p.catch(error);return p;}
 client.__syncCommunityDemographics=schedule;
 client.on('roleDelete',role=>{if(DEMOGRAPHIC_GUILDS.includes(role.guild.id))catalogs.delete(role.guild.id);});
 client.on('guildMemberAdd',member=>{if(DEMOGRAPHIC_GUILDS.includes(member.guild.id)&&!member.user.bot)schedule(member.id).catch(()=>{});});
 client.on('guildMemberRemove',member=>{if(member.guild.id===COMMUNITY)pending.add(member.id);});

 let periodicRunning=false;
 async function sweep(){if(periodicRunning||!client.isReady())return;periodicRunning=true;let synced=0,failed=0;const users=new Set();try{for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(!guild)continue;try{let after='0';for(let page=0;page<100;page++){const batch=await client.rest.get('/guilds/'+id+'/members?limit=1000&after='+after);for(const m of batch)if(!m.user.bot)users.add(m.user.id);if(batch.length<1000)break;after=batch.at(-1).user.id;}}catch(e){failed++;error(e);}}for(const id of users){try{await schedule(id);synced++;}catch{failed++;}}console.log('[가입 정보 역할 연동] 홈페이지 기준 확인 '+users.size+'명 / 완료 '+synced+'명 / 오류 '+failed+'건');}finally{periodicRunning=false;}}
 client.once('clientReady',()=>{void(async()=>{for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(guild)try{await catalog(guild);}catch(e){error(e);}}await sweep();})().catch(error);});const periodic=setInterval(()=>void sweep().catch(error),60000);periodic.unref?.();
 const timer=setInterval(()=>{for(const id of pending)schedule(id).catch(()=>{});for(const id of DEMOGRAPHIC_GUILDS){const guild=client.guilds.cache.get(id);if(guild&&!catalogs.has(id))catalog(guild).catch(error);}},60000);timer.unref?.();
 return {stop(){clearInterval(timer);clearInterval(periodic);},sync:schedule};
}

