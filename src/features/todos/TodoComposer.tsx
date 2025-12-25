"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/trpc/react";
import { Plus } from "lucide-react";

export function TodoComposer(props: {
  date: string;
  blockId: string;
  disabled: boolean;
  onCreated?: () => void;
}) {
  const utils = api.useUtils();
  const [title, setTitle] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState(15);

  const create = api.todos.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      await utils.daily.getDay.invalidate({ date: props.date });
      props.onCreated?.();
    },
  });

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (props.disabled) return;
        const trimmed = title.trim();
        if (!trimmed) return;
        create.mutate({
          blockId: props.blockId,
          title: trimmed,
          estimateMinutes,
        });
      }}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a todo…"
        disabled={props.disabled || create.isPending}
      />
      <Input
        className="w-20"
        inputMode="numeric"
        value={String(estimateMinutes)}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) setEstimateMinutes(Math.max(0, Math.min(1440, Math.floor(n))));
        }}
        disabled={props.disabled || create.isPending}
      />
      <Button
        type="submit"
        size="icon"
        disabled={props.disabled || create.isPending}
        aria-label="Add todo"
        title="Add todo"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}


