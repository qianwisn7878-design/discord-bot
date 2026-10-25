const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const CHANNEL_ID =
    '1510258999529046116';
const BUTTON_ID =
    'phone_write';
const MODAL_ID =
    'phone_modal';
const USER_INFO_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'userInfo.json'
    );
function loadUserInfo() {
    try {
        if (
            !fs.existsSync(
                USER_INFO_FILE
            )
        ) {
            return {
                users: {}
            };
        }
        const raw =
            fs.readFileSync(
                USER_INFO_FILE,
                'utf8'
            );
        if (
            !raw.trim()
        ) {
            return {
                users: {}
            };
        }
        const data =
            JSON.parse(
                raw
            );
        if (
            !data.users
        ) {
            data.users = {};
        }
        return data;
    } catch (error) {
        console.error(
            '[전화번호] userInfo.json 읽기 실패:',
            error
        );
        return {
            users: {}
        };
    }
}
function saveUserInfo(data) {
    try {
        fs.writeFileSync(
            USER_INFO_FILE,
            JSON.stringify(
                data,
                null,
                4
            ),
            'utf8'
        );
        return true;
    } catch (error) {
        console.error(
            '[전화번호] userInfo.json 저장 실패:',
            error
        );
        return false;
    }
}
function formatPhoneNumber(value) {
    const numbers =
        String(value)
            .replace(
                /[^0-9]/g,
                ''
            );
    if (
        numbers.length === 10
    ) {
        return numbers.replace(
            /(\d{3})(\d{3})(\d{4})/,
            '$1-$2-$3'
        );
    }
    if (
        numbers.length === 11
    ) {
        return numbers.replace(
            /(\d{3})(\d{4})(\d{4})/,
            '$1-$2-$3'
        );
    }
    return null;
}
async function sendPhoneMessage(
    client
) {
    try {
        const channel =
            await client.channels.fetch(
                CHANNEL_ID
            );
        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.error(
                '[전화번호] 전화번호 입력 채널을 찾을 수 없습니다.'
            );
            return;
        }
        const messages =
            await channel.messages.fetch({
                limit: 100
            });
        const existingMessage =
            messages.find(
                message =>
                    message.author.id ===
                        client.user.id &&
                    message.embeds.length > 0 &&
                    message.embeds[0].title ===
                        '전화번호 등록'
            );
        const embed =
            new EmbedBuilder()
                .setTitle(
                    '전화번호 등록'
                )
                .setDescription(
                    '전화번호를 등록하려면 아래 버튼을 눌러주세요.\n\n' +
                    '본인의 전화번호를 입력해주세요.\n' +
                    '예시: `010-1234-5678`'
                );
        const button =
            new ButtonBuilder()
                .setCustomId(
                    BUTTON_ID
                )
                .setLabel(
                    '전화번호 입력'
                )
                .setStyle(
                    ButtonStyle.Primary
                );
        const row =
            new ActionRowBuilder()
                .addComponents(
                    button
                );
        if (
            existingMessage
        ) {
            await existingMessage.edit({
                embeds: [
                    embed
                ],
                components: [
                    row
                ]
            });
            console.log(
                '[전화번호] 기존 전화번호 입력 메시지를 확인했습니다.'
            );
            return;
        }
        await channel.send({
            embeds: [
                embed
            ],
            components: [
                row
            ]
        });
        console.log(
            '[전화번호] 전화번호 입력 메시지를 생성했습니다.'
        );
    } catch (error) {
        console.error(
            '[전화번호] 입력 메시지 생성 실패:',
            error
        );
    }
}
async function handlePhoneButton(
    interaction
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                MODAL_ID
            )
            .setTitle(
                '전화번호 입력'
            );
    const phoneInput =
        new TextInputBuilder()
            .setCustomId(
                'phone'
            )
            .setLabel(
                '전화번호'
            )
            .setPlaceholder(
                '010-1234-5678'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                true
            )
            .setMaxLength(
                20
            );
    const row =
        new ActionRowBuilder()
            .addComponents(
                phoneInput
            );
    modal.addComponents(
        row
    );
    await interaction.showModal(
        modal
    );
}
async function handlePhoneModal(
    interaction
) {
    const input =
        interaction.fields.getTextInputValue(
            'phone'
        );
    const phone =
        formatPhoneNumber(
            input
        );
    if (
        !phone
    ) {
        await interaction.reply({
            content:
                '❌ 올바른 전화번호를 입력해주세요.\n\n' +
                '예시: `010-1234-5678`',
            ephemeral:
                true
        });
        return;
    }
    const data =
        loadUserInfo();
    if (
        !data.users[
            interaction.user.id
        ]
    ) {
        data.users[
            interaction.user.id
        ] = {};
    }
    data.users[
        interaction.user.id
    ].phone =
        phone;
    data.users[
        interaction.user.id
    ].연락처 =
        phone;
    const saved =
        saveUserInfo(
            data
        );
    if (
        !saved
    ) {
        await interaction.reply({
            content:
                '❌ 전화번호 저장 중 오류가 발생했습니다.',
            ephemeral:
                true
        });
        return;
    }
    console.log('[전화번호] 비공개 정보 저장 완료');
    await interaction.reply({
        content:
            `✅ 전화번호가 등록되었습니다.\n\n` +
            `> ${phone}`,
        ephemeral:
            true
    });
}
async function startPhoneSystem(
    client
) {
    await sendPhoneMessage(
        client
    );
    console.log(
        '[전화번호] 전화번호 입력 시스템 실행 완료'
    );
}
module.exports = {
    startPhoneSystem,
    handlePhoneButton,
    handlePhoneModal
};
