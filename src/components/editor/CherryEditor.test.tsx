import { render, waitFor } from '@testing-library/react';
import { CherryEditor } from './CherryEditor';

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

jest.mock('../../stores/fileStore', () => ({
  useFileStore: (selector: (state: any) => any) =>
    selector({
      currentFile: {
        path: '/Users/xzr/docs/note.md',
        name: 'note.md',
        content: '![本地图](./img/a.png)\n\n![网络图](https://example.com/b.png)',
        modified: false,
      },
      updateContent: jest.fn(),
      reloadVersion: 0,
    }),
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

jest.mock('../ui/Toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
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
