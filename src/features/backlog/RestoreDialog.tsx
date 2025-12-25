"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/trpc/react";

function isDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function RestoreDialog(props: {
  item: { id: string; title: string; estimatedMinutes: number };
  onRestored?: () => void;
}) {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [targetDate, setTargetDate] = useState("");
  const [targetHour, setTargetHour] = useState("9");

  const hours = useMemo(
    () => Array.from({ length: 24 }, (_, h) => String(h)),
    [],
  );

  const restore = api.backlog.restore.useMutation({
    onSuccess: async () => {
      await utils.backlog.list.invalidate();
      setOpen(false);
      props.onRestored?.();
    },
  });

  const dateOk = isDateKey(targetDate);
  const hourNum = Number(targetHour);
  const hourOk = Number.isFinite(hourNum) && hourNum >= 0 && hourNum <= 23;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Restore</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore to a future hour</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{props.item.title}</div>
            <div className="text-xs text-muted-foreground">
              est {props.item.estimatedMinutes}m
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Target date</div>
            <Input
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Target hour</div>
            <Select value={targetHour} onValueChange={setTargetHour}>
              <SelectTrigger>
                <SelectValue placeholder="Select hour" />
              </SelectTrigger>
              <SelectContent>
                {hours.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() =>
              restore.mutate({
                itemId: props.item.id,
                targetDate,
                targetHour: hourNum,
              })
            }
            disabled={!dateOk || !hourOk || restore.isPending}
          >
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


