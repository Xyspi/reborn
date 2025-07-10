import React, { useState, useEffect } from 'react';

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl?: string;
  fileSize?: number;
}

interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
  status: 'checking' | 'downloading' | 'installing' | 'completed' | 'error';
  error?: string;
}

export function UpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  useEffect(() => {
    // Get current version on component mount
    if (window.electronAPI) {
      window.electronAPI.updater.getCurrentVersion().then(setCurrentVersion);
      
      // Set up event listeners
      window.electronAPI.updater.onProgress(setProgress);
      window.electronAPI.updater.onUpdateAvailable((info: UpdateInfo) => {
        setUpdateInfo(info);
        if (info.available) {
          setShowUpdateDialog(true);
        }
      });
    }
  }, []);

  const checkForUpdates = async () => {
    if (!window.electronAPI) {
      console.warn('Electron API not available');
      return;
    }

    setIsChecking(true);
    setProgress(null);

    try {
      const info = await window.electronAPI.updater.checkForUpdates();
      setUpdateInfo(info);
      
      if (info.available) {
        setShowUpdateDialog(true);
      } else {
        // Show "up to date" message
        setProgress({
          percent: 100,
          transferred: 0,
          total: 0,
          status: 'completed'
        });
        
        // Hide message after 3 seconds
        setTimeout(() => setProgress(null), 3000);
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setProgress({
        percent: 0,
        transferred: 0,
        total: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Update check failed'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const downloadUpdate = async () => {
    if (!updateInfo?.downloadUrl || !window.electronAPI) return;

    try {
      await window.electronAPI.updater.downloadAndInstall(updateInfo.downloadUrl);
    } catch (error) {
      console.error('Update download failed:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatReleaseNotes = (notes: string): string => {
    // Basic markdown parsing for release notes
    return notes
      .replace(/^## (.+)/gm, '<h3>$1</h3>')
      .replace(/^### (.+)/gm, '<h4>$1</h4>')
      .replace(/^\* (.+)/gm, '<li>$1</li>')
      .replace(/^- (.+)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>')
      .replace(/<p><li>/g, '<ul><li>')
      .replace(/<\/li><\/p>/g, '</li></ul>');
  };

  return (
    <div className="update-checker">
      <div className="update-section">
        <h3>Application Updates</h3>
        
        <div className="version-info">
          <div className="current-version">
            <span className="label">Current Version:</span>
            <span className="version">{currentVersion}</span>
          </div>
          
          <button 
            onClick={checkForUpdates} 
            disabled={isChecking || (progress?.status === 'downloading')}
            className="btn btn-secondary"
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>
        </div>

        {/* Progress Display */}
        {progress && (
          <div className="update-progress">
            {progress.status === 'checking' && (
              <div className="progress-info">
                <span>🔍 Checking for updates...</span>
              </div>
            )}
            
            {progress.status === 'downloading' && (
              <div className="progress-info">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress.percent}%` }}
                  ></div>
                  <span className="progress-text">
                    {progress.percent}% - {formatFileSize(progress.transferred)} / {formatFileSize(progress.total)}
                  </span>
                </div>
                <span>📥 Downloading update...</span>
              </div>
            )}
            
            {progress.status === 'installing' && (
              <div className="progress-info">
                <span>🔧 Installing update...</span>
              </div>
            )}
            
            {progress.status === 'completed' && !updateInfo?.available && (
              <div className="progress-info success">
                <span>✅ You're up to date!</span>
              </div>
            )}
            
            {progress.status === 'completed' && updateInfo?.available && (
              <div className="progress-info success">
                <span>✅ Update ready! The application will restart to complete installation.</span>
              </div>
            )}
            
            {progress.status === 'error' && (
              <div className="progress-info error">
                <span>❌ {progress.error}</span>
              </div>
            )}
          </div>
        )}

        {/* Update Available Dialog */}
        {showUpdateDialog && updateInfo?.available && (
          <div className="update-dialog">
            <div className="update-header">
              <h4>🎉 Update Available!</h4>
              <button 
                className="close-btn"
                onClick={() => setShowUpdateDialog(false)}
              >
                ×
              </button>
            </div>
            
            <div className="update-info">
              <div className="version-comparison">
                <span className="current">v{updateInfo.currentVersion}</span>
                <span className="arrow">→</span>
                <span className="latest">v{updateInfo.latestVersion}</span>
              </div>
              
              {updateInfo.fileSize && (
                <div className="download-size">
                  Download size: {formatFileSize(updateInfo.fileSize)}
                </div>
              )}
              
              <div className="release-notes">
                <h5>What's New:</h5>
                <div 
                  className="notes-content"
                  dangerouslySetInnerHTML={{ 
                    __html: formatReleaseNotes(updateInfo.releaseNotes) 
                  }}
                />
              </div>
              
              <div className="update-actions">
                <button 
                  onClick={downloadUpdate}
                  disabled={progress?.status === 'downloading'}
                  className="btn btn-primary"
                >
                  {progress?.status === 'downloading' ? 'Downloading...' : 'Download & Install'}
                </button>
                <button 
                  onClick={() => setShowUpdateDialog(false)}
                  className="btn btn-secondary"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdateChecker;