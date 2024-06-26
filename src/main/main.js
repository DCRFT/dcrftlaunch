// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('node:path')
const fs = require('fs');
const utils = require('../utils.js');
const {dialog} = require('electron');

function createWindow() {
    // Create the browser window.
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

    // and load the index.html of the src.
    mainWindow.loadFile(path.join(__dirname, 'index.html'))

    ipcMain.on('close-app', event => {
        utils.debug("Closing app via close button");
        app.quit();
    })
    ipcMain.on('devtools', event => {
        mainWindow.webContents.openDevTools()
    })

    ipcMain.handle("select-java", async (event) => {
        return (await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })).filePaths;
    })

    ipcMain.on('debug', (event, debugText) => {
        console.log(debugText);
    });

    // Open the DevTools.
    mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the src when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your src's specific main process
// code. You can also put them in separate files and require them here.
