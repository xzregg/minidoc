/**
 * 检测是否在 Tauri WebView 环境中运行
 * Tauri 2.x 使用 __TAURI__ 全局对象
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as typeof window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  // Tauri 2.x 使用 __TAURI__，旧版本使用 __TAURI_INTERNALS__
  return typeof w.__TAURI__ !== 'undefined' || typeof w.__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * 安全地获取 invoke 函数
 */
export async function getInvoke(): Promise<(<T>(command: string, args?: Record<string, unknown>) => Promise<T>) | null> {
  if (!isTauri()) {
    console.warn('[Tauri] 不在 Tauri 环境中');
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    if (typeof invoke !== 'function') {
      console.warn('[Tauri] invoke 不是函数');
      return null;
    }
    return invoke;
  } catch (e) {
    console.warn('[Tauri] 无法导入 invoke:', e);
    return null;
  }
}
