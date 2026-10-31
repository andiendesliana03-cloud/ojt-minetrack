
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
// DASHBOARD PERSETUJUAN PESERTA OJT
// MODERN CORPORATE NAVY / EMERALD / WHITE
// TEMPLATE SELARAS DENGAN PENDAFTARAN OJT
//
// KEAMANAN & DATABASE TETAP:
// - Feature flags gagal = nonaktif
// - Endpoint review-registration tetap
// - Konfirmasi keputusan dua tahap
// - Validasi respons server tetap
// - Hanya pengajuan baru pending dapat diproses
// ======================================================

const FLAGS_URL = "/api/system/feature-flags";
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const PROGRAM_START = "12 September 2026";
const PROGRAM_END = "6 Maret 2027";
const TOTAL_WEEKS = 25;

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

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  });
}

function statusLabel(value) {
  return (
    {
      pending: "Menunggu Persetujuan",
      approved: "Disetujui",
      rejected: "Ditolak",
    }[value] ||
    value ||
    "—"
  );
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

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
    check: (
      <path d="m4 12 5 5L20 6" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    x: (
      <path d="M5 5l14 14M19 5 5 19" />
    ),
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
    back: (
      <path d="M19 12H5m6-6-6 6 6 6" />
    ),
    arrow: (
      <path d="M5 12h14m-6-6 6 6-6 6" />
    ),
    menu: (
      <path d="M4 7h16M4 12h16M4 17h16" />
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    flag: (
      <path d="M5 22V4m0 1c5-4 9 4 15 0v11c-6 4-10-4-15 0" />
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
      {paths[name] || paths.check}
    </svg>
  );
}

// ======================================================
// KOMPONEN
// ======================================================

function StatusBadge({ status }) {
  const icon =
    status === "approved"
      ? "check"
      : status === "rejected"
        ? "x"
        : "clock";

  return (
    <span className={`ap-status ${status || "unknown"}`}>
      <Icon name={icon} size={13} />
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={
        `ap-summary-card ${tone} ` +
        (selected ? "selected" : "")
      }
      onClick={onClick}
    >
      <div className="ap-summary-icon">
        <Icon name={icon} size={23} />
      </div>

      <div className="ap-summary-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>Lihat pengajuan</small>
      </div>

      <Icon name="arrow" size={15} />
    </button>
  );
}

function SectionHeading({ icon, title, description }) {
  return (
    <div className="ap-section-title">
      <div className="ap-heading-icon">
        <Icon name={icon} size={21} />
      </div>

      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="ap-detail-item">
      <span>{label}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function PersetujuanPesertaPage() {
  const router = useRouter();

  const [account, setAccount] = useState(null);

  const [features, setFeatures] = useState({
    approval_enabled: false,
    rejection_enabled: false,
  });

  const [flagsLoading, setFlagsLoading] = useState(true);
  const [registrations, setRegistrations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [filter, setFilter] = useState("pending");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");

  const [mobileMenu, setMobileMenu] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ====================================================
  // FEATURE FLAGS — FAIL CLOSED
  // ====================================================

  const loadFeatureFlags = useCallback(async () => {
    setFlagsLoading(true);

    const safeFlags = {
      approval_enabled: false,
      rejection_enabled: false,
    };

    try {
      const response = await fetch(FLAGS_URL, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          "Gagal membaca konfigurasi fitur."
        );
      }

      const result = await response.json();

      if (result?.success !== true) {
        throw new Error(
          "Konfigurasi fitur tidak valid."
        );
      }

      const nextFlags = {
        approval_enabled:
          result.features?.approval_enabled === true,

        rejection_enabled:
          result.features?.rejection_enabled === true,
      };

      setFeatures(nextFlags);
      return nextFlags;
    } catch {
      setFeatures(safeFlags);
      return safeFlags;
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  // ====================================================
  // DATA REGISTRASI — ENDPOINT ASLI
  // ====================================================

  const loadRegistrations = useCallback(
    async (clearError = true) => {
      setLoading(true);

      if (clearError) setError("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          router.replace("/login");
          return false;
        }

        const response = await fetch(
          "/api/mentor/registrations",
          {
            method: "GET",
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
            },
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (response.status === 401) {
          router.replace("/login");
          return false;
        }

        if (response.status === 403) {
          throw new Error(
            "Akses hanya diperbolehkan untuk mentor."
          );
        }

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Gagal mengambil daftar pengajuan."
          );
        }

        setRegistrations(
          Array.isArray(result.registrations)
            ? result.registrations
            : []
        );

        return true;
      } catch (err) {
        setError(
          err?.message ||
            "Gagal membaca daftar pengajuan."
        );

        return false;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // ====================================================
  // IDENTITAS MENTOR
  // ====================================================

  useEffect(() => {
    let active = true;

    async function getAccount() {
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
          data,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (data?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya untuk Mentor OJT."
          );
        }

        if (active) setAccount(data);
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal membaca profil mentor."
          );
        }
      }
    }

    getAccount();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    loadFeatureFlags();
    loadRegistrations();
  }, [loadFeatureFlags, loadRegistrations]);

  // ====================================================
  // PENGAMAN KEPUTUSAN
  // ====================================================

  function decisionEnabled(type, currentFlags) {
    if (type === "approved") {
      return currentFlags.approval_enabled === true;
    }

    if (type === "rejected") {
      return currentFlags.rejection_enabled === true;
    }

    return false;
  }

  function openDecision(item, nextDecision) {
    if (
      processing ||
      flagsLoading ||
      item.source !== "new" ||
      item.status !== "pending" ||
      !decisionEnabled(nextDecision, features)
    ) {
      return;
    }

    setSelected(item);
    setDetail(null);
    setDecision(nextDecision);
    setReason("");
    setError("");
    setMessage("");
  }

  function closeDecision() {
    if (processing) return;

    setSelected(null);
    setReason("");
  }

  function openDetail(item) {
    setDetail(item);
  }

  function closeDetail() {
    setDetail(null);
  }

  // ====================================================
  // KEPUTUSAN MENTOR — ENDPOINT ASLI
  // ====================================================

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing || flagsLoading) return;

    if (
      selected.source !== "new" ||
      selected.status !== "pending"
    ) {
      setError(
        "Pengajuan ini tidak dapat diproses."
      );
      return;
    }

    const cleanReason = reason.trim();

    if (
      decision === "rejected" &&
      (cleanReason.length < 5 ||
        cleanReason.length > 1000)
    ) {
      setError(
        "Alasan penolakan harus 5–1000 karakter."
      );
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const latestFlags = await loadFeatureFlags();

      if (!decisionEnabled(decision, latestFlags)) {
        throw new Error(
          "Fitur keputusan mentor belum diaktifkan."
        );
      }

      const participantName =
        selected.full_name || "Peserta OJT";

      const action =
        decision === "approved"
          ? "MENYETUJUI"
          : "MENOLAK";

      const confirmed = window.confirm(
        `${action} pengajuan OJT?\n\n` +
          `Peserta: ${participantName}\n` +
          `Site: ${selected.site}\n` +
          `Periode: ${formatDate(selected.start_date)} ` +
          `s.d. ${formatDate(selected.end_date)}\n` +
          (decision === "rejected"
            ? `Alasan: ${cleanReason}\n`
            : "") +
          "\nKeputusan ini akan disimpan ke database."
      );

      if (!confirmed) return;

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/login");
        return;
      }

      const response = await fetch(
        "/api/mentor/review-registration",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            request_id: selected.id,
            decision,
            rejection_reason:
              decision === "rejected"
                ? cleanReason
                : null,
            dry_run: false,
          }),
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Keputusan gagal diproses."
        );
      }

      if (
        result.success !== true ||
        result.dry_run !== false ||
        result.status !== decision ||
        (decision === "approved" &&
          !result.program_id)
      ) {
        throw new Error(
          "Hasil keputusan belum dapat dipastikan. " +
            "Periksa daftar pengajuan sebelum mencoba lagi."
        );
      }

      setSelected(null);
      setReason("");
      setFilter(decision);

      const refreshed =
        await loadRegistrations(false);

      if (decision === "approved") {
        setMessage(
          refreshed
            ? `${participantName} berhasil disetujui. Program OJT telah aktif.`
            : `${participantName} berhasil disetujui. Program OJT telah aktif, tetapi daftar belum dapat diperbarui.`
        );
      } else {
        setMessage(
          refreshed
            ? `Pengajuan ${participantName} berhasil ditolak.`
            : `Pengajuan ${participantName} berhasil ditolak, tetapi daftar belum dapat diperbarui.`
        );
      }
    } catch (err) {
      setError(
        err?.message || "Terjadi kesalahan."
      );
    } finally {
      setProcessing(false);
    }
  }

  // ====================================================
  // REFRESH
  // ====================================================

  async function refreshData() {
    if (loading || refreshing || processing) return;

    setRefreshing(true);
    setError("");

    try {
      await Promise.all([
        loadRegistrations(),
        loadFeatureFlags(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // PERHITUNGAN STATISTIK
  // ====================================================

  const counts = useMemo(
    () => ({
      pending: registrations.filter(
        (r) => r.status === "pending"
      ).length,

      approved: registrations.filter(
        (r) => r.status === "approved"
      ).length,

      rejected: registrations.filter(
        (r) => r.status === "rejected"
      ).length,

      all: registrations.length,
    }),
    [registrations]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return registrations.filter((item) => {
      const matchesStatus =
        filter === "all" ||
        item.status === filter;

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
        matchesStatus &&
        searchable.includes(keyword)
      );
    });
  }, [registrations, filter, search]);

  function navigate(path) {
    setMobileMenu(false);
    router.push(path);
  }

  const filterTabs = [
    ["pending", "Menunggu", counts.pending],
    ["approved", "Disetujui", counts.approved],
    ["rejected", "Ditolak", counts.rejected],
    ["all", "Semua", counts.all],
  ];

  const approvalStatus = flagsLoading
    ? "Memeriksa..."
    : features.approval_enabled
      ? "Aktif"
      : "Nonaktif";

  const rejectionStatus = flagsLoading
    ? "Memeriksa..."
    : features.rejection_enabled
      ? "Aktif"
      : "Nonaktif";

  // ====================================================
  // TAMPILAN DASHBOARD
  // ====================================================

  return (
    <div className="ap-app">
      <style>{css}</style>

      {/* TOPBAR */}

      <header className="ap-topbar">
        <button
          type="button"
          className="ap-brand"
          onClick={() => navigate("/")}
        >
          <span className="ap-brand-symbol">
            <Icon name="shield" size={22} />
          </span>

          <span className="ap-brand-copy">
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
            "ap-nav " +
            (mobileMenu ? "open" : "")
          }
          aria-label="Menu utama"
        >
          {NAV.map((item) => (
            <button
              type="button"
              key={item.url}
              className={
                item.url ===
                "/mentor/persetujuan-peserta"
                  ? "active"
                  : ""
              }
              onClick={() => navigate(item.url)}
            >
              <Icon
                name={item.icon}
                size={17}
              />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="ap-account">
          <div className="ap-account-avatar">
            {initials(
              account?.full_name || "Mentor OJT"
            )}
          </div>

          <div className="ap-account-info">
            <strong>
              {account?.full_name || "Mentor OJT"}
            </strong>
            <small>Mentor OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="ap-mobile-toggle"
          aria-label={
            mobileMenu
              ? "Tutup menu"
              : "Buka menu"
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

      <main className="ap-container">

        {/* HERO CORPORATE */}

        <section
          className="ap-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(4,22,43,.97) 0%,
                rgba(5,34,57,.86) 45%,
                rgba(5,35,54,.48) 100%
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div className="ap-hero-content">
            <div className="ap-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Dashboard <span>Persetujuan OJT</span>
            </h1>

            <p>
              Tinjau pengajuan, verifikasi kelengkapan
              data, dan kelola persetujuan peserta
              On Job Training melalui Dashboard Mentor
              secara aman dan terstruktur.
            </p>

            <div className="ap-hero-tags">
              <span>
                <Icon name="shield" size={15} />
                Akses Mentor
              </span>

              <span>
                <Icon name="calendar" size={15} />
                Program OJT 2026–2027
              </span>

              <span>
                <Icon name="check" size={15} />
                Verifikasi Peserta
              </span>
            </div>
          </div>

          <div className="ap-hero-summary">
            <span className="ap-hero-summary-icon">
              <Icon name="file" size={25} />
            </span>

            <small>TOTAL PENGAJUAN</small>

            <strong>{counts.all}</strong>

            <span>
              Pengajuan tercatat
            </span>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="ap-breadcrumb">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Dashboard
          </button>

          <span>/</span>

          <strong>
            Persetujuan Peserta OJT
          </strong>
        </div>

        {/* NOTIFIKASI */}

        {message && (
          <div
            className="ap-alert success"
            role="status"
          >
            <Icon name="check" size={20} />
            <span>{message}</span>

            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setMessage("")}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}

        {error && (
          <div
            className="ap-alert error"
            role="alert"
          >
            <Icon name="info" size={20} />
            <span>{error}</span>

            <button
              type="button"
              aria-label="Tutup pesan kesalahan"
              onClick={() => setError("")}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        )}

        {/* EMPAT KARTU STATISTIK */}

        <section className="ap-summary-grid">
          <SummaryCard
            icon="clock"
            label="Menunggu Persetujuan"
            value={counts.pending}
            tone="amber"
            selected={filter === "pending"}
            onClick={() => setFilter("pending")}
          />

          <SummaryCard
            icon="check"
            label="Disetujui"
            value={counts.approved}
            tone="green"
            selected={filter === "approved"}
            onClick={() => setFilter("approved")}
          />

          <SummaryCard
            icon="x"
            label="Ditolak"
            value={counts.rejected}
            tone="rose"
            selected={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          />

          <SummaryCard
            icon="file"
            label="Total Pengajuan"
            value={counts.all}
            tone="blue"
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </section>

        {/* STATUS FEATURE FLAGS */}

        <section className="ap-feature-bar">
          <div className="ap-feature-heading">
            <div className="ap-feature-icon">
              <Icon name="shield" size={22} />
            </div>

            <div>
              <strong>
                Status Fitur Mentor
              </strong>

              <small>
                Keputusan hanya dapat diproses
                jika fitur diaktifkan oleh server.
              </small>
            </div>
          </div>

          <div className="ap-feature-statuses">
            <div>
              <span>Persetujuan</span>

              <strong
                className={
                  features.approval_enabled
                    ? "enabled"
                    : "disabled"
                }
              >
                {approvalStatus}
              </strong>
            </div>

            <div>
              <span>Penolakan</span>

              <strong
                className={
                  features.rejection_enabled
                    ? "enabled"
                    : "disabled"
                }
              >
                {rejectionStatus}
              </strong>
            </div>
          </div>
        </section>

        {/* DAFTAR PENGAJUAN */}

        <section className="ap-card">
          <div className="ap-section-heading">
            <SectionHeading
              icon="users"
              title="Daftar Pengajuan Peserta"
              description="Pemeriksaan dan pengambilan keputusan pendaftaran OJT."
            />

            <button
              type="button"
              className="ap-refresh"
              onClick={refreshData}
              disabled={
                loading ||
                refreshing ||
                processing ||
                flagsLoading
              }
            >
              <Icon name="refresh" size={17} />

              {loading || refreshing
                ? "Memperbarui..."
                : "Perbarui Data"}
            </button>
          </div>

          {/* FILTER & SEARCH */}

          <div className="ap-filterbar">
            <div className="ap-tabs">
              {filterTabs.map(
                ([value, label, total]) => (
                  <button
                    type="button"
                    key={value}
                    className={
                      filter === value
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setFilter(value);
                      setSelected(null);
                    }}
                  >
                    {label}
                    <span>{total}</span>
                  </button>
                )
              )}
            </div>

            <label className="ap-search">
              <Icon name="search" size={17} />

              <input
                type="search"
                placeholder="Cari nama, site, departemen..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>
          </div>

          <div className="ap-result-count">
            Menampilkan{" "}
            <strong>{filtered.length}</strong>
            {" dari "}
            <strong>{counts.all}</strong>
            {" pengajuan."}
          </div>

          {/* LOADING / EMPTY */}

          {loading ? (
            <div className="ap-empty">
              <Icon name="refresh" size={30} />
              <strong>
                Memuat Data Pengajuan
              </strong>
              <p>
                Memeriksa daftar peserta OJT...
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ap-empty">
              <Icon name="file" size={30} />
              <strong>
                Tidak Ada Pengajuan
              </strong>
              <p>
                Tidak ditemukan pengajuan sesuai
                filter atau pencarian.
              </p>
            </div>
          ) : (
            <>
              {/* TABEL DESKTOP */}

              <div className="ap-table-scroll">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Peserta OJT</th>
                      <th>Departemen / Site</th>
                      <th>Periode Program</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((item, index) => {
                      const canReview =
                        item.source === "new" &&
                        item.status === "pending";

                      return (
                        <tr
                          key={`${item.source}-${item.id}`}
                        >
                          <td>{index + 1}</td>

                          <td>
                            <div className="ap-person">
                              <div className="ap-person-avatar">
                                {initials(item.full_name)}
                              </div>

                              <div>
                                <strong>
                                  {item.full_name ||
                                    "Nama belum tersedia"}
                                </strong>

                                <small>
                                  {item.source === "new"
                                    ? "Pengajuan Baru"
                                    : "Riwayat Lama"}
                                </small>

                                {item.email && (
                                  <small>{item.email}</small>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong className="ap-cell-main">
                              {item.department || "—"}
                            </strong>

                            <small className="ap-cell-sub">
                              {item.site ||
                                "Site belum tersedia"}
                            </small>
                          </td>

                          <td>
                            <span className="ap-date-cell">
                              {formatDate(item.start_date)}
                              <br />
                              s.d.{" "}
                              {formatDate(item.end_date)}
                            </span>
                          </td>

                          <td>
                            {formatTime(item.created_at)}
                          </td>

                          <td>
                            <StatusBadge
                              status={item.status}
                            />

                            {item.status === "rejected" &&
                              item.rejection_reason && (
                                <small className="ap-reason-inline">
                                  {item.rejection_reason}
                                </small>
                              )}
                          </td>

                          <td>
                            <div className="ap-row-actions">
                              <button
                                type="button"
                                className="details"
                                onClick={() =>
                                  openDetail(item)
                                }
                              >
                                Detail
                              </button>

                              {canReview ? (
                                <>
                                  <button
                                    type="button"
                                    className="approve"
                                    disabled={
                                      processing ||
                                      flagsLoading ||
                                      !features.approval_enabled
                                    }
                                    onClick={() =>
                                      openDecision(
                                        item,
                                        "approved"
                                      )
                                    }
                                  >
                                    Setujui
                                  </button>

                                  <button
                                    type="button"
                                    className="reject"
                                    disabled={
                                      processing ||
                                      flagsLoading ||
                                      !features.rejection_enabled
                                    }
                                    onClick={() =>
                                      openDecision(
                                        item,
                                        "rejected"
                                      )
                                    }
                                  >
                                    Tolak
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* KARTU MOBILE */}

              <div className="ap-mobile-list">
                {filtered.map((item) => {
                  const canReview =
                    item.source === "new" &&
                    item.status === "pending";

                  return (
                    <div
                      className="ap-mobile-item"
                      key={`${item.source}-${item.id}`}
                    >
                      <div className="ap-mobile-person">
                        <div className="ap-person-avatar">
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

                      <div className="ap-mobile-meta">
                        <span>Periode OJT</span>
                        <strong>
                          {formatDate(item.start_date)}
                          {" – "}
                          {formatDate(item.end_date)}
                        </strong>
                      </div>

                      <div className="ap-mobile-meta">
                        <span>Diajukan</span>
                        <strong>
                          {formatTime(item.created_at)}
                        </strong>
                      </div>

                      <div className="ap-mobile-meta">
                        <span>Sumber</span>
                        <strong>
                          {item.source === "new"
                            ? "Pengajuan Baru"
                            : "Riwayat Lama"}
                        </strong>
                      </div>

                      <StatusBadge status={item.status} />

                      {item.status === "rejected" &&
                        item.rejection_reason && (
                          <p className="ap-mobile-reason">
                            Alasan:{" "}
                            {item.rejection_reason}
                          </p>
                        )}

                      <div className="ap-row-actions mobile">
                        <button
                          type="button"
                          className="details"
                          onClick={() =>
                            openDetail(item)
                          }
                        >
                          Detail
                        </button>

                        {canReview && (
                          <>
                            <button
                              type="button"
                              className="approve"
                              disabled={
                                processing ||
                                flagsLoading ||
                                !features.approval_enabled
                              }
                              onClick={() =>
                                openDecision(
                                  item,
                                  "approved"
                                )
                              }
                            >
                              Setujui
                            </button>

                            <button
                              type="button"
                              className="reject"
                              disabled={
                                processing ||
                                flagsLoading ||
                                !features.rejection_enabled
                              }
                              onClick={() =>
                                openDecision(
                                  item,
                                  "rejected"
                                )
                              }
                            >
                              Tolak
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* PANEL INFORMASI BAWAH */}

        <div className="ap-bottom-grid">

          {/* PERIODE PROGRAM */}

          <section className="ap-card">
            <SectionHeading
              icon="calendar"
              title="Program OJT 2026–2027"
              description="Kalender Global Program Week 01–25."
            />

            <div className="ap-program-dates">
              <div>
                <span>Mulai · Week 01</span>
                <strong>{PROGRAM_START}</strong>
              </div>

              <div>
                <span>Selesai · Week 25</span>
                <strong>{PROGRAM_END}</strong>
              </div>
            </div>

            <div className="ap-week-timeline">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, index) => (
                  <div
                    className={
                      "ap-week-node " +
                      (index === 0 ||
                      index === TOTAL_WEEKS - 1
                        ? "endpoint"
                        : "")
                    }
                    key={index}
                  >
                    <div />
                    <small>
                      {String(index + 1).padStart(2, "0")}
                    </small>
                  </div>
                )
              )}
            </div>

            <p className="ap-program-note">
              Kalender Global digunakan untuk monitoring
              Week 01–25. Tanggal setiap pengajuan tetap
              ditampilkan dari data aktual sistem.
            </p>
          </section>

          {/* ALUR PERSETUJUAN */}

          <section className="ap-card">
            <SectionHeading
              icon="clipboard"
              title="Alur Persetujuan Peserta"
              description="Tahapan pengelolaan pengajuan OJT."
            />

            <div className="ap-process-list">
              {[
                [
                  "Pendaftaran Peserta",
                  "Peserta mengajukan pendaftaran OJT.",
                ],
                [
                  "Verifikasi Data",
                  "Data pengajuan tersedia untuk diperiksa.",
                ],
                [
                  "Keputusan Mentor",
                  "Mentor menyetujui atau menolak sesuai kewenangan.",
                ],
                [
                  "Status Pengajuan",
                  "Keputusan dan status tersimpan melalui sistem.",
                ],
              ].map(([title, text], index) => (
                <div
                  key={index}
                  className="ap-process-item"
                >
                  <span>{index + 1}</span>

                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* BACK */}

        <div className="ap-bottom-actions">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            <Icon name="back" size={17} />
            Kembali ke Dashboard Mentor
          </button>
        </div>

        <footer className="ap-footer">
          <span>
            OJT MineTrack v2.0 · Emergency Response Group
          </span>

          <span>
            PT Berau Coal · Program 2026–2027
          </span>
        </footer>
      </main>

      {/* =================================================
          MODAL DETAIL — HANYA MEMBACA DATA
      ================================================= */}

      {detail && (
        <div
          className="ap-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDetail();
            }
          }}
        >
          <section
            className="ap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ap-detail-title"
          >
            <div className="ap-modal-header">
              <div className="ap-modal-icon">
                <Icon name="user" size={22} />
              </div>

              <div>
                <h2 id="ap-detail-title">
                  Detail Pengajuan Peserta
                </h2>

                <p>
                  Informasi berdasarkan data sistem.
                </p>
              </div>

              <button
                type="button"
                className="ap-close"
                onClick={closeDetail}
                aria-label="Tutup"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="ap-modal-body">
              <div className="ap-detail-grid">
                <DetailItem
                  label="Nama Lengkap"
                  value={detail.full_name}
                />

                <DetailItem
                  label="Email"
                  value={detail.email}
                />

                <DetailItem
                  label="Departemen"
                  value={detail.department}
                />

                <DetailItem
                  label="Site"
                  value={detail.site}
                />

                <DetailItem
                  label="Tanggal Mulai"
                  value={formatDate(detail.start_date)}
                />

                <DetailItem
                  label="Tanggal Selesai"
                  value={formatDate(detail.end_date)}
                />

                <DetailItem
                  label="Tanggal Pengajuan"
                  value={formatTime(detail.created_at)}
                />

                <DetailItem
                  label="Sumber Data"
                  value={
                    detail.source === "new"
                      ? "Pengajuan Baru"
                      : "Riwayat Lama"
                  }
                />
              </div>

              <div className="ap-detail-status">
                <span>Status Pengajuan</span>
                <StatusBadge status={detail.status} />
              </div>

              {detail.rejection_reason && (
                <div className="ap-detail-reason">
                  <strong>Alasan Penolakan</strong>
                  <p>{detail.rejection_reason}</p>
                </div>
              )}

              <button
                type="button"
                className="ap-detail-close"
                onClick={closeDetail}
              >
                Tutup Detail
              </button>
            </div>
          </section>
        </div>
      )}

      {/* =================================================
          MODAL KEPUTUSAN — ENDPOINT TETAP
      ================================================= */}

      {selected && (
        <div
          className="ap-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closeDecision();
            }
          }}
        >
          <section
            className="ap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ap-modal-title"
          >
            <div className="ap-modal-header">
              <div className="ap-modal-icon">
                <Icon
                  name={
                    decision === "approved"
                      ? "check"
                      : "x"
                  }
                  size={22}
                />
              </div>

              <div>
                <h2 id="ap-modal-title">
                  {decision === "approved"
                    ? "Persetujuan Peserta OJT"
                    : "Penolakan Peserta OJT"}
                </h2>

                <p>
                  Konfirmasi keputusan pengajuan.
                </p>
              </div>

              <button
                type="button"
                className="ap-close"
                onClick={closeDecision}
                disabled={processing}
                aria-label="Tutup"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="ap-modal-body">

              <div className="ap-modal-participant">
                <div className="ap-person-avatar">
                  {initials(selected.full_name)}
                </div>

                <div>
                  <strong>
                    {selected.full_name ||
                      "Peserta OJT"}
                  </strong>

                  <small>
                    {selected.department || "—"}
                    {" · "}
                    {selected.site || "—"}
                  </small>
                </div>
              </div>

              <div className="ap-modal-period">
                <span>Periode Program OJT</span>

                <strong>
                  {formatDate(selected.start_date)}
                  {" – "}
                  {formatDate(selected.end_date)}
                </strong>
              </div>

              {decision === "approved" ? (
                <div className="ap-modal-notice approve">
                  <Icon name="info" size={20} />

                  <span>
                    Setelah disetujui, server akan
                    memproses pengajuan dan
                    mengaktifkan program OJT
                    sesuai aturan sistem.
                  </span>
                </div>
              ) : (
                <div className="ap-modal-notice reject">
                  <Icon name="info" size={20} />

                  <span>
                    Penolakan harus disertai alasan
                    yang jelas dan akan tersimpan
                    sebagai bagian dari riwayat pengajuan.
                  </span>
                </div>
              )}

              <form onSubmit={submitDecision}>
                {decision === "rejected" && (
                  <label className="ap-reason-field">
                    <strong>
                      Alasan Penolakan *
                    </strong>

                    <textarea
                      rows={5}
                      required
                      minLength={5}
                      maxLength={1000}
                      value={reason}
                      disabled={processing}
                      placeholder="Tuliskan alasan penolakan..."
                      onChange={(event) =>
                        setReason(event.target.value)
                      }
                    />

                    <small>
                      {reason.length}/1000 karakter
                    </small>
                  </label>
                )}

                <div className="ap-modal-actions">
                  <button
                    type="button"
                    className="cancel"
                    onClick={closeDecision}
                    disabled={processing}
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className={
                      decision === "approved"
                        ? "confirm-approve"
                        : "confirm-reject"
                    }
                    disabled={
                      processing || flagsLoading
                    }
                  >
                    <Icon
                      name={
                        decision === "approved"
                          ? "check"
                          : "x"
                      }
                      size={17}
                    />

                    {processing
                      ? "Memproses..."
                      : decision === "approved"
                        ? "Konfirmasi Persetujuan"
                        : "Konfirmasi Penolakan"}
                  </button>
                </div>
              </form>
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
.ap-app,
.ap-app * {
  box-sizing: border-box;
}

.ap-app {
  min-height: 100vh;
  background: #edf3f7;
  color: #173654;
  font-family: Arial, Helvetica, sans-serif;
}

.ap-app button,
.ap-app input,
.ap-app textarea {
  font: inherit;
}

.ap-app button {
  cursor: pointer;
}

.ap-app button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.ap-app button:focus-visible,
.ap-app input:focus-visible,
.ap-app textarea:focus-visible {
  outline: 3px solid #67d7bb;
  outline-offset: 2px;
}

/* TOPBAR */

.ap-topbar {
  position: sticky;
  top: 0;
  z-index: 40;

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;

  min-height: 76px;
  padding: 11px 28px;

  background: #081e35;
  color: white;

  border-bottom: 1px solid #ffffff2b;
  box-shadow: 0 5px 20px #0a294024;
}

.ap-brand {
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

.ap-brand-symbol {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;

  border: 1px solid #49cbb88a;
  border-radius: 11px;
  background: #0c78736e;
  color: #71e8c7;
}

.ap-brand-copy strong {
  display: block;
  white-space: nowrap;
  font-size: 21px;
  letter-spacing: -.5px;
}

.ap-brand-copy strong em {
  color: #5de1c1;
  font-style: normal;
}

.ap-brand-copy strong small {
  margin-left: 7px;
  padding: 4px 6px;
  border-radius: 5px;
  background: #5be2c2;
  color: #073647;
  font-size: 10px;
}

.ap-brand-copy > span {
  display: block;
  margin-top: 5px;
  color: #c4d8e4;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
}

.ap-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
}

.ap-nav button {
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

.ap-nav button:hover {
  background: #ffffff18;
}

.ap-nav button.active {
  background: #0c807b;
  color: white;
  box-shadow: inset 0 -2px #68ecd2;
}

.ap-account {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.ap-account-avatar {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  flex-shrink: 0;

  border-radius: 50%;
  background: #d8f6eb;
  color: #08795d;
  font-size: 12px;
  font-weight: 900;
}

.ap-account-info strong {
  display: block;
  max-width: 155px;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.ap-account-info small {
  display: block;
  margin-top: 4px;
  color: #b3cbd6;
  font-size: 10px;
}

.ap-mobile-toggle {
  display: none;
  padding: 7px;
  border: 0;
  background: transparent;
  color: white;
}

/* CONTENT */

.ap-container {
  max-width: 1500px;
  margin: auto;
  padding: 23px;
}

/* HERO */

.ap-hero {
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

.ap-hero-content {
  max-width: 750px;
}

.ap-kicker {
  color: #e6c17a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.ap-hero h1 {
  margin: 12px 0;
  font-size: clamp(29px,3.3vw,44px);
  line-height: 1.15;
  letter-spacing: -.8px;
}

.ap-hero h1 span {
  color: #5be3c2;
}

.ap-hero p {
  max-width: 650px;
  margin: 0;
  color: #e0ebef;
  font-size: 12px;
  line-height: 1.8;
}

.ap-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 18px;
}

.ap-hero-tags span {
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

.ap-hero-tags svg {
  color: #83e7c9;
}

.ap-hero-summary {
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

.ap-hero-summary-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  background: #e2f5ed;
  color: #108868;
}

.ap-hero-summary small {
  color: #aacbd9;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .8px;
}

.ap-hero-summary > strong {
  font-size: 38px;
}

.ap-hero-summary > span:last-child {
  color: #d6e5ea;
  font-size: 10px;
}

/* BREADCRUMB */

.ap-breadcrumb {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 15px 3px;
  font-size: 11px;
  color: #8ba2af;
}

.ap-breadcrumb button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #6c8595;
  font-weight: 750;
}

.ap-breadcrumb strong {
  color: #087c75;
}

/* ALERTS */

.ap-alert {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 15px;
  margin-bottom: 15px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.6;
}

.ap-alert > span {
  flex: 1;
}

.ap-alert button {
  border: 0;
  background: transparent;
  color: inherit;
}

.ap-alert.success {
  color: #08794f;
  background: #edf9f1;
  border: 1px solid #bee6ce;
}

.ap-alert.error {
  color: #b12b2b;
  background: #fff1f1;
  border: 1px solid #f3c8c8;
}

/* FOUR STATISTICS */

.ap-summary-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 13px;
  margin-bottom: 16px;
}

.ap-summary-card {
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

.ap-summary-card.selected {
  outline: 2px solid #58cfae;
  outline-offset: -2px;
}

.ap-summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 45px;
  height: 45px;
  border-radius: 11px;
}

.ap-summary-card.amber .ap-summary-icon {
  background: #fff1d8;
  color: #c18a20;
}

.ap-summary-card.green .ap-summary-icon {
  background: #def8ed;
  color: #078c67;
}

.ap-summary-card.rose .ap-summary-icon {
  background: #fff0f2;
  color: #c94c62;
}

.ap-summary-card.blue .ap-summary-icon {
  background: #e0effe;
  color: #1979bf;
}

.ap-summary-content {
  display: grid;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.ap-summary-content > span {
  color: #73899b;
  font-size: 10px;
  font-weight: 800;
}

.ap-summary-content > strong {
  color: #123d6b;
  font-size: 30px;
}

.ap-summary-content > small {
  color: #8497a5;
  font-size: 10px;
}

.ap-summary-card > svg {
  flex-shrink: 0;
  color: #93a7b7;
}

/* FEATURE BAR */

.ap-feature-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;

  padding: 15px 18px;
  margin-bottom: 17px;

  border: 1px solid #c7e4ed;
  border-radius: 12px;
  background: #eaf6fa;
}

.ap-feature-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}

.ap-feature-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 42px;
  height: 42px;

  border-radius: 10px;
  background: #d8ebf5;
  color: #2577a1;
}

.ap-feature-heading strong {
  color: #225b7a;
  font-size: 12px;
}

.ap-feature-heading small {
  display: block;
  margin-top: 5px;
  color: #5e8191;
  font-size: 11px;
  line-height: 1.6;
}

.ap-feature-statuses {
  display: flex;
  gap: 10px;
}

.ap-feature-statuses > div {
  display: grid;
  gap: 6px;
  min-width: 115px;
  padding: 10px;
  border: 1px solid #d7e8ee;
  border-radius: 9px;
  background: white;
  text-align: center;
}

.ap-feature-statuses span {
  color: #8193a0;
  font-size: 10px;
}

.ap-feature-statuses strong {
  font-size: 11px;
}

.ap-feature-statuses .enabled {
  color: #087c55;
}

.ap-feature-statuses .disabled {
  color: #b5791f;
}

/* CARDS */

.ap-card {
  min-width: 0;
  padding: 21px;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  background: white;
  box-shadow: 0 6px 20px #17384d0d;
}

.ap-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 19px;
}

.ap-section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ap-heading-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 41px;
  height: 41px;
  border-radius: 9px;
  background: linear-gradient(
    135deg,
    #10487e,
    #188bcb
  );
  color: white;
}

.ap-section-title h2 {
  margin: 0;
  color: #123e70;
  font-size: 17px;
}

.ap-section-title p {
  margin: 5px 0 0;
  color: #7d91a2;
  font-size: 11px;
  line-height: 1.5;
}

.ap-refresh {
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

.ap-filterbar {
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

.ap-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ap-tabs button {
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

.ap-tabs button.active {
  background: #087d76;
  color: white;
}

.ap-tabs button > span {
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

.ap-tabs button.active > span {
  background: #ffffff30;
  color: white;
}

.ap-search {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 240px;
  padding: 0 12px;
  border: 1px solid #d7e4eb;
  border-radius: 8px;
  background: white;
  color: #8ca2af;
}

.ap-search input {
  width: 100%;
  min-height: 40px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #1a3c56;
  font-size: 11px;
}

.ap-result-count {
  padding: 13px 2px;
  color: #8497a4;
  font-size: 10px;
}

.ap-result-count strong {
  color: #087d73;
}

/* TABLE */

.ap-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.ap-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
  text-align: left;
  font-size: 11px;
}

.ap-table th {
  padding: 13px 11px;
  background: #eaf1f6;
  color: #426178;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.ap-table td {
  padding: 14px 11px;
  border-bottom: 1px solid #eaf0f3;
  color: #355265;
  vertical-align: middle;
}

.ap-table tbody tr:hover {
  background: #fafdfc;
}

.ap-person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 165px;
}

.ap-person-avatar {
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

.ap-person strong,
.ap-person small {
  display: block;
}

.ap-person strong {
  color: #20405a;
  font-size: 11px;
}

.ap-person small {
  margin-top: 5px;
  color: #879baa;
  font-size: 10px;
  overflow-wrap: anywhere;
}

.ap-cell-main,
.ap-cell-sub {
  display: block;
}

.ap-cell-main {
  font-size: 11px;
}

.ap-cell-sub {
  margin-top: 5px;
  color: #8197a6;
  font-size: 10px;
}

.ap-date-cell {
  font-size: 10px;
  line-height: 1.7;
  white-space: nowrap;
}

/* STATUS */

.ap-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.ap-status.pending {
  background: #fff3d9;
  color: #ad7a23;
}

.ap-status.approved {
  background: #dff6e9;
  color: #078257;
}

.ap-status.rejected {
  background: #fff0f2;
  color: #c14d61;
}

.ap-status.unknown {
  background: #edf2f5;
  color: #78909d;
}

.ap-reason-inline {
  display: block;
  margin-top: 8px;
  max-width: 180px;
  color: #b35d70;
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* ACTIONS */

.ap-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ap-row-actions button {
  padding: 8px 10px;
  border: 0;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 900;
}

.ap-row-actions .details {
  background: #e7f1fd;
  color: #286ba7;
}

.ap-row-actions .approve {
  background: #078c5f;
  color: white;
}

.ap-row-actions .reject {
  background: #fff0f2;
  color: #bf3c55;
}

/* EMPTY */

.ap-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 45px 20px;
  color: #8ca1b0;
  text-align: center;
}

.ap-empty strong {
  color: #47697d;
  font-size: 14px;
}

.ap-empty p {
  margin: 0;
  font-size: 11px;
  line-height: 1.6;
}

.ap-mobile-list {
  display: none;
}

/* BOTTOM PANELS */

.ap-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 16px;
}

.ap-program-dates {
  display: flex;
  justify-content: space-between;
  gap: 13px;
  margin-top: 22px;
}

.ap-program-dates > div {
  display: grid;
  gap: 6px;
}

.ap-program-dates > div:last-child {
  text-align: right;
}

.ap-program-dates span {
  color: #0e8581;
  font-size: 10px;
  font-weight: 900;
}

.ap-program-dates strong {
  color: #254a66;
  font-size: 11px;
}

.ap-week-timeline {
  position: relative;
  display: flex;
  margin-top: 22px;
}

.ap-week-timeline::before {
  content: "";
  position: absolute;
  top: 5px;
  left: 1%;
  right: 1%;
  height: 3px;
  background: #2cbfc1;
}

.ap-week-node {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  text-align: center;
}

.ap-week-node > div {
  width: 9px;
  height: 9px;
  margin: 1px auto 8px;
  border: 2px solid #1bb0bb;
  border-radius: 50%;
  background: #d7fcfc;
}

.ap-week-node.endpoint > div {
  width: 15px;
  height: 15px;
  margin-top: -2px;
  margin-bottom: 5px;
  border: 3px solid #087c81;
  background: #09a69c;
}

.ap-week-node small {
  color: #7894aa;
  font-size: 7px;
}

.ap-program-note {
  margin: 20px 0 0;
  padding: 12px;
  border-radius: 8px;
  background: #eff8fb;
  color: #5d8299;
  font-size: 10px;
  line-height: 1.7;
}

/* PROCESS */

.ap-process-list {
  display: grid;
  gap: 15px;
  margin-top: 19px;
}

.ap-process-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ap-process-item > span {
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

.ap-process-item:nth-child(2) > span,
.ap-process-item:nth-child(4) > span {
  background: #0da78e;
}

.ap-process-item:nth-child(3) > span {
  background: #d09c31;
}

.ap-process-item strong {
  color: #244967;
  font-size: 11px;
}

.ap-process-item p {
  margin: 5px 0 0;
  color: #7d93a3;
  font-size: 10px;
  line-height: 1.5;
}

/* BACK & FOOTER */

.ap-bottom-actions {
  margin-top: 17px;
}

.ap-bottom-actions button {
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

.ap-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;

  margin-top: 23px;
  padding: 15px 2px;

  border-top: 1px solid #d9e4ec;
  color: #8195a5;
  font-size: 10px;
}

/* MODALS */

.ap-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;

  display: grid;
  place-items: center;
  padding: 16px;

  background: #061e2acd;
}

.ap-modal {
  width: min(100%,570px);
  max-height: 92vh;
  overflow-y: auto;

  border-radius: 16px;
  background: white;
  box-shadow: 0 25px 65px #00192355;
}

.ap-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;

  padding: 20px;
  border-bottom: 1px solid #e8eef3;
}

.ap-modal-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 43px;
  height: 43px;

  border-radius: 11px;
  background: #e1f6ea;
  color: #07865d;
}

.ap-modal-header > div:nth-child(2) {
  flex: 1;
}

.ap-modal-header h2 {
  margin: 0;
  color: #173e63;
  font-size: 17px;
}

.ap-modal-header p {
  margin: 6px 0 0;
  color: #8398a7;
  font-size: 11px;
}

.ap-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f7;
  color: #71848f;
}

.ap-modal-body {
  padding: 20px;
}

.ap-modal-participant {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.ap-modal-participant strong,
.ap-modal-participant small {
  display: block;
}

.ap-modal-participant strong {
  font-size: 13px;
}

.ap-modal-participant small {
  margin-top: 5px;
  color: #7e909a;
  font-size: 11px;
}

.ap-modal-period {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 13px;
  border-radius: 8px;
  background: #edf6fb;
}

.ap-modal-period span {
  color: #658397;
  font-size: 11px;
}

.ap-modal-period strong {
  font-size: 11px;
}

.ap-modal-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 16px 0;
  padding: 13px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.7;
}

.ap-modal-notice svg {
  flex-shrink: 0;
}

.ap-modal-notice.approve {
  background: #edf9f1;
  color: #15784f;
}

.ap-modal-notice.reject {
  background: #fff6e8;
  color: #a35b27;
}

.ap-reason-field {
  display: block;
  margin-top: 16px;
}

.ap-reason-field strong {
  display: block;
  font-size: 11px;
}

.ap-reason-field textarea {
  width: 100%;
  resize: vertical;
  margin-top: 9px;
  padding: 12px;

  border: 1px solid #d9e5e9;
  border-radius: 9px;

  color: #1a3945;
  font-size: 12px;
  line-height: 1.6;
}

.ap-reason-field small {
  display: block;
  margin-top: 6px;
  color: #8799a3;
  text-align: right;
  font-size: 10px;
}

.ap-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
}

.ap-modal-actions button,
.ap-detail-close {
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

.ap-modal-actions .cancel {
  background: #e9eff2;
  color: #526b78;
}

.ap-modal-actions .confirm-approve {
  background: #078b61;
  color: white;
}

.ap-modal-actions .confirm-reject {
  background: #ce4356;
  color: white;
}

/* DETAIL MODAL */

.ap-detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ap-detail-item {
  min-width: 0;
  padding: 12px;
  border: 1px solid #dce8ef;
  border-radius: 8px;
  background: #f8fbfd;
}

.ap-detail-item span {
  display: block;
  color: #8297a6;
  font-size: 10px;
}

.ap-detail-item strong {
  display: block;
  margin-top: 6px;
  color: #244b67;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.ap-detail-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 15px;
  padding: 13px;
  background: #f3f8fa;
  border-radius: 8px;
}

.ap-detail-status > span {
  font-size: 11px;
  color: #668092;
}

.ap-detail-reason {
  margin-top: 14px;
  padding: 13px;
  border-radius: 8px;
  background: #fff3f3;
}

.ap-detail-reason strong {
  font-size: 11px;
  color: #af4d5b;
}

.ap-detail-reason p {
  font-size: 11px;
  color: #9b6570;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.ap-detail-close {
  width: 100%;
  margin-top: 18px;
  background: #e8f1f8;
  color: #225d91;
}

/* RESPONSIVE TABLET */

@media(max-width:1250px) {
  .ap-topbar {
    gap: 10px;
    padding: 11px 17px;
  }

  .ap-nav button {
    padding: 10px 8px;
    font-size: 10px;
  }

  .ap-summary-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media(max-width:1000px) {
  .ap-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    padding: 12px;
    background: #0b2943;
    border-bottom: 1px solid #ffffff2d;
  }

  .ap-nav.open {
    display: grid;
  }

  .ap-nav button {
    padding: 12px;
    font-size: 12px;
  }

  .ap-account {
    margin-left: auto;
  }

  .ap-mobile-toggle {
    display: grid;
    place-items: center;
  }

  .ap-feature-bar {
    flex-wrap: wrap;
  }

  .ap-bottom-grid {
    grid-template-columns: 1fr;
  }
}

/* MOBILE */

@media(max-width:700px) {
  .ap-topbar {
    min-height: 65px;
    padding: 10px 12px;
  }

  .ap-brand-copy strong {
    font-size: 16px;
  }

  .ap-brand-copy > span {
    font-size: 6.5px;
  }

  .ap-brand-symbol {
    width: 35px;
    height: 35px;
  }

  .ap-account-info {
    display: none;
  }

  .ap-container {
    padding: 11px;
  }

  .ap-hero {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 23px 18px;
  }

  .ap-hero h1 {
    font-size: 29px;
  }

  .ap-hero-summary {
    width: 100%;
  }

  .ap-summary-grid {
    gap: 9px;
  }

  .ap-summary-card {
    min-height: 110px;
    padding: 12px;
    gap: 9px;
  }

  .ap-summary-icon {
    width: 34px;
    height: 34px;
  }

  .ap-summary-content > strong {
    font-size: 25px;
  }

  .ap-summary-card > svg {
    display: none;
  }

  .ap-feature-statuses {
    width: 100%;
  }

  .ap-feature-statuses > div {
    flex: 1;
    min-width: 0;
  }

  .ap-card {
    padding: 15px;
  }

  .ap-section-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .ap-section-title h2 {
    font-size: 15px;
  }

  .ap-refresh {
    width: 100%;
  }

  .ap-filterbar {
    flex-direction: column;
    align-items: stretch;
  }

  .ap-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .ap-tabs button {
    justify-content: space-between;
  }

  .ap-search {
    width: 100%;
    min-width: 0;
  }

  .ap-table-scroll {
    display: none;
  }

  .ap-mobile-list {
    display: grid;
    gap: 10px;
  }

  .ap-mobile-item {
    padding: 14px;
    border: 1px solid #e3ebef;
    border-radius: 10px;
    background: #fff;
  }

  .ap-mobile-person {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 13px;
  }

  .ap-mobile-person strong,
  .ap-mobile-person small {
    display: block;
  }

  .ap-mobile-person strong {
    font-size: 12px;
  }

  .ap-mobile-person small {
    margin-top: 5px;
    color: #8498a5;
    font-size: 10px;
  }

  .ap-mobile-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 0;
    border-top: 1px solid #edf2f4;
  }

  .ap-mobile-meta span {
    color: #879ba7;
    font-size: 10px;
  }

  .ap-mobile-meta strong {
    font-size: 10px;
    text-align: right;
  }

  .ap-mobile-item > .ap-status {
    margin-top: 12px;
  }

  .ap-mobile-reason {
    color: #b34d60;
    font-size: 11px;
    line-height: 1.6;
  }

  .ap-row-actions.mobile {
    margin-top: 14px;
  }

  .ap-row-actions.mobile button {
    flex: 1;
    padding: 11px 7px;
  }

  .ap-modal-header,
  .ap-modal-body {
    padding: 15px;
  }

  .ap-modal-header h2 {
    font-size: 15px;
  }

  .ap-modal-actions {
    flex-direction: column-reverse;
  }

  .ap-modal-actions button {
    width: 100%;
  }

  .ap-detail-grid {
    grid-template-columns: 1fr;
  }

  .ap-footer {
    flex-direction: column;
    text-align: center;
  }

  .ap-week-node small {
    font-size: 5.5px;
  }
}

@media print {
  .ap-topbar,
  .ap-refresh,
  .ap-tabs,
  .ap-search,
  .ap-bottom-actions,
  .ap-modal-overlay {
    display: none !important;
  }

  .ap-container {
    padding: 0;
  }

  .ap-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .ap-card,
  .ap-summary-card {
    box-shadow: none;
  }
}
`;
