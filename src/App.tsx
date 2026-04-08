import { MainLayout } from './components/layout/MainLayout';
import { CherryEditor } from './components/editor/CherryEditor';
import { SettingsDialog, ExportDialog, WelcomeDialog, FileOpenDialog } from './components/dialogs';
import { useFileStore } from './stores/fileStore';
import { useUIStore } from './stores/uiStore';
import { useAutoSave } from './hooks/useAutoSave';
import { useEffect, useState, useCallback, useRef } from 'react';
import { ToastContainer, useToast } from './components/ui/Toast';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { path } from '@tauri-apps/api';
import './App.css';

function App() {
  const { openFile, setCurrentDirectory, setHighlightedPath } = useFileStore();
  const { openSearch } = useUIStore();
  const { success, error } = useToast();
  const [initialized, setInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [fileOpened, setFileOpened] = useState(false);

  // 🔴 文件打开队列管理 - 防止对话框叠加
  const [currentDialogFile, setCurrentDialogFile] = useState<string | null>(null);
  // 去重标记：防止同一个文件重复触发（使用 ref 避免重渲染）
  const processedFilesRef = useRef<Set<string>>(new Set());

  // 🔴 读取并打开文件的辅助函数（定义在 enqueueFileDialog 之前，避免循环依赖）
  const openFilePath = useCallback(async (filePath: string): Promise<boolean> => {
    const { currentFile } = useFileStore.getState();

    // 🔴 去重：如果已经是当前打开的文件，不重复打开
    if (currentFile?.path === filePath) {
      console.log('[App] 文件已打开，忽略:', filePath);
      return false;
    }

    try {
      const content = await invoke<string>('read_file', { path: filePath });
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

      openFile({
        path: filePath,
        name: fileName,
        content,
        modified: false,
      });

      const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
      if (dirPath) {
        setCurrentDirectory(dirPath);
      }

      setHighlightedPath(filePath);
      success(`已打开：${fileName}`);
      console.log('[App] 文件打开成功:', filePath);
      return true;
    } catch (err) {
      console.error('[App] 打开文件失败:', err);
      error(`打开文件失败：${err}`);
      return false;
    }
  }, [openFile, setCurrentDirectory, setHighlightedPath, success, error]);

  // 🔴 将文件加入队列并显示对话框（去重 + 限制长度 + 目录判断）
  const enqueueFileDialog = useCallback((filePath: string) => {
    const { currentFile, currentDirectory } = useFileStore.getState();

    // 🔴 关键修复：如果文件已经是当前打开的文件，直接忽略
    if (currentFile?.path === filePath) {
      console.log('[App] 文件已打开，忽略入队:', filePath);
      return;
    }

    // 🔴 关键新增：比较目录，同目录直接打开，不同目录才弹窗
    const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
    const isSameDirectory = currentDirectory === fileDir;

    console.log('[App] 目录比较:', { fileDir, currentDirectory, isSameDirectory });

    if (isSameDirectory) {
      // 同目录，直接打开不弹窗
      console.log('[App] 同目录，直接打开:', filePath);
      openFilePath(filePath);
      return;
    }

    // 🔴 去重：如果这个文件已经处理过，忽略
    if (processedFilesRef.current.has(filePath)) {
      console.log('[App] 文件已处理，忽略:', filePath);
      return;
    }
    processedFilesRef.current.add(filePath);

    setCurrentDialogFile(prev => {
      // 如果当前显示的就是这个文件，忽略
      if (prev === filePath) {
        return prev;
      }
      // 如果当前无对话框，直接显示
      if (prev === null) {
        return filePath;
      }
      // 已有对话框，忽略新文件（不队列，直接丢弃）
      console.log('[App] 已有对话框，忽略:', filePath);
      return prev;
    });
  }, [openFilePath]);

  // 🔴 启用自动保存
  useAutoSave();

  // 🔴 处理对话框关闭，清空去重标记
  const handleDialogClose = useCallback(() => {
    setCurrentDialogFile(null);
    // 清空去重标记，允许下次打开
    processedFilesRef.current = new Set();
  }, []);

  // 🔴 在当前窗口打开
  const handleOpenInCurrent = useCallback(async () => {
    if (currentDialogFile) {
      await openFilePath(currentDialogFile);
    }
    handleDialogClose();
  }, [currentDialogFile, openFilePath, handleDialogClose]);

  // 🔴 监听文件打开事件（首次启动）
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupListener = async () => {
      const unlisten = await listen<string>('file-opened', async (event) => {
        const filePath = event.payload;
        console.log('[App] 收到文件打开事件 (file-opened):', filePath);
        setFileOpened(true);
        // 直接用当前最新的 openFilePath 引用（不依赖 useCallback）
        await openFilePath(filePath);
      });

      cleanup = unlisten;
    };

    setupListener();

    return () => {
      cleanup?.();
    };
  }, []); // 空依赖，只注册一次

  // 🔴 监听外部文件打开事件（应用已运行时）
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupListener = async () => {
      const unlisten = await listen<string>('file-opened-external', async (event) => {
        const filePath = event.payload;
        console.log('[App] 收到外部文件打开事件 (file-opened-external):', filePath);

        // 使用队列函数处理
        enqueueFileDialog(filePath);
      });

      cleanup = unlisten;
    };

    setupListener();

    return () => {
      cleanup?.();
    };
  }, []); // 空依赖，只注册一次

  // 初始化时打开一个示例文件（仅在没有通过双击打开文件时）
  useEffect(() => {
    if (initialized || fileOpened) return;

    const timer = setTimeout(() => {
      const sampleFile = {
        path: '/untitled.md',
        name: 'untitled.md',
        modified: false,
        content: '# 欢迎使用 Minidoc 📝\n\n这是一个现代化的 Markdown 编辑器。\n\n## 主要功能\n\n- ✅ **实时预览** - 左侧编辑，右侧实时预览\n- ✅ **文件管理** - 完整的文件树和管理功能\n- ✅ **语法高亮** - 美观的 Markdown 渲染\n\n## 开始使用\n\n1. 在左侧输入 Markdown 内容\n2. 右侧实时查看预览效果\n3. 使用快捷键提高效率\n  - **Cmd/Ctrl + S** - 保存文件\n  - **Cmd/Ctrl + B** - 加粗\n  - **Cmd/Ctrl + I** - 斜体\n\n## 示例代码\n\n```javascript\nfunction hello() {\n  console.log("Hello, Minidoc!");\n}\n```\n\n> 💡 提示：这是一个简洁优雅的编辑器\n\n---\n**享受写作的乐趣！**',
      };
      openFile(sampleFile);
      setInitialized(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, [initialized, fileOpened, openFile]);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  // 监听 Tauri 原生拖拽放下事件
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupListener = async () => {
      const unlisten = await listen<string>('drag-drop-opened', async (event) => {
        const filePath = event.payload;
        console.log('[App] 收到原生拖拽放下事件:', filePath);

        try {
          const isDirectory = await invoke<boolean>('is_directory', { path: filePath });

          if (isDirectory) {
            setCurrentDirectory(filePath);
            setHighlightedPath(null);
            const dirName = filePath.split('/').pop() || filePath;
            success(`已加载目录：${dirName}`);
          } else {
            const ext = await path.extname(filePath);
            const isMarkdown = ['md', 'markdown', 'mkd', 'mdwn'].includes(ext.toLowerCase()) || ['.md', '.markdown', '.mkd', '.mdwn'].includes(ext.toLowerCase());

            if (!isMarkdown) {
              error(`不支持的文件类型：${ext}，仅支持 Markdown 文件`);
              return;
            }

            const content = await invoke<string>('read_file', { path: filePath });
            const fileName = await path.basename(filePath);
            const dirPath = await path.dirname(filePath);

            openFile({
              path: filePath,
              name: fileName,
              content,
              modified: false,
            });

            setCurrentDirectory(dirPath);
            setHighlightedPath(filePath);
            success(`已打开：${fileName}`);
          }
        } catch (err) {
          console.error('[App] 处理拖拽失败:', err);
          const errMsg = err instanceof Error ? err.message : String(err);
          error(`处理拖拽失败：${errMsg}`);
        }
      });

      cleanup = unlisten;
    };

    setupListener();

    return () => {
      cleanup?.();
    };
  }, [openFile, setCurrentDirectory, setHighlightedPath, success, error]);

  // 处理拖拽视觉反馈
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <>
      <div
        className={`fixed inset-0 relative min-h-screen w-full ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 拖拽释放遮罩 */}
        {isDragging && (
          <div className="fixed inset-0 bg-blue-500/20 border-2 border-blue-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white dark:bg-gray-800 px-8 py-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
                释放以打开
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">
                释放文件或文件夹即可在 Minidoc 中打开
              </p>
            </div>
          </div>
        )}

        <MainLayout>
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
            <CherryEditor className="flex-1" />
          </div>
        </MainLayout>

        {/* Dialogs */}
        <SettingsDialog />
        <ExportDialog />
        <WelcomeDialog />

        {/* 文件打开对话框（应用已运行时）- 使用队列确保只有一个实例 */}
        {currentDialogFile && (
          <FileOpenDialog
            filePath={currentDialogFile}
            onOpenInCurrent={handleOpenInCurrent}
            onClose={handleDialogClose}
          />
        )}

        {/* Toast Notifications */}
        <ToastContainer />
      </div>
    </>
  );
}

export default App;
