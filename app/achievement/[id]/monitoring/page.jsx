
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT - COMPACT ENTERPRISE
// GLOBAL CALENDAR WEEK 01-25
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
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
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

  const startProgram = String(program.start_date)
    .slice(0, 10);

  const endProgram = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startProgram
      ? global.start
      : startProgram;

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

    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const previous = available.filter(
    item => item.end < today
  );

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
    ["training", "internaltraining", "pelatihan"]
      .includes(key)
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (["coaching", "pembinaan"].includes(key)) {
    return "Coaching";
  }

  if (
    ["orientasi", "orientasiarea", "areaorientation"]
      .includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"]
      .includes(key)
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

  const canManage =
    role === "admin" || role === "mentor";

  const isParticipant =
    role === "participant" || role === "peserta";

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

  const selectedParticipantRange = programWeekRange(
    program,
    week
  );

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
      !["admin", "mentor", "participant", "peserta"]
        .includes(currentRole)
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

    return {
      user,
      profile,
      programData,
    };
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

        const data = await fetchMonitoringData(
          access.programData.id
        );

        if (!active) return;

        setAccount(access.profile);
        setProgram(access.programData);
        setTypes(data.types);
        setRecords(data.records);

        setWeek(initialWeek(access.programData));
      } catch (err) {
        if (!active) return;

        setError(
          err?.message ||
          "Gagal memuat Monitoring Achievement."
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

      const data = await fetchMonitoringData(
        access.programData.id
      );

      setProgram(access.programData);
      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
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

  const programRecords = useMemo(() => {
    return records.filter(
      item => insideProgram(item.activity_date, program)
    );
  }, [records, program]);

  const outsideProgram = useMemo(() => {
    return records.length - programRecords.length;
  }, [records, programRecords]);

  // ===================================================
  // MINGGU TERPILIH
  // ===================================================

  const weeklyRecords = useMemo(() => {
    return programRecords.filter(
      item => globalWeekOf(item.activity_date) === week
    );
  }, [programRecords, week]);

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

  const categories = useMemo(() => {
    return TARGETS.map(category => {
      const related = weeklyRecords.filter(
        item =>
          categoryFor(item, types)?.name === category.name
      );

      const valid = related.filter(
        item => roleOf(item.status) === "verified"
      );

      const waiting = related.filter(
        item => roleOf(item.status) === "pending"
      );

      const actual = achievedValue(valid, category);

      const targetPercent = clamp(
        (actual / category.target) * 100
      );

      return {
        ...category,
        actual,
        total: related.length,
        verified: valid.length,
        pending: waiting.length,
        targetPercent,
        completed: actual >= category.target,
      };
    });
  }, [weeklyRecords, types]);

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

  const chart = useMemo(() => {
    return GLOBAL_WEEKS.map(item => {
      const matching = programRecords.filter(
        record =>
          globalWeekOf(record.activity_date) === item.week
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
    });
  }, [programRecords, availableWeekNumbers]);

  const maxChart = Math.max(
    1,
    ...chart.map(item => item.verified)
  );

  const activeWeeks = chart.filter(
    item => item.inProgram && item.total > 0
  ).length;

  const verifiedWeeks = chart.filter(
    item => item.inProgram && item.verified > 0
  ).length;

  const totalAvailableWeeks = availableWeeks.length;

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <main className="am-loading">
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Achievement...</p>
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-loading">
        <h2>Monitoring Tidak Dapat Ditampilkan</h2>

        <p>
          {error || "Data peserta tidak tersedia."}
        </p>

        <button onClick={() => router.push("/")}>
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  return (
    <main
      className={`am-root ${
        presentation ? "am-presentation" : ""
      }`}
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

            <strong>
              {account.full_name || "Pengguna"}
            </strong>
          </div>

          <button type="button" onClick={goBack}>
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">

        {/* HERO */}

        <section className="am-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Monitoring Achievement OJT</h1>

          <p>
            Evaluasi pencapaian, verifikasi, dan
            aktivitas berdasarkan Kalender Global.
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

        <nav className="am-tabs">
          {canManage && (
            <button
              type="button"
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
            >
              ✍️ Input Achievement
            </button>
          )}

          <span className="active">
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

            <small>
              Kalender Global OJT 2026–2027
            </small>
          </div>

          <div className="am-actions">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="primary"
              onClick={() =>
                setPresentation(value => !value)
              }
            >
              {presentation
                ? "Tampilan Normal"
                : "▣ Mode Presentasi"}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
            >
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
                Ringkasan Achievement pada minggu
                global terpilih.
              </p>
            </div>

            <div className="am-week-control">
              <button
                type="button"
                disabled={
                  availableWeeks.findIndex(
                    item => item.week === week
                  ) <= 0
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
                onChange={event =>
                  changeWeek(event.target.value)
                }
                aria-label="Pilih minggu global"
              >
                {availableWeeks.map(item => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    {weekLabel(item.week)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  availableWeeks.findIndex(
                    item => item.week === week
                  ) >= availableWeeks.length - 1
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
                Periode peserta:
                {" "}
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
                Target dan realisasi Verified pada
                {" "}
                {weekLabel(week)}.
              </p>
            </div>

            <div className="am-week-progress">
              <small>Rata-rata pencapaian</small>

              <strong>
                {percentText(weeklyAchievementProgress)}
              </strong>

              <span>
                {completedCategories}/6 kategori tercapai
              </span>
            </div>
          </div>

          <div className="am-category-grid">
            {categories.map(item => (
              <article
                className="am-category"
                key={item.name}
              >
                <div className="am-category-head">
                  <span className="am-icon">
                    {item.icon}
                  </span>

                  <div>
                    <strong>{item.name}</strong>

                    <small>
                      Target {item.target} {item.unit}
                      {" / minggu"}
                    </small>
                  </div>
                </div>

                <div className="am-category-actual">
                  <strong>
                    {amountText(item.actual, item)}
                  </strong>

                  <span>
                    {percentText(item.targetPercent)}
                  </span>
                </div>

                <ProgressBar
                  value={item.targetPercent}
                />

                <div className="am-category-footer">
                  <span>
                    {item.verified} Verified
                  </span>

                  <span>
                    {item.pending} Pending
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="am-note">
            Progres berdasarkan target mingguan.
            Hanya kegiatan terverifikasi yang
            dihitung. Persentase maksimal 100%,
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
                  Jumlah kegiatan Verified
                  pada Kalender Global Week 01–25.
                </p>
              </div>
            </div>

            <div className="am-chart-scroll">
              <div className="am-chart">
                {chart.map(item => {
                  const selected =
                    item.week === week;

                  const height = item.verified
                    ? Math.max(
                        6,
                        (item.verified / maxChart) * 100
                      )
                    : 2;

                  return (
                    <button
                      type="button"
                      key={item.week}
                      disabled={!item.inProgram}
                      className={[
                        "am-chart-column",
                        selected ? "selected" : "",
                        !item.inProgram
                          ? "outside"
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        changeWeek(item.week)
                      }
                      title={
                        `${weekLabel(item.week)}: ` +
                        `${item.verified} Verified · ` +
                        `${formatDate(item.start)} – ` +
                        `${formatDate(item.end)}`
                      }
                    >
                      <strong>
                        {item.inProgram
                          ? item.verified
                          : "–"}
                      </strong>

                      <span className="am-bar-track">
                        <i
                          style={{
                            height: `${height}%`,
                          }}
                        />
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
              Pilih batang untuk melihat pencapaian
              pada minggu tersebut. Tinggi batang
              menunjukkan jumlah kegiatan Verified,
              bukan total kilometer.
            </p>
          </section>

          {/* AKTIVITAS 25 MINGGU - COMPACT */}

          <section className="am-card am-activity-panel">
            <div className="am-section-head">
              <div>
                <h2>Aktivitas 25 Minggu</h2>

                <p>
                  Sebaran minggu yang memiliki
                  catatan Achievement.
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
                    className={[
                      "am-week",
                      active ? "has-data" : "",
                      selected ? "selected" : "",
                      !item.inProgram
                        ? "outside"
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      changeWeek(item.week)
                    }
                    title={
                      `${weekLabel(item.week)} · ` +
                      `${formatDate(item.start)} – ` +
                      `${formatDate(item.end)} · ` +
                      (
                        item.inProgram
                          ? `${item.total} kegiatan`
                          : "Di luar periode peserta"
                      )
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
                {outsideProgram} catatan berada di luar
                Kalender Global atau periode peserta.
                Data tetap tersimpan, tetapi tidak
                dihitung dalam monitoring ini.
              </p>
            )}
          </section>
        </div>

        {/* BOTTOM ACTION */}

        <div className="am-bottom">
          <button
            type="button"
            onClick={goBack}
          >
            ← {isParticipant
              ? "Dashboard Peserta"
              : "Detail Peserta"}
          </button>

          {canManage && (
            <button
              type="button"
              className="primary"
              onClick={() =>
                router.push(`/achievement/${programId}`)
              }
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
// CSS - COMPACT PROFESSIONAL DASHBOARD
// =====================================================

const css = `
  .am-root,
  .am-root * {
    box-sizing: border-box;
  }

  .am-root {
    min-height: 100vh;
    background: #f3f7f8;
    color: #17352d;
    font-family: Arial, Helvetica, sans-serif;
  }

  .am-root button,
  .am-root select {
    font-family: inherit;
  }

  .am-root button {
    cursor: pointer;
  }

  .am-root button:disabled {
    cursor: not-allowed;
  }

  .am-loading {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 30px;
    font-family: Arial, sans-serif;
    text-align: center;
    background: #f3f7f8;
    color: #17352d;
  }

  .am-loading button {
    margin-top: 10px;
    padding: 12px 16px;
    border: 0;
    background: #07865e;
    color: white;
    border-radius: 9px;
    font-weight: 800;
  }

  /* HEADER */

  .am-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 15px 24px;
    color: #fff;
    background: #071e25;
  }

  .am-brand {
    font-size: 22px;
    font-weight: 900;
    white-space: nowrap;
  }

  .am-brand span {
    color: #2dcd97;
  }

  .am-brand small {
    margin-left: 6px;
    font-size: 10px;
    color: #b8d2c7;
  }

  .am-account {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .am-account small,
  .am-account strong {
    display: block;
    text-align: right;
  }

  .am-account small {
    font-size: 10px;
    color: #bdd5cc;
    margin-bottom: 5px;
  }

  .am-account strong {
    font-size: 12px;
  }

  .am-account button {
    border: 1px solid #ffffff38;
    background: #ffffff15;
    color: #fff;
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
    color: #fff;
    background:
      linear-gradient(
        100deg,
        rgba(6,29,35,.96),
        rgba(7,80,62,.82)
      ),
      url("/background-erg.png.PNG");
    background-position: center;
    background-size: cover;
  }

  .am-hero > small {
    color: #edca79;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .am-hero h1 {
    font-size: clamp(24px, 3vw, 35px);
    margin: 10px 0 7px;
  }

  .am-hero > p {
    margin: 0;
    color: #dcece4;
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
    background: #092b2cc4;
    border: 1px solid #ffffff2a;
    border-radius: 11px;
  }

  .am-avatar {
    display: grid;
    place-items: center;
    width: 43px;
    height: 43px;
    flex-shrink: 0;
    color: #087453;
    background: #d8f3e7;
    border-radius: 10px;
    font-weight: 900;
  }

  .am-person strong,
  .am-person span,
  .am-person small {
    display: block;
  }

  .am-person strong {
    font-size: 13px;
  }

  .am-person span,
  .am-person small {
    font-size: 10px;
    color: #c8e0d7;
    margin-top: 5px;
  }

  /* TABS */

  .am-tabs {
    display: flex;
    gap: 8px;
    margin: 14px 0;
  }

  .am-tabs button,
  .am-tabs span {
    padding: 11px 16px;
    border: 1px solid #dceae3;
    background: #fff;
    color: #326b56;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-tabs .active {
    background: #078b61;
    border-color: #078b61;
    color: #fff;
  }

  .am-error {
    padding: 13px;
    margin-bottom: 13px;
    border: 1px solid #fecaca;
    background: #fff1f1;
    color: #b91c1c;
    border-radius: 10px;
    font-size: 12px;
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
  }

  .am-toolbar > div > small {
    display: block;
    color: #87978f;
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
    border: 1px solid #d9e7df;
    border-radius: 9px;
    background: white;
    color: #166347;
    font-size: 11px;
    font-weight: 800;
  }

  .am-actions button.primary,
  .am-bottom button.primary {
    background: #078b61;
    color: white;
    border-color: #078b61;
  }

  .am-actions button:disabled {
    opacity: .5;
  }

  /* CARDS */

  .am-card {
    min-width: 0;
    padding: 18px;
    margin-bottom: 14px;
    border: 1px solid #e1ebe6;
    border-radius: 14px;
    background: white;
    box-shadow: 0 4px 16px #153d2b09;
  }

  .am-section-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }

  .am-section-head h2 {
    margin: 0;
    font-size: 17px;
    line-height: 1.4;
  }

  .am-section-head p {
    margin: 5px 0 0;
    font-size: 11px;
    color: #82948a;
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
    border: 1px solid #dce8df;
    color: #146b4c;
    background: #f8fbf9;
    font-size: 12px;
    font-weight: 800;
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
    background: #edf8f1;
    border-radius: 9px;
    font-size: 11px;
  }

  .am-period strong {
    color: #087e59;
  }

  .am-period span {
    color: #58796a;
  }

  .am-period small {
    color: #738e7f;
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
    background: #f6f9f7;
    border: 1px solid #e7eee9;
    border-radius: 10px;
  }

  .am-stat.green {
    background: #e7f7ee;
  }

  .am-stat.orange {
    background: #fff5e6;
  }

  .am-stat.blue {
    background: #eaf4ff;
  }

  .am-stat span,
  .am-stat small {
    display: block;
    font-size: 10px;
    color: #6f8779;
  }

  .am-stat strong {
    display: block;
    font-size: 27px;
    color: #153c2f;
    margin: 7px 0;
  }

  /* CATEGORY */

  .am-week-progress {
    text-align: right;
  }

  .am-week-progress small,
  .am-week-progress span {
    display: block;
    color: #81958a;
    font-size: 10px;
  }

  .am-week-progress strong {
    display: block;
    font-size: 23px;
    margin: 5px 0;
    color: #07885f;
  }

  .am-category-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 11px;
  }

  .am-category {
    min-width: 0;
    padding: 14px;
    border: 1px solid #e3ece6;
    border-radius: 11px;
    background: #fcfefd;
  }

  .am-category-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .am-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    background: #e4f5eb;
    border-radius: 9px;
    font-size: 19px;
  }

  .am-category-head strong,
  .am-category-head small {
    display: block;
  }

  .am-category-head strong {
    font-size: 13px;
  }

  .am-category-head small {
    color: #8a9b90;
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
    color: #087e58;
    font-size: 18px;
  }

  .am-category-actual span {
    font-size: 11px;
    color: #668776;
    white-space: nowrap;
  }

  .am-progress {
    width: 100%;
    height: 9px;
    border-radius: 20px;
    background: #e4ece7;
    overflow: hidden;
  }

  .am-progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      #28bf8c,
      #07885f
    );
  }

  .am-category-footer {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 11px;
    color: #7c9184;
    font-size: 10px;
  }

  /* EQUAL WIDTH PANELS */

  .am-two-columns {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) minmax(0, 1fr);
    align-items: stretch;
    gap: 14px;
  }

  .am-two-columns > .am-card {
    min-width: 0;
    height: 100%;
  }

  /* CHART - COMPACT */

  .am-chart-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 7px;
  }

  .am-chart {
    display: flex;
    align-items: stretch;
    width: max-content;
    gap: 5px;
    height: 183px;
    border-bottom: 1px solid #dde9e1;
  }

  .am-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 25px;
    padding: 0;
    border: none;
    background: transparent;
    color: #7b9386;
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
  }

  .am-bar-track i {
    display: block;
    width: 100%;
    border-radius: 4px 4px 0 0;
    background: #40c59a;
  }

  .am-chart-column.selected .am-bar-track i {
    background: #268bd6;
  }

  .am-chart-column.selected {
    color: #207bc1;
    font-weight: 900;
  }

  .am-chart-column.outside {
    opacity: .25;
  }

  .am-chart-column.outside .am-bar-track i {
    background: #dce5e0;
  }

  /* ACTIVITY PANEL - SMALLER */

  .am-activity-panel {
    display: flex;
    flex-direction: column;
  }

  .am-highlight {
    color: #078b60;
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
    background: #edf8f2;
  }

  .am-activity-stats strong {
    display: block;
    font-size: 21px;
    color: #087e59;
    line-height: 1.1;
  }

  .am-activity-stats span {
    display: block;
    font-size: 9px;
    line-height: 1.5;
    margin-top: 5px;
    color: #698677;
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
    border: 1px solid #dce8e1;
    border-radius: 6px;
    background: #f3f7f5;
    color: #718a7a;
    font-size: 9px;
    font-weight: 800;
    text-align: center;
    white-space: nowrap;
  }

  .am-week.has-data {
    color: #087c58;
    background: #ccefe0;
    border-color: #b7e6d0;
  }

  .am-week.selected {
    background: #087b59;
    color: white;
    border-color: #087b59;
  }

  .am-week.outside {
    background: #f6f7f7;
    border-color: #edf0ef;
    color: #bec9c4;
    opacity: .65;
    cursor: not-allowed;
  }

  .am-legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 11px;
    color: #87998e;
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
    border-radius: 3px;
    display: inline-block;
  }

  .am-dot.active {
    background: #28b786;
  }

  .am-dot.inactive {
    background: #d7e3dc;
  }

  .am-dot.outside {
    background: #f6f7f7;
    border: 1px solid #c4d0ca;
  }

  /* COMMON NOTE */

  .am-note {
    margin: 11px 0 0;
    color: #87998e;
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
    color: #8da095;
    font-size: 10px;
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
    .am-week {
      padding: 7px 1px;
      font-size: 8px;
    }

    .am-legend {
      gap: 7px;
      font-size: 8px;
    }
  }

  /* PRINT */

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    .am-header,
    .am-tabs,
    .am-toolbar,
    .am-week-control,
    .am-bottom {
      display: none !important;
    }

    .am-root {
      background: white;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .am-container {
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

    .am-two-columns {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .am-chart-scroll {
      overflow: visible;
    }
  }
`;
