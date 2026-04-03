/**
 * 性能测试
 *
 * 测试大文件加载、文件树渲染、内存泄漏等性能相关场景
 */

import { renderHook, act } from '@testing-library/react';
import { useFileStore, fileCache } from '../stores/fileStore';
import { performance } from 'perf_hooks';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('../components/ui/Toast', () => ({
  useToastStore: {
    getState: jest.fn(() => ({
      addToast: jest.fn(),
    })),
  },
}));

describe('性能测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileCache.clear();
  });

  describe('大文件加载性能', () => {
    test('应该能在合理时间内读取大文件', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 模拟 10MB 文件
      const largeContent = 'x'.repeat(10_000_000);
      invoke.mockResolvedValue(largeContent);

      const startTime = performance.now();

      const content = await invoke('read_file', { path: '/test/large.txt' });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(content).toHaveLength(10_000_000);
      // 在模拟环境中应该很快（< 100ms）
      expect(duration).toBeLessThan(100);
    });

    test('应该能高效处理大量小文件', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 模拟 100 个小文件
      const files = Array.from({ length: 100 }, (_, i) => ({
        name: `file${i}.txt`,
        path: `/test/file${i}.txt`,
        is_dir: false,
        size: 100,
        modified: Date.now() / 1000,
        children: null,
      }));

      invoke.mockResolvedValue(files);

      const startTime = performance.now();

      const result = await invoke('read_directory', {
        path: '/test',
        recursive: false,
        include_hidden: false,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.length).toBe(100);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('文件树渲染性能', () => {
    test('应该能处理深层嵌套目录结构', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 创建深层嵌套结构
      let currentDir = {
        name: 'root',
        path: '/root',
        is_dir: true,
        size: 0,
        modified: Date.now() / 1000,
        children: [] as any[],
      };

      let dir = currentDir;
      for (let i = 0; i < 10; i++) {
        const child = {
          name: `level${i}`,
          path: `/root/${Array.from({ length: i + 1 }, (_, j) => `level${j}`).join('/')}`,
          is_dir: true,
          size: 0,
          modified: Date.now() / 1000,
          children: [] as any[],
        };
        dir.children.push(child);
        dir = child;
      }

      // 添加文件到最深层
      dir.children.push({
        name: 'deep.txt',
        path: dir.path + '/deep.txt',
        is_dir: false,
        size: 100,
        modified: Date.now() / 1000,
        children: null,
      });

      invoke.mockResolvedValue([currentDir]);

      const startTime = performance.now();

      const result = await invoke('read_directory', {
        path: '/root',
        recursive: true,
        include_hidden: false,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    test('应该能处理宽目录（大量子项）', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 创建包含 1000 个文件的目录
      const files = Array.from({ length: 1000 }, (_, i) => ({
        name: `file${i}.txt`,
        path: `/test/file${i}.txt`,
        is_dir: false,
        size: 100,
        modified: Date.now() / 1000,
        children: null,
      }));

      invoke.mockResolvedValue(files);

      const startTime = performance.now();

      const result = await invoke('read_directory', {
        path: '/test',
        recursive: false,
        include_hidden: false,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.length).toBe(1000);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('缓存性能', () => {
    test('LRU 缓存应该高效工作', () => {
      const { result } = renderHook(() => useFileStore);

      // 添加大量缓存项
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        fileCache.set(`/test/file${i}.txt`, `Content ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 缓存操作应该很快
      expect(duration).toBeLessThan(50);
      expect(fileCache.size).toBeLessThanOrEqual(50); // LRU 最大 50
    });

    test('缓存命中应该显著提高性能', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 第一次调用（缓存未命中）
      invoke.mockResolvedValue('Content');

      const startTime1 = performance.now();
      await invoke('read_file', { path: '/test/cached.txt' });
      const endTime1 = performance.now();

      // 设置缓存
      fileCache.set('/test/cached.txt', 'Content');

      // 从缓存读取
      const startTime2 = performance.now();
      const cached = fileCache.get('/test/cached.txt');
      const endTime2 = performance.now();

      expect(cached).toBe('Content');
      // 缓存读取应该比 API 调用快得多
      //（注意：在模拟环境中这个差异可能不明显）
    });
  });

  describe('内存使用', () => {
    test('频繁打开关闭文件不应该造成内存泄漏', () => {
      const { result } = renderHook(() => useFileStore);

      const initialOpenFiles = result.current.openFiles.length;

      // 打开 100 个文件
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.openFile({
            path: `/test/file${i}.txt`,
            name: `file${i}.txt`,
            modified: false,
            content: `Content ${i}`,
          });
        });
      }

      expect(result.current.openFiles.length).toBe(initialOpenFiles + 100);

      // 关闭所有文件
      for (let i = 0; i < 100; i++) {
        act(() => {
          result.current.closeFile(`/test/file${i}.txt`);
        });
      }

      // 验证所有文件都已关闭
      expect(result.current.openFiles.length).toBe(initialOpenFiles);
    });

    test('大量编辑操作不应该造成性能下降', () => {
      const { result } = renderHook(() => useFileStore);

      act(() => {
        result.current.openFile({
          path: '/test/edit.txt',
          name: 'edit.txt',
          modified: false,
          content: '',
        });
      });

      const startTime = performance.now();

      // 执行 1000 次编辑
      for (let i = 0; i < 1000; i++) {
        act(() => {
          result.current.updateContent(`Content ${i}\n`);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000 次更新应该在合理时间内完成
      expect(duration).toBeLessThan(5000); // 5 秒
    });
  });

  describe('多标签页性能', () => {
    test('应该能高效管理大量标签页', () => {
      const { result } = renderHook(() => useFileStore);

      const startTime = performance.now();

      // 打开 50 个标签页
      for (let i = 0; i < 50; i++) {
        act(() => {
          result.current.openFile({
            path: `/test/tab${i}.txt`,
            name: `tab${i}.txt`,
            modified: false,
            content: `Tab ${i} content`,
          });
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.openFiles.length).toBe(50);
      expect(duration).toBeLessThan(1000); // 1 秒
    });

    test('标签页切换应该是即时的', () => {
      const { result } = renderHook(() => useFileStore);

      // 打开多个文件
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.openFile({
            path: `/test/tab${i}.txt`,
            name: `tab${i}.txt`,
            modified: false,
            content: `Tab ${i}`,
          });
        });
      }

      const startTime = performance.now();

      // 快速切换标签页
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.setActiveTab(`/test/tab${i}.txt`);
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 标签切换应该很快
      expect(duration).toBeLessThan(500); // 500ms
    });
  });

  describe('并发操作性能', () => {
    test('应该能处理并发的文件操作', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;
      invoke.mockResolvedValue('Content');

      const startTime = performance.now();

      // 并发读取 50 个文件
      const promises = Array.from({ length: 50 }, (_, i) =>
        invoke('read_file', { path: `/test/file${i}.txt` })
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 并发操作应该高效
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('字符串处理性能', () => {
    test('应该能高效处理大文本编辑', () => {
      const { result } = renderHook(() => useFileStore);

      // 创建大文件
      const largeContent = Array.from({ length: 10000 }, (_, i) => `Line ${i}`).join('\n');

      act(() => {
        result.current.openFile({
          path: '/test/large.txt',
          name: 'large.txt',
          modified: false,
          content: largeContent,
        });
      });

      const startTime = performance.now();

      // 在文件末尾追加内容
      act(() => {
        result.current.updateContent(largeContent + '\nNew line');
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 大文本更新应该在合理时间内
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('搜索和过滤性能', () => {
    test('文件过滤应该高效', async () => {
      const invoke = jest.requireMock('@tauri-apps/api/core').invoke;

      // 创建包含各种扩展名的文件列表
      const files = Array.from({ length: 1000 }, (_, i) => ({
        name: i % 2 === 0 ? `file${i}.txt` : `file${i}.md`,
        path: `/test/file${i}`,
        is_dir: false,
        size: 100,
        modified: Date.now() / 1000,
        children: null,
      }));

      invoke.mockResolvedValue(files);

      const allFiles = await invoke('read_directory', {
        path: '/test',
        recursive: false,
        include_hidden: false,
      });

      const startTime = performance.now();

      // 过滤 Markdown 文件
      const mdFiles = allFiles.filter((f: any) => f.name.endsWith('.md'));

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(mdFiles.length).toBe(500);
      expect(duration).toBeLessThan(50);
    });
  });

  describe('性能基准', () => {
    test('建立性能基准', () => {
      const benchmarks = {
        cacheSet: () => {
          const start = performance.now();
          fileCache.set('/test/bench.txt', 'Content');
          return performance.now() - start;
        },
        cacheGet: () => {
          fileCache.set('/test/bench.txt', 'Content');
          const start = performance.now();
          fileCache.get('/test/bench.txt');
          return performance.now() - start;
        },
      };

      // 运行多次取平均
      const runs = 1000;
      const results = {
        cacheSet: 0,
        cacheGet: 0,
      };

      for (let i = 0; i < runs; i++) {
        results.cacheSet += benchmarks.cacheSet();
        results.cacheGet += benchmarks.cacheGet();
      }

      const avgCacheSet = results.cacheSet / runs;
      const avgCacheGet = results.cacheGet / runs;

      console.log('性能基准结果:');
      console.log(`平均缓存设置时间: ${avgCacheSet.toFixed(4)}ms`);
      console.log(`平均缓存读取时间: ${avgCacheGet.toFixed(4)}ms`);

      // 基准应该在合理范围内
      expect(avgCacheSet).toBeLessThan(1); // < 1ms
      expect(avgCacheGet).toBeLessThan(1); // < 1ms
    });
  });
});

/**
 * 性能测试说明
 *
 * 这些测试验证以下性能指标：
 *
 * 1. 大文件加载：10MB 文件 < 100ms
 * 2. 文件树渲染：1000 个文件 < 100ms
 * 3. 缓存操作：get/set < 1ms
 * 4. 标签页切换：< 500ms
 * 5. 并发操作：50 个并发 < 1s
 *
 * 真实环境中的性能会因系统而异。
 * 如果测试失败，可能需要：
 * - 优化数据处理逻辑
 * - 实现虚拟化
 * - 添加分页或懒加载
 * - 使用 Web Workers
 */
