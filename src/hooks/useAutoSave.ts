import { useEffect, useRef } from 'react';
import { useFileStore } from '../stores/fileStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * 自动保存 Hook
 *
 * 当文件内容修改后，在指定间隔后自动保存
 * 使用防抖机制避免频繁保存
 */
export function useAutoSave() {
  const { currentFile, saveFile } = useFileStore();
  const { settings } = useSettingsStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 如果自动保存未启用或没有当前文件，则不执行
    if (!settings.autoSave || !currentFile) {
      return;
    }

    // 如果文件未修改，不需要保存
    if (!currentFile.modified) {
      return;
    }

    // 清除之前的定时器
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // 设置新的定时器
    timerRef.current = setTimeout(() => {
      console.log('[AutoSave] 触发自动保存:', currentFile.path);

      // 静默保存（不显示 Toast 提示）
      saveFile().catch(err => {
        console.error('[AutoSave] 自动保存失败:', err);
      });
    }, settings.autoSaveInterval);

    // 清理函数
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentFile, settings.autoSave, settings.autoSaveInterval, saveFile]);

  return null;
}
