"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StreakCard(props: { streak: number; endsOn: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Streak</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-3xl font-semibold">{props.streak}</div>
        <div className="text-sm text-muted-foreground">
          consecutive scored days ending on {props.endsOn}
        </div>
      </CardContent>
    </Card>
  );
}


