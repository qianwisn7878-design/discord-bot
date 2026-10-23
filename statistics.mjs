import {createHmac,randomUUID} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve} from 'node:path';
export const STATISTICS_GUILDS=new Set(['1554439098490429442','1492461447568162876','1554439352652922891','1563217788288499813']);
export const statisticsDay=t=>new Date(t+32400000).toISOString().slice(0,10);
export function createStatisticsCollector({secret,send,now=Date.now,directory=resolve('.etg-statistics')}){
 mkdirSync(directory,{recursive:true});const file=resolve(directory,'outbox.json');let queue=[];try{queue=JSON.parse(readFileSync(file,'utf8'));if(!Array.isArray(queue))queue=[];}catch{}const buckets=new Map();let busy=false;const last=new Map();
 const persist=()=>{writeFileSync(file+'.tmp',JSON.stringify(queue),{mode:0o600});renameSync(file+'.tmp',file);};
 const hash=id=>createHmac('sha256',secret).update('etg-analytics-v1:'+id).digest('hex').slice(0,32);
 const bucket=(guildId,t=now())=>{const day=statisticsDay(t),key=guildId+':'+day;if(!buckets.has(key))buckets.set(key,{guildId,day,batchId:randomUUID(),messages:0,commands:0,voiceSeconds:0,streamSeconds:0,coverageSeconds:0,peakVoice:0,users:[],chatUsers:[],voiceUsers:[],hours:Array(24).fill(0),channels:{},features:{}});return buckets.get(key);};
 const person=(b,id,kind)=>{const h=hash(id);if(!b.users.includes(h))b.users.push(h);if(kind&&!b[kind].includes(h))b[kind].push(h);};
 function activity({guildId,userId,bot=false,kind,channelId,feature}){if(bot||!STATISTICS_GUILDS.has(guildId))return;const b=bucket(guildId);person(b,userId,kind==='message'?'chatUsers':null);if(kind==='message'){b.messages++;b.hours[new Date(now()+32400000).getUTCHours()]++;if(channelId)b.channels[channelId]=(b.channels[channelId]||0)+1;}if(kind==='command'){b.commands++;const label=String(feature||'버튼').replace(/[^\p{L}\p{N}_ -]/gu,' ').slice(0,80)||'기타';b.features[label]=(b.features[label]||0)+1;}}
 function sample(guilds,previous){const end=now();for(const g of guilds){if(!STATISTICS_GUILDS.has(g.id)||g.available===false)continue;const start=Math.max(last.get(g.id)??end,end-120000);last.set(g.id,end);let entries=[...(g.voiceStates?.cache?.values()||[])];if(previous?.guild.id===g.id){entries=entries.filter(s=>s.id!==previous.id);entries.push(previous);}const states=entries.filter(s=>s.channelId&&s.channelId!==g.afkChannelId&&s.member&&!s.member.user.bot);for(let t=start;t<end;){const boundary=Math.floor((t+32400000)/86400000+1)*86400000-32400000,until=Math.min(end,boundary),seconds=Math.floor((until-t)/1000),b=bucket(g.id,t);b.coverageSeconds+=seconds;b.voiceSeconds+=states.length*seconds;b.streamSeconds+=states.filter(s=>s.streaming).length*seconds;b.peakVoice=Math.max(b.peakVoice,states.length);for(const s of states)person(b,s.id,'voiceUsers');t=until;}}}
 async function flush(){if(busy)return;busy=true;try{for(const b of buckets.values())queue.push(b);buckets.clear();const cutoff=statisticsDay(now()-89*86400000);queue=queue.filter(b=>b.day>=cutoff);if(queue.length>17280){console.error('[통계] 전송 대기 3일 한도 초과 · 오래된 미전송 구간은 누락됩니다.');queue=queue.slice(-17280);}persist();while(queue.length){await send('/api/discord-bot/statistics',queue[0]);queue.shift();persist();}}finally{busy=false;}}
 return {activity,sample,flush,pause:()=>last.clear(),pending:()=>queue.length,hash};
}
export function installStatistics(client,bridge,secret,readyEvent){const c=createStatisticsCollector({secret,send:bridge});let timer;
 client.on('messageCreate',m=>c.activity({guildId:m.guildId,userId:m.author.id,bot:m.author.bot,kind:'message',channelId:m.channelId}));
 client.on('voiceStateUpdate',(oldState)=>{if(client.isReady())c.sample([oldState.guild],oldState);});
 client.on('shardDisconnect',()=>c.pause());
 client.on('interactionCreate',i=>{if(i.isChatInputCommand()||i.isButton()||i.isStringSelectMenu()||i.isModalSubmit())c.activity({guildId:i.guildId,userId:i.user.id,bot:i.user.bot,kind:'command',feature:i.isChatInputCommand()?i.commandName:i.customId?.startsWith('etgkb:')?'키보드 주문':i.customId?.startsWith('etg2:')?'ETG 메뉴':'내전 버튼'});});
 client.once(readyEvent,()=>{c.sample(client.guilds.cache.values());timer=setInterval(()=>{if(!client.isReady()){c.pause();return;}c.sample(client.guilds.cache.values());c.flush().catch(()=>console.error('[통계] 전송 대기 중 · 다음 주기에 재시도합니다.'));},60000);timer.unref();c.flush().catch(()=>{});});
 return {stop:async()=>{clearInterval(timer);c.sample(client.guilds.cache.values());await c.flush();}};
}
