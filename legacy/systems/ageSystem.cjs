const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const CHANNEL_ID = '1510258999529046116';
const AGE_ROLES = {
    '98': '1546291224648880259',
    '99': '1546291305964109884',
    '00': '1536798154681229312',
    '01': '1536798154077511740',
    '02': '1536798152923807915',
    '03': '1536798152185745438',
    '04': '1536798151879565362',
    '05': '1536798151061540914',
    '06': '1536798150487048212',
    '07': '1536798146863304724',
    '08': '1536798146804580412',
    '09': '1536798142018752602',
    '10': '1536798139296514088',
    '11': '1536798130803314802'
};
const AGES = [
    '11',
    '10',
    '09',
    '08',
    '07',
    '06',
    '05',
    '04',
    '03',
    '02',
    '01',
    '00',
    '99',
    '98'
];
function createAgeButtons() {
    const rows = [];
    for (let i = 0; i < AGES.length; i += 5) {
        const row = new ActionRowBuilder();
        for (
            let j = i;
            j < Math.min(i + 5, AGES.length);
            j++
        ) {
            const age = AGES[j];
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`age_select_${age}`)
                    .setLabel(age)
                    .setStyle(ButtonStyle.Primary)
            );
        }
        rows.push(row);
    }
    return rows;
}
async function sendAgeMessage(client) {
    try {
        const channel =
            await client.channels.fetch(CHANNEL_ID);
        if (!channel) {
            console.error(
                '[나이시스템] 채널을 찾을 수 없습니다.'
            );
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('본인 나이를 고르세요')
            .setDescription(
                '본인 나이 고르쇼'
            );
        const message = await channel.send({
            embeds: [embed],
            components: createAgeButtons()
        });
        console.log(
            `[나이시스템] 나이 선택 메시지 생성 완료: ${message.id}`
        );
    } catch (error) {
        console.error(
            '[나이시스템] 메시지 생성 실패:',
            error
        );
    }
}
async function handleAgeButton(interaction) {
    if (
        !interaction.isButton() ||
        !interaction.customId.startsWith('age_select_')
    ) {
        return false;
    }
    const age =
        interaction.customId.replace(
            'age_select_',
            ''
        );
    const roleId = AGE_ROLES[age];
    if (!roleId) {
        await interaction.reply({
            content:
                '해당 나이의 역할이 설정되어 있지 않습니다.',
            ephemeral: true
        });
        return true;
    }
    const member =
        await interaction.guild.members
            .fetch(interaction.user.id)
            .catch(() => null);
    if (!member) {
        await interaction.reply({
            content:
                '유저 정보를 불러오지 못했습니다.',
            ephemeral: true
        });
        return true;
    }
    const existingAgeRoleId =
        Object.values(AGE_ROLES).find(
            id => member.roles.cache.has(id)
        );
    if (existingAgeRoleId) {
        const existingRole =
            interaction.guild.roles.cache.get(
                existingAgeRoleId
            );
        await interaction.reply({
            content:
                `이미 나이 역할 **${existingRole?.name || '등록된 나이'}**을 가지고 있습니다.\n\n` +
                '나이 역할은 하나만 가질 수 있습니다.',
            ephemeral: true
        });
        return true;
    }
    const role =
        interaction.guild.roles.cache.get(roleId);
    if (!role) {
        await interaction.reply({
            content:
                `**${age}** 나이 역할을 찾을 수 없습니다.\n` +
                `역할 ID: ${roleId}`,
            ephemeral: true
        });
        return true;
    }
    if (!role.editable) {
        await interaction.reply({
            content:
                `**${role.name}** 역할을 지급할 수 없습니다.\n\n` +
                '봇의 역할이 해당 나이 역할보다 위에 있는지 확인해주세요.',
            ephemeral: true
        });
        return true;
    }
    try {
        await member.roles.add(
            role,
            '나이 선택 시스템'
        );
        await interaction.reply({
            content:
                `✅ **${age}** 나이 역할을 추가했습니다.`,
            ephemeral: true
        });
        console.log(
            `[나이시스템] ${interaction.user.tag} → ${age}`
        );
    } catch (error) {
        console.error(
            '[나이시스템] 역할 추가 실패:',
            error
        );
        if (!interaction.replied) {
            await interaction.reply({
                content:
                    '역할을 추가하지 못했습니다.\n' +
                    '봇의 역할 위치와 Manage Roles 권한을 확인해주세요.',
                ephemeral: true
            });
        }
    }
    return true;
}
module.exports = {
    sendAgeMessage,
    handleAgeButton
};
