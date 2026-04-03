import { useEffect, useRef } from 'react';
import Cherry from 'cherry-markdown';
import 'cherry-markdown/dist/cherry-markdown.css';
import '../../styles/cherry-sidebar.css';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';

interface CherryEditorProps {
  className?: string;
}

export function CherryEditor({ className = '' }: CherryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Cherry | null>(null);
  // 🔴 关键：标志位，防止 setValue 触发 afterChange 循环
  const isUpdatingFromStore = useRef(false);

  const currentFile = useFileStore(state => state.currentFile);
  const updateContent = useFileStore(state => state.updateContent);
  const { options, syncWithSettings } = useEditorStore();

  // 初始化时同步设置
  useEffect(() => {
    syncWithSettings();
  }, [syncWithSettings]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 🔴 StrictMode 修复：先清理之前的编辑器实例和 DOM
    if (editorRef.current) {
      editorRef.current.destroy();
      editorRef.current = null;
    }
    // 清理容器内容
    containerRef.current.innerHTML = '';

    try {
      const editor = new Cherry({
        el: containerRef.current,
        value: currentFile?.content || '# 欢迎使用 Minidoc\n\n开始您的Markdown创作之旅!',
        locale: 'zh_CN',
        externals: {
          echarts: (window as any).echarts,
          katex: (window as any).katex,
          MathJax: (window as any).MathJax,
        },
        isPreviewOnly: false,
        engine: {
          global: {
            urlProcessor: (url: string) => url,
            htmlAttrWhiteList: 'part|slot',
            flowSessionContext: false,
          },
          syntax: {
            codeBlock: {
              theme: 'default',
              lineNumber: true,
              expandCode: true,
              copyCode: true,
              editCode: true,
              changeLang: true,
            },
            table: {
              enableChart: true,
            },
            mathBlock: {
              engine: 'KaTeX',
            },
            inlineMath: {
              engine: 'KaTeX',
            },
            emoji: {
              useUnicode: true,
            },
            panel: {
              enableJustify: true,
              enablePanel: true,
            },
          },
        },
        editor: {
          height: '100%',
          width: '100%',
          defaultModel: 'edit&preview',
          showHeader: false,
          showFooter: false,
          autoScroll: true,
          autoSave2Textarea: true,
          // 🔴 透传给 CodeMirror 的配置
          codemirror: {
            lineNumbers: options.showLineNumbers,
            lineWrapping: options.wordWrap,
          },
        },
        toolbars: {
          toolbar: [
            'bold',
            'italic',
            {
              strikethrough: ['strikethrough', 'underline', 'sub', 'sup'],
            },
            'size',
            '|',
            'color',
            'header',
            '|',
            'ol',
            'ul',
            'checklist',
            'panel',
            'align',
            '|',
            'formula',
            {
              insert: [
                'image',
                'link',
                'hr',
                'br',
                'code',
                'inlineCode',
                'table',
                'toc',
              ],
            },
            'graph',
            'togglePreview',
            'codeTheme',
            'search',
            '|',
            'mobilePreview',
            'copy',
            'theme',
          ],
          toolbarRight: ['fullScreen', '|', { export: ['pdf', 'html', 'png', 'markdown'] }, 'wordCount'],
          bubble: [
            'bold',
            'italic',
            'underline',
            'strikethrough',
            'sub',
            'sup',
            '|',
            'size',
            'color',
          ],
          sidebar: [],
          toc: {
            defaultModel: 'full',
            updateLocationHash: false,
          },
        },
        callback: {
          afterChange: (markdown: string) => {
            // 🔴 关键：如果是从 store 更新的，跳过回调，避免循环
            if (isUpdatingFromStore.current) {
              console.log('[CherryEditor] 跳过 afterChange（来自 store 更新）');
              return;
            }
            console.log('[CherryEditor] afterChange 用户编辑，更新 store');
            updateContent(markdown);
          },
        },
        themeSettings: {
          mainTheme: 'default',
        },
      });

      editorRef.current = editor;
      console.log('Cherry editor initialized');
    } catch (error) {
      console.error('Failed to initialize Cherry editor:', error);
    }

    return () => {
      editorRef.current?.destroy();
    };
  }, []);

  // 🔴 修复：监听 currentFile?.path 变化，每次切换文件都强制重新加载内容
  useEffect(() => {
    if (editorRef.current && currentFile) {
      console.log('[CherryEditor] 文件切换，重新加载内容:', currentFile.path, '长度:', currentFile.content.length);

      // 🔴 关键：设置标志位，防止 afterChange 回调
      isUpdatingFromStore.current = true;

      try {
        editorRef.current.setValue(currentFile.content);
      } finally {
        // 🔴 增加延迟到 100ms，确保 afterChange 回调完成后再重置
        setTimeout(() => {
          isUpdatingFromStore.current = false;
          console.log('[CherryEditor] 标志位已重置');
        }, 100);
      }
    }
  }, [currentFile?.path]);

  useEffect(() => {
    if (!editorRef.current) return;

    const wrapper = containerRef.current?.querySelector('.cherry-markdown');
    if (wrapper) {
      (wrapper as HTMLElement).style.fontSize = `${options.fontSize}px`;
    }

    if (options.theme === 'dark') {
      containerRef.current?.classList.add('cherry-markdown-dark');
    } else {
      containerRef.current?.classList.remove('cherry-markdown-dark');
    }
  }, [options.fontSize, options.theme]);

  // 🔴 动态更新行号和自动换行
  useEffect(() => {
    if (!editorRef.current) return;

    // 🔴 使用 Cherry API 获取 CodeMirror 实例
    const cherry = editorRef.current as any;
    const cmEditor = cherry.getCodeMirror?.() || cherry.editor?.editor;

    if (!cmEditor) {
      console.warn('[CherryEditor] 无法获取 CodeMirror 实例');
      return;
    }

    // 设置行号显示
    cmEditor.setOption('lineNumbers', options.showLineNumbers);
    // 设置自动换行
    cmEditor.setOption('lineWrapping', options.wordWrap);

    console.log('[CherryEditor] 更新编辑器配置:', {
      showLineNumbers: options.showLineNumbers,
      wordWrap: options.wordWrap,
    });
  }, [options.showLineNumbers, options.wordWrap]);

  return (
    <div className={`cherry-editor-wrapper h-full ${className}`}>
      <div ref={containerRef} className="cherry-markdown h-full" />
    </div>
  );
}
