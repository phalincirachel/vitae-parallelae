const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Lazy load path to avoid "app is undefined" issues at startup if any
function getSaveFile() {
    // Version 3: FRESH START
    return path.join(app.getPath('userData'), 'savegame_v3.json');
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    win.loadFile('index.html');
    // win.webContents.openDevTools(); // Optional for debugging
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('save-data', async (event, data) => {
    try {
        const file = getSaveFile();
        fs.writeFileSync(file, JSON.stringify(data));
        return { success: true };
    } catch (error) {
        console.error('Save failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        const file = getSaveFile();
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error('Load failed:', error);
        return null;
    }
});
