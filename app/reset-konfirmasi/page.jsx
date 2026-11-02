
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// RESET PASSWORD — LINK EMAIL
//
// ALUR:
// Email -> Konfirmasi -> Verifikasi token
// -> Password baru -> Login
//
// Token diverifikasi langsung pada halaman ini.
// Tidak perlu meneruskan token ke halaman lain.
// =====================================================

export default function ResetKonfirmasiPage() {
  const router = useRouter();

  const [tokenHash, setTokenHash] = useState("");
  const [status, setStatus] = useState("loading");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Status:
  // loading = memeriksa parameter tautan
  // confirm = menunggu tombol Lanjutkan
  // ready = token berhasil diverifikasi
  // invalid = tautan tidak valid
  // success = password berhasil diperbarui

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const token = params.get("token_hash");
    const type = params.get("type");

    if (!token || type !== "recovery") {
      setError(
        "Tautan pemulihan tidak lengkap. " +
        "Silakan meminta tautan reset password baru."
      );
      setStatus("invalid");
      return;
    }

    setTokenHash(token);
    setStatus("confirm");
  }, []);

  // ===================================================
  // VERIFIKASI TOKEN
  // Hanya dijalankan ketika pengguna menekan tombol.
  // ===================================================

  async function handleContinue() {
    if (busy || !tokenHash || status !== "confirm") {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const {
        data,
        error: verifyError,
      } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });

      if (verifyError) {
        throw verifyError;
      }

      if (!data?.session?.user) {
        throw new Error(
          "Sesi pemulihan password tidak terbentuk."
        );
      }

      // Pastikan sesi yang tersimpan milik akun
      // yang diverifikasi dari tautan pemulihan.
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Sesi pengguna tidak berhasil diverifikasi."
        );
      }

      if (user.id !== data.session.user.id) {
        throw new Error(
          "Sesi akun tidak sesuai. " +
          "Silakan minta tautan baru."
        );
      }

      // Token tidak diperlukan lagi setelah
      // verifikasi berhasil.
      window.history.replaceState(
        {},
        "",
        "/reset-konfirmasi"
      );

      setTokenHash("");
      setStatus("ready");
    } catch (err) {
      setError(
        err?.message ||
        "Tautan pemulihan tidak valid atau kedaluwarsa."
      );

      setStatus("invalid");
    } finally {
      setBusy(false);
    }
  }

  // ===================================================
  // SIMPAN PASSWORD BARU
  // ===================================================

  async function handleSavePassword(event) {
    event.preventDefault();

    if (busy || status !== "ready") {
      return;
    }

    if (password.length < 12) {
      setError(
        "Password harus memiliki minimal 12 karakter."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Konfirmasi password tidak cocok."
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "Sesi pemulihan sudah tidak aktif. " +
          "Silakan minta link reset baru."
        );
      }

      const {
        error: updateError,
      } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirmPassword("");
      setStatus("success");

      // Logout hanya dari perangkat ini.
      // Keberhasilan update password tidak
      // bergantung pada keberhasilan logout.
      const {
        error: signOutError,
      } = await supabase.auth.signOut({
        scope: "local",
      });

      if (signOutError) {
        setError(
          "Password berhasil diperbarui, tetapi " +
          "logout otomatis gagal. " +
          "Silakan logout sebelum login kembali."
        );
      }
    } catch (err) {
      setError(
        err?.message ||
        "Gagal menyimpan password baru."
      );
    } finally {
      setBusy(false);
    }
  }

  function requestNewLink() {
    router.push("/lupa-password");
  }

  return (
    <main className="rc-page">
      <style>{css}</style>

      <section className="rc-card">
        {/* BRAND */}

        <div className="rc-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="rc-subtitle">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </div>

        {/* LOADING */}

        {status === "loading" && (
          <div className="rc-content">
            <div className="rc-icon">
              🔐
            </div>

            <h1>Memeriksa Tautan</h1>

            <p>
              Memeriksa informasi pemulihan
              password dari email...
            </p>
          </div>
        )}

        {/* KONFIRMASI */}

        {status === "confirm" && (
          <div className="rc-content">
            <div className="rc-icon">
              🔑
            </div>

            <h1>Konfirmasi Reset Password</h1>

            <p>
              Tautan pemulihan telah diterima.
            </p>

            <p>
              Klik tombol di bawah untuk
              memverifikasi permintaan dan
              melanjutkan penggantian password.
            </p>

            <button
              type="button"
              className="rc-primary"
              onClick={handleContinue}
              disabled={busy}
            >
              {busy
                ? "Memverifikasi..."
                : "Lanjutkan Reset Password"}
            </button>
          </div>
        )}

        {/* FORM PASSWORD BARU */}

        {status === "ready" && (
          <div className="rc-content">
            <div className="rc-icon">
              🔒
            </div>

            <h1>Buat Password Baru</h1>

            <p>
              Tautan berhasil diverifikasi.
              Silakan buat password baru untuk
              akun OJT MineTrack.
            </p>

            <form
              className="rc-form"
              onSubmit={handleSavePassword}
            >
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
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
                minLength={12}
                disabled={busy}
                required
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
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                minLength={12}
                disabled={busy}
                required
              />

              <label className="rc-show">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) =>
                    setShowPassword(
                      event.target.checked
                    )
                  }
                />

                <span>Tampilkan Password</span>
              </label>

              <button
                className="rc-primary"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Menyimpan Password..."
                  : "Simpan Password Baru"}
              </button>
            </form>
          </div>
        )}

        {/* LINK ERROR */}

        {status === "invalid" && (
          <div className="rc-content">
            <div className="rc-icon">
              ⚠️
            </div>

            <h1>Tautan Tidak Valid</h1>

            <p>
              Tautan pemulihan tidak dapat
              digunakan atau sudah kedaluwarsa.
            </p>

            <button
              type="button"
              className="rc-primary"
              onClick={requestNewLink}
            >
              Minta Link Reset Baru
            </button>
          </div>
        )}

        {/* SUCCESS */}

        {status === "success" && (
          <div
            className="rc-content"
            role="status"
          >
            <div className="rc-icon">
              ✅
            </div>

            <h1>Password Berhasil Diubah</h1>

            <p>
              Password akun OJT MineTrack
              berhasil diperbarui.
            </p>

            <p>
              Silakan login kembali
              menggunakan password baru.
            </p>

            <button
              type="button"
              className="rc-primary"
              onClick={() =>
                router.replace("/login")
              }
            >
              Kembali ke Login
            </button>
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            className="rc-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* BACK */}

        {status !== "success" && (
          <button
            type="button"
            className="rc-back"
            onClick={() =>
              router.push("/login")
            }
          >
            ← Kembali ke Login
          </button>
        )}

        {/* FOOTER */}

        <footer className="rc-footer">
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

// =====================================================
// CSS — OJT MINETRACK V2.0
// =====================================================

const css = `
* {
  box-sizing: border-box;
}

.rc-page {
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
      center/cover no-repeat;
}

.rc-card {
  width: 100%;
  max-width: 440px;
  padding: 35px 28px;
  background: white;
  border-radius: 19px;
  color: #17313d;
  box-shadow: 0 20px 60px #031a2740;
}

.rc-brand {
  text-align: center;
  font-size: 27px;
  font-weight: 900;
  color: #142c3b;
}

.rc-brand span {
  color: #09875f;
}

.rc-brand small {
  font-size: 10px;
  color: #8da0aa;
  margin-left: 5px;
}

.rc-subtitle {
  margin-top: 10px;
  text-align: center;
  color: #82969d;
  font-size: 10px;
  letter-spacing: .7px;
  line-height: 1.7;
}

.rc-content {
  margin-top: 30px;
  text-align: center;
}

.rc-icon {
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  margin: 0 auto 20px;
  background: #e2f6eb;
  border-radius: 17px;
  font-size: 28px;
}

.rc-content h1 {
  margin: 12px 0 15px;
  color: #17313d;
  font-size: 23px;
  font-weight: 900;
}

.rc-content p {
  margin: 10px 0;
  color: #728894;
  font-size: 13px;
  line-height: 1.8;
}

.rc-form {
  margin-top: 25px;
  text-align: left;
}

.rc-form label:not(.rc-show) {
  display: block;
  margin: 17px 0 9px;
  color: #3b5360;
  font-size: 12px;
  font-weight: 800;
}

.rc-form input:not([type="checkbox"]) {
  display: block;
  width: 100%;
  min-height: 49px;
  padding: 13px;
  border: 1px solid #d6e3e8;
  border-radius: 10px;
  color: #183442;
  background: white;
  font-size: 14px;
}

.rc-form input:focus-visible {
  outline: 2px solid #80d4ae;
  border-color: #07966c;
}

.rc-show {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 16px;
  color: #647b87;
  font-size: 12px;
  cursor: pointer;
}

.rc-show input {
  accent-color: #078b61;
}

.rc-primary {
  display: block;
  width: 100%;
  min-height: 49px;
  margin-top: 22px;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: #078b61;
  color: white;
  font-size: 13px;
  font-weight: 850;
  cursor: pointer;
}

.rc-primary:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.rc-error {
  margin-top: 18px;
  padding: 13px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f1;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.rc-back {
  display: block;
  width: 100%;
  margin: 22px auto 0;
  padding: 9px;
  border: none;
  background: transparent;
  color: #087c58;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.rc-footer {
  margin-top: 27px;
  padding-top: 19px;
  border-top: 1px solid #edf1f3;
  text-align: center;
  color: #9baab2;
  font-size: 10px;
  line-height: 1.8;
}

@media (max-width: 480px) {
  .rc-card {
    padding: 27px 20px;
  }

  .rc-brand {
    font-size: 24px;
  }

  .rc-content h1 {
    font-size: 21px;
  }
}
`;
