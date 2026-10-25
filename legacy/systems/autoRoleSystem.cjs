const {
    Events
} = require('discord.js');
const AUTO_ROLE_IDS = [
    '1524752591592882207',
    '1524752431710474280',
    '1524752325611360276',
    '1524751634507501720',
    '1536798528066683032',
    '1552411367137349713',
    '1552414146732236830'
];
function startAutoRoleSystem(client) {
    client.on(
        Events.GuildMemberAdd,
        async member => {
            if (
                member.user.bot
            ) {
                return;
            }
            try {
                const botMember =
                    member.guild.members.me;
                if (
                    !botMember
                ) {
                    console.error(
                        '[자동 역할] 봇 멤버 정보를 찾을 수 없습니다.'
                    );
                    return;
                }
                for (
                    const roleId
                    of AUTO_ROLE_IDS
                ) {
                    const role =
                        member.guild.roles.cache.get(
                            roleId
                        );
                    if (
                        !role
                    ) {
                        console.error(
                            `[자동 역할] 역할을 찾을 수 없습니다: ${roleId}`
                        );
                        continue;
                    }
                    if (
                        role.position >=
                        botMember.roles.highest.position
                    ) {
                        console.error(
                            `[자동 역할] 지급할 수 없는 역할입니다. ` +
                            `봇의 최고 역할보다 높거나 같습니다: ${role.name}`
                        );
                        continue;
                    }
                    if (
                        member.roles.cache.has(
                            role.id
                        )
                    ) {
                        continue;
                    }
                    await member.roles.add(
                        role
                    );
                    console.log(
                        `[자동 역할] ${member.user.tag} → ${role.name}`
                    );
                }
            } catch (error) {
                console.error(
                    `[자동 역할] ${member.user.tag} 역할 지급 실패:`,
                    error
                );
            }
        }
    );
    console.log(
        '✅ 자동 역할 시스템 시작'
    );
}
module.exports = {
    startAutoRoleSystem
};
