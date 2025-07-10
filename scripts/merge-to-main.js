#!/usr/bin/env node

/**
 * Merge dev to main and create release
 * This script handles the proper workflow for releases
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
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

function log(message, color = 'white') {
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

function askQuestion(question) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function incrementVersion(version, type) {
  const parts = version.split('.').map(Number);
  
  switch (type) {
    case 'major':
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
      break;
    case 'minor':
      parts[1]++;
      parts[2] = 0;
      break;
    case 'patch':
    default:
      parts[2]++;
      break;
  }
  
  return parts.join('.');
}

async function getCurrentVersion() {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    log(`❌ Error reading package.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function updatePackageVersion(newVersion) {
  try {
    const packagePath = path.join(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    log(`✅ Updated package.json to version ${newVersion}`, 'green');
  } catch (error) {
    log(`❌ Error updating package.json: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function main() {
  try {
    log('🚀 Merge Dev to Main - Release Tool', 'magenta');
    log('====================================', 'magenta');
    
    // Check current branch
    const { stdout: currentBranch } = await execPromise('git branch --show-current');
    const branch = currentBranch.trim();
    
    if (branch !== 'dev') {
      log(`⚠️  You are on branch '${branch}'. Switching to dev...`, 'yellow');
      await execPromise('git checkout dev');
    }
    
    // Check for uncommitted changes
    const { stdout: status } = await execPromise('git status --porcelain');
    if (status.trim()) {
      log('⚠️  You have uncommitted changes on dev:', 'yellow');
      log(status, 'yellow');
      
      const answer = await askQuestion('Commit these changes first? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        const message = await askQuestion('Enter commit message: ');
        await execPromise(`git add . && git commit -m "${message}"`);
        log('✅ Changes committed on dev', 'green');
      } else {
        log('❌ Please commit your changes first', 'red');
        process.exit(1);
      }
    }
    
    // Push dev branch
    log('📤 Pushing dev branch...', 'blue');
    await execPromise('git push origin dev');
    log('✅ Dev branch pushed', 'green');
    
    // Get current version and ask for increment
    const currentVersion = await getCurrentVersion();
    log(`📦 Current version: ${currentVersion}`, 'blue');
    
    const patchVersion = incrementVersion(currentVersion, 'patch');
    const minorVersion = incrementVersion(currentVersion, 'minor');
    const majorVersion = incrementVersion(currentVersion, 'major');
    
    log('\nVersion increment options:', 'yellow');
    log(`  1. Patch (${currentVersion} → ${patchVersion}) - Bug fixes`, 'white');
    log(`  2. Minor (${currentVersion} → ${minorVersion}) - New features`, 'white');
    log(`  3. Major (${currentVersion} → ${majorVersion}) - Breaking changes`, 'white');
    log(`  4. Custom version`, 'white');
    
    const choice = await askQuestion('\nSelect version increment (1-4): ');
    
    let newVersion;
    switch (choice) {
      case '1':
        newVersion = patchVersion;
        break;
      case '2':
        newVersion = minorVersion;
        break;
      case '3':
        newVersion = majorVersion;
        break;
      case '4':
        newVersion = await askQuestion('Enter custom version (e.g., 1.2.3): ');
        break;
      default:
        log('❌ Invalid option', 'red');
        process.exit(1);
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
      log('❌ Invalid version format. Use semver format (e.g., 1.2.3)', 'red');
      process.exit(1);
    }
    
    // Update version in package.json
    await updatePackageVersion(newVersion);
    
    // Commit version bump on dev
    await execPromise('git add package.json');
    await execPromise(`git commit -m "Bump version to ${newVersion}"`);
    await execPromise('git push origin dev');
    log('✅ Version bump committed and pushed to dev', 'green');
    
    // Switch to main and pull latest
    log('🔄 Switching to main branch...', 'blue');
    await execPromise('git checkout main');
    await execPromise('git pull origin main');
    log('✅ Main branch updated', 'green');
    
    // Merge dev into main
    log('🔀 Merging dev into main...', 'blue');
    await execPromise('git merge dev --no-ff -m "Merge dev into main for release v' + newVersion + '"');
    log('✅ Dev merged into main', 'green');
    
    // Push main
    log('📤 Pushing main branch...', 'blue');
    await execPromise('git push origin main');
    log('✅ Main branch pushed', 'green');
    
    log('🎉 Release process completed!', 'magenta');
    log('📋 What happens next:', 'cyan');
    log('  1. GitHub Actions will build the release automatically', 'white');
    log('  2. A new tag will be created from the package.json version', 'white');
    log('  3. Release will be published with .exe and .AppImage files', 'white');
    log('  4. Auto-updater will detect the new version', 'white');
    log('', 'white');
    log(`🔗 Check progress: https://github.com/Xyspi/reborn/actions`, 'cyan');
    log(`📦 Release will be: https://github.com/Xyspi/reborn/releases/tag/v${newVersion}`, 'cyan');
    
    // Switch back to dev for continued development
    log('🔄 Switching back to dev for continued development...', 'blue');
    await execPromise('git checkout dev');
    log('✅ Ready for continued development on dev branch', 'green');
    
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();