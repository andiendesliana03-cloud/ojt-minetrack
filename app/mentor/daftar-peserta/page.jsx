
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

export default function DaftarPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mentor, setMentor] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
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

        const { data: profile, error: profileError } =
          await supabase
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
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving || message) return;

    const cleanName = form.full_name.trim();
    const cleanEmail =
      form.email.trim().toLowerCase();
    const cleanDepartment =
      form.department.trim();

    setError("");

    if (cleanName.length < 3) {
      setError(
        "Nama peserta minimal 3 karakter."
      );
      return;
    }

    if (!cleanEmail || !cleanDepartment) {
      setError(
        "Email dan departemen wajib diisi."
      );
      return;
    }

    if (!SITE_OPTIONS.includes(form.site)) {
      setError(
        "Pilih satu site penempatan OJT."
      );
      return;
    }

    if (
      !form.start_date ||
      !form.end_date
    ) {
      setError(
        "Tanggal mulai dan selesai OJT wajib diisi."
      );
      return;
    }

    if (form.end_date < form.start_date) {
      setError(
        "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
      );
      return;
    }

    setSaving(true);

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
          body: JSON.stringify({
            full_name: cleanName,
            email: cleanEmail,
            department: cleanDepartment,
            site: form.site,
            start_date: form.start_date,
            end_date: form.end_date,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Pendaftaran gagal."
        );
      }

      setMessage(
        `Peserta ${cleanName} berhasil didaftarkan. ` +
        `Site: ${result.site || form.site}. ` +
        `Periode: ${result.start_date || form.start_date} ` +
        `sampai ${result.end_date || form.end_date}. ` +
        "Program OJT berhasil dibuat dan undangan akun telah dikirim."
      );

      setForm(initialForm);
    } catch (err) {
      setError(
        err.message || "Terjadi kesalahan."
      );
    } finally {
      setSaving(false);
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

        <section style={card}>
          <h2>
            Daftarkan Peserta dan Program OJT
          </h2>

          <p style={{ color: "#64748b" }}>
            Lengkapi identitas peserta, pilih
            satu site penempatan, dan tentukan
            tanggal mulai serta selesai OJT.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="full-name">
              <strong>
                Nama Lengkap Peserta
              </strong>
            </label>

            <input
              id="full-name"
              style={inputStyle}
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="Nama lengkap peserta"
              value={form.full_name}
              disabled={saving || !!message}
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
              style={inputStyle}
              type="email"
              required
              maxLength={254}
              placeholder="nama@email.com"
              value={form.email}
              disabled={saving || !!message}
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
              style={inputStyle}
              type="text"
              required
              maxLength={100}
              value={form.department}
              disabled={saving || !!message}
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
              style={inputStyle}
              value={form.site}
              required
              disabled={saving || !!message}
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
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 12,
                padding: 14,
                marginTop: 12,
              }}
            >
              <strong>
                Ketentuan Site OJT
              </strong>

              <p
                style={{
                  marginBottom: 0,
                  color: "#475569",
                  fontSize: 14,
                }}
              >
                Satu peserta memiliki satu site
                penempatan selama periode
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
                style={inputStyle}
                value={form.start_date}
                required
                disabled={saving || !!message}
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
                style={inputStyle}
                value={form.end_date}
                min={form.start_date || undefined}
                required
                disabled={saving || !!message}
                onChange={(e) =>
                  updateForm(
                    "end_date",
                    e.target.value
                  )
                }
              />
            </div>

            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                marginBottom: 20,
                color: "#475569",
                fontSize: 14,
              }}
            >
              Setelah pendaftaran berhasil,
              sistem membuat akun peserta,
              mengirim email undangan,
              dan membuat program OJT aktif
              sesuai site serta periode
              yang ditentukan mentor.
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  color: "#b91c1c",
                  background: "#fef2f2",
                  padding: 12,
                  borderRadius: 10,
                  overflowWrap: "anywhere",
                }}
              >
                {error}
              </p>
            )}

            {message && (
              <div
                role="status"
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  color: "#166534",
                  padding: 14,
                  borderRadius: 12,
                  marginBottom: 18,
                }}
              >
                <strong>
                  Pendaftaran Berhasil
                </strong>
                <p>{message}</p>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/mentor/monitoring-peserta"
                    )
                  }
                  style={{
                    width: "100%",
                    padding: 13,
                    background: "#15803d",
                    color: "white",
                    border: 0,
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Lihat Monitoring Peserta
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !!message}
              style={{
                width: "100%",
                background:
                  saving || message
                    ? "#94a3b8"
                    : "#2563eb",
                color: "white",
                padding: 15,
                border: 0,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: "bold",
                cursor:
                  saving || message
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {saving
                ? "Memproses Pendaftaran..."
                : "Daftarkan Peserta dan Buat Program OJT"}
            </button>
          </form>
        </section>

        <section style={card}>
          <h3>Informasi Pendaftaran</h3>

          <p>
            Peserta menerima email undangan
            untuk mengaktifkan akun.
          </p>

          <p>
            Site dan periode program OJT
            akan digunakan pada monitoring
            peserta.
          </p>

          <p>
            Halaman ini hanya dapat digunakan
            oleh Mentor.
          </p>
        </section>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            background: "#475569",
            color: "white",
            padding: 15,
            border: 0,
            borderRadius: 10,
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}
