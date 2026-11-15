const GUILD='1554439352652922891',CATEGORY='1566303694104952872';
export async function cleanup(client,job){
 if(job.guildId!==GUILD||!/^[a-f0-9-]{36}$/.test(job.eventId||'')||!/^\d{17,20}$/.test(job.lobbyId||'')||!Array.isArray(job.channelIds)||!job.channelIds.length||job.channelIds.length>2||new Set(job.channelIds).size!==job.channelIds.length||job.channelIds.includes(job.lobbyId)||job.channelIds.some(id=>!/^\d{17,20}$/.test(id)))throw Error('내전 음성 정리 작업을 확인하세요.');
 const guild=client.guilds.cache.get(GUILD);
 if(!client.isReady()||!guild||guild.available===false)throw Error('내전 서버 연결을 확인하세요.');
 const lobby=await client.rest.get('/channels/'+job.lobbyId);
 const valid=c=>c.guild_id===GUILD&&c.type===2&&c.parent_id===CATEGORY&&c.name?.includes(job.eventId.slice(0,8));
 if(!valid(lobby))throw Error('내전 대기실을 확인하세요.');
 for(const id of job.channelIds){
  let room;try{room=await client.rest.get('/channels/'+id);}catch(e){if(e.status===404)continue;throw e;}
  if(!valid(room))throw Error('내전 팀 음성방을 확인하세요.');
  for(const state of guild.voiceStates.cache.values()){
   if(state.channelId===id)await client.rest.patch('/guilds/'+GUILD+'/members/'+state.id,{body:{channel_id:job.lobbyId}});
  }
  // Gateway events can lag REST moves. Try deletion on a subsequent tick if needed.
  if([...guild.voiceStates.cache.values()].some(v=>v.channelId===id))throw Error('음성 이동 반영 대기');
  await client.rest.delete('/channels/'+id);
 }
}
