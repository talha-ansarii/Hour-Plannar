"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { GripVerticalIcon } from "lucide-react";

import { TodoItemRow, type TodoRow } from "@/features/todos/TodoItemRow";

export function SortableTodoRow(props: {
  todo: TodoRow;
  disabled: boolean;
  canToggle: boolean;
  onToggle: (next: "PENDING" | "DONE") => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const sortable = useSortable({
    id: props.todo.id,
    disabled: props.disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="flex items-start gap-1"
    >
      <button
        type="button"
        aria-label="Drag"
        className="mt-1 rounded-md px-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVerticalIcon className="size-4" />
      </button>
      <div className="min-w-0 flex-1">
        <TodoItemRow
          todo={props.todo}
          disabled={props.disabled}
          canToggle={props.canToggle}
          onToggle={props.onToggle}
          canDelete={props.canDelete}
          onDelete={props.onDelete}
        />
      </div>
    </div>
  );
}


