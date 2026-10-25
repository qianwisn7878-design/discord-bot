const {
    Events
} = require('discord.js');
const TERMS_CHANNEL_ID =
    '1551594410754580481';
const TERMS_AGREED_ROLE_ID =
    '1552414580926455860';
const TERMS_NOT_AGREED_ROLE_ID =
    '1552411367137349713';
const PRIVACY_AGREED_ROLE_ID =
    '1552414582402711623';
const PRIVACY_NOT_AGREED_ROLE_ID =
    '1552414146732236830';
const ALL_TERMS_AGREED_ROLE_ID =
    '1552414388491911199';
let termsMessageId = null;
let privacyMessageId = null;
const CHECK_EMOJI = '✅';
function isCheckEmoji(reaction) {
    if (
        !reaction ||
        !reaction.emoji
    ) {
        return false;
    }
    return (
        reaction.emoji.name ===
        CHECK_EMOJI
    );
}
function getKoreanTime() {
    return new Intl.DateTimeFormat(
        'ko-KR',
        {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }
    ).format(
        new Date()
    );
}
async function createTermsMessages(client) {
    try {
        const channel =
            await client.channels.fetch(
                TERMS_CHANNEL_ID
            );
        if (
            !channel ||
            !channel.isTextBased()
        ) {
            console.error(
                '[약관] 약관 채널을 찾을 수 없습니다.'
            );
            return;
        }
        const messages =
            await channel.messages.fetch({
                limit: 50
            });
        const existingTerms =
            messages.find(
                message =>
                    message.author.id ===
                        client.user.id &&
                    message.content.includes(
                        '[ 필수 ] 이용약관 동의'
                    )
            );
        const existingPrivacy =
            messages.find(
                message =>
                    message.author.id ===
                        client.user.id &&
                    message.content.includes(
                        '[ 필수 ] 개인정보 수집 및 이용 동의'
                    )
            );
        if (existingTerms) {
            termsMessageId =
                existingTerms.id;
        } else {
            const message =
                await channel.send({
                    content:
                        '[ 필수 ] 이용약관 동의\n\n' +
                        '이용약관에 동의하신다면 해당 메세지에 체크 반응을 눌러주세요.'
                });
            await message.react(
                CHECK_EMOJI
            );
            termsMessageId =
                message.id;
        }
        if (existingPrivacy) {
            privacyMessageId =
                existingPrivacy.id;
        } else {
            const message =
                await channel.send({
                    content:
                        '[ 필수 ] 개인정보 수집 및 이용 동의\n\n' +
                        '개인정보 수집 및 이용에 동의하신다면 해당 메세지에 체크 반응을 눌러주세요.'
                });
            await message.react(
                CHECK_EMOJI
            );
            privacyMessageId =
                message.id;
        }
        console.log(
            '[약관] 약관 메시지 확인 완료'
        );
        console.log(
            `[약관] 이용약관 메시지 ID: ${termsMessageId}`
        );
        console.log(
            `[약관] 개인정보 메시지 ID: ${privacyMessageId}`
        );
    } catch (error) {
        console.error(
            '[약관] 메시지 생성 실패:',
            error
        );
    }
}
async function updateAllTermsRole(member) {
    try {
        const hasTerms =
            member.roles.cache.has(
                TERMS_AGREED_ROLE_ID
            );
        const hasPrivacy =
            member.roles.cache.has(
                PRIVACY_AGREED_ROLE_ID
            );
        const hasAll =
            member.roles.cache.has(
                ALL_TERMS_AGREED_ROLE_ID
            );
        if (
            hasTerms &&
            hasPrivacy
        ) {
            if (!hasAll) {
                await member.roles.add(
                    ALL_TERMS_AGREED_ROLE_ID
                );
                console.log(
                    `[약관] ${member.user.tag} → 모든 약관 동의 역할 지급 완료`
                );
            }
            return;
        }
        if (hasAll) {
            await member.roles.remove(
                ALL_TERMS_AGREED_ROLE_ID
            );
            console.log(
                `[약관] ${member.user.tag} → 모든 약관 동의 역할 제거 완료`
            );
        }
    } catch (error) {
        console.error(
            '[약관] 모든 약관 동의 역할 처리 실패:',
            error
        );
    }
}
async function agreeTerms(member) {
    try {
        console.log(
            `[약관] ${member.user.tag} → 이용약관 동의 처리`
        );
        await member.roles.remove(
            TERMS_NOT_AGREED_ROLE_ID
        ).catch(() => {});
        await member.roles.add(
            TERMS_AGREED_ROLE_ID
        );
        console.log(
            `[약관] ${member.user.tag} → 이용약관 동의 역할 지급 완료`
        );
        await updateAllTermsRole(
            member
        );
        try {
            await member.send({
                content:
                    '이용약관에 동의하셨습니다.\n\n' +
                    `동의 시간: ${getKoreanTime()}`
            });
            console.log(
                `[약관] ${member.user.tag} → 이용약관 동의 DM 전송 완료`
            );
        } catch (error) {
            console.error(
                `[약관] ${member.user.tag} 이용약관 동의 DM 전송 실패:`,
                error.message
            );
        }
    } catch (error) {
        console.error(
            `[약관] ${member.user.tag} 이용약관 동의 처리 실패:`,
            error
        );
    }
}
async function disagreeTerms(member) {
    try {
        console.log(
            `[약관] ${member.user.tag} → 이용약관 동의 취소`
        );
        await member.roles.remove(
            TERMS_AGREED_ROLE_ID
        ).catch(() => {});
        await member.roles.add(
            TERMS_NOT_AGREED_ROLE_ID
        );
        console.log(
            `[약관] ${member.user.tag} → 이용약관 미동의 역할 지급 완료`
        );
        await updateAllTermsRole(
            member
        );
    } catch (error) {
        console.error(
            `[약관] ${member.user.tag} 이용약관 동의 취소 실패:`,
            error
        );
    }
}
async function agreePrivacy(member) {
    try {
        console.log(
            `[약관] ${member.user.tag} → 개인정보 수집 및 이용 동의 처리`
        );
        await member.roles.remove(
            PRIVACY_NOT_AGREED_ROLE_ID
        ).catch(() => {});
        await member.roles.add(
            PRIVACY_AGREED_ROLE_ID
        );
        console.log(
            `[약관] ${member.user.tag} → 개인정보 동의 역할 지급 완료`
        );
        await updateAllTermsRole(
            member
        );
        try {
            await member.send({
                content:
                    '개인정보 수집 및 이용에 동의하셨습니다.\n\n' +
                    `동의 시간: ${getKoreanTime()}`
            });
            console.log(
                `[약관] ${member.user.tag} → 개인정보 동의 DM 전송 완료`
            );
        } catch (error) {
            console.error(
                `[약관] ${member.user.tag} 개인정보 동의 DM 전송 실패:`,
                error.message
            );
        }
    } catch (error) {
        console.error(
            `[약관] ${member.user.tag} 개인정보 동의 처리 실패:`,
            error
        );
    }
}
async function disagreePrivacy(member) {
    try {
        console.log(
            `[약관] ${member.user.tag} → 개인정보 동의 취소`
        );
        await member.roles.remove(
            PRIVACY_AGREED_ROLE_ID
        ).catch(() => {});
        await member.roles.add(
            PRIVACY_NOT_AGREED_ROLE_ID
        );
        console.log(
            `[약관] ${member.user.tag} → 개인정보 미동의 역할 지급 완료`
        );
        await updateAllTermsRole(
            member
        );
    } catch (error) {
        console.error(
            `[약관] ${member.user.tag} 개인정보 동의 취소 실패:`,
            error
        );
    }
}
async function handleReactionAdd(
    reaction,
    user
) {
    try {
        if (user.bot) {
            return;
        }
        if (reaction.partial) {
            await reaction.fetch();
        }
        if (reaction.message.partial) {
            await reaction.message.fetch();
        }
        if (
            reaction.message.channelId !==
            TERMS_CHANNEL_ID
        ) {
            return;
        }
        if (!isCheckEmoji(reaction)) {
            return;
        }
        const member =
            await reaction.message.guild.members
                .fetch(user.id)
                .catch(() => null);
        if (!member) {
            return;
        }
        if (
            reaction.message.id ===
            termsMessageId
        ) {
            await agreeTerms(
                member
            );
            return;
        }
        if (
            reaction.message.id ===
            privacyMessageId
        ) {
            await agreePrivacy(
                member
            );
            return;
        }
    } catch (error) {
        console.error(
            '[약관] 반응 추가 처리 실패:',
            error
        );
    }
}
async function handleReactionRemove(
    reaction,
    user
) {
    try {
        if (user.bot) {
            return;
        }
        if (reaction.partial) {
            await reaction.fetch();
        }
        if (reaction.message.partial) {
            await reaction.message.fetch();
        }
        if (
            reaction.message.channelId !==
            TERMS_CHANNEL_ID
        ) {
            return;
        }
        if (!isCheckEmoji(reaction)) {
            return;
        }
        const member =
            await reaction.message.guild.members
                .fetch(user.id)
                .catch(() => null);
        if (!member) {
            return;
        }
        if (
            reaction.message.id ===
            termsMessageId
        ) {
            await disagreeTerms(
                member
            );
            return;
        }
        if (
            reaction.message.id ===
            privacyMessageId
        ) {
            await disagreePrivacy(
                member
            );
            return;
        }
    } catch (error) {
        console.error(
            '[약관] 반응 제거 처리 실패:',
            error
        );
    }
}
async function startTermsSystem(client) {
    await createTermsMessages(
        client
    );
    client.on(
        Events.MessageReactionAdd,
        handleReactionAdd
    );
    client.on(
        Events.MessageReactionRemove,
        handleReactionRemove
    );
    console.log(
        '✅ 약관 동의 시스템 시작'
    );
}
module.exports = {
    startTermsSystem
};
