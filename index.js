const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 
const { google } = require('googleapis');

const BOT_TOKEN = '8869980874:AAF2LGQyeHHUoJHOnFAJ7D0U3NCeI1kG1Kg'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Private channel ID
const PRIVATE_CHANNEL_ID = -1003900661218; 

// 📁 Backup group ID (For delivery logs & notifications)
const BACKUP_GROUP_ID = -1004314246888; 

// 👑 ADMIN BYPASS SYSTEM
const ADMIN_IDS = [5328189325];

// 📢 Force Join Channels & Links Configuration
const MAIN_CH_ID = "-1003933920647";
const MAIN_CH_LINK = "https://t.me/popkornmovie_1";
const BACKUP_CH_ID = "-1003900661218";
const BACKUP_CH_LINK = "https://t.me/+1A7MUa-fD71jNDk1";

// 📊 GOOGLE SHEETS CONFIGURATION
const SPREADSHEET_ID = '1fiz4SGDPI_oXf-W0whhFdAkPe-jsO7z5xWt460muovA';

let sheets = null;
try {
    const serviceAccountCredentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
        credentials: serviceAccountCredentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    sheets = google.sheets({ version: 'v4', auth });
} catch (err) {
    console.error("⚠️ GOOGLE_SERVICE_ACCOUNT_JSON setup missing or invalid in Environment Variables!");
}

const bot = new Telegraf(BOT_TOKEN, {
    handlerTimeout: 900000 
});

const fileDb = new Map();
const userStates = new Map();

// 🚀 ALIVE & PORT FIX
const PORT = process.env.PORT || 7860;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely with Google Sheets!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// ==================== 📊 GOOGLE SHEETS SYNC & RESTORE SYSTEM ====================

// Startup & Restore Command ke liye Google Sheet Se Pure Data Load Karein
async function loadDbFromGoogleSheet() {
    if (!sheets) {
        console.error("❌ Google Sheets client is not initialized.");
        return 0;
    }
    try {
        console.log("⏳ Syncing database from Google Sheet...");
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A2:C',
        });

        const rows = response.data.values;
        if (rows && rows.length > 0) {
            fileDb.clear(); // Safe Reset for Clean Reload
            rows.forEach(row => {
                if (row[0] && row[1]) {
                    fileDb.set(row[0].trim(), {
                        messageId: parseInt(row[1]),
                        name: row[2] ? row[2].trim() : 'Unnamed File'
                    });
                }
            });
            console.log(`✅ Google Sheet Sync Complete! Total Records Loaded: ${fileDb.size}`);
            return fileDb.size;
        } else {
            console.log("ℹ️ Google Sheet is empty or no valid rows found.");
            return 0;
        }
    } catch (err) {
        console.error("❌ Google Sheet Read Error:", err.message);
        return -1;
    }
}

async function saveToGoogleSheet(param, messageId, fileName) {
    fileDb.set(param, { messageId, name: fileName });

    if (!sheets) return;
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:C',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [[param, messageId, fileName]]
            }
        });
        console.log(`✅ Record Appended to Google Sheet: ${fileName}`);
    } catch (err) {
        console.error("❌ Google Sheet Append Error:", err.message);
    }
}

// ====================================================================

const getAdminMenu = () => {
    return Markup.keyboard([
        ['🖼️ Inline Post', '🎬 Batch Inline'],
        ['🚀 Send Video', '🔗 Batch Links'],
        ['✏️ Forward Post', '❌ Cancel Operation'],
        ['🟢 Bot Status', '🔄 Restore Links']
    ]).resize();
};

async function saveDeliveryLogToBackup(deliveryData) {
    try {
        const logText = `DELIVERY_LOG:\nUSER_CHAT_ID: ${deliveryData.chatId}\nFILE_MSG_ID: ${deliveryData.fileMsgId}\nWARN_MSG_ID: ${deliveryData.warnMsgId}\nTIME: ${Date.now()}`;
        const sentLog = await bot.telegram.sendMessage(BACKUP_GROUP_ID, logText);
        return sentLog.message_id;
    } catch (err) {
        console.error("Delivery Log Error:", err.message);
    }
}

const getBatchInlineKeyboard = (selections) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback(`${selections['480p'] ? '✅' : '❌'} 480p`, 'toggle_480p')],
        [Markup.button.callback(`${selections['720p'] ? '✅' : '❌'} 720p`, 'toggle_720p')],
        [Markup.button.callback(`${selections['1080p'] ? '✅' : '❌'} 1080p`, 'toggle_1080p')],
        [Markup.button.callback('👉 Done (Aage Badhein)', 'batchinline_done')]
    ]);
};

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
    } catch (err) {}

    try {
        const member = await ctx.telegram.getChatMember(MAIN_CH_ID, userId);
        if (member && allowedStatuses.includes(member.status)) isSubscribedToMain = true;
    } catch (err) {}

    return { isSubscribedToBackup, isSubscribedToMain };
}

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

bot.action(/check_join_(.+)/, async (ctx) => {
    const userId = ctx.from.id;
    const param = ctx.match[1];

    const verified = await enforceJoinOrPrompt(ctx, userId, param);
    if (!verified) {
        await ctx.answerCbQuery("You still need to join a channel.");
        return;
    }

    await ctx.answerCbQuery("Verified! Unlocking your file...");
    try { await ctx.deleteMessage(); } catch (e) {}

    await deliverFile(ctx, param);
});

// 📦 CORE FILE DELIVERY LOGIC
async function deliverFile(ctx, param) {
    const targetChatId = ctx.chat.id;
    
    const cleanParam = param.replace('getfile_', '').trim();
    let fileData = fileDb.get(cleanParam);

    if (!fileData) {
        await loadDbFromGoogleSheet();
        fileData = fileDb.get(cleanParam);
    }

    if (!param.startsWith('getfile_')) {
        const webAppFinalUrl = `${WEBAPP_URL}?fid=${cleanParam}`;

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
            } catch (err) {}
        }, 120000);
    }
    else {
        if (!fileData) {
            return ctx.reply("❌ Link expired or invalid! Please get a new link from the channel.");
        }

        try {
            await ctx.reply("🚀 Processing your secure link... Sending file...⌛⏳");
            
            const forwardedMsg = await ctx.telegram.forwardMessage(targetChatId, DATABASE_GROUP_ID, fileData.messageId);
            const warningMsg = await ctx.reply("⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted in **30 minutes** due to copyright policies. Please forward it to a chat or save the message.", { parse_mode: 'Markdown' });

            const logId = await saveDeliveryLogToBackup({
                chatId: targetChatId,
                fileMsgId: forwardedMsg.message_id,
                warnMsgId: warningMsg.message_id
            });

            setTimeout(async () => {
                try {
                    await ctx.telegram.deleteMessage(targetChatId, forwardedMsg.message_id);
                    await ctx.telegram.deleteMessage(targetChatId, warningMsg.message_id);
                    if (logId) await ctx.telegram.deleteMessage(BACKUP_GROUP_ID, logId).catch(() => null);
                } catch (err) {}
            }, 30 * 60 * 1000);
            
        } catch (err) {
            ctx.reply("❌ Error delivering file. Make sure the bot is an Admin in the database group.");
        }
    }
}

// Handlers
const handleStatus = (ctx) => ctx.reply(`🟢 **Bot Status:** Alive & Running!\n📊 **Google Sheet Total Records Loaded:** ${fileDb.size}`, { parse_mode: 'Markdown', ...getAdminMenu() });

// 🔄 RESTORE FUNCTION (NEW)
const handleRestore = async (ctx) => {
    if (ctx.chat.id === DATABASE_GROUP_ID || ADMIN_IDS.includes(ctx.from?.id)) {
        const msg = await ctx.reply("⏳ **Restoring all links from Google Sheet... Please wait.**");
        const count = await loadDbFromGoogleSheet();
        await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => null);
        
        if (count >= 0) {
            return ctx.reply(`✅ **RESTORE COMPLETE!**\n\n📊 Total **${count}** uploaded links restored successfully into memory. All old links are now live!`, getAdminMenu());
        } else {
            return ctx.reply(`❌ **Restore Failed!** Please check Google Sheets Credentials in environment variables.`, getAdminMenu());
        }
    }
};

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

const handleBatchInline = (ctx) => {
    const userId = ctx.from.id;
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        const selections = { '480p': true, '720p': true, '1080p': true };
        userStates.set(userId, { step: 'AWAITING_BATCH_SELECTION', selections });
        return ctx.reply("🎬 **Batch Inline Menu:** Qualities choose karein jinhe post me rakhna hai (Toggling click kijiye):", {
            ...getBatchInlineKeyboard(selections)
        });
    }
};

// Registered Commands
bot.command('status', handleStatus);
bot.command('restore', handleRestore); // 👈 /restore Command Active
bot.command('sync', handleRestore);    // 👈 /sync Command
bot.command('cancel', handleCancel);
bot.command('inline', handleInline);
bot.command('forward', handleForward);
bot.command('video', handleVideo);
bot.command('link', handleLinkBatch);
bot.command('batchinline', handleBatchInline);

bot.action(/toggle_(480p|720p|1080p)/, async (ctx) => {
    const userId = ctx.from.id;
    const quality = ctx.match[1];
    const currentState = userStates.get(userId);

    if (currentState && currentState.step === 'AWAITING_BATCH_SELECTION') {
        currentState.selections[quality] = !currentState.selections[quality];
        userStates.set(userId, currentState);

        try {
            await ctx.editMessageText("🎬 **Batch Inline Menu:** Qualities choose karein jinhe post me rakhna hai (Toggling click kijiye):", {
                ...getBatchInlineKeyboard(currentState.selections)
            });
        } catch (err) {}
    }
    await ctx.answerCbQuery();
});

bot.action('batchinline_done', async (ctx) => {
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);

    if (currentState && currentState.step === 'AWAITING_BATCH_SELECTION') {
        const activeQualities = Object.keys(currentState.selections).filter(q => currentState.selections[q]);
        
        if (activeQualities.length === 0) {
            return ctx.answerCbQuery("⚠️ Kam se kam ek quality select karna zaroori hai!", { show_alert: true });
        }

        currentState.step = 'AWAITING_BATCH_IMAGE';
        userStates.set(userId, currentState);

        await ctx.answerCbQuery("Qualities selected!");
        await ctx.editMessageText(`✅ Selected Qualities: **${activeQualities.join(', ')}**\n\n🖼️ Ab please ek **Image (Photo)** bhejein jise aap background post banana chahte hain...`, { parse_mode: 'Markdown' });
    } else {
        await ctx.answerCbQuery("Invalid Session.");
    }
});

bot.on(['message', 'channel_post'], async (ctx) => {
    const message = ctx.message || ctx.channelPost;
    if (!message) return;

    const text = message.text || message.caption || '';
    const userId = message.from ? message.from.id : null;
    const currentState = userId ? userStates.get(userId) : null;
    const chatId = ctx.chat.id;

    if (chatId === DATABASE_GROUP_ID) {
        if (text === '🟢 Bot Status') return handleStatus(ctx);
        if (text === '🔄 Restore Links') return handleRestore(ctx); // 👈 Button Handler Added
        if (text === '❌ Cancel Operation') return handleCancel(ctx);
        if (text === '🖼️ Inline Post') return handleInline(ctx);
        if (text === '✏️ Forward Post') return handleForward(ctx);
        if (text === '🚀 Send Video') return handleVideo(ctx);
        if (text === '🔗 Batch Links') return handleLinkBatch(ctx);
        if (text === '🎬 Batch Inline') return handleBatchInline(ctx);
    }

    if (text.startsWith('/inline') || text.startsWith('/video') || text.startsWith('/forward') || text.startsWith('/cancel') || text.startsWith('/status') || text.startsWith('/link') || text.startsWith('/batchinline') || text.startsWith('/sync') || text.startsWith('/restore')) return;

    if (chatId === BACKUP_GROUP_ID && text.startsWith('DELIVERY_LOG:')) {
        try {
            const userChatIdMatch = text.match(/USER_CHAT_ID:\s*(-?\d+)/);
            const fileMsgIdMatch = text.match(/FILE_MSG_ID:\s*(\d+)/);
            const warnMsgIdMatch = text.match(/WARN_MSG_ID:\s*(\d+)/);
            const timeMatch = text.match(/TIME:\s*(\d+)/);

            if (userChatIdMatch && fileMsgIdMatch && warnMsgIdMatch && timeMatch) {
                const logTime = parseInt(timeMatch[1]);
                if (Date.now() - logTime >= 1800000) {
                    await ctx.telegram.deleteMessage(userChatIdMatch[1], fileMsgIdMatch[1]).catch(() => null);
                    await ctx.telegram.deleteMessage(userChatIdMatch[1], warnMsgIdMatch[1]).catch(() => null);
                    await ctx.deleteMessage().catch(() => null);
                }
            }
        } catch (e) {}
    }

    if (chatId === DATABASE_GROUP_ID) {
        
        if (currentState && currentState.step === 'AWAITING_BATCH_IMAGE') {
            if (!message.photo) return ctx.reply("❌ Invalid format. Please send or forward an Image (Photo) only.");

            const photoId = message.photo[message.photo.length - 1].file_id;
            currentState.photoId = photoId;
            currentState.caption = message.caption || "";
            currentState.step = 'AWAITING_BATCH_URLS';
            userStates.set(userId, currentState);

            return ctx.reply("🔗 **Send Batch Links:** Ab sabhi quality links sequence me bhejhein...", getAdminMenu());
        }

        if (currentState && currentState.step === 'AWAITING_BATCH_URLS') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const foundLinks = text.match(urlRegex);

            if (!foundLinks || foundLinks.length === 0) {
                return ctx.reply("❌ No valid links found! Please send proper URLs.");
            }

            let finalQualities = Object.keys(currentState.selections).filter(q => currentState.selections[q]);

            if (foundLinks.length === 3) {
                finalQualities = ['480p', '720p', '1080p'];
            }

            if (foundLinks.length < finalQualities.length) {
                return ctx.reply(`❌ Links shortage! You selected **${finalQualities.length}** qualities but provided **${foundLinks.length}** link(s).`);
            }

            const processMsg = await ctx.reply("⏳ **Generating Batch Posts... Please wait...**");
            const outputLinksList = [];

            for (let i = 0; i < finalQualities.length; i++) {
                const currentQuality = finalQualities[i];
                const targetLink = foundLinks[i];
                const postCaption = `⚡ **Quality:** ${currentQuality}\n\n${currentState.caption || ''}`;

                try {
                    const finalPost = await ctx.telegram.sendPhoto(chatId, currentState.photoId, {
                        caption: postCaption,
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([[Markup.button.url('🍿 Download/Watch online', targetLink)]])
                    });

                    const msgIdStr = finalPost.message_id.toString();
                    const encodedParam = Buffer.from(msgIdStr).toString('base64url');
                    const trackerName = `Batch Inline [${currentQuality}] - Msg ID: ${msgIdStr}`;

                    await saveToGoogleSheet(encodedParam, finalPost.message_id, trackerName);

                    const finalBotLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
                    outputLinksList.push(`🍿 **${currentQuality}:** \`${finalBotLink}\``);

                } catch (err) {
                    outputLinksList.push(`❌ **${currentQuality}:** Generation Failed.`);
                }
            }

            if (userId) userStates.delete(userId);
            await ctx.telegram.deleteMessage(chatId, processMsg.message_id).catch(() => null);

            return ctx.reply(`📊 **Batch Inline Generated Successfully!**\n\n${outputLinksList.join('\n\n')}`, {
                parse_mode: 'Markdown',
                ...getAdminMenu()
            });
        }

        if (currentState && currentState.step === 'AWAITING_BATCH_LINKS') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const foundLinks = text.match(urlRegex);

            if (!foundLinks || foundLinks.length === 0) {
                return ctx.reply("❌ No valid links found! Please send proper URLs.", getAdminMenu());
            }

            const processingMsg = await ctx.reply(`⏳ **Processing ${foundLinks.length} link(s)... Please wait. (Bulk links me thoda time lag sakta hai)**`);
            let outputLinksList = [];

            for (let i = 0; i < foundLinks.length; i++) {
                const targetUrl = foundLinks[i];
                try {
                    const textPost = await ctx.telegram.sendMessage(chatId, `🍿 **Your Direct Link:**\n\n${targetUrl}`, {
                        parse_mode: 'Markdown'
                    });

                    const msgIdStr = textPost.message_id.toString();
                    const encodedParam = Buffer.from(msgIdStr).toString('base64url');
                    const dummyName = `Text Link Post #${msgIdStr}`;

                    await saveToGoogleSheet(encodedParam, textPost.message_id, dummyName);

                    const finalBotLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
                    outputLinksList.push(`🔗 **Link ${i+1}:** \`${finalBotLink}\``);

                } catch (linkErr) {
                    outputLinksList.push(`❌ **Link ${i+1}:** Failed to process (${targetUrl.substring(0, 20)}...)`);
                }
                
                // 🛑 RATE LIMIT PROTECTOR: 1.5 seconds ka delay add kiya gaya hai taaki APIs block na karein
                await new Promise(resolve => setTimeout(resolve, 1500));
            }

            if (userId) userStates.delete(userId);
            await ctx.telegram.deleteMessage(chatId, processingMsg.message_id).catch(() => null);
            
            // 🛑 MESSAGE LENGTH PROTECTOR: Agar output bohot bada hai, toh usko chunks me break karega
            let finalMessage = `📊 **Batch Processing Complete!**\n\n`;
            for (const outLink of outputLinksList) {
                // Telegram max limit 4096 hai, safe side ke liye 3800 par cut kar rahe hain
                if ((finalMessage.length + outLink.length) > 3800) {
                    await ctx.reply(finalMessage, { parse_mode: 'Markdown' });
                    finalMessage = ""; // Naye part ke liye clear karein
                }
                finalMessage += outLink + '\n\n';
            }
            
            if (finalMessage.trim().length > 0) {
                return ctx.reply(finalMessage, {
                    parse_mode: 'Markdown',
                    ...getAdminMenu()
                });
            }
            return;
        }

        let currentFileObj = message.video || message.document || message.audio || message.animation || message.video_note || (message.photo ? message.photo[message.photo.length - 1] : null);
        
        if (currentState && currentState.step === 'AWAITING_DIRECT_VIDEO') {
            if (!currentFileObj) return ctx.reply("❌ No media detected. Please send a valid Video or Document file.");
            
            let fileName = currentFileObj.file_name || (message.video ? "Video File" : message.animation ? "Silent Video" : "Media File");
            const msgIdStr = message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            await saveToGoogleSheet(encodedParam, message.message_id, fileName);

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

                await saveToGoogleSheet(encodedParam, finalPost.message_id, fileData.fileName);

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

            await saveToGoogleSheet(encodedParam, message.message_id, fileName);

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

bot.launch().then(async () => {
    console.log("Hotpopkornbot is now online...");
    await loadDbFromGoogleSheet(); // Auto Restore on Startup
});
