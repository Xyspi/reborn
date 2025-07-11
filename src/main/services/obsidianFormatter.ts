import TurndownService from 'turndown';
import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface ObsidianFormatterConfig {
  enableCallouts: boolean;
  enableWikilinks: boolean;
  enableCodeBlocks: boolean;
  enableTables: boolean;
  useAdmonitions: boolean; // Use Admonitions plugin syntax instead of native callouts
  debugMode: boolean; // Enable debug logging for HTML analysis
  calloutMapping: {
    [key: string]: string;
  };
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

  public async formatAsObsidian(html: string): Promise<string> {
    if (this.config.debugMode) {
      console.log('\n🚀 === SIMPLE HTML WHITELIST APPROACH ===');
      console.log('📥 Raw HTML received (first 500 chars):', html.substring(0, 500));
      console.log('📏 Total HTML length:', html.length);
    }
    
    try {
      // STEP 1: Extract the main content first using cheerio
      if (this.config.debugMode) {
        console.log('🔍 === EXTRACTING MAIN CONTENT ===');
      }
      const $ = cheerio.load(html);
      
      // HTB Academy specific content selectors
      const mainContent = $('.training-module').first();
      if (mainContent.length === 0) {
        if (this.config.debugMode) {
          console.log('📝 No .training-module found, using full HTML');
        }
        // If no main content found, use the full HTML
      } else {
        if (this.config.debugMode) {
          console.log('🏆 Found .training-module content, extracting...');
        }
        html = mainContent.html() || html;
        if (this.config.debugMode) {
          console.log('📜 Extracted content length:', html.length);
        }
      }
      
      // STEP 2: Clean HTML using whitelist approach
      if (this.config.debugMode) {
        console.log('🔍 === CLEANING HTML WITH WHITELIST ===');
      }
      const cleanedHtml = this.cleanHtmlWithWhitelist(html);
      if (this.config.debugMode) {
        console.log('📜 Cleaned HTML length:', cleanedHtml.length);
      }
      
      // STEP 3: Group logical content sections
      if (this.config.debugMode) {
        console.log('🔍 === GROUPING LOGICAL SECTIONS ===');
      }
      const groupedHtml = this.groupLogicalSections(cleanedHtml);
      if (this.config.debugMode) {
        console.log('📜 Grouped HTML length:', groupedHtml.length);
      }
      
      // STEP 4: Convert to markdown using turndown
      if (this.config.debugMode) {
        console.log('🔍 === CONVERTING TO MARKDOWN ===');
      }
      const markdown = this.turndownService.turndown(groupedHtml);
      if (this.config.debugMode) {
        console.log('🏆 Markdown conversion complete! Final length:', markdown.length);
      }
      
      return markdown.trim();
    } catch (error) {
      console.error('🔥 Simple conversion failed:', error);
      // Fallback to basic turndown
      return this.turndownService.turndown(html);
    }
  }
  
  /**
   * Clean HTML by keeping only whitelisted tags and removing everything else
   */
  private cleanHtmlWithWhitelist(html: string): string {
    const $ = cheerio.load(html);
    
    // Whitelist of allowed HTML tags
    const allowedTags = [
      // Content tags
      'p', 'div', 'span',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Tables
      'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
      // Code
      'pre', 'code',
      // Lists
      'ul', 'ol', 'li',
      // Formatting
      'strong', 'em', 'b', 'i', 'u', 'mark',
      // Links and images
      'a', 'img',
      // Other semantic tags
      'blockquote', 'hr', 'br'
    ];
    
    if (this.config.debugMode) {
      console.log('🔍 Filtering HTML tags...');
    }
    
    // Define tags to completely remove (not just unwrap)
    const tagsToRemove = ['script', 'style', 'nav', 'header', 'footer', 'aside', 'noscript'];
    
    // First, remove unwanted tags completely
    tagsToRemove.forEach(tag => {
      $(tag).remove();
    });
    
    // Then, remove all remaining tags that are not in the whitelist
    $('*').each((_, element) => {
      // Check if element is an Element (not Document, Text, etc.)
      if ('tagName' in element && element.tagName) {
        const tagName = element.tagName.toLowerCase();
        if (!allowedTags.includes(tagName) && !tagsToRemove.includes(tagName)) {
          // Replace the element with its content (unwrap)
          $(element).replaceWith($(element).contents());
        }
      }
    });
    
    // Remove empty elements
    $('*').each((_, element) => {
      const $el = $(element);
      if ($el.is(':empty') && !$el.is('br, hr, img')) {
        $el.remove();
      }
    });
    
    const cleanedHtml = $.html();
    if (this.config.debugMode) {
      console.log('✅ HTML cleaned with whitelist approach');
    }
    
    return cleanedHtml;
  }
  
  /**
   * Group logical sections together and detect HTB Academy patterns
   */
  private groupLogicalSections(html: string): string {
    const $ = cheerio.load(html);
    
    if (this.config.debugMode) {
      console.log('🔍 Looking for HTB Academy content patterns...');
    }
    
    // STEP 1: Detect and wrap Notes (b>Note:</b> patterns)
    this.detectAndWrapNotes($);
    
    // STEP 2: Detect and wrap other callout patterns
    this.detectAndWrapCalloutPatterns($);
    
    // STEP 3: Detect special code with color #9fef00
    this.detectAndWrapSpecialCode($);
    
    // STEP 4: Find patterns: paragraph followed by table (existing logic)
    this.detectAndWrapParagraphTablePatterns($);
    
    // STEP 5: Wrap remaining paragraphs in ad-info by default
    this.wrapRemainingContentInInfo($);
    
    // Add turndown rules for all our custom content groups
    this.addCustomCalloutRules();
    
    const groupedHtml = $.html();
    if (this.config.debugMode) {
      console.log('✅ HTB Academy patterns detected and grouped');
    }
    
    return groupedHtml;
  }
  
  /**
   * Detect <b>Note:</b> patterns and wrap them in ad-note callouts
   */
  private detectAndWrapNotes($: cheerio.CheerioAPI): void {
    if (this.config.debugMode) {
      console.log('🔍 Detecting Note patterns...');
    }
    
    // Look for <b>Note:</b> or <strong>Note:</strong> at the beginning of paragraphs
    $('p').each((_, element) => {
      const $p = $(element);
      const text = $p.text().trim();
      const html = $p.html() || '';
      
      // Check if paragraph starts with Note: in bold
      if (html.match(/^<(b|strong)>\s*Note:\s*<\/(b|strong)>/i)) {
        if (this.config.debugMode) {
          console.log('📝 Found Note pattern:', text.substring(0, 100));
        }
        
        // Wrap in note callout
        const $wrapper = $('<div class="content-group-note"></div>');
        $p.before($wrapper);
        $wrapper.append($p);
      }
    });
  }
  
  /**
   * Detect other callout patterns (Warning, Tip, Important, etc.)
   */
  private detectAndWrapCalloutPatterns($: cheerio.CheerioAPI): void {
    if (this.config.debugMode) {
      console.log('🔍 Detecting other callout patterns...');
    }
    
    const patterns = [
      { regex: /^<(b|strong)>\s*Warning:\s*<\/(b|strong)>/i, type: 'warning' },
      { regex: /^<(b|strong)>\s*Important:\s*<\/(b|strong)>/i, type: 'important' },
      { regex: /^<(b|strong)>\s*Tip:\s*<\/(b|strong)>/i, type: 'tip' },
      { regex: /^<(b|strong)>\s*Example:\s*<\/(b|strong)>/i, type: 'example' },
      { regex: /^<(b|strong)>\s*Exercise:\s*<\/(b|strong)>/i, type: 'example' }
    ];
    
    $('p').each((_, element) => {
      const $p = $(element);
      const html = $p.html() || '';
      
      // Skip if already wrapped
      if ($p.parent().hasClass('content-group-note') || 
          $p.parent().hasClass('content-group-warning') ||
          $p.parent().hasClass('content-group-important') ||
          $p.parent().hasClass('content-group-tip') ||
          $p.parent().hasClass('content-group-example')) {
        return;
      }
      
      for (const pattern of patterns) {
        if (html.match(pattern.regex)) {
          if (this.config.debugMode) {
            console.log(`📝 Found ${pattern.type} pattern:`, $p.text().substring(0, 100));
          }
          
          const $wrapper = $(`<div class="content-group-${pattern.type}"></div>`);
          $p.before($wrapper);
          $wrapper.append($p);
          break;
        }
      }
    });
  }
  
  /**
   * Detect code with special color #9fef00
   */
  private detectAndWrapSpecialCode($: cheerio.CheerioAPI): void {
    if (this.config.debugMode) {
      console.log('🔍 Detecting special colored code...');
    }
    
    $('code').each((_, element) => {
      const $code = $(element);
      const style = $code.attr('style') || '';
      
      // Check for the specific green color
      if (style.includes('#9fef00') || style.includes('color: #9fef00')) {
        if (this.config.debugMode) {
          console.log('💚 Found special green code:', $code.text().substring(0, 50));
        }
        
        // Add a special class to identify this code
        $code.addClass('htb-special-code');
      }
    });
  }
  
  /**
   * Original logic: paragraph followed by table
   */
  private detectAndWrapParagraphTablePatterns($: cheerio.CheerioAPI): void {
    $('p').each((_, element) => {
      const $p = $(element);
      const $nextElement = $p.next();
      
      // Skip if already wrapped
      if ($p.parent().attr('class')?.startsWith('content-group-')) {
        return;
      }
      
      // If next element is a table, group them together
      if ($nextElement.is('table')) {
        if (this.config.debugMode) {
          console.log('🔗 Found paragraph + table pattern, grouping...');
        }
        
        const $wrapper = $('<div class="content-group-note"></div>');
        $p.before($wrapper);
        $wrapper.append($p);
        $wrapper.append($nextElement);
      }
    });
  }
  
  /**
   * Wrap remaining content in ad-info by default
   */
  private wrapRemainingContentInInfo($: cheerio.CheerioAPI): void {
    if (this.config.debugMode) {
      console.log('🔍 Wrapping remaining content in ad-info...');
    }
    
    $('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote').each((_, element) => {
      const $element = $(element);
      
      // Skip if already wrapped in a content group
      if ($element.parent().attr('class')?.startsWith('content-group-')) {
        return;
      }
      
      // Skip empty elements
      if ($element.text().trim().length === 0) {
        return;
      }
      
      if (this.config.debugMode) {
        console.log('📦 Wrapping in ad-info:', $element.text().substring(0, 50));
      }
      
      const $wrapper = $('<div class="content-group-info"></div>');
      $element.before($wrapper);
      $wrapper.append($element);
    });
  }
  
  /**
   * Add turndown rules for all custom callout types
   */
  private addCustomCalloutRules(): void {
    const calloutTypes = ['note', 'warning', 'important', 'tip', 'example', 'info'];
    
    calloutTypes.forEach(type => {
      this.turndownService.addRule(`contentGroup${type}`, {
        filter: function (node: any) {
          return node.classList && node.classList.contains(`content-group-${type}`);
        },
        replacement: (content: string) => {
          if (this.config.useAdmonitions) {
            return `\n\`\`\`ad-${type}\n${content.trim()}\n\`\`\`\n`;
          } else {
            return `\n> [!${type}]\n> ${content.replace(/\n/g, '\n> ')}\n`;
          }
        }
      });
    });
    
    // Special rule for HTB green code
    this.turndownService.addRule('htbSpecialCode', {
      filter: function (node: any) {
        return node.classList && node.classList.contains('htb-special-code');
      },
      replacement: (content: string) => {
        return `\`${content}\`{style="color: #9fef00"}`;
      }
    });
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