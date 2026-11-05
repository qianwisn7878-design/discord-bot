import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {syncTeamPrivacyDocument,TEAM_PRIVACY_MESSAGE_ID,TEAM_PRIVACY_CONTENT,TEAM_PRIVACY_FILE,TEAM_PRIVACY_DISPLAY_NAME,loadTeamPrivacyPolicy} from '../team-privacy-document.mjs';
const CHANNEL='1551594410754580481',GUILD='1492461447568162876';
function fixture(){
 const reactions=new Map([['✅',new Set(['111111111111111111','222222222222222222'])]]),attachments=new Map([['old',{id:'old',name:'existing.txt'}]]),edits=[];
 const message={id:TEAM_PRIVACY_MESSAGE_ID,channelId:CHANNEL,author:{id:'bot'},content:'[ 필수 ] 이용약관 동의\n\n기존 안내',attachments,reactions,edit:async body=>{edits.push(body);message.content=body.content;if(body.attachments){const kept=new Set(body.attachments.map(a=>a.id));for(const id of attachments.keys())if(!kept.has(id))attachments.delete(id);}if(body.files)for(const f of body.files)attachments.set('pdf',{id:'pdf',name:f.name});return message;}};
 const channel={guildId:GUILD,isTextBased:()=>true,messages:{fetch:async id=>{assert.equal(id,TEAM_PRIVACY_MESSAGE_ID);return message;}}};
 const client={user:{id:'bot'},channels:{fetch:async id=>{assert.equal(id,CHANNEL);return channel;}}};
 return {client,channel,message,reactions,edits};
}
const pdf=()=>loadTeamPrivacyPolicy();
test('edits only the exact message, retaining message ID, previous attachments and all check reactions',async()=>{
 const f=fixture();const original=structuredClone(f.reactions);
 const result=await syncTeamPrivacyDocument(f.client,{load:pdf});
 assert.equal(result.messageId,TEAM_PRIVACY_MESSAGE_ID);assert.equal(f.message.id,TEAM_PRIVACY_MESSAGE_ID);
 assert.equal(f.edits.length,1);assert.equal(f.edits[0].content,TEAM_PRIVACY_CONTENT);
 assert.deepEqual(f.edits[0].attachments,[{id:'old'}]);assert.equal(f.edits[0].files[0].name,TEAM_PRIVACY_DISPLAY_NAME);
 assert.deepEqual(f.reactions,original);assert.deepEqual(f.edits[0].allowedMentions,{parse:[]});
});
test('restarts and simultaneous calls do not upload duplicate PDFs or rewrite correct content',async()=>{
 const f=fixture();await Promise.all([syncTeamPrivacyDocument(f.client,{load:pdf}),syncTeamPrivacyDocument(f.client,{load:pdf})]);
 assert.equal(f.edits.length,1);await syncTeamPrivacyDocument(f.client,{load:()=>{throw Error('must not read');}});assert.equal(f.edits.length,1);
});
test('missing PDF, corrupt PDF or a missing/wrong message fails before any edit; no send/delete/reaction methods exist',async()=>{
 for(const load of [async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});},async()=>Buffer.from('%PDF-corrupt')]){
  const f=fixture();await assert.rejects(syncTeamPrivacyDocument(f.client,{load}));assert.equal(f.edits.length,0);assert.equal(f.reactions.get('✅').size,2);
 }
 for(const mutate of [f=>f.message.author.id='other',f=>f.message.id='wrong',f=>f.channel.guildId='wrong',f=>f.message.channelId='wrong']){
  const f=fixture();mutate(f);await assert.rejects(syncTeamPrivacyDocument(f.client,{load:pdf}));assert.equal(f.edits.length,0);
 }
 const f=fixture();f.channel.messages.fetch=async()=>{throw Object.assign(Error('not found'),{status:404});};await assert.rejects(syncTeamPrivacyDocument(f.client,{load:pdf}));assert.equal(f.edits.length,0);
});
test('content-only correction keeps the existing PDF and reaction users',async()=>{
 const f=fixture();f.message.attachments.set('pdf',{id:'pdf',name:TEAM_PRIVACY_DISPLAY_NAME});await syncTeamPrivacyDocument(f.client,{load:()=>{throw Error('must not read');}});
 assert.equal(f.edits.length,1);assert(!Object.hasOwn(f.edits[0],'files'));assert(!Object.hasOwn(f.edits[0],'attachments'));assert.equal(f.reactions.get('✅').size,2);
});

test('GitHub-only encoded PDF decodes to the original bytes when no separate PDF is uploaded',async()=>{
 const encoded=await readFile(new URL('../assets/'+TEAM_PRIVACY_FILE+'.base64',import.meta.url),'utf8');
 const decoded=await loadTeamPrivacyPolicy(async(url,encoding)=>{
  if(url.pathname.endsWith('.pdf'))throw Object.assign(Error('not uploaded'),{code:'ENOENT'});
  assert.equal(encoding,'utf8');return encoded;
 });
 assert.equal(decoded.subarray(0,5).toString(),'%PDF-');
 assert.equal(decoded.length,111492);
 const f=fixture();await syncTeamPrivacyDocument(f.client,{load:async()=>decoded});
 assert.equal(f.edits.length,1);assert.equal(f.reactions.get('✅').size,2);
});


test('replaces only the old policy attachment with the requested Korean filename on the same message',async()=>{
 const f=fixture();f.message.attachments.set('old-pdf',{id:'old-pdf',name:TEAM_PRIVACY_FILE});
 const before=structuredClone(f.reactions);await syncTeamPrivacyDocument(f.client,{load:pdf});
 assert.equal(f.message.id,TEAM_PRIVACY_MESSAGE_ID);assert.deepEqual(f.edits[0].attachments,[{id:'old'}]);
 assert.equal(f.edits[0].files[0].name,'개인정보 수집 및 이용 동의.pdf');
 assert.deepEqual(f.reactions,before);assert(f.message.attachments.has('old'));assert(!f.message.attachments.has('old-pdf'));
 await syncTeamPrivacyDocument(f.client,{load:pdf});assert.equal(f.edits.length,1);
});


test('retains one policy PDF, preserves unrelated files and all 30 reaction users, and stays stable across restarts',async()=>{
 const f=fixture();f.message.content=TEAM_PRIVACY_CONTENT;
 f.message.attachments.set('first',{id:'first',name:TEAM_PRIVACY_DISPLAY_NAME.replaceAll(' ','_')});
 f.message.attachments.set('duplicate',{id:'duplicate',name:TEAM_PRIVACY_DISPLAY_NAME});
 f.message.attachments.set('legacy',{id:'legacy',name:TEAM_PRIVACY_FILE});
 f.reactions.set('✅',new Set(Array.from({length:30},(_,i)=>'user'+i)));const before=structuredClone(f.reactions);
 await syncTeamPrivacyDocument(f.client,{load:()=>{throw Error('must not upload another PDF');}});
 assert.equal(f.edits.length,1);assert.deepEqual(f.edits[0].attachments,[{id:'old'},{id:'first'}]);assert(!f.edits[0].files);
 assert.deepEqual(f.reactions,before);assert.equal(f.message.id,TEAM_PRIVACY_MESSAGE_ID);
 await syncTeamPrivacyDocument(f.client,{load:()=>{throw Error('must not upload');}});assert.equal(f.edits.length,1);
});
test('recognizes Discord sanitized attachment filenames without uploading another copy',async()=>{
 const f=fixture();f.message.content=TEAM_PRIVACY_CONTENT;
 f.message.attachments.set('pdf',{id:'pdf',name:TEAM_PRIVACY_DISPLAY_NAME.replaceAll(' ','_')});
 const result=await syncTeamPrivacyDocument(f.client,{load:()=>{throw Error('must not upload');}});
 assert.equal(result.updated,false);assert.equal(f.edits.length,0);
});
