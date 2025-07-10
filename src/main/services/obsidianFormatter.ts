import TurndownService from 'turndown';
import * as cheerio from 'cheerio';

export interface ObsidianFormatterConfig {
  enableCallouts: boolean;
  enableWikilinks: boolean;
  enableCodeBlocks: boolean;
  enableTables: boolean;
  calloutMapping: {
    [key: string]: string;
  };
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
      calloutMapping: {
        'info': 'ad-info',
        'note': 'ad-note',
        'example': 'ad-example',
        'abstract': 'ad-abstract',
        'warning': 'ad-warning',
        'tip': 'ad-tip',
        'important': 'ad-note',
        'summary': 'ad-abstract',
        'exercise': 'ad-example',
        'task': 'ad-example'
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
    
    patterns.forEach(({ selector, type }) => {
      const elements = $(selector);
      elements.each((_, element) => {
        const content = $(element).html() || '';
        const language = type === 'code' ? this.detectLanguage($(element).attr('class') || '', $(element).text()) : undefined;
        
        sections.push({
          type,
          content,
          language,
          title: $(element).attr('title') || $(element).attr('data-title') || undefined
        });
      });
    });
    
    // Enhanced text-based detection for remaining content
    if (sections.length === 0) {
      const textContent = $.text().toLowerCase();
      const htmlContent = $.html() || '';
      
      let detectedType: ContentSection['type'] = 'text';
      
      // Check for text patterns
      for (const { keywords, type } of textPatterns) {
        if (keywords.some(keyword => textContent.includes(keyword.toLowerCase()))) {
          detectedType = type;
          break;
        }
      }
      
      // Check for structural patterns
      if (detectedType === 'text') {
        // Detect code blocks by content
        if (htmlContent.includes('<pre>') || htmlContent.includes('<code>') || 
            textContent.includes('function ') || textContent.includes('import ') ||
            textContent.includes('#!/bin/') || textContent.includes('SELECT ')) {
          detectedType = 'code';
        }
        // Detect tables
        else if (htmlContent.includes('<table>') || htmlContent.includes('<th>') || htmlContent.includes('<td>')) {
          detectedType = 'table';
        }
        // Detect lists that might be examples
        else if ((htmlContent.includes('<ol>') || htmlContent.includes('<ul>')) && 
                 (textContent.includes('step') || textContent.includes('first') || textContent.includes('next'))) {
          detectedType = 'example';
        }
      }
      
      sections.push({
        type: detectedType,
        content: htmlContent
      });
    }
    
    return sections;
  }

  public formatAsObsidian(html: string): string {
    if (!this.config.enableCallouts) {
      return this.turndownService.turndown(html);
    }
    
    const sections = this.detectContentType(html);
    let markdown = '';
    
    sections.forEach(section => {
      switch (section.type) {
        case 'abstract':
        case 'note':
        case 'example':
        case 'info':
        case 'warning':
        case 'tip':
          markdown += this.createCallout(section);
          break;
        case 'code':
          markdown += this.createCodeBlock(section);
          break;
        case 'table':
          markdown += this.turndownService.turndown(section.content);
          break;
        default:
          markdown += this.turndownService.turndown(section.content);
      }
      markdown += '\n\n';
    });
    
    return markdown.trim();
  }

  private createCallout(section: ContentSection): string {
    const calloutType = this.config.calloutMapping[section.type] || 'ad-note';
    const content = this.turndownService.turndown(section.content);
    const title = section.title || section.type.charAt(0).toUpperCase() + section.type.slice(1);
    
    return `\`\`\`${calloutType}\n${title}\n\n${content}\n\`\`\``;
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
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
    
    if (frontmatter) {
      return `---\n${frontmatter}\n---\n\n${content}`;
    }
    
    return content;
  }
}

export default ObsidianFormatter;