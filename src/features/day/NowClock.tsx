"use client";

import { useEffect, useMemo, useState } from "react";

function formatNow(timeZone: string, now: Date) {
  const fmt = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return fmt.format(now);
}

export function NowClock(props: { timeZone: string }) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date(0));

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const label = useMemo(() => formatNow(props.timeZone, now), [props.timeZone, now]);

  if (!mounted) {
    return <span className="tabular-nums text-muted-foreground">—</span>;
  }

  return <span className="tabular-nums">{label}</span>;
}


