import { useEffect, useRef } from 'react';
import Cherry from 'cherry-markdown';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
// 使用官方 CSS 确保样式一致性
import '../../styles/cherry-markdown-official.css';
import '../../styles/cherry-sidebar.css';
import { useFileStore } from '../../stores/fileStore';
import { useEditorStore } from '../../stores/editorStore';
import { useToast } from '../ui/Toast';
import { resolveImageSrc } from '../../utils/markdownImage';

interface CherryEditorProps {
  className?: string;
}

export function CherryEditor({ className = '' }: CherryEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Cherry | null>(null);

  // 🔴 记录每个文件的滚动位置
  const scrollPositionsRef = useRef<Map<string, { editor: number; preview: number }>>(new Map());
  // 🔴 当前文件所在目录（供 urlProcessor 解析相对图片路径）
  const currentFileDirRef = useRef<string | null>(null);
  // 🔴 待恢复的滚动位置（由 useEffect 设置，由 afterChange 回调执行恢复）
  const pendingScrollRestore = useRef<{ editor: number; preview: number } | null>(null);

  const currentFile = useFileStore(state => state.currentFile);
  const updateContent = useFileStore(state => state.updateContent);
  const { options, syncWithSettings, isPreviewOnly, savedEditorWidth, setSavedEditorWidth } = useEditorStore();
  const reloadVersion = useFileStore(state => state.reloadVersion);
  const { success, error } = useToast();

  // 🔴 图片导出：使用 html2canvas 截图
  const handleExportImage = async () => {
    const cherry = editorRef.current;
    if (!cherry) return;

    try {
      console.log('[Export] 开始导出长图流程');

      const filePath = await save({
        filters: [{ name: '图片', extensions: ['jpg', 'png'] }],
        defaultPath: currentFile?.name?.replace('.md', '') || 'untitled',
      });

      console.log('[Export] 用户选择的路径:', filePath);

      if (!filePath) {
        console.log('[Export] 用户取消选择');
        return;
      }

      // 🔴 核心：使用 Cherry API 获取完整的渲染 HTML（带样式）
      const htmlContent = cherry.getHtml();
      console.log('[Export] HTML 内容长度:', htmlContent.length);

      if (!htmlContent || htmlContent.length < 50) {
        error('无法获取预览内容，内容可能为空');
        return;
      }

      // 🔴 创建隐藏 iframe，渲染完整 HTML（固定宽度 1200px 改善右边显示不全）
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:9999px;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        document.body.removeChild(iframe);
        error('无法创建渲染容器');
        return;
      }

      // 写入完整 HTML + 基础样式
      iframeDoc.open();
      iframeDoc.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 60px; width: 1200px; line-height: 1.6; background: white; box-sizing: border-box; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 2px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    img { max-width: 100%; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
    p { margin: 16px 0; }
    ul, ol { margin: 16px 0; padding-left: 24px; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>
      `);
      iframeDoc.close();

      // 等待 iframe 渲染完成
      await new Promise(resolve => setTimeout(resolve, 500));

      const iframeBody = iframeDoc.body;
      const fullHeight = iframeBody.scrollHeight;
      console.log('[Export] iframe 尺寸: 1200 x', fullHeight);

      // 动态加载 html2canvas
      const html2canvasModule = await import('html2canvas');
      const html2canvasFn = html2canvasModule.default || html2canvasModule;

      // 截取 iframe body
      const canvas = await html2canvasFn(iframeBody, {
        allowTaint: true,
        useCORS: true,
        scrollY: 0,
        scrollX: 0,
        width: 1200,
        height: fullHeight,
        windowWidth: 1200,
        windowHeight: fullHeight,
        scale: 1,
        backgroundColor: '#ffffff',
        logging: true,
      });

      // 清理 iframe
      document.body.removeChild(iframe);

      console.log('[Export] Canvas 尺寸:', canvas.width, 'x', canvas.height);

      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const base64Data = imgData.split(',')[1];

      await invoke('write_binary_file', {
        path: filePath,
        content: base64Data,
      });
      console.log('[Export] 文件已写入:', filePath);
      success(`已导出长图: ${filePath}`);
    } catch (err) {
      console.error('[Export] 导出长图失败:', err);
      error(`导出失败: ${err}`);
    }
  };

  const handleExportHtml = async () => {
    const cherry = editorRef.current;
    if (!cherry) return;

    try {
      const htmlContent = cherry.getHtml();
      console.log('[Export] HTML 内容长度:', htmlContent.length);

      if (!htmlContent || htmlContent.length < 50) {
        error('无法获取预览内容，内容可能为空');
        return;
      }

      // 创建完整 HTML 文档（与 PDF 相同，但不包含打印脚本）
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>HTML 导出 - ${currentFile?.name || 'untitled'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 2px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    img { max-width: 100%; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

      // 保存到临时目录
      const tempDir = '/tmp';
      const tempFileName = `minidoc-export-${Date.now()}.html`;
      const tempPath = `${tempDir}/${tempFileName}`;

      await invoke('write_file', { path: tempPath, content: fullHtml });
      console.log('[Export] 临时 HTML 已保存:', tempPath);

      // 用浏览器打开
      await invoke('open_in_browser', { path: tempPath });
      console.log('[Export] 已在浏览器中打开');

      success('请在浏览器中查看，可使用"另存为"保存');
    } catch (err) {
      console.error('[Export] 导出 HTML 失败:', err);
      error(`导出失败: ${err}`);
    }
  };

  // 🔴 PDF 导出：生成临时 HTML 文件，用系统命令打开
  const handleExportPdf = async () => {
    const cherry = editorRef.current;
    if (!cherry) return;

    try {
      // 使用 Cherry API 获取完整的渲染 HTML
      const htmlContent = cherry.getHtml();
      console.log('[Export] HTML 内容长度:', htmlContent.length);

      if (!htmlContent || htmlContent.length < 50) {
        error('无法获取预览内容，内容可能为空');
        return;
      }

      // 创建完整 HTML 文档
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>打印预览 - ${currentFile?.name || 'untitled'}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 2px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    img { max-width: 100%; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 16px; color: #666; }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
${htmlContent}
<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>`;

      // 🔴 保存到临时目录（使用 Tauri path API）
      const tempDir = '/tmp';
      const tempFileName = `minidoc-print-${Date.now()}.html`;
      const tempPath = `${tempDir}/${tempFileName}`;

      await invoke('write_file', { path: tempPath, content: fullHtml });
      console.log('[Export] 临时 HTML 已保存:', tempPath);

      // 🔴 核心：使用 Rust backend 直接调用系统浏览器打开
      await invoke('open_in_browser', { path: tempPath });
      console.log('[Export] 已在浏览器中打开');

      success('请在浏览器打印对话框中选择"保存为 PDF"');
    } catch (err) {
      console.error('[Export] PDF 导出失败:', err);
      error(`PDF 导出失败: ${err}`);
    }
  };

  const handleExportMarkdown = async () => {
    const cherry = editorRef.current;
    if (!cherry) return;

    try {
      const filePath = await save({
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        defaultPath: currentFile?.name || 'untitled',
      });

      if (!filePath) return;

      const markdown = cherry.getMarkdown();

      // 🔴 修复：使用 Rust backend 写入文件
      await invoke('write_file', {
        path: filePath,
        content: markdown,
      });
      success(`已导出 Markdown: ${filePath.split('/').pop()}`);
    } catch (err) {
      console.error('[Export] 导出 Markdown 失败:', err);
      error(`导出失败: ${err}`);
    }
  };

  // 🔴 修复：初始化时立即同步设置，使用同步后的值
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
            urlProcessor: (url: string, type: string) => {
              if (type === 'image') {
                return resolveImageSrc(url, currentFileDirRef.current);
              }
              return url;
            },
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
          // 透传给 CodeMirror 的配置
          codemirror: {
            lineNumbers: options.showLineNumbers,
            lineWrapping: true, // 固定启用自动换行
          },
          convertWhenPaste: true,
          keepDocumentScrollAfterInit: false
        },
        toolbars: {
          toolbar: [
            'bold',
            'italic',
            {
             strikethrough: ['strikethrough', 'underline', 'sub', 'sup', 'ruby'],
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
            'detail',
            '|',
            {
              insert: [
                'image',
                'audio',
                'video',
                'link',
                'hr',
                'br',
                'code',
                'inlineCode',
                'formula',
                'toc',
                'table',
                'pdf',
                'word',
                'file',
              ],
            },
            'graph',
            'proTable',
            'togglePreview',
            'codeTheme',
            'search',
            'shortcutKey',
            '|',
            'mobilePreview',
            'copy',
            'theme',
          ],
          toolbarRight: ['fullScreen', '|', 'customExport', 'changeLocale', 'wordCount'],
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
          customMenu: {
            // 🔴 自定义导出菜单：使用 Tauri dialog 选择保存路径
            customExport: Cherry.createMenuHook('导出', {
              iconName: 'export',
              subMenuConfig: [
                { noIcon: true, name: '导出PDF', onclick: handleExportPdf },
                { noIcon: true, name: '导出长图', onclick: handleExportImage },
                { noIcon: true, name: '导出HTML', onclick: handleExportHtml },
                { noIcon: true, name: '导出Markdown', onclick: handleExportMarkdown },
              ],
            }),
            customMenuTable: Cherry.createMenuHook('图表', {
              iconName: 'trendingUp',
              subMenuConfig: [
                { noIcon: true, name: '折线图', onclick: () => {
                  const cherry = editorRef.current;
                  cherry?.insert('\n| :line:{\"title\": \"折线图\"} | Header1 | Header2 | Header3 | Header4 |\n| ------ | ------ | ------ | ------ | ------ |\n| Sample1 | 11 | 11 | 4 | 33 |\n| Sample2 | 112 | 111 | 22 | 222 |\n| Sample3 | 333 | 142 | 311 | 11 |\n');
                }},
                { noIcon: true, name: '柱状图', onclick: () => {
                  const cherry = editorRef.current;
                  cherry?.insert('\n| :bar:{\"title\": \"柱状图\"} | Header1 | Header2 | Header3 | Header4 |\n| ------ | ------ | ------ | ------ | ------ |\n| Sample1 | 11 | 11 | 4 | 33 |\n| Sample2 | 112 | 111 | 22 | 222 |\n| Sample3 | 333 | 142 | 311 | 11 |\n');
                }},
                { noIcon: true, name: '雷达图', onclick: () => {
                  const cherry = editorRef.current;
                  cherry?.insert('\n| :radar:{\"title\": \"雷达图\"} | Header1 | Header2 | Header3 | Header4 |\n| ------ | ------ | ------ | ------ | ------ |\n| Sample1 | 11 | 11 | 4 | 33 |\n| Sample2 | 112 | 111 | 22 | 222 |\n| Sample3 | 333 | 142 | 311 | 11 |\n');
                }},
                { noIcon: true, name: '饼图', onclick: () => {
                  const cherry = editorRef.current;
                  cherry?.insert('\n| :pie:{\"title\": \"饼图\"} | Header1 | Header2 | Header3 | Header4 |\n| ------ | ------ | ------ | ------ | ------ |\n| Sample1 | 11 | 11 | 4 | 33 |\n| Sample2 | 112 | 111 | 22 | 222 |\n| Sample3 | 333 | 142 | 311 | 11 |\n');
                }},
                { noIcon: true, name: '散点图', onclick: () => {
                  const cherry = editorRef.current;
                  cherry?.insert('\n| :scatter:{\"title\": \"散点图\"} | X | Y |\n| ------ | ------ | ------ |\n| Point1 | 10 | 20 |\n| Point2 | 30 | 40 |\n| Point3 | 50 | 60 |\n');
                }},
              ],
            }),
          },
        },
        callback: {
          afterChange: (markdown: string) => {
            // 🔴 外部修改加载后，Cherry 渲染完成，恢复滚动位置
            if (pendingScrollRestore.current) {
              const cherryContainer = containerRef.current?.querySelector('.cherry') as HTMLElement;
              const editorScrollEl = cherryContainer?.querySelector('.cherry-editor .CodeMirror-scroll') as HTMLElement;
              const previewerEl = cherryContainer?.querySelector('.cherry-previewer') as HTMLElement;
              const pos = pendingScrollRestore.current;
              // 🔴 延迟等 DOM 高度计算完成
              setTimeout(() => {
                if (editorScrollEl) editorScrollEl.scrollTop = pos.editor;
                if (previewerEl) previewerEl.scrollTop = pos.preview;
                console.log('[CherryEditor] afterChange: 恢复滚动位置', pos);
              }, 200);
              pendingScrollRestore.current = null;
            }

            // 用户编辑时，更新 store
            updateContent(markdown);
          },
        },
        themeSettings: {
          mainTheme: 'default',
        },
      });

      editorRef.current = editor;
      // 🔴 拦截预览区域链接点击，在系统浏览器打开
      const previewer = containerRef.current?.querySelector('.cherry-previewer');
      if (previewer) {
        const handleLinkClick = (e: Event) => {
          const target = e.target as HTMLElement;
          const link = target.closest('a');
          if (link && link.href) {
            const href = link.href;
            // 仅拦截外部链接
            if (href.startsWith('http://') || href.startsWith('https://')) {
              e.preventDefault();
              e.stopPropagation();
              open(href).catch(err => console.error('[Link] 打开失败:', err));
            }
          }
        };
        previewer.addEventListener('click', handleLinkClick);
        // 保存处理函数引用用于清理
        (previewer as any)._linkClickHandler = handleLinkClick;
      }

      console.log('Cherry editor initialized');
    } catch (error) {
      console.error('Failed to initialize Cherry editor:', error);
    }

    return () => {
      // 清理链接点击事件监听
      const previewer = containerRef.current?.querySelector('.cherry-previewer');
      if (previewer && (previewer as any)._linkClickHandler) {
        previewer.removeEventListener('click', (previewer as any)._linkClickHandler);
        delete (previewer as any)._linkClickHandler;
      }
      editorRef.current?.destroy();
    };
  }, []);

  // 🔴 修复：监听 path 变化（切换文件） + reloadVersion 变化（侧边栏强制刷新）
  // reloadVersion 只在侧边栏点击时 +1，用户编辑时不变化 → 避免编辑时闪烁
  const prevFilePathRef = useRef<string>('');

  // 🔴 保持当前文件目录最新，供 Cherry urlProcessor 使用（editor 只初始化一次）
  currentFileDirRef.current = currentFile?.path
    ? currentFile.path.substring(0, currentFile.path.lastIndexOf('/'))
    : null;

  useEffect(() => {
    if (!editorRef.current || !currentFile) return;

    const cherryContainer = containerRef.current?.querySelector('.cherry') as HTMLElement;
    const editorScrollEl = cherryContainer?.querySelector('.cherry-editor .CodeMirror-scroll') as HTMLElement;
    const previewerEl = cherryContainer?.querySelector('.cherry-previewer') as HTMLElement;

    const prevPath = prevFilePathRef.current;
    const isSameFile = prevPath === currentFile.path;

    // 🔴 保存旧文件的滚动位置（切换文件时）
    if (prevPath && !isSameFile) {
      const positions = {
        editor: editorScrollEl?.scrollTop || 0,
        preview: previewerEl?.scrollTop || 0,
      };
      scrollPositionsRef.current.set(prevPath, positions);
    }

    // 🔴 记录 setValue 前的滚动位置
    const positionsBeforeSet = isSameFile ? {
      editor: editorScrollEl?.scrollTop || 0,
      preview: previewerEl?.scrollTop || 0,
    } : null;

    // 🔴 确定要恢复的滚动位置
    let positionsToRestore: { editor: number; preview: number };
    if (isSameFile) {
      positionsToRestore = positionsBeforeSet!;
    } else {
      const saved = scrollPositionsRef.current.get(currentFile.path);
      positionsToRestore = saved || { editor: 0, preview: 0 };
    }

    console.log('[CherryEditor] setValue:', currentFile.path, 'sameFile:', isSameFile, 'restore:', positionsToRestore);

    // 🔴 设置待恢复位置，afterChange 回调会在 Cherry 渲染完成后执行恢复
    pendingScrollRestore.current = positionsToRestore;

    editorRef.current.setValue(currentFile.content);

    // 记录当前文件路径
    prevFilePathRef.current = currentFile.path;
  }, [currentFile?.path, reloadVersion]);

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

  // 🔴 动态更新行号
  useEffect(() => {
    if (!editorRef.current) return;

    console.log('[CherryEditor] 准备更新行号，options.showLineNumbers =', options.showLineNumbers);

    // 🔴 使用 Cherry API 获取 CodeMirror 实例
    const cherry = editorRef.current as any;
    const cmEditor = cherry.getCodeMirror?.() || cherry.editor?.editor;

    if (!cmEditor) {
      console.warn('[CherryEditor] 无法获取 CodeMirror 实例');
      return;
    }

    console.log('[CherryEditor] 当前 lineNumbers 选项:', cmEditor.getOption('lineNumbers'));

    // 设置行号显示
    cmEditor.setOption('lineNumbers', options.showLineNumbers);

    console.log('[CherryEditor] 调用 setOption 后 lineNumbers 选项:', cmEditor.getOption('lineNumbers'));
  }, [options.showLineNumbers]);

  // 🔴 CSS 隐藏方式控制预览模式：记录宽度 → 隐藏编辑区 → 预览区100%
  useEffect(() => {
    if (!containerRef.current) return;

    const cherryContainer = containerRef.current.querySelector('.cherry') as HTMLElement;
    if (!cherryContainer) return;

    const editorEl = cherryContainer.querySelector('.cherry-editor') as HTMLElement;
    const previewerEl = cherryContainer.querySelector('.cherry-previewer') as HTMLElement;
    const dragLine = cherryContainer.querySelector('.cherry-drag') as HTMLElement;

    if (!editorEl || !previewerEl) return;

    console.log('[CherryEditor] 切换预览模式:', isPreviewOnly);

    if (isPreviewOnly) {
      // 进入预览模式：
      // 1. 记录当前编辑区宽度
      const currentWidth = editorEl.style.width || editorEl.offsetWidth + 'px';
      setSavedEditorWidth(currentWidth);
      console.log('[CherryEditor] 保存编辑区宽度:', currentWidth);

      // 2. 编辑区隐藏
      editorEl.classList.add('cherry-editor--hidden');
      editorEl.style.display = 'none';

      // 3. 分隔线隐藏
      if (dragLine) dragLine.style.display = 'none';

      // 4. 预览区100%宽度
      previewerEl.style.width = '100%';
      previewerEl.classList.add('cherry-preview--full');
    } else {
      // 恢复分屏模式：
      // 1. 编辑区取消隐藏
      editorEl.classList.remove('cherry-editor--hidden');
      editorEl.style.display = '';

      // 2. 分隔线显示
      if (dragLine) dragLine.style.display = '';

      // 3. 预览区取消full状态
      previewerEl.classList.remove('cherry-preview--full');

      // 4. 恢复之前保存的宽度
      if (savedEditorWidth) {
        editorEl.style.width = savedEditorWidth;
        previewerEl.style.width = `calc(100% - ${savedEditorWidth})`;
        console.log('[CherryEditor] 恢复编辑区宽度:', savedEditorWidth);
      } else {
        // 默认50%
        editorEl.style.width = '50%';
        previewerEl.style.width = '50%';
      }
    }

    console.log('[CherryEditor] 切换完成');
  }, [isPreviewOnly]);

  return (
    <div className={`cherry-editor-wrapper w-full h-full min-w-full min-h-full max-w-full max-h-full ${className}`}>
      <div ref={containerRef} className="cherry-markdown w-full h-full min-w-full min-h-full max-w-full max-h-full" />
    </div>
  );
}
