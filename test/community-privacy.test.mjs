import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {purgeLocalCommunityProfile} from '../community-registration.mjs';
test('departure removes only the departed local profile and tolerates repeat/missing files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'etg-privacy-')),file=path.join(dir,'userInfo.json'),id='10000000000000001',other='10000000000000002';
 try{fs.writeFileSync(file,JSON.stringify({users:{[id]:{birthDate:'private'},[other]:{name:'keep'}},[id]:{name:'legacy'},settings:{keep:true}}));purgeLocalCommunityProfile(id,file);purgeLocalCommunityProfile(id,file);assert.deepEqual(JSON.parse(fs.readFileSync(file)),{users:{[other]:{name:'keep'}},settings:{keep:true}});purgeLocalCommunityProfile(id,path.join(dir,'missing.json'));assert.throws(()=>purgeLocalCommunityProfile('../bad',file));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
