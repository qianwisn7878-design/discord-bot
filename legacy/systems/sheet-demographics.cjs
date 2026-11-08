const COMMUNITY='1554439098490429442';
function fromRoles(member,{ageRoles={},maleRoleId,femaleRoleId}={}){
 const roles=[...(member.roles?.cache?.values?.()||[])],years=new Set(),genders=new Set();
 for(const role of roles){
  const name=String(role.name||'').normalize('NFKC').replace(/\s/g,'');
  const match=/^((?:19|20)?\d{2})년생$/.exec(name);
  if(match){
   const text=match[1],year=text.length===4?Number(text):(Number(text)>=90?1900:2000)+Number(text);
   if(year>=1900&&year<=new Date().getUTCFullYear())years.add(year);
  }
  if(['남자','남성'].includes(name))genders.add('남자');
  if(['여자','여성'].includes(name))genders.add('여자');
 }
 if(!years.size)for(const [text,id] of Object.entries(ageRoles))if(member.roles?.cache?.has(id))years.add((Number(text)>=90?1900:2000)+Number(text));
 if(!genders.size){
  if(maleRoleId&&member.roles?.cache?.has(maleRoleId))genders.add('남자');
  if(femaleRoleId&&member.roles?.cache?.has(femaleRoleId))genders.add('여자');
 }
 if(years.size>1||genders.size>1)throw Error('출생연도 또는 성별 역할이 중복되어 시트 동기화를 보류합니다.');
 const year=[...years][0];return {age:year===undefined?'':String(year%100).padStart(2,'0'),gender:[...genders][0]||''};
}
function profileValues(response,member,legacy){
 if(!response||!Object.hasOwn(response,'profile'))throw Error('가입 정보 응답을 확인하지 못해 기존 시트 내용을 유지합니다.');
 if(response.profile===null)return response.clear===true?{age:'',gender:''}:fromRoles(member,legacy);
 const p=response.profile;
 if(!Number.isInteger(p.birthYear)||p.birthYear<1900||p.birthYear>new Date().getUTCFullYear()||!['male','female'].includes(p.gender))throw Error('출생연도·성별 응답이 올바르지 않아 기존 시트 내용을 유지합니다.');
 return {age:String(p.birthYear%100).padStart(2,'0'),gender:p.gender==='male'?'남자':'여자'};
}
async function resolveSheetDemographics(client,member,legacy={}){
 const cached=client.__getCommunityDemographicProfile?.(member.id);
 if(cached&&Number.isFinite(cached.fetchedAt)&&Date.now()-cached.fetchedAt>=0&&Date.now()-cached.fetchedAt<=300000)return profileValues(cached,member,legacy);
 if(typeof client.__legacyBridge!=='function')return fromRoles(member,legacy);
 const response=await client.__legacyBridge('/api/discord-bot/community-registration',{action:'demographics',guildId:COMMUNITY,userId:member.id,at:Date.now()});
 return profileValues(response,member,legacy);
}
function createSheetSyncRunner({run,onError=()=>{},delayMs=2000,retryMs=5000,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,running=false,requested=false,stopped=false,failures=0;
 const arm=ms=>{timer=setTimer(tick,ms);timer?.unref?.();};
 async function tick(){
  timer=null;if(stopped||running)return;running=true;requested=false;let failed=false;
  try{await run();failures=0;}catch(e){failed=true;failures++;requested=true;onError(e);}
  finally{running=false;if(requested&&!stopped)arm(failed?Math.min(60000,retryMs*2**Math.min(failures-1,4)):delayMs);}
 }
 return {request(ms=delayMs){if(stopped)return;requested=true;if(!running&&timer===null)arm(ms);},stop(){stopped=true;requested=false;if(timer!==null)clearTimer(timer);timer=null;}};
}
module.exports={fromRoles,profileValues,resolveSheetDemographics,createSheetSyncRunner};
