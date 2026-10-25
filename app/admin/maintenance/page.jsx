
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AdminMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (
        String(profile?.role || "")
          .trim()
          .toLowerCase() !== "admin"
      ) {
        router.replace("/");
        return;
      }

      setIsAdmin(true);

      const { data: settings, error: settingsError } =
        await supabase
          .from("app_settings")
          .select("maintenance_mode")
          .eq("id", 1)
          .single();

      if (settingsError) throw settingsError;

      setMaintenance(settings.maintenance_mode === true);
    } catch (err) {
      setError(err.message || "Gagal membaca pengaturan.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function updateMaintenance(nextValue) {
    if (!isAdmin || saving) return;

    const confirmed = window.confirm(
      nextValue
        ? "Aktifkan Maintenance Mode? Mentor dan Peserta akan melihat halaman pemeliharaan."
        : "Nonaktifkan Maintenance Mode? Mentor dan Peserta dapat kembali menggunakan website."
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { data, error: updateError } =
        await supabase
          .from("app_settings")
          .update({
            maintenance_mode: nextValue,
            updated_at: new Date().toISOString(),
          })
          .eq("id", 1)
          .select("maintenance_mode")
          .single();

      if (updateError) throw updateError;

      if (data.maintenance_mode !== nextValue) {
        throw new Error(
          "Status database tidak sesuai dengan perubahan."
        );
      }

      setMaintenance(data.maintenance_mode);

      setMessage(
        nextValue
          ? "Maintenance Mode berhasil diaktifkan."
          : "Maintenance Mode berhasil dinonaktifkan."
      );
    } catch (err) {
      setError(
        err.message || "Gagal mengubah Maintenance Mode."
      );
    } finally {
      setSaving(false);
    }
  }

  const buttonStyle = {
    border: "none",
    borderRadius: 12,
    padding: "14px 18px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  };

  if (loading) {
    return (
      <div style={styles.center}>
        Memeriksa akses Administrator...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={styles.center}>
        {error || "Akses hanya untuk Administrator."}
      </div>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <button
          onClick={() => router.push("/")}
          style={{
            ...buttonStyle,
            background: "#e7eee9",
            color: "#164a37",
            marginBottom: 22,
          }}
        >
          ← Kembali ke Dashboard Mentor
        </button>

        <div style={styles.card}>
          <div style={styles.brand}>
            OJT MINETRACK v2.0
          </div>

          <h1 style={styles.heading}>
            Pengaturan Maintenance Mode
          </h1>

          <p style={styles.description}>
            Panel ini hanya dapat digunakan oleh Admin
            untuk mengatur akses website selama
            proses pemeliharaan.
          </p>

          <div
            style={{
              ...styles.status,
              background: maintenance
                ? "#fff0df"
                : "#e9f7ee",
              color: maintenance
                ? "#945009"
                : "#17613a",
            }}
          >
            <div style={{ fontSize: 12 }}>
              STATUS WEBSITE
            </div>

            <div
              style={{
                fontSize: 25,
                fontWeight: 800,
                marginTop: 8,
              }}
            >
              {maintenance
                ? "MAINTENANCE ON"
                : "MAINTENANCE OFF"}
            </div>

            <div
              style={{
                fontSize: 13,
                marginTop: 8,
                lineHeight: 1.6,
              }}
            >
              {maintenance
                ? "Mode pemeliharaan sedang aktif."
                : "Website beroperasi secara normal."}
            </div>
          </div>

          <div style={styles.buttonGroup}>
            <button
              disabled={saving || maintenance}
              onClick={() => updateMaintenance(true)}
              style={{
                ...buttonStyle,
                background: "#b45309",
                color: "white",
                opacity:
                  saving || maintenance ? 0.5 : 1,
              }}
            >
              Aktifkan Maintenance
            </button>

            <button
              disabled={saving || !maintenance}
              onClick={() => updateMaintenance(false)}
              style={{
                ...buttonStyle,
                background: "#17613a",
                color: "white",
                opacity:
                  saving || !maintenance ? 0.5 : 1,
              }}
            >
              Nonaktifkan Maintenance
            </button>
          </div>

          {saving && (
            <p style={styles.description}>
              Menyimpan perubahan...
            </p>
          )}

          {message && (
            <p style={{ color: "#17613a" }}>
              {message}
            </p>
          )}

          {error && (
            <p style={{ color: "#b42318" }}>
              {error}
            </p>
          )}

          <button
            onClick={loadSettings}
            disabled={saving}
            style={{
              ...buttonStyle,
              width: "100%",
              marginTop: 16,
              background: "#e7eee9",
              color: "#164a37",
            }}
          >
            Periksa Status Terbaru
          </button>
        </div>

        <p style={styles.footer}>
          Emergency Response Group
          <br />
          PT Berau Coal
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "35px 16px",
    background: "#f3f6fa",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: 650,
    margin: "0 auto",
  },
  card: {
    background: "#ffffff",
    borderRadius: 22,
    padding: "30px 24px",
    boxShadow: "0 8px 30px rgba(0,0,0,0.07)",
  },
  brand: {
    color: "#17613a",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  heading: {
    fontSize: 25,
    color: "#173a2a",
    marginTop: 15,
  },
  description: {
    fontSize: 14,
    lineHeight: 1.8,
    color: "#64748b",
  },
  status: {
    borderRadius: 16,
    padding: 25,
    marginTop: 24,
    marginBottom: 24,
  },
  buttonGroup: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12,
  },
  center: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    color: "#164a37",
    padding: 24,
    textAlign: "center",
  },
  footer: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 1.8,
    color: "#64748b",
    marginTop: 25,
  },
};
