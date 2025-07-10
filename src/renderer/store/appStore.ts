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
        
        if (!window.electronAPI) {
          throw new Error('Electron API not available');
        }
        
        set({ isRunning: true, isPaused: false });
        
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