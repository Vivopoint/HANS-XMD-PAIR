const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const router = express.Router();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
        console.log(`[CLEANUP] Removed: ${FilePath}`);
    }
}

// AUTO DELETE session folder every 5 minutes
setInterval(() => {
    console.log("[AUTO CLEAN] Cleaning session folder...");
    removeFile('./session');
}, 5 * 60 * 1000); // 5 minutes

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function HansPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            const HansTzInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "info" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "info" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!HansTzInc.authState.creds.registered) {
                while (true) {
                    try {
                        num = num.replace(/[^0-9]/g, '');
                        const code = await HansTzInc.requestPairingCode(num);
                        console.log("[PAIRING] Pairing code generated:", code);
                        if (!res.headersSent) {
                            res.send({ code });
                        }
                        break;
                    } catch (err) {
                        console.log("[PAIRING ERROR] Retrying in 5s:", err.message);
                        await delay(5000);
                    }
                }
            }

            HansTzInc.ev.on('creds.update', saveCreds);
            HansTzInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                console.log("[WHATSAPP] Connection update:", connection);
                if (connection === "open") {
                    console.log("[WHATSAPP] Successfully connected to WhatsApp.");
                    await delay(10000);

                    // Read session credentials and format
                    const fullCreds = fs.readFileSync('./session/creds.json', 'utf-8');
                    const parsed = JSON.parse(fullCreds);
                    delete parsed.lastPropHash;

                    const formattedCreds = JSON.stringify(parsed, null, 2);

                    // Send the credentials to the connected WhatsApp number
                    const Hansses = await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: formattedCreds
                    });

                    // Follow-up instruction message
                    await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: `
> Login Complete ✅

> Save this file as 📁 'sessions/creds.json'

> GitHub Repo:
> https://github.com/Mrhanstz/HANS-XMD_V2

> WhatsApp Channel:
> https://whatsapp.com/channel/0029VasiOoR3bbUw5aV4qB31
                        `
                    }, { quoted: Hansses });
                } else if (connection === "close") {
                    console.log("[WHATSAPP] Connection closed. Retrying...");
                    await delay(3000);
                    HansPair();
                }
            });
        } catch (err) {
            console.error("[FATAL ERROR]", err.message);
            removeFile('./session');
            if (!res.headersSent) {
                res.status(500).send({ code: "Connection failed. Try again later." });
            }
        }
    }

    return HansPair();
});

// Error handler
process.on('uncaughtException', function (err) {
    const e = String(err);
    if (
        e.includes("conflict") ||
        e.includes("Socket connection timeout") ||
        e.includes("not-authorized") ||
        e.includes("rate-overlimit") ||
        e.includes("Connection Closed") ||
        e.includes("Timed Out") ||
        e.includes("Value not found")
    ) return;
    console.log('[UNCAUGHT EXCEPTION]', err);
});

module.exports = router;