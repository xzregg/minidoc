import type { TOCItem, GenerateOptions, TOCJSON } from './types';

/**
 * 根据选项生成目录字符串
 */
export function generateTOC(
  items: TOCItem[],
  options: GenerateOptions,
  filename?: string
): string {
  const { format } = options;

  switch (format) {
    case 'markdown':
      return generateMarkdown(items, options);
    case 'txt':
      return generateTXT(items, options);
    case 'json':
      return generateJSON(items, options, filename || 'document.md');
    default:
      throw new Error(`不支持的格式：${format}`);
  }
}

/**
 * 生成 Markdown 格式目录
 */
function generateMarkdown(items: TOCItem[], options: GenerateOptions): string {
  const { maxLevel = 6, indentSize = 2 } = options;
  const lines: string[] = [];

  function traverse(node: TOCItem, depth: number) {
    if (node.level > maxLevel) return;

    const indent = ' '.repeat(depth * indentSize);
    lines.push(`${indent}- [${node.text}](#${node.id})`);

    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }

  for (const item of items) {
    traverse(item, 0);
  }

  return lines.join('\n');
}

/**
 * 生成 TXT 格式目录
 */
function generateTXT(items: TOCItem[], options: GenerateOptions): string {
  const { maxLevel = 6, includeNumbers = false, indentType = 'space', indentSize = 2 } = options;
  const lines: string[] = [];
  const counters: number[] = []; // 用于编号 [1, 1, 1]

  function traverse(node: TOCItem, depth: number) {
    if (node.level > maxLevel) return;

    // 更新当前层级的计数器
    counters[depth] = (counters[depth] || 0) + 1;
    counters.splice(depth + 1); // 清空子层级计数器

    // 计算缩进
    const indent = indentType === 'space'
      ? ' '.repeat(depth * indentSize)
      : '\t'.repeat(depth);

    // 构建标题文本
    let text = node.text;
    if (includeNumbers) {
      const number = counters.slice(0, depth + 1).join('.');
      text = `${number} ${text}`;
    }

    lines.push(`${indent}${text}`);

    for (const child of node.children) {
      traverse(child, depth + 1);
    }
  }

  for (const item of items) {
    traverse(item, 0);
  }

  return lines.join('\n');
}

/**
 * 生成 JSON 格式目录
 */
function generateJSON(items: TOCItem[], options: GenerateOptions, filename: string): string {
  const tocJSON: TOCJSON = {
    title: filename.replace(/\.md$/, ''),
    sourceFile: filename,
    generatedAt: new Date().toISOString(),
    toc: items
  };

  return JSON.stringify(tocJSON, null, 2);
}

/**
 * 统计标题数量
 */
export function countHeadings(items: TOCItem[]): number {
  let count = 0;

  function traverse(node: TOCItem) {
    count++;
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const item of items) {
    traverse(item);
  }

  return count;
}
