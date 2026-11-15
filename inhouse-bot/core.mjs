import {createHmac, randomUUID} from 'node:crypto';
export const CLIENT_ID='1479973832205926523';
export const GUILDS=['1554439098490429442','1554439352652922891'];
export function loadConfig(env=process.env){
 const token=env.DISCORD_BOT_TOKEN?.trim(),secret=env.ETG_INHOUSE_BRIDGE_SECRET?.trim();
 if(!token)throw Error('DISCORD_BOT_TOKEN 환경변수를 입력하세요.');
 if(!secret||secret.length<32)throw Error('ETG_INHOUSE_BRIDGE_SECRET은 새 임의 문자열 32자 이상으로 설정하세요.');
 if((env.DISCORD_CLIENT_ID||CLIENT_ID)!==CLIENT_ID)throw Error('내전 전용 클라이언트 ID가 일치하지 않습니다.');
 const site=new URL(env.ETG_SITE_URL||'https://enjoythegame.kr');
 if(site.protocol!=='https:'||site.hostname!=='enjoythegame.kr'||site.username||site.password||site.port||site.pathname!=='/'||site.search||site.hash)throw Error('ETG_SITE_URL은 https://enjoythegame.kr 로 설정하세요.');
 return {token,secret,site:site.origin,clientId:CLIENT_ID};
}
export function createBridge(config,{fetchImpl=fetch,now=Date.now,nonce=randomUUID}={}){
 return async function bridge(action,data){
  if(!['state','interaction','tick','work','complete'].includes(action))throw Error('허용되지 않은 내전 기능입니다.');
  const method=['state','work'].includes(action)?'GET':'POST',path='/api/discord-bot/inhouse/'+action;
  const raw=method==='GET'?'':JSON.stringify(data||{}),time=String(now()),id=nonce();
  const signature=createHmac('sha256',config.secret).update(`${time}\n${id}\n${method}\n${path}\n${raw}`).digest('hex');
  let response;
  try{response=await fetchImpl(config.site+path,{method,headers:{'Content-Type':'application/json','X-ETG-Timestamp':time,'X-ETG-Nonce':id,'X-ETG-Signature':signature},...(raw?{body:raw}:{}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(90000)});}
  catch{throw Error('홈페이지 연결 지연 · 주소와 서버 상태를 확인하세요.');}
  let out;try{out=await response.json();}catch{throw Error('홈페이지 응답 오류 · HTTP '+response.status);}
  if(!response.ok)throw Error('홈페이지 HTTP '+response.status+' · '+String(out.error||'내전 요청 실패').slice(0,200));
  return out;
 };
}
export function isSupported(i){return GUILDS.includes(i.guildId)&&(i.isChatInputCommand()&&i.commandName==='내전'||i.isStringSelectMenu()&&i.customId==='etgi:pick'||i.isButton()&&/^etg:(join|leave):[a-f0-9-]{36}$/.test(i.customId));}
export function listPayload(events){
 if(!events.length)return {content:'모집 중이거나 진행 중인 내전이 없습니다.',components:[],embeds:[]};
 return {content:'내전을 선택하세요.',components:[{type:1,components:[{type:3,custom_id:'etgi:pick',placeholder:'내전 선택',options:events.slice(0,25).map(e=>({label:e.title.slice(0,100),value:e.id,description:`${e.status} · 참가 ${e.count}/10명`.slice(0,100)}))}]}]};
}
export function eventPayload(e){
 const open=e.status==='모집 중';
 return {content:`${e.title}\n${e.status} · 참가 ${e.count}/10명`,embeds:[],allowedMentions:{parse:[]},components:[{type:1,components:[
  {type:2,style:1,label:e.count>=10?'예약 신청':'참가 신청',custom_id:'etg:join:'+e.id,disabled:!open},
  {type:2,style:4,label:'참가·예약 취소',custom_id:'etg:leave:'+e.id,disabled:!open},
  {type:2,style:5,label:'팀 배정·밴픽·진행',url:e.url}
 ]}]};
}
export async function handleInteraction(i,bridge,ephemeral){
 if(!isSupported(i))return false;
 await i.deferReply({flags:ephemeral});
 if(i.isChatInputCommand()){const {events}=await bridge('state');await i.editReply(listPayload(events));return true;}
 if(i.isStringSelectMenu()){
  const {events}=await bridge('state'),event=events.find(e=>e.id===i.values[0]);
  await i.editReply(event?eventPayload(event):{content:'내전이 종료되었거나 취소되었습니다.',components:[]});return true;
 }
 const result=await bridge('interaction',{interactionId:i.id,guildId:i.guildId,userId:i.user.id,name:i.member?.displayName||i.user.globalName||i.user.username,customId:i.customId});
 await i.editReply({content:result.text,allowedMentions:{parse:[]},components:[{type:1,components:[{type:2,style:5,label:'홈페이지에서 확인',url:result.url}]}]});return true;
}
