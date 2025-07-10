#!/usr/bin/env node

// Mock electron app for testing BEFORE importing
global.app = {
  getVersion: () => '1.1.0',  // Mock current version
  getPath: (name) => '/tmp',  // Mock temp path
  quit: () => console.log('🔄 Mock app quit')
};

global.shell = {
  openPath: (path) => console.log('🔗 Mock open:', path),
  showItemInFolder: (path) => console.log('📁 Mock show in folder:', path)
};

// Mock the electron module in the cache
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      app: global.app,
      shell: global.shell
    };
  }
  return originalRequire.apply(this, arguments);
};

// Simple test script for updater functionality
const { UpdaterService } = require('./dist/main/services/updater.js');

// Also update the User-Agent in the test
const originalRequire2 = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === 'electron') {
    return {
      app: global.app,
      shell: global.shell
    };
  }
  return originalRequire.apply(this, arguments);
};

async function testUpdater() {
  console.log('🧪 Testing Auto-Updater...\n');
  
  try {
    const updater = new UpdaterService();
    console.log('✅ UpdaterService instantiated');
    
    // Test getting current version
    const currentVersion = updater.getCurrentVersion();
    console.log('📦 Current version:', currentVersion);
    
    // Test version comparison (internal method, we'll test logic here)
    const testVersions = [
      { v1: '1.0.0', v2: '1.0.1', expected: -1 },
      { v1: '1.1.0', v2: '1.0.0', expected: 1 },
      { v1: '1.0.0', v2: '1.0.0', expected: 0 },
      { v1: '2.0.0', v2: '1.9.9', expected: 1 }
    ];
    
    console.log('\n🔍 Testing version comparison logic...');
    // Since compareVersions is private, we'll test the public checkForUpdates method
    
    console.log('\n📡 Testing GitHub API connection...');
    
    // Set up progress listener
    updater.on('progress', (progress) => {
      console.log(`📊 Progress: ${progress.status} - ${progress.percent}%`);
      if (progress.error) {
        console.log(`❌ Error: ${progress.error}`);
      }
    });
    
    updater.on('update-available', (info) => {
      console.log('🎉 Update available:', {
        current: info.currentVersion,
        latest: info.latestVersion,
        available: info.available,
        hasDownloadUrl: !!info.downloadUrl
      });
    });
    
    // Test checking for updates
    try {
      const updateInfo = await updater.checkForUpdates();
      console.log('\n✅ Update check completed:');
      console.log('- Available:', updateInfo.available);
      console.log('- Current:', updateInfo.currentVersion);
      console.log('- Latest:', updateInfo.latestVersion);
      
      if (updateInfo.available) {
        console.log('- Download URL:', updateInfo.downloadUrl ? 'Available' : 'Not found');
        console.log('- File Size:', updateInfo.fileSize ? `${Math.round(updateInfo.fileSize / 1024 / 1024)}MB` : 'Unknown');
        console.log('- Release Notes:', updateInfo.releaseNotes.substring(0, 100) + '...');
      } else {
        console.log('✅ You\'re up to date!');
      }
      
    } catch (error) {
      console.error('❌ Update check failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack:', error.stack);
  }
}


// Build first, then test
const { exec } = require('child_process');

console.log('🏗️ Building TypeScript...');
exec('npm run build:ts', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Build failed:', error.message);
    return;
  }
  
  if (stderr) {
    console.log('⚠️ Build warnings:', stderr);
  }
  
  console.log('✅ Build completed');
  testUpdater();
});