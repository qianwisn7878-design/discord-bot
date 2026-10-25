const {
    EmbedBuilder,
    Events
} = require('discord.js');
const REACTION_LOG_CHANNEL_ID = '1552408692740067410';
function getEmojiName(reaction) {
    if (reaction.emoji.id) {
        return `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
    }
    return reaction.emoji.name || '알 수 없는 이모지';
}
function getMessageUrl(reaction) {
    return `https://discord.com/channels/${reaction.message.guildId}/${reaction.message.channelId}/${reaction.message.id}`;
}
function limitText(text, max = 1000) {
    if (!text) return '(메시지 내용 없음)';
    if (text.length > max) {
        return text.slice(0, max - 3) + '...';
    }
    return text;
}
async function sendReactionLog(reaction, user, type) {
    try {
        const guild = reaction.message.guild;
        if (!guild) return;
        const logChannel = await guild.channels
            .fetch(REACTION_LOG_CHANNEL_ID)
            .catch(() => null);
        if (!logChannel || !logChannel.isTextBased()) return;
        const emoji = getEmojiName(reaction);
        const messageUrl = getMessageUrl(reaction);
        const member = guild.members.cache.get(user.id);
        const username = member
            ? member.user.username
            : user.username;
        const displayName = member
            ? member.displayName
            : user.username;
        const isAdd = type === 'add';
        const embed = new EmbedBuilder()
            .setTitle(
                isAdd
                    ? '👍 반응 추가'
                    : '🗑️ 반응 제거'
            )
            .setDescription(
                isAdd
                    ? `${displayName}님이 메시지에 반응을 추가했습니다.`
                    : `${displayName}님이 메시지에서 반응을 제거했습니다.`
            )
            .addFields(
                {
                    name: '사용자',
                    value: `${displayName} (\`${username}\`)`,
                    inline: true
                },
                {
                    name: '이모지',
                    value: emoji,
                    inline: true
                },
                {
                    name: '채널',
                    value: `<#${reaction.message.channelId}>`,
                    inline: true
                },
                {
                    name: '메시지',
                    value: `[메시지 바로가기](${messageUrl})`,
                    inline: true
                },
                {
                    name: '메시지 내용',
                    value: limitText(reaction.message.content),
                    inline: false
                }
            )
            .setTimestamp();
        await logChannel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error('[반응 로그 오류]', error);
    }
}
function startReactionLogSystem(client) {
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[반응 추가 Fetch 오류]', error);
                return;
            }
        }
        await sendReactionLog(
            reaction,
            user,
            'add'
        );
    });
    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        if (user.bot) return;
        if (reaction.partial) {
            try {
                await reaction.fetch();
            } catch (error) {
                console.error('[반응 제거 Fetch 오류]', error);
                return;
            }
        }
        await sendReactionLog(
            reaction,
            user,
            'remove'
        );
    });
    console.log('✅ 반응 로그 시스템 시작');
}
module.exports = {
    startReactionLogSystem
};
