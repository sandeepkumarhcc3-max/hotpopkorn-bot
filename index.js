const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Private channel ID
const PRIVATE_CHANNEL_ID = -1003900661218; 

// 📁 Backup group ID
const BACKUP_GROUP_ID = -1004314246888; 

// 👑 ADMIN BYPASS SYSTEM
const ADMIN_IDS = [5328189325];

// 📢 Force Join Channels & Links Configuration
const MAIN_CH_ID = "-1003933920647";
const MAIN_CH_LINK = "https://t.me/popkornmovie_1";
const BACKUP_CH_ID = "-1003900661218";
const BACKUP_CH_LINK = "https://t.me/+1A7MUa-fD71jNDk1";

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();
const userStates = new Map();

// 🚀 ALIVE & PORT FIX
const PORT = process.env.PORT || 7860;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely and alive!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// Helper function: Backup group me log bhejkar use pin karne ke liye
async function saveToBackup(param, msgId, name) {
    try {
        const logText = `DATABASE_LOG:\nPARAM: ${param}\nMSG_ID: ${msgId}\nNAME: ${name}`;
        const sentLog = await bot.telegram.sendMessage(BACKUP_GROUP_ID, logText);
        await bot.telegram.pinChatMessage(BACKUP_GROUP_ID, sentLog.message_id, { disable_notification: true });
    } catch (err) {
        console.error("Backup Save/Pin Error:", err.message);
    }
}

// 🔒 Force-Join check
async function checkForceJoin(ctx, userId) {
    if (ADMIN_IDS.includes(userId)) {
        return { isSubscribedToBackup: true, isSubscribedToMain: true };
    }

    let isSubscribedToBackup = false;
    let isSubscribedToMain = false;
    const allowedStatuses = ['member', 'administrator', 'creator'];

    try {
        const member = await ctx.telegram.getChatMember(BACKUP_CH_ID, userId);
        if (member && allowedStatuses.includes(member.status)) isSubscribedToBackup = true;
    } catch (err) {
        console.error("Error checking backup channel status:", err.message);
    }

    try {
        const member = await ctx.telegram.getChatMember(MAIN_CH_ID, userId);
        if (member && allowedStatuses.includes(member.status)) isSubscribedToMain = true;
    } catch (err) {
        console.error("Error checking main channel status:", err.message);
    }

    return { isSubscribedToBackup, isSubscribedToMain };
}

// 🔒 Enforce Join
async function enforceJoinOrPrompt(ctx, userId, param) {
    const { isSubscribedToBackup, isSubscribedToMain } = await checkForceJoin(ctx, userId);

    if (!isSubscribedToBackup) {
        await ctx.reply(
            "🔒 Access denied. Join our Backup Channel to unlock your file. You haven't joined it yet.",
            Markup.inlineKeyboard([
                [Markup.button.url('📢 Join Backup Channel', BACKUP_CH_LINK)],
                [Markup.button.callback('✅ I\'ve Joined', `check_join_${param}`)]
            ])
        );
        return false;
    }

    if (!isSubscribedToMain) {
        await ctx.reply(
            "🔒 Access denied. Join our Main Channel first, then your file will unlock.",
            Markup.inlineKeyboard([
                [Markup.button.url('📢 Join Main Channel', MAIN_CH_LINK)],
                [Markup.button.callback('✅ I\'ve Joined', `check_join_${param}`)]
            ])
        );
        return false;
    }

    return true;
}

// 🔁 Recheck button handler
bot.action(/check_join_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    const param = ctx.match[1];

    const verified = await enforceJoinOrPrompt(ctx, userId, param);
    if (!verified) {
        await ctx.answerCbQuery("You still need to join a channel.");
        return;
    }

    await ctx.answerCbQuery("Verified! Unlocking your file...");
    try {
        await ctx.deleteMessage();
    } catch (e) {}

    await deliverFile(ctx, param);
});

// 📦 File delivery logic
async function deliverFile(ctx, param) {
    if (!param.startsWith('getfile_')) {
        const webAppFinalUrl = `${WEBAPP_URL}?fid=${param}`;

        const webAppMsg = await ctx.reply(
            `✨ **YOUR REQUESTED FILE IS READY!**\n\n🔒 *Your secure download link has been generated successfully. Click the button below to open the downloader and unlock your file.*\n\n👇  👇  👇`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.webApp('📥 Download Now', webAppFinalUrl)]
                ])
            }
        );

        setTimeout(async () => {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, webAppMsg.message_id);
                console.log("WebApp URL message deleted automatically after 2 minutes.");
            } catch (err) { console.log("Error during WebApp message auto-deletion:", err.message); }
        }, 120000);
    }
    else {
        const cleanParam = param.replace('getfile_', '');
        const fileData = fileDb.get(cleanParam);

        if (!fileData) return ctx.reply("❌ Link expired or invalid! Please get a new link from the channel.");

        try {
            await ctx.reply("🚀 Processing your secure link... Sending file...");
            const forwardedMsg = await ctx.telegram.forwardMessage(ctx.chat.id, DATABASE_GROUP_ID, fileData.messageId);
            const warningMsg = await ctx.reply("⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted in **30 minutes** due to copyright policies. Please forward it to a chat or save the message.", { parse_mode: 'Markdown' });

            setTimeout(async () => {
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, forwardedMsg.message_id);
                    await ctx.telegram.deleteMessage(ctx.chat.id, warningMsg.message_id);
                } catch (err) { console.log("Error during auto-deletion:", err.message); }
            }, 1800000);
        } catch (err) {
            ctx.reply("❌ Error delivering file. Make sure the bot is an Admin in the database group.");
        }
    }
}

// 💥 DEDICATED COMMANDS HANDLERS 
bot.command('status', (ctx) => {
    return ctx.reply("🟢 **Bot is alive and running smoothly!**", { parse_mode: 'Markdown' });
});

bot.command('inline', (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        userStates.set(userId, { step: 'AWAITING_FILE' });
        return ctx.reply("🖼️ **Set Image/File:** Please send or forward the file (Photo/Video/Document) now...", { parse_mode: 'Markdown' });
    }
});

bot.command('forward', (ctx) => {
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        if (!currentState || !currentState.lastTrackedLink) {
            return ctx.reply("❌ **No recent file found!** Pehle `/inline` process poori karein.", { parse_mode: 'Markdown' });
        }
        currentState.step = 'AWAITING_TITLE';
        userStates.set(userId, currentState);
        return ctx.reply("✏️ **Title your post name:** Please send the text/title for your channel post now...", { parse_mode: 'Markdown' });
    }
});

// 🎬 NEW: Dedicated /video command for direct tracking without conflict
bot.command('video', (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        userStates.set(userId, { step: 'AWAITING_DIRECT_VIDEO' });
        return ctx.reply("🚀 **Send Video:** Please send or forward your video file now, and I will generate the link instantly!", { parse_mode: 'Markdown' });
    }
});


// 1. DATABASE GROUP, MESSAGE & STATE LOOP LOGIC
bot.on(['message', 'channel_post'], async (ctx) => {
    const message = ctx.message || ctx.channelPost;
    if (!message) return;

    const text = message.text || message.caption || '';
    const userId = message.from ? message.from.id : null;
    const currentState = userId ? userStates.get(userId) : null;
    const chatId = ctx.chat.id;

    // --- Pinned Messages/Logs se Memory Restore karne ka Logic ---
    if (chatId === BACKUP_GROUP_ID && text.startsWith('/restore')) {
        try {
            const fullChat = await ctx.telegram.getChat(BACKUP_GROUP_ID);
            if (!fullChat.pinned_message) return ctx.reply("🏁 **Restore Cancelled!** Is group me koi bhi pinned message nahi mila.");

            const statusMsg = await ctx.reply("🔄 **Memory restoration started...** Scanning backup messages...");
            const latestPinId = fullChat.pinned_message.message_id;
            let restoredCount = 0;
            const scanRange = 10000; 
            const startId = latestPinId;
            const endId = Math.max(1, latestPinId - scanRange);

            for (let currentId = startId; currentId >= endId; currentId--) {
                try {
                    const msg = await ctx.telegram.forwardMessage(DATABASE_GROUP_ID, BACKUP_GROUP_ID, currentId).catch(() => null);
                    if (msg) {
                        await ctx.telegram.deleteMessage(DATABASE_GROUP_ID, msg.message_id).catch(() => null);
                        const msgText = msg.text || msg.caption || '';
                        if (msgText.includes('DATABASE_LOG:')) {
                            const paramMatch = msgText.match(/PARAM:\s*([^\s|]+)/);
                            const msgIdMatch = msgText.match(/MSG_ID:\s*(\d+)/);
                            const nameMatch = msgText.match(/NAME:\s*(.+)$/m);

                            if (paramMatch && msgIdMatch && nameMatch) {
                                const key = paramMatch[1].trim();
                                if (!fileDb.has(key)) {
                                    fileDb.set(key, { messageId: parseInt(msgIdMatch[1]), name: nameMatch[1].trim() });
                                    restoredCount++;
                                }
                            }
                        }
                    }
                } catch (e) { continue; }
            }
            try { await ctx.telegram.deleteMessage(chatId, statusMsg.message_id); } catch (e) {}
            return ctx.reply(`📊 **Restoration Complete!**\n\n✅ New Restored Links: **${restoredCount}**\n📚 Total Active Links: **${fileDb.size}**`);
        } catch (restoreErr) {
            return ctx.reply(`❌ **Restore Error:** \`${restoreErr.message}\``);
        }
    }

    // Main database group ka logic
    if (chatId === DATABASE_GROUP_ID) {

        // ⚡ NEW: Dedicated /video state logic (Directly catches the video file)
        if (currentState && currentState.step === 'AWAITING_DIRECT_VIDEO') {
            if (!message.video && !message.document) {
                return ctx.reply("❌ That is not a video file. Please send a proper Video or Document file.");
            }
            let fileName = "Video File";
            if (message.video) fileName = message.video.file_name || "Video File";
            else if (message.document) fileName = message.document.file_name;

            const msgIdStr = message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: message.message_id, name: fileName });
            await saveToBackup(encodedParam, message.message_id, fileName);

            if (userId) userStates.delete(userId); // Clear state

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            return ctx.reply(`✅ **Video Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: message.message_id,
                parse_mode: 'Markdown'
            });
        }

        // Step 2: File receive karna (/inline loop ke liye)
        if (currentState && currentState.step === 'AWAITING_FILE') {
            let hasFile = message.document || message.video || message.audio || message.photo;
            if (!hasFile) return ctx.reply("❌ That's not a file. Please send an image, video, or document.");

            let fileName = "Requested File", fileType = "", fileId = "";
            if (message.document) { fileName = message.document.file_name; fileId = message.document.file_id; fileType = "document"; }
            else if (message.video) { fileName = message.video.file_name || "Video File"; fileId = message.video.file_id; fileType = "video"; }
            else if (message.audio) { fileName = message.audio.file_name || "Audio File"; fileId = message.audio.file_id; fileType = "audio"; }
            else if (message.photo) { fileName = "Photo File"; fileId = message.photo[message.photo.length - 1].file_id; fileType = "photo"; }

            if (userId) {
                userStates.set(userId, { step: 'AWAITING_LINK', fileId, fileType, fileName, caption: message.caption || "" });
            }
            return ctx.reply("🔗 **Send Link:** Now, please send the URL/Link for the button...", { reply_to_message_id: message.message_id, parse_mode: 'Markdown' });
        }

        // Step 3: Link receive karna aur backup me log bhejna (/inline)
        if (currentState && currentState.step === 'AWAITING_LINK') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const match = text.match(urlRegex);
            if (!match) return ctx.reply("❌ Invalid Link! Please send a proper URL.");

            const watchOnlineUrl = match[0];
            const fileData = currentState;

            try {
                let finalPost;
                const extraOptions = { caption: fileData.caption, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('🍿 Watch Online', watchOnlineUrl)]]) };

                if (fileData.fileType === 'photo') finalPost = await ctx.telegram.sendPhoto(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'video') finalPost = await ctx.telegram.sendVideo(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'document') finalPost = await ctx.telegram.sendDocument(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'audio') finalPost = await ctx.telegram.sendAudio(chatId, fileData.fileId, extraOptions);

                const msgIdStr = finalPost.message_id.toString();
                const encodedParam = Buffer.from(msgIdStr).toString('base64url');

                fileDb.set(encodedParam, { messageId: finalPost.message_id, name: fileData.fileName });
                await saveToBackup(encodedParam, finalPost.message_id, fileData.fileName);

                const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
                if (userId) userStates.set(userId, { step: 'COMPLETED', fileId: fileData.fileId, fileType: fileData.fileType, lastTrackedLink: botLink });

                return ctx.reply(`✅ **Inline Post Created & Tracked Successfully!**\n\n📂 **Name:** ${fileData.fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { reply_to_message_id: finalPost.message_id, parse_mode: 'Markdown' });
            } catch (err) {
                return ctx.reply("❌ Error compiling the inline post.");
            }
        }

        // Step 4: /forward ke baad naya title lekar private channel me bhejna
        if (currentState && currentState.step === 'AWAITING_TITLE') {
            const newTitle = text;
            const fileData = currentState;
            if (userId) userStates.delete(userId);

            try {
                const channelOptions = { caption: `**${newTitle}**`, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('📥 Download Now', fileData.lastTrackedLink)]]) };

                if (fileData.fileType === 'photo') await ctx.telegram.sendPhoto(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'video') await ctx.telegram.sendVideo(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'document') await ctx.telegram.sendDocument(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'audio') await ctx.telegram.sendAudio(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);

                return ctx.reply("🚀 **Success!** Post aapke private channel par publish kar di gayi hai.", { reply_to_message_id: message.message_id });
            } catch (err) {
                return ctx.reply("❌ Private channel par post bhejne me error aaya.");
            }
        }

        // --- Normal response fallback (Direct upload) ---
        let isDirectFile = message.document || message.video || message.audio || message.photo;
        if (isDirectFile && !currentState) {
            let fileName = "Requested File";
            if (message.document) fileName = message.document.file_name;
            else if (message.video) fileName = message.video.file_name || "Video File";
            else if (message.audio) fileName = message.audio.file_name || "Audio File";
            else if (message.photo) fileName = "Photo File";

            const msgIdStr = message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: message.message_id, name: fileName });
            await saveToBackup(encodedParam, message.message_id, fileName);

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            return ctx.reply(`✅ **File Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: message.message_id,
                parse_mode: 'Markdown'
            });
        }
    }

    // 2. USER CHAT LOGIC (Downloader part)
    if (text.startsWith('/start') && userId) {
        const param = text.split(' ')[1];
        if (!param) return ctx.reply("👋 Welcome! Please click a file link from our channel to download.");

        const verified = await enforceJoinOrPrompt(ctx, userId, param);
        if (!verified) return; 

        await deliverFile(ctx, param);
    }
});

bot.launch().then(() => console.log("Hotpopkornbot is now online..."));
