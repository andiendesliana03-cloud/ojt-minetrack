
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function MaintenanceGuard({
  children,
}) {
  const [checking, setChecking] = useState(true);
  const [maintenance, setMaintenance] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const { data: setting, error: settingError } =
          await supabase
            .from("app_settings")
            .select("maintenance_mode")
            .eq("id", 1)
            .single();

        if (settingError) throw settingError;

        const enabled =
          setting?.maintenance_mode === true;

        if (!enabled) {
          if (mounted) {
            setMaintenance(false);
            setChecking(false);
          }
          return;
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        let admin = false;

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          admin =
            String(profile?.role || "")
              .trim()
              .toLowerCase() === "admin";
        }

        if (mounted) {
          setIsAdmin(admin);
          setMaintenance(true);
          setChecking(false);
        }
      } catch (error) {
        console.error(
          "Maintenance check failed:",
          error
        );

        if (mounted) {
          setChecking(false);
        }
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#071b22",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Memeriksa akses OJT MineTrack...
      </div>
    );
  }

  if (maintenance && !isAdmin) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background:
            "linear-gradient(145deg, #071b22, #124734)",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            textAlign: "center",
            padding: "40px 24px",
            borderRadius: 24,
            background: "rgba(255,255,255,0.08)",
            border:
              "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <div
            style={{
              fontSize: 55,
              marginBottom: 20,
            }}
          >
            🛠️
          </div>

          <div
            style={{
              color: "#d8b45a",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              marginBottom: 14,
            }}
          >
            OJT MINETRACK v2.0
          </div>

          <h1
            style={{
              fontSize: 28,
              lineHeight: 1.3,
              marginBottom: 16,
            }}
          >
            Website Sedang Dalam Pemeliharaan
          </h1>

          <p
            style={{
              color: "#d3e5dc",
              fontSize: 14,
              lineHeight: 1.9,
            }}
          >
            Sistem Monitoring dan Evaluasi OJT
            sedang menjalani proses pemeliharaan
            dan peningkatan layanan.
          </p>

          <p
            style={{
              color: "#d8b45a",
              fontWeight: 700,
              marginTop: 24,
            }}
          >
            Silakan kembali beberapa saat lagi.
          </p>

          <div
            style={{
              marginTop: 35,
              paddingTop: 20,
              borderTop:
                "1px solid rgba(255,255,255,0.15)",
              fontSize: 11,
              color: "#b8ccc1",
            }}
          >
            Emergency Response Group
            <br />
            PT Berau Coal
          </div>
        </div>
      </main>
    );
  }

  return children;
}
