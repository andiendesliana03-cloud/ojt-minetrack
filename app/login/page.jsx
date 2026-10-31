
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// LOGIN ADMIN / MENTOR / PESERTA
// CORPORATE MINING + LUPA PASSWORD
// ======================================================

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getDestination(role) {
  const value = normalize(role);

  if (value === "admin" || value === "mentor") {
    return "/";
  }

  if (value === "participant" || value === "peserta") {
    return "/dashboard-peserta";
  }

  return null;
}

function Icon({ name, size = 19 }) {
  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M3 3 21 21" />
        <path d="M10.6 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-4 4.4" />
        <path d="M6.1 6.1A16 16 0 0 0 2 12s4 7 10 7c1.6 0 3.1-.5 4.4-1.2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    arrow: (
      <path d="M5 12h14m-6-6 6 6-6 6" />
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 17h.01" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
    chart: (
      <path d="M5 20v-7M11 20V5M17 20v-11M22 20V3" />
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="5" />
        <path d="m11.5 11.5 9-9M16 7l3 3M18 5l3 3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);

  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ====================================================
  // VALIDASI ROLE DAN MAINTENANCE
  // ====================================================

  async function resolveAccess(user) {
    if (!user?.id) {
      throw new Error("Sesi pengguna tidak ditemukan.");
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
      throw new Error(
        `Gagal membaca profil: ${profileError.message}`
      );
    }

    if (!profile) {
      throw new Error(
        "Profil pengguna belum tersedia. Hubungi Administrator."
      );
    }

    const role = normalize(profile.role);
    const destination = getDestination(role);

    if (!destination) {
      throw new Error(
        "Akun belum memiliki peran yang diizinkan."
      );
    }

    // Konsisten dengan Maintenance Mode Dashboard.
    const { data: settings, error: settingsError } =
      await supabase
        .from("app_settings")
        .select("maintenance_mode")
        .eq("id", 1)
        .maybeSingle();

    if (settingsError) {
      throw new Error(
        "Gagal memeriksa status sistem. " +
        settingsError.message
      );
    }

    if (
      typeof settings?.maintenance_mode !== "boolean"
    ) {
      throw new Error(
        "Konfigurasi Maintenance Mode belum tersedia."
      );
    }

    if (settings.maintenance_mode && role !== "admin") {
      throw new Error(
        "OJT MineTrack sedang Maintenance. " +
        "Akses Mentor dan Peserta sementara dinonaktifkan."
      );
    }

    return {
      destination,
      profile,
    };
  }

  // ====================================================
  // CEK SESI LOGIN SEBELUM MENAMPILKAN FORM
  // ====================================================

  useEffect(() => {
    let active = true;

    async function checkExistingSession() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          setChecking(false);
          return;
        }

        // Hindari auto-redirect ketika pengguna sedang
        // membuka tautan pemulihan password.
        const recoveryUrl =
          window.location.hash.includes("type=recovery") ||
          new URLSearchParams(
            window.location.search
          ).has("code");

        if (recoveryUrl) {
          router.replace("/reset-password");
          return;
        }

        const access = await resolveAccess(user);

        if (!active) return;

        router.replace(access.destination);
      } catch {
        if (active) {
          setChecking(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  // ====================================================
  // LOGIN SUPABASE
  // ====================================================

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setError("Masukkan alamat email yang valid.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (loginError) {
        const loginMessage = normalize(loginError.message);

        if (
          loginMessage.includes("invalid login credentials") ||
          loginMessage.includes("invalid credentials")
        ) {
          throw new Error(
            "Email atau password salah. " +
            "Silakan periksa kembali."
          );
        }

        if (loginMessage.includes("email not confirmed")) {
          throw new Error(
            "Email akun belum diverifikasi. " +
            "Hubungi Administrator."
          );
        }

        throw loginError;
      }

      if (!data?.user) {
        throw new Error(
          "Login belum menghasilkan sesi pengguna."
        );
      }

      const access = await resolveAccess(data.user);

      // Opsi "Ingat Email" tidak menyimpan password.
      // Email hanya disimpan selama halaman masih terbuka.
      // Tidak digunakan sebagai autentikasi tambahan.
      if (!rememberEmail) {
        setPassword("");
      }

      router.replace(access.destination);
      router.refresh();
    } catch (err) {
      const text =
        err?.message || "Gagal login. Silakan coba lagi.";

      // Apabila sesi berhasil dibuat tetapi pengguna
      // tidak mendapat akses, akhiri sesi tersebut.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        await supabase.auth.signOut();
      }

      setError(text);
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="login-loading">
        <style>{css}</style>

        <div>
          <div className="login-loading-logo">
            OJT <span>MineTrack</span>
          </div>
          <p>Memeriksa sesi pengguna...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <style>{css}</style>

      <div className="login-layout">

        {/* ==========================================
            LEFT PANEL — CORPORATE MINING
            ========================================== */}

        <section className="login-visual">
          <div className="login-visual-overlay" />

          <div className="login-visual-content">
            <div className="login-company">
              <span className="login-company-icon">
                <Icon name="shield" size={27} />
              </span>

              <div>
                <strong>EMERGENCY RESPONSE GROUP</strong>
                <small>PT BERAU COAL</small>
              </div>
            </div>

            <div className="login-visual-main">
              <div className="login-eyebrow">
                ON JOB TRAINING MANAGEMENT SYSTEM
              </div>

              <h1>
                OJT <span>MineTrack</span>
              </h1>

              <div className="login-version">
                VERSION 2.0
              </div>

              <p>
                Sistem monitoring dan evaluasi
                On Job Training untuk mendukung
                pengembangan kompetensi,
                keselamatan, dan kesiapan
                operasional personel.
              </p>

              <div className="login-values">
                <div>
                  <Icon name="shield" size={20} />
                  <span>Safe People</span>
                </div>

                <div>
                  <Icon name="chart" size={20} />
                  <span>Safe Operation</span>
                </div>

                <div>
                  <Icon name="users" size={20} />
                  <span>Sustainable Mining</span>
                </div>
              </div>
            </div>

            <div className="login-visual-footer">
              OJT Program 2026–2027 · PT Berau Coal
            </div>
          </div>
        </section>

        {/* ==========================================
            RIGHT PANEL — LOGIN FORM
            ========================================== */}

        <section className="login-form-area">
          <div className="login-form-container">

            <div className="login-mobile-brand">
              OJT <span>MineTrack</span>
              <small>v2.0</small>
            </div>

            <div className="login-form-heading">
              <div className="login-welcome-badge">
                <Icon name="shield" size={16} />
                SECURE ACCESS
              </div>

              <h2>Selamat Datang</h2>

              <p>
                Silakan login menggunakan email
                dan password akun OJT MineTrack Anda.
              </p>
            </div>

            <form onSubmit={handleLogin}>

              {/* EMAIL */}

              <div className="login-field">
                <label htmlFor="login-email">
                  Email Pengguna
                </label>

                <div className="login-input-wrapper">
                  <Icon name="mail" size={20} />

                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="username"
                    maxLength={254}
                    placeholder="Masukkan email terdaftar"
                    value={email}
                    disabled={loading}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                  />
                </div>
              </div>

              {/* PASSWORD */}

              <div className="login-field">
                <label htmlFor="login-password">
                  Password
                </label>

                <div className="login-input-wrapper">
                  <Icon name="lock" size={20} />

                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    value={password}
                    disabled={loading}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                    }}
                  />

                  <button
                    type="button"
                    className="login-toggle-password"
                    onClick={() =>
                      setShowPassword((value) => !value)
                    }
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  >
                    <Icon
                      name={showPassword ? "eyeOff" : "eye"}
                      size={19}
                    />
                  </button>
                </div>
              </div>

              {/* REMEMBER + LUPA PASSWORD */}

              <div className="login-options">
                <label className="login-remember">
                  <input
                    type="checkbox"
                    checked={rememberEmail}
                    disabled={loading}
                    onChange={(event) =>
                      setRememberEmail(event.target.checked)
                    }
                  />
                  <span>Ingat Email</span>
                </label>

                <button
                  type="button"
                  className="login-forgot"
                  disabled={loading}
                  onClick={() =>
                    router.push("/lupa-password")
                  }
                >
                  Lupa Password?
                </button>
              </div>

              {/* ERROR */}

              {error && (
                <div
                  className="login-error"
                  role="alert"
                >
                  <Icon name="alert" size={19} />
                  <span>{error}</span>
                </div>
              )}

              {/* SUBMIT */}

              <button
                type="submit"
                className="login-submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? "Memverifikasi Akun..."
                    : "Masuk ke OJT MineTrack"}
                </span>

                {!loading && (
                  <Icon name="arrow" size={19} />
                )}
              </button>
            </form>

            {/* ACCESS INFORMATION */}

            <div className="login-access-info">
              <div className="login-access-icon">
                <Icon name="shield" size={21} />
              </div>

              <div>
                <strong>Akses Berdasarkan Peran</strong>
                <p>
                  Sistem mengarahkan Administrator,
                  Mentor, dan Peserta ke dashboard
                  sesuai hak akses akun.
                </p>
              </div>
            </div>

            <div className="login-help">
              <span>Kesulitan mengakses akun?</span>

              <button
                type="button"
                onClick={() =>
                  router.push("/lupa-password")
                }
              >
                Reset password melalui email
              </button>
            </div>
          </div>

          <footer className="login-form-footer">
            © 2026 OJT MineTrack v2.0
            <br />
            Emergency Response Group · PT Berau Coal
          </footer>
        </section>
      </div>
    </main>
  );
}

// ======================================================
// CORPORATE MINING LOGIN CSS
// ======================================================

const css = `
* {
  box-sizing: border-box;
}

.login-page {
  min-height: 100vh;
  background: #f5f8f9;
  color: #17333f;
  font-family: Arial, Helvetica, sans-serif;
}

.login-page button,
.login-page input {
  font-family: inherit;
}

.login-page button {
  cursor: pointer;
}

.login-page button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.login-page button:focus-visible,
.login-page input:focus-visible {
  outline: 3px solid #74cfae;
  outline-offset: 2px;
}

/* ==========================================
   PAGE LAYOUT
   ========================================== */

.login-layout {
  display: grid;
  grid-template-columns:
    minmax(0,1.12fr)
    minmax(430px,.88fr);
  min-height: 100vh;
}

/* ==========================================
   LEFT PANEL
   ========================================== */

.login-visual {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background:
    linear-gradient(
      115deg,
      rgba(3,22,32,.95),
      rgba(5,43,48,.8) 58%,
      rgba(4,55,45,.62)
    ),
    url("/background-erg.png.PNG")
      center/cover;
}

.login-visual-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(
      circle at 20% 20%,
      #14b88a20,
      transparent 48%
    ),
    linear-gradient(
      180deg,
      #04192515,
      #031a23aa
    );
}

.login-visual-content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 46px 55px 34px;
  color: white;
}

/* COMPANY BRAND */

.login-company {
  display: flex;
  align-items: center;
  gap: 13px;
}

.login-company-icon {
  display: grid;
  place-items: center;
  width: 47px;
  height: 47px;
  border: 1px solid #ffffff45;
  border-radius: 12px;
  background: #ffffff16;
  color: #78e5b9;
}

.login-company strong,
.login-company small {
  display: block;
}

.login-company strong {
  font-size: 12px;
  letter-spacing: 1.1px;
}

.login-company small {
  margin-top: 6px;
  color: #bddecf;
  font-size: 11px;
  letter-spacing: 1px;
}

/* HEADLINE */

.login-visual-main {
  max-width: 650px;
  padding: 60px 0;
}

.login-eyebrow {
  color: #eccb88;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1.7px;
}

.login-visual-main h1 {
  margin: 18px 0 0;
  font-size: clamp(43px,5.3vw,78px);
  line-height: 1.1;
  letter-spacing: -2px;
  font-weight: 900;
}

.login-visual-main h1 span {
  color: #48d7a2;
}

.login-version {
  display: inline-block;
  margin-top: 18px;
  padding: 8px 12px;
  border: 1px solid #ffffff40;
  border-radius: 7px;
  color: #e0f4eb;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  background: #ffffff12;
}

.login-visual-main > p {
  max-width: 540px;
  margin-top: 26px;
  color: #d8e8e4;
  font-size: 16px;
  line-height: 1.85;
}

/* VALUES */

.login-values {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 31px;
}

.login-values > div {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px;
  border: 1px solid #ffffff35;
  border-radius: 10px;
  background: #ffffff13;
  color: #e5f5ef;
  font-size: 12px;
  font-weight: 750;
}

.login-values svg {
  color: #eccb88;
}

.login-visual-footer {
  padding-top: 22px;
  border-top: 1px solid #ffffff36;
  color: #bad5ce;
  font-size: 11px;
}

/* ==========================================
   RIGHT FORM PANEL
   ========================================== */

.login-form-area {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-width: 0;
  min-height: 100vh;
  padding: 48px 35px 22px;
  background: #fff;
}

.login-form-container {
  width: 100%;
  max-width: 440px;
  margin: auto 0;
}

.login-mobile-brand {
  display: none;
}

.login-form-heading {
  margin-bottom: 35px;
}

.login-welcome-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 11px;
  border-radius: 8px;
  background: #e8f8ef;
  color: #087e59;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
}

.login-form-heading h2 {
  margin: 19px 0 11px;
  color: #152e3b;
  font-size: 35px;
  font-weight: 900;
  letter-spacing: -.8px;
}

.login-form-heading p {
  margin: 0;
  color: #8195a1;
  font-size: 13px;
  line-height: 1.85;
}

/* FORM FIELDS */

.login-field {
  margin-bottom: 22px;
}

.login-field > label {
  display: block;
  margin-bottom: 10px;
  color: #38505d;
  font-size: 12px;
  font-weight: 850;
}

.login-input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 15px;
  border: 1px solid #dce7eb;
  border-radius: 11px;
  background: #f9fbfc;
  color: #7b929e;
  transition:
    border-color .15s ease,
    box-shadow .15s ease;
}

.login-input-wrapper:focus-within {
  border-color: #0a966b;
  box-shadow: 0 0 0 3px #0a966b15;
  background: white;
}

.login-input-wrapper > svg {
  flex-shrink: 0;
}

.login-input-wrapper input {
  width: 100%;
  min-width: 0;
  min-height: 49px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #173542;
  font-size: 13px;
}

.login-input-wrapper input::placeholder {
  color: #a2b0b9;
}

.login-toggle-password {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  padding: 6px;
  border: 0;
  background: transparent;
  color: #8496a1;
}

/* LOGIN OPTIONS */

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 3px 0 25px;
}

.login-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6f8592;
  font-size: 12px;
  cursor: pointer;
}

.login-remember input {
  width: 16px;
  height: 16px;
  accent-color: #078b61;
}

.login-forgot {
  padding: 5px 0;
  border: 0;
  background: transparent;
  color: #078b61;
  font-size: 12px;
  font-weight: 850;
}

.login-forgot:hover {
  text-decoration: underline;
}

/* LOGIN BUTTON */

.login-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  min-height: 53px;
  padding: 14px;
  border: 0;
  border-radius: 11px;
  background: linear-gradient(
    90deg,
    #078a61,
    #079f72
  );
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  box-shadow: 0 7px 20px #079f7222;
}

.login-submit:hover:not(:disabled) {
  background: #087b56;
}

/* ERRORS */

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px;
  margin-bottom: 19px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff1f1;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.65;
}

.login-error svg {
  flex-shrink: 0;
}

/* ACCESS INFO */

.login-access-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 17px;
  margin-top: 30px;
  border: 1px solid #d6e8df;
  border-radius: 11px;
  background: #f3faf6;
}

.login-access-icon {
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  border-radius: 9px;
  background: #dbf4e7;
  color: #087c57;
}

.login-access-info strong {
  font-size: 12px;
  color: #257154;
}

.login-access-info p {
  margin: 7px 0 0;
  color: #748e80;
  font-size: 11px;
  line-height: 1.7;
}

.login-help {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 26px;
}

.login-help span {
  color: #8a9ca6;
  font-size: 11px;
}

.login-help button {
  border: 0;
  background: transparent;
  color: #078b61;
  font-size: 12px;
  font-weight: 850;
}

.login-form-footer {
  margin-top: 40px;
  padding-top: 20px;
  color: #a1aeb6;
  text-align: center;
  font-size: 10px;
  line-height: 1.9;
}

/* ==========================================
   LOADING SCREEN
   ========================================== */

.login-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 25px;
  background: #061f29;
  color: white;
  text-align: center;
  font-family: Arial, Helvetica, sans-serif;
}

.login-loading-logo {
  font-size: 30px;
  font-weight: 900;
}

.login-loading-logo span {
  color: #42d59f;
}

.login-loading p {
  margin-top: 16px;
  color: #c1d8d0;
  font-size: 13px;
}

/* ==========================================
   RESPONSIVE
   ========================================== */

@media(max-width:1100px) {
  .login-layout {
    grid-template-columns:
      minmax(0,1fr)
      minmax(400px,1fr);
  }

  .login-visual-content {
    padding: 35px;
  }

  .login-visual-main h1 {
    font-size: 49px;
  }

  .login-visual-main > p {
    font-size: 14px;
  }

  .login-values {
    gap: 8px;
  }

  .login-values > div {
    font-size: 11px;
    padding: 11px;
  }
}

@media(max-width:800px) {
  .login-layout {
    grid-template-columns: 1fr;
  }

  .login-visual {
    display: none;
  }

  .login-form-area {
    min-height: 100vh;
    padding: 34px 20px 22px;
  }

  .login-form-container {
    max-width: 450px;
  }

  .login-mobile-brand {
    display: block;
    margin-bottom: 45px;
    color: #142c3b;
    font-size: 25px;
    font-weight: 900;
  }

  .login-mobile-brand span {
    color: #078b61;
  }

  .login-mobile-brand small {
    margin-left: 6px;
    color: #8a9eaa;
    font-size: 10px;
  }

  .login-form-heading h2 {
    font-size: 30px;
  }
}

@media(max-width:480px) {
  .login-form-area {
    padding: 26px 20px 20px;
  }

  .login-mobile-brand {
    margin-bottom: 32px;
  }

  .login-form-heading {
    margin-bottom: 29px;
  }

  .login-form-heading h2 {
    font-size: 28px;
  }

  .login-options {
    gap: 10px;
  }

  .login-remember,
  .login-forgot {
    font-size: 11px;
  }
}
`;
