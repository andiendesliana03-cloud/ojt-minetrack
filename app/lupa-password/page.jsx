
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// LUPA PASSWORD — EMAIL RECOVERY
//
// Digunakan oleh Admin, Mentor, dan Peserta.
// Tidak mengubah database maupun role pengguna.
//
// Alur:
// 1. Masukkan email
// 2. Kirim permintaan reset ke Supabase
// 3. Buka tautan terbaru dari email
// 4. Masuk ke /reset-password
// 5. Buat password baru
// ======================================================

export default function LupaPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (sending) return;

    const cleanEmail = email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    setSending(true);
    setError("");

    try {
      // Menggunakan domain tempat website
      // sedang dibuka, bukan domain hardcode.
      const redirectTo = new URL(
        "/reset-password",
        window.location.origin
      ).toString();

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      if (resetError) throw resetError;

      setSent(true);
    } catch (err) {
      const errorMessage =
        String(err?.message || "").toLowerCase();

      if (
        errorMessage.includes("rate limit") ||
        errorMessage.includes("too many requests") ||
        errorMessage.includes("security purposes")
      ) {
        setError(
          "Permintaan terlalu sering. " +
          "Silakan coba kembali setelah jeda " +
          "yang ditentukan sistem."
        );
      } else {
        setError(
          err?.message ||
            "Gagal mengirim permintaan reset password."
        );
      }
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setSent(false);
    setError("");
    setShowInfo(false);
  }

  return (
    <main className="lp-page">
      <style>{css}</style>

      <section className="lp-card">
        {/* BRAND */}

        <div className="lp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="lp-subbrand">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </div>

        {/* ICON */}

        <div className="lp-symbol">
          {sent ? "📩" : "🔐"}
        </div>

        {sent ? (
          <>
            <h1>Periksa Email Anda</h1>

            <p className="lp-description">
              Jika alamat email terdaftar,
              sistem akan mengirimkan tautan
              untuk mengatur ulang password.
            </p>

            <div
              className="lp-email-box"
              role="status"
            >
              <span>Permintaan dikirim untuk:</span>
              <strong>{email.trim()}</strong>
            </div>

            <div className="lp-info">
              <strong>
                📋 Langkah selanjutnya
              </strong>

              <ol>
                <li>
                  Buka Inbox email yang digunakan.
                </li>

                <li>
                  Periksa folder Spam atau Junk
                  jika email belum ditemukan.
                </li>

                <li>
                  Buka email pemulihan terbaru
                  dari sistem OJT MineTrack.
                </li>

                <li>
                  Klik tautan reset password
                  satu kali.
                </li>

                <li>
                  Buat password baru dengan
                  minimal 12 karakter.
                </li>

                <li>
                  Login kembali menggunakan
                  password yang baru.
                </li>
              </ol>
            </div>

            <button
              type="button"
              className="lp-primary"
              onClick={resetForm}
            >
              Kirim Permintaan Baru
            </button>

            <p className="lp-small">
              Demi keamanan, sistem tidak
              menampilkan apakah sebuah email
              terdaftar atau tidak.
            </p>
          </>
        ) : (
          <>
            <h1>Lupa Password?</h1>

            <p className="lp-description">
              Masukkan alamat email yang
              terdaftar pada OJT MineTrack v2.0.
              Kami akan mengirimkan tautan
              untuk membuat password baru.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="lp-email">
                Email Akun
              </label>

              <input
                id="lp-email"
                type="email"
                placeholder="Masukkan email terdaftar"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                disabled={sending}
                required
              />

              <button
                type="submit"
                className="lp-primary"
                disabled={sending}
              >
                {sending
                  ? "Mengirim Permintaan..."
                  : "Kirim Link Reset Password"}
              </button>
            </form>

            <button
              type="button"
              className="lp-help-toggle"
              onClick={() =>
                setShowInfo((previous) => !previous)
              }
              aria-expanded={showInfo}
            >
              {showInfo
                ? "− Tutup Petunjuk"
                : "+ Petunjuk Reset Password"}
            </button>

            {showInfo && (
              <div className="lp-info">
                <strong>
                  Informasi Pemulihan Akun
                </strong>

                <p>
                  Gunakan email yang sama
                  dengan email akun Mentor,
                  Admin, atau Peserta OJT.
                </p>

                <p>
                  Gunakan tautan dari email
                  terbaru. Jika tautan tidak
                  valid, ulangi permintaan
                  pemulihan dari halaman ini.
                </p>

                <p>
                  Jangan membagikan tautan,
                  OTP, atau password kepada
                  pengguna lain.
                </p>
              </div>
            )}
          </>
        )}

        {/* ERROR */}

        {error && (
          <div
            className="lp-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* BACK */}

        <button
          type="button"
          className="lp-back"
          onClick={() =>
            router.push("/login")
          }
        >
          ← Kembali ke Login
        </button>

        {/* FOOTER */}

        <footer className="lp-footer">
          OJT MineTrack v2.0
          <br />
          Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </section>
    </main>
  );
}

// ======================================================
// CSS — OJT MINETRACK V2.0
// ======================================================

const css = `
* {
  box-sizing: border-box;
}

.lp-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 20px;
  font-family: Arial, Helvetica, sans-serif;

  background:
    linear-gradient(
      120deg,
      rgba(4,23,34,.93),
      rgba(4,55,48,.84)
    ),
    url("/background-erg.png.PNG")
      center / cover no-repeat;
}

.lp-card {
  width: 100%;
  max-width: 440px;
  padding: 35px;

  background: #fff;
  border-radius: 19px;
  color: #17313d;

  box-shadow:
    0 20px 60px rgba(3,26,39,.25);
}

.lp-brand {
  color: #142c3b;
  font-size: 27px;
  font-weight: 900;
  letter-spacing: -.7px;
  text-align: center;
}

.lp-brand span {
  color: #09875f;
}

.lp-brand small {
  margin-left: 6px;
  color: #8da0aa;
  font-size: 10px;
  letter-spacing: 0;
}

.lp-subbrand {
  margin-top: 9px;
  color: #7b919b;
  text-align: center;
  font-size: 10px;
  letter-spacing: .7px;
  line-height: 1.7;
}

.lp-symbol {
  display: grid;
  place-items: center;

  width: 65px;
  height: 65px;

  margin: 28px auto 15px;

  background: #e2f6eb;
  border-radius: 17px;
  font-size: 28px;
}

.lp-card h1 {
  margin: 12px 0;
  font-size: 24px;
  text-align: center;
  font-weight: 900;
}

.lp-description {
  margin: 0 0 22px;
  color: #728894;
  text-align: center;
  font-size: 13px;
  line-height: 1.8;
}

.lp-card form {
  margin-top: 22px;
}

.lp-card label {
  display: block;
  margin: 17px 0 9px;
  color: #3b5360;
  font-size: 12px;
  font-weight: 800;
}

.lp-card input {
  display: block;
  width: 100%;
  min-height: 49px;

  padding: 13px;

  border: 1px solid #d6e3e8;
  border-radius: 10px;

  background: #fff;
  color: #183442;
  font-size: 14px;
}

.lp-card input:focus-visible {
  outline: 2px solid #80d4ae;
  border-color: #07966c;
}

.lp-primary {
  display: block;
  width: 100%;
  min-height: 49px;

  margin-top: 21px;
  padding: 14px;

  border: 0;
  border-radius: 10px;

  background: #078b61;
  color: #fff;

  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.lp-primary:hover {
  background: #087452;
}

.lp-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.lp-email-box {
  display: grid;
  gap: 7px;

  padding: 14px;
  border: 1px solid #ccebd9;
  border-radius: 11px;

  background: #ecf9f1;
  text-align: center;
}

.lp-email-box span {
  color: #688477;
  font-size: 11px;
}

.lp-email-box strong {
  color: #087957;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.lp-info {
  margin-top: 18px;
  padding: 16px;

  background: #f4faf6;
  border: 1px solid #dcece2;
  border-radius: 12px;

  color: #3e5b50;
  font-size: 12px;
  line-height: 1.75;
}

.lp-info > strong {
  display: block;
  margin-bottom: 9px;
  color: #17694f;
}

.lp-info ol {
  margin: 8px 0 0;
  padding-left: 22px;
}

.lp-info li {
  padding: 4px 0;
}

.lp-info p {
  margin: 8px 0;
}

.lp-help-toggle {
  display: block;
  margin: 16px auto 0;
  padding: 10px;

  border: 0;
  background: transparent;

  color: #087b58;
  font-size: 12px;
  font-weight: 800;

  cursor: pointer;
}

.lp-error {
  margin-top: 14px;
  padding: 12px;

  border: 1px solid #fecaca;
  border-radius: 9px;

  background: #fff1f1;
  color: #b91c1c;

  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.lp-small {
  margin: 13px 0 0;
  color: #8a9aa3;
  text-align: center;
  font-size: 11px;
  line-height: 1.6;
}

.lp-back {
  display: block;
  width: 100%;

  margin-top: 20px;
  padding: 8px;

  border: 0;
  background: transparent;

  color: #087c58;
  font-size: 12px;
  font-weight: 800;

  cursor: pointer;
}

.lp-footer {
  margin-top: 26px;
  padding-top: 18px;

  border-top: 1px solid #edf1f3;

  color: #9baab2;
  text-align: center;
  font-size: 10px;
  line-height: 1.8;
}

@media (max-width: 480px) {
  .lp-card {
    padding: 26px 20px;
  }

  .lp-card h1 {
    font-size: 22px;
  }

  .lp-brand {
    font-size: 24px;
  }
}
`;
