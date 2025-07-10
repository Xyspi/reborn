#!/usr/bin/env node

// Simple test script for Obsidian formatting
const path = require('path');

// Mock HTML content similar to HTB Academy
const testHtml = `
<div class="module-content">
  <h2>Skills Assessment - Password Attacks</h2>
  <p>Host IP Address <code>DMZ01</code> <code>10.129.*.*</code> <strong>(External)</strong>, <code>172.16.119.13</code> <strong>(Internal)</strong></p>
  
  <div class="alert-info">
    <p>This is an important information box that should become an ad-info callout.</p>
  </div>
  
  <div class="exercise">
    <h3>Exercise</h3>
    <p>This is an exercise section that should become an ad-example callout.</p>
  </div>
  
  <pre><code class="language-bash">#!/bin/bash
echo "This is a code block"
cat /etc/passwd
  </code></pre>
  
  <table>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
    </tr>
    <tr>
      <td>Value 1</td>
      <td>Value 2</td>
    </tr>
  </table>
  
  <p>Regular paragraph content that should be processed normally.</p>
</div>
`;

async function testObsidianFormatting() {
  console.log('🧪 Testing Obsidian Formatting...\n');
  
  try {
    // Import the ObsidianFormatter (we'll need to build first)
    const { ObsidianFormatter } = require('./dist/main/services/obsidianFormatter.js');
    
    console.log('✅ ObsidianFormatter imported successfully');
    
    // Test with default config
    const formatter = new ObsidianFormatter();
    console.log('✅ ObsidianFormatter instantiated');
    
    console.log('\n📝 Input HTML:');
    console.log(testHtml.substring(0, 200) + '...');
    
    console.log('\n🔄 Processing with Obsidian formatting...');
    const result = formatter.formatAsObsidian(testHtml);
    
    console.log('\n📄 Result:');
    console.log('Length:', result.length);
    console.log('Content:');
    console.log(result);
    
    // Test without callouts
    console.log('\n🔄 Testing without callouts...');
    const formatterNoCallouts = new ObsidianFormatter({ enableCallouts: false });
    const resultNoCallouts = formatterNoCallouts.formatAsObsidian(testHtml);
    
    console.log('\n📄 Result without callouts:');
    console.log('Length:', resultNoCallouts.length);
    console.log('Content preview:', resultNoCallouts.substring(0, 300) + '...');
    
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
  testObsidianFormatting();
});