
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    // URL recovery dari Supabase dapat berisi token
    // dalam fragment atau kode otorisasi.
    const hash = window.location.hash;
    const params = new URLSearchParams(
      window.location.search
    );

    const recoveryLink =
      hash.includes("type=recovery") ||
      hash.includes("access_token=") ||
      params.has("code") ||
      params.has("token_hash");

    if (
      hash.includes("error=") ||
      params.has("error")
    ) {
      setError(
        "Tautan reset tidak valid atau kedaluwarsa. " +
        "Silakan minta tautan baru."
      );
      setChecking(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (
          event === "PASSWORD_RECOVERY" &&
          session
        ) {
          setAuthorized(true);
          setChecking(false);
          setError("");
        }

        if (
          event === "INITIAL_SESSION" &&
          session &&
          recoveryLink
        ) {
          setAuthorized(true);
          setChecking(false);
        }
      }
    );

    async function checkSession() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!active) return;

        if (sessionError) throw sessionError;

        if (session && recoveryLink) {
          setAuthorized(true);
        } else if (!session) {
          setError(
            "Sesi pemulihan belum tersedia. " +
            "Buka halaman ini dari tautan email reset password."
          );
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memvalidasi tautan reset."
          );
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    checkSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving || !authorized) return;

    if (password.length < 12) {
      setError("Password minimal 12 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      // Mengakhiri sesi setelah password diperbarui.
      // Jika gagal signOut, password tetap berhasil diubah.
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        setError(
          "Password berhasil diperbarui, tetapi sesi " +
          "belum dapat diakhiri otomatis. " +
          "Silakan logout sebelum login kembali."
        );
      }
    } catch (err) {
      setError(
        err?.message ||
        "Gagal memperbarui password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="rp-page">
      <style>{css}</style>

      <div className="rp-card">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="rp-subbrand">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </div>

        <div className="rp-symbol">
          {success ? "✅" : "🔑"}
        </div>

        {checking ? (
          <>
            <h1>Memverifikasi Tautan</h1>
            <p className="rp-description">
              Memeriksa izin pemulihan password...
            </p>
          </>
        ) : success ? (
          <div role="status">
            <h1>Password Berhasil Diubah</h1>
            <p className="rp-description">
              Password akun Anda telah diperbarui.
              Silakan login menggunakan password baru.
            </p>

            {error && (
              <div className="rp-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="rp-primary"
              onClick={() => router.replace("/login")}
            >
              Kembali ke Login
            </button>
          </div>
        ) : !authorized ? (
          <>
            <h1>Tautan Tidak Valid</h1>

            <p className="rp-description">
              Tautan pemulihan tidak tersedia,
              telah kedaluwarsa, atau tidak
              dapat diverifikasi.
            </p>

            {error && (
              <div className="rp-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="button"
              className="rp-primary"
              onClick={() =>
                router.push("/lupa-password")
              }
            >
              Minta Link Reset Baru
            </button>
          </>
        ) : (
          <>
            <h1>Buat Password Baru</h1>

            <p className="rp-description">
              Masukkan password baru untuk
              akun OJT MineTrack Anda.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="new-password">
                Password Baru
              </label>

              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                required
                minLength={12}
                autoComplete="new-password"
                disabled={saving}
                placeholder="Minimal 12 karakter"
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />

              <label htmlFor="confirm-password">
                Konfirmasi Password Baru
              </label>

              <input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                required
                minLength={12}
                autoComplete="new-password"
                disabled={saving}
                placeholder="Ulangi password baru"
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
              />

              <label className="rp-show">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) =>
                    setShowPassword(event.target.checked)
                  }
                />
                <span>Tampilkan Password</span>
              </label>

              {error && (
                <div className="rp-error" role="alert">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="rp-primary"
                disabled={saving}
              >
                {saving
                  ? "Menyimpan Password..."
                  : "Simpan Password Baru"}
              </button>
            </form>
          </>
        )}

        {!success && (
          <button
            type="button"
            className="rp-back"
            onClick={() => router.push("/login")}
          >
            ← Kembali ke Login
          </button>
        )}

        <div className="rp-footer">
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

.rp-page {
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

.rp-card {
  width: 100%;
  max-width: 440px;
  padding: 35px;
  background: white;
  border-radius: 19px;
  color: #17313d;
  box-shadow: 0 20px 60px #031a2740;
}

.rp-brand {
  color: #142c3b;
  font-size: 27px;
  font-weight: 900;
  letter-spacing: -.7px;
  text-align: center;
}

.rp-brand span {
  color: #09875f;
}

.rp-brand small {
  margin-left: 6px;
  color: #8da0aa;
  font-size: 10px;
}

.rp-subbrand {
  margin-top: 9px;
  color: #7b919b;
  text-align: center;
  font-size: 10px;
  letter-spacing: .7px;
  line-height: 1.7;
}

.rp-symbol {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin: 28px auto 15px;
  background: #e2f6eb;
  border-radius: 17px;
  font-size: 27px;
}

.rp-card h1 {
  margin: 12px 0;
  font-size: 24px;
  text-align: center;
}

.rp-description {
  color: #728894;
  text-align: center;
  font-size: 13px;
  line-height: 1.8;
}

.rp-card form {
  margin-top: 23px;
}

.rp-card label {
  display: block;
  margin: 17px 0 9px;
  color: #3b5360;
  font-size: 12px;
  font-weight: 800;
}

.rp-card input:not([type="checkbox"]) {
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

.rp-card input:focus-visible {
  outline: 2px solid #80d4ae;
  border-color: #07966c;
}

.rp-card .rp-show {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
  color: #647b87;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.rp-show input {
  accent-color: #078b61;
}

.rp-primary {
  display: block;
  width: 100%;
  min-height: 49px;
  margin-top: 21px;
  padding: 14px;
  border: 0;
  border-radius: 10px;
  background: #078b61;
  color: white;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.rp-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.rp-error {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  background: #fff1f1;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
}

.rp-back {
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

.rp-footer {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid #edf1f3;
  color: #9baab2;
  text-align: center;
  font-size: 10px;
  line-height: 1.8;
}

@media(max-width:480px) {
  .rp-card {
    padding: 26px 20px;
  }
}
`;
