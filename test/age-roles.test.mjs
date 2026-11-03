import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BIRTH_YEARS,DEMOGRAPHIC_GUILDS,birthYearOfRole,ensureDemographicRoles,installDemographicSync,refreshCommunityEligibility} from '../demographic-sync.mjs';
test('recognizes 2013 and 13 year roles and creates the missing birth role across four ETG servers',async()=>{
 assert.equal(BIRTH_YEARS[0],2013);assert.equal(BIRTH_YEARS.at(-1),1990);assert.equal(DEMOGRAPHIC_GUILDS.length,4);
 for(const name of ['13년생','2013년생','2013 년생'])assert.equal(birthYearOfRole({name}),2013);
 assert.equal(birthYearOfRole({name:'2014년생'}),null);
 for(const id of DEMOGRAPHIC_GUILDS){
  const roles=new Map(BIRTH_YEARS.filter(y=>y!==2013).map(y=>[String(y),{id:String(y),name:y+'년생',managed:false}]));
  roles.set('male',{id:'male',name:'남자'});roles.set('female',{id:'female',name:'여자'});const created=[];
  const guild={id,roles:{fetch:async()=>roles,create:async data=>{created.push(data);const r={...data,id:'new'+created.length};roles.set(r.id,r);return r;}}};
  const result=await ensureDemographicRoles(guild);assert.equal(created.length,1);assert.equal(created[0].name,'13년생');assert.equal(created[0].permissions,0n);assert(result.years.has(2013));
  await ensureDemographicRoles(guild);assert.equal(created.length,1);
 }
});
test('age exception refresh updates only community joined/pending roles from server eligibility',async()=>{
 const joined='1566010351177175040',pending='1566049064527855666',agreed='1566006162112122942',held=new Set([agreed,pending]),changes=[],user='111111111111111111';
 const member={user:{bot:false},roles:{cache:{has:id=>held.has(id)},add:async id=>{held.add(id);changes.push(['add',id]);},remove:async id=>{held.delete(id);changes.push(['remove',id]);}}};
 const client={guilds:{cache:new Map([[DEMOGRAPHIC_GUILDS[0],{members:{fetch:async()=>member}}]])}};
 let eligible=true;
 const bridge=async(path,body)=>{assert.equal(body.action,'sync');assert.equal(body.agreed,true);return {eligible};};
 await refreshCommunityEligibility(client,bridge,user);assert(held.has(joined));assert(!held.has(pending));
 eligible=false;await refreshCommunityEligibility(client,bridge,user);assert(!held.has(joined));assert(held.has(pending));assert(changes.every(([,id])=>[joined,pending].includes(id)));
});
