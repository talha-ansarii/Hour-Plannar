"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { CompletionMeter } from "@/features/day/CompletionMeter";
import { TodoComposer } from "@/features/todos/TodoComposer";
import { TodoListDnd } from "@/features/todos/TodoListDnd";
import { cn } from "@/lib/utils";
import { CircleCheck, RotateCcw } from "lucide-react";

export type HourBlockVM = {
  id: string;
  hour: number;
  plannedText: string;
  reflectionText: string;
  isLocked: boolean;
  estimatedTotal: number;
  doneCount: number;
  totalCount: number;
  todos: Array<{
    id: string;
    title: string;
    status: "PENDING" | "DONE";
    estimatedMinutes: number;
    actualMinutes: number | null;
    sortOrder: number;
  }>;
};

type Mode = "planning" | "execution" | "history";

function hourLabel(hour: number) {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const ampm = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${String(twelve).padStart(2, "0")}:00 ${ampm}`;
}

export function HourBlockCard(props: {
  date: string;
  block: HourBlockVM;
  mode: Mode;
  onToggleTodo: (todoId: string, next: "PENDING" | "DONE") => void;
  onToggleAllTodos: (next: "PENDING" | "DONE") => void;
  onDeleteTodo: (todoId: string) => void;
  planOptimistic: (text: string) => void;
  reflectionOptimistic: (text: string) => void;
}) {
  const utils = api.useUtils();
  const [planDraft, setPlanDraft] = useState(props.block.plannedText);
  const [reflectionDraft, setReflectionDraft] = useState(props.block.reflectionText);

  const updatePlan = api.blocks.updatePlan.useMutation({
    onMutate: async ({ text }) => {
      props.planOptimistic(text);
    },
    onSuccess: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const updateReflection = api.blocks.updateReflection.useMutation({
    onMutate: async ({ text }) => {
      props.reflectionOptimistic(text);
    },
    onSuccess: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const isHistory = props.mode === "history";
  const isPlanning = props.mode === "planning";
  const isExecution = props.mode === "execution";

  const planDisabled = isHistory || props.block.isLocked || updatePlan.isPending;
  const canAddTodo = (isPlanning || isExecution) && !props.block.isLocked && !isHistory;
  const canToggleTodos = isExecution && !isHistory;
  const canDeleteTodos = (isPlanning || isExecution) && !props.block.isLocked && !isHistory;

  const isCompleted = useMemo(() => {
    if (props.block.totalCount <= 0) return false;
    return props.block.doneCount === props.block.totalCount;
  }, [props.block.doneCount, props.block.totalCount]);

  return (
    <Card
      id={`hour-${props.block.hour}`}
      className={cn(
        "scroll-mt-20",
        isCompleted && "border-emerald-300 bg-emerald-50/40",
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-4">
          <CardTitle className="text-base">{hourLabel(props.block.hour)}</CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">est {props.block.estimatedTotal}m</div>
            {isExecution ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => props.onToggleAllTodos(isCompleted ? "PENDING" : "DONE")}
                disabled={isHistory || props.block.isLocked || props.block.totalCount === 0}
                aria-label={isCompleted ? "Mark hour uncompleted" : "Mark hour completed"}
                title={isCompleted ? "Mark uncompleted" : "Mark completed"}
              >
                {isCompleted ? (
                  <RotateCcw className="h-4 w-4" />
                ) : (
                  <CircleCheck className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Plan</div>
          <Textarea
            value={planDraft}
            onChange={(e) => setPlanDraft(e.target.value)}
            onBlur={() => {
              if (planDisabled) return;
              if (planDraft !== props.block.plannedText) {
                updatePlan.mutate({ blockId: props.block.id, text: planDraft });
              }
            }}
            disabled={planDisabled}
            className={cn("min-h-20", planDisabled && "opacity-80")}
            placeholder={isPlanning ? "What will you do in this hour?" : ""}
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Todos</div>
          <TodoListDnd
            blockId={props.block.id}
            todos={props.block.todos}
            disabled={isHistory}
            canToggle={canToggleTodos}
            onToggle={props.onToggleTodo}
            canDelete={canDeleteTodos}
            onDelete={props.onDeleteTodo}
          />
          {canAddTodo ? (
            <TodoComposer date={props.date} blockId={props.block.id} disabled={!canAddTodo} />
          ) : null}
        </div>

        {isExecution ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Reflection</div>
            <Textarea
              value={reflectionDraft}
              onChange={(e) => setReflectionDraft(e.target.value)}
              onBlur={() => {
                if (isHistory) return;
                if (reflectionDraft !== props.block.reflectionText) {
                  updateReflection.mutate({ blockId: props.block.id, text: reflectionDraft });
                }
              }}
              disabled={isHistory || updateReflection.isPending}
              className="min-h-20"
              placeholder="What happened? What did you learn?"
            />
          </div>
        ) : null}

        <CompletionMeter done={props.block.doneCount} total={props.block.totalCount} />
      </CardContent>
    </Card>
  );
}


