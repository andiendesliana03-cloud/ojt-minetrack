
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// RESET PASSWORD — RECOVERY FIX
//
// Mendukung:
// - Supabase PKCE code
// - Supabase token_hash recovery
// - Supabase implicit recovery session
// - PASSWORD_RECOVERY event
//
// Password minimal 12 karakter.
// Database dan role pengguna tidak diubah.
// ======================================================

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

  const verificationRef = useRef(null);

  useEffect(() => {
    let active = true;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    const hash = new URLSearchParams(
      url.hash.replace(/^#/, "")
    );

    const tokenHash = params.get("token_hash");
    const code = params.get("code");
    const type = params.get("type");

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    const linkError =
      params.get("error_description") ||
      hash.get("error_description") ||
      params.get("error") ||
      hash.get("error");

    const hasImplicitRecovery =
      Boolean(accessToken && refreshToken) &&
      hash.get("type") === "recovery";

    const hasRecoveryLink = Boolean(
      tokenHash ||
      code ||
      hasImplicitRecovery
    );

    let recoveredByEvent = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;

        if (
          event === "PASSWORD_RECOVERY" &&
          session?.user
        ) {
          recoveredByEvent = true;
          setAuthorized(true);
          setChecking(false);
          setError("");
        }
      }
    );

    async function verifyRecoveryLink() {
      if (linkError) {
        throw new Error(
          "Tautan reset ditolak atau kedaluwarsa. " +
          "Silakan minta tautan baru."
        );
      }

      if (!hasRecoveryLink) {
        throw new Error(
          "Tautan pemulihan tidak ditemukan. " +
          "Buka tautan terbaru dari email reset password."
        );
      }

      // ==========================================
      // METODE 1 — TOKEN HASH
      // ==========================================

      if (tokenHash) {
        if (type !== "recovery") {
          throw new Error(
            "Jenis tautan pemulihan tidak sesuai."
          );
        }

        const {
          data,
          error: verifyError,
        } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (verifyError) throw verifyError;

        if (!data?.session?.user) {
          throw new Error(
            "Sesi pemulihan tidak terbentuk."
          );
        }

        return data.session;
      }

      // ==========================================
      // METODE 2 — PKCE CODE
      // ==========================================

      if (code) {
        const {
          data,
          error: exchangeError,
        } =
          await supabase.auth.exchangeCodeForSession(
            code
          );

        if (exchangeError) throw exchangeError;

        if (!data?.session?.user) {
          throw new Error(
            "Kode pemulihan tidak menghasilkan sesi."
          );
        }

        return data.session;
      }

      // ==========================================
      // METODE 3 — IMPLICIT RECOVERY
      // ==========================================

      if (hasImplicitRecovery) {
        // Jika Supabase sudah memproses token URL,
        // gunakan sesi hasil pemrosesan tersebut.

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (
          session?.user &&
          session.access_token === accessToken
        ) {
          return session;
        }

        // Jika belum, proses token secara eksplisit.
        const {
          data,
          error: setSessionError,
        } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError) throw setSessionError;

        if (!data?.session?.user) {
          throw new Error(
            "Sesi pemulihan tidak berhasil dibuat."
          );
        }

        return data.session;
      }

      throw new Error(
        "Format tautan pemulihan tidak dikenali."
      );
    }

    // Menghindari verifikasi ganda pada React Strict Mode.
    if (!verificationRef.current) {
      verificationRef.current = verifyRecoveryLink();
    }

    verificationRef.current
      .then((session) => {
        if (!active) return;

        if (!session?.user) {
          throw new Error(
            "Sesi reset password tidak tersedia."
          );
        }

        setAuthorized(true);
        setChecking(false);
        setError("");

        // Token tidak lagi ditampilkan di URL
        // setelah verifikasi berhasil.
        window.history.replaceState(
          {},
          "",
          "/reset-password"
        );
      })
      .catch((err) => {
        if (!active || recoveredByEvent) return;

        setAuthorized(false);
        setChecking(false);

        setError(
          err?.message ||
            "Tautan reset tidak valid atau kedaluwarsa."
        );
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // ====================================================
  // SIMPAN PASSWORD BARU
  // ====================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving || !authorized || success) {
      return;
    }

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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Sesi pemulihan tidak berlaku. " +
          "Silakan minta tautan reset baru."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      setSuccess(true);
      setAuthorized(false);
      setPassword("");
      setConfirmPassword("");

      // Logout setelah berhasil mengganti password.
      // Jika logout gagal, perubahan password
      // tetap dinyatakan berhasil.
      const { error: signOutError } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (signOutError) {
        setError(
          "Password berhasil diubah, tetapi " +
          "logout otomatis gagal. " +
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

  // ====================================================
  // TAMPILAN
  // ====================================================

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
          {success
            ? "✅"
            : checking
            ? "🔐"
            : "🔑"}
        </div>

        {checking ? (
          <>
            <h1>Memverifikasi Tautan</h1>

            <p className="rp-description">
              Memverifikasi tautan dan
              menyiapkan sesi pemulihan password...
            </p>
          </>
        ) : success ? (
          <div role="status">
            <h1>Password Berhasil Diubah</h1>

            <p className="rp-description">
              Password akun OJT MineTrack telah
              diperbarui. Silakan login menggunakan
              password baru.
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
                router.replace("/login")
              }
            >
              Kembali ke Login
            </button>
          </div>
        ) : !authorized ? (
          <>
            <h1>Tautan Tidak Valid</h1>

            <p className="rp-description">
              Tautan pemulihan tidak tersedia,
              sudah kedaluwarsa, atau tidak
              berhasil diverifikasi.
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
              Tautan berhasil diverifikasi.
              Masukkan password baru
              untuk akun OJT MineTrack.
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="new-password">
                Password Baru
              </label>

              <input
                id="new-password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
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
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                required
                minLength={12}
                autoComplete="new-password"
                disabled={saving}
                placeholder="Ulangi password baru"
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
              />

              <label className="rp-show">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) =>
                    setShowPassword(
                      event.target.checked
                    )
                  }
                />

                <span>
                  Tampilkan Password
                </span>
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
            onClick={() =>
              router.push("/login")
            }
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

// ======================================================
// CSS — DESAIN OJT MINETRACK
// ======================================================

const css = `
* {
  box-sizing: border-box;
}

.rp-page {
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
  background: white;
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

@media (max-width: 480px) {
  .rp-card {
    padding: 26px 20px;
  }
}
`;
