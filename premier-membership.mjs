export const PREMIER_MEMBERSHIP={team:'1492461447568162876',community:'1554439098490429442',allTerms:'1552414388491911199',pending:'1566006110593359883',approved:'1566289898120548453',member:'1566291062476251156'};
export function premierMembershipPlan(hasAllTerms,hasCommunityTeam){const approved=hasAllTerms&&hasCommunityTeam;return {approved,pending:!approved,member:hasAllTerms&&approved};}
export function installPremierMembership(client){const C=PREMIER_MEMBERSHIP,queues=new Map(),dirty=new Set(),retry=new Set();let timer,stopped=false,sweeping=false,roleCache=null;
 const gone=e=>e.status===404||e.code===10007||e.code===10004;
 async function communityRole(){if(roleCache&&Date.now()-roleCache.at<60000)return roleCache.id;const roles=await client.rest.get('/guilds/'+C.community+'/roles'),role=roles.find(r=>r.name.replace(/\s+/g,'')==='발로란트프리미어팀'&&!r.managed);roleCache={id:role?.id||null,at:Date.now()};return roleCache.id;}
 async function reconcile(id){const guild=await client.guilds.fetch(C.team);let member;try{member=await guild.members.fetch({user:id,force:true});}catch(e){if(gone(e)){retry.delete(id);return;}throw e;}if(member.user.bot)return;const roleId=await communityRole();let community=null;if(roleId)try{community=await client.rest.get('/guilds/'+C.community+'/members/'+id);}catch(e){if(!gone(e))throw e;}const p=premierMembershipPlan(member.roles.cache.has(C.allTerms),!!roleId&&!!community?.roles?.includes(roleId));const has=new Set(member.roles.cache.keys()),reason='프리미어 팀 가입 조건 자동 확인';
 // Revoke derived access before switching state, then add only the required roles.
 for(const [role,wanted]of [[C.member,p.member],[C.approved,p.approved]])if(!wanted&&has.has(role)){await member.roles.remove(role,reason);has.delete(role);}
 if(p.pending&&!has.has(C.pending)){await member.roles.add(C.pending,reason);has.add(C.pending);}
 if(p.approved&&!has.has(C.approved)){await member.roles.add(C.approved,reason);has.add(C.approved);}
 if(p.member&&!has.has(C.member)){await member.roles.add(C.member,reason);has.add(C.member);}
 if(!p.pending&&has.has(C.pending))await member.roles.remove(C.pending,reason);
 retry.delete(id);
 }
 function schedule(id){if(stopped)return Promise.resolve();dirty.add(id);if(queues.has(id))return queues.get(id);const job=(async()=>{while(dirty.delete(id)&&!stopped){try{await reconcile(id);}catch(e){retry.add(id);console.error('[프리미어 가입 역할]',id,e.code||e.status||e.message);break;}}})();queues.set(id,job);job.finally(()=>{queues.delete(id);if(dirty.has(id)&&!stopped)schedule(id);});return job;}
 async function sweep(){if(stopped||sweeping||!client.isReady())return;sweeping=true;try{let after='0';for(let page=0;page<20;page++){const members=await client.rest.get('/guilds/'+C.team+'/members?limit=1000&after='+after);for(const m of members)if(!m.user.bot)await schedule(m.user.id);if(members.length<1000)break;after=members.at(-1).user.id;}for(const id of retry)await schedule(id);}catch(e){console.error('[프리미어 가입 역할] 전체 확인 대기',e.code||e.status||e.message);}finally{sweeping=false;}}
 client.on('guildMemberAdd',member=>{if(member.user.bot)return;if(member.guild.id===C.team){void (async()=>{try{await member.roles.add(C.pending,'팀 서버 입장 기본 미승인 역할');}catch(e){retry.add(member.id);console.error('[프리미어 가입 역할] 기본 역할 지급 대기');}await schedule(member.id);})();}else if(member.guild.id===C.community)void schedule(member.id);});
 client.on('guildMemberUpdate',(oldMember,member)=>{if(member.user.bot)return;if(member.guild.id===C.team){if([C.allTerms,C.pending,C.approved,C.member].some(role=>oldMember.roles.cache.has(role)!==member.roles.cache.has(role)))void schedule(member.id);}else if(member.guild.id===C.community&&oldMember.roles.cache.size!==member.roles.cache.size||member.guild.id===C.community&&[...oldMember.roles.cache.keys()].some(role=>!member.roles.cache.has(role)))void schedule(member.id);});
 client.on('guildMemberRemove',member=>{if(member.guild.id===C.community&&!member.user.bot)void schedule(member.id);});
 for(const event of ['roleCreate','roleUpdate','roleDelete'])client.on(event,(oldRole,newRole)=>{const role=newRole||oldRole;if(role.guild.id===C.community){roleCache=null;void sweep();}});
 client.once('clientReady',()=>{void sweep();timer=setInterval(()=>void sweep(),60000);timer.unref?.();});
 return {schedule,sweep,stop(){stopped=true;clearInterval(timer);}};
}
