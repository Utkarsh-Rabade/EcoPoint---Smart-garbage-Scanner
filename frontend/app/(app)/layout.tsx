/**
 * Authenticated app shell layout.
 * Wraps all routes inside (app): /dashboard /history /rewards /leaderboard /profile /submit
 *
 * ShellProvider is a Server Component — it fetches the Supabase user
 * server-side and renders the desktop header, mobile header, and bottom nav.
 * Public/auth pages (login, signup) do NOT use this layout.
 */

import { ShellProvider } from "@/components/shell/ShellProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ShellProvider>{children}</ShellProvider>;
}
