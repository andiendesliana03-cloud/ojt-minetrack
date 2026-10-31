
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// PENDAFTARAN PESERTA — CORPORATE MINING
// Pendaftaran asli tetap NONAKTIF
// ======================================================

const REGISTRATION_ENABLED = false;

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
  start_date: "",
  end_date: "",
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

function FormField({ label, children, hint }) {
  return (
    <label className="reg-field">
      <span className="reg-label">{label}</span>
      {children}
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
  // AUTENTIKASI — KHUSUS MENTOR
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

        if (active) {
          setMentor(profile);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memeriksa akses mentor."
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
      return "Tanggal mulai dan selesai wajib diisi.";
    }

    if (form.end_date < form.start_date) {
      return "Tanggal selesai tidak boleh lebih awal dari tanggal mulai.";
    }

    return "";
  }

  // ====================================================
  // SIMULASI PENDAFTARAN — DRY RUN
  // TIDAK MEMBUAT AKUN / PROGRAM
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
            start_date: form.start_date,
            end_date: form.end_date,
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
        err?.message || "Terjadi kesalahan simulasi."
      );
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // PENGUJIAN PENGAMAN API
  // PERMINTAAN TANPA TOKEN & TANPA DATA PESERTA
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
          data.error || "Server tidak memberikan pesan.",
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

  // ====================================================
  // NAVIGASI
  // ====================================================

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
  // LOADING & ACCESS
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
          <p>{error || "Halaman khusus Mentor OJT."}</p>
          <button onClick={() => router.push("/")}>
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ====================================================
  // TAMPILAN UTAMA
  // ====================================================

  return (
    <div className="reg-app">
      <style>{css}</style>

      {/* TOP NAVIGATION */}

      <header className="reg-topbar">
        <button
          type="button"
          className="reg-brand"
          onClick={() => navigate("/")}
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <nav
          className={`reg-navigation ${
            mobileMenu ? "open" : ""
          }`}
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
            <strong>{mentor.full_name || "Mentor OJT"}</strong>
            <small>Mentor OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="reg-mobile-toggle"
          aria-label={mobileMenu ? "Tutup menu" : "Buka menu"}
          aria-expanded={mobileMenu}
          onClick={() => setMobileMenu((value) => !value)}
        >
          <Icon name={mobileMenu ? "x" : "menu"} size={23} />
        </button>
      </header>

      <main className="reg-container">

        {/* HERO CORPORATE MINING */}

        <section className="reg-hero">
          <div className="reg-hero-content">
            <div className="reg-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Pendaftaran <span>Peserta OJT</span>
            </h1>

            <p>
              Pengelolaan data calon peserta dan simulasi
              pendaftaran program On Job Training secara
              aman dan terstruktur.
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
            </div>
          </div>

          <div className="reg-hero-status">
            <div className="reg-status-symbol">
              <Icon name="lock" size={23} />
            </div>
            <div>
              <small>STATUS PENDAFTARAN</small>
              <strong>
                {REGISTRATION_ENABLED
                  ? "Pendaftaran Aktif"
                  : "Mode Pengujian"}
              </strong>
              <span>
                {REGISTRATION_ENABLED
                  ? "Pendaftaran tersedia"
                  : "Pendaftaran asli terkunci"}
              </span>
            </div>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="reg-breadcrumb">
          <button onClick={() => navigate("/")}>
            Dashboard
          </button>
          <span>/</span>
          <strong>Pendaftaran Peserta</strong>
        </div>

        {/* MODE TESTING */}

        <section className="reg-notice">
          <div className="reg-notice-icon">
            <Icon name="shield" size={22} />
          </div>

          <div>
            <strong>Mode Pengujian Aktif</strong>
            <p>
              Pendaftaran peserta asli sedang dinonaktifkan.
              Anda tetap dapat menjalankan simulasi dan menguji
              keamanan API tanpa membuat akun atau program OJT baru.
            </p>
          </div>

          <span className="reg-notice-badge">
            DRY RUN ONLY
          </span>
        </section>

        {/* MAIN GRID */}

        <div className="reg-main-grid">

          {/* FORMULIR */}

          <section className="reg-card reg-form-card">
            <div className="reg-section-head">
              <div className="reg-section-icon">
                <Icon name="clipboard" size={21} />
              </div>

              <div>
                <h2>Formulir Pendaftaran Peserta</h2>
                <p>
                  Lengkapi identitas dan informasi
                  penempatan program OJT.
                </p>
              </div>
            </div>

            <div className="reg-step-heading">
              <span>01</span>
              <div>
                <strong>Identitas Peserta</strong>
                <small>
                  Data calon peserta yang akan disimulasikan.
                </small>
              </div>
            </div>

            <form onSubmit={runSimulation}>
              <div className="reg-form-grid">

                <FormField label="Nama Lengkap Peserta">
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={120}
                    placeholder="Masukkan nama lengkap peserta"
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

                <FormField label="Email Peserta">
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

                <FormField label="Departemen">
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

                <FormField label="Site Penempatan OJT">
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
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="reg-inline-note">
                <Icon name="info" size={17} />
                <span>
                  Site penempatan ditentukan pada awal
                  program dan digunakan selama periode OJT.
                </span>
              </div>

              <div className="reg-step-heading second">
                <span>02</span>
                <div>
                  <strong>Periode Program OJT</strong>
                  <small>
                    Tentukan tanggal mulai dan selesai
                    program peserta.
                  </small>
                </div>
              </div>

              <div className="reg-form-grid">
                <FormField label="Tanggal Mulai OJT">
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "start_date",
                        event.target.value
                      )
                    }
                  />
                </FormField>

                <FormField label="Tanggal Selesai OJT">
                  <input
                    type="date"
                    required
                    min={form.start_date || undefined}
                    value={form.end_date}
                    disabled={saving || testing}
                    onChange={(event) =>
                      updateForm(
                        "end_date",
                        event.target.value
                      )
                    }
                  />
                </FormField>
              </div>

              <div className="reg-calendar-notice">
                <Icon name="calendar" size={20} />
                <div>
                  <strong>Kalender Global OJT</strong>
                  <p>
                    Kalender monitoring menggunakan
                    Week 01–25 secara global.
                    Tanggal mulai dan selesai peserta
                    tetap disimpan sesuai periode
                    masing-masing.
                  </p>
                </div>
              </div>

              {error && (
                <div
                  className="reg-alert error"
                  role="alert"
                >
                  <Icon name="alert" size={19} />
                  <span>{error}</span>
                </div>
              )}

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
                </button>

                <button
                  type="button"
                  className="reg-button-disabled"
                  disabled={
                    !REGISTRATION_ENABLED ||
                    saving ||
                    testing
                  }
                >
                  <Icon name="lock" size={17} />
                  Daftarkan Peserta Asli
                </button>
              </div>

              <p className="reg-form-footnote">
                Simulasi tidak membuat akun,
                menyimpan peserta baru,
                atau membuat program OJT.
              </p>
            </form>

            {/* RESULT SIMULASI */}

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
                      Validasi data dan akses mentor
                      berhasil diperiksa.
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
                  Server mengonfirmasi mode simulasi.
                  Tidak ada akun atau program OJT yang dibuat.
                </div>
              </section>
            )}
          </section>

          {/* SIDEBAR INFORMASI */}

          <aside className="reg-side">

            <section className="reg-card">
              <div className="reg-side-title">
                <div className="reg-section-icon">
                  <Icon name="info" size={20} />
                </div>

                <h2>Informasi Pendaftaran</h2>
              </div>

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
                  <small>Organisasi</small>
                  <strong>
                    Emergency Response Group
                  </strong>
                </div>

                <div>
                  <small>Perusahaan</small>
                  <strong>PT Berau Coal</strong>
                </div>
              </div>
            </section>

            {/* PENGAMAN API */}

            <section className="reg-card">
              <div className="reg-side-title">
                <div className="reg-section-icon blue">
                  <Icon name="shield" size={21} />
                </div>

                <h2>Pengujian Keamanan API</h2>
              </div>

              <p className="reg-side-description">
                Verifikasi bahwa server menolak
                permintaan pendaftaran asli
                ketika fitur masih dikunci.
              </p>

              <div className="reg-security-box">
                <Icon name="lock" size={20} />
                <div>
                  <strong>Registration Lock</strong>
                  <small>
                    Server harus menolak permintaan
                    pendaftaran asli.
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
                  ? "Sedang Menguji Pengaman..."
                  : "Uji Pengaman API"}
              </button>

              {securityResult && (
                <div
                  className={`reg-security-result ${
                    securityResult.passed
                      ? "passed"
                      : "failed"
                  }`}
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

                  <p>
                    {securityResult.message}
                  </p>

                  {securityResult.passed && (
                    <small>
                      Server menolak permintaan
                      pendaftaran asli dengan
                      respons yang diharapkan.
                    </small>
                  )}
                </div>
              )}
            </section>

            {/* ALUR PENDAFTARAN */}

            <section className="reg-card">
              <div className="reg-side-title">
                <div className="reg-section-icon">
                  <Icon name="clipboard" size={20} />
                </div>
                <h2>Alur Pendaftaran</h2>
              </div>

              <div className="reg-timeline">
                <div className="reg-timeline-item">
                  <span>01</span>
                  <div>
                    <strong>Isi Data Peserta</strong>
                    <small>
                      Identitas, departemen,
                      dan lokasi penempatan.
                    </small>
                  </div>
                </div>

                <div className="reg-timeline-item">
                  <span>02</span>
                  <div>
                    <strong>Tentukan Periode OJT</strong>
                    <small>
                      Tanggal mulai dan tanggal
                      selesai program peserta.
                    </small>
                  </div>
                </div>

                <div className="reg-timeline-item">
                  <span>03</span>
                  <div>
                    <strong>Jalankan Simulasi</strong>
                    <small>
                      Periksa validasi data
                      tanpa membuat akun.
                    </small>
                  </div>
                </div>

                <div className="reg-timeline-item">
                  <span>04</span>
                  <div>
                    <strong>Verifikasi Keamanan</strong>
                    <small>
                      Pastikan pengaman
                      pendaftaran berfungsi.
                    </small>
                  </div>
                </div>
              </div>
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
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal · Program 2026–2027
        </footer>
      </main>
    </div>
  );
}

// ======================================================
// STYLE — CORPORATE MINING
// ======================================================

const css = `
.reg-app,
.reg-app * {
  box-sizing: border-box;
}

.reg-app {
  min-height: 100vh;
  background: #f3f7f8;
  color: #142d38;
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
  opacity: .55;
}

.reg-app button:focus-visible,
.reg-app input:focus-visible,
.reg-app select:focus-visible {
  outline: 3px solid #75cdb0;
  outline-offset: 2px;
}

/* TOPBAR */

.reg-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 28px;
  background: #fff;
  border-bottom: 1px solid #e2ebef;
  box-shadow: 0 3px 16px #102d3a08;
}

.reg-brand {
  flex-shrink: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: #14283f;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -.7px;
  white-space: nowrap;
}

.reg-brand span {
  color: #07865f;
}

.reg-brand small {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #8a9ba8;
}

.reg-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;
}

.reg-navigation button {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  padding: 12px 14px;
  background: transparent;
  color: #526777;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.reg-navigation button.active,
.reg-navigation button:hover {
  background: #e6f5ee;
  color: #07835b;
}

.reg-account {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.reg-account-avatar {
  flex-shrink: 0;
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dff4e9;
  color: #087857;
  font-size: 12px;
  font-weight: 900;
}

.reg-account-info {
  min-width: 0;
}

.reg-account-info strong,
.reg-account-info small {
  display: block;
}

.reg-account-info strong {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.reg-account-info small {
  margin-top: 5px;
  font-size: 10px;
  color: #8293a0;
}

.reg-mobile-toggle {
  display: none;
  border: 0;
  background: transparent;
  color: #173d34;
}

/* CONTAINER */

.reg-container {
  max-width: 1500px;
  margin: auto;
  padding: 24px;
}

/* HERO */

.reg-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 28px;
  min-height: 220px;
  padding: 32px;
  border-radius: 17px;
  overflow: hidden;
  color: white;
  background:
    linear-gradient(
      95deg,
      rgba(4,24,36,.98) 0%,
      rgba(5,43,47,.92) 48%,
      rgba(5,47,49,.63) 100%
    ),
    url("/background-erg.png.PNG") center/cover;
}

.reg-hero-content {
  max-width: 760px;
}

.reg-kicker {
  color: #eccb82;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.reg-hero h1 {
  margin: 14px 0 10px;
  font-size: clamp(27px,3.3vw,44px);
  line-height: 1.15;
  letter-spacing: -.7px;
}

.reg-hero h1 span {
  color: #34d19b;
}

.reg-hero p {
  margin: 0;
  max-width: 650px;
  color: #d1e5e1;
  font-size: 13px;
  line-height: 1.8;
}

.reg-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 21px;
}

.reg-hero-meta span {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: #e5f1ec;
}

.reg-hero-meta svg {
  color: #eac578;
}

.reg-hero-status {
  display: flex;
  align-items: center;
  gap: 13px;
  flex-shrink: 0;
  padding: 18px;
  border: 1px solid #ffffff40;
  border-radius: 13px;
  background: #05272dd9;
}

.reg-status-symbol {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 45px;
  height: 45px;
  border-radius: 11px;
  background: #d6f2e5;
  color: #087453;
}

.reg-hero-status small,
.reg-hero-status strong,
.reg-hero-status span {
  display: block;
}

.reg-hero-status small {
  font-size: 9px;
  letter-spacing: .6px;
  color: #a9cbc5;
}

.reg-hero-status strong {
  margin-top: 7px;
  font-size: 15px;
}

.reg-hero-status span {
  margin-top: 6px;
  font-size: 10px;
  color: #c2dbd5;
}

/* BREADCRUMB */

.reg-breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 15px 2px;
  color: #90a0aa;
  font-size: 11px;
}

.reg-breadcrumb button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #758c95;
  font-weight: 700;
}

.reg-breadcrumb strong {
  color: #097c59;
}

/* NOTICE */

.reg-notice {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 17px 20px;
  margin-bottom: 17px;
  background: #eaf6fb;
  border: 1px solid #c5e4ee;
  border-radius: 13px;
}

.reg-notice-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 11px;
  background: #d3eaf6;
  color: #236c91;
}

.reg-notice > div:nth-child(2) {
  flex: 1;
}

.reg-notice strong {
  font-size: 13px;
  color: #205d7d;
}

.reg-notice p {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: #557b8b;
}

.reg-notice-badge {
  border-radius: 6px;
  padding: 8px 10px;
  background: #d8ecf5;
  color: #216588;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

/* MAIN GRID */

.reg-main-grid {
  display: grid;
  grid-template-columns: minmax(0,1.8fr) minmax(300px,.85fr);
  gap: 17px;
  align-items: start;
}

.reg-card {
  min-width: 0;
  padding: 23px;
  margin-bottom: 17px;
  background: white;
  border: 1px solid #e1eaf0;
  border-radius: 15px;
  box-shadow: 0 5px 18px #112a3708;
}

.reg-section-head {
  display: flex;
  align-items: center;
  gap: 13px;
  padding-bottom: 20px;
  border-bottom: 1px solid #edf1f3;
  margin-bottom: 22px;
}

.reg-section-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 11px;
  background: #e0f5ea;
  color: #07835a;
}

.reg-section-icon.blue {
  background: #e6f1ff;
  color: #2875b7;
}

.reg-section-head h2 {
  margin: 0;
  font-size: 18px;
}

.reg-section-head p {
  margin: 6px 0 0;
  color: #8394a3;
  font-size: 11px;
  line-height: 1.5;
}

/* STEP HEADINGS */

.reg-step-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 6px 0 18px;
}

.reg-step-heading.second {
  padding-top: 25px;
  margin-top: 24px;
  border-top: 1px solid #e9eff1;
}

.reg-step-heading > span {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 35px;
  height: 35px;
  border-radius: 9px;
  background: #087e5b;
  color: white;
  font-size: 11px;
  font-weight: 900;
}

.reg-step-heading strong,
.reg-step-heading small {
  display: block;
}

.reg-step-heading strong {
  font-size: 14px;
}

.reg-step-heading small {
  margin-top: 5px;
  color: #8293a0;
  font-size: 11px;
}

.reg-form-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 19px 17px;
}

.reg-field {
  display: block;
  min-width: 0;
}

.reg-label {
  display: block;
  margin-bottom: 9px;
  color: #30495a;
  font-size: 12px;
  font-weight: 800;
}

.reg-field input,
.reg-field select {
  display: block;
  width: 100%;
  min-height: 45px;
  padding: 12px 13px;
  border: 1px solid #d9e5e9;
  border-radius: 9px;
  outline: none;
  background: #fff;
  color: #183442;
  font-size: 13px;
}

.reg-field input:focus,
.reg-field select:focus {
  border-color: #0a9a70;
  box-shadow: 0 0 0 3px #0a9a7018;
}

.reg-field input::placeholder {
  color: #a5b2bd;
}

.reg-hint {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  color: #8393a0;
}

.reg-inline-note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 9px;
  background: #f3faf6;
  color: #487766;
  font-size: 11px;
  line-height: 1.7;
}

.reg-inline-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}

.reg-calendar-notice {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 15px;
  margin-top: 21px;
  border: 1px solid #dcece4;
  border-radius: 11px;
  background: #f5fbf7;
}

.reg-calendar-notice svg {
  flex-shrink: 0;
  color: #07885c;
}

.reg-calendar-notice strong {
  font-size: 12px;
  color: #14714f;
}

.reg-calendar-notice p {
  margin: 6px 0 0;
  font-size: 11px;
  color: #658779;
  line-height: 1.7;
}

/* BUTTONS */

.reg-form-actions {
  display: flex;
  align-items: stretch;
  gap: 11px;
  margin-top: 23px;
}

.reg-button-primary,
.reg-button-disabled,
.reg-button-security {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 9px;
  border: 0;
  border-radius: 10px;
  min-height: 46px;
  padding: 13px 15px;
  font-size: 12px;
  font-weight: 850;
}

.reg-button-primary {
  flex: 1;
  background: #078960;
  color: white;
}

.reg-button-primary:hover:not(:disabled) {
  background: #067650;
}

.reg-button-disabled {
  flex: 1;
  background: #e8eef1;
  color: #82949d;
}

.reg-form-footnote {
  margin: 13px 0 0;
  text-align: center;
  font-size: 10px;
  color: #91a0a9;
  line-height: 1.6;
}

/* ALERTS */

.reg-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  margin-top: 18px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.reg-alert svg {
  flex-shrink: 0;
}

.reg-alert.error {
  color: #ae2828;
  background: #fff1f1;
  border: 1px solid #fbcaca;
}

/* SIMULATION */

.reg-simulation-result {
  margin-top: 25px;
  padding: 19px;
  border: 1px solid #b9e6cf;
  border-radius: 12px;
  background: #f0faf4;
}

.reg-result-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 17px;
}

.reg-result-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #d6f5e2;
  color: #068559;
}

.reg-result-head h3 {
  margin: 0;
  font-size: 15px;
  color: #09794f;
}

.reg-result-head p {
  margin: 6px 0 0;
  font-size: 11px;
  color: #648b77;
}

.reg-preview-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 10px;
}

.reg-preview-item {
  min-width: 0;
  padding: 12px;
  border: 1px solid #d8ecdf;
  border-radius: 8px;
  background: white;
}

.reg-preview-item span,
.reg-preview-item strong {
  display: block;
}

.reg-preview-item span {
  color: #809889;
  font-size: 10px;
}

.reg-preview-item strong {
  margin-top: 7px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.reg-result-confirm {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 15px;
  color: #0b774f;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.6;
}

/* SIDE PANELS */

.reg-side-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.reg-side-title h2 {
  margin: 0;
  font-size: 15px;
}

.reg-side-title .reg-section-icon {
  width: 38px;
  height: 38px;
}

.reg-info-list {
  display: grid;
  gap: 0;
}

.reg-info-list > div {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #eef2f4;
}

.reg-info-list > div:last-child {
  border-bottom: 0;
}

.reg-info-list small {
  color: #8193a0;
  font-size: 11px;
}

.reg-info-list strong {
  font-size: 11px;
  text-align: right;
  overflow-wrap: anywhere;
}

.reg-text-amber {
  color: #b77c19;
}

.reg-side-description {
  margin: 0 0 17px;
  font-size: 11px;
  color: #748998;
  line-height: 1.8;
}

.reg-security-box {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px;
  margin-bottom: 14px;
  background: #edf6fc;
  border-radius: 10px;
  color: #22668a;
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
  margin-top: 6px;
  font-size: 10px;
  line-height: 1.5;
}

.reg-button-security {
  width: 100%;
  color: white;
  background: #246bb3;
}

.reg-button-security:hover:not(:disabled) {
  background: #1c5897;
}

.reg-security-result {
  margin-top: 15px;
  padding: 13px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.reg-security-result strong {
  display: block;
  font-size: 12px;
}

.reg-security-result p {
  margin: 9px 0;
}

.reg-security-result small {
  display: block;
  margin-top: 9px;
}

.reg-security-result.passed {
  background: #ecf9f0;
  border: 1px solid #bde8ce;
  color: #087449;
}

.reg-security-result.failed {
  background: #fff1f1;
  border: 1px solid #fbcaca;
  color: #b12e2e;
}

/* TIMELINE */

.reg-timeline {
  display: grid;
  gap: 19px;
  padding: 3px 0;
}

.reg-timeline-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.reg-timeline-item > span {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 50%;
  background: #e3f5ec;
  color: #087856;
  font-size: 10px;
  font-weight: 900;
}

.reg-timeline-item strong,
.reg-timeline-item small {
  display: block;
}

.reg-timeline-item strong {
  font-size: 12px;
}

.reg-timeline-item small {
  margin-top: 6px;
  font-size: 10px;
  color: #8597a2;
  line-height: 1.6;
}

.reg-back {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 12px;
  border: 1px solid #d5e7df;
  border-radius: 10px;
  background: #e9f5ee;
  color: #126b50;
  font-size: 12px;
  font-weight: 850;
}

.reg-back:hover {
  background: #d8eee2;
}

.reg-footer {
  padding: 28px 0 10px;
  text-align: center;
  color: #92a2ad;
  font-size: 10px;
}

/* LOADING */

.reg-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background: #f2f7f8;
  color: #193b42;
  font-family: Arial, Helvetica, sans-serif;
  text-align: center;
}

.reg-loading > div {
  max-width: 480px;
}

.reg-loading h2 span {
  color: #07865f;
}

.reg-loading p {
  color: #718894;
  line-height: 1.7;
}

.reg-loading button {
  margin-top: 12px;
  padding: 12px 16px;
  border: 0;
  border-radius: 9px;
  background: #07885f;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

/* RESPONSIVE */

@media (max-width: 1250px) {
  .reg-topbar {
    gap: 10px;
    padding: 12px 18px;
  }

  .reg-brand {
    font-size: 20px;
  }

  .reg-navigation button {
    padding: 10px;
    font-size: 11px;
  }

  .reg-main-grid {
    grid-template-columns: minmax(0,1.5fr) minmax(270px,.8fr);
  }
}

@media (max-width: 1000px) {
  .reg-main-grid {
    grid-template-columns: 1fr;
  }

  .reg-side {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 14px;
  }

  .reg-side .reg-card {
    margin-bottom: 0;
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
    background: white;
    border-bottom: 1px solid #e2ebef;
    padding: 13px;
    box-shadow: 0 12px 25px #142d3817;
  }

  .reg-navigation.open {
    display: grid;
  }

  .reg-navigation button {
    font-size: 13px;
  }

  .reg-mobile-toggle {
    display: grid;
    place-items: center;
    padding: 8px;
  }

  .reg-account {
    margin-left: auto;
  }
}

@media (max-width: 700px) {
  .reg-container {
    padding: 12px;
  }

  .reg-topbar {
    min-height: 61px;
    padding: 10px 12px;
  }

  .reg-brand {
    font-size: 19px;
  }

  .reg-account-info {
    display: none;
  }

  .reg-hero {
    flex-direction: column;
    align-items: stretch;
    min-height: auto;
    padding: 24px 18px;
    gap: 22px;
  }

  .reg-hero h1 {
    font-size: 29px;
  }

  .reg-hero-status {
    width: 100%;
  }

  .reg-notice {
    flex-wrap: wrap;
    padding: 15px;
  }

  .reg-notice-badge {
    margin-left: 0;
  }

  .reg-card {
    padding: 17px;
  }

  .reg-form-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .reg-form-actions {
    flex-direction: column;
  }

  .reg-button-primary,
  .reg-button-disabled {
    width: 100%;
  }

  .reg-preview-grid {
    grid-template-columns: 1fr;
  }

  .reg-side {
    grid-template-columns: 1fr;
  }

  .reg-section-head h2 {
    font-size: 16px;
  }
}

@media print {
  .reg-topbar,
  .reg-breadcrumb,
  .reg-form-actions,
  .reg-button-security,
  .reg-back,
  .reg-mobile-toggle {
    display: none !important;
  }

  .reg-container {
    max-width: none;
    padding: 0;
  }

  .reg-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .reg-card {
    box-shadow: none;
    break-inside: avoid;
  }
}
`;
