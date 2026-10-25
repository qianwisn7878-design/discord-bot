const {
    EmbedBuilder,
    Events
} = require('discord.js');
const JOIN_LEAVE_LOG_CHANNEL_ID =
    '1552001932053315695';
async function sendLog(channel, embed) {
    try {
        await channel.send({
            embeds: [embed]
        });
    } catch (error) {
        console.error(
            '입장/퇴장 로그 전송 실패:',
            error
        );
    }
}
function startJoinLeaveLogSystem(client) {
    client.on(
        Events.GuildMemberAdd,
        async member => {
            if (member.user.bot) {
                return;
            }
            try {
                const channel =
                    await client.channels.fetch(
                        JOIN_LEAVE_LOG_CHANNEL_ID
                    );
                if (!channel) {
                    return;
                }
                const embed =
                    new EmbedBuilder()
                        .setTitle('📥 서버 입장')
                        .setColor(0x57F287)
                        .setThumbnail(
                            member.user.displayAvatarURL({
                                dynamic: true,
                                size: 256
                            })
                        )
                        .addFields(
                            {
                                name: '사용자',
                                value:
                                    `${member.user} (${member.user.tag})`,
                                inline: false
                            },
                            {
                                name: '사용자명',
                                value:
                                    `\`${member.user.username}\``,
                                inline: true
                            },
                            {
                                name: '사용자 ID',
                                value:
                                    `\`${member.id}\``,
                                inline: true
                            }
                        )
                        .setTimestamp()
                        .setFooter({
                            text:
                                `회원 수: ${member.guild.memberCount}명`
                        });
                await sendLog(
                    channel,
                    embed
                );
            } catch (error) {
                console.error(
                    '서버 입장 로그 처리 실패:',
                    error
                );
            }
        }
    );
    client.on(
        Events.GuildMemberRemove,
        async member => {
            if (member.user.bot) {
                return;
            }
            try {
                const channel =
                    await client.channels.fetch(
                        JOIN_LEAVE_LOG_CHANNEL_ID
                    );
                if (!channel) {
                    return;
                }
                const embed =
                    new EmbedBuilder()
                        .setTitle('📤 서버 퇴장')
                        .setColor(0xED4245)
                        .setThumbnail(
                            member.user.displayAvatarURL({
                                dynamic: true,
                                size: 256
                            })
                        )
                        .addFields(
                            {
                                name: '사용자',
                                value:
                                    `${member.user} (${member.user.tag})`,
                                inline: false
                            },
                            {
                                name: '사용자명',
                                value:
                                    `\`${member.user.username}\``,
                                inline: true
                            },
                            {
                                name: '사용자 ID',
                                value:
                                    `\`${member.id}\``,
                                inline: true
                            }
                        )
                        .setTimestamp();
                await sendLog(
                    channel,
                    embed
                );
            } catch (error) {
                console.error(
                    '서버 퇴장 로그 처리 실패:',
                    error
                );
            }
        }
    );
    console.log(
        '입장/퇴장 로그 시스템 시작 완료'
    );
}
module.exports = {
    startJoinLeaveLogSystem
};
