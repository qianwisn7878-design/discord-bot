import fs from 'node:fs';
import {createInfoPanelRecovery} from './info-panels.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('./legacy/',import.meta.url)),dataDir=path.join(root,'data');
const GUILDS=new Set(['1492461447568162876','1477820654739787858']),OWNER='794026986002448414',MANAGER='1515403509103722627';
const FILES=['activityTimeMessage.json','ageMessage.json','phoneMessage.json','genderMessage.json','gradeRosters.json','rosterMembers.json','rosters.json','termsMessages.json','tierMessage.json','tierRosters.json','userInfo.json','google-service-account.json','valorantNicknameMessage.json','runtime.json'];
export function legacyCapabilities(flags){const bits=BigInt(flags||0);return {members:!!(bits&((1n<<14n)|(1n<<15n))),content:!!(bits&((1n<<18n)|(1n<<19n)))};}
export function isLegacyInteraction(i,names){return i.isChatInputCommand()?names.has(i.commandName):/^(age_select_|gender_|valorant_nickname_|activity_time_|tier_select_|tier_grade_|tier_back$|phone_)/.test(i.customId||'');}
export function mayUseLegacyCommand(i){
 if(!i.isChatInputCommand()||['정보보기'].includes(i.commandName))return true;
 return i.user.id===OWNER||!!i.member?.roles?.cache?.has(MANAGER)||!!i.memberPermissions?.has(32n);
}
function read(file,fallback={}){try{return JSON.parse(fs.readFileSync(path.join(dataDir,file),'utf8'));}catch{return fallback;}}
function write(file,data){fs.mkdirSync(dataDir,{recursive:true});const target=path.join(dataDir,file);fs.writeFileSync(target+'.tmp',JSON.stringify(data));fs.renameSync(target+'.tmp',target);}
export async function installLegacy(client,bridge,{members,content}){
 let rosterQueue=Promise.resolve();let snapshot=await bridge('/api/discord-bot/legacy-state'),version=snapshot.version,lastSaved='',saving=null;
 if(!snapshot.rawFiles||!Number.isSafeInteger(version))throw Error('기존 봇 데이터 백업을 확인할 수 없습니다.');
 fs.mkdirSync(dataDir,{recursive:true});
 for(const file of FILES)if(Object.hasOwn(snapshot.rawFiles,file)){const target=file==='google-service-account.json'?path.join(root,file):path.join(dataDir,file);fs.writeFileSync(target,Buffer.from(snapshot.rawFiles[file],'base64'),{mode:0o600});}
 const status={pending:[],version:'legacy-migration-v1',commands:2,systems:15,removed:['티어 투표','맞짱','역할·명단 편집 명령'],missingIntents:[...(!members?['Server Members Intent']:[]),...(!content?['Message Content Intent']:[])],errors:[],backupAt:null};
 const filePath=f=>f==='google-service-account.json'?path.join(root,f):path.join(dataDir,f);const files=()=>Object.fromEntries(FILES.filter(f=>fs.existsSync(filePath(f))).map(f=>[f,fs.readFileSync(filePath(f)).toString('base64')]));
 lastSaved=JSON.stringify(files());
 const flush=async()=>{
  if(saving)return saving;
  const state=files(),encoded=JSON.stringify(state);if(encoded===lastSaved)return;
  saving=(async()=>{const result=await bridge('/api/discord-bot/legacy-state',{version,rawFiles:state});version=result.version;lastSaved=encoded;status.backupAt=new Date().toISOString();})();
  try{await saving;}finally{saving=null;}
 };
 const scoped=Object.create(client),names=new Set();scoped.__legacyBridge=bridge;scoped.__legacyStatus=status;
 const infoPanels=createInfoPanelRecovery(scoped,{onStatus:value=>{status.infoPanels=value;},onError:()=>{status.errors.push('입력 안내 메시지 복구 실패');status.errors=status.errors.slice(-10);}});scoped.__ensureInformationPanels=infoPanels.ensure;
 scoped.__isLegacyInteraction=i=>isLegacyInteraction(i,names);
 scoped.__authorizeLegacy=async i=>{
  if(!mayUseLegacyCommand(i)){await i.reply({content:'이 명령어는 총괄·매니저만 사용할 수 있습니다.',flags:64});return false;}
  if(i.isChatInputCommand()&&['정보보기','정보추가'].includes(i.commandName)){
   for(const method of ['reply','followUp']){const original=i[method].bind(i);i[method]=body=>original({...typeof body==='string'?{content:body}:body,ephemeral:undefined,flags:64});}
  }
  return true;
 };
 const scopedListener=(fn,once=false)=>(...args)=>{
  const guild=args.map(a=>a?.guild?.id||a?.guildId||a?.message?.guild?.id).find(Boolean);if(guild&&!GUILDS.has(guild))return;
  Promise.resolve().then(()=>fn(...args)).then(()=>flush()).catch(error=>{status.errors.push(String(error.message).slice(0,180));status.errors=status.errors.slice(-10);console.error('[기존 봇 기능] '+error.message);});
 };
 scoped.on=(event,fn)=>{client.on(event,scopedListener(fn));return scoped;};
 scoped.once=(event,fn)=>{client.once(event,scopedListener(fn,true));return scoped;};
 require('./legacy/bootstrap.cjs')(scoped);client.legacyCommands=scoped.legacyCommands;
 for(const [name] of scoped.legacyCommands)names.add(name);
 const commands=[...scoped.legacyCommands.values()].map(command=>command.data.toJSON());
 client.once('clientReady',async()=>{
  try{
   const runtime=read('runtime.json');
   if(runtime.botId!==client.user.id){
    for(const file of ['ageMessage.json','genderMessage.json','tierMessage.json','valorantNicknameMessage.json'])write(file,{sent:false});
    write('activityTimeMessage.json',{});
    for(const file of ['rosters.json','gradeRosters.json','tierRosters.json']){const d=read(file);delete d.messageId;delete d.messageIds;write(file,d);}
    write('runtime.json',{...runtime,botId:client.user.id,migratedAt:new Date().toISOString()});
   }
   for(const guildId of GUILDS){if(!client.guilds.cache.has(guildId))continue;const base='/applications/'+client.user.id+'/guilds/'+guildId+'/commands';const old=await client.rest.get(base);const removed=new Set(['기본역할','나랑맞짱까자','등급명단분류역할제거','등급명단분류역할추가','등급명단역할제거','등급명단역할추가','등급별채널지정','명단종류제거','명단전체제거','명단종류추가','역할제거','역할추가','티어명단제거','티어명단추가','티어투표','티어투표취소']);for(const command of old)if(removed.has(command.name))await client.rest.delete(base+'/'+command.id);for(const command of commands)await client.rest.post(base,{body:command});}
   await flush();status.readyAt=new Date().toISOString();
  }catch(error){status.errors.push(error.message);console.error('[기존 명령어 준비] '+error.message);}
 });
 // Reset old panel ownership before the legacy ready callback starts posting.
 const callbacks=client.listeners('clientReady'),legacyReady=callbacks.at(-2),registration=callbacks.at(-1);
 if(legacyReady&&registration){client.removeListener('clientReady',registration);client.prependOnceListener('clientReady',registration);}
 const timer=setInterval(()=>flush().catch(error=>console.error('[기존 정보 백업] '+error.message)),15000);timer.unref();
 return {status,flush,ensureInfoPanels:async()=>{await infoPanels.ensure();await flush();},syncRosters:boards=>{const task=rosterQueue.then(async()=>{await syncWebsiteRosters(client,boards);await flush();status.rosterSyncAt=new Date().toISOString();});rosterQueue=task.catch(()=>{});return task;},stop:async()=>{clearInterval(timer);infoPanels.stop();await flush();}};
}

export async function syncWebsiteRosters(client,boards,storage={read,write}){
 if(!Array.isArray(boards))return;
 const runtime=storage.read('runtime.json');runtime.rosterBoards||={};
 for(const board of boards){
  if(!['general','premier','tiers'].includes(board.key)||!/^\d{17,20}$/.test(board.channelId||'')||!Array.isArray(board.sections))continue;
  const title={general:'운영진·역할',premier:'프리미어 팀',tiers:'팀 티어'}[board.key],lines=['**홈페이지 연동 명단 · '+title+'**','홈페이지에서 수정한 내용이 자동 반영됩니다.'];
  for(const section of board.sections)lines.push('\n**'+String(section.title||'').replace(/([\\*_~`>|])/g,'\\$1')+'**',...(section.lines?.length?section.lines:['미배치']));
  const pages=[];let page='';for(const line of lines){if((page+'\n'+line).length>1900){pages.push(page);page='';}page+=(page?'\n':'')+line;}if(page)pages.push(page);
  const hash=JSON.stringify(pages),previous=runtime.rosterBoards[board.key]||{},sourceVersion=Number(board.sourceVersion)||0,sourceAt=Number(board.sourceAt)||0;
  if((previous.sourceVersion||0)>sourceVersion||((previous.sourceVersion||0)===sourceVersion&&(previous.sourceAt||0)>sourceAt))continue;
  if(previous.hash===hash&&previous.channelId===board.channelId){if(previous.sourceVersion!==sourceVersion||previous.sourceAt!==sourceAt){runtime.rosterBoards[board.key]={...previous,sourceVersion,sourceAt};storage.write('runtime.json',runtime);}continue;}
  const channel=await client.channels.fetch(board.channelId);if((channel.guildId||channel.guild?.id)!=='1492461447568162876')throw Error('명단 대상은 ETG 팀 서버의 채널이어야 합니다.');
  const ids=previous.channelId===board.channelId?previous.messageIds||[]:[],next=[];
  for(let index=0;index<pages.length;index++){
   let message=ids[index]?await channel.messages.fetch(ids[index]).catch(()=>null):null;
   const body={content:pages[index],allowedMentions:{parse:[]}};
   if(message?.author.id===client.user.id)await message.edit(body);else message=await channel.send(body);next.push(message.id);
  }
  for(const id of ids.slice(pages.length)){const old=await channel.messages.fetch(id).catch(()=>null);if(old?.author.id===client.user.id)await old.edit({content:'명단이 갱신되었습니다. 위의 최신 명단을 확인하세요.',allowedMentions:{parse:[]}});}
  runtime.rosterBoards[board.key]={channelId:board.channelId,messageIds:next,hash,sourceVersion,sourceAt};storage.write('runtime.json',runtime);
 }
}
