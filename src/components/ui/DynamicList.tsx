"use client";

import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";

interface DynamicListProps<T> {
  items: T[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  addLabel?: string;
}

export default function DynamicList<T>({
  items,
  onAdd,
  onRemove,
  renderItem,
  addLabel = "Add",
}: DynamicListProps<T>) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-1">{renderItem(item, index)}</div>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="btn-icon text-red-400 hover:text-red-300 mt-1"
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <HiOutlinePlus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}
