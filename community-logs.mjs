export function chatLogContent(message,contentIntent){
 if(message.content)return message.content;
 if(message.partial)return '(삭제·수정 전 내용이 캐시에 없어 확인할 수 없습니다.)';
 const attachments=message.attachments?.size||0,stickers=[...(message.stickers?.values()||[])],embeds=message.embeds||[];
 if(attachments)return '(텍스트 없이 첨부 파일 '+attachments+'개)';
 if(stickers.length)return '(스티커: '+stickers.map(s=>s.name||'스티커').join(', ')+')';
 if(embeds.length)return embeds.map(e=>[e.title,e.description].filter(Boolean).join('\n')).filter(Boolean).join('\n')||'(텍스트 없는 임베드 '+embeds.length+'개)';
 if(contentIntent===false)return '(본문 수신 불가 · 봇의 Message Content Intent 설정을 확인하세요.)';
 return '(텍스트 본문을 받지 못했습니다.)';
}
const GUILD='1554439098490429442',CATEGORY='1564160025788944485';
export const COMMUNITY_LOG_CHANNELS={members:'입장-퇴장-로그',chat:'채팅-로그',voice:'음성-로그',reactions:'반응-로그',roles:'역할-로그'};
export function installCommunityLogs(client){
 const channels=new Map(),queues=new Map();let ensuring=null;
 const clip=(value,max=1000)=>String(value||'(내용 없음)').slice(0,max);
 const channelName=id=>id?'<#'+id+'>':'없음';
 const report=e=>console.error('[커뮤니티 로그]',e.message);
 async function ensureChannels(){
  if(ensuring)return ensuring;
  ensuring=(async()=>{const category=await client.channels.fetch(CATEGORY);if(category?.guildId!==GUILD||category.type!==4)throw Error('커뮤니티 로그 카테고리를 확인하세요.');const guild=category.guild,all=await guild.channels.fetch();for(const [kind,name]of Object.entries(COMMUNITY_LOG_CHANNELS)){let channel=all.find(c=>c?.parentId===CATEGORY&&c.type===0&&c.name===name);if(!channel)channel=await guild.channels.create({name,type:0,parent:CATEGORY,reason:'커뮤니티 운영 로그 채널 설정'});channels.set(kind,channel);}return channels;})().finally(()=>{ensuring=null;});return ensuring;
 }
 function send(kind,title,description,fields=[],color=0xc5f277){
  const task=(queues.get(kind)||Promise.resolve()).catch(()=>{}).then(async()=>{if(!channels.has(kind))await ensureChannels();await channels.get(kind).send({embeds:[{title,description:clip(description,2000),color,fields:fields.slice(0,20).map(f=>({name:clip(f.name,256),value:clip(f.value,1000),inline:f.inline||false})),timestamp:new Date().toISOString()}],allowedMentions:{parse:[]}});});
  queues.set(kind,task);task.catch(report).finally(()=>{if(queues.get(kind)===task)queues.delete(kind);});return task;
 }
 const memberLabel=member=>'<@'+member.id+'> · '+(member.user?.tag||member.user?.username||member.id)+'\nID: '+member.id;
 const attachments=message=>[...(message.attachments?.values()||[])].map(a=>a.url).join('\n');
 const messageFields=message=>[{name:'채널',value:channelName(message.channelId)},{name:'메시지 ID',value:message.id},{name:'내용',value:clip(chatLogContent(message,client.options?.intents?.has(32768))) },...(attachments(message)?[{name:'첨부 파일',value:attachments(message)}]:[])];
 const isMessage=m=>m?.guildId===GUILD&&!m.author?.bot&&!channelsHas(m.channelId);
 const channelsHas=id=>[...channels.values()].some(c=>c.id===id);
 const on=(event,fn)=>client.on(event,(...args)=>{Promise.resolve().then(()=>fn(...args)).catch(report);});
 client.once('clientReady',()=>{if(client.options?.intents?.has(32768)===false)console.warn('[커뮤니티 채팅 로그] Message Content Intent가 연결에 포함되지 않았습니다. Developer Portal → Bot → Privileged Gateway Intents 설정을 확인하고 재시작하세요.');ensureChannels().catch(report);});
 on('guildMemberAdd',m=>{if(m.guild.id===GUILD&&!m.user.bot)return send('members','회원 입장',memberLabel(m),[{name:'계정 생성',value:m.user.createdAt?.toISOString()||'미확인'},{name:'서버 인원',value:String(m.guild.memberCount)}]);});
 on('guildMemberRemove',m=>{if(m.guild.id===GUILD&&!m.user.bot)return send('members','회원 퇴장',memberLabel(m),[{name:'서버 가입',value:m.joinedAt?.toISOString()||'미확인'},{name:'서버 인원',value:String(m.guild.memberCount)}],0xe77979);});
 on('messageCreate',m=>{if(isMessage(m))return send('chat','메시지 작성','<@'+m.author.id+'> · ID: '+m.author.id,messageFields(m));});
 on('messageUpdate',async(old,m)=>{if(m.guildId!==GUILD||m.author?.bot||channelsHas(m.channelId))return;if(m.partial)await m.fetch();if(m.author?.bot||old.content===m.content)return;return send('chat','메시지 수정','<@'+m.author.id+'> · '+m.url,[{name:'채널',value:channelName(m.channelId)},{name:'수정 전',value:chatLogContent(old,client.options?.intents?.has(32768))},{name:'수정 후',value:chatLogContent(m,client.options?.intents?.has(32768))}],0xe6c66d);});
 on('messageDelete',m=>{if(isMessage(m))return send('chat','메시지 삭제',m.author?'<@'+m.author.id+'> · ID: '+m.author.id:'작성자 캐시 없음',messageFields(m),0xe77979);});
 on('messageDeleteBulk',messages=>{for(const m of messages.values())if(isMessage(m))send('chat','메시지 일괄 삭제',m.author?'<@'+m.author.id+'>':'작성자 캐시 없음',messageFields(m),0xe77979);});
 on('voiceStateUpdate',(old,state)=>{const member=state.member||old.member;if(state.guild.id!==GUILD||!member||member.user.bot||old.channelId===state.channelId)return;return send('voice',!old.channelId?'음성방 입장':!state.channelId?'음성방 퇴장':'음성방 이동',memberLabel(member),[{name:'이전 음성방',value:channelName(old.channelId)},{name:'이후 음성방',value:channelName(state.channelId)}]);});
 for(const [event,label]of [['messageReactionAdd','반응 추가'],['messageReactionRemove','반응 취소']])on(event,async(reaction,user)=>{if(user.bot||reaction.message.guildId!==GUILD||channelsHas(reaction.message.channelId))return;if(reaction.partial)await reaction.fetch();return send('reactions',label,'<@'+user.id+'> · ID: '+user.id,[{name:'반응',value:reaction.emoji.toString()},{name:'채널',value:channelName(reaction.message.channelId)},{name:'메시지',value:reaction.message.url||reaction.message.id}]);});
 on('guildMemberUpdate',(old,m)=>{if(m.guild.id!==GUILD||m.user.bot)return;const added=[...m.roles.cache.values()].filter(r=>!old.roles.cache.has(r.id)),removed=[...old.roles.cache.values()].filter(r=>!m.roles.cache.has(r.id));if(!added.length&&!removed.length)return;return send('roles','회원 역할 변경',memberLabel(m),[{name:'추가된 역할',value:added.map(r=>'<@&'+r.id+'> ('+r.name+')').join('\n')||'없음'},{name:'제거된 역할',value:removed.map(r=>'<@&'+r.id+'> ('+r.name+')').join('\n')||'없음'}]);});
 const timer=setInterval(()=>ensureChannels().catch(report),300000);timer.unref?.();
 return {ensureChannels,stop(){clearInterval(timer);}};
}
