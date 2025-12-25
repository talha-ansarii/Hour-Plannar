"use client";

import { api } from "@/trpc/react";
import { TodoItemRow, type TodoRow } from "@/features/todos/TodoItemRow";

export function TodoList(props: {
  todos: TodoRow[];
  disabled: boolean;
  canToggle: boolean;
}) {
  const utils = api.useUtils();

  const updateStatus = api.todos.updateStatus.useMutation({
    onSuccess: async () => {
      await utils.daily.getDay.invalidate();
    },
  });

  return (
    <div className="space-y-1">
      {props.todos.length === 0 ? (
        <div className="px-2 py-1 text-sm text-muted-foreground">(No todos)</div>
      ) : null}
      {props.todos.map((t) => (
        <TodoItemRow
          key={t.id}
          todo={t}
          disabled={props.disabled || updateStatus.isPending}
          canToggle={props.canToggle}
          onToggle={(next) => updateStatus.mutate({ todoId: t.id, status: next })}
          canDelete={false}
          onDelete={() => void 0}
        />
      ))}
    </div>
  );
}


