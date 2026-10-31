
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// TEMPLATE 1 — MODERN SPLIT LAYOUT
// LOGIN ADMIN / MENTOR / PESERTA
// SUPABASE AUTH + MAINTENANCE + RESET PASSWORD
// ======================================================

const BACKGROUND_IMAGE = "/login-erg.jpg";
const REMEMBER_KEY = "ojt_minetrack_remembered_email";

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

function Icon({ name, size = 20 }) {
  const icons = {
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
        <path d="M3 3l18 18" />
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
    shieldCheck: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V14h4v6M10 20V9h4v11M16 20V4h4v16" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 17h.01" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.check}
    </svg>
  );
}

function FeatureCard({ icon, title }) {
  return (
    <div className="login-feature">
      <div className="login-feature-icon">
        <Icon name={icon} size={23} />
      </div>
      <span>{title}</span>
    </div>
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
  // MEMBACA PROFIL & STATUS MAINTENANCE
  // ====================================================

  async function resolveAccess(user) {
    if (!user?.id) {
      throw new Error("Sesi pengguna tidak ditemukan.");
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
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

    const {
      data: settings,
      error: settingsError,
    } = await supabase
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

    if (
      settings.maintenance_mode &&
      role !== "admin"
    ) {
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
  // INGAT EMAIL
  // HANYA MENYIMPAN EMAIL, BUKAN PASSWORD
  // ====================================================

  useEffect(() => {
    try {
      const savedEmail =
        window.localStorage.getItem(REMEMBER_KEY);

      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // Storage tidak tersedia.
    }
  }, []);

  function persistEmail(cleanEmail) {
    try {
      if (rememberEmail) {
        window.localStorage.setItem(
          REMEMBER_KEY,
          cleanEmail
        );
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      // Tidak menghalangi login.
    }
  }

  function changeRememberEmail(value) {
    setRememberEmail(value);

    if (!value) {
      try {
        window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // Abaikan kesalahan storage.
      }
    }
  }

  // ====================================================
  // CEK SESI SEBELUM LOGIN
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

        const params = new URLSearchParams(
          window.location.search
        );

        const recoveryUrl =
          window.location.hash.includes("type=recovery") ||
          params.has("code");

        if (recoveryUrl) {
          router.replace("/reset-password");
          return;
        }

        const access = await resolveAccess(user);

        if (!active) return;

        router.replace(access.destination);
      } catch {
        if (active) setChecking(false);
      }
    }

    checkExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  // ====================================================
  // LOGIN SUPABASE AUTH
  // ====================================================

  async function handleLogin(event) {
    event.preventDefault();

    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        cleanEmail
      )
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

    let signedIn = false;

    try {
      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (loginError) {
        const loginMessage = normalize(
          loginError.message
        );

        if (
          loginMessage.includes(
            "invalid login credentials"
          ) ||
          loginMessage.includes("invalid credentials")
        ) {
          throw new Error(
            "Email atau password salah. " +
            "Silakan periksa kembali."
          );
        }

        if (
          loginMessage.includes("email not confirmed")
        ) {
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

      signedIn = true;

      const access = await resolveAccess(data.user);

      persistEmail(cleanEmail);
      setPassword("");

      router.replace(access.destination);
      router.refresh();
    } catch (err) {
      if (signedIn) {
        try {
          await supabase.auth.signOut();
        } catch {
          // Status autentikasi tetap ditangani Supabase.
        }
      }

      setError(
        err?.message ||
        "Gagal login. Silakan coba lagi."
      );
      setLoading(false);
    }
  }

  // ====================================================
  // LOADING
  // ====================================================

  if (checking) {
    return (
      <main className="login-loading">
        <style>{css}</style>

        <div className="login-loading-content">
          <div className="login-loading-logo">
            OJT <span>MineTrack</span>
          </div>

          <span className="login-loader" />

          <p>Memeriksa sesi pengguna...</p>
        </div>
      </main>
    );
  }

  // ====================================================
  // UI — TEMPLATE 1
  // ====================================================

  return (
    <main className="login-page">
      <style>{css}</style>

      <div
        className="login-background"
        style={{
          backgroundImage: `url("${BACKGROUND_IMAGE}")`,
        }}
      />

      <div className="login-overlay" />

      <div className="login-container">

        {/* HEADER */}

        <header className="login-header">
          <div className="login-header-brand">
            <div className="login-header-logo">
              <Icon name="shieldCheck" size={24} />
            </div>

            <div>
              <strong>
                EMERGENCY RESPONSE GROUP
              </strong>
              <span>PT BERAU COAL</span>
            </div>
          </div>

          <span className="login-header-version">
            OJT PROGRAM 2026–2027
          </span>
        </header>

        {/* MAIN TWO-COLUMN LAYOUT */}

        <div className="login-main">

          {/* LEFT CONTENT */}

          <section className="login-left">
            <div className="login-eyebrow">
              ON JOB TRAINING MANAGEMENT SYSTEM
            </div>

            <div className="login-heading">
              <div className="login-heading-top">
                <h1>OJT</h1>
                <span className="login-version">
                  VERSION 2.0
                </span>
              </div>

              <div className="login-minetrack">
                MineTrack
              </div>
            </div>

            <p className="login-subtitle">
              Sistem monitoring dan evaluasi On Job Training
              untuk mendukung pengembangan kompetensi,
              keselamatan, dan kesiapan operasional personel.
            </p>

            <div className="login-features">
              <FeatureCard
                icon="shield"
                title="Safe People"
              />

              <FeatureCard
                icon="chart"
                title="Safe Operation"
              />

              <FeatureCard
                icon="users"
                title="Sustainable Mining"
              />
            </div>

            <div className="login-left-footer">
              <div className="login-footer-line" />
              <span>
                EMERGENCY RESPONSE GROUP
                <br />
                PT BERAU COAL
              </span>
            </div>
          </section>

          {/* RIGHT LOGIN CARD */}

          <section className="login-right">
            <div className="login-card">

              <div className="login-card-badge">
                <Icon name="shieldCheck" size={16} />
                SECURE ACCESS
              </div>

              <h2>Selamat Datang</h2>

              <p className="login-card-description">
                Silakan login menggunakan email dan password
                akun OJT MineTrack Anda.
              </p>

              <form onSubmit={handleLogin}>

                {/* EMAIL */}

                <div className="login-field">
                  <label htmlFor="login-email">
                    Email Pengguna
                  </label>

                  <div className="login-input">
                    <Icon name="mail" size={19} />

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

                  <div className="login-input">
                    <Icon name="lock" size={19} />

                    <input
                      id="login-password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
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
                      className="login-eye"
                      disabled={loading}
                      aria-label={
                        showPassword
                          ? "Sembunyikan password"
                          : "Tampilkan password"
                      }
                      onClick={() =>
                        setShowPassword((value) => !value)
                      }
                    >
                      <Icon
                        name={
                          showPassword
                            ? "eyeOff"
                            : "eye"
                        }
                        size={19}
                      />
                    </button>
                  </div>
                </div>

                {/* REMEMBER & FORGOT */}

                <div className="login-options">
                  <label className="login-remember">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      disabled={loading}
                      onChange={(event) =>
                        changeRememberEmail(
                          event.target.checked
                        )
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
                    <Icon name="arrow" size={20} />
                  )}
                </button>
              </form>

              {/* ROLE INFO */}

              <div className="login-access-info">
                <div className="login-access-icon">
                  <Icon
                    name="shieldCheck"
                    size={21}
                  />
                </div>

                <div>
                  <strong>
                    Akses Berdasarkan Peran
                  </strong>

                  <p>
                    Sistem mengarahkan Administrator,
                    Mentor, dan Peserta ke dashboard
                    sesuai hak akses.
                  </p>
                </div>
              </div>

              {/* CARD FOOTER */}

              <div className="login-card-footer">
                <div>
                  © 2026 OJT MineTrack v2.0
                </div>
                <div>
                  Emergency Response Group · PT Berau Coal
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* GLOBAL FOOTER */}

        <footer className="login-global-footer">
          <span>
            OJT Program 2026–2027
          </span>

          <span className="login-footer-separator">
            |
          </span>

          <span>
            PT Berau Coal
          </span>
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// STYLES — TEMPLATE 1
// ======================================================

const css = `
.login-page,
.login-page * {
  box-sizing: border-box;
}

.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  font-family: Arial, Helvetica, sans-serif;
  color: #ffffff;
  background: #071b2d;
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
  outline: 3px solid #72d9b1;
  outline-offset: 3px;
}

/* BACKGROUND */

.login-background {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  z-index: 0;
}

.login-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(
      90deg,
      rgba(4, 20, 35, .92) 0%,
      rgba(5, 29, 43, .83) 31%,
      rgba(5, 32, 47, .43) 61%,
      rgba(6, 24, 39, .47) 100%
    ),
    linear-gradient(
      0deg,
      rgba(2, 14, 26, .88),
      transparent 34%
    );
}

/* PAGE CONTAINER */

.login-container {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 30px clamp(24px,4.5vw,70px) 24px;
}

/* HEADER */

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.login-header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.login-header-logo {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid #69d6ae77;
  border-radius: 12px;
  background: #0b5e5d55;
  color: #69e8bd;
}

.login-header-brand strong,
.login-header-brand span {
  display: block;
}

.login-header-brand strong {
  font-size: 12px;
  letter-spacing: .9px;
}

.login-header-brand span {
  margin-top: 5px;
  font-size: 10px;
  letter-spacing: 1.3px;
  color: #c7dcd8;
}

.login-header-version {
  padding: 9px 12px;
  border: 1px solid #ffffff38;
  border-radius: 8px;
  background: #071a2c55;
  color: #d8e8e6;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .7px;
}

/* MAIN */

.login-main {
  display: grid;
  grid-template-columns:
    minmax(0,1.25fr)
    minmax(350px,.75fr);
  align-items: center;
  gap: clamp(30px,5vw,90px);
  flex: 1;
  padding: 30px 0 50px;
}

/* LEFT */

.login-left {
  min-width: 0;
  max-width: 760px;
}

.login-eyebrow {
  margin-bottom: 20px;
  color: #f0c779;
  font-size: 12px;
  letter-spacing: 2.3px;
  font-weight: 900;
}

.login-heading-top {
  display: flex;
  align-items: center;
  gap: 20px;
}

.login-heading-top h1 {
  margin: 0;
  font-size: clamp(74px,9vw,135px);
  font-weight: 900;
  line-height: .95;
  letter-spacing: -4px;
  color: #fff;
}

.login-version {
  display: inline-flex;
  align-items: center;
  padding: 9px 13px;
  border: 1px solid #55e2b88a;
  border-radius: 9px;
  background: #18a88c28;
  color: #d8fff1;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.login-minetrack {
  margin-top: 4px;
  color: #56e7b9;
  font-size: clamp(57px,7.1vw,110px);
  font-weight: 900;
  line-height: 1.04;
  letter-spacing: -3px;
  overflow-wrap: anywhere;
  text-shadow: 0 5px 20px #00162055;
}

.login-subtitle {
  max-width: 580px;
  margin: 24px 0 30px;
  color: #e0eeed;
  font-size: 16px;
  line-height: 1.85;
  text-shadow: 0 2px 10px #06152366;
}

/* VALUES */

.login-features {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 66px;
  padding: 12px 15px;
  border: 1px solid #ffffff4a;
  border-radius: 12px;
  background: #092536a8;
  backdrop-filter: blur(9px);
  -webkit-backdrop-filter: blur(9px);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

.login-feature-icon {
  color: #75edc5;
}

.login-left-footer {
  margin-top: 48px;
}

.login-footer-line {
  width: 130px;
  height: 3px;
  margin-bottom: 17px;
  border-radius: 10px;
  background: #57e7b8;
}

.login-left-footer span {
  color: #d1e6e3;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.8;
  letter-spacing: 1px;
}

/* LOGIN CARD */

.login-right {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  min-width: 0;
}

.login-card {
  width: 100%;
  max-width: 455px;
  padding: 33px 30px 25px;
  border: 1px solid #ffffff8c;
  border-radius: 17px;
  background: #ffffff;
  color: #17303f;
  box-shadow: 0 25px 70px #05172480;
}

.login-card-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background: #e6f6ef;
  color: #088760;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .9px;
}

.login-card h2 {
  margin: 22px 0 10px;
  color: #152b3c;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -.8px;
}

.login-card-description {
  margin: 0 0 29px;
  color: #728695;
  font-size: 13px;
  line-height: 1.75;
}

/* FORM */

.login-field {
  margin-bottom: 22px;
}

.login-field label {
  display: block;
  margin-bottom: 9px;
  color: #2e4656;
  font-size: 12px;
  font-weight: 850;
}

.login-input {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 50px;
  padding: 0 13px;
  border: 1px solid #d6e3e9;
  border-radius: 9px;
  background: #fafcfd;
  color: #8598a4;
}

.login-input:focus-within {
  background: white;
  border-color: #0a996c;
  box-shadow: 0 0 0 3px #0a996c18;
}

.login-input > svg {
  flex-shrink: 0;
}

.login-input input {
  width: 100%;
  min-width: 0;
  min-height: 49px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #183443;
  font-size: 13px;
}

.login-input input::placeholder {
  color: #a2b1bb;
}

.login-eye {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: 6px;
  border: 0;
  background: transparent;
  color: #8698a5;
}

/* OPTIONS */

.login-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 3px 0 24px;
}

.login-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #657989;
  font-size: 12px;
  cursor: pointer;
}

.login-remember input {
  width: 16px;
  height: 16px;
  accent-color: #088e62;
}

.login-forgot {
  border: 0;
  padding: 4px 0;
  background: transparent;
  color: #087f5d;
  font-size: 12px;
  font-weight: 850;
}

.login-forgot:hover {
  text-decoration: underline;
}

/* SUBMIT */

.login-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 51px;
  padding: 13px;
  border: 0;
  border-radius: 9px;
  background: linear-gradient(
    95deg,
    #07855e,
    #0ec68f
  );
  box-shadow: 0 7px 19px #05966c25;
  color: white;
  font-size: 13px;
  font-weight: 900;
}

.login-submit:hover:not(:disabled) {
  background: #087d59;
}

/* ERROR */

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 18px;
  padding: 13px;
  border: 1px solid #fecaca;
  border-radius: 9px;
  background: #fff1f1;
  color: #b91c1c;
  font-size: 12px;
  line-height: 1.6;
}

.login-error svg {
  flex-shrink: 0;
}

/* ACCESS INFO */

.login-access-info {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-top: 27px;
  padding: 14px;
  border: 1px solid #d9eee5;
  border-radius: 10px;
  background: #effaf5;
}

.login-access-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 35px;
  height: 35px;
  border-radius: 9px;
  background: #dcf4e8;
  color: #08845d;
}

.login-access-info strong {
  font-size: 11px;
  color: #167253;
}

.login-access-info p {
  margin: 6px 0 0;
  color: #6c8b7c;
  font-size: 10px;
  line-height: 1.7;
}

/* FOOTERS */

.login-card-footer {
  margin-top: 24px;
  padding-top: 19px;
  border-top: 1px solid #e9eef1;
  color: #9eacb4;
  font-size: 10px;
  text-align: center;
  line-height: 1.8;
}

.login-global-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #ffffff42;
  color: #d0e1df;
  font-size: 11px;
}

.login-footer-separator {
  color: #79d6b9;
}

/* LOADING */

.login-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 25px;
  background: #061d2b;
  color: white;
  font-family: Arial, Helvetica, sans-serif;
  text-align: center;
}

.login-loading-logo {
  font-size: 31px;
  font-weight: 900;
}

.login-loading-logo span {
  color: #54e5b6;
}

.login-loading p {
  color: #c8dfd8;
  font-size: 13px;
}

.login-loader {
  display: block;
  width: 34px;
  height: 34px;
  margin: 25px auto 18px;
  border: 3px solid #ffffff45;
  border-top-color: #53e3b5;
  border-radius: 50%;
  animation: login-spin .8s linear infinite;
}

@keyframes login-spin {
  to { transform: rotate(360deg); }
}

/* TABLET */

@media(max-width:1100px) {
  .login-main {
    grid-template-columns:
      minmax(0,1fr)
      minmax(340px,.9fr);
    gap: 30px;
  }

  .login-heading-top h1 {
    font-size: 80px;
  }

  .login-minetrack {
    font-size: 64px;
  }

  .login-subtitle {
    font-size: 14px;
  }

  .login-feature {
    padding: 10px;
  }

  .login-card {
    padding: 26px 23px;
  }
}

/* MOBILE */

@media(max-width:800px) {
  .login-container {
    padding: 20px 17px;
  }

  .login-main {
    grid-template-columns: 1fr;
    gap: 25px;
    padding: 35px 0;
  }

  .login-header-version {
    display: none;
  }

  .login-left {
    text-align: center;
    margin: 0 auto;
  }

  .login-eyebrow {
    font-size: 10px;
  }

  .login-heading-top {
    justify-content: center;
  }

  .login-heading-top h1 {
    font-size: 67px;
  }

  .login-minetrack {
    font-size: clamp(48px,10vw,75px);
  }

  .login-subtitle {
    max-width: 500px;
    margin: 16px auto 21px;
    font-size: 13px;
  }

  .login-features {
    justify-content: center;
  }

  .login-feature {
    min-height: 50px;
    padding: 9px 11px;
    font-size: 11px;
  }

  .login-left-footer {
    display: none;
  }

  .login-right {
    justify-content: center;
  }

  .login-card {
    max-width: 490px;
  }

  .login-background {
    background-position: 36% center;
  }

  .login-overlay {
    background:
      linear-gradient(
        180deg,
        #061b2dba,
        #071f35bc 52%,
        #061b2df0
      );
  }

  .login-global-footer {
    justify-content: center;
  }
}

@media(max-width:480px) {
  .login-container {
    padding: 17px 12px;
  }

  .login-header-brand strong {
    font-size: 10px;
  }

  .login-header-brand span {
    font-size: 9px;
  }

  .login-heading-top h1 {
    font-size: 61px;
  }

  .login-minetrack {
    font-size: 49px;
    letter-spacing: -1.5px;
  }

  .login-version {
    padding: 7px 9px;
    font-size: 9px;
  }

  .login-subtitle {
    font-size: 12px;
  }

  .login-features {
    gap: 7px;
  }

  .login-feature {
    flex-direction: column;
    gap: 5px;
    padding: 9px;
    font-size: 9px;
  }

  .login-feature-icon svg {
    width: 19px;
    height: 19px;
  }

  .login-card {
    padding: 24px 19px 20px;
  }

  .login-card h2 {
    font-size: 25px;
  }

  .login-card-description {
    font-size: 12px;
  }

  .login-options {
    gap: 8px;
  }

  .login-remember,
  .login-forgot {
    font-size: 11px;
  }

  .login-global-footer {
    font-size: 10px;
  }
}

@media(prefers-reduced-motion:reduce) {
  .login-loader {
    animation: none;
  }
}
`;
