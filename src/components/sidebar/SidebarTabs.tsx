import { useState, useEffect, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileTree, FileTreeRef } from './FileTree';
import { FiRefreshCw, FiFolder } from 'react-icons/fi';
import { useFileStore } from '@/stores/fileStore';

interface SidebarTabsProps {
  width?: number;
}

export function SidebarTabs({ width = 280 }: SidebarTabsProps) {
  // 🔴 修复：使用 fileStore 的 currentDirectory，而不是本地状态
  const { currentDirectory, setCurrentDirectory } = useFileStore();
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  const fileTreeRef = useRef<FileTreeRef>(null);

  // 目录选择处理函数 - 更新 store 而不是本地状态
  const handleDirectorySelect = useCallback((path: string) => {
    console.log(`[SidebarTabs] 选择目录：${path}`);
    setCurrentDirectory(path);
  }, [setCurrentDirectory]);

  // 暴露给外部调用的方法（如从编辑器标签页调用）
  useEffect(() => {
    // 监听来自其他组件的文件高亮请求
    const handleFileHighlight = (event: CustomEvent<{ path: string }>) => {
      const { path } = event.detail;
      console.log(`[SidebarTabs] 收到文件高亮请求：${path}`);
      setHighlightedPath(path);
    };

    // @ts-ignore - 自定义事件
    window.addEventListener('highlight-file', handleFileHighlight);

    return () => {
      // @ts-ignore
      window.removeEventListener('highlight-file', handleFileHighlight);
    };
  }, []);

  // 使用系统对话框打开文件夹
  const handleOpenFolder = async () => {
    try {
      // 使用 Tauri 的原生对话框选择目录
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择文件夹',
      });
      console.log('[SidebarTabs] 对话框返回:', selected);
      if (selected && typeof selected === 'string') {
        handleDirectorySelect(selected);
      }
    } catch (error) {
      console.error('打开文件夹失败:', error);
    }
  };

  return (
    <div
      className="bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">资源管理器</span>
        <div className="flex items-center gap-1">
          {currentDirectory && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]" title={currentDirectory}>
              📁 {currentDirectory.split('/').pop() || currentDirectory}
            </span>
          )}
          <button
            onClick={handleOpenFolder}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
            title="打开文件夹"
          >
            <FiFolder size={14} />
          </button>
          <button
            onClick={() => handleDirectorySelect(currentDirectory || '.')}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
            title="刷新当前目录"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <FileTree
          ref={fileTreeRef}
          initialPath={currentDirectory || undefined}
          onDirectorySelect={handleDirectorySelect}
          highlightedPath={highlightedPath || undefined}
        />
      </div>
    </div>
  );
}
