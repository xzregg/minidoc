import { FiFile, FiPlus } from 'react-icons/fi';
import { invoke } from '@tauri-apps/api/core';

interface FileOpenDialogProps {
  filePath: string;
  onOpenInCurrent: () => void;
  onClose: () => void;
}

export function FileOpenDialog({ filePath, onOpenInCurrent, onClose }: FileOpenDialogProps) {
  const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'unknown';

  const handleOpenInNew = async () => {
    try {
      // 🔴 调用 Tauri 命令启动新的应用实例
      await invoke<void>('launch_new_instance', { path: filePath });
      onClose();
    } catch (err) {
      console.error('[FileOpenDialog] 打开新窗口失败:', err);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            打开文件
          </h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Minidoc 已在运行，如何打开此文件？
          </p>

          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-900 dark:text-gray-100 truncate font-medium">
              {fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
              {filePath}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onOpenInCurrent}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <FiFile size={16} />
            在当前窗口打开
          </button>
          <button
            onClick={handleOpenInNew}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
          >
            <FiPlus size={16} />
            打开新窗口
          </button>
        </div>
      </div>
    </div>
  );
}
