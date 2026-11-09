const GUILD='1492461447568162876',VIEW=1024n,FORBIDDEN=8n|32n|268435456n|536870912n;
const pattern=/^(초청|최상급|상급|중상급|중급|초급)\s*([1-9]\d{0,3})$/;
const normalize=name=>String(name||'').normalize('NFKC').replace(/\s/g,'');
const categories=['초청','최상급','상급','중상급','중급','초급'];
const safe=role=>role&&!role.managed&&(BigInt(role.permissions||0)&FORBIDDEN)===0n;
export async function renamePremierTeam(client,job){
 const source=pattern.exec(job.previousName||''),target=pattern.exec(job.teamName||'');
 if(job.guildId!==GUILD||!source||!target||!/^\d{17,20}$/.test(job.roleId||''))throw Error('변경할 하위 팀을 확인하세요.');
 const [roles,channels]=await Promise.all([client.rest.get('/guilds/'+GUILD+'/roles'),client.rest.get('/guilds/'+GUILD+'/channels')]);
 const role=roles.find(r=>r.id===job.roleId),oldName=normalize(job.previousName),newName=normalize(job.teamName);
 if(!safe(role)||![oldName,newName].includes(normalize(role.name)))throw Error('변경할 기존 팀 역할이 일치하지 않습니다.');
 if(roles.some(r=>r.id!==job.roleId&&normalize(r.name)===newName))throw Error('같은 이름의 대상 팀 역할이 이미 있습니다.');
 const parent=name=>{const matches=roles.filter(r=>normalize(r.name)===name);if(matches.length!==1||!safe(matches[0]))throw Error(name+' 상위 역할을 하나로 확인하세요.');return matches[0];};
 const oldParent=parent(source[1]),newParent=parent(target[1]);
 const owned=c=>c.type===4&&(c.permission_overwrites||[]).some(o=>o.id===job.roleId&&Number(o.type)===0&&(BigInt(o.allow||0)&VIEW)!==0n);
 const candidates=channels.filter(c=>owned(c)&&[oldName,newName].includes(normalize(c.name)));
 if(candidates.length!==1)throw Error('기존 팀 카테고리와 팀 역할 권한을 하나로 확인하세요.');
 const category=candidates[0];
 if(job.channels?.categoryId&&job.channels.categoryId!==category.id)throw Error('저장된 팀 카테고리가 일치하지 않습니다.');
 if(channels.some(c=>c.type===4&&c.id!==category.id&&normalize(c.name)===newName))throw Error('같은 이름의 대상 카테고리가 이미 있습니다.');
 const children=channels.filter(c=>c.parent_id===category.id),ids=new Set(children.map(c=>c.id));
 if(job.channels?.channelIds?.some(id=>!ids.has(id)))throw Error('연결된 채널이 카테고리 밖으로 이동했습니다.');
 // Read the full membership before any writes, including reserves and unslotted role holders.
 const members=[];let after='0',complete=false;
 for(let page=0;page<100;page++){
  const batch=await client.rest.get('/guilds/'+GUILD+'/members?limit=1000&after='+after);
  if(!Array.isArray(batch)||batch.some(m=>!m.user?.id||!Array.isArray(m.roles)))throw Error('전체 팀 인원을 확인하지 못했습니다.');
  members.push(...batch.filter(m=>m.roles.includes(job.roleId)));
  if(batch.length<1000){complete=true;break;}
  const next=batch.at(-1).user.id;if(next===after)throw Error('팀 인원 조회가 반복되었습니다.');after=next;
 }
 if(!complete)throw Error('전체 인원을 확인하지 못해 변경을 중단했습니다.');
 const oldText=new RegExp(source[1]+'\\s*'+source[2]+'(?![0-9])','g');
 const changes=children.map(c=>({channel:c,name:c.name.replace(oldText,newName)}));
 if(changes.some(({channel,name})=>name!==channel.name&&children.some(other=>other.id!==channel.id&&other.type===channel.type&&other.name===name)))throw Error('변경 후 채널 이름이 중복됩니다.');
 // IDs, permission overwrites, messages and member assignments remain attached to the same objects.
 for(const {channel,name} of changes)if(name!==channel.name)await client.rest.patch('/channels/'+channel.id,{body:{name}});
 if(category.name!==newName)await client.rest.patch('/channels/'+category.id,{body:{name:newName}});
 if(role.name!==newName)await client.rest.patch('/guilds/'+GUILD+'/roles/'+job.roleId,{body:{name:newName}});
 if(oldParent.id!==newParent.id)for(const member of members){
  if(!member.roles.includes(newParent.id))await client.rest.put('/guilds/'+GUILD+'/members/'+member.user.id+'/roles/'+newParent.id);
  const otherOldTeam=roles.some(r=>r.id!==job.roleId&&member.roles.includes(r.id)&&pattern.exec(r.name||'')?.[1]===source[1]);
  if(member.roles.includes(oldParent.id)&&!otherOldTeam)await client.rest.delete('/guilds/'+GUILD+'/members/'+member.user.id+'/roles/'+oldParent.id);
 }
 // Sort known team categories numerically within each grade; preserve other category positions.
 const sorted=channels.filter(c=>c.type===4&&pattern.test(c.id===category.id?newName:c.name)).map(c=>({...c,name:c.id===category.id?newName:c.name}));
 const positions=sorted.map(c=>c.position).filter(Number.isInteger).sort((a,b)=>a-b);
 sorted.sort((a,b)=>{const x=pattern.exec(a.name),y=pattern.exec(b.name);return categories.indexOf(x[1])-categories.indexOf(y[1])||Number(x[2])-Number(y[2]);});
 if(positions.length===sorted.length&&sorted.length>1)await client.rest.patch('/guilds/'+GUILD+'/channels',{body:sorted.map((c,i)=>({id:c.id,position:positions[i]}))});
 const information=children.filter(c=>c.type===0&&String(c.name).replace(/[^가-힣a-zA-Z0-9]/g,'')==='팀원정보');
 return {categoryId:category.id,channelIds:children.map(c=>c.id),...(information.length===1?{memberInfoChannelId:information[0].id}:{}),memberIds:members.map(m=>m.user.id),name:newName};
}
