
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const FLAGS_URL = "/api/system/feature-flags";

const NAV = [
  { label: "Dashboard", url: "/", icon: "home" },
  { label: "Peserta OJT", url: "/mentor/monitoring-peserta", icon: "users" },
  { label: "Pendaftaran Peserta", url: "/mentor/daftar-peserta", icon: "file" },
  { label: "Persetujuan", url: "/mentor/persetujuan-peserta", icon: "check" },
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
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
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

function StatusBadge({ status }) {
  return (
    <span className={`ap-status ${status || "unknown"}`}>
      {status === "approved" && <Icon name="check" size={13} />}
      {status === "rejected" && <Icon name="x" size={13} />}
      {status === "pending" && <Icon name="clock" size={13} />}
      {statusLabel(status)}
    </span>
  );
}

function SummaryCard({ icon, title, value, tone, selected, onClick }) {
  return (
    <button
      type="button"
      className={`ap-summary-card ${tone} ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      <span className="ap-summary-icon">
        <Icon name={icon} size={24} />
      </span>
      <span className="ap-summary-info">
        <small>{title}</small>
        <strong>{value}</strong>
        <span>Lihat pengajuan</span>
      </span>
      <Icon name="arrow" size={16} />
    </button>
  );
}

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
  const [decision, setDecision] = useState("approved");
  const [reason, setReason] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ===================================================
  // FEATURE FLAGS — GAGAL = FITUR NONAKTIF
  // ===================================================

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
        throw new Error("Gagal membaca konfigurasi fitur.");
      }

      const result = await response.json();

      if (result?.success !== true) {
        throw new Error("Konfigurasi fitur tidak valid.");
      }

      const nextFlags = {
        approval_enabled: result.features?.approval_enabled === true,
        rejection_enabled: result.features?.rejection_enabled === true,
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

  // ===================================================
  // DATA PENDAFTARAN
  // ===================================================

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

        const response = await fetch("/api/mentor/registrations", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const result = await response.json();

        if (response.status === 401) {
          router.replace("/login");
          return false;
        }

        if (response.status === 403) {
          throw new Error("Akses hanya diperbolehkan untuk mentor.");
        }

        if (!response.ok) {
          throw new Error(
            result.error || "Gagal mengambil daftar pengajuan."
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
          err?.message || "Gagal membaca daftar pengajuan."
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  // ===================================================
  // IDENTITAS MENTOR
  // ===================================================

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

        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (data?.role !== "mentor") {
          throw new Error("Halaman ini hanya untuk Mentor OJT.");
        }

        if (active) setAccount(data);
      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal membaca profil mentor.");
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

  // ===================================================
  // KEPUTUSAN MENTOR — ENDPOINT TETAP
  // ===================================================

  async function submitDecision(event) {
    event.preventDefault();

    if (!selected || processing || flagsLoading) return;

    if (
      selected.source !== "new" ||
      selected.status !== "pending"
    ) {
      setError("Pengajuan ini tidak dapat diproses.");
      return;
    }

    const cleanReason = reason.trim();

    if (
      decision === "rejected" &&
      (cleanReason.length < 5 || cleanReason.length > 1000)
    ) {
      setError("Alasan penolakan harus 5–1000 karakter.");
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const latestFlags = await loadFeatureFlags();

      if (!decisionEnabled(decision, latestFlags)) {
        throw new Error("Fitur keputusan mentor belum diaktifkan.");
      }

      const participantName =
        selected.full_name || "Peserta OJT";

      const action =
        decision === "approved" ? "MENYETUJUI" : "MENOLAK";

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
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
          body: JSON.stringify({
            request_id: selected.id,
            decision,
            rejection_reason:
              decision === "rejected" ? cleanReason : null,
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
          result.error || "Keputusan gagal diproses."
        );
      }

      if (
        result.success !== true ||
        result.dry_run !== false ||
        result.status !== decision ||
        (decision === "approved" && !result.program_id)
      ) {
        throw new Error(
          "Hasil keputusan belum dapat dipastikan. " +
            "Periksa daftar pengajuan sebelum mencoba lagi."
        );
      }

      setSelected(null);
      setReason("");
      setFilter(decision);

      const refreshed = await loadRegistrations(false);

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
      setError(err?.message || "Terjadi kesalahan.");
    } finally {
      setProcessing(false);
    }
  }

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

  const counts = useMemo(
    () => ({
      pending: registrations.filter((r) => r.status === "pending").length,
      approved: registrations.filter((r) => r.status === "approved").length,
      rejected: registrations.filter((r) => r.status === "rejected").length,
      all: registrations.length,
    }),
    [registrations]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return registrations.filter((item) => {
      const matchesStatus =
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

      return matchesStatus && searchable.includes(keyword);
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

  return (
    <div className="ap-app">
      <style>{css}</style>

      {/* NAVIGASI UTAMA */}

      <header className="ap-topbar">
        <button
          type="button"
          className="ap-brand"
          onClick={() => navigate("/")}
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <nav
          className={`ap-nav ${mobileMenu ? "open" : ""}`}
          aria-label="Menu utama"
        >
          {NAV.map((item) => (
            <button
              type="button"
              key={item.url}
              className={
                item.url === "/mentor/persetujuan-peserta"
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

        <div className="ap-account">
          <div className="ap-account-avatar">
            {initials(account?.full_name || "Mentor OJT")}
          </div>

          <div className="ap-account-info">
            <strong>{account?.full_name || "Mentor OJT"}</strong>
            <small>Mentor OJT</small>
          </div>
        </div>

        <button
          type="button"
          className="ap-mobile-toggle"
          aria-label={mobileMenu ? "Tutup menu" : "Buka menu"}
          onClick={() => setMobileMenu((v) => !v)}
        >
          <Icon name={mobileMenu ? "x" : "menu"} size={24} />
        </button>
      </header>

      <main className="ap-container">

        {/* HERO */}

        <section className="ap-hero">
          <div>
            <div className="ap-kicker">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Persetujuan <span>Peserta OJT</span>
            </h1>

            <p>
              Tinjau pengajuan, verifikasi kelengkapan data,
              dan kelola keputusan peserta On Job Training
              secara terstruktur.
            </p>

            <div className="ap-hero-tags">
              <span>
                <Icon name="shield" size={16} />
                Akses Mentor
              </span>
              <span>
                <Icon name="calendar" size={16} />
                Program OJT 2026–2027
              </span>
            </div>
          </div>

          <div className="ap-hero-summary">
            <small>TOTAL PENGAJUAN</small>
            <strong>{counts.all}</strong>
            <span>Pengajuan tercatat</span>
          </div>
        </section>

        {/* BREADCRUMB */}

        <div className="ap-breadcrumb">
          <button onClick={() => navigate("/")}>Dashboard</button>
          <span>/</span>
          <strong>Persetujuan Peserta</strong>
        </div>

        {/* ALERT */}

        {message && (
          <div className="ap-alert success" role="status">
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
          <div className="ap-alert error" role="alert">
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

        {/* STATUS FITUR */}

        <section className="ap-feature-bar">
          <div className="ap-feature-heading">
            <div className="ap-feature-icon">
              <Icon name="shield" size={22} />
            </div>
            <div>
              <strong>Status Fitur Mentor</strong>
              <small>
                Keputusan hanya dapat diproses jika fitur diaktifkan server.
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

        {/* RINGKASAN */}

        <section className="ap-summary-grid">
          <SummaryCard
            icon="clock"
            title="Menunggu Persetujuan"
            value={counts.pending}
            tone="amber"
            selected={filter === "pending"}
            onClick={() => setFilter("pending")}
          />

          <SummaryCard
            icon="check"
            title="Disetujui"
            value={counts.approved}
            tone="green"
            selected={filter === "approved"}
            onClick={() => setFilter("approved")}
          />

          <SummaryCard
            icon="x"
            title="Ditolak"
            value={counts.rejected}
            tone="rose"
            selected={filter === "rejected"}
            onClick={() => setFilter("rejected")}
          />

          <SummaryCard
            icon="file"
            title="Total Pengajuan"
            value={counts.all}
            tone="blue"
            selected={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </section>

        {/* DAFTAR */}

        <section className="ap-card">
          <div className="ap-section-heading">
            <div className="ap-section-title">
              <div className="ap-section-icon">
                <Icon name="users" size={21} />
              </div>
              <div>
                <h2>Daftar Pengajuan Peserta</h2>
                <p>
                  Pemeriksaan dan pengambilan keputusan pendaftaran OJT.
                </p>
              </div>
            </div>

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

          {/* FILTER */}

          <div className="ap-filterbar">
            <div className="ap-tabs">
              {filterTabs.map(([value, label, total]) => (
                <button
                  type="button"
                  key={value}
                  className={filter === value ? "active" : ""}
                  onClick={() => {
                    setFilter(value);
                    setSelected(null);
                  }}
                >
                  {label}
                  <span>{total}</span>
                </button>
              ))}
            </div>

            <label className="ap-search">
              <Icon name="search" size={17} />
              <input
                type="search"
                placeholder="Cari nama, site, departemen..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="ap-result-count">
            Menampilkan <strong>{filtered.length}</strong> dari{" "}
            <strong>{counts.all}</strong> pengajuan.
          </div>

          {loading ? (
            <div className="ap-empty">
              <Icon name="refresh" size={29} />
              <strong>Memuat Pengajuan</strong>
              <p>Memeriksa data pendaftaran peserta...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="ap-empty">
              <Icon name="file" size={29} />
              <strong>Belum Ada Pengajuan</strong>
              <p>
                Tidak ada pengajuan yang sesuai dengan
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
                      <th>Peserta</th>
                      <th>Departemen / Site</th>
                      <th>Periode OJT</th>
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
                        <tr key={`${item.source}-${item.id}`}>
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
                              </div>
                            </div>
                          </td>

                          <td>
                            <strong className="ap-cell-main">
                              {item.department || "—"}
                            </strong>
                            <small className="ap-cell-sub">
                              {item.site || "Site belum tersedia"}
                            </small>
                          </td>

                          <td>
                            <span className="ap-date-cell">
                              {formatDate(item.start_date)}
                              <br />
                              s.d. {formatDate(item.end_date)}
                            </span>
                          </td>

                          <td>{formatTime(item.created_at)}</td>

                          <td>
                            <StatusBadge status={item.status} />
                            {item.status === "rejected" &&
                              item.rejection_reason && (
                                <small className="ap-reason-inline">
                                  {item.rejection_reason}
                                </small>
                              )}
                          </td>

                          <td>
                            {canReview ? (
                              <div className="ap-row-actions">
                                <button
                                  type="button"
                                  className="approve"
                                  disabled={
                                    processing ||
                                    flagsLoading ||
                                    !features.approval_enabled
                                  }
                                  onClick={() =>
                                    openDecision(item, "approved")
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
                                    openDecision(item, "rejected")
                                  }
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="ap-no-action">
                                Selesai
                              </span>
                            )}
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
                            {item.full_name || "Nama belum tersedia"}
                          </strong>
                          <small>
                            {item.department || "—"} ·{" "}
                            {item.site || "—"}
                          </small>
                        </div>
                      </div>

                      <div className="ap-mobile-meta">
                        <span>Periode OJT</span>
                        <strong>
                          {formatDate(item.start_date)} –{" "}
                          {formatDate(item.end_date)}
                        </strong>
                      </div>

                      <div className="ap-mobile-meta">
                        <span>Diajukan</span>
                        <strong>{formatTime(item.created_at)}</strong>
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
                            Alasan: {item.rejection_reason}
                          </p>
                        )}

                      {canReview && (
                        <div className="ap-row-actions mobile">
                          <button
                            type="button"
                            className="approve"
                            disabled={
                              processing ||
                              flagsLoading ||
                              !features.approval_enabled
                            }
                            onClick={() =>
                              openDecision(item, "approved")
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
                              openDecision(item, "rejected")
                            }
                          >
                            Tolak
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <div className="ap-bottom-actions">
          <button onClick={() => navigate("/")}>
            <Icon name="back" size={17} />
            Kembali ke Dashboard
          </button>
        </div>

        <footer className="ap-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal · Program 2026–2027
        </footer>
      </main>

      {/* MODAL KEPUTUSAN */}

      {selected && (
        <div
          className="ap-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
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
                  name={decision === "approved" ? "check" : "x"}
                  size={22}
                />
              </div>

              <div>
                <h2 id="ap-modal-title">
                  {decision === "approved"
                    ? "Persetujuan Peserta OJT"
                    : "Penolakan Peserta OJT"}
                </h2>
                <p>Konfirmasi keputusan pengajuan peserta.</p>
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
                    {selected.full_name || "Peserta OJT"}
                  </strong>
                  <small>
                    {selected.department || "—"} ·{" "}
                    {selected.site || "—"}
                  </small>
                </div>
              </div>

              <div className="ap-modal-period">
                <span>Periode Program OJT</span>
                <strong>
                  {formatDate(selected.start_date)} –{" "}
                  {formatDate(selected.end_date)}
                </strong>
              </div>

              {decision === "approved" ? (
                <div className="ap-modal-notice approve">
                  <Icon name="info" size={20} />
                  <span>
                    Setelah disetujui, server akan memproses
                    pengajuan dan mengaktifkan program OJT
                    sesuai aturan sistem.
                  </span>
                </div>
              ) : (
                <div className="ap-modal-notice reject">
                  <Icon name="info" size={20} />
                  <span>
                    Penolakan harus disertai alasan yang jelas.
                    Alasan akan disimpan sebagai bagian dari
                    riwayat pengajuan.
                  </span>
                </div>
              )}

              <form onSubmit={submitDecision}>
                {decision === "rejected" && (
                  <label className="ap-reason-field">
                    <strong>Alasan Penolakan *</strong>
                    <textarea
                      rows={5}
                      required
                      minLength={5}
                      maxLength={1000}
                      value={reason}
                      disabled={processing}
                      placeholder="Tuliskan alasan penolakan secara jelas..."
                      onChange={(event) =>
                        setReason(event.target.value)
                      }
                    />
                    <small>{reason.length}/1000 karakter</small>
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
                    disabled={processing || flagsLoading}
                  >
                    <Icon
                      name={decision === "approved" ? "check" : "x"}
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

// =====================================================
// CORPORATE MINING CSS
// =====================================================

const css = `
.ap-app,
.ap-app * {
  box-sizing: border-box;
}

.ap-app {
  min-height: 100vh;
  background: #f3f7f8;
  color: #142d38;
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
  outline: 3px solid #73ccad;
  outline-offset: 2px;
}

/* TOP BAR */

.ap-topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  min-height: 72px;
  padding: 12px 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: #fff;
  border-bottom: 1px solid #e3ebef;
  box-shadow: 0 3px 15px #12364a09;
}

.ap-brand {
  flex-shrink: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #14283f;
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -.7px;
  white-space: nowrap;
}

.ap-brand span {
  color: #078660;
}

.ap-brand small {
  margin-left: 6px;
  color: #8798a4;
  font-size: 10px;
}

.ap-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ap-nav button {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  padding: 12px 13px;
  background: transparent;
  color: #536777;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.ap-nav button.active,
.ap-nav button:hover {
  background: #e7f5ef;
  color: #087f5c;
}

.ap-account {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ap-account-avatar {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  background: #dff4e9;
  color: #087857;
  font-size: 12px;
  font-weight: 900;
}

.ap-account-info {
  min-width: 0;
}

.ap-account-info strong,
.ap-account-info small {
  display: block;
}

.ap-account-info strong {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.ap-account-info small {
  margin-top: 4px;
  font-size: 10px;
  color: #8094a1;
}

.ap-mobile-toggle {
  display: none;
  padding: 7px;
  border: 0;
  background: transparent;
}

/* CONTENT */

.ap-container {
  max-width: 1500px;
  margin: auto;
  padding: 24px;
}

.ap-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
  min-height: 213px;
  border-radius: 17px;
  padding: 30px 34px;
  color: white;
  background:
    linear-gradient(
      95deg,
      rgba(4,24,36,.98),
      rgba(5,43,47,.92) 48%,
      rgba(5,47,49,.63)
    ),
    url("/background-erg.png.PNG") center/cover;
}

.ap-kicker {
  color: #eccb82;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.ap-hero h1 {
  margin: 14px 0 10px;
  font-size: clamp(27px,3vw,43px);
  line-height: 1.15;
  letter-spacing: -.7px;
}

.ap-hero h1 span {
  color: #36d19b;
}

.ap-hero p {
  max-width: 670px;
  margin: 0;
  color: #d1e5e1;
  font-size: 13px;
  line-height: 1.8;
}

.ap-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  margin-top: 20px;
}

.ap-hero-tags span {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
}

.ap-hero-tags svg {
  color: #eac578;
}

.ap-hero-summary {
  display: grid;
  gap: 7px;
  min-width: 180px;
  justify-items: center;
  padding: 20px 25px;
  border: 1px solid #ffffff40;
  border-radius: 14px;
  background: #062a2fcf;
  text-align: center;
}

.ap-hero-summary small {
  font-size: 10px;
  letter-spacing: .5px;
  color: #b7d5cd;
  font-weight: 800;
}

.ap-hero-summary strong {
  font-size: 40px;
}

.ap-hero-summary span {
  font-size: 11px;
  color: #c0dfd5;
}

.ap-breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 16px 2px;
  font-size: 11px;
  color: #92a1ad;
}

.ap-breadcrumb button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #768c98;
  font-weight: 700;
}

.ap-breadcrumb strong {
  color: #087b59;
}

/* ALERT */

.ap-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 15px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
}

.ap-alert > span {
  flex: 1;
}

.ap-alert button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 3px;
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

/* FEATURE BAR */

.ap-feature-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 17px 20px;
  margin-bottom: 15px;
  border: 1px solid #cce4ee;
  border-radius: 13px;
  background: #edf7fb;
}

.ap-feature-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}

.ap-feature-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 11px;
  color: #276d91;
  background: #dceff8;
}

.ap-feature-heading strong,
.ap-feature-heading small {
  display: block;
}

.ap-feature-heading strong {
  color: #215d7b;
  font-size: 13px;
}

.ap-feature-heading small {
  margin-top: 6px;
  color: #648392;
  font-size: 11px;
  line-height: 1.5;
}

.ap-feature-statuses {
  display: flex;
  gap: 11px;
}

.ap-feature-statuses > div {
  display: grid;
  gap: 7px;
  min-width: 112px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #d7e8ee;
  border-radius: 9px;
  text-align: center;
}

.ap-feature-statuses span {
  color: #78909d;
  font-size: 10px;
}

.ap-feature-statuses strong {
  font-size: 12px;
}

.ap-feature-statuses strong.enabled {
  color: #087c55;
}

.ap-feature-statuses strong.disabled {
  color: #b5791f;
}

/* SUMMARY CARDS */

.ap-summary-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.ap-summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 112px;
  padding: 17px;
  border: 1px solid #e0e9ee;
  border-radius: 13px;
  background: white;
  text-align: left;
  box-shadow: 0 4px 15px #15354807;
}

.ap-summary-card.selected {
  outline: 2px solid #6ecfa7;
  outline-offset: -2px;
}

.ap-summary-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 11px;
}

.ap-summary-card.amber .ap-summary-icon {
  color: #bb7b16;
  background: #fff3d9;
}

.ap-summary-card.green .ap-summary-icon {
  color: #078b60;
  background: #e1f7ea;
}

.ap-summary-card.rose .ap-summary-icon {
  color: #ca4b5d;
  background: #fff0f2;
}

.ap-summary-card.blue .ap-summary-icon {
  color: #2874c8;
  background: #e9f2fe;
}

.ap-summary-info {
  display: grid;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.ap-summary-info small {
  font-size: 11px;
  font-weight: 800;
  color: #647a89;
}

.ap-summary-info strong {
  color: #173642;
  font-size: 29px;
}

.ap-summary-info > span {
  color: #8c9fa9;
  font-size: 10px;
}

.ap-summary-card > svg {
  color: #92a6ad;
  flex-shrink: 0;
}

/* MAIN CARD */

.ap-card {
  padding: 22px;
  border: 1px solid #e0eaee;
  border-radius: 15px;
  background: white;
  box-shadow: 0 5px 18px #112f3d08;
}

.ap-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 20px;
}

.ap-section-title {
  display: flex;
  align-items: center;
  gap: 13px;
}

.ap-section-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 11px;
  background: #e1f5ea;
  color: #087d59;
}

.ap-section-title h2 {
  margin: 0;
  font-size: 18px;
}

.ap-section-title p {
  margin: 6px 0 0;
  color: #8195a0;
  font-size: 11px;
  line-height: 1.5;
}

.ap-refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #d8e6e9;
  border-radius: 9px;
  padding: 11px 14px;
  background: #fff;
  color: #206350;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

/* FILTER BAR */

.ap-filterbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e7eef1;
  border-radius: 12px;
  background: #f7fafb;
}

.ap-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ap-tabs button {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 8px;
  padding: 10px 13px;
  background: transparent;
  color: #607786;
  font-size: 12px;
  font-weight: 800;
}

.ap-tabs button.active {
  background: #078961;
  color: white;
}

.ap-tabs button > span {
  display: grid;
  place-items: center;
  min-width: 23px;
  height: 22px;
  padding: 0 5px;
  border-radius: 6px;
  background: #e6eef1;
  color: #425c6c;
  font-size: 10px;
}

.ap-tabs button.active > span {
  background: #ffffff35;
  color: white;
}

.ap-search {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 240px;
  padding: 0 13px;
  border: 1px solid #d8e4e9;
  border-radius: 9px;
  background: white;
  color: #879ba6;
}

.ap-search input {
  width: 100%;
  min-height: 40px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: #153846;
}

.ap-result-count {
  padding: 14px 2px;
  color: #81939c;
  font-size: 11px;
}

.ap-result-count strong {
  color: #087c59;
}

/* TABLE */

.ap-table-scroll {
  overflow-x: auto;
  width: 100%;
}

.ap-table {
  width: 100%;
  min-width: 990px;
  border-collapse: collapse;
  text-align: left;
  font-size: 12px;
}

.ap-table th {
  padding: 13px 12px;
  background: #edf4f6;
  color: #58717c;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
}

.ap-table td {
  padding: 15px 12px;
  border-bottom: 1px solid #ecf1f3;
  color: #344f5b;
  vertical-align: middle;
}

.ap-table tr:hover td {
  background: #fafcfb;
}

.ap-person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 160px;
}

.ap-person-avatar {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #ddf3e8;
  color: #087954;
  font-weight: 900;
  font-size: 12px;
}

.ap-person strong,
.ap-person small {
  display: block;
}

.ap-person strong {
  color: #1e3944;
  font-size: 12px;
}

.ap-person small {
  margin-top: 5px;
  color: #8a9ca6;
  font-size: 10px;
}

.ap-cell-main,
.ap-cell-sub {
  display: block;
}

.ap-cell-main {
  color: #24434f;
  font-size: 12px;
}

.ap-cell-sub {
  margin-top: 5px;
  color: #8296a1;
  font-size: 11px;
}

.ap-date-cell {
  font-size: 11px;
  line-height: 1.7;
  white-space: nowrap;
}

/* BADGES */

.ap-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.ap-status.pending {
  background: #fff3d9;
  color: #b17b20;
}

.ap-status.approved {
  background: #e1f7ea;
  color: #0a8559;
}

.ap-status.rejected {
  background: #fff0f2;
  color: #c34759;
}

.ap-status.unknown {
  background: #eef2f4;
  color: #69808b;
}

.ap-reason-inline {
  display: block;
  margin-top: 8px;
  max-width: 180px;
  color: #a25c66;
  font-size: 10px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.ap-row-actions {
  display: flex;
  gap: 7px;
}

.ap-row-actions button {
  border: 0;
  border-radius: 7px;
  padding: 9px 11px;
  font-size: 11px;
  font-weight: 850;
}

.ap-row-actions .approve {
  background: #078c5f;
  color: #fff;
}

.ap-row-actions .reject {
  background: #fff0f1;
  color: #c23b51;
}

.ap-no-action {
  font-size: 11px;
  color: #8c9eaa;
}

.ap-empty {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 45px 20px;
  text-align: center;
  color: #8ca0aa;
}

.ap-empty strong {
  color: #516b78;
  font-size: 14px;
}

.ap-empty p {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.ap-mobile-list {
  display: none;
}

.ap-bottom-actions {
  display: flex;
  margin-top: 17px;
}

.ap-bottom-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid #d5e7df;
  border-radius: 9px;
  padding: 12px 16px;
  background: #e9f5ee;
  color: #126b50;
  font-size: 12px;
  font-weight: 850;
}

.ap-footer {
  padding: 28px 0 10px;
  color: #91a2ad;
  text-align: center;
  font-size: 10px;
}

/* MODAL */

.ap-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 15px;
  background: #061e29b8;
}

.ap-modal {
  width: min(100%,560px);
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
  border-bottom: 1px solid #edf1f3;
}

.ap-modal-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  border-radius: 11px;
  background: #e1f6ea;
  color: #07865d;
}

.ap-modal-header > div:nth-child(2) {
  flex: 1;
}

.ap-modal-header h2 {
  margin: 0;
  font-size: 17px;
}

.ap-modal-header p {
  margin: 6px 0 0;
  color: #8395a0;
  font-size: 11px;
}

.ap-close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: #f1f5f6;
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
  font-size: 14px;
}

.ap-modal-participant small {
  margin-top: 6px;
  color: #7e909a;
  font-size: 11px;
}

.ap-modal-period {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 9px;
  padding: 13px;
  border-radius: 9px;
  background: #f4f8f9;
}

.ap-modal-period span {
  color: #758b95;
  font-size: 11px;
}

.ap-modal-period strong {
  font-size: 12px;
}

.ap-modal-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 16px 0;
  padding: 13px;
  border-radius: 10px;
  font-size: 11px;
  line-height: 1.7;
}

.ap-modal-notice svg {
  flex-shrink: 0;
}

.ap-modal-notice.approve {
  color: #15784f;
  background: #edf9f1;
}

.ap-modal-notice.reject {
  color: #a35b27;
  background: #fff6e8;
}

.ap-reason-field {
  display: block;
  margin-top: 17px;
}

.ap-reason-field strong {
  display: block;
  font-size: 12px;
}

.ap-reason-field textarea {
  width: 100%;
  resize: vertical;
  margin-top: 9px;
  padding: 13px;
  border: 1px solid #d9e5e9;
  border-radius: 9px;
  color: #1a3945;
  font-size: 13px;
  line-height: 1.6;
}

.ap-reason-field small {
  display: block;
  margin-top: 6px;
  text-align: right;
  font-size: 10px;
  color: #8799a3;
}

.ap-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 21px;
}

.ap-modal-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  min-height: 43px;
  padding: 12px 15px;
  font-size: 12px;
  font-weight: 850;
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

/* RESPONSIVE */

@media(max-width:1250px) {
  .ap-topbar {
    padding: 12px 18px;
    gap: 10px;
  }

  .ap-brand {
    font-size: 20px;
  }

  .ap-nav button {
    padding: 10px;
    font-size: 11px;
  }

  .ap-summary-card {
    padding: 13px;
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
    background: white;
    border-bottom: 1px solid #e0e9ee;
    box-shadow: 0 15px 25px #102d3c20;
  }

  .ap-nav.open {
    display: grid;
  }

  .ap-nav button {
    font-size: 13px;
  }

  .ap-account {
    margin-left: auto;
  }

  .ap-mobile-toggle {
    display: grid;
    place-items: center;
  }

  .ap-summary-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .ap-feature-bar {
    flex-wrap: wrap;
  }
}

@media(max-width:700px) {
  .ap-topbar {
    min-height: 60px;
    padding: 10px 12px;
  }

  .ap-brand {
    font-size: 19px;
  }

  .ap-account-info {
    display: none;
  }

  .ap-container {
    padding: 12px;
  }

  .ap-hero {
    flex-direction: column;
    align-items: stretch;
    min-height: 0;
    padding: 24px 18px;
  }

  .ap-hero h1 {
    font-size: 29px;
  }

  .ap-hero-summary {
    min-width: 0;
    justify-items: start;
    text-align: left;
    padding: 15px;
  }

  .ap-hero-summary strong {
    font-size: 31px;
  }

  .ap-feature-statuses {
    width: 100%;
  }

  .ap-feature-statuses > div {
    flex: 1;
    min-width: 0;
  }

  .ap-summary-grid {
    gap: 8px;
  }

  .ap-summary-card {
    min-height: 115px;
    padding: 12px;
    gap: 8px;
  }

  .ap-summary-icon {
    width: 34px;
    height: 34px;
  }

  .ap-summary-info small {
    font-size: 10px;
  }

  .ap-summary-info strong {
    font-size: 25px;
  }

  .ap-summary-card > svg {
    display: none;
  }

  .ap-card {
    padding: 15px;
  }

  .ap-section-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .ap-section-title h2 {
    font-size: 16px;
  }

  .ap-refresh {
    width: 100%;
  }

  .ap-filterbar {
    align-items: stretch;
    flex-direction: column;
  }

  .ap-tabs {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .ap-tabs button {
    justify-content: space-between;
    font-size: 11px;
  }

  .ap-search {
    min-width: 0;
    width: 100%;
  }

  .ap-table-scroll {
    display: none;
  }

  .ap-mobile-list {
    display: grid;
    gap: 11px;
  }

  .ap-mobile-item {
    padding: 15px;
    border: 1px solid #e4ecef;
    border-radius: 11px;
    background: white;
  }

  .ap-mobile-person {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 14px;
  }

  .ap-mobile-person strong,
  .ap-mobile-person small {
    display: block;
  }

  .ap-mobile-person strong {
    font-size: 13px;
  }

  .ap-mobile-person small {
    margin-top: 5px;
    color: #82949d;
    font-size: 11px;
  }

  .ap-mobile-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 0;
    border-top: 1px solid #eff3f4;
  }

  .ap-mobile-meta span {
    color: #8799a2;
    font-size: 11px;
  }

  .ap-mobile-meta strong {
    text-align: right;
    font-size: 11px;
  }

  .ap-mobile-item > .ap-status {
    margin-top: 12px;
  }

  .ap-mobile-reason {
    margin: 12px 0 0;
    font-size: 11px;
    color: #b34d60;
    line-height: 1.6;
  }

  .ap-row-actions.mobile {
    margin-top: 14px;
  }

  .ap-row-actions.mobile button {
    flex: 1;
    padding: 12px;
  }

  .ap-modal {
    width: 100%;
  }

  .ap-modal-header,
  .ap-modal-body {
    padding: 16px;
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
