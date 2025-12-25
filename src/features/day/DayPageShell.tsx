"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/trpc/react";
import { HourBlockCard, type HourBlockVM } from "@/features/day/HourBlockCard";
import { HourCompletionGrid } from "@/features/day/HourCompletionGrid";
import { NowClock } from "@/features/day/NowClock";
import { type TodoRow } from "@/features/todos/TodoItemRow";

type Mode = "planning" | "execution" | "history";

export function DayPageShell(props: {
  date: string;
  mode: Mode;
  today: string;
  timeZone: string;
  dailyLog: {
    id: string;
    date: string;
    status: "PLANNING" | "EXECUTION" | "HISTORY";
    isLocked: boolean;
    score: number | null;
    scorePreview: number;
    summary: string | null;
    aiSummary: string | null;
    sweptAt: Date | null;
  };
  blocks: HourBlockVM[];
}) {
  const utils = api.useUtils();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const [blocksState, setBlocksState] = useState<HourBlockVM[]>(props.blocks);
  const [activeTodoId, setActiveTodoId] = useState<string | null>(null);

  useEffect(() => {
    setBlocksState(props.blocks);
  }, [props.blocks]);

  const lockDay = api.daily.lockDay.useMutation({
    onSuccess: async () => utils.daily.getDay.invalidate({ date: props.date }),
  });
  const unlockDay = api.daily.unlockDay.useMutation({
    onSuccess: async () => utils.daily.getDay.invalidate({ date: props.date }),
  });

  const generateSummary = api.daily.generateSummary.useMutation({
    onSuccess: async () => utils.daily.getDay.invalidate({ date: props.date }),
  });

  const updateStatus = api.todos.updateStatus.useMutation({
    onMutate: async ({ todoId, status }) => {
      await utils.daily.getDay.cancel({ date: props.date });
      const prev = utils.daily.getDay.getData({ date: props.date });

      utils.daily.getDay.setData({ date: props.date }, (cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          blocks: cur.blocks.map((b) => ({
            ...b,
            todos: b.todos.map((t) => (t.id === todoId ? { ...t, status } : t)),
          })),
        };
      });

      return { prev };
    },
    onError: (_err, _input, ctx2) => {
      if (ctx2?.prev) utils.daily.getDay.setData({ date: props.date }, ctx2.prev);
    },
    onSettled: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const updateBlockStatus = api.todos.updateBlockStatus.useMutation({
    onMutate: async ({ blockId, status }) => {
      await utils.daily.getDay.cancel({ date: props.date });
      const prev = utils.daily.getDay.getData({ date: props.date });

      utils.daily.getDay.setData({ date: props.date }, (cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          blocks: cur.blocks.map((b) =>
            b.id === blockId
              ? { ...b, todos: b.todos.map((t) => ({ ...t, status })) }
              : b,
          ),
        };
      });

      return { prev };
    },
    onError: (_err, _input, ctx2) => {
      if (ctx2?.prev) utils.daily.getDay.setData({ date: props.date }, ctx2.prev);
    },
    onSettled: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const deleteTodo = api.todos.delete.useMutation({
    onMutate: async ({ todoId }) => {
      await utils.daily.getDay.cancel({ date: props.date });
      const prev = utils.daily.getDay.getData({ date: props.date });

      utils.daily.getDay.setData({ date: props.date }, (cur) => {
        if (!cur) return cur;
        return {
          ...cur,
          blocks: cur.blocks.map((b) => ({
            ...b,
            todos: b.todos.filter((t) => t.id !== todoId),
          })),
        };
      });

      return { prev };
    },
    onError: (_err, _input, ctx2) => {
      if (ctx2?.prev) utils.daily.getDay.setData({ date: props.date }, ctx2.prev);
    },
    onSettled: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const moveTodo = api.todos.move.useMutation({
    onMutate: async (input) => {
      await utils.daily.getDay.cancel({ date: props.date });
      const prev = utils.daily.getDay.getData({ date: props.date });

      utils.daily.getDay.setData({ date: props.date }, (cur) => {
        if (!cur) return cur;

        const blocks = cur.blocks.map((b) => ({ ...b, todos: b.todos.slice() }));
        const source = blocks.find((b) => b.todos.some((t) => t.id === input.todoId));
        const target = blocks.find((b) => b.id === input.targetBlockId);
        if (!source || !target) return cur;

        const todo = source.todos.find((t) => t.id === input.todoId);
        if (!todo) return cur;

        source.todos = source.todos.filter((t) => t.id !== input.todoId);
        const insertAt =
          input.targetIndex == null
            ? target.todos.length
            : Math.max(0, Math.min(target.todos.length, input.targetIndex));
        target.todos = target.todos.slice();
        target.todos.splice(insertAt, 0, todo);

        return { ...cur, blocks };
      });

      return { prev };
    },
    onError: (_err, _input, ctx2) => {
      if (ctx2?.prev) utils.daily.getDay.setData({ date: props.date }, ctx2.prev);
    },
    onSettled: async () => {
      await utils.daily.getDay.invalidate({ date: props.date });
    },
  });

  const canEditStructure = props.mode !== "history";
  const lockLabel = props.dailyLog.isLocked ? "Unlock day" : "Lock day";

  const blocks = useMemo(
    () => blocksState.slice().sort((a, b) => a.hour - b.hour),
    [blocksState],
  );

  const todoIndex = useMemo(() => {
    const map = new Map<string, TodoRow>();
    for (const b of blocks) {
      for (const t of b.todos) map.set(t.id, t);
    }
    return map;
  }, [blocks]);

  function findBlockIdForTodo(todoId: string) {
    for (const b of blocksState) {
      if (b.todos.some((t) => t.id === todoId)) return b.id;
    }
    return null;
  }

  function isBlockId(id: string) {
    return blocksState.some((b) => b.id === id);
  }

  function moveLocalBetweenBlocks(input: {
    activeId: string;
    fromBlockId: string;
    toBlockId: string;
    overId: string | null;
  }) {
    setBlocksState((cur) => {
      const next = cur.map((b) => ({ ...b, todos: b.todos.slice() }));
      const source = next.find((b) => b.id === input.fromBlockId);
      const target = next.find((b) => b.id === input.toBlockId);
      if (!source || !target) return cur;
      const idx = source.todos.findIndex((t) => t.id === input.activeId);
      if (idx < 0) return cur;
      const todo = source.todos[idx];
      if (!todo) return cur;
      source.todos.splice(idx, 1);

      const insertAt =
        input.overId == null
          ? target.todos.length
          : target.todos.findIndex((t) => t.id === input.overId);
      target.todos.splice(insertAt < 0 ? target.todos.length : insertAt, 0, todo);
      return next;
    });
  }

  function reorderLocalWithinBlock(blockId: string, activeId: string, overId: string) {
    setBlocksState((cur) => {
      const next = cur.map((b) => ({ ...b, todos: b.todos.slice() }));
      const block = next.find((b) => b.id === blockId);
      if (!block) return cur;
      const oldIndex = block.todos.findIndex((t) => t.id === activeId);
      const newIndex = block.todos.findIndex((t) => t.id === overId);
      if (oldIndex < 0 || newIndex < 0) return cur;
      block.todos = arrayMove(block.todos, oldIndex, newIndex);
      return next;
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActiveTodoId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const fromBlockId = findBlockIdForTodo(activeId);
    if (!fromBlockId) return;

    const toBlockId = isBlockId(overId) ? overId : findBlockIdForTodo(overId);
    if (!toBlockId) return;

    if (fromBlockId !== toBlockId) {
      moveLocalBetweenBlocks({
        activeId,
        fromBlockId,
        toBlockId,
        overId: isBlockId(overId) ? null : overId,
      });
    }
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    setActiveTodoId(null);
    if (!overId) return;

    const fromBlockId = findBlockIdForTodo(activeId);
    if (!fromBlockId) return;

    const toBlockId = isBlockId(overId) ? overId : findBlockIdForTodo(overId);
    if (!toBlockId) return;

    if (fromBlockId === toBlockId && !isBlockId(overId)) {
      reorderLocalWithinBlock(fromBlockId, activeId, overId);
    }

    const target = blocksState.find((b) => b.id === toBlockId);
    if (!target) return;
    const targetIndex = target.todos.findIndex((t) => t.id === activeId);

    moveTodo.mutate({
      todoId: activeId,
      targetBlockId: toBlockId,
      targetIndex: targetIndex < 0 ? 0 : targetIndex,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            {props.mode === "execution"
              ? "Execution Mode"
              : props.mode === "planning"
                ? "Planning Mode"
                : "History Mode"}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatDateKeyForDisplay(props.date, props.timeZone)}
          </h1>
          <div className="text-sm text-muted-foreground">
            <NowClock timeZone={props.timeZone} />
          </div>
        </div>

        <div className="flex items-start justify-end">
          <HourCompletionGrid
            blocks={blocks.map((b) => ({
              id: b.id,
              hour: b.hour,
              doneCount: b.doneCount,
              totalCount: b.totalCount,
            }))}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canEditStructure ? (
          <Button
            variant="outline"
            onClick={() => {
              if (props.dailyLog.isLocked) {
                unlockDay.mutate({ date: props.date });
              } else {
                lockDay.mutate({ date: props.date });
              }
            }}
            disabled={lockDay.isPending || unlockDay.isPending}
          >
            {lockLabel}
          </Button>
        ) : null}

        <Button
          onClick={() => generateSummary.mutate({ date: props.date })}
          disabled={generateSummary.isPending}
        >
          AI rewrite
        </Button>
      </div>

      {!props.dailyLog.isLocked && canEditStructure ? (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
          Day is <span className="font-medium">unlocked</span>. Lock it to freeze planning fields and ordering.
        </div>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {blocks.map((b) => (
            <HourBlockCard
              key={b.id}
              date={props.date}
              block={b}
              mode={props.mode}
              onToggleTodo={(todoId, next) =>
                updateStatus.mutate({ todoId, status: next })
              }
              onToggleAllTodos={(next) =>
                updateBlockStatus.mutate({ blockId: b.id, status: next })
              }
              onDeleteTodo={(todoId) => deleteTodo.mutate({ todoId })}
              planOptimistic={(text) => {
                utils.daily.getDay.setData({ date: props.date }, (cur) => {
                  if (!cur) return cur;
                  return {
                    ...cur,
                    blocks: cur.blocks.map((blk) =>
                      blk.id === b.id ? { ...blk, plannedText: text } : blk,
                    ),
                  };
                });
              }}
              reflectionOptimistic={(text) => {
                utils.daily.getDay.setData({ date: props.date }, (cur) => {
                  if (!cur) return cur;
                  return {
                    ...cur,
                    blocks: cur.blocks.map((blk) =>
                      blk.id === b.id ? { ...blk, reflectionText: text } : blk,
                    ),
                  };
                });
              }}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTodoId ? (
            <div className="rounded-md border bg-background px-3 py-2 text-sm shadow">
              {todoIndex.get(activeTodoId)?.title ?? ""}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Score: {props.dailyLog.score ?? props.dailyLog.scorePreview}
            {props.dailyLog.score == null ? " (preview)" : ""}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Deterministic</div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
              {props.dailyLog.summary ?? "(No summary yet)"}
            </pre>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">AI</div>
            <pre className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
              {props.dailyLog.aiSummary ?? "(No AI summary yet)"}
            </pre>
            {generateSummary.data?.aiError ? (
              <div className="text-xs text-destructive">
                AI rewrite failed: {generateSummary.data.aiError}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDateKeyForDisplay(dateKey: string, timeZone: string) {
  // Use UTC midday to avoid timezone-shift when formatting.
  const [yStr, mStr, dStr] = dateKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const safe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(safe);
}


