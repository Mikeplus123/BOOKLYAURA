import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAppUserAgent } from "@/lib/platform";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

// Keeps the Supabase auth session fresh on every navigation (rotates cookies before expiry).
export async function proxy(request: NextRequest) {
  // The content admin is a desktop tool; keep it out of the Android app.
  if (request.nextUrl.pathname.startsWith("/admin") && isAppUserAgent(request.headers.get("user-agent"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        // Prevent CDNs from caching responses that carry refreshed auth cookies.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Do not put code between createServerClient and getUser(): it revalidates the token.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|brand/|covers/|audio/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|m4a|ogg|wav)$).*)"],
};
