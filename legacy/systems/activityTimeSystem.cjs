const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const CHANNEL_ID = '1510258999529046116';
const DATA_DIR = path.join(
    __dirname,
    '..',
    'data'
);
const USER_INFO_FILE = path.join(
    DATA_DIR,
    'userInfo.json'
);
const MESSAGE_FILE = path.join(
    DATA_DIR,
    'activityTimeMessage.json'
);
const pendingActivityData =
    new Map();
function loadJson(
    file,
    fallback = {}
) {
    try {
        if (!fs.existsSync(file)) {
            return fallback;
        }
        const raw =
            fs.readFileSync(
                file,
                'utf8'
            );
        if (!raw.trim()) {
            return fallback;
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error(
            `[활동시간대] ${path.basename(file)} 읽기 실패:`,
            error
        );
        return fallback;
    }
}
function saveJson(
    file,
    data
) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(
                DATA_DIR,
                {
                    recursive: true
                }
            );
        }
        fs.writeFileSync(
            file,
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
            `[활동시간대] ${path.basename(file)} 저장 실패:`,
            error
        );
        return false;
    }
}
function createActivityButton() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    'activity_time_write'
                )
                .setLabel(
                    '작성하기'
                )
                .setStyle(
                    ButtonStyle.Primary
                )
        );
}
function createStep2Button() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(
                    'activity_time_step2_open'
                )
                .setLabel(
                    '토요일 / 일요일 작성하기'
                )
                .setStyle(
                    ButtonStyle.Success
                )
        );
}
async function sendActivityTimeMessage(client) {
    try {
        const channel =
            await client.channels.fetch(
                CHANNEL_ID
            );
        if (!channel) {
            console.error(
                '[활동시간대] 채널을 찾을 수 없습니다.'
            );
            return;
        }
        const messageData =
            loadJson(
                MESSAGE_FILE,
                {}
            );
        if (
            messageData.messageId
        ) {
            const existingMessage =
                await channel.messages
                    .fetch(
                        messageData.messageId
                    )
                    .catch(
                        () => null
                    );
            if (existingMessage) {
                console.log(
                    `[활동시간대] 기존 메시지 사용: ${existingMessage.id}`
                );
                return;
            }
        }
        const embed =
            new EmbedBuilder()
                .setTitle(
                    '본인의 활동 시간대를 입력해주세요'
                )
                .setDescription(
                    '아래 **작성하기** 버튼을 눌러\n' +
                    '요일별 활동 가능한 시간대를 작성해주세요.\n\n' +
                    '예시: `18:00 ~ 23:00`\n' +
                    '불가능한 경우: `불가능`\n' +
                    '시간 제한이 없는 경우: `자유`'
                );
        const message =
            await channel.send({
                embeds: [
                    embed
                ],
                components: [
                    createActivityButton()
                ]
            });
        saveJson(
            MESSAGE_FILE,
            {
                channelId:
                    channel.id,
                messageId:
                    message.id
            }
        );
        console.log(
            `[활동시간대] 메시지 생성 완료: ${message.id}`
        );
    } catch (error) {
        console.error(
            '[활동시간대] 메시지 생성 실패:',
            error
        );
    }
}
async function handleActivityTimeButton(
    interaction
) {
    if (
        !interaction.isButton() ||
        interaction.customId !==
        'activity_time_write'
    ) {
        return false;
    }
    const modal =
        new ModalBuilder()
            .setCustomId(
                'activity_time_modal_step1'
            )
            .setTitle(
                '활동 시간대 작성 (1/2)'
            );
    const monday =
        new TextInputBuilder()
            .setCustomId(
                'monday'
            )
            .setLabel(
                '월요일'
            )
            .setPlaceholder(
                '예: 18:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    const tuesday =
        new TextInputBuilder()
            .setCustomId(
                'tuesday'
            )
            .setLabel(
                '화요일'
            )
            .setPlaceholder(
                '예: 18:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    const wednesday =
        new TextInputBuilder()
            .setCustomId(
                'wednesday'
            )
            .setLabel(
                '수요일'
            )
            .setPlaceholder(
                '예: 18:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    const thursday =
        new TextInputBuilder()
            .setCustomId(
                'thursday'
            )
            .setLabel(
                '목요일'
            )
            .setPlaceholder(
                '예: 18:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    const friday =
        new TextInputBuilder()
            .setCustomId(
                'friday'
            )
            .setLabel(
                '금요일'
            )
            .setPlaceholder(
                '예: 18:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                monday
            ),
        new ActionRowBuilder()
            .addComponents(
                tuesday
            ),
        new ActionRowBuilder()
            .addComponents(
                wednesday
            ),
        new ActionRowBuilder()
            .addComponents(
                thursday
            ),
        new ActionRowBuilder()
            .addComponents(
                friday
            )
    );
    await interaction.showModal(
        modal
    );
    return true;
}
async function handleActivityTimeModalStep1(
    interaction
) {
    if (
        !interaction.isModalSubmit() ||
        interaction.customId !==
        'activity_time_modal_step1'
    ) {
        return false;
    }
    try {
        const monday =
            interaction.fields
                .getTextInputValue(
                    'monday'
                ) || '';
        const tuesday =
            interaction.fields
                .getTextInputValue(
                    'tuesday'
                ) || '';
        const wednesday =
            interaction.fields
                .getTextInputValue(
                    'wednesday'
                ) || '';
        const thursday =
            interaction.fields
                .getTextInputValue(
                    'thursday'
                ) || '';
        const friday =
            interaction.fields
                .getTextInputValue(
                    'friday'
                ) || '';
        pendingActivityData.set(
            interaction.user.id,
            {
                monday,
                tuesday,
                wednesday,
                thursday,
                friday,
                createdAt:
                    Date.now()
            }
        );
        await interaction.reply({
            content:
                '✅ 월요일 ~ 금요일 활동 시간대가 입력되었습니다.\n\n' +
                '이제 아래 버튼을 눌러 **토요일 / 일요일**을 입력해주세요.',
            components: [
                createStep2Button()
            ],
            ephemeral: true
        });
        console.log(
            `[활동시간대] ${interaction.user.tag} 월~금 임시 저장`
        );
    } catch (error) {
        console.error(
            '[활동시간대] 1차 모달 처리 실패:',
            error
        );
        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '활동 시간대 입력 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
    return true;
}
async function handleActivityTimeStep2Button(
    interaction
) {
    if (
        !interaction.isButton() ||
        interaction.customId !==
        'activity_time_step2_open'
    ) {
        return false;
    }
    const pendingData =
        pendingActivityData.get(
            interaction.user.id
        );
    if (!pendingData) {
        await interaction.reply({
            content:
                '이전 활동 시간대 정보가 만료되었습니다.\n' +
                '처음부터 다시 작성해주세요.',
            ephemeral: true
        });
        return true;
    }
    const modal =
        new ModalBuilder()
            .setCustomId(
                'activity_time_modal_step2'
            )
            .setTitle(
                '활동 시간대 작성 (2/2)'
            );
    const saturday =
        new TextInputBuilder()
            .setCustomId(
                'saturday'
            )
            .setLabel(
                '토요일'
            )
            .setPlaceholder(
                '예: 자유'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    const sunday =
        new TextInputBuilder()
            .setCustomId(
                'sunday'
            )
            .setLabel(
                '일요일'
            )
            .setPlaceholder(
                '예: 14:00 ~ 23:00'
            )
            .setStyle(
                TextInputStyle.Short
            )
            .setRequired(
                false
            );
    modal.addComponents(
        new ActionRowBuilder()
            .addComponents(
                saturday
            ),
        new ActionRowBuilder()
            .addComponents(
                sunday
            )
    );
    await interaction.showModal(
        modal
    );
    return true;
}
async function handleActivityTimeModalStep2(
    interaction
) {
    if (
        !interaction.isModalSubmit() ||
        interaction.customId !==
        'activity_time_modal_step2'
    ) {
        return false;
    }
    try {
        const pendingData =
            pendingActivityData.get(
                interaction.user.id
            );
        if (!pendingData) {
            await interaction.reply({
                content:
                    '이전 활동 시간대 정보가 만료되었습니다.\n' +
                    '다시 작성해주세요.',
                ephemeral: true
            });
            return true;
        }
        const saturday =
            interaction.fields
                .getTextInputValue(
                    'saturday'
                ) || '';
        const sunday =
            interaction.fields
                .getTextInputValue(
                    'sunday'
                ) || '';
        const data =
            loadJson(
                USER_INFO_FILE,
                {}
            );
        if (
            !data.users ||
            typeof data.users !==
            'object'
        ) {
            data.users = {};
        }
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
        ].activityTime = {
            monday:
                pendingData.monday,
            tuesday:
                pendingData.tuesday,
            wednesday:
                pendingData.wednesday,
            thursday:
                pendingData.thursday,
            friday:
                pendingData.friday,
            saturday,
            sunday,
            updatedAt:
                new Date()
                    .toISOString()
        };
        const saved =
            saveJson(
                USER_INFO_FILE,
                data
            );
        if (!saved) {
            throw new Error(
                'userInfo.json 저장 실패'
            );
        }
        pendingActivityData.delete(
            interaction.user.id
        );
        await interaction.reply({
            content:
                '✅ 활동 시간대가 저장되었습니다.\n\n' +
                `**월요일:** ${pendingData.monday || '미등록'}\n` +
                `**화요일:** ${pendingData.tuesday || '미등록'}\n` +
                `**수요일:** ${pendingData.wednesday || '미등록'}\n` +
                `**목요일:** ${pendingData.thursday || '미등록'}\n` +
                `**금요일:** ${pendingData.friday || '미등록'}\n` +
                `**토요일:** ${saturday || '미등록'}\n` +
                `**일요일:** ${sunday || '미등록'}`,
            ephemeral: true
        });
        console.log(
            `[활동시간대] ${interaction.user.tag} 활동 시간대 저장 완료`
        );
    } catch (error) {
        console.error(
            '[활동시간대] 2차 모달 처리 실패:',
            error
        );
        if (
            !interaction.replied &&
            !interaction.deferred
        ) {
            await interaction.reply({
                content:
                    '활동 시간대를 저장하는 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
    return true;
}
module.exports = {
    sendActivityTimeMessage,
    handleActivityTimeButton,
    handleActivityTimeModalStep1,
    handleActivityTimeStep2Button,
    handleActivityTimeModalStep2
};
