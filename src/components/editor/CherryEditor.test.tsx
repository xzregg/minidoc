import { render, waitFor } from '@testing-library/react';
import { CherryEditor } from './CherryEditor';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
  convertFileSrc: (p: string) => `asset://localhost${encodeURIComponent(p)}`,
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-shell', () => ({
  open: jest.fn(),
}));

const fileState = {
  currentFile: {
    path: '/Users/xzr/docs/note.md',
    name: 'note.md',
    content: '![本地图](./img/a.png)\n\n![网络图](https://example.com/b.png)',
    modified: false,
  },
  updateContent: jest.fn(),
  reloadVersion: 0,
  openFile: jest.fn(),
  setHighlightedPath: jest.fn(),
};

jest.mock('../../stores/fileStore', () => ({
  useFileStore: Object.assign(
    (selector: (state: any) => any) => selector(fileState),
    { getState: () => fileState },
  ),
}));

const editorState = {
  options: {
    fontSize: 14,
    showLineNumbers: true,
    wordWrap: true,
    theme: 'light',
    autoSave: true,
  },
  syncWithSettings: jest.fn(),
  isPreviewOnly: false,
  savedEditorWidth: null,
  setSavedEditorWidth: jest.fn(),
};

jest.mock('../../stores/editorStore', () => ({
  useEditorStore: (selector?: (state: any) => any) => (selector ? selector(editorState) : editorState),
}));

const toastError = jest.fn();
jest.mock('../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: toastError }),
}));

describe('CherryEditor 图片链接渲染', () => {
  beforeEach(() => {
    // 模拟 Tauri 运行时注入的全局
    (window as any).__TAURI_INTERNALS__ = {
      convertFileSrc: (p: string) => `asset://localhost${encodeURIComponent(p)}`,
    };
  });

  it('相对路径图片转换为 asset URL，网络图片保持原样', async () => {
    const { container } = render(<CherryEditor />);

    await waitFor(() => {
      const imgs = container.querySelectorAll('.cherry-previewer img');
      expect(imgs.length).toBe(2);
    });

    const imgs = container.querySelectorAll('.cherry-previewer img');
    expect(imgs[0].getAttribute('src')).toBe('asset://localhost%2FUsers%2Fxzr%2Fdocs%2Fimg%2Fa.png');
    expect(imgs[1].getAttribute('src')).toBe('https://example.com/b.png');
  });
});

describe('CherryEditor 文档链接导航', () => {
  async function clickLink(container: HTMLElement) {
    const link = await waitFor(() => {
      const element = container.querySelector('.cherry-previewer a');
      expect(element).not.toBeNull();
      return element!;
    });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    return click;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    fileState.currentFile = {
      path: '/Users/xzr/docs/需求/评审.md',
      name: '评审.md',
      content: '[云打印配置与补打](../操作手册/云打印配置与补打.md)',
      modified: false,
    };
    jest.mocked(invoke).mockImplementation(async (command) => {
      if (command === 'read_file') return '# 云打印';
      if (command === 'get_file_mtime') return 123;
      return undefined;
    });
    jest.mocked(open).mockResolvedValue(undefined);
  });

  it('点击中文相对文档链接时阻止新窗口，并在当前编辑器打开目标文件', async () => {
    const { container } = render(<CherryEditor />);
    const click = await clickLink(container);

    expect(click.defaultPrevented).toBe(true);
    await waitFor(() => expect(fileState.openFile).toHaveBeenCalledWith({
      path: '/Users/xzr/docs/操作手册/云打印配置与补打.md',
      name: '云打印配置与补打.md',
      content: '# 云打印',
      modified: false,
      fileMtime: 123,
    }));
    expect(open).not.toHaveBeenCalled();
  });

  it('解码路径中的中文和空格，并忽略链接的查询和片段部分', async () => {
    fileState.currentFile.content = '[说明](./%E8%AF%B4%E6%98%8E%20v2.md?view=1#步骤)';
    const { container } = render(<CherryEditor />);
    await clickLink(container);
    await waitFor(() => expect(fileState.openFile).toHaveBeenCalledWith(expect.objectContaining({
      path: '/Users/xzr/docs/需求/说明 v2.md',
      name: '说明 v2.md',
    })));
  });

  it('切换文档前保存当前修改', async () => {
    fileState.currentFile.modified = true;
    const { container } = render(<CherryEditor />);
    await clickLink(container);
    await waitFor(() => expect(fileState.openFile).toHaveBeenCalled());
    expect(invoke).toHaveBeenNthCalledWith(1, 'write_file', {
      path: '/Users/xzr/docs/需求/评审.md',
      content: fileState.currentFile.content,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'read_file', {
      path: '/Users/xzr/docs/操作手册/云打印配置与补打.md',
    });
  });

  it.each(['write_file', 'read_file'])('%s 失败时显示错误并保留当前文档', async (failedCommand) => {
    fileState.currentFile.modified = true;
    jest.mocked(invoke).mockImplementation(async (command) => {
      if (command === failedCommand) throw new Error('文件不可访问');
      return undefined;
    });
    const { container } = render(<CherryEditor />);
    const click = await clickLink(container);
    expect(click.defaultPrevented).toBe(true);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('打开文档失败: 文件不可访问'));
    expect(fileState.openFile).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('网页中的 Markdown 链接仍通过系统浏览器打开', async () => {
    fileState.currentFile.content = '[网上文档](https://example.com/guide.md)';
    const { container } = render(<CherryEditor />);
    const click = await clickLink(container);
    expect(click.defaultPrevented).toBe(true);
    expect(open).toHaveBeenCalledWith('https://example.com/guide.md');
    expect(invoke).not.toHaveBeenCalled();
    expect(fileState.openFile).not.toHaveBeenCalled();
  });

  it('文档内锚点不被作为本地文件打开', async () => {
    fileState.currentFile.content = '[跳转](#guide.md)';
    const { container } = render(<CherryEditor />);
    await clickLink(container);
    expect(invoke).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(fileState.openFile).not.toHaveBeenCalled();
  });
});
