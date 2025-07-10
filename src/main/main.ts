import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import { join } from 'path';
import Store from 'electron-store';
import { ScraperService } from './services/scraper';
import { FileService } from './services/file';
import { UpdaterService } from './services/updater';

// Disable GPU for Windows compatibility
app.disableHardwareAcceleration();

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let scraperService: ScraperService;
let fileService: FileService;
let updaterService: UpdaterService;

const createWindow = () => {
  const preloadPath = join(__dirname, 'preload.js');
  console.log('🔍 Preload path:', preloadPath);
  console.log('🔍 Preload exists:', require('fs').existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 Development mode - Loading from localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the built dist/renderer directory
    const indexPath = join(__dirname, '../renderer/index.html');
    console.log('🟡 Production mode - Loading from:', indexPath);
    console.log('🔍 File exists:', require('fs').existsSync(indexPath));
    console.log('🔍 Current __dirname:', __dirname);
    console.log('🔍 Process cwd:', process.cwd());
    
    mainWindow.loadFile(indexPath).catch(error => {
      console.error('❌ Failed to load index.html:', error);
    });
    
    // Always open DevTools in production for debugging
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Debug resource loading
  mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    console.log('🔍 Resource request:', details.url);
    callback({});
  });

  mainWindow.webContents.session.webRequest.onErrorOccurred((details) => {
    console.error('❌ Resource error:', details.url, details.error);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ Page load failed:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
    
    // Check if electronAPI is available
    mainWindow?.webContents.executeJavaScript('window.electronAPI ? "✅ electronAPI available" : "❌ electronAPI NOT available"')
      .then(result => console.log('🔍 API check:', result))
      .catch(err => console.error('❌ API check failed:', err));
  });
};

app.whenReady().then(() => {
  createWindow();
  
  try {
    scraperService = new ScraperService();
    fileService = new FileService();
    updaterService = new UpdaterService();
    
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

  // Updater operations
  ipcMain.handle('updater:checkForUpdates', async () => {
    return updaterService.checkForUpdates();
  });

  ipcMain.handle('updater:downloadAndInstall', async (_, downloadUrl: string) => {
    return updaterService.downloadAndInstall(downloadUrl);
  });

  ipcMain.handle('updater:getCurrentVersion', () => {
    return updaterService.getCurrentVersion();
  });

  // Updater events
  updaterService.on('progress', (data) => {
    mainWindow?.webContents.send('updater:progress', data);
  });

  updaterService.on('update-available', (data) => {
    mainWindow?.webContents.send('updater:update-available', data);
  });
};