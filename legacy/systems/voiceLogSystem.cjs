const {
    EmbedBuilder,
    Events
} = require('discord.js');
const VOICE_LOG_CHANNEL_ID =
    '1552002112035094579';
function startVoiceLogSystem(client) {
    client.on(
        Events.VoiceStateUpdate,
        async (oldState, newState) => {
            const member =
                newState.member ||
                oldState.member;
            if (!member) {
                return;
            }
            if (member.user.bot) {
                return;
            }
            if (
                oldState.channelId ===
                newState.channelId
            ) {
                return;
            }
            try {
                const logChannel =
                    await client.channels.fetch(
                        VOICE_LOG_CHANNEL_ID
                    );
                if (!logChannel) {
                    return;
                }
                let embed;
                if (
                    !oldState.channelId &&
                    newState.channelId
                ) {
                    embed =
                        new EmbedBuilder()
                            .setTitle('🔊 음성채널 입장')
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
                                        `${member.user}`,
                                    inline: true
                                },
                                {
                                    name: '채널',
                                    value:
                                        `${newState.channel}`,
                                    inline: true
                                }
                            )
                            .setTimestamp();
                }
                else if (
                    oldState.channelId &&
                    !newState.channelId
                ) {
                    embed =
                        new EmbedBuilder()
                            .setTitle('🔇 음성채널 퇴장')
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
                                        `${member.user}`,
                                    inline: true
                                },
                                {
                                    name: '채널',
                                    value:
                                        `${oldState.channel}`,
                                    inline: true
                                }
                            )
                            .setTimestamp();
                }
                else if (
                    oldState.channelId &&
                    newState.channelId
                ) {
                    embed =
                        new EmbedBuilder()
                            .setTitle('🔄 음성채널 이동')
                            .setColor(0x5865F2)
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
                                        `${member.user}`,
                                    inline: false
                                },
                                {
                                    name: '이전 채널',
                                    value:
                                        `${oldState.channel}`,
                                    inline: true
                                },
                                {
                                    name: '이동한 채널',
                                    value:
                                        `${newState.channel}`,
                                    inline: true
                                }
                            )
                            .setTimestamp();
                }
                if (!embed) {
                    return;
                }
                await logChannel.send({
                    embeds: [embed]
                });
            } catch (error) {
                console.error(
                    '음성채널 로그 처리 실패:',
                    error
                );
            }
        }
    );
    console.log(
        '음성채널 로그 시스템 시작 완료'
    );
}
module.exports = {
    startVoiceLogSystem
};
