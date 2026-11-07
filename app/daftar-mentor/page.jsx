"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// PENDAFTARAN MENTOR MANDIRI
// Light / Dark mengikuti RootLayout
// ======================================================

export default function DaftarMentorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    department: "",
    site: "",
    password: "",
    confirmPassword: "",
  });

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function change(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    setError("");

    if (form.password.length < 12) {
      setError("Password minimal 12 karakter.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi password tidak sesuai.");
      return;
    }

    setSaving(true);

    try {
      // Mencegah pendaftaran akun lain ketika
      // pengguna masih memiliki sesi login.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        throw new Error(
          "Silakan keluar dari akun yang sedang aktif " +
          "sebelum mendaftarkan akun Mentor baru."
        );
      }

      const { error: signupError } =
        await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: {
            emailRedirectTo:
              window.location.origin + "/login",
            data: {
              full_name: form.full_name.trim(),
              department: form.department.trim(),
              site: form.site.trim(),

              // Permintaan saja, bukan role aktif.
              registration_type: "mentor",
            },
          },
        });

      if (signupError) {
        throw signupError;
      }

      setSuccess(true);
    } catch (err) {
      setError(
        err?.message ||
        "Pendaftaran Mentor gagal."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dm-root">
      <style>{css}</style>

      <div className="dm-card">
        <div className="dm-brand">
          OJT <span>MineTrack</span>
          <small> v2.0</small>
        </div>

        <p className="dm-subbrand">
          EMERGENCY RESPONSE GROUP · PT BERAU COAL
        </p>

        {success ? (
          <div className="dm-success">
            <h2>Pengajuan Mentor Dikirim</h2>

            <p>
              Jika pendaftaran akun berhasil diproses,
              email verifikasi akan dikirim ke alamat
              yang didaftarkan.
            </p>

            <p>
              Setelah verifikasi email, pengajuan
              menunggu persetujuan Admin sebelum
              hak akses Mentor diaktifkan.
            </p>

            <button
              type="button"
              className="dm-primary"
              onClick={() => router.push("/login")}
            >
              Kembali ke Login
            </button>
          </div>
        ) : (
          <>
            <div className="dm-heading">
              <h1>Pendaftaran Mentor OJT</h1>
              <p>
                Daftarkan akun Mentor untuk
                OJT MineTrack V2.0.
              </p>
            </div>

            <div className="dm-info">
              Akun Mentor harus mendapat persetujuan
              Admin sebelum dapat mengelola peserta.
            </div>

            {error && (
              <div className="dm-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="dm-form">
              <label>
                Nama Lengkap
                <input
                  required
                  type="text"
                  maxLength={120}
                  value={form.full_name}
                  onChange={event =>
                    change("full_name", event.target.value)
                  }
                  placeholder="Nama lengkap Mentor"
                />
              </label>

              <label>
                Email
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={event =>
                    change("email", event.target.value)
                  }
                  placeholder="Alamat email aktif"
                />
              </label>

              <label>
                Departemen
                <input
                  required
                  type="text"
                  maxLength={100}
                  value={form.department}
                  onChange={event =>
                    change("department", event.target.value)
                  }
                  placeholder="Contoh: ER & SS"
                />
              </label>

              <label>
                Site / Penempatan
                <input
                  required
                  type="text"
                  maxLength={100}
                  value={form.site}
                  onChange={event =>
                    change("site", event.target.value)
                  }
                  placeholder="Contoh: PMO, TSP, LMO, HO"
                />
              </label>

              <label>
                Password
                <input
                  required
                  minLength={12}
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={event =>
                    change("password", event.target.value)
                  }
                  placeholder="Minimal 12 karakter"
                />
              </label>

              <label>
                Konfirmasi Password
                <input
                  required
                  minLength={12}
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={event =>
                    change(
                      "confirmPassword",
                      event.target.value
                    )
                  }
                  placeholder="Ulangi password"
                />
              </label>

              <button
                type="submit"
                className="dm-primary"
                disabled={saving}
              >
                {saving
                  ? "Mengirim Pengajuan..."
                  : "Daftar Sebagai Mentor"}
              </button>
            </form>

            <button
              type="button"
              className="dm-link"
              onClick={() => router.push("/login")}
            >
              Sudah punya akun? Kembali ke Login
            </button>
          </>
        )}
      </div>
    </main>
  );
}

const css = `
.dm-root {
  --dm-bg: #f0f5f4;
  --dm-card: #ffffff;
  --dm-text: #17352d;
  --dm-muted: #71857d;
  --dm-border: #d8e6df;
  --dm-input: #ffffff;
  --dm-tint: #eaf7ef;

  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px 14px;
  background: var(--dm-bg);
  color: var(--dm-text);
  font-family: Arial, Helvetica, sans-serif;
}

html[data-theme="dark"] .dm-root {
  color-scheme: dark;
  --dm-bg: #0d171b;
  --dm-card: #17272b;
  --dm-text: #edf8f4;
  --dm-muted: #a5bbb8;
  --dm-border: #30484b;
  --dm-input: #1b3034;
  --dm-tint: #203b35;
}

.dm-root * {
  box-sizing: border-box;
}

.dm-card {
  width: 100%;
  max-width: 510px;
  padding: 30px;
  border-radius: 20px;
  background: var(--dm-card);
  border: 1px solid var(--dm-border);
  box-shadow: 0 12px 40px #00000010;
}

.dm-brand {
  text-align: center;
  font-size: 26px;
  font-weight: 900;
}

.dm-brand span {
  color: #0f996b;
}

.dm-brand small {
  font-size: 10px;
  color: var(--dm-muted);
}

.dm-subbrand {
  text-align: center;
  color: var(--dm-muted);
  font-size: 10px;
  letter-spacing: 1px;
  margin: 10px 0 27px;
}

.dm-heading h1 {
  margin: 0;
  font-size: 24px;
  text-align: center;
}

.dm-heading p {
  text-align: center;
  color: var(--dm-muted);
  font-size: 13px;
  line-height: 1.6;
}

.dm-info {
  margin: 18px 0;
  background: var(--dm-tint);
  color: var(--dm-text);
  padding: 13px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.dm-form {
  display: grid;
  gap: 15px;
}

.dm-form label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
}

.dm-form input {
  width: 100%;
  min-width: 0;
  background: var(--dm-input);
  color: var(--dm-text);
  border: 1px solid var(--dm-border);
  border-radius: 10px;
  padding: 13px;
  font: inherit;
  font-weight: 400;
  font-size: 14px;
}

.dm-form input:focus-visible {
  outline: 2px solid #24b987;
  outline-offset: 2px;
}

.dm-primary {
  width: 100%;
  padding: 14px;
  border: 0;
  border-radius: 10px;
  background: #078b61;
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.dm-primary:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.dm-link {
  display: block;
  border: 0;
  margin: 17px auto 0;
  background: transparent;
  color: #159a72;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.dm-error {
  background: #fff0f0;
  color: #b91c1c;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 15px;
  font-size: 12px;
}

.dm-success {
  text-align: center;
  line-height: 1.7;
}

.dm-success h2 {
  font-size: 21px;
}

.dm-success p {
  color: var(--dm-muted);
  font-size: 13px;
}

.dm-success button {
  margin-top: 12px;
}

@media(max-width:500px) {
  .dm-card {
    padding: 21px;
  }
}
`;
