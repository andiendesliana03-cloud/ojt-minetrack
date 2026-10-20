
"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function PresenceTracker() {
  useEffect(() => {
    let stopped = false;

    async function heartbeat() {
      if (document.visibilityState !== "visible") {
        return;
      }

      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user || stopped) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (
        profile?.role !== "participant" &&
        profile?.role !== "peserta"
      ) {
        return;
      }

      await supabase
        .from("participant_presence")
        .upsert(
          {
            user_id: user.id,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    }

    heartbeat();

    const interval = setInterval(
      heartbeat,
      60000
    );

    document.addEventListener(
      "visibilitychange",
      heartbeat
    );

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        heartbeat
      );
    };
  }, []);

  return null;
}
