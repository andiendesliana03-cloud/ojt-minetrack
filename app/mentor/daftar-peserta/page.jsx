
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// PENDAFTARAN PESERTA — MENTOR DASHBOARD
// MODERN CORPORATE NAVY / EMERALD / WHITE
// BACKGROUND SELARAS DENGAN DASHBOARD PENDAFTARAN
//
// KEAMANAN:
// - Pendaftaran asli tetap NONAKTIF
// - Simulasi selalu dry_run: true
// - Pengujian API asli tetap dipertahankan
// - Tidak mengubah database atau hak akses
// ======================================================

const REGISTRATION_ENABLED = false;
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const PROGRAM_START = "2026-09-12";
const PROGRAM_END = "2027-03-06";
const TOTAL_WEEKS = 25;

const SITE_OPTIONS = [
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

const initialForm = {
  full_name: "",
  email: "",
  department: "ER & SS",
  site: "",
  start_date: PROGRAM_START,
  end_date: PROGRAM_END,
};

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function initials(name) {
  return String(name || "Mentor OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function Icon({ name, size = 19 }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9M9 21v-7h6v7" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    file: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
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
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="5" width="14" height="16" rx="2" />
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <path d="M9 13h6M9 17h4" />
      </>
    ),
    map: (
      <>
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    alert: (
      <>
        <path d="M12 3 2 21h20L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    x: <path d="M5 5l14 14M19 5 5 19" />,
    flag: (
      <path d="M5 22V4m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0" />
    ),
    activity: (
      <>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
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
      {paths[name] || paths.check}
    </svg>
  );
}

function FormField({ label, icon, children, hint }) {
  return (
    <label className="reg-field">
      <span className="reg-label">{label}</span>

      <div className="reg-input-wrap">
        <Icon name={icon} size={17} />
        {children}
      </div>

      {hint && <small className="reg-hint">{hint}</small>}
    </label>
  );
}

function PreviewItem({ label, value }) {
  return (
    <div className="reg-preview-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function SummaryCard({ icon, label, value, text, color }) {
  return (
    <div className="reg-summary-card">
      <div className={`reg-summary-icon ${color}`}>
        <Icon name={icon} size={23} />
      </div>

      <div className="reg-summary-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function SectionHeading({ icon, title, description }) {
  return (
    <div className="reg-section-heading">
      <div className="reg-heading-icon">
        <Icon name={icon} size={21} />
      </div>

      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function DaftarPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [securityResult, setSecurityResult] = useState(null);

  const [mobileMenu, setMobileMenu] = useState(false);

  // ====================================================
  // AUTENTIKASI — HANYA MENTOR
  // ====================================================

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError || profile?.role !== "mentor") {
          router.replace("/peserta");
          return;
        }

        if (active) setMentor(profile);
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memeriksa akses mentor."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
    setResult(null);
  }

  function validateForm() {
    if (form.full_name.trim().length < 3) {
      return "Nama peserta minimal 3 karakter.";
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      return "Format email peserta tidak valid.";
    }

    if (!form.department.trim()) {
      return "Departemen wajib diisi.";
    }

    if (!SITE_OPTIONS.includes(form.site)) {
      return "Pilih site OJT.";
    }

    if (!form.start_date || !form.end_date) {
      return "Tanggal mulai dan selesai wajib tersedia.";
    }

    if (form.end_date < form.start_date) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }

    return "";
  }

  // ====================================================
  // SIMULASI PENDAFTARAN — DRY RUN
  // TIDAK MEMBUAT AKUN ATAU PROGRAM
  // ====================================================

  async function runSimulation(event) {
    event.preventDefault();

    if (saving || testing) return;

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }

    setSaving(true);
    setError("");
    setResult(null);

    try {
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.auth.getSession();

      const token = sessionData?.session?.access_token;

      if (sessionError || !token) {
        throw new Error(
          "Sesi login habis. Silakan login kembali."
        );
      }

      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            department: form.department.trim(),
            site: form.site,
            start_date: PROGRAM_START,
            end_date: PROGRAM_END,
            dry_run: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Simulasi gagal.");
      }

      if (data.dry_run !== true) {
        throw new Error(
          "Server tidak mengonfirmasi mode simulasi."
        );
      }

      setResult(data);
    } catch (err) {
      setError(
        err?.message ||
          "Terjadi kesalahan simulasi."
      );
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // UJI PENGAMAN API
  // TANPA TOKEN DAN TANPA DATA PESERTA
  // ====================================================

  async function testSecurity() {
    if (saving || testing) return;

    setTesting(true);
    setSecurityResult(null);
    setError("");

    try {
      const response = await fetch(
        "/api/mentor/register-participant",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            dry_run: false,
          }),
        }
      );

      const data = await response.json();

      const passed =
        response.status === 403 &&
        data.success === false &&
        typeof data.error === "string" &&
        data.error.includes(
          "Pendaftaran asli sedang dinonaktifkan"
        );

      setSecurityResult({
        passed,
        status: response.status,
        message:
          data.error ||
          "Server tidak memberikan pesan.",
      });
    } catch (err) {
      setSecurityResult({
        passed: false,
        status: "—",
        message:
          err?.message || "Kesalahan jaringan.",
      });
    } finally {
      setTesting(false);
    }
  }

  function navigate(path) {
    setMobileMenu(false);
    router.push(path);
  }

  const navigation = [
    {
      label: "Dashboard",
      path: "/",
      icon: "home",
    },
    {
      label: "Peserta OJT",
      path: "/mentor/monitoring-peserta",
      icon: "users",
    },
    {
      label: "Pendaftaran Peserta",
      path: "/mentor/daftar-peserta",
      icon: "file",
    },
    {
      label: "Persetujuan",
      path: "/mentor/persetujuan-peserta",
      icon: "check",
    },
  ];

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="reg-loading">
        <style>{css}</style>

        <div>
          <h2>
            OJT <span>MineTrack</span>
          </h2>
          <p>Memeriksa akses mentor...</p>
        </div>
      </main>
    );
  }

  if (!mentor) {
    return (
      <main className="reg-loading">
        <style>{css}</style>

        <div>
          <h2>Akses Tidak Tersedia</h2>
          <p>
            {error || "Halaman khusus Mentor OJT."}
          </p>

          <button onClick={() => router.push("/")}>
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ====================================================
  // TAMPILAN DASHBOARD
  // ====================================================

  return (
    <div className="reg-app">
      <style>{css}</style>

      {/* HEADER DASHBOARD */}

      <header className="reg-topbar">
        <button
          type="button"
          className="reg-brand"
          onClick={() => navigate("/")}
        >
          <span className="reg-brand-icon">
            <Icon name="shield" size={22} />
          </span>

          <span className="reg-brand-copy">
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>

            <span>
              ON THE JOB TRAINING MANAGEMENT SYSTEM
            </span>
          </span>
        </button>

        <nav
          className={
            "reg-navigation " +
            (mobileMenu ? "open" : "")
          }
          aria-label="Navigasi utama"
        >
          {navigation.map((item) => (
            <button
              type="button"
              key={item.path}
              className={
                item.path === "/mentor/daftar-peserta"
                  ? "active"
                  : ""
              }
              onClick={() => navigate(item.path)}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="reg-account">
          <div className="reg-account-avatar">
            {initials(mentor.full_name)}
          </div>

          <div className="reg-account-info">
            <strong>
              {mentor.full_name || "Mentor OJT"}
            </strong>
            <small>Mentor OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="reg-mobile-toggle"
          aria-label={
            mobileMenu ? "Tutup menu" : "Buka menu"
          }
          aria-expanded={mobileMenu}
          onClick={() =>
            setMobileMenu((value) => !value)
          }
        >
          <Icon
            name={mobileMenu ? "x" : "menu"}
            size={22}
          />
        </button>
      </header>

      <main className="reg-container">

        {/* HERO CORPORATE */}

        <section
          className="reg-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(4,22,43,.97) 0%,
                rgba(5,34,57,.88) 44%,
                rgba(5,35,54,.46) 100%
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div className="reg-hero-content">
            <div className="reg-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Dashboard <span>Pendaftaran OJT</span>
            </h1>

            <p>
              Kelola persiapan data calon peserta,
              tinjau periode program, dan jalankan
              simulasi pendaftaran secara aman melalui
              Dashboard Mentor OJT MineTrack.
            </p>

            <div className="reg-hero-meta">
              <span>
                <Icon name="shield" size={15} />
                Akses Mentor
              </span>

              <span>
                <Icon name="calendar" size={15} />
                Program OJT 2026–2027
              </span>

              <span>
                <Icon name="lock" size={15} />
                Dry Run Only
              </span>
            </div>
          </div>

          <div className="reg-hero-status">
            <div className="reg-status-icon">
              <Icon name="lock" size={23} />
            </div>

            <small>STATUS MODUL</small>

            <strong>
              {REGISTRATION_ENABLED
                ? "Pendaftaran Aktif"
                : "Mode Pengujian"}
            </strong>

            <span>
              {REGISTRATION_ENABLED
                ? "Modul tersedia"
                : "Pendaftaran asli terkunci"}
            </span>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="reg-breadcrumb">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Dashboard
          </button>
          <span>/</span>
          <strong>Pendaftaran Peserta OJT</strong>
        </div>

        {/* KARTU INFORMASI */}

        <section className="reg-summary-grid">
          <SummaryCard
            icon="lock"
            color="green"
            label="Status Pendaftaran"
            value="Dry Run Only"
            text="Pendaftaran asli nonaktif. Simulasi tetap dapat digunakan."
          />

          <SummaryCard
            icon="calendar"
            color="blue"
            label="Periode Program"
            value="12 Sep 2026 – 06 Mar 2027"
            text="Kalender Global Week 01–25."
          />

          <SummaryCard
            icon="users"
            color="gold"
            label="Alur Persetujuan"
            value="Peserta → Mentor → Admin"
            text="Persetujuan menggunakan sistem yang sudah berlaku."
          />

          <SummaryCard
            icon="file"
            color="teal"
            label="Program OJT"
            value="Week 01 – Week 25"
            text="Monitoring dan evaluasi selama 25 minggu."
          />
        </section>

        {/* PEMBERITAHUAN KEAMANAN */}

        <section className="reg-notice">
          <div className="reg-notice-icon">
            <Icon name="shield" size={22} />
          </div>

          <div>
            <strong>
              Mode Pengujian Pendaftaran Mentor
            </strong>

            <p>
              Pendaftaran asli masih dinonaktifkan.
              Simulasi dan pengujian API tidak membuat
              akun maupun program OJT baru.
            </p>
          </div>

          <span className="reg-notice-badge">
            REGISTRATION LOCKED
          </span>
        </section>

        {/* GRID FORMULIR DAN INFORMASI */}

        <div className="reg-main-grid">

          {/* FORMULIR */}

          <section className="reg-card reg-form-card">
            <SectionHeading
              icon="user"
              title="Formulir Pendaftaran Peserta OJT"
              description="Masukkan data calon peserta untuk pengujian validasi pendaftaran."
            />

            <form onSubmit={runSimulation}>

              <div className="reg-subheading">
                <span>01</span>
                <div>
                  <strong>Identitas Peserta</strong>
                  <small>
                    Data calon peserta OJT.
                  </small>
                </div>
              </div>

              <div className="reg-form-grid">
                <FormField
                  label="Nama Lengkap Peserta"
                  icon="user"
                >
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="Masukkan nama lengkap"
                    value={form.full_name}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "full_name",
                        event.target.value
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Email Peserta"
                  icon="mail"
                >
                  <input
                    type="email"
                    required
                    maxLength={254}
                    placeholder="nama@example.com"
                    value={form.email}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "email",
                        event.target.value
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Departemen"
                  icon="users"
                >
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={form.department}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "department",
                        event.target.value
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Site Penempatan"
                  icon="map"
                >
                  <select
                    required
                    value={form.site}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "site",
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Pilih Site Penempatan
                    </option>

                    {SITE_OPTIONS.map((site) => (
                      <option
                        key={site}
                        value={site}
                      >
                        {site}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="reg-inline-info">
                <Icon name="info" size={17} />

                <span>
                  Data yang dimasukkan hanya digunakan
                  untuk simulasi. Pengujian tidak
                  membuat akun peserta.
                </span>
              </div>

              {/* PERIODE PROGRAM */}

              <div className="reg-subheading second">
                <span>02</span>
                <div>
                  <strong>
                    Jadwal Program OJT
                  </strong>
                  <small>
                    Mengikuti Kalender Global 2026–2027.
                  </small>
                </div>
              </div>

              <div className="reg-fixed-period">
                <div className="reg-fixed-title">
                  <Icon name="calendar" size={18} />
                  Jadwal Program OJT (Fixed)
                </div>

                <div className="reg-fixed-grid">
                  <div className="reg-date-box">
                    <Icon name="calendar" size={22} />

                    <div>
                      <span>Tanggal Mulai OJT</span>
                      <strong>
                        12 September 2026
                      </strong>
                      <small>Week 01</small>
                    </div>

                    <Icon name="lock" size={16} />
                  </div>

                  <div className="reg-date-box">
                    <Icon name="flag" size={22} />

                    <div>
                      <span>
                        Tanggal Selesai Program
                      </span>
                      <strong>
                        6 Maret 2027
                      </strong>
                      <small>Week 25</small>
                    </div>

                    <Icon name="lock" size={16} />
                  </div>
                </div>

                <p>
                  <Icon name="info" size={16} />
                  Periode tetap mengikuti Kalender Global
                  Week 01–25. Tanggal tidak dapat diubah
                  melalui formulir Mentor.
                </p>
              </div>

              {/* ERROR */}

              {error && (
                <div
                  className="reg-alert error"
                  role="alert"
                >
                  <Icon name="alert" size={19} />
                  <span>{error}</span>
                </div>
              )}

              {/* AKSI */}

              <div className="reg-form-actions">
                <button
                  type="submit"
                  className="reg-button-primary"
                  disabled={saving || testing}
                >
                  <Icon name="check" size={18} />

                  {saving
                    ? "Menjalankan Simulasi..."
                    : "Jalankan Simulasi Pendaftaran"}

                  {!saving && (
                    <Icon name="arrow" size={17} />
                  )}
                </button>

                <button
                  type="button"
                  className="reg-button-disabled"
                  disabled={true}
                >
                  <Icon name="lock" size={17} />
                  Daftarkan Peserta Asli
                </button>
              </div>

              <p className="reg-form-footnote">
                Simulasi dilakukan tanpa membuat akun,
                peserta baru, atau program OJT.
              </p>
            </form>

            {/* HASIL SIMULASI */}

            {result?.dry_run === true && (
              <section
                className="reg-simulation-result"
                role="status"
              >
                <div className="reg-result-head">
                  <div className="reg-result-icon">
                    <Icon name="check" size={23} />
                  </div>

                  <div>
                    <h3>Simulasi Berhasil</h3>
                    <p>
                      Server mengonfirmasi mode dry run.
                    </p>
                  </div>
                </div>

                <div className="reg-preview-grid">
                  <PreviewItem
                    label="Nama Peserta"
                    value={result.preview?.full_name}
                  />

                  <PreviewItem
                    label="Email"
                    value={result.preview?.email}
                  />

                  <PreviewItem
                    label="Departemen"
                    value={result.preview?.department}
                  />

                  <PreviewItem
                    label="Site"
                    value={result.preview?.site}
                  />

                  <PreviewItem
                    label="Tanggal Mulai"
                    value={formatDate(
                      result.preview?.start_date
                    )}
                  />

                  <PreviewItem
                    label="Tanggal Selesai"
                    value={formatDate(
                      result.preview?.end_date
                    )}
                  />

                  <PreviewItem
                    label="Status Program"
                    value={result.preview?.status}
                  />
                </div>

                <div className="reg-result-confirm">
                  <Icon name="shield" size={17} />
                  Tidak ada akun atau program OJT yang
                  dibuat melalui simulasi ini.
                </div>
              </section>
            )}
          </section>

          {/* SIDEBAR */}

          <aside className="reg-side">

            {/* TIMELINE */}

            <section className="reg-card">
              <SectionHeading
                icon="calendar"
                title="Program OJT 2026–2027"
                description="Timeline Kalender Global Week 01–25."
              />

              <div className="reg-timeline-labels">
                <span>Mulai · Week 01</span>
                <span>Selesai · Week 25</span>
              </div>

              <div className="reg-week-timeline">
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => (
                    <div
                      key={index}
                      className={
                        "reg-week-node " +
                        (index === 0 ||
                        index === TOTAL_WEEKS - 1
                          ? "endpoint"
                          : "")
                      }
                    >
                      <div />
                      <small>
                        {String(index + 1).padStart(
                          2,
                          "0"
                        )}
                      </small>
                    </div>
                  )
                )}
              </div>

              <p className="reg-timeline-caption">
                12 September 2026 – 6 Maret 2027
              </p>
            </section>

            {/* INFORMASI MENTOR */}

            <section className="reg-card">
              <SectionHeading
                icon="users"
                title="Informasi Pendaftaran"
                description="Identitas pengguna dan status modul."
              />

              <div className="reg-info-list">
                <div>
                  <small>Status Modul</small>
                  <strong className="reg-text-amber">
                    Mode Pengujian
                  </strong>
                </div>

                <div>
                  <small>Pengguna Aktif</small>
                  <strong>
                    {mentor.full_name || "Mentor OJT"}
                  </strong>
                </div>

                <div>
                  <small>Hak Akses</small>
                  <strong>Mentor OJT</strong>
                </div>

                <div>
                  <small>Periode Program</small>
                  <strong>Week 01–25</strong>
                </div>

                <div>
                  <small>Organisasi</small>
                  <strong>
                    Emergency Response Group
                  </strong>
                </div>
              </div>
            </section>

            {/* ALUR PENDAFTARAN */}

            <section className="reg-card">
              <SectionHeading
                icon="clipboard"
                title="Alur Pendaftaran"
                description="Mekanisme pengajuan peserta OJT."
              />

              <div className="reg-process-list">
                {[
                  {
                    title: "Pendaftaran Peserta",
                    text: "Data peserta diisi melalui formulir pendaftaran.",
                  },
                  {
                    title: "Verifikasi Data",
                    text: "Data pengajuan diperiksa sesuai aturan sistem.",
                  },
                  {
                    title: "Persetujuan Mentor",
                    text: "Mentor meninjau kelengkapan pengajuan peserta.",
                  },
                  {
                    title: "Persetujuan Admin",
                    text: "Administrator melakukan verifikasi sesuai kewenangan.",
                  },
                  {
                    title: "Akses Program OJT",
                    text: "Akses mengikuti hasil persetujuan dalam sistem.",
                  },
                ].map((step, index) => (
                  <div
                    className="reg-process-item"
                    key={index}
                  >
                    <span
                      className={
                        "reg-process-number color-" +
                        index
                      }
                    >
                      {index + 1}
                    </span>

                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="reg-link-button"
                onClick={() =>
                  navigate(
                    "/mentor/persetujuan-peserta"
                  )
                }
              >
                Lihat Persetujuan Peserta
                <Icon name="arrow" size={17} />
              </button>
            </section>

            {/* KEAMANAN API */}

            <section className="reg-card">
              <SectionHeading
                icon="shield"
                title="Pengujian Keamanan API"
                description="Periksa penguncian pendaftaran asli."
              />

              <div className="reg-security-box">
                <Icon name="lock" size={21} />

                <div>
                  <strong>Registration Lock</strong>
                  <small>
                    Server harus menolak permintaan
                    pendaftaran asli ketika fitur terkunci.
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="reg-button-security"
                onClick={testSecurity}
                disabled={saving || testing}
              >
                <Icon name="shield" size={17} />

                {testing
                  ? "Sedang Menguji..."
                  : "Uji Pengaman API"}
              </button>

              {securityResult && (
                <div
                  className={
                    "reg-security-result " +
                    (securityResult.passed
                      ? "passed"
                      : "failed")
                  }
                  role="status"
                >
                  <strong>
                    {securityResult.passed
                      ? "✓ Pengaman API Berfungsi"
                      : "Pengujian Perlu Diperiksa"}
                  </strong>

                  <p>
                    HTTP Status:{" "}
                    <b>{securityResult.status}</b>
                  </p>

                  <p>{securityResult.message}</p>

                  {securityResult.passed && (
                    <small>
                      Server menolak permintaan sesuai
                      respons pengujian yang diharapkan.
                    </small>
                  )}
                </div>
              )}
            </section>

            <button
              type="button"
              className="reg-back"
              onClick={() => navigate("/")}
            >
              <Icon name="back" size={17} />
              Kembali ke Dashboard Mentor
            </button>
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
      </main>
    </div>
  );
}

// ======================================================
// CSS MODERN CORPORATE DASHBOARD
// ======================================================

const css = `
.reg-app,
.reg-app * {
  box-sizing: border-box;
}

.reg-app {
  min-height: 100vh;
  background: #edf3f7;
  color: #173654;
  font-family: Arial, Helvetica, sans-serif;
}

.reg-app button,
.reg-app input,
.reg-app select {
  font-family: inherit;
}

.reg-app button {
  cursor: pointer;
}

.reg-app button:disabled {
  cursor: not-allowed;
  opacity: .52;
}

.reg-app button:focus-visible,
.reg-app input:focus-visible,
.reg-app select:focus-visible {
  outline: 3px solid #60d8bd;
  outline-offset: 2px;
}

/* TOP NAVIGATION */

.reg-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 76px;
  padding: 11px 29px;
  background: #081e35;
  border-bottom: 1px solid #ffffff2c;
  color: white;
  box-shadow: 0 5px 20px #0a294024;
}

.reg-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: white;
  text-align: left;
}

.reg-brand-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: 1px solid #49cbb88a;
  border-radius: 11px;
  background: #0c78736e;
  color: #71e8c7;
}

.reg-brand-copy strong {
  display: block;
  font-size: 21px;
  white-space: nowrap;
  letter-spacing: -.4px;
}

.reg-brand-copy strong em {
  font-style: normal;
  color: #5de1c1;
}

.reg-brand-copy strong small {
  margin-left: 7px;
  padding: 4px 6px;
  border-radius: 5px;
  background: #5be2c2;
  color: #073647;
  font-size: 10px;
}

.reg-brand-copy > span {
  display: block;
  margin-top: 5px;
  color: #c4d8e4;
  font-size: 8px;
  letter-spacing: 1px;
  font-weight: 800;
}

.reg-navigation {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.reg-navigation button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #c7dae5;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.reg-navigation button:hover {
  background: #ffffff18;
}

.reg-navigation button.active {
  background: #0c807b;
  color: white;
  box-shadow: inset 0 -2px #68ecd2;
}

.reg-account {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.reg-account-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 37px;
  height: 37px;
  border-radius: 50%;
  background: #d8f6eb;
  color: #08795d;
  font-size: 12px;
  font-weight: 900;
}

.reg-account-info {
  min-width: 0;
}

.reg-account-info strong {
  display: block;
  max-width: 155px;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.reg-account-info small {
  display: block;
  margin-top: 4px;
  color: #b3cbd6;
  font-size: 10px;
}

.reg-mobile-toggle {
  display: none;
  border: 0;
  background: transparent;
  color: white;
}

/* CONTAINER */

.reg-container {
  max-width: 1500px;
  margin: 0 auto;
  padding: 23px;
}

/* HERO BANNER */

.reg-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 30px;
  min-height: 230px;
  padding: 30px 34px;
  border-radius: 16px;
  background-color: #0c2d47;
  background-size: cover;
  background-position: center 44%;
  overflow: hidden;
  color: white;
  box-shadow: 0 9px 27px #12385220;
}

.reg-hero-content {
  max-width: 750px;
}

.reg-kicker {
  color: #e6c17a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.reg-hero h1 {
  margin: 12px 0;
  font-size: clamp(29px,3.3vw,44px);
  letter-spacing: -.8px;
  line-height: 1.15;
}

.reg-hero h1 span {
  color: #5be3c2;
}

.reg-hero p {
  max-width: 620px;
  margin: 0;
  color: #e0ebef;
  font-size: 12px;
  line-height: 1.8;
}

.reg-hero-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.reg-hero-meta span {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid #ffffff4c;
  border-radius: 20px;
  background: #092b42a8;
  color: #e4f4f0;
  font-size: 10px;
  font-weight: 750;
}

.reg-hero-meta svg {
  color: #83e7c9;
}

.reg-hero-status {
  display: grid;
  justify-items: center;
  gap: 9px;
  flex-shrink: 0;
  min-width: 175px;
  padding: 18px 16px;
  border: 1px solid #ffffff5b;
  border-radius: 13px;
  background: #062641c7;
  text-align: center;
}

.reg-status-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  background: #e2f5ed;
  color: #108868;
}

.reg-hero-status small {
  color: #aacbd9;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
}

.reg-hero-status strong {
  font-size: 17px;
}

.reg-hero-status > span {
  color: #d6e5ea;
  font-size: 10px;
}

/* BREADCRUMB */

.reg-breadcrumb {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 15px 3px;
  font-size: 11px;
  color: #8ba2af;
}

.reg-breadcrumb button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #6c8595;
  font-weight: 750;
}

.reg-breadcrumb strong {
  color: #087c75;
}

/* FOUR SUMMARY CARDS */

.reg-summary-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 13px;
  margin-bottom: 16px;
}

.reg-summary-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 125px;
  padding: 17px;
  border: 1px solid #dce7ee;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 6px 20px #0d355015;
}

.reg-summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border-radius: 11px;
}

.reg-summary-icon.green {
  background: #def8ed;
  color: #078c67;
}

.reg-summary-icon.blue {
  background: #e0effe;
  color: #1979bf;
}

.reg-summary-icon.gold {
  background: #fff1d8;
  color: #be891c;
}

.reg-summary-icon.teal {
  background: #ddf7f4;
  color: #068e89;
}

.reg-summary-content {
  min-width: 0;
}

.reg-summary-content > span {
  display: block;
  color: #73899b;
  font-size: 10px;
}

.reg-summary-content > strong {
  display: block;
  margin-top: 6px;
  color: #123d6b;
  font-size: 13px;
  line-height: 1.35;
  font-weight: 900;
}

.reg-summary-content > p {
  margin: 7px 0 0;
  color: #73869a;
  font-size: 10px;
  line-height: 1.55;
}

/* MODE NOTICE */

.reg-notice {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 18px;
  margin-bottom: 17px;
  border: 1px solid #c7e4ed;
  border-radius: 12px;
  background: #eaf6fa;
}

.reg-notice-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #d8ebf5;
  color: #2577a1;
}

.reg-notice > div:nth-child(2) {
  flex: 1;
}

.reg-notice strong {
  color: #225b7a;
  font-size: 12px;
}

.reg-notice p {
  margin: 5px 0 0;
  color: #5e8191;
  font-size: 11px;
  line-height: 1.6;
}

.reg-notice-badge {
  padding: 8px 10px;
  border-radius: 7px;
  background: #d8eaf3;
  color: #2a6d8d;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

/* MAIN GRID */

.reg-main-grid {
  display: grid;
  grid-template-columns: minmax(0,1.15fr) minmax(0,.85fr);
  align-items: start;
  gap: 16px;
}

.reg-card {
  min-width: 0;
  padding: 21px;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  background: white;
  box-shadow: 0 6px 20px #17384d0d;
}

.reg-form-card {
  padding: 22px;
}

.reg-side {
  display: grid;
  gap: 15px;
}

/* SECTION HEADING */

.reg-section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.reg-heading-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 41px;
  height: 41px;
  border-radius: 9px;
  background: linear-gradient(135deg,#10487e,#188bcb);
  color: white;
}

.reg-section-heading h2 {
  margin: 0;
  color: #123e70;
  font-size: 17px;
  line-height: 1.3;
}

.reg-section-heading p {
  margin: 5px 0 0;
  color: #7d91a2;
  font-size: 11px;
  line-height: 1.5;
}

/* FORM */

.reg-subheading {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 5px 0 17px;
}

.reg-subheading.second {
  margin-top: 23px;
  padding-top: 19px;
  border-top: 1px solid #e6eef3;
}

.reg-subheading > span {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 33px;
  height: 33px;
  border-radius: 9px;
  background: #09877c;
  color: white;
  font-size: 11px;
  font-weight: 900;
}

.reg-subheading strong,
.reg-subheading small {
  display: block;
}

.reg-subheading strong {
  color: #244660;
  font-size: 13px;
}

.reg-subheading small {
  margin-top: 5px;
  color: #8799a8;
  font-size: 10px;
}

.reg-form-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 15px 12px;
}

.reg-field {
  display: block;
  min-width: 0;
}

.reg-label {
  display: block;
  margin-bottom: 8px;
  color: #304b68;
  font-size: 11px;
  font-weight: 900;
}

.reg-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 11px;
  border: 1px solid #d5e2eb;
  border-radius: 8px;
  background: #fdfefe;
  color: #7f99ac;
}

.reg-input-wrap:focus-within {
  border-color: #099c8f;
  box-shadow: 0 0 0 3px #099c8f15;
}

.reg-input-wrap > svg {
  flex-shrink: 0;
}

.reg-input-wrap input,
.reg-input-wrap select {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #173b5a;
  font-size: 12px;
}

.reg-input-wrap input::placeholder {
  color: #9cabb9;
}

.reg-hint {
  display: block;
  margin-top: 6px;
  color: #8195a3;
  font-size: 10px;
}

/* INLINE INFORMATION */

.reg-inline-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 15px;
  padding: 11px 13px;
  border-radius: 8px;
  background: #f1faf7;
  color: #4e8273;
  font-size: 10px;
  line-height: 1.6;
}

.reg-inline-info svg {
  flex-shrink: 0;
}

/* FIXED PROGRAM PERIOD */

.reg-fixed-period {
  padding: 15px;
  border: 1px solid #d0e7f4;
  border-radius: 10px;
  background: #eaf6fd;
}

.reg-fixed-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #145484;
  font-size: 12px;
  font-weight: 900;
}

.reg-fixed-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.reg-date-box {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background: #dceefd;
  color: #206b9e;
}

.reg-date-box > div {
  min-width: 0;
  flex: 1;
}

.reg-date-box span,
.reg-date-box small {
  display: block;
  font-size: 9px;
}

.reg-date-box strong {
  display: block;
  margin: 6px 0;
  color: #123e70;
  font-size: 12px;
}

.reg-fixed-period > p {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 12px 0 0;
  color: #3b78a0;
  font-size: 10px;
  line-height: 1.6;
}

.reg-fixed-period > p svg {
  flex-shrink: 0;
}

/* FORM BUTTONS */

.reg-form-actions {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 10px;
  margin-top: 20px;
}

.reg-button-primary,
.reg-button-disabled,
.reg-button-security {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 45px;
  padding: 11px;
  border: 0;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 900;
}

.reg-button-primary {
  background: linear-gradient(100deg,#08776f,#09a69a);
  color: white;
}

.reg-button-primary:hover:not(:disabled) {
  background: #08786d;
}

.reg-button-disabled {
  background: #e6edf2;
  color: #8497a7;
}

.reg-form-footnote {
  margin: 13px 0 0;
  color: #8a9dac;
  text-align: center;
  font-size: 10px;
  line-height: 1.6;
}

/* ERRORS */

.reg-alert {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 15px;
  padding: 13px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.6;
}

.reg-alert.error {
  border: 1px solid #f7c8c8;
  background: #fff2f2;
  color: #b52d2d;
}

/* SIMULATION RESULT */

.reg-simulation-result {
  margin-top: 23px;
  padding: 17px;
  border: 1px solid #b9e5ce;
  border-radius: 11px;
  background: #f0faf5;
}

.reg-result-head {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 15px;
}

.reg-result-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #d7f4e4;
  color: #098a60;
}

.reg-result-head h3 {
  margin: 0;
  color: #087b56;
  font-size: 15px;
}

.reg-result-head p {
  margin: 5px 0 0;
  color: #668b79;
  font-size: 11px;
}

.reg-preview-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 9px;
}

.reg-preview-item {
  padding: 11px;
  min-width: 0;
  border: 1px solid #d8ebe0;
  border-radius: 8px;
  background: white;
}

.reg-preview-item span,
.reg-preview-item strong {
  display: block;
}

.reg-preview-item span {
  color: #83998c;
  font-size: 10px;
}

.reg-preview-item strong {
  margin-top: 6px;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.reg-result-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 13px;
  color: #0d8058;
  font-size: 10px;
  font-weight: 800;
}

/* PROGRAM TIMELINE */

.reg-timeline-labels {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 27px;
  color: #078477;
  font-size: 10px;
  font-weight: 900;
}

.reg-week-timeline {
  position: relative;
  display: flex;
  align-items: flex-start;
  margin-top: 18px;
}

.reg-week-timeline::before {
  content: "";
  position: absolute;
  top: 5px;
  left: 1%;
  right: 1%;
  height: 3px;
  background: #2cbfc1;
}

.reg-week-node {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  text-align: center;
}

.reg-week-node > div {
  width: 9px;
  height: 9px;
  margin: 1px auto 8px;
  border: 2px solid #1bb0bb;
  border-radius: 50%;
  background: #d7fcfc;
}

.reg-week-node.endpoint > div {
  width: 15px;
  height: 15px;
  margin-top: -2px;
  margin-bottom: 5px;
  border: 3px solid #087c81;
  background: #09a69c;
}

.reg-week-node small {
  display: block;
  color: #7894aa;
  font-size: 7px;
}

.reg-timeline-caption {
  margin: 16px 0 0;
  color: #64849b;
  text-align: center;
  font-size: 10px;
}

/* INFORMATION LIST */

.reg-info-list > div {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf2f5;
}

.reg-info-list > div:last-child {
  border-bottom: 0;
}

.reg-info-list small {
  color: #8295a4;
  font-size: 10px;
}

.reg-info-list strong {
  color: #244965;
  font-size: 11px;
  text-align: right;
  overflow-wrap: anywhere;
}

.reg-info-list .reg-text-amber {
  color: #ad771f;
}

/* APPROVAL PROCESS */

.reg-process-list {
  display: grid;
  gap: 16px;
}

.reg-process-item {
  display: flex;
  align-items: flex-start;
  gap: 11px;
}

.reg-process-number {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 29px;
  height: 29px;
  border-radius: 50%;
  background: #177ec4;
  color: white;
  font-size: 11px;
  font-weight: 900;
}

.reg-process-number.color-1,
.reg-process-number.color-4 {
  background: #0eaa92;
}

.reg-process-number.color-2 {
  background: #d3a133;
}

.reg-process-number.color-3 {
  background: #327bd2;
}

.reg-process-item strong {
  color: #214767;
  font-size: 11px;
}

.reg-process-item p {
  margin: 5px 0 0;
  color: #7d91a1;
  font-size: 10px;
  line-height: 1.5;
}

.reg-link-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  margin-top: 18px;
  padding: 11px;
  border: 1px solid #a7d7ce;
  border-radius: 8px;
  background: #ebf9f5;
  color: #087e73;
  font-size: 11px;
  font-weight: 900;
}

/* SECURITY API */

.reg-security-box {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 13px;
  padding: 13px;
  border-radius: 9px;
  background: #edf6fd;
  color: #246c98;
}

.reg-security-box > svg {
  flex-shrink: 0;
}

.reg-security-box strong,
.reg-security-box small {
  display: block;
}

.reg-security-box strong {
  font-size: 12px;
}

.reg-security-box small {
  margin-top: 5px;
  font-size: 10px;
  line-height: 1.5;
}

.reg-button-security {
  width: 100%;
  background: #176ab4;
  color: white;
}

.reg-button-security:hover:not(:disabled) {
  background: #13568f;
}

.reg-security-result {
  margin-top: 13px;
  padding: 12px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.reg-security-result strong {
  display: block;
}

.reg-security-result p {
  margin: 7px 0;
}

.reg-security-result.passed {
  border: 1px solid #bee5cf;
  background: #eefaf3;
  color: #08794d;
}

.reg-security-result.failed {
  border: 1px solid #f6c9c9;
  background: #fff1f1;
  color: #b32d2d;
}

/* BACK BUTTON */

.reg-back {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  min-height: 44px;
  padding: 11px;
  border: 1px solid #b8dcd1;
  border-radius: 9px;
  background: #e7f6f1;
  color: #087c67;
  font-size: 11px;
  font-weight: 900;
}

.reg-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 23px;
  padding: 15px 2px;
  border-top: 1px solid #d9e4ec;
  color: #8195a5;
  font-size: 10px;
}

/* LOADING */

.reg-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background: #edf4f7;
  font-family: Arial, sans-serif;
  text-align: center;
  color: #15394e;
}

.reg-loading h2 span {
  color: #078e72;
}

.reg-loading p {
  color: #718a9c;
}

.reg-loading button {
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: #078977;
  color: white;
  cursor: pointer;
}

/* TABLET */

@media(max-width:1200px) {
  .reg-topbar {
    gap: 10px;
    padding: 11px 17px;
  }

  .reg-navigation button {
    padding: 10px 8px;
    font-size: 10px;
  }

  .reg-summary-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .reg-main-grid {
    grid-template-columns: minmax(0,1.05fr) minmax(0,.95fr);
  }
}

@media(max-width:1000px) {
  .reg-main-grid {
    grid-template-columns: 1fr;
  }

  .reg-side {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .reg-side .reg-back {
    grid-column: 1 / -1;
  }

  .reg-navigation {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    padding: 12px;
    background: #0b2943;
    border-bottom: 1px solid #ffffff2d;
  }

  .reg-navigation.open {
    display: grid;
  }

  .reg-navigation button {
    font-size: 12px;
    padding: 12px;
  }

  .reg-account {
    margin-left: auto;
  }

  .reg-mobile-toggle {
    display: grid;
    place-items: center;
    padding: 8px;
  }
}

/* MOBILE */

@media(max-width:700px) {
  .reg-container {
    padding: 11px;
  }

  .reg-topbar {
    min-height: 65px;
    padding: 10px 12px;
  }

  .reg-brand-copy strong {
    font-size: 16px;
  }

  .reg-brand-copy > span {
    font-size: 6.5px;
  }

  .reg-brand-icon {
    width: 35px;
    height: 35px;
  }

  .reg-account-info {
    display: none;
  }

  .reg-hero {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 23px 18px;
  }

  .reg-hero h1 {
    font-size: 29px;
  }

  .reg-hero-status {
    width: 100%;
  }

  .reg-summary-grid {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .reg-summary-card {
    min-height: 0;
    padding: 13px;
  }

  .reg-notice {
    flex-wrap: wrap;
    padding: 13px;
  }

  .reg-card {
    padding: 15px;
  }

  .reg-form-grid {
    grid-template-columns: 1fr;
  }

  .reg-fixed-grid {
    grid-template-columns: 1fr;
  }

  .reg-form-actions {
    grid-template-columns: 1fr;
  }

  .reg-preview-grid {
    grid-template-columns: 1fr;
  }

  .reg-side {
    grid-template-columns: 1fr;
  }

  .reg-side .reg-back {
    grid-column: auto;
  }

  .reg-section-heading h2 {
    font-size: 15px;
  }

  .reg-footer {
    flex-direction: column;
    text-align: center;
  }

  .reg-week-node small {
    font-size: 5.5px;
  }

  .reg-week-node > div {
    width: 7px;
    height: 7px;
  }
}

@media print {
  .reg-topbar,
  .reg-breadcrumb,
  .reg-form-actions,
  .reg-button-security,
  .reg-back {
    display: none !important;
  }

  .reg-card {
    break-inside: avoid;
    box-shadow: none;
  }

  .reg-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;
