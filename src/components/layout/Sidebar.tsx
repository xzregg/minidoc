import { useState, forwardRef, useImperativeHandle } from 'react';
import { FiFile, FiList, FiHome, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useFileStore } from '@/stores/fileStore';
import { FileTree } from '../sidebar/FileTree';
import { isTauri } from '@/utils/tauri-env';
import { useToast } from '../ui/Toast';

export interface SidebarRef {
  revealFile: (filePath: string) => void;
}

interface SidebarProps {
  className?: string;
}

export const Sidebar = forwardRef<SidebarRef, SidebarProps>(({ className = '' }, ref) => {
  const { currentFile, highlightedPath, setHighlightedPath, currentDirectory, setCurrentDirectory } = useFileStore();
  const [activeTab, setActiveTab] = useState<'files' | 'outline'>('files');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { success, warning } = useToast();

  // 【调试日志】记录每次渲染时的 store 状态
  console.log('[Sidebar] 渲染状态:', { currentDirectory, timestamp: Date.now() });

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    revealFile: (filePath: string) => {
      console.log('[Sidebar] revealFile called:', filePath);
      // 设置目录为文件所在目录
      const dir = filePath.substring(0, filePath.lastIndexOf('/'));
      setCurrentDirectory(dir);
      // 通知 FileTree 高亮文件
      setHighlightedPath(filePath);
      // 切换到文件选项卡
      setActiveTab('files');
    }
  }), [setHighlightedPath, setCurrentDirectory]);

  const handleDirectorySelect = (path: string) => {
    console.log('[Sidebar] 选择目录:', path);
    setCurrentDirectory(path);
    success(`已设置工作目录: ${path}`);
  };

  const handleOpenDirectory = async () => {
    console.log('[Sidebar] handleOpenDirectory 被调用');
    console.log('[Sidebar] isTauri():', isTauri());
    console.log('[Sidebar] 当前 currentDirectory:', useFileStore.getState().currentDirectory);

    try {
      if (isTauri()) {
        console.log('[Sidebar] 动态导入 @tauri-apps/plugin-dialog...');
        const dialogModule = await import('@tauri-apps/plugin-dialog');
        console.log('[Sidebar] 导入成功，open 函数:', typeof dialogModule.open);

        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
        });

        console.log('[Sidebar] 对话框返回值:', selected, '类型:', typeof selected);
        console.log('[Sidebar] 返回值详情:', JSON.stringify(selected, null, 2));

        if (selected) {
          // Tauri v2 返回可能是：
          // 1. 字符串（单个路径）
          // 2. null（用户取消）
          // 3. 对象 { path: string }（某些配置下）
          let path: string | null = null;

          if (typeof selected === 'string') {
            path = selected;
          } else if (selected && typeof selected === 'object') {
            // 检查是否是数组（multiple: true 时）
            const selectedObj = selected as unknown;
            if (Array.isArray(selectedObj) && (selectedObj as unknown[]).length > 0) {
              const first = (selectedObj as unknown[])[0];
              path = typeof first === 'string' ? first : (first as Record<string, unknown>).path as string;
            } else {
              path = ((selectedObj as Record<string, unknown>).path as string) || null;
            }
          }

          console.log('[Sidebar] 提取的路径:', path);

          if (path) {
            console.log('[Sidebar] 调用 setCurrentDirectory...');
            setCurrentDirectory(path);
            console.log('[Sidebar] setCurrentDirectory 调用完成');
            console.log('[Sidebar] 调用后 store.currentDirectory:', useFileStore.getState().currentDirectory);
            success(`已打开目录: ${path}`);

            // 强制检查 store 状态
            setTimeout(() => {
              console.log('[Sidebar] 500ms 后检查 store.currentDirectory:', useFileStore.getState().currentDirectory);
            }, 500);
          } else {
            console.log('[Sidebar] 无法从返回值中提取路径');
            warning('无法获取选择的目录路径');
          }
        } else {
          console.log('[Sidebar] 用户取消了选择');
        }
      } else {
        warning('仅在 Tauri 环境中支持打开目录');
      }
    } catch (err) {
      console.error('[Sidebar] 打开目录失败:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      warning(`打开目录失败: ${errorMessage}`);
    }
  };

  if (isCollapsed) {
    return (
      <div className={`w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 ${className}`}>
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          title="展开侧边栏"
        >
          <FiChevronRight size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={`w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${className}`}>
      {/* Header with Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center flex-1">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'files'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiFile size={16} />
            资源管理器
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium transition-colors ${
              activeTab === 'outline'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <FiList size={16} />
            大纲
          </button>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="折叠侧边栏"
        >
          <FiChevronLeft size={16} />
        </button>
      </div>

      {/* Directory Actions */}
      {activeTab === 'files' && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={handleOpenDirectory}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <FiHome size={16} />
            {currentDirectory ? currentDirectory.split('/').pop() || currentDirectory : '选择工作目录'}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' ? (
          <FileTree
            initialPath={currentDirectory || undefined}
            highlightedPath={highlightedPath || undefined}
            onDirectorySelect={handleDirectorySelect}
          />
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="space-y-2">
              <FiList size={48} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentFile ? '打开一个文件以查看大纲' : '打开文件以查看大纲'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
