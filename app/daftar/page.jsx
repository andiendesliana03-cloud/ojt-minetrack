
"use client";

import { useState } from "react";
import Link from "next/link";

const REGISTRATION_ENABLED = false;

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const INITIAL = {
  full_name: "",
  email: "",
  password: "",
  department: "ER & SS",
  site: "",
  start_date: "",
  end_date: "",
};

const fieldStyle = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 16,
  color: "#0f172a",
  background: "#ffffff",
  boxSizing: "border-box",
};

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export default function DaftarPesertaPage() {
  const [form, setForm] = useState(INITIAL);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);

  function update(field, value) {
    setForm((old) => ({ ...old, [field]: value }));
    setError("");
    setPreview(null);
  }

  function validate() {
    if (
      form.full_name.trim().length < 3 ||
      form.full_name.trim().length > 120
    ) return "Nama lengkap harus 3–120 karakter.";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Format email tidak valid.";
    }

    if (form.password.length < 8) {
      return "Password minimal 8 karakter.";
    }

    if (!form.department.trim()) {
      return "Departemen wajib diisi.";
    }

    if (!SITES.includes(form.site)) {
      return "Pilih site OJT yang valid.";
    }

    if (
      !validDate(form.start_date) ||
      !validDate(form.end_date)
    ) {
      return "Tanggal OJT tidak valid.";
    }

    if (form.end_date < form.start_date) {
      return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setPreview(null);

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    if (!REGISTRATION_ENABLED) {
      // Simulasi lokal: tidak memanggil Supabase.
      setPreview({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        department: form.department.trim(),
        site: form.site,
        start_date: form.start_date,
        end_date: form.end_date,
      });
      return;
    }

    // Pendaftaran asli sengaja belum diimplementasikan.
    // Aktifkan hanya setelah API dan RLS diuji.
    setError(
      "Pendaftaran asli belum tersedia. Hubungi administrator."
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "25px 16px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
        background: "#f1f5f9",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          padding: 24,
          boxSizing: "border-box",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
        }}
      >
        <header
          style={{
            background: "#0f172a",
            color: "#ffffff",
            textAlign: "center",
            borderRadius: 14,
            padding: 22,
            marginBottom: 22,
          }}
        >
          <strong>ERG</strong>
          <h1 style={{ fontSize: 24 }}>OJT MineTrack</h1>
          <p>Emergency Response Group</p>
          <small>PT Berau Coal 2026</small>
        </header>

        <h2 style={{ textAlign: "center" }}>
          Pendaftaran Peserta OJT
        </h2>

        {!REGISTRATION_ENABLED && (
          <div
            style={{
              padding: 14,
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            <strong>MODE SIMULASI AKTIF</strong>
            <p style={{ marginBottom: 0, fontSize: 13 }}>
              Formulir dapat diuji tanpa membuat akun
              atau menyimpan pengajuan ke Supabase.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {[
            ["full_name", "Nama Lengkap", "text"],
            ["email", "Email", "email"],
            ["password", "Password", showPassword ? "text" : "password"],
            ["department", "Departemen", "text"],
          ].map(([key, label, type]) => (
            <div key={key} style={{ marginBottom: 17 }}>
              <label htmlFor={key}>
                <strong>{label}</strong>
              </label>
              <input
                id={key}
                type={type}
                style={fieldStyle}
                required
                minLength={
                  key === "password" ? 8 :
                  key === "full_name" ? 3 : undefined
                }
                maxLength={
                  key === "full_name" ? 120 : undefined
                }
                autoComplete={
                  key === "password" ? "new-password" :
                  key === "email" ? "email" :
                  key === "full_name" ? "name" : "off"
                }
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            </div>
          ))}

          <label
            style={{
              display: "flex",
              gap: 9,
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
            />
            Tampilkan password
          </label>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="site">
              <strong>Site Penempatan OJT</strong>
            </label>
            <select
              id="site"
              style={fieldStyle}
              required
              value={form.site}
              onChange={(e) => update("site", e.target.value)}
            >
              <option value="">-- Pilih Site --</option>
              {SITES.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
          </div>

          <h3>Periode OJT</h3>

          <div style={{ marginBottom: 17 }}>
            <label htmlFor="start_date">
              <strong>Tanggal Mulai OJT</strong>
            </label>
            <input
              id="start_date"
              type="date"
              style={fieldStyle}
              required
              value={form.start_date}
              onChange={(e) => {
                const value = e.target.value;
                setForm((old) => ({
                  ...old,
                  start_date: value,
                  end_date:
                    old.end_date && old.end_date < value
                      ? ""
                      : old.end_date,
                }));
                setError("");
                setPreview(null);
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="end_date">
              <strong>Tanggal Selesai OJT</strong>
            </label>
            <input
              id="end_date"
              type="date"
              style={fieldStyle}
              min={form.start_date || undefined}
              required
              value={form.end_date}
              onChange={(e) =>
                update("end_date", e.target.value)
              }
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                background: "#fef2f2",
                color: "#b91c1c",
                padding: 12,
                borderRadius: 10,
                marginBottom: 15,
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
              padding: 15,
              background: loading ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Memproses..."
              : REGISTRATION_ENABLED
              ? "Daftar Peserta OJT"
              : "Jalankan Simulasi Pendaftaran"}
          </button>
        </form>

        {preview && (
          <section
            role="status"
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 12,
              padding: 15,
              marginTop: 20,
              lineHeight: 1.8,
            }}
          >
            <strong style={{ color: "#166534" }}>
              Validasi Formulir Berhasil
            </strong>
            <p>Nama: {preview.full_name}</p>
            <p>Email: {preview.email}</p>
            <p>Departemen: {preview.department}</p>
            <p>Site: {preview.site}</p>
            <p>Mulai: {preview.start_date}</p>
            <p>Selesai: {preview.end_date}</p>
            <strong>
              Belum ada akun atau pengajuan yang dibuat.
            </strong>
          </section>
        )}

        <p
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            lineHeight: 1.6,
            marginTop: 22,
          }}
        >
          Setelah pendaftaran asli dibuka, peserta wajib
          memverifikasi email dan mendapatkan persetujuan
          mentor sebelum mengakses monitoring OJT.
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
