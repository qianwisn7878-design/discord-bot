function matches(actual,expected){
 if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((v,n)=>matches(actual[n],v));
 if(expected&&typeof expected==='object')return !!actual&&Object.entries(expected).filter(([,v])=>v!==undefined).every(([k,v])=>matches(actual[k],v));
 return actual===expected||expected==null&&actual==null;
}
export async function syncGuildCommands(client,guildId,desired,{remove=[]}={}){
 const base='/applications/'+client.user.id+'/guilds/'+guildId+'/commands',existing=await client.rest.get(base),removed=new Set(remove);let changed=0;
 for(const old of existing)if(removed.has(old.name)&&!desired.some(c=>c.name===old.name)){await client.rest.delete(base+'/'+old.id);changed++;}
 for(const command of desired){const expected={...command,type:command.type||1,options:command.options||[]},old=existing.find(c=>c.name===command.name&&(c.type||1)===expected.type);if(old&&matches({...old,options:old.options||[]},expected))continue;await client.rest.post(base,{body:command});changed++;}
 return {changed};
}
export function scrimNeedsRefresh(customId=''){return /^etgp:(run|challenge|execute|submit|submit-draft):/.test(customId);}
