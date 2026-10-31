
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// LOGIN — MODERN SPLIT LAYOUT
// BACKGROUND ERG + TOMBOL REGISTRASI PESERTA
// SUPABASE AUTH + MAINTENANCE + RESET PASSWORD
// ======================================================

const BACKGROUND_IMAGE = "/background-erg.png.PNG";
const REGISTRATION_PATH = "/daftar";
const REMEMBER_KEY = "ojt_minetrack_remembered_email";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
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
    chart: (
      <path d="M4 20v-6h4v6M10 20V9h4v11M16 20V4h4v16" />
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
      {icons[name] || icons.shield}
    </svg>
  );
}

function FeatureCard({ icon, title }) {
  return (
    <div className="login-feature">
      <Icon name={icon} size={22} />
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
  // PROFIL DAN MAINTENANCE
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

    return { destination, profile };
  }

  // ====================================================
  // INGAT EMAIL
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
      // Local storage tidak tersedia.
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
      // Tidak menghambat login.
    }
  }

  function changeRememberEmail(value) {
    setRememberEmail(value);

    if (!value) {
      try {
        window.localStorage.removeItem(REMEMBER_KEY);
      } catch {
        // Abaikan.
      }
    }
  }

  // ====================================================
  // CEK SESI
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
        const message = normalize(loginError.message);

        if (
          message.includes("invalid login credentials") ||
          message.includes("invalid credentials")
        ) {
          throw new Error(
            "Email atau password salah. " +
              "Silakan periksa kembali."
          );
        }

        if (message.includes("email not confirmed")) {
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
          // Abaikan.
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
  // UI LOGIN
  // ====================================================

  return (
    <main className="login-page">
      <style>{css}</style>

      <div
        className="login-background"
        style={{
          backgroundImage: `url("${BACKGROUND_IMAGE}")`,
        }}
        aria-hidden="true"
      />

      <div
        className="login-overlay"
        aria-hidden="true"
      />

      <div className="login-container">

        {/* HEADER */}

        <header className="login-header">
          <div className="login-header-brand">
            <div className="login-header-logo">
              <Icon name="shield" size={24} />
            </div>

            <div>
              <strong>EMERGENCY RESPONSE GROUP</strong>
              <span>PT BERAU COAL</span>
            </div>
          </div>

          <span className="login-header-version">
            OJT PROGRAM 2026–2027
          </span>
        </header>

        {/* MAIN */}

        <div className="login-main">

          {/* KIRI */}

          <section className="login-left">
            <div className="login-eyebrow">
              ON THE JOB TRAINING MANAGEMENT SYSTEM
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

          {/* KANAN */}

          <section className="login-right">
            <div className="login-card">

              <div className="login-card-badge">
                <Icon name="shield" size={16} />
                SECURE ACCESS
              </div>

              <h2>Selamat Datang</h2>

              <p className="login-card-description">
                Masuk menggunakan email dan password
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

                {/* INGAT EMAIL & LUPA PASSWORD */}

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

                {/* LOGIN */}

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

              {/* DAFTAR PESERTA — NAVIGASI */}

              <div className="login-register">
                <div className="login-divider">
                  <span>ATAU</span>
                </div>

                <p>
                  Belum memiliki akun peserta OJT?
                </p>

                <button
                  type="button"
                  className="login-register-button"
                  disabled={loading}
                  onClick={() =>
                    router.push(REGISTRATION_PATH)
                  }
                >
                  <Icon name="users" size={19} />
                  <span>Daftar sebagai Peserta OJT</span>
                  <Icon name="arrow" size={18} />
                </button>

                <small>
                  Pendaftaran peserta mengikuti
                  proses verifikasi dan persetujuan
                  Mentor atau Administrator.
                </small>
              </div>

              {/* ROLE INFO */}

              <div className="login-access-info">
                <div className="login-access-icon">
                  <Icon name="shield" size={21} />
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

              {/* FOOTER */}

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

        <footer className="login-global-footer">
          <span>OJT Program 2026–2027</span>
          <span>|</span>
          <span>PT Berau Coal</span>
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// CSS — MODERN SPLIT LAYOUT
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
  color: white;
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
  z-index: 0;

  background-color: #102f45;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
}

.login-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;

  background:
    linear-gradient(
      90deg,
      rgba(4,20,35,.79) 0%,
      rgba(5,29,43,.66) 32%,
      rgba(5,32,47,.28) 65%,
      rgba(6,24,39,.40) 100%
    ),
    linear-gradient(
      0deg,
      rgba(2,14,26,.78),
      transparent 42%
    );
}

.login-container {
  position: relative;
  z-index: 2;

  display: flex;
  flex-direction: column;

  width: 100%;
  max-width: 1600px;
  min-height: 100vh;

  margin: 0 auto;
  padding: 25px clamp(22px,4.5vw,70px);
}

/* HEADER */

.login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
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

  background: #071a2c66;
  color: #e2efed;

  font-size: 10px;
  font-weight: 800;
  letter-spacing: .7px;
}

/* SPLIT LAYOUT */

.login-main {
  display: grid;
  grid-template-columns:
    minmax(0,1.2fr)
    minmax(350px,.8fr);

  align-items: center;
  gap: clamp(30px,5vw,80px);

  flex: 1;
  padding: 32px 0 45px;
}

/* LEFT PANEL */

.login-left {
  min-width: 0;
  max-width: 760px;
}

.login-eyebrow {
  margin-bottom: 19px;
  color: #f0c779;

  font-size: 12px;
  font-weight: 900;
  letter-spacing: 2px;
}

.login-heading-top {
  display: flex;
  align-items: center;
  gap: 19px;
}

.login-heading-top h1 {
  margin: 0;

  font-size: clamp(70px,9vw,132px);
  font-weight: 900;
  line-height: .95;
  letter-spacing: -4px;
}

.login-version {
  padding: 9px 13px;
  border: 1px solid #55e2b88a;
  border-radius: 9px;
  background: #18a88c28;

  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.login-minetrack {
  margin-top: 4px;
  color: #56e7b9;

  font-size: clamp(56px,7vw,108px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -3px;

  text-shadow: 0 5px 20px #00162055;
}

.login-subtitle {
  max-width: 570px;
  margin: 24px 0 28px;

  color: #e0eeed;
  font-size: 16px;
  line-height: 1.8;

  text-shadow: 0 2px 10px #06152366;
}

/* FEATURE BADGES */

.login-features {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.login-feature {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 12px 14px;

  border: 1px solid #ffffff55;
  border-radius: 11px;

  background: #092536a3;
  color: white;

  font-size: 12px;
  font-weight: 800;

  backdrop-filter: blur(7px);
}

.login-feature svg {
  color: #75edc5;
  flex-shrink: 0;
}

.login-left-footer {
  margin-top: 43px;
}

.login-footer-line {
  width: 130px;
  height: 3px;
  margin-bottom: 15px;

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
  padding: 29px 29px 23px;

  border: 1px solid #ffffff90;
  border-radius: 17px;

  background: white;
  color: #17303f;

  box-shadow: 0 25px 70px #05172480;
}

.login-card-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  padding: 8px 11px;
  border-radius: 8px;

  background: #e6f6ef;
  color: #088760;

  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
}

.login-card h2 {
  margin: 20px 0 9px;
  color: #152b3c;

  font-size: 29px;
  font-weight: 900;
  letter-spacing: -.7px;
}

.login-card-description {
  margin: 0 0 22px;
  color: #728695;

  font-size: 13px;
  line-height: 1.7;
}

/* INPUT */

.login-field {
  margin-bottom: 19px;
}

.login-field label {
  display: block;
  margin-bottom: 8px;

  color: #2e4656;
  font-size: 12px;
  font-weight: 850;
}

.login-input {
  display: flex;
  align-items: center;
  gap: 12px;

  min-height: 49px;
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
  min-height: 47px;

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
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;

  margin: 1px 0 20px;
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
  justify-content: center;
  align-items: center;
  gap: 10px;

  width: 100%;
  min-height: 50px;
  padding: 13px;

  border: 0;
  border-radius: 9px;

  background: linear-gradient(
    95deg,
    #07855e,
    #0ec68f
  );

  color: white;
  font-size: 13px;
  font-weight: 900;

  box-shadow: 0 7px 19px #05966c25;
}

.login-submit:hover:not(:disabled) {
  background: #087d59;
}

/* ERROR */

.login-error {
  display: flex;
  align-items: flex-start;
  gap: 9px;

  margin-bottom: 15px;
  padding: 12px;

  border: 1px solid #fecaca;
  border-radius: 9px;

  background: #fff1f1;
  color: #b91c1c;

  font-size: 12px;
  line-height: 1.5;
}

.login-error svg {
  flex-shrink: 0;
}

/* REGISTRATION */

.login-register {
  margin-top: 23px;
  text-align: center;
}

.login-divider {
  position: relative;

  display: flex;
  justify-content: center;
  align-items: center;

  margin-bottom: 15px;
}

.login-divider::before {
  content: "";

  position: absolute;
  left: 0;
  right: 0;

  height: 1px;
  background: #e5ecef;
}

.login-divider span {
  position: relative;
  padding: 0 12px;

  background: white;
  color: #94a3aa;

  font-size: 10px;
  font-weight: 800;
}

.login-register > p {
  margin: 0 0 12px;
  color: #667e89;
  font-size: 12px;
}

.login-register-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 9px;

  width: 100%;
  min-height: 49px;
  padding: 11px;

  border: 1px solid #0b9b70;
  border-radius: 9px;

  background: #f4fbf7;
  color: #087e5b;

  font-size: 12px;
  font-weight: 900;
}

.login-register-button:hover:not(:disabled) {
  background: #e1f5eb;
}

.login-register > small {
  display: block;
  margin-top: 10px;

  color: #90a0a5;
  font-size: 10px;
  line-height: 1.6;
}

/* ROLE INFO */

.login-access-info {
  display: flex;
  align-items: flex-start;
  gap: 11px;

  margin-top: 21px;
  padding: 13px;

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
  color: #167253;
  font-size: 11px;
}

.login-access-info p {
  margin: 5px 0 0;

  color: #6c8b7c;
  font-size: 10px;
  line-height: 1.6;
}

/* FOOTERS */

.login-card-footer {
  margin-top: 19px;
  padding-top: 14px;

  border-top: 1px solid #e9eef1;

  color: #9eacb4;
  font-size: 10px;
  text-align: center;
  line-height: 1.7;
}

.login-global-footer {
  display: flex;
  align-items: center;
  gap: 12px;

  padding-top: 13px;
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
  to {
    transform: rotate(360deg);
  }
}

/* TABLET */

@media(max-width:1100px) {
  .login-main {
    grid-template-columns:
      minmax(0,1fr)
      minmax(340px,.95fr);

    gap: 25px;
  }

  .login-heading-top h1 {
    font-size: 77px;
  }

  .login-minetrack {
    font-size: 62px;
  }

  .login-subtitle {
    font-size: 14px;
  }

  .login-card {
    padding: 25px 22px;
  }
}

/* MOBILE */

@media(max-width:800px) {
  .login-container {
    padding: 19px 16px;
  }

  .login-main {
    grid-template-columns: 1fr;
    gap: 26px;
    padding: 35px 0;
  }

  .login-header-version {
    display: none;
  }

  .login-left {
    margin: 0 auto;
    text-align: center;
  }

  .login-heading-top {
    justify-content: center;
  }

  .login-heading-top h1 {
    font-size: 68px;
  }

  .login-minetrack {
    font-size: clamp(48px,10vw,75px);
  }

  .login-subtitle {
    max-width: 520px;
    margin: 17px auto 22px;
    font-size: 13px;
  }

  .login-features {
    justify-content: center;
  }

  .login-feature {
    padding: 10px;
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
    background: linear-gradient(
      180deg,
      rgba(6,27,45,.66),
      rgba(7,31,53,.77) 55%,
      rgba(6,27,45,.92)
    );
  }

  .login-global-footer {
    justify-content: center;
  }
}

@media(max-width:480px) {
  .login-container {
    padding: 16px 12px;
  }

  .login-header-brand strong {
    font-size: 10px;
  }

  .login-header-brand span {
    font-size: 9px;
  }

  .login-heading-top h1 {
    font-size: 60px;
  }

  .login-minetrack {
    font-size: 48px;
    letter-spacing: -1px;
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
    font-size: 9px;
  }

  .login-card {
    padding: 23px 18px;
  }

  .login-card h2 {
    font-size: 25px;
  }

  .login-card-description {
    font-size: 12px;
  }

  .login-remember,
  .login-forgot {
    font-size: 11px;
  }
}

@media(prefers-reduced-motion:reduce) {
  .login-loader {
    animation: none;
  }
}
`;
