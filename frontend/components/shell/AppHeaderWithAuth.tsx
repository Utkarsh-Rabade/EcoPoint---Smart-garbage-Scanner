"use client";

/**
 * Wraps AppHeader with a Supabase sign-out handler.
 * Must be a client component because it uses the browser Supabase client.
 *
 * The parent ShellProvider (Server Component) passes user data down;
 * this thin wrapper adds the sign-out behavior.
 */

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "./AppHeader";

interface AppHeaderWithAuthProps {
  userName?: string | null;
  userEmail?: string | null;
}

export function AppHeaderWithAuth({ userName, userEmail }: AppHeaderWithAuthProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <AppHeader
      userName={userName}
      userEmail={userEmail}
      onSignOut={handleSignOut}
    />
  );
}
