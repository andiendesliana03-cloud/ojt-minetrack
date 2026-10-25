
"use client";

import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function PresenceTracker() {
  useEffect(() => {
    let stopped = false;
    let running = false;

    async function heartbeat() {
      if (stopped || running) return;

      if (document.visibilityState !== "visible") {
        return;
      }

      running = true;

      try {
        // Periksa status Maintenance Mode.
        const {
          data: setting,
          error: settingError,
        } = await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .maybeSingle();

        // Jika status maintenance tidak dapat
        // dipastikan, jangan catat aktivitas.
        if (settingError || !setting) {
          return;
        }

        // Selama maintenance aktif,
        // aktivitas peserta tidak dicatat.
        if (setting.maintenance_mode === true) {
          return;
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user || stopped) {
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError || !profile || stopped) {
          return;
        }

        const role = String(profile.role || "")
          .trim()
          .toLowerCase();

        // Admin dan Mentor tidak dicatat
        // sebagai peserta aktif.
        if (
          role !== "participant" &&
          role !== "peserta"
        ) {
          return;
        }

        if (stopped) return;

        await supabase
          .from("participant_presence")
          .upsert(
            {
              user_id: user.id,
              last_seen_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id",
            }
          );
      } catch (error) {
        console.error(
          "PresenceTracker error:",
          error
        );
      } finally {
        running = false;
      }
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
