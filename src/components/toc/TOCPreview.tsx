import { useMemo } from 'react';

interface TOCPreviewProps {
  content: string;       // 生成的目录内容
  format: 'markdown' | 'txt' | 'json';
}

export function TOCPreview({ content, format }: TOCPreviewProps) {
  // 根据格式决定渲染方式
  const renderedContent = useMemo(() => {
    if (format === 'json') {
      // JSON 格式显示为代码块
      try {
        const parsed = JSON.parse(content);
        return <pre className="text-xs font-mono whitespace-pre-wrap break-all">{content}</pre>;
      } catch {
        return <pre className="text-xs font-mono whitespace-pre-wrap break-all">{content}</pre>;
      }
    }

    // Markdown 和 TXT 格式直接显示
    return (
      <pre
        className="text-sm font-mono whitespace-pre-wrap break-words"
        style={{
          lineHeight: '1.6',
          color: 'var(--text-primary)'
        }}
      >
        {content}
      </pre>
    );
  }, [content, format]);

  return (
    <div
      className="w-full h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
      style={{
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
      }}
    >
      {renderedContent}
    </div>
  );
}
