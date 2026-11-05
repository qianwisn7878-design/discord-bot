import {test} from 'node:test';
import assert from 'node:assert/strict';
import {syncTeamTermsDocument,TEAM_TERMS_MESSAGE_ID,TEAM_TERMS_CONTENT,TEAM_POLICY_FILE,TEAM_POLICY_DISPLAY_NAME,loadTeamPolicy} from '../team-terms-document.mjs';
const CHANNEL='1551594410754580481',GUILD='1492461447568162876',ENDPOINT='/channels/'+CHANNEL+'/messages/'+TEAM_TERMS_MESSAGE_ID;
function fixture(attachments=[]){
 const reactions=new Set(Array.from({length:31},(_,i)=>'user'+i)),calls=[];
 const message={id:TEAM_TERMS_MESSAGE_ID,channel_id:CHANNEL,author:{id:'bot'},content:TEAM_TERMS_CONTENT,attachments:structuredClone(attachments)};
 const channel={id:CHANNEL,guild_id:GUILD,type:0};
 const client={user:{id:'bot'},channels:{fetch:()=>{throw Error('cached SDK access is forbidden');}},rest:{
  get:async path=>{calls.push(['GET',path]);if(path==='/channels/'+CHANNEL)return structuredClone(channel);assert.equal(path,ENDPOINT);return structuredClone(message);},
  patch:async(path,options)=>{
   assert.equal(path,ENDPOINT);calls.push(['PATCH',path,options]);
   const {body,files=[]}=options;
   if(body.attachments){
    const old=new Map(message.attachments.map(a=>[a.id,a]));
    message.attachments=body.attachments.map(a=>{
     if(a.id===0){assert.equal(files.length,1);assert.equal(a.filename,TEAM_POLICY_DISPLAY_NAME);assert.equal(files[0].name,a.filename);assert.equal(files[0].contentType,'application/pdf');return {id:'new-upload',filename:a.filename,size:files[0].data.length,content_type:'application/pdf'};}
     assert(old.has(a.id),'keep only known existing attachment IDs');return old.get(a.id);
    });
   }
   message.content=body.content;assert.deepEqual(body.allowed_mentions,{parse:[]});
   return structuredClone(message);
  }
 }};
 return {client,message,channel,calls,reactions};
}
const patches=f=>f.calls.filter(c=>c[0]==='PATCH');
test('real API filename fields with three PDFs retain exactly one and preserve 31 users without uploading',async()=>{
 const f=fixture([{id:'other',filename:'readme.txt'},{id:'1',filename:TEAM_POLICY_DISPLAY_NAME},{id:'2',filename:TEAM_POLICY_DISPLAY_NAME},{id:'3',filename:TEAM_POLICY_DISPLAY_NAME}]);
 const before=new Set(f.reactions);
 await syncTeamTermsDocument(f.client,{load:()=>{throw Error('must not upload');}});
 assert.equal(patches(f).length,1);assert.deepEqual(f.message.attachments.map(a=>a.id),['other','1']);assert.equal(patches(f)[0][2].files,undefined);
 assert.deepEqual(f.reactions,before);assert.equal(f.message.id,TEAM_TERMS_MESSAGE_ID);
 for(let n=0;n<5;n++)await syncTeamTermsDocument(f.client,{load:()=>{throw Error('must not upload');}});
 assert.equal(patches(f).length,1);
});
test('sanitized, URL-encoded and original asset filenames are deduplicated correctly',async()=>{
 const f=fixture([{id:'old',filename:TEAM_POLICY_FILE},{id:'1',filename:TEAM_POLICY_DISPLAY_NAME.replaceAll(' ','_')},{id:'2',filename:encodeURIComponent(TEAM_POLICY_DISPLAY_NAME)}]);
 await syncTeamTermsDocument(f.client,{load:()=>{throw Error('must not upload');}});
 assert.deepEqual(f.message.attachments.map(a=>a.id),['1']);
});
test('first upload explicitly specifies all retained and new attachment IDs, then does not append on restart',async()=>{
 const f=fixture([{id:'other',filename:'readme.txt'}]);
 await Promise.all([syncTeamTermsDocument(f.client),syncTeamTermsDocument(f.client)]);
 assert.equal(patches(f).length,1);assert.deepEqual(patches(f)[0][2].body.attachments,[{id:'other'},{id:0,filename:TEAM_POLICY_DISPLAY_NAME}]);
 assert.equal(f.message.attachments.length,2);await syncTeamTermsDocument(f.client);assert.equal(patches(f).length,1);
});
test('unknown PDFs fail closed instead of adding a fourth copy',async()=>{
 const f=fixture([{id:'1',filename:'unknown.pdf',content_type:'application/pdf'}]);
 await assert.rejects(syncTeamTermsDocument(f.client),/추가 첨부를 중단/);assert.equal(patches(f).length,0);
});
test('wrong authors, channels and missing PDF do not mutate anything',async()=>{
 for(const mutate of [f=>f.message.author.id='other',f=>f.message.id='wrong',f=>f.message.channel_id='wrong',f=>f.channel.guild_id='wrong']){
  const f=fixture();mutate(f);await assert.rejects(syncTeamTermsDocument(f.client));assert.equal(patches(f).length,0);assert.equal(f.reactions.size,31);
 }
 const f=fixture();await assert.rejects(syncTeamTermsDocument(f.client,{load:async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});}}));assert.equal(patches(f).length,0);
});
test('replaces only the obsolete asset with the requested name and retains unrelated attachments',async()=>{
 const f=fixture([{id:'old',filename:TEAM_POLICY_FILE},{id:'other',filename:'readme.txt'}]);
 await syncTeamTermsDocument(f.client);assert.deepEqual(f.message.attachments.map(a=>a.id),['other','new-upload']);assert.equal(f.message.attachments[1].filename,TEAM_POLICY_DISPLAY_NAME);
});
test('PDF loaded from GitHub encoded asset is the unchanged supplied document',async()=>{
 const bytes=await loadTeamPolicy();assert.equal(bytes.length,97896);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
});

test('matches the exact opaque filenames from the live log by document bytes, with and without a visible title',async()=>{
 const bytes=await loadTeamPolicy();
 for(const withTitle of [false,true]){
  const files=["cb3113155f68bf83.pdf", "12d2a8dea86688ef.pdf", "e1be64961b7300f6.pdf"].map((filename,i)=>({id:String(i+1),filename,size:bytes.length,content_type:'application/pdf',url:'https://cdn.discordapp.com/attachments/'+CHANNEL+'/'+(i+1)+'/'+filename,...(withTitle?{title:TEAM_POLICY_DISPLAY_NAME}:{})}));
  const f=fixture(files);const before=new Set(f.reactions);let downloads=0;
  const fetchImpl=async(url,options)=>{assert(url.startsWith('https://cdn.discordapp.com/attachments/'+CHANNEL+'/'));assert.equal(options.redirect,'error');downloads++;return new Response(bytes);};
  await syncTeamTermsDocument(f.client,{fetchImpl,load:()=>{throw Error('must not attach another PDF');}});
  assert.equal(f.message.attachments.length,1);assert.equal(f.message.attachments[0].id,'1');assert.deepEqual(f.reactions,before);assert(downloads>0);
  assert(patches(f).every(c=>!c[2].files));
  const previous=patches(f).length;
  await syncTeamTermsDocument(f.client,{fetchImpl,load:()=>{throw Error('must not attach');}});
  assert.equal(patches(f).length,previous);assert.equal(f.message.attachments.length,1);
 }
});
test('only matching PDF contents are deduplicated; unrelated PDFs remain attached',async()=>{
 const bytes=await loadTeamPolicy(),files=[1,2,3].map(i=>({id:String(i),filename:'opaque-'+i+'.pdf',content_type:'application/pdf',url:'https://cdn.discordapp.com/attachments/'+CHANNEL+'/'+i+'/opaque-'+i+'.pdf'}));
 const f=fixture(files);
 const fetchImpl=async url=>new Response(url.includes('/3/')?Buffer.from('%PDF-unrelated'):bytes);
 await syncTeamTermsDocument(f.client,{fetchImpl});assert.deepEqual(f.message.attachments.map(a=>a.id),['1','3']);assert(!patches(f)[0][2].files);
});
test('untrusted URLs or failed downloads abort before any change or upload',async()=>{
 for(const url of ['https://example.test/file.pdf','https://cdn.discordapp.com/attachments/wrong/1/file.pdf']){
  const f=fixture([{id:'1',filename:'opaque.pdf',url}]);let fetched=false;
  await assert.rejects(syncTeamTermsDocument(f.client,{fetchImpl:async()=>{fetched=true;throw Error('unexpected');}}));
  assert.equal(fetched,false);assert.equal(patches(f).length,0);
 }
 const f=fixture([{id:'1',filename:'opaque.pdf',url:'https://cdn.discordapp.com/attachments/'+CHANNEL+'/1/file.pdf'}]);
 await assert.rejects(syncTeamTermsDocument(f.client,{fetchImpl:async()=>new Response('expired',{status:403})}));assert.equal(patches(f).length,0);
});
