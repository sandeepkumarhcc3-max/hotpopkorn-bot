const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAF2LGQyeHHUoJHOnFAJ7D0U3NCeI1kG1Kg'; 
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

const bot = new Telegraf(BOT_TOKEN, {
    handlerTimeout: 900000 
});
const fileDb = new Map();
const userStates = new Map();

// 📂 Sent Files Tracker Map (Memory Object for Active Sessions)
const activeDeliveries = new Map();

// 🚀 ALIVE & PORT FIX
const PORT = process.env.PORT || 7860;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely and alive!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 🛠️ Permanent Keyboard Menu Helper for Database Group
const getAdminMenu = () => {
    return Markup.keyboard([
        ['🖼️ Inline Post', '🚀 Send Video'],
        ['🔗 Batch Links', '✏️ Forward Post'],
        ['❌ Cancel Operation', '🟢 Bot Status']
    ]).resize();
};

// Helper function: Backup group me log bhejkar use pin karne ke liye
async function saveToBackup(param, msgId, name, deliveryData = null) {
    try {
        let logText = `DATABASE_LOG:\nPARAM: ${param}\nMSG_ID: ${msgId}\nNAME: ${name}`;
        if (deliveryData) {
            logText = `DELIVERY_LOG:\nUSER_CHAT_ID: ${deliveryData.chatId}\nFILE_MSG_ID: ${deliveryData.fileMsgId}\nWARN_MSG_ID: ${deliveryData.warnMsgId}\nTIME: ${Date.now()}`;
        }
        const sentLog = await bot.telegram.sendMessage(BACKUP_GROUP_ID, logText);
        if (!deliveryData) {
            await bot.telegram.pinChatMessage(BACKUP_GROUP_ID, sentLog.message_id, { disable_notification: true });
        }
        return sentLog.message_id;
    } catch (err) {
        console.error("Backup Save Error:", err.message);
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
    const targetChatId = ctx.chat.id;
    
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
                await ctx.telegram.deleteMessage(targetChatId, webAppMsg.message_id);
            } catch (err) { console.log("Error during WebApp message auto-deletion:", err.message); }
        }, 120000);
    }
    else {
        const cleanParam = param.replace('getfile_', '');
        const fileData = fileDb.get(cleanParam);

        if (!fileData) return ctx.reply("❌ Link expired or invalid! Please get a new link from the channel.");

        try {
            await ctx.reply("🚀 Processing your secure link... Sending file...⌛⏳");
            const forwardedMsg = await ctx.telegram.forwardMessage(targetChatId, DATABASE_GROUP_ID, fileData.messageId);
            const warningMsg = await ctx.reply("⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted in **30 minutes** due to copyright policies. Please forward it to a chat or save the message.", { parse_mode: 'Markdown' });

            const logId = await saveToBackup(null, null, null, {
                chatId: targetChatId,
                fileMsgId: forwardedMsg.message_id,
                warnMsgId: warningMsg.message_id
            });

            setTimeout(async () => {
                try {
                    await ctx.telegram.deleteMessage(targetChatId, forwardedMsg.message_id);
                    await ctx.telegram.deleteMessage(targetChatId, warningMsg.message_id);
                    if (logId) await ctx.telegram.deleteMessage(BACKUP_GROUP_ID, logId).catch(() => null);
                } catch (err) { console.log("Error during active session deletion:", err.message); }
            }, 30 * 60 * 1000);
            
        } catch (err) {
            ctx.reply("❌ Error delivering file. Make sure the bot is an Admin in the database group.");
        }
    }
}

// 🔄 RECALL CLEANUP LOGIC
async function runActiveCleanup() {
    console.log("🔍 Scanning backup channel for expired files...");
    try {
        const chat = await bot.telegram.getChat(BACKUP_GROUP_ID);
    } catch (e) { console.error("Cleanup loop initial sync failed:", e.message); }
}

// 💥 DEDICATED COMMANDS HANDLERS & KEYBOARD INTERCEPTORS
const handleStatus = (ctx) => ctx.reply("🟢 **Bot is alive and running smoothly!**", { parse_mode: 'Markdown', ...getAdminMenu() });

const handleCancel = (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        if (userStates.has(userId)) {
            userStates.delete(userId);
            return ctx.reply("❌ **Process Cancelled!** Aapka current operation cancel kar diya gaya hai.", getAdminMenu());
        } else {
            return ctx.reply("ℹ️ **No active process found to cancel.**", getAdminMenu());
        }
    }
};

const handleInline = (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        userStates.set(userId, { step: 'AWAITING_FILE' });
        return ctx.reply("🖼️ **Set Image/File:** Please send or forward the file (Photo/Video/Document) now...", { parse_mode: 'Markdown', ...getAdminMenu() });
    }
};

const handleForward = (ctx) => {
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        if (!currentState || !currentState.lastTrackedLink) {
            return ctx.reply("❌ **No recent file found!** Pehle `🖼️ Inline Post` process poori karein.", getAdminMenu());
        }
        currentState.step = 'AWAITING_TITLE';
        userStates.set(userId, currentState);
        return ctx.reply("✏️ **Title your post name:** Please send the text/title for your channel post now...", { parse_mode: 'Markdown', ...getAdminMenu() });
    }
};

const handleVideo = (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        userStates.set(userId, { step: 'AWAITING_DIRECT_VIDEO' });
        return ctx.reply("🚀 **Send Video:** Please send or forward your video file now, and I will generate the link instantly!", { parse_mode: 'Markdown', ...getAdminMenu() });
    }
};

const handleLinkBatch = (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        userStates.set(userId, { step: 'AWAITING_BATCH_LINKS' });
        return ctx.reply("🔗 **Send Batch Links:** Please send all your links now (Separate multiple links with a new line or spaces)...", { parse_mode: 'Markdown', ...getAdminMenu() });
    }
};

// Bind commands
bot.command('status', handleStatus);
bot.command('cancel', handleCancel);
bot.command('inline', handleInline);
bot.command('forward', handleForward);
bot.command('video', handleVideo);
bot.command('link', handleLinkBatch);


// 1. DATABASE GROUP, MESSAGE & STATE LOOP LOGIC
bot.on(['message', 'channel_post'], async (ctx) => {
    const message = ctx.message || ctx.channelPost;
    if (!message) return;

    const text = message.text || message.caption || '';
    const userId = message.from ? message.from.id : null;
    const currentState = userId ? userStates.get(userId) : null;
    const chatId = ctx.chat.id;

    // Route Text Menu Buttons to respective handlers
    if (chatId === DATABASE_GROUP_ID) {
        if (text === '🟢 Bot Status') return handleStatus(ctx);
        if (text === '❌ Cancel Operation') return handleCancel(ctx);
        if (text === '🖼️ Inline Post') return handleInline(ctx);
        if (text === '✏️ Forward Post') return handleForward(ctx);
        if (text === '🚀 Send Video') return handleVideo(ctx);
        if (text === '🔗 Batch Links') return handleLinkBatch(ctx);
    }

    if (text.startsWith('/inline') || text.startsWith('/video') || text.startsWith('/forward') || text.startsWith('/cancel') || text.startsWith('/status') || text.startsWith('/link')) return;

    // --- Delivery Logs scan processing ---
    if (chatId === BACKUP_GROUP_ID && text.startsWith('DELIVERY_LOG:')) {
        try {
            const userChatIdMatch = text.match(/USER_CHAT_ID:\s*(-?\d+)/);
            const fileMsgIdMatch = text.match(/FILE_MSG_ID:\s*(\d+)/);
            const warnMsgIdMatch = text.match(/WARN_MSG_ID:\s*(\d+)/);
            const timeMatch = text.match(/TIME:\s*(\d+)/);

            if (userChatIdMatch && fileMsgIdMatch && warnMsgIdMatch && timeMatch) {
                const logTime = parseInt(timeMatch[1]);
                const timeDiff = Date.now() - logTime;

                if (timeDiff >= 1800000) {
                    await ctx.telegram.deleteMessage(userChatIdMatch[1], fileMsgIdMatch[1]).catch(() => null);
                    await ctx.telegram.deleteMessage(userChatIdMatch[1], warnMsgIdMatch[1]).catch(() => null);
                    await ctx.deleteMessage().catch(() => null);
                }
            }
        } catch (e) {}
    }

    // --- Memory Restore Logic ---
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
                        
                        if (msgText.includes('DELIVERY_LOG:')) {
                            const userChatIdMatch = msgText.match(/USER_CHAT_ID:\s*(-?\d+)/);
                            const fileMsgIdMatch = msgText.match(/FILE_MSG_ID:\s*(\d+)/);
                            const warnMsgIdMatch = msgText.match(/WARN_MSG_ID:\s*(\d+)/);
                            const timeMatch = msgText.match(/TIME:\s*(\d+)/);

                            if (userChatIdMatch && fileMsgIdMatch && warnMsgIdMatch && timeMatch) {
                                if (Date.now() - parseInt(timeMatch[1]) >= 1800000) {
                                    await ctx.telegram.deleteMessage(userChatIdMatch[1], fileMsgIdMatch[1]).catch(() => null);
                                    await ctx.telegram.deleteMessage(userChatIdMatch[1], warnMsgIdMatch[1]).catch(() => null);
                                    await ctx.telegram.deleteMessage(BACKUP_GROUP_ID, currentId).catch(() => null);
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
        
        // --- NEW BATCH LINK PROCESSING LOGIC ---
        if (currentState && currentState.step === 'AWAITING_BATCH_LINKS') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const foundLinks = text.match(urlRegex);

            if (!foundLinks || foundLinks.length === 0) {
                return ctx.reply("❌ No valid links found! Please send proper URLs.", getAdminMenu());
            }

            const processingMsg = await ctx.reply(`⏳ **Processing ${foundLinks.length} link(s)... Please wait.**`);
            let outputLinksList = [];

            for (let i = 0; i < foundLinks.length; i++) {
                const targetUrl = foundLinks[i];
                try {
                    // Create text post with dynamic inline button inside database group
                    const textPost = await ctx.telegram.sendMessage(chatId, `✨ **YOUR REQUESTED FILE IS READY!**\n\n🔒 *Your secure download link has been generated successfully. Click the button below to open the downloader and unlock your file.*`, {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([[Markup.button.url('🍿 Download/Watch online', targetUrl)]])
                    });

                    const msgIdStr = textPost.message_id.toString();
                    const encodedParam = Buffer.from(msgIdStr).toString('base64url');
                    const dummyName = `Text Link Post #${msgIdStr}`;

                    // Set in Memory DB
                    fileDb.set(encodedParam, { messageId: textPost.message_id, name: dummyName });

                    // Save to Backup
                    await saveToBackup(encodedParam, textPost.message_id, dummyName);

                    const finalBotLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
                    outputLinksList.push(`🔗 **Link ${i+1}:** \`${finalBotLink}\``);

                } catch (linkErr) {
                    outputLinksList.push(`❌ **Link ${i+1}:** Failed to process (${targetUrl.substring(0, 20)}...)`);
                }
            }

            if (userId) userStates.delete(userId);
            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id).catch(() => null);
            
            // Send final batch compilation to the Admin
            return ctx.reply(`📊 **Batch Processing Complete!**\n\n${outputLinksList.join('\n\n')}\n\n✨ _Copy the links above for your channel!_`, {
                parse_mode: 'Markdown',
                ...getAdminMenu()
            });
        }

        let currentFileObj = message.video || message.document || message.audio || message.animation || message.video_note || (message.photo ? message.photo[message.photo.length - 1] : null);
        
        if (currentState && currentState.step === 'AWAITING_DIRECT_VIDEO') {
            if (!currentFileObj) return ctx.reply("❌ No media detected. Please send a valid Video or Document file.");
            
            let fileName = currentFileObj.file_name || (message.video ? "Video File" : message.animation ? "Silent Video" : "Media File");
            const msgIdStr = message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: message.message_id, name: fileName });
            
            process.nextTick(async () => {
                await saveToBackup(encodedParam, message.message_id, fileName);
            });

            if (userId) userStates.delete(userId); 

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            return ctx.reply(`✅ **Video Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: message.message_id,
                parse_mode: 'Markdown',
                ...getAdminMenu()
            });
        }

        if (currentState && currentState.step === 'AWAITING_FILE') {
            if (!currentFileObj) return ctx.reply("❌ That's not a valid file. Please send any file/image/video.");

            let fileName = currentFileObj.file_name || "Requested File";
            let fileId = currentFileObj.file_id;
            let fileType = message.document ? "document" : message.video ? "video" : message.audio ? "audio" : message.animation ? "animation" : "photo";

            if (userId) {
                userStates.set(userId, { step: 'AWAITING_LINK', fileId, fileType, fileName, caption: message.caption || "" });
            }
            return ctx.reply("🔗 **Send Link:** Now, please send the URL/Link for the button...", { reply_to_message_id: message.message_id, parse_mode: 'Markdown' });
        }

        if (currentState && currentState.step === 'AWAITING_LINK') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const match = text.match(urlRegex);
            if (!match) return ctx.reply("❌ Invalid Link! Please send a proper URL.");

            const watchOnlineUrl = match[0];
            const fileData = currentState;

            try {
                let finalPost;
                const extraOptions = { caption: fileData.caption, parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.url('🍿 Download/Watch online', watchOnlineUrl)]]) };

                if (fileData.fileType === 'photo') finalPost = await ctx.telegram.sendPhoto(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'video') finalPost = await ctx.telegram.sendVideo(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'document') finalPost = await ctx.telegram.sendDocument(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'audio') finalPost = await ctx.telegram.sendAudio(chatId, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'animation') finalPost = await ctx.telegram.sendAnimation(chatId, fileData.fileId, extraOptions);

                const msgIdStr = finalPost.message_id.toString();
                const encodedParam = Buffer.from(msgIdStr).toString('base64url');

                fileDb.set(encodedParam, { messageId: finalPost.message_id, name: fileData.fileName });
                
                process.nextTick(async () => {
                    await saveToBackup(encodedParam, finalPost.message_id, fileData.fileName);
                });

                const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
                if (userId) userStates.set(userId, { step: 'COMPLETED', fileId: fileData.fileId, fileType: fileData.fileType, lastTrackedLink: botLink });

                return ctx.reply(`✅ **Inline Post Created & Tracked Successfully!**\n\n📂 **Name:** ${fileData.fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { reply_to_message_id: finalPost.message_id, parse_mode: 'Markdown', ...getAdminMenu() });
            } catch (err) {
                return ctx.reply("❌ Error compiling the inline post.", getAdminMenu());
            }
        }

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
                else if (fileData.fileType === 'animation') await ctx.telegram.sendAnimation(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);

                return ctx.reply("🚀 **Success!** Post aapke private channel par publish kar di gayi hai.", { reply_to_message_id: message.message_id, ...getAdminMenu() });
            } catch (err) { return ctx.reply("❌ Private channel par post bhejne me error aaya.", getAdminMenu()); }
        }

        if (currentFileObj && !currentState) {
            let fileName = currentFileObj.file_name || (message.video ? "Video File" : message.animation ? "Silent Video" : message.photo ? "Photo File" : "Media File");

            const msgIdStr = message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: message.message_id, name: fileName });
            
            process.nextTick(async () => {
                await saveToBackup(encodedParam, message.message_id, fileName);
            });

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            return ctx.reply(`✅ **File Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: message.message_id,
                parse_mode: 'Markdown',
                ...getAdminMenu()
            });
        }
    }

    if (text.startsWith('/start') && userId) {
        const param = text.split(' ')[1];
        if (!param) return ctx.reply("👋 Welcome! Please click a file link from our channel to download.");

        const verified = await enforceJoinOrPrompt(ctx, userId, param);
        if (!verified) return; 

        await deliverFile(ctx, param);
    }
});

// Bot launch trigger with cleanup check
bot.launch().then(() => {
    console.log("Hotpopkornbot is now online...");
    runActiveCleanup();
});
