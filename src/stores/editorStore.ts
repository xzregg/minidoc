import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

export interface EditorOptions {
  fontSize: number;
  showLineNumbers: boolean;
  wordWrap: true; // 固定为 true
  theme: 'light' | 'dark';
  autoSave: boolean;
}

interface EditorState {
  options: EditorOptions;
  isPreviewOnly: boolean;
  savedEditorWidth: string | null; // 保存的编辑区宽度
  isFullscreen: boolean;

  updateOptions: (options: Partial<EditorOptions>) => void;
  togglePreviewOnly: () => void;
  setSavedEditorWidth: (width: string) => void;
  toggleFullscreen: () => void;
  syncWithSettings: () => void;
}

const defaultOptions: EditorOptions = {
  fontSize: 14,
  showLineNumbers: true,
  wordWrap: true, // 固定启用自动换行
  theme: 'light',
  autoSave: true,
};

export const useEditorStore = create<EditorState>((set) => ({
  options: defaultOptions,
  isPreviewOnly: false,
  savedEditorWidth: null,
  isFullscreen: false,

  updateOptions: (newOptions) => {
    set((state) => ({
      options: { ...state.options, ...newOptions },
    }));
  },

  togglePreviewOnly: () => {
    set((state) => ({ isPreviewOnly: !state.isPreviewOnly }));
  },

  setSavedEditorWidth: (width: string) => {
    set({ savedEditorWidth: width });
  },

  toggleFullscreen: () => {
    set((state) => ({ isFullscreen: !state.isFullscreen }));
  },

  syncWithSettings: () => {
    const settings = useSettingsStore.getState().settings;
    console.log('[editorStore] syncWithSettings 读取到 settings:', settings);
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
    console.log('[editorStore] sync 完成后的 options:', useEditorStore.getState().options);
  },
}));
