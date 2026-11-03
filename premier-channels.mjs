const GUILD='1492461447568162876',VIEW=1024n;
const teamName=/^(초청|최상급|상급|중상급|중급|초급)\s*[1-9]\d{0,3}$/;
const managerName=name=>/^(매니저|팀 매니저|프리미어 매니저|프리미어 팀 매니저)$/.test(name.trim());
export const teamChannels=name=>[{name:'📅｜일정',type:0},{name:'조합택틱',type:15},{name:'팀원정보',type:0},{name:'피드백',type:0},{name,type:0},{name:name+' 통방',type:2}];
const locks=new Map();
export async function executePremierChannels(client,job){
 if(job.guildId!==GUILD||!/^\d{17,20}$/.test(job.roleId||'')||!teamName.test(job.teamName||'')||!['ensure','delete'].includes(job.action))throw Error('하위 팀 채널 요청을 확인하세요.');
 const previous=locks.get(job.roleId)||Promise.resolve();let release;const pending=new Promise(r=>release=r);locks.set(job.roleId,pending);await previous;
 try{return await run(client,job);}finally{release();if(locks.get(job.roleId)===pending)locks.delete(job.roleId);}
}
async function run(client,job){
 const roles=await client.rest.get('/guilds/'+GUILD+'/roles'),role=roles.find(r=>r.id===job.roleId);
 if(role&&(role.managed||role.name!==job.teamName||!teamName.test(role.name)))throw Error('하위 팀 역할이 일치하지 않습니다.');
 if(job.action==='ensure'&&!role)throw Error('하위 팀 역할이 없습니다.');
 const channels=await client.rest.get('/guilds/'+GUILD+'/channels');
 const owned=c=>c.type===4&&c.name===job.teamName&&(c.permission_overwrites||[]).some(o=>o.id===job.roleId&&Number(o.type)===0&&(BigInt(o.allow||0)&VIEW)!==0n);
 if(job.action==='delete'){
  const manifest=job.channels;if(!manifest?.categoryId||!Array.isArray(manifest.channelIds)||manifest.channelIds.length!==6)throw Error('저장된 팀 채널 정보를 확인하세요.');
  const category=channels.find(c=>c.id===manifest.categoryId),ids=new Set(manifest.channelIds);
  if(category&&!owned(category))throw Error('삭제할 팀 카테고리의 소유 정보를 확인하세요.');
  const targets=channels.filter(c=>ids.has(c.id));
  if(targets.some(c=>c.parent_id!==manifest.categoryId||!teamChannels(job.teamName).some(t=>t.type===c.type&&t.name===c.name)))throw Error('팀 채널 구성이 달라 삭제를 중단했습니다.');
  if(channels.some(c=>c.parent_id===manifest.categoryId&&!ids.has(c.id)))throw Error('카테고리에 별도로 추가된 채널이 있습니다. 먼저 이동하세요.');
  for(const c of targets)await client.rest.delete('/channels/'+c.id);
  if(category)await client.rest.delete('/channels/'+category.id);
  return {deleted:true};
 }
 const managers=roles.filter(r=>!r.managed&&managerName(r.name));if(!managers.length)throw Error('팀 서버에서 매니저 역할을 찾을 수 없습니다.');
 const allow=String(1024n|2048n|65536n|1048576n|2097152n|3145728n|32768n|16384n|34359738368n|68719476736n|274877906944n);
 const overwrites=[{id:GUILD,type:0,allow:'0',deny:String(VIEW)},{id:job.roleId,type:0,allow,deny:'0'},...managers.map(r=>({id:r.id,type:0,allow,deny:'0'})),{id:client.user.id,type:1,allow:String(1024n|16n|2048n|16384n|65536n|268435456n),deny:'0'}];
 const matches=channels.filter(c=>c.type===4&&c.name===job.teamName);if(matches.length>1)throw Error('같은 이름의 팀 카테고리가 여러 개입니다.');
 let category=matches[0];
 if(category&&!owned(category))throw Error('같은 이름의 기존 카테고리가 있습니다. 팀 역할 권한을 확인하세요.');
 if(!category){category=await client.rest.post('/guilds/'+GUILD+'/channels',{body:{name:job.teamName,type:4,permission_overwrites:overwrites}});channels.push(category);}
 else await client.rest.patch('/channels/'+category.id,{body:{permission_overwrites:overwrites}});
 const result=[];
 for(const spec of teamChannels(job.teamName)){
  const existing=channels.filter(c=>c.parent_id===category.id&&c.name===spec.name&&c.type===spec.type);if(existing.length>1)throw Error('중복된 팀 채널이 있습니다.');
  let c=existing[0];if(c)await client.rest.patch('/channels/'+c.id,{body:{permission_overwrites:overwrites}});
  else{c=await client.rest.post('/guilds/'+GUILD+'/channels',{body:{...spec,parent_id:category.id,permission_overwrites:overwrites,...(spec.type===15?{available_tags:[]}: {})}});channels.push(c);}result.push(c.id);
 }
 return {categoryId:category.id,channelIds:result};
}
