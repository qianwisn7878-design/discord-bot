const ROSTER_GUILDS=new Set(['1492461447568162876','1554439098490429442','1554439352652922891','1563217788288499813']);
export function createRosterRefresh({refresh,onError=()=>{},delayMs=250,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,running=false,pending=false,stopped=false,retries=0;
 const arm=(delay=delayMs)=>{if(timer!==null)clearTimer(timer);timer=setTimer(run,delay);timer?.unref?.();};
 const run=async()=>{
  timer=null;if(stopped||running)return;
  running=true;pending=false;
  let failed=false;try{await refresh();retries=0;}catch(error){failed=true;onError(error);retries++;pending=true;}
  finally{running=false;if(pending&&!stopped)arm(failed?Math.max(delayMs,Math.min(30000,5000*retries)):delayMs);}
 };
 return {request(){if(stopped)return;pending=true;if(!running&&timer===null)arm();},stop(){stopped=true;pending=false;if(timer!==null)clearTimer(timer);}};
}
export function installRosterRefresh(client,options){
 const queues=new Map(),roles=member=>[...(member.roles?.cache?.keys?.()||[])].sort().join(',');
 function queue(guild){if(!queues.has(guild.id)){const entry={members:new Map(),active:null,occurredAt:0,refresher:null};entry.refresher=createRosterRefresh({...options,refresh:async()=>{if(!entry.active){entry.active={guildId:guild.id,occurredAt:entry.occurredAt,members:[...entry.members.values()].slice(0,100),roles:[...(guild.roles?.cache?.values?.()||[])].map(role=>({id:role.id,name:role.name,position:role.position,managed:Boolean(role.managed),permissions:String(role.permissions?.bitfield||0)}))};for(const member of entry.active.members)entry.members.delete(member.id);}await options.refresh(entry.active);entry.active=null;if(entry.members.size)entry.refresher.request();}});queues.set(guild.id,entry);}return queues.get(guild.id);}
 function request(member,removed=false){if(!ROSTER_GUILDS.has(member.guild?.id)||member.user?.bot)return;const entry=queue(member.guild);entry.occurredAt=Date.now();entry.members.set(member.id,{id:member.id,name:member.displayName||member.user?.globalName||member.user?.username||'회원',roles:[...(member.roles?.cache?.keys?.()||[])],avatar:member.displayAvatarURL?.({extension:'png',size:128})||null,removed});entry.refresher.request();}
 const changed=(oldMember,newMember)=>{if(roles(oldMember)!==roles(newMember))request(newMember);};
 const added=member=>request(member),removed=member=>request(member,true);
 const roleChanged=role=>{if(!ROSTER_GUILDS.has(role.guild?.id))return;const entry=queue(role.guild);entry.occurredAt=Date.now();entry.refresher.request();};
 client.on('guildMemberUpdate',changed);client.on('guildMemberAdd',added);client.on('guildMemberRemove',removed);client.on('roleCreate',roleChanged);client.on('roleUpdate',updated);client.on('roleDelete',roleChanged);
 return {stop(){for(const entry of queues.values())entry.refresher.stop();client.removeListener('guildMemberUpdate',changed);client.removeListener('guildMemberAdd',added);client.removeListener('guildMemberRemove',removed);client.removeListener('roleCreate',roleChanged);client.removeListener('roleDelete',roleChanged);client.removeListener('roleUpdate',updated);}};
 function updated(_old,role){roleChanged(role);}
}
