// 文件系统相关类型
export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemItem[];
  size?: number;
  modified?: string;
}

// 大纲相关类型
export interface OutlineItem {
  id: string;
  level: number;
  title: string;
  line: number;
}

// Tauri 命令参数类型
export interface ListFilesOptions {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
}

// 文件过滤选项
export interface FileFilterOptions {
  extensions?: string[];
  excludePatterns?: string[];
}
