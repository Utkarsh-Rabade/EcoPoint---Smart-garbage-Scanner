/**
 * EcoPoints — ShellProvider (Server Component)
 *
 * Reads the current Supabase session server-side and passes the user's
 * display name and email to the client shell components.
 *
 * This is a Server Component — no "use client" directive.
 * It renders the client AppHeader / MobileHeader / BottomNav with hydrated user data.
 */

import { createClient } from "@/lib/supabase/server";
import { AppHeaderWithAuth } from "./AppHeaderWithAuth";
import { BottomNav, MobileHeader } from "./MobileNav";

export async function ShellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort: if the client isn't configured yet, degrade gracefully.
  let userName: string | null = null;
  let userEmail: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      userEmail = user.email ?? null;
      // Use display_name from user_metadata if available, else email prefix
      userName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        (userEmail ? userEmail.split("@")[0] : null);
    }
  } catch {
    // Supabase env vars not yet configured — silently degrade
  }

  return (
    <div id="ep-shell">
      {/* Desktop header — hidden on mobile via CSS */}
      <AppHeaderWithAuth
        userName={userName}
        userEmail={userEmail}
      />

      {/* Mobile compact header — hidden on desktop via CSS */}
      <MobileHeader userName={userName} />

      {/* Page content */}
      <main id="ep-main">{children}</main>

      {/* Mobile bottom tab bar — hidden on desktop via CSS */}
      <BottomNav />
    </div>
  );
}
