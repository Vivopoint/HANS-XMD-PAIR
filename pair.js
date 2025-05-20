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
                    await delay(10000);

                    const fullCreds = fs.readFileSync('./session/creds.json', 'utf-8');
                    const parsed = JSON.parse(fullCreds);
                    delete parsed.lastPropHash;

                    const formattedCreds = JSON.stringify(parsed, null, 2);

                    const Hansses = await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: formattedCreds
                    });

                    await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: `
> Successfully Connected 

> Put On Folder 📁 sessions 

> Then on creds.json 🤞 paste you session code

> BOT REPO FORK 
> https://github.com/Mrhanstz/HANS-XMD_V2/fork

> FOLLOW MY WHATSAPP CHANNEL 
> https://whatsapp.com/channel/0029VasiOoR3bbUw5aV4qB31

> FOLLOW MY GIT
> https://github.com/Mrhanstz`
                    }, { quoted: Hansses });

                    await delay(100);
                    removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    console.log("Reconnecting...");
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

// Error handling
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