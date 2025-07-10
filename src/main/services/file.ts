import { promises as fs } from 'fs';
import { join } from 'path';

export class FileService {
  async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      await fs.writeFile(path, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write file ${path}: ${error}`);
    }
  }

  async ensureDir(path: string): Promise<void> {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${path}: ${error}`);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  async parseCookieFile(path: string): Promise<string> {
    const content = await this.readFile(path);
    
    // Try to parse as JSON (Chrome/Edge export format)
    try {
      const cookies = JSON.parse(content);
      return cookies
        .filter((cookie: any) => cookie.domain.includes('hackthebox.com'))
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');
    } catch {
      // Try to parse as Netscape format (Firefox)
      return content
        .split('\n')
        .filter(line => line.includes('hackthebox.com'))
        .map(line => {
          const parts = line.split('\t');
          return `${parts[5]}=${parts[6]}`;
        })
        .join('; ');
    }
  }

  async exportToPDF(htmlContent: string, outputPath: string): Promise<void> {
    // This would require puppeteer or similar for PDF generation
    // For now, just save as HTML
    await this.writeFile(outputPath.replace('.pdf', '.html'), htmlContent);
  }

  async exportToEPUB(content: any[], outputPath: string): Promise<void> {
    // This would require epub-gen or similar library
    // For now, create a structured HTML file
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>HTB Academy Course</title>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Times New Roman', serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        h1 { page-break-before: always; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 2px; }
    </style>
</head>
<body>
    ${content.map(item => `<h1>${item.title}</h1>\n${item.content}`).join('\n\n')}
</body>
</html>`;
    
    await this.writeFile(outputPath.replace('.epub', '.html'), htmlContent);
  }
}