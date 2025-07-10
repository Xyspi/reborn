import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import Store from 'electron-store';
import { ScraperService } from './services/scraper';
import { FileService } from './services/file';

// Disable GPU for Windows compatibility
app.disableHardwareAcceleration();

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let scraperService: ScraperService;
let fileService: FileService;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

app.whenReady().then(() => {
  createWindow();
  
  try {
    scraperService = new ScraperService();
    fileService = new FileService();
    
    setupIpcHandlers();
  } catch (error) {
    console.error('Failed to initialize services:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(error => {
  console.error('App initialization failed:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const setupIpcHandlers = () => {
  // Settings
  ipcMain.handle('store:get', (_, key: string) => store.get(key));
  ipcMain.handle('store:set', (_, key: string, value: any) => store.set(key, value));
  ipcMain.handle('store:delete', (_, key: string) => store.delete(key));

  // File operations
  ipcMain.handle('file:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    return result.filePaths[0];
  });

  ipcMain.handle('file:selectFile', async (_, filters: any[]) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters,
    });
    return result.filePaths[0];
  });

  // Scraper operations
  ipcMain.handle('scraper:start', async (_, config: any) => {
    return scraperService.startScraping(config);
  });

  ipcMain.handle('scraper:stop', async () => {
    return scraperService.stopScraping();
  });

  ipcMain.handle('scraper:pause', async () => {
    return scraperService.pauseScraping();
  });

  ipcMain.handle('scraper:resume', async () => {
    return scraperService.resumeScraping();
  });

  // Progress updates
  scraperService.on('progress', (data) => {
    mainWindow?.webContents.send('scraper:progress', data);
  });

  scraperService.on('completed', (data) => {
    mainWindow?.webContents.send('scraper:completed', data);
  });

  scraperService.on('error', (error) => {
    mainWindow?.webContents.send('scraper:error', error);
  });
};