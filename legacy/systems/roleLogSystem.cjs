const {
    EmbedBuilder,
    Events
} = require('discord.js');
const ROLE_LOG_CHANNEL_ID =
    '1552415232058593371';
function limitText(
    text,
    max = 1000
) {
    if (
        !text
    ) {
        return '';
    }
    if (
        text.length > max
    ) {
        return (
            text.slice(
                0,
                max - 3
            ) +
            '...'
        );
    }
    return text;
}
async function sendRoleLog(
    member,
    role,
    type
) {
    try {
        const channel =
            await member.guild.channels
                .fetch(
                    ROLE_LOG_CHANNEL_ID
                )
                .catch(
                    () => null
                );
        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.error(
                '[역할 로그] 로그 채널을 찾을 수 없습니다.'
            );
            return;
        }
        const isAdded =
            type === 'add';
        const embed =
            new EmbedBuilder()
                .setTitle(
                    isAdded
                        ? '➕ 역할 추가'
                        : '➖ 역할 제거'
                )
                .setDescription(
                    isAdded
                        ? `${member}님의 역할이 추가되었습니다.`
                        : `${member}님의 역할이 제거되었습니다.`
                )
                .addFields(
                    {
                        name: '사용자',
                        value:
                            `${member.user.tag}\n` +
                            `\`${member.id}\``,
                        inline: true
                    },
                    {
                        name: '역할',
                        value:
                            `${role}\n` +
                            `\`${role.name}\``,
                        inline: true
                    },
                    {
                        name: '역할 ID',
                        value:
                            `\`${role.id}\``,
                        inline: true
                    }
                )
                .setTimestamp();
        await channel.send({
            embeds: [
                embed
            ]
        });
    } catch (error) {
        console.error(
            '[역할 로그] 로그 전송 실패:',
            error
        );
    }
}
function startRoleLogSystem(
    client
) {
    client.on(
        Events.GuildMemberUpdate,
        async (
            oldMember,
            newMember
        ) => {
            try {
                const oldRoles =
                    oldMember.roles.cache;
                const newRoles =
                    newMember.roles.cache;
                const addedRoles =
                    newRoles.filter(
                        role =>
                            !oldRoles.has(
                                role.id
                            )
                    );
                const removedRoles =
                    oldRoles.filter(
                        role =>
                            !newRoles.has(
                                role.id
                            )
                    );
                for (
                    const role
                    of addedRoles.values()
                ) {
                    await sendRoleLog(
                        newMember,
                        role,
                        'add'
                    );
                }
                for (
                    const role
                    of removedRoles.values()
                ) {
                    await sendRoleLog(
                        newMember,
                        role,
                        'remove'
                    );
                }
            } catch (error) {
                console.error(
                    '[역할 로그] 역할 변경 감지 실패:',
                    error
                );
            }
        }
    );
    console.log(
        '✅ 역할 추가/제거 로그 시스템 시작'
    );
}
module.exports = {
    startRoleLogSystem
};
