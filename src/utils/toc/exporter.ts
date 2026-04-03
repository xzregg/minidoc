/**
 * 下载文件
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    } catch (error) {
      console.error('下载失败:', error);
      // 降级处理：新窗口打开
      try {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(content)}</pre>`);
          newWindow.document.title = filename;
          resolve();
        } else {
          reject(new Error('无法打开新窗口'));
        }
      } catch (fallbackError) {
        reject(fallbackError);
      }
    }
  });
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(content: string): Promise<void> {
  // 优先使用现代 API
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content);
      return;
    } catch (error) {
      console.warn('navigator.clipboard 失败，使用降级方案');
    }
  }

  // 降级方案：使用 execCommand
  return new Promise((resolve, reject) => {
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      const success = document.execCommand('copy');
      if (!success) {
        throw new Error('execCommand 失败');
      }
      resolve();
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

/**
 * HTML 转义 helper
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
