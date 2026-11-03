const GUILD='1492461447568162876',VERSION='premier-member-info-v1';
export const MEMBER_SLOTS=[['coach','코치'],['subcoach','서브코치'],...Array.from({length:5},(_,i)=>['main-'+i,'주전 '+(i+1)]),...Array.from({length:2},(_,i)=>['six-'+i,'식스맨 '+(i+1)])];
const id=value=>typeof value==='string'&&/^\d{17,20}$/.test(value);
const teamName=value=>/^(초청|최상급|상급|중상급|중급|초급)\s*[1-9]\d{0,3}$/.test(value||'');
const plain=(value,max=100)=>String(value??'').replace(/[\r\n]/g,' ').slice(0,max);
const escape=value=>plain(value).replace(/([\\*_`~|>])/g,'\\$1');
const marker=(roleId,slot)=>'etg:team-info:v1:'+roleId+':'+slot;
const DAYS=[['mon','월'],['tue','화'],['wed','수'],['thu','목'],['fri','금'],['sat','토'],['sun','일']];
export function activityText(days={}){
 return DAYS.map(([key,label])=>{
  const row=days[key]||{};if(row.status==='unavailable')return label+'요일: 활동 불가';
  if(row.status!=='available'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end||''))return label+'요일: 미설정';
  const condition=({'after-academy':'학원 마치고','after-school':'학교 마치고','after-waking':'일어나면'})[row.startCondition]||(row.startCondition==='other'?escape(row.customCondition):'');
  return label+'요일: '+(condition?condition+' · ':'')+row.start+' ~ '+row.end+(row.end<row.start?' (다음 날 종료)':'');
 }).join('\n');
}
function activityFields(text){
 const fields=[];let current='';
 for(const line of text.split('\n')){
  if(current&&current.length+line.length+1>1024){fields.push(current);current='';}
  current+=(current?'\n':'')+line;
 }
 if(current)fields.push(current);
 return fields.map((value,i)=>({name:'활동시간 · 한국 시간'+(i?' (계속)':''),value,inline:false}));
}
export function memberInfoBody(team,slot,label,member){
 const positions=member?.positions?.map(p=>'**'+escape(p.name)+'**: '+(p.agents?.length?p.agents.map(escape).join(' · '):'선택한 요원 없음')).join('\n')||'미설정';
 return {content:'',embeds:[{title:label+' · '+(member?plain(member.name):'미배정'),description:member?'<@'+member.id+'>':'아직 배정된 팀원이 없습니다.',color:0xb3e96a,fields:[{name:'포지션 · 포지션별 요원',value:(positions+(member?.igl?'\nIGL: 선택함':'')).slice(0,1024),inline:false},...activityFields(member?activityText(member.activityDays):'팀원 배정 후 자동 표시됩니다.')],footer:{text:marker(team.roleId,slot)}}],allowed_mentions:{parse:[]}};
}
const visible=o=>(BigInt(o.allow||0)&1024n)!==0n;
function privateFor(channel,roleId){
 const overwrites=channel.permission_overwrites||[];
 return overwrites.some(o=>o.id===GUILD&&Number(o.type)===0&&(BigInt(o.deny||0)&1024n)!==0n&&!visible(o))&&overwrites.some(o=>o.id===roleId&&Number(o.type)===0&&visible(o));
}
function targetChannel(team,channels,roles,botId){
 const categories=channels.filter(c=>c.type===4&&c.name===team.name&&privateFor(c,team.roleId));
 if(categories.length!==1)throw Error('비공개 팀 카테고리를 하나로 확인할 수 없습니다.');
 const category=categories[0];
 if(team.channels?.categoryId&&team.channels.categoryId!==category.id)throw Error('저장된 팀 카테고리가 일치하지 않습니다.');
 const matches=channels.filter(c=>c.parent_id===category.id&&c.type===0&&c.name.replace(/[\s-]/g,'')==='팀원정보');
 if(matches.length!==1)throw Error('팀원정보 채널을 하나로 확인할 수 없습니다.');
 const channel=matches[0];
 if(team.channels?.channelIds&&!team.channels.channelIds.includes(channel.id))throw Error('연결된 팀원정보 채널이 아닙니다.');
 if(!privateFor(channel,team.roleId))throw Error('팀원정보 채널을 비공개로 설정하세요.');
 const managers=new Set(roles.filter(r=>/^(매니저|팀 매니저|프리미어 매니저|프리미어 팀 매니저)$/.test(r.name?.trim()||'')).map(r=>r.id));
 for(const o of channel.permission_overwrites||[]){
  if(!visible(o)||o.id===team.roleId||o.id===botId||managers.has(o.id))continue;
  const role=roles.find(r=>r.id===o.id);
  if(Number(o.type)===0&&role&&(BigInt(role.permissions||0)&8n)!==0n)continue;
  throw Error('팀원정보 채널에 팀·매니저 외 보기 권한이 있습니다.');
 }
 return channel;
}
function canonical(message){
 return {content:message.content||'',embeds:(message.embeds||[]).map(e=>({title:e.title,description:e.description,color:e.color,fields:(e.fields||[]).map(f=>({name:f.name,value:f.value,inline:Boolean(f.inline)})),footer:{text:e.footer?.text}}))};
}
async function existingMessages(client,channelId,roleId){
 const found=new Map();let before=null;
 for(let page=0;page<20;page++){
  const batch=await client.rest.get('/channels/'+channelId+'/messages?limit=100'+(before?'&before='+before:''));
  if(!Array.isArray(batch))throw Error('명단 메시지를 조회하지 못했습니다.');
  for(const m of batch){
   if(m.author?.id!==client.user.id)continue;
   for(const [slot] of MEMBER_SLOTS)if(!found.has(slot)&&m.embeds?.[0]?.footer?.text===marker(roleId,slot))found.set(slot,m);
  }
  if(found.size===MEMBER_SLOTS.length||batch.length<100)return found;
  const next=batch.at(-1)?.id;if(!id(next)||next===before)throw Error('명단 메시지 조회가 반복되었습니다.');before=next;
 }
 throw Error('이전 명단을 모두 확인하지 못해 중복 게시를 중단했습니다.');
}
const queues=new WeakMap();
export function syncPremierMemberInfo(client,payload){
 if(!payload||payload.version!==VERSION||!Array.isArray(payload.teams))return Promise.resolve({updated:0,errors:[]});
 const previous=queues.get(client)||Promise.resolve();
 const run=previous.catch(()=>{}).then(()=>sync(client,payload));
 queues.set(client,run);return run.finally(()=>{if(queues.get(client)===run)queues.delete(client);});
}
async function sync(client,payload){
 const [roles,channels]=await Promise.all([client.rest.get('/guilds/'+GUILD+'/roles'),client.rest.get('/guilds/'+GUILD+'/channels')]);let updated=0;const errors=[];
 const seen=new Set();
 for(const team of payload.teams){
  try{
   if(!id(team.roleId)||!teamName(team.name)||seen.has(team.roleId))throw Error('팀 명단 정보를 확인하세요.');seen.add(team.roleId);
   const role=roles.find(r=>r.id===team.roleId);if(!role)continue;
   if(role.managed||role.name!==team.name)throw Error('팀 역할이 일치하지 않습니다.');
   const channel=targetChannel(team,channels,roles,client.user.id),messages=await existingMessages(client,channel.id,team.roleId);
   const actual=new Map();
   for(const [slot] of MEMBER_SLOTS){
    const person=team.slots?.[slot];if(!person)continue;if(!id(person.id))throw Error('팀원 ID를 확인하세요.');
    if(!actual.has(person.id)){let member;try{member=await client.rest.get('/guilds/'+GUILD+'/members/'+person.id);}catch(e){if(e.status!==404)throw e;member=null;}actual.set(person.id,Boolean(member?.roles?.includes(team.roleId)));}
   }
   for(const [slot,label] of MEMBER_SLOTS){
    const person=team.slots?.[slot],member=person&&actual.get(person.id)?person:null,body=memberInfoBody(team,slot,label,member),old=messages.get(slot);
    if(old){
     if(JSON.stringify(canonical(old))===JSON.stringify(canonical(body)))continue;
     await client.rest.patch('/channels/'+channel.id+'/messages/'+old.id,{body});
    }else await client.rest.post('/channels/'+channel.id+'/messages',{body});
    updated++;
   }
  }catch(error){errors.push({team:plain(team.name||'팀'),message:String(error.message||error).slice(0,180)});}
 }
 return {updated,errors};
}
