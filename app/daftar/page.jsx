
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  borderRadius: 14,
  padding: 20,
  marginBottom: 16,
};

const FIELD = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  marginTop: 8,
  marginBottom: 17,
  borderRadius: 9,
  border: "1px solid #cbd5e1",
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
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
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

  const [registrationEnabled, setRegistrationEnabled] =
    useState(false);

  const [checking, setChecking] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function readRegistrationStatus() {
    const response = await fetch(
      "/api/system/feature-flags",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Status pendaftaran tidak tersedia."
      );
    }

    const result = await response.json();

    if (
      result.success !== true ||
      !result.features
    ) {
      throw new Error(
        "Konfigurasi pendaftaran tidak valid."
      );
    }

    return (
      result.features.submission_enabled === true
    );
  }

  useEffect(() => {
    let active = true;

    async function checkStatus() {
      try {
        const enabled =
          await readRegistrationStatus();

        if (active) {
          setRegistrationEnabled(enabled);
        }
      } catch {
        if (active) {
          setRegistrationEnabled(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkStatus();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (processing || checking) return;

    setError("");

    const name = fullName
      .trim()
      .replace(/\s+/g, " ");

    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (name.length < 3 || name.length > 120) {
      setError(
        "Nama lengkap harus 3–120 karakter."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      setError("Alamat email tidak valid.");
      return;
    }

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      setError(
        "Password harus 8–128 karakter."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Konfirmasi password tidak sesuai."
      );
      return;
    }

    if (!SITES.includes(site)) {
      setError("Pilih Site OJT.");
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
      // Periksa ulang sebelum mengirim.
      const enabled =
        await readRegistrationStatus();

      setRegistrationEnabled(enabled);

      if (!enabled) {
        throw new Error(
          "Pendaftaran OJT belum dibuka."
        );
      }

      // Pendaftaran diproses oleh API server,
      // bukan lagi supabase.auth.signUp()
      // secara langsung dari browser.
      const response = await fetch(
        "/api/participant/auto-register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            full_name: name,
            email: cleanEmail,
            password,
            site,
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );

      const result = await response.json();

      if (
        !response.ok ||
        result.success !== true ||
        result.status !== "pending"
      ) {
        throw new Error(
          result.error ||
            "Pendaftaran gagal diproses."
        );
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(
        err.message ||
          "Terjadi kesalahan pendaftaran."
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
        color: "#0f172a",
        padding: "24px 15px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 560,
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
          <h1>Pendaftaran Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal</p>
        </header>

        {success ? (
          <section
            role="status"
            style={{
              ...CARD,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 44,
                color: "#16a34a",
              }}
            >
              ✓
            </div>

            <h2>Pendaftaran Berhasil</h2>

            <p style={{ lineHeight: 1.8 }}>
              Akun dan pengajuan OJT berhasil
              dibuat secara otomatis.
            </p>

            <p style={{ lineHeight: 1.8 }}>
              Status pengajuan:
              <strong> Menunggu Persetujuan Mentor</strong>
            </p>

            <p style={{ lineHeight: 1.8 }}>
              Setelah disetujui, silakan
              login menggunakan email dan
              password yang didaftarkan.
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
              <strong>Status Pendaftaran</strong>

              <p>
                {checking
                  ? "Memeriksa status..."
                  : registrationEnabled
                  ? "Pendaftaran OJT dibuka."
                  : "Pendaftaran OJT belum dibuka."}
              </p>

              <p
                style={{
                  fontSize: 13,
                  color: "#475569",
                  marginBottom: 0,
                }}
              >
                Isi formulir satu kali.
                Pengajuan akan otomatis masuk
                ke daftar persetujuan mentor.
              </p>
            </section>

            <section style={CARD}>
              <h2>Formulir Pendaftaran</h2>

              <form onSubmit={handleSubmit}>
                <label htmlFor="fullName">
                  <strong>Nama Lengkap</strong>
                </label>

                <input
                  id="fullName"
                  style={FIELD}
                  type="text"
                  value={fullName}
                  required
                  maxLength={120}
                  disabled={processing}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  placeholder="Nama lengkap"
                />

                <label htmlFor="email">
                  <strong>Email</strong>
                </label>

                <input
                  id="email"
                  style={FIELD}
                  type="email"
                  value={email}
                  required
                  disabled={processing}
                  autoComplete="email"
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="Alamat email peserta"
                />

                <label htmlFor="password">
                  <strong>Password</strong>
                </label>

                <input
                  id="password"
                  style={FIELD}
                  type="password"
                  value={password}
                  required
                  minLength={8}
                  maxLength={128}
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
                  style={FIELD}
                  type="password"
                  value={confirmPassword}
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

                <label htmlFor="department">
                  <strong>Departemen</strong>
                </label>

                <input
                  id="department"
                  style={{
                    ...FIELD,
                    background: "#f1f5f9",
                  }}
                  value="ER & SS"
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
                  style={FIELD}
                  type="date"
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
                  style={FIELD}
                  type="date"
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
                      color: "#991b1b",
                      background: "#fef2f2",
                      borderRadius: 9,
                      padding: 12,
                    }}
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    processing ||
                    checking ||
                    !registrationEnabled
                  }
                  style={{
                    ...BUTTON,
                    background:
                      processing ||
                      checking ||
                      !registrationEnabled
                        ? "#94a3b8"
                        : "#2563eb",
                  }}
                >
                  {processing
                    ? "Mendaftarkan..."
                    : "Daftar OJT"}
                </button>
              </form>
            </section>

            <section style={CARD}>
              <p>Sudah mempunyai akun?</p>

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
