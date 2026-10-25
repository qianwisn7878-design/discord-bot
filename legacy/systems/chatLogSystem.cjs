const {
    EmbedBuilder,
    Events
} = require('discord.js');
const CHAT_LOG_CHANNEL_ID =
    '1552002065969057813';
function limitText(
    text,
    max = 1000
) {
    if (!text) {
        return '(내용 없음)';
    }
    if (text.length <= max) {
        return text;
    }
    return (
        text.substring(
            0,
            max - 3
        ) +
        '...'
    );
}
async function getLogChannel(client) {
    try {
        return await client.channels.fetch(
            CHAT_LOG_CHANNEL_ID
        );
    } catch (error) {
        console.error(
            '채팅 로그 채널 가져오기 실패:',
            error
        );
        return null;
    }
}
function startChatLogSystem(client) {
    client.on(
        Events.MessageCreate,
        async message => {
            if (message.author.bot) {
                return;
            }
            if (!message.guild) {
                return;
            }
            try {
                const channel =
                    await getLogChannel(
                        client
                    );
                if (!channel) {
                    return;
                }
                const embed =
                    new EmbedBuilder()
                        .setTitle('💬 메시지 작성')
                        .setColor(0x5865F2)
                        .setAuthor({
                            name:
                                message.author.tag,
                            iconURL:
                                message.author.displayAvatarURL({
                                    dynamic: true
                                })
                        })
                        .addFields(
                            {
                                name: '작성자',
                                value:
                                    `${message.author}`,
                                inline: true
                            },
                            {
                                name: '채널',
                                value:
                                    `${message.channel}`,
                                inline: true
                            },
                            {
                                name: '내용',
                                value:
                                    `\`\`\`\n${limitText(message.content)}\n\`\`\``,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({
                            text:
                                `메시지 ID: ${message.id}`
                        });
                await channel.send({
                    embeds: [embed]
                });
            } catch (error) {
                console.error(
                    '메시지 작성 로그 처리 실패:',
                    error
                );
            }
        }
    );
    client.on(
        Events.MessageUpdate,
        async (oldMessage, newMessage) => {
            if (
                newMessage.author &&
                newMessage.author.bot
            ) {
                return;
            }
            if (!newMessage.guild) {
                return;
            }
            if (
                oldMessage.content ===
                newMessage.content
            ) {
                return;
            }
            try {
                const channel =
                    await getLogChannel(
                        client
                    );
                if (!channel) {
                    return;
                }
                const author =
                    newMessage.author;
                const embed =
                    new EmbedBuilder()
                        .setTitle('✏️ 메시지 수정')
                        .setColor(0xFEE75C)
                        .setAuthor({
                            name:
                                author
                                    ? author.tag
                                    : '알 수 없음',
                            iconURL:
                                author
                                    ? author.displayAvatarURL({
                                        dynamic: true
                                    })
                                    : undefined
                        })
                        .addFields(
                            {
                                name: '작성자',
                                value:
                                    author
                                        ? `${author}`
                                        : '알 수 없음',
                                inline: true
                            },
                            {
                                name: '채널',
                                value:
                                    `${newMessage.channel}`,
                                inline: true
                            },
                            {
                                name: '수정 전',
                                value:
                                    `\`\`\`\n${limitText(oldMessage.content)}\n\`\`\``,
                                inline: false
                            },
                            {
                                name: '수정 후',
                                value:
                                    `\`\`\`\n${limitText(newMessage.content)}\n\`\`\``,
                                inline: false
                            },
                            {
                                name: '메시지',
                                value:
                                    `[메시지 바로가기](${newMessage.url})`,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({
                            text:
                                `메시지 ID: ${newMessage.id}`
                        });
                await channel.send({
                    embeds: [embed]
                });
            } catch (error) {
                console.error(
                    '메시지 수정 로그 처리 실패:',
                    error
                );
            }
        }
    );
    client.on(
        Events.MessageDelete,
        async message => {
            if (
                message.author &&
                message.author.bot
            ) {
                return;
            }
            if (!message.guild) {
                return;
            }
            try {
                const channel =
                    await getLogChannel(
                        client
                    );
                if (!channel) {
                    return;
                }
                const author =
                    message.author;
                const embed =
                    new EmbedBuilder()
                        .setTitle('🗑️ 메시지 삭제')
                        .setColor(0xED4245)
                        .setAuthor({
                            name:
                                author
                                    ? author.tag
                                    : '알 수 없음',
                            iconURL:
                                author
                                    ? author.displayAvatarURL({
                                        dynamic: true
                                    })
                                    : undefined
                        })
                        .addFields(
                            {
                                name: '작성자',
                                value:
                                    author
                                        ? `${author}`
                                        : '알 수 없음',
                                inline: true
                            },
                            {
                                name: '채널',
                                value:
                                    message.channel
                                        ? `${message.channel}`
                                        : '알 수 없음',
                                inline: true
                            },
                            {
                                name: '삭제된 내용',
                                value:
                                    `\`\`\`\n${limitText(message.content)}\n\`\`\``,
                                inline: false
                            }
                        )
                        .setTimestamp()
                        .setFooter({
                            text:
                                `메시지 ID: ${message.id}`
                        });
                await channel.send({
                    embeds: [embed]
                });
            } catch (error) {
                console.error(
                    '메시지 삭제 로그 처리 실패:',
                    error
                );
            }
        }
    );
    console.log(
        '채팅 로그 시스템 시작 완료'
    );
}
module.exports = {
    startChatLogSystem
};
