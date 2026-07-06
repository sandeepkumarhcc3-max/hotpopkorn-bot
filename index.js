const { Telegraf, Markup } = require('telegraf');
const http = require('http'); // Dummy server ke liye

// Aapki saari details yahan fit hain
const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();

// 🟢 RENDER FREE TIER ERROR FIX: Dummy HTTP Server 🟢
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 1. DATABASE GROUP LOGIC
bot.on('message', async (ctx) => {
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        
        if (hasFile) {
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

    // 2. USER CHAT LOGIC
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
const { Telegraf, Markup } = require('telegraf');

// Aapki saari details yahan fit hain
const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();

// 1. DATABASE GROUP LOGIC
bot.on('message', async (ctx) => {
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        
        if (hasFile) {
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

    // 2. USER CHAT LOGIC
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
const { Telegraf, Markup } = require('telegraf');
const http = require('http'); // Dummy server ke liye

// Aapki saari details yahan fit hain
const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

const bot = new Telegraf(BOT_TOKEN);
const fileDb = new Map();

// 🟢 RENDER FREE TIER ERROR FIX: Dummy HTTP Server 🟢
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running safely!');
}).listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// 1. DATABASE GROUP LOGIC
bot.on('message', async (ctx) => {
    if (ctx.chat.id === DATABASE_GROUP_ID) {
        let hasFile = ctx.message.document || ctx.message.video || ctx.message.audio || ctx.message.photo;
        
        if (hasFile) {
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

    // 2. USER CHAT LOGIC
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
