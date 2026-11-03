"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MONITORING FISIK — GLOBAL LIGHT / DARK MODE
//
// Tema mengikuti html[data-theme] dari RootLayout.
// Tidak menambahkan tombol tema.
//
// DIPERTAHANKAN:
// - Hak akses Admin, Mentor, dan Peserta
// - Database dan kebijakan RLS Supabase
// - Target 25 km per minggu
// - Perhitungan kilometer dalam satuan meter
// - Hanya verified dengan jarak valid dihitung
// - Pemilihan 25 minggu dan riwayat kegiatan
// - Refresh dan pemeriksaan ulang akses
//
// CATATAN:
// Perhitungan minggu mengikuti kode asal:
// berbasis start_date peserta.
// =====================================================

const TOTAL_WEEKS = 25;
const TARGET_KM = 25;

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some((n) => !Number.isInteger(n))
  ) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

// Contoh: 8,000 menjadi 8; 12,500 menjadi 12,5.
function formatKm(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0%";

  return (
    number.toLocaleString("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + "%"
  );
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function validDistance(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

function distanceMeters(value) {
  if (!validDistance(value)) return 0;

  return Math.round(Number(value) * 1000);
}

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function ProgressBar({ percentage }) {
  const width = Math.min(
    100,
    Math.max(0, Number(percentage) || 0)
  );

  return (
    <div
      className="mf-progress"
      role="progressbar"
      aria-label="Pencapaian target Fisik mingguan"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${width}%` }} />
    </div>
  );
}

export default function MonitoringFisikPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [account, setAccount] = useState(null);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [viewerId, setViewerId] = useState(null);

  // ==================================================
  // VERIFIKASI AKSES
  //
  // Admin dan Mentor boleh melihat seluruh program.
  // Peserta hanya boleh melihat program miliknya.
  // RLS Supabase tetap menjadi pengaman utama.
  // ==================================================

  async function fetchData() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,role,full_name")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Profil akun tidak ditemukan.");
    }

    const role = normalizeRole(profile.role);
    const isAdmin = role === "admin";
    const isMentor = role === "mentor";
    const isManager = isAdmin || isMentor;

    const isParticipant = [
      "participant",
      "peserta",
    ].includes(role);

    if (!isManager && !isParticipant) {
      throw new Error(
        "Akun tidak memiliki akses Monitoring Fisik."
      );
    }

    let programQuery = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        site,
        start_date,
        end_date,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", programId);

    // Admin dan Mentor mengikuti akses seluruh program
    // yang diizinkan RLS. Peserta hanya program sendiri.
    if (isParticipant) {
      programQuery = programQuery.eq(
        "participant_id",
        user.id
      );
    }

    const programResult =
      await programQuery.maybeSingle();

    if (programResult.error) {
      throw programResult.error;
    }

    if (!programResult.data) {
      throw new Error(
        "Program OJT tidak ditemukan atau tidak dapat diakses."
      );
    }

    if (
      isParticipant &&
      programResult.data.participant_id !== user.id
    ) {
      throw new Error(
        "Peserta hanya dapat melihat Monitoring Fisik miliknya."
      );
    }

    if (!parseDate(programResult.data.start_date)) {
      throw new Error("Tanggal mulai OJT belum valid.");
    }

    const typeResult = await supabase
      .from("achievement_types")
      .select("code,name");

    if (typeResult.error) {
      throw typeResult.error;
    }

    const fisikType = (typeResult.data || []).find(
      (item) =>
        String(item.name || "")
          .trim()
          .toLowerCase() === "fisik"
    );

    if (!fisikType) {
      throw new Error("Kategori Fisik tidak ditemukan.");
    }

    const recordResult = await supabase
      .from("achievement_records")
      .select(`
        id,
        type_code,
        activity_date,
        description,
        distance_km,
        status,
        verified_by,
        created_at
      `)
      .eq("program_id", programResult.data.id)
      .eq("type_code", fisikType.code)
      .order("activity_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (recordResult.error) {
      throw recordResult.error;
    }

    return {
      viewerId: user.id,
      role,
      profile,
      program: programResult.data,
      records: recordResult.data || [],
    };
  }

  // ==================================================
  // LOAD DATA
  // ==================================================

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setProgram(null);
      setRecords([]);
      setViewerId(null);
      setAccount(null);

      try {
        if (!programId) {
          throw new Error(
            "ID program OJT tidak tersedia."
          );
        }

        const result = await fetchData();

        if (!active) return;

        setProgram(result.program);
        setRecords(result.records);
        setViewerId(result.viewerId);
        setAccount(result.profile);

        const now = new Date();

        const localToday = new Date(
          now.getTime() -
            now.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 10);

        const currentWeek = weekOf(
          localToday,
          result.program.start_date
        );

        const latestRecordedWeek = result.records
          .map((item) =>
            weekOf(
              item.activity_date,
              result.program.start_date
            )
          )
          .filter((week) => week !== null)
          .sort((a, b) => b - a)[0];

        setSelectedWeek(
          currentWeek || latestRecordedWeek || 1
        );
      } catch (err) {
        if (!active) return;

        if (
          String(err?.message || "").includes(
            "Sesi login tidak tersedia"
          )
        ) {
          router.replace("/login");
          return;
        }

        setError(
          err?.message ||
            "Gagal memuat Monitoring Fisik."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  // ==================================================
  // REFRESH DATA
  // Akses diperiksa ulang seperti pada kode asal.
  // ==================================================

  async function refresh() {
    if (
      refreshing ||
      loading ||
      !programId ||
      !program
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const result = await fetchData();

      if (result.viewerId !== viewerId) {
        throw new Error(
          "Akun login telah berubah. Silakan buka ulang halaman."
        );
      }

      setProgram(result.program);
      setRecords(result.records);
      setViewerId(result.viewerId);
      setAccount(result.profile);
    } catch (err) {
      setProgram(null);
      setRecords([]);
      setViewerId(null);
      setAccount(null);

      if (
        String(err?.message || "").includes(
          "Sesi login tidak tersedia"
        )
      ) {
        router.replace("/login");
      } else {
        setError(
          err?.message ||
            "Gagal memperbarui data Fisik."
        );
      }
    } finally {
      setRefreshing(false);
    }
  }

  // ==================================================
  // PERHITUNGAN FISIK — DIPERTAHANKAN
  // ==================================================

  const summary = useMemo(() => {
    const weeklyRecords = records.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) === selectedWeek
    );

    const verifiedRecords = weeklyRecords.filter(
      (item) =>
        item.status === "verified" &&
        validDistance(item.distance_km)
    );

    const pendingRecords = weeklyRecords.filter(
      (item) => item.status === "pending"
    );

    const totalMeters = verifiedRecords.reduce(
      (sum, item) =>
        sum + distanceMeters(item.distance_km),
      0
    );

    const weeklyKm = totalMeters / 1000;
    const percentage = (weeklyKm / TARGET_KM) * 100;

    const remainingMeters = Math.max(
      0,
      TARGET_KM * 1000 - totalMeters
    );

    const achieved =
      totalMeters >= TARGET_KM * 1000;

    return {
      weeklyKm,
      percentage,
      achieved,
      remainingKm: remainingMeters / 1000,
      weeklyRecords,
      verifiedCount: verifiedRecords.length,
      pendingCount: pendingRecords.length,
      activityCount: weeklyRecords.length,
    };
  }, [records, program, selectedWeek]);

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const startWeekDate = program?.start_date
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7
      )
    : null;

  const endWeekDate = startWeekDate
    ? addDays(startWeekDate, 6)
    : null;

  const accountRole = normalizeRole(account?.role);

  const roleLabel =
    accountRole === "admin"
      ? "Administrator"
      : accountRole === "mentor"
      ? "Mentor OJT"
      : "Peserta OJT";

  return (
    <main className="mf-root">
      <style>{STYLES}</style>

      <header className="mf-header">
        <div className="mf-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="mf-header-actions">
          {account && (
            <div className="mf-account">
              <small>{roleLabel}</small>
              <strong>
                {account.full_name || "Pengguna"}
              </strong>
            </div>
          )}

          <button
            type="button"
            className="mf-back"
            onClick={() =>
              router.push(`/monitoring/${programId}`)
            }
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="mf-container">
        <h1 className="mf-title">
          Monitoring Fisik
        </h1>

        <p className="mf-subtitle">
          Monitoring jarak dan frekuensi lari setiap
          minggu OJT. Hanya kegiatan terverifikasi
          yang dihitung dalam pencapaian target.
        </p>

        {loading ? (
          <section
            className="mf-card mf-loading"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="mf-loading-icon" aria-hidden="true">
              🏃
            </div>
            <strong>Memuat Monitoring Fisik</strong>
            <p className="mf-muted">
              Memuat data peserta dan riwayat kegiatan...
            </p>
          </section>
        ) : error && !program ? (
          <div className="mf-alert" role="alert">
            {error}
          </div>
        ) : (
          <>
            {error && (
              <div className="mf-alert" role="alert">
                {error}
              </div>
            )}

            <section className="mf-card">
              <div className="mf-profile-name">
                {participant?.full_name || "Peserta OJT"}
              </div>

              <div className="mf-profile-meta">
                {participant?.department || "—"}
                {" · "}
                {program?.site || "Site belum tersedia"}
              </div>
            </section>

            <section className="mf-card">
              <label
                htmlFor="mf-week"
                className="mf-label"
              >
                Pilih Minggu Monitoring
              </label>

              <select
                id="mf-week"
                className="mf-select"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(Number(event.target.value))
                }
              >
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => index + 1
                ).map((week) => (
                  <option key={week} value={week}>
                    {weekLabel(week)}
                  </option>
                ))}
              </select>

              <div className="mf-week-dates">
                {startWeekDate && endWeekDate
                  ? `${formatDate(startWeekDate)} – ${formatDate(endWeekDate)}`
                  : "Periode minggu belum tersedia"}
              </div>
            </section>

            <section className="mf-card">
              <div className="mf-target-card">
                <div className="mf-target-top">
                  <div>
                    <div className="mf-target-label">
                      Realisasi {weekLabel(selectedWeek)}
                    </div>

                    <div className="mf-target-value">
                      {formatKm(summary.weeklyKm)}
                      <span> / 25 km</span>
                    </div>
                  </div>

                  <div
                    className={`mf-percent ${
                      summary.achieved ? "done" : ""
                    }`}
                  >
                    {formatPercent(summary.percentage)}
                  </div>
                </div>

                <ProgressBar percentage={summary.percentage} />

                <div className="mf-target-stats">
                  <div>
                    <span>Kegiatan lari terverifikasi</span>
                    <strong>
                      {summary.verifiedCount} kali
                    </strong>
                  </div>

                  <div>
                    <span>Sisa target minggu ini</span>
                    <strong>
                      {formatKm(summary.remainingKm)} km
                    </strong>
                  </div>
                </div>

                <div
                  className={`mf-status-text ${
                    summary.achieved ? "" : "pending"
                  }`}
                >
                  {summary.achieved
                    ? "✓ Target mingguan tercapai"
                    : "Target mingguan belum tercapai"}
                </div>
              </div>
            </section>

            <section className="mf-card">
              <h2 className="mf-section-title">
                Aktivitas Fisik Minggu Ini
              </h2>

              <p className="mf-muted">
                Ringkasan seluruh catatan lari pada{" "}
                {weekLabel(selectedWeek)}.
              </p>

              <div className="mf-stats-grid">
                <div className="mf-stat">
                  <span>Total Kegiatan Lari</span>
                  <strong>
                    {summary.activityCount} kali
                  </strong>
                </div>

                <div className="mf-stat">
                  <span>Terverifikasi</span>
                  <strong>
                    {summary.verifiedCount} kali
                  </strong>
                </div>

                <div className="mf-stat">
                  <span>Menunggu Verifikasi</span>
                  <strong>
                    {summary.pendingCount} kali
                  </strong>
                </div>
              </div>
            </section>

            <section className="mf-card">
              <div className="mf-actions">
                <button
                  type="button"
                  className="mf-refresh"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              <h2 className="mf-section-title">
                Riwayat Lari — {weekLabel(selectedWeek)}
              </h2>

              <p className="mf-muted">
                {summary.activityCount} catatan kegiatan pada
                minggu ini. Setiap kegiatan ditampilkan
                berdasarkan tanggal dan statusnya.
              </p>

              {!summary.weeklyRecords.length ? (
                <p className="mf-muted">
                  Belum ada kegiatan lari yang tercatat
                  pada {weekLabel(selectedWeek)}.
                </p>
              ) : (
                <div className="mf-history">
                  {summary.weeklyRecords.map((item, index) => {
                    const verified = item.status === "verified";

                    return (
                      <div
                        className="mf-history-item"
                        key={item.id}
                      >
                        <div
                          className="mf-history-icon"
                          aria-hidden="true"
                        >
                          🏃
                        </div>

                        <div>
                          <div className="mf-history-date">
                            Lari ke-
                            {summary.activityCount - index}
                            {" · "}
                            {formatDate(item.activity_date)}
                          </div>

                          <div
                            className={`mf-history-status ${
                              verified
                                ? "mf-verified"
                                : "mf-pending"
                            }`}
                          >
                            {verified
                              ? "✓ Terverifikasi Mentor"
                              : item.status === "pending"
                              ? "Menunggu Verifikasi"
                              : item.status ||
                                "Status belum tersedia"}
                          </div>

                          {item.description && (
                            <div className="mf-history-desc">
                              {item.description}
                            </div>
                          )}
                        </div>

                        <div className="mf-history-distance">
                          {validDistance(item.distance_km)
                            ? formatKm(item.distance_km)
                            : "—"}{" "}
                          km
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// =====================================================
// CSS — TEMA GLOBAL
// =====================================================

const STYLES = `
  /* LIGHT MODE */

  .mf-root {
    color-scheme: light;

    --mf-bg: #f1f6f5;
    --mf-surface: #ffffff;
    --mf-text: #19362e;
    --mf-heading: #19362e;
    --mf-muted: #587165;
    --mf-border: #e0e9e5;
    --mf-divider: #e5ece7;
    --mf-shadow: 0 4px 18px rgba(24,61,43,.04);

    --mf-header: #07313a;
    --mf-header-text: #ffffff;
    --mf-header-muted: #c3ded3;
    --mf-brand-accent: #3bc78e;

    --mf-back-bg: #e2f3e9;
    --mf-back-text: #0a694d;
    --mf-back-hover: #ccebdc;

    --mf-input-bg: #ffffff;
    --mf-input-border: #cddbd4;
    --mf-input-text: #183b2b;

    --mf-target-bg: #edf8f1;
    --mf-target-border: #cce7d6;
    --mf-target-text: #173e2b;
    --mf-target-muted: #4e705d;

    --mf-percent-bg: #fff0df;
    --mf-percent-text: #974700;
    --mf-done-bg: #d4efdf;
    --mf-done-text: #08623e;

    --mf-progress-bg: #d4e7db;
    --mf-progress-fill: #269858;

    --mf-stat-bg: #f2faf5;
    --mf-stat-border: #d9ede0;
    --mf-stat-text: #0d7952;

    --mf-status-done: #087448;
    --mf-status-pending: #945000;

    --mf-icon-bg: #edf4ef;
    --mf-verified: #0a7950;
    --mf-pending: #946000;

    --mf-error-bg: #fff0f0;
    --mf-error-border: #f1c1c1;
    --mf-error-text: #a52535;

    --mf-refresh-bg: #e9f7ee;
    --mf-refresh-border: #cde7d7;
    --mf-refresh-text: #0b8057;
    --mf-refresh-hover: #d8efdf;

    --mf-focus: #237fc0;
  }

  /* DARK MODE */

  html[data-theme="dark"] .mf-root {
    color-scheme: dark;

    --mf-bg: #0b171c;
    --mf-surface: #15272e;
    --mf-text: #e3f0e8;
    --mf-heading: #edf8f1;
    --mf-muted: #aac1b5;
    --mf-border: #30473f;
    --mf-divider: #2b4038;
    --mf-shadow: 0 4px 18px rgba(0,0,0,.18);

    --mf-header: #071e25;
    --mf-header-text: #f0f8f3;
    --mf-header-muted: #b5d1c2;
    --mf-brand-accent: #5bdeb0;

    --mf-back-bg: #234638;
    --mf-back-text: #bcf5d8;
    --mf-back-hover: #2c5945;

    --mf-input-bg: #1b3036;
    --mf-input-border: #3b574b;
    --mf-input-text: #e3f0e8;

    --mf-target-bg: #10281f;
    --mf-target-border: #2c5540;
    --mf-target-text: #f0f8f2;
    --mf-target-muted: #b1cdbb;

    --mf-percent-bg: #493521;
    --mf-percent-text: #ffd29f;
    --mf-done-bg: #214b34;
    --mf-done-text: #98efb9;

    --mf-progress-bg: #2c4838;
    --mf-progress-fill: #53d589;

    --mf-stat-bg: #1b352a;
    --mf-stat-border: #315340;
    --mf-stat-text: #87e8b6;

    --mf-status-done: #98edb8;
    --mf-status-pending: #ffd09a;

    --mf-icon-bg: #244234;
    --mf-verified: #85e4af;
    --mf-pending: #ffd28e;

    --mf-error-bg: #40242c;
    --mf-error-border: #7a424d;
    --mf-error-text: #ffc3cb;

    --mf-refresh-bg: #214333;
    --mf-refresh-border: #38634b;
    --mf-refresh-text: #a2edc1;
    --mf-refresh-hover: #2c5540;

    --mf-focus: #88caff;
  }

  /* BASE */

  .mf-root,
  .mf-root * {
    box-sizing: border-box;
  }

  .mf-root {
    min-height: 100vh;
    background: var(--mf-bg);
    color: var(--mf-text);
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }

  .mf-root button,
  .mf-root select {
    font-family: inherit;
  }

  .mf-root button {
    cursor: pointer;
    touch-action: manipulation;
  }

  .mf-root button:disabled {
    cursor: not-allowed;
  }

  .mf-root button:focus-visible,
  .mf-root select:focus-visible {
    outline: 3px solid var(--mf-focus);
    outline-offset: 3px;
  }

  /* HEADER */

  .mf-header {
    background: var(--mf-header);
    color: var(--mf-header-text);
    padding: 18px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .mf-brand {
    font-size: 22px;
    font-weight: 900;
    white-space: nowrap;
  }

  .mf-brand span {
    color: var(--mf-brand-accent);
  }

  .mf-brand > small {
    margin-left: 6px;
    color: var(--mf-header-muted);
    font-size: 10px;
  }

  .mf-header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }

  .mf-account {
    min-width: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }

  .mf-account small,
  .mf-account strong {
    display: block;
  }

  .mf-account small {
    color: var(--mf-header-muted);
    font-size: 10px;
    margin-bottom: 4px;
  }

  .mf-account strong {
    color: var(--mf-header-text);
    font-size: 12px;
  }

  .mf-back {
    flex-shrink: 0;
    border: 0;
    border-radius: 10px;
    background: var(--mf-back-bg);
    color: var(--mf-back-text);
    padding: 11px 15px;
    font-size: 13px;
    font-weight: 800;
  }

  /* PAGE */

  .mf-container {
    width: 100%;
    max-width: 1050px;
    margin: 0 auto;
    padding: 24px;
  }

  .mf-title {
    color: var(--mf-heading);
    font-size: 27px;
    font-weight: 900;
    line-height: 1.3;
    margin: 0 0 8px;
  }

  .mf-subtitle {
    color: var(--mf-muted);
    font-size: 13px;
    line-height: 1.6;
    margin: 0 0 20px;
  }

  .mf-card {
    min-width: 0;
    background: var(--mf-surface);
    color: var(--mf-text);
    border: 1px solid var(--mf-border);
    border-radius: 16px;
    padding: 21px;
    margin-bottom: 17px;
    box-shadow: var(--mf-shadow);
  }

  .mf-profile-name {
    color: var(--mf-heading);
    font-size: 19px;
    font-weight: 900;
    margin-bottom: 7px;
    overflow-wrap: anywhere;
  }

  .mf-profile-meta {
    font-size: 12px;
    color: var(--mf-muted);
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .mf-section-title {
    color: var(--mf-heading);
    font-size: 18px;
    font-weight: 900;
    margin: 0 0 12px;
  }

  /* WEEK SELECTION */

  .mf-label {
    display: block;
    color: var(--mf-text);
    font-size: 13px;
    font-weight: 800;
    margin-bottom: 9px;
  }

  .mf-select {
    display: block;
    width: 100%;
    padding: 13px;
    border: 1px solid var(--mf-input-border);
    border-radius: 10px;
    background: var(--mf-input-bg);
    color: var(--mf-input-text);
    font-size: 16px;
  }

  .mf-select option {
    background: var(--mf-input-bg);
    color: var(--mf-input-text);
  }

  .mf-week-dates {
    margin-top: 10px;
    color: var(--mf-muted);
    font-size: 12px;
  }

  /* WEEKLY TARGET */

  .mf-target-card {
    background: var(--mf-target-bg);
    color: var(--mf-target-text);
    border: 1px solid var(--mf-target-border);
    border-radius: 17px;
    padding: 24px;
  }

  .mf-target-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .mf-target-top > div:first-child {
    min-width: 0;
  }

  .mf-target-label {
    font-size: 14px;
    color: var(--mf-target-muted);
    margin-bottom: 10px;
  }

  .mf-target-value {
    color: var(--mf-target-text);
    font-size: 38px;
    font-weight: 900;
    line-height: 1.2;
    overflow-wrap: anywhere;
  }

  .mf-target-value span {
    font-size: 18px;
    color: var(--mf-target-muted);
    font-weight: 700;
  }

  .mf-percent {
    background: var(--mf-percent-bg);
    color: var(--mf-percent-text);
    border-radius: 40px;
    padding: 9px 12px;
    font-weight: 900;
    font-size: 15px;
    white-space: nowrap;
  }

  .mf-percent.done {
    background: var(--mf-done-bg);
    color: var(--mf-done-text);
  }

  .mf-progress {
    background: var(--mf-progress-bg);
    height: 11px;
    border-radius: 20px;
    overflow: hidden;
    margin-top: 22px;
  }

  .mf-progress div {
    background: var(--mf-progress-fill);
    height: 100%;
    border-radius: inherit;
    transition: width .2s ease;
  }

  .mf-target-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-top: 24px;
  }

  .mf-target-stats > div {
    min-width: 0;
  }

  .mf-target-stats span {
    display: block;
    color: var(--mf-target-muted);
    font-size: 12px;
    margin-bottom: 9px;
  }

  .mf-target-stats strong {
    color: var(--mf-target-text);
    font-size: 25px;
    font-weight: 900;
    overflow-wrap: anywhere;
  }

  .mf-status-text {
    margin-top: 12px;
    font-size: 12px;
    font-weight: 800;
    color: var(--mf-status-done);
  }

  .mf-status-text.pending {
    color: var(--mf-status-pending);
  }

  /* ACTIVITY STATS */

  .mf-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
  }

  .mf-stat {
    min-width: 0;
    background: var(--mf-stat-bg);
    border: 1px solid var(--mf-stat-border);
    border-radius: 12px;
    padding: 15px;
  }

  .mf-stat span {
    display: block;
    color: var(--mf-muted);
    font-size: 11px;
    margin-bottom: 8px;
  }

  .mf-stat strong {
    display: block;
    color: var(--mf-stat-text);
    font-size: 22px;
    overflow-wrap: anywhere;
  }

  /* HISTORY */

  .mf-history {
    display: flex;
    flex-direction: column;
  }

  .mf-history-item {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    gap: 13px;
    align-items: start;
    padding: 17px 0;
    border-bottom: 1px solid var(--mf-divider);
  }

  .mf-history-item:last-child {
    border-bottom: 0;
  }

  .mf-history-icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    background: var(--mf-icon-bg);
    border-radius: 12px;
    font-size: 23px;
  }

  .mf-history-date {
    color: var(--mf-heading);
    font-size: 14px;
    font-weight: 900;
    margin-bottom: 6px;
    overflow-wrap: anywhere;
  }

  .mf-history-status {
    font-size: 12px;
    color: var(--mf-muted);
    overflow-wrap: anywhere;
  }

  .mf-history-desc {
    color: var(--mf-muted);
    font-size: 12px;
    line-height: 1.5;
    margin-top: 7px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .mf-history-distance {
    color: var(--mf-heading);
    text-align: right;
    font-size: 17px;
    font-weight: 900;
    white-space: nowrap;
  }

  .mf-verified {
    color: var(--mf-verified);
  }

  .mf-pending {
    color: var(--mf-pending);
  }

  /* COMMON */

  .mf-muted {
    color: var(--mf-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .mf-alert {
    background: var(--mf-error-bg);
    border: 1px solid var(--mf-error-border);
    color: var(--mf-error-text);
    padding: 15px;
    border-radius: 12px;
    margin-bottom: 16px;
    overflow-wrap: anywhere;
  }

  .mf-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 15px;
  }

  .mf-refresh {
    border: 1px solid var(--mf-refresh-border);
    background: var(--mf-refresh-bg);
    color: var(--mf-refresh-text);
    border-radius: 9px;
    padding: 10px 14px;
    font-weight: 800;
  }

  .mf-refresh:disabled {
    opacity: .6;
  }

  /* LOADING */

  .mf-loading {
    text-align: center;
    padding: 35px 20px;
  }

  .mf-loading-icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    margin: 0 auto 14px;
    border-radius: 14px;
    background: var(--mf-icon-bg);
    font-size: 27px;
  }

  .mf-loading > strong {
    display: block;
    color: var(--mf-heading);
    font-size: 17px;
  }

  .mf-loading p {
    margin-bottom: 0;
  }

  /* HOVER */

  @media (hover: hover) {
    .mf-back:hover {
      background: var(--mf-back-hover);
    }

    .mf-refresh:not(:disabled):hover {
      background: var(--mf-refresh-hover);
    }
  }

  /* RESPONSIVE */

  @media (max-width: 760px) {
    .mf-header {
      padding: 15px;
    }

    .mf-brand {
      font-size: 19px;
    }

    .mf-header-actions {
      gap: 10px;
    }

    .mf-account {
      max-width: 150px;
    }

    .mf-container {
      padding: 12px;
    }

    .mf-title {
      font-size: 22px;
    }

    .mf-card {
      padding: 16px;
      border-radius: 14px;
      margin-bottom: 12px;
    }

    .mf-target-card {
      padding: 19px;
    }

    .mf-target-value {
      font-size: 30px;
    }

    .mf-target-value span {
      font-size: 15px;
    }

    .mf-percent {
      font-size: 13px;
    }

    .mf-target-stats strong {
      font-size: 20px;
    }

    .mf-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .mf-history-item {
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 10px;
    }

    .mf-history-icon {
      width: 38px;
      height: 38px;
      font-size: 19px;
    }

    .mf-history-distance {
      grid-column: 2;
      text-align: left;
      font-size: 17px;
    }
  }

  @media (max-width: 540px) {
    .mf-header {
      flex-wrap: wrap;
    }

    .mf-header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .mf-account {
      max-width: calc(100% - 105px);
      text-align: left;
    }

    .mf-back {
      font-size: 12px;
      padding: 10px 12px;
    }
  }

  @media (max-width: 370px) {
    .mf-target-top {
      flex-wrap: wrap;
    }

    .mf-target-value {
      font-size: 27px;
    }

    .mf-target-stats {
      gap: 12px;
    }

    .mf-stat {
      padding: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mf-progress div {
      transition: none;
    }
  }
`;
