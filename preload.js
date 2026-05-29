const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  readFlights: () => ipcRenderer.invoke('read-flights'),
  saveFlights: (data) => ipcRenderer.invoke('save-flights', data),
});
