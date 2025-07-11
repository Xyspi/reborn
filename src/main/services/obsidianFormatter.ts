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
   * Group logical sections together (e.g., paragraph + table = one callout)
   */
  private groupLogicalSections(html: string): string {
    const $ = cheerio.load(html);
    
    if (this.config.debugMode) {
      console.log('🔍 Looking for logical content groups...');
    }
    
    // Find patterns: paragraph followed by table
    $('p').each((_, element) => {
      const $p = $(element);
      const $nextElement = $p.next();
      
      // If next element is a table, group them together
      if ($nextElement.is('table')) {
        if (this.config.debugMode) {
          console.log('🔗 Found paragraph + table pattern, grouping...');
        }
        
        // Create a wrapper div with a special class for callout
        const $wrapper = $('<div class="content-group-note"></div>');
        
        // Move both elements into the wrapper
        $p.before($wrapper);
        $wrapper.append($p);
        $wrapper.append($nextElement);
      }
    });
    
    // Add turndown rule for our custom content groups
    this.turndownService.addRule('contentGroup', {
      filter: function (node: any) {
        return node.classList && node.classList.contains('content-group-note');
      },
      replacement: (content: string) => {
        if (this.config.useAdmonitions) {
          return `\n\`\`\`ad-note\n${content.trim()}\n\`\`\`\n`;
        } else {
          return `\n> [!note]\n> ${content.replace(/\n/g, '\n> ')}\n`;
        }
      }
    });
    
    const groupedHtml = $.html();
    if (this.config.debugMode) {
      console.log('✅ Logical sections grouped');
    }
    
    return groupedHtml;
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