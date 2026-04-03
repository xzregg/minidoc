import { useState, useEffect, useCallback } from 'react';
import { useFileStore } from '@/stores/fileStore';
import { parseTOC, generateTOC, countHeadings } from '@/utils/toc';
import { downloadFile, copyToClipboard } from '@/utils/toc';
import { TOCPreview } from './TOCPreview';
import { FiCopy, FiDownload, FiAlertCircle } from 'react-icons/fi';

type TOCFormat = 'markdown' | 'txt' | 'json';

export function TOCOutlineTab() {
  const { currentFile } = useFileStore();

  // 状态
  const [format, setFormat] = useState<TOCFormat>('markdown');
  const [maxLevel, setMaxLevel] = useState<number>(6);
  const [includeNumbers, setIncludeNumbers] = useState(false);
  const [tocContent, setTocContent] = useState('');
  const [titleCount, setTitleCount] = useState(0);
  const [isEmpty, setIsEmpty] = useState(false);
  const [noHeadings, setNoHeadings] = useState(false);
  const [copySuccess, setCopySuccess] = useState<boolean | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 生成目录内容
  const generateContent = useCallback(() => {
    if (!currentFile) {
      setIsEmpty(true);
      setNoHeadings(false);
      setTitleCount(0);
      setTocContent('');
      return;
    }

    const markdown = currentFile.content;

    if (!markdown || markdown.trim().length === 0) {
      setIsEmpty(true);
      setNoHeadings(false);
      setTitleCount(0);
      setTocContent('');
      return;
    }

    setIsEmpty(false);

    // 解析目录
    const tocItems = parseTOC(markdown, { maxLevel });

    if (tocItems.length === 0) {
      setNoHeadings(true);
      setTitleCount(0);
      setTocContent('');
      return;
    }

    setNoHeadings(false);
    setTitleCount(countHeadings(tocItems));

    // 生成目录内容
    const content = generateTOC(tocItems, {
      format,
      maxLevel,
      includeNumbers,
      indentType: 'space',
      indentSize: 2
    }, currentFile.name);

    setTocContent(content);
  }, [currentFile, format, maxLevel, includeNumbers]);

  // 当依赖变化时重新生成
  useEffect(() => {
    generateContent();
  }, [generateContent]);

  // 复制功能
  const handleCopy = async () => {
    if (!tocContent) return;

    try {
      await copyToClipboard(tocContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      setCopySuccess(false);
      setTimeout(() => setCopySuccess(null), 3000);
    }
  };

  // 导出文件功能
  const handleExport = async () => {
    if (!tocContent || !currentFile) return;

    const extMap: Record<TOCFormat, string> = {
      markdown: 'md',
      txt: 'txt',
      json: 'json'
    };

    const mimeMap: Record<TOCFormat, string> = {
      markdown: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json'
    };

    const baseName = currentFile.name.replace(/\.md$/, '');
    const filename = `${baseName}-outline.${extMap[format]}`;

    try {
      setDownloadError(null);
      await downloadFile(tocContent, filename, mimeMap[format]);
    } catch (error) {
      console.error('导出失败:', error);
      setDownloadError('导出失败，请重试');
      setTimeout(() => setDownloadError(null), 3000);
    }
  };

  // 空文档状态
  if (isEmpty || !currentFile) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {!currentFile ? '请先打开一个文档' : '当前文档为空'}
        </p>
      </div>
    );
  }

  // 无标题状态
  if (noHeadings) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FiAlertCircle className="w-12 h-12 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          文档中没有可导出的标题
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          请使用 # 标题语法添加内容
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 格式选择区 */}
      <section>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">选择导出格式</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'markdown' as TOCFormat, label: 'Markdown', desc: '带锚点链接' },
            { value: 'txt' as TOCFormat, label: '纯文本', desc: '无格式文本' },
            { value: 'json' as TOCFormat, label: 'JSON', desc: '结构化数据' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setFormat(option.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                format === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs opacity-70">{option.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 导出选项 */}
      <section>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">导出选项</h3>
        <div className="space-y-3">
          {/* 最大层级 */}
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-gray-600 dark:text-gray-400">最大层级</span>
            <select
              value={maxLevel}
              onChange={(e) => setMaxLevel(Number(e.target.value))}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>H1 (仅一级标题)</option>
              <option value={2}>H2 (到二级标题)</option>
              <option value={3}>H3 (到三级标题)</option>
              <option value={4}>H4 (到四级标题)</option>
              <option value={5}>H5 (到五级标题)</option>
              <option value={6}>H6 (所有标题)</option>
            </select>
          </label>

          {/* 包含标题编号 */}
          <label className="flex items-center justify-between cursor-pointer group">
            <span className="text-sm text-gray-600 dark:text-gray-400">包含标题编号</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(e) => setIncludeNumbers(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
          </label>
        </div>
      </section>

      {/* 预览区 */}
      <section>
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">预览</h3>
        <TOCPreview content={tocContent} format={format} />
      </section>

      {/* 状态信息 */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          共 <strong className="text-gray-900 dark:text-gray-100">{titleCount}</strong> 个标题
        </span>
        {copySuccess === true && (
          <span className="text-green-600 dark:text-green-400">已复制到剪贴板</span>
        )}
        {copySuccess === false && (
          <span className="text-red-600 dark:text-red-400">复制失败，请手动选择复制</span>
        )}
        {downloadError && (
          <span className="text-red-600 dark:text-red-400">{downloadError}</span>
        )}
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleCopy}
          disabled={!tocContent}
          className="px-4 py-2 text-sm flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FiCopy size={16} />
          复制
        </button>
        <button
          onClick={handleExport}
          disabled={!tocContent}
          className="px-4 py-2 text-sm flex items-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FiDownload size={16} />
          导出文件
        </button>
      </div>
    </div>
  );
}
