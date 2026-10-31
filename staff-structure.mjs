// Staff ranks and duties are managed only in the community server.
// Retained as an inert compatibility module; never alters team or clan roles.
export function installStaffStructure(){return {run:async()=>({disabled:true,source:'community'}),stop(){}};}
