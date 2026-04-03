import { useRef, useState, useEffect } from 'react';
import { useFileStore } from '../../stores/fileStore';
import { useSettingsStore } from '../../stores/settingsStore';

interface SimpleEditorProps {
  className?: string;
}

export function SimpleEditor({ className = '' }: SimpleEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState('');

  const { currentFile, updateContent } = useFileStore();
  const { settings } = useSettingsStore();

  // 🔴 修复：使用 useEffect 同步 store 状态到本地 state
  // 当 currentFile 变化时（包括切换文件），同步内容
  useEffect(() => {
    if (currentFile) {
      console.log('[SimpleEditor] 同步文件内容:', currentFile.path, '长度:', currentFile.content.length);
      setContent(currentFile.content);
    }
  }, [currentFile?.path, currentFile?.content]);

  // 简单的 Markdown 转 HTML
  const parseMarkdown = (text: string) => {
    return text
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/\n/gim, '<br>');
  };

  // 更新预览 - 使用 useEffect 而不是渲染期副作用
  useEffect(() => {
    if (previewRef.current && content) {
      previewRef.current.innerHTML = parseMarkdown(content);
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    updateContent(newContent);
  };

  // 滚动同步
  const handleEditorScroll = () => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    const editorRatio = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
    preview.scrollTop = editorRatio * (preview.scrollHeight - preview.clientHeight);
  };

  const handlePreviewScroll = () => {
    const textarea = textareaRef.current;
    const preview = previewRef.current;
    if (!textarea || !preview) return;

    const previewRatio = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    textarea.scrollTop = previewRatio * (textarea.scrollHeight - textarea.clientHeight);
  };

  if (!currentFile) {
    return (
      <div className={`h-full flex items-center justify-center bg-gray-50 ${className}`}>
        <div className="text-center">
          <div className="text-6xl mb-6">📝</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">欢迎使用 Minidoc</h2>
          <p className="text-gray-500">请打开一个 Markdown 文件开始编辑</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex bg-white ${className}`}>
      {/* 编辑区 */}
      <div className="flex-1 flex flex-col border-r border-gray-200">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
          编辑
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onScroll={handleEditorScroll}
          className="flex-1 p-4 resize-none outline-none font-mono leading-relaxed"
          style={{ fontSize: `${settings.fontSize}px` }}
          placeholder="开始输入 Markdown..."
        />
      </div>

      {/* 预览区 */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
          预览
        </div>
        <div
          ref={previewRef}
          onScroll={handlePreviewScroll}
          className="flex-1 p-4 prose prose-sm max-w-none overflow-auto"
          style={{ fontSize: `${settings.fontSize}px` }}
        />
      </div>
    </div>
  );
}
