"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT — GLOBAL LIGHT / DARK MODE
//
// Tema mengikuti html[data-theme] dari RootLayout.
// Tidak menambahkan tombol tema pada halaman ini.
//
// DIPERTAHANKAN:
// - Struktur database dan query Supabase
// - Hak akses Admin, Mentor, dan Peserta
// - Kalender Global Week 01–25
// - Periode program peserta
// - Target, rumus, dan perhitungan Achievement
// - Refresh, navigasi minggu, dan grafik
// - Mode Presentasi dan Cetak
// - Tampilan responsif desktop dan mobile
// =====================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? "2026-09-12"
        : addDays("2026-09-20", (index - 1) * 7);

    return {
      week: index + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date)) return null;

  const found = GLOBAL_WEEKS.find(
    item => date >= item.start && date <= item.end
  );

  return found?.week ?? null;
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = type =>
    parts.find(item => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
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

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function kmText(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function percentText(value) {
  return `${Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })}%`;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(item => item[0] || "")
    .join("")
    .toUpperCase();
}

// =====================================================
// PERIODE PROGRAM PESERTA
// =====================================================

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS[week - 1];

  if (!global || !parseDate(program?.start_date)) {
    return null;
  }

  const startProgram = String(program.start_date).slice(0, 10);

  const endProgram = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startProgram ? global.start : startProgram;

  const end =
    endProgram && endProgram < global.end
      ? endProgram
      : global.end;

  if (start > end) return null;

  return { start, end };
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date) ||
    globalWeekOf(date) === null
  ) {
    return false;
  }

  const start = String(program.start_date).slice(0, 10);

  const end = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  return date >= start && (!end || date <= end);
}

function initialWeek(program) {
  const available = GLOBAL_WEEKS.filter(
    item => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find(item => {
    const range = programWeekRange(program, item.week);

    return range && today >= range.start && today <= range.end;
  });

  if (current) return current.week;

  const previous = available.filter(item => item.end < today);

  if (previous.length) {
    return previous[previous.length - 1].week;
  }

  return available[0].week;
}

// =====================================================
// KATEGORI
// =====================================================

function categoryOf(value) {
  const key = normalize(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    ["training", "internaltraining", "pelatihan"].includes(key)
  ) {
    return "Training";
  }

  if (["sosialisasi", "socialization"].includes(key)) {
    return "Sosialisasi";
  }

  if (["coaching", "pembinaan"].includes(key)) {
    return "Coaching";
  }

  if (
    ["orientasi", "orientasiarea", "areaorientation"].includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"].includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function categoryFor(record, types) {
  const type = types.find(
    item => normalize(item.code) === normalize(record.type_code)
  );

  const name =
    categoryOf(record.type_code) ||
    categoryOf(type?.code) ||
    categoryOf(type?.name);

  return TARGETS.find(item => item.name === name) || null;
}

function achievedValue(records, category) {
  if (category.name !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce((sum, record) => {
    const distance = Number(record.distance_km);

    if (!Number.isFinite(distance) || distance <= 0) {
      return sum;
    }

    return sum + Math.round(distance * 1000);
  }, 0);

  return meters / 1000;
}

function amountText(value, category) {
  if (category.name === "Fisik") {
    return `${kmText(value)} km`;
  }

  return `${value} kegiatan`;
}

// =====================================================
// KOMPONEN UI
// =====================================================

function ProgressBar({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="am-progress"
      role="progressbar"
      aria-label="Progres pencapaian target"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function StatCard({ label, value, note, tone = "default" }) {
  return (
    <div className={`am-stat ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

export default function MonitoringAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [account, setAccount] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);
  const [week, setWeek] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [error, setError] = useState("");

  const role = roleOf(account?.role);
  const canManage = role === "admin" || role === "mentor";
  const isParticipant = role === "participant" || role === "peserta";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(
        item => programWeekRange(program, item.week)
      ),
    [program]
  );

  const availableWeekNumbers = useMemo(
    () => new Set(availableWeeks.map(item => item.week)),
    [availableWeeks]
  );

  const selectedPeriod = GLOBAL_WEEKS[week - 1];
  const selectedParticipantRange = programWeekRange(program, week);

  // ===================================================
  // SUPABASE
  // ===================================================

  async function fetchMonitoringData(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name")
        .order("name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
        )
        .eq("program_id", id)
        .order("activity_date", { ascending: false }),
    ]);

    if (results[0].error) throw results[0].error;
    if (results[1].error) throw results[1].error;

    return {
      types: results[0].data || [],
      records: results[1].data || [],
    };
  }

  async function verifyAccess() {
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
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Profil akun tidak ditemukan.");
    }

    const currentRole = roleOf(profile.role);

    if (
      !["admin", "mentor", "participant", "peserta"].includes(currentRole)
    ) {
      throw new Error(
        "Akun tidak memiliki akses Monitoring Achievement."
      );
    }

    let query = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        mentor_id,
        site,
        start_date,
        end_date,
        status,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", programId);

    if (currentRole === "mentor") {
      query = query.eq("mentor_id", user.id);
    }

    if (
      currentRole === "participant" ||
      currentRole === "peserta"
    ) {
      query = query
        .eq("participant_id", user.id)
        .eq("status", "active");
    }

    const {
      data: programData,
      error: programError,
    } = await query.maybeSingle();

    if (programError) throw programError;

    if (!programData) {
      throw new Error(
        "Program tidak ditemukan atau akses ditolak."
      );
    }

    if (!parseDate(programData.start_date)) {
      throw new Error(
        "Tanggal mulai program OJT tidak valid."
      );
    }

    return { user, profile, programData };
  }

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError("ID program tidak tersedia.");
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const access = await verifyAccess();
        const data = await fetchMonitoringData(access.programData.id);

        if (!active) return;

        setAccount(access.profile);
        setProgram(access.programData);
        setTypes(data.types);
        setRecords(data.records);
        setWeek(initialWeek(access.programData));
      } catch (err) {
        if (!active) return;

        setError(
          err?.message || "Gagal memuat Monitoring Achievement."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId]);

  async function refresh() {
    if (refreshing || loading || !program) return;

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess();

      if (access.profile.id !== account?.id) {
        setAccount(null);
        setProgram(null);

        throw new Error(
          "Akun login berubah. Silakan buka ulang halaman."
        );
      }

      const data = await fetchMonitoringData(access.programData.id);

      setProgram(access.programData);
      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  function changeWeek(value) {
    const number = Number(value);

    if (!availableWeekNumbers.has(number)) return;

    setWeek(number);
  }

  function goBack() {
    router.push(
      isParticipant
        ? "/dashboard-peserta"
        : `/peserta/${programId}`
    );
  }

  // ===================================================
  // VALID DATA DALAM PERIODE PESERTA
  // ===================================================

  const programRecords = useMemo(
    () =>
      records.filter(
        item => insideProgram(item.activity_date, program)
      ),
    [records, program]
  );

  const outsideProgram = useMemo(
    () => records.length - programRecords.length,
    [records, programRecords]
  );

  // ===================================================
  // MINGGU TERPILIH
  // ===================================================

  const weeklyRecords = useMemo(
    () =>
      programRecords.filter(
        item => globalWeekOf(item.activity_date) === week
      ),
    [programRecords, week]
  );

  const verified = useMemo(
    () =>
      weeklyRecords.filter(
        item => roleOf(item.status) === "verified"
      ),
    [weeklyRecords]
  );

  const pending = useMemo(
    () =>
      weeklyRecords.filter(
        item => roleOf(item.status) === "pending"
      ),
    [weeklyRecords]
  );

  const verificationPercent = weeklyRecords.length
    ? (verified.length / weeklyRecords.length) * 100
    : 0;

  // ===================================================
  // PROGRES ENAM KATEGORI
  // ===================================================

  const categories = useMemo(
    () =>
      TARGETS.map(category => {
        const related = weeklyRecords.filter(
          item => categoryFor(item, types)?.name === category.name
        );

        const valid = related.filter(
          item => roleOf(item.status) === "verified"
        );

        const waiting = related.filter(
          item => roleOf(item.status) === "pending"
        );

        const actual = achievedValue(valid, category);
        const targetPercent = clamp((actual / category.target) * 100);

        return {
          ...category,
          actual,
          total: related.length,
          verified: valid.length,
          pending: waiting.length,
          targetPercent,
          completed: actual >= category.target,
        };
      }),
    [weeklyRecords, types]
  );

  const weeklyAchievementProgress = useMemo(() => {
    if (!categories.length) return 0;

    return (
      categories.reduce(
        (sum, item) => sum + item.targetPercent,
        0
      ) / categories.length
    );
  }, [categories]);

  const completedCategories = categories.filter(
    item => item.completed
  ).length;

  // ===================================================
  // GRAFIK GLOBAL 25 MINGGU
  // ===================================================

  const chart = useMemo(
    () =>
      GLOBAL_WEEKS.map(item => {
        const matching = programRecords.filter(
          record => globalWeekOf(record.activity_date) === item.week
        );

        return {
          ...item,
          inProgram: availableWeekNumbers.has(item.week),
          total: matching.length,
          verified: matching.filter(
            record => roleOf(record.status) === "verified"
          ).length,
          pending: matching.filter(
            record => roleOf(record.status) === "pending"
          ).length,
        };
      }),
    [programRecords, availableWeekNumbers]
  );

  const maxChart = Math.max(1, ...chart.map(item => item.verified));

  const activeWeeks = chart.filter(
    item => item.inProgram && item.total > 0
  ).length;

  const verifiedWeeks = chart.filter(
    item => item.inProgram && item.verified > 0
  ).length;

  const totalAvailableWeeks = availableWeeks.length;

  // ===================================================
  // LOADING DAN ERROR
  // Style tetap dimuat agar kedua layar mengikuti tema.
  // ===================================================

  if (loading) {
    return (
      <main className="am-root am-loading" aria-busy="true">
        <style>{css}</style>

        <div className="am-state-card" role="status">
          <div className="am-loading-mark" aria-hidden="true">
            OJT
          </div>
          <h2>OJT MineTrack</h2>
          <p>Memuat Monitoring Achievement...</p>
        </div>
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-root am-loading">
        <style>{css}</style>

        <div className="am-state-card">
          <h2>Monitoring Tidak Dapat Ditampilkan</h2>
          <p role="alert">
            {error || "Data peserta tidak tersedia."}
          </p>

          <button type="button" onClick={() => router.push("/")}>
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`am-root ${presentation ? "am-presentation" : ""}`}
    >
      <style>{css}</style>

      {/* HEADER */}

      <header className="am-header">
        <div className="am-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="am-account">
          <div>
            <small>
              {role === "admin"
                ? "Administrator"
                : role === "mentor"
                ? "Mentor OJT"
                : "Peserta OJT"}
            </small>
            <strong>{account.full_name || "Pengguna"}</strong>
          </div>

          <button type="button" onClick={goBack}>
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">
        {/* HERO */}

        <section className="am-hero">
          <small>EMERGENCY RESPONSE GROUP · PT BERAU COAL</small>
          <h1>Monitoring Achievement OJT</h1>
          <p>
            Evaluasi pencapaian, verifikasi, dan aktivitas berdasarkan
            Kalender Global.
          </p>

          <div className="am-person">
            <div className="am-avatar">
              {initials(participant?.full_name)}
            </div>

            <div>
              <strong>
                {participant?.full_name || "Peserta OJT"}
              </strong>
              <span>
                {participant?.department || "—"}
                {" · "}
                {program.site || "—"}
              </span>
              <small>
                {formatDate(program.start_date)}
                {" – "}
                {formatDate(program.end_date)}
              </small>
            </div>
          </div>
        </section>

        {/* NAVIGATION */}

        <nav className="am-tabs" aria-label="Menu Achievement">
          {canManage && (
            <button
              type="button"
              onClick={() => router.push(`/achievement/${programId}`)}
            >
              ✍️ Input Achievement
            </button>
          )}

          <span className="active" aria-current="page">
            📊 Monitoring Achievement
          </span>
        </nav>

        {error && (
          <div className="am-error" role="alert">
            {error}
          </div>
        )}

        {/* TOOLBAR */}

        <div className="am-toolbar">
          <div>
            <strong>Dashboard Monitoring</strong>
            <small>Kalender Global OJT 2026–2027</small>
          </div>

          <div className="am-actions">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing ? "Memperbarui..." : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="primary"
              aria-pressed={presentation}
              onClick={() => setPresentation(value => !value)}
            >
              {presentation ? "Tampilan Normal" : "▣ Mode Presentasi"}
            </button>

            <button type="button" onClick={() => window.print()}>
              🖨 Cetak
            </button>
          </div>
        </div>

        {/* MONITORING MINGGUAN */}

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Monitoring Mingguan</h2>
              <p>
                Ringkasan Achievement pada minggu global terpilih.
              </p>
            </div>

            <div className="am-week-control">
              <button
                type="button"
                aria-label="Minggu sebelumnya"
                disabled={
                  availableWeeks.findIndex(item => item.week === week) <= 0
                }
                onClick={() => {
                  const index = availableWeeks.findIndex(
                    item => item.week === week
                  );

                  if (index > 0) {
                    changeWeek(availableWeeks[index - 1].week);
                  }
                }}
              >
                ‹
              </button>

              <select
                value={week}
                onChange={event => changeWeek(event.target.value)}
                aria-label="Pilih minggu global"
              >
                {availableWeeks.map(item => (
                  <option key={item.week} value={item.week}>
                    {weekLabel(item.week)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                aria-label="Minggu berikutnya"
                disabled={
                  availableWeeks.findIndex(item => item.week === week) >=
                  availableWeeks.length - 1
                }
                onClick={() => {
                  const index = availableWeeks.findIndex(
                    item => item.week === week
                  );

                  if (
                    index >= 0 &&
                    index < availableWeeks.length - 1
                  ) {
                    changeWeek(availableWeeks[index + 1].week);
                  }
                }}
              >
                ›
              </button>
            </div>
          </div>

          <div className="am-period">
            <strong>{weekLabel(week)}</strong>
            <span>
              {formatDate(selectedPeriod?.start)}
              {" – "}
              {formatDate(selectedPeriod?.end)}
            </span>

            {selectedParticipantRange && (
              <small>
                Periode peserta:{" "}
                {formatDate(selectedParticipantRange.start)}
                {" – "}
                {formatDate(selectedParticipantRange.end)}
              </small>
            )}
          </div>

          <div className="am-stats">
            <StatCard
              label="Total Achievement"
              value={weeklyRecords.length}
              note="Minggu terpilih"
            />
            <StatCard
              label="Verified"
              value={verified.length}
              note="Sudah terverifikasi"
              tone="green"
            />
            <StatCard
              label="Pending"
              value={pending.length}
              note="Menunggu verifikasi"
              tone="orange"
            />
            <StatCard
              label="Persentase Verifikasi"
              value={percentText(verificationPercent)}
              note="Verified / Total"
              tone="blue"
            />
          </div>
        </section>

        {/* PROGRES KATEGORI */}

        <section className="am-card">
          <div className="am-section-head">
            <div>
              <h2>Progres Enam Kategori</h2>
              <p>
                Target dan realisasi Verified pada {weekLabel(week)}.
              </p>
            </div>

            <div className="am-week-progress">
              <small>Rata-rata pencapaian</small>
              <strong>
                {percentText(weeklyAchievementProgress)}
              </strong>
              <span>{completedCategories}/6 kategori tercapai</span>
            </div>
          </div>

          <div className="am-category-grid">
            {categories.map(item => (
              <article className="am-category" key={item.name}>
                <div className="am-category-head">
                  <span className="am-icon">{item.icon}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      Target {item.target} {item.unit} / minggu
                    </small>
                  </div>
                </div>

                <div className="am-category-actual">
                  <strong>{amountText(item.actual, item)}</strong>
                  <span>{percentText(item.targetPercent)}</span>
                </div>

                <ProgressBar value={item.targetPercent} />

                <div className="am-category-footer">
                  <span>{item.verified} Verified</span>
                  <span>{item.pending} Pending</span>
                </div>
              </article>
            ))}
          </div>

          <p className="am-note">
            Progres berdasarkan target mingguan. Hanya kegiatan
            terverifikasi yang dihitung. Persentase maksimal 100%,
            sedangkan realisasi asli tetap ditampilkan.
          </p>
        </section>

        {/* DUA PANEL SEIMBANG */}

        <div className="am-two-columns">
          {/* GRAFIK */}

          <section className="am-card am-chart-panel">
            <div className="am-section-head">
              <div>
                <h2>Grafik Achievement Mingguan</h2>
                <p>
                  Jumlah kegiatan Verified pada Kalender Global
                  Week 01–25.
                </p>
              </div>
            </div>

            <div
              className="am-chart-scroll"
              tabIndex={0}
              role="region"
              aria-label="Grafik Achievement 25 minggu, dapat digeser horizontal"
            >
              <div className="am-chart">
                {chart.map(item => {
                  const selected = item.week === week;

                  const height = item.verified
                    ? Math.max(6, (item.verified / maxChart) * 100)
                    : 2;

                  return (
                    <button
                      type="button"
                      key={item.week}
                      disabled={!item.inProgram}
                      aria-pressed={selected}
                      className={[
                        "am-chart-column",
                        selected ? "selected" : "",
                        !item.inProgram ? "outside" : "",
                      ].join(" ")}
                      onClick={() => changeWeek(item.week)}
                      title={
                        `${weekLabel(item.week)}: ` +
                        `${item.verified} Verified · ` +
                        `${formatDate(item.start)} – ` +
                        `${formatDate(item.end)}`
                      }
                    >
                      <strong>
                        {item.inProgram ? item.verified : "–"}
                      </strong>

                      <span className="am-bar-track">
                        <i style={{ height: `${height}%` }} />
                      </span>

                      <small>
                        W{String(item.week).padStart(2, "0")}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="am-note">
              Pilih batang untuk melihat pencapaian pada minggu tersebut.
              Tinggi batang menunjukkan jumlah kegiatan Verified,
              bukan total kilometer.
            </p>
          </section>

          {/* AKTIVITAS 25 MINGGU */}

          <section className="am-card am-activity-panel">
            <div className="am-section-head">
              <div>
                <h2>Aktivitas 25 Minggu</h2>
                <p>
                  Sebaran minggu yang memiliki catatan Achievement.
                </p>
              </div>

              <strong className="am-highlight">
                {activeWeeks}/{totalAvailableWeeks}
              </strong>
            </div>

            <div className="am-activity-stats">
              <div>
                <strong>{activeWeeks}</strong>
                <span>Minggu memiliki kegiatan</span>
              </div>
              <div>
                <strong>{verifiedWeeks}</strong>
                <span>Minggu memiliki Verified</span>
              </div>
            </div>

            <div className="am-week-grid">
              {chart.map(item => {
                const active = item.total > 0;
                const selected = item.week === week;

                return (
                  <button
                    type="button"
                    key={item.week}
                    disabled={!item.inProgram}
                    aria-pressed={selected}
                    className={[
                      "am-week",
                      active ? "has-data" : "",
                      selected ? "selected" : "",
                      !item.inProgram ? "outside" : "",
                    ].join(" ")}
                    onClick={() => changeWeek(item.week)}
                    title={
                      `${weekLabel(item.week)} · ` +
                      `${formatDate(item.start)} – ` +
                      `${formatDate(item.end)} · ` +
                      (item.inProgram
                        ? `${item.total} kegiatan`
                        : "Di luar periode peserta")
                    }
                  >
                    W{String(item.week).padStart(2, "0")}
                  </button>
                );
              })}
            </div>

            <div className="am-legend">
              <span>
                <i className="am-dot active" />
                Ada kegiatan
              </span>
              <span>
                <i className="am-dot inactive" />
                Belum ada
              </span>
              <span>
                <i className="am-dot outside" />
                Di luar periode
              </span>
            </div>

            {outsideProgram > 0 && (
              <p className="am-note">
                {outsideProgram} catatan berada di luar Kalender Global
                atau periode peserta. Data tetap tersimpan, tetapi tidak
                dihitung dalam monitoring ini.
              </p>
            )}
          </section>
        </div>

        {/* BOTTOM ACTION */}

        <div className="am-bottom">
          <button type="button" onClick={goBack}>
            ← {isParticipant ? "Dashboard Peserta" : "Detail Peserta"}
          </button>

          {canManage && (
            <button
              type="button"
              className="primary"
              onClick={() => router.push(`/achievement/${programId}`)}
            >
              ✍️ Input Achievement
            </button>
          )}
        </div>

        <footer className="am-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS — GLOBAL LIGHT / DARK MODE
// Variabel dibatasi pada halaman Monitoring Achievement.
// Perubahan html[data-theme] langsung diterapkan oleh CSS.
// =====================================================

const css = `
  /* LIGHT MODE — DEFAULT */

  .am-root {
    color-scheme: light;

    --am-bg: #f3f7f8;
    --am-surface: #ffffff;
    --am-surface-soft: #f6f9f7;
    --am-surface-category: #fcfefd;
    --am-control-bg: #f8fbf9;
    --am-text: #17352d;
    --am-text-strong: #153c2f;
    --am-muted: #587166;
    --am-secondary: #496c5b;
    --am-border: #dce8e1;
    --am-border-soft: #e3ece6;
    --am-shadow: 0 4px 16px #153d2b09;

    --am-accent: #087e59;
    --am-accent-strong: #087453;
    --am-primary: #078b61;
    --am-primary-hover: #066f4e;
    --am-primary-text: #ffffff;
    --am-tint: #edf8f1;
    --am-icon-bg: #e4f5eb;

    --am-stat-green: #e7f7ee;
    --am-stat-orange: #fff5e6;
    --am-stat-blue: #eaf4ff;

    --am-progress-track: #e4ece7;
    --am-progress-start: #28bf8c;
    --am-progress-end: #07885f;

    --am-chart-bar: #40c59a;
    --am-chart-selected: #268bd6;
    --am-chart-selected-text: #1769a7;
    --am-chart-outside: #dce5e0;

    --am-week-bg: #f3f7f5;
    --am-week-data-bg: #ccefe0;
    --am-week-data-border: #b7e6d0;
    --am-week-data-text: #087453;
    --am-week-selected: #087b59;
    --am-week-outside-bg: #f6f7f7;
    --am-week-outside-border: #e3e8e5;
    --am-week-outside-text: #7c8e85;

    --am-error-bg: #fff1f1;
    --am-error-border: #fecaca;
    --am-error-text: #b91c1c;
    --am-focus: #237fd0;

    --am-header-bg: #071e25;
    --am-header-text: #ffffff;
    --am-header-muted: #bdd5cc;
    --am-header-button-bg: #ffffff15;
    --am-header-button-border: #ffffff38;
    --am-brand-accent: #2dcd97;

    --am-hero-start: rgba(6,29,35,.96);
    --am-hero-end: rgba(7,80,62,.82);
    --am-hero-text: #ffffff;
    --am-hero-muted: #dcece4;
    --am-hero-label: #edca79;
    --am-person-bg: #092b2cc4;
    --am-person-border: #ffffff2a;
    --am-person-muted: #c8e0d7;
    --am-avatar-bg: #d8f3e7;
    --am-avatar-text: #087453;
  }

  /* DARK MODE — ROOTLAYOUT */

  html[data-theme="dark"] .am-root {
    color-scheme: dark;

    --am-bg: #0b141b;
    --am-surface: #13212b;
    --am-surface-soft: #192a34;
    --am-surface-category: #152630;
    --am-control-bg: #192d37;
    --am-text: #e3eee9;
    --am-text-strong: #f0f7f3;
    --am-muted: #a8bfb4;
    --am-secondary: #b4cdbf;
    --am-border: #30463f;
    --am-border-soft: #293e38;
    --am-shadow: 0 4px 18px rgba(0,0,0,.18);

    --am-accent: #5bdeb0;
    --am-accent-strong: #81e8c3;
    --am-primary: #087b59;
    --am-primary-hover: #096b50;
    --am-primary-text: #ffffff;
    --am-tint: #17382d;
    --am-icon-bg: #204536;

    --am-stat-green: #173d2f;
    --am-stat-orange: #3c3021;
    --am-stat-blue: #19354d;

    --am-progress-track: #2b4239;
    --am-progress-start: #54dfad;
    --am-progress-end: #17a779;

    --am-chart-bar: #46cfa1;
    --am-chart-selected: #67b8fa;
    --am-chart-selected-text: #8ccaff;
    --am-chart-outside: #45594f;

    --am-week-bg: #1a2b34;
    --am-week-data-bg: #214c3b;
    --am-week-data-border: #347259;
    --am-week-data-text: #91edc8;
    --am-week-selected: #087b59;
    --am-week-outside-bg: #172129;
    --am-week-outside-border: #2b383e;
    --am-week-outside-text: #899c93;

    --am-error-bg: #3c2028;
    --am-error-border: #82404c;
    --am-error-text: #ffc2c7;
    --am-focus: #82caff;

    --am-header-bg: #071219;
    --am-header-text: #edf7f1;
    --am-header-muted: #b4cec0;
    --am-header-button-bg: #ffffff0d;
    --am-header-button-border: #ffffff30;
    --am-brand-accent: #5bdeb0;

    --am-hero-start: rgba(4,17,24,.97);
    --am-hero-end: rgba(7,57,45,.91);
    --am-hero-text: #f0f8f3;
    --am-hero-muted: #d0e5d9;
    --am-hero-label: #f0d28a;
    --am-person-bg: #071e25cc;
    --am-person-border: #7cbba53b;
    --am-person-muted: #bddbcc;
    --am-avatar-bg: #204b3b;
    --am-avatar-text: #94efca;
  }

  /* BASE */

  .am-root,
  .am-root * {
    box-sizing: border-box;
  }

  .am-root {
    min-height: 100vh;
    background: var(--am-bg);
    color: var(--am-text);
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }

  .am-root button,
  .am-root select {
    font-family: inherit;
  }

  .am-root button {
    cursor: pointer;
    touch-action: manipulation;
  }

  .am-root button:disabled {
    cursor: not-allowed;
  }

  .am-root button:focus-visible,
  .am-root select:focus-visible,
  .am-chart-scroll:focus-visible {
    outline: 3px solid var(--am-focus);
    outline-offset: 3px;
  }

  .am-root select option {
    background: var(--am-surface);
    color: var(--am-text);
  }

  /* LOADING / ERROR SCREEN */

  .am-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    text-align: center;
  }

  .am-state-card {
    width: 100%;
    max-width: 480px;
    padding: 28px;
    border: 1px solid var(--am-border);
    border-radius: 16px;
    background: var(--am-surface);
    box-shadow: var(--am-shadow);
  }

  .am-state-card h2 {
    margin: 0 0 10px;
    color: var(--am-text-strong);
    font-size: 22px;
    line-height: 1.4;
  }

  .am-state-card p {
    margin: 0;
    color: var(--am-muted);
    font-size: 13px;
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .am-loading-mark {
    display: grid;
    place-items: center;
    width: 58px;
    height: 58px;
    margin: 0 auto 18px;
    border-radius: 15px;
    background: var(--am-tint);
    color: var(--am-accent);
    font-size: 16px;
    font-weight: 900;
  }

  .am-loading button {
    margin-top: 18px;
    padding: 12px 16px;
    border: 1px solid var(--am-primary);
    border-radius: 9px;
    background: var(--am-primary);
    color: var(--am-primary-text);
    font-weight: 800;
  }

  /* HEADER */

  .am-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 15px 24px;
    color: var(--am-header-text);
    background: var(--am-header-bg);
  }

  .am-brand {
    font-size: 22px;
    font-weight: 900;
    white-space: nowrap;
  }

  .am-brand span {
    color: var(--am-brand-accent);
  }

  .am-brand small {
    margin-left: 6px;
    font-size: 10px;
    color: var(--am-header-muted);
  }

  .am-account {
    display: flex;
    align-items: center;
    gap: 15px;
    min-width: 0;
  }

  .am-account > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .am-account small,
  .am-account strong {
    display: block;
    text-align: right;
  }

  .am-account small {
    margin-bottom: 5px;
    font-size: 10px;
    color: var(--am-header-muted);
  }

  .am-account strong {
    color: var(--am-header-text);
    font-size: 12px;
  }

  .am-account button {
    flex-shrink: 0;
    border: 1px solid var(--am-header-button-border);
    background: var(--am-header-button-bg);
    color: var(--am-header-text);
    border-radius: 9px;
    padding: 10px 13px;
    font-size: 12px;
    font-weight: 800;
  }

  /* CONTAINER */

  .am-container {
    width: 100%;
    max-width: 1500px;
    padding: 20px;
    margin: 0 auto;
  }

  /* HERO */

  .am-hero {
    border-radius: 15px;
    padding: 24px;
    color: var(--am-hero-text);
    background:
      linear-gradient(
        100deg,
        var(--am-hero-start),
        var(--am-hero-end)
      ),
      url("/background-erg.png.PNG");
    background-position: center;
    background-size: cover;
  }

  .am-hero > small {
    color: var(--am-hero-label);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .am-hero h1 {
    color: var(--am-hero-text);
    font-size: clamp(24px, 3vw, 35px);
    margin: 10px 0 7px;
    line-height: 1.25;
  }

  .am-hero > p {
    margin: 0;
    color: var(--am-hero-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .am-person {
    display: flex;
    align-items: center;
    gap: 11px;
    width: fit-content;
    max-width: 100%;
    margin-top: 17px;
    padding: 11px;
    background: var(--am-person-bg);
    border: 1px solid var(--am-person-border);
    border-radius: 11px;
  }

  .am-person > div:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .am-avatar {
    display: grid;
    place-items: center;
    width: 43px;
    height: 43px;
    flex-shrink: 0;
    color: var(--am-avatar-text);
    background: var(--am-avatar-bg);
    border-radius: 10px;
    font-weight: 900;
  }

  .am-person strong,
  .am-person span,
  .am-person small {
    display: block;
  }

  .am-person strong {
    color: var(--am-hero-text);
    font-size: 13px;
  }

  .am-person span,
  .am-person small {
    font-size: 10px;
    color: var(--am-person-muted);
    margin-top: 5px;
  }

  /* TABS */

  .am-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 14px 0;
  }

  .am-tabs button,
  .am-tabs span {
    padding: 11px 16px;
    border: 1px solid var(--am-border);
    background: var(--am-surface);
    color: var(--am-accent-strong);
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
  }

  .am-tabs .active {
    background: var(--am-primary);
    border-color: var(--am-primary);
    color: var(--am-primary-text);
  }

  .am-error {
    padding: 13px;
    margin-bottom: 13px;
    border: 1px solid var(--am-error-border);
    background: var(--am-error-bg);
    color: var(--am-error-text);
    border-radius: 10px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  /* TOOLBAR */

  .am-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 13px;
  }

  .am-toolbar > div > strong {
    display: block;
    font-size: 14px;
    color: var(--am-text-strong);
  }

  .am-toolbar > div > small {
    display: block;
    color: var(--am-muted);
    font-size: 10px;
    margin-top: 5px;
  }

  .am-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .am-actions button,
  .am-bottom button {
    padding: 10px 13px;
    border: 1px solid var(--am-border);
    border-radius: 9px;
    background: var(--am-surface);
    color: var(--am-accent-strong);
    font-size: 11px;
    font-weight: 800;
  }

  .am-actions button.primary,
  .am-bottom button.primary {
    background: var(--am-primary);
    color: var(--am-primary-text);
    border-color: var(--am-primary);
  }

  .am-actions button:disabled {
    opacity: .5;
  }

  /* CARDS */

  .am-card {
    min-width: 0;
    padding: 18px;
    margin-bottom: 14px;
    border: 1px solid var(--am-border);
    border-radius: 14px;
    background: var(--am-surface);
    box-shadow: var(--am-shadow);
  }

  .am-section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .am-section-head > div {
    min-width: 0;
  }

  .am-section-head h2 {
    margin: 0;
    color: var(--am-text-strong);
    font-size: 17px;
    line-height: 1.4;
  }

  .am-section-head p {
    margin: 5px 0 0;
    font-size: 11px;
    color: var(--am-muted);
    line-height: 1.6;
  }

  .am-week-control {
    display: flex;
    gap: 5px;
  }

  .am-week-control button,
  .am-week-control select {
    padding: 9px;
    border-radius: 8px;
    border: 1px solid var(--am-border);
    color: var(--am-accent-strong);
    background: var(--am-control-bg);
    font-size: 12px;
    font-weight: 800;
  }

  .am-week-control button {
    min-width: 34px;
  }

  .am-week-control button:disabled {
    opacity: .4;
  }

  /* PERIOD */

  .am-period {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 11px 13px;
    margin-bottom: 13px;
    background: var(--am-tint);
    border-radius: 9px;
    font-size: 11px;
  }

  .am-period strong {
    color: var(--am-accent);
  }

  .am-period span {
    color: var(--am-secondary);
  }

  .am-period small {
    color: var(--am-muted);
    margin-left: auto;
    font-size: 10px;
  }

  /* STATS */

  .am-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .am-stat {
    min-width: 0;
    padding: 14px;
    background: var(--am-surface-soft);
    border: 1px solid var(--am-border-soft);
    border-radius: 10px;
  }

  .am-stat.green {
    background: var(--am-stat-green);
  }

  .am-stat.orange {
    background: var(--am-stat-orange);
  }

  .am-stat.blue {
    background: var(--am-stat-blue);
  }

  .am-stat span,
  .am-stat small {
    display: block;
    font-size: 10px;
    color: var(--am-muted);
    overflow-wrap: anywhere;
  }

  .am-stat strong {
    display: block;
    font-size: 27px;
    color: var(--am-text-strong);
    margin: 7px 0;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  /* CATEGORY */

  .am-week-progress {
    text-align: right;
  }

  .am-week-progress small,
  .am-week-progress span {
    display: block;
    color: var(--am-muted);
    font-size: 10px;
  }

  .am-week-progress strong {
    display: block;
    font-size: 23px;
    margin: 5px 0;
    color: var(--am-accent);
    line-height: 1.25;
  }

  .am-category-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 11px;
  }

  .am-category {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--am-border-soft);
    border-radius: 11px;
    background: var(--am-surface-category);
  }

  .am-category-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .am-category-head > div {
    min-width: 0;
  }

  .am-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    background: var(--am-icon-bg);
    border-radius: 9px;
    font-size: 19px;
  }

  .am-category-head strong,
  .am-category-head small {
    display: block;
  }

  .am-category-head strong {
    color: var(--am-text-strong);
    font-size: 13px;
  }

  .am-category-head small {
    color: var(--am-muted);
    font-size: 10px;
    margin-top: 5px;
  }

  .am-category-actual {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 9px;
    margin: 13px 0 9px;
  }

  .am-category-actual strong {
    color: var(--am-accent);
    font-size: 18px;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .am-category-actual span {
    font-size: 11px;
    color: var(--am-secondary);
    white-space: nowrap;
  }

  .am-progress {
    width: 100%;
    height: 9px;
    border-radius: 20px;
    background: var(--am-progress-track);
    overflow: hidden;
  }

  .am-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      var(--am-progress-start),
      var(--am-progress-end)
    );
  }

  .am-category-footer {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 11px;
    color: var(--am-muted);
    font-size: 10px;
  }

  /* EQUAL WIDTH PANELS */

  .am-two-columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: stretch;
    gap: 14px;
    margin-bottom: 14px;
  }

  .am-two-columns > .am-card {
    min-width: 0;
    height: 100%;
    margin-bottom: 0;
  }

  /* CHART */

  .am-chart-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 7px;
    scrollbar-width: thin;
    scrollbar-color: var(--am-border) var(--am-surface);
  }

  .am-chart {
    display: flex;
    align-items: stretch;
    width: max-content;
    gap: 5px;
    height: 183px;
    border-bottom: 1px solid var(--am-border);
  }

  .am-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    width: 25px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--am-muted);
    gap: 6px;
  }

  .am-chart-column strong,
  .am-chart-column small {
    font-size: 9px;
    font-weight: 700;
  }

  .am-bar-track {
    display: flex;
    align-items: flex-end;
    width: 16px;
    height: 125px;
    flex-shrink: 0;
  }

  .am-bar-track i {
    display: block;
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: var(--am-chart-bar);
  }

  .am-chart-column.selected .am-bar-track i {
    background: var(--am-chart-selected);
  }

  .am-chart-column.selected {
    color: var(--am-chart-selected-text);
    font-weight: 900;
  }

  .am-chart-column.outside {
    opacity: .4;
  }

  .am-chart-column.outside .am-bar-track i {
    background: var(--am-chart-outside);
  }

  /* ACTIVITY PANEL */

  .am-activity-panel {
    display: flex;
    flex-direction: column;
  }

  .am-highlight {
    color: var(--am-accent);
    font-size: 22px;
    font-weight: 900;
  }

  .am-activity-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }

  .am-activity-stats > div {
    min-width: 0;
    padding: 11px 12px;
    border-radius: 9px;
    background: var(--am-tint);
  }

  .am-activity-stats strong {
    display: block;
    font-size: 21px;
    color: var(--am-accent);
    line-height: 1.1;
  }

  .am-activity-stats span {
    display: block;
    font-size: 9px;
    line-height: 1.5;
    margin-top: 5px;
    color: var(--am-secondary);
  }

  .am-week-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 5px;
  }

  .am-week {
    min-width: 0;
    min-height: 29px;
    padding: 7px 2px;
    border: 1px solid var(--am-border);
    border-radius: 6px;
    background: var(--am-week-bg);
    color: var(--am-muted);
    font-size: 9px;
    font-weight: 800;
    text-align: center;
    white-space: nowrap;
  }

  .am-week.has-data {
    color: var(--am-week-data-text);
    background: var(--am-week-data-bg);
    border-color: var(--am-week-data-border);
  }

  .am-week.selected {
    background: var(--am-week-selected);
    color: #ffffff;
    border-color: var(--am-week-selected);
    box-shadow: 0 0 0 1px var(--am-week-selected);
  }

  .am-week.outside {
    background: var(--am-week-outside-bg);
    border-color: var(--am-week-outside-border);
    color: var(--am-week-outside-text);
    opacity: .65;
    cursor: not-allowed;
    box-shadow: none;
  }

  .am-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 11px;
    color: var(--am-muted);
    font-size: 9px;
  }

  .am-legend span {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .am-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 3px;
    display: inline-block;
  }

  .am-dot.active {
    background: var(--am-chart-bar);
  }

  .am-dot.inactive {
    background: var(--am-progress-track);
    border: 1px solid var(--am-border);
  }

  .am-dot.outside {
    background: var(--am-week-outside-bg);
    border: 1px solid var(--am-week-outside-text);
  }

  /* COMMON NOTE */

  .am-note {
    margin: 11px 0 0;
    color: var(--am-muted);
    font-size: 10px;
    line-height: 1.65;
  }

  /* BOTTOM */

  .am-bottom {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin: 4px 0 15px;
  }

  .am-footer {
    padding: 14px 0 22px;
    text-align: center;
    color: var(--am-muted);
    font-size: 10px;
  }

  /* HOVER */

  @media (hover: hover) {
    .am-actions button:not(.primary):not(:disabled):hover,
    .am-bottom button:not(.primary):hover,
    .am-tabs button:hover,
    .am-week-control button:not(:disabled):hover {
      background: var(--am-tint);
      border-color: var(--am-accent);
    }

    .am-actions button.primary:hover,
    .am-bottom button.primary:hover,
    .am-loading button:hover {
      background: var(--am-primary-hover);
      border-color: var(--am-primary-hover);
    }

    .am-account button:hover {
      background: #ffffff24;
    }

    .am-week:not(:disabled):hover {
      border-color: var(--am-accent);
    }

    .am-chart-column:not(:disabled):hover .am-bar-track i {
      background: var(--am-chart-selected);
    }
  }

  /* PRESENTATION MODE */

  .am-presentation .am-header,
  .am-presentation .am-tabs {
    display: none;
  }

  .am-presentation .am-container {
    max-width: 1900px;
  }

  /* RESPONSIVE */

  @media (max-width: 1100px) {
    .am-category-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 850px) {
    .am-two-columns {
      grid-template-columns: 1fr;
    }

    .am-two-columns > .am-card {
      height: auto;
    }
  }

  @media (max-width: 650px) {
    .am-header {
      padding: 12px;
    }

    .am-brand {
      font-size: 18px;
    }

    .am-account {
      gap: 7px;
    }

    .am-account > div {
      max-width: 120px;
      overflow-wrap: anywhere;
    }

    .am-account button {
      padding: 9px;
      font-size: 10px;
    }

    .am-container {
      padding: 11px;
    }

    .am-hero {
      padding: 18px;
    }

    .am-hero h1 {
      font-size: 24px;
    }

    .am-tabs button,
    .am-tabs span {
      padding: 10px 12px;
      font-size: 11px;
    }

    .am-card {
      padding: 14px;
    }

    .am-section-head h2 {
      font-size: 15px;
    }

    .am-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 7px;
    }

    .am-stat {
      padding: 11px;
    }

    .am-stat strong {
      font-size: 23px;
    }

    .am-category-grid {
      grid-template-columns: 1fr;
    }

    .am-week-progress {
      text-align: left;
    }

    .am-period small {
      width: 100%;
      margin-left: 0;
    }

    .am-week {
      font-size: 9px;
    }

    .am-activity-stats {
      gap: 6px;
    }

    .am-bottom {
      flex-wrap: wrap;
    }

    .am-bottom button {
      flex: 1;
      white-space: nowrap;
    }
  }

  @media (max-width: 390px) {
    .am-header {
      flex-wrap: wrap;
    }

    .am-account {
      width: 100%;
      justify-content: space-between;
    }

    .am-account > div {
      max-width: calc(100% - 90px);
    }

    .am-account small,
    .am-account strong {
      text-align: left;
    }

    .am-week {
      padding: 7px 1px;
      font-size: 8px;
    }

    .am-legend {
      gap: 7px;
      font-size: 8px;
    }

    .am-state-card {
      padding: 20px;
    }
  }

  /* PRINT — SELALU MENGGUNAKAN PALET TERANG */

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    .am-root,
    html[data-theme="dark"] .am-root {
      color-scheme: light;

      --am-bg: #ffffff;
      --am-surface: #ffffff;
      --am-surface-soft: #f6f9f7;
      --am-surface-category: #fcfefd;
      --am-control-bg: #f8fbf9;
      --am-text: #17352d;
      --am-text-strong: #153c2f;
      --am-muted: #587166;
      --am-secondary: #496c5b;
      --am-border: #dce8e1;
      --am-border-soft: #e3ece6;
      --am-shadow: none;

      --am-accent: #087e59;
      --am-accent-strong: #087453;
      --am-primary: #078b61;
      --am-primary-text: #ffffff;
      --am-tint: #edf8f1;
      --am-icon-bg: #e4f5eb;

      --am-stat-green: #e7f7ee;
      --am-stat-orange: #fff5e6;
      --am-stat-blue: #eaf4ff;

      --am-progress-track: #e4ece7;
      --am-progress-start: #28bf8c;
      --am-progress-end: #07885f;

      --am-chart-bar: #40c59a;
      --am-chart-selected: #268bd6;
      --am-chart-selected-text: #1769a7;
      --am-chart-outside: #dce5e0;

      --am-week-bg: #f3f7f5;
      --am-week-data-bg: #ccefe0;
      --am-week-data-border: #b7e6d0;
      --am-week-data-text: #087453;
      --am-week-selected: #087b59;
      --am-week-outside-bg: #f6f7f7;
      --am-week-outside-border: #e3e8e5;
      --am-week-outside-text: #7c8e85;

      --am-error-bg: #fff1f1;
      --am-error-border: #fecaca;
      --am-error-text: #b91c1c;

      --am-hero-start: rgba(6,29,35,.96);
      --am-hero-end: rgba(7,80,62,.82);
      --am-hero-text: #ffffff;
      --am-hero-muted: #dcece4;
      --am-hero-label: #edca79;
      --am-person-bg: #092b2cc4;
      --am-person-border: #ffffff2a;
      --am-person-muted: #c8e0d7;
      --am-avatar-bg: #d8f3e7;
      --am-avatar-text: #087453;

      background: #ffffff;
      color: #17352d;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .am-header,
    .am-tabs,
    .am-toolbar,
    .am-week-control,
    .am-bottom {
      display: none !important;
    }

    .am-container,
    .am-presentation .am-container {
      max-width: none;
      padding: 0;
    }

    .am-card {
      box-shadow: none;
      break-inside: avoid;
    }

    .am-hero {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .am-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .am-category-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .am-two-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .am-chart-scroll {
      overflow: visible;
    }

    .am-chart {
      width: 100%;
      gap: 2px;
    }

    .am-chart-column {
      flex: 1 1 0;
      min-width: 0;
      width: auto;
    }

    .am-chart-column strong,
    .am-chart-column small {
      font-size: 7px;
    }

    .am-bar-track {
      width: 70%;
      max-width: 16px;
    }
  }
`;
