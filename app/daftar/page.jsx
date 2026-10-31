
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ======================================================
// OJT MINETRACK V2.0
// DASHBOARD PENDAFTARAN PESERTA OJT
// CORPORATE NAVY / EMERALD / ERG BACKGROUND
// DESAIN SESUAI DASHBOARD MENTOR & ADMIN
//
// CATATAN:
// Proses submit perlu dihubungkan ke fungsi registrasi
// lama agar mekanisme Supabase dan persetujuan tidak berubah.
// ======================================================

const BACKGROUND = "/background-erg.png.PNG";

const PROGRAM_START = "2026-09-12";
const PROGRAM_END = "2027-03-06";
const TOTAL_WEEKS = 25;

const SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

const DEPARTMENTS = [
  "ER & SS",
  "Emergency Response Group",
  "Operation",
  "Maintenance",
  "HSE",
  "Engineering",
  "Human Resources",
  "Lainnya",
];

function Icon({ name, size = 19 }) {
  const icons = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
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
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M14 3v6h5M9 13h6M9 17h6" />
      </>
    ),
    map: (
      <>
        <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    phone: (
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19 19 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.4 3a2 2 0 0 1-.6 1.8L7 10.4a16 16 0 0 0 6.6 6.6l1.9-1.9a2 2 0 0 1 1.8-.6l3 .4a2 2 0 0 1 1.7 2z" />
    ),
    arrow: (
      <path d="M5 12h14m-6-6 6 6-6 6" />
    ),
    back: (
      <path d="M19 12H5m6-6-6 6 6 6" />
    ),
    check: (
      <path d="m4 12 5 5L20 6" />
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    flag: (
      <path d="M5 22V4m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0" />
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4z" />
        <path d="M22 2 11 13" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 1 1 5 2.3c-1.2 1-2 1.3-2 3.2M12 18h.01" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v11H3z" />
        <path d="M9 21v-8h6v8" />
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
      {icons[name] || icons.info}
    </svg>
  );
}

function InfoCard({ icon, label, title, children, color }) {
  return (
    <div className="reg-info-card">
      <div className={"reg-info-icon " + color}>
        <Icon name={icon} size={24} />
      </div>
      <div>
        <span className="reg-info-label">{label}</span>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  icon,
  required = false,
  children,
}) {
  return (
    <div className="reg-field">
      <label>
        {label}
        {required && <em> *</em>}
      </label>
      <div className="reg-field-control">
        <Icon name={icon} size={18} />
        {children}
      </div>
    </div>
  );
}

function getInitialForm() {
  return {
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    site: "",
    phone: "",
  };
}

export default function DaftarPesertaOJT() {
  const router = useRouter();

  const [form, setForm] = useState(getInitialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function update(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
    setError("");
    setNotice("");
  }

  const passwordValid = useMemo(
    () => form.password.length >= 8,
    [form.password]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setNotice("");

    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\s/g, "");

    if (fullName.length < 3) {
      setError("Nama lengkap minimal 3 karakter.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Masukkan email yang valid.");
      return;
    }

    if (!passwordValid) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    if (!form.department || !form.site) {
      setError("Departemen dan site wajib dipilih.");
      return;
    }

    if (!/^\+?[0-9]{9,15}$/.test(phone)) {
      setError("Masukkan nomor HP yang valid, 9–15 digit.");
      return;
    }

    if (!agreed) {
      setError(
        "Anda harus menyetujui ketentuan pendaftaran."
      );
      return;
    }

    // ==================================================
    // INTEGRASI DATABASE
    //
    // Sambungkan di sini ke handleSubmit pendaftaran
    // asli setelah memeriksa app/daftar/page.jsx lama.
    //
    // Data yang sudah tervalidasi:
    // fullName, email, form.password,
    // form.department, form.site, phone
    //
    // Periode tetap:
    // PROGRAM_START dan PROGRAM_END
    //
    // Jangan langsung memanggil auth.signUp lalu
    // menganggap pendaftaran berhasil, karena
    // pembuatan user dan pengajuan ke Mentor/Admin
    // harus mengikuti transaksi/alur lama.
    // ==================================================

    setNotice(
      "Formulir sudah valid. Pengiriman belum diaktifkan " +
      "karena fungsi registrasi Supabase yang lama perlu " +
      "dihubungkan agar persetujuan Mentor/Admin tetap aman."
    );
  }

  return (
    <main className="reg-root">
      <style>{css}</style>

      <div
        className="reg-background"
        style={{
          backgroundImage: `url("${BACKGROUND}")`,
        }}
      />

      <div className="reg-overlay" />

      <div className="reg-container">
        {/* HEADER NAVIGASI */}

        <header className="reg-topbar">
          <div className="reg-brand">
            <div className="reg-logo">
              <Icon name="shield" size={25} />
            </div>
            <div>
              <strong>
                OJT <span>MineTrack</span>
                <small>v2.0</small>
              </strong>
              <p>ON THE JOB TRAINING MANAGEMENT SYSTEM</p>
            </div>
          </div>

          <nav className="reg-navigation">
            <button
              type="button"
              onClick={() => router.push("/login")}
            >
              <Icon name="home" size={16} />
              Beranda
            </button>
            <span className="active">
              <Icon name="file" size={16} />
              Pendaftaran
            </span>
            <a href="#informasi-program">
              <Icon name="calendar" size={16} />
              Informasi Program
            </a>
          </nav>

          <div className="reg-company">
            <Icon name="shield" size={23} />
            <span>
              EMERGENCY RESPONSE GROUP
              <small>PT BERAU COAL</small>
            </span>
          </div>
        </header>

        {/* HERO */}

        <section className="reg-hero">
          <div className="reg-hero-copy">
            <div className="reg-eyebrow">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Dashboard <span>Pendaftaran OJT</span>
            </h1>

            <p>
              Daftarkan diri Anda untuk mengikuti program
              On The Job Training (OJT) di lingkungan
              Emergency Response Group PT Berau Coal.
              Lengkapi data dengan benar dan ikuti
              proses persetujuan.
            </p>

            <div className="reg-hero-tags">
              <span>
                <Icon name="shield" size={15} />
                Safe People
              </span>
              <span>Safe Operation</span>
              <span>Sustainable Mining</span>
            </div>
          </div>
        </section>

        {/* EMPAT KARTU INFORMASI */}

        <section className="reg-info-grid">
          <InfoCard
            icon="user"
            label="Status Formulir"
            title="Pendaftaran Peserta OJT"
            color="green"
          >
            Lengkapi formulir satu kali. Status pengajuan
            ditentukan oleh sistem setelah dikirim.
          </InfoCard>

          <InfoCard
            icon="calendar"
            label="Periode Program"
            title="12 Sep 2026 – 06 Mar 2027"
            color="blue"
          >
            Mengikuti Kalender Global OJT Week 01–25.
          </InfoCard>

          <InfoCard
            icon="users"
            label="Alur Persetujuan"
            title="Peserta → Mentor → Admin"
            color="gold"
          >
            Pengajuan diperiksa melalui mekanisme
            persetujuan yang sudah berlaku.
          </InfoCard>

          <InfoCard
            icon="file"
            label="Program OJT"
            title="Week 01 – Week 25"
            color="teal"
          >
            Program monitoring dan evaluasi terstruktur
            selama 25 minggu.
          </InfoCard>
        </section>

        {/* AREA UTAMA */}

        <div className="reg-main-grid">
          {/* FORMULIR KIRI */}

          <section className="reg-card reg-form-card">
            <div className="reg-card-heading">
              <div className="reg-heading-icon">
                <Icon name="user" size={23} />
              </div>

              <div>
                <h2>Formulir Pendaftaran Peserta OJT</h2>
                <p>
                  Lengkapi data sesuai identitas resmi.
                  Seluruh kolom bertanda * wajib diisi.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="reg-form-grid">
                <FormField
                  label="Nama Lengkap"
                  icon="user"
                  required
                >
                  <input
                    required
                    type="text"
                    autoComplete="name"
                    placeholder="Nama lengkap peserta"
                    value={form.fullName}
                    onChange={(e) =>
                      update("fullName", e.target.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Email"
                  icon="mail"
                  required
                >
                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="Alamat email aktif"
                    value={form.email}
                    onChange={(e) =>
                      update("email", e.target.value)
                    }
                  />
                </FormField>

                <FormField
                  label="Password"
                  icon="lock"
                  required
                >
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Minimal 8 karakter"
                    value={form.password}
                    onChange={(e) =>
                      update("password", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="reg-eye-button"
                    aria-label={
                      showPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                    onClick={() =>
                      setShowPassword((old) => !old)
                    }
                  >
                    <Icon
                      name={showPassword ? "eyeOff" : "eye"}
                      size={18}
                    />
                  </button>
                </FormField>

                <FormField
                  label="Konfirmasi Password"
                  icon="lock"
                  required
                >
                  <input
                    required
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Ulangi password"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      update("confirmPassword", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="reg-eye-button"
                    aria-label={
                      showConfirm
                        ? "Sembunyikan konfirmasi password"
                        : "Tampilkan konfirmasi password"
                    }
                    onClick={() =>
                      setShowConfirm((old) => !old)
                    }
                  >
                    <Icon
                      name={showConfirm ? "eyeOff" : "eye"}
                      size={18}
                    />
                  </button>
                </FormField>

                <FormField
                  label="Departemen"
                  icon="users"
                  required
                >
                  <select
                    required
                    value={form.department}
                    onChange={(e) =>
                      update("department", e.target.value)
                    }
                  >
                    <option value="">
                      Pilih departemen
                    </option>

                    {DEPARTMENTS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  label="Site Penempatan"
                  icon="map"
                  required
                >
                  <select
                    required
                    value={form.site}
                    onChange={(e) =>
                      update("site", e.target.value)
                    }
                  >
                    <option value="">
                      Pilih site penempatan
                    </option>

                    {SITES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="reg-span-full">
                  <FormField
                    label="Nomor HP"
                    icon="phone"
                    required
                  >
                    <input
                      required
                      type="tel"
                      autoComplete="tel"
                      placeholder="Contoh: 0812 3456 7890"
                      value={form.phone}
                      onChange={(e) =>
                        update("phone", e.target.value)
                      }
                    />
                  </FormField>
                </div>
              </div>

              {/* JADWAL TERKUNCI */}

              <div className="reg-fixed-program">
                <h3>
                  <Icon name="calendar" size={19} />
                  Jadwal Program OJT (Otomatis)
                </h3>

                <div className="reg-fixed-grid">
                  <div>
                    <Icon name="calendar" size={21} />
                    <div>
                      <span>Tanggal Mulai OJT</span>
                      <strong>12 September 2026</strong>
                      <small>Week 01 · Sabtu</small>
                    </div>
                    <Icon name="lock" size={15} />
                  </div>

                  <div>
                    <Icon name="flag" size={21} />
                    <div>
                      <span>Tanggal Selesai Program</span>
                      <strong>6 Maret 2027</strong>
                      <small>Week 25 · Sabtu</small>
                    </div>
                    <Icon name="lock" size={15} />
                  </div>
                </div>

                <p>
                  <Icon name="info" size={16} />
                  Tanggal mengikuti Kalender Global OJT
                  Week 01–25 dan tidak dapat diubah peserta.
                </p>
              </div>

              <label className="reg-agreement">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) =>
                    setAgreed(e.target.checked)
                  }
                />
                <span>
                  Saya menyatakan seluruh data yang diisi
                  adalah benar dan bersedia mengikuti
                  ketentuan program OJT MineTrack PT Berau Coal.
                </span>
              </label>

              {error && (
                <div className="reg-error" role="alert">
                  <Icon name="info" size={18} />
                  {error}
                </div>
              )}

              {notice && (
                <div className="reg-notice" role="status">
                  <Icon name="info" size={18} />
                  {notice}
                </div>
              )}

              <div className="reg-actions">
                <button
                  type="submit"
                  className="reg-primary-button"
                >
                  <Icon name="send" size={18} />
                  Daftar Sekarang
                  <Icon name="arrow" size={17} />
                </button>

                <button
                  type="button"
                  className="reg-secondary-button"
                  onClick={() => router.push("/login")}
                >
                  <Icon name="back" size={17} />
                  Kembali ke Login
                </button>
              </div>
            </form>
          </section>

          {/* PANEL KANAN */}

          <aside className="reg-right-column">
            <section
              className="reg-card reg-timeline-card"
              id="informasi-program"
            >
              <div className="reg-card-heading">
                <div className="reg-heading-icon">
                  <Icon name="calendar" size={22} />
                </div>
                <div>
                  <h2>Program OJT 2026–2027</h2>
                  <p>
                    Timeline Kalender Global Week 01–25.
                  </p>
                </div>
              </div>

              <div className="reg-timeline-dates">
                <span>Mulai · Week 01</span>
                <span>Selesai · Week 25</span>
              </div>

              <div className="reg-timeline">
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => (
                    <div
                      className={
                        "reg-timeline-week " +
                        (index === 0 ||
                        index === TOTAL_WEEKS - 1
                          ? "endpoint"
                          : "")
                      }
                      key={index}
                    >
                      <div className="reg-timeline-dot" />
                      <small>{String(index + 1).padStart(2, "0")}</small>
                    </div>
                  )
                )}
              </div>

              <div className="reg-timeline-caption">
                12 September 2026 – 6 Maret 2027
              </div>
            </section>

            <section className="reg-card reg-guidelines-card">
              <div className="reg-card-heading">
                <div className="reg-heading-icon">
                  <Icon name="file" size={21} />
                </div>

                <div>
                  <h2>Ketentuan Pendaftaran</h2>
                  <p>
                    Tahapan pengajuan dan persetujuan peserta.
                  </p>
                </div>
              </div>

              <div className="reg-steps">
                {[
                  [
                    "Pendaftaran dilakukan satu kali",
                    "Peserta mengisi formulir dengan identitas yang benar.",
                  ],
                  [
                    "Data akan diverifikasi",
                    "Pengajuan diperiksa sesuai aturan sistem.",
                  ],
                  [
                    "Persetujuan Mentor",
                    "Mentor meninjau pengajuan peserta.",
                  ],
                  [
                    "Persetujuan Admin",
                    "Administrator memverifikasi pengajuan sesuai kewenangannya.",
                  ],
                  [
                    "Hasil pendaftaran",
                    "Peserta mengetahui status pengajuan melalui mekanisme sistem.",
                  ],
                ].map(([title, description], index) => (
                  <div className="reg-step" key={index}>
                    <span className={"reg-step-number step-" + index}>
                      {index + 1}
                    </span>

                    <div>
                      <strong>{title}</strong>
                      <p>{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="reg-card reg-help-card">
              <div className="reg-help-icon">
                <Icon name="help" size={27} />
              </div>

              <div>
                <h3>Butuh Bantuan?</h3>
                <p>
                  Jika mengalami kendala pendaftaran,
                  hubungi tim Administrator Emergency
                  Response Group PT Berau Coal.
                </p>
              </div>
            </section>
          </aside>
        </div>

        <footer className="reg-footer">
          <span>
            OJT MineTrack v2.0 · Emergency Response Group
          </span>
          <span>
            PT Berau Coal · Program 2026–2027
          </span>
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// CSS CORPORATE DASHBOARD
// ======================================================

const css = `
.reg-root,
.reg-root * {
  box-sizing: border-box;
}

.reg-root {
  position: relative;
  min-height: 100vh;
  background: #edf4f8;
  color: #153252;
  font-family: Arial, Helvetica, sans-serif;
}

.reg-root button,
.reg-root input,
.reg-root select {
  font-family: inherit;
}

.reg-root button {
  cursor: pointer;
}

.reg-root button:focus-visible,
.reg-root input:focus-visible,
.reg-root select:focus-visible {
  outline: 2px solid #12aa9a;
  outline-offset: 2px;
}

.reg-background {
  position: absolute;
  inset: 0 0 auto;
  height: 520px;
  background-color: #0b2941;
  background-size: cover;
  background-position: center 40%;
  background-repeat: no-repeat;
}

.reg-overlay {
  position: absolute;
  inset: 0 0 auto;
  height: 560px;
  background:
    linear-gradient(
      90deg,
      rgba(4,24,44,.95) 0%,
      rgba(6,31,53,.69) 42%,
      rgba(6,33,57,.48) 100%
    ),
    linear-gradient(
      0deg,
      #edf4f8 0%,
      transparent 52%
    );
}

.reg-container {
  position: relative;
  z-index: 1;
  max-width: 1550px;
  margin: auto;
  padding: 0 24px 24px;
}

/* TOPBAR */

.reg-topbar {
  display: flex;
  align-items: center;
  gap: 25px;
  min-height: 82px;
  border-bottom: 1px solid #ffffff2b;
  color: white;
}

.reg-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  white-space: nowrap;
}

.reg-logo {
  display: grid;
  place-items: center;
  width: 45px;
  height: 45px;
  border-radius: 12px;
  background: #0a797b55;
  color: #6ce7c2;
  border: 1px solid #64d7c37c;
}

.reg-brand strong {
  font-size: 23px;
  font-weight: 900;
}

.reg-brand strong span {
  color: #54dec5;
}

.reg-brand strong small {
  margin-left: 7px;
  padding: 5px 7px;
  border-radius: 5px;
  background: #54dec5;
  color: #08333e;
  font-size: 11px;
}

.reg-brand p {
  margin: 5px 0 0;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #d4e4e8;
}

.reg-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
}

.reg-navigation button,
.reg-navigation a,
.reg-navigation > span {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 39px;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  border-radius: 8px;
  color: #d8e6ed;
  text-decoration: none;
  font-size: 12px;
  font-weight: 750;
}

.reg-navigation .active {
  background: #09726f;
  color: white;
  border-bottom: 2px solid #54e0c6;
}

.reg-company {
  display: flex;
  align-items: center;
  gap: 10px;
  color: white;
}

.reg-company svg {
  color: #ebc378;
}

.reg-company > span {
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.reg-company small {
  display: block;
  margin-top: 4px;
  font-size: 9px;
  color: #c9dfeb;
}

/* HERO */

.reg-hero {
  display: flex;
  align-items: center;
  min-height: 195px;
  padding: 22px 9px;
  color: white;
}

.reg-hero-copy {
  max-width: 700px;
}

.reg-eyebrow {
  color: #e8c789;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.reg-hero h1 {
  margin: 12px 0;
  font-size: clamp(29px,3.1vw,44px);
  line-height: 1.15;
  font-weight: 900;
  letter-spacing: -.9px;
}

.reg-hero h1 span {
  color: #58dfbf;
}

.reg-hero p {
  max-width: 590px;
  font-size: 13px;
  line-height: 1.75;
  color: #edf5f8;
}

.reg-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.reg-hero-tags span {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border: 1px solid #ffffff47;
  border-radius: 20px;
  background: #05283a82;
  color: #e8f7f4;
  font-size: 10px;
  font-weight: 750;
}

/* SUMMARY CARDS */

.reg-info-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 13px;
  margin-bottom: 16px;
}

.reg-info-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 122px;
  padding: 17px;
  border: 1px solid #e0e8ef;
  border-radius: 11px;
  background: #ffffffef;
  box-shadow: 0 7px 25px #102c461c;
}

.reg-info-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  border-radius: 11px;
}

.reg-info-icon.green {
  background: #e0f7ee;
  color: #05926a;
}

.reg-info-icon.blue {
  background: #e1f0fe;
  color: #136cba;
}

.reg-info-icon.gold {
  background: #fff1d9;
  color: #c58b22;
}

.reg-info-icon.teal {
  background: #ddf9f5;
  color: #0a9b91;
}

.reg-info-label {
  display: block;
  color: #698095;
  font-size: 10px;
}

.reg-info-card strong {
  display: block;
  margin-top: 5px;
  color: #0d3765;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.35;
}

.reg-info-card p {
  margin: 7px 0 0;
  color: #687c90;
  font-size: 11px;
  line-height: 1.5;
}

/* MAIN AREA */

.reg-main-grid {
  display: grid;
  grid-template-columns: 1.12fr .88fr;
  align-items: start;
  gap: 15px;
}

.reg-card {
  min-width: 0;
  border: 1px solid #e0e8f0;
  border-radius: 12px;
  background: #fffffffa;
  box-shadow: 0 5px 22px #163d5810;
}

.reg-form-card {
  padding: 20px;
}

.reg-card-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.reg-heading-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  background: linear-gradient(135deg,#0b437d,#1683ca);
  color: white;
}

.reg-card-heading h2 {
  margin: 0;
  color: #123b69;
  font-size: 17px;
  font-weight: 900;
}

.reg-card-heading p {
  margin: 5px 0 0;
  color: #74859a;
  font-size: 11px;
  line-height: 1.5;
}

/* FORM */

.reg-form-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 15px 13px;
}

.reg-span-full {
  grid-column: 1 / -1;
}

.reg-field {
  min-width: 0;
}

.reg-field > label {
  display: block;
  margin-bottom: 7px;
  color: #213b5e;
  font-size: 11px;
  font-weight: 900;
}

.reg-field em {
  color: #d33f46;
  font-style: normal;
}

.reg-field-control {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 11px;
  border: 1px solid #d5e0e8;
  border-radius: 7px;
  background: #fdfefe;
  color: #7893a9;
}

.reg-field-control:focus-within {
  border-color: #069c90;
  box-shadow: 0 0 0 3px #0a9d8e16;
}

.reg-field-control > svg {
  flex-shrink: 0;
}

.reg-field-control input,
.reg-field-control select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1e3c59;
  font-size: 12px;
}

.reg-field-control input::placeholder {
  color: #9cadba;
}

.reg-eye-button {
  display: grid;
  place-items: center;
  padding: 4px;
  flex-shrink: 0;
  border: 0;
  background: transparent;
  color: #7893a9;
}

/* FIXED PROGRAM */

.reg-fixed-program {
  margin-top: 18px;
  padding: 14px;
  border: 1px solid #d4eaf5;
  border-radius: 9px;
  background: #eaf6fd;
}

.reg-fixed-program h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  color: #124779;
  font-size: 12px;
}

.reg-fixed-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.reg-fixed-grid > div {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px;
  border-radius: 7px;
  background: #dceefc;
  color: #20639a;
}

.reg-fixed-grid > div > div {
  flex: 1;
}

.reg-fixed-grid span,
.reg-fixed-grid small {
  display: block;
  font-size: 10px;
}

.reg-fixed-grid strong {
  display: block;
  margin: 5px 0;
  color: #163a69;
  font-size: 12px;
}

.reg-fixed-program > p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 11px 0 0;
  color: #3973a2;
  font-size: 10px;
  line-height: 1.6;
}

/* CHECKBOX AND BUTTONS */

.reg-agreement {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 15px;
  color: #556e86;
  font-size: 11px;
  line-height: 1.5;
  cursor: pointer;
}

.reg-agreement input {
  width: 17px;
  height: 17px;
  margin: 1px 0 0;
  flex-shrink: 0;
  accent-color: #078879;
}

.reg-actions {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 11px;
  margin-top: 16px;
}

.reg-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 44px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 900;
}

.reg-primary-button {
  border: 0;
  background: linear-gradient(100deg,#086f66,#08a096);
  color: white;
}

.reg-secondary-button {
  border: 1px solid #a5c1d8;
  background: white;
  color: #14538a;
}

.reg-error,
.reg-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 14px;
  padding: 12px;
  border-radius: 7px;
  font-size: 11px;
  line-height: 1.6;
}

.reg-error {
  border: 1px solid #f5c5c5;
  background: #fff1f1;
  color: #b42d2d;
}

.reg-notice {
  border: 1px solid #bddbe8;
  background: #eff8fc;
  color: #255e80;
}

/* RIGHT COLUMN */

.reg-right-column {
  display: grid;
  gap: 14px;
}

.reg-timeline-card,
.reg-guidelines-card,
.reg-help-card {
  padding: 18px;
}

/* TIMELINE */

.reg-timeline-card {
  background: linear-gradient(135deg,#ffffff,#eaf5fe);
}

.reg-timeline-dates {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  color: #047d76;
  font-size: 11px;
  font-weight: 900;
}

.reg-timeline {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-top: 17px;
}

.reg-timeline::before {
  content: "";
  position: absolute;
  left: 1%;
  right: 1%;
  top: 5px;
  height: 3px;
  background: #1eb9bf;
}

.reg-timeline-week {
  position: relative;
  z-index: 1;
  min-width: 0;
  text-align: center;
  flex: 1;
}

.reg-timeline-dot {
  width: 9px;
  height: 9px;
  margin: 1px auto 8px;
  border: 2px solid #1bb8c5;
  border-radius: 50%;
  background: #c9f8fc;
}

.reg-timeline-week.endpoint .reg-timeline-dot {
  width: 15px;
  height: 15px;
  margin-top: -2px;
  margin-bottom: 5px;
  border: 3px solid #026b74;
  background: #09a49d;
}

.reg-timeline-week small {
  display: block;
  color: #68849b;
  font-size: 7px;
}

.reg-timeline-caption {
  margin-top: 16px;
  text-align: center;
  color: #597b99;
  font-size: 11px;
}

/* GUIDELINES */

.reg-guidelines-card {
  background: linear-gradient(130deg,#fff 60%,#edf7ff);
}

.reg-steps {
  display: grid;
  gap: 15px;
}

.reg-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.reg-step-number {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 50%;
  color: white;
  background: #1587d9;
  font-weight: 900;
  font-size: 12px;
}

.reg-step-number.step-1,
.reg-step-number.step-4 {
  background: #08a78d;
}

.reg-step-number.step-2 {
  background: #dba02c;
}

.reg-step-number.step-3 {
  background: #2c78dc;
}

.reg-step strong {
  color: #153c69;
  font-size: 11px;
  font-weight: 900;
}

.reg-step p {
  margin: 5px 0 0;
  color: #6c849b;
  font-size: 10px;
  line-height: 1.5;
}

/* HELP */

.reg-help-card {
  display: flex;
  align-items: center;
  gap: 13px;
  background: #e6f4ff;
}

.reg-help-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #147fc3;
  color: white;
}

.reg-help-card h3 {
  margin: 0;
  color: #145086;
  font-size: 13px;
}

.reg-help-card p {
  margin: 6px 0 0;
  color: #577c98;
  font-size: 10px;
  line-height: 1.5;
}

.reg-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 24px;
  padding: 14px 0;
  border-top: 1px solid #d8e3ec;
  color: #68849b;
  font-size: 10px;
}

/* RESPONSIVE */

@media(max-width:1200px) {
  .reg-topbar {
    flex-wrap: wrap;
    padding: 15px 0;
  }

  .reg-navigation {
    order: 3;
    flex-basis: 100%;
  }

  .reg-company {
    margin-left: auto;
  }

  .reg-info-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media(max-width:950px) {
  .reg-main-grid {
    grid-template-columns: 1fr;
  }

  .reg-background {
    height: 650px;
  }

  .reg-overlay {
    height: 680px;
  }
}

@media(max-width:650px) {
  .reg-container {
    padding: 0 12px 16px;
  }

  .reg-brand strong {
    font-size: 18px;
  }

  .reg-brand p {
    font-size: 7px;
  }

  .reg-company {
    display: none;
  }

  .reg-navigation {
    gap: 2px;
    justify-content: space-between;
  }

  .reg-navigation button,
  .reg-navigation a,
  .reg-navigation > span {
    padding: 9px 6px;
    font-size: 10px;
  }

  .reg-hero {
    min-height: 225px;
  }

  .reg-hero h1 {
    font-size: 30px;
  }

  .reg-info-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .reg-info-card {
    min-height: 0;
    padding: 13px;
  }

  .reg-form-card,
  .reg-timeline-card,
  .reg-guidelines-card {
    padding: 14px;
  }

  .reg-form-grid {
    grid-template-columns: 1fr;
  }

  .reg-fixed-grid {
    grid-template-columns: 1fr;
  }

  .reg-actions {
    grid-template-columns: 1fr;
  }

  .reg-card-heading h2 {
    font-size: 15px;
  }

  .reg-timeline-week small {
    font-size: 5.5px;
  }

  .reg-timeline-dot {
    width: 7px;
    height: 7px;
  }

  .reg-footer {
    flex-direction: column;
    text-align: center;
  }
}
`;
