import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const GUILD='1492461447568162876',CHANNEL='1551594410754580481';
export const TEAM_PRIVACY_MESSAGE_ID='1563934964054106279';
export const TEAM_PRIVACY_CONTENT='[ 필수 ] 개인정보 수집 및 이용 동의\n\n아래 개인정보 수집 및 이용에 동의하신다면 해당 메세지에 체크 반응을 눌러주세요.';
const HASH='e3465c6823a279e187eebf20ec40721a27e1dc63ce910ad21b5ae56a613478ad';
export const TEAM_PRIVACY_FILE='ETG-Privacy-Consent-2026-09-25-e3465c6823.pdf';
export const TEAM_PRIVACY_DISPLAY_NAME='개인정보 수집 및 이용 동의.pdf';
export async function loadTeamPrivacyPolicy(read=readFile){
 try{return await read(new URL('./assets/'+TEAM_PRIVACY_FILE,import.meta.url));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const encoded=await read(new URL('./assets/'+TEAM_PRIVACY_FILE+'.base64',import.meta.url),'utf8');
 return Buffer.from(encoded.replace(/\s/g,''),'base64');
}
function normalizedFilename(value){
 let name=String(value||'');try{name=decodeURIComponent(name);}catch{}
 return name.normalize('NFKC').replace(/[\s_]+/g,'').toLowerCase();
}
async function policyAttachmentIds(attachments,fetchImpl){
 const policyIds=new Set(),keepableIds=new Set();
 const match=value=>normalizedFilename(value)===normalizedFilename(TEAM_PRIVACY_DISPLAY_NAME);
 const old=value=>normalizedFilename(value)===normalizedFilename(TEAM_PRIVACY_FILE);
 for(const a of attachments){
  const filename=a.filename??a.name??'';
  if(match(filename)){policyIds.add(a.id);keepableIds.add(a.id);continue;}
  if(old(filename)){policyIds.add(a.id);if(match(a.title))keepableIds.add(a.id);continue;}
  if(a.content_type!=='application/pdf'&&!/\.pdf$/i.test(filename)&&!match(a.title))continue;
  // Discord may replace the storage filename with a hash and keep the visible name in title.
  // Match the actual supplied document before retaining/removing any opaque-name attachment.
  let url;
  try{url=new URL(a.url);}catch{throw Error('기존 PDF 내용 확인 실패로 추가 첨부를 중단했습니다.');}
  if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname)||!url.pathname.startsWith('/attachments/'+CHANNEL+'/'+a.id+'/'))throw Error('기존 PDF 다운로드 주소를 확인하지 못해 추가 첨부를 중단했습니다.');
  const limit=2*1024*1024;
  if(a.size>limit)throw Error('기존 PDF 확인 용량을 초과해 추가 첨부를 중단했습니다.');
  const response=await fetchImpl(url.href,{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok||!response.body||Number(response.headers.get('content-length')||0)>limit)throw Error('기존 PDF 다운로드에 실패해 추가 첨부를 중단했습니다.');
  const reader=response.body.getReader(),parts=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('기존 PDF 확인 용량을 초과해 추가 첨부를 중단했습니다.');}parts.push(Buffer.from(value));}}finally{reader.releaseLock();}
  if(createHash('sha256').update(Buffer.concat(parts)).digest('hex')===HASH){policyIds.add(a.id);keepableIds.add(a.id);}
 }
 return {policyIds,keepableIds};
}
const inflight=new WeakMap();
export function syncTeamPrivacyDocument(client,{load=loadTeamPrivacyPolicy,fetchImpl=fetch}={}){
 if(inflight.has(client))return inflight.get(client);
 const task=update(client,load,fetchImpl).finally(()=>inflight.delete(client));inflight.set(client,task);return task;
}
async function update(client,load,fetchImpl){
 const channel=await client.rest.get('/channels/'+CHANNEL);
 if(channel?.type!==0||channel.guild_id!==GUILD)throw Error('기존 동의 채널을 확인하세요. 메시지는 변경하지 않았습니다.');
 const endpoint='/channels/'+CHANNEL+'/messages/'+TEAM_PRIVACY_MESSAGE_ID;
 // Fetch fresh wire-format attachments. Never read or edit a cached SDK Message.
 const message=await client.rest.get(endpoint);
 if(message.id!==TEAM_PRIVACY_MESSAGE_ID||message.channel_id!==CHANNEL||message.author?.id!==client.user.id)throw Error('지정한 동의 메시지와 작성 봇을 확인하세요. 메시지는 변경하지 않았습니다.');
 if(!Array.isArray(message.attachments))throw Error('첨부파일 목록을 확인하지 못해 수정을 중단했습니다.');
 const attachments=message.attachments;
 const {policyIds,keepableIds}=await policyAttachmentIds(attachments,fetchImpl);
 const keep=attachments.find(a=>keepableIds.has(a.id));
 const retained=attachments.filter(a=>!policyIds.has(a.id)||a.id===keep?.id);
 if(retained.some(a=>typeof a.id!=='string'))throw Error('보존할 첨부파일 ID를 확인하지 못했습니다.');
 const attached=Boolean(keep),changedAttachments=retained.length!==attachments.length;
 if(attached&&!changedAttachments&&message.content===TEAM_PRIVACY_CONTENT)return {updated:false,messageId:message.id};
 let bytes;
 if(!attached){
  try{bytes=await load();}catch(e){if(e.code==='ENOENT')throw Error('PDF 파일이 없습니다. GitHub 최신 코드와 assets 파일을 함께 받고 재시작하세요. 기존 메시지와 반응은 유지했습니다.');throw e;}
  if(!Buffer.isBuffer(bytes)||bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==HASH)throw Error('첨부할 PDF가 원본과 다릅니다. 기존 메시지와 반응은 유지했습니다.');
 }
 const body={content:TEAM_PRIVACY_CONTENT,allowed_mentions:{parse:[]}},options={body};
 if(bytes||changedAttachments){
  body.attachments=retained.map(a=>({id:a.id}));
  if(bytes){
   body.attachments.push({id:0,filename:TEAM_PRIVACY_DISPLAY_NAME});
   options.files=[{data:bytes,name:TEAM_PRIVACY_DISPLAY_NAME,contentType:'application/pdf'}];
  }
 }
 await client.rest.patch(endpoint,options);
 const actual=await client.rest.get(endpoint);
 if(!Array.isArray(actual.attachments))throw Error('수정 후 첨부 목록을 확인하지 못했습니다.');
 const verified=await policyAttachmentIds(actual.attachments,fetchImpl);
 const pdfs=actual.attachments.filter(a=>verified.policyIds.has(a.id));
 if(actual.id!==TEAM_PRIVACY_MESSAGE_ID||pdfs.length!==1||!verified.keepableIds.has(pdfs[0].id))throw Error('수정 후 PDF 1개 여부를 확인하지 못했습니다. 재첨부하지 않고 중단합니다.');
 return {updated:true,messageId:message.id,pdfAttached:true};
}
