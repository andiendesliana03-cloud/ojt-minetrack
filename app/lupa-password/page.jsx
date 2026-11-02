
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // STATUS:
  // checking = memverifikasi tautan
  // ready = boleh mengganti password
  // request = meminta tautan baru
  // invalid = tautan tidak berlaku
  // sent = email pemulihan sudah diminta
  // success = password berhasil diganti

  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams(
      window.location.search
    );

    const hash = new URLSearchParams(
      window.location.hash.replace(/^#/, "")
    );

    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const code = params.get("code");

    const errorFromUrl =
      params.get("error_description") ||
      hash.get("error_description");

    const hasRecoveryHash =
      Boolean(hash.get("access_token")) &&
      hash.get("type") === "recovery";

    const hasRecoveryLink =
      Boolean(tokenHash || code || hasRecoveryHash);

    const { data: listener } =
      supabase.auth.onAuthStateChange((event) => {
        if (!alive) return;

        if (event === "PASSWORD_RECOVERY") {
          setError("");
          setStatus("ready");
        }
      });

    async function verifyRecovery() {
      try {
        if (errorFromUrl) {
          throw new Error(
            decodeURIComponent(
              errorFromUrl.replace(/\+/g, " ")
            )
          );
        }

        if (tokenHash) {
          if (type !== "recovery") {
            throw new Error(
              "Jenis tautan pemulihan tidak valid."
            );
          }

          const { error: verifyError } =
            await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "recovery",
            });

          if (verifyError) throw verifyError;

          if (!alive) return;

          window.history.replaceState(
            {},
            "",
            "/reset-password"
          );

          setStatus("ready");
          return;
        }

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          if (exchangeError) throw exchangeError;

          if (!alive) return;

          window.history.replaceState(
            {},
            "",
            "/reset-password"
          );

          setStatus("ready");
          return;
        }

        // Supabase dapat mengirim token melalui URL hash.
        // Supabase client memproses token ini ketika
        // detectSessionInUrl diaktifkan.

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!alive) return;

        if (session?.user) {
          window.history.replaceState(
            {},
            "",
            "/reset-password"
          );

          setStatus("ready");
          return;
        }

        if (hasRecoveryLink) {
          throw new Error(
            "Sesi pemulihan tidak berhasil diverifikasi."
          );
        }

        setStatus("request");
      } catch (err) {
        if (!alive) return;

        setError(
          err?.message ||
            "Tautan pemulihan tidak valid atau kedaluwarsa."
        );

        setStatus("invalid");
      }
    }

    verifyRecovery();

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function requestReset(event) {
    event.preventDefault();

    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Masukkan alamat email terlebih dahulu.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const { error: requestError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          { redirectTo }
        );

      if (requestError) throw requestError;

      setStatus("sent");
      setMessage(
        "Jika email terdaftar, tautan pemulihan akan dikirim. Periksa Inbox dan Spam."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal mengirim permintaan reset password."
      );
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event) {
    event.preventDefault();

    if (busy || status !== "ready") return;

    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Konfirmasi password tidak sama."
      );
      return;
    }

    setBusy(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.user) {
        setStatus("invalid");
        throw new Error(
          "Sesi pemulihan telah berakhir. Minta tautan baru."
        );
      }

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        });

      if (updateError) throw updateError;

      setPassword("");
      setConfirmPassword("");

      setStatus("success");
      setMessage(
        "Password berhasil diperbarui. Silakan login menggunakan password baru."
      );

      // Keluar dari sesi pemulihan di perangkat ini.
      try {
        await supabase.auth.signOut({
          scope: "local",
        });
      } catch {
        // Password sudah tersimpan.
      }
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memperbarui password."
      );
    } finally {
      setBusy(false);
    }
  }

  function openRequestForm() {
    setError("");
    setMessage("");
    setStatus("request");

    window.history.replaceState(
      {},
      "",
      "/reset-password"
    );
  }

  return (
    <main className="rp-root">
      <style>{css}</style>

      <section className="rp-card">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <p className="rp-subtitle">
          EMERGENCY RESPONSE GROUP
          <br />
          PT BERAU COAL
        </p>

        {status === "checking" && (
          <div className="rp-center">
            <div className="rp-icon">🔐</div>
            <h1>Memverifikasi Tautan</h1>
            <p>
              Sistem sedang memeriksa sesi
              pemulihan password.
            </p>
          </div>
        )}

        {status === "invalid" && (
          <div className="rp-center">
            <div className="rp-icon">🔑</div>
            <h1>Tautan Tidak Valid</h1>
            <p>
              Tautan pemulihan telah kedaluwarsa,
              pernah digunakan, atau tidak dapat
              diverifikasi.
            </p>
          </div>
        )}

        {status === "request" && (
          <>
            <div className="rp-center">
              <div className="rp-icon">✉️</div>
              <h1>Lupa Password?</h1>
              <p>
                Masukkan email akun OJT MineTrack
                untuk menerima tautan pemulihan.
              </p>
            </div>

            <form
              className="rp-form"
              onSubmit={requestReset}
            >
              <label htmlFor="rp-email">
                Email Akun
              </label>

              <input
                id="rp-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Masukkan email terdaftar"
                autoComplete="email"
                required
              />

              <button
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Mengirim..."
                  : "Kirim Link Reset Password"}
              </button>
            </form>
          </>
        )}

        {status === "ready" && (
          <>
            <div className="rp-center">
              <div className="rp-icon">🔒</div>
              <h1>Buat Password Baru</h1>
              <p>
                Tautan berhasil diverifikasi.
                Silakan masukkan password baru.
              </p>
            </div>

            <form
              className="rp-form"
              onSubmit={savePassword}
            >
              <label htmlFor="rp-password">
                Password Baru
              </label>

              <div className="rp-password-wrap">
                <input
                  id="rp-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter"
                  required
                />

                <button
                  type="button"
                  className="rp-eye"
                  onClick={() =>
                    setShowPassword((old) => !old)
                  }
                >
                  {showPassword ? "Tutup" : "Lihat"}
                </button>
              </div>

              <label htmlFor="rp-confirm">
                Konfirmasi Password Baru
              </label>

              <input
                id="rp-confirm"
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
                minLength={8}
                autoComplete="new-password"
                placeholder="Ulangi password baru"
                required
              />

              <button
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Menyimpan..."
                  : "Simpan Password Baru"}
              </button>
            </form>
          </>
        )}

        {status === "sent" && (
          <div className="rp-center">
            <div className="rp-icon">📩</div>
            <h1>Periksa Email</h1>
            <p>
              Jika akun terdaftar, email pemulihan
              akan dikirim. Gunakan tautan terbaru
              dan jangan bagikan kepada orang lain.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="rp-center">
            <div className="rp-icon">✅</div>
            <h1>Password Berhasil Diubah</h1>
            <p>
              Silakan login kembali dengan
              password yang baru.
            </p>
          </div>
        )}

        {error && (
          <div className="rp-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div
            className="rp-alert success"
            role="status"
          >
            {message}
          </div>
        )}

        {status === "invalid" && (
          <button
            type="button"
            className="rp-main-button"
            onClick={openRequestForm}
          >
            Minta Link Reset Baru
          </button>
        )}

        {status === "sent" && (
          <button
            type="button"
            className="rp-secondary"
            onClick={openRequestForm}
          >
            Kirim Ulang Permintaan
          </button>
        )}

        {status === "success" && (
          <button
            type="button"
            className="rp-main-button"
            onClick={() =>
              router.replace("/login")
            }
          >
            Login Sekarang
          </button>
        )}

        <button
          type="button"
          className="rp-back"
          onClick={() =>
            router.push("/login")
          }
        >
          ← Kembali ke Login
        </button>

        <footer className="rp-footer">
          OJT MineTrack v2.0
          <br />
          Emergency Response Group · PT Berau Coal
        </footer>
      </section>
    </main>
  );
}

const css = `
* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.rp-root {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  font-family: Arial, Helvetica, sans-serif;
  color: #203845;
  background:
    linear-gradient(
      rgba(0, 36, 40, .85),
      rgba(0, 61, 55, .83)
    ),
    url("/background-erg.png.PNG")
      center / cover no-repeat;
}

.rp-card {
  width: 100%;
  max-width: 450px;
  padding: 35px 30px;
  border-radius: 20px;
  background: white;
  box-shadow: 0 16px 50px #001e2840;
}

.rp-brand {
  text-align: center;
  color: #233946;
  font-size: 27px;
  font-weight: 900;
}

.rp-brand span {
  color: #078d65;
}

.rp-brand small {
  margin-left: 5px;
  color: #8498a1;
  font-size: 10px;
}

.rp-subtitle {
  text-align: center;
  margin: 12px 0 32px;
  color: #92a0a8;
  font-size: 10px;
  letter-spacing: 1px;
  line-height: 1.8;
}

.rp-center {
  text-align: center;
}

.rp-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  margin: 0 auto 19px;
  border-radius: 20px;
  background: #e5f7ed;
  font-size: 30px;
}

.rp-center h1 {
  margin: 0 0 13px;
  font-size: 24px;
  color: #203845;
}

.rp-center p {
  margin: 0 0 22px;
  color: #80909a;
  font-size: 13px;
  line-height: 1.8;
}

.rp-form {
  display: grid;
  gap: 13px;
}

.rp-form label {
  color: #334d59;
  font-size: 12px;
  font-weight: 800;
}

.rp-form input {
  display: block;
  width: 100%;
  min-height: 47px;
  padding: 13px;
  border: 1px solid #dce5e8;
  border-radius: 10px;
  background: white;
  color: #203845;
  font-size: 14px;
}

.rp-form input:focus {
  outline: 2px solid #9ddbc4;
}

.rp-password-wrap {
  position: relative;
}

.rp-password-wrap input {
  padding-right: 78px;
}

.rp-eye {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 11px;
  border: none;
  background: transparent;
  color: #087e59;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.rp-form > button,
.rp-main-button {
  width: 100%;
  min-height: 51px;
  margin-top: 8px;
  border: none;
  border-radius: 11px;
  background: #078e65;
  color: white;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.rp-form > button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.rp-secondary {
  width: 100%;
  padding: 14px;
  border: 1px solid #cce6dc;
  border-radius: 10px;
  background: #effaf4;
  color: #078e65;
  font-weight: 800;
  cursor: pointer;
}

.rp-alert {
  margin: 14px 0;
  padding: 13px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.rp-alert.error {
  color: #b91c1c;
  border: 1px solid #fecaca;
  background: #fff1f1;
}

.rp-alert.success {
  color: #087e59;
  border: 1px solid #b9e6ca;
  background: #eaf9ef;
}

.rp-back {
  display: block;
  width: 100%;
  margin: 22px auto 0;
  border: none;
  background: transparent;
  color: #087e59;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.rp-footer {
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid #edf0f2;
  color: #9da9b2;
  text-align: center;
  font-size: 10px;
  line-height: 2;
}

@media (max-width: 480px) {
  .rp-card {
    padding: 29px 20px;
  }

  .rp-brand {
    font-size: 24px;
  }
}
`;
