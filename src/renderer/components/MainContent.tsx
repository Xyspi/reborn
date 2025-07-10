import React, { useCallback, useState } from 'react';
import { useAppStore } from '../store/appStore';

export function MainContent() {
  const {
    config,
    updateConfig,
    progress,
    isRunning,
    isPaused,
    startScraping,
    stopScraping,
    pauseScraping,
    resumeScraping,
    urls,
    addUrl,
    removeUrl,
    clearUrls,
  } = useAppStore();

  const [newUrl, setNewUrl] = useState('');

  const handleStart = async () => {
    if (!config.cookies) {
      alert('Please provide cookies in the Authentication section');
      return;
    }

    if (urls.length === 0) {
      alert('Please add at least one URL in the URLs section');
      return;
    }

    if (!config.outputDir) {
      alert('Please select an output directory using the Browse button');
      return;
    }

    try {
      await startScraping();
      console.log('Scraping started successfully');
    } catch (error) {
      alert(`Failed to start scraping: ${error}`);
    }
  };

  const selectOutputDir = async () => {
    if (!window.electronAPI) {
      // Mock for web development
      const mockDir = '/home/user/Downloads/htb-courses';
      updateConfig({ outputDir: mockDir });
      console.log('🔧 Mock directory selected:', mockDir);
      return;
    }
    
    try {
      const dir = await window.electronAPI.file.selectDirectory();
      if (dir) {
        updateConfig({ outputDir: dir });
      }
    } catch (error) {
      console.error('Error selecting directory:', error);
      alert('Error selecting directory');
    }
  };

  const handleAddUrl = () => {
    if (newUrl.trim()) {
      addUrl(newUrl.trim());
      setNewUrl('');
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        if (file.name.endsWith('.json') || file.name.endsWith('.txt')) {
          try {
            const cookies = JSON.parse(content);
            const cookieString = cookies
              .filter((c: any) => c.domain.includes('hackthebox.com'))
              .map((c: any) => `${c.name}=${c.value}`)
              .join('; ');
            updateConfig({ cookies: cookieString });
            alert('Cookies imported successfully');
          } catch {
            updateConfig({ cookies: content });
            alert('Cookie string imported');
          }
        }
      };
      reader.readAsText(file);
    });
  }, [updateConfig]);

  return (
    <div className="main-content">
      <div className="header">
        <h1>HTB Academy Scraper</h1>
        <p>Download courses and sections with modern interface</p>
        
        <div className="controls">
          <button 
            onClick={handleStart} 
            disabled={isRunning}
            className="btn btn-primary"
          >
            Start
          </button>
          {isRunning && (
            <>
              <button 
                onClick={isPaused ? resumeScraping : pauseScraping}
                className="btn btn-secondary"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button 
                onClick={stopScraping}
                className="btn btn-danger"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="progress-section">
          <h3>Progress</h3>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            ></div>
            <span className="progress-text">
              {progress.current}/{progress.total}
            </span>
          </div>
          <p>{progress.filename || progress.url}</p>
          {progress.status === 'error' && (
            <p className="error">Error: {progress.error}</p>
          )}
        </div>
      )}

      {/* Cookie Import */}
      <div className="section">
        <h3>Authentication</h3>
        <div 
          className="dropzone"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <p>Drag & drop cookie file here or paste below</p>
        </div>
        <textarea
          placeholder="htb_academy_session=...; XSRF-TOKEN=..."
          value={config.cookies}
          onChange={(e) => updateConfig({ cookies: e.target.value })}
          rows={3}
          className="form-control"
        />
      </div>

      {/* URL Management */}
      <div className="section">
        <h3>URLs</h3>
        <div className="url-input">
          <input
            type="text"
            placeholder="https://academy.hackthebox.com/..."
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
            className="form-control"
          />
          <button onClick={handleAddUrl} className="btn btn-primary">
            Add
          </button>
          <button onClick={clearUrls} className="btn btn-danger">
            Clear All
          </button>
        </div>
        <div className="url-list">
          {urls.map((url, index) => (
            <div key={index} className="url-item">
              <span>{url}</span>
              <button 
                onClick={() => removeUrl(index)}
                className="btn btn-sm btn-danger"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div className="section">
        <h3>Settings</h3>
        <div className="settings-grid">
          <div className="form-group">
            <label>Output Directory</label>
            <div className="input-group">
              <input
                type="text"
                value={config.outputDir}
                readOnly
                className="form-control"
              />
              <button onClick={selectOutputDir} className="btn btn-secondary">
                Browse
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label>Rate Limit (seconds)</label>
            <input
              type="number"
              value={config.rateLimit}
              onChange={(e) => updateConfig({ rateLimit: parseFloat(e.target.value) || 1 })}
              min="0"
              step="0.1"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Export Formats</label>
            <div className="checkbox-group">
              {['markdown', 'html', 'txt'].map(format => (
                <label key={format} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={config.formats.includes(format)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateConfig({ formats: [...config.formats, format] });
                      } else {
                        updateConfig({ formats: config.formats.filter(f => f !== format) });
                      }
                    }}
                  />
                  {format.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.includeImages}
                onChange={(e) => updateConfig({ includeImages: e.target.checked })}
              />
              Include Images
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}