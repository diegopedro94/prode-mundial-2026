import { redirect } from "next/navigation";

import { LoginButton } from "@/app/login/login-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Prode Mundial 2026</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Ingres&aacute; con tu cuenta de Google. Solo emails autorizados.
          </p>
        </div>
        <LoginButton />
      </div>
    </main>
  );
}
