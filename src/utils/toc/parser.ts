import type { TOCItem, ParseOptions } from './types';

/**
 * 解析 Markdown 内容为目录项列表
 */
export function parseTOC(markdown: string, options: ParseOptions = {}): TOCItem[] {
  const { maxLevel = 6, includeLineNumbers = true } = options;
  const lines = markdown.split('\n');
  const flatItems: TOCItem[] = [];

  // 步骤 1: 逐行解析，提取标题
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 跳过代码块内的标题
    if (isInCodeBlock(lines, i)) {
      continue;
    }

    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (!match) continue;

    const level = match[1].length;
    if (level > maxLevel) continue;

    const text = match[2].trim();
    flatItems.push({
      level,
      text,
      line: includeLineNumbers ? i + 1 : 0,
      id: generateAnchorId(text),
      children: []
    });
  }

  // 步骤 2: 构建树状结构
  return buildTree(flatItems);
}

/**
 * 检测行是否在代码块内
 */
function isInCodeBlock(lines: string[], lineIndex: number): boolean {
  let inCodeBlock = false;
  for (let i = 0; i < lineIndex; i++) {
    // 检测 fenced code block (```)
    if (lines[i].startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }
    // 检测 indented code block (4 空格或 tab 开头)
    else if (!inCodeBlock && (lines[i].startsWith('    ') || lines[i].startsWith('\t'))) {
      // 检查前一行是否为空行或标题行
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine === '' || prevLine.match(/^#{1,6}\s+/)) {
          // 可能是代码块，需要继续检查
        }
      }
    }
  }
  return inCodeBlock;
}

/**
 * 将扁平列表转换为树状结构
 */
function buildTree(flatItems: TOCItem[]): TOCItem[] {
  const root: TOCItem[] = [];
  const stack: TOCItem[] = [];

  for (const item of flatItems) {
    const newNode: TOCItem = { ...item, children: [] };

    // 弹出栈中所有层级 >= 当前节点的节点
    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    // 添加到父节点或根
    if (stack.length === 0) {
      root.push(newNode);
    } else {
      stack[stack.length - 1].children.push(newNode);
    }

    stack.push(newNode);
  }

  return root;
}

/**
 * 生成锚点 ID（参考 GitHub/GitLab 规则）
 */
export function generateAnchorId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-\u4e00-\u9fff]/g, '')  // 保留中文和字母数字
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
