const fs = require('fs');
const path = require('path');
const {
    google
} = require('../google-client.cjs');
const GUILD_ID =
    '1492461447568162876';
const SPREADSHEET_ID =
    '1EHWnlwE0qt1izK7vtaXE1-H9lU34RZpevVUGAH15P7A';
const SHEET_NAME =
    '정보';
const USER_INFO_FILE =
    path.join(
        __dirname,
        '..',
        'data',
        'userInfo.json'
    );
const SERVICE_ACCOUNT_FILE =
    path.join(
        __dirname,
        '..',
        'google-service-account.json'
    );
const SYNC_INTERVAL =
    5 * 60 * 1000;
const AGE_ROLES = {
    '98':
        '1546291224648880259',
    '99':
        '1546291305964109884',
    '00':
        '1536798154681229312',
    '01':
        '1536798154077511740',
    '02':
        '1536798152923807915',
    '03':
        '1536798152185745438',
    '04':
        '1536798151879565362',
    '05':
        '1536798151061540914',
    '06':
        '1536798150487048212',
    '07':
        '1536798146863304724',
    '08':
        '1536798146804580412',
    '09':
        '1536798142018752602',
    '10':
        '1536798139296514088',
    '11':
        '1536798130803314802'
};
const FEMALE_ROLE_ID =
    '1546587477668798544';
const MALE_ROLE_ID =
    '1546587516180631593';
const TIER_ROLES = {
    iron: {
        name:
            '아이언',
        1:
            '1546600805153644617',
        2:
            '1546600795322196040',
        3:
            '1510266399623483393'
    },
    bronze: {
        name:
            '브론즈',
        1:
            '1546600737075896481',
        2:
            '1546600721930129488',
        3:
            '1510266484935364668'
    },
    silver: {
        name:
            '실버',
        1:
            '1546600650748600370',
        2:
            '1546600665491705956',
        3:
            '1510266486692909218'
    },
    gold: {
        name:
            '골드',
        1:
            '1546600597921468507',
        2:
            '1546600586328150037',
        3:
            '1510266487368319026'
    },
    platinum: {
        name:
            '플래티넘',
        1:
            '1546600527729659994',
        2:
            '1546600537468698694',
        3:
            '1510266488051732510'
    },
    diamond: {
        name:
            '다이아몬드',
        1:
            '1546600443080347738',
        2:
            '1546600451867156632',
        3:
            '1510266489075269632'
    },
    ascendant: {
        name:
            '초월자',
        1:
            '1546600370338267279',
        2:
            '1546600397974667375',
        3:
            '1510266489360355479'
    },
    immortal: {
        name:
            '불멸',
        1:
            '1546600314533183568',
        2:
            '1546600296241831938',
        3:
            '1510266490014793758'
    },
    radiant: {
        name:
            '레디언트',
        1:
            '1510270925176836228'
    }
};
const POSITION_ROLES = {
    IGL:
        '1524750640486547566',
    연막:
        '1524750878764961912',
    타격:
        '1524750881869004800',
    척후:
        '1524750885131911259',
    감시:
        '1524750887929512027'
};
const TEAM_TIER_ROLES = {
    '1티어':
        '1524746038592671844',
    '2티어':
        '1524746041000198266',
    '3티어':
        '1524746042913063053',
    '4티어':
        '1524746044691189891',
    '5티어':
        '1524746046712975480',
    '6티어':
        '1524746048340361227',
    '7티어':
        '1524746050173145210'
};
const auth =
    new google.auth.GoogleAuth({
        keyFile:
            SERVICE_ACCOUNT_FILE,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    });
const sheets =
    google.sheets({
        version:
            'v4',
        auth
    });
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
            '[시트 동기화] userInfo.json 읽기 실패:',
            error
        );
        return {
            users: {}
        };
    }
}
function getAgeFromRoles(
    member
) {
    for (
        const [
            age,
            roleId
        ]
        of Object.entries(
            AGE_ROLES
        )
    ) {
        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            return age;
        }
    }
    return '';
}
function getGenderFromRoles(
    member
) {
    if (
        member.roles.cache.has(
            MALE_ROLE_ID
        )
    ) {
        return '남자';
    }
    if (
        member.roles.cache.has(
            FEMALE_ROLE_ID
        )
    ) {
        return '여자';
    }
    return '';
}
function getValorantTierFromRoles(
    member
) {
    for (
        const [
            tierKey,
            tierData
        ]
        of Object.entries(
            TIER_ROLES
        )
    ) {
        for (
            const [
                grade,
                roleId
            ]
            of Object.entries(
                tierData
            )
        ) {
            if (
                grade === 'name'
            ) {
                continue;
            }
            if (
                member.roles.cache.has(
                    roleId
                )
            ) {
                if (
                    tierKey ===
                    'radiant'
                ) {
                    return '레디언트';
                }
                return `${tierData.name} ${grade}`;
            }
        }
    }
    return '';
}
function getPositionsFromRoles(
    member
) {
    const positions = [];
    for (
        const [
            positionName,
            roleId
        ]
        of Object.entries(
            POSITION_ROLES
        )
    ) {
        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            positions.push(
                positionName
            );
        }
    }
    return positions.join(
        ', '
    );
}
function getTeamTierFromRoles(
    member
) {
    for (
        const [
            tierName,
            roleId
        ]
        of Object.entries(
            TEAM_TIER_ROLES
        )
    ) {
        if (
            member.roles.cache.has(
                roleId
            )
        ) {
            return tierName;
        }
    }
    return '';
}
function getValorantNicknames(
    userData
) {
    if (
        !userData
    ) {
        return '';
    }
    if (
        Array.isArray(
            userData.valorantNicknames
        )
    ) {
        return userData
            .valorantNicknames
            .filter(
                nickname =>
                    nickname &&
                    String(
                        nickname
                    ).trim()
            )
            .join(
                ', '
            );
    }
    if (
        userData.nickname
    ) {
        return String(
            userData.nickname
        );
    }
    return '';
}
function getActivityTimeText(
    activityTime
) {
    if (
        !activityTime ||
        typeof activityTime !==
        'object'
    ) {
        return '';
    }
    const days = [
        [
            '월',
            'monday'
        ],
        [
            '화',
            'tuesday'
        ],
        [
            '수',
            'wednesday'
        ],
        [
            '목',
            'thursday'
        ],
        [
            '금',
            'friday'
        ],
        [
            '토',
            'saturday'
        ],
        [
            '일',
            'sunday'
        ]
    ];
    const result = [];
    for (
        const [
            koreanDay,
            key
        ]
        of days
    ) {
        const value =
            activityTime[key];
        if (
            value &&
            String(
                value
            ).trim()
        ) {
            result.push(
                `${koreanDay}: ${value}`
            );
        }
    }
    return result.join(
        ' / '
    );
}
async function getGuildMembers(
    client
) {
    const guild =
        await client.guilds.fetch(
            GUILD_ID
        );
    await guild.members.fetch();
    const members =
        guild.members.cache
            .filter(
                member =>
                    !member.user.bot
            )
            .sort(
                (
                    a,
                    b
                ) =>
                    a.joinedTimestamp -
                    b.joinedTimestamp
            );
    return members;
}
async function syncGoogleSheet(
    client
) {
    console.log(
        '[구글 시트] 동기화 시작'
    );
    const members =
        await getGuildMembers(
            client
        );
    const userInfo =
        loadUserInfo();
    const values = [
        [
            '사용자명',
            '나이',
            '이름',
            '전화번호',
            '성별',
            '발로란트 닉네임',
            '최티',
            '팀 티어',
            '포지션',
            '활동 시간대'
        ]
    ];
    for (
        const member
        of members.values()
    ) {
        const discordId =
            member.id;
        const username =
            member.user.username;
        const userData =
            userInfo.users[
                discordId
            ] ||
            {};
        const name =
            userData.name ||
            '';
        const phone =
            userData.phone ||
            '';
        const valorantNickname =
            getValorantNicknames(
                userData
            );
        const activityTime =
            getActivityTimeText(
                userData.activityTime
            );
        const age =
            getAgeFromRoles(
                member
            );
        const gender =
            getGenderFromRoles(
                member
            );
        const highestTier =
            getValorantTierFromRoles(
                member
            );
        const position =
            getPositionsFromRoles(
                member
            );
        const teamTier =
            getTeamTierFromRoles(
                member
            );
        values.push(
            [
                username,
                age,
                name,
                phone,
                gender,
                valorantNickname,
                highestTier,
                teamTier,
                position,
                activityTime
            ]
        );
    }
    await sheets
        .spreadsheets
        .values
        .clear({
            spreadsheetId:
                SPREADSHEET_ID,
            range:
                `${SHEET_NAME}!A:J`
        });
    await sheets
        .spreadsheets
        .values
        .update({
            spreadsheetId:
                SPREADSHEET_ID,
            range:
                `${SHEET_NAME}!A1`,
            valueInputOption:
                'USER_ENTERED',
            requestBody: {
                values:
                    values
            }
        });
    client.__legacyStatus.sheetSyncAt=new Date().toISOString();
    console.log(
        `[구글 시트] 동기화 완료 - ${members.size}명`
    );
    return true;
}
async function startGoogleSheetSync(
    client
) {
    try {
        await syncGoogleSheet(
            client
        );
    } catch (error) {
        console.error(
            '[구글 시트] 초기 동기화 실패:',
            error
        );
    }
    setInterval(
        async () => {
            try {
                await syncGoogleSheet(
                    client
                );
            } catch (error) {
                console.error(
                    '[구글 시트] 주기적 동기화 실패:',
                    error
                );
            }
        },
        SYNC_INTERVAL
    );
    console.log(
        '[구글 시트] 5분 주기 자동 동기화가 시작되었습니다.'
    );
}
module.exports = {
    startGoogleSheetSync,
    syncGoogleSheet
};
