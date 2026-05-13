import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// `@supabase/ssr` 0.5 has a type-inference bug where `createServerClient<Database>`
// does not propagate `Database` into the returned client's mutation methods, so
// `.upsert(row)` and friends type-check against `never`. Casting to
// `SupabaseClient<Database>` from `@supabase/supabase-js` restores typing.
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Setting cookies fails in Server Components. The middleware refreshes
            // the session so this is safe to ignore here.
          }
        },
      },
    },
  ) as unknown as SupabaseClient<Database>;
}
