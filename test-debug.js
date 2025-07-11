#!/usr/bin/env node

// Mock electron for testing
global.app = {
  getPath: () => '/tmp',
  getVersion: () => '1.0.0'
};

const { ObsidianFormatter } = require('./dist/main/services/obsidianFormatter.js');

// Simulate HTB Academy HTML content
const sampleHtmlContent = `
<div class="module-content">
  <h1>Skills Assessment - Password Attacks</h1>
  
  <div class="alert alert-info">
    <strong>Info:</strong> This is an information box that should be detected.
  </div>
  
  <p>The <strong>Credential Theft Shuffle</strong>, as coined by Sean Metcalf, is a systematic approach...</p>
  
  <div class="warning-box">
    <p>Warning: This is a warning about potential security risks.</p>
  </div>
  
  <div class="exercise">
    <h3>Exercise</h3>
    <p>Complete the following practical exercise to test your understanding.</p>
  </div>
  
  <p>Note: This is a note that should be detected by text pattern matching.</p>
  
  <div class="highlight">
    <p>This is highlighted content that might be important.</p>
  </div>
  
  <p>Regular paragraph content without any special formatting.</p>
  
  <table>
    <tr><th>Host</th><th>IP Address</th></tr>
    <tr><td>DMZ01</td><td>10.129.*.*</td></tr>
    <tr><td>JUMP01</td><td>172.16.119.7</td></tr>
  </table>
</div>
`;

console.log('🧪 Testing HTML Debug System...\n');

// Test with debug enabled
const formatter = new ObsidianFormatter({
  useAdmonitions: true,
  debugMode: true,
  enableCallouts: true
});

console.log('📝 Processing sample HTB Academy content...');
const result = formatter.formatAsObsidian(sampleHtmlContent);

console.log('\n📄 Formatted Markdown Result:');
console.log('='.repeat(50));
console.log(result);
console.log('='.repeat(50));

console.log('\n🔍 Check the debug/ directory for detailed HTML analysis files.');
console.log('💡 The debug system will help us understand HTB Academy\'s HTML structure.');

// Test the analyzeHtmlStructure method directly
console.log('\n🔬 Direct HTML Structure Analysis:');
const debugInfo = formatter.analyzeHtmlStructure(sampleHtmlContent);
console.log('Summary:', debugInfo.summary);
console.log('Potential Callouts Found:', debugInfo.potentialCallouts.length);
console.log('Text Patterns Found:', debugInfo.textPatterns.length);