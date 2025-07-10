import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
const TurndownService = require('turndown');
import { promises as fs } from 'fs';
import { join } from 'path';
import { ObsidianFormatter, ObsidianFormatterConfig } from './obsidianFormatter';

export interface ScrapingConfig {
  cookies: string;
  urls: string[];
  outputDir: string;
  rateLimit: number;
  formats: string[];
  includeImages: boolean;
  customSelectors?: {
    content: string[];
    cleanup: string[];
  };
  obsidianFormat?: boolean;
  obsidianConfig?: Partial<ObsidianFormatterConfig>;
}

export interface ScrapingProgress {
  current: number;
  total: number;
  url: string;
  filename: string;
  status: 'downloading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export class ScraperService extends EventEmitter {
  private client!: AxiosInstance;
  private turndownService!: any;
  private obsidianFormatter!: ObsidianFormatter;
  private isRunning = false;
  private isPaused = false;
  private currentConfig: ScrapingConfig | null = null;
  private downloadQueue: string[] = [];
  private processedUrls: Set<string> = new Set();

  constructor() {
    super();
    this.setupAxios();
    this.setupTurndown();
    this.setupObsidianFormatter();
  }

  private setupAxios() {
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 429) {
          // Rate limit hit, wait and retry
          return new Promise((resolve) => {
            setTimeout(() => resolve(this.client.request(error.config)), 2000);
          });
        }
        return Promise.reject(error);
      }
    );
  }

  private setupTurndown() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
    });

    this.turndownService.addRule('removeScripts', {
      filter: ['script', 'style', 'nav', 'header', 'footer'],
      replacement: () => '',
    });
  }

  private setupObsidianFormatter() {
    this.obsidianFormatter = new ObsidianFormatter();
  }

  private parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    cookieString.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = value;
      }
    });
    return cookies;
  }

  private async extractUrls(courseUrl: string): Promise<string[]> {
    try {
      const response = await this.client.get(courseUrl);
      const $ = cheerio.load(response.data);
      const urls: string[] = [];

      $('a[href*=\"/module/\"][href*=\"/section/\"]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          const fullUrl = new URL(href, 'https://academy.hackthebox.com').href;
          if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
          }
        }
      });

      return urls;
    } catch (error) {
      throw new Error(`Failed to extract URLs from course: ${error}`);
    }
  }

  private async downloadPage(url: string): Promise<{ title: string; content: string }> {
    const response = await this.client.get(url);
    const $ = cheerio.load(response.data);

    // Extract title
    const title = $('h1').first().text().trim() || url.split('/').pop() || 'untitled';

    // Extract content using configurable selectors
    const contentSelectors = this.currentConfig?.customSelectors?.content || [
      'div.module-content',
      'div.training-module',
      'div.modal-body',
      'article'
    ];

    let contentElement: cheerio.Cheerio<any> | null = null;
    for (const selector of contentSelectors) {
      contentElement = $(selector).first();
      if (contentElement.length > 0) break;
    }

    if (!contentElement || contentElement.length === 0) {
      throw new Error('No content found on page');
    }

    // Clean up unwanted elements
    const cleanupSelectors = this.currentConfig?.customSelectors?.cleanup || [
      '#pwnboxSwitchWarningModal',
      '#solutionsModuleSetting',
      '#statusText',
      '#vpn-switch',
      '.vpnSelector',
      '.pwnbox-select-card',
      '#screen',
      '#questionsDiv',
      '.footer',
      'canvas',
      '.instance-button',
      '.terminateInstanceBtn'
    ];

    cleanupSelectors.forEach(selector => {
      contentElement!.find(selector).remove();
    });

    const htmlContent = contentElement.html() || '';
    
    // Choose formatting based on configuration
    let markdownContent: string;
    if (this.currentConfig?.obsidianFormat) {
      
      // Update ObsidianFormatter configuration if provided
      if (this.currentConfig.obsidianConfig) {
        this.obsidianFormatter = new ObsidianFormatter(this.currentConfig.obsidianConfig);
      }
      
      markdownContent = this.obsidianFormatter.formatAsObsidian(htmlContent);
    } else {
      markdownContent = this.turndownService.turndown(htmlContent);
    }

    return { title, content: markdownContent };
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  }

  private async saveContent(title: string, content: string, outputDir: string, formats: string[]) {
    const filename = this.sanitizeFilename(title);
    
    for (const format of formats) {
      switch (format.toLowerCase()) {
        case 'markdown':
        case 'md':
          let finalContent = content;
          
          // Apply Obsidian-specific formatting if enabled
          if (this.currentConfig?.obsidianFormat) {
            const formattedTitle = this.obsidianFormatter.formatTitle(title);
            finalContent = this.obsidianFormatter.formatHeaders(content);
            
            // Add metadata if available
            const metadata = {
              tags: ['htb-academy', 'cybersecurity'],
              created: new Date().toISOString(),
              source: 'HTB Academy Scraper'
            };
            
            finalContent = this.obsidianFormatter.addObsidianMetadata(
              `${formattedTitle}\n\n${finalContent}`,
              metadata
            );
          } else {
            finalContent = `# ${title}\n\n${content}`;
          }
          
          await fs.writeFile(
            join(outputDir, `${filename}.md`),
            finalContent,
            'utf8'
          );
          break;
        case 'html':
          const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 2px; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    ${content}
</body>
</html>`;
          await fs.writeFile(join(outputDir, `${filename}.html`), htmlContent, 'utf8');
          break;
        case 'txt':
          await fs.writeFile(
            join(outputDir, `${filename}.txt`),
            `${title}\n${'='.repeat(title.length)}\n\n${content}`,
            'utf8'
          );
          break;
      }
    }
  }

  async startScraping(config: ScrapingConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scraping is already running');
    }

    this.currentConfig = config;
    this.isRunning = true;
    this.isPaused = false;
    this.processedUrls.clear();

    // Set up cookies
    const cookies = this.parseCookies(config.cookies);
    this.client.defaults.headers.Cookie = config.cookies;

    // Extract URLs from courses if needed
    this.downloadQueue = [];
    for (const url of config.urls) {
      if (url.includes('/courses/')) {
        const courseUrls = await this.extractUrls(url);
        this.downloadQueue.push(...courseUrls);
      } else {
        this.downloadQueue.push(url);
      }
    }

    // Remove duplicates
    this.downloadQueue = [...new Set(this.downloadQueue)];

    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });

    // Start processing queue
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    const total = this.downloadQueue.length;
    let current = 0;

    for (const url of this.downloadQueue) {
      if (!this.isRunning) break;

      while (this.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      try {
        current++;
        this.emit('progress', {
          current,
          total,
          url,
          filename: '',
          status: 'downloading',
        } as ScrapingProgress);

        const { title, content } = await this.downloadPage(url);
        const filename = this.sanitizeFilename(title);

        this.emit('progress', {
          current,
          total,
          url,
          filename,
          status: 'processing',
        } as ScrapingProgress);

        await this.saveContent(title, content, this.currentConfig!.outputDir, this.currentConfig!.formats);

        this.emit('progress', {
          current,
          total,
          url,
          filename,
          status: 'completed',
        } as ScrapingProgress);

        this.processedUrls.add(url);

        // Rate limiting
        if (this.currentConfig!.rateLimit > 0) {
          await new Promise(resolve => setTimeout(resolve, this.currentConfig!.rateLimit * 1000));
        }

      } catch (error) {
        this.emit('progress', {
          current,
          total,
          url,
          filename: '',
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        } as ScrapingProgress);
      }
    }

    this.isRunning = false;
    this.emit('completed', {
      total: this.processedUrls.size,
      errors: total - this.processedUrls.size,
    });
  }

  async stopScraping(): Promise<void> {
    this.isRunning = false;
    this.isPaused = false;
  }

  async pauseScraping(): Promise<void> {
    this.isPaused = true;
  }

  async resumeScraping(): Promise<void> {
    this.isPaused = false;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      processed: this.processedUrls.size,
      total: this.downloadQueue.length,
    };
  }
}