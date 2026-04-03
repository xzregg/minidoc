/**
 * 图片导出功能
 * 使用 html2canvas 将 HTML 转换为图片
 */

import html2canvas from 'html2canvas';

export interface ImageExportOptions {
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;    // 0-1 for jpeg/webp
  scale?: number;      // 缩放比例，默认 2
  backgroundColor?: string;
  filename?: string;
}

/**
 * 导出为图片
 */
export async function exportToImage(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<void> {
  const {
    format = 'png',
    quality = 0.95,
    scale = 2,
    backgroundColor = '#ffffff',
    filename = 'document'
  } = options;

  try {
    // 使用 html2canvas 生成 canvas
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor,
      allowTaint: false,
    });

    // 转换为 blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          throw new Error('图片生成失败');
        }

        // 下载图片
        downloadImage(blob, `${filename}.${format}`);
      },
      `image/${format}`,
      quality
    );
  } catch (error) {
    throw new Error(`图片导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 导出为图片（返回 Promise）
 */
export async function exportToImageAsync(
  element: HTMLElement,
  options: ImageExportOptions = {}
): Promise<Blob> {
  const {
    format = 'png',
    quality = 0.95,
    scale = 2,
    backgroundColor = '#ffffff',
  } = options;

  return new Promise((resolve, reject) => {
    html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor,
      allowTaint: false,
    })
      .then((canvas) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('图片生成失败'));
              return;
            }
            resolve(blob);
          },
          `image/${format}`,
          quality
        );
      })
      .catch(reject);
  });
}

/**
 * 下载图片
 */
function downloadImage(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // 清理
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从 Markdown 生成图片（需要先渲染为 HTML）
 */
export async function exportMarkdownToImage(
  _markdown: string,
  htmlContent: string,
  options: ImageExportOptions = {}
): Promise<void> {
  // 创建临时容器
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.width = '800px';
  container.style.padding = '40px';
  container.style.backgroundColor = options.backgroundColor || '#ffffff';
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    await exportToImage(container, options);
  } finally {
    // 清理临时容器
    document.body.removeChild(container);
  }
}

/**
 * 获取图片数据 URL
 */
export async function getImageDataUrl(
  element: HTMLElement,
  options: Omit<ImageExportOptions, 'filename'> = {}
): Promise<string> {
  const {
    format = 'png',
    quality = 0.95,
    scale = 2,
    backgroundColor = '#ffffff',
  } = options;

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor,
    allowTaint: false,
  });

  return canvas.toDataURL(`image/${format}`, quality);
}
