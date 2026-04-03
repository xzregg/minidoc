/**
 * PDF 导出功能
 * 使用系统打印对话框导出 PDF
 */

import { exportToHTML } from './html';

export interface PDFExportOptions {
  title?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * 导出为 PDF
 * 通过打开打印对话框，用户可以"另存为 PDF"
 */
export async function exportToPDF(
  markdown: string,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Document',
    filename = 'document'
  } = options;

  try {
    // 生成 HTML
    const html = await exportToHTML(markdown, {
      inlineCSS: true,
      title
    });

    // 创建临时窗口并打印
    await printWithBrowser(html, filename);
  } catch (error) {
    throw new Error(`PDF 导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 使用浏览器打印功能
 */
async function printWithBrowser(html: string, _filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时 iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) {
        document.body.removeChild(iframe);
        reject(new Error('无法创建打印窗口'));
        return;
      }

      const iframeDocument = iframeWindow.document;

      // 写入 HTML 内容
      iframeDocument.open();
      iframeDocument.write(html);
      iframeDocument.close();

      // 等待内容加载完成后打印
      iframe.onload = () => {
        try {
          // 调用打印对话框
          iframeWindow.focus();
          iframeWindow.print();

          // 延迟清理 iframe，确保打印对话框打开
          setTimeout(() => {
            document.body.removeChild(iframe);
            resolve();
          }, 1000);
        } catch (error) {
          document.body.removeChild(iframe);
          reject(error);
        }
      };
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 使用新窗口打印（备选方案）
 */
export async function exportToPDFWithWindow(
  markdown: string,
  options: PDFExportOptions = {}
): Promise<void> {
  const {
    title = 'Document',
  } = options;

  try {
    const html = await exportToHTML(markdown, {
      inlineCSS: true,
      title
    });

    // 打开新窗口
    const newWindow = window.open('', '_blank');
    if (!newWindow) {
      throw new Error('弹窗被阻止，请允许弹窗后重试');
    }

    // 写入内容
    newWindow.document.write(html);
    newWindow.document.close();

    // 等待加载后打印
    newWindow.onload = () => {
      newWindow.focus();
      newWindow.print();
      // 用户可以在打印对话框中选择"另存为 PDF"
    };
  } catch (error) {
    throw new Error(`PDF 导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}
