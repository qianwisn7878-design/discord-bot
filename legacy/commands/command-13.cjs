const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const OWNER_ID =
    '794026986002448414';
const COACH_ROLE_ID =
    '1493189735789760662';
const MANAGER_ROLE_ID =
    '1515403509103722627';
const DATA_DIR = path.join(
    __dirname,
    '..',
    'data'
);
const USER_INFO_FILE = path.join(
    DATA_DIR,
    'userInfo.json'
);
const TIER_ROSTERS_FILE = path.join(
    DATA_DIR,
    'tierRosters.json'
);
const INFO_PERMISSION = {
    이름: 2,
    닉네임: 0,
    '발로란트 인게임 닉네임': 0,
    나이: 0,
    성별: 0,
    연락처: 2,
    '발로란트 티어': 0,
    '팀 티어': 0,
    포지션: 0,
    '활동 시간대': 0
};
const ROLE_INFO = {
    나이: {
        '1536798130803314802': '11년생',
        '1536798139296514088': '10년생',
        '1536798142018752602': '09년생',
        '1536798146804580412': '08년생',
        '1536798146863304724': '07년생',
        '1536798150487048212': '06년생',
        '1536798151061540914': '05년생',
        '1536798151879565362': '04년생',
        '1536798152185745438': '03년생',
        '1536798152923807915': '02년생',
        '1536798154077511740': '01년생',
        '1536798154681229312': '00년생'
    },
    성별: {
    },
    '발로란트 티어': {
        '1510270925176836228': '레디언트',
        '1510266490014793758': '불멸',
        '1510266489360355479': '초월',
        '1510266489075269632': '다이아몬드',
        '1510266488051732510': '플레티넘',
        '1510266487368319026': '골드',
        '1510266486692909218': '실버',
        '1510266484935364668': '브론즈',
        '1510266399623483393': '아이언'
    },
    포지션: {
        '1524750640486547566': 'IGL',
        '1524750878764961912': '연막',
        '1524750881869004800': '타격',
        '1524750885131911259': '척후',
        '1524750887929512027': '감시'
    }
};
function loadJson(file) {
    try {
        if (
            !fs.existsSync(file)
        ) {
            return {};
        }
        const raw =
            fs.readFileSync(
                file,
                'utf8'
            );
        if (!raw.trim()) {
            return {};
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error(
            `${path.basename(file)} 읽기 실패:`,
            error
        );
        return {};
    }
}
function getViewerLevel(
    interaction
) {
    if (
        interaction.user.id ===
        OWNER_ID
    ) {
        return 3;
    }
    if (
        interaction.member &&
        interaction.member.roles &&
        interaction.member.roles.cache.has(
            MANAGER_ROLE_ID
        )
    ) {
        return 2;
    }
    if (
        interaction.member &&
        interaction.member.roles &&
        interaction.member.roles.cache.has(
            COACH_ROLE_ID
        )
    ) {
        return 1;
    }
    return 0;
}
function canView(
    viewerLevel,
    requiredLevel
) {
    return (
        viewerLevel >=
        requiredLevel
    );
}
function getRoleBasedInfos(
    member,
    category
) {
    if(category==='나이')return [...new Set([...member.roles.cache.values()].filter(role=>/^(?:19|20)?(\\d{2})년생$/.test(role.name.replace(/\\s+/g,''))).map(role=>role.name))];
    const categoryRoles =
        ROLE_INFO[category];
    if (!categoryRoles) {
        return [];
    }
    const results = [];
    for (
        const [
            roleId,
            value
        ]
        of Object.entries(
            categoryRoles
        )
    ) {
        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            results.push(
                value
            );
        }
    }
    return results;
}
function getRoleBasedInfo(
    member,
    category
) {
    const results =
        getRoleBasedInfos(
            member,
            category
        );
    return (
        results.length > 0
            ? results[0]
            : null
    );
}
function getUserInfo(
    userId
) {
    const data =
        loadJson(
            USER_INFO_FILE
        );
    if (
        data.users &&
        typeof data.users ===
        'object' &&
        data.users[userId]
    ) {
        return data.users[userId];
    }
    if (
        data[userId] &&
        typeof data[userId] ===
        'object'
    ) {
        return data[userId];
    }
    return {};
}
function getValorantNicknames(
    userInfo
) {
    let nicknames =
        userInfo.valorantNicknames ||
        userInfo.valorantNickname ||
        userInfo.valorantNames ||
        userInfo.valorantName ||
        userInfo.발로란트닉네임 ||
        userInfo.발로란트인게임닉네임 ||
        userInfo.인게임닉네임 ||
        [];
    if (
        typeof nicknames ===
        'string'
    ) {
        nicknames = [
            nicknames
        ];
    }
    if (
        !Array.isArray(
            nicknames
        )
    ) {
        nicknames =
            [];
    }
    nicknames =
        nicknames
            .filter(
                nickname =>
                    typeof nickname ===
                    'string' &&
                    nickname.trim().length > 0
            )
            .map(
                nickname =>
                    nickname.trim()
            );
    if (
        nicknames.length === 0
    ) {
        return '미등록';
    }
    return nicknames.join(
        '\n'
    );
}
function getTeamTier(
    userId
) {
    const data =
        loadJson(
            TIER_ROSTERS_FILE
        );
    if (
        !data ||
        !data.roles ||
        typeof data.roles !==
        'object'
    ) {
        return null;
    }
    for (
        const tier
        of Object.values(
            data.roles
        )
    ) {
        if (
            !tier ||
            !Array.isArray(
                tier.members
            )
        ) {
            continue;
        }
        if (
            tier.members.includes(
                userId
            )
        ) {
            return (
                tier.roleName ||
                tier.tierName ||
                tier.name ||
                null
            );
        }
    }
    return null;
}
function formatActivityTime(
    activityTime
) {
    if (
        !activityTime ||
        typeof activityTime !==
        'object'
    ) {
        return '미등록';
    }
    const days = [
        [
            '월요일',
            activityTime.monday
        ],
        [
            '화요일',
            activityTime.tuesday
        ],
        [
            '수요일',
            activityTime.wednesday
        ],
        [
            '목요일',
            activityTime.thursday
        ],
        [
            '금요일',
            activityTime.friday
        ],
        [
            '토요일',
            activityTime.saturday
        ],
        [
            '일요일',
            activityTime.sunday
        ]
    ];
    const lines = [];
    for (
        const [
            day,
            value
        ]
        of days
    ) {
        lines.push(
            `**${day}:** ${value || '미등록'}`
        );
    }
    return lines.join(
        '\n'
    );
}
module.exports = {
    data:
        new SlashCommandBuilder()
            .setName(
                '정보보기'
            )
            .setDescription(
                '유저의 정보를 확인합니다.'
            )
            .addUserOption(
                option =>
                    option
                        .setName(
                            '유저'
                        )
                        .setDescription(
                            '정보를 확인할 유저'
                        )
                        .setRequired(
                            true
                        )
            ),
    async execute(
        interaction
    ) {
        try {
            const targetUser =
                interaction.options.getUser(
                    '유저'
                );
            if (!targetUser) {
                return interaction.reply({
                    content:
                        '유저를 선택해주세요.',
                    ephemeral: true
                });
            }
            const targetMember =
                await interaction.guild.members
                    .fetch(
                        targetUser.id
                    )
                    .catch(
                        () => null
                    );
            if (!targetMember) {
                return interaction.reply({
                    content:
                        '해당 서버의 유저 정보를 불러올 수 없습니다.',
                    ephemeral: true
                });
            }
            const viewerLevel =
                getViewerLevel(
                    interaction
                );
            const userInfo =
                getUserInfo(
                    targetUser.id
                );
            const nickname =
                targetMember.nickname ||
                targetUser.globalName ||
                targetUser.username;
            const embed =
                new EmbedBuilder()
                    .setTitle(
                        `${nickname} 정보`
                    )
                    .setThumbnail(
                        targetUser
                            .displayAvatarURL({
                                dynamic: true,
                                size: 256
                            })
                    )
                    .setTimestamp();
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.이름
                )
            ) {
                embed.addFields({
                    name:
                        '이름',
                    value:
                        userInfo.name ||
                        userInfo.이름 ||
                        '미등록',
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.닉네임
                )
            ) {
                embed.addFields({
                    name:
                        '닉네임',
                    value:
                        nickname,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION[
                        '발로란트 인게임 닉네임'
                    ]
                )
            ) {
                const valorantNicknames =
                    getValorantNicknames(
                        userInfo
                    );
                embed.addFields({
                    name:
                        '발로란트 인게임 닉네임',
                    value:
                        valorantNicknames,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.나이
                )
            ) {
                const age =
                    getRoleBasedInfo(
                        targetMember,
                        '나이'
                    ) ||
                    userInfo.age ||
                    userInfo.나이 ||
                    '미등록';
                embed.addFields({
                    name:
                        '나이',
                    value:
                        age,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.성별
                )
            ) {
                const gender =
                    getRoleBasedInfo(
                        targetMember,
                        '성별'
                    ) ||
                    userInfo.gender ||
                    userInfo.성별 ||
                    '미등록';
                embed.addFields({
                    name:
                        '성별',
                    value:
                        gender,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.연락처
                )
            ) {
                embed.addFields({
                    name:
                        '연락처',
                    value:
                        userInfo.phone ||
                        userInfo.연락처 ||
                        '미등록',
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION[
                        '발로란트 티어'
                    ]
                )
            ) {
                const valorantTier =
                    getRoleBasedInfo(
                        targetMember,
                        '발로란트 티어'
                    ) ||
                    userInfo.valorantTier ||
                    userInfo.발로란트티어 ||
                    '미등록';
                embed.addFields({
                    name:
                        '발로란트 티어',
                    value:
                        valorantTier,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION[
                        '팀 티어'
                    ]
                )
            ) {
                const teamTier =
                    getTeamTier(
                        targetUser.id
                    ) ||
                    userInfo.teamTier ||
                    userInfo.팀티어 ||
                    '미등록';
                embed.addFields({
                    name:
                        '팀 티어',
                    value:
                        teamTier,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION.포지션
                )
            ) {
                const positions =
                    getRoleBasedInfos(
                        targetMember,
                        '포지션'
                    );
                const position =
                    positions.length > 0
                        ? positions.join(', ')
                        : (
                            userInfo.position ||
                            userInfo.포지션 ||
                            '미등록'
                        );
                embed.addFields({
                    name:
                        '포지션',
                    value:
                        position,
                    inline:
                        true
                });
            }
            if (
                canView(
                    viewerLevel,
                    INFO_PERMISSION[
                        '활동 시간대'
                    ]
                )
            ) {
                const activityTime =
                    formatActivityTime(
                        userInfo.activityTime
                    );
                embed.addFields({
                    name:
                        '활동 시간대',
                    value:
                        activityTime,
                    inline:
                        false
                });
            }
            if (
                !embed.data.fields ||
                embed.data.fields.length === 0
            ) {
                embed.setDescription(
                    '볼 수 있는 정보가 없습니다.'
                );
            }
            await interaction.reply({
                embeds: [
                    embed
                ],
                ephemeral:
                    true
            });
        } catch (error) {
            console.error(
                '/정보보기 실행 오류:',
                error
            );
            if (
                interaction.replied ||
                interaction.deferred
            ) {
                await interaction.followUp({
                    content:
                        '정보를 불러오는 중 오류가 발생했습니다.',
                    ephemeral:
                        true
                });
            } else {
                await interaction.reply({
                    content:
                        '정보를 불러오는 중 오류가 발생했습니다.',
                    ephemeral:
                        true
                });
            }
        }
    }
};
