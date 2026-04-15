import { FiFilePlus, FiFolder, FiSave, FiMoon, FiSettings, FiSun, FiEye } from 'react-icons/fi';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUIStore } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useEditorStore } from '@/stores/editorStore';
import { useEffect } from 'react';
import { useToast } from '../ui/Toast';
import { isTauri } from '@/utils/tauri-env';

export function Toolbar() {
  const { settings, toggleTheme } = useSettingsStore();
  const { openSettings } = useUIStore();
  const { openFile, saveFile, isSaving, currentFile, revealInExplorer, setHighlightedPath, currentDirectory, saveFileAs, triggerRefresh } = useFileStore();
  const { success, warning, error } = useToast();
  const isPreviewOnly = useEditorStore(state => state.isPreviewOnly);
  const togglePreviewOnly = useEditorStore(state => state.togglePreviewOnly);

  const handleNewFile = async () => {
    console.log('[Toolbar] 创建新文件');

    if (!currentDirectory) {
      warning('请先选择一个目录');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { join } = await import('@tauri-apps/api/path');

      // 生成文件名和路径
      const fileName = `untitled-${Date.now()}.md`;
      const filePath = await join(currentDirectory, fileName);

      // 🔴 核心：立即创建空文件到磁盘
      await invoke('write_file', {
        path: filePath,
        content: '',
      });

      // 打开这个文件
      openFile({
        path: filePath,
        name: fileName,
        content: '',
        modified: false,
      });

      // 🔴 修复：使用 triggerRefresh 强制刷新资源管理器
      triggerRefresh();
      setHighlightedPath(filePath);

      success(`已创建: ${fileName}`);
      console.log('[Toolbar] 新文件已创建:', filePath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[Toolbar] 创建文件失败:', errorMessage);
      error(`创建文件失败: ${errorMessage}`);
    }
  };

  const handleOpenFile = async () => {
    console.log('[Toolbar] 打开文件');

    try {
      if (isTauri()) {
        // 使用 Tauri 文件对话框
        const { open } = await import('@tauri-apps/plugin-dialog');

        const selected = await open({
          multiple: false,
          filters: [{
            name: 'Markdown',
            extensions: ['md', 'markdown', 'txt']
          }]
        });

        if (selected && typeof selected === 'string') {
          // 使用 Rust 后端读取文件
          const { invoke } = await import('@tauri-apps/api/core');
          const content = await invoke<string>('read_file', { path: selected });

          const fileName = selected.split('/').pop() || selected.split('\\').pop() || 'unknown';

          openFile({
            path: selected,
            name: fileName,
            content,
            modified: false,
          });

          revealInExplorer(selected); // 联动资源管理器定位
          success(`已打开: ${fileName}`);
        }
      } else {
        // 浏览器环境：使用 input 元素
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.md,.markdown,.txt,text/markdown,text/plain';

        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;

          try {
            const content = await file.text();
            openFile({
              path: file.name,
              name: file.name,
              content,
              modified: false,
            });
            setHighlightedPath(file.name); // 联动资源管理器
            success(`已打开: ${file.name}`);
          } catch (err) {
            console.error('读取文件失败:', err);
            error('读取文件失败');
          }
        };

        input.click();
      }
    } catch (err) {
      console.error('打开文件失败:', err);
      error('打开文件失败');
    }
  };

  const handleSave = async () => {
    console.log('[Toolbar] 保存文件');

    if (!currentFile) {
      warning('没有打开的文件');
      return;
    }

    // 新文件（未保存过）需要选择保存位置
    if (currentFile.path.startsWith('untitled-')) {
      if (isTauri()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const savePath = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: currentDirectory || undefined
        });

        if (savePath) {
          await saveFileAs(savePath);
        }
      } else {
        warning('浏览器环境暂不支持保存新文件');
      }
    } else {
      await saveFile();
    }
  };

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S 保存
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        console.log('[Toolbar] Cmd/Ctrl+S 快捷键触发');
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentFile]); // 依赖 currentFile 以获取最新状态

  return (
    <div className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-4 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-3 pr-4 border-r border-gray-200 dark:border-gray-700">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-lg">M</span>
        </div>
        <span className="font-semibold text-gray-800 dark:text-gray-100 text-lg">Minidoc</span>
      </div>

      {/* File Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleNewFile}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 rounded-lg transition-colors"
          title="新建文件 (Cmd/Ctrl+N)"
        >
          <FiFilePlus size={18} />
        </button>
        <button
          onClick={handleOpenFile}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 rounded-lg transition-colors"
          title="打开文件 (Cmd/Ctrl+O)"
        >
          <FiFolder size={18} />
        </button>
        <button
          onClick={handleSave}
          disabled={!currentFile || isSaving}
          className={`p-2 rounded-lg transition-colors ${
            !currentFile
              ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : isSaving
              ? 'text-blue-500 animate-spin'
              : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600'
          }`}
          title={`保存文件 ${currentFile?.modified ? '(已修改)' : ''} (Cmd/Ctrl+S)`}
        >
          <FiSave size={18} />
        </button>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

      {/* 文件名显示 */}
      <div className="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate">
        {currentFile ? currentFile.name : '未打开文件'}
        {currentFile?.modified && <span className="ml-1 text-orange-500">*</span>}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-1">
        {/* 预览模式切换按钮 */}
        <button
          onClick={togglePreviewOnly}
          className={`p-2 rounded-lg transition-colors ${
            isPreviewOnly
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={isPreviewOnly ? '切换到分屏模式' : '切换到预览模式'}
        >
          <FiEye size={18} />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="切换主题"
        >
          {settings.theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
        </button>
        <button
          onClick={openSettings}
          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="设置"
        >
          <FiSettings size={18} />
        </button>
      </div>
    </div>
  );
}
