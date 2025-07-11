import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Store operations
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },

  // File operations
  file: {
    selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
    selectFile: (filters: any[]) => ipcRenderer.invoke('file:selectFile', filters),
  },

  // Scraper operations
  scraper: {
    start: (config: any) => ipcRenderer.invoke('scraper:start', config),
    stop: () => ipcRenderer.invoke('scraper:stop'),
    pause: () => ipcRenderer.invoke('scraper:pause'),
    resume: () => ipcRenderer.invoke('scraper:resume'),
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('scraper:progress', (_, data) => callback(data));
    },
    onCompleted: (callback: (data: any) => void) => {
      ipcRenderer.on('scraper:completed', (_, data) => callback(data));
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('scraper:error', (_, error) => callback(error));
    },
  },

  // Updater operations
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
    downloadAndInstall: (downloadUrl: string) => ipcRenderer.invoke('updater:downloadAndInstall', downloadUrl),
    getCurrentVersion: () => ipcRenderer.invoke('updater:getCurrentVersion'),
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('updater:progress', (_, data) => callback(data));
    },
    onUpdateAvailable: (callback: (data: any) => void) => {
      ipcRenderer.on('updater:update-available', (_, data) => callback(data));
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;