import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTeamScrimInteraction} from '../premier-scrims.mjs';
const base={guildId:'1492461447568162876',user:{id:'111111111111111111'},id:'222222222222222222'};
test('main bot keeps recruitment UI',async()=>{
 let out;await handleTeamScrimInteraction({...base,customId:'etgp:create',reply:async p=>out=p},()=>{throw Error('unneeded bridge');},64);
 assert.equal(out.components[0].components.length,3);assert.ok(out.content.includes('맵 결정'));
});
test('old progression and finish buttons hand off without sending any game action',async()=>{
 for(const customId of ['etgp:run:start:111','etgp:map-start:111','etgp:execute:finish:111:1']){
  let out;await handleTeamScrimInteraction({...base,customId,reply:async p=>out=p},()=>{throw Error('must not progress on primary');},64);
  assert.ok(out.content.includes('내전봇'));assert.equal(out.components[0].components[0].url,'https://enjoythegame.kr/home#premier');
 }
});
