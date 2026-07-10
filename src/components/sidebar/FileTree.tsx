import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Loader2, Check, X } from 'lucide-react';
import { useFileStore } from '../../stores/fileStore';
import { useToastStore } from '../ui/Toast';
import { isTauri } from '../../utils/tauri-env';

export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemItem[];
  size?: number;
  modified?: string;
}

export interface FileTreeRef {
  revealFile: (filePath: string) => Promise<void>;
}

interface FileTreeProps {
  initialPath?: string;
  onDirectorySelect?: (path: string) => void;
  highlightedPath?: string;
}

// 目录加载状态管理
interface DirectoryState {
  isLoading: boolean;
  isLoaded: boolean;
  children: FileSystemItem[] | null;
  error: string | null;
}

// 文件缓存（避免重复加载）
const fileCache = new Map<string, string>();

export const FileTree = forwardRef<FileTreeRef, FileTreeProps>(
  function FileTree({ initialPath, onDirectorySelect, highlightedPath }, ref) {
  // 🔴 修复：使用解构方式订阅，确保与 Sidebar 一致
  const {
    currentDirectory,
    openFile,
    currentFile,
    setCurrentDirectory,
    refreshVersion,  // 🔴 新增：监听刷新计数器
    triggerRefresh,  // 🔴 新增：刷新资源管理器
    setHighlightedPath,  // 🔴 新增：高亮路径
  } = useFileStore();
  const { addToast } = useToastStore();

  // 🔴 Toast 辅助函数
  const success = (msg: string) => addToast({ type: 'success', message: msg });
  const error = (msg: string) => addToast({ type: 'error', message: msg });
  const warning = (msg: string) => addToast({ type: 'warning', message: msg });

  // 使用 store 中的路径
  const effectivePath = currentDirectory || initialPath;

  // 渲染日志（调试用，生产环境可移除）
  useEffect(() => {
    console.log('[FileTree] 初始化完成，currentDirectory:', currentDirectory);
  }, [currentDirectory]);

  // 🔴 保存/恢复侧边栏滚动位置
  useEffect(() => {
    const prevDir = prevDirectoryRef.current;
    const container = sidebarScrollRef.current;
    if (!container) return;

    // 保存上一个目录的滚动位置
    if (prevDir) {
      sidebarScrollPosRef.current.set(prevDir, container.scrollTop);
    }

    // 恢复当前目录的滚动位置（延迟确保 DOM 已渲染）
    const savedScroll = sidebarScrollPosRef.current.get(effectivePath || '');
    if (savedScroll !== undefined) {
      setTimeout(() => {
        container.scrollTop = savedScroll;
        console.log('[FileTree] 恢复侧边栏滚动位置:', effectivePath, savedScroll);
      }, 100);
    }

    prevDirectoryRef.current = effectivePath || null;
  }, [effectivePath]);

  // 目录状态管理
  const [directoryStates, setDirectoryStates] = useState<Map<string, DirectoryState>>(new Map());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootItems, setRootItems] = useState<FileSystemItem[]>([]);
  const [currentRoot, setCurrentRoot] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState<string>('');

  // 🔴 新增：右键菜单和删除确认状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: FileSystemItem | null;  // null 表示空白区域
    type: 'file' | 'folder' | 'empty';  // 点击目标类型
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    item: FileSystemItem;
    onConfirm: () => void;
  } | null>(null);

  // 使用 ref 避免递归调用
  const isLoadingRef = useRef<Map<string, boolean>>(new Map());
  const treeNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 🔴 新增：侧边栏滚动位置记录
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollPosRef = useRef<Map<string, number>>(new Map());
  const prevDirectoryRef = useRef<string | null>(null);
  const lastLoadedPathRef = useRef<string | null>(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    revealFile: async (filePath: string) => {
      console.log(`[FileTree] revealFile 被调用: ${filePath}`);

      if (!isTauri()) {
        addToast({
          type: 'error',
          message: '当前不在 Tauri 环境，无法定位文件',
        });
        return;
      }

      try {
        // 获取文件的父目录
        const { dirname } = await import('@tauri-apps/api/path');
        const parentDir = await dirname(filePath);

        console.log(`[FileTree] revealFile 设置目录: ${parentDir}`);

        // 🔴 核心修复：只调用 setCurrentDirectory，让 useEffect 统一处理加载
        // 不再手动调用 loadDirectory 和设置内部状态
        setCurrentDirectory(parentDir);

        // 等待目录加载完成（最多 5 秒）
        const startTime = Date.now();
        const maxWait = 5000;

        while (Date.now() - startTime < maxWait) {
          // 检查 isInitialized 和 currentRoot 是否已更新
          if (isInitialized && currentRoot === parentDir) {
            console.log(`[FileTree] revealFile 目录已加载，耗时 ${Date.now() - startTime}ms`);
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 展开所有父目录并高亮目标文件
        await expandToFilePath(filePath);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[FileTree] revealFile 失败:', errorMessage);
        addToast({
          type: 'error',
          message: `定位文件失败: ${errorMessage}`,
        });
      }
    },
  }));

  // 展开到指定文件的路径
  const expandToFilePath = async (filePath: string): Promise<void> => {
    if (!isTauri()) return;

    try {
      const { join } = await import('@tauri-apps/api/path');

      // 获取根目录
      const rootDir = currentRoot || effectivePath;
      if (!rootDir) return;

      // 获取相对路径
      const relativePath = filePath.replace(rootDir + '/', '').replace(rootDir + '\\', '');
      const pathParts = relativePath.split(/[/\\]/);

      // 逐级展开目录
      let currentPath = rootDir;
      for (let i = 0; i < pathParts.length - 1; i++) {
        currentPath = await join(currentPath, pathParts[i]);

        // 展开目录
        if (!expandedFolders.has(currentPath)) {
          setExpandedFolders(prev => {
            const newSet = new Set(prev);
            newSet.add(currentPath);
            return newSet;
          });

          // 加载子目录
          const state = directoryStates.get(currentPath);
          if (!state?.isLoaded && !state?.isLoading) {
            await loadDirectory(currentPath);
          }
        }
      }

      // 滚动到目标文件
      setTimeout(() => {
        const targetElement = treeNodeRefs.current.get(filePath);
        if (targetElement && sidebarScrollRef.current) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 添加高亮动画
          targetElement.classList.add('highlight-pulse');
          setTimeout(() => {
            targetElement.classList.remove('highlight-pulse');
          }, 2000);
        }
      }, 300);

    } catch (err) {
      console.error('[FileTree] expandToFilePath 失败:', err);
    }
  };

  console.log('[FileTree] 组件状态:', {
    isInitialized,
    currentRoot,
    rootItemsCount: rootItems.length,
    expandedFoldersCount: expandedFolders.size,
    directoryStatesCount: directoryStates.size,
    currentDirectory,
    lastLoadedPath: lastLoadedPathRef.current,
    isLoading,
  });

  /**
   * 加载目录内容
   */
  const loadDirectory = useCallback(async (path: string, isRoot = false, forceRefresh = false): Promise<FileSystemItem[]> => {
    console.log(`[FileTree] loadDirectory 被调用: ${path}, isRoot: ${isRoot}, forceRefresh: ${forceRefresh}`);

    // 🔴 修复：强制刷新时绕过防重复加载
    if (!forceRefresh && isLoadingRef.current.has(path) && isLoadingRef.current.get(path)) {
      console.log(`[FileTree] 跳过重复加载: ${path}`);
      return [];
    }

    isLoadingRef.current.set(path, true);

    // 更新目录状态为加载中
    setDirectoryStates(prev => {
      const newMap = new Map(prev);
      newMap.set(path, {
        isLoading: true,
        isLoaded: false,
        children: null,
        error: null,
      });
      return newMap;
    });

    try {
      if (!isTauri()) {
        console.warn('[FileTree] 不在 Tauri 环境中，无法加载真实目录');
        throw new Error('当前不在 Tauri 环境，无法加载文件系统');
      }

      const { invoke } = await import('@tauri-apps/api/core');
      console.log(`[FileTree] 调用 read_directory: ${path}`);

      const result = await invoke<FileInfo[]>('read_directory', {
        path,
        recursive: false, // 使用非递归模式，按需加载子目录
        include_hidden: false,
      });

      console.log(`[FileTree] read_directory 返回 ${result.length} 项`);

      // 转换为前端格式 - 只显示 .md 文件和目录
      const items: FileSystemItem[] = result
        .filter(info => info.is_dir || info.name.endsWith('.md'))
        .map(info => ({
          name: info.name,
          path: info.path,
          type: info.is_dir ? 'directory' : 'file',
          children: info.is_dir ? [] : undefined,
          size: info.size,
          modified: info.modified ? new Date(info.modified * 1000).toISOString() : undefined,
        }));

      // 更新目录状态为已加载
      setDirectoryStates(prev => {
        const newMap = new Map(prev);
        newMap.set(path, {
          isLoading: false,
          isLoaded: true,
          children: items,
          error: null,
        });
        return newMap;
      });

      console.log(`[FileTree] 目录加载成功: ${path}, 项数: ${items.length}`);
      return items;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[FileTree] 加载目录失败: ${path}, 错误:`, errorMessage);

      // 更新目录状态为错误
      setDirectoryStates(prev => {
        const newMap = new Map(prev);
        newMap.set(path, {
          isLoading: false,
          isLoaded: false,
          children: null,
          error: errorMessage,
        });
        return newMap;
      });

      addToast({
        type: 'error',
        message: `加载目录失败: ${errorMessage}`,
      });
      return [];
    } finally {
      isLoadingRef.current.set(path, false);
    }
  }, [addToast]);

  /**
   * 🔴 核心逻辑：当 currentDirectory 变化或 refreshVersion 变化时，加载目录
   * refreshVersion 用于强制刷新（新建/删除文件后）
   */
  useEffect(() => {
    // 空路径处理
    if (!currentDirectory) {
      console.log('[FileTree] currentDirectory 为空，重置状态');
      setIsInitialized(false);
      setRootItems([]);
      setCurrentRoot(null);
      lastLoadedPathRef.current = null;
      return;
    }

    // 🔴 修复：路径没变但 refreshVersion 变了 = 强制刷新
    const isForceRefresh = currentDirectory === lastLoadedPathRef.current;
    if (isForceRefresh) {
      console.log('[FileTree] 🔄 强制刷新（refreshVersion:', refreshVersion, '）');
    } else {
      console.log('[FileTree] 🔄 检测到目录变化:', {
        from: lastLoadedPathRef.current,
        to: currentDirectory
      });
    }

    // 🔴 修复：使用立即执行异步函数，避免 isLoading 依赖问题
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        // 🔴 强制刷新时不清空状态，只重新加载
        if (!isForceRefresh) {
          setIsInitialized(false);
          setRootItems([]);
          setExpandedFolders(new Set());
          setDirectoryStates(new Map());
        }

        const items = await loadDirectory(currentDirectory, true, isForceRefresh);

        if (cancelled) return;

        console.log('[FileTree] ✅ 加载完成:', currentDirectory, '共', items.length, '项');
        setRootItems(items);
        setCurrentRoot(currentDirectory);
        setIsInitialized(true);
        lastLoadedPathRef.current = currentDirectory;

        // 🔴 强制刷新时不显示 toast
        if (!isForceRefresh && items.length > 0) {
          addToast({ type: 'success', message: `已加载: ${currentDirectory.split('/').pop()}` });
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[FileTree] ❌ 加载失败:', err);
        addToast({ type: 'error', message: `加载失败: ${err}` });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [currentDirectory, refreshVersion, loadDirectory, addToast]);

  /**
   * 展开/折叠目录
   */
  const toggleFolder = useCallback(async (path: string) => {
    console.log(`[FileTree] toggleFolder: ${path}`);

    const isExpanded = expandedFolders.has(path);

    if (isExpanded) {
      // 折叠：从展开集合中移除
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(path);
        return newSet;
      });
    } else {
      // 展开：添加到展开集合，并加载子目录（如果尚未加载）
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.add(path);
        return newSet;
      });

      // 检查是否已加载
      const state = directoryStates.get(path);
      if (!state?.isLoaded && !state?.isLoading) {
        console.log(`[FileTree] 展开目录时加载子项: ${path}`);
        await loadDirectory(path);
      }
    }
  }, [expandedFolders, directoryStates, loadDirectory]);

  /**
   * 处理目录点击（用于选择工作目录）
   */
  const handleDirectoryClick = useCallback((path: string) => {
    console.log(`[FileTree] handleDirectoryClick: ${path}`);
    if (onDirectorySelect) {
      onDirectorySelect(path);
    }
  }, [onDirectorySelect]);

  /**
   * 处理文件双击重命名
   */
  const handleFileDoubleClick = useCallback((item: FileSystemItem) => {
    if (item.type !== 'file') return;
    console.log(`[FileTree] 双击文件重命名: ${item.path}`);
    setRenamingPath(item.path);
    setNewName(item.name.replace('.md', '')); // 移除 .md 后缀显示
  }, []);

  /**
   * 保存重命名
   */
  const saveRename = useCallback(async () => {
    if (!renamingPath || !newName.trim()) {
      // 🔴 修复：空名称时取消重命名
      setRenamingPath(null);
      setNewName('');
      return;
    }

    // 🔴 修复：检查文件名是否真的改变了
    const originalName = renamingPath.split('/').pop() || '';
    // 🔴 修复：文件夹不加 .md 后缀，文件加
    const isDirectory = !originalName.endsWith('.md');
    const finalNewName = isDirectory ? newName : (newName.endsWith('.md') ? newName : `${newName}.md`);

    if (originalName === finalNewName) {
      // 文件名没变，直接取消重命名状态，不调用后端
      console.log('[FileTree] 文件名未改变，取消重命名:', originalName);
      setRenamingPath(null);
      setNewName('');
      return;
    }

    // 🔴 修复：先保存当前状态，用于失败时恢复
    const currentRenamingPath = renamingPath;
    const currentNewName = newName;

    // 🔴 修复：立即清除重命名状态，避免 UI 状态不一致
    setRenamingPath(null);
    setNewName('');

    try {
      if (!isTauri()) {
        throw new Error('当前不在 Tauri 环境，无法重命名文件');
      }

      const { invoke } = await import('@tauri-apps/api/core');
      const { dirname, join } = await import('@tauri-apps/api/path');

      // 获取父目录并构建完整新路径
      const parentDir = await dirname(currentRenamingPath);
      const newPath = await join(parentDir, finalNewName);

      console.log(`[FileTree] 重命名文件: ${currentRenamingPath} -> ${newPath}`);

      await invoke('rename_file', {
        oldPath: currentRenamingPath,
        newPath: newPath,
      });

      addToast({
        type: 'success',
        message: '重命名成功',
      });

      // 🔴 修复：刷新目录后更新 rootItems
      const isParentRoot = parentDir === currentRoot;
      const items = await loadDirectory(parentDir, isParentRoot);

      // 如果是根目录，需要更新 rootItems
      if (isParentRoot && items.length >= 0) {
        console.log('[FileTree] 重命名后刷新根目录，项目数:', items.length);
        setRootItems(items);
      }

      // 如果重命名的是当前打开的文件，更新文件引用
      if (currentFile?.path === currentRenamingPath) {
        // 通知 fileStore 更新文件路径
        const { useFileStore } = await import('../../stores/fileStore');
        const store = useFileStore.getState();
        store.openFile({
          path: newPath,
          name: finalNewName,
          content: store.currentFile?.content || '',
          modified: store.currentFile?.modified || false,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[FileTree] 重命名失败:', errorMessage);
      addToast({
        type: 'error',
        message: `重命名失败: ${errorMessage}`,
      });
      // 🔴 修复：失败时恢复重命名状态，让用户可以修改后重试
      setRenamingPath(currentRenamingPath);
      setNewName(currentNewName);
    }
  }, [renamingPath, newName, currentRoot, loadDirectory, addToast, currentFile]);

  /**
   * 取消重命名
   */
  const cancelRename = useCallback(() => {
    setRenamingPath(null);
    setNewName('');
  }, []);

  /**
   * 处理重命名输入框键盘事件
   */
  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  }, [saveRename, cancelRename]);

  /**
   * 🔴 新增：处理右键菜单
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, item: FileSystemItem) => {
    e.preventDefault();
    e.stopPropagation();
    const type = item.type === 'directory' ? 'folder' : 'file';
    setContextMenu({ x: e.clientX, y: e.clientY, item, type });
  }, []);

  /**
   * 🔴 新增：空白区域右键菜单
   */
  const handleEmptyContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[FileTree] 空白区域右键，currentDirectory:', currentDirectory);
    if (!currentDirectory) {
      warning('请先选择一个目录');
      return;
    }
    setContextMenu({ x: e.clientX, y: e.clientY, item: null, type: 'empty' });
  }, [currentDirectory, warning]);

  /**
   * 🔴 新增：关闭右键菜单
   */
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * 🔴 新增：新建文件
   */
  const handleNewFile = useCallback(async (targetPath: string) => {
    if (!targetPath) {
      warning('请先选择一个目录');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { join } = await import('@tauri-apps/api/path');

      const fileName = `untitled-${Date.now()}.md`;
      const filePath = await join(targetPath, fileName);

      await invoke('write_file', { path: filePath, content: '' });

      openFile({ path: filePath, name: fileName, content: '', modified: false });
      closeContextMenu();

      // 🔴 如果 targetPath 不是当前根目录，需要展开该目录并加载
      if (targetPath !== currentDirectory) {
        // 展开目录
        setExpandedFolders(prev => {
          const newSet = new Set(prev);
          newSet.add(targetPath);
          return newSet;
        });
        // 加载该目录内容
        await loadDirectory(targetPath, false, true);
      } else {
        // 根目录，直接刷新
        triggerRefresh();
      }

      setHighlightedPath(filePath);

      // 🔴 新建后直接进入重命名模式
      setRenamingPath(filePath);
      setNewName('untitled');

      success(`已创建: ${fileName}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`创建文件失败: ${errorMessage}`);
    }
  }, [openFile, triggerRefresh, setHighlightedPath, success, error, warning, closeContextMenu, currentDirectory, loadDirectory, setExpandedFolders]);

  /**
   * 🔴 新增：新建文件夹
   */
  const handleNewFolder = useCallback(async (targetPath: string) => {
    if (!targetPath) {
      warning('请先选择一个目录');
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { join } = await import('@tauri-apps/api/path');

      const folderName = `新建文件夹-${Date.now()}`;
      const folderPath = await join(targetPath, folderName);

      await invoke('create_directory', { path: folderPath });

      closeContextMenu();

      // 🔴 如果 targetPath 不是当前根目录，需要展开该目录并加载
      if (targetPath !== currentDirectory) {
        // 展开目录
        setExpandedFolders(prev => {
          const newSet = new Set(prev);
          newSet.add(targetPath);
          return newSet;
        });
        // 加载该目录内容
        await loadDirectory(targetPath, false, true);
      } else {
        // 根目录，直接刷新
        triggerRefresh();
      }

      // 🔴 新建后直接进入重命名模式
      setRenamingPath(folderPath);
      setNewName('新建文件夹');

      success(`已创建: ${folderName}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error(`创建文件夹失败: ${errorMessage}`);
    }
  }, [triggerRefresh, success, error, warning, closeContextMenu, currentDirectory, loadDirectory, setExpandedFolders]);

  /**
   * 🔴 新增：处理删除
   */
  const handleDelete = useCallback(async (item: FileSystemItem) => {
    if (!isTauri()) {
      addToast({ type: 'error', message: '当前不在 Tauri 环境' });
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // 🔴 使用 trash_file 移动到回收站，而不是 delete_file 直接删除
      await invoke('trash_file', { path: item.path });

      addToast({ type: 'success', message: `已移至回收站: ${item.name}` });

      // 刷新目录
      const parentDir = item.path.substring(0, item.path.lastIndexOf('/'));
      const isParentRoot = parentDir === currentRoot;
      const items = await loadDirectory(parentDir, isParentRoot, true);
      if (isParentRoot) {
        setRootItems(items);
      }

      // 如果删除的是当前打开的文件，清空当前文件
      if (currentFile?.path === item.path) {
        const { useFileStore } = await import('../../stores/fileStore');
        useFileStore.getState().closeCurrentFile();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addToast({ type: 'error', message: `删除失败: ${errorMessage}` });
    }
  }, [addToast, currentRoot, loadDirectory, currentFile]);

  /**
   * 🔴 新增：显示删除确认
   */
  const showDeleteConfirm = useCallback((item: FileSystemItem) => {
    setDeleteConfirm({
      item,
      onConfirm: () => {
        handleDelete(item);
        setDeleteConfirm(null);
      },
    });
    setContextMenu(null);
  }, [handleDelete]);

  /**
   * 监听 highlightedPath 变化，自动滚动到对应文件
   */
  useEffect(() => {
    if (highlightedPath && isInitialized) {
      expandToFilePath(highlightedPath);
    }
  }, [highlightedPath, isInitialized]);

  /**
   * 处理文件点击
   */
  const handleFileClick = useCallback(async (item: FileSystemItem) => {
    console.log(`[FileTree] handleFileClick: ${item.path}`);

    if (item.type !== 'file') return;

    // 🔴 Sublime 风格：切换文件时自动保存未保存的修改，不弹窗
    if (currentFile?.modified && currentFile.path !== item.path) {
      try {
        const { invoke: invokeSave } = await import('@tauri-apps/api/core');
        await invokeSave('write_file', {
          path: currentFile.path,
          content: currentFile.content,
        });
        console.log('[FileTree] 自动保存未保存的修改:', currentFile.path);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addToast({
          type: 'error',
          message: `保存失败: ${errorMessage}`,
        });
        // 保存失败不切换文件
        return;
      }
    }

    // 加载文件内容
    try {
      if (!isTauri()) {
        throw new Error('当前不在 Tauri 环境，无法加载文件');
      }

      const { invoke } = await import('@tauri-apps/api/core');
      console.log(`[FileTree] 调用 read_file: ${item.path}`);

      // 🔴 获取磁盘文件的修改时间
      const diskMtime = await invoke<number>('get_file_mtime', { path: item.path });
      const cachedMtime = currentFile?.path === item.path ? (currentFile.fileMtime ?? 0) : 0;

      // 🔴 点击同一文件时，对比 mtime 判断是否有外部变化
      if (currentFile?.path === item.path && diskMtime <= cachedMtime) {
        console.log('[FileTree] 文件未变化（mtime 相同），跳过刷新');
        return;
      }

      const diskContent = await invoke<string>('read_file', { path: item.path });

      // 🔴 二次确认：内容也未变化，跳过（防御 mtime 精度问题）
      if (currentFile?.path === item.path && diskContent === currentFile.content) {
        // 更新 mtime 但不用重载
        console.log('[FileTree] 内容一致，跳过刷新');
        return;
      }

      console.log('[FileTree] 文件有外部变化，静默加载');

      // 缓存内容
      fileCache.set(item.path, diskContent);

      console.log(`[FileTree] 文件加载成功，内容长度: ${diskContent.length}`);

      openFile({
        path: item.path,
        name: item.name,
        content: diskContent,
        modified: false,
        fileMtime: diskMtime,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[FileTree] 加载文件失败: ${item.path}`, errorMessage);
      addToast({
        type: 'error',
        message: `加载文件失败: ${errorMessage}`,
      });
    }
  }, [openFile, addToast, currentFile]);

  /**
   * 获取文件图标
   */
  const getFileIcon = useCallback((name: string, type: 'file' | 'directory') => {
    if (type === 'directory') {
      return null; // 目录使用 Folder/FolderOpen 图标
    }

    const ext = name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      md: '📄',
      markdown: '📄',
      js: '📜',
      jsx: '⚛️',
      ts: '📘',
      tsx: '⚛️',
      css: '🎨',
      scss: '🎨',
      html: '🌐',
      json: '📋',
      xml: '📋',
      yaml: '⚙️',
      yml: '⚙️',
      txt: '📄',
      pdf: '📕',
      doc: '📘',
      docx: '📘',
      xls: '📊',
      xlsx: '📊',
      ppt: '📙',
      pptx: '📙',
      png: '🖼️',
      jpg: '🖼️',
      jpeg: '🖼️',
      gif: '🖼️',
      svg: '🎨',
      mp3: '🎵',
      mp4: '🎬',
      zip: '📦',
      rar: '📦',
    };

    return iconMap[ext || ''] || '📄';
  }, []);

  /**
   * 渲染文件树节点
   */
  const renderTreeNode = useCallback((items: FileSystemItem[], level: number = 0): React.ReactNode => {
    return items.map(item => {
      const state = directoryStates.get(item.path);
      const isDirectory = item.type === 'directory';
      const isExpanded = expandedFolders.has(item.path);
      const isLoading = state?.isLoading || false;
      const children = state?.children || item.children;
      const isHighlighted = highlightedPath === item.path;
      const isCurrentFile = currentFile?.path === item.path;
      const isRenaming = renamingPath === item.path;

      return (
        <div
          key={item.path}
          ref={(el) => {
            if (el && isHighlighted) {
              treeNodeRefs.current.set(item.path, el);
            }
          }}
          className="tree-node"
        >
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
              isHighlighted || isCurrentFile
                ? 'bg-blue-50 dark:bg-blue-900/20'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (isRenaming) return;
              if (isDirectory) {
                toggleFolder(item.path);
              } else {
                handleFileClick(item);
              }
            }}
            onDoubleClick={() => {
              if (isRenaming) return;
              if (isDirectory) {
                // 🔴 修复：双击文件夹展开/折叠，而不是加载目录
                toggleFolder(item.path);
              } else {
                handleFileDoubleClick(item);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              handleContextMenu(e, item);
            }}
          >
            {/* 展开/折叠箭头 */}
            {isDirectory && (
              <span className="w-4 h-4 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 size={14} className="text-gray-400 animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />
                )}
              </span>
            )}

            {/* 文件/目录图标 */}
            {isDirectory ? (
              isExpanded ? (
                <FolderOpen size={16} className="text-amber-500" />
              ) : (
                <Folder size={16} className="text-amber-500" />
              )
            ) : (
              <span className="text-sm">{getFileIcon(item.name, 'file')}</span>
            )}

            {/* 名称或重命名输入框 */}
            {isRenaming ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleRenameKeyDown}
                  onBlur={saveRename}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-1 py-0.5 text-sm bg-white dark:bg-gray-800 border border-blue-500 rounded outline-none"
                  autoFocus
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveRename();
                  }}
                  className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded"
                  title="保存 (Enter)"
                >
                  <Check size={14} className="text-green-600 dark:text-green-400" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cancelRename();
                  }}
                  className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                  title="取消 (Escape)"
                >
                  <X size={14} className="text-red-600 dark:text-red-400" />
                </button>
              </div>
            ) : (
              <span className={`text-sm truncate ${
                isHighlighted || isCurrentFile
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {item.name}
              </span>
            )}

            {/* 当前文件指示器 */}
            {(isCurrentFile || isHighlighted) && !isDirectory && !isRenaming && (
              <span className="ml-auto text-blue-500 dark:text-blue-400 text-xs">●</span>
            )}
          </div>

          {/* 子节点 */}
          {isDirectory && isExpanded && children && children.length > 0 && (
            <div>
              {renderTreeNode(children, level + 1)}
            </div>
          )}

          {/* 空目录提示 */}
          {isDirectory && isExpanded && state?.isLoaded && (!children || children.length === 0) && (
            <div
              className="text-sm text-gray-400 dark:text-gray-500 pl-6 py-1"
              style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
            >
              空目录
            </div>
          )}
        </div>
      );
    });
  }, [directoryStates, expandedFolders, currentFile, highlightedPath, renamingPath, newName, getFileIcon, toggleFolder, handleFileClick, handleDirectoryClick, handleFileDoubleClick, saveRename, cancelRename, handleRenameKeyDown]);

  // 加载状态
  if (isLoading && !isInitialized) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-blue-500 animate-spin" />
          <span className="text-sm text-gray-500">正在加载文件树...</span>
        </div>
      </div>
    );
  }

  // 空状态
  if (!isInitialized && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Folder size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          未选择工作目录
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          点击上方"选择工作目录"按钮开始
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={sidebarScrollRef} className="h-full overflow-y-auto" onContextMenu={handleEmptyContextMenu}>
        <style>{`
          .highlight-pulse {
            animation: pulse-highlight 2s ease-in-out;
          }
          @keyframes pulse-highlight {
            0%, 100% { background-color: transparent; }
            50% { background-color: rgba(59, 130, 246, 0.2); }
          }
        `}</style>
        {rootItems.length > 0 ? (
          <div className="py-1">
            {renderTreeNode(rootItems)}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center h-full p-6 text-center"
          >
            <File size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              目录为空
            </p>
          </div>
        )}
      </div>

      {/* 🔴 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {/* 文件夹或空区域：显示新建选项 */}
          {(contextMenu.type === 'folder' || contextMenu.type === 'empty') && (
            <>
              <button
                onClick={() => {
                  const targetPath = contextMenu.item?.path || currentDirectory;
                  if (targetPath) handleNewFile(targetPath);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>📄</span> 新建文件
              </button>
              <button
                onClick={() => {
                  const targetPath = contextMenu.item?.path || currentDirectory;
                  if (targetPath) handleNewFolder(targetPath);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>📁</span> 新建文件夹
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
            </>
          )}

          {/* 所有类型：在文件管理器中打开 */}
          <button
            onClick={async () => {
              const targetPath = contextMenu.item?.path || currentDirectory;
              if (targetPath) {
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  // 🔴 使用 Rust 命令打开，而不是 shell open
                  const pathToOpen = contextMenu.item?.type === 'directory'
                    ? targetPath
                    : targetPath.substring(0, targetPath.lastIndexOf('/'));
                  await invoke('open_in_browser', { path: pathToOpen });
                } catch (err) {
                  error(`打开失败: ${err}`);
                }
              }
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <span>📂</span> 在文件管理器中打开
          </button>

          {/* 文件或文件夹：显示重命名和删除 */}
          {contextMenu.type === 'file' && contextMenu.item && (
            <>
              <button
                onClick={() => {
                  setRenamingPath(contextMenu.item!.path);
                  setNewName(contextMenu.item!.name.replace('.md', ''));
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>✏️</span> 重命名
              </button>
              <button
                onClick={() => showDeleteConfirm(contextMenu.item!)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <span>🗑️</span> 删除
              </button>
            </>
          )}

          {/* 文件夹：显示重命名和删除 */}
          {contextMenu.type === 'folder' && contextMenu.item && (
            <>
              <button
                onClick={() => {
                  setRenamingPath(contextMenu.item!.path);
                  setNewName(contextMenu.item!.name);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <span>✏️</span> 重命名
              </button>
              <button
                onClick={() => showDeleteConfirm(contextMenu.item!)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <span>🗑️</span> 删除
              </button>
            </>
          )}
        </div>
      )}

      {/* 🔴 删除确认对话框 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              确认删除
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              确定要删除 <span className="font-medium text-gray-900 dark:text-gray-100">{deleteConfirm.item.name}</span> 吗？
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={deleteConfirm.onConfirm}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 点击空白处关闭右键菜单 */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeContextMenu}
        />
      )}
    </>
  );
}); // end of forwardRef

// Rust 后端返回的 FileInfo 类型
interface FileInfo {
  name: string;
  path: string;
   is_dir: boolean;
  size: number;
  modified: number | null;
  children: FileInfo[] | null;
}
