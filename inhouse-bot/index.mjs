import {Client,Events,GatewayIntentBits,MessageFlags,ActivityType,REST} from 'discord.js';
import {loadConfig,createBridge,handleInteraction,CLIENT_ID,GUILDS} from './core.mjs';
import {cleanup} from './cleanup.mjs';
let config;try{config=loadConfig();}catch(error){console.error(error.message);process.exit(1);}
const redact=error=>{let value=String(error?.message||error);for(const secret of [config.token,config.secret])value=value.split(secret).join('[숨김]');return value.slice(0,1000);};
const bridge=createBridge(config),client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildVoiceStates],rest:{timeout:15000,retries:2}});
let timer,busy=false,stopping=false;
async function tick(){
 if(busy||stopping||!client.isReady())return;busy=true;
 try{
  const {jobs}=await bridge('work');
  for(const job of jobs||[]){try{await cleanup(client,job);await bridge('complete',{id:job.id,token:job.token});}catch(error){console.error('[내전 음성 정리] '+redact(error));}}
  const result=await bridge('tick');
  if(result.errors?.length)console.error('[내전 공지] '+result.errors.join(' · '));
 }catch(error){console.error('[내전 홈페이지] '+redact(error));}finally{busy=false;}
}
client.once(Events.ClientReady,async ready=>{
 if(ready.user.id!==CLIENT_ID){console.error('내전 전용 토큰과 클라이언트 ID가 다릅니다.');ready.destroy();process.exitCode=1;return;}
 ready.user.setPresence({activities:[{name:'ETG 내전',type:ActivityType.Watching}],status:'online'});
 console.log('내전 전용 봇 온라인: '+ready.user.tag);
 for(const guild of GUILDS){
  if(!ready.guilds.cache.has(guild)){console.warn('[내전 봇] 초대 필요: '+guild);continue;}
  try{await ready.rest.put('/applications/'+CLIENT_ID+'/guilds/'+guild+'/commands',{body:[{name:'내전',description:'홈페이지 내전 목록과 참가·취소 버튼을 확인합니다.',type:1}]});}
  catch(error){console.error('[내전 명령어] '+redact(error));}
 }
 await tick();timer=setInterval(()=>void tick(),15000);
});
client.on(Events.InteractionCreate,async i=>{
 try{await handleInteraction(i,bridge,MessageFlags.Ephemeral);}
 catch(error){const content=redact(error);try{if(i.deferred||i.replied)await i.editReply({content,components:[]});else await i.reply({content,flags:MessageFlags.Ephemeral});}catch{}console.error('[내전 신청] '+content);}
});
client.on(Events.Error,error=>console.error('[내전 Discord] '+redact(error)));
async function stop(){stopping=true;clearInterval(timer);client.destroy();}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 const me=await new REST({version:'10',timeout:15000,retries:2}).setToken(config.token).get('/users/@me');
 if(me.id!==CLIENT_ID)throw Error('내전 전용 토큰과 클라이언트 ID가 다릅니다.');
 await client.login(config.token);
}catch(error){console.error('[내전 시작 실패] '+redact(error));client.destroy();process.exitCode=1;}
