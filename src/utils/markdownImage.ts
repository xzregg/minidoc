import { convertFileSrc } from '@tauri-apps/api/core';

const REMOTE_PROTOCOLS = ['http:', 'https:', 'data:', 'blob:', 'asset:', 'tauri:', 'ipc:', 'file:'];

function isRemoteUrl(src: string): boolean {
  return REMOTE_PROTOCOLS.some((protocol) => src.toLowerCase().startsWith(protocol));
}

function normalizeAbsolute(path: string): string {
  const parts = path.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return `/${out.join('/')}`;
}

function toAbsolutePath(src: string, baseDir: string | null): string | null {
  // 本地绝对路径（macOS/Linux 或 Windows 盘符）
  if (src.startsWith('/')) return normalizeAbsolute(src);
  if (/^[A-Za-z]:[\\/]/.test(src)) return src.replace(/\\/g, '/');

  // 相对路径：基于 markdown 文件所在目录解析
  if (baseDir && baseDir.startsWith('/')) {
    return normalizeAbsolute(`${baseDir}/${src}`);
  }
  return null;
}

function toAssetUrl(path: string): string {
  // 仅在 Tauri 环境转换；纯浏览器环境（如 vite dev）原样返回
  const internals = (globalThis as any).window?.__TAURI_INTERNALS__;
  if (internals) return convertFileSrc(path);
  return path;
}

/**
 * 将 markdown 图片链接解析为 webview 可加载的 URL：
 * - http(s)/data/asset 等协议原样返回
 * - 相对路径基于 markdown 文件所在目录解析为绝对路径
 * - 本地绝对路径通过 Tauri asset 协议（convertFileSrc）加载
 */
export function resolveImageSrc(src: string, baseDir: string | null): string {
  if (!src || isRemoteUrl(src)) return src;

  const absPath = toAbsolutePath(src, baseDir);
  if (!absPath) return src;

  return toAssetUrl(absPath);
}
