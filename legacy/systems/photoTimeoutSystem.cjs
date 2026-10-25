const {
    Events
} = require('discord.js');
const TIMEOUT_DURATION =
    3 * 24 * 60 * 60 * 1000; // 3일
const ANNOUNCEMENT_CHANNEL_ID =
    '1552485417205506199';
const DETECTION_WINDOW =
    30 * 1000;
const userPhotoMessages =
    new Map();
async function handlePhotoTimeout(message) {
    if (message.author.bot) {
        return;
    }
    if (!message.guild) {
        return;
    }
    const imageAttachments =
        message.attachments.filter(
            attachment =>
                attachment.contentType &&
                attachment.contentType.startsWith('image/')
        );
    if (imageAttachments.size !== 4) {
        return;
    }
    const userId =
        message.author.id;
    const now =
        Date.now();
    let records =
        userPhotoMessages.get(userId) || [];
    records =
        records.filter(
            record =>
                now - record.time <=
                DETECTION_WINDOW
        );
    records.push({
        time: now,
        message: message
    });
    userPhotoMessages.set(
        userId,
        records
    );
    if (records.length < 2) {
        return;
    }
    userPhotoMessages.delete(userId);
    const member =
        message.member ||
        await message.guild.members
            .fetch(userId)
            .catch(() => null);
    if (!member) {
        return;
    }
    console.log(
        `[사진 감지] ${message.author.tag} → 30초 이내 사진 4장 메시지 2회 감지`
    );
    for (const record of records) {
        try {
            if (!record.message.deleted) {
                await record.message.delete();
            }
        } catch (error) {
            console.error(
                '[사진 감지] 사진 메시지 삭제 실패:',
                error
            );
        }
    }
    try {
        await message.author.send(
            '당신은 미스터비스트입니까?'
        );
    } catch (error) {
        console.error(
            '[사진 감지] DM 전송 실패:',
            error
        );
    }
    try {
        const announcementChannel =
            await message.guild.channels
                .fetch(
                    ANNOUNCEMENT_CHANNEL_ID
                );
        if (
            announcementChannel &&
            announcementChannel.isTextBased()
        ) {
            await announcementChannel.send(
                `${member} 미스터비스트니깐 조심!`
            );
        }
    } catch (error) {
        console.error(
            '[사진 감지] 전체공지 전송 실패:',
            error
        );
    }
    try {
        await member.timeout(
            TIMEOUT_DURATION,
            '30초 이내 사진 4장 메시지 2회 이상 전송'
        );
        console.log(
            `[사진 타임아웃] ${message.author.tag} → 3일 타임아웃`
        );
    } catch (error) {
        console.error(
            '[사진 타임아웃] 타임아웃 처리 실패:',
            error
        );
    }
}
function startPhotoTimeoutSystem(client) {
    client.on(
        Events.MessageCreate,
        handlePhotoTimeout
    );
    console.log(
        '사진 4장 연속 전송 감지 시스템 실행 완료'
    );
}
module.exports = {
    startPhotoTimeoutSystem
};
