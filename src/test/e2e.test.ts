/**
 * E2E 测试
 *
 * 端到端测试完整的工作流程和边界情况
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile, readDir, exists } from '@tauri-apps/plugin-fs';

// 注意：E2E 测试需要在真实的 Tauri 环境中运行
// 这些测试可以作为 Tauri 测试套件的一部分运行

describe('E2E 测试：完整工作流程', () => {
  // 测试路径配置
  const TEST_DIR = '/tmp/minidoc-test';
  const TEST_FILE = `${TEST_DIR}/test.txt`;
  const TEST_SUBDIR = `${TEST_DIR}/subdir`;

  beforeAll(async () => {
    // 设置测试环境
    // 注意：这里假设 Tauri API 可用
    try {
      // 创建测试目录（如果不存在）
      if (!(await exists(TEST_DIR))) {
        await invoke('create_directory', { path: TEST_DIR });
      }
    } catch (e) {
      console.warn('无法创建测试目录，E2E 测试可能需要真实环境');
    }
  });

  afterAll(async () => {
    // 清理测试环境
    try {
      await invoke('delete_file', { path: TEST_DIR });
    } catch (e) {
      console.warn('清理测试目录失败');
    }
  });

  describe('完整编辑流程', () => {
    test('新建目录 -> 新建文件 -> 编辑内容 -> 保存 -> 关闭', async () => {
      // 步骤 1: 创建测试目录
      await invoke('create_directory', { path: TEST_DIR });
      const dirExists = await invoke('exists', { path: TEST_DIR });
      expect(dirExists).toBe(true);

      // 步骤 2: 创建新文件
      await invoke('write_file', { path: TEST_FILE, content: '' });
      const fileExists = await invoke('exists', { path: TEST_FILE });
      expect(fileExists).toBe(true);

      // 步骤 3: 写入内容
      const content = '# Hello World\n\nThis is a test file.';
      await invoke('write_file', { path: TEST_FILE, content });

      // 步骤 4: 读取并验证内容
      const readContent = await invoke('read_file', { path: TEST_FILE });
      expect(readContent).toBe(content);

      // 步骤 5: 更新内容
      const updatedContent = content + '\n\nUpdated line.';
      await invoke('write_file', { path: TEST_FILE, content: updatedContent });

      const newContent = await invoke('read_file', { path: TEST_FILE });
      expect(newContent).toBe(updatedContent);
    });
  });

  describe('目录操作流程', () => {
    test('创建嵌套目录结构', async () => {
      // 创建多级目录
      const nestedDir = `${TEST_DIR}/level1/level2/level3`;
      await invoke('create_directory', { path: nestedDir });

      const exists = await invoke('exists', { path: nestedDir });
      expect(exists).toBe(true);

      // 在嵌套目录中创建文件
      const nestedFile = `${nestedDir}/deep.txt`;
      await invoke('write_file', { path: nestedFile, content: 'Deep file' });

      const content = await invoke('read_file', { path: nestedFile });
      expect(content).toBe('Deep file');
    });

    test('递归读取目录结构', async () => {
      // 创建测试结构
      await invoke('create_directory', { path: `${TEST_DIR}/e2e-test` });
      await invoke('write_file', { path: `${TEST_DIR}/e2e-test/file1.txt`, content: '1' });
      await invoke('write_file', { path: `${TEST_DIR}/e2e-test/file2.md`, content: '2' });
      await invoke('create_directory', { path: `${TEST_DIR}/e2e-test/subdir` });
      await invoke('write_file', { path: `${TEST_DIR}/e2e-test/subdir/nested.txt`, content: '3' });

      // 递归读取
      const files = await invoke('read_directory', {
        path: `${TEST_DIR}/e2e-test`,
        recursive: true,
        include_hidden: false,
      });

      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('文件边界情况', () => {
    test('处理空文件', async () => {
      const emptyFile = `${TEST_DIR}/empty.txt`;
      await invoke('write_file', { path: emptyFile, content: '' });

      const content = await invoke('read_file', { path: emptyFile });
      expect(content).toBe('');
    });

    test('处理包含特殊字符的文件', async () => {
      const specialFile = `${TEST_DIR}/special.txt`;
      const specialContent = 'Hello 世界 🌍\nРусский текст\nΕλληνικά';

      await invoke('write_file', { path: specialFile, content: specialContent });

      const content = await invoke('read_file', { path: specialFile });
      expect(content).toBe(specialContent);
    });

    test('处理多行文件', async () => {
      const multiLineFile = `${TEST_DIR}/multiline.txt`;
      const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');

      await invoke('write_file', { path: multiLineFile, content: lines });

      // 测试按行读取
      const readLines = await invoke('read_file_lines', {
        path: multiLineFile,
        max_lines: 10,
      });

      expect(Array.isArray(readLines)).toBe(true);
      expect(readLines.length).toBe(10);
      expect(readLines[0]).toBe('Line 1');
      expect(readLines[9]).toBe('Line 10');
    });
  });

  describe('错误处理', () => {
    test('读取不存在的文件应该返回错误', async () => {
      await expect(
        invoke('read_file', { path: `${TEST_DIR}/nonexistent.txt` })
      ).rejects.toThrow();
    });

    test('创建已存在的文件应该处理正确', async () => {
      const existingFile = `${TEST_DIR}/existing.txt`;
      await invoke('write_file', { path: existingFile, content: 'First' });

      // 覆盖写入应该成功
      await invoke('write_file', { path: existingFile, content: 'Second' });

      const content = await invoke('read_file', { path: existingFile });
      expect(content).toBe('Second');
    });
  });

  describe('文件元数据', () => {
    test('获取文件元数据', async () => {
      const metaFile = `${TEST_DIR}/meta.txt`;
      const content = 'Metadata test';

      await invoke('write_file', { path: metaFile, content });

      const metadata = await invoke('get_metadata', { path: metaFile });

      expect(metadata).toHaveProperty('name');
      expect(metadata).toHaveProperty('path');
      expect(metadata).toHaveProperty('size');
      expect(metadata).toHaveProperty('is_dir');
      expect(metadata.is_dir).toBe(false);
    });

    test('获取目录元数据', async () => {
      const metadata = await invoke('get_metadata', { path: TEST_DIR });

      expect(metadata.is_dir).toBe(true);
    });
  });

  describe('批量操作', () => {
    test('创建和读取多个文件', async () => {
      const batchDir = `${TEST_DIR}/batch`;
      await invoke('create_directory', { path: batchDir });

      // 创建多个文件
      const promises = Array.from({ length: 10 }, (_, i) =>
        invoke('write_file', {
          path: `${batchDir}/file${i}.txt`,
          content: `Content ${i}`,
        })
      );

      await Promise.all(promises);

      // 读取目录
      const files = await invoke('read_directory', {
        path: batchDir,
        recursive: false,
        include_hidden: false,
      });

      expect(files.length).toBe(10);
    });
  });

  describe('文件追加操作', () => {
    test('追加内容到文件', async () => {
      const appendFile = `${TEST_DIR}/append.txt`;
      const initialContent = 'Initial\n';

      await invoke('write_file', { path: appendFile, content: initialContent });
      await invoke('append_file', { path: appendFile, content: 'Appended' });

      const content = await invoke('read_file', { path: appendFile });
      expect(content).toBe('Initial\nAppended');
    });
  });

  describe('隐藏文件过滤', () => {
    test('应该正确过滤隐藏文件', async () => {
      const hiddenDir = `${TEST_DIR}/hidden-test`;
      await invoke('create_directory', { path: hiddenDir });

      // 创建各种文件
      await invoke('write_file', { path: `${hiddenDir}/.gitignore`, content: '' });
      await invoke('write_file', { path: `${hiddenDir}/.env`, content: '' });
      await invoke('write_file', { path: `${hiddenDir}/normal.txt`, content: '' });
      await invoke('create_directory', { path: `${hiddenDir}/.git` });
      await invoke('create_directory', { path: `${hiddenDir}/node_modules` });

      // 不包含隐藏文件
      const filesWithoutHidden = await invoke('read_directory', {
        path: hiddenDir,
        recursive: false,
        include_hidden: false,
      });

      // 包含隐藏文件
      const filesWithHidden = await invoke('read_directory', {
        path: hiddenDir,
        recursive: false,
        include_hidden: true,
      });

      expect(filesWithHidden.length).toBeGreaterThanOrEqual(filesWithoutHidden.length);
    });
  });

  describe('实际工作流程模拟', () => {
    test('模拟用户创建新文档并编辑保存', async () => {
      // 用户场景：创建新文档

      // 1. 选择工作目录
      const workDir = `${TEST_DIR}/project`;
      await invoke('create_directory', { path: workDir });

      // 2. 创建新文件
      const docPath = `${workDir}/README.md`;
      await invoke('write_file', { path: docPath, content: '' });

      // 3. 编辑器中写入内容
      const docContent = `# 项目说明

这是一个测试项目。

## 功能特性

- 特性 1
- 特性 2

## 安装

运行安装命令...
`;

      await invoke('write_file', { path: docPath, content: docContent });

      // 4. 验证内容
      const saved = await invoke('read_file', { path: docPath });
      expect(saved).toBe(docContent);

      // 5. 创建子目录和更多文件
      await invoke('create_directory', { path: `${workDir}/docs` });
      await invoke('write_file', {
        path: `${workDir}/docs/guide.md`,
        content: '# 使用指南',
      });

      // 6. 验证目录结构
      const structure = await invoke('read_directory', {
        path: workDir,
        recursive: true,
        include_hidden: false,
      });

      expect(structure.length).toBeGreaterThanOrEqual(3); // README.md, docs/, docs/guide.md
    });
  });

  describe('大文件处理', () => {
    test('应该能处理较大的文件', async () => {
      const largeFile = `${TEST_DIR}/large.txt`;
      // 创建 100KB 的文件
      const largeContent = 'x'.repeat(100_000);

      await invoke('write_file', { path: largeFile, content: largeContent });

      // 分块读取
      const lines = await invoke('read_file_lines', {
        path: largeFile,
        max_lines: 100,
      });

      expect(lines.length).toBe(100);
    });
  });

  describe('文件删除和重命名', () => {
    test('删除文件和目录', async () => {
      const deleteDir = `${TEST_DIR}/delete-test`;
      await invoke('create_directory', { path: deleteDir });
      await invoke('write_file', { path: `${deleteDir}/file.txt`, content: 'test' });

      // 删除文件
      await invoke('delete_file', { path: `${deleteDir}/file.txt` });
      let exists = await invoke('exists', { path: `${deleteDir}/file.txt` });
      expect(exists).toBe(false);

      // 删除目录
      await invoke('delete_file', { path: deleteDir });
      exists = await invoke('exists', { path: deleteDir });
      expect(exists).toBe(false);
    });

    test('删除非空目录', async () => {
      const nonEmptyDir = `${TEST_DIR}/nonempty`;
      await invoke('create_directory', { path: nonEmptyDir });
      await invoke('write_file', { path: `${nonEmptyDir}/file.txt`, content: 'test' });
      await invoke('create_directory', { path: `${nonEmptyDir}/subdir` });
      await invoke('write_file', { path: `${nonEmptyDir}/subdir/nested.txt`, content: 'nested' });

      // 应该能删除整个目录树
      await invoke('delete_file', { path: nonEmptyDir });

      const exists = await invoke('exists', { path: nonEmptyDir });
      expect(exists).toBe(false);
    });
  });
});

/**
 * E2E 测试使用说明
 *
 * 1. 这些测试需要在 Tauri 环境中运行
 * 2. 运行命令：npm run tauri test (需要配置)
 * 3. 或者手动在 Tauri 应用中执行这些操作进行验证
 *
 * 真实 E2E 测试通常使用：
 * - Spectron (Electron)
 * - Tauri API + 测试框架
 * - Playwright/Wdio (如果测试 Web 部分)
 */
