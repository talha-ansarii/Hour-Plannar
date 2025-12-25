"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2Icon } from "lucide-react";

export type TodoRow = {
  id: string;
  title: string;
  status: "PENDING" | "DONE";
  estimatedMinutes: number;
  actualMinutes: number | null;
};

export function TodoItemRow(props: {
  todo: TodoRow;
  disabled: boolean;
  canToggle: boolean;
  onToggle: (next: "PENDING" | "DONE") => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const isDone = props.todo.status === "DONE";
  return (
    <div className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-muted/60">
      <Checkbox
        checked={isDone}
        disabled={props.disabled || !props.canToggle}
        onCheckedChange={(checked) => props.onToggle(checked ? "DONE" : "PENDING")}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-sm",
            isDone && "text-muted-foreground line-through",
          )}
          title={props.todo.title}
        >
          {props.todo.title}
        </div>
        <div className="text-xs text-muted-foreground">
          est {props.todo.estimatedMinutes}m
          {props.todo.actualMinutes != null ? ` · act ${props.todo.actualMinutes}m` : ""}
        </div>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={props.onDelete}
        disabled={props.disabled || !props.canDelete}
        aria-label="Delete todo"
      >
        <Trash2Icon className="h-4 w-4" />
      </Button>
    </div>
  );
}


