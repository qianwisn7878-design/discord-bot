const {Collection,Events}=require('discord.js');
const fs=require('node:fs'),path=require('node:path');
const phone=require('./systems/phoneSystem.cjs'),activity=require('./systems/activityTimeSystem.cjs'),nickname=require('./systems/valorantNicknameSystem.cjs');
const age=require('./systems/ageSystem.cjs'),gender=require('./systems/genderSystem.cjs'),tier=require('./systems/tierSystem.cjs');
module.exports=function installLegacy(client){
 client.legacyCommands=new Collection();
 for(const file of ['command-13.cjs','command-14.cjs']){const command=require('./commands/'+file);client.legacyCommands.set(command.data.name,command);}
 client.once(Events.ClientReady,async()=>{
  for(const [moduleName,method] of [
   ['joinLeaveLogSystem','startJoinLeaveLogSystem'],['chatLogSystem','startChatLogSystem'],['voiceLogSystem','startVoiceLogSystem'],['reactionLogSystem','startReactionLogSystem'],['autoRoleSystem','startAutoRoleSystem'],['roleLogSystem','startRoleLogSystem'],['termsSystem','startTermsSystem'],['photoTimeoutSystem','startPhotoTimeoutSystem'],['phoneSystem','startPhoneSystem']
  ]){try{await require('./systems/'+moduleName+'.cjs')[method](client);}catch(error){client.__legacyStatus.errors.push(moduleName+': '+error.message);}}
  try{const file=path.join(__dirname,'data','ageMessage.json');let old={};try{old=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}if(!old.sent){await age.sendAgeMessage(client);fs.writeFileSync(file,JSON.stringify({sent:true}));}}catch(error){client.__legacyStatus.errors.push('age: '+error.message);}
  for(const [system,method] of [[gender,'sendGenderMessage'],[tier,'sendTierMessage'],[activity,'sendActivityTimeMessage'],[nickname,'sendValorantNicknameMessage']]){try{await system[method](client);}catch(error){client.__legacyStatus.errors.push(method+': '+error.message);}}
  try{await require('./systems/googleSheetSyncSystem.cjs').startGoogleSheetSync(client);}catch(error){client.__legacyStatus.errors.push('Google 시트 연결 실패');}
 });
 client.on(Events.InteractionCreate,async interaction=>{
  if(!client.__isLegacyInteraction(interaction)||!await client.__authorizeLegacy(interaction))return;
  const id=interaction.customId||'';
  if(interaction.isModalSubmit()){if(id==='phone_modal')return phone.handlePhoneModal(interaction);if(id==='valorant_nickname_modal')return nickname.handleValorantNicknameModal(interaction);if(id==='activity_time_modal_step1')return activity.handleActivityTimeModalStep1(interaction);if(id==='activity_time_modal_step2')return activity.handleActivityTimeModalStep2(interaction);}
  if(interaction.isButton()){
   if(id==='phone_write')return phone.handlePhoneButton(interaction);if(id==='valorant_nickname_write')return nickname.handleValorantNicknameButton(interaction);if(id==='activity_time_write')return activity.handleActivityTimeButton(interaction);if(id==='activity_time_step2_open')return activity.handleActivityTimeStep2Button(interaction);
   if(id.startsWith('age_select_'))return age.handleAgeButton(interaction);
   if(id.startsWith('gender_'))return gender.handleGenderButton(interaction);
   if(id.startsWith('tier_select_'))return tier.handleTierButton(interaction);
   if(id.startsWith('tier_grade_'))return tier.handleTierGradeButton(interaction);
   if(id==='tier_back')return tier.handleTierBackButton(interaction);
  }
  if(interaction.isChatInputCommand())await client.legacyCommands.get(interaction.commandName)?.execute(interaction);
 });
};
