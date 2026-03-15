const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const { createSaveStore } = require('./electron/save-store');

let saveStore = null;
let introConfigPromise = null;

function getSaveStore() {
    if (!saveStore) {
        saveStore = createSaveStore({ app });
    }
    return saveStore;
}

async function getIntroConfig() {
    if (!introConfigPromise) {
        const moduleUrl = pathToFileURL(path.join(__dirname, 'assets/js/shared/data/intro-config.js')).href;
        introConfigPromise = import(moduleUrl);
    }
    return introConfigPromise;
}

async function resolveStartupTarget() {
    const [{ INTRO_VERSION, INTRO_ROUTE }, save] = await Promise.all([
        getIntroConfig(),
        getSaveStore().load().catch((error) => {
            console.warn('[Electron] Failed to read save before startup:', error);
            return null;
        })
    ]);

    const intro = save && typeof save === 'object' ? save.intro : null;
    const introCompleted = !!(intro && intro.completed === true && Number(intro.version) === Number(INTRO_VERSION));
    return introCompleted ? INTRO_ROUTE.gameFile : INTRO_ROUTE.introFile;
}

async function createWindow() {
    const win = new BrowserWindow({
        width: 1024,
        height: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    if (!app.isPackaged) {
        win.webContents.on('before-input-event', (event, input) => {
            const key = String(input && input.key ? input.key : '').toLowerCase();
            const wantsHardReload = (input && (input.control || input.meta)) && input.shift && key === 'r';
            if (!wantsHardReload) return;
            event.preventDefault();
            win.webContents.reloadIgnoringCache();
        });

        try {
            await win.webContents.session.clearCache();
        } catch (error) {
            console.warn('[Electron] Failed to clear cache before load:', error);
        }

        try {
            await win.webContents.session.clearStorageData({
                storages: ['serviceworkers', 'cachestorage']
            });
        } catch (error) {
            console.warn('[Electron] Failed to clear transient storage before load:', error);
        }
    }

    const startupFile = await resolveStartupTarget();
    await win.loadFile(startupFile, !app.isPackaged
        ? { query: { v: String(Date.now()) } }
        : undefined);
}

app.whenReady().then(async () => {
    getSaveStore();
    await createWindow();

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

ipcMain.handle('save-data', async (_event, data) => {
    try {
        await getSaveStore().save(data);
        return { success: true };
    } catch (error) {
        console.error('Save failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        return await getSaveStore().load();
    } catch (error) {
        console.error('Load failed:', error);
        return null;
    }
});
