import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

export interface EditorOptions {
  fontSize: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
  theme: 'light' | 'dark';
  autoSave: boolean;
}

interface EditorState {
  options: EditorOptions;
  isPreviewMode: boolean;
  isFullscreen: boolean;

  updateOptions: (options: Partial<EditorOptions>) => void;
  togglePreview: () => void;
  toggleFullscreen: () => void;
  syncWithSettings: () => void;
}

const defaultOptions: EditorOptions = {
  fontSize: 14,
  showLineNumbers: true,
  wordWrap: false,
  theme: 'light',
  autoSave: true,
};

export const useEditorStore = create<EditorState>((set) => ({
  options: defaultOptions,
  isPreviewMode: false,
  isFullscreen: false,

  updateOptions: (newOptions) => {
    set((state) => ({
      options: { ...state.options, ...newOptions },
    }));
  },

  togglePreview: () => {
    set((state) => ({ isPreviewMode: !state.isPreviewMode }));
  },

  toggleFullscreen: () => {
    set((state) => ({ isFullscreen: !state.isFullscreen }));
  },

  syncWithSettings: () => {
    const settings = useSettingsStore.getState().settings;
    set((state) => ({
      options: {
        ...state.options,
        fontSize: settings.fontSize,
        showLineNumbers: settings.showLineNumbers,
        wordWrap: settings.wordWrap,
        theme: settings.theme === 'auto' ? 'light' : settings.theme,
        autoSave: settings.autoSave,
      },
    }));
  },
}));
