#!/usr/bin/env node

/**
 * Release automation script
 * Automatically increments version, creates tags, and triggers GitHub releases
 */

const fs = require('fs');
const { exec } = require('child_process');
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

function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function incrementVersion(version, type) {
  const v = parseVersion(version);
  
  switch (type) {
    case 'major':
      v.major++;
      v.minor = 0;
      v.patch = 0;
      break;
    case 'minor':
      v.minor++;
      v.patch = 0;
      break;
    case 'patch':
    default:
      v.patch++;
      break;
  }
  
  return formatVersion(v);
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

async function checkGitStatus() {
  try {
    const { stdout } = await execPromise('git status --porcelain');
    if (stdout.trim()) {
      log('⚠️  You have uncommitted changes:', 'yellow');
      log(stdout, 'yellow');
      
      const answer = await askQuestion('Do you want to commit these changes first? (y/n): ');
      if (answer.toLowerCase() === 'y') {
        const message = await askQuestion('Enter commit message: ');
        await execPromise(`git add . && git commit -m "${message}"`);
        log('✅ Changes committed', 'green');
      } else {
        log('❌ Please commit your changes first', 'red');
        process.exit(1);
      }
    }
  } catch (error) {
    log(`❌ Error checking git status: ${error.message}`, 'red');
    process.exit(1);
  }
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

async function createRelease(version, releaseType) {
  try {
    log(`🚀 Creating release v${version}...`, 'blue');
    
    // Check git status
    await checkGitStatus();
    
    // Update package.json version
    await updatePackageVersion(version);
    
    // Commit version bump
    await execPromise(`git add package.json`);
    await execPromise(`git commit -m "Bump version to ${version}"`);
    log(`✅ Committed version bump to ${version}`, 'green');
    
    // Push changes
    await execPromise('git push origin main');
    log('✅ Pushed changes to main branch', 'green');
    
    // Create and push tag
    await execPromise(`git tag v${version}`);
    await execPromise(`git push origin v${version}`);
    log(`✅ Created and pushed tag v${version}`, 'green');
    
    log('🎉 Release process completed!', 'magenta');
    log(`📋 GitHub Actions will now build and create the release automatically`, 'cyan');
    log(`🔗 Check progress at: https://github.com/Xyspi/reborn/actions`, 'cyan');
    log(`📦 Release will be available at: https://github.com/Xyspi/reborn/releases/tag/v${version}`, 'cyan');
    
  } catch (error) {
    log(`❌ Error creating release: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function main() {
  log('🚀 Reborn Release Automation Tool', 'magenta');
  log('=====================================', 'magenta');
  
  // Get current version
  const currentVersion = await getCurrentVersion();
  log(`📦 Current version: ${currentVersion}`, 'blue');
  
  // Show version options
  const patchVersion = incrementVersion(currentVersion, 'patch');
  const minorVersion = incrementVersion(currentVersion, 'minor');
  const majorVersion = incrementVersion(currentVersion, 'major');
  
  log('\nVersion increment options:', 'yellow');
  log(`  1. Patch (${currentVersion} → ${patchVersion}) - Bug fixes`, 'white');
  log(`  2. Minor (${currentVersion} → ${minorVersion}) - New features`, 'white');
  log(`  3. Major (${currentVersion} → ${majorVersion}) - Breaking changes`, 'white');
  log(`  4. Custom version`, 'white');
  log(`  5. Exit`, 'white');
  
  const choice = await askQuestion('\nSelect an option (1-5): ');
  
  let newVersion;
  let releaseType;
  
  switch (choice) {
    case '1':
      newVersion = patchVersion;
      releaseType = 'patch';
      break;
    case '2':
      newVersion = minorVersion;
      releaseType = 'minor';
      break;
    case '3':
      newVersion = majorVersion;
      releaseType = 'major';
      break;
    case '4':
      newVersion = await askQuestion('Enter custom version (e.g., 1.2.3): ');
      releaseType = 'custom';
      break;
    case '5':
      log('👋 Goodbye!', 'cyan');
      process.exit(0);
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
  
  // Confirm release
  log(`\n🎯 About to create release v${newVersion}`, 'yellow');
  log(`📋 This will:`, 'yellow');
  log(`   - Update package.json version to ${newVersion}`, 'white');
  log(`   - Commit the version bump`, 'white');
  log(`   - Push changes to main branch`, 'white');
  log(`   - Create and push tag v${newVersion}`, 'white');
  log(`   - Trigger GitHub Actions to build and release`, 'white');
  
  const confirm = await askQuestion('\nProceed with release? (y/n): ');
  
  if (confirm.toLowerCase() === 'y') {
    await createRelease(newVersion, releaseType);
  } else {
    log('❌ Release cancelled', 'red');
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  log(`❌ Unhandled Rejection at: ${promise}, reason: ${reason}`, 'red');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log(`❌ Uncaught Exception: ${error.message}`, 'red');
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  getCurrentVersion,
  incrementVersion,
  createRelease
};