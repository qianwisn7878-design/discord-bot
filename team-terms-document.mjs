import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const GUILD='1492461447568162876',CHANNEL='1551594410754580481';
export const TEAM_TERMS_MESSAGE_ID='1563934946454667306';
export const TEAM_TERMS_CONTENT='[ 필수 ] 이용약관 동의\n\n아래 이용약관에 동의하신다면 해당 메세지에 체크 반응을 눌러주세요.';
const HASH='5b0ec0f9f5c850ee4ab81816322ba47dd084e929d0acd10e006a9837cd7e7df3';
export const TEAM_POLICY_FILE='ETG-VALORANT-Team-Policy-2026-10-31-5b0ec0f9f5.pdf';
export const TEAM_POLICY_DISPLAY_NAME='발로란트 팀 이용약관.pdf';
export async function loadTeamPolicy(read=readFile){
 try{return await read(new URL('./assets/'+TEAM_POLICY_FILE,import.meta.url));}
 catch(e){if(e.code!=='ENOENT')throw e;}
 const encoded=await read(new URL('./assets/'+TEAM_POLICY_FILE+'.base64',import.meta.url),'utf8');
 return Buffer.from(encoded.replace(/\s/g,''),'base64');
}
function normalizedFilename(value){
 let name=String(value||'');try{name=decodeURIComponent(name);}catch{}
 return name.normalize('NFKC').replace(/[\s_]+/g,'').toLowerCase();
}
const inflight=new WeakMap();
export function syncTeamTermsDocument(client,{load=loadTeamPolicy}={}){
 if(inflight.has(client))return inflight.get(client);
 const task=update(client,load).finally(()=>inflight.delete(client));inflight.set(client,task);return task;
}
async function update(client,load){
 const channel=await client.channels.fetch(CHANNEL);
 if(!channel?.isTextBased()||channel.guildId!==GUILD)throw Error('기존 팀 이용약관 채널을 확인하세요. 메시지는 변경하지 않았습니다.');
 // Fetch only the exact existing message. Never create or delete a consent message.
 const message=await channel.messages.fetch(TEAM_TERMS_MESSAGE_ID);
 if(message.id!==TEAM_TERMS_MESSAGE_ID||message.channelId!==CHANNEL||message.author?.id!==client.user.id)throw Error('지정한 이용약관 메시지와 작성 봇을 확인하세요. 메시지는 변경하지 않았습니다.');
 const attachments=[...(message.attachments?.values()||[])];
 const isDesired=a=>normalizedFilename(a.name)===normalizedFilename(TEAM_POLICY_DISPLAY_NAME);
 const isPolicy=a=>isDesired(a)||normalizedFilename(a.name)===normalizedFilename(TEAM_POLICY_FILE);
 const keep=attachments.find(isDesired);
 const retained=attachments.filter(a=>!isPolicy(a)||a.id===keep?.id);
 const attached=Boolean(keep),changedAttachments=retained.length!==attachments.length;
 if(attached&&!changedAttachments&&message.content===TEAM_TERMS_CONTENT)return {updated:false,messageId:message.id};
 let bytes;
 if(!attached){
  try{bytes=await load();}catch(e){if(e.code==='ENOENT')throw Error('운영정책 PDF 파일이 없습니다. GitHub 최신 코드와 assets 파일을 함께 받고 재시작하세요. 기존 메시지와 반응은 유지했습니다.');throw e;}
  if(!Buffer.isBuffer(bytes)||bytes.subarray(0,5).toString()!=='%PDF-'||createHash('sha256').update(bytes).digest('hex')!==HASH)throw Error('첨부할 운영정책 PDF가 원본과 다릅니다. 기존 메시지와 반응은 유지했습니다.');
 }
 const body={content:TEAM_TERMS_CONTENT,allowedMentions:{parse:[]}};
 if(bytes||changedAttachments)body.attachments=retained.map(a=>({id:a.id}));
 if(bytes)body.files=[{attachment:bytes,name:TEAM_POLICY_DISPLAY_NAME}];
 await message.edit(body);
 return {updated:true,messageId:message.id,pdfAttached:true};
}


