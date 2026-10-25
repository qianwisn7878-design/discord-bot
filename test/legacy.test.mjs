import {test} from 'node:test';import assert from 'node:assert/strict';
import {Client,GatewayIntentBits,Collection} from 'discord.js';
import {installLegacy,legacyCapabilities,isLegacyInteraction,mayUseLegacyCommand} from '../legacy.mjs';
test('privileged intents are only requested when Discord reports them enabled',()=>{assert.deepEqual(legacyCapabilities(0),{members:false,content:false});assert.deepEqual(legacyCapabilities((1<<15)|(1<<19)),{members:true,content:true});assert.deepEqual(legacyCapabilities(1<<14),{members:true,content:false});});
test('legacy routing does not consume current helper commands or shared buttons',()=>{const names=new Set(['기본역할']),i={isChatInputCommand:()=>true,commandName:'기본역할'};assert(isLegacyInteraction(i,names));assert(!isLegacyInteraction({...i,commandName:'스크림'},names));assert(!isLegacyInteraction({isChatInputCommand:()=>false,customId:'etgp:create'},names));assert(isLegacyInteraction({isChatInputCommand:()=>false,customId:'age_select_00'},names));});
test('administrative legacy commands require owner, manager or manage-server access',()=>{const i={isChatInputCommand:()=>true,commandName:'정보추가',user:{id:'outsider'},member:{roles:{cache:new Collection}},memberPermissions:{has:()=>false}};assert.equal(mayUseLegacyCommand(i),false);assert(mayUseLegacyCommand({...i,user:{id:'794026986002448414'}}));i.member.roles.cache.set('1515403509103722627',{});assert(mayUseLegacyCommand(i));});
test('only information commands remain and personal replies are private',async()=>{
 const client=new Client({intents:[GatewayIntentBits.Guilds]});let posts=0;
 const legacy=await installLegacy(client,async(path,body)=>{assert.equal(path,'/api/discord-bot/legacy-state');if(body){posts++;return {version:2};}return {version:1,rawFiles:{}};},{members:false,content:false});
 assert.equal(client.legacyCommands.size,2);for(const command of client.legacyCommands.values()){const json=command.data.toJSON();assert(json.name);assert(json.description);}
 assert.deepEqual([...client.legacyCommands.keys()].sort(),['정보보기','정보추가']);assert(!isLegacyInteraction({isChatInputCommand:()=>false,customId:'match_accept'},new Set()));
 assert.deepEqual(legacy.status.missingIntents,['Server Members Intent','Message Content Intent']);
 const i={guildId:'1492461447568162876',guild:{id:'1492461447568162876'},client,isChatInputCommand:()=>true,commandName:'정보추가',isModalSubmit:()=>false,isButton:()=>false,options:{getUser:()=>null,getString:()=>''},user:{id:'794026986002448414'},reply:async body=>{i.replyBody=body;},followUp:async body=>{i.replyBody=body;}};
 client.emit('interactionCreate',i);await new Promise(r=>setImmediate(r));assert.match(i.replyBody.content,/유저/);assert.equal(i.replyBody.flags,64);assert.equal(posts,0);
 await legacy.stop();client.destroy();
});
