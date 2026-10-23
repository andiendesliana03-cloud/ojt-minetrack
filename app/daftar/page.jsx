
"use client";

import { useEffect, useState } from "react";
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
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 22,
  marginBottom: 16,
};

const FIELD = {
  width: "100%",
  boxSizing: "border-box",
  padding: 13,
  marginTop: 7,
  marginBottom: 17,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
};

const BUTTON = {
  width: "100%",
  padding: 14,
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

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

  const [submissionEnabled, setSubmissionEnabled] =
    useState(false);

  const [checking, setChecking] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkRegistrationStatus() {
      try {
        const response = await fetch(
          "/api/system/feature-flags",
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Konfigurasi tidak tersedia.");
        }

        const result = await response.json();

        if (active) {
          setSubmissionEnabled(
            result?.success === true &&
              result?.features?.submission_enabled ===
                true
          );
        }
      } catch {
        if (active) {
          setSubmissionEnabled(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkRegistrationStatus();

    return () => {
      active = false;
    };
  }, []);

  async function handleRegister(event) {
    event.preventDefault();

    if (processing) return;

    setError("");

    // Baca ulang status sebelum pendaftaran.
    try {
      const flagsResponse = await fetch(
        "/api/system/feature-flags",
        { cache: "no-store" }
      );

      if (!flagsResponse.ok) {
        throw new Error(
          "Status pendaftaran tidak tersedia."
        );
      }

      const flags = await flagsResponse.json();

      if (
        flags?.features?.submission_enabled !== true
      ) {
        throw new Error(
          "Pendaftaran OJT belum dibuka."
        );
      }
    } catch (err) {
      setError(
        err.message || "Pendaftaran belum tersedia."
      );
      return;
    }

    const name = fullName.trim().replace(/\s+/g, " ");
    const cleanEmail = email.trim().toLowerCase();

    if (name.length < 3 || name.length > 120) {
      setError(
        "Nama lengkap harus 3–120 karakter."
      );
      return;
    }

    if (
      !cleanEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setError("Alamat email tidak valid.");
      return;
    }

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sesuai.");
      return;
    }

    if (!SITES.includes(site)) {
      setError("Pilih site OJT.");
      return;
    }

    if (
      !validDate(startDate) ||
      !validDate(endDate) ||
      endDate < startDate
    ) {
      setError("Periode OJT tidak valid.");
      return;
    }

    setProcessing(true);

    try {
      // Pendaftaran peserta baru.
      // Trigger database membuat:
      // 1. Profil peserta
      // 2. Pengajuan OJT pending
      const { data, error: signUpError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo:
              `${window.location.origin}/login`,
            data: {
              full_name: name,
              department: "ER & SS",
              site,
              start_date: startDate,
              end_date: endDate,

              // Dikenali oleh trigger Supabase.
              ojt_auto_request: true,
            },
          },
        });

      if (signUpError) {
        throw signUpError;
      }

      if (!data?.user) {
        throw new Error(
          "Pendaftaran belum dapat dipastikan. " +
            "Periksa akun sebelum mencoba lagi."
        );
      }

      // Jika Supabase menyediakan session,
      // keluarkan sesi agar akses menunggu mentor.
      if (data.session) {
        await supabase.auth.signOut();
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.message ||
          "Pendaftaran gagal. Silakan periksa data."
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: "24px 15px",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 560,
          margin: "0 auto",
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
          <h1>Pendaftaran Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal</p>
        </header>

        {success ? (
          <section
            style={{
              ...CARD,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 44,
                marginBottom: 12,
              }}
            >
              ✓
            </div>

            <h2>Pendaftaran Diterima</h2>

            <p style={{ lineHeight: 1.8 }}>
              Permintaan pendaftaran sudah
              diterima oleh sistem.
            </p>

            <p style={{ lineHeight: 1.8 }}>
              Silakan menunggu persetujuan
              mentor sebelum mengakses
              Dashboard OJT.
            </p>

            <button
              type="button"
              style={BUTTON}
              onClick={() =>
                router.push("/login")
              }
            >
              Ke Halaman Login
            </button>
          </section>
        ) : (
          <>
            <section
              style={{
                ...CARD,
                background: "#eff6ff",
                borderColor: "#bfdbfe",
              }}
            >
              <strong>
                Status Pendaftaran
              </strong>

              <p>
                {checking
                  ? "Memeriksa status..."
                  : submissionEnabled
                  ? "Pendaftaran peserta OJT dibuka."
                  : "Pendaftaran peserta OJT belum dibuka."}
              </p>

              <p
                style={{
                  marginBottom: 0,
                  fontSize: 13,
                  color: "#475569",
                }}
              >
                Peserta hanya perlu mendaftar
                sekali. Persetujuan mengikuti
                OJT dilakukan oleh mentor.
              </p>
            </section>

            <section style={CARD}>
              <h2>Formulir Pendaftaran</h2>

              <form onSubmit={handleRegister}>
                <label htmlFor="fullName">
                  <strong>Nama Lengkap</strong>
                </label>

                <input
                  id="fullName"
                  type="text"
                  style={FIELD}
                  value={fullName}
                  maxLength={120}
                  required
                  disabled={processing}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Nama lengkap peserta"
                />

                <label htmlFor="email">
                  <strong>Email</strong>
                </label>

                <input
                  id="email"
                  type="email"
                  style={FIELD}
                  value={email}
                  required
                  disabled={processing}
                  autoComplete="email"
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Alamat email aktif"
                />

                <label htmlFor="password">
                  <strong>Password</strong>
                </label>

                <input
                  id="password"
                  type="password"
                  style={FIELD}
                  value={password}
                  minLength={8}
                  required
                  disabled={processing}
                  autoComplete="new-password"
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Minimal 8 karakter"
                />

                <label htmlFor="confirmPassword">
                  <strong>Konfirmasi Password</strong>
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  style={FIELD}
                  value={confirmPassword}
                  minLength={8}
                  required
                  disabled={processing}
                  autoComplete="new-password"
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  placeholder="Ulangi password"
                />

                <label>
                  <strong>Departemen</strong>
                </label>

                <input
                  type="text"
                  value="ER & SS"
                  style={{
                    ...FIELD,
                    background: "#f1f5f9",
                  }}
                  readOnly
                />

                <label htmlFor="site">
                  <strong>Site OJT</strong>
                </label>

                <select
                  id="site"
                  style={FIELD}
                  value={site}
                  required
                  disabled={processing}
                  onChange={(event) =>
                    setSite(event.target.value)
                  }
                >
                  <option value="">
                    Pilih Site OJT
                  </option>

                  {SITES.map((item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ))}
                </select>

                <label htmlFor="startDate">
                  <strong>Tanggal Mulai OJT</strong>
                </label>

                <input
                  id="startDate"
                  type="date"
                  style={FIELD}
                  value={startDate}
                  required
                  disabled={processing}
                  onChange={(event) => {
                    const next = event.target.value;

                    setStartDate(next);

                    if (
                      endDate &&
                      endDate < next
                    ) {
                      setEndDate("");
                    }
                  }}
                />

                <label htmlFor="endDate">
                  <strong>Tanggal Selesai OJT</strong>
                </label>

                <input
                  id="endDate"
                  type="date"
                  style={FIELD}
                  min={startDate || undefined}
                  value={endDate}
                  required
                  disabled={processing}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                />

                {error && (
                  <p
                    role="alert"
                    style={{
                      color: "#b91c1c",
                      padding: 12,
                      background: "#fef2f2",
                      borderRadius: 9,
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  style={{
                    ...BUTTON,
                    background:
                      processing ||
                      checking ||
                      !submissionEnabled
                        ? "#94a3b8"
                        : "#2563eb",
                  }}
                  disabled={
                    processing ||
                    checking ||
                    !submissionEnabled
                  }
                >
                  {processing
                    ? "Mendaftarkan..."
                    : "Daftar OJT"}
                </button>
              </form>
            </section>

            <section style={CARD}>
              <p>
                Sudah memiliki akun OJT?
              </p>

              <button
                type="button"
                style={{
                  ...BUTTON,
                  background: "#475569",
                }}
                onClick={() =>
                  router.push("/login")
                }
              >
                Masuk ke Akun
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
