import { create } from 'zustand';
import { useEditorStore } from './editorStore';

export interface Settings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  autoSave: boolean;
  autoSaveInterval: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
}

interface SettingsState {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  toggleTheme: () => void;
}

const defaultSettings: Settings = {
  theme: 'light',
  fontSize: 14,
  autoSave: true,
  autoSaveInterval: 3000,
  showLineNumbers: true,
  wordWrap: false,
};

// 从 localStorage 读取设置
const getInitialSettings = (): Settings => {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const saved = localStorage.getItem('settings');
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load settings from localStorage:', e);
  }
  return defaultSettings;
};

// 应用主题到 DOM
const applyThemeToDom = (theme: Settings['theme']) => {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
};

export const useSettingsStore = create<SettingsState>((set) => {
  const initialSettings = getInitialSettings();
  // 初始化时应用主题
  applyThemeToDom(initialSettings.theme);

  return {
    settings: initialSettings,

    updateSettings: (newSettings) => {
    set((state) => {
      const updatedSettings = { ...state.settings, ...newSettings };

      // 如果主题设置发生变化，更新 DOM 的 class
      if (newSettings.theme && newSettings.theme !== state.settings.theme) {
        applyThemeToDom(newSettings.theme);
      }

      // 持久化设置到本地存储
      localStorage.setItem('settings', JSON.stringify(updatedSettings));

      // 同步到 editorStore
      const editorStore = useEditorStore.getState();
      editorStore.syncWithSettings();

      return {
        settings: updatedSettings,
      };
    });
  },

  toggleTheme: () => {
    set((state) => {
      const themeMap: Record<string, 'light' | 'dark'> = {
        light: 'dark',
        dark: 'light',
      };
      const newTheme = themeMap[state.settings.theme] || 'light';

      // 更新 DOM 的 class
      applyThemeToDom(newTheme);

      // 同步到 editorStore
      const editorStore = useEditorStore.getState();
      editorStore.syncWithSettings();

      // 持久化设置到本地存储
      localStorage.setItem('settings', JSON.stringify({ ...state.settings, theme: newTheme }));

      return {
        settings: { ...state.settings, theme: newTheme },
      };
    });
  },
};
});
