/**
 * Word 导出功能
 * 需要后端 Pandoc 支持
 */

import { invoke } from '@tauri-apps/api/core';
import { exportToHTML } from './html';

export interface WordExportOptions {
  title?: string;
  filename?: string;
  usePandoc?: boolean;  // 是否使用后端 Pandoc（默认 false，使用前端方案）
}

/**
 * 导出为 Word 文档
 */
export async function exportToWord(
  markdown: string,
  options: WordExportOptions = {}
): Promise<void> {
  const {
    title = 'Document',
    filename = 'document',
    usePandoc = false
  } = options;

  try {
    // 生成 HTML
    const html = await exportToHTML(markdown, {
      inlineCSS: true,
      title
    });

    if (usePandoc) {
      // 使用后端 Pandoc 转换
      await exportWordWithPandoc(html, filename);
    } else {
      // 使用前端纯 HTML 方案
      await exportWordAsHTML(html, filename);
    }
  } catch (error) {
    throw new Error(`Word 导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 使用后端 Pandoc 转换
 */
async function exportWordWithPandoc(html: string, filename: string): Promise<void> {
  try {
    // 调用 Tauri 后端命令
    await invoke('export_to_word', {
      html,
      path: `${filename}.docx`
    });
  } catch (error) {
    // 如果后端不支持，回退到前端方案
    console.warn('后端 Pandoc 不可用，使用前端方案:', error);
    await exportWordAsHTML(html, filename);
  }
}

/**
 * 前端方案：导出为 HTML（Word 可以打开）
 * 这是一个简化方案，生成的文件扩展名为 .doc，实际上是 HTML
 */
async function exportWordAsHTML(html: string, filename: string): Promise<void> {
  // 修改 HTML 以兼容 Word
  const wordCompatibleHTML = html.replace(
    '<head>',
    `<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word">
    <meta name="Originator" content="Microsoft Word">`
  );

  // 下载为 .doc 文件（实际上是 HTML）
  const blob = new Blob([wordCompatibleHTML], {
    type: 'application/msword'
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.doc`;
  document.body.appendChild(a);
  a.click();

  // 清理
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 检查后端是否支持 Pandoc
 */
export async function checkPandocAvailable(): Promise<boolean> {
  try {
    await invoke('check_pandoc');
    return true;
  } catch {
    return false;
  }
}
