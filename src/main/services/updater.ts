import { EventEmitter } from 'events';
import axios from 'axios';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createHash } from 'crypto';

// Safe electron imports for testing
let app: any;
let shell: any;

try {
  const electron = require('electron');
  app = electron.app;
  shell = electron.shell;
} catch (error) {
  // Mock for testing
  app = (global as any).app || {
    getVersion: () => '1.0.0',
    getPath: () => '/tmp',
    quit: () => {}
  };
  shell = (global as any).shell || {
    openPath: () => Promise.resolve(),
    showItemInFolder: () => Promise.resolve()
  };
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  assets: Array<{
    name: string;
    download_url: string;
    size: number;
    browser_download_url: string;
    content_type?: string;
  }>;
  prerelease: boolean;
  draft: boolean;
}

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  fileSize?: number;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  status: 'checking' | 'downloading' | 'installing' | 'completed' | 'error';
  error?: string;
}

export class UpdaterService extends EventEmitter {
  private readonly repoOwner = 'Xyspi';
  private readonly repoName = 'reborn';
  private readonly githubApiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases`;
  
  private currentVersion: string;
  private isChecking = false;
  private isDownloading = false;

  constructor() {
    super();
    this.currentVersion = app.getVersion();
  }

  /**
   * Check for updates on GitHub
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    if (this.isChecking) {
      throw new Error('Update check already in progress');
    }

    this.isChecking = true;
    this.emit('progress', {
      percent: 0,
      transferred: 0,
      total: 0,
      status: 'checking'
    } as UpdateProgress);

    try {
      console.log('🔍 Checking for updates...');
      console.log('📡 GitHub API URL:', this.githubApiUrl);
      
      const response = await axios.get(this.githubApiUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `${this.repoName}/${this.currentVersion}`
        }
      });

      const releases: GitHubRelease[] = response.data;
      
      // Get the latest non-prerelease, non-draft release
      const latestRelease = releases.find(release => 
        !release.prerelease && !release.draft
      );

      if (!latestRelease) {
        throw new Error('No stable releases found');
      }

      const latestVersion = latestRelease.tag_name.replace(/^v/, '');
      const isUpdateAvailable = this.compareVersions(latestVersion, this.currentVersion) > 0;

      let downloadUrl: string | undefined;
      let fileSize: number | undefined;

      if (isUpdateAvailable) {
        // Find the appropriate asset for current platform
        const platformAsset = this.findPlatformAsset(latestRelease.assets);
        if (platformAsset) {
          downloadUrl = platformAsset.browser_download_url;
          fileSize = platformAsset.size;
        }
      }

      const updateInfo: UpdateInfo = {
        available: isUpdateAvailable,
        currentVersion: this.currentVersion,
        latestVersion,
        releaseNotes: latestRelease.body,
        downloadUrl,
        fileSize
      };

      console.log('✅ Update check completed:', updateInfo);
      this.emit('update-available', updateInfo);
      
      return updateInfo;

    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      
      let errorMessage = 'Unknown error';
      
      // Handle specific error cases
      if ((error as any)?.response?.status === 404) {
        errorMessage = 'Repository not found. The project may not be published yet or the repository name has changed.';
      } else if ((error as any)?.response?.status === 403) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
      } else if ((error as any)?.code === 'ENOTFOUND' || (error as any)?.code === 'ECONNREFUSED') {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      this.emit('progress', {
        percent: 0,
        transferred: 0,
        total: 0,
        status: 'error',
        error: errorMessage
      } as UpdateProgress);
      
      throw new Error(errorMessage);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Download and install update
   */
  async downloadAndInstall(downloadUrl: string): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Download already in progress');
    }

    // Validate download URL
    if (!this.validateDownloadUrl(downloadUrl)) {
      throw new Error('Invalid or unsafe download URL');
    }

    this.isDownloading = true;

    try {
      const tempDir = app.getPath('temp');
      const fileName = downloadUrl.split('/').pop() || 'update';
      const filePath = join(tempDir, fileName);

      console.log('📥 Downloading update from:', downloadUrl);
      console.log('📁 Saving to:', filePath);

      // Download with progress tracking
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        headers: {
          'User-Agent': `${this.repoName}/${this.currentVersion}`
        }
      });

      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;

      // Create write stream
      const writeStream = createWriteStream(filePath);

      // Track download progress
      response.data.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
        
        this.emit('progress', {
          percent,
          transferred: downloadedSize,
          total: totalSize,
          status: 'downloading'
        } as UpdateProgress);
      });

      // Download file
      await pipeline(response.data, writeStream);

      console.log('✅ Download completed');

      // Validate downloaded file
      const isValidFile = await this.validateDownloadedFile(filePath, totalSize);
      if (!isValidFile) {
        throw new Error('Downloaded file validation failed');
      }

      console.log('✅ File validation passed');

      // Calculate file hash for logging
      try {
        const fileHash = await this.calculateFileHash(filePath);
        console.log('📋 File SHA256:', fileHash);
      } catch (error) {
        console.warn('⚠️ Could not calculate file hash:', error);
      }

      // Install update
      this.emit('progress', {
        percent: 100,
        transferred: downloadedSize,
        total: totalSize,
        status: 'installing'
      } as UpdateProgress);

      await this.installUpdate(filePath);

    } catch (error) {
      console.error('❌ Error downloading/installing update:', error);
      this.emit('progress', {
        percent: 0,
        transferred: 0,
        total: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      } as UpdateProgress);
      throw error;
    } finally {
      this.isDownloading = false;
    }
  }

  /**
   * Install the downloaded update
   */
  private async installUpdate(filePath: string): Promise<void> {
    console.log('🔧 Installing update from:', filePath);

    try {
      // On Windows, run the installer
      if (process.platform === 'win32') {
        await shell.openPath(filePath);
        
        // Close current app after a short delay
        setTimeout(() => {
          app.quit();
        }, 2000);
      }
      // On Linux, show the downloaded AppImage
      else if (process.platform === 'linux') {
        await shell.showItemInFolder(filePath);
        
        // You could also make it executable and run it
        // await fs.chmod(filePath, '755');
        // await shell.openPath(filePath);
      }
      // On macOS
      else if (process.platform === 'darwin') {
        await shell.showItemInFolder(filePath);
      }

      this.emit('progress', {
        percent: 100,
        transferred: 0,
        total: 0,
        status: 'completed'
      } as UpdateProgress);

      console.log('✅ Update installation initiated');

    } catch (error) {
      console.error('❌ Error installing update:', error);
      throw error;
    }
  }

  /**
   * Compare two version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(n => parseInt(n, 10));
    const v2Parts = version2.split('.').map(n => parseInt(n, 10));
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * Find the appropriate asset for current platform
   */
  private findPlatformAsset(assets: GitHubRelease['assets']): GitHubRelease['assets'][0] | undefined {
    const platform = process.platform;
    
    for (const asset of assets) {
      const name = asset.name.toLowerCase();
      
      // Look for exact names first, then fallback to extensions
      if (platform === 'win32' && (name === 'reborn.exe' || name.includes('.exe'))) {
        return asset;
      } else if (platform === 'linux' && (name === 'reborn.appimage' || name.includes('.appimage'))) {
        return asset;
      } else if (platform === 'darwin' && (name.includes('.dmg') || name.includes('.zip'))) {
        return asset;
      }
    }
    
    return undefined;
  }

  /**
   * Get current version
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Check if update check is in progress
   */
  isCheckingForUpdates(): boolean {
    return this.isChecking;
  }

  /**
   * Check if download is in progress
   */
  isDownloadingUpdate(): boolean {
    return this.isDownloading;
  }

  /**
   * Validate download URL for security
   */
  private validateDownloadUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Only allow GitHub releases
      if (parsedUrl.hostname !== 'github.com' && parsedUrl.hostname !== 'objects.githubusercontent.com') {
        console.error('Invalid download host:', parsedUrl.hostname);
        return false;
      }
      
      // Check if URL is from the correct repository
      if (parsedUrl.pathname.includes(this.repoOwner) && parsedUrl.pathname.includes(this.repoName)) {
        return true;
      }
      
      console.error('Download URL not from expected repository');
      return false;
    } catch (error) {
      console.error('Invalid download URL:', error);
      return false;
    }
  }

  /**
   * Validate downloaded file
   */
  private async validateDownloadedFile(filePath: string, expectedSize?: number): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      
      // Check file size if provided
      if (expectedSize && stats.size !== expectedSize) {
        console.error(`File size mismatch. Expected: ${expectedSize}, Got: ${stats.size}`);
        return false;
      }
      
      // Check file type based on extension
      const platform = process.platform;
      const fileName = filePath.toLowerCase();
      
      if (platform === 'win32' && !fileName.endsWith('.exe')) {
        console.error('Invalid file type for Windows platform');
        return false;
      }
      
      if (platform === 'linux' && !fileName.endsWith('.appimage')) {
        console.error('Invalid file type for Linux platform');
        return false;
      }
      
      // Basic file integrity check - ensure it's not empty
      if (stats.size === 0) {
        console.error('Downloaded file is empty');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating downloaded file:', error);
      return false;
    }
  }

  /**
   * Calculate file hash for integrity verification
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const hash = createHash('sha256').update(fileBuffer).digest('hex');
      return hash;
    } catch (error) {
      console.error('Error calculating file hash:', error);
      throw error;
    }
  }

  /**
   * Clean up resources to prevent memory leaks
   */
  cleanup(): void {
    console.log('Cleaning up UpdaterService resources...');
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Reset state
    this.isChecking = false;
    this.isDownloading = false;
  }
}

export default UpdaterService;