import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {syncWebsiteRosters} from '../legacy.mjs';
const require=createRequire(import.meta.url),{google}=require('../legacy/google-client.cjs');
function fixture(sections,existing=true){
 let runtime={},edits=[],sends=[],deletes=[],serial=0;const messages=new Map();
 const make=(id,content)=>({id,author:{id:'bot'},content,edit:async function(body){edits.push(body);this.content=body.content;},delete:async()=>{deletes.push(id);messages.delete(id);}});
 if(existing)messages.set('m',make('m','**홈페이지 연동 명단 · 프리미어 팀**'));
 const channel={guildId:'1492461447568162876',messages:{fetch:async query=>typeof query==='object'?new Map(messages):messages.get(query)},send:async body=>{sends.push(body);const m=make('m'+(++serial),body.content);messages.set(m.id,m);return m;}};
 return {edits,sends,deletes,messages,client:{user:{id:'bot'},channels:{fetch:async()=>channel}},storage:{read:()=>structuredClone(runtime),write:(_,value)=>runtime=structuredClone(value)},board:{key:'premier',channelId:'1563935082278821912',sourceAt:200,sourceVersion:1,sections}};
}

test('existing roster is discovered and edited; full plain text stays in one message without files or embeds',async()=>{
 const f=fixture([{title:'중급',lines:['x'.repeat(1850),'synthetic-player-last']}]);
 await syncWebsiteRosters(f.client,[f.board],f.storage);
 assert.equal(f.edits.length,1);assert(f.edits[0].content.includes('synthetic-player-last'));assert.equal(f.edits[0].files,undefined);assert.deepEqual(f.edits[0].embeds,[]);assert(f.edits[0].content.length>1900);assert(f.edits[0].content.length<=2000);
 await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.edits.length,1);
 f.board.sections=[{title:'초급',lines:['new-player']}];await syncWebsiteRosters(f.client,[f.board],f.storage);
 assert(f.edits.at(-1).content.includes('new-player'));assert.deepEqual(f.edits.at(-1).attachments,[]);
});
test('over 2000 characters continues as linked replies and shrinks cleanly',async()=>{const f=fixture([{title:'team',lines:Array.from({length:40},(_,i)=>'player-'+i+' '+('가'.repeat(100)))}]);await syncWebsiteRosters(f.client,[f.board],f.storage);assert(f.sends.length>=2);assert([...f.edits,...f.sends].every(b=>b.content.length<=2000));assert.equal(f.sends[0].reply.messageReference,'m');assert.equal(f.sends[1].reply.messageReference,'m1');assert.equal(f.sends[0].allowedMentions.repliedUser,false);assert([...f.messages.values()].some(m=>m.content.includes('player-39')));const sent=f.sends.length;await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.sends.length,sent);f.board.sourceVersion++;f.board.sections=[{title:'team',lines:['short']}];await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.messages.size,1);assert.equal(f.deletes.length,sent);});
test('missing or deleted roster is never recreated',async()=>{
 const f=fixture([{title:'중급',lines:[]}],false);await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.edits.length,0);
});
test('older directory snapshots never overwrite the latest roster',async()=>{
 const f=fixture([{title:'team',lines:['new']}]);await syncWebsiteRosters(f.client,[f.board],f.storage);
 f.board.sourceAt=100;f.board.sections[0].lines=['old'];await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.edits.length,1);
 f.board.sourceVersion=2;await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.edits.length,2);
});
test('bot Google adapter signs locally and can only update the approved sheet and tab',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'etg-synthetic-key-')),keyFile=path.join(temp,'test.json'),originalFetch=globalThis.fetch,calls=[];
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:1024});
 fs.writeFileSync(keyFile,JSON.stringify({type:'service_account',client_email:'test@project.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://untrusted.invalid'}));
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url==='https://oauth2.googleapis.com/token'?{access_token:'synthetic-token',expires_in:3600}:{});};
 try{
  const auth=new google.auth.GoogleAuth({keyFile}),sheets=google.sheets({auth}),id='1EHWnlwE0qt1izK7vtaXE1-H9lU34RZpevVUGAH15P7A';
  await sheets.spreadsheets.values.clear({spreadsheetId:id,range:'정보!A:J'});assert.equal(calls.length,0,'do not clear before successfully writing replacement values');
  await sheets.spreadsheets.values.update({spreadsheetId:id,range:'정보!A1',requestBody:{values:[Array(10).fill('synthetic-only')]}});
  assert.equal(calls[0].url,'https://oauth2.googleapis.com/token');assert(calls[1].url.includes('valueInputOption=RAW'));assert.equal(calls[1].options.method,'PUT');assert(calls[2].url.endsWith(':clear'));
  const before=calls.length;await assert.rejects(()=>sheets.spreadsheets.values.update({spreadsheetId:'other',range:'정보!A1',requestBody:{values:[]}}),/승인/);assert.equal(calls.length,before);
 }finally{globalThis.fetch=originalFetch;fs.unlinkSync(keyFile);fs.rmdirSync(temp);}
});

