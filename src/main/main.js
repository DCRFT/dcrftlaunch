const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('node:path')
const utils = require('../utils.js');
const {dialog} = require('electron');
const {Auth} = require("msmc");
const authManager = new Auth("select_account");

function createWindow() {
    const mainWindow = new BrowserWindow({
        frame: false,
        width: 1250,
        height: 750,
        icon: __dirname + '/../../res/steve.png',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    })

    mainWindow.loadFile(path.join(__dirname, 'index.html')).then();

    ipcMain.on('close-app', () => {
        utils.debug("Closing app via close button");
        app.quit();
    })
    ipcMain.on('devtools', () => {
        mainWindow.webContents.openDevTools()
    })

    ipcMain.handle("select-java", async () => {
        return (await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })).filePaths;
    })

    ipcMain.on('debug', (event, debugText) => {
        console.log(debugText);
    });

    ipcMain.on('toggleLauncher', (event, launcherBehaviour) => {
        switch (launcherBehaviour) {
            case "show":
                mainWindow.show();
                break;
            case "close":
                mainWindow.close();
                break;
            case "hide":
                mainWindow.hide();
                break;
            case "dont-close":
                return;
        }
    });

    ipcMain.handle("mslogin", async () => {
        try {
            const xboxManager = await authManager.launch("raw");
            const token = await xboxManager.getMinecraft();
            return {
                token: token,
                mc: token.mclc()
            };
        } catch (error) {
            utils.debug("Error during mslogin:", error);
            return {error: error};
        }
    });

    // Open the DevTools.
    // mainWindow.webContents.openDevTools()
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})
