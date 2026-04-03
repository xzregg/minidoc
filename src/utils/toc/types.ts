/**
 * 目录项接口
 */
export interface TOCItem {
  level: number;           // 1-6，对应 H1-H6
  text: string;            // 标题文本
  line: number;            // 原始行号（从 1 开始）
  id: string;              // 生成的锚点 ID
  children: TOCItem[];     // 子标题（树状结构）
}

/**
 * 解析选项
 */
export interface ParseOptions {
  maxLevel?: number;       // 最大解析层级，默认 6
  includeLineNumbers?: boolean; // 是否包含行号，默认 true
}

/**
 * 生成选项
 */
export interface GenerateOptions {
  format: 'markdown' | 'txt' | 'json';
  maxLevel?: number;       // 最大导出层级
  includeNumbers?: boolean; // 是否包含标题编号（仅 TXT）
  indentType?: 'space' | 'tab'; // 缩进类型，默认 'space'
  indentSize?: number;     // 每级缩进空格数，默认 2
}

/**
 * JSON 导出结构
 */
export interface TOCJSON {
  title: string;
  sourceFile: string;
  generatedAt: string;
  toc: TOCItem[];
}
