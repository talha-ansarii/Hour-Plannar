"use client";

import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";

import { type TodoRow } from "@/features/todos/TodoItemRow";
import { SortableTodoRow } from "@/features/todos/SortableTodoRow";

export function TodoListDnd(props: {
  blockId: string;
  todos: TodoRow[];
  disabled: boolean;
  canToggle: boolean;
  onToggle: (todoId: string, next: "PENDING" | "DONE") => void;
  canDelete: boolean;
  onDelete: (todoId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: props.blockId });
  const ids = props.todos.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`space-y-1 rounded-md ${isOver ? "bg-muted/40" : ""}`}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {props.todos.length === 0 ? (
          <div className="px-2 py-1 text-sm text-muted-foreground">(No todos)</div>
        ) : null}
        {props.todos.map((t) => (
          <SortableTodoRow
            key={t.id}
            todo={t}
            disabled={props.disabled}
            canToggle={props.canToggle}
            onToggle={(next) => props.onToggle(t.id, next)}
            canDelete={props.canDelete}
            onDelete={() => props.onDelete(t.id)}
          />
        ))}
      </SortableContext>
    </div>
  );
}


