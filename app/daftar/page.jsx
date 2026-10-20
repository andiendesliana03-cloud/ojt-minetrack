
"use client";

import { useState } from "react";
import Link from "next/link";

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

  const [showPassword, setShowPassword] =
    useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    // Pendaftaran belum dibuka.
    // API pendaftaran akan dibuat pada tahap berikutnya.
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
          boxShadow:
            "0 10px 30px rgba(15,23,42,0.08)",
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
              required
              disabled={!REGISTRATION_ENABLED}
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
              required
              disabled={!REGISTRATION_ENABLED}
            />
          </label>

          <div style={{ height: 16 }} />

          <label>
            Password
            <input
              style={inputStyle}
              type={
                showPassword ? "text" : "password"
              }
              placeholder="Minimal 8 karakter"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              minLength={8}
              required
              disabled={!REGISTRATION_ENABLED}
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
            />
            Tampilkan password
          </label>

          <button
            type="submit"
            disabled={!REGISTRATION_ENABLED}
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
            Daftar sebagai Peserta OJT
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
          Setelah pendaftaran dibuka, peserta
          harus melakukan verifikasi email
          dan menunggu persetujuan mentor.
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
