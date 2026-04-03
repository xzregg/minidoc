// Jest 测试环境设置
import '@testing-library/jest-dom';

// Mock Tauri API
global.__TAURI_INTERNALS__ = {
  transformCallback: () => 1,
};

// Mock window.__TAURI__
Object.defineProperty(window, '__TAURI__', {
  value: {
    tauri: {
      invoke: jest.fn(),
    },
  },
  writable: true,
});

// Mock Tauri core API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

// Mock Tauri dialog API
jest.mock('@tauri-apps/plugin-dialog', () => ({
  open: jest.fn(),
  save: jest.fn(),
}));

// Mock Tauri fs API
jest.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  readDir: jest.fn(),
  exists: jest.fn(),
}));

// 清除所有 mock 在每个测试后
afterEach(() => {
  jest.clearAllMocks();
});
