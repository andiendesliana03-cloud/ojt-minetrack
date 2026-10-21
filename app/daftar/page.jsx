
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

const REGISTRATION_ENABLED = false;

const inputStyle = {
  width: "100%",
  padding: "12px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  marginTop: "6px",
  boxSizing: "border-box",
  fontSize: "15px",
};

export default function DaftarPesertaPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!REGISTRATION_ENABLED) {
      setError(
        "Pendaftaran peserta masih dalam mode pengujian."
      );
      return;
    }

    const name = fullName.trim();

    if (name.length < 3) {
      setError("Nama lengkap minimal 3 karakter.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
            },
            emailRedirectTo:
              `${window.location.origin}/pengajuan-peserta`,
          },
        });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        setMessage(
          "Akun berhasil dibuat. Silakan lanjutkan proses pengajuan peserta setelah alur verifikasi disiapkan."
        );
      } else {
        setMessage(
          "Permintaan pendaftaran diterima. Periksa email untuk melakukan verifikasi akun."
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          "Pendaftaran gagal. Silakan coba kembali."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "26px",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ marginBottom: 6 }}>
            OJT MineTrack
          </h1>

          <p style={{ color: "#64748b" }}>
            Emergency Response Group
            <br />
            PT Berau Coal
          </p>

          <h2>Pendaftaran Peserta OJT</h2>
        </div>

        {!REGISTRATION_ENABLED && (
          <div
            style={{
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              padding: 14,
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 14,
            }}
          >
            <strong>Mode Pengujian</strong>
            <p style={{ marginBottom: 0 }}>
              Formulir sedang disiapkan.
              Pendaftaran peserta belum dibuka.
            </p>
          </div>
        )}

        {message && (
          <div
            role="status"
            style={{
              background: "#dcfce7",
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label>
            Nama Lengkap
            <input
              style={inputStyle}
              type="text"
              placeholder="Masukkan nama lengkap"
              value={fullName}
              onChange={(e) =>
                setFullName(e.target.value)
              }
              minLength={3}
              maxLength={120}
              autoComplete="name"
              required
              disabled={!REGISTRATION_ENABLED || loading}
            />
          </label>

          <div style={{ height: 16 }} />

          <label>
            Email
            <input
              style={inputStyle}
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
              disabled={!REGISTRATION_ENABLED || loading}
            />
          </label>

          <div style={{ height: 16 }} />

          <label>
            Password
            <input
              style={inputStyle}
              type={showPassword ? "text" : "password"}
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!REGISTRATION_ENABLED || loading}
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) =>
                setShowPassword(e.target.checked)
              }
              disabled={loading}
            />
            Tampilkan password
          </label>

          <button
            type="submit"
            disabled={!REGISTRATION_ENABLED || loading}
            style={{
              width: "100%",
              padding: 14,
              marginTop: 22,
              border: "none",
              borderRadius: 10,
              background: REGISTRATION_ENABLED
                ? "#2563eb"
                : "#94a3b8",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: 15,
              cursor: REGISTRATION_ENABLED
                ? "pointer"
                : "not-allowed",
            }}
          >
            {loading
              ? "Memproses..."
              : "Daftar sebagai Peserta OJT"}
          </button>
        </form>

        <p
          style={{
            fontSize: 13,
            color: "#64748b",
            textAlign: "center",
            marginTop: 18,
          }}
        >
          Peserta wajib memverifikasi email dan
          menunggu persetujuan mentor sebelum
          memperoleh akses monitoring OJT.
        </p>

        <div style={{ textAlign: "center" }}>
          <Link href="/login">
            ← Kembali ke Login
          </Link>
        </div>
      </div>
    </main>
  );
}
