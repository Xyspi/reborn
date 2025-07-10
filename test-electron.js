const { app, BrowserWindow } = require('electron');
const path = require('path');

// Simple test to verify the app loads correctly
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'dist/main/preload.js')
    }
  });

  console.log('🔍 Loading from:', path.join(__dirname, 'dist/renderer/index.html'));
  
  mainWindow.loadFile(path.join(__dirname, 'dist/renderer/index.html'));
  mainWindow.webContents.openDevTools();
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
    
    // Test electronAPI
    mainWindow.webContents.executeJavaScript(`
      if (window.electronAPI) {
        console.log('✅ electronAPI is available');
        console.log('API methods:', Object.keys(window.electronAPI));
      } else {
        console.log('❌ electronAPI is NOT available');
      }
    `);
  });
};

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});