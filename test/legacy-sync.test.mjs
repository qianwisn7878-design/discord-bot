import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';
import {syncWebsiteRosters} from '../legacy.mjs';
const require=createRequire(import.meta.url),{google}=require('../legacy/google-client.cjs');
test('roster display uses website data, includes every page and never edits roles',async()=>{
 let saved={},seq=0,writes=0;const messages=new Map,channel={guildId:'1492461447568162876',messages:{fetch:async id=>messages.get(id)},send:async body=>{writes++;assert.deepEqual(body.allowedMentions,{parse:[]});const m={id:String(++seq),author:{id:'helper'},edit:async b=>{writes++;m.content=b.content;},content:body.content};messages.set(m.id,m);return m;}};
 const client={user:{id:'helper'},channels:{fetch:async()=>channel}};
 Object.defineProperty(client,'guilds',{get(){throw Error('role mutations must not be used');}});
 const storage={read:()=>structuredClone(saved),write:(name,data)=>{saved=structuredClone(data);}},board={key:'premier',channelId:'111111111111111111',sections:[{title:'상급1',lines:Array.from({length:150},(_,n)=>'주전: <@'+String(100000000000000000n+BigInt(n))+'>')}]};
 await syncWebsiteRosters(client,[board],storage);assert(messages.size>1);assert([...messages.values()].some(m=>m.content.includes('100000000000000149')));const before=writes;await syncWebsiteRosters(client,[board],storage);assert.equal(writes,before);
 board.sections=[{title:'상급2',lines:['주전: <@new-player>']}];await syncWebsiteRosters(client,[board],storage);assert([...messages.values()].some(m=>m.content.includes('new-player')));
});
test('older directory snapshots never overwrite the latest roster',async()=>{
 let runtime={},writes=0,last='';const message={id:'m',author:{id:'bot'},edit:async b=>{writes++;last=b.content;}},channel={guildId:'1492461447568162876',messages:{fetch:async()=>message},send:async b=>{writes++;last=b.content;return message;}},client={user:{id:'bot'},channels:{fetch:async()=>channel}},storage={read:()=>structuredClone(runtime),write:(name,value)=>runtime=structuredClone(value)};
 const board=(who,at,version=1)=>({key:'premier',channelId:'111111111111111111',sourceAt:at,sourceVersion:version,sections:[{title:'team',lines:[who]}]});
 await syncWebsiteRosters(client,[board('new',200)],storage);const count=writes;await syncWebsiteRosters(client,[board('old',100)],storage);assert.equal(writes,count);assert(last.includes('new'));
 await syncWebsiteRosters(client,[board('new',300)],storage);await syncWebsiteRosters(client,[board('stale',250)],storage);assert.equal(writes,count);
 await syncWebsiteRosters(client,[board('new-version',150,2)],storage);assert(last.includes('new-version'));
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
