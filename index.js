const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Aapki private channel ki ID set hai
const PRIVATE_CHANNEL_ID = -1003900661218; 

// 📁 Aapki backup group ki ID set hai
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

// 🔒 Force-Join check: returns which channels the user still needs to join
async function checkForceJoin(ctx, userId) {
    // 👑 Admin bypass
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

// 🔒 Sends the correct "please join" message depending on what's missing.
// Returns true if user is fully verified (both joined), false if a join message was sent.
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
        // Still missing a channel — enforceJoinOrPrompt already sent the next prompt.
        await ctx.answerCbQuery("You still need to join a channel.");
        return;
    }

    await ctx.answerCbQuery("Verified! Unlocking your file...");
    try {
        await ctx.deleteMessage();
    } catch (e) {}

    // Same delivery logic as the /start handler, reused here after verification.
    await deliverFile(ctx, param);
});

// 📦 Extracted file-delivery logic so both /start and the recheck button can use it
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
            const warningMsg = await ctx.reply("⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted in **30 minutes** due to copyright policies.Please forward it to a chat or save the message.", { parse_mode: 'Markdown' });

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

// 1. DATABASE GROUP & BACKUP RESTORE LOGIC
bot.on('message', async (ctx) => {
    const text = ctx.message.text || '';
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);

    // --- Pinned Messages/Logs se Memory Restore karne ka Fix Logic ---
    if (ctx.chat.id === BACKUP_GROUP_ID && text.startsWith('/restore')) {
        try {
            // Pehle aakhiri pinned message ki ID nikaalte hain taaki wahan se piche scan kar sakein
            const fullChat = await ctx.telegram.getChat(BACKUP_GROUP_ID);
            if (!fullChat.pinned_message) {
                return ctx.reply("🏁 **Restore Cancelled!** Is group me koi bhi pinned message nahi mila.");
            }

            const statusMsg = await ctx.reply("🔄 **Memory restoration started...** Scanning backup messages line by line, please wait...");
            
            const latestPinId = fullChat.pinned_message.message_id;
            let restoredCount = 0;
            
            // Loop chala kar pichle 10,000 messages ko scan karenge (Aap is range ko badha bhi sakte hain)
            const scanRange = 10000; 
            const startId = latestPinId;
            const endId = Math.max(1, latestPinId - scanRange);

            for (let currentId = startId; currentId >= endId; currentId--) {
                try {
                    // Ek-ek karke message ko target group me forward karke metadata fetch karne ki trick
                    const msg = await ctx.telegram.forwardMessage(DATABASE_GROUP_ID, BACKUP_GROUP_ID, currentId).catch(() => null);
                    
                    if (msg) {
                        // Forward karne ke baad use turant delete kar denge taaki database group ganda na ho
                        await ctx.telegram.deleteMessage(DATABASE_GROUP_ID, msg.message_id).catch(() => null);
                        
                        const msgText = msg.text || '';
                        if (msgText.includes('DATABASE_LOG:')) {
                            const paramMatch = msgText.match(/PARAM:\s*([^\s|]+)/);
                            const msgIdMatch = msgText.match(/MSG_ID:\s*(\d+)/);
                            const nameMatch = msgText.match(/NAME:\s*(.+)$/m);

                            if (paramMatch && msgIdMatch && nameMatch) {
                                const key = paramMatch[1].trim();
                                // Agar pehle se added nahi hai toh add karo
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
                    // Agar koi ek message content private ya deleted ho toh skip karo
                    continue;
                }
            }

            // Status message ko update karo final report ke sath
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            } catch (e) {}

            return ctx.reply(`📊 **Restoration Complete!**\n\n✅ New Restored Links: **${restoredCount}**\n📚 Total Active Links in Memory: **${fileDb.size}**`);

        } catch (restoreErr) {
            console.error("Restore Error:", restoreErr);
            return ctx.reply(`❌ **Restore karne me samasya aayi.**\n\n**Technical Error:** \`${restoreErr.message}\``);
        }
    }

    // Main database group ka logic
    if (ctx.chat.id === DATABASE_GROUP_ID) {

        // --- Customized /inline command logic ---
        if (text.startsWith('/inline')) {
            userStates.set(userId, { step: 'AWAITING_FILE' });
            return ctx.reply("🖼️ **Set Image/File:** Please send or forward the file (Photo/Video/Document) now...", {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }

        // --- /forward command logic ---
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

        // Step 2: File receive karna
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

        // Step 3: Link receive karna aur backup me log bhejna
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

                // 💾 Backup group me data bhejna aur PIN karna
                await saveToBackup(encodedParam, finalPost.message_id, fileData.fileName);

                const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;

                userStates.set(userId, {
                    step: 'COMPLETED',
                    fileId: fileData.fileId,
                    fileType: fileData.fileType,
                    lastTrackedLink: botLink
                });

                return ctx.reply(`✅ **Inline Post Created & Tracked Successfully!**\n\n📂 **Name:** ${fileData.fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                    reply_to_message_id: finalPost.message_id,
                    parse_mode: 'Markdown'
                });

            } catch (err) {
                console.error("Error creating combined post:", err);
                return ctx.reply("❌ Error compiling the inline post.");
            }
        }

        // Step 4: /forward ke baad naya title lekar private channel me bhejna
        if (currentState && currentState.step === 'AWAITING_TITLE') {
            const newTitle = text;
            const fileData = currentState;
            userStates.delete(userId);

            try {
                const channelOptions = {
                    caption: `**${newTitle}**`,
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('📥 Download Now', fileData.lastTrackedLink)]
                    ])
                };

                if (fileData.fileType === 'photo') await ctx.telegram.sendPhoto(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'video') await ctx.telegram.sendVideo(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'document') await ctx.telegram.sendDocument(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);
                else if (fileData.fileType === 'audio') await ctx.telegram.sendAudio(PRIVATE_CHANNEL_ID, fileData.fileId, channelOptions);

                return ctx.reply("🚀 **Success!** Post aapke private channel par **Download Now** button ke saath publish kar di gayi hai.", { reply_to_message_id: ctx.message.message_id });
            } catch (err) {
                console.error(err);
                return ctx.reply("❌ Private channel par post bhejne me error aaya. Check karein bot Admin hai.");
            }
        }

        // --- Normal response logic (Direct upload) ---
        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        if (hasFile && !currentState) {
            let fileName = "Requested File";
            if (ctx.message.document) fileName = ctx.message.document.file_name;
            else if (ctx.message.video) fileName = ctx.message.video.file_name || "Video File";

            const msgIdStr = ctx.message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, { messageId: ctx.message.message_id, name: fileName });

            // 💾 Normal file ko bhi backup bhejkar PIN karna
            await saveToBackup(encodedParam, ctx.message.message_id, fileName);

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            return ctx.reply(`✅ **File Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }
    }

    // 2. USER CHAT LOGIC (Downloader part)
    if (text.startsWith('/start')) {
        const param = text.split(' ')[1];
        if (!param) return ctx.reply("👋 Welcome! Please click a file link from our channel to download.");

        // 🔒 Force-join gate: user must join Backup Channel, then Main Channel, before getting the file
        const verified = await enforceJoinOrPrompt(ctx, userId, param);
        if (!verified) return; // enforceJoinOrPrompt already sent the correct "please join" message

        await deliverFile(ctx, param);
    }
});

bot.launch().then(() => console.log("Hotpopkornbot is now online..."));
