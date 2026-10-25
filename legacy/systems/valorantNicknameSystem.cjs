const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const VALORANT_NICKNAME_CHANNEL_ID =
    '1510258999529046116';
const DATA_DIR = path.join(
    __dirname,
    '..',
    'data'
);
const USER_INFO_FILE = path.join(
    DATA_DIR,
    'userInfo.json'
);
const NICKNAME_MESSAGE_FILE = path.join(
    DATA_DIR,
    'valorantNicknameMessage.json'
);
function loadJson(
    file
) {
    try {
        if (
            !fs.existsSync(
                file
            )
        ) {
            return {};
        }
        const raw =
            fs.readFileSync(
                file,
                'utf8'
            );
        if (
            !raw.trim()
        ) {
            return {};
        }
        return JSON.parse(
            raw
        );
    } catch (error) {
        console.error(
            `${path.basename(file)} 읽기 실패:`,
            error
        );
        return {};
    }
}
function saveJson(
    file,
    data
) {
    const dir =
        path.dirname(
            file
        );
    if (
        !fs.existsSync(
            dir
        )
    ) {
        fs.mkdirSync(
            dir,
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
}
function hasNicknameMessageBeenSent() {
    const data =
        loadJson(
            NICKNAME_MESSAGE_FILE
        );
    return data.sent === true;
}
function saveNicknameMessageSent(
    messageId
) {
    saveJson(
        NICKNAME_MESSAGE_FILE,
        {
            sent:
                true,
            messageId:
                messageId
        }
    );
}
async function sendValorantNicknameMessage(
    client
) {
    if (
        hasNicknameMessageBeenSent()
    ) {
        return;
    }
    const channel =
        await client.channels
            .fetch(
                VALORANT_NICKNAME_CHANNEL_ID
            )
            .catch(
                () => null
            );
    if (!channel) {
        throw new Error(
            '발로란트 닉네임 채널을 찾을 수 없습니다.'
        );
    }
    const button =
        new ButtonBuilder()
            .setCustomId(
                'valorant_nickname_write'
            )
            .setLabel(
                '발로란트 닉네임 등록'
            )
            .setStyle(
                ButtonStyle.Primary
            );
    const row =
        new ActionRowBuilder()
            .addComponents(
                button
            );
    const message =
        await channel.send({
            content:
                '# 발로란트 인게임 닉네임 등록\n\n' +
                '사용 중인 발로란트 계정의 인게임 닉네임을 입력해주세요.\n\n' +
                '최대 5개의 계정을 등록할 수 있습니다.\n' +
                '빈칸은 저장되지 않습니다.\n\n' +
                '**다시 입력하면 기존 등록 정보가 새 정보로 수정됩니다.**',
            components: [
                row
            ]
        });
    saveNicknameMessageSent(
        message.id
    );
}
async function handleValorantNicknameButton(
    interaction
) {
    const modal =
        new ModalBuilder()
            .setCustomId(
                'valorant_nickname_modal'
            )
            .setTitle(
                '발로란트 닉네임 등록'
            );
    const inputs = [];
    for (
        let i = 1;
        i <= 5;
        i++
    ) {
        const input =
            new TextInputBuilder()
                .setCustomId(
                    `valorant_nickname_${i}`
                )
                .setLabel(
                    `발로란트 닉네임 ${i}`
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(
                    i === 1
                )
                .setPlaceholder(
                    i === 1
                        ? '예: 닉네임#KR1'
                        : '없으면 비워두세요'
                );
        const row =
            new ActionRowBuilder()
                .addComponents(
                    input
                );
        inputs.push(
            row
        );
    }
    modal.addComponents(
        ...inputs
    );
    await interaction.showModal(
        modal
    );
}
async function handleValorantNicknameModal(
    interaction
) {
    const nicknames = [];
    for (
        let i = 1;
        i <= 5;
        i++
    ) {
        const value =
            interaction.fields
                .getTextInputValue(
                    `valorant_nickname_${i}`
                )
                .trim();
        if (
            value
        ) {
            nicknames.push(
                value
            );
        }
    }
    const uniqueNicknames =
        [
            ...new Set(
                nicknames
            )
        ];
    const data =
        loadJson(
            USER_INFO_FILE
        );
    if (
        !data.users ||
        typeof data.users !==
        'object'
    ) {
        data.users =
            {};
    }
    if (
        !data.users[
            interaction.user.id
        ]
    ) {
        data.users[
            interaction.user.id
        ] =
            {};
    }
    data.users[
        interaction.user.id
    ].valorantNicknames =
        uniqueNicknames;
    saveJson(
        USER_INFO_FILE,
        data
    );
    if (
        uniqueNicknames.length === 0
    ) {
        return interaction.reply({
            content:
                '입력된 발로란트 닉네임이 없습니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
    await interaction.reply({
        content:
            '발로란트 닉네임을 저장했습니다.\n\n' +
            uniqueNicknames
                .map(
                    (
                        nickname,
                        index
                    ) =>
                        `${index + 1}. ${nickname}`
                )
                .join(
                    '\n'
                ),
        flags:
            MessageFlags.Ephemeral
    });
}
module.exports = {
    sendValorantNicknameMessage,
    handleValorantNicknameButton,
    handleValorantNicknameModal
};
