
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
// PERSETUJUAN PESERTA OJT — MENTOR
//
// UPDATE:
// - Nama Mentor: Andien Desliana
// - Inisial Mentor: AL
// - Email peserta desktop dan mobile
// - Email pada detail dan konfirmasi
// - Site PMO dan TSP
// - Feature Flags menggunakan token autentikasi
// - Transaksi tetap melalui server
// - Database dan RPC tidak diubah
// ======================================================

const FLAGS_URL = "/api/system/feature-flags";
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const MENTOR_DISPLAY_NAME = "Andien Desliana";
const MENTOR_INITIALS = "AL";

// ======================================================
// DAFTAR SITE OJT
// ======================================================

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
  "PMO",
  "TSP",
];

const NAV = [
  ["Dashboard", "/", "home"],
  ["Peserta OJT", "/mentor/monitoring-peserta", "users"],
  ["Pendaftaran Peserta", "/mentor/daftar-peserta", "file"],
  ["Persetujuan", "/mentor/persetujuan-peserta", "check"],
];

// ======================================================
// ICON COMPONENT
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
    file: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    x: <path d="M5 5l14 14M19 5 5 19" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
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
// HELPERS
// ======================================================

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function formatDate(value) {
  if (!value) return "—";

  const date = dateOnly(value);
  const parts = date.split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : String(value);
}

function formatTime(value) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Makassar",
  });
}

function statusLabel(status) {
  return (
    {
      pending: "Menunggu Persetujuan",
      approved: "Disetujui",
      rejected: "Ditolak",
    }[status] ||
    status ||
    "—"
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`ap-status ${status || ""}`}>
      <Icon
        name={
          status === "approved"
            ? "check"
            : status === "rejected"
            ? "x"
            : "clock"
        }
        size={13}
      />
      {statusLabel(status)}
    </span>
  );
}

function sourceOf(item) {
  if (item?.source === "new") return "new";
  if (item?.source === "legacy") return "legacy";
  return null;
}

function canReview(item) {
  return Boolean(
    item?.id &&
      item?.status === "pending" &&
      sourceOf(item)
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
// MAIN PAGE
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

  const [detail, setDetail] = useState(null);
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState("approved");

  const [site, setSite] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const [mobileMenu, setMobileMenu] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ====================================================
  // FEATURE FLAGS
  // ====================================================

  const loadFeatureFlags = useCallback(async () => {
    setFlagsLoading(true);

    const disabled = {
      approval_enabled: false,
      rejection_enabled: false,
    };

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setFeatures(disabled);
        return disabled;
      }

      const response = await fetch(FLAGS_URL, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Gagal membaca fitur.");
      }

      const result = await response.json();

      if (result?.success !== true) {
        throw new Error("Respons fitur tidak valid.");
      }

      const next = {
        approval_enabled:
          result.features?.approval_enabled === true,
        rejection_enabled:
          result.features?.rejection_enabled === true,
      };

      setFeatures(next);
      return next;
    } catch (err) {
      console.error("Feature Flags:", err);
      setFeatures(disabled);
      return disabled;
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  // ====================================================
  // LOAD REGISTRATIONS
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
            headers: {
              Authorization: `Bearer ${session.access_token}`,
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
          throw new Error("Akses khusus Mentor OJT.");
        }

        if (!response.ok) {
          throw new Error(
            result.error || "Gagal mengambil pengajuan."
          );
        }

        const rows = Array.isArray(result.registrations)
          ? result.registrations
          : [];

        setRegistrations(rows);
        return true;
      } catch (err) {
        setError(
          err?.message || "Gagal membaca daftar pengajuan."
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
          .select("id,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (data?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya untuk Mentor OJT."
          );
        }

        if (active) {
          setAccount(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memeriksa mentor."
          );
        }
      }
    }

    getAccount();

    return () => {
      active = false;
    };
  }, [router]);

  // ====================================================
  // INITIAL LOAD
  // ====================================================

  useEffect(() => {
    loadFeatureFlags();
    loadRegistrations();
  }, [loadFeatureFlags, loadRegistrations]);

  // ====================================================
  // FEATURE VALIDATION
  // ====================================================

  function decisionEnabled(type, flags) {
    return type === "approved"
      ? flags.approval_enabled === true
      : type === "rejected"
      ? flags.rejection_enabled === true
      : false;
  }

  // ====================================================
  // DETAIL MODAL
  // ====================================================

  function openDetail(item) {
    if (processing) return;
    setDetail(item);
  }

  function closeDetail() {
    if (!processing) {
      setDetail(null);
    }
  }

  // ====================================================
  // DECISION MODAL
  // ====================================================

  function openDecision(item, type) {
    if (
      processing ||
      flagsLoading ||
      !canReview(item) ||
      !decisionEnabled(type, features)
    ) {
      return;
    }

    setSelected(item);
    setDetail(null);
    setDecision(type);

    setSite(
      SITES.includes(item.site) ? item.site : ""
    );

    setStartDate(dateOnly(item.start_date));
    setEndDate(dateOnly(item.end_date));
    setReason("");

    setError("");
    setMessage("");
  }

  function closeDecision() {
    if (processing) return;

    setSelected(null);
    setReason("");
  }

  // ====================================================
  // SUBMIT APPROVAL / REJECTION
  // ====================================================

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing || flagsLoading) {
      return;
    }

    const source = sourceOf(selected);

    if (!canReview(selected) || !source) {
      setError(
        "Sumber pengajuan tidak dikenali. Keputusan tidak dikirim."
      );
      return;
    }

    const cleanReason = reason.trim();

    if (
      decision === "rejected" &&
      (cleanReason.length < 5 || cleanReason.length > 1000)
    ) {
      setError(
        "Alasan penolakan harus 5–1000 karakter."
      );
      return;
    }

    // Tanggal wajib untuk pengajuan legacy.

    if (source === "legacy" && decision === "approved") {
      if (!SITES.includes(site)) {
        setError("Pilih site OJT yang valid.");
        return;
      }

      if (!startDate || !endDate) {
        setError(
          "Tanggal mulai dan selesai OJT wajib diisi."
        );
        return;
      }

      if (endDate < startDate) {
        setError(
          "Tanggal selesai tidak boleh lebih awal dari tanggal mulai."
        );
        return;
      }
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const latestFlags = await loadFeatureFlags();

      if (!decisionEnabled(decision, latestFlags)) {
        throw new Error(
          "Fitur keputusan Mentor belum aktif."
        );
      }

      const participantName =
        selected.full_name || "Peserta OJT";

      const periodText =
        source === "legacy"
          ? `${formatDate(startDate)} s.d. ${formatDate(endDate)}`
          : `${formatDate(selected.start_date)} s.d. ${formatDate(selected.end_date)}`;

      const confirmed = window.confirm(
        `${decision === "approved" ? "SETUJUI" : "TOLAK"} PENGAJUAN OJT?\n\n` +
          `Peserta: ${participantName}\n` +
          `Email: ${selected.email || "Tidak tersedia"}\n` +
          `Site: ${site || selected.site || "—"}\n` +
          `Periode: ${periodText}\n` +
          (decision === "rejected"
            ? `Alasan: ${cleanReason}\n`
            : "") +
          "\nKeputusan akan disimpan oleh server."
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

      const payload = {
        request_id: selected.id,
        source,
        decision,
        rejection_reason:
          decision === "rejected" ? cleanReason : null,
        dry_run: false,
      };

      if (source === "legacy" && decision === "approved") {
        payload.site = site;
        payload.start_date = startDate;
        payload.end_date = endDate;
      }

      const response = await fetch(
        "/api/mentor/review-registration",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify(payload),
        }
      );

      let result = {};

      try {
        result = await response.json();
      } catch {
        throw new Error(
          "Respons server tidak dapat dibaca."
        );
      }

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            "Keputusan gagal disimpan."
        );
      }

      if (
        result.success !== true ||
        result.dry_run !== false ||
        result.status !== decision ||
        result.source !== source ||
        (decision === "approved" && !result.program_id)
      ) {
        throw new Error(
          "Keputusan belum dapat dipastikan. Periksa status pengajuan sebelum mengulang."
        );
      }

      setSelected(null);
      setReason("");
      setFilter(decision);

      const refreshed = await loadRegistrations(false);

      if (decision === "approved") {
        setMessage(
          `${participantName} berhasil disetujui.` +
            (refreshed
              ? " Program OJT telah dibuat."
              : " Data daftar perlu diperbarui.")
        );
      } else {
        setMessage(
          `Pengajuan ${participantName} berhasil ditolak.`
        );
      }
    } catch (err) {
      setError(err?.message || "Terjadi kesalahan.");
    } finally {
      setProcessing(false);
    }
  }

  // ====================================================
  // REFRESH
  // ====================================================

  async function refreshData() {
    if (loading || refreshing || processing) {
      return;
    }

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
  // FILTER / STATISTICS
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
      const statusMatches =
        filter === "all" || item.status === filter;

      const text = [
        item.full_name,
        item.email,
        item.department,
        item.site,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return statusMatches && text.includes(keyword);
    });
  }, [registrations, filter, search]);

  const filterTabs = [
    ["pending", "Menunggu", counts.pending],
    ["approved", "Disetujui", counts.approved],
    ["rejected", "Ditolak", counts.rejected],
    ["all", "Semua", counts.all],
  ];

  // ====================================================
  // NAVIGATION
  // ====================================================

  function navigate(path) {
    setMobileMenu(false);
    router.push(path);
  }

  // ====================================================
  // ACTION BUTTONS
  // ====================================================

  function DecisionButtons({ item }) {
    if (!canReview(item)) {
      return null;
    }

    return (
      <>
        <button
          type="button"
          className="ap-approve"
          disabled={
            processing ||
            flagsLoading ||
            !features.approval_enabled
          }
          onClick={() => openDecision(item, "approved")}
        >
          <Icon name="check" size={15} />
          Setujui
        </button>

        <button
          type="button"
          className="ap-reject"
          disabled={
            processing ||
            flagsLoading ||
            !features.rejection_enabled
          }
          onClick={() => openDecision(item, "rejected")}
        >
          <Icon name="x" size={15} />
          Tolak
        </button>
      </>
    );
  }

  // ====================================================
  // MAIN UI
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
            <Icon name="shield" size={23} />
          </span>

          <span>
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>

            <label>
              ON THE JOB TRAINING MANAGEMENT SYSTEM
            </label>
          </span>
        </button>

        <nav
          aria-label="Navigasi Mentor"
          className={"ap-nav " + (mobileMenu ? "open" : "")}
        >
          {NAV.map(([label, url, icon]) => (
            <button
              type="button"
              key={url}
              className={
                url === "/mentor/persetujuan-peserta"
                  ? "active"
                  : ""
              }
              onClick={() => navigate(url)}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* IDENTITAS MENTOR */}

        <div className="ap-account">
          <span className="ap-avatar">
            {MENTOR_INITIALS}
          </span>

          <span>
            <strong>{MENTOR_DISPLAY_NAME}</strong>
            <small>Mentor OJT</small>
          </span>
        </div>

        <button
          type="button"
          className="ap-menu"
          aria-label={mobileMenu ? "Tutup menu" : "Buka menu"}
          aria-expanded={mobileMenu}
          onClick={() => setMobileMenu((v) => !v)}
        >
          <Icon name={mobileMenu ? "x" : "menu"} />
        </button>
      </header>

      <main className="ap-container">

        {/* HERO */}

        <section
          className="ap-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(4,22,43,.97),
                rgba(5,34,57,.85) 55%,
                rgba(5,35,54,.50)
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div>
            <span className="ap-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </span>

            <h1>
              Dashboard <em>Persetujuan OJT</em>
            </h1>

            <p>
              Verifikasi pengajuan dan kelola keputusan
              peserta On Job Training melalui Dashboard Mentor.
            </p>

            <div className="ap-hero-tags">
              <span>
                <Icon name="shield" size={15} />
                Akses Mentor
              </span>

              <span>
                <Icon name="calendar" size={15} />
                Program 2026–2027
              </span>

              <span>
                <Icon name="check" size={15} />
                Verifikasi Peserta
              </span>
            </div>
          </div>

          <div className="ap-hero-number">
            <small>TOTAL PENGAJUAN</small>
            <strong>{counts.all}</strong>
            <span>Pengajuan tercatat</span>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="ap-breadcrumb">
          <button type="button" onClick={() => navigate("/")}>
            Dashboard
          </button>
          <span>/</span>
          <strong>Persetujuan Peserta OJT</strong>
        </div>

        {/* SUCCESS MESSAGE */}

        {message && (
          <div className="ap-alert success" role="status">
            <Icon name="check" />
            <span>{message}</span>
            <button
              type="button"
              aria-label="Tutup pesan berhasil"
              onClick={() => setMessage("")}
            >
              <Icon name="x" />
            </button>
          </div>
        )}

        {/* ERROR MESSAGE */}

        {error && (
          <div className="ap-alert error" role="alert">
            <Icon name="info" />
            <span>{error}</span>
            <button
              type="button"
              aria-label="Tutup pesan kesalahan"
              onClick={() => setError("")}
            >
              <Icon name="x" />
            </button>
          </div>
        )}

        {/* STATISTICS */}

        <div className="ap-stats">
          {[
            ["pending", "Menunggu Persetujuan", counts.pending, "clock"],
            ["approved", "Disetujui", counts.approved, "check"],
            ["rejected", "Ditolak", counts.rejected, "x"],
            ["all", "Total Pengajuan", counts.all, "file"],
          ].map(([key, label, value, icon]) => (
            <button
              type="button"
              key={key}
              className={"ap-stat " + (filter === key ? "active" : "")}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              <span className={`ap-stat-icon ${key}`}>
                <Icon name={icon} size={23} />
              </span>

              <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <small>Lihat pengajuan</small>
              </span>

              <Icon name="arrow" size={15} />
            </button>
          ))}
        </div>

        {/* FEATURE FLAGS */}

        <section className="ap-feature">
          <div>
            <Icon name="shield" size={24} />
            <span>
              <strong>Status Fitur Mentor</strong>
              <small>
                Keputusan diproses melalui server.
              </small>
            </span>
          </div>

          <div className="ap-feature-flags">
            <span>
              Persetujuan
              <strong
                className={
                  features.approval_enabled
                    ? "enabled"
                    : "disabled"
                }
              >
                {flagsLoading
                  ? "Memeriksa..."
                  : features.approval_enabled
                  ? "Aktif"
                  : "Nonaktif"}
              </strong>
            </span>

            <span>
              Penolakan
              <strong
                className={
                  features.rejection_enabled
                    ? "enabled"
                    : "disabled"
                }
              >
                {flagsLoading
                  ? "Memeriksa..."
                  : features.rejection_enabled
                  ? "Aktif"
                  : "Nonaktif"}
              </strong>
            </span>
          </div>
        </section>

        {/* REGISTRATIONS CARD */}

        <section className="ap-card">

          {/* HEADING */}

          <div className="ap-section-heading">
            <div className="ap-section-title">
              <span>
                <Icon name="users" size={21} />
              </span>

              <div>
                <h2>Daftar Pengajuan Peserta</h2>
                <p>
                  Pemeriksaan dan keputusan pendaftaran OJT.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="ap-refresh"
              disabled={
                loading ||
                refreshing ||
                processing ||
                flagsLoading
              }
              onClick={refreshData}
            >
              <Icon name="refresh" size={17} />
              {refreshing || loading
                ? "Memperbarui..."
                : "Perbarui Data"}
            </button>
          </div>

          {/* FILTERS */}

          <div className="ap-filterbar">
            <div className="ap-tabs">
              {filterTabs.map(([key, label, count]) => (
                <button
                  type="button"
                  key={key}
                  className={filter === key ? "active" : ""}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <span>{count}</span>
                </button>
              ))}
            </div>

            <label className="ap-search">
              <Icon name="search" size={17} />
              <input
                type="search"
                placeholder="Cari nama, email, departemen, site..."
                aria-label="Cari pengajuan peserta"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>

          {/* RESULT COUNT */}

          <p className="ap-count">
            Menampilkan <strong>{filtered.length}</strong>
            {" dari "}
            <strong>{counts.all}</strong>
            {" pengajuan."}
          </p>

          {/* REGISTRATION DATA */}

          {loading ? (
            <div className="ap-empty">
              Memuat daftar pengajuan...
            </div>
          ) : !filtered.length ? (
            <div className="ap-empty">
              Tidak ada pengajuan sesuai pencarian.
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}

              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Peserta OJT</th>
                      <th>Departemen / Site</th>
                      <th>Periode OJT</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((item, index) => (
                      <tr key={`${item.source}-${item.id}`}>
                        <td>{index + 1}</td>

                        <td>
                          <div className="ap-person">
                            <span className="ap-person-avatar">
                              {initials(item.full_name)}
                            </span>

                            <span>
                              <strong>
                                {item.full_name || "—"}
                              </strong>

                              <small>
                                {sourceOf(item) === "new"
                                  ? "Pengajuan Baru"
                                  : sourceOf(item) === "legacy"
                                  ? "Pendaftaran Terdahulu"
                                  : "Sumber Tidak Diketahui"}
                              </small>

                              <small className="ap-email">
                                <span>Email:</span>{" "}
                                {item.email || "Email belum tersedia"}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {item.department || "—"}
                          </strong>
                          <small className="ap-sub">
                            {item.site || "—"}
                          </small>
                        </td>

                        <td>
                          {formatDate(item.start_date)}
                          <br />
                          s.d. {formatDate(item.end_date)}
                        </td>

                        <td>
                          {formatTime(item.created_at)}
                        </td>

                        <td>
                          <StatusBadge status={item.status} />
                        </td>

                        <td>
                          <div className="ap-actions">
                            <button
                              type="button"
                              className="ap-detail"
                              onClick={() => openDetail(item)}
                            >
                              Detail
                            </button>

                            <DecisionButtons item={item} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE LIST */}

              <div className="ap-mobile-list">
                {filtered.map((item) => (
                  <article
                    className="ap-mobile-card"
                    key={`${item.source}-${item.id}`}
                  >
                    <div className="ap-person">
                      <span className="ap-person-avatar">
                        {initials(item.full_name)}
                      </span>

                      <span>
                        <strong>
                          {item.full_name || "—"}
                        </strong>

                        <small>
                          {item.department || "—"}
                          {" · "}
                          {item.site || "—"}
                        </small>

                        <small className="ap-email">
                          <span>Email:</span>{" "}
                          {item.email || "Email belum tersedia"}
                        </small>
                      </span>
                    </div>

                    <div className="ap-mobile-line">
                      <span>Periode OJT</span>
                      <strong>
                        {formatDate(item.start_date)}
                        {" – "}
                        {formatDate(item.end_date)}
                      </strong>
                    </div>

                    <div className="ap-mobile-line">
                      <span>Pengajuan</span>
                      <strong>
                        {formatTime(item.created_at)}
                      </strong>
                    </div>

                    <StatusBadge status={item.status} />

                    <div className="ap-actions">
                      <button
                        type="button"
                        className="ap-detail"
                        onClick={() => openDetail(item)}
                      >
                        Detail
                      </button>

                      <DecisionButtons item={item} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {/* BOTTOM PANELS */}

        <section className="ap-bottom">

          {/* GLOBAL CALENDAR */}

          <div className="ap-card">
            <div className="ap-section-title">
              <span>
                <Icon name="calendar" size={21} />
              </span>

              <div>
                <h2>Program OJT 2026–2027</h2>
                <p>Kalender Global Week 01–25</p>
              </div>
            </div>

            <div className="ap-program-dates">
              <div>
                <small>Mulai · Week 01</small>
                <strong>12 September 2026</strong>
              </div>

              <div>
                <small>Selesai · Week 25</small>
                <strong>6 Maret 2027</strong>
              </div>
            </div>

            <div className="ap-timeline">
              {Array.from({ length: 25 }, (_, index) => (
                <span key={index}>
                  <i />
                  <small>
                    {String(index + 1).padStart(2, "0")}
                  </small>
                </span>
              ))}
            </div>

            <p className="ap-note">
              Kalender global digunakan untuk monitoring
              25 minggu. Periode masing-masing peserta tetap
              mengikuti tanggal individual.
            </p>
          </div>

          {/* APPROVAL FLOW */}

          <div className="ap-card">
            <div className="ap-section-title">
              <span>
                <Icon name="check" size={21} />
              </span>

              <div>
                <h2>Alur Persetujuan Peserta</h2>
                <p>
                  Tahapan pengelolaan pengajuan OJT.
                </p>
              </div>
            </div>

            <div className="ap-flow">
              {[
                ["Pendaftaran", "Peserta mengajukan pendaftaran."],
                ["Verifikasi", "Mentor memeriksa data peserta."],
                ["Keputusan", "Mentor menyetujui atau menolak."],
                ["Aktivasi", "Server membuat program jika disetujui."],
              ].map(([title, desc], i) => (
                <div key={title}>
                  <span>{i + 1}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BACK BUTTON */}

        <div className="ap-bottom-actions">
          <button
            type="button"
            onClick={() => navigate("/")}
          >
            <Icon name="back" size={17} />
            Kembali ke Dashboard Mentor
          </button>
        </div>

        {/* FOOTER */}

        <footer className="ap-footer">
          <span>
            OJT MineTrack v2.0 · Emergency Response Group
          </span>
          <span>
            PT Berau Coal · Program 2026–2027
          </span>
        </footer>
      </main>

      {/* DETAIL MODAL */}

      {detail && (
        <div
          className="ap-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDetail();
            }
          }}
        >
          <section
            className="ap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <header className="ap-modal-header">
              <div>
                <h2 id="detail-title">
                  Detail Pengajuan Peserta
                </h2>
                <p>Informasi berdasarkan data sistem.</p>
              </div>

              <button
                type="button"
                aria-label="Tutup detail"
                onClick={closeDetail}
              >
                <Icon name="x" />
              </button>
            </header>

            <div className="ap-modal-body">
              <div className="ap-detail-grid">
                <DetailItem
                  label="Nama Lengkap"
                  value={detail.full_name}
                />

                <DetailItem
                  label="Email"
                  value={detail.email || "Email belum tersedia"}
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
                    sourceOf(detail) === "new"
                      ? "Pengajuan Baru"
                      : sourceOf(detail) === "legacy"
                      ? "Pendaftaran Terdahulu"
                      : "Belum Dikenali"
                  }
                />
              </div>

              <div className="ap-detail-status">
                <span>Status Pengajuan</span>
                <StatusBadge status={detail.status} />
              </div>

              {detail.rejection_reason && (
                <div className="ap-rejection-info">
                  <strong>Alasan Penolakan</strong>
                  <p>{detail.rejection_reason}</p>
                </div>
              )}

              {canReview(detail) && (
                <div className="ap-detail-actions">
                  <DecisionButtons item={detail} />
                </div>
              )}

              {detail.status === "pending" &&
                !sourceOf(detail) && (
                  <p className="ap-note">
                    Sumber pengajuan belum dikenali oleh API
                    daftar. Keputusan tidak dapat dikirim
                    dengan aman.
                  </p>
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

      {/* DECISION MODAL */}

      {selected && (
        <div
          className="ap-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDecision();
            }
          }}
        >
          <section
            className="ap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-title"
          >
            <header className="ap-modal-header">
              <div>
                <h2 id="decision-title">
                  {decision === "approved"
                    ? "Persetujuan Peserta OJT"
                    : "Penolakan Peserta OJT"}
                </h2>

                <p>Konfirmasi keputusan Mentor.</p>
              </div>

              <button
                type="button"
                aria-label="Tutup konfirmasi"
                onClick={closeDecision}
                disabled={processing}
              >
                <Icon name="x" />
              </button>
            </header>

            <form
              className="ap-modal-body"
              onSubmit={submitDecision}
            >
              {/* SELECTED PARTICIPANT */}

              <div className="ap-person ap-modal-person">
                <span className="ap-person-avatar">
                  {initials(selected.full_name)}
                </span>

                <span>
                  <strong>
                    {selected.full_name || "Peserta OJT"}
                  </strong>

                  <small>
                    {selected.department || "—"}
                    {" · "}
                    {selected.site || "—"}
                  </small>

                  <small className="ap-email">
                    <span>Email:</span>{" "}
                    {selected.email || "Email belum tersedia"}
                  </small>
                </span>
              </div>

              {/* LEGACY REGISTRATION */}

              {sourceOf(selected) === "legacy" &&
              decision === "approved" ? (
                <div className="ap-period-form">
                  <p className="ap-note">
                    Pendaftaran ini belum menyimpan periode
                    individual OJT. Tentukan tanggal sesuai
                    penugasan peserta.
                  </p>

                  <label>
                    Site OJT
                    <select
                      value={site}
                      disabled={processing}
                      onChange={(e) => setSite(e.target.value)}
                      required
                    >
                      <option value="">Pilih Site</option>
                      {SITES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="ap-date-fields">
                    <label>
                      Tanggal Mulai OJT
                      <input
                        type="date"
                        required
                        value={startDate}
                        disabled={processing}
                        onChange={(e) =>
                          setStartDate(e.target.value)
                        }
                      />
                    </label>

                    <label>
                      Tanggal Selesai OJT
                      <input
                        type="date"
                        required
                        min={startDate || undefined}
                        value={endDate}
                        disabled={processing}
                        onChange={(e) =>
                          setEndDate(e.target.value)
                        }
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="ap-period-display">
                  <span>Periode OJT</span>
                  <strong>
                    {formatDate(selected.start_date)}
                    {" – "}
                    {formatDate(selected.end_date)}
                  </strong>
                </div>
              )}

              {/* REJECTION REASON */}

              {decision === "rejected" && (
                <label className="ap-reason-label">
                  Alasan Penolakan *
                  <textarea
                    rows={5}
                    required
                    minLength={5}
                    maxLength={1000}
                    value={reason}
                    disabled={processing}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Tuliskan alasan penolakan..."
                  />
                  <small>{reason.length}/1000 karakter</small>
                </label>
              )}

              {/* SERVER NOTICE */}

              <div className="ap-notice">
                <Icon name="info" size={18} />
                <span>
                  Keputusan akan diverifikasi dan disimpan
                  melalui API Mentor.
                </span>
              </div>

              {/* MODAL ACTIONS */}

              <div className="ap-modal-buttons">
                <button
                  type="button"
                  className="ap-cancel"
                  disabled={processing}
                  onClick={closeDecision}
                >
                  Batal
                </button>

                <button
                  type="submit"
                  className={
                    decision === "approved"
                      ? "ap-confirm-approve"
                      : "ap-confirm-reject"
                  }
                  disabled={processing || flagsLoading}
                >
                  {processing
                    ? "Memproses..."
                    : decision === "approved"
                    ? "Konfirmasi Persetujuan"
                    : "Konfirmasi Penolakan"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

// ======================================================
// COMPLETE CSS — LIGHT & DARK MODE
// ======================================================

const css = `
.ap-app,.ap-app *{box-sizing:border-box}
.ap-app{
  --ap-bg:#edf3f7;--ap-surface:#fff;--ap-surface-soft:#f6f9fb;
  --ap-surface-muted:#eaf1f6;--ap-text:#173654;--ap-heading:#123e70;
  --ap-muted:#7d91a2;--ap-muted-soft:#8ba2af;--ap-border:#dce7ef;
  --ap-border-soft:#eaf0f3;--ap-primary:#087d76;--ap-primary-text:#087c75;
  --ap-accent-soft:#e7f6f1;--ap-accent-text:#087c67;
  --ap-input-bg:#fff;--ap-table-hover:#fafdfc;--ap-shadow:rgba(13,53,80,.07);
  min-height:100vh;background:var(--ap-bg);color:var(--ap-text);
  font-family:Arial,Helvetica,sans-serif
}
:root[data-theme="dark"] .ap-app{
  --ap-bg:#0d171b;--ap-surface:#17272b;--ap-surface-soft:#1c3034;
  --ap-surface-muted:#203438;--ap-text:#edf8f4;--ap-heading:#f0faf6;
  --ap-muted:#a5bbb8;--ap-muted-soft:#91aaa7;--ap-border:#30484b;
  --ap-border-soft:#2a4144;--ap-primary:#0b876e;--ap-primary-text:#79e6bb;
  --ap-accent-soft:#224239;--ap-accent-text:#a8eed0;
  --ap-input-bg:#1b3034;--ap-table-hover:#213a3b;--ap-shadow:rgba(0,0,0,.20)
}
.ap-app button,.ap-app input,.ap-app textarea,.ap-app select{font:inherit}
.ap-app button{cursor:pointer}
.ap-app button:disabled{opacity:.45;cursor:not-allowed}
.ap-app button:focus-visible,.ap-app input:focus-visible,
.ap-app select:focus-visible,.ap-app textarea:focus-visible{
  outline:3px solid #67d7bb;outline-offset:2px
}

/* TOPBAR */
.ap-topbar{
  position:sticky;top:0;z-index:40;display:flex;align-items:center;
  justify-content:space-between;gap:18px;min-height:76px;padding:11px 25px;
  background:#081e35;color:white;box-shadow:0 5px 20px #0a294024
}
:root[data-theme="dark"] .ap-topbar{
  background:#071d20;border-bottom:1px solid #30504a
}
.ap-brand{
  display:flex;align-items:center;gap:10px;flex-shrink:0;
  background:none;border:0;color:white;text-align:left
}
.ap-brand-symbol{
  display:grid;place-items:center;width:40px;height:40px;
  border:1px solid #49cbb88a;border-radius:11px;
  background:#0c78736e;color:#71e8c7
}
.ap-brand strong{display:block;font-size:21px;white-space:nowrap}
.ap-brand strong em{font-style:normal;color:#5de1c1}
.ap-brand strong small{
  margin-left:6px;padding:4px 6px;border-radius:5px;
  background:#5be2c2;color:#073647;font-size:10px
}
.ap-brand label{
  display:block;margin-top:5px;color:#c4d8e4;
  font-size:8px;letter-spacing:1px;pointer-events:none
}
.ap-nav{display:flex;align-items:center;gap:5px}
.ap-nav button{
  display:flex;align-items:center;gap:8px;padding:11px;
  border:0;border-radius:8px;background:transparent;color:#c7dae5;
  font-size:11px;font-weight:800;white-space:nowrap
}
.ap-nav button:hover{background:#ffffff18}
.ap-nav button.active{background:#0c807b;color:white}
.ap-account{display:flex;align-items:center;gap:9px}
.ap-account strong,.ap-account small{display:block;font-size:11px}
.ap-account strong{overflow-wrap:anywhere}
.ap-account small{margin-top:4px;color:#b3cbd6;font-size:10px}
.ap-avatar{
  display:grid;place-items:center;flex-shrink:0;width:37px;height:37px;
  border-radius:50%;background:#d8f6eb;color:#08795d;
  font-size:12px;font-weight:900
}
.ap-menu{display:none;border:0;background:none;color:white}

/* MAIN CONTAINER */
.ap-container{max-width:1500px;margin:auto;padding:23px}

/* HERO */
.ap-hero{
  display:flex;align-items:center;justify-content:space-between;gap:25px;
  min-height:230px;padding:30px 34px;border-radius:16px;
  background-color:#0c2d47;background-size:cover;background-position:center;
  color:white;box-shadow:0 9px 27px #12385220
}
.ap-kicker{color:#e6c17a;font-size:10px;font-weight:900;letter-spacing:1.4px}
.ap-hero h1{margin:12px 0;color:white;font-size:clamp(29px,3.3vw,44px)}
.ap-hero h1 em{font-style:normal;color:#5be3c2}
.ap-hero p{max-width:650px;color:#e0ebef;font-size:12px;line-height:1.8}
.ap-hero-tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px}
.ap-hero-tags span{
  display:flex;align-items:center;gap:7px;padding:7px 10px;
  border:1px solid #ffffff4c;border-radius:20px;
  background:#092b42a8;color:#e4f4f0;font-size:10px
}
.ap-hero-number{
  display:grid;justify-items:center;gap:9px;flex-shrink:0;min-width:175px;
  padding:23px;border:1px solid #ffffff5b;border-radius:13px;
  background:#062641c7;text-align:center
}
.ap-hero-number small{color:#aacbd9;font-size:10px}
.ap-hero-number strong{font-size:38px}
.ap-hero-number>span{font-size:10px}

/* BREADCRUMB */
.ap-breadcrumb{
  display:flex;align-items:center;gap:10px;margin:17px 3px;
  color:var(--ap-muted-soft);font-size:11px
}
.ap-breadcrumb button{border:0;background:none;color:var(--ap-muted)}
.ap-breadcrumb strong{color:var(--ap-primary-text)}

/* ALERTS */
.ap-alert{
  display:flex;align-items:center;gap:10px;margin-bottom:15px;
  padding:13px 15px;border-radius:10px;font-size:12px;font-weight:700
}
.ap-alert span{flex:1}
.ap-alert button{border:0;background:none;color:inherit}
.ap-alert.success{border:1px solid #bee6ce;background:#edf9f1;color:#08794f}
.ap-alert.error{border:1px solid #f3c8c8;background:#fff1f1;color:#b12b2b}
:root[data-theme="dark"] .ap-alert.success{
  border-color:#376752;background:#1d4535;color:#b4f5ce
}
:root[data-theme="dark"] .ap-alert.error{
  border-color:#704349;background:#45262a;color:#ffbfc8
}

/* STAT CARDS */
.ap-stats{
  display:grid;grid-template-columns:repeat(4,minmax(0,1fr));
  gap:13px;margin-bottom:16px
}
.ap-stat{
  display:flex;align-items:center;gap:12px;min-height:125px;padding:17px;
  border:1px solid var(--ap-border);border-radius:12px;
  background:var(--ap-surface);color:var(--ap-text);text-align:left;
  box-shadow:0 6px 20px var(--ap-shadow)
}
.ap-stat:hover{background:var(--ap-table-hover)}
.ap-stat.active{outline:2px solid #58cfae;outline-offset:-2px}
.ap-stat>span:nth-child(2){
  display:grid;gap:5px;flex:1;min-width:0
}
.ap-stat small{color:var(--ap-muted);font-size:10px;font-weight:800}
.ap-stat strong{color:var(--ap-heading);font-size:30px}
.ap-stat>svg{color:var(--ap-muted);flex-shrink:0}
.ap-stat-icon{
  display:grid;place-items:center;flex-shrink:0;width:45px;height:45px;
  border-radius:11px
}
.ap-stat-icon.pending{background:#fff1d8;color:#c18a20}
.ap-stat-icon.approved{background:#def8ed;color:#078c67}
.ap-stat-icon.rejected{background:#fff0f2;color:#c94c62}
.ap-stat-icon.all{background:#e0effe;color:#1979bf}
:root[data-theme="dark"] .ap-stat-icon.pending{background:#49391f;color:#f5d191}
:root[data-theme="dark"] .ap-stat-icon.approved{background:#214c3b;color:#8af0bd}
:root[data-theme="dark"] .ap-stat-icon.rejected{background:#4b2934;color:#ffacc1}
:root[data-theme="dark"] .ap-stat-icon.all{background:#233d55;color:#a4d2ff}

/* FEATURE FLAGS */
.ap-feature{
  display:flex;align-items:center;justify-content:space-between;gap:16px;
  margin-bottom:17px;padding:15px 18px;
  border:1px solid #c7e4ed;border-radius:12px;background:#eaf6fa
}
:root[data-theme="dark"] .ap-feature{background:#1a343b;border-color:#34585a}
.ap-feature>div:first-child{display:flex;align-items:center;gap:12px}
.ap-feature>div:first-child>svg{color:#2577a1}
:root[data-theme="dark"] .ap-feature>div:first-child>svg{color:#8fd7f4}
.ap-feature strong,.ap-feature small{display:block}
.ap-feature strong{font-size:12px;color:var(--ap-heading)}
.ap-feature small{margin-top:5px;color:var(--ap-muted);font-size:11px}
.ap-feature-flags{display:flex;gap:10px}
.ap-feature-flags>span{
  display:grid;gap:6px;min-width:115px;padding:10px;
  border:1px solid var(--ap-border);border-radius:9px;
  background:var(--ap-surface);color:var(--ap-muted);
  text-align:center;font-size:10px
}
.ap-feature-flags strong.enabled{color:#087c55}
.ap-feature-flags strong.disabled{color:#b5791f}
:root[data-theme="dark"] .ap-feature-flags strong.enabled{color:#8ceebd}
:root[data-theme="dark"] .ap-feature-flags strong.disabled{color:#f1cb84}

/* CARD */
.ap-card{
  min-width:0;padding:21px;border:1px solid var(--ap-border);
  border-radius:13px;background:var(--ap-surface);color:var(--ap-text);
  box-shadow:0 6px 20px var(--ap-shadow)
}
.ap-section-heading{
  display:flex;align-items:center;justify-content:space-between;
  gap:15px;margin-bottom:19px
}
.ap-section-title{display:flex;align-items:center;gap:12px}
.ap-section-title>span{
  display:grid;place-items:center;width:41px;height:41px;flex-shrink:0;
  border-radius:9px;background:linear-gradient(135deg,#10487e,#188bcb);
  color:white
}
.ap-section-title h2{margin:0;color:var(--ap-heading);font-size:17px}
.ap-section-title p{margin:5px 0 0;color:var(--ap-muted);font-size:11px}
.ap-refresh{
  display:flex;align-items:center;gap:8px;padding:11px 14px;
  border:1px solid var(--ap-border);border-radius:8px;
  background:var(--ap-surface-soft);color:var(--ap-primary-text);
  font-size:11px;font-weight:900
}
.ap-refresh:hover:not(:disabled){background:var(--ap-accent-soft)}

/* FILTERS */
.ap-filterbar{
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:12px;padding:12px;
  border:1px solid var(--ap-border);border-radius:10px;
  background:var(--ap-surface-soft)
}
.ap-tabs{display:flex;flex-wrap:wrap;gap:6px}
.ap-tabs button{
  display:flex;align-items:center;gap:7px;padding:10px 12px;
  border:0;border-radius:8px;background:transparent;
  color:var(--ap-muted);font-size:11px;font-weight:900
}
.ap-tabs button:hover:not(.active){background:var(--ap-surface-muted)}
.ap-tabs button.active{background:var(--ap-primary);color:white}
.ap-tabs button span{
  padding:5px 7px;border-radius:6px;
  background:var(--ap-surface-muted);color:var(--ap-text)
}
.ap-tabs button.active span{background:#ffffff30;color:white}
.ap-search{
  display:flex;align-items:center;gap:9px;min-width:230px;padding:0 12px;
  border:1px solid var(--ap-border);border-radius:8px;
  background:var(--ap-input-bg);color:var(--ap-muted)
}
.ap-search input{
  width:100%;min-height:40px;border:0;outline:0;
  background:transparent;color:var(--ap-text);font-size:11px
}
.ap-search input::placeholder{color:var(--ap-muted);opacity:1}
.ap-count{padding:5px 2px;color:var(--ap-muted);font-size:10px}
.ap-count strong{color:var(--ap-primary-text)}

/* TABLE */
.ap-table-wrap{width:100%;overflow-x:auto}
.ap-table{
  width:100%;min-width:1100px;border-collapse:collapse;
  text-align:left;font-size:11px;color:var(--ap-text)
}
.ap-table th{
  padding:13px 11px;background:var(--ap-surface-muted);
  color:var(--ap-muted);font-size:10px;white-space:nowrap
}
.ap-table td{
  padding:14px 11px;border-bottom:1px solid var(--ap-border-soft);
  color:var(--ap-text);vertical-align:middle
}
.ap-table td strong{font-size:11px;color:var(--ap-heading)}
.ap-table tbody tr:hover{background:var(--ap-table-hover)}
.ap-table .ap-sub{
  display:block;margin-top:6px;color:var(--ap-muted);font-size:10px
}

/* PARTICIPANT */
.ap-person{display:flex;align-items:center;gap:10px;min-width:150px}
.ap-person>span:last-child{min-width:0}
.ap-person strong,.ap-person small{display:block}
.ap-person strong{font-size:11px;color:var(--ap-heading)}
.ap-person small{
  margin-top:5px;color:var(--ap-muted);font-size:10px;
  overflow-wrap:anywhere
}
.ap-person-avatar{
  display:grid;place-items:center;flex-shrink:0;width:40px;height:40px;
  border-radius:10px;background:#ddf3e8;color:#087954;
  font-size:12px;font-weight:900
}
:root[data-theme="dark"] .ap-person-avatar{background:#274f40;color:#a9f2cf}
.ap-email{overflow-wrap:anywhere;word-break:break-word}
.ap-email span{font-weight:800;color:var(--ap-primary-text)}

/* STATUS BADGES */
.ap-status{
  display:inline-flex;align-items:center;gap:6px;padding:7px 10px;
  border-radius:20px;font-size:10px;font-weight:900;white-space:nowrap
}
.ap-status.pending{background:#fff3d9;color:#ad7a23}
.ap-status.approved{background:#dff6e9;color:#078257}
.ap-status.rejected{background:#fff0f2;color:#c14d61}
:root[data-theme="dark"] .ap-status.pending{background:#493a20;color:#f3d292}
:root[data-theme="dark"] .ap-status.approved{background:#224a39;color:#a2efbf}
:root[data-theme="dark"] .ap-status.rejected{background:#4a2934;color:#ffb4c0}

/* ACTION BUTTONS */
.ap-actions{display:flex;flex-wrap:wrap;gap:6px}
.ap-actions button,.ap-detail-actions button{
  display:flex;align-items:center;justify-content:center;gap:6px;
  padding:9px 11px;border:0;border-radius:7px;
  font-size:10px;font-weight:900
}
.ap-detail{background:#e7f1fd;color:#286ba7}
:root[data-theme="dark"] .ap-detail{background:#25435b;color:#b2d8ff}
.ap-approve{background:#078c5f;color:white}
.ap-reject{background:#ce4356;color:white}
.ap-approve:hover:not(:disabled){background:#069c69}
.ap-reject:hover:not(:disabled){background:#bb3649}
.ap-empty{padding:45px 15px;color:var(--ap-muted);text-align:center;font-size:12px}
.ap-mobile-list{display:none}

/* BOTTOM PANELS */
.ap-bottom{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:16px}
.ap-program-dates{display:flex;justify-content:space-between;gap:12px;margin-top:22px}
.ap-program-dates>div{display:grid;gap:6px}
.ap-program-dates>div:last-child{text-align:right}
.ap-program-dates small{color:var(--ap-primary-text);font-size:10px;font-weight:900}
.ap-program-dates strong{color:var(--ap-heading);font-size:11px}
.ap-timeline{display:flex;margin-top:24px;position:relative}
.ap-timeline::before{
  content:"";position:absolute;top:5px;left:1%;right:1%;
  height:3px;background:#2cbfc1
}
.ap-timeline span{position:relative;flex:1;text-align:center}
.ap-timeline i{
  display:block;width:9px;height:9px;margin:1px auto 8px;
  border:2px solid #1bb0bb;border-radius:50%;background:#d7fcfc
}
.ap-timeline small{color:var(--ap-muted);font-size:7px}
.ap-note{
  margin-top:16px;padding:12px;border-radius:8px;
  background:#eff8fb;color:#5d8299;font-size:11px;line-height:1.7
}
:root[data-theme="dark"] .ap-note{background:#203a41;color:#bdd5d9}

/* APPROVAL FLOW */
.ap-flow{display:grid;gap:15px;margin-top:19px}
.ap-flow>div{display:flex;align-items:flex-start;gap:12px}
.ap-flow>div>span{
  display:grid;place-items:center;flex-shrink:0;width:29px;height:29px;
  border-radius:50%;background:#1188bc;color:white;
  font-size:11px;font-weight:900
}
.ap-flow>div:nth-child(2)>span,.ap-flow>div:nth-child(4)>span{background:#0da78e}
.ap-flow>div:nth-child(3)>span{background:#d09c31}
.ap-flow strong{color:var(--ap-heading);font-size:11px}
.ap-flow p{margin:5px 0 0;color:var(--ap-muted);font-size:10px;line-height:1.5}

/* BOTTOM ACTIONS */
.ap-bottom-actions{margin-top:17px}
.ap-bottom-actions button{
  display:flex;align-items:center;gap:9px;padding:12px 16px;
  border:1px solid var(--ap-border);border-radius:9px;
  background:var(--ap-accent-soft);color:var(--ap-accent-text);
  font-size:11px;font-weight:900
}
.ap-footer{
  display:flex;justify-content:space-between;gap:12px;
  margin-top:23px;padding:15px 2px;
  border-top:1px solid var(--ap-border);
  color:var(--ap-muted);font-size:10px
}

/* MODAL */
.ap-overlay{
  position:fixed;inset:0;z-index:100;display:grid;place-items:center;
  padding:16px;background:#061e2acd
}
.ap-modal{
  width:min(100%,570px);max-height:92vh;overflow-y:auto;
  border:1px solid var(--ap-border);border-radius:16px;
  background:var(--ap-surface);color:var(--ap-text);
  box-shadow:0 25px 65px #00192355
}
.ap-modal-header{
  display:flex;align-items:center;justify-content:space-between;
  gap:12px;padding:20px;border-bottom:1px solid var(--ap-border)
}
.ap-modal-header h2{margin:0;color:var(--ap-heading);font-size:17px}
.ap-modal-header p{margin:6px 0 0;color:var(--ap-muted);font-size:11px}
.ap-modal-header>button{
  display:grid;place-items:center;width:32px;height:32px;
  border:0;border-radius:8px;background:var(--ap-surface-muted);
  color:var(--ap-muted)
}
.ap-modal-body{padding:20px}

/* DETAIL MODAL */
.ap-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ap-detail-item{
  min-width:0;padding:12px;border:1px solid var(--ap-border);
  border-radius:8px;background:var(--ap-surface-soft)
}
.ap-detail-item span{display:block;color:var(--ap-muted);font-size:10px}
.ap-detail-item strong{
  display:block;margin-top:6px;color:var(--ap-heading);
  font-size:11px;overflow-wrap:anywhere
}
.ap-detail-status{
  display:flex;align-items:center;justify-content:space-between;
  gap:10px;margin-top:15px;padding:13px;border-radius:8px;
  background:var(--ap-surface-muted);color:var(--ap-text);font-size:11px
}
.ap-detail-actions{display:flex;gap:10px;margin-top:18px}
.ap-detail-actions button{flex:1;min-height:43px;font-size:11px}
.ap-detail-close{
  width:100%;min-height:43px;margin-top:14px;border:0;
  border-radius:8px;background:var(--ap-accent-soft);
  color:var(--ap-accent-text);font-size:11px;font-weight:900
}

/* REJECTION INFO */
.ap-rejection-info{
  margin-top:14px;padding:13px;border-radius:8px;
  background:#fff3f3;color:#af4d5b;font-size:11px
}
.ap-rejection-info p{overflow-wrap:anywhere}
:root[data-theme="dark"] .ap-rejection-info{background:#462b30;color:#ffb2c0}

/* DECISION MODAL */
.ap-modal-person{margin-bottom:18px}
.ap-period-display{
  display:flex;justify-content:space-between;gap:10px;padding:13px;
  border-radius:8px;background:var(--ap-surface-soft);
  color:var(--ap-text);font-size:11px
}
.ap-period-display strong{color:var(--ap-heading)}

/* PERIOD FORM */
.ap-period-form{display:grid;gap:12px}
.ap-period-form label,.ap-reason-label{
  display:grid;gap:8px;color:var(--ap-heading);
  font-size:11px;font-weight:800
}
.ap-period-form select,.ap-period-form input,.ap-reason-label textarea{
  width:100%;min-height:42px;padding:10px;
  border:1px solid var(--ap-border);border-radius:8px;
  background:var(--ap-input-bg);color:var(--ap-text);
  font-size:12px;color-scheme:light
}
:root[data-theme="dark"] .ap-period-form select,
:root[data-theme="dark"] .ap-period-form input,
:root[data-theme="dark"] .ap-reason-label textarea{color-scheme:dark}
.ap-period-form select option{background:var(--ap-input-bg);color:var(--ap-text)}
.ap-date-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* REJECTION FORM */
.ap-reason-label{margin-top:15px}
.ap-reason-label textarea{resize:vertical}
.ap-reason-label textarea::placeholder{color:var(--ap-muted);opacity:1}
.ap-reason-label small{text-align:right;color:var(--ap-muted)}

/* NOTICE */
.ap-notice{
  display:flex;align-items:flex-start;gap:10px;margin-top:16px;
  padding:13px;border-radius:9px;background:#edf9f1;
  color:#15784f;font-size:11px;line-height:1.7
}
:root[data-theme="dark"] .ap-notice{background:#204638;color:#adefc8}

/* MODAL BUTTONS */
.ap-modal-buttons{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}
.ap-modal-buttons button{
  min-height:43px;padding:11px 15px;border:0;border-radius:8px;
  font-size:11px;font-weight:900
}
.ap-cancel{background:var(--ap-surface-muted);color:var(--ap-text)}
.ap-confirm-approve{background:#078b61;color:white}
.ap-confirm-reject{background:#ce4356;color:white}

/* TABLET */
@media(max-width:1250px){
  .ap-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ap-nav button{padding:10px 7px;font-size:10px}
}
@media(max-width:1000px){
  .ap-nav{
    display:none;position:absolute;top:100%;left:0;right:0;
    padding:12px;background:#0b2943
  }
  :root[data-theme="dark"] .ap-nav{background:#0b282a}
  .ap-nav.open{display:grid}
  .ap-nav button{padding:12px}
  .ap-account{margin-left:auto}
  .ap-menu{display:grid;place-items:center}
  .ap-feature{flex-wrap:wrap}
  .ap-bottom{grid-template-columns:1fr}
}

/* MOBILE */
@media(max-width:700px){
  .ap-topbar{min-height:65px;padding:10px 12px}
  .ap-brand strong{font-size:16px}
  .ap-brand label{font-size:6.5px}
  .ap-brand-symbol{width:35px;height:35px}
  .ap-account>span:last-child{display:none}
  .ap-container{padding:11px}
  .ap-hero{flex-direction:column;align-items:stretch;padding:23px 18px}
  .ap-hero h1{font-size:29px}
  .ap-hero-number{width:100%}
  .ap-stats{gap:9px}
  .ap-stat{min-height:110px;padding:12px;gap:9px}
  .ap-stat-icon{width:34px;height:34px}
  .ap-stat strong{font-size:25px}
  .ap-stat>svg{display:none}
  .ap-feature-flags{width:100%}
  .ap-feature-flags>span{flex:1;min-width:0}
  .ap-card{padding:15px}
  .ap-section-heading{flex-direction:column;align-items:stretch}
  .ap-refresh{justify-content:center}
  .ap-filterbar{flex-direction:column;align-items:stretch}
  .ap-tabs{display:grid;grid-template-columns:1fr 1fr}
  .ap-tabs button{justify-content:space-between}
  .ap-search{min-width:0}
  .ap-table-wrap{display:none}
  .ap-mobile-list{display:grid;gap:10px}
  .ap-mobile-card{
    padding:14px;border:1px solid var(--ap-border);
    border-radius:10px;background:var(--ap-surface);color:var(--ap-text)
  }
  .ap-mobile-line{
    display:flex;justify-content:space-between;gap:10px;
    margin-top:11px;padding-top:10px;
    border-top:1px solid var(--ap-border-soft);font-size:10px
  }
  .ap-mobile-line span{color:var(--ap-muted)}
  .ap-mobile-line strong{text-align:right;color:var(--ap-heading)}
  .ap-mobile-card>.ap-status{margin-top:13px}
  .ap-mobile-card>.ap-actions{margin-top:14px}
  .ap-mobile-card>.ap-actions button{flex:1}
  .ap-modal-header,.ap-modal-body{padding:15px}
  .ap-modal-header h2{font-size:15px}
  .ap-detail-grid,.ap-date-fields{grid-template-columns:1fr}
  .ap-detail-actions,.ap-modal-buttons{flex-direction:column}
  .ap-modal-buttons button{width:100%}
  .ap-footer{flex-direction:column;text-align:center}
  .ap-timeline small{font-size:5.5px}
}

/* PRINT */
@page{size:A4 landscape;margin:9mm}
@media print{
  html,body{background:white!important}
  .ap-app,:root[data-theme="dark"] .ap-app{
    --ap-bg:#fff;--ap-surface:#fff;--ap-surface-soft:#f6f9fb;
    --ap-surface-muted:#eaf1f6;--ap-text:#173654;--ap-heading:#123e70;
    --ap-muted:#718596;--ap-muted-soft:#8198a5;--ap-border:#dce7ef;
    --ap-border-soft:#eaf0f3;--ap-primary-text:#087c75;
    --ap-accent-soft:#e7f6f1;--ap-accent-text:#087c67;
    --ap-shadow:transparent;background:#fff!important;color:#173654!important
  }
  .ap-topbar,.ap-refresh,.ap-tabs,.ap-search,.ap-bottom-actions,.ap-overlay{
    display:none!important
  }
  .ap-container{padding:0;max-width:none}
  .ap-hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ap-card,.ap-stat{
    box-shadow:none!important;background:#fff!important;color:#173654!important;
    border:1px solid #dce7ef!important;break-inside:avoid-page
  }
  .ap-table{color:#173654!important}
  .ap-table th{background:#eaf1f6!important;color:#426178!important}
  .ap-table td,.ap-table td strong,.ap-section-title h2,
  .ap-stat strong,.ap-flow strong,.ap-program-dates strong{
    color:#173654!important
  }
  .ap-status,.ap-stat-icon,.ap-timeline{
    -webkit-print-color-adjust:exact;print-color-adjust:exact
  }
}
`;
