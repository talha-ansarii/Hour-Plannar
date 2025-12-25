import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth, signIn } from "@/server/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/today");

  async function loginAction() {
    "use server";
    await signIn("google", { redirectTo: "/today" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use your Google account to continue.
        </p>
      </div>

      <form action={loginAction} className="w-full">
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>
    </main>
  );
}


