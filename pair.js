const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function HansPair() {
        const { state, saveCreds } = await useMultiFileAuthState(`./session`);
        try {
            let HansTzInc = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: ["Ubuntu", "Chrome", "20.0.04"],
            });

            if (!HansTzInc.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await HansTzInc.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            HansTzInc.ev.on('creds.update', saveCreds);
            HansTzInc.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
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

> Then on creds.json 🤞 paste you session code

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
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    HansPair();
                }
            });
        } catch (err) {
            console.log("service restated");
            await removeFile('./session');
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await HansPair();
});

process.on('uncaughtException', function (err) {
    let e = String(err);
    if (e.includes("conflict")) return;
    if (e.includes("Socket connection timeout")) return;
    if (e.includes("not-authorized")) return;
    if (e.includes("rate-overlimit")) return;
    if (e.includes("Connection Closed")) return;
    if (e.includes("Timed Out")) return;
    if (e.includes("Value not found")) return;
    console.log('Caught exception: ', err);
});

module.exports = router;
