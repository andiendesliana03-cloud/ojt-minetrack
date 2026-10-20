
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
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
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) throw loginError;

      if (!data.user) {
        throw new Error("Login gagal. Silakan coba lagi.");
      }

      const { data: profil, error: profilError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

      if (profilError) {
        throw new Error(
          "Profil akun belum tersedia. Hubungi administrator."
        );
      }

      if (profil.role === "mentor") {
        router.replace("/");
      } else if (profil.role === "participant") {
        router.replace("/peserta");
      } else {
        throw new Error("Role akun tidak dikenali.");
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "Terjadi kesalahan saat login.");
    } finally {
      setLoading(false);
    }
  }

  const halaman = {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#0f172a",
    backgroundImage:
      'linear-gradient(rgba(15,23,42,0.58), rgba(15,23,42,0.76)), url("/background-erg.png.PNG")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    color: "#0f172a",
  };

  const inputStyle = {
    width: "100%",
    padding: "13px 14px",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    background: "#ffffff",
    color: "#0f172a",
    outlineColor: "#2563eb",
  };

  return (
    <main style={halaman}>
      <div
        style={{
          width: "100%",
          maxWidth: 420,
        }}
      >
        <header
          style={{
            textAlign: "center",
            color: "#ffffff",
            marginBottom: 24,
            textShadow: "0 2px 8px rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "10px 16px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.25)",
              marginBottom: 18,
              fontWeight: "bold",
              letterSpacing: 2,
            }}
          >
            ERG
          </div>

          <h1
            style={{
              fontSize: 27,
              lineHeight: 1.3,
              margin: "0 0 12px",
            }}
          >
            Monitoring OJT
          </h1>

          <h2
            style={{
              fontSize: 19,
              fontWeight: 500,
              margin: "0 0 12px",
            }}
          >
            Emergency Response Group
          </h2>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            PT Berau Coal 2026
          </p>
        </header>

        <section
          style={{
            background: "rgba(255,255,255,0.95)",
            padding: 26,
            borderRadius: 18,
            boxShadow: "0 15px 45px rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.65)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginTop: 0,
              marginBottom: 8,
              fontSize: 22,
            }}
          >
            Login
          </h2>

          <p
            style={{
              textAlign: "center",
              color: "#64748b",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            Mentor dan Peserta OJT
          </p>

          <form onSubmit={handleLogin}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Masukkan email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                ...inputStyle,
                marginBottom: 18,
              }}
            />

            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              placeholder="Masukkan password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                ...inputStyle,
                marginBottom: 18,
              }}
            />

            {error && (
              <p
                role="alert"
                style={{
                  color: "#b91c1c",
                  background: "#fef2f2",
                  padding: 12,
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 10,
                background: "#2563eb",
                color: "#ffffff",
                fontSize: 16,
                fontWeight: "bold",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Memproses Login..." : "Masuk"}
            </button>
          </form>
        </section>

        <footer
          style={{
            color: "#ffffff",
            textAlign: "center",
            fontSize: 12,
            marginTop: 24,
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
          }}
        >
          Monitoring OJT — Emergency Response Group
          <p style={{ marginTop: 6 }}>
            © 2026 PT Berau Coal
          </p>
        </footer>
      </div>
    </main>
  );
}
