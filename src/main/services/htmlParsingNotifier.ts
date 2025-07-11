import { EventEmitter } from 'events';

export interface HtmlParsingProgress {
  isVisible: boolean;
  progress: number;
  stage: 'analyzing' | 'detecting' | 'converting' | 'complete';
  currentUrl?: string;
  potentialCallouts?: number;
  textPatterns?: number;
}

export class HtmlParsingNotifier extends EventEmitter {
  private currentProgress: HtmlParsingProgress = {
    isVisible: false,
    progress: 0,
    stage: 'analyzing',
  };

  public startParsing(url: string): void {
    this.currentProgress = {
      isVisible: true,
      progress: 0,
      stage: 'analyzing',
      currentUrl: url,
    };
    
    this.emit('html-parsing-progress', this.currentProgress);
  }

  public updateProgress(
    progress: number,
    stage: 'analyzing' | 'detecting' | 'converting' | 'complete',
    data?: { potentialCallouts?: number; textPatterns?: number }
  ): void {
    this.currentProgress = {
      ...this.currentProgress,
      progress,
      stage,
      ...data,
    };
    
    this.emit('html-parsing-progress', this.currentProgress);
  }

  public completeParsing(): void {
    this.currentProgress = {
      ...this.currentProgress,
      progress: 100,
      stage: 'complete',
    };
    
    this.emit('html-parsing-progress', this.currentProgress);
    
    // Hide after showing completion
    setTimeout(() => {
      this.currentProgress.isVisible = false;
      this.emit('html-parsing-progress', this.currentProgress);
    }, 1500);
  }

  public hideParsing(): void {
    this.currentProgress.isVisible = false;
    this.emit('html-parsing-progress', this.currentProgress);
  }

  public getCurrentProgress(): HtmlParsingProgress {
    return { ...this.currentProgress };
  }
}

export default HtmlParsingNotifier;