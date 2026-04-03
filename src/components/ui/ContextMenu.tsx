import { useEffect, useRef } from 'react';
import { FiFilePlus, FiFolderPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';

export interface ContextMenuItem {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 调整位置防止超出视口
  const adjustPosition = () => {
    if (!menuRef.current) return { x: position.x, y: position.y };

    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = position.x;
    let y = position.y;

    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 8;
    }

    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 8;
    }

    return { x, y };
  };

  const adjustedPosition = adjustPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {items.map((item, index) => (
        <div key={index}>
          {item.divider && (
            <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          )}
          <button
            onClick={() => {
              if (!item.disabled && item.onClick) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
              item.disabled
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {item.icon && <span className="text-gray-500 dark:text-gray-400">{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// 预定义的文件树右键菜单项
export function getFileTreeContextMenuItems(
  item: { name: string; path: string; type: 'file' | 'directory' },
  handlers: {
    onNewFile?: () => void;
    onNewFolder?: () => void;
    onRename?: () => void;
    onDelete?: () => void;
  }
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];

  if (item.type === 'directory') {
    items.push(
      {
        label: '新建文件',
        icon: <FiFilePlus size={16} />,
        onClick: handlers.onNewFile || (() => {}),
      },
      {
        label: '新建文件夹',
        icon: <FiFolderPlus size={16} />,
        onClick: handlers.onNewFolder || (() => {}),
      },
      { divider: true }
    );
  }

  items.push(
    {
      label: '重命名',
      icon: <FiEdit2 size={16} />,
      onClick: handlers.onRename || (() => {}),
    },
    {
      label: '删除',
      icon: <FiTrash2 size={16} />,
      onClick: handlers.onDelete || (() => {}),
    }
  );

  return items;
}
