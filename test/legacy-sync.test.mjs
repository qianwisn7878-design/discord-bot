import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {syncWebsiteRosters} from '../legacy.mjs';
const require=createRequire(import.meta.url),{google}=require('../legacy/google-client.cjs');
function fixture(sections, existing=true){
 let runtime={},edits=[],scans=0;
 const message={id:'m',author:{id:'bot'},content:'**홈페이지 연동 명단 · 프리미어 팀**',edit:async body=>{edits.push(body);message.content=body.content;}};
 const channel={guildId:'1492461447568162876',messages:{fetch:async query=>typeof query==='object'?(scans++,new Map(existing?[[message.id,message]]:[])):existing?message:null},send:async()=>{throw Error('must never send a new roster message');}};
 return {edits,client:{user:{id:'bot'},channels:{fetch:async()=>channel}},storage:{read:()=>structuredClone(runtime),write:(_,value)=>runtime=structuredClone(value)},board:{key:'premier',channelId:'1563935082278821912',sourceAt:200,sourceVersion:1,sections}};
}
test('existing roster is discovered and edited; overflow stays in the same message as a complete attachment',async()=>{
 const f=fixture([{title:'중급',lines:Array.from({length:150},(_,n)=>'synthetic-player-'+n)}]);
 await syncWebsiteRosters(f.client,[f.board],f.storage);
 assert.equal(f.edits.length,1);assert(f.edits[0].files[0].attachment.toString().includes('synthetic-player-149'));
 await syncWebsiteRosters(f.client,[f.board],f.storage);assert.equal(f.edits.length,1);
 f.board.sections=[{title:'초급',lines:['new-player']}];await syncWebsiteRosters(f.client,[f.board],f.storage);
 assert(f.edits.at(-1).content.includes('new-player'));assert.deepEqual(f.edits.at(-1).attachments,[]);
});
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

