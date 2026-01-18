const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveGame: (data) => ipcRenderer.invoke('save-data', data),
    loadGame: () => ipcRenderer.invoke('load-data')
});
