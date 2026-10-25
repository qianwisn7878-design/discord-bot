const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const TIER_ROLES = {
    iron: {
        name: '아이언',
        1: '1546600805153644617',
        2: '1546600795322196040',
        3: '1510266399623483393'
    },
    bronze: {
        name: '브론즈',
        1: '1546600737075896481',
        2: '1546600721930129488',
        3: '1510266484935364668'
    },
    silver: {
        name: '실버',
        1: '1546600650748600370',
        2: '1546600665491705956',
        3: '1510266486692909218'
    },
    gold: {
        name: '골드',
        1: '1546600597921468507',
        2: '1546600586328150037',
        3: '1510266487368319026'
    },
    platinum: {
        name: '플래티넘',
        1: '1546600527729659994',
        2: '1546600537468698694',
        3: '1510266488051732510'
    },
    diamond: {
        name: '다이아몬드',
        1: '1546600443080347738',
        2: '1546600451867156632',
        3: '1510266489075269632'
    },
    ascendant: {
        name: '초월자',
        1: '1546600370338267279',
        2: '1546600397974667375',
        3: '1510266489360355479'
    },
    immortal: {
        name: '불멸',
        1: '1546600314533183568',
        2: '1546600296241831938',
        3: '1510266490014793758'
    },
    radiant: {
        name: '레디언트',
        1: '1510270925176836228'
    }
};
const TIER_MESSAGE_DATA_FILE = path.join(
    __dirname,
    '..',
    'data',
    'tierMessage.json'
);
function hasTierMessageBeenSent() {
    try {
        if (
            !fs.existsSync(
                TIER_MESSAGE_DATA_FILE
            )
        ) {
            return false;
        }
        const data =
            JSON.parse(
                fs.readFileSync(
                    TIER_MESSAGE_DATA_FILE,
                    'utf8'
                )
            );
        return data.sent === true;
    } catch (error) {
        console.error(
            'tierMessage.json 읽기 실패:',
            error
        );
        return false;
    }
}
function saveTierMessageSent(
    channelId,
    messageId
) {
    try {
        const dataDir =
            path.dirname(
                TIER_MESSAGE_DATA_FILE
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
            TIER_MESSAGE_DATA_FILE,
            JSON.stringify(
                {
                    sent: true,
                    channelId,
                    messageId
                },
                null,
                4
            ),
            'utf8'
        );
    } catch (error) {
        console.error(
            'tierMessage.json 저장 실패:',
            error
        );
    }
}
async function sendTierMessage(
    client
) {
    if (
        hasTierMessageBeenSent()
    ) {
        console.log(
            '티어 선택 메시지가 이미 전송되어 있습니다.'
        );
        return;
    }
    const TIER_CHANNEL_ID =
        '1510258999529046116';
    const channel =
        await client.channels.fetch(
            TIER_CHANNEL_ID
        );
    if (!channel) {
        throw new Error(
            '티어 선택 채널을 찾을 수 없습니다.'
        );
    }
    const embed =
        new EmbedBuilder()
            .setTitle(
                '발로란트 티어 선택'
            )
            .setDescription(
                '자신의 최티를 선택하이.\n\n' +
                '먼저 **티어 종류**를 선택한 뒤\n' +
                '**1 / 2 / 3 등급**을 선택하면 됩니다.\n\n' +
                '최티가 달라 졌다면 다시 선택하세요.\n\n\n' +
                '선택한 티어 역할은 기존 티어 역할을 제거하고 변경됩니다.'
            );
    const row1 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_iron'
                    )
                    .setLabel(
                        '아이언'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_bronze'
                    )
                    .setLabel(
                        '브론즈'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_silver'
                    )
                    .setLabel(
                        '실버'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_gold'
                    )
                    .setLabel(
                        '골드'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );
    const row2 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_platinum'
                    )
                    .setLabel(
                        '플래티넘'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_diamond'
                    )
                    .setLabel(
                        '다이아몬드'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_ascendant'
                    )
                    .setLabel(
                        '초월자'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_immortal'
                    )
                    .setLabel(
                        '불멸'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );
    const row3 =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'tier_select_radiant'
                    )
                    .setLabel(
                        '레디언트'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );
    const message =
        await channel.send({
            embeds: [
                embed
            ],
            components: [
                row1,
                row2,
                row3
            ]
        });
    saveTierMessageSent(
        channel.id,
        message.id
    );
    console.log(
        '티어 선택 메시지를 전송했습니다.'
    );
}
async function handleTierButton(
    interaction
) {
    const tierKey =
        interaction.customId.replace(
            'tier_select_',
            ''
        );
    const tierData =
        TIER_ROLES[
            tierKey
        ];
    if (!tierData) {
        return interaction.reply({
            content:
                '존재하지 않는 티어입니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
    if (
        tierKey ===
        'radiant'
    ) {
        await setTierRole(
            interaction,
            tierKey,
            1
        );
        return;
    }
    const row =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `tier_grade_${tierKey}_1`
                    )
                    .setLabel(
                        `${tierData.name} 1`
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        `tier_grade_${tierKey}_2`
                    )
                    .setLabel(
                        `${tierData.name} 2`
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    ),
                new ButtonBuilder()
                    .setCustomId(
                        `tier_grade_${tierKey}_3`
                    )
                    .setLabel(
                        `${tierData.name} 3`
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );
    const backRow =
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        'tier_back'
                    )
                    .setLabel(
                        '뒤로가기'
                    )
                    .setStyle(
                        ButtonStyle.Primary
                    )
            );
    await interaction.reply({
        content:
            `**${tierData.name}**의 세부 등급을 선택해주세요.`,
        components: [
            row,
            backRow
        ],
        flags:
            MessageFlags.Ephemeral
    });
}
async function handleTierGradeButton(
    interaction
) {
    const parts =
        interaction.customId.split(
            '_'
        );
    const tierKey =
        parts[2];
    const grade =
        Number(
            parts[3]
        );
    await setTierRole(
        interaction,
        tierKey,
        grade
    );
}
async function setTierRole(
    interaction,
    tierKey,
    grade
) {
    const tierData =
        TIER_ROLES[
            tierKey
        ];
    if (!tierData) {
        throw new Error(
            '티어 정보를 찾을 수 없습니다.'
        );
    }
    const roleId =
        tierData[
            grade
        ];
    if (!roleId) {
        return interaction.reply({
            content:
                '아직 이 티어의 역할 ID가 설정되지 않았습니다.',
            flags:
                MessageFlags.Ephemeral
        });
    }
    const member =
        await interaction.guild.members.fetch(
            interaction.user.id
        );
    const allTierRoleIds = [];
    for (
        const tier
        of Object.values(
            TIER_ROLES
        )
    ) {
        for (
            const id
            of Object.values(
                tier
            )
        ) {
            if (
                typeof id ===
                'string'
            ) {
                allTierRoleIds.push(
                    id
                );
            }
        }
    }
    const rolesToRemove =
        member.roles.cache.filter(
            role =>
                allTierRoleIds.includes(
                    role.id
                )
        );
    if (
        rolesToRemove.size > 0
    ) {
        await member.roles.remove(
            rolesToRemove
        );
    }
    await member.roles.add(
        roleId
    );
    const tierName =
        tierKey === 'radiant'
            ? '레디언트'
            : `${tierData.name} ${grade}`;
    await interaction.reply({
        content:
            `티어가 **${tierName}**으로 설정되었습니다.`,
        flags:
            MessageFlags.Ephemeral
    });
}
async function handleTierBackButton(
    interaction
) {
    await interaction.update({
        content:
            '다시 티어 종류를 선택해주세요.',
        components: []
    });
}
module.exports = {
    sendTierMessage,
    handleTierButton,
    handleTierGradeButton,
    handleTierBackButton
};
