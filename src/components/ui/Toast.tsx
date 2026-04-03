import { create } from 'zustand';
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';

// Toast 类型定义
export type ToastType = 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

// Toast Store
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // 自动移除 Toast
    const duration = toast.duration ?? 3000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

// Toast 图标组件
const ToastIcon = ({ type }: { type: ToastType }) => {
  const icons = {
    success: <CheckCircle size={20} className="text-green-500 flex-shrink-0" />,
    error: <AlertCircle size={20} className="text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />,
  };
  return icons[type];
};

// Toast 样式配置
const toastStyles = {
  success: 'border-green-500 bg-green-50 dark:bg-green-900/20',
  error: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  warning: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20',
};

// Toast 组件
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg min-w-[300px] max-w-md animate-slide-in ${
            toastStyles[toast.type]
          }`}
        >
          <ToastIcon type={toast.type} />
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-200">
            {toast.message}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

// 便捷的 Toast Hook
export const useToast = () => {
  const { addToast } = useToastStore();

  return {
    success: (message: string, duration?: number) =>
      addToast({ type: 'success', message, duration }),
    error: (message: string, duration?: number) =>
      addToast({ type: 'error', message, duration }),
    warning: (message: string, duration?: number) =>
      addToast({ type: 'warning', message, duration }),
  };
};
