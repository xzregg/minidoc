import { create } from 'zustand';
import { useToastStore } from '../components/ui/Toast';

export interface File {
  path: string;
  name: string;
  modified: boolean;
  content: string;
}

interface FileState {
  // 🔴 简化：单文件模式
  currentFile: File | null;
  isSaving: boolean;

  // 资源管理器联动状态
  highlightedPath: string | null;
  currentDirectory: string | null;
  refreshVersion: number;

  // 自动保存设置
  autoSaveEnabled: boolean;
  autoSaveInterval: number;

  // 🔴 简化：核心方法
  openFile: (file: File | null) => void;
  updateContent: (content: string) => void;
  saveFile: () => Promise<void>;
  saveFileAs: (newPath: string) => Promise<void>;
  closeCurrentFile: () => void;

  // 资源管理器联动方法
  setHighlightedPath: (path: string | null) => void;
  setCurrentDirectory: (path: string | null) => void;
  revealInExplorer: (filePath: string) => void;
  triggerRefresh: () => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  currentFile: null,
  isSaving: false,
  highlightedPath: null,
  currentDirectory: null,
  refreshVersion: 0,
  autoSaveEnabled: true,
  autoSaveInterval: 30000,

  triggerRefresh: () => {
    set({ refreshVersion: get().refreshVersion + 1 });
  },

  openFile: (file) => {
    if (file) {
      console.log('[fileStore] 打开文件:', file.path, '内容长度:', file.content.length);
    } else {
      console.log('[fileStore] 关闭当前文件');
    }
    set({ currentFile: file });
  },

  closeCurrentFile: () => {
    set({ currentFile: null });
  },

  updateContent: (content) => {
    const { currentFile } = get();
    if (!currentFile) return;

    set({
      currentFile: { ...currentFile, content, modified: true },
    });
  },

  saveFile: async () => {
    const { currentFile } = get();
    if (!currentFile) return;

    const isTauriEnv = typeof window !== 'undefined' &&
      // @ts-expect-error __TAURI_INTERNALS__ is a global injected by Tauri
      typeof window.__TAURI_INTERNALS__ !== 'undefined';

    if (isTauriEnv) {
      try {
        set({ isSaving: true });
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_file', {
          path: currentFile.path,
          content: currentFile.content,
        });
        set({
          currentFile: { ...currentFile, modified: false },
          isSaving: false,
        });
        useToastStore.getState().addToast({
          type: 'success',
          message: `文件已保存: ${currentFile.name}`,
        });
      } catch (err) {
        set({ isSaving: false });
        const errorMessage = err instanceof Error ? err.message : String(err);
        useToastStore.getState().addToast({
          type: 'error',
          message: `保存失败: ${errorMessage}`,
        });
      }
    }
  },

  setHighlightedPath: (path) => {
    set({ highlightedPath: path });
  },

  setCurrentDirectory: (path) => {
    set({ currentDirectory: path });
  },

  revealInExplorer: (filePath) => {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    set({ currentDirectory: dir, highlightedPath: filePath });
  },

  saveFileAs: async (newPath) => {
    const { currentFile } = get();
    if (!currentFile) return;

    const isTauriEnv = typeof window !== 'undefined' &&
      // @ts-expect-error
      typeof window.__TAURI_INTERNALS__ !== 'undefined';

    if (isTauriEnv) {
      try {
        set({ isSaving: true });
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('write_file', {
          path: newPath,
          content: currentFile.content,
        });
        const newFile = {
          ...currentFile,
          path: newPath,
          name: newPath.split('/').pop() || currentFile.name,
          modified: false,
        };
        set({ currentFile: newFile, isSaving: false });
        useToastStore.getState().addToast({
          type: 'success',
          message: `文件已保存: ${newFile.name}`,
        });
      } catch (err) {
        set({ isSaving: false });
        const errorMessage = err instanceof Error ? err.message : String(err);
        useToastStore.getState().addToast({
          type: 'error',
          message: `另存为失败: ${errorMessage}`,
        });
      }
    }
  },
}));
