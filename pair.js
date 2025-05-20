const express = require('express');
const fs = require('fs');
const pino = require("pino");
let router = express.Router();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (fs.existsSync(FilePath)) {
        fs.rmSync(FilePath, { recursive: true, force: true });
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function HansPair(attempt = 1) {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            const HansTzInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!HansTzInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                let code;

                try {
                    code = await HansTzInc.requestPairingCode(num);
                } catch (err) {
                    console.log("Failed to generate pairing code. Retrying...");
                    if (attempt <= 3) {
                        await delay(3000);
                        return HansPair(attempt + 1);
                    } else {
                        if (!res.headersSent) {
                            return res.status(503).send({ code: "Unable to generate pairing code" });
                        }
                        return;
                    }
                }

                if (code && !res.headersSent) {
                    return res.send({ code });
                }
            }

            HansTzInc.ev.on('creds.update', saveCreds);
            HansTzInc.ev.on("connection.update", async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    console.log("Connected successfully to WhatsApp.");

                    await delay(10000); // Ensure session is stable

                    // Read and format session data
                    const fullCreds = fs.readFileSync('./session/creds.json', 'utf-8');
                    const parsed = JSON.parse(fullCreds);
                    delete parsed.lastPropHash;
                    const formattedCreds = JSON.stringify(parsed, null, 2);

                    // Send session creds to self
                    const Hansses = await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: formattedCreds
                    });

                    await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: `
> Successfully Connected ✅

> Save session file: 📁 'sessions/creds.json'

> BOT REPO FORK:
> https://github.com/Mrhanstz/HANS-XMD_V2/fork

> FOLLOW WHATSAPP CHANNEL:
> https://whatsapp.com/channel/0029VasiOoR3bbUw5aV4qB31

> FOLLOW GITHUB:
> https://github.com/Mrhanstz`
                    }, { quoted: Hansses });

                    // Clean session folder AFTER successful login + messages
                    await delay(500);
                    removeFile('./session');
                    console.log("Session folder cleaned. Exiting.");
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log("Connection closed. Reconnecting...");
                    await delay(5000);
                    HansPair();
                }
            });
        } catch (err) {
            console.error("Error in HansPair:", err.message);
            removeFile('./session');
            if (!res.headersSent) {
                return res.status(500).send({ code: "Service Error. Try Again" });
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
    console.log('Caught exception:', err);
});

module.exports = router;