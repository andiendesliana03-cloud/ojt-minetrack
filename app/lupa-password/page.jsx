
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LupaPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          { redirectTo }
        );

      if (resetError) throw resetError;

      setSent(true);
    } catch (err) {
      setError(
        err?.message ||
          "Permintaan belum dapat diproses. Coba kembali."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="fp-page">
      <style>{css}</style>

      <div className="fp-card">
        <div className="fp-brand">
          <span>OJT </span>
          <strong>MineTrack</strong>
          <small>v2.0</small>
        </div>

        <div className="fp-subbrand">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </div>

        <div className="fp-symbol">🔐</div>

        {!sent ? (
          <>
            <h1>Lupa Password?</h1>

            <p className="fp-description">
              Masukkan email yang terdaftar pada akun
              OJT MineTrack untuk menerima tautan
              pemulihan password.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="recovery-email">
                Email Terdaftar
              </label>

              <input
                id="recovery-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="nama@perusahaan.com"
                value={email}
                disabled={loading}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />

              {error && (
                <div className="fp-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="fp-primary"
                disabled={loading}
              >
                {loading
                  ? "Mengirim Permintaan..."
                  : "Kirim Link Reset Password"}
              </button>
            </form>
          </>
        ) : (
          <div role="status" className="fp-success">
            <h1>Periksa Email Anda</h1>

            <p>
              Jika alamat email tersebut terdaftar,
              tautan pemulihan password akan dikirim.
            </p>

            <p>
              Periksa kotak masuk atau folder Spam.
              Jangan bagikan tautan reset kepada orang lain.
            </p>

            <button
              type="button"
              className="fp-primary"
              onClick={() => setSent(false)}
            >
              Kirim Ulang Permintaan
            </button>
          </div>
        )}

        <button
          type="button"
          className="fp-back"
          onClick={() => router.push("/login")}
        >
          ← Kembali ke Login
        </button>

        <div className="fp-footer">
          OJT MineTrack v2.0
          <br />
          Emergency Response Group · PT Berau Coal
        </div>
      </div>
    </main>
  );
}

const css = `
* {
  box-sizing: border-box;
}

.fp-page {
  min-height: 100vh;
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
      center/cover;
}

.fp-card {
  width: 100%;
  max-width: 440px;
  padding: 35px;
  background: #fff;
  border-radius: 19px;
  color: #17313d;
  box-shadow: 0 20px 60px #031a2740;
}

.fp-brand {
  text-align: center;
  font-size: 27px;
  font-weight: 900;
  letter-spacing: -.7px;
  color: #142c3b;
}

.fp-brand strong {
  color: #09875f;
}

.fp-brand small {
  margin-left: 5px;
  color: #8da0aa;
  font-size: 10px;
}

.fp-subbrand {
  margin-top: 9px;
  text-align: center;
  color: #7b919b;
  font-size: 10px;
  line-height: 1.7;
  letter-spacing: .7px;
}

.fp-symbol {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin: 28px auto 15px;
  background: #e2f6eb;
  border-radius: 17px;
  font-size: 27px;
}

.fp-card h1 {
  margin: 12px 0;
  text-align: center;
  font-size: 24px;
}

.fp-description,
.fp-success p {
  color: #728894;
  font-size: 13px;
  text-align: center;
  line-height: 1.8;
}

.fp-card form {
  margin-top: 24px;
}

.fp-card label {
  display: block;
  margin-bottom: 9px;
  color: #3b5360;
  font-size: 12px;
  font-weight: 800;
}

.fp-card input {
  width: 100%;
  min-height: 49px;
  padding: 13px;
  border: 1px solid #d6e3e8;
  border-radius: 10px;
  background: #fff;
  color: #183442;
  font-size: 14px;
}

.fp-card input:focus {
  outline: 2px solid #80d4ae;
  border-color: #07966c;
}

.fp-primary {
  width: 100%;
  margin-top: 18px;
  padding: 15px;
  border: 0;
  border-radius: 10px;
  background: #078b61;
  color: #fff;
  font-weight: 850;
  font-size: 13px;
  cursor: pointer;
}

.fp-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.fp-back {
  display: block;
  width: 100%;
  margin-top: 19px;
  border: 0;
  background: transparent;
  color: #087c58;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}

.fp-error {
  margin-top: 13px;
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  background: #fff1f1;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
}

.fp-success {
  padding-top: 8px;
}

.fp-footer {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid #edf1f3;
  color: #9baab2;
  text-align: center;
  font-size: 10px;
  line-height: 1.8;
}

@media(max-width:480px) {
  .fp-card {
    padding: 26px 20px;
  }
}
`;
