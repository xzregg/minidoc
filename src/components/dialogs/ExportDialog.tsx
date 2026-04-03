import { useState } from 'react';
import { useUIStore } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { FiX, FiDownload, FiFileText, FiCode, FiImage } from 'react-icons/fi';
import { exportDocument } from '@/utils/export';

type ExportFormat = 'markdown' | 'html' | 'pdf' | 'png';

export function ExportDialog() {
  const { exportOpen, closeExport } = useUIStore();
  const { currentFile } = useFileStore();
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [includeStyles, setIncludeStyles] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeExport();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeExport();
    }
  };

  const handleExport = async () => {
    if (!currentFile) {
      alert('没有打开的文件');
      return;
    }

    setIsExporting(true);

    try {
      const filename = currentFile.name.replace(/\.md$/, '');

      switch (format) {
        case 'markdown':
          // 直接下载 markdown 文件
          downloadMarkdown(currentFile.content, filename);
          break;

        case 'html':
          await exportDocument({
            format: 'html',
            markdown: currentFile.content,
            title: filename,
            filename,
          });
          break;

        case 'pdf':
          await exportDocument({
            format: 'pdf',
            markdown: currentFile.content,
            title: filename,
            filename,
          });
          break;

        case 'png':
          // PNG 需要获取预览区域的 DOM 元素
          const previewElement = document.querySelector('.cherry-previewer') as HTMLElement;
          if (previewElement) {
            await exportDocument({
              format: 'png',
              element: previewElement,
              filename,
            });
          } else {
            throw new Error('找不到预览区域');
          }
          break;
      }

      closeExport();
    } catch (error) {
      console.error('导出失败:', error);
      alert(`导出失败: ${error instanceof Error ? error.message : '请重试'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // 下载 Markdown 文件
  const downloadMarkdown = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!exportOpen) return null;

  const formatOptions = [
    { value: 'markdown' as ExportFormat, label: 'Markdown', icon: FiFileText, description: '.md 文件' },
    { value: 'html' as ExportFormat, label: 'HTML', icon: FiCode, description: '.html 网页' },
    { value: 'pdf' as ExportFormat, label: 'PDF', icon: FiFileText, description: '.pdf 文档' },
    { value: 'png' as ExportFormat, label: 'PNG', icon: FiImage, description: '.png 图片' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">导出文档</h2>
          <button
            onClick={closeExport}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">选择导出格式</h3>
            <div className="grid grid-cols-2 gap-3">
              {formatOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = format === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setFormat(option.value)}
                    disabled={isExporting}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 scale-[1.02]'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    } ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon size={24} />
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs opacity-70">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Options - 只保留包含样式选项，且只对 HTML 有效 */}
          {format === 'html' && (
            <section>
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">导出选项</h3>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm text-gray-600 dark:text-gray-400">包含样式</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={includeStyles}
                    onChange={(e) => setIncludeStyles(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </div>
              </label>
            </section>
          )}

          {/* Preview Info */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <FiDownload size={16} />
              <span>将导出为 <strong className="text-gray-900 dark:text-gray-100">.{format === 'markdown' ? 'md' : format}</strong> 格式</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={closeExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                导出中...
              </>
            ) : (
              <>
                <FiDownload size={16} />
                导出
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
