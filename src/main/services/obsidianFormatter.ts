import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { join } from 'path';

// Global type for unified callout replacements
declare global {
  var unifiedCalloutReplacements: Map<string, any>;
}

// Unified.js ecosystem imports - using dynamic imports for ESM modules
// import { unified } from 'unified';
// import rehypeParse from 'rehype-parse';
// import rehypeRemark from 'rehype-remark';
// import remarkStringify from 'remark-stringify';
// import rehypeRaw from 'rehype-raw';
// import type { Element, Node } from 'hast';
// import { visit } from 'unist-util-visit';

export interface ObsidianFormatterConfig {
  enableCallouts: boolean;
  enableWikilinks: boolean;
  enableCodeBlocks: boolean;
  enableTables: boolean;
  useAdmonitions: boolean; // Use Admonitions plugin syntax instead of native callouts
  interactiveCallouts: boolean; // Enable interactive callout suggestion system
  debugMode: boolean; // Enable debug logging for HTML analysis
  calloutMapping: {
    [key: string]: string;
  };
}

export interface HtmlDebugInfo {
  totalElements: number;
  potentialCallouts: Array<{
    selector: string;
    count: number;
    examples: Array<{
      classes: string;
      text: string;
      html: string;
    }>;
  }>;
  textPatterns: Array<{
    pattern: string;
    matches: string[];
  }>;
  summary: string;
}

export interface CalloutSuggestion {
  id: string;
  content: string;
  htmlContent: string;
  position: number;
  suggestedTypes: string[];
  confidence: number;
  context: string;
}

export interface CalloutChoice {
  suggestionId: string;
  calloutType: string;
  applied: boolean;
}

export interface ContentSection {
  type: 'abstract' | 'note' | 'example' | 'info' | 'warning' | 'tip' | 'code' | 'table' | 'text';
  content: string;
  language?: string;
  title?: string;
}

export class ObsidianFormatter {
  private config: ObsidianFormatterConfig;
  private turndownService: TurndownService;

  constructor(config: Partial<ObsidianFormatterConfig> = {}) {
    this.config = {
      enableCallouts: true,
      enableWikilinks: true,
      enableCodeBlocks: true,
      enableTables: true,
      useAdmonitions: false, // Default to native callouts
      interactiveCallouts: false, // Default to automatic callouts
      debugMode: false, // Default to no debug
      calloutMapping: {
        'info': 'info',
        'note': 'note',
        'example': 'example',
        'abstract': 'abstract',
        'warning': 'warning',
        'tip': 'tip',
        'important': 'important',
        'summary': 'summary',
        'exercise': 'example',
        'task': 'todo'
      },
      ...config
    };

    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
      linkReferenceStyle: 'full'
    });

    this.setupTurndownRules();
  }

  private setupTurndownRules(): void {
    // Enhanced code block handling
    this.turndownService.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content, node: any) => {
        try {
          const nodeHtml = node.outerHTML || node.innerHTML || content;
          const $ = cheerio.load(nodeHtml);
          const codeElement = $('code').first();
          if (codeElement.length > 0) {
            const language = this.detectLanguage(codeElement.attr('class') || '', codeElement.text());
            const code = codeElement.text() || '';
            return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
          }
        } catch (error) {
          // Fallback to basic content
        }
        return `\n\`\`\`\n${content}\n\`\`\`\n\n`;
      }
    });

    // Enhanced table handling
    this.turndownService.addRule('table', {
      filter: 'table',
      replacement: (content, node: any) => {
        if (!this.config.enableTables) return content;
        
        try {
          const nodeHtml = node.outerHTML || node.innerHTML || content;
          const $ = cheerio.load(nodeHtml);
          const rows = $('tr');
          
          if (rows.length === 0) return content;
          
          let markdown = '\n';
          
          rows.each((index, row) => {
            const cells = $(row).find('td, th');
            const cellContent: string[] = [];
            cells.each((_, cell) => {
              cellContent.push($(cell).text().trim() || '');
            });
            
            markdown += `| ${cellContent.join(' | ')} |\n`;
            
            // Add separator after header row
            if (index === 0) {
              const separator = cellContent.map(() => '---').join(' | ');
              markdown += `| ${separator} |\n`;
            }
          });
          
          return markdown + '\n';
        } catch (error) {
          return content;
        }
      }
    });

    // Image handling for Obsidian wikilinks
    this.turndownService.addRule('image', {
      filter: 'img',
      replacement: (content, node: any) => {
        try {
          const nodeHtml = node.outerHTML || node.innerHTML || content;
          const $ = cheerio.load(nodeHtml);
          const img = $('img').first();
          const src = img.attr('src') || '';
          const alt = img.attr('alt') || '';
          
          if (this.config.enableWikilinks) {
            // Convert to Obsidian wikilink format
            const filename = this.extractFilename(src);
            return `![[${filename}]]`;
          }
          
          return `![${alt}](${src})`;
        } catch (error) {
          return content;
        }
      }
    });
  }

  private detectLanguage(className: string, codeContent?: string): string {
    // Common language detection patterns
    const languagePatterns = [
      { pattern: /language-(\w+)/, index: 1 },
      { pattern: /lang-(\w+)/, index: 1 },
      { pattern: /highlight-(\w+)/, index: 1 },
      { pattern: /(\w+)/, index: 1 }
    ];
    
    for (const { pattern, index } of languagePatterns) {
      const match = className.match(pattern);
      if (match) {
        return match[index];
      }
    }
    
    // Fallback language detection based on content
    if (codeContent) {
      const code = codeContent.toLowerCase();
      
      if (code.includes('#!/bin/bash') || code.includes('#!/bin/sh')) return 'bash';
      if (code.includes('<?php')) return 'php';
      if (code.includes('import ') && code.includes('from ')) return 'python';
      if (code.includes('const ') || code.includes('let ') || code.includes('var ')) return 'javascript';
      if (code.includes('#include') || code.includes('int main')) return 'c';
      if (code.includes('select ') || code.includes('from ')) return 'sql';
    }
    
    return '';
  }

  private extractFilename(url: string): string {
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename.includes('.') ? filename : `${filename}.png`;
  }

  public detectContentType(html: string): ContentSection[] {
    const sections: ContentSection[] = [];
    const $ = cheerio.load(html);
    
    // Create a copy of the DOM to track what we've processed
    const $copy = cheerio.load(html);
    const processedElements = new Set();
    
    // HTB Academy specific patterns - enhanced detection
    const patterns = [
      // HTB Academy specific classes and patterns
      { selector: '.alert-info, .info-box, .note-info, .callout-info, [class*="info"]', type: 'info' as const },
      { selector: '.alert-warning, .warning-box, .note-warning, .callout-warning, [class*="warning"]', type: 'warning' as const },
      { selector: '.alert-example, .example-box, .exercise, .callout-example, [class*="example"], [class*="exercise"]', type: 'example' as const },
      { selector: '.abstract, .summary, .overview, .callout-abstract, [class*="abstract"], [class*="summary"]', type: 'abstract' as const },
      { selector: '.note, .important, .tip, .callout-note, [class*="important"], [class*="note"]', type: 'note' as const },
      
      // Code detection - more specific patterns
      { selector: 'pre code, .highlight, .code-block, .language-*, [class*="lang-"]', type: 'code' as const },
      { selector: 'pre:not(:has(code))', type: 'code' as const },
      
      // Table detection
      { selector: 'table', type: 'table' as const }
    ];
    
    // Text-based detection for HTB Academy content
    const textPatterns = [
      { keywords: ['example:', 'for example', 'exercise:', 'task:', 'practice:'], type: 'example' as const },
      { keywords: ['note:', 'important:', 'remember:', 'tip:', 'hint:'], type: 'note' as const },
      { keywords: ['warning:', 'caution:', 'danger:', 'alert:'], type: 'warning' as const },
      { keywords: ['summary:', 'abstract:', 'overview:', 'conclusion:'], type: 'abstract' as const },
      { keywords: ['info:', 'information:', 'details:'], type: 'info' as const }
    ];
    
    // First, extract special sections and filter out empty ones
    patterns.forEach(({ selector, type }) => {
      const elements = $(selector);
      
      elements.each((_, element) => {
        const content = $(element).html() || '';
        
        // Skip empty content
        if (content.trim().length === 0) {
          return;
        }
        
        const language = type === 'code' ? this.detectLanguage($(element).attr('class') || '', $(element).text()) : undefined;
        
        sections.push({
          type,
          content,
          language,
          title: $(element).attr('title') || $(element).attr('data-title') || undefined
        });
        
        // Remove from copy for remaining content detection
        $copy(element).remove();
      });
    });
    
    // Now process remaining content as general text
    const remainingHtml = $copy.html() || '';
    
    if (remainingHtml.trim().length > 0) {
      // Clean up the remaining HTML (remove empty containers)
      const $remaining = cheerio.load(remainingHtml);
      $remaining('div:empty, span:empty, p:empty').remove();
      const cleanedHtml = $remaining.html() || '';
      
      if (cleanedHtml.trim().length > 0) {
        
        // Detect type of remaining content
        const textContent = $remaining.text().toLowerCase();
        let detectedType: ContentSection['type'] = 'text';
        
        // Check for text patterns in remaining content
        for (const { keywords, type } of textPatterns) {
          if (keywords.some(keyword => textContent.includes(keyword.toLowerCase()))) {
            detectedType = type;
            break;
          }
        }
        
        // Add the remaining content as the first section (main content)
        sections.unshift({
          type: detectedType,
          content: cleanedHtml
        });
      }
    }
    
    // Fallback for completely empty result
    if (sections.length === 0) {
      sections.push({
        type: 'text',
        content: html
      });
    }
    
    return sections;
  }

  public async formatAsObsidian(html: string): Promise<string> {
    console.log('\n🚀 === NEW UNIFIED.JS OBSIDIAN FORMATTING ===');
    console.log('📥 Raw HTML received (first 500 chars):', html.substring(0, 500));
    console.log('📏 Total HTML length:', html.length);
    console.log('🔧 Debug mode enabled:', this.config.debugMode);
    console.log('🎨 Admonitions enabled:', this.config.useAdmonitions);
    
    try {
      // STEP 1: Extract the main content first using cheerio
      console.log('🔍 === EXTRACTING MAIN CONTENT ===');
      const $ = cheerio.load(html);
      
      // HTB Academy specific content selectors
      const mainContent = $('.training-module').first();
      if (mainContent.length === 0) {
        console.log('📝 No .training-module found, using full HTML');
        // If no main content found, use the full HTML
      } else {
        console.log('🏆 Found .training-module content, extracting...');
        html = mainContent.html() || html;
        console.log('📜 Extracted content length:', html.length);
      }
      
      // STEP 2: Now process with unified.js
      console.log('🔍 === PROCESSING WITH UNIFIED.JS ===');
      
      // Dynamic import for ESM modules
      const { unified } = await import('unified');
      const { default: rehypeParse } = await import('rehype-parse');
      const { default: rehypeRemark } = await import('rehype-remark');
      const { default: remarkStringify } = await import('remark-stringify');
      const { default: rehypeRaw } = await import('rehype-raw');
      const { visit } = await import('unist-util-visit');
      
      // Use unified.js pipeline for clean HTML to markdown conversion
      const result = unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeRaw) // Handle raw HTML
        .use(this.createCalloutPlugin(visit)) // Custom plugin for HTB Academy callouts
        .use(rehypeRemark)
        .use(remarkStringify, {
          bullet: '-',
          fences: true,
          incrementListMarker: true,
        })
        .processSync(html);
      
      let markdown = String(result);
      console.log('🏆 Unified.js conversion complete! Final length:', markdown.length);
      
      // STEP 3: Process unified callout markers
      console.log('🔍 === PROCESSING UNIFIED CALLOUT MARKERS ===');
      markdown = this.processUnifiedCalloutMarkers(markdown);
      console.log('🏆 Unified callout markers processed! Final length:', markdown.length);
      
      return markdown.trim();
    } catch (error) {
      console.error('🔥 Unified.js conversion failed:', error);
      // Fallback to old method if unified fails
      return this.formatAsObsidianLegacy(html);
    }
  }
  
  /**
   * Analyze ALL HTML tags in the content to understand structure
   */
  public analyzeHtmlStructure(html: string): HtmlDebugInfo {
    const $ = cheerio.load(html);
    const debugInfo: HtmlDebugInfo = {
      totalElements: $('*').length,
      potentialCallouts: [],
      textPatterns: [],
      summary: ''
    };
    
    // Count ALL tags in the HTML - not just specific ones
    const tagCounts: { [tag: string]: number } = {};
    const tagExamples: { [tag: string]: string[] } = {};
    
    $('*').each((_, element) => {
      // Ensure element has tagName property (is an Element, not Document)
      if (!('tagName' in element)) return;
      
      const tagName = element.tagName.toLowerCase();
      
      // Count occurrences
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      
      // Store examples (max 2 per tag)
      if (!tagExamples[tagName]) {
        tagExamples[tagName] = [];
      }
      
      if (tagExamples[tagName].length < 2) {
        const $el = $(element);
        const text = $el.text().trim();
        const classes = $el.attr('class') || '';
        const id = $el.attr('id') || '';
        
        let example = `<${tagName}`;
        if (classes) example += ` class="${classes}"`;
        if (id) example += ` id="${id}"`;
        example += `> ${text.substring(0, 100)}...`;
        
        tagExamples[tagName].push(example);
      }
    });
    
    // FORCE LOG ALL TAGS - This should be visible!
    console.log('🏷️ ALL HTML Tags Analysis (FORCED):');
    console.log(`🔥 TOTAL UNIQUE TAGS FOUND: ${Object.keys(tagCounts).length}`);
    
    Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a) // Sort by count descending
      .forEach(([tag, count]) => {
        console.log(`  🔥 ${tag}: ${count} elements`);
        tagExamples[tag]?.forEach(example => {
          console.log(`    🔥 Example: ${example}`);
        });
      });
    
    console.log('🔥 END OF HTML TAGS ANALYSIS');
    
    // Analyze important semantic tags specifically
    const importantTags = [
      'code', 'pre', 'blockquote', 'aside', 'details', 'summary',
      'table', 'th', 'td', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'b', 'i', 'mark'
    ];
    
    // Test all possible selectors that might contain callouts
    const testSelectors = [
      // Native HTML semantic tags (most reliable)
      'blockquote', 'aside', 'details', 'summary',
      
      // Bootstrap/common alert patterns
      '.alert', '.alert-info', '.alert-warning', '.alert-danger', '.alert-success',
      '.alert-primary', '.alert-secondary', '.alert-light', '.alert-dark',
      
      // HTB Academy specific patterns (guessing based on common patterns)
      '.note', '.note-info', '.note-warning', '.note-danger', '.note-success',
      '.info', '.info-box', '.info-card', '.info-section',
      '.warning', '.warning-box', '.warning-card', '.warning-section',
      '.example', '.example-box', '.example-card', '.example-section',
      '.exercise', '.exercise-box', '.exercise-card', '.exercise-section',
      '.tip', '.tip-box', '.tip-card', '.tip-section',
      '.important', '.important-box', '.important-card', '.important-section',
      
      // Generic patterns
      '.box', '.card', '.panel', '.section', '.container',
      '.highlight', '.emphasis', '.special', '.callout',
      
      // Attribute-based patterns
      '[class*="info"]', '[class*="warning"]', '[class*="note"]',
      '[class*="alert"]', '[class*="example"]', '[class*="exercise"]',
      '[class*="tip"]', '[class*="important"]', '[class*="highlight"]',
      
      // Role-based patterns
      '[role="alert"]', '[role="note"]', '[role="complementary"]',
      
      // Data attributes
      '[data-type="info"]', '[data-type="warning"]', '[data-type="note"]',
      '[data-callout]', '[data-alert]'
    ];
    
    // FORCE NATIVE HTML TAG ANALYSIS - This should be visible!
    console.log('🔍 Native HTML Tag Analysis (FORCED):');
    const nativeTagAnalysis = ['code', 'pre', 'blockquote', 'aside', 'details', 'summary', 'table', 'th', 'td'];
    nativeTagAnalysis.forEach(tag => {
      const elements = $(tag);
      console.log(`  🔥 ${tag}: ${elements.length} elements found`);
      if (elements.length > 0) {
        elements.each((i, el) => {
          if (i < 2) { // Show first 2 examples
            const $el = $(el);
            const text = $el.text().trim();
            const classes = $el.attr('class') || 'no-class';
            const tagInfo = `${tag}.${classes}`;
            console.log(`    🔥 Example: ${tagInfo} - "${text.substring(0, 80)}..."`);
          }
        });
      }
    });
    console.log('🔥 END OF NATIVE TAGS ANALYSIS');
    
    testSelectors.forEach(selector => {
      try {
        const elements = $(selector);
        if (elements.length > 0) {
          const examples: Array<{ classes: string; text: string; html: string }> = [];
          
          elements.each((i, el) => {
            if (i < 3) { // Limit to first 3 examples
              const $el = $(el);
              const text = $el.text().trim();
              const html = $el.html() || '';
              const classes = $el.attr('class') || '';
              
              if (text.length > 0 && text.length < 300) {
                examples.push({
                  classes,
                  text: text.substring(0, 150),
                  html: html.substring(0, 200)
                });
              }
            }
          });
          
          if (examples.length > 0) {
            debugInfo.potentialCallouts.push({
              selector,
              count: elements.length,
              examples
            });
          }
        }
      } catch (error) {
        // Skip invalid selectors
      }
    });
    
    // Look for text patterns that might indicate callouts
    const textPatterns = [
      { pattern: 'Note:', regex: /\bNote:\s*(.+)/gi },
      { pattern: 'Warning:', regex: /\bWarning:\s*(.+)/gi },
      { pattern: 'Important:', regex: /\bImportant:\s*(.+)/gi },
      { pattern: 'Example:', regex: /\bExample:\s*(.+)/gi },
      { pattern: 'Exercise:', regex: /\bExercise:\s*(.+)/gi },
      { pattern: 'Tip:', regex: /\bTip:\s*(.+)/gi },
      { pattern: 'Alert:', regex: /\bAlert:\s*(.+)/gi },
      { pattern: 'Info:', regex: /\bInfo:\s*(.+)/gi }
    ];
    
    const fullText = $.text();
    textPatterns.forEach(({ pattern, regex }) => {
      const matches = Array.from(fullText.matchAll(regex));
      if (matches.length > 0) {
        debugInfo.textPatterns.push({
          pattern,
          matches: matches.map(m => m[1]?.substring(0, 100) || '').slice(0, 5)
        });
      }
    });
    
    // Generate summary
    const totalCallouts = debugInfo.potentialCallouts.reduce((sum, item) => sum + item.count, 0);
    const totalTextPatterns = debugInfo.textPatterns.reduce((sum, item) => sum + item.matches.length, 0);
    
    debugInfo.summary = `Found ${totalCallouts} potential HTML callouts and ${totalTextPatterns} text patterns in ${debugInfo.totalElements} total elements`;
    
    return debugInfo;
  }
  
  /**
   * Analyze content and generate callout suggestions for interactive mode
   */
  public generateCalloutSuggestions(html: string): CalloutSuggestion[] {
    const $ = cheerio.load(html);
    const suggestions: CalloutSuggestion[] = [];
    
    // Find potential callout candidates
    const candidates = this.findCalloutCandidates($);
    
    candidates.forEach((candidate, index) => {
      const suggestion: CalloutSuggestion = {
        id: `suggestion-${index}`,
        content: candidate.text,
        htmlContent: candidate.html,
        position: candidate.position,
        suggestedTypes: this.suggestCalloutTypes(candidate.text),
        confidence: this.calculateConfidence(candidate.text),
        context: candidate.context
      };
      
      suggestions.push(suggestion);
    });
    
    return suggestions;
  }
  
  /**
   * Apply user-selected callout choices to markdown
   */
  public applyCalloutChoices(markdown: string, choices: CalloutChoice[]): string {
    // Sort choices by position (descending) to avoid position shifts
    const sortedChoices = choices
      .filter(choice => choice.applied)
      .sort((a, b) => b.suggestionId.localeCompare(a.suggestionId));
    
    let result = markdown;
    
    sortedChoices.forEach(choice => {
      const calloutType = this.config.calloutMapping[choice.calloutType] || choice.calloutType;
      
      // Find the corresponding suggestion and replace it with a callout
      // This is a simplified implementation - you'd need more sophisticated text matching
      const calloutContent = this.config.useAdmonitions
        ? `\n\`\`\`ad-${calloutType}\n{CONTENT}\n\`\`\`\n`
        : `\n> [!${calloutType}]\n> {CONTENT}\n`;
      
      // Replace placeholder with actual content
      result = result.replace('{CONTENT}', result);
    });
    
    return result;
  }
  
  private findCalloutCandidates($: cheerio.CheerioAPI): Array<{ text: string; html: string; position: number; context: string }> {
    const candidates: Array<{ text: string; html: string; position: number; context: string }> = [];
    
    // Look for paragraphs and divs that might contain callout-worthy content
    $('p, div').each((index, element) => {
      const $element = $(element);
      const text = $element.text().trim();
      const html = $element.html() || '';
      
      // Skip if too short or likely not a callout
      if (text.length < 10 || text.length > 500) {
        return;
      }
      
      // Look for keywords that suggest this might be a callout
      const calloutIndicators = [
        'note', 'important', 'warning', 'caution', 'tip', 'hint',
        'example', 'exercise', 'task', 'practice', 'remember',
        'attention', 'info', 'information', 'alert', 'danger'
      ];
      
      const hasCalloutIndicator = calloutIndicators.some(indicator => 
        text.toLowerCase().includes(indicator)
      );
      
      // Check for emphasis patterns
      const hasEmphasis = html.includes('<strong>') || html.includes('<em>') || html.includes('<b>');
      
      // Check for list-like structure
      const isList = text.includes('•') || text.includes('-') || text.includes('*');
      
      if (hasCalloutIndicator || hasEmphasis || isList) {
        candidates.push({
          text,
          html,
          position: index,
          context: $element.parent().text().substring(0, 100)
        });
      }
    });
    
    return candidates;
  }
  
  private suggestCalloutTypes(text: string): string[] {
    const lowerText = text.toLowerCase();
    const suggestions: string[] = [];
    
    // Analyze content to suggest appropriate callout types
    if (lowerText.includes('note') || lowerText.includes('important') || lowerText.includes('remember')) {
      suggestions.push('note');
    }
    
    if (lowerText.includes('warning') || lowerText.includes('caution') || lowerText.includes('danger')) {
      suggestions.push('warning');
    }
    
    if (lowerText.includes('example') || lowerText.includes('exercise') || lowerText.includes('practice')) {
      suggestions.push('example');
    }
    
    if (lowerText.includes('info') || lowerText.includes('information') || lowerText.includes('details')) {
      suggestions.push('info');
    }
    
    if (lowerText.includes('tip') || lowerText.includes('hint') || lowerText.includes('suggestion')) {
      suggestions.push('tip');
    }
    
    if (lowerText.includes('summary') || lowerText.includes('conclusion') || lowerText.includes('overview')) {
      suggestions.push('abstract');
    }
    
    // Default suggestions if no specific type detected
    if (suggestions.length === 0) {
      suggestions.push('note', 'info', 'example');
    }
    
    return suggestions;
  }
  
  private calculateConfidence(text: string): number {
    const lowerText = text.toLowerCase();
    let confidence = 0.3; // Base confidence
    
    // Keywords that increase confidence
    const strongIndicators = ['note:', 'warning:', 'important:', 'example:', 'tip:'];
    const mediumIndicators = ['note', 'warning', 'important', 'example', 'tip', 'remember'];
    
    if (strongIndicators.some(indicator => lowerText.includes(indicator))) {
      confidence += 0.4;
    } else if (mediumIndicators.some(indicator => lowerText.includes(indicator))) {
      confidence += 0.2;
    }
    
    // Length affects confidence
    if (text.length > 50 && text.length < 200) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }
  
  /**
   * Save debug information to file for analysis (transparent to user)
   */
  private async saveDebugInfo(debugInfo: HtmlDebugInfo): Promise<void> {
    try {
      // Create debug directory if it doesn't exist
      const debugDir = join(process.cwd(), 'debug');
      await fs.mkdir(debugDir, { recursive: true });
      
      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `htb-debug-${timestamp}.json`;
      const filepath = join(debugDir, filename);
      
      // Save debug info as JSON
      await fs.writeFile(filepath, JSON.stringify(debugInfo, null, 2), 'utf8');
      
      console.log(`📁 Debug info saved to: ${filepath}`);
    } catch (error) {
      console.warn('⚠️ Could not save debug info:', error);
    }
  }
  
  /**
   * Create a unified.js plugin for HTB Academy callouts
   */
  private createCalloutPlugin(visit: any) {
    const config = this.config;
    
    return function calloutPlugin() {
      return function transformer(tree: any) {
        console.log('🔍 === UNIFIED.JS CALLOUT PLUGIN ===');
        
        visit(tree, 'element', (node: any, index: any, parent: any) => {
          const tagName = node.tagName;
          const properties = node.properties || {};
          const className = Array.isArray(properties.className) 
            ? properties.className.join(' ') 
            : String(properties.className || '');
          
          // Detect callout-worthy elements
          let calloutType: string | null = null;
          
          // 1. Code elements (très important pour HTB Academy)
          if (tagName === 'code' || tagName === 'pre') {
            calloutType = 'code';
            console.log(`🔥 Found ${tagName} element - converting to code callout`);
          }
          
          // 2. Tables (convert to info callouts)
          else if (tagName === 'table') {
            calloutType = 'info';
            console.log(`🔥 Found table element - converting to info callout`);
          }
          
          // 3. Semantic HTML elements
          else if (tagName === 'blockquote') {
            calloutType = 'quote';
            console.log(`🔥 Found blockquote element - converting to quote callout`);
          }
          else if (tagName === 'aside') {
            calloutType = 'note';
            console.log(`🔥 Found aside element - converting to note callout`);
          }
          
          // 4. CSS class-based detection
          else if (className && typeof className === 'string') {
            if (className.includes('alert') || className.includes('info')) {
              calloutType = 'info';
              console.log(`🔥 Found alert/info class: ${className}`);
            }
            else if (className.includes('warning') || className.includes('danger')) {
              calloutType = 'warning';
              console.log(`🔥 Found warning/danger class: ${className}`);
            }
            else if (className.includes('example') || className.includes('exercise')) {
              calloutType = 'example';
              console.log(`🔥 Found example/exercise class: ${className}`);
            }
          }
          
          // Transform the element if it's a callout
          if (calloutType && parent && index !== undefined) {
            const mappedType = config.calloutMapping[calloutType] || calloutType;
            
            // Instead of complex AST manipulation, add a special marker
            // that we can easily replace later with proper markdown
            const calloutMarker = `__UNIFIED_CALLOUT_${mappedType.toUpperCase()}_${Math.random().toString(36).substr(2, 9)}__`;
            
            // Store the original node content for later processing
            if (!global.unifiedCalloutReplacements) {
              global.unifiedCalloutReplacements = new Map();
            }
            
            // Convert node to HTML for processing
            const nodeHtml = nodeToHtml(node);
            global.unifiedCalloutReplacements.set(calloutMarker, {
              type: mappedType,
              content: nodeHtml,
              originalNode: node
            });
            
            // Replace the node with a simple text marker
            const textNode = {
              type: 'text',
              value: `\n\n${calloutMarker}\n\n`
            };
            
            if (parent && parent.children && Array.isArray(parent.children) && index !== undefined) {
              parent.children[index] = textNode;
            }
            
            console.log(`🏆 Converted ${tagName} to ${mappedType} callout with marker ${calloutMarker}`);
          }
        });
        
        console.log('🔍 === CALLOUT PLUGIN COMPLETE ===');
      };
    };
    
    // Helper function to convert node to HTML
    function nodeToHtml(node: any): string {
      if (node.type === 'text') {
        return node.value || '';
      }
      
      if (node.type === 'element') {
        const tagName = node.tagName;
        const children = node.children || [];
        const childrenHtml = children.map((child: any) => nodeToHtml(child)).join('');
        
        // Handle void elements
        const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];
        if (voidElements.includes(tagName)) {
          return `<${tagName}>`;
        }
        
        return `<${tagName}>${childrenHtml}</${tagName}>`;
      }
      
      return '';
    }
  }
  
  /**
   * Process unified callout markers and convert them to proper callouts
   */
  private processUnifiedCalloutMarkers(markdown: string): string {
    const replacements = global.unifiedCalloutReplacements;
    if (!replacements || replacements.size === 0) {
      console.log('🔄 No unified callout replacements found');
      return markdown;
    }
    
    console.log(`🔥 Processing ${replacements.size} unified callout markers`);
    
    replacements.forEach((calloutData: any, marker: string) => {
      console.log(`🔥 Processing marker: ${marker}`);
      console.log(`🔥 Callout type: ${calloutData.type}`);
      console.log(`🔥 Content preview: ${calloutData.content.substring(0, 100)}...`);
      
      // Convert the HTML content to markdown first
      const markdownContent = this.turndownService.turndown(calloutData.content);
      console.log(`🔥 Markdown content: ${markdownContent.substring(0, 100)}...`);
      
      // Create the final callout based on configuration
      const finalCallout = this.config.useAdmonitions
        ? `\n\`\`\`ad-${calloutData.type}\n${markdownContent.trim()}\n\`\`\`\n`
        : `\n> [!${calloutData.type}]\n> ${markdownContent.replace(/\n/g, '\n> ')}\n`;
      
      console.log(`🔥 Final callout: ${finalCallout.substring(0, 100)}...`);
      
      // Check if marker exists in markdown
      const markerExists = markdown.includes(marker);
      console.log(`🔥 Marker exists in markdown: ${markerExists}`);
      
      if (markerExists) {
        markdown = markdown.replace(marker, finalCallout);
        console.log(`🔥 Marker replaced successfully`);
      } else {
        console.log(`🔥 ERROR: Marker not found in markdown!`);
      }
    });
    
    // Clear the global replacements for next use
    global.unifiedCalloutReplacements = new Map();
    
    return markdown;
  }

  /**
   * Legacy fallback method using the old approach
   */
  private formatAsObsidianLegacy(html: string): string {
    console.log('🔄 Using legacy fallback method');
    return this.turndownService.turndown(html);
  }
  
  private detectAndReplaceCallouts(html: string): string {
    const $ = cheerio.load(html);
    
    console.log('🔄 Starting callout detection...');
    
    // Simple tag-based patterns - convert common HTML tags to callouts
    const simpleTagPatterns = [
      // Code blocks - très important pour HTB Academy
      { selector: 'pre', type: 'code', description: 'Code blocks' },
      { selector: 'code', type: 'code', description: 'Inline code' },
      
      // Semantic HTML elements 
      { selector: 'blockquote', type: 'quote', description: 'Blockquotes' },
      { selector: 'aside', type: 'note', description: 'Aside content' },
      { selector: 'details', type: 'example', description: 'Details/collapsible' },
      { selector: 'summary', type: 'abstract', description: 'Summary headers' },
      
      // Tables - convertir en callouts si petites
      { selector: 'table', type: 'info', description: 'Tables' },
      
      // Strong emphasis that might be callouts
      { selector: 'strong', type: 'note', description: 'Strong emphasis' },
    ];
    
    // HTB Academy CSS class-based patterns (fallback)
    const cssClassPatterns = [
      // Common alert/info boxes
      { selector: '.alert, .alert-info, .info-box, .note-info', type: 'info', description: 'Alert info boxes' },
      { selector: '.alert-warning, .warning-box, .note-warning', type: 'warning', description: 'Alert warning boxes' },
      { selector: '.alert-danger, .danger-box, .alert-error', type: 'warning', description: 'Alert danger boxes' },
      { selector: '.alert-success, .success-box', type: 'note', description: 'Alert success boxes' },
      
      // Exercise and example boxes
      { selector: '.exercise, .example-box, .practice-box', type: 'example', description: 'Exercise boxes' },
      { selector: '.task, .challenge, .lab', type: 'example', description: 'Task/challenge boxes' },
      
      // Note and tip boxes
      { selector: '.note, .tip, .hint', type: 'note', description: 'Note/tip boxes' },
      { selector: '.important, .highlight', type: 'note', description: 'Important/highlight boxes' },
      
      // Abstract/summary boxes
      { selector: '.summary, .abstract, .overview', type: 'abstract', description: 'Summary/abstract boxes' },
      
      // Generic patterns with class names containing keywords
      { selector: '[class*="info"]', type: 'info', description: 'Generic info classes' },
      { selector: '[class*="warning"]', type: 'warning', description: 'Generic warning classes' },
      { selector: '[class*="danger"]', type: 'warning', description: 'Generic danger classes' },
      { selector: '[class*="error"]', type: 'warning', description: 'Generic error classes' },
      { selector: '[class*="note"]', type: 'note', description: 'Generic note classes' },
      { selector: '[class*="tip"]', type: 'note', description: 'Generic tip classes' },
      { selector: '[class*="example"]', type: 'example', description: 'Generic example classes' },
      { selector: '[class*="exercise"]', type: 'example', description: 'Generic exercise classes' },
      { selector: '[class*="task"]', type: 'example', description: 'Generic task classes' },
      { selector: '[class*="practice"]', type: 'example', description: 'Generic practice classes' },
      { selector: '[class*="summary"]', type: 'abstract', description: 'Generic summary classes' },
      { selector: '[class*="abstract"]', type: 'abstract', description: 'Generic abstract classes' },
    ];
    
    // Combine patterns: native tags first (more reliable), then CSS classes
    const allPatterns = [...simpleTagPatterns, ...cssClassPatterns];
    
    // Process native tag patterns first - add logging for detection
    console.log('📝 Processing tag patterns for callout detection:');
    let totalDetectedElements = 0;
    
    allPatterns.forEach(({ selector, type, description }) => {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`🎯 Found ${elements.length} ${description || selector} elements (type: ${type})`);
        totalDetectedElements += elements.length;
        
        // Show example content for first element
        const firstEl = elements.first();
        if (firstEl.length > 0) {
          const text = firstEl.text().trim();
          const classes = firstEl.attr('class') || 'no-class';
          console.log(`  Example: ${selector} class="${classes}" - "${text.substring(0, 60)}..."`);
        }
      }
      
      // Now process each element
      elements.each((_, element) => {
        const $element = $(element);
        const content = $element.html();
        
        // Skip if empty or already processed
        if (!content || content.trim().length === 0 || $element.hasClass('processed-callout')) {
          return;
        }
        
        // Skip if it's a nested element that's already been processed
        if ($element.closest('.processed-callout').length > 0) {
          return;
        }
        
        const calloutType = this.config.calloutMapping[type] || 'note';
        
        // Create callout marker
        const calloutMarker = `__CALLOUT_${type.toUpperCase()}_${Math.random().toString(36).substr(2, 9)}__`;
        
        // Store the raw HTML content for later processing
        // Replace the element with a marker
        $element.replaceWith(`<div class="callout-placeholder">${calloutMarker}</div>`);
        
        // Store the mapping for later replacement
        if (!this.calloutReplacements) {
          this.calloutReplacements = new Map();
        }
        this.calloutReplacements.set(calloutMarker, { content, type: calloutType });
        console.log(`🔥 STORED CALLOUT: ${calloutMarker} -> ${calloutType}`);
        console.log(`🔥 Content: ${content.substring(0, 100)}...`);
      });
    });
    
    // Now process text-based patterns manually
    this.processTextBasedCallouts($);
    
    // Final logging summary
    console.log(`📊 Total elements processed for callout detection: ${totalDetectedElements}`);
    console.log(`🔄 Callout replacements created: ${this.calloutReplacements.size}`);
    
    return $.html() || html;
  }
  
  // Legacy - kept for backward compatibility
  private calloutReplacements: Map<string, { content: string; type: string }> = new Map();
  
  /**
   * Process text-based callout patterns (strong tags and paragraphs with keywords)
   */
  private processTextBasedCallouts($: cheerio.CheerioAPI): void {
    const textPatterns = [
      { keywords: ['Note:', 'NOTE:'], type: 'note' },
      { keywords: ['Warning:', 'WARNING:'], type: 'warning' },
      { keywords: ['Important:', 'IMPORTANT:'], type: 'note' },
      { keywords: ['Example:', 'EXAMPLE:'], type: 'example' },
      { keywords: ['Exercise:', 'EXERCISE:'], type: 'example' },
      { keywords: ['Tip:', 'TIP:'], type: 'tip' },
      { keywords: ['Info:', 'INFO:'], type: 'info' },
    ];
    
    textPatterns.forEach(({ keywords, type }) => {
      keywords.forEach(keyword => {
        // Find strong tags containing the keyword
        $('strong').each((_, element) => {
          const $element = $(element);
          const text = $element.text().trim();
          
          if (text.includes(keyword) && !$element.hasClass('processed-callout')) {
            // Get the parent paragraph
            const $parent = $element.closest('p');
            if ($parent.length > 0 && !$parent.hasClass('processed-callout')) {
              this.replaceWithCalloutMarker($parent, type);
            }
          }
        });
        
        // Find paragraphs starting with the keyword
        $('p').each((_, element) => {
          const $element = $(element);
          const text = $element.text().trim();
          
          if (text.startsWith(keyword) && !$element.hasClass('processed-callout')) {
            this.replaceWithCalloutMarker($element, type);
          }
        });
      });
    });
  }
  
  /**
   * Replace an element with a callout marker
   */
  private replaceWithCalloutMarker($element: cheerio.Cheerio<any>, type: string): void {
    const content = $element.html();
    if (!content || content.trim().length === 0) return;
    
    const calloutType = this.config.calloutMapping[type] || 'note';
    const calloutMarker = `__CALLOUT_${type.toUpperCase()}_${Math.random().toString(36).substr(2, 9)}__`;
    
    // Replace the element with a marker
    $element.replaceWith(`<div class="callout-placeholder">${calloutMarker}</div>`);
    
    // Store the mapping for later replacement
    if (!this.calloutReplacements) {
      this.calloutReplacements = new Map();
    }
    this.calloutReplacements.set(calloutMarker, { content, type: calloutType });
  }
  
  private replaceCalloutMarkers(markdown: string): string {
    console.log('🔥 REPLACE CALLOUT MARKERS - Starting replacement');
    console.log('🔥 Callout replacements available:', this.calloutReplacements.size);
    console.log('🔥 Markdown length before:', markdown.length);
    
    // Replace all callout markers with their actual callout content
    this.calloutReplacements.forEach((calloutData, marker) => {
      console.log(`🔥 Processing marker: ${marker}`);
      console.log(`🔥 Callout type: ${calloutData.type}`);
      console.log(`🔥 Content preview: ${calloutData.content.substring(0, 100)}...`);
      
      // Convert the HTML content to markdown first
      const markdownContent = this.turndownService.turndown(calloutData.content);
      console.log(`🔥 Markdown content: ${markdownContent.substring(0, 100)}...`);
      
      // Create the final callout
      const finalCallout = this.config.useAdmonitions
        ? `\n\`\`\`ad-${calloutData.type}\n${markdownContent.trim()}\n\`\`\`\n`
        : `\n> [!${calloutData.type}]\n> ${markdownContent.replace(/\n/g, '\n> ')}\n`;
      
      console.log(`🔥 Final callout: ${finalCallout.substring(0, 100)}...`);
      
      // Check if marker exists in markdown
      const markerExists = markdown.includes(marker);
      console.log(`🔥 Marker exists in markdown: ${markerExists}`);
      
      if (markerExists) {
        markdown = markdown.replace(marker, finalCallout);
        console.log(`🔥 Marker replaced successfully`);
      } else {
        console.log(`🔥 ERROR: Marker not found in markdown!`);
      }
    });
    
    console.log('🔥 Markdown length after:', markdown.length);
    
    // Clear the replacements for next use
    this.calloutReplacements.clear();
    
    return markdown;
  }
  
  private enhanceWithCallouts(markdown: string): string {
    // Convert text patterns to callouts
    const patterns = [
      // HTB Academy specific patterns
      { pattern: /^(Note|Important|Tip|Hint):\s*(.+)$/gmi, type: 'note' },
      { pattern: /^(Warning|Caution|Danger|Alert):\s*(.+)$/gmi, type: 'warning' },
      { pattern: /^(Example|Exercise|Task|Practice):\s*(.+)$/gmi, type: 'example' },
      { pattern: /^(Summary|Abstract|Overview|Conclusion):\s*(.+)$/gmi, type: 'abstract' },
      { pattern: /^(Info|Information|Details):\s*(.+)$/gmi, type: 'info' },
      
      // Look for bold/emphasized introductory words
      { pattern: /^\*\*(Note|Important|Tip|Hint)\*\*:\s*(.+)$/gmi, type: 'note' },
      { pattern: /^\*\*(Warning|Caution|Danger|Alert)\*\*:\s*(.+)$/gmi, type: 'warning' },
      { pattern: /^\*\*(Example|Exercise|Task|Practice)\*\*:\s*(.+)$/gmi, type: 'example' },
      { pattern: /^\*\*(Summary|Abstract|Overview|Conclusion)\*\*:\s*(.+)$/gmi, type: 'abstract' },
      { pattern: /^\*\*(Info|Information|Details)\*\*:\s*(.+)$/gmi, type: 'info' },
    ];
    
    // Apply pattern transformations
    patterns.forEach(({ pattern, type }) => {
      markdown = markdown.replace(pattern, (match, label, content) => {
        const calloutType = this.config.calloutMapping[type] || 'note';
        
        if (this.config.useAdmonitions) {
          // Use Admonitions plugin syntax
          return `\n\`\`\`ad-${calloutType}\n${content.trim()}\n\`\`\`\n`;
        } else {
          // Use native Obsidian callout syntax
          return `\n> [!${calloutType}]\n> ${content.trim()}\n`;
        }
      });
    });
    
    // Look for paragraphs that start with common callout words
    const lines = markdown.split('\n');
    const enhancedLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this line starts with a callout keyword
      const calloutMatch = line.match(/^(Note|Important|Tip|Hint|Warning|Caution|Example|Exercise|Info|Summary):\s*(.+)$/i);
      
      if (calloutMatch) {
        const [, keyword, content] = calloutMatch;
        let type = 'note';
        
        if (['warning', 'caution', 'danger', 'alert'].includes(keyword.toLowerCase())) {
          type = 'warning';
        } else if (['example', 'exercise', 'task', 'practice'].includes(keyword.toLowerCase())) {
          type = 'example';
        } else if (['summary', 'abstract', 'overview', 'conclusion'].includes(keyword.toLowerCase())) {
          type = 'abstract';
        } else if (['info', 'information', 'details'].includes(keyword.toLowerCase())) {
          type = 'info';
        }
        
        const calloutType = this.config.calloutMapping[type] || 'note';
        
        if (this.config.useAdmonitions) {
          // Use Admonitions plugin syntax
          enhancedLines.push(`\n\`\`\`ad-${calloutType}\n${content.trim()}\n\`\`\`\n`);
        } else {
          // Use native Obsidian callout syntax
          enhancedLines.push(`\n> [!${calloutType}]\n> ${content.trim()}\n`);
        }
      } else {
        enhancedLines.push(line);
      }
    }
    
    return enhancedLines.join('\n');
  }

  private createCallout(section: ContentSection): string {
    const calloutType = this.config.calloutMapping[section.type] || 'note';
    const content = this.turndownService.turndown(section.content);
    const title = section.title || section.type.charAt(0).toUpperCase() + section.type.slice(1);
    
    return `> [!${calloutType}] ${title}\n> ${content.replace(/\n/g, '\n> ')}`;
  }

  private createCodeBlock(section: ContentSection): string {
    const language = section.language || '';
    const code = section.content.replace(/<[^>]*>/g, ''); // Strip HTML tags
    
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  public formatTitle(title: string): string {
    return `# ${title}`;
  }

  public formatHeaders(content: string): string {
    // Convert existing headers to proper hierarchy
    return content
      .replace(/^###+ /gm, '#### ')
      .replace(/^## /gm, '### ')
      .replace(/^# /gm, '## ');
  }

  public addObsidianMetadata(content: string, metadata: any = {}): string {
    const frontmatter = Object.entries(metadata)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: [${value.join(', ')}]`;
        }
        return `${key}: ${value}`;
      })
      .join('\n');
    
    if (frontmatter) {
      return `---\n${frontmatter}\n---\n\n${content}`;
    }
    
    return content;
  }
}

export default ObsidianFormatter;