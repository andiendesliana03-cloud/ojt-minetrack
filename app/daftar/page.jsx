
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
  background: "#153c2e",
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
  const [inviteCode, setInviteCode] = useState("");

  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function checkStatus() {
    const response = await fetch(
      "/api/system/feature-flags",
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "Status pendaftaran belum tersedia."
      );
    }

    const result = await response.json();

    return (
      result?.success === true &&
      result?.features?.submission_enabled === true
    );
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const available = await checkStatus();

        if (mounted) setEnabled(available);
      } catch {
        if (mounted) setEnabled(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    load();

    return () => {
      mounted = false;
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

    if (!inviteCode.trim()) {
      setError(
        "Kode pendaftaran ERG wajib diisi."
      );
      return;
    }

    if (inviteCode.length > 128) {
      setError(
        "Kode pendaftaran terlalu panjang."
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
      const available = await checkStatus();

      setEnabled(available);

      if (!available) {
        throw new Error(
          "Pendaftaran OJT belum dibuka."
        );
      }

      // Data dikirim ke API server.
      // Kode undangan diperiksa di server,
      // bukan dibandingkan dalam browser.
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
            invite_code: inviteCode.trim(),
            site,
            start_date: startDate,
            end_date: endDate,
          }),
        }
      );

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Server tidak memberikan respons yang valid."
        );
      }

      if (
        !response.ok ||
        result?.success !== true ||
        result?.status !== "pending"
      ) {
        throw new Error(
          result?.error ||
            "Pendaftaran gagal diproses."
        );
      }

      setPassword("");
      setConfirmPassword("");
      setInviteCode("");
      setSuccess(true);
    } catch (err) {
      setError(
        err?.message ||
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
        background: "#f3f6f3",
        padding: "24px 15px",
        color: "#20352b",
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
            background: "#153c2e",
            color: "#ffffff",
            textAlign: "center",
            borderTop: "5px solid #d8b45a",
          }}
        >
          <h1>OJT MineTrack</h1>
          <h2>Pendaftaran Peserta OJT</h2>
          <p>Emergency Response Group</p>
          <p>PT Berau Coal 2026</p>
        </header>

        {success ? (
          <section
            style={{
              ...CARD,
              textAlign: "center",
            }}
            role="status"
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

            <p>
              <strong>
                Status: Menunggu Persetujuan Mentor
              </strong>
            </p>

            <p style={{ lineHeight: 1.8 }}>
              Kamu tidak perlu melakukan verifikasi
              email atau mengisi formulir pengajuan
              kedua.
            </p>

            <p style={{ lineHeight: 1.8 }}>
              Setelah mentor menyetujui, masuk
              menggunakan email dan password
              yang sudah didaftarkan.
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
                background: "#f8f0d9",
                borderColor: "#e7d59c",
              }}
            >
              <strong>Status Pendaftaran</strong>

              <p>
                {checking
                  ? "Memeriksa status..."
                  : enabled
                  ? "Pendaftaran peserta OJT dibuka."
                  : "Pendaftaran peserta OJT belum dibuka."}
              </p>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                Peserta cukup mendaftar satu kali.
                Pengajuan akan langsung masuk
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
                  type="text"
                  style={FIELD}
                  value={fullName}
                  maxLength={120}
                  required
                  disabled={processing}
                  onChange={(e) =>
                    setFullName(e.target.value)
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
                  onChange={(e) =>
                    setEmail(e.target.value)
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
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={processing}
                  autoComplete="new-password"
                  onChange={(e) =>
                    setPassword(e.target.value)
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
                  required
                  disabled={processing}
                  autoComplete="new-password"
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  placeholder="Ulangi password"
                />

                <label htmlFor="inviteCode">
                  <strong>
                    Kode Pendaftaran ERG *
                  </strong>
                </label>

                <input
                  id="inviteCode"
                  type="text"
                  style={FIELD}
                  value={inviteCode}
                  required
                  maxLength={128}
                  disabled={processing}
                  autoComplete="off"
                  onChange={(e) =>
                    setInviteCode(e.target.value)
                  }
                  placeholder="Masukkan kode dari mentor"
                />

                <p
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: -9,
                    marginBottom: 20,
                  }}
                >
                  Kode diberikan oleh mentor atau
                  administrator OJT.
                </p>

                <label htmlFor="department">
                  <strong>Departemen</strong>
                </label>

                <input
                  id="department"
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
                  onChange={(e) =>
                    setSite(e.target.value)
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setStartDate(value);

                    if (
                      endDate &&
                      endDate < value
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
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                />

                {error && (
                  <p
                    role="alert"
                    style={{
                      padding: 12,
                      color: "#991b1b",
                      background: "#fef2f2",
                      borderRadius: 10,
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
                      !enabled
                        ? "#94a3b8"
                        : "#153c2e",
                  }}
                  disabled={
                    processing ||
                    checking ||
                    !enabled
                  }
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
