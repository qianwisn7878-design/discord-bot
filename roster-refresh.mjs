const TEAM_GUILD='1492461447568162876';
export function createRosterRefresh({refresh,onError=()=>{},delayMs=1000,setTimer=setTimeout,clearTimer=clearTimeout}){
 let timer=null,running=false,pending=false,stopped=false,retries=0;
 const arm=(delay=delayMs)=>{if(timer!==null)clearTimer(timer);timer=setTimer(run,delay);timer?.unref?.();};
 const run=async()=>{
  timer=null;if(stopped||running)return;
  running=true;pending=false;
  let failed=false;try{await refresh();retries=0;}catch(error){failed=true;onError(error);if(++retries<=3)pending=true;}
  finally{running=false;if(pending&&!stopped)arm(failed?Math.max(delayMs,5000):delayMs);}
 };
 return {request(){if(stopped)return;pending=true;if(!running&&timer===null)arm();},stop(){stopped=true;pending=false;if(timer!==null)clearTimer(timer);}};
}
export function installRosterRefresh(client,options){
 const refresher=createRosterRefresh(options),roles=member=>[...(member.roles?.cache?.keys?.()||[])].sort().join(',');
 const changed=(oldMember,newMember)=>{if(newMember.guild?.id===TEAM_GUILD&&!newMember.user?.bot&&roles(oldMember)!==roles(newMember))refresher.request();};
 const memberChanged=member=>{if(member.guild?.id===TEAM_GUILD&&!member.user?.bot)refresher.request();};
 client.on('guildMemberUpdate',changed);client.on('guildMemberAdd',memberChanged);client.on('guildMemberRemove',memberChanged);
 return {stop(){refresher.stop();client.removeListener('guildMemberUpdate',changed);client.removeListener('guildMemberAdd',memberChanged);client.removeListener('guildMemberRemove',memberChanged);}};
}
