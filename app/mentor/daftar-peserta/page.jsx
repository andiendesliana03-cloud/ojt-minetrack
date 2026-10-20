
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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

// Pendaftaran asli dinonaktifkan selama pengujian.
const REGISTRATION_ENABLED = false;

const initialForm = {
  full_name: "",
  email: "",
  department: "ER & SS",
  site: "",
  start_date: "",
  end_date: "",
};

const card = {
  background: "white",
  padding: 24,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  marginBottom: 18,
};

const inputStyle = {
  width: "100%",
  padding: 13,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 16,
  marginTop: 7,
  boxSizing: "border-box",
  background: "white",
  color: "#0f172a",
};

const buttonStyle = {
  width: "100%",
  padding: 15,
  border: 0,
  borderRadius: 10,
  fontSize: 16,
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
  const [saving, setSaving] = useState(false);
  const [mentor, setMentor] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

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
            err.message || "Gagal memeriksa akses."
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

    // Hasil simulasi lama tidak berlaku
    // jika data formulir diubah.
    setResult(null);
    setError("");
  }

  function validateForm() {
    const cleanName = form.full_name.trim();
    const cleanEmail =
      form.email.trim().toLowerCase();
    const cleanDepartment =
      form.department.trim();

    if (cleanName.length < 3) {
      return "Nama peserta minimal 3 karakter.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
    ) {
      return "Format email peserta tidak valid.";
    }

    if (!cleanDepartment) {
      return "Departemen wajib diisi.";
    }

    if (!SITE_OPTIONS.includes(form.site)) {
      return "Pilih salah satu site OJT.";
    }

    if (
      !form.start_date ||
      !form.end_date
    ) {
      return "Tanggal mulai dan selesai wajib diisi.";
    }

    if (form.end_date < form.start_date) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }

    return "";
  }

  async function submitRegistration(dryRun) {
    if (saving) return;

    // Perlindungan tambahan agar pendaftaran
    // asli tidak bisa dilakukan selama pengujian.
    if (!dryRun && !REGISTRATION_ENABLED) {
      setError(
        "Pendaftaran asli masih dinonaktifkan selama tahap pengujian."
      );
      return;
    }

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
            dry_run: dryRun,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Permintaan gagal."
        );
      }

      // Simulasi harus mendapat konfirmasi
      // dry_run dari server, bukan sekadar
      // status HTTP 200.
      if (dryRun && data.dry_run !== true) {
        throw new Error(
          "Server tidak mengonfirmasi mode simulasi. Periksa versi API sebelum melanjutkan."
        );
      }

      setResult(data);

      if (!dryRun) {
        setForm(initialForm);
      }
    } catch (err) {
      setError(
        err.message || "Terjadi kesalahan."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    // Tombol utama form hanya menjalankan simulasi
    // selama pendaftaran asli dinonaktifkan.
    submitRegistration(true);
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

        <p style={{ color: "#dc2626" }}>
          {error || "Halaman khusus Mentor."}
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 18,
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "white",
          }}
        >
          <h1>Pendaftaran Peserta OJT</h1>

          <p>Emergency Response Group</p>
          <p>PT Berau Coal 2026</p>

          <small>
            Mentor:{" "}
            {mentor.full_name || "Mentor OJT"}
          </small>
        </header>

        <section
          style={{
            ...card,
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Mode Simulasi Aktif
          </h3>

          <p style={{ marginBottom: 0 }}>
            Pengujian ini tidak membuat akun,
            tidak mengirim email undangan,
            dan tidak menyimpan data peserta
            atau program OJT.
          </p>
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>
            Simulasi Pendaftaran OJT
          </h2>

          <p style={{ color: "#64748b" }}>
            Lengkapi data simulasi untuk
            memeriksa validasi dan akses mentor.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="full-name">
              <strong>
                Nama Lengkap Peserta
              </strong>
            </label>

            <input
              id="full-name"
              type="text"
              required
              minLength={3}
              maxLength={120}
              style={inputStyle}
              placeholder="Nama lengkap peserta"
              value={form.full_name}
              disabled={saving}
              onChange={(e) =>
                updateForm(
                  "full_name",
                  e.target.value
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
              style={inputStyle}
              placeholder="simulasi@example.com"
              value={form.email}
              disabled={saving}
              onChange={(e) =>
                updateForm(
                  "email",
                  e.target.value
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
              disabled={saving}
              onChange={(e) =>
                updateForm(
                  "department",
                  e.target.value
                )
              }
            />

            <div style={{ height: 18 }} />

            <label htmlFor="site">
              <strong>
                Site Penempatan OJT
              </strong>
            </label>

            <select
              id="site"
              required
              style={inputStyle}
              value={form.site}
              disabled={saving}
              onChange={(e) =>
                updateForm(
                  "site",
                  e.target.value
                )
              }
            >
              <option value="">
                -- Pilih Site OJT --
              </option>

              {SITE_OPTIONS.map((site) => (
                <option
                  key={site}
                  value={site}
                >
                  {site}
                </option>
              ))}
            </select>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                marginTop: 14,
              }}
            >
              <strong>
                Ketentuan Site OJT
              </strong>

              <p
                style={{
                  color: "#475569",
                  marginBottom: 0,
                }}
              >
                Satu peserta menggunakan satu
                site penempatan selama periode
                program OJT.
              </p>
            </div>

            <hr
              style={{
                border: 0,
                borderTop: "1px solid #e2e8f0",
                margin: "26px 0",
              }}
            />

            <h2>Periode Program OJT</h2>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="start-date">
                <strong>
                  Tanggal Mulai OJT
                </strong>
              </label>

              <input
                id="start-date"
                type="date"
                required
                style={inputStyle}
                value={form.start_date}
                disabled={saving}
                onChange={(e) =>
                  updateForm(
                    "start_date",
                    e.target.value
                  )
                }
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label htmlFor="end-date">
                <strong>
                  Tanggal Selesai OJT
                </strong>
              </label>

              <input
                id="end-date"
                type="date"
                required
                min={form.start_date || undefined}
                style={inputStyle}
                value={form.end_date}
                disabled={saving}
                onChange={(e) =>
                  updateForm(
                    "end_date",
                    e.target.value
                  )
                }
              />
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 18,
                  overflowWrap: "anywhere",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                ...buttonStyle,
                background: saving
                  ? "#94a3b8"
                  : "#0f766e",
                color: "white",
                marginBottom: 12,
              }}
            >
              {saving
                ? "Menjalankan Simulasi..."
                : "Jalankan Simulasi Pendaftaran"}
            </button>

            <button
              type="button"
              disabled={!REGISTRATION_ENABLED || saving}
              onClick={() =>
                submitRegistration(false)
              }
              style={{
                ...buttonStyle,
                background: "#94a3b8",
                color: "white",
                cursor: "not-allowed",
              }}
            >
              Daftarkan Peserta dan Buat Program OJT
            </button>

            <p
              style={{
                fontSize: 12,
                color: "#64748b",
                textAlign: "center",
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
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 12,
                padding: 18,
                marginTop: 20,
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

              <p
                style={{
                  fontWeight: 700,
                  color: "#166534",
                }}
              >
                Tidak ada akun atau program
                OJT yang dibuat.
              </p>
            </div>
          )}
        </section>

        <section style={card}>
          <h3>Informasi Pengujian</h3>

          <p>
            Mode simulasi hanya memeriksa
            validasi formulir dan akses mentor
            melalui API.
          </p>

          <p>
            Keberhasilan penyimpanan data
            ke Supabase belum diuji.
          </p>
        </section>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            ...buttonStyle,
            background: "#475569",
            color: "white",
          }}
        >
          Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}
