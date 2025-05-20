const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const router = express.Router();

// Function to remove a folder
function removeFile(filePath) {
    if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { recursive: true, force: true });
    }
}

// Auto-clear session folder every 5 minutes
setInterval(() => {
    console.log("Auto-clearing session folder...");
    removeFile('./session');
}, 5 * 60 * 1000); // 5 minutes

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num) return res.status(400).send({ error: 'Missing number query param' });

    async function HansPair() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(`./session`);
            const HansTzInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            HansTzInc.ev.on('creds.update', saveCreds);

            if (!HansTzInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await HansTzInc.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            HansTzInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection === "open") {
                    await delay(10000);

                    const fullCreds = fs.readFileSync('./session/creds.json', 'utf-8');
                    const parsed = JSON.parse(fullCreds);
                    delete parsed.lastPropHash;

                    const formattedCreds = `${JSON.stringify(parsed)}`;

                    HansTzInc.groupAcceptInvite("Kjm8rnDFcpb04gQNSTbW2d");

                    const Hansses = await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: formattedCreds
                    });

                    await HansTzInc.sendMessage(HansTzInc.user.id, {
                        text: `
> Successfully Connected 

> Put On Folder 📁 sessions 

> Then on creds.json 🤞 paste your session code

> BOT REPO FORK 
> https://github.com/Mrhanstz/HANS-XMD_V2/fork

> FOLLOW MY WHATSAPP CHANNEL 
> https://whatsapp.com/channel/0029VasiOoR3bbUw5aV4qB31

> FOLLOW MY GIT
> https://github.com/Mrhanstz`
                    }, { quoted: Hansses });

                    await delay(100);
                    await removeFile('./session');
                    process.exit(0);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode !== 401) {
                    await delay(10000);
                    removeFile('./session');
                    HansPair(); // retry
                }
            });
        } catch (err) {
            console.log("Service restarted due to error");
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await HansPair();
});

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
    console.log('Caught exception: ', err);
});

module.exports = router;