const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Force Join Channels & Links Configuration
const MAIN_CH_ID = -1003933920647;
const MAIN_CH_LINK = "https://t.me/popkornmovie_1";
const BACKUP_CH_ID = -1003900661218; // Yehi aapka pehle PRIVATE_CHANNEL_ID tha
const BACKUP_CH_LINK = "https://t.me/+1A7MUa-fD71jNDk1";

// 📁 Aapki backup group ki ID set hai (Jahan logs pin hote hain)
const BACKUP_GROUP_ID = -1004314246888; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();
const userStates = new Map();

// RENDER FREE TIER FIX
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely!');
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

// Helper function: User ka channel membership status check karne ke liye
async function checkForceJoin(ctx, userId) {
    let isSubscribedToBackup = false;
    let isSubscribedToMain = false;

    // Check Backup Channel
    try {
        const member = await ctx.telegram.getChatMember(BACKUP_CH_ID, userId);
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            isSubscribedToBackup = true;
        }
    } catch (err) {
        console.error("Error checking backup channel status:", err.message);
        // Agar bot admin nahi hai ya channel nahi mila, toh crash na ho isliye safe fallback
    }

    // Check Main Channel
    try {
        const member = await ctx.telegram.getChatMember(MAIN_CH_ID, userId);
        if (['member', 'administrator', 'creator'].includes(member.status)) {
            isSubscribedToMain = true;
        }
    } catch (err) {
        console.error("Error checking main channel status:", err.message);
    }

    return { isSubscribedToBackup, isSubscribedToMain };
}

// 1. DATABASE GROUP & BACKUP RESTORE LOGIC
bot.on('message', async (ctx) => {
    const text = ctx.message.text || '';
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);

    // --- Pinned Messages/Logs se Memory Restore karne ka Fix Logic ---
    if (ctx.chat.id === BACKUP_GROUP_ID && text.startsWith('/restore')) {
        try {
            const fullChat = await ctx.telegram.getChat(BACKUP_GROUP_ID);
            if (!fullChat.pinned_message) {
                return ctx.reply("🏁 **Restore Cancelled!** Is group me koi bhi pinned message nahi mila.");
            }

            const statusMsg = await ctx.reply("🔄 **Memory restoration started...** Scanning backup messages line by line, please wait...");
            
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
                        
                        const msgText = msg.text || '';
                        if (msgText.includes('DATABASE_LOG:')) {
                            const paramMatch = msgText.match(/PARAM:\s*([^\s|]+)/);
                            const msgIdMatch = msgText.match(/MSG_ID:\s*(\d+)/);
                            const nameMatch = msgText.match(/NAME:\s*(.+)$/m);

                            if (paramMatch && msgIdMatch && nameMatch) {
                                const key = paramMatch[1].trim();
                                if (!fileDb.has(key)) {
                                    fileDb.set(key, { 
                                        messageId: parseInt(msgIdMatch[1]), 
                                        name: nameMatch[1].trim() 
                                    });
                                    restoredCount++;
                                }
                            }
                        }
                    }
                } catch (singleErr) {
                    continue;
                }
            }

            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            } catch (e) {}

            return ctx.reply("📊 **Restoration Complete!**\n\n✅ New Restored Links: **" + restoredCount + "**\n📚 Total Active Links in Memory: **" + fileDb.size + "**");

        } catch (restoreErr) {
            console.error("Restore Error:", restoreErr);
            return ctx.reply("❌ **Restore karne me samasya aayi.**\n\n**Technical Error:** `" + restoreErr.message + "`");
        }
    }

    // Main database group ka logic
    if (ctx.chat.id === DATABASE_GROUP_ID) {

        if (text.startsWith('/inline')) {
            userStates.set(userId, { step: 'AWAITING_FILE' });
            return ctx.reply("🖼️ **Set Image/File:** Please send or forward the file (Photo/Video/Document) now...", {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }

        if (text.startsWith('/forward')) {
            if (!currentState || !currentState.lastTrackedLink) {
                return ctx.reply("❌ **No recent file found!** Pehle `/inline` process poori karein.", {
                    reply_to_message_id: ctx.message.message_id,
                    parse_mode: 'Markdown'
                });
            }

            currentState.step = 'AWAITING_TITLE';
            userStates.set(userId, currentState);

            return ctx.reply("✏️ **Title your post name:** Please send the text/title for your channel post now...", {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }

        if (currentState && currentState.step === 'AWAITING_FILE') {
            let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
            if (!hasFile) {
                return ctx.reply("❌ That's not a file. Please send an image, video, or document.");
            }

            let fileName = "Requested File";
            let fileType = "";
            let fileId = "";

            if (ctx.message.document) {
                fileName = ctx.message.document.file_name;
                fileId = ctx.message.document.file_id;
                fileType = "document";
            } else if (ctx.message.video) {
                fileName = ctx.message.video.file_name || "Video File";
                fileId = ctx.message.video.file_id;
                fileType = "video";
            } else if (ctx.message.audio) {
                fileName = ctx.message.audio.file_name || "Audio File";
                fileId = ctx.message.audio.file_id;
                fileType = "audio";
            } else if (ctx.message.photo) {
                fileName = "Photo File";
                fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                fileType = "photo";
            }

            userStates.set(userId, {
                step: 'AWAITING_LINK',
                fileId: fileId,
                fileType: fileType,
                fileName: fileName,
                caption: ctx.message.caption || ""
            });

            return ctx.reply("🔗 **Send Link:** Now, please send the URL/Link for the button...", {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }

        if (currentState && currentState.step === 'AWAITING_LINK') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const match = text.match(urlRegex);

            if (!match) {
                return ctx.reply("❌ Invalid Link! Please send a proper URL.");
            }

            const watchOnlineUrl = match[0];
            const fileData = currentState;

            try {
                let finalPost;
                const extraOptions = {
                    caption: fileData.caption,
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('🍿 Watch Online', watchOnlineUrl)]
                    ])
                };

                if (fileData.fileType === 'photo') finalPost = await ctx.telegram.sendPhoto(ctx.chat.id, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'video') finalPost = await ctx.telegram.sendVideo(ctx.chat.id, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'document') finalPost = await ctx.telegram.sendDocument(ctx.chat.id, fileData.fileId, extraOptions);
                else if (fileData.fileType === 'audio') finalPost = await ctx.telegram.sendAudio(ctx.chat.id, fileData.fileId, extraOptions);

                const msgIdStr = finalPost.message_id.toString();
                const encodedParam = Buffer.from(msgIdStr).toString('base64url');

                fileDb.set(encodedParam, { messageId: finalPost.message_id, name: fileData.fileName });

                await saveToBackup(encodedParam, finalPost.message_id, fileData.fileName);

                const botLink = "https://t.me/" + ctx.botInfo.username + "?start=" + encodedParam;

                userStates.set(userId, {
                    step: 'COMPLETED',
                    fileId: fileData.fileId,
                    fileType: fileData.fileType,
                    lastTrackedLink: botLink
                });

                return ctx.reply("✅ **Inline Post Created & Tracked Successfully!**\n\n📂 **Name:** " + fileData.fileName + "\n\n🔗 **Post Link for Channel:**\n`" + botLink + "`", { 
                    reply_to_message_id: finalPost.message_id,
                    parse_mode: 'Markdown'
                });

            } catch (err) {
                console.error("Error creating combined post:", err);
                return ctx.reply("❌ Error compiling the inline post.");
            }
        }

        if (currentState && currentState.step === 'AWAITING_TITLE') {
            const newTitle = text;
            const fileData = currentState;
            userStates.delete(userId);

            try {
                const channelOptions = {
                    caption: "**" + newTitle + "**",
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('📥 Download Now', fileData.lastTrackedLink)]
                    ])
                };

                if (fileData.fileType === 'photo') await ctx.telegram.sendPhoto(BACKUP_CH_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'video') await ctx.telegram.sendVideo(BACKUP_CH_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'document') await ctx.telegram.sendDocument(BACKUP_CH_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'audio') await ctx.telegram.sendAudio(BACKUP_CH_ID, fileData.fileId, channelOptions);

                return ctx.reply("🚀 **Success!** Post aapke private channel par **Download Now** button ke saath publish kar di gayi hai.", { reply_to_message_id: ctx.message.message_id });
            } catch (err) {
                console.error(err);
                return ctx.reply("❌ Private channel par post bhejne me error aaya. Check karein bot Admin hai.");
            }
        }

        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        if (hasFile && !currentState) {
            let fileName = "Requested File";
            if (ctx.message.document) fileName = ctx.message.document.file_name;
            else if (ctx.message.video) fileName = ctx.message.video.file_name || "Video File";

            const msgIdStr = ctx.message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: ctx.message.message_id, name: fileName });

            await saveToBackup(encodedParam, ctx.message.message_id, fileName);

            const botLink = "https://t.me/" + ctx.botInfo.username + "?start=" + encodedParam;
            return ctx.reply("✅ **File Tracked Successfully!**\n\n📂 **Name:** " + fileName + "\n\n🔗 **Post Link for Channel:**\n`" + botLink + "`", { 
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }
    }

    // 2. USER CHAT LOGIC (Downloader part)
    if (text.startsWith('/start')) {
        const param = text.split(' ')[1];
        if (!param) return ctx.reply("👋 Welcome! Please click a file link from our channel to download.");

        // --- FORCE JOIN VERIFICATION SYSTEM ---
        const { isSubscribedToBackup, isSubscribedToMain } = await checkForceJoin(ctx, userId);

        // Agar user dono me se kisi ek me bhi nahi hai, toh use access nahi milega
        if (!isSubscribedToBackup || !isSubscribedToMain) {
            const buttons = [];
            let alertText = "⚠️ **ACCESS DENIED!**\n\nFile download karne ke liye aapko humare channels ko join karna hoga. Niche diye gaye buttons se join karein aur phir link par dubara click karein:\n";

            if (!isSubscribedToBackup) {
                buttons.push([Markup.button.url('📢 Join Backup Channel', BACKUP_CH_LINK)]);
            }
            if (!isSubscribedToMain) {
                buttons.push([Markup.button.url('🍿 Join Main Channel', MAIN_CH_LINK)]);
            }

            // Ek refresh button bhi add kar dete hain convenience ke liye
            const botUsername = ctx.botInfo.username;
            buttons.push([Markup.button.url('🔄 Check Subscription Again', "https://t.me/" + botUsername + "?start=" + param)]);

            return ctx.reply(alertText, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard(buttons)
            });
        }
        // ---------------------------------------

        if (!param.startsWith('getfile_')) {
            const fileData = fileDb.get(param);
            const webAppFinalUrl = WEBAPP_URL + "?fid=" + param;

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
        else if (param.startsWith('getfile_')) {
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
});

bot.launch().then(() => console.log("Hotpopkornbot is now online with Force Join..."));
