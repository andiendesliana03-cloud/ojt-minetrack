
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email
        .trim()
        .toLowerCase();

      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (loginError) {
        if (
          loginError.message
            ?.toLowerCase()
            .includes("email not confirmed")
        ) {
          throw new Error(
            "Akun masih memerlukan konfirmasi email. Hubungi administrator."
          );
        }

        throw new Error(
          "Login gagal. Periksa email dan password."
        );
      }

      if (!data?.user) {
        throw new Error(
          "Login gagal. Silakan coba kembali."
        );
      }

      const {
        data: profil,
        error: profilError,
      } = await supabase
        .from("profiles")
        .select("id,role")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profilError) {
        throw new Error(
          "Gagal memeriksa profil akun."
        );
      }

      if (!profil) {
        throw new Error(
          "Profil akun belum tersedia. Hubungi administrator."
        );
      }

      const role = String(profil.role || "")
        .trim()
        .toLowerCase();

      // ADMIN
      // Tetap memiliki role admin.
      // Masuk ke Dashboard Mentor.
      if (role === "admin") {
        router.replace("/");
        router.refresh();
        return;
      }

      // MENTOR
      if (role === "mentor") {
        router.replace("/");
        router.refresh();
        return;
      }

      // PESERTA
      // Status pendaftaran dan akses program
      // tetap diperiksa di Dashboard Peserta.
      if (
        role === "participant" ||
        role === "peserta"
      ) {
        router.replace("/dashboard-peserta");
        router.refresh();
        return;
      }

      throw new Error(
        "Role akun tidak dikenali. Hubungi administrator."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Terjadi kesalahan saat login."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDaftarPeserta() {
    if (loading) return;
    router.push("/daftar");
  }

  const halaman = {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 16px",
    boxSizing: "border-box",
    position: "relative",
    isolation: "isolate",
    overflow: "hidden",
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
    backgroundColor: "#dbeafe",
  };

  const inputStyle = {
    width: "100%",
    padding: "14px 15px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    fontSize: 16,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    outlineColor: "#2563eb",
  };

  return (
    <main style={halaman}>
      {/* Background ERG */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          backgroundColor: "#334155",
          backgroundImage:
            'url("/background-erg.png.PNG")',
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      {/* Lapisan transparan */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.30), rgba(15,23,42,0.65))",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 430,
          background: "rgba(255,255,255,0.94)",
          padding: 22,
          borderRadius: 20,
          boxShadow:
            "0 16px 50px rgba(0,0,0,0.28)",
          border:
            "1px solid rgba(255,255,255,0.75)",
          boxSizing: "border-box",
        }}
      >
        <header
          style={{
            backgroundColor: "#0f172a",
            borderRadius: 15,
            padding: "28px 22px",
            color: "#ffffff",
            marginBottom: 26,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background:
                "rgba(255,255,255,0.12)",
              border:
                "1px solid rgba(255,255,255,0.25)",
              borderRadius: 10,
              padding: "8px 18px",
              fontWeight: "bold",
              letterSpacing: 2,
              marginBottom: 18,
            }}
          >
            ERG
          </div>

          <h1
            style={{
              fontSize: 25,
              lineHeight: 1.3,
              margin: "0 0 12px",
            }}
          >
            Monitoring OJT
          </h1>

          <p
            style={{
              fontSize: 18,
              fontWeight: 600,
              margin: "0 0 16px",
            }}
          >
            Emergency Response Group
          </p>

          <p
            style={{
              fontSize: 14,
              margin: 0,
              color: "#cbd5e1",
            }}
          >
            PT Berau Coal 2026
          </p>
        </header>

        <form onSubmit={handleLogin}>
          <h2
            style={{
              textAlign: "center",
              fontSize: 22,
              margin: "0 0 8px",
            }}
          >
            Login
          </h2>

          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#64748b",
              margin: "0 0 26px",
            }}
          >
            Admin, Mentor dan Peserta OJT
          </p>

          <label
            htmlFor="email"
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 9,
            }}
          >
            Email
          </label>

          <input
            id="email"
            type="email"
            placeholder="Masukkan email"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            required
            disabled={loading}
            autoComplete="email"
            style={{
              ...inputStyle,
              marginBottom: 22,
            }}
          />

          <label
            htmlFor="password"
            style={{
              display: "block",
              fontWeight: 600,
              marginBottom: 9,
            }}
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            placeholder="Masukkan password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
            disabled={loading}
            autoComplete="current-password"
            style={{
              ...inputStyle,
              marginBottom: 22,
            }}
          />

          {error && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                padding: 12,
                borderRadius: 10,
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px 18px",
              border: "none",
              borderRadius: 11,
              backgroundColor: "#0f172a",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 600,
              cursor: loading
                ? "wait"
                : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Memproses Login..."
              : "Masuk"}
          </button>
        </form>

        <div
          style={{
            marginTop: 22,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: "#475569",
              marginBottom: 12,
            }}
          >
            Ingin bergabung sebagai peserta OJT?
          </p>

          <button
            type="button"
            onClick={handleDaftarPeserta}
            disabled={loading}
            style={{
              width: "100%",
              padding: "15px 18px",
              border: "2px solid #2563eb",
              borderRadius: 11,
              backgroundColor: "#eff6ff",
              color: "#1d4ed8",
              fontSize: 16,
              fontWeight: 700,
              cursor: loading
                ? "not-allowed"
                : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            Daftar Peserta OJT
          </button>

          <p
            style={{
              fontSize: 12,
              color: "#64748b",
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            Cukup daftar satu kali.
            Setelah mentor menyetujui,
            peserta dapat mengakses
            monitoring OJT.
          </p>
        </div>

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            marginTop: 28,
          }}
        >
          Sistem Monitoring dan Evaluasi OJT

          <p style={{ marginBottom: 0 }}>
            © 2026 PT Berau Coal
          </p>
        </footer>
      </div>
    </main>
  );
}
