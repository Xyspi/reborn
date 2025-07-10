const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building HTB Academy Scraper...');

// Clean previous builds
console.log('🧹 Cleaning previous builds...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
if (fs.existsSync('release')) {
  fs.rmSync('release', { recursive: true, force: true });
}

// Build TypeScript files
console.log('📦 Building TypeScript files...');
try {
  execSync('npx tsc -p tsconfig.main.json', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ TypeScript build failed:', error.message);
  process.exit(1);
}

// Build Vite renderer
console.log('⚡ Building Vite renderer...');
try {
  execSync('npx vite build', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Vite build failed:', error.message);
  process.exit(1);
}

// Build Electron app
console.log('🔧 Building Electron app...');
try {
  const platform = process.platform;
  let buildCommand = 'npx electron-builder';
  
  if (process.argv.includes('--win')) {
    buildCommand += ' --win';
  } else if (process.argv.includes('--mac')) {
    buildCommand += ' --mac';
  } else if (process.argv.includes('--linux')) {
    buildCommand += ' --linux';
  } else {
    // Build for current platform
    if (platform === 'win32') {
      buildCommand += ' --win';
    } else if (platform === 'darwin') {
      buildCommand += ' --mac';
    } else {
      buildCommand += ' --linux';
    }
  }
  
  execSync(buildCommand, { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Electron build failed:', error.message);
  process.exit(1);
}

console.log('✅ Build completed successfully!');
console.log('📁 Built files are in the "release" directory');

// Show build info
const releaseDir = path.join(__dirname, '..', 'release');
if (fs.existsSync(releaseDir)) {
  const files = fs.readdirSync(releaseDir);
  console.log('\n📋 Generated files:');
  files.forEach(file => {
    const filePath = path.join(releaseDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`  • ${file} (${size} MB)`);
  });
}