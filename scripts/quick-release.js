#!/usr/bin/env node

/**
 * Quick Release Script
 * Simple one-command release for patch versions
 */

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

function log(message, color = 'white') {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function incrementPatchVersion(version) {
  const parts = version.split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  return parts.join('.');
}

async function quickRelease() {
  try {
    log('🚀 Quick Release Tool', 'magenta');
    log('====================', 'magenta');
    
    // Get current version
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version;
    const newVersion = incrementPatchVersion(currentVersion);
    
    log(`📦 Current version: ${currentVersion}`, 'blue');
    log(`🎯 New version: ${newVersion}`, 'green');
    
    // Check for uncommitted changes
    const { stdout } = await execPromise('git status --porcelain');
    if (stdout.trim()) {
      log('⚠️  Committing current changes...', 'yellow');
      await execPromise('git add .');
      await execPromise(`git commit -m "Prepare for release v${newVersion}"`);
    }
    
    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    log(`✅ Updated package.json to ${newVersion}`, 'green');
    
    // Commit version bump
    await execPromise('git add package.json');
    await execPromise(`git commit -m "Bump version to ${newVersion}"`);
    log('✅ Committed version bump', 'green');
    
    // Push changes
    await execPromise('git push origin main');
    log('✅ Pushed to main branch', 'green');
    
    // Create and push tag
    await execPromise(`git tag v${newVersion}`);
    await execPromise(`git push origin v${newVersion}`);
    log(`✅ Created and pushed tag v${newVersion}`, 'green');
    
    log('🎉 Quick release completed!', 'magenta');
    log(`🔗 GitHub Actions: https://github.com/Xyspi/reborn/actions`, 'cyan');
    log(`📦 Release: https://github.com/Xyspi/reborn/releases/tag/v${newVersion}`, 'cyan');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

quickRelease();