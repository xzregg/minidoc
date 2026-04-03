/**
 * HTML 导出功能
 * 使用 Cherry Markdown 内置 HTML 生成功能
 */

import Cherry from 'cherry-markdown';

export interface HTMLExportOptions {
  inlineCSS?: boolean;         // 内联 CSS 样式
  includeCodeHighlight?: boolean; // 包含代码高亮
  includeTOC?: boolean;         // 包含目录
  title?: string;              // 文档标题
}

/**
 * 导出为 HTML
 */
export async function exportToHTML(
  markdown: string,
  options: HTMLExportOptions = {}
): Promise<string> {
  const {
    inlineCSS = true,
    title = 'Document'
  } = options;

  try {
    // 使用 Cherry Markdown 生成 HTML
    const cherry = new Cherry({
      value: markdown,
      engine: {
        global: {
          theme: 'default'
        }
      }
    });

    const html = cherry.getHtml();

    // 获取 Cherry Markdown 的 CSS
    const cssStyles = inlineCSS ? getInlineStyles() : '';

    // 包装完整 HTML 文档
    const fullHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${inlineCSS ? `<style>${cssStyles}</style>` : '<link rel="stylesheet" href="cherry-markdown.css">'}
</head>
<body>
  <div class="cherry-markdown">
    ${html}
  </div>
</body>
</html>`;

    return fullHTML;
  } catch (error) {
    throw new Error(`HTML 导出失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 下载 HTML 文件
 */
export async function downloadHTML(html: string, filename: string): Promise<void> {
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = ensureExtension(filename, '.html');
    document.body.appendChild(a);
    a.click();

    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    throw new Error(`HTML 下载失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取内联样式
 */
function getInlineStyles(): string {
  return `
    /* Cherry Markdown 基础样式 */
    .cherry-markdown {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      line-height: 1.7;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1f2937;
    }

    .cherry-markdown h1, .cherry-markdown h2, .cherry-markdown h3,
    .cherry-markdown h4, .cherry-markdown h5, .cherry-markdown h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.25;
    }

    .cherry-markdown h1 { font-size: 2.25em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    .cherry-markdown h2 { font-size: 1.75em; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
    .cherry-markdown h3 { font-size: 1.5em; }
    .cherry-markdown h4 { font-size: 1.25em; }

    .cherry-markdown p { margin-bottom: 1em; }

    .cherry-markdown code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: "SF Mono", Monaco, Consolas, "Courier New", monospace;
      font-size: 0.9em;
    }

    .cherry-markdown pre {
      background: #f4f4f4;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin-bottom: 1em;
    }

    .cherry-markdown pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
    }

    .cherry-markdown blockquote {
      border-left: 4px solid #4A90E2;
      padding-left: 16px;
      margin: 1em 0;
      color: #6b7280;
    }

    .cherry-markdown ul, .cherry-markdown ol {
      padding-left: 2em;
      margin-bottom: 1em;
    }

    .cherry-markdown li { margin-bottom: 0.25em; }

    .cherry-markdown table {
      border-collapse: collapse;
      width: 100%;
      margin-bottom: 1em;
    }

    .cherry-markdown th, .cherry-markdown td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      text-align: left;
    }

    .cherry-markdown th {
      background: #f9fafb;
      font-weight: 600;
    }

    .cherry-markdown img {
      max-width: 100%;
      height: auto;
    }

    .cherry-markdown a {
      color: #4A90E2;
      text-decoration: none;
    }

    .cherry-markdown a:hover {
      text-decoration: underline;
    }

    @media print {
      .cherry-markdown {
        max-width: 100%;
        padding: 0;
      }
    }
  `;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 确保文件名有正确的扩展名
 */
function ensureExtension(filename: string, extension: string): string {
  if (filename.toLowerCase().endsWith(extension.toLowerCase())) {
    return filename;
  }
  return filename + extension;
}
