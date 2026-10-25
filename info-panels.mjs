import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
import {createRosterRefresh} from './roster-refresh.mjs';
const require=createRequire(import.meta.url),CHANNEL='1510258999529046116',TERMS_CHANNEL='1551594410754580481',dir=fileURLToPath(new URL('./legacy/data/',import.meta.url));
const definitions=[['ageMessage.json','age_select_','ageSystem','sendAgeMessage'],['genderMessage.json','gender_','genderSystem','sendGenderMessage'],['tierMessage.json','tier_select_','tierSystem','sendTierMessage'],['valorantNicknameMessage.json','valorant_nickname_write','valorantNicknameSystem','sendValorantNicknameMessage'],['activityTimeMessage.json','activity_time_write','activityTimeSystem','sendActivityTimeMessage'],['phoneMessage.json','phone_write','phoneSystem','startPhoneSystem']];
const allowed=new Set(definitions.map(d=>d[0]).filter(Boolean));
function readMetadata(file){if(!allowed.has(file))throw Error('안내 메시지 기록만 확인할 수 있습니다.');try{return JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));}catch{return {};}}
function writeMetadata(file,value){if(!allowed.has(file))throw Error('안내 메시지 기록만 초기화할 수 있습니다.');fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,file);fs.writeFileSync(target+'.tmp',JSON.stringify(value));fs.renameSync(target+'.tmp',target);}
function matches(message,prefix,botId){return message?.author?.id===botId&&message.components?.some(row=>row.components?.some(component=>String(component.customId||component.custom_id||'').startsWith(prefix)));}
export function createInfoPanelRecovery(client,{senders=null,read=readMetadata,write=writeMetadata,refreshTerms=null,onStatus=()=>{},onError=()=>{},...timers}={}){
 let task=null,stopped=false;
 const ensure=()=>{
  if(stopped)return Promise.resolve();if(task)return task;
  task=(async()=>{
   const channel=await client.channels.fetch(CHANNEL);if(!channel?.isTextBased()||(channel.guildId||channel.guild?.id)!=='1492461447568162876')throw Error('정보 입력 안내 채널을 확인하세요.');
   const messages=await channel.messages.fetch({limit:100}),known=[...messages.values()];let created=0;
   for(const [file,prefix,moduleName,method] of definitions){
    let existing=known.find(message=>matches(message,prefix,client.user.id));
    const previous=file?read(file):null;
    if(!existing&&previous?.messageId){try{const message=await channel.messages.fetch(previous.messageId);if(matches(message,prefix,client.user.id))existing=message;}catch(error){if(error.status!==404&&error.code!==10008)throw error;}}
    if(existing){if(file)write(file,{sent:true,channelId:CHANNEL,messageId:existing.id});continue;}
    if(file)write(file,{sent:false,channelId:CHANNEL,messageId:null});
    let posted=null;
    const wrapped=new Proxy(channel,{get(target,key){if(key==='send')return async body=>{const message=await target.send(body);if(matches(message,prefix,client.user.id))posted=message;return message;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
    const proxy=Object.create(client);proxy.channels={fetch:async id=>id===CHANNEL?wrapped:client.channels.fetch(id)};
    const send=senders?.[moduleName]||require('./legacy/systems/'+moduleName+'.cjs')[method];await send(proxy);
    if(!posted)throw Error('안내 메시지를 다시 생성하지 못했습니다. 채널 권한을 확인하세요.');
    known.push(posted);if(file)write(file,{sent:true,channelId:CHANNEL,messageId:posted.id});created++;
   }
   if(refreshTerms)await refreshTerms();else if(client.__legacyStatus?.termsReady)await require('./legacy/systems/termsSystem.cjs').createTermsMessages(client);
   const status={count:definitions.length,createdCount:created,checkedAt:new Date().toISOString()};onStatus(status);return status;
  })().finally(()=>{task=null;});return task;
 };
 const refresher=createRosterRefresh({...timers,refresh:ensure,onError});
 const deleted=message=>{if([CHANNEL,TERMS_CHANNEL].includes(message.channelId||message.channel?.id))refresher.request();};
 const deletedBulk=(messages,channel)=>{if([CHANNEL,TERMS_CHANNEL].includes(channel?.id||messages.first?.()?.channelId))refresher.request();};
 client.on('messageDelete',deleted);client.on('messageDeleteBulk',deletedBulk);
 return {ensure,stop(){stopped=true;refresher.stop();client.removeListener('messageDelete',deleted);client.removeListener('messageDeleteBulk',deletedBulk);}};
}
