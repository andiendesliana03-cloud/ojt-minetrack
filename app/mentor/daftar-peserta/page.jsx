
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

    if (saving) return;

    const cleanName = form.full_name.trim();
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanDepartment = form.department.trim();

    if (cleanName.length < 3) {
      setError(
        "Nama peserta minimal 3 karakter."
      );
      return;
    }

    if (!cleanEmail) {
      setError("Email peserta wajib diisi.");
      return;
    }

    if (!cleanDepartment) {
      setError("Departemen wajib diisi.");
      return;
    }

    if (!SITE_OPTIONS.includes(form.site)) {
      setError(
        "Pilih satu site penempatan OJT."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

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

      const payload = {
        full_name: cleanName,
        email: cleanEmail,
        department: cleanDepartment,
        site: form.site,
      };

      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Pendaftaran gagal."
        );
      }

      setMessage(
        `Undangan berhasil dibuat untuk ${cleanName}. ` +
        `Site yang dipilih: ${form.site}. ` +
        "Pastikan integrasi API penyimpanan site sudah aktif."
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
          <h2>Undang Peserta Baru</h2>

          <p style={{ color: "#64748b" }}>
            Isi identitas peserta dan pilih satu
            site penempatan untuk seluruh periode OJT.
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
                marginTop: 4,
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
                Satu peserta hanya memiliki satu
                site penempatan selama periode OJT.
                Seluruh penilaian dan laporan
                mingguan akan menggunakan site ini.
              </p>
            </div>

            <div style={{ height: 24 }} />

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                background: saving
                  ? "#94a3b8"
                  : "#2563eb",
                color: "white",
                padding: 15,
                border: 0,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: "bold",
                cursor: saving
                  ? "wait"
                  : "pointer",
              }}
            >
              {saving
                ? "Mengirim undangan..."
                : "Daftarkan & Kirim Undangan"}
            </button>
          </form>

          {message && (
            <p
              role="status"
              style={{
                color: "#15803d",
                marginTop: 20,
              }}
            >
              {message}
            </p>
          )}

          {error && (
            <p
              role="alert"
              style={{
                color: "#dc2626",
                marginTop: 20,
              }}
            >
              {error}
            </p>
          )}
        </section>

        <section style={card}>
          <h3>Informasi Pendaftaran</h3>

          <p>
            Peserta menerima email undangan
            untuk mengaktifkan akun.
          </p>

          <p>
            Nama dan site peserta akan digunakan
            sebagai identitas pada monitoring
            pencapaian OJT.
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
