import { useUIStore } from '@/stores/uiStore';
import { FiX, FiFileText, FiSearch, FiMoon, FiCheckCircle } from 'react-icons/fi';

export function WelcomeDialog() {
  const { welcomeOpen, closeWelcome } = useUIStore();

  const handleGetStarted = () => {
    localStorage.setItem('hasSeenWelcome', 'true');
    closeWelcome();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleGetStarted();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleGetStarted();
    }
  };

  if (!welcomeOpen) return null;

  const features = [
    {
      icon: FiFileText,
      title: 'Markdown 编辑',
      description: '基于 Cherry Markdown 的强大编辑器',
      shortcut: 'Cmd+N',
    },
    {
      icon: FiSearch,
      title: '快速搜索',
      description: '在多个文件中快速查找内容',
      shortcut: 'Cmd+Shift+F',
    },
    {
      icon: FiMoon,
      title: '主题切换',
      description: '支持浅色、深色和跟随系统主题',
      shortcut: 'Cmd+Shift+T',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-blue-500/10 to-white dark:to-gray-800">
          <button
            onClick={handleGetStarted}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          >
            <FiX size={18} />
          </button>

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-3xl">M</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">欢迎使用 Minidoc</h1>
              <p className="text-gray-600 dark:text-gray-400">轻量级 Markdown 编辑器</p>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            Minidoc 是一款简洁优雅的 Markdown 编辑器，专注于提供流畅的写作体验。
            支持实时预览、语法高亮、多文件管理等功能。
          </p>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">核心功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500/50 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="text-blue-500" size={20} />
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{feature.description}</p>
                  <kbd className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                    {feature.shortcut}
                  </kbd>
                </div>
              );
            })}
          </div>

          {/* Quick Tips */}
          <div className="mt-6 p-4 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <FiCheckCircle className="text-blue-500" size={18} />
              快速提示
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• 使用 <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Cmd+S</kbd> 保存文件</li>
              <li>• 使用 <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Cmd+B</kbd> 加粗选中文本</li>
              <li>• 使用 <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">Cmd+I</kbd> 斜体选中文本</li>
              <li>• 更多快捷键请查看设置中的帮助文档</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-8 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              localStorage.setItem('hasSeenWelcome', 'true');
              closeWelcome();
            }}
            className="px-6 py-2.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
          >
            开始使用
          </button>
        </div>
      </div>
    </div>
  );
}
