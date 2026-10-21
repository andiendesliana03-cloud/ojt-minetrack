
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

const CARD = {
  background: "#ffffff",
  borderRadius: 16,
  padding: 22,
  marginBottom: 16,
  border: "1px solid #e2e8f0",
};

const FIELD = {
  width: "100%",
  padding: 13,
  marginTop: 7,
  marginBottom: 18,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
  boxSizing: "border-box",
};

const BUTTON = {
  width: "100%",
  padding: 15,
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(value + "T00:00:00Z");

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export default function DaftarPesertaPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(event) {
    event.preventDefault();

    if (loading || success) return;

    setError("");

    const name = fullName.trim().replace(/\s+/g, " ");
    const normalizedEmail = email.trim().toLowerCase();

    if (name.length < 3 || name.length > 120) {
      setError(
        "Nama lengkap harus 3 sampai 120 karakter."
      );
      return;
    }

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Alamat email tidak valid.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    if (!SITES.includes(site)) {
      setError("Silakan pilih site OJT.");
      return;
    }

    if (
      !isValidDate(startDate) ||
      !isValidDate(endDate) ||
      endDate < startDate
    ) {
      setError("Periode OJT tidak valid.");
      return;
    }

    setLoading(true);

    try {
      // Membuat akun Supabase Auth.
      // Trigger database akan membuat profil
      // dengan role participant.
      const { error: signupError } =
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo:
              window.location.origin +
              "/pengajuan-peserta",
            data: {
              full_name: name,
              department: "ER & SS",
              site,
              start_date: startDate,
              end_date: endDate,
            },
          },
        });

      if (signupError) {
        throw signupError;
      }

      setSuccess(true);

      // Jangan menampilkan password.
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.message ||
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
        padding: "25px 15px",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...CARD,
            background: "#0f172a",
            color: "#ffffff",
            textAlign: "center",
          }}
        >
          <h1>Daftar Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal</p>
        </header>

        <section
          style={{
            ...CARD,
            background: "#eff6ff",
            borderColor: "#bfdbfe",
          }}
        >
          <strong style={{ color: "#1d4ed8" }}>
            PENDAFTARAN AKUN PESERTA
          </strong>

          <p style={{ lineHeight: 1.7 }}>
            Halaman ini digunakan untuk membuat
            akun peserta OJT baru.
          </p>

          <p style={{ marginBottom: 0 }}>
            Setelah email terverifikasi,
            peserta harus login dan mengirim
            pengajuan OJT secara terpisah.
            Pengajuan masih menunggu persetujuan
            mentor sebelum program diaktifkan.
          </p>
        </section>

        {error && (
          <section
            role="alert"
            style={{
              ...CARD,
              background: "#fef2f2",
              borderColor: "#fecaca",
              color: "#991b1b",
            }}
          >
            {error}
          </section>
        )}

        {success ? (
          <section
            role="status"
            style={{
              ...CARD,
              background: "#f0fdf4",
              borderColor: "#86efac",
            }}
          >
            <h2 style={{ color: "#166534" }}>
              Permintaan Pendaftaran Diterima
            </h2>

            <p>
              Permintaan pendaftaran untuk
              alamat email berikut telah diproses:
            </p>

            <strong>{email.trim()}</strong>

            <p style={{ lineHeight: 1.8 }}>
              Jika email dapat didaftarkan,
              Supabase akan mengirimkan tautan
              verifikasi. Periksa kotak masuk
              atau folder spam.
            </p>

            <p>
              Setelah verifikasi, masuk menggunakan
              email dan password yang didaftarkan.
            </p>

            <p>
              <strong>
                Pengajuan OJT belum dikirim
                kepada mentor.
              </strong>
            </p>

            <button
              type="button"
              style={BUTTON}
              onClick={() => router.push("/login")}
            >
              Menuju Halaman Login
            </button>
          </section>
        ) : (
          <section style={CARD}>
            <h2>Formulir Pendaftaran Akun</h2>

            <form onSubmit={handleRegister}>
              <label htmlFor="full_name">
                <strong>Nama Lengkap</strong>
              </label>

              <input
                id="full_name"
                type="text"
                autoComplete="name"
                style={FIELD}
                value={fullName}
                required
                minLength={3}
                maxLength={120}
                disabled={loading}
                onChange={(e) =>
                  setFullName(e.target.value)
                }
              />

              <label htmlFor="email">
                <strong>Email Peserta</strong>
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                style={FIELD}
                value={email}
                required
                disabled={loading}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

              <label htmlFor="password">
                <strong>Password</strong>
              </label>

              <input
                id="password"
                type="password"
                autoComplete="new-password"
                style={FIELD}
                value={password}
                minLength={8}
                required
                disabled={loading}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

              <label htmlFor="confirm_password">
                <strong>Konfirmasi Password</strong>
              </label>

              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                style={FIELD}
                value={confirmPassword}
                minLength={8}
                required
                disabled={loading}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
              />

              <label htmlFor="department">
                <strong>Departemen</strong>
              </label>

              <input
                id="department"
                type="text"
                style={{
                  ...FIELD,
                  background: "#f1f5f9",
                }}
                value="ER & SS"
                readOnly
              />

              <label htmlFor="site">
                <strong>Site Penempatan OJT</strong>
              </label>

              <select
                id="site"
                style={FIELD}
                value={site}
                required
                disabled={loading}
                onChange={(e) =>
                  setSite(e.target.value)
                }
              >
                <option value="">
                  -- Pilih Site --
                </option>

                {SITES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <h3>Rencana Periode OJT</h3>

              <label htmlFor="start_date">
                <strong>Tanggal Mulai</strong>
              </label>

              <input
                id="start_date"
                type="date"
                style={FIELD}
                value={startDate}
                required
                disabled={loading}
                onChange={(e) => {
                  const value = e.target.value;
                  setStartDate(value);

                  if (endDate && endDate < value) {
                    setEndDate("");
                  }
                }}
              />

              <label htmlFor="end_date">
                <strong>Tanggal Selesai</strong>
              </label>

              <input
                id="end_date"
                type="date"
                style={FIELD}
                value={endDate}
                min={startDate || undefined}
                required
                disabled={loading}
                onChange={(e) =>
                  setEndDate(e.target.value)
                }
              />

              <button
                type="submit"
                disabled={loading}
                style={{
                  ...BUTTON,
                  background: loading
                    ? "#94a3b8"
                    : "#2563eb",
                }}
              >
                {loading
                  ? "Memproses Pendaftaran..."
                  : "Daftar Akun Peserta OJT"}
              </button>
            </form>
          </section>
        )}

        {!success && (
          <section style={CARD}>
            <p>
              Sudah mempunyai akun?
            </p>

            <button
              type="button"
              style={{
                ...BUTTON,
                background: "#475569",
              }}
              onClick={() => router.push("/login")}
            >
              Masuk ke Akun
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
