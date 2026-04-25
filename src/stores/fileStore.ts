import { create } from 'zustand';
import { useToastStore } from '../components/ui/Toast';

export interface File {
  path: string;
  name: string;
  modified: boolean;
  content: string;
  fileMtime?: number; // 磁盘文件的最后修改时间（秒级时间戳）
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

  // 🔴 重新加载版本号：每次从磁盘重新读取内容时 +1
  reloadVersion: number;
  incrementReloadVersion: () => void;

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
  reloadVersion: 0,
  autoSaveEnabled: true,
  autoSaveInterval: 30000,

  triggerRefresh: () => {
    set({ refreshVersion: get().refreshVersion + 1 });
  },

  incrementReloadVersion: () => {
    set({ reloadVersion: get().reloadVersion + 1 });
  },

  openFile: (file) => {
    if (file) {
      console.log('[fileStore] 打开文件:', file.path, '内容长度:', file.content.length);
    } else {
      console.log('[fileStore] 关闭当前文件');
    }
    set({ currentFile: file, reloadVersion: get().reloadVersion + 1 });
  },

  closeCurrentFile: () => {
    set({ currentFile: null });
  },

  updateContent: (content) => {
    const { currentFile } = get();
    if (!currentFile) return;

    // 内容未变化，不创建新对象（避免触发 useEffect 循环）
    if (currentFile.content === content) return;

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
        // 🔴 保存后更新 fileMtime，避免定时扫描误判为外部修改
        const fileMtime = await invoke<number>('get_file_mtime', { path: currentFile.path });
        set({
          currentFile: { ...currentFile, modified: false, fileMtime },
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
