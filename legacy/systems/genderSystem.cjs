const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const GENDER_CHANNEL_ID =
    '1510258999529046116';
const FEMALE_ROLE_ID =
    '1546587477668798544';
const MALE_ROLE_ID =
    '1546587516180631593';
const GENDER_MESSAGE_FILE = path.join(
    __dirname,
    '..',
    'data',
    'genderMessage.json'
);
function hasGenderMessageBeenSent() {
    try {
        if (
            !fs.existsSync(
                GENDER_MESSAGE_FILE
            )
        ) {
            return false;
        }
        const raw =
            fs.readFileSync(
                GENDER_MESSAGE_FILE,
                'utf8'
            );
        if (!raw.trim()) {
            return false;
        }
        const data =
            JSON.parse(
                raw
            );
        return data.sent === true;
    } catch (error) {
        console.error(
            'genderMessage.json 읽기 실패:',
            error
        );
        return false;
    }
}
function saveGenderMessageSent(
    messageId
) {
    try {
        const dataDir =
            path.dirname(
                GENDER_MESSAGE_FILE
            );
        if (
            !fs.existsSync(
                dataDir
            )
        ) {
            fs.mkdirSync(
                dataDir,
                {
                    recursive: true
                }
            );
        }
        fs.writeFileSync(
            GENDER_MESSAGE_FILE,
            JSON.stringify(
                {
                    sent:
                        true,
                    messageId:
                        messageId
                },
                null,
                4
            ),
            'utf8'
        );
    } catch (error) {
        console.error(
            'genderMessage.json 저장 실패:',
            error
        );
    }
}
async function sendGenderMessage(
    client
) {
    if (
        hasGenderMessageBeenSent()
    ) {
        return;
    }
    const channel =
        await client.channels
            .fetch(
                GENDER_CHANNEL_ID
            )
            .catch(
                () => null
            );
    if (!channel) {
        throw new Error(
            '성별 선택 채널을 찾을 수 없습니다.'
        );
    }
    const maleButton =
        new ButtonBuilder()
            .setCustomId(
                'gender_select_male'
            )
            .setLabel(
                '남자'
            )
            .setStyle(
                ButtonStyle.Primary
            );
    const femaleButton =
        new ButtonBuilder()
            .setCustomId(
                'gender_select_female'
            )
            .setLabel(
                '여자'
            )
            .setStyle(
                ButtonStyle.Danger
            );
    const row =
        new ActionRowBuilder()
            .addComponents(
                maleButton,
                femaleButton
            );
    const message =
        await channel.send({
            content:
                '# 성별 선택\n\n' +
                '본인의 성별을 선택해주세요.\n' +
                '다른거 선택하면 빠따로 줘 팸요.',
            components: [
                row
            ]
        });
    saveGenderMessageSent(
        message.id
    );
}
async function handleGenderButton(
    interaction
) {
    const member =
        await interaction.guild.members
            .fetch(
                interaction.user.id
            )
            .catch(
                () => null
            );
    if (!member) {
        return interaction.reply({
            content:
                '유저 정보를 불러올 수 없습니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
    const hasMaleRole =
        member.roles.cache.has(
            MALE_ROLE_ID
        );
    const hasFemaleRole =
        member.roles.cache.has(
            FEMALE_ROLE_ID
        );
    if (
        hasMaleRole ||
        hasFemaleRole
    ) {
        return interaction.reply({
            content:
                '이미 성별을 선택했습니다. 다시 선택할 수 없습니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
    let selectedRoleId;
    let selectedGender;
    if (
        interaction.customId ===
        'gender_select_male'
    ) {
        selectedRoleId =
            MALE_ROLE_ID;
        selectedGender =
            '남자';
    } else if (
        interaction.customId ===
        'gender_select_female'
    ) {
        selectedRoleId =
            FEMALE_ROLE_ID;
        selectedGender =
            '여자';
    } else {
        return;
    }
    try {
        await member.roles.add(
            selectedRoleId
        );
        await interaction.reply({
            content:
                `성별이 **${selectedGender}**로 선택되었습니다.`,
            flags:
                MessageFlags.Ephemeral
        });
    } catch (error) {
        console.error(
            '성별 역할 지급 실패:',
            error
        );
        await interaction.reply({
            content:
                '성별 역할 지급 중 오류가 발생했습니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
}
module.exports = {
    sendGenderMessage,
    handleGenderButton,
    FEMALE_ROLE_ID,
    MALE_ROLE_ID
};
