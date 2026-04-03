import { MainLayout } from './components/layout/MainLayout';
import { CherryEditor } from './components/editor/CherryEditor';
import { SettingsDialog, ExportDialog, WelcomeDialog } from './components/dialogs';
import { useFileStore } from './stores/fileStore';
import { useUIStore } from './stores/uiStore';
import { useAutoSave } from './hooks/useAutoSave';
import { useEffect, useState } from 'react';
import { ToastContainer, useToast } from './components/ui/Toast';
import './App.css';

function App() {
  const { openFile, setCurrentDirectory, setHighlightedPath } = useFileStore();
  const { openSearch } = useUIStore();
  const { success, error } = useToast();
  const [initialized, setInitialized] = useState(false);

  // 🔴 启用自动保存
  useAutoSave();

  // 🔴 监听双击打开文件事件
  useEffect(() => {
    const unlisten = import('@tauri-apps/api/event').then(({ listen }) => {
      return listen<string>('file-opened', async (event) => {
        const filePath = event.payload;
        console.log('[App] 收到文件打开事件:', filePath);

        try {
          // 读取文件内容
          const { invoke } = await import('@tauri-apps/api/core');
          const content = await invoke<string>('read_file', { path: filePath });

          // 提取文件名
          const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

          // 打开文件
          openFile({
            path: filePath,
            name: fileName,
            content,
            modified: false,
          });

          // 设置资源管理器目录为文件所在目录
          const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
          if (dirPath) {
            setCurrentDirectory(dirPath);
          }

          // 高亮当前文件
          setHighlightedPath(filePath);

          success(`已打开: ${fileName}`);
          console.log('[App] 文件打开成功:', filePath);
        } catch (err) {
          console.error('[App] 打开文件失败:', err);
          error(`打开文件失败: ${err}`);
        }
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openFile, setCurrentDirectory, setHighlightedPath, success, error]);

  // 初始化时打开一个示例文件（仅在没有通过双击打开文件时）
  useEffect(() => {
    if (initialized) return;

    // 延迟检查，等待 file-opened 事件
    const timer = setTimeout(() => {
      const sampleFile = {
        path: '/untitled.md',
        name: 'untitled.md',
        modified: false,
        content: `# 欢迎使用 Minidoc 📝

这是一个现代化的 Markdown 编辑器。

## 主要功能

- ✅ **实时预览** - 左侧编辑，右侧实时预览
- ✅ **文件管理** - 完整的文件树和管理功能
- ✅ **语法高亮** - 美观的 Markdown 渲染

## 开始使用

1. 在左侧输入 Markdown 内容
2. 右侧实时查看预览效果
3. 使用快捷键提高效率
  - **Cmd/Ctrl + S** - 保存文件
  - **Cmd/Ctrl + B** - 加粗
  - **Cmd/Ctrl + I** - 斜体

## 示例代码

\`\`\`javascript
function hello() {
  console.log("Hello, Minidoc!");
}
\`\`\`

> 💡 提示：这是一个简洁优雅的编辑器

---
**享受写作的乐趣！**
`
      };
      openFile(sampleFile);
      setInitialized(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [initialized, openFile]);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F 打开搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        openSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  return (
    <>
      <MainLayout>
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
          <CherryEditor className="flex-1" />
        </div>
      </MainLayout>

      {/* Dialogs */}
      <SettingsDialog />
      <ExportDialog />
      <WelcomeDialog />

      {/* Toast Notifications */}
      <ToastContainer />
    </>
  );
}

export default App;
