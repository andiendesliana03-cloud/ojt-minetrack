
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const REGISTRATION_ENABLED = false;

const SITE_OPTIONS = [
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

const initialForm = {
  full_name: "",
  email: "",
  department: "ER & SS",
  site: "",
  start_date: "",
  end_date: "",
};

const cardStyle = {
  background: "#ffffff",
  padding: 22,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  marginBottom: 18,
};

const inputStyle = {
  width: "100%",
  padding: 13,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
  boxSizing: "border-box",
  marginTop: 7,
};

const buttonStyle = {
  width: "100%",
  padding: 15,
  border: "none",
  borderRadius: 10,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};

function formatDate(value) {
  if (!value) return "-";

  const parts = value.split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function DaftarPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [securityResult, setSecurityResult] =
    useState(null);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (
          profileError ||
          profile?.role !== "mentor"
        ) {
          router.replace("/peserta");
          return;
        }

        if (active) {
          setMentor(profile);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Gagal memeriksa akses mentor."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setResult(null);
  }

  function validateForm() {
    if (form.full_name.trim().length < 3) {
      return "Nama peserta minimal 3 karakter.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Format email peserta tidak valid.";
    }

    if (!form.department.trim()) {
      return "Departemen wajib diisi.";
    }

    if (!SITE_OPTIONS.includes(form.site)) {
      return "Pilih site OJT.";
    }

    if (!form.start_date || !form.end_date) {
      return "Tanggal mulai dan selesai wajib diisi.";
    }

    if (form.end_date < form.start_date) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }

    return "";
  }

  // SIMULASI PENDAFTARAN
  async function runSimulation(event) {
    event.preventDefault();

    if (saving || testing) return;

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }

    setSaving(true);
    setError("");
    setResult(null);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      const token =
        sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error(
          "Sesi login habis. Silakan login kembali."
        );
      }

      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            department: form.department.trim(),
            site: form.site,
            start_date: form.start_date,
            end_date: form.end_date,
            dry_run: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Simulasi gagal."
        );
      }

      if (data.dry_run !== true) {
        throw new Error(
          "Server tidak mengonfirmasi mode simulasi."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message || "Terjadi kesalahan simulasi."
      );
    } finally {
      setSaving(false);
    }
  }

  // UJI PENGAMAN API
  // Permintaan ini sengaja tidak menyertakan
  // token maupun data peserta.
  //
  // Server yang terkunci harus mengembalikan
  // HTTP 403 sebelum proses pembuatan akun.
  async function testSecurity() {
    if (saving || testing) return;

    setTesting(true);
    setSecurityResult(null);
    setError("");

    try {
      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            dry_run: false,
          }),
        }
      );

      const data = await response.json();

      const passed =
        response.status === 403 &&
        data.success === false &&
        typeof data.error === "string" &&
        data.error.includes(
          "Pendaftaran asli sedang dinonaktifkan"
        );

      setSecurityResult({
        passed,
        status: response.status,
        message:
          data.error ||
          "Server tidak memberikan pesan.",
      });
    } catch (err) {
      setSecurityResult({
        passed: false,
        status: "-",
        message:
          err.message || "Kesalahan jaringan.",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Memeriksa akses mentor...
      </main>
    );
  }

  if (!mentor) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Akses tidak tersedia</h2>
        <p>{error || "Halaman khusus mentor."}</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            ...cardStyle,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            Pendaftaran Peserta OJT
          </h1>

          <p>Emergency Response Group</p>
          <p>PT Berau Coal 2026</p>

          <small>
            Mentor:{" "}
            {mentor.full_name || "Mentor OJT"}
          </small>
        </header>

        <section
          style={{
            ...cardStyle,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Mode Pengujian Aktif
          </h3>

          <p style={{ marginBottom: 0 }}>
            Pendaftaran asli sedang dikunci.
            Simulasi dan pengujian pengaman
            dapat dilakukan tanpa membuat
            akun peserta baru.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>
            Formulir Peserta OJT
          </h2>

          <form onSubmit={runSimulation}>
            <label htmlFor="full-name">
              <strong>Nama Lengkap Peserta</strong>
            </label>

            <input
              id="full-name"
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="Nama peserta"
              style={inputStyle}
              value={form.full_name}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "full_name",
                  event.target.value
                )
              }
            />

            <div style={{ height: 18 }} />

            <label htmlFor="email">
              <strong>Email Peserta</strong>
            </label>

            <input
              id="email"
              type="email"
              required
              maxLength={254}
              placeholder="simulasi@example.com"
              style={inputStyle}
              value={form.email}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "email",
                  event.target.value
                )
              }
            />

            <div style={{ height: 18 }} />

            <label htmlFor="department">
              <strong>Departemen</strong>
            </label>

            <input
              id="department"
              type="text"
              required
              maxLength={100}
              style={inputStyle}
              value={form.department}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "department",
                  event.target.value
                )
              }
            />

            <div style={{ height: 18 }} />

            <label htmlFor="site">
              <strong>Site Penempatan OJT</strong>
            </label>

            <select
              id="site"
              required
              style={inputStyle}
              value={form.site}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "site",
                  event.target.value
                )
              }
            >
              <option value="">
                -- Pilih Site OJT --
              </option>

              {SITE_OPTIONS.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <strong>
                Ketentuan Penempatan
              </strong>

              <p
                style={{
                  marginBottom: 0,
                  color: "#475569",
                }}
              >
                Site peserta ditentukan pada
                awal program OJT dan digunakan
                selama periode program.
              </p>
            </div>

            <hr
              style={{
                border: 0,
                borderTop: "1px solid #e2e8f0",
                margin: "24px 0",
              }}
            />

            <h2>Periode Program OJT</h2>

            <label htmlFor="start-date">
              <strong>Tanggal Mulai OJT</strong>
            </label>

            <input
              id="start-date"
              type="date"
              required
              style={inputStyle}
              value={form.start_date}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "start_date",
                  event.target.value
                )
              }
            />

            <div style={{ height: 18 }} />

            <label htmlFor="end-date">
              <strong>Tanggal Selesai OJT</strong>
            </label>

            <input
              id="end-date"
              type="date"
              required
              min={form.start_date || undefined}
              style={inputStyle}
              value={form.end_date}
              disabled={saving || testing}
              onChange={(event) =>
                updateForm(
                  "end_date",
                  event.target.value
                )
              }
            />

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 20,
                  padding: 14,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  color: "#b91c1c",
                  overflowWrap: "anywhere",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || testing}
              style={{
                ...buttonStyle,
                marginTop: 24,
                background:
                  saving || testing
                    ? "#94a3b8"
                    : "#0f766e",
              }}
            >
              {saving
                ? "Menjalankan Simulasi..."
                : "Jalankan Simulasi Pendaftaran"}
            </button>

            <button
              type="button"
              disabled={
                !REGISTRATION_ENABLED ||
                saving ||
                testing
              }
              style={{
                ...buttonStyle,
                background: "#94a3b8",
                marginTop: 12,
                cursor: "not-allowed",
              }}
            >
              Daftarkan Peserta dan Buat Program OJT
            </button>

            <p
              style={{
                textAlign: "center",
                color: "#64748b",
                fontSize: 12,
              }}
            >
              Pendaftaran asli dinonaktifkan
              sementara selama pengujian.
            </p>
          </form>

          {result?.dry_run === true && (
            <div
              role="status"
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 12,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: "#166534",
                }}
              >
                Simulasi Berhasil
              </h3>

              <p>
                Validasi data dan akses mentor
                berhasil diperiksa.
              </p>

              <p>
                <strong>Nama:</strong>{" "}
                {result.preview?.full_name}
              </p>

              <p>
                <strong>Email:</strong>{" "}
                {result.preview?.email}
              </p>

              <p>
                <strong>Departemen:</strong>{" "}
                {result.preview?.department}
              </p>

              <p>
                <strong>Site:</strong>{" "}
                {result.preview?.site}
              </p>

              <p>
                <strong>Mulai OJT:</strong>{" "}
                {formatDate(
                  result.preview?.start_date
                )}
              </p>

              <p>
                <strong>Selesai OJT:</strong>{" "}
                {formatDate(
                  result.preview?.end_date
                )}
              </p>

              <p>
                <strong>Status Program:</strong>{" "}
                {result.preview?.status}
              </p>

              <strong
                style={{
                  color: "#166534",
                }}
              >
                Tidak ada akun atau program
                OJT yang dibuat.
              </strong>
            </div>
          )}
        </section>

        {/* PANEL PENGUJIAN PENGAMAN API */}
        <section
          style={{
            ...cardStyle,
            border: "1px solid #bfdbfe",
          }}
        >
          <h2 style={{ marginTop: 0 }}>
            Pengujian Keamanan API
          </h2>

          <p style={{ color: "#475569" }}>
            Tombol ini menguji apakah server
            menolak permintaan pendaftaran
            asli ketika mode pengujian aktif.
          </p>

          <button
            type="button"
            disabled={saving || testing}
            onClick={testSecurity}
            style={{
              ...buttonStyle,
              background:
                saving || testing
                  ? "#94a3b8"
                  : "#1d4ed8",
            }}
          >
            {testing
              ? "Sedang Menguji Pengaman..."
              : "Uji Pengaman API"}
          </button>

          {securityResult && (
            <div
              role="status"
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 12,
                border: securityResult.passed
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
                background: securityResult.passed
                  ? "#f0fdf4"
                  : "#fef2f2",
              }}
            >
              <h3
                style={{
                  marginTop: 0,
                  color: securityResult.passed
                    ? "#166534"
                    : "#b91c1c",
                }}
              >
                {securityResult.passed
                  ? "Pengaman API Berfungsi"
                  : "Pengujian Perlu Diperiksa"}
              </h3>

              <p>
                <strong>HTTP Status:</strong>{" "}
                {securityResult.status}
              </p>

              <p>
                <strong>Pesan Server:</strong>{" "}
                {securityResult.message}
              </p>

              {securityResult.passed && (
                <p
                  style={{
                    color: "#166534",
                    fontWeight: 700,
                  }}
                >
                  Server menolak pendaftaran
                  asli sebelum proses pembuatan
                  akun peserta.
                </p>
              )}
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            ...buttonStyle,
            background: "#475569",
            marginBottom: 20,
          }}
        >
          Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}
