
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// MONITORING PENDAFTARAN PESERTA OJT — MENTOR
//
// CORPORATE NAVY / EMERALD / WHITE
// BACKGROUND ERG
//
// READ ONLY:
// Tidak membuat akun, mengubah database,
// menyetujui, atau menolak pengajuan.
// ======================================================

const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const PROGRAM_START = "12 September 2026";
const PROGRAM_END = "6 Maret 2027";
const TOTAL_WEEKS = 25;

const REGISTRATIONS_API = "/api/mentor/registrations";

const NAV = [
  {
    label: "Dashboard",
    url: "/",
    icon: "home",
  },
  {
    label: "Peserta OJT",
    url: "/mentor/monitoring-peserta",
    icon: "users",
  },
  {
    label: "Pendaftaran Peserta",
    url: "/mentor/daftar-peserta",
    icon: "file",
  },
  {
    label: "Persetujuan",
    url: "/mentor/persetujuan-peserta",
    icon: "check",
  },
];

// ======================================================
// HELPERS
// ======================================================

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";

  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return "—";

  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status) {
  const labels = {
    pending: "Menunggu",
    approved: "Disetujui",
    rejected: "Ditolak",
  };

  return labels[status] || "Tidak Diketahui";
}

// ======================================================
// ICONS
// ======================================================

function Icon({ name, size = 18 }) {
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
    file: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    x: <path d="M5 5l14 14M19 5 5 19" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="5" width="14" height="16" rx="2" />
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <path d="M9 13h6M9 17h4" />
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
      {paths[name] || paths.file}
    </svg>
  );
}

// ======================================================
// COMPONENTS
// ======================================================

function StatusBadge({ status }) {
  const icon =
    status === "approved"
      ? "check"
      : status === "rejected"
        ? "x"
        : status === "pending"
          ? "clock"
          : "info";

  return (
    <span className={`mon-status ${status || "unknown"}`}>
      <Icon name={icon} size={13} />
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  description,
  tone,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        `mon-stat ${tone} ` +
        (selected ? "selected" : "")
      }
      onClick={onClick}
    >
      <span className="mon-stat-icon">
        <Icon name={icon} size={24} />
      </span>

      <span className="mon-stat-content">
        <small>{title}</small>
        <strong>{value}</strong>
        <span>{description}</span>
      </span>

      <Icon name="arrow" size={16} />
    </button>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}) {
  return (
    <div className="mon-section-title">
      <div className="mon-section-icon">
        <Icon name={icon} size={21} />
      </div>

      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div className="mon-detail-field">
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

  const [mentor, setMentor] = useState(null);

  const [registrations, setRegistrations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);

  const [mobileMenu, setMobileMenu] = useState(false);

  const [error, setError] = useState("");

  // ====================================================
  // AUTHENTICATION — MENTOR ONLY
  // ====================================================

  const loadData = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { redirect: "/login" };
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (normalize(profile?.role) !== "mentor") {
      throw new Error(
        "Akses ditolak. Halaman ini khusus Mentor OJT."
      );
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token ||
      session.user?.id !== user.id
    ) {
      return { redirect: "/login" };
    }

    const response = await fetch(
      REGISTRATIONS_API,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      }
    );

    if (response.status === 401) {
      return { redirect: "/login" };
    }

    if (response.status === 403) {
      throw new Error(
        "Server menolak akses data pendaftaran Mentor."
      );
    }

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        "Server tidak memberikan data pengajuan yang valid."
      );
    }

    if (!response.ok) {
      throw new Error(
        result?.error ||
          "Gagal mengambil daftar pengajuan peserta."
      );
    }

    if (!Array.isArray(result.registrations)) {
      throw new Error(
        "Format daftar pengajuan dari server tidak valid."
      );
    }

    return {
      profile,
      registrations: result.registrations,
    };
  }, []);

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const result = await loadData();

        if (!active) return;

        if (result.redirect) {
          router.replace(result.redirect);
          return;
        }

        setMentor(result.profile);
        setRegistrations(result.registrations);
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat monitoring pendaftaran."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [loadData, router]);

  // ====================================================
  // REFRESH
  // ====================================================

  async function refreshData() {
    if (loading || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const result = await loadData();

      if (result.redirect) {
        setMentor(null);
        setRegistrations([]);
        router.replace(result.redirect);
        return;
      }

      setMentor(result.profile);
      setRegistrations(result.registrations);

      // Detail dibuka kembali dari data terbaru,
      // bukan data lama yang mungkin sudah berubah.
      setSelected((current) => {
        if (!current) return null;

        return (
          result.registrations.find(
            (item) =>
              item.id === current.id &&
              item.source === current.source
          ) || null
        );
      });
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memperbarui data pendaftaran."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // STATISTICS
  // ====================================================

  const counts = useMemo(() => {
    return {
      all: registrations.length,

      pending: registrations.filter(
        (item) => item.status === "pending"
      ).length,

      approved: registrations.filter(
        (item) => item.status === "approved"
      ).length,

      rejected: registrations.filter(
        (item) => item.status === "rejected"
      ).length,
    };
  }, [registrations]);

  // ====================================================
  // FILTER & SEARCH
  // ====================================================

  const filtered = useMemo(() => {
    const keyword = normalize(search);

    return registrations.filter((item) => {
      const matchStatus =
        filter === "all" || item.status === filter;

      const searchable = [
        item.full_name,
        item.email,
        item.department,
        item.site,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        matchStatus && searchable.includes(keyword)
      );
    });
  }, [registrations, filter, search]);

  function navigate(path) {
    setMobileMenu(false);
    router.push(path);
  }

  const filterTabs = [
    ["all", "Semua", counts.all],
    ["pending", "Menunggu", counts.pending],
    ["approved", "Disetujui", counts.approved],
    ["rejected", "Ditolak", counts.rejected],
  ];

  // ====================================================
  // LOADING
  // ====================================================

  if (loading && !mentor) {
    return (
      <main className="mon-loading">
        <style>{css}</style>
        <div>
          <h2>
            OJT <span>MineTrack</span>
          </h2>
          <p>Memuat monitoring pendaftaran...</p>
        </div>
      </main>
    );
  }

  if (!mentor) {
    return (
      <main className="mon-loading">
        <style>{css}</style>
        <div>
          <h2>Monitoring Tidak Dapat Dibuka</h2>
          <p>
            {error || "Data Mentor belum tersedia."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/")}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="mon-app">
      <style>{css}</style>

      {/* ================================================
          TOP NAVIGATION
      ================================================ */}

      <header className="mon-topbar">
        <button
          type="button"
          className="mon-brand"
          onClick={() => navigate("/")}
        >
          <span className="mon-brand-icon">
            <Icon name="shield" size={22} />
          </span>

          <span className="mon-brand-copy">
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
            "mon-nav " + (mobileMenu ? "open" : "")
          }
          aria-label="Navigasi Mentor"
        >
          {NAV.map((item) => (
            <button
              key={item.url}
              type="button"
              className={
                item.url ===
                "/mentor/daftar-peserta"
                  ? "active"
                  : ""
              }
              onClick={() => navigate(item.url)}
            >
              <Icon name={item.icon} size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mon-account">
          <div className="mon-account-avatar">
            {initials(mentor.full_name)}
          </div>

          <div className="mon-account-info">
            <strong>
              {mentor.full_name || "Mentor OJT"}
            </strong>
            <small>Mentor OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="mon-mobile-toggle"
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

      <main className="mon-container">

        {/* ================================================
            HERO
        ================================================ */}

        <section
          className="mon-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(4,22,43,.97) 0%,
                rgba(5,34,57,.87) 45%,
                rgba(5,35,54,.48) 100%
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div className="mon-hero-content">
            <div className="mon-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Monitoring <span>Pendaftaran OJT</span>
            </h1>

            <p>
              Pantau pengajuan peserta, status
              pendaftaran, periode program, dan hasil
              verifikasi melalui Dashboard Mentor
              OJT MineTrack.
            </p>

            <div className="mon-hero-tags">
              <span>
                <Icon name="shield" size={15} />
                Akses Mentor
              </span>

              <span>
                <Icon name="calendar" size={15} />
                Program OJT 2026–2027
              </span>

              <span>
                <Icon name="eye" size={15} />
                Monitoring Data
              </span>
            </div>
          </div>

          <div className="mon-hero-summary">
            <div className="mon-hero-summary-icon">
              <Icon name="users" size={24} />
            </div>

            <small>TOTAL PENGAJUAN</small>
            <strong>{counts.all}</strong>
            <span>Data dari sistem OJT</span>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="mon-breadcrumb">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Dashboard
          </button>

          <span>/</span>

          <strong>Monitoring Pendaftaran Peserta</strong>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mon-alert" role="alert">
            <Icon name="info" size={19} />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Tutup pesan"
            >
              <Icon name="x" size={17} />
            </button>
          </div>
        )}

        {/* ================================================
            STATISTICS
        ================================================ */}

        <section className="mon-stat-grid">
          <SummaryCard
            icon="file"
            title="Total Pengajuan"
            value={counts.all}
            description="Semua data pendaftaran"
            tone="blue"
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          />

          <SummaryCard
            icon="clock"
            title="Menunggu Persetujuan"
            value={counts.pending}
            description="Pengajuan masih menunggu"
            tone="amber"
            selected={filter === "pending"}
            onClick={() => setFilter("pending")}
          />

          <SummaryCard
            icon="check"
            title="Disetujui"
            value={counts.approved}
            description="Pengajuan telah disetujui"
            tone="green"
            selected={filter === "approved"}
            onClick={() => setFilter("approved")}
          />

          <SummaryCard
            icon="x"
            title="Ditolak"
            value={counts.rejected}
            description="Riwayat pengajuan ditolak"
            tone="rose"
            selected={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          />
        </section>

        {/* ================================================
            INFORMATION NOTICE
        ================================================ */}

        <section className="mon-notice">
          <div className="mon-notice-icon">
            <Icon name="shield" size={22} />
          </div>

          <div>
            <strong>
              Monitoring Pendaftaran Peserta Aktif
            </strong>

            <p>
              Halaman ini menampilkan data pengajuan
              peserta dari sistem secara langsung saat
              dimuat atau diperbarui. Untuk mengambil
              keputusan, gunakan menu Persetujuan Peserta
              OJT.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/mentor/persetujuan-peserta")
            }
          >
            Menu Persetujuan
            <Icon name="arrow" size={16} />
          </button>
        </section>

        {/* ================================================
            REGISTRATION TABLE
        ================================================ */}

        <section className="mon-card">
          <div className="mon-section-head">
            <SectionHeading
              icon="users"
              title="Daftar Pendaftaran Peserta OJT"
              description="Data peserta yang mengajukan pendaftaran melalui sistem."
            />

            <button
              type="button"
              className="mon-refresh"
              onClick={refreshData}
              disabled={loading || refreshing}
            >
              <Icon name="refresh" size={17} />

              {refreshing
                ? "Memperbarui..."
                : "Perbarui Data"}
            </button>
          </div>

          {/* FILTER */}

          <div className="mon-filterbar">
            <div className="mon-tabs">
              {filterTabs.map(
                ([value, label, total]) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      filter === value ? "active" : ""
                    }
                    onClick={() => setFilter(value)}
                  >
                    {label}
                    <span>{total}</span>
                  </button>
                )
              )}
            </div>

            <label className="mon-search">
              <Icon name="search" size={17} />

              <input
                type="search"
                placeholder="Cari nama, email, site..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>
          </div>

          <div className="mon-result-count">
            Menampilkan{" "}
            <strong>{filtered.length}</strong>
            {" dari "}
            <strong>{counts.all}</strong>
            {" pengajuan."}
          </div>

          {refreshing && (
            <p className="mon-refresh-message">
              Memperbarui data dari server...
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="mon-empty">
              <Icon name="file" size={31} />

              <strong>
                Tidak Ada Data Pengajuan
              </strong>

              <p>
                Belum ada pengajuan yang sesuai
                dengan filter atau pencarian.
              </p>
            </div>
          ) : (
            <>
              {/* TABEL DESKTOP */}

              <div className="mon-table-scroll">
                <table className="mon-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Nama Peserta</th>
                      <th>Departemen / Site</th>
                      <th>Periode OJT</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((item, index) => (
                      <tr
                        key={`${item.source}-${item.id}`}
                      >
                        <td>{index + 1}</td>

                        <td>
                          <div className="mon-person">
                            <div className="mon-person-avatar">
                              {initials(item.full_name)}
                            </div>

                            <div>
                              <strong>
                                {item.full_name ||
                                  "Nama belum tersedia"}
                              </strong>

                              <small>
                                {item.email || "—"}
                              </small>

                              <small>
                                {item.source === "new"
                                  ? "Pengajuan Baru"
                                  : "Riwayat Lama"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong className="mon-cell-main">
                            {item.department || "—"}
                          </strong>

                          <small className="mon-cell-sub">
                            {item.site || "—"}
                          </small>
                        </td>

                        <td>
                          <span className="mon-period-cell">
                            {formatDate(item.start_date)}
                            <br />
                            s.d. {formatDate(item.end_date)}
                          </span>
                        </td>

                        <td>
                          {formatTime(item.created_at)}
                        </td>

                        <td>
                          <StatusBadge status={item.status} />
                        </td>

                        <td>
                          <button
                            type="button"
                            className="mon-detail-button"
                            onClick={() => setSelected(item)}
                          >
                            <Icon name="eye" size={15} />
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE LIST */}

              <div className="mon-mobile-list">
                {filtered.map((item) => (
                  <div
                    className="mon-mobile-item"
                    key={`${item.source}-${item.id}`}
                  >
                    <div className="mon-mobile-person">
                      <div className="mon-person-avatar">
                        {initials(item.full_name)}
                      </div>

                      <div>
                        <strong>
                          {item.full_name ||
                            "Nama belum tersedia"}
                        </strong>

                        <small>
                          {item.department || "—"}
                          {" · "}
                          {item.site || "—"}
                        </small>
                      </div>
                    </div>

                    <div className="mon-mobile-row">
                      <span>Periode OJT</span>
                      <strong>
                        {formatDate(item.start_date)}
                        {" – "}
                        {formatDate(item.end_date)}
                      </strong>
                    </div>

                    <div className="mon-mobile-row">
                      <span>Tanggal Pengajuan</span>
                      <strong>
                        {formatTime(item.created_at)}
                      </strong>
                    </div>

                    <div className="mon-mobile-bottom">
                      <StatusBadge status={item.status} />

                      <button
                        type="button"
                        className="mon-detail-button"
                        onClick={() => setSelected(item)}
                      >
                        <Icon name="eye" size={15} />
                        Detail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ================================================
            PROGRAM INFORMATION
        ================================================ */}

        <div className="mon-bottom-grid">

          <section className="mon-card">
            <SectionHeading
              icon="calendar"
              title="Program OJT 2026–2027"
              description="Kalender Global OJT Week 01–25."
            />

            <div className="mon-program-dates">
              <div>
                <span>Mulai · Week 01</span>
                <strong>{PROGRAM_START}</strong>
              </div>

              <div>
                <span>Selesai · Week 25</span>
                <strong>{PROGRAM_END}</strong>
              </div>
            </div>

            <div className="mon-week-timeline">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, index) => (
                  <div
                    key={index}
                    className={
                      "mon-week-node " +
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

            <p className="mon-program-note">
              Timeline ini merupakan kalender global
              program. Periode tiap pengajuan tetap
              menggunakan tanggal yang tersimpan
              pada sistem.
            </p>
          </section>

          <section className="mon-card">
            <SectionHeading
              icon="clipboard"
              title="Alur Pendaftaran Peserta"
              description="Ringkasan proses pendaftaran dan monitoring."
            />

            <div className="mon-process-list">
              {[
                [
                  "Pendaftaran",
                  "Calon peserta mengisi formulir melalui halaman pendaftaran OJT.",
                ],
                [
                  "Data Pengajuan",
                  "Pengajuan masuk ke sistem untuk ditinjau Mentor.",
                ],
                [
                  "Persetujuan Mentor",
                  "Keputusan dilakukan pada menu Persetujuan Peserta sesuai fitur yang aktif.",
                ],
                [
                  "Monitoring Status",
                  "Status pengajuan dapat dipantau kembali pada halaman ini.",
                ],
              ].map(([title, description], index) => (
                <div
                  className="mon-process-item"
                  key={title}
                >
                  <span>{index + 1}</span>

                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mon-process-button"
              onClick={() =>
                navigate("/mentor/persetujuan-peserta")
              }
            >
              Buka Dashboard Persetujuan
              <Icon name="arrow" size={17} />
            </button>
          </section>
        </div>

        {/* FOOTER */}

        <div className="mon-bottom-actions">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            <Icon name="back" size={17} />
            Kembali ke Dashboard Mentor
          </button>
        </div>

        <footer className="mon-footer">
          <span>
            OJT MineTrack v2.0 · Emergency Response Group
          </span>

          <span>
            PT Berau Coal · Program 2026–2027
          </span>
        </footer>
      </main>

      {/* ================================================
          READ-ONLY DETAIL MODAL
      ================================================ */}

      {selected && (
        <div
          className="mon-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <section
            className="mon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mon-detail-title"
          >
            <div className="mon-modal-header">
              <div className="mon-modal-icon">
                <Icon name="user" size={22} />
              </div>

              <div>
                <h2 id="mon-detail-title">
                  Detail Pendaftaran Peserta
                </h2>

                <p>
                  Informasi berdasarkan data aktual sistem.
                </p>
              </div>

              <button
                type="button"
                className="mon-close"
                onClick={() => setSelected(null)}
                aria-label="Tutup detail"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="mon-modal-body">
              <div className="mon-detail-grid">
                <DetailField
                  label="Nama Peserta"
                  value={selected.full_name}
                />

                <DetailField
                  label="Email"
                  value={selected.email}
                />

                <DetailField
                  label="Departemen"
                  value={selected.department}
                />

                <DetailField
                  label="Site"
                  value={selected.site}
                />

                <DetailField
                  label="Tanggal Mulai"
                  value={formatDate(
                    selected.start_date
                  )}
                />

                <DetailField
                  label="Tanggal Selesai"
                  value={formatDate(
                    selected.end_date
                  )}
                />

                <DetailField
                  label="Tanggal Pengajuan"
                  value={formatTime(
                    selected.created_at
                  )}
                />

                <DetailField
                  label="Sumber Data"
                  value={
                    selected.source === "new"
                      ? "Pengajuan Baru"
                      : "Riwayat Lama"
                  }
                />
              </div>

              <div className="mon-detail-status">
                <span>Status Pendaftaran</span>
                <StatusBadge
                  status={selected.status}
                />
              </div>

              {selected.rejection_reason && (
                <div className="mon-detail-reason">
                  <strong>Alasan Penolakan</strong>
                  <p>{selected.rejection_reason}</p>
                </div>
              )}

              <p className="mon-detail-note">
                Detail ini bersifat informasi dan
                tidak mengubah status pengajuan.
              </p>

              <div className="mon-modal-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelected(null)}
                >
                  Tutup
                </button>

                {selected.source === "new" &&
                  selected.status === "pending" && (
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setSelected(null);
                        navigate(
                          "/mentor/persetujuan-peserta"
                        );
                      }}
                    >
                      Menu Persetujuan
                      <Icon name="arrow" size={16} />
                    </button>
                  )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// ======================================================
// CSS — CORPORATE NAVY & EMERALD
// ======================================================

const css = `
.mon-app,
.mon-app * {
  box-sizing: border-box;
}

.mon-app {
  min-height: 100vh;
  background: #edf3f7;
  color: #173654;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.mon-app button,
.mon-app input {
  font-family: inherit;
}

.mon-app button {
  cursor: pointer;
}

.mon-app button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.mon-app button:focus-visible,
.mon-app input:focus-visible {
  outline: 3px solid #60d8bd;
  outline-offset: 2px;
}

/* TOPBAR */

.mon-topbar {
  position: sticky;
  top: 0;
  z-index: 40;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 17px;

  min-height: 76px;
  padding: 11px 28px;

  background: #081e35;
  color: white;
  border-bottom: 1px solid #ffffff2c;
  box-shadow: 0 5px 20px #0a294024;
}

.mon-brand {
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

.mon-brand-icon {
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

.mon-brand-copy strong {
  display: block;
  font-size: 21px;
  letter-spacing: -.5px;
  white-space: nowrap;
}

.mon-brand-copy strong em {
  color: #5de1c1;
  font-style: normal;
}

.mon-brand-copy strong small {
  margin-left: 7px;
  padding: 4px 6px;
  border-radius: 5px;
  background: #5be2c2;
  color: #073647;
  font-size: 10px;
}

.mon-brand-copy > span {
  display: block;
  margin-top: 5px;
  color: #c4d8e4;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.mon-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.mon-nav button {
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

.mon-nav button:hover {
  background: #ffffff18;
}

.mon-nav button.active {
  background: #0c807b;
  color: white;
  box-shadow: inset 0 -2px #68ecd2;
}

.mon-account {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.mon-account-avatar {
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

.mon-account-info strong {
  display: block;
  max-width: 155px;
  overflow-wrap: anywhere;
  font-size: 11px;
}

.mon-account-info small {
  display: block;
  margin-top: 4px;
  color: #b3cbd6;
  font-size: 10px;
}

.mon-mobile-toggle {
  display: none;
  padding: 7px;
  border: 0;
  background: transparent;
  color: white;
}

/* CONTAINER */

.mon-container {
  max-width: 1500px;
  margin: auto;
  padding: 23px;
}

/* HERO */

.mon-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;

  min-height: 230px;
  padding: 30px 34px;
  overflow: hidden;

  border-radius: 16px;
  background-color: #0c2d47;
  background-position: center 44%;
  background-size: cover;

  color: white;
  box-shadow: 0 9px 27px #12385220;
}

.mon-hero-content {
  max-width: 750px;
}

.mon-kicker {
  color: #e6c17a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.mon-hero h1 {
  margin: 12px 0;
  font-size: clamp(29px,3.3vw,44px);
  line-height: 1.15;
  letter-spacing: -.8px;
}

.mon-hero h1 span {
  color: #5be3c2;
}

.mon-hero p {
  max-width: 650px;
  margin: 0;
  color: #e0ebef;
  font-size: 12px;
  line-height: 1.8;
}

.mon-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.mon-hero-tags span {
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

.mon-hero-tags svg {
  color: #83e7c9;
}

.mon-hero-summary {
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

.mon-hero-summary-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  background: #e2f5ed;
  color: #108868;
}

.mon-hero-summary small {
  color: #aacbd9;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
}

.mon-hero-summary > strong {
  font-size: 38px;
}

.mon-hero-summary > span:last-child {
  color: #d6e5ea;
  font-size: 10px;
}

/* BREADCRUMB */

.mon-breadcrumb {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 15px 3px;
  font-size: 11px;
  color: #8ba2af;
}

.mon-breadcrumb button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #6c8595;
  font-weight: 750;
}

.mon-breadcrumb strong {
  color: #087c75;
}

/* ALERT */

.mon-alert {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 15px;
  padding: 13px 15px;
  border: 1px solid #f3c8c8;
  border-radius: 10px;
  background: #fff1f1;
  color: #b12b2b;
  font-size: 11px;
  line-height: 1.6;
}

.mon-alert span {
  flex: 1;
}

.mon-alert button {
  border: 0;
  background: transparent;
  color: inherit;
}

/* STATS */

.mon-stat-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 13px;
  margin-bottom: 16px;
}

.mon-stat {
  display: flex;
  align-items: center;
  gap: 12px;

  min-height: 125px;
  padding: 17px;

  border: 1px solid #dce7ee;
  border-radius: 12px;
  background: white;

  text-align: left;
  box-shadow: 0 6px 20px #0d355015;
}

.mon-stat.selected {
  outline: 2px solid #58cfae;
  outline-offset: -2px;
}

.mon-stat-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border-radius: 11px;
}

.mon-stat.blue .mon-stat-icon {
  background: #e0effe;
  color: #1979bf;
}

.mon-stat.amber .mon-stat-icon {
  background: #fff1d8;
  color: #c18a20;
}

.mon-stat.green .mon-stat-icon {
  background: #def8ed;
  color: #078c67;
}

.mon-stat.rose .mon-stat-icon {
  background: #fff0f2;
  color: #c94c62;
}

.mon-stat-content {
  display: grid;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.mon-stat-content small {
  color: #73899b;
  font-size: 10px;
  font-weight: 800;
}

.mon-stat-content strong {
  color: #123d6b;
  font-size: 30px;
}

.mon-stat-content > span {
  color: #8497a5;
  font-size: 10px;
}

.mon-stat > svg {
  flex-shrink: 0;
  color: #93a7b7;
}

/* NOTICE */

.mon-notice {
  display: flex;
  align-items: center;
  gap: 14px;

  padding: 15px 18px;
  margin-bottom: 17px;

  border: 1px solid #c7e4ed;
  border-radius: 12px;
  background: #eaf6fa;
}

.mon-notice-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #d8ebf5;
  color: #2577a1;
}

.mon-notice > div:nth-child(2) {
  flex: 1;
}

.mon-notice strong {
  color: #225b7a;
  font-size: 12px;
}

.mon-notice p {
  margin: 5px 0 0;
  color: #5e8191;
  font-size: 11px;
  line-height: 1.6;
}

.mon-notice > button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  padding: 11px 13px;
  border: 0;
  border-radius: 8px;

  background: #087d76;
  color: white;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

/* MAIN CARD */

.mon-card {
  min-width: 0;
  padding: 21px;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  background: white;
  box-shadow: 0 6px 20px #17384d0d;
}

.mon-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 19px;
}

.mon-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mon-section-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 41px;
  height: 41px;
  border-radius: 9px;
  background: linear-gradient(135deg,#10487e,#188bcb);
  color: white;
}

.mon-section-title h2 {
  margin: 0;
  color: #123e70;
  font-size: 17px;
}

.mon-section-title p {
  margin: 5px 0 0;
  color: #7d91a2;
  font-size: 11px;
  line-height: 1.5;
}

.mon-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 14px;
  border: 1px solid #d8e6e9;
  border-radius: 8px;
  background: #f7fafc;
  color: #206d65;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

/* FILTERS */

.mon-filterbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e6eef3;
  border-radius: 10px;
  background: #f6f9fb;
}

.mon-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mon-tabs button {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #627f90;
  font-size: 11px;
  font-weight: 900;
}

.mon-tabs button.active {
  background: #087d76;
  color: white;
}

.mon-tabs button > span {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  border-radius: 6px;
  background: #e5edf2;
  color: #486474;
  font-size: 10px;
}

.mon-tabs button.active > span {
  background: #ffffff30;
  color: white;
}

.mon-search {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 245px;
  padding: 0 12px;
  border: 1px solid #d7e4eb;
  border-radius: 8px;
  background: white;
  color: #8ca2af;
}

.mon-search input {
  width: 100%;
  min-height: 40px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1a3c56;
  font-size: 11px;
}

.mon-result-count {
  padding: 13px 2px;
  color: #8497a4;
  font-size: 10px;
}

.mon-result-count strong {
  color: #087d73;
}

.mon-refresh-message {
  color: #26778a;
  font-size: 11px;
}

/* TABLE */

.mon-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.mon-table {
  width: 100%;
  min-width: 1040px;
  border-collapse: collapse;
  text-align: left;
  font-size: 11px;
}

.mon-table th {
  padding: 13px 11px;
  background: #eaf1f6;
  color: #426178;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mon-table td {
  padding: 14px 11px;
  border-bottom: 1px solid #eaf0f3;
  color: #355265;
  vertical-align: middle;
}

.mon-table tbody tr:hover {
  background: #fafdfc;
}

.mon-person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}

.mon-person-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #ddf3e8;
  color: #087954;
  font-size: 12px;
  font-weight: 900;
}

.mon-person strong,
.mon-person small {
  display: block;
}

.mon-person strong {
  color: #20405a;
  font-size: 11px;
}

.mon-person small {
  margin-top: 5px;
  color: #879baa;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.mon-cell-main,
.mon-cell-sub {
  display: block;
}

.mon-cell-main {
  font-size: 11px;
}

.mon-cell-sub {
  margin-top: 5px;
  color: #8197a6;
  font-size: 10px;
}

.mon-period-cell {
  font-size: 10px;
  line-height: 1.7;
  white-space: nowrap;
}

/* STATUS */

.mon-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mon-status.pending {
  background: #fff3d9;
  color: #ad7a23;
}

.mon-status.approved {
  background: #dff6e9;
  color: #078257;
}

.mon-status.rejected {
  background: #fff0f2;
  color: #c14d61;
}

.mon-status.unknown {
  background: #edf2f5;
  color: #78909d;
}

.mon-detail-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  border: 0;
  border-radius: 8px;
  background: #e7f1fd;
  color: #286ba7;
  font-size: 11px;
  font-weight: 900;
}

.mon-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 45px 20px;
  color: #8ca1b0;
  text-align: center;
}

.mon-empty strong {
  color: #47697d;
  font-size: 14px;
}

.mon-empty p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
}

.mon-mobile-list {
  display: none;
}

/* BOTTOM PANELS */

.mon-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 15px;
  margin-top: 16px;
}

.mon-program-dates {
  display: flex;
  justify-content: space-between;
  gap: 13px;
  margin-top: 22px;
}

.mon-program-dates > div {
  display: grid;
  gap: 6px;
}

.mon-program-dates > div:last-child {
  text-align: right;
}

.mon-program-dates span {
  color: #0e8581;
  font-size: 10px;
  font-weight: 900;
}

.mon-program-dates strong {
  color: #254a66;
  font-size: 11px;
}

.mon-week-timeline {
  position: relative;
  display: flex;
  margin-top: 22px;
}

.mon-week-timeline::before {
  content: "";
  position: absolute;
  top: 5px;
  left: 1%;
  right: 1%;
  height: 3px;
  background: #2cbfc1;
}

.mon-week-node {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  text-align: center;
}

.mon-week-node > div {
  width: 9px;
  height: 9px;
  margin: 1px auto 8px;
  border: 2px solid #1bb0bb;
  border-radius: 50%;
  background: #d7fcfc;
}

.mon-week-node.endpoint > div {
  width: 15px;
  height: 15px;
  margin-top: -2px;
  margin-bottom: 5px;
  border: 3px solid #087c81;
  background: #09a69c;
}

.mon-week-node small {
  color: #7894aa;
  font-size: 7px;
}

.mon-program-note {
  margin: 20px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: #eff8fb;
  color: #5d8299;
  font-size: 10px;
  line-height: 1.7;
}

/* PROCESS */

.mon-process-list {
  display: grid;
  gap: 15px;
  margin-top: 19px;
}

.mon-process-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.mon-process-item > span {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 29px;
  height: 29px;
  border-radius: 50%;
  background: #1188bc;
  color: white;
  font-size: 11px;
  font-weight: 900;
}

.mon-process-item:nth-child(2) > span,
.mon-process-item:nth-child(4) > span {
  background: #0da78e;
}

.mon-process-item:nth-child(3) > span {
  background: #d09c31;
}

.mon-process-item strong {
  color: #244967;
  font-size: 11px;
}

.mon-process-item p {
  margin: 5px 0 0;
  color: #7d93a3;
  font-size: 10px;
  line-height: 1.5;
}

.mon-process-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  border: 1px solid #a7d7ce;
  border-radius: 8px;
  background: #ebf9f5;
  color: #087e73;
  font-size: 11px;
  font-weight: 900;
}

/* FOOTER */

.mon-bottom-actions {
  margin-top: 17px;
}

.mon-bottom-actions button {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 16px;
  border: 1px solid #b8dcd1;
  border-radius: 9px;
  background: #e7f6f1;
  color: #087c67;
  font-size: 11px;
  font-weight: 900;
}

.mon-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 23px;
  padding: 15px 2px;
  border-top: 1px solid #d9e4ec;
  color: #8195a5;
  font-size: 10px;
}

/* MODAL */

.mon-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: #061e2acd;
}

.mon-modal {
  width: min(100%,570px);
  max-height: 92vh;
  overflow-y: auto;
  border-radius: 16px;
  background: white;
  box-shadow: 0 25px 65px #00192355;
}

.mon-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid #e8eef3;
}

.mon-modal-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  background: #e1f6ea;
  color: #07865d;
}

.mon-modal-header > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.mon-modal-header h2 {
  margin: 0;
  color: #173e63;
  font-size: 17px;
}

.mon-modal-header p {
  margin: 6px 0 0;
  color: #8398a7;
  font-size: 11px;
}

.mon-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f7;
  color: #71848f;
}

.mon-modal-body {
  padding: 20px;
}

.mon-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.mon-detail-field {
  min-width: 0;
  padding: 12px;
  border: 1px solid #dce8ef;
  border-radius: 8px;
  background: #f8fbfd;
}

.mon-detail-field span {
  display: block;
  color: #8297a6;
  font-size: 10px;
}

.mon-detail-field strong {
  display: block;
  margin-top: 6px;
  color: #244b67;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.mon-detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 15px;
  padding: 13px;
  border-radius: 8px;
  background: #f3f8fa;
}

.mon-detail-status > span {
  color: #668092;
  font-size: 11px;
}

.mon-detail-reason {
  margin-top: 14px;
  padding: 13px;
  border-radius: 8px;
  background: #fff3f3;
}

.mon-detail-reason strong {
  color: #af4d5b;
  font-size: 11px;
}

.mon-detail-reason p {
  margin: 8px 0 0;
  color: #9b6570;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.mon-detail-note {
  margin-top: 15px;
  color: #7f92a2;
  font-size: 10px;
  line-height: 1.6;
}

.mon-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 18px;
}

.mon-modal-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 43px;
  padding: 11px 15px;
  border: 0;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 900;
}

.mon-modal-actions .secondary {
  background: #e9eff2;
  color: #526b78;
}

.mon-modal-actions .primary {
  background: #078b76;
  color: white;
}

/* LOADING */

.mon-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px;
  background: #edf4f7;
  font-family: Arial, sans-serif;
  text-align: center;
  color: #15394e;
}

.mon-loading h2 span {
  color: #078e72;
}

.mon-loading p {
  color: #718a9c;
  line-height: 1.6;
}

.mon-loading button {
  margin-top: 12px;
  padding: 12px 15px;
  border: 0;
  border-radius: 8px;
  background: #078977;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

/* RESPONSIVE */

@media(max-width:1250px) {
  .mon-topbar {
    gap: 10px;
    padding: 11px 17px;
  }

  .mon-nav button {
    padding: 10px 8px;
    font-size: 10px;
  }

  .mon-stat-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media(max-width:1000px) {
  .mon-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    padding: 12px;
    background: #0b2943;
    border-bottom: 1px solid #ffffff2d;
  }

  .mon-nav.open {
    display: grid;
  }

  .mon-nav button {
    padding: 12px;
    font-size: 12px;
  }

  .mon-account {
    margin-left: auto;
  }

  .mon-mobile-toggle {
    display: grid;
    place-items: center;
  }

  .mon-bottom-grid {
    grid-template-columns: 1fr;
  }
}

@media(max-width:700px) {
  .mon-topbar {
    min-height: 65px;
    padding: 10px 12px;
  }

  .mon-brand-copy strong {
    font-size: 16px;
  }

  .mon-brand-copy > span {
    font-size: 6.5px;
  }

  .mon-brand-icon {
    width: 35px;
    height: 35px;
  }

  .mon-account-info {
    display: none;
  }

  .mon-container {
    padding: 11px;
  }

  .mon-hero {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 23px 18px;
  }

  .mon-hero h1 {
    font-size: 29px;
  }

  .mon-hero-summary {
    width: 100%;
  }

  .mon-stat-grid {
    gap: 9px;
  }

  .mon-stat {
    min-height: 110px;
    padding: 12px;
    gap: 9px;
  }

  .mon-stat-icon {
    width: 34px;
    height: 34px;
  }

  .mon-stat-content strong {
    font-size: 25px;
  }

  .mon-stat > svg {
    display: none;
  }

  .mon-notice {
    flex-wrap: wrap;
    padding: 13px;
  }

  .mon-notice > button {
    width: 100%;
  }

  .mon-card {
    padding: 15px;
  }

  .mon-section-head {
    flex-direction: column;
    align-items: stretch;
  }

  .mon-section-title h2 {
    font-size: 15px;
  }

  .mon-refresh {
    width: 100%;
  }

  .mon-filterbar {
    flex-direction: column;
    align-items: stretch;
  }

  .mon-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .mon-tabs button {
    justify-content: space-between;
  }

  .mon-search {
    min-width: 0;
    width: 100%;
  }

  .mon-table-scroll {
    display: none;
  }

  .mon-mobile-list {
    display: grid;
    gap: 10px;
  }

  .mon-mobile-item {
    padding: 14px;
    border: 1px solid #e3ebef;
    border-radius: 10px;
    background: white;
  }

  .mon-mobile-person {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 13px;
  }

  .mon-mobile-person strong,
  .mon-mobile-person small {
    display: block;
  }

  .mon-mobile-person strong {
    font-size: 12px;
  }

  .mon-mobile-person small {
    margin-top: 5px;
    color: #8498a5;
    font-size: 10px;
  }

  .mon-mobile-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 0;
    border-top: 1px solid #edf2f4;
  }

  .mon-mobile-row span {
    color: #879ba7;
    font-size: 10px;
  }

  .mon-mobile-row strong {
    font-size: 10px;
    text-align: right;
  }

  .mon-mobile-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 12px;
  }

  .mon-modal-header,
  .mon-modal-body {
    padding: 15px;
  }

  .mon-modal-header h2 {
    font-size: 15px;
  }

  .mon-detail-grid {
    grid-template-columns: 1fr;
  }

  .mon-modal-actions {
    flex-direction: column-reverse;
  }

  .mon-modal-actions button {
    width: 100%;
  }

  .mon-footer {
    flex-direction: column;
    text-align: center;
  }

  .mon-week-node small {
    font-size: 5.5px;
  }
}

@media(max-width:400px) {
  .mon-stat-grid {
    grid-template-columns: 1fr;
  }

  .mon-hero-tags {
    gap: 6px;
  }
}

/* PRINT */

@media print {
  .mon-topbar,
  .mon-refresh,
  .mon-tabs,
  .mon-search,
  .mon-bottom-actions,
  .mon-modal-overlay,
  .mon-notice > button {
    display: none !important;
  }

  .mon-container {
    padding: 0;
  }

  .mon-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mon-card,
  .mon-stat {
    box-shadow: none;
  }
}
`;
