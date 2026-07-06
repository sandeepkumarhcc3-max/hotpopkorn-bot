const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();

// यूज़र्स के स्टेट्स (कदम) याद रखने के लिए मेमोरी
const userStates = new Map();

// RENDER FREE TIER FIX
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 1. DATABASE GROUP LOGIC
bot.on('message', async (ctx) => {
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        const text = ctx.message.text || '';
        const userId = ctx.from.id;
        const currentState = userStates.get(userId);

        // --- कस्टमाइज्ड /inline कमांड लॉजिक ---
        if (text.startsWith('/inline')) {
            userStates.set(userId, { step: 'AWAITING_FILE' });
            return ctx.reply("🖼️ **Set Image/File:** Please send or forward the file (Photo/Video/Document) now...", {
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }

        // स्टेप 2: फाइल रिसीव करना (जब /inline मोड एक्टिव हो)
        if (currentState && currentState.step === 'AWAITING_FILE') {
            let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
            if (!hasFile) {
                return ctx.reply("❌ That's not a file. Please send an image, video, or document.");
            }

            // फाइल का नाम और टाइप निकालें
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
                // फोटो एरे में से सबसे बड़ी साइज वाली फोटो लेते हैं
                fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
                fileType = "photo";
            }

            // अगला स्टेप सेट करें और डेटा सेव करें
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

        // स्टेप 3: लिंक रिसीv करना और कंबाइन करके पोस्ट बनाना
        if (currentState && currentState.step === 'AWAITING_LINK') {
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const match = text.match(urlRegex);

            if (!match) {
                return ctx.reply("❌ Invalid Link! Please send a proper URL starting with http:// or https://");
            }

            const watchOnlineUrl = match[0];
            const fileData = currentState;

            // स्टेट डिलीट करें ताकि प्रोसेस रीसेट हो जाए
            userStates.delete(userId);

            try {
                let finalPost;
                const extraOptions = {
                    caption: fileData.caption,
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('🍿 Watch Online', watchOnlineUrl)]
                    ])
                };

                // कंबाइंड पोस्ट ग्रुप में भेजना
                if (fileData.fileType === 'photo') {
                    finalPost = await ctx.telegram.sendPhoto(ctx.chat.id, fileData.fileId, extraOptions);
                } else if (fileData.fileType === 'video') {
                    finalPost = await ctx.telegram.sendVideo(ctx.chat.id, fileData.fileId, extraOptions);
                } else if (fileData.fileType === 'document') {
                    finalPost = await ctx.telegram.sendDocument(ctx.chat.id, fileData.fileId, extraOptions);
                } else if (fileData.fileType === 'audio') {
                    finalPost = await ctx.telegram.sendAudio(ctx.chat.id, fileData.fileId, extraOptions);
                }

                // पुराने लॉजिक के अनुसार फाइल को डेटाबेस में ट्रैक करना
                const msgIdStr = finalPost.message_id.toString();
                const encodedParam = Buffer.from(msgIdStr).toString('base64url');

                fileDb.set(encodedParam, {
                    messageId: finalPost.message_id,
                    name: fileData.fileName
                });

                const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;

                return ctx.reply(`✅ **Inline Post Created & Tracked Successfully!**\n\n📂 **Name:** ${fileData.fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                    reply_to_message_id: finalPost.message_id,
                    parse_mode: 'Markdown'
                });

            } catch (err) {
                console.error("Error creating combined post:", err);
                return ctx.reply("❌ Error compiling the inline post. Check bot permissions.");
            }
        }


        // --- २. नॉर्मल रिस्पांस लॉजिक (बिना /inline कमांड के) ---
        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        
        if (hasFile && !currentState) {
            let fileName = "Requested File";
            if (ctx.message.document) fileName = ctx.message.document.file_name;
            else if (ctx.message.video) fileName = ctx.message.video.file_name || "Video File";

            const msgIdStr = ctx.message.message_id.toString();
            const encodedParam = Buffer.from(msgIdStr).toString('base64url');

            fileDb.set(encodedParam, {
                messageId: ctx.message.message_id,
                name: fileName
            });

            const botLink = `https://t.me/${ctx.botInfo.username}?start=${encodedParam}`;
            
            return ctx.reply(`✅ **File Tracked Successfully!**\n\n📂 **Name:** ${fileName}\n\n🔗 **Post Link for Channel:**\n\`${botLink}\``, { 
                reply_to_message_id: ctx.message.message_id,
                parse_mode: 'Markdown'
            });
        }
        return;
    }

    // 2. USER CHAT LOGIC (यह हिस्सा बिल्कुल पुराना और अनछुआ है)
    const text = ctx.message.text || '';
    if (text.startsWith('/start')) {
        const param = text.split(' ')[1];

        if (!param) {
            return ctx.reply("👋 Welcome! Please click a file link from our channel to download.");
        }

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

            if (!fileData) {
                return ctx.reply("❌ Link expired or invalid! Please get a new link from the channel.");
            }

            try {
                await ctx.reply("🚀 Processing your secure link... Sending file...");

                const forwardedMsg = await ctx.telegram.forwardMessage(ctx.chat.id, DATABASE_GROUP_ID, fileData.messageId);

                const warningMsg = await ctx.reply(
                    "⚠️ **IMPORTANT NOTICE:**\n\nThis file will be automatically deleted from this chat in **30 minutes** due to copyright and privacy policies.\n\n👉 **Forward or Save this file to your Saved Messages right now!**",
                    { parse_mode: 'Markdown' }
                );

                setTimeout(async () => {
                    try {
                        await ctx.telegram.deleteMessage(ctx.chat.id, forwardedMsg.message_id);
                        await ctx.telegram.deleteMessage(ctx.chat.id, warningMsg.message_id);
                        console.log(`Successfully auto-deleted file for chat: ${ctx.chat.id}`);
                    } catch (err) {
                        console.log("Error during auto-deletion:", err.message);
                    }
                }, 1800000); 

            } catch (err) {
                console.error(err);
                ctx.reply("❌ Error delivering file. Make sure the bot is an Admin in the database group.");
            }
        }
    }
});

bot.launch().then(() => console.log("Hotpopkornbot is now online..."));
                
