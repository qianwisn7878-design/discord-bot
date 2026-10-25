const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');
const USER_INFO_FILE = path.join(DATA_DIR, 'userInfo.json');
const INFO_TYPES = {
    이름: 'name',
    닉네임: 'nickname',
    나이: 'age',
    성별: 'gender',
    연락처: 'phone',
    '발로란트 티어': 'valorantTier',
    '팀 티어': 'teamTier',
    포지션: 'position',
    활동시간: 'activityTime'
};
function loadJson() {
    try {
        if (!fs.existsSync(USER_INFO_FILE)) {
            return {
                users: {}
            };
        }
        const raw =
            fs.readFileSync(
                USER_INFO_FILE,
                'utf8'
            );
        if (!raw.trim()) {
            return {
                users: {}
            };
        }
        const data =
            JSON.parse(raw);
        if (!data.users) {
            data.users = {};
        }
        return data;
    } catch (error) {
        console.error(
            'userInfo.json 읽기 실패:',
            error
        );
        return {
            users: {}
        };
    }
}
function saveJson(data) {
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
            'userInfo.json 저장 실패:',
            error
        );
        return false;
    }
}
module.exports = {
    data: new SlashCommandBuilder()
        .setName('정보추가')
        .setDescription('유저의 정보를 추가하거나 수정합니다.')
        .addUserOption(option =>
            option
                .setName('유저')
                .setDescription('정보를 추가할 유저')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('항목')
                .setDescription('추가할 정보의 종류')
                .setRequired(true)
                .addChoices(
                    {
                        name: '이름',
                        value: '이름'
                    },
                    {
                        name: '닉네임',
                        value: '닉네임'
                    },
                    {
                        name: '나이',
                        value: '나이'
                    },
                    {
                        name: '성별',
                        value: '성별'
                    },
                    {
                        name: '연락처',
                        value: '연락처'
                    },
                    {
                        name: '발로란트 티어',
                        value: '발로란트 티어'
                    },
                    {
                        name: '팀 티어',
                        value: '팀 티어'
                    },
                    {
                        name: '포지션',
                        value: '포지션'
                    },
                    {
                        name: '활동시간',
                        value: '활동시간'
                    }
                )
        )
        .addStringOption(option =>
            option
                .setName('정보')
                .setDescription('저장할 정보를 입력하세요.')
                .setRequired(true)
        ),
    async execute(interaction) {
        try {
            const targetUser =
                interaction.options.getUser('유저');
            const type =
                interaction.options.getString('항목');
            const value =
                interaction.options.getString('정보');
            if (!targetUser) {
                return interaction.reply({
                    content:
                        '유저를 선택해주세요.',
                    ephemeral: true
                });
            }
            if (!type) {
                return interaction.reply({
                    content:
                        '정보 항목을 선택해주세요.',
                    ephemeral: true
                });
            }
            if (!value || !value.trim()) {
                return interaction.reply({
                    content:
                        '저장할 정보를 입력해주세요.',
                    ephemeral: true
                });
            }
            const data =
                loadJson();
            if (
                !data.users[targetUser.id] ||
                typeof data.users[targetUser.id] !== 'object'
            ) {
                data.users[targetUser.id] = {};
            }
            const key =
                INFO_TYPES[type];
            if (!key) {
                return interaction.reply({
                    content:
                        '잘못된 정보 항목입니다.',
                    ephemeral: true
                });
            }
            data.users[targetUser.id][key] =
                value.trim();
            data.users[targetUser.id][type] =
                value.trim();
            const saved =
                saveJson(data);
            if (!saved) {
                return interaction.reply({
                    content:
                        '정보 저장 중 오류가 발생했습니다.',
                    ephemeral: true
                });
            }
            return interaction.reply({
                content:
                    `✅ **${targetUser.username}**의 **${type}** 정보를 추가했습니다.\n\n` +
                    `> ${value.trim()}`,
                ephemeral: true
            });
        } catch (error) {
            console.error(
                '/정보추가 실행 오류:',
                error
            );
            if (
                interaction.replied ||
                interaction.deferred
            ) {
                return interaction.followUp({
                    content:
                        '정보 추가 중 오류가 발생했습니다.',
                    ephemeral: true
                });
            }
            return interaction.reply({
                content:
                    '정보 추가 중 오류가 발생했습니다.',
                ephemeral: true
            });
        }
    }
};
