/**
 * FileStore 单元测试
 *
 * 测试文件状态管理的核心逻辑
 */

import { renderHook, act } from '@testing-library/react';
import { useFileStore, fileCache } from './fileStore';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock Toast store
jest.mock('../components/ui/Toast', () => ({
  useToastStore: {
    getState: jest.fn(() => ({
      addToast: jest.fn(),
    })),
  },
}));

describe('FileStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    const { result } = renderHook(() => useFileStore());
    act(() => {
      result.current.openFiles = [];
      result.current.currentFile = null;
      result.current.activeTab = null;
      result.current.isSaving = false;
    });
    fileCache.clear();
  });

  describe('openFile', () => {
    it('应该打开新文件并设置为当前文件', () => {
      const { result } = renderHook(() => useFileStore());
      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: false,
        content: 'Test content',
      };

      act(() => {
        result.current.openFile(testFile);
      });

      expect(result.current.openFiles).toHaveLength(1);
      expect(result.current.currentFile).toEqual(testFile);
      expect(result.current.activeTab).toBe('/test/file.txt');
    });

    it('应该更新已存在文件的内容', () => {
      const { result } = renderHook(() => useFileStore());
      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: false,
        content: 'Test content',
      };

      act(() => {
        result.current.openFile(testFile);
      });

      const updatedFile = {
        ...testFile,
        content: 'Updated content',
      };

      act(() => {
        result.current.openFile(updatedFile);
      });

      expect(result.current.openFiles).toHaveLength(1);
      expect(result.current.currentFile?.content).toBe('Updated content');
    });

    it('应该可以打开多个文件', () => {
      const { result } = renderHook(() => useFileStore());
      const file1 = {
        path: '/test/file1.txt',
        name: 'file1.txt',
        modified: false,
        content: 'Content 1',
      };
      const file2 = {
        path: '/test/file2.txt',
        name: 'file2.txt',
        modified: false,
        content: 'Content 2',
      };

      act(() => {
        result.current.openFile(file1);
        result.current.openFile(file2);
      });

      expect(result.current.openFiles).toHaveLength(2);
      expect(result.current.currentFile).toEqual(file2);
    });
  });

  describe('closeFile', () => {
    it('应该关闭文件并从打开列表中移除', () => {
      const { result } = renderHook(() => useFileStore());
      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: false,
        content: 'Test content',
      };

      act(() => {
        result.current.openFile(testFile);
        result.current.closeFile('/test/file.txt');
      });

      expect(result.current.openFiles).toHaveLength(0);
      expect(result.current.currentFile).toBeNull();
      expect(result.current.activeTab).toBeNull();
    });

    it('关闭当前文件后应该切换到下一个文件', () => {
      const { result } = renderHook(() => useFileStore());
      const file1 = {
        path: '/test/file1.txt',
        name: 'file1.txt',
        modified: false,
        content: 'Content 1',
      };
      const file2 = {
        path: '/test/file2.txt',
        name: 'file2.txt',
        modified: false,
        content: 'Content 2',
      };

      act(() => {
        result.current.openFile(file1);
        result.current.openFile(file2);
      });

      act(() => {
        result.current.closeFile('/test/file2.txt');
      });

      expect(result.current.currentFile).toEqual(file1);
      expect(result.current.activeTab).toBe('/test/file1.txt');
    });

    it('关闭中间文件后应该保持当前文件', () => {
      const { result } = renderHook(() => useFileStore());
      const file1 = {
        path: '/test/file1.txt',
        name: 'file1.txt',
        modified: false,
        content: 'Content 1',
      };
      const file2 = {
        path: '/test/file2.txt',
        name: 'file2.txt',
        modified: false,
        content: 'Content 2',
      };
      const file3 = {
        path: '/test/file3.txt',
        name: 'file3.txt',
        modified: false,
        content: 'Content 3',
      };

      act(() => {
        result.current.openFile(file1);
        result.current.openFile(file2);
        result.current.openFile(file3);
      });

      act(() => {
        result.current.closeFile('/test/file2.txt');
      });

      expect(result.current.currentFile).toEqual(file3);
      expect(result.current.openFiles).toHaveLength(2);
    });
  });

  describe('setActiveTab', () => {
    it('应该切换活动标签页', () => {
      const { result } = renderHook(() => useFileStore());
      const file1 = {
        path: '/test/file1.txt',
        name: 'file1.txt',
        modified: false,
        content: 'Content 1',
      };
      const file2 = {
        path: '/test/file2.txt',
        name: 'file2.txt',
        modified: false,
        content: 'Content 2',
      };

      act(() => {
        result.current.openFile(file1);
        result.current.openFile(file2);
        result.current.setActiveTab('/test/file1.txt');
      });

      expect(result.current.currentFile).toEqual(file1);
      expect(result.current.activeTab).toBe('/test/file1.txt');
    });
  });

  describe('updateContent', () => {
    it('应该更新文件内容并标记为已修改', () => {
      const { result } = renderHook(() => useFileStore());
      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: false,
        content: 'Original content',
      };

      act(() => {
        result.current.openFile(testFile);
        result.current.updateContent('Updated content');
      });

      expect(result.current.currentFile?.content).toBe('Updated content');
      expect(result.current.currentFile?.modified).toBe(true);
      expect(result.current.openFiles[0].modified).toBe(true);
    });

    it('没有当前文件时不应该更新内容', () => {
      const { result } = renderHook(() => useFileStore());

      act(() => {
        result.current.updateContent('Should not update');
      });

      expect(result.current.currentFile).toBeNull();
    });

    it('应该缓存文件内容', () => {
      const { result } = renderHook(() => useFileStore());
      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: false,
        content: 'Original content',
      };

      act(() => {
        result.current.openFile(testFile);
        result.current.updateContent('Cached content');
      });

      expect(fileCache.has('/test/file.txt')).toBe(true);
      expect(fileCache.get('/test/file.txt')).toBe('Cached content');
    });
  });

  describe('saveFile', () => {
    it('在 Tauri 环境中应该调用 write_file', async () => {
      const { result } = renderHook(() => useFileStore());
      const invoke = jest.fn().mockResolvedValue(undefined);
      jest.doMock('@tauri-apps/api/core', () => ({
        invoke,
      }));

      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: true,
        content: 'Content to save',
      };

      act(() => {
        result.current.openFile(testFile);
      });

      // 设置 Tauri 环境
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        writable: true,
      });

      await act(async () => {
        await result.current.saveFile();
      });

      // 验证调用
      expect(invoke).toHaveBeenCalledWith('write_file', {
        path: '/test/file.txt',
        content: 'Content to save',
      });
    });

    it('保存成功后应该清除修改标记', async () => {
      const { result } = renderHook(() => useFileStore());
      const invoke = jest.fn().mockResolvedValue(undefined);

      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: true,
        content: 'Content',
      };

      act(() => {
        result.current.openFile(testFile);
      });

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        writable: true,
      });

      await act(async () => {
        await result.current.saveFile();
      });

      expect(result.current.currentFile?.modified).toBe(false);
      expect(result.current.isSaving).toBe(false);
    });

    it('保存失败应该显示错误提示', async () => {
      const { result } = renderHook(() => useFileStore());
      const invoke = jest.fn().mockRejectedValue(new Error('Permission denied'));

      const testFile = {
        path: '/test/file.txt',
        name: 'file.txt',
        modified: true,
        content: 'Content',
      };

      act(() => {
        result.current.openFile(testFile);
      });

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        writable: true,
      });

      await act(async () => {
        await result.current.saveFile();
      });

      expect(result.current.isSaving).toBe(false);
    });

    it('没有当前文件时不应该保存', async () => {
      const { result } = renderHook(() => useFileStore());

      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        writable: true,
      });

      await act(async () => {
        await result.current.saveFile();
      });

      // 不应该抛出错误
      expect(result.current.currentFile).toBeNull();
    });
  });

  describe('LRU Cache', () => {
    it('应该正确缓存和获取内容', () => {
      fileCache.set('/test/1.txt', 'Content 1');
      fileCache.set('/test/2.txt', 'Content 2');
      fileCache.set('/test/3.txt', 'Content 3');

      expect(fileCache.get('/test/1.txt')).toBe('Content 1');
      expect(fileCache.get('/test/2.txt')).toBe('Content 2');
      expect(fileCache.get('/test/3.txt')).toBe('Content 3');
    });

    it('应该更新 LRU 顺序', () => {
      fileCache.set('/test/1.txt', 'Content 1');
      fileCache.set('/test/2.txt', 'Content 2');
      // 访问 1 更新其位置
      fileCache.get('/test/1.txt');
      // 添加新内容应该淘汰 2
      fileCache.set('/test/3.txt', 'Content 3');

      expect(fileCache.has('/test/1.txt')).toBe(true);
      expect(fileCache.has('/test/2.txt')).toBe(false);
    });

    it('应该正确清除缓存', () => {
      fileCache.set('/test/1.txt', 'Content 1');
      fileCache.set('/test/2.txt', 'Content 2');

      expect(fileCache.size).toBe(2);

      fileCache.clear();

      expect(fileCache.size).toBe(0);
      expect(fileCache.has('/test/1.txt')).toBe(false);
    });
  });

  describe('AutoSave Settings', () => {
    it('应该可以设置自动保存开关', () => {
      const { result } = renderHook(() => useFileStore());

      act(() => {
        result.current.setAutoSaveEnabled(false);
      });

      expect(result.current.autoSaveEnabled).toBe(false);

      act(() => {
        result.current.setAutoSaveEnabled(true);
      });

      expect(result.current.autoSaveEnabled).toBe(true);
    });

    it('应该可以设置自动保存间隔', () => {
      const { result } = renderHook(() => useFileStore());

      act(() => {
        result.current.setAutoSaveInterval(60000);
      });

      expect(result.current.autoSaveInterval).toBe(60000);
    });
  });
});
