/**
 * 导出功能统一入口
 */

export * from './html';
export * from './pdf';
export * from './image';
export * from './word';

import { exportToHTML, downloadHTML } from './html';
import { exportToPDF } from './pdf';
import { exportToImage } from './image';
import { exportToWord } from './word';

export type ExportFormat = 'html' | 'pdf' | 'png' | 'jpeg' | 'webp' | 'word';

export interface ExportOptions {
  format: ExportFormat;
  markdown?: string;
  element?: HTMLElement;
  title?: string;
  filename?: string;
  htmlContent?: string;  // 用于图片导出
}

/**
 * 统一导出函数
 */
export async function exportDocument(options: ExportOptions): Promise<void> {
  const {
    format,
    markdown = '',
    element,
    title = 'Document',
    filename = 'document',
    htmlContent
  } = options;

  try {
    switch (format) {
      case 'html':
        if (!markdown) {
          throw new Error('HTML 导出需要 markdown 内容');
        }
        const html = await exportToHTML(markdown, { title });
        await downloadHTML(html, filename);
        break;

      case 'pdf':
        if (!markdown) {
          throw new Error('PDF 导出需要 markdown 内容');
        }
        await exportToPDF(markdown, { title, filename });
        break;

      case 'png':
      case 'jpeg':
      case 'webp':
        if (!element && !htmlContent) {
          throw new Error('图片导出需要 element 或 htmlContent');
        }
        if (element) {
          await exportToImage(element, {
            format: format === 'png' ? 'png' : format === 'jpeg' ? 'jpeg' : 'webp',
            filename
          });
        } else if (htmlContent) {
          const { exportMarkdownToImage } = await import('./image');
          await exportMarkdownToImage(markdown, htmlContent, {
            format: format === 'png' ? 'png' : format === 'jpeg' ? 'jpeg' : 'webp',
            filename
          });
        }
        break;

      case 'word':
        if (!markdown) {
          throw new Error('Word 导出需要 markdown 内容');
        }
        await exportToWord(markdown, { title, filename });
        break;

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  } catch (error) {
    console.error('导出失败:', error);
    throw error;
  }
}

/**
 * 导出进度回调类型
 */
export type ExportProgressCallback = (progress: {
  stage: 'preparing' | 'processing' | 'saving' | 'completed' | 'error';
  message: string;
  percentage?: number;
}) => void;

/**
 * 带进度回调的导出函数
 */
export async function exportDocumentWithProgress(
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  try {
    onProgress?.({ stage: 'preparing', message: '准备导出...', percentage: 10 });

    // 模拟准备时间
    await new Promise(resolve => setTimeout(resolve, 100));

    onProgress?.({ stage: 'processing', message: '处理内容...', percentage: 30 });

    await exportDocument(options);

    onProgress?.({ stage: 'saving', message: '保存文件...', percentage: 80 });

    // 模拟保存时间
    await new Promise(resolve => setTimeout(resolve, 200));

    onProgress?.({ stage: 'completed', message: '导出完成', percentage: 100 });
  } catch (error) {
    onProgress?.({
      stage: 'error',
      message: `导出失败: ${error instanceof Error ? error.message : String(error)}`
    });
    throw error;
  }
}
