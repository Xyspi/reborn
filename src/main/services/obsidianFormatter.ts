import TurndownService from 'turndown';
import * as cheerio from 'cheerio';

export interface ObsidianFormatterConfig {
  enableCallouts: boolean;
  enableWikilinks: boolean;
  enableCodeBlocks: boolean;
  enableTables: boolean;
  useAdmonitions: boolean; // Use Admonitions plugin syntax instead of native callouts
  interactiveCallouts: boolean; // Enable interactive callout suggestion system
  calloutMapping: {
    [key: string]: string;
  };
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

  public formatAsObsidian(html: string): string {
    
    if (!this.config.enableCallouts) {
      const result = this.turndownService.turndown(html);
      return result;
    }
    
    // Check if interactive callouts are enabled
    if (this.config.interactiveCallouts) {
      // For interactive mode, just convert to markdown and return suggestions separately
      const markdown = this.turndownService.turndown(html);
      return markdown.trim();
    }
    
    // Enhanced approach: detect HTML elements first, then convert to markdown
    let processedHtml = this.detectAndReplaceCallouts(html);
    
    // Convert to markdown
    let markdown = this.turndownService.turndown(processedHtml);
    
    // Post-process markdown to add callouts based on text patterns
    markdown = this.enhanceWithCallouts(markdown);
    
    // Replace callout markers with actual callouts
    markdown = this.replaceCalloutMarkers(markdown);
    
    return markdown.trim();
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
  
  private detectAndReplaceCallouts(html: string): string {
    const $ = cheerio.load(html);
    
    // HTB Academy specific callout patterns
    const calloutPatterns = [
      // Common alert/info boxes
      { selector: '.alert, .alert-info, .info-box, .note-info', type: 'info' },
      { selector: '.alert-warning, .warning-box, .note-warning', type: 'warning' },
      { selector: '.alert-danger, .danger-box, .alert-error', type: 'warning' },
      { selector: '.alert-success, .success-box', type: 'note' },
      
      // Exercise and example boxes
      { selector: '.exercise, .example-box, .practice-box', type: 'example' },
      { selector: '.task, .challenge, .lab', type: 'example' },
      
      // Note and tip boxes
      { selector: '.note, .tip, .hint', type: 'note' },
      { selector: '.important, .highlight', type: 'note' },
      
      // Abstract/summary boxes
      { selector: '.summary, .abstract, .overview', type: 'abstract' },
      
      // Generic patterns with class names containing keywords
      { selector: '[class*="info"]', type: 'info' },
      { selector: '[class*="warning"]', type: 'warning' },
      { selector: '[class*="danger"]', type: 'warning' },
      { selector: '[class*="error"]', type: 'warning' },
      { selector: '[class*="note"]', type: 'note' },
      { selector: '[class*="tip"]', type: 'note' },
      { selector: '[class*="example"]', type: 'example' },
      { selector: '[class*="exercise"]', type: 'example' },
      { selector: '[class*="task"]', type: 'example' },
      { selector: '[class*="practice"]', type: 'example' },
      { selector: '[class*="summary"]', type: 'abstract' },
      { selector: '[class*="abstract"]', type: 'abstract' },
    ];
    
    // Process each pattern
    calloutPatterns.forEach(({ selector, type }) => {
      const elements = $(selector);
      
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
      });
    });
    
    return $.html() || html;
  }
  
  private calloutReplacements: Map<string, { content: string; type: string }> = new Map();
  
  private replaceCalloutMarkers(markdown: string): string {
    // Replace all callout markers with their actual callout content
    this.calloutReplacements.forEach((calloutData, marker) => {
      // Convert the HTML content to markdown first
      const markdownContent = this.turndownService.turndown(calloutData.content);
      
      // Create the final callout
      const finalCallout = this.config.useAdmonitions
        ? `\n\`\`\`ad-${calloutData.type}\n${markdownContent.trim()}\n\`\`\`\n`
        : `\n> [!${calloutData.type}]\n> ${markdownContent.replace(/\n/g, '\n> ')}\n`;
      
      markdown = markdown.replace(marker, finalCallout);
    });
    
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