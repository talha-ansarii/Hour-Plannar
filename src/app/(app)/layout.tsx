import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/server/auth";

export default async function AppLayout(props: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/auth/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/today" className="font-semibold">
              Hourly Planner
            </Link>
            <nav className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
              <Link className="hover:text-foreground" href="/today">
                Today
              </Link>
              <Link className="hover:text-foreground" href="/history">
                History
              </Link>
              <Link className="hover:text-foreground" href="/backlog">
                Backlog
              </Link>
              <Link className="hover:text-foreground" href="/analytics">
                Analytics
              </Link>
            </nav>
          </div>

          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-[90vw] max-w-none px-4 py-6">{props.children}</main>
    </div>
  );
}


