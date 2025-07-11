#!/usr/bin/env node

// Mock electron for testing
global.app = {
  getPath: () => '/tmp',
  getVersion: () => '1.0.0'
};

const { ObsidianFormatter } = require('./dist/main/services/obsidianFormatter.js');

// Simulate HTB Academy HTML content with native HTML tags
const sampleHtmlContent = `
<div class="module-content">
  <h1>Skills Assessment - Password Attacks</h1>
  
  <!-- Native blockquote (very common for callouts) -->
  <blockquote>
    <p><strong>Info:</strong> This information is presented in a blockquote, which is a native HTML semantic element for highlighting important content.</p>
  </blockquote>
  
  <p>The <strong>Credential Theft Shuffle</strong>, as coined by Sean Metcalf, is a systematic approach...</p>
  
  <!-- Native aside element -->
  <aside>
    <p><strong>Warning:</strong> This warning content is in an aside element, which semantically represents content that is tangentially related to the main content.</p>
  </aside>
  
  <!-- Native details/summary elements -->
  <details>
    <summary>Exercise: Complete this practical exercise</summary>
    <p>This exercise content is in a details/summary element, which is perfect for expandable callouts or examples.</p>
    <p>Try to identify the password policy configuration on the target system.</p>
  </details>
  
  <!-- Strong elements with callout keywords -->
  <p><strong>Note:</strong> This is a note with a strong tag containing the keyword.</p>
  
  <p><strong>Important:</strong> Always validate your findings before proceeding.</p>
  
  <p><strong>Tip:</strong> Use the --verbose flag to get more detailed output.</p>
  
  <!-- Paragraphs starting with callout keywords -->
  <p>Example: Here's how you would run the command in practice.</p>
  
  <p>Exercise: Try this on your own lab environment.</p>
  
  <p>Regular paragraph content without any special formatting.</p>
  
  <!-- Traditional CSS class-based content (fallback) -->
  <div class="alert alert-info">
    <strong>Info:</strong> This is a traditional CSS class-based alert.
  </div>
  
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