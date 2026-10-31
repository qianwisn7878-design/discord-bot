import fs from 'node:fs';
import path from 'node:path';
const GUILD='1554439098490429442',CHANNEL='1566011543324201052',ENDPOINT='/api/discord-bot/community-registration';
const BUTTON='etg:community-info:open',MODAL='etg:community-info:submit';
export function installCommunityRegistration(client,bridge,{queuePath=path.resolve('community-departures.json')}={}){
 const queues=new Map();let departures={};try{departures=JSON.parse(fs.readFileSync(queuePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const persist=()=>{fs.mkdirSync(path.dirname(queuePath),{recursive:true});fs.writeFileSync(queuePath+'.tmp',JSON.stringify(departures),{mode:0o600});fs.renameSync(queuePath+'.tmp',queuePath);};
 const serial=(id,task)=>{const p=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(task);queues.set(id,p);p.catch(()=>{}).finally(()=>{if(queues.get(id)===p)queues.delete(id);});return p;};
 async function flushDeparture(id){if(!departures[id])return;const at=departures[id];await bridge(ENDPOINT,{action:'left',guildId:GUILD,userId:id,at});if(departures[id]===at){delete departures[id];persist();}}
 let ensuring=null;
 function ensurePanel(){if(ensuring)return ensuring;ensuring=(async()=>{const channel=await client.channels.fetch(CHANNEL);if(channel?.guildId!==GUILD||!channel.isTextBased())throw Error('커뮤니티 가입 채널을 확인하세요.');let before;for(let page=0;page<50;page++){const messages=await channel.messages.fetch({limit:100,...(before?{before}:{})});const existing=messages.find(m=>m.author.id===client.user.id&&(m.content.startsWith('## 2. 정보 입력하기')||m.components.some(row=>row.components.some(c=>c.customId===BUTTON))));const body={content:'## 2. 정보 입력하기',allowedMentions:{parse:[]},components:[{type:1,components:[{type:2,style:1,label:'정보 입력하기',custom_id:BUTTON}]}]};if(existing){await existing.edit(body);return;}if(messages.size<100){await channel.send(body);return;}before=messages.last().id;}throw Error('가입 안내 기록 확인 범위를 초과했습니다.');})().finally(()=>{ensuring=null;});return ensuring;}
 const error=e=>console.error('[커뮤니티 가입]',e.status?'홈페이지 요청 실패 · HTTP '+e.status:e.message);
 client.once('clientReady',()=>{ensurePanel().catch(error);});
 client.on('interactionCreate',async i=>{
  if(i.guildId!==GUILD||i.channelId!==CHANNEL||![BUTTON,MODAL].includes(i.customId))return;
  try{
   if(i.isButton()&&i.customId===BUTTON){await i.showModal({custom_id:MODAL,title:'커뮤니티 가입 정보',components:[{type:1,components:[{type:4,custom_id:'birthDate',label:'생년월일 (YYYY-MM-DD)',style:1,required:true,min_length:10,max_length:10,placeholder:'예: 2008-05-21'}]},{type:1,components:[{type:4,custom_id:'gender',label:'성별 (남성 / 여성)',style:1,required:true,min_length:2,max_length:2,placeholder:'남성 또는 여성'}]}]});return;}
   if(!i.isModalSubmit()||i.customId!==MODAL)return;
   await i.deferReply({flags:64});
   const birthDate=i.fields.getTextInputValue('birthDate').trim(),rawGender=i.fields.getTextInputValue('gender').trim(),gender=rawGender==='남성'?'male':rawGender==='여성'?'female':'';
   if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||!gender){await i.editReply('생년월일은 YYYY-MM-DD, 성별은 남성 또는 여성으로 입력해 주세요.');return;}
   await serial(i.user.id,async()=>{await flushDeparture(i.user.id);await i.guild.members.fetch({user:i.user.id,force:true});await bridge(ENDPOINT,{action:'submit',guildId:GUILD,userId:i.user.id,birthDate,gender,at:Date.now()});});
   await i.editReply('가입 정보를 저장했습니다. 홈페이지 설정 → 개인정보에서 확인할 수 있습니다.');
  }catch(e){if(i.deferred||i.replied)await i.editReply(e.status===400||e.status===409?e.message:'정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.').catch(()=>{});else await i.reply({content:'입력창을 열지 못했습니다. 다시 시도해 주세요.',flags:64}).catch(()=>{});error(e);}
 });
 client.on('guildMemberRemove',member=>{if(member.guild.id!==GUILD||member.user.bot)return;departures[member.id]=Date.now();try{persist();}catch(e){error(e);}serial(member.id,()=>flushDeparture(member.id)).catch(error);});
 const timer=setInterval(()=>{if(client.isReady())ensurePanel().catch(error);for(const id of Object.keys(departures))serial(id,()=>flushDeparture(id)).catch(error);},60000);timer.unref?.();
 return {stop(){clearInterval(timer);},ensurePanel};
}
