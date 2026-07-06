const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Aapki private channel ki ID set hai
const PRIVATE_CHANNEL_ID = -1003900661218; 

// 📁 Aapki backup group ki ID set hai
const BACKUP_GROUP_ID = -1004314246888; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();
const userStates = new Map();

// Restore progress (Pagination) yaad rakhne ke liye variable
let lastRestoredMsgId = null;

// RENDER FREE TIER FIX
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 1. DATABASE GROUP & BACKUP RESTORE LOGIC
bot.on('message', async (ctx) => {
    const text = ctx.message.text || '';
    const userId = ctx.from.id;
    const currentState = userStates.get(userId);

    // --- Backup Group me /restore command logic (With Smart Pagination Fix) ---
    if (ctx.chat.id === BACKUP_GROUP_ID && text.startsWith('/restore')) {
        try {
            let options = { limit: 100 };
            
            if (lastRestoredMsgId) {
                options.offset_id = lastRestoredMsgId;
                await ctx.reply(`🔄 **Next Batch:** Message ID ${lastRestoredMsgId} ke pehle ke purane messages scan kiye ja rahe hain...`);
            } else {
                await ctx.reply("🔄 **First Batch:** Sabse naye 100 messages scan kiye ja rahe hain...");
            }
            
            // FIX: BACKUP_GROUP_ID ki jagah seedhe ctx.chat.id ka use kiya hai
            const logs = await ctx.telegram.getChatHistory(ctx.chat.id, options);
            
            if (!logs || logs.length === 0) {
                lastRestoredMsgId = null; // Progress reset
                return ctx.reply("🏁 **All Done!** Backup group me ab scan karne ke liye koi aur purana message nahi bacha hai.");
            }

            let restoredCount = 0;

            for (const log of logs) {
                if (log.text && log.text.includes('DATABASE_LOG:')) {
                    const paramMatch = log.text.match(/PARAM:\s*([^\s|]+)/);
                    const msgIdMatch = log.text.match(/MSG_ID:\s*(\d+)/);
                    const nameMatch = log.text.match(/NAME:\s*(.+)$/m);

                    if (paramMatch && msgIdMatch && nameMatch) {
                        const param = paramMatch[1];
                        const messageId = parseInt(msgIdMatch[1]);
                        const fileName = nameMatch[1].trim();

                        fileDb.set(param, { messageId, name: fileName });
                        restoredCount++;
                    }
                }
                // Agle batch ke liye sabse aakhri message ID track karna
                lastRestoredMsgId = log.message_id;
            }

            return ctx.reply(
                `📊 **Batch Restored!**\n\nIs batch me **${restoredCount}** links reload hue.\nKul active links (Memory): **${fileDb.size}**\n\n👇 Iske aur peeche (purane) links load karne ke liye neeche diye button par click karein ya fir se \`/restore\` likhein.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Load Next 100 Files', 'load_more_backup')]
                ])
            );

        } catch (restoreErr) {
            console.error("Restore Error:", restoreErr);
            // FIX: Agar koi dikkat aayegi toh ab ye seedhe asli technical error message screen par dega
            return ctx.reply(`❌ **Restore karne me samasya aai.**\n\n**Technical Error:** \`${restoreErr.message}\``);
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

                // 💾 Backup group me data store karna
                await ctx.telegram.sendMessage(BACKUP_GROUP_ID, `DATABASE_LOG:\nPARAM: ${encodedParam}\nMSG_ID: ${finalPost.message_id}\nNAME: ${fileData.fileName}`);

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

            // 💾 Normal file ka bhi backup log bhejna
            await ctx.telegram.sendMessage(BACKUP_GROUP_ID, `DATABASE_LOG:\nPARAM: ${encodedParam}\nMSG_ID: ${ctx.message.message_id}\nNAME: ${fileName}`);

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

        if (!param.startsWith('getfile_')) {
            const fileData = fileDb.get(param);
            const fileName = fileData ? fileData.name : "Your Requested File";
            const webAppFinalUrl = `${WEBAPP_URL}?fid=${param}`;

            await ctx.reply(
                `📂 **File Name:** \`${fileName}\`\n\n👇 Click the button below to open the secure downloader and unlock your file.`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.webApp('📥 Download Now', webAppFinalUrl)]
                    ])
                }
            );
        } 
        else if (param.startsWith('getfile_')) {
            const cleanParam = param.replace('getfile_', '');
            const fileData = fileDb.get(cleanParam);

            if (!fileData) return ctx.reply("❌ Link expired or invalid! Please get a new link from the channel.");

            try {
                await ctx.reply("🚀 Processing your secure link... Sending file...");
                const forwardedMsg = await ctx.telegram.forwardMessage(ctx.chat.id, DATABASE_GROUP_ID, fileData.messageId);
                const warningMsg = await ctx.reply("⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted in **30 minutes** due to copyright policies.", { parse_mode: 'Markdown' });

                setTimeout(async () => {
                    try {
                        await ctx.telegram.deleteMessage(ctx.chat.id, forwardedMsg.message_id);
                        // FIX: warningMsg ka double variable hata diya hai yahan
                        await ctx.telegram.deleteMessage(ctx.chat.id, warningMsg.message_id);
                    } catch (err) { console.log("Error during auto-deletion:", err.message); }
                }, 1800000); 
            } catch (err) {
                ctx.reply("❌ Error delivering file. Make sure the bot is an Admin in the database group.");
            }
        }
    }
});

// Inline button 'Load Next 100 Files' click handler
bot.action('load_more_backup', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.message = { text: '/restore', chat: { id: BACKUP_GROUP_ID } };
    ctx.from = ctx.callbackQuery.from;
    return bot.handleUpdate(ctx.update);
});

bot.launch().then(() => console.log("Hotpopkornbot is now online..."));
