
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function MaintenanceGuard({ children }) {
  const pathname = usePathname();

  const [status, setStatus] = useState("checking");
  const [errorMessage, setErrorMessage] = useState("");

  const checkMaintenance = useCallback(async () => {
    try {
      const { data: setting, error: settingError } =
        await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .single();

      if (settingError) throw settingError;

      if (setting.maintenance_mode !== true) {
        setStatus("allowed");
        setErrorMessage("");
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        setStatus("maintenance");
        setErrorMessage("");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      const role = String(profile?.role || "")
        .trim()
        .toLowerCase();

      setStatus(
        role === "admin" ? "allowed" : "maintenance"
      );
      setErrorMessage("");
    } catch (error) {
      console.error("MaintenanceGuard:", error);
      setErrorMessage(
        "Status layanan tidak dapat diperiksa. Silakan coba lagi."
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    checkMaintenance();

    const interval = setInterval(
      checkMaintenance,
      15000
    );

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkMaintenance();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      // Hindari permintaan Supabase langsung
      // di dalam callback autentikasi.
      setStatus("checking");
    });

    return () => {
      clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      subscription.unsubscribe();
    };
  }, [checkMaintenance]);

  // Halaman login tetap dapat dibuka agar
  // Admin bisa masuk selama maintenance.
  // Dashboard tetap diperiksa berdasarkan role.
  if (pathname === "/login") {
    return children;
  }

  if (status === "checking") {
    return (
      <div style={styles.center}>
        Memeriksa akses OJT MineTrack...
      </div>
    );
  }

  if (status === "error") {
    return (
      <main style={styles.center}>
        <div style={{ textAlign: "center" }}>
          <h2>Gagal Memeriksa Akses</h2>
          <p>{errorMessage}</p>
          <button
            onClick={checkMaintenance}
            style={styles.button}
          >
            Coba Lagi
          </button>
        </div>
      </main>
    );
  }

  if (status === "maintenance") {
    return (
      <main style={styles.maintenancePage}>
        <div style={styles.card}>
          <div style={{ fontSize: 54 }}>🛠️</div>

          <p style={styles.brand}>
            OJT MINETRACK v2.0
          </p>

          <h1 style={styles.title}>
            Website Sedang Dalam Pemeliharaan
          </h1>

          <p style={styles.description}>
            Sistem Monitoring dan Evaluasi OJT
            sedang menjalani pemeliharaan dan
            peningkatan layanan.
          </p>

          <p style={styles.notice}>
            Silakan kembali beberapa saat lagi.
          </p>

          <div style={styles.footer}>
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

const styles = {
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#071b22",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
  },
  maintenancePage: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    boxSizing: "border-box",
    background:
      "linear-gradient(145deg, #071b22, #124734)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    padding: "40px 24px",
    borderRadius: 24,
    textAlign: "center",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
  },
  brand: {
    color: "#d8b45a",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 2,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    lineHeight: 1.3,
    marginTop: 16,
  },
  description: {
    color: "#d3e5dc",
    fontSize: 14,
    lineHeight: 1.9,
    marginTop: 16,
  },
  notice: {
    color: "#d8b45a",
    fontWeight: 700,
    marginTop: 24,
  },
  footer: {
    borderTop: "1px solid rgba(255,255,255,0.15)",
    paddingTop: 20,
    marginTop: 35,
    fontSize: 11,
    lineHeight: 1.8,
    color: "#b8ccc1",
  },
  button: {
    padding: "12px 20px",
    background: "#d8b45a",
    color: "#071b22",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    cursor: "pointer",
  },
};
