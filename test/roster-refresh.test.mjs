import {test} from 'node:test';import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';
import {createRosterRefresh,installRosterRefresh} from '../roster-refresh.mjs';
function timers(){const pending=new Map;let seq=0;return {pending,setTimer:(fn,delay)=>{const id=++seq;pending.set(id,{fn,delay});return id;},clearTimer:id=>pending.delete(id),run:async()=>{const [id,item]=pending.entries().next().value;pending.delete(id);await item.fn();}};}
test('role bursts coalesce without waiting forever; updates during a request are not lost',async()=>{
 const clock=timers();let count=0,release;const refresh=createRosterRefresh({...clock,refresh:()=>{count++;return count===1?new Promise(resolve=>release=resolve):Promise.resolve();}});
 for(let n=0;n<20;n++)refresh.request();assert.equal(clock.pending.size,1);const running=clock.run();assert.equal(count,1);
 refresh.request();refresh.request();assert.equal(clock.pending.size,0);release();await running;assert.equal(clock.pending.size,1);await clock.run();assert.equal(count,2);assert.equal(clock.pending.size,0);refresh.stop();
});
test('failures retry and stopping cancels pending work',async()=>{const clock=timers();let tries=0,errors=0;const refresh=createRosterRefresh({...clock,refresh:async()=>{if(++tries===1)throw Error('temporary');},onError:()=>errors++});refresh.request();await clock.run();assert.equal(errors,1);assert.equal(clock.pending.values().next().value.delay,5000);await clock.run();assert.equal(tries,2);refresh.request();refresh.stop();assert.equal(clock.pending.size,0);});
test('only team role changes and team joins/leaves trigger a refresh',async()=>{const client=new EventEmitter,clock=timers();let requests=0;const listener=installRosterRefresh(client,{...clock,refresh:async()=>requests++});const member=roles=>({guild:{id:'1492461447568162876'},user:{bot:false},roles:{cache:new Map(roles.map(id=>[id,{}]))}});
 client.emit('guildMemberUpdate',member(['a']),member(['a']));assert.equal(clock.pending.size,0);
 client.emit('guildMemberUpdate',member(['a']),member(['a','b']));client.emit('guildMemberUpdate',member(['a','b']),member(['b']));assert.equal(clock.pending.size,1);await clock.run();assert.equal(requests,1);
 client.emit('guildMemberUpdate',member(['a']),{...member(['b']),guild:{id:'other'}});assert.equal(clock.pending.size,0);
 client.emit('guildMemberRemove',member(['b']));await clock.run();assert.equal(requests,2);listener.stop();assert.equal(client.listenerCount('guildMemberUpdate'),0);
});
