const {ipcRenderer} = require('electron');
const RPC = require("discord-rpc");

let rpc = null;

function debug(text) {
    let debugText = "[LauncherDebug]: " + text;
    console.log(debugText);
    if(ipcRenderer != null) ipcRenderer.send("debug", debugText)
}

function loadRPC() {
    rpc = new RPC.Client({ transport: "ipc"} );
    const clientId = "949374226484314142";
    rpc.on("ready", () => { setRPC("W menu"); });

    rpc.login({
        clientId: clientId
    }).catch(function (r) {
        debug("Couldn't connect to Discord: " + r)
    });
}

function setRPC(state) {
    rpc.setActivity({
        startTimestamp: new Date(),
        state: state,
        largeImageKey: "dcl4it",
        largeImageText: "DragonCraft",
        details: "Launcher Minecraft dla DCRFT.PL",
        buttons: [{label: "DragonCraft", url: "http://dcrft.pl"}, {
            label: "Pobierz launcher!",
            url: "http://dcrft.pl/launcher"
        }]
    }).then(r => function () {})
}

module.exports = {
    debug,
    setRPC,
    loadRPC
};