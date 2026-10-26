import {test} from 'node:test';import assert from 'node:assert/strict';
import {syncGuildCommands,scrimNeedsRefresh} from '../command-sync.mjs';
test('unchanged guild commands skip registration despite Discord default fields',async()=>{
 const calls=[],desired=[{name:'synthetic',description:'test',type:1,options:[{name:'team',description:'team',type:3}]}],client={user:{id:'bot'},rest:{get:async()=>[{...desired[0],id:'command',version:'123',options:[{...desired[0].options[0],required:false,autocomplete:false}]}],post:async()=>calls.push('post')}};
 assert.equal((await syncGuildCommands(client,'guild',desired)).changed,0);assert.equal(calls.length,0);
 desired[0].options=[];assert.equal((await syncGuildCommands(client,'guild',desired)).changed,1);
});
test('only explicitly retired commands are removed and draft controls do not force global synchronization',async()=>{
 const deleted=[],client={user:{id:'bot'},rest:{get:async()=>[{id:'a',name:'retired'},{id:'b',name:'keep'}],delete:async path=>deleted.push(path),post:async()=>{}}};
 await syncGuildCommands(client,'guild',[],{remove:['retired']});assert.equal(deleted.length,1);assert(deleted[0].endsWith('/a'));
 for(const action of ['draft-option:x:region','create-mode:veto','draft-next:x','draft-map:x','map-start:x','map-choose:x:y','view:x'])assert(!scrimNeedsRefresh('etgp:'+action));
 for(const action of ['run:begin-match:x','challenge:x','submit-draft:x'])assert(scrimNeedsRefresh('etgp:'+action));
});
