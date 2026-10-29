const CATEGORY='1564911577017360465',PANEL='ETG Support Tickets v1',runs=new WeakMap();
// Remove only the retired support interface. Ticket conversations remain untouched.
export async function cleanupRetiredSupportTickets(client){
 let state=runs.get(client);if(!state){state={done:new Set(),before:new Map()};runs.set(client,state);}
 const category=await client.rest.get('/channels/'+CATEGORY);if(category.type!==4)throw Error('기존 티켓 카테고리를 확인하세요.');
 const channels=await client.rest.get('/guilds/'+category.guild_id+'/channels');
 const channel=channels.find(c=>c.type===0&&c.parent_id===CATEGORY&&!state.done.has(c.id)&&(c.topic===PANEL||/^etg-support:v[12]:/.test(c.topic||'')));
 if(!channel)return;
 const before=state.before.get(channel.id),messages=await client.rest.get('/channels/'+channel.id+'/messages?limit=100'+(before?'&before='+before:''));
 if(!Array.isArray(messages))throw Error('기존 접수창 메시지 조회 실패');
 let changed=0,processed=0,last=null;
 for(const message of messages){
  const owned=message.author?.id===client.user.id,panel=owned&&message.embeds?.some(e=>e.footer?.text===PANEL),controls=owned&&message.components?.some(row=>row.components?.some(c=>c.custom_id?.startsWith('etgticket:')));
  if(panel)await client.rest.delete('/channels/'+channel.id+'/messages/'+message.id);
  else if(controls)await client.rest.patch('/channels/'+channel.id+'/messages/'+message.id,{body:{components:[]}});
  if(panel||controls)changed++;
  processed++;last=message.id;if(changed>=10)break;
 }
 if(messages.length<100&&processed===messages.length){
  // Delete the entry channel only after proving it contains no conversation data.
  if(channel.topic===PANEL&&!before&&messages.every(m=>m.author?.id===client.user.id&&m.embeds?.some(e=>e.footer?.text===PANEL)))await client.rest.delete('/channels/'+channel.id);
  state.done.add(channel.id);state.before.delete(channel.id);
 }else if(last)state.before.set(channel.id,last);
}
