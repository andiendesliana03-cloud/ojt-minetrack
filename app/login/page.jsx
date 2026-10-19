
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
    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) throw loginError;

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("Profil pengguna belum tersedia.");
      }

      if (!["mentor", "participant"].includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error("Role akun tidak dikenal.");
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f1f5f9",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{
        background: "white",
        borderRadius: 18,
        padding: 28,
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 30px #0f172a12",
      }}>
        <header style={{
          background: "#0f172a",
          color: "white",
          padding: 22,
          borderRadius: 12,
          marginBottom: 24,
        }}>
          <h1 style={{ margin: 0, fontSize: 25 }}>
            Monitoring OJT - Emergency Response Group
          </h1>
          <p style={{ marginBottom: 0 }}>
            PT Berau Coal 2026
          </p>
        </header>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Masukkan email"
            style={inputStyle}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan password"
            style={inputStyle}
          />

          {error && (
            <p role="alert" style={{
              color: "#b91c1c",
              fontSize: 14,
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: "#0f172a",
              color: "white",
              border: 0,
              padding: 15,
              borderRadius: 10,
              fontSize: 16,
              marginTop: 12,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Sedang masuk..." : "Masuk"}
          </button>
        </form>

        <p style={{
          textAlign: "center",
          color: "#64748b",
          fontSize: 12,
          marginTop: 24,
        }}>
          Sistem Monitoring dan Evaluasi OJT
        </p>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 13,
  marginTop: 8,
  marginBottom: 20,
  border: "1px solid #cbd5e1",
  borderRadius: 9,
  boxSizing: "border-box",
  fontSize: 16,
};
