import { resolveImageSrc } from '../markdownImage';

describe('resolveImageSrc', () => {
  const realInternals = (globalThis as any).window?.__TAURI_INTERNALS__;

  beforeEach(() => {
    // 与 Tauri 注入的 convertFileSrc 行为一致：整个路径 encodeURIComponent
    (globalThis as any).window.__TAURI_INTERNALS__ = {
      convertFileSrc: (p: string) => `asset://localhost${encodeURIComponent(p)}`,
    };
  });

  afterEach(() => {
    (globalThis as any).window.__TAURI_INTERNALS__ = realInternals;
  });

  it('http 链接原样返回', () => {
    expect(resolveImageSrc('https://example.com/a.png', '/Users/xzr/docs')).toBe('https://example.com/a.png');
    expect(resolveImageSrc('http://example.com/a.png', '/Users/xzr/docs')).toBe('http://example.com/a.png');
  });

  it('data / asset 协议原样返回', () => {
    expect(resolveImageSrc('data:image/png;base64,abc', '/Users/xzr/docs')).toBe('data:image/png;base64,abc');
    expect(resolveImageSrc('asset://localhost/Users/xzr/a.png', '/Users/xzr/docs')).toBe('asset://localhost/Users/xzr/a.png');
  });

  it('相对路径基于 markdown 文件目录解析为 asset URL', () => {
    expect(resolveImageSrc('./images/foo.png', '/Users/xzr/docs')).toBe(
      'asset://localhost%2FUsers%2Fxzr%2Fdocs%2Fimages%2Ffoo.png',
    );
  });

  it('处理 ../ 相对路径', () => {
    expect(resolveImageSrc('../assets/pic.png', '/Users/xzr/docs/notes')).toBe(
      'asset://localhost%2FUsers%2Fxzr%2Fdocs%2Fassets%2Fpic.png',
    );
  });

  it('绝对路径转换为 asset URL', () => {
    expect(resolveImageSrc('/Users/xzr/Desktop/pic.png', '/Users/xzr/docs')).toBe(
      'asset://localhost%2FUsers%2Fxzr%2FDesktop%2Fpic.png',
    );
  });

  it('无基础目录时相对路径原样返回', () => {
    expect(resolveImageSrc('./images/foo.png', null)).toBe('./images/foo.png');
  });

  it('非 Tauri 环境不转换', () => {
    (globalThis as any).window.__TAURI_INTERNALS__ = undefined;
    expect(resolveImageSrc('/Users/xzr/Desktop/pic.png', '/Users/xzr/docs')).toBe('/Users/xzr/Desktop/pic.png');
  });
});
