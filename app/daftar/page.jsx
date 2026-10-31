
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// ======================================================
// OJT MINETRACK V2.0
// DASHBOARD PENDAFTARAN PESERTA OJT
// CORPORATE NAVY & EMERALD
//
// FRONTEND TERHUBUNG KE /api/register
// SERVER REGISTRATION LOCK TETAP DIHORMATI
// ======================================================

const BACKGROUND = "/background-erg.png.PNG";
const REGISTER_API = "/api/register";

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

const EMPTY_FORM = {
  fullName: "",
  email: "",
  password: "",
  confirmPassword: "",
  department: "",
  site: "",
};

// ======================================================
// ICON
// ======================================================

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
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    check: <path d="m4 12 5 5L20 6" />,
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

// ======================================================
// COMPONENTS
// ======================================================

function InfoCard({
  icon,
  label,
  title,
  children,
  color,
}) {
  return (
    <div className="reg-info-card">
      <div className={`reg-info-icon ${color}`}>
        <Icon name={icon} size={23} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  icon,
  children,
}) {
  return (
    <div className="reg-field">
      <label className="reg-field-label">
        {label} <em>*</em>
      </label>

      <div className="reg-field-control">
        <Icon name={icon} size={18} />
        {children}
      </div>
    </div>
  );
}

// ======================================================
// MAIN PAGE
// ======================================================

export default function DaftarPesertaOJT() {
  const router = useRouter();

  const [form, setForm] = useState(EMPTY_FORM);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirm, setShowConfirm] =
    useState(false);

  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  // ====================================================
  // FORM HELPERS
  // ====================================================

  function update(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setNotice("");
  }

  const passwordValid = useMemo(() => {
    return (
      form.password.length >= 8 &&
      form.password.length <= 128
    );
  }, [form.password]);

  // ====================================================
  // VALIDATION
  // ====================================================

  function validateForm() {
    const fullName = form.fullName
      .trim()
      .replace(/\s+/g, " ");

    const email = form.email
      .trim()
      .toLowerCase();

    if (
      fullName.length < 3 ||
      fullName.length > 120
    ) {
      return "Nama lengkap harus 3–120 karakter.";
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return "Masukkan email yang valid.";
    }

    if (!passwordValid) {
      return "Password harus 8–128 karakter.";
    }

    if (form.password !== form.confirmPassword) {
      return "Konfirmasi password tidak sesuai.";
    }

    if (
      !form.department ||
      form.department.length > 100
    ) {
      return "Departemen wajib dipilih.";
    }

    if (!SITES.includes(form.site)) {
      return "Pilih site penempatan OJT.";
    }

    if (!agreed) {
      return "Anda harus menyetujui ketentuan pendaftaran.";
    }

    return "";
  }

  // ====================================================
  // REGISTRATION SUBMIT
  //
  // MENGGUNAKAN ENDPOINT SERVER YANG SUDAH ADA.
  // TIDAK MENGGUNAKAN auth.signUp LANGSUNG.
  //
  // SERVER MENENTUKAN APAKAH PENDAFTARAN AKTIF.
  // ====================================================

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading || success) return;

    setError("");
    setNotice("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      full_name: form.fullName
        .trim()
        .replace(/\s+/g, " "),

      email: form.email
        .trim()
        .toLowerCase(),

      password: form.password,

      department: form.department,

      site: form.site,

      // Periode global ditampilkan pada UI.
      // Endpoint saat ini belum menerima tanggal.
    };

    setLoading(true);

    try {
      const response = await fetch(REGISTER_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      let result = null;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Server tidak memberikan respons yang valid."
        );
      }

      // SERVER REGISTRATION LOCK
      if (response.status === 503) {
        throw new Error(
          result?.error ||
          "Pendaftaran peserta belum diaktifkan oleh Administrator."
        );
      }

      if (response.status === 409) {
        throw new Error(
          result?.error ||
          "Email sudah terdaftar. Silakan login."
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Pendaftaran gagal diproses."
        );
      }

      // HANYA RESPONS SUKSES SERVER
      // YANG BOLEH MENANDAI PENDAFTARAN BERHASIL.

      if (result?.success !== true) {
        throw new Error(
          "Server belum mengonfirmasi pendaftaran."
        );
      }

      setSuccess(true);

      setNotice(
        result.message ||
        "Pengajuan pendaftaran berhasil tersimpan."
      );

      // Kosongkan password dari state.
      setForm((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));
    } catch (err) {
      setError(
        err?.message ||
        "Terjadi kesalahan saat mendaftar."
      );
    } finally {
      setLoading(false);
    }
  }

  // ====================================================
  // UI
  // ====================================================

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

        {/* HEADER */}

        <header className="reg-topbar">
          <div className="reg-brand">
            <div className="reg-logo">
              <Icon name="shield" size={24} />
            </div>

            <div>
              <strong>
                OJT <span>MineTrack</span>
                <small>v2.0</small>
              </strong>

              <p>
                ON THE JOB TRAINING MANAGEMENT SYSTEM
              </p>
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
        </section>

        {/* SUMMARY INFORMATION */}

        <section className="reg-info-grid">
          <InfoCard
            icon="user"
            label="Status Formulir"
            title="Pendaftaran Peserta OJT"
            color="green"
          >
            Pengajuan disimpan setelah server
            menerima dan memvalidasi pendaftaran.
          </InfoCard>

          <InfoCard
            icon="calendar"
            label="Periode Kalender Global"
            title="12 Sep 2026 – 06 Mar 2027"
            color="blue"
          >
            Kalender Global OJT Week 01–25.
          </InfoCard>

          <InfoCard
            icon="users"
            label="Alur Persetujuan"
            title="Peserta → Mentor"
            color="gold"
          >
            Pengajuan menunggu persetujuan Mentor
            sesuai mekanisme sistem.
          </InfoCard>

          <InfoCard
            icon="file"
            label="Program OJT"
            title="Week 01 – Week 25"
            color="teal"
          >
            Program monitoring dan evaluasi
            selama 25 minggu kalender global.
          </InfoCard>
        </section>

        {/* MAIN CONTENT */}

        <div className="reg-main-grid">

          {/* REGISTRATION FORM */}

          <section className="reg-card reg-form-card">
            <div className="reg-card-heading">
              <div className="reg-heading-icon">
                <Icon name="user" size={23} />
              </div>

              <div>
                <h2>
                  Formulir Pendaftaran Peserta OJT
                </h2>

                <p>
                  Lengkapi data sesuai identitas resmi.
                  Seluruh kolom bertanda * wajib diisi.
                </p>
              </div>
            </div>

            {success ? (
              <div
                className="reg-success-card"
                role="status"
              >
                <div className="reg-success-icon">
                  <Icon name="check" size={32} />
                </div>

                <h2>Pendaftaran Tersimpan</h2>

                <p>{notice}</p>

                <div className="reg-success-detail">
                  <strong>
                    {form.fullName.trim()}
                  </strong>

                  <span>
                    {form.email.trim().toLowerCase()}
                  </span>

                  <span>
                    {form.department} · {form.site}
                  </span>
                </div>

                <p>
                  Status pengajuan menunggu keputusan
                  sesuai alur yang berlaku. Pendaftaran
                  belum berarti program telah aktif.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="reg-primary-button"
                >
                  Kembali ke Login
                  <Icon name="arrow" size={17} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="reg-form-grid">

                  <FormField
                    label="Nama Lengkap"
                    icon="user"
                  >
                    <input
                      required
                      type="text"
                      minLength={3}
                      maxLength={120}
                      autoComplete="name"
                      placeholder="Nama lengkap peserta"
                      value={form.fullName}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "fullName",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Email"
                    icon="mail"
                  >
                    <input
                      required
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      placeholder="Alamat email aktif"
                      value={form.email}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "email",
                          event.target.value
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Password"
                    icon="lock"
                  >
                    <input
                      required
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Minimal 8 karakter"
                      value={form.password}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "password",
                          event.target.value
                        )
                      }
                    />

                    <button
                      type="button"
                      className="reg-eye-button"
                      disabled={loading}
                      onClick={() =>
                        setShowPassword((old) => !old)
                      }
                      aria-label="Tampilkan atau sembunyikan password"
                    >
                      <Icon
                        name={
                          showPassword
                            ? "eyeOff"
                            : "eye"
                        }
                        size={18}
                      />
                    </button>
                  </FormField>

                  <FormField
                    label="Konfirmasi Password"
                    icon="lock"
                  >
                    <input
                      required
                      type={
                        showConfirm
                          ? "text"
                          : "password"
                      }
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="Ulangi password"
                      value={form.confirmPassword}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "confirmPassword",
                          event.target.value
                        )
                      }
                    />

                    <button
                      type="button"
                      className="reg-eye-button"
                      disabled={loading}
                      onClick={() =>
                        setShowConfirm((old) => !old)
                      }
                      aria-label="Tampilkan atau sembunyikan konfirmasi password"
                    >
                      <Icon
                        name={
                          showConfirm
                            ? "eyeOff"
                            : "eye"
                        }
                        size={18}
                      />
                    </button>
                  </FormField>

                  <FormField
                    label="Departemen"
                    icon="users"
                  >
                    <select
                      required
                      value={form.department}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "department",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Pilih departemen
                      </option>

                      {DEPARTMENTS.map((item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    label="Site Penempatan"
                    icon="map"
                  >
                    <select
                      required
                      value={form.site}
                      disabled={loading}
                      onChange={(event) =>
                        update(
                          "site",
                          event.target.value
                        )
                      }
                    >
                      <option value="">
                        Pilih site penempatan
                      </option>

                      {SITES.map((item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {/* FIXED GLOBAL CALENDAR */}

                <div className="reg-fixed-program">
                  <h3>
                    <Icon name="calendar" size={19} />
                    Kalender Global Program OJT
                  </h3>

                  <div className="reg-fixed-grid">
                    <div>
                      <Icon name="calendar" size={21} />
                      <div>
                        <span>Awal Kalender OJT</span>
                        <strong>
                          12 September 2026
                        </strong>
                        <small>
                          Week 01 · Sabtu
                        </small>
                      </div>
                      <Icon name="lock" size={15} />
                    </div>

                    <div>
                      <Icon name="flag" size={21} />
                      <div>
                        <span>Akhir Kalender OJT</span>
                        <strong>
                          6 Maret 2027
                        </strong>
                        <small>
                          Week 25 · Sabtu
                        </small>
                      </div>
                      <Icon name="lock" size={15} />
                    </div>
                  </div>

                  <p>
                    <Icon name="info" size={16} />
                    Kalender global bersifat tetap.
                    Tanggal individual program peserta
                    belum disimpan oleh endpoint
                    pendaftaran ini.
                  </p>
                </div>

                {/* AGREEMENT */}

                <label className="reg-agreement">
                  <input
                    type="checkbox"
                    required
                    checked={agreed}
                    disabled={loading}
                    onChange={(event) =>
                      setAgreed(event.target.checked)
                    }
                  />

                  <span>
                    Saya menyatakan seluruh data yang
                    diisi adalah benar dan bersedia
                    mengikuti ketentuan program OJT
                    MineTrack PT Berau Coal.
                  </span>
                </label>

                {/* ERROR */}

                {error && (
                  <div
                    className="reg-error"
                    role="alert"
                  >
                    <Icon name="info" size={18} />
                    <span>{error}</span>
                  </div>
                )}

                {notice && (
                  <div
                    className="reg-notice"
                    role="status"
                  >
                    <Icon name="info" size={18} />
                    <span>{notice}</span>
                  </div>
                )}

                {/* ACTIONS */}

                <div className="reg-actions">
                  <button
                    type="submit"
                    className="reg-primary-button"
                    disabled={loading}
                  >
                    <Icon name="send" size={18} />

                    {loading
                      ? "Memproses Pendaftaran..."
                      : "Daftar Sekarang"}

                    {!loading && (
                      <Icon name="arrow" size={17} />
                    )}
                  </button>

                  <button
                    type="button"
                    className="reg-secondary-button"
                    disabled={loading}
                    onClick={() =>
                      router.push("/login")
                    }
                  >
                    <Icon name="back" size={17} />
                    Kembali ke Login
                  </button>
                </div>

                <p className="reg-form-footnote">
                  Pengajuan hanya berhasil apabila
                  server mengonfirmasi bahwa data
                  telah tersimpan.
                </p>
              </form>
            )}
          </section>

          {/* RIGHT SIDE */}

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
                    Tahapan pengajuan peserta.
                  </p>
                </div>
              </div>

              <div className="reg-steps">
                {[
                  [
                    "Mengisi Formulir",
                    "Peserta mengisi data diri sesuai identitas.",
                  ],
                  [
                    "Validasi Server",
                    "Sistem memeriksa data dan status pendaftaran.",
                  ],
                  [
                    "Pengajuan Tersimpan",
                    "Pengajuan yang berhasil diterima berstatus menunggu.",
                  ],
                  [
                    "Persetujuan Mentor",
                    "Mentor meninjau pengajuan melalui dashboard.",
                  ],
                  [
                    "Program OJT",
                    "Aktivasi program mengikuti proses persetujuan sistem.",
                  ],
                ].map(
                  ([title, description], index) => (
                    <div
                      className="reg-step"
                      key={title}
                    >
                      <span>{index + 1}</span>

                      <div>
                        <strong>{title}</strong>
                        <p>{description}</p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>

            <section className="reg-card reg-help-card">
              <div className="reg-help-icon">
                <Icon name="help" size={26} />
              </div>

              <div>
                <h3>Butuh Bantuan?</h3>

                <p>
                  Jika mengalami kendala pendaftaran,
                  hubungi Administrator Emergency
                  Response Group PT Berau Coal.
                </p>
              </div>
            </section>
          </aside>
        </div>

        {/* FOOTER */}

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
// CSS
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

.reg-root button:disabled {
  opacity: .55;
  cursor: not-allowed;
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
  pointer-events: none;
}

.reg-container {
  position: relative;
  z-index: 1;
  max-width: 1550px;
  margin: auto;
  padding: 0 24px 24px;
}

/* HEADER */

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
  color: #d4e4e8;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
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
  color: #c9dfeb;
  font-size: 9px;
}

/* HERO */

.reg-hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 195px;
  padding: 22px 9px;
  color: white;
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
  margin: 0;
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

/* INFORMATION */

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

.reg-info-card > div:last-child {
  min-width: 0;
}

.reg-info-card span {
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

/* CONTENT */

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
  background: linear-gradient(
    135deg,#0b437d,#1683ca
  );
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

.reg-field {
  min-width: 0;
}

.reg-field-label {
  display: block;
  margin-bottom: 7px;
  color: #213b5e;
  font-size: 11px;
  font-weight: 900;
}

.reg-field-label em {
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

/* FIXED CALENDAR */

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
  align-items: flex-start;
  gap: 7px;
  margin: 11px 0 0;
  color: #3973a2;
  font-size: 10px;
  line-height: 1.6;
}

/* AGREEMENT */

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

/* ACTIONS */

.reg-actions {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 11px;
  margin-top: 16px;
}

.reg-actions button,
.reg-success-card button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 44px;
  padding: 10px 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 900;
}

.reg-primary-button {
  border: 0;
  background: linear-gradient(
    100deg,#086f66,#08a096
  );
  color: white;
}

.reg-secondary-button {
  border: 1px solid #a5c1d8;
  background: white;
  color: #14538a;
}

.reg-form-footnote {
  margin: 12px 0 0;
  color: #7c90a0;
  font-size: 10px;
  text-align: center;
  line-height: 1.6;
}

/* MESSAGES */

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

/* SUCCESS */

.reg-success-card {
  padding: 25px 15px;
  text-align: center;
  background: #f0faf6;
  border: 1px solid #c1e9d7;
  border-radius: 10px;
}

.reg-success-icon {
  display: grid;
  place-items: center;
  width: 65px;
  height: 65px;
  margin: 0 auto 15px;
  border-radius: 50%;
  background: #dbf6e8;
  color: #087d58;
}

.reg-success-card h2 {
  margin: 0 0 9px;
  color: #087b5b;
  font-size: 21px;
}

.reg-success-card p {
  margin: 10px 0;
  color: #4e796a;
  font-size: 12px;
  line-height: 1.7;
}

.reg-success-detail {
  display: grid;
  gap: 7px;
  margin: 18px auto;
  padding: 15px;
  border: 1px solid #d4ecdf;
  border-radius: 9px;
  background: white;
  overflow-wrap: anywhere;
}

.reg-success-detail strong {
  color: #173c51;
}

.reg-success-detail span {
  color: #6d8895;
  font-size: 11px;
}

.reg-success-card button {
  margin: 20px auto 0;
}

/* RIGHT SIDE */

.reg-right-column {
  display: grid;
  gap: 14px;
}

.reg-timeline-card,
.reg-guidelines-card,
.reg-help-card {
  padding: 18px;
}

.reg-timeline-card {
  background: linear-gradient(
    135deg,#ffffff,#eaf5fe
  );
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
  flex: 1;
  min-width: 0;
  text-align: center;
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

.reg-guidelines-card {
  background: linear-gradient(
    130deg,#fff 60%,#edf7ff
  );
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

.reg-step > span {
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

.reg-step:nth-child(2) > span,
.reg-step:nth-child(5) > span {
  background: #08a78d;
}

.reg-step:nth-child(3) > span {
  background: #dba02c;
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
    grid-template-columns:
      repeat(2,minmax(0,1fr));
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
