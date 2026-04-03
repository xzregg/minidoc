import { useFileStore } from '@/stores/fileStore';

export function StatusBar() {
  const { currentFile } = useFileStore();

  const wordCount = currentFile?.content
    ? currentFile.content.split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="h-8 bg-background-secondary border-t border-border flex items-center px-6 justify-between text-xs text-text-secondary">
      <div className="flex items-center gap-6">
        <span>{wordCount.toLocaleString()} 字</span>
        <span>UTF-8</span>
        <span>LF</span>
        <span>Markdown</span>
      </div>

      <div className="flex items-center gap-4">
        {currentFile?.modified ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-warning">未保存</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-success">已保存</span>
          </div>
        )}
      </div>
    </div>
  );
}
