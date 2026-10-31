const {ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder}=require('discord.js');
const CHANNEL_ID='1510258999529046116';
const AGES=Array.from({length:23},(_,i)=>String((2012-i)%100).padStart(2,'0'));
const roleJobs=new Map(),memberJobs=new Map();
function ageFromRole(role){const match=/^(?:19|20)?(\d{2})년생$/.exec(String(role.name||'').replace(/\s+/g,''));return match&&AGES.includes(match[1])?match[1]:null;}
async function ensureAgeRoles(guild){
 if(roleJobs.has(guild.id))return roleJobs.get(guild.id);
 const task=(async()=>{const roles=await guild.roles.fetch(),found=new Map();for(const role of roles.values()){const age=ageFromRole(role);if(age&&!role.managed&&!found.has(age))found.set(age,role);}
 for(const age of AGES)if(!found.has(age))found.set(age,await guild.roles.create({name:age+'년생',permissions:0n,mentionable:false,hoist:false,reason:'ETG 출생연도 선택 범위 1990~2012년 확장'}));return found;})();
 roleJobs.set(guild.id,task);try{return await task;}finally{if(roleJobs.get(guild.id)===task)roleJobs.delete(guild.id);}
}
function agePayload(){const rows=[];for(let i=0;i<AGES.length;i+=5)rows.push(new ActionRowBuilder().addComponents(...AGES.slice(i,i+5).map(age=>new ButtonBuilder().setCustomId('age_select_'+age).setLabel(age+'년생').setStyle(ButtonStyle.Primary))));return {embeds:[new EmbedBuilder().setTitle('출생연도를 선택하세요').setDescription('1990년생부터 2012년생까지 선택할 수 있습니다.\n가입 조건은 만 14세 이상입니다. 2012년생은 생일이 지나 만 14세가 된 경우에만 선택해 주세요.\n출생연도 역할은 한 개만 받을 수 있습니다.')],components:rows,allowedMentions:{parse:[]}};}
async function refreshAgeMessage(client,message){const guild=message.guild||await client.guilds.fetch(message.guildId);await ensureAgeRoles(guild);const payload=agePayload(),wanted=payload.components.flatMap(row=>row.toJSON().components.map(c=>c.custom_id)),actual=(message.components||[]).flatMap(row=>(row.components||[]).map(c=>c.customId||c.custom_id));if(JSON.stringify(wanted)!==JSON.stringify(actual))await message.edit(payload);}
async function sendAgeMessage(client){const channel=await client.channels.fetch(CHANNEL_ID);if(!channel)throw Error('나이 선택 채널을 찾을 수 없습니다.');await ensureAgeRoles(channel.guild);return channel.send(agePayload());}
async function handleAgeButton(interaction){
 if(!interaction.isButton()||!interaction.customId.startsWith('age_select_'))return false;
 const match=/^age_select_(\d{2})(_confirm)?$/.exec(interaction.customId);if(!match||!AGES.includes(match[1])){await interaction.reply({content:'출생연도를 다시 선택해 주세요.',ephemeral:true});return true;}
 const age=match[1];if(age==='12'&&!match[2]){await interaction.reply({content:'2012년생은 생일이 지나 만 14세 이상이어야 가입할 수 있습니다. 해당 조건을 충족하나요?',ephemeral:true,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('age_select_12_confirm').setLabel('생일이 지났고 만 14세 이상입니다').setStyle(ButtonStyle.Primary))]});return true;}
 await interaction.deferReply({ephemeral:true});
 const key=interaction.guildId+':'+interaction.user.id,previous=memberJobs.get(key)||Promise.resolve();
 const task=previous.catch(()=>{}).then(async()=>{const roles=await ensureAgeRoles(interaction.guild),member=await interaction.guild.members.fetch(interaction.user.id),existing=[...member.roles.cache.values()].find(r=>ageFromRole(r));if(existing){await interaction.editReply('이미 출생연도 역할 **'+existing.name+'**을 가지고 있습니다. 출생연도 역할은 한 개만 받을 수 있습니다.');return;}
 const role=roles.get(age);if(!role?.editable)throw Error('봇의 역할을 출생연도 역할보다 위로 배치하고 역할 관리 권한을 확인해 주세요.');await member.roles.add(role,'출생연도 선택 시스템');await interaction.editReply('✅ **'+age+'년생** 역할을 추가했습니다.');});
 memberJobs.set(key,task);try{await task;}catch(error){await interaction.editReply('역할 지급에 실패했습니다. '+error.message);}finally{if(memberJobs.get(key)===task)memberJobs.delete(key);}return true;
}
module.exports={sendAgeMessage,handleAgeButton,refreshAgeMessage,ensureAgeRoles,agePayload,ageFromRole};
