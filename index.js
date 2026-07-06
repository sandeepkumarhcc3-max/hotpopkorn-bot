const { Telegraf, Markup } = require('telegraf');
const http = require('http'); 

const BOT_TOKEN = '8869980874:AAE_MTb64po36ocmbLFdMtxwCPHT4a9UZ7g'; 
const DATABASE_GROUP_ID = -1003927356068; 
const WEBAPP_URL = 'https://hotpopkornbotwebapp.vercel.app'; 

// 📢 Force Join Channels & Links Configuration
const MAIN_CH_ID = "-1003933920647";
const MAIN_CH_LINK = "https://t.me/popkornmovie_1";
const BACKUP_CH_ID = "-1003900661218"; 
const BACKUP_CH_LINK = "https://t.me/+1A7MUa-fD71jNDk1";

// 📁 Aapki backup group ki ID set hai (Jahan logs pin hote hain)
const BACKUP_GROUP_ID = -1004314246888; 

// 👑 ADMIN BYPASS SYSTEM: Aapki numeric Telegram Chat ID add kar di hai
const ADMIN_IDS = [ 5328189325 ]; 

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

// Helper function: User ka channel membership status check karne ke liye (FIXED)
async function checkForceJoin(ctx, userId) {
    // 👑 Rule 1: Admin bypass check
    if (ADMIN_IDS.includes(userId)) {
        return { isSubscribedToBackup: true, isSubscribedToMain: true };
    }

    let isSubscribedToBackup = false;
    let isSubscribedToMain = false;

    const allowedStatuses = ['member', 'administrator', 'creator'];

    // Check Backup Channel
    try {
        const member = await ctx.telegram.getChatMember(BACKUP_CH_ID, userId);
        if (member && allowedStatuses.includes(member.status)) {
            isSubscribedToBackup = true;
        }
    } catch (err) {
        console.error("Error checking backup channel status:", err.message);
    }

    // Check Main Channel
    try {
        const member = await ctx.telegram.getChatMember(MAIN_CH_ID, userId);
        if (member && allowedStatuses.includes(member.status)) {
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
                fileId =
