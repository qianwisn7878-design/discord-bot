import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executePremierChannels} from '../premier-channels.mjs';
const guild='1492461447568162876',team='111111111111111111',oldTier='222222222222222222',newTier='333333333333333333',category='444444444444444444';
const job={guildId:guild,roleId:team,previousName:'중상급2',teamName:'상급10',action:'rename'};
function fixture(){
 const roles=[{id:team,name:'중상급2',permissions:'0'},{id:oldTier,name:'중상급',permissions:'0'},{id:newTier,name:'상급',permissions:'0'},{id:'555555555555555555',name:'코치',permissions:'0'}];
 const channels=[{id:category,type:4,name:'중상급2',position:1,permission_overwrites:[{id:guild,type:0,deny:'1024'},{id:team,type:0,allow:'1024'}]},...['중상급2','중상급2 통방','팀원정보','별도-전략'].map((name,i)=>({id:String(600000000000000000n+BigInt(i)),name,type:i===1?2:0,parent_id:category,permission_overwrites:[{id:team,allow:'1024'}],messages:['keep']}))];
 const members=Array.from({length:12},(_,i)=>({user:{id:String(700000000000000000n+BigInt(i))},roles:[team,oldTier,...(i===0?['555555555555555555']:[])]}));members.push({user:{id:'888888888888888888'},roles:[oldTier]});
 const calls=[],state={fail:null};
 const client={rest:{get:async path=>structuredClone(path.endsWith('/roles')?roles:path.endsWith('/channels')?channels:path.includes('/members?')?members: (()=>{throw Error(path);})()),
 patch:async(path,{body})=>{calls.push(['PATCH',path,structuredClone(body)]);if(state.fail===path){state.fail=null;throw Error('network interruption');}if(path==='/guilds/'+guild+'/channels')return;const object=path.includes('/roles/')?roles.find(r=>path.endsWith(r.id)):channels.find(c=>path.endsWith(c.id));assert(object);Object.assign(object,body);return structuredClone(object);},
 put:async path=>{calls.push(['PUT',path]);const m=members.find(m=>path.includes(m.user.id));m.roles.push(path.split('/').at(-1));},
 delete:async path=>{calls.push(['DELETE',path]);assert(path.includes('/members/'));const m=members.find(m=>path.includes(m.user.id));m.roles=m.roles.filter(r=>r!==path.split('/').at(-1));},
 post:async()=>{throw Error('must not create new roles or channels');}}};
 return {client,roles,channels,members,calls,state};
}
test('renames same role and all team-labelled channels while keeping IDs, records, permissions and all 12 people',async()=>{
 const f=fixture(),before=structuredClone(f.channels);const result=await executePremierChannels(f.client,job);
 assert.equal(f.roles[0].name,'상급10');assert.equal(f.channels[0].name,'상급10');assert.equal(f.channels[1].name,'상급10');assert.equal(f.channels[2].name,'상급10 통방');assert.equal(f.channels[4].name,'별도-전략');
 for(let i=0;i<before.length;i++){assert.equal(f.channels[i].id,before[i].id);assert.deepEqual(f.channels[i].permission_overwrites,before[i].permission_overwrites);assert.deepEqual(f.channels[i].messages,before[i].messages);}
 assert.equal(result.memberIds.length,12);assert.equal(result.memberInfoChannelId,f.channels[3].id);
 for(const m of f.members.slice(0,12)){assert(m.roles.includes(team));assert(m.roles.includes(newTier));assert(!m.roles.includes(oldTier));}assert(f.members[0].roles.includes('555555555555555555'));assert.deepEqual(f.members.at(-1).roles,[oldTier]);
 await executePremierChannels(f.client,{...job,channels:result});assert.equal(f.channels.length,5);
});
test('partially completed rename resumes after channel and member role failures',async()=>{
 const f=fixture();f.state.fail='/guilds/'+guild+'/roles/'+team;await assert.rejects(executePremierChannels(f.client,job),/network/);
 assert.equal(f.channels[0].name,'상급10');assert.equal(f.roles[0].name,'중상급2');
 const put=f.client.rest.put;let failed=false;f.client.rest.put=async p=>{if(!failed){failed=true;throw Error('member interruption');}return put(p);};
 await assert.rejects(executePremierChannels(f.client,job),/member interruption/);assert.equal(f.roles[0].name,'상급10');
 await executePremierChannels(f.client,job);assert(f.members.slice(0,12).every(m=>m.roles.includes(newTier)&&!m.roles.includes(oldTier)));
});
test('duplicates, privileged roles, foreign categories and incomplete member lookups fail before any mutation',async()=>{
 for(const change of [f=>f.roles.push({id:'999999999999999999',name:'상급10'}),f=>f.roles[0].permissions='8',f=>f.channels[0].permission_overwrites=[],f=>{f.client.rest.get=async()=>{throw Error('lookup failure');};}]){const f=fixture();change(f);await assert.rejects(executePremierChannels(f.client,job));assert.equal(f.calls.length,0);}
});
test('preserves old tier when a member also belongs to another old-grade team',async()=>{
 const f=fixture(),other='999999999999999999';f.roles.push({id:other,name:'중상급3',permissions:'0'});f.members[0].roles.push(other);await executePremierChannels(f.client,job);assert(f.members[0].roles.includes(oldTier));assert(f.members[0].roles.includes(newTier));
});
