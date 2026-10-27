import {STATIC_DISCORD_IDS} from './relay-policy.mjs';
import {executeScrimVoice} from './scrim-voice-relay.mjs';
const GUILDS=new Set(['1492461447568162876','1554439098490429442','1554439352652922891','1563217788288499813','1477820654739787858']);
const outboundDMs=new Set();
const publicChannel=name=>new Set(['📣・공지-소식','📝・모집-게시판','📅・일정-이벤트']).has(name)||String(name||'').includes('포인트-상점');
const managedName=name=>/^(내전|스크림|[AB]팀)\s/.test(name||'')||/^밴픽-[a-f0-9]{8}$/.test(name||'');
const forbiddenPermissions=8n|32n|268435456n|536870912n;
export async function validateRelayJob(client,job){
 if(job.kind==='cleanup-voices'||job.kind==='scrim-voice')return;
 if(job.kind!=='rest'||!['GET','POST','PATCH','PUT','DELETE'].includes(job.method)||typeof job.path!=='string'||job.path.length>2000||/[\\#]|%2f|%5c|\.\./i.test(job.path))throw Error('허용되지 않은 봇 작업입니다.');
 if(job.files?.length>2||job.files?.some(f=>typeof f.base64!=='string'||f.base64.length>2900000||!['image/png','image/jpeg','image/webp'].includes(f.type)))throw Error('허용되지 않은 첨부 파일입니다.');
 const path=job.path.split('?')[0],parts=path.split('/').filter(Boolean),body=job.body||{};
 if(path==='/users/@me'&&job.method==='GET'||path==='/oauth2/applications/@me'&&job.method==='GET')return;
 if(path==='/users/@me/channels'&&job.method==='POST'){
  if(!/^\d{17,20}$/.test(body.recipient_id||''))throw Error('수신자를 확인하세요.');
  for(const id of GUILDS){try{await client.rest.get('/guilds/'+id+'/members/'+body.recipient_id);return;}catch{}}
  throw Error('ETG 서버 회원에게만 전달할 수 있습니다.');
 }
 if(parts[0]==='guilds'){
  if(!GUILDS.has(parts[1]))throw Error('ETG 서버 외에는 접근할 수 없습니다.');
  if(parts.length===2&&job.method==='GET')return {prefetched:channel};
  if(parts[2]==='roles'){
   if(body.permissions!==undefined&&(BigInt(body.permissions)&forbiddenPermissions)!==0n)throw Error('관리자 권한 역할은 홈페이지에서 만들 수 없습니다.');
   if(parts[3]&&job.method==='DELETE'){const roles=await client.rest.get('/guilds/'+parts[1]+'/roles'),role=roles.find(r=>r.id===parts[3]);if(role&&(role.managed||(BigInt(role.permissions)&forbiddenPermissions)!==0n||!/^(초청|최상급|상급|중상급|중급|초급)\s*\d+$/.test(role.name)))throw Error('하위 팀 역할만 삭제할 수 있습니다.');}
   if(parts.length<=4)return;
  }
  if(parts[2]==='members'){
   if(job.method==='GET')return;
   if(parts[4]==='roles'&&parts[5]&&['PUT','DELETE'].includes(job.method)){const roles=await client.rest.get('/guilds/'+parts[1]+'/roles'),role=roles.find(r=>r.id===parts[5]);if(!role||role.managed||(BigInt(role.permissions)&forbiddenPermissions)!==0n)throw Error('관리자 권한 역할은 Discord에서 직접 관리하세요.');return;}
   if(job.method==='PATCH'&&parts.length===4&&Object.keys(body).every(key=>key==='channel_id')){const c=await client.rest.get('/channels/'+body.channel_id);if(c.guild_id===parts[1]&&c.type===2&&managedName(c.name))return;}
  }
  if(parts[2]==='voice-states'&&job.method==='GET')return;
  if(parts[2]==='channels'&&job.method==='GET')return;
  if(parts[2]==='channels'&&job.method==='POST'&&[0,2].includes(body.type)&&(managedName(body.name)||body.type===0&&publicChannel(body.name))&&(!body.parent_id||STATIC_DISCORD_IDS.has(body.parent_id))){if(body.permission_overwrites?.some(o=>(BigInt(o.allow||0)&forbiddenPermissions)!==0n))throw Error('허용되지 않은 채널 권한입니다.');return;}
 }
 if(parts[0]==='channels'&&/^\d{17,20}$/.test(parts[1]||'')){
  const channel=await client.rest.get('/channels/'+parts[1]);
  if(channel.type===1){if(parts[2]==='messages'&&job.method==='POST'&&outboundDMs.has(channel.id))return;throw Error('DM 조회·수정은 허용하지 않습니다.');}
  if(!GUILDS.has(channel.guild_id)||(!STATIC_DISCORD_IDS.has(channel.id)&&!managedName(channel.name)&&!publicChannel(channel.name)))throw Error('허용된 ETG 채널만 접근할 수 있습니다.');
  if(parts.length===2&&job.method==='GET')return {prefetched:channel};
  if(parts.length===2&&job.method==='DELETE'&&[0,2].includes(channel.type)&&managedName(channel.name))return;
  if(parts[2]==='messages'&&parts.length<=4){if(parts[3]&&['PATCH','DELETE'].includes(job.method)){const message=await client.rest.get('/channels/'+parts[1]+'/messages/'+parts[3]);if(message.author?.id!==client.user.id)throw Error('봇이 작성한 메시지만 수정·삭제할 수 있습니다.');}return;}
  if(parts[2]==='invites'&&job.method==='POST'&&channel.type===2&&managedName(channel.name))return;
  if(parts[2]==='permissions'&&['PUT','DELETE'].includes(job.method)&&STATIC_DISCORD_IDS.has(parts[3])&&(BigInt(body.allow||0)&forbiddenPermissions)===0n)return;
 }
 throw Error('보안 정책에서 허용하지 않은 Discord 작업입니다.');
}
async function cleanupVoices(client,job){
 if(!GUILDS.has(job.guildId)||!Array.isArray(job.channelIds)||job.channelIds.length>2||!/^[a-f0-9-]{36}$/.test(job.eventId||''))throw Error('음성방 정리 요청을 확인하세요.');
 const lobby=await client.rest.get('/channels/'+job.lobbyId);if(lobby.guild_id!==job.guildId||lobby.type!==2||!managedName(lobby.name)||!lobby.name.includes(job.eventId.slice(0,8)))throw Error('스크림 대기실을 확인하세요.');
 const targets=[];for(const id of job.channelIds){let c;try{c=await client.rest.get('/channels/'+id);}catch(error){if(error.status===404)continue;throw error;}if(c.guild_id!==job.guildId||c.type!==2||!managedName(c.name)||!c.name.includes(job.eventId.slice(0,8)))throw Error('정리할 팀 음성방을 확인하세요.');targets.push(id);}
 const guild=client.guilds.cache.get(job.guildId);if(!guild)throw Error('봇의 서버 연결을 확인하세요.');
 for(let pass=0;pass<3;pass++){const states=[...guild.voiceStates.cache.values()].filter(s=>targets.includes(s.channelId));for(const state of states){let current;try{current=await client.rest.get('/guilds/'+job.guildId+'/voice-states/'+state.id);}catch(error){if(error.status===404)continue;throw error;}if(targets.includes(current?.channel_id))await client.rest.patch('/guilds/'+job.guildId+'/members/'+state.id,{body:{channel_id:job.lobbyId}});}if(!states.length)break;}
 for(const state of guild.voiceStates.cache.values())if(targets.includes(state.channelId)){const current=await client.rest.get('/guilds/'+job.guildId+'/voice-states/'+state.id).catch(()=>null);if(targets.includes(current?.channel_id))throw Error('팀 음성방에 인원이 남아 있어 유지합니다. 다시 정리하세요.');}
 for(const id of targets)await client.rest.delete('/channels/'+id);
 return {ok:true};
}
export async function executeRelayJob(client,job){try{const validated=await validateRelayJob(client,job);if(job.kind==='scrim-voice')return {status:200,body:await executeScrimVoice(client,job)};if(job.kind==='cleanup-voices')return {status:200,body:await cleanupVoices(client,job)};const files=(job.files||[]).map(f=>({data:Buffer.from(f.base64,'base64'),name:f.name,contentType:f.type})),options={...(job.body?{body:job.body}:{}),...(files.length?{files}:{})};let body=validated?.prefetched||await client.rest[job.method.toLowerCase()](job.path,options);if(job.path==='/users/@me/channels'&&body?.id)outboundDMs.add(body.id);if(job.path==='/oauth2/applications/@me')body={id:body.id,flags:body.flags,flags_new:body.flags_new};return {status:job.method==='DELETE'?204:200,body:body??null};}catch(error){return {status:Number.isInteger(error.status)&&error.status>=400&&error.status<=599?error.status:403,body:{message:String(error.rawError?.message||error.message||'봇 작업 실패').slice(0,250),code:typeof error.code==='number'?error.code:undefined}};}}
export function installDiscordRelay(client,bridge,{idleMs=1000,retryMs=5000}={}){
 let running=false,stopped=false,timer=null,timerAt=Infinity,wakeRequested=false;
 const inflight=new Map(),completed=new Map(),results=new Map();
 client.relayStatus={ready:false,processed:0,lastAt:null,transport:'exchange-v1'};
 function schedule(ms){if(stopped)return;const at=Date.now()+ms;if(timer&&timerAt<=at)return;clearTimeout(timer);timerAt=at;timer=setTimeout(()=>{timer=null;timerAt=Infinity;void tick();},ms);timer.unref?.();}
 function wake(){if(running)wakeRequested=true;else schedule(0);}
 async function execute(job){try{let result=results.get(job.id);if(!result){result=await executeRelayJob(client,job);results.set(job.id,result);while(results.size>16)results.delete(results.keys().next().value);}completed.set(job.id,{id:job.id,key:job.key,lease:job.lease,...result});}finally{inflight.delete(job.id);wake();}}
 async function tick(){if(running||stopped)return;if(!client.isReady()){schedule(idleMs);return;}if(inflight.size===4&&!completed.size){schedule(idleMs);return;}running=true;wakeRequested=false;let delay=idleMs;
  try{const sending=[...completed.values()].slice(0,4),{jobs=[]}=await bridge('/api/discord-bot/relay/exchange',{results:sending,capacity:4-inflight.size});for(const result of sending){completed.delete(result.id);client.relayStatus.processed++;client.relayStatus.lastAt=new Date().toISOString();}client.relayStatus.ready=true;
   for(const job of jobs){if(inflight.has(job.id))continue;inflight.set(job.id,job);void execute(job);}
  }catch{client.relayStatus.ready=false;delay=retryMs;wakeRequested=false;}
  finally{running=false;schedule(wakeRequested?0:delay);}
 }
 schedule(0);console.log('[봇 중계] exchange-v1 준비');
 return {stop(){stopped=true;clearTimeout(timer);}};
}

