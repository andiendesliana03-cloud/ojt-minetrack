
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function DaftarPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mentor, setMentor] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    department: "ER & SS",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkAccess() {
      const { data: sessionData } =
        await supabase.auth.getUser();

      const user = sessionData?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

      if (profileError || profile?.role !== "mentor") {
        router.replace("/peserta");
        return;
      }

      setMentor(profile);
      setLoading(false);
    }

    checkAccess();
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error("Sesi login habis. Silakan login kembali.");
      }

      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(form),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Pendaftaran gagal."
        );
      }

      setMessage(
        "Undangan berhasil dibuat untuk " +
          form.full_name +
          ". Peserta perlu membuka email undangan."
      );

      setForm({
        full_name: "",
        email: "",
        department: "ER & SS",
      });
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

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
  };

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Memeriksa akses mentor...
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
      }}
    >
      <div style={{ maxWidth: 680, margin: "auto" }}>
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
            Mentor: {mentor?.full_name || "Mentor OJT"}
          </small>
        </header>

        <section style={card}>
          <h2>Undang Peserta Baru</h2>
          <p>
            Isi data peserta. Undangan akan dikirim ke
            alamat email yang didaftarkan.
          </p>

          <form onSubmit={handleSubmit}>
            <label>
              Nama lengkap peserta
              <input
                style={inputStyle}
                type="text"
                required
                minLength={3}
                maxLength={120}
                placeholder="Nama lengkap peserta"
                value={form.full_name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    full_name: e.target.value,
                  })
                }
              />
            </label>

            <div style={{ height: 18 }} />

            <label>
              Email peserta
              <input
                style={inputStyle}
                type="email"
                required
                maxLength={254}
                placeholder="nama@email.com"
                value={form.email}
                onChange={(e) =>
                  setForm({
                    ...form,
                    email: e.target.value,
                  })
                }
              />
            </label>

            <div style={{ height: 18 }} />

            <label>
              Departemen
              <input
                style={inputStyle}
                type="text"
                required
                maxLength={100}
                value={form.department}
                onChange={(e) =>
                  setForm({
                    ...form,
                    department: e.target.value,
                  })
                }
              />
            </label>

            <div style={{ height: 24 }} />

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                background: saving ? "#94a3b8" : "#2563eb",
                color: "white",
                padding: 15,
                border: 0,
                borderRadius: 10,
                fontSize: 16,
                fontWeight: "bold",
                cursor: saving ? "wait" : "pointer",
              }}
            >
              {saving
                ? "Mengirim undangan..."
                : "Daftarkan & Kirim Undangan"}
            </button>
          </form>

          {message && (
            <p style={{ color: "#15803d", marginTop: 20 }}>
              {message}
            </p>
          )}

          {error && (
            <p style={{ color: "#dc2626", marginTop: 20 }}>
              {error}
            </p>
          )}
        </section>

        <section style={card}>
          <h3>Informasi Pendaftaran</h3>
          <p>
            Peserta menerima email undangan untuk
            mengaktifkan akun.
          </p>
          <p>
            Setelah akun aktif, mentor dapat mengelola
            program dan perkembangan OJT peserta.
          </p>
          <p>
            Halaman ini hanya dapat digunakan oleh mentor.
          </p>
        </section>

        <button
          onClick={() => router.push("/")}
          style={{
            width: "100%",
            background: "#475569",
            color: "white",
            padding: 15,
            border: 0,
            borderRadius: 10,
            fontWeight: "bold",
          }}
        >
          Kembali ke Dashboard Mentor
        </button>
      </div>
    </main>
  );
}
