import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { FiX, FiMoon, FiSun, FiMonitor } from 'react-icons/fi';

export function SettingsDialog() {
  const { settingsOpen, closeSettings } = useUIStore();
  const { settings, updateSettings } = useSettingsStore();

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeSettings();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeSettings();
    }
  };

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">设置</h2>
          <button
            onClick={closeSettings}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Theme Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">主题</h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                  settings.theme === 'light'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FiSun size={20} />
                <span className="text-xs">浅色</span>
              </button>
              <button
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                  settings.theme === 'dark'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FiMoon size={20} />
                <span className="text-xs">深色</span>
              </button>
              <button
                onClick={() => updateSettings({ theme: 'auto' })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                  settings.theme === 'auto'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                <FiMonitor size={20} />
                <span className="text-xs">跟随系统</span>
              </button>
            </div>
          </section>

          {/* Editor Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">编辑器</h3>
            <div className="space-y-4">
              {/* Font Size */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600 dark:text-gray-400">字体大小</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={12}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    className="w-32 accent-blue-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100 w-8 text-right">{settings.fontSize}</span>
                </div>
              </div>

              {/* Line Numbers */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600 dark:text-gray-400">显示行号</label>
                <button
                  onClick={() => {
                    const newValue = !settings.showLineNumbers;
                    console.log('[SettingsDialog] 点击行号 toggle，目标值:', newValue);
                    updateSettings({ showLineNumbers: newValue });
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.showLineNumbers ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.showLineNumbers ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

            </div>
          </section>

          {/* Auto Save Section */}
          <section>
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">自动保存</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-600 dark:text-gray-400">启用自动保存</label>
                <button
                  onClick={() => updateSettings({ autoSave: !settings.autoSave })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoSave ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.autoSave ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {settings.autoSave && (
                <div className="flex items-center justify-between pl-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400">保存间隔 (秒)</label>
                  <select
                    value={settings.autoSaveInterval / 1000}
                    onChange={(e) => updateSettings({ autoSaveInterval: Number(e.target.value) * 1000 })}
                    className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>1 秒</option>
                    <option value={3}>3 秒</option>
                    <option value={5}>5 秒</option>
                    <option value={10}>10 秒</option>
                  </select>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={closeSettings}
            className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
