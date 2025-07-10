import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ScrapingConfig {
  cookies: string;
  outputDir: string;
  rateLimit: number;
  formats: string[];
  includeImages: boolean;
  customSelectors?: {
    content: string[];
    cleanup: string[];
  };
}

export interface ScrapingProgress {
  current: number;
  total: number;
  url: string;
  filename: string;
  status: 'downloading' | 'processing' | 'completed' | 'error';
  error?: string;
}

interface AppState {
  // UI State
  sidebarOpened: boolean;
  currentTab: string;
  
  // Scraping State
  config: ScrapingConfig;
  progress: ScrapingProgress;
  isRunning: boolean;
  isPaused: boolean;
  urls: string[];
  
  // Actions
  setSidebarOpened: (opened: boolean) => void;
  setCurrentTab: (tab: string) => void;
  updateConfig: (config: Partial<ScrapingConfig>) => void;
  updateProgress: (progress: Partial<ScrapingProgress>) => void;
  addUrl: (url: string) => void;
  removeUrl: (index: number) => void;
  clearUrls: () => void;
  
  // Scraping Actions
  startScraping: () => Promise<void>;
  stopScraping: () => Promise<void>;
  pauseScraping: () => Promise<void>;
  resumeScraping: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      sidebarOpened: false,
      currentTab: 'scraper',
      
      config: {
        cookies: '',
        outputDir: './output',
        rateLimit: 1.0,
        formats: ['markdown'],
        includeImages: false,
      },
      
      progress: {
        current: 0,
        total: 0,
        url: '',
        filename: '',
        status: 'downloading',
      },
      
      isRunning: false,
      isPaused: false,
      urls: [],
      
      // UI Actions
      setSidebarOpened: (opened) => set({ sidebarOpened: opened }),
      setCurrentTab: (tab) => set({ currentTab: tab }),
      
      // Config Actions
      updateConfig: (newConfig) =>
        set((state) => ({
          config: { ...state.config, ...newConfig },
        })),
      
      updateProgress: (newProgress) =>
        set((state) => ({
          progress: { ...state.progress, ...newProgress },
        })),
      
      // URL Management
      addUrl: (url) =>
        set((state) => ({
          urls: [...state.urls, url],
        })),
      
      removeUrl: (index) =>
        set((state) => ({
          urls: state.urls.filter((_, i) => i !== index),
        })),
      
      clearUrls: () => set({ urls: [] }),
      
      // Scraping Actions
      startScraping: async () => {
        const { config, urls } = get();
        
        if (!config.cookies || urls.length === 0 || !config.outputDir) {
          throw new Error('Missing required configuration');
        }

        set({ isRunning: true, isPaused: false });
        
        if (!window.electronAPI) {
          // Mock for web development
          console.log('🔧 Mock scraping started with config:', { config, urls });
          
          // Simulate progress
          let current = 0;
          const total = urls.length * 5; // Simulate 5 steps per URL
          
          const mockProgress = () => {
            current++;
            set({ 
              progress: { 
                current, 
                total, 
                filename: `mock-file-${current}.md`,
                url: urls[Math.floor(current / 5)] || urls[0],
                status: 'processing'
              } 
            });
            
            if (current >= total) {
              set({ isRunning: false, isPaused: false });
              console.log('🔧 Mock scraping completed');
            } else {
              setTimeout(mockProgress, 1000);
            }
          };
          
          setTimeout(mockProgress, 1000);
          return;
        }
        
        // Set up progress listener
        window.electronAPI.scraper.onProgress((progress: any) => {
          set({ progress });
        });
        
        window.electronAPI.scraper.onCompleted((result: any) => {
          set({ isRunning: false, isPaused: false });
          console.log('Scraping completed:', result);
        });
        
        window.electronAPI.scraper.onError((error: any) => {
          set({ isRunning: false, isPaused: false });
          console.error('Scraping error:', error);
        });
        
        // Start scraping
        await window.electronAPI.scraper.start({
          ...config,
          urls,
        });
      },
      
      stopScraping: async () => {
        if (window.electronAPI) {
          await window.electronAPI.scraper.stop();
        }
        set({ isRunning: false, isPaused: false });
      },
      
      pauseScraping: async () => {
        if (window.electronAPI) {
          await window.electronAPI.scraper.pause();
        }
        set({ isPaused: true });
      },
      
      resumeScraping: async () => {
        if (window.electronAPI) {
          await window.electronAPI.scraper.resume();
        }
        set({ isPaused: false });
      },
    }),
    {
      name: 'htb-scraper-storage',
      partialize: (state) => ({
        config: state.config,
        urls: state.urls,
      }),
    }
  )
);