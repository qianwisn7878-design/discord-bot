const GUILD='1492461447568162876',CATEGORY='1523985107881300038';
async function batch(items,fn){const out=[];for(let n=0;n<items.length;n+=4){const done=await Promise.allSettled(items.slice(n,n+4).map(fn));const failed=done.find(v=>v.status==='rejected');if(failed)throw failed.reason;out.push(...done.map(v=>v.value));}return out;}
export async function executeScrimVoice(client,job){
 if(job.guildId!==GUILD||!['start','begin-match'].includes(job.action)||!/^[a-f0-9-]{36}$/.test(job.eventId||'')||!/^\d{17,20}$/.test(job.actorId||'')||!Array.isArray(job.teamIds)||job.teamIds.length!==2||job.teamIds[0]===job.teamIds[1]||job.teamIds.some(id=>!/^\d{17,20}$/.test(id)))throw Error('스크림 음성 작업을 확인하세요.');
 const guild=client.guilds?.cache.get(GUILD);if(!guild||guild.available===false||!client.isReady())throw Error('봇의 서버 연결을 확인하세요.');
 const [roles,channels,category]=await Promise.all([client.rest.get('/guilds/'+GUILD+'/roles'),client.rest.get('/guilds/'+GUILD+'/channels'),client.rest.get('/channels/'+CATEGORY)]);
 if(category.type!==4||category.guild_id!==GUILD)throw Error('스크림 카테고리를 확인하세요.');
 const teamRoles=job.teamIds.map(id=>roles.find(r=>r.id===id));
 if(teamRoles.some(r=>!r||r.managed||!/^(초청|최상급|상급|중상급|중급|초급)\s*\d+$/.test(r.name)||(BigInt(r.permissions||0)&(8n|32n|268435456n|536870912n))!==0n))throw Error('스크림 하위 팀 역할을 확인하세요.');
 let members=[],after='0',complete=false;
 for(let n=0;n<20;n++){const list=await client.rest.get('/guilds/'+GUILD+'/members?limit=1000&after='+after);if(!Array.isArray(list))throw Error('팀원 조회 응답을 확인하세요.');members.push(...list);if(list.length<1000){complete=true;break;}const next=list.at(-1)?.user?.id;if(!next||next===after)break;after=next;}
 if(!complete)throw Error('팀원 목록을 모두 확인하지 못했습니다.');
 const actor=members.find(m=>m.user?.id===job.actorId);if(!actor||!job.teamIds.some(id=>actor.roles?.includes(id)))throw Error('참가한 두 팀의 소속 회원만 진행할 수 있습니다.');
 const teams={a:[],b:[]};for(const m of members){if(!m.user||m.user.bot)continue;const matching=job.teamIds.map((id,n)=>m.roles?.includes(id)?n:-1).filter(n=>n>=0);if(matching.length>1)throw Error('양쪽 팀 역할을 가진 회원의 역할을 정리하세요.');if(matching.length)teams[matching[0]===0?'a':'b'].push({id:m.user.id,name:m.nick||m.user.global_name||m.user.username||'회원'});}
 if(!teams.a.length||!teams.b.length)throw Error('각 팀의 실제 Discord 소속 회원을 확인하세요.');
 const name=label=>('스크림 '+label+' · '+teamRoles[0].name+' vs '+teamRoles[1].name+' · '+job.eventId.slice(0,8)).slice(0,100);
 const descriptor=c=>({id:c.id,name:c.name,url:'https://discord.com/channels/'+GUILD+'/'+c.id});
 async function voice(label){let c=channels.find(c=>c.type===2&&c.parent_id===CATEGORY&&c.name===name(label));if(!c){c=await client.rest.post('/guilds/'+GUILD+'/channels',{body:{name:name(label),type:2,parent_id:CATEGORY,bitrate:64000,user_limit:0}});channels.push(c);}return descriptor(c);}
 if(job.action==='start')return {voice:await voice('대기실'),teams,channels:{},startedAt:new Date().toISOString()};
 const lobby=channels.find(c=>c.id===job.lobbyId);if(!lobby||lobby.type!==2||lobby.parent_id!==CATEGORY||!lobby.name.startsWith('스크림 ')||!lobby.name.includes(job.eventId.slice(0,8)))throw Error('스크림 대기실을 확인하세요.');
 const existing=['a','b'].map((key,n)=>channels.find(c=>c.type===2&&c.parent_id===CATEGORY&&c.name===name(teamRoles[n].name))?.id).filter(Boolean),allowed=new Set([lobby.id,...existing]);
 const actual={a:teams.a.filter(m=>allowed.has(guild.voiceStates.cache.get(m.id)?.channelId)),b:teams.b.filter(m=>allowed.has(guild.voiceStates.cache.get(m.id)?.channelId))};
 if(!actual.a.length||!actual.b.length)throw Error('양 팀 참가자가 스크림 대기실에 입장한 뒤 경기를 시작하세요.');
 const rooms=await batch(teamRoles,r=>voice(r.name)),roomMap={a:rooms[0],b:rooms[1]};for(const c of rooms)allowed.add(c.id);
 await batch(['a','b'].flatMap(key=>actual[key].map(member=>({key,member}))),async({key,member})=>{if(!client.isReady())throw Error('음성 연결이 끊겼습니다. 다시 확인하세요.');const current=guild.voiceStates.cache.get(member.id)?.channelId;if(!allowed.has(current))throw Error('참가자가 대기실에서 나갔습니다. 입장 상태를 다시 확인하세요.');if(current!==roomMap[key].id)await client.rest.patch('/guilds/'+GUILD+'/members/'+member.id,{body:{channel_id:roomMap[key].id}});});
 const startedAt=new Date().toISOString();return {teams:actual,channels:roomMap,gameStartedAt:startedAt,series:{sets:[{number:1,startedAt,result:null}],wins:{a:0,b:0}}};
}
