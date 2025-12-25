"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";
import { RestoreDialog } from "@/features/backlog/RestoreDialog";

export function BacklogClient() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const list = api.backlog.list.useQuery({ page, pageSize });

  if (list.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (list.error) return <div className="text-sm text-destructive">{list.error.message}</div>;
  if (!list.data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Page {list.data.page} / {list.data.totalPages} · {list.data.totalCount} items
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(list.data.totalPages, p + 1))}
            disabled={page >= list.data.totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="divide-y rounded-md border">
        {list.data.items.map((i) => (
          <div key={i.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-sm">{i.title}</div>
              <div className="text-xs text-muted-foreground">
                est {i.estimatedMinutes}m
                {i.sourceDate ? ` · from ${i.sourceDate}${i.sourceHour != null ? `@${i.sourceHour}` : ""}` : ""}
              </div>
            </div>
            <RestoreDialog item={i} />
          </div>
        ))}
      </div>
    </div>
  );
}


