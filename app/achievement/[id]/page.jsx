
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT
// KALENDER GLOBAL • CAPAIAN MAKSIMAL 100%
// =====================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    color: "#e24e46",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
    color: "#e4a12d",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "📣",
    color: "#c7aa25",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🗺️",
    color: "#268d61",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "👥",
    color: "#219ac0",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    color: "#3573d2",
  },
];

function pad(number) {
  return String(number).padStart(2, "0");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
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

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

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

function todayLocal() {
  const date = new Date();

  return new Date(
    date.getTime() -
      date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
}

function dateText(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function kmText(value) {
  return Number(value || 0).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }
  );
}

function numberText(value, digits = 0) {
  return Number(value || 0).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }
  );
}

function percent(realized, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (realized / target) * 100)
  );
}

function average(values) {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

// =====================================================
// KALENDER GLOBAL OJT
//
// WEEK 01: 12–18 SEP 2026 (KHUSUS)
// WEEK 02: 20–26 SEP 2026
// WEEK 07: 25–31 OKT 2026
// WEEK 25: 28 FEB–06 MAR 2027
//
// 19 SEP 2026 DI LUAR KALENDER PROGRAM.
// =====================================================

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? "2026-09-12"
        : addDays(
            "2026-09-20",
            (index - 1) * 7
          );

    return {
      week: index + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(value) {
  const key = String(value ?? "").slice(0, 10);

  if (!parseDate(key)) return null;

  const matched = GLOBAL_WEEKS.find(
    (week) =>
      key >= week.start &&
      key <= week.end
  );

  return matched?.week ?? null;
}

function weekLabel(week) {
  return `Week ${pad(week)}`;
}

function getWeek(week) {
  return (
    GLOBAL_WEEKS.find(
      (item) => item.week === Number(week)
    ) || null
  );
}

function programRangeForWeek(week, program) {
  const selected = getWeek(week);

  if (
    !selected ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const start =
    selected.start > program.start_date
      ? selected.start
      : program.start_date;

  const end =
    program.end_date &&
    program.end_date < selected.end
      ? program.end_date
      : selected.end;

  if (start > end) return null;

  return { start, end };
}

function defaultWeek(program) {
  const date = todayLocal();

  const available = GLOBAL_WEEKS.filter(
    (week) =>
      programRangeForWeek(
        week.week,
        program
      )
  );

  if (!available.length) {
    return globalWeekOf(date) || 1;
  }

  const active = available.find(
    (week) => {
      const range = programRangeForWeek(
        week.week,
        program
      );

      return (
        date >= range.start &&
        date <= range.end
      );
    }
  );

  if (active) return active.week;

  const upcoming = available.find(
    (week) => {
      const range = programRangeForWeek(
        week.week,
        program
      );

      return range.start > date;
    }
  );

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

function getCategory(typeCode, types) {
  const type = types.find(
    (item) => item.code === typeCode
  );

  return TARGETS.find(
    (target) =>
      normalize(target.name) ===
      normalize(type?.name)
  );
}

// =====================================================
// HALAMAN MONITORING
// =====================================================

export default function MonitoringAchievementPage() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [account, setAccount] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [selectedWeek, setSelectedWeek] =
    useState(1);

  const [historyWeek, setHistoryWeek] =
    useState("selected");

  const [historyCategory, setHistoryCategory] =
    useState("all");

  const [historyStatus, setHistoryStatus] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [presentation, setPresentation] =
    useState(false);

  const role = normalizeRole(account?.role);

  const canManage =
    role === "admin" || role === "mentor";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  // ===================================================
  // PEMERIKSAAN AKSES
  // ===================================================

  async function getAccess() {
    const {
      data: auth,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      return { redirect: "/login" };
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error(
        "Profil pengguna tidak ditemukan."
      );
    }

    const currentRole =
      normalizeRole(profile.role);

    const participantRole =
      ["peserta", "participant"].includes(
        currentRole
      );

    if (
      !participantRole &&
      !["admin", "mentor"].includes(
        currentRole
      )
    ) {
      throw new Error(
        "Anda tidak memiliki akses Monitoring Achievement."
      );
    }

    let query = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        mentor_id,
        site,
        status,
        start_date,
        end_date,
        legacy_access,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", programId);

    if (participantRole) {
      query = query
        .eq("participant_id", auth.user.id)
        .eq("status", "active");
    }

    const {
      data: programData,
      error: programError,
    } = await query.maybeSingle();

    if (programError) throw programError;

    if (!programData) {
      throw new Error(
        "Program OJT tidak ditemukan atau akses tidak tersedia."
      );
    }

    if (!parseDate(programData.start_date)) {
      throw new Error(
        "Tanggal mulai program OJT tidak valid."
      );
    }

    if (participantRole) {
      const [request, registration] =
        await Promise.all([
          supabase
            .from("ojt_registration_requests")
            .select("status")
            .eq("participant_id", auth.user.id),

          supabase
            .from("participant_registrations")
            .select("status")
            .eq("user_id", auth.user.id),
        ]);

      if (request.error) throw request.error;
      if (registration.error) {
        throw registration.error;
      }

      const approved = [
        ...(request.data || []),
        ...(registration.data || []),
      ].some(
        (item) =>
          normalizeRole(item.status) ===
          "approved"
      );

      if (
        !approved &&
        programData.legacy_access !== true
      ) {
        throw new Error(
          "Akses peserta belum disetujui."
        );
      }
    }

    return {
      profile,
      programData,
    };
  }

  async function fetchAchievement() {
    const [typeResult, recordResult] =
      await Promise.all([
        supabase
          .from("achievement_types")
          .select("code,name"),

        supabase
          .from("achievement_records")
          .select(
            "id,type_code,activity_date,description,distance_km,status,created_at"
          )
          .eq("program_id", programId)
          .order(
            "activity_date",
            { ascending: false }
          ),
      ]);

    if (typeResult.error) {
      throw typeResult.error;
    }

    if (recordResult.error) {
      throw recordResult.error;
    }

    return {
      loadedTypes: typeResult.data || [],
      loadedRecords: recordResult.data || [],
    };
  }

  // ===================================================
  // LOAD DATA
  // ===================================================

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const access = await getAccess();

        if (!active) return;

        if (access.redirect) {
          router.replace(access.redirect);
          return;
        }

        const result = await fetchAchievement();

        if (!active) return;

        setAccount(access.profile);
        setProgram(access.programData);
        setTypes(result.loadedTypes);
        setRecords(result.loadedRecords);

        setSelectedWeek(
          defaultWeek(access.programData)
        );
      } catch (err) {
        if (!active) return;

        setAccount(null);
        setProgram(null);

        setError(
          err?.message ||
          "Gagal memuat Monitoring Achievement."
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

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      const access = await getAccess();

      if (access.redirect) {
        router.replace(access.redirect);
        return;
      }

      const result = await fetchAchievement();

      setAccount(access.profile);
      setProgram(access.programData);
      setTypes(result.loadedTypes);
      setRecords(result.loadedRecords);

      setMessage(
        "Monitoring Achievement berhasil diperbarui."
      );
    } catch (err) {
      setError(
        err?.message ||
        "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // DATA MINGGUAN GLOBAL
  // ===================================================

  const weeklyData = useMemo(() => {
    const verifiedRecords = records.filter(
      (item) => item.status === "verified"
    );

    return GLOBAL_WEEKS.map((week) => {
      const allWeekRecords = records.filter(
        (item) =>
          globalWeekOf(item.activity_date) ===
          week.week
      );

      const validRecords = verifiedRecords.filter(
        (item) =>
          globalWeekOf(item.activity_date) ===
          week.week
      );

      const categories = TARGETS.map(
        (target) => {
          const type = types.find(
            (item) =>
              normalize(item.name) ===
              normalize(target.name)
          );

          const items = validRecords.filter(
            (item) =>
              item.type_code === type?.code
          );

          let realized = 0;

          if (target.name === "Fisik") {
            const meters = items.reduce(
              (sum, item) =>
                sum +
                Math.round(
                  Number(item.distance_km || 0) *
                    1000
                ),
              0
            );

            realized = meters / 1000;
          } else {
            realized = items.length;
          }

          const achievementPercent = percent(
            realized,
            target.target
          );

          return {
            ...target,
            realized,
            percentage: achievementPercent,
            achieved:
              realized >= target.target,
          };
        }
      );

      const pending = allWeekRecords.filter(
        (item) => item.status === "pending"
      ).length;

      return {
        ...week,
        records: allWeekRecords.length,
        verified: validRecords.length,
        pending,
        categories,
        overall: average(
          categories.map(
            (item) => item.percentage
          )
        ),
      };
    });
  }, [records, types]);

  const selectedData = useMemo(
    () =>
      weeklyData.find(
        (week) =>
          week.week === Number(selectedWeek)
      ) || weeklyData[0],
    [weeklyData, selectedWeek]
  );

  const activeWeekRange = programRangeForWeek(
    selectedWeek,
    program
  );

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(
        (item) =>
          programRangeForWeek(
            item.week,
            program
          )
      ),
    [program]
  );

  // Program progress dihitung dari minggu global
  // yang beririsan dengan periode OJT peserta.
  // Setiap persentase mingguan maksimal 100%.

  const overallProgram = useMemo(() => {
    const eligible = weeklyData.filter(
      (week) =>
        programRangeForWeek(
          week.week,
          program
        )
    );

    return {
      weeks: eligible.length,
      percentage: average(
        eligible.map(
          (week) => week.overall
        )
      ),
      completed: eligible.filter(
        (week) =>
          week.categories.every(
            (item) => item.achieved
          )
      ).length,
    };
  }, [weeklyData, program]);

  const totalRecords = records.length;

  const verifiedRecords = records.filter(
    (item) => item.status === "verified"
  ).length;

  const pendingRecords = records.filter(
    (item) => item.status === "pending"
  ).length;

  const verifiedRatio = totalRecords
    ? (verifiedRecords / totalRecords) * 100
    : 0;

  // ===================================================
  // FILTER RIWAYAT
  // ===================================================

  const filteredHistory = useMemo(() => {
    return records.filter((item) => {
      const week = globalWeekOf(
        item.activity_date
      );

      const category = getCategory(
        item.type_code,
        types
      );

      const matchWeek =
        historyWeek === "all" ||
        (
          historyWeek === "selected" &&
          week === selectedWeek
        ) ||
        (
          historyWeek !== "selected" &&
          historyWeek !== "all" &&
          week === Number(historyWeek)
        );

      const matchCategory =
        historyCategory === "all" ||
        normalize(category?.name) ===
          normalize(historyCategory);

      const matchStatus =
        historyStatus === "all" ||
        item.status === historyStatus;

      return (
        matchWeek &&
        matchCategory &&
        matchStatus
      );
    });
  }, [
    records,
    types,
    selectedWeek,
    historyWeek,
    historyCategory,
    historyStatus,
  ]);

  const maxCount = Math.max(
    1,
    ...weeklyData.map(
      (week) => week.verified
    )
  );

  // ===================================================
  // CETAK / PRESENTASI
  // ===================================================

  function printPage() {
    window.print();
  }

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <main className="am-loading">
        Memuat Monitoring Achievement OJT...
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-loading">
        <h2>
          Monitoring Achievement tidak dapat dibuka
        </h2>

        <p>
          {error || "Data tidak tersedia."}
        </p>

        <button
          type="button"
          onClick={() => router.back()}
        >
          Kembali
        </button>
      </main>
    );
  }

  const backPath = canManage
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  return (
    <main
      className={
        "am-root " +
        (presentation
          ? "am-presentation"
          : "")
      }
    >
      <style>{css}</style>

      {/* HEADER */}
      <header className="am-topbar">
        <div className="am-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="am-header-right">
          <div className="am-account">
            <small>
              {role === "admin"
                ? "Administrator"
                : role === "mentor"
                ? "Mentor"
                : "Peserta"}
            </small>

            <strong>
              {account.full_name || "Pengguna"}
            </strong>
          </div>

          <button
            type="button"
            className="am-btn light"
            onClick={() =>
              router.push(backPath)
            }
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">
        {/* HERO */}
        <section className="am-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>
              Monitoring Achievement OJT
            </h1>

            <p>
              Evaluasi pencapaian berdasarkan
              Kalender Global OJT Week 01–25.
            </p>

            <div className="am-hero-meta">
              <span>
                {participant?.full_name ||
                  "Peserta OJT"}
              </span>

              <span>
                {program.site || "—"}
              </span>

              <span>
                {dateText(program.start_date)}
                {" – "}
                {dateText(program.end_date)}
              </span>
            </div>
          </div>

          <div className="am-hero-badge">
            <span>
              PROGRAM GLOBAL
            </span>

            <strong>
              25 WEEKS
            </strong>
          </div>
        </section>

        {/* NAVIGASI */}
        <nav className="am-tabs">
          {canManage && (
            <button
              type="button"
              className="am-tab"
              onClick={() =>
                router.push(
                  `/achievement/${programId}`
                )
              }
            >
              ✍️ Input Achievement
            </button>
          )}

          <div className="am-tab active">
            📊 Monitoring Achievement
          </div>
        </nav>

        {error && (
          <div className="am-alert error">
            {error}
          </div>
        )}

        {message && (
          <div className="am-alert success">
            ✓ {message}
          </div>
        )}

        {/* TOOLBAR */}
        <section className="am-toolbar">
          <div className="am-toolbar-left">
            <label htmlFor="am-week">
              Pilih Week Global
            </label>

            <select
              id="am-week"
              className="am-select"
              value={selectedWeek}
              onChange={(event) =>
                setSelectedWeek(
                  Number(event.target.value)
                )
              }
            >
              {GLOBAL_WEEKS.map((week) => (
                <option
                  key={week.week}
                  value={week.week}
                >
                  {weekLabel(week.week)}
                  {" — "}
                  {dateText(week.start)}
                  {" s.d. "}
                  {dateText(week.end)}
                </option>
              ))}
            </select>
          </div>

          <div className="am-toolbar-actions">
            <button
              type="button"
              className="am-btn light"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memuat..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="am-btn blue"
              onClick={() =>
                setPresentation((value) => !value)
              }
            >
              {presentation
                ? "Tampilan Normal"
                : "Mode Presentasi"}
            </button>

            <button
              type="button"
              className="am-btn primary"
              onClick={printPage}
            >
              Cetak / PDF
            </button>
          </div>
        </section>

        {/* IDENTITAS MINGGU */}
        <section className="am-week-banner">
          <div>
            <small>
              PERIODE KALENDER GLOBAL
            </small>

            <h2>
              {weekLabel(selectedWeek)}
            </h2>

            <p>
              {dateText(selectedData.start)}
              {" – "}
              {dateText(selectedData.end)}
            </p>
          </div>

          <div className="am-week-banner-note">
            {activeWeekRange ? (
              <>
                <strong>
                  Rentang Aktif Peserta
                </strong>

                <span>
                  {dateText(activeWeekRange.start)}
                  {" – "}
                  {dateText(activeWeekRange.end)}
                </span>
              </>
            ) : (
              <>
                <strong>
                  Di luar periode peserta
                </strong>

                <span>
                  Minggu ini tidak beririsan
                  dengan tanggal OJT peserta.
                </span>
              </>
            )}
          </div>
        </section>

        {/* KPI */}
        <section className="am-kpis">
          <div className="am-kpi">
            <span>
              Total Kegiatan Week
            </span>

            <strong>
              {selectedData.records}
            </strong>

            <small>
              Semua status
            </small>
          </div>

          <div className="am-kpi green">
            <span>
              Kegiatan Tercatat
            </span>

            <strong>
              {selectedData.verified}
            </strong>

            <small>
              Langsung dihitung
            </small>
          </div>

          <div className="am-kpi orange">
            <span>
              Pending Lama
            </span>

            <strong>
              {selectedData.pending}
            </strong>

            <small>
              Belum dihitung
            </small>
          </div>

          <div className="am-kpi blue">
            <span>
              Progres Mingguan
            </span>

            <strong>
              {numberText(
                selectedData.overall,
                2
              )}%
            </strong>

            <small>
              Maksimal 100%
            </small>
          </div>
        </section>

        {/* KATEGORI */}
        <section className="am-section">
          <div className="am-section-head">
            <div>
              <h2>
                Pencapaian Enam Kategori
              </h2>

              <p>
                Realisasi aktual tetap ditampilkan.
                Persentase dibatasi maksimal 100%.
              </p>
            </div>

            <span className="am-section-tag">
              {weekLabel(selectedWeek)}
            </span>
          </div>

          <div className="am-category-grid">
            {selectedData.categories.map(
              (item) => (
                <article
                  className="am-category"
                  key={item.name}
                >
                  <div className="am-category-head">
                    <span className="am-category-icon">
                      {item.icon}
                    </span>

                    <span
                      className={
                        "am-category-status " +
                        (item.achieved
                          ? "achieved"
                          : "")
                      }
                    >
                      {item.achieved
                        ? "Tercapai"
                        : "Belum Tercapai"}
                    </span>
                  </div>

                  <h3>
                    {item.name}
                  </h3>

                  <div className="am-category-values">
                    <div>
                      <small>
                        REALISASI
                      </small>

                      <strong>
                        {item.name === "Fisik"
                          ? kmText(item.realized)
                          : item.realized}
                      </strong>
                    </div>

                    <div>
                      <small>
                        TARGET
                      </small>

                      <strong>
                        {item.target}
                      </strong>
                    </div>
                  </div>

                  <div className="am-progress-row">
                    <span>
                      Pencapaian
                    </span>

                    <strong>
                      {numberText(
                        item.percentage,
                        2
                      )}%
                    </strong>
                  </div>

                  <div className="am-progress-track">
                    <div
                      style={{
                        width:
                          `${item.percentage}%`,
                        background:
                          item.color,
                      }}
                    />
                  </div>

                  <small className="am-unit">
                    {item.unit}
                    {" · "}
                    Target per minggu global
                  </small>
                </article>
              )
            )}
          </div>
        </section>

        {/* GRAFIK 25 MINGGU */}
        <section className="am-section">
          <div className="am-section-head">
            <div>
              <h2>
                Grafik Kegiatan Week 01–25
              </h2>

              <p>
                Jumlah kegiatan berstatus
                Verified berdasarkan tanggal
                pada kalender global.
              </p>
            </div>
          </div>

          <div className="am-chart-scroll">
            <div className="am-chart">
              {weeklyData.map((week) => {
                const height =
                  week.verified === 0
                    ? 0
                    : Math.max(
                        5,
                        (week.verified /
                          maxCount) *
                          100
                      );

                return (
                  <button
                    type="button"
                    key={week.week}
                    className={
                      "am-chart-column " +
                      (
                        week.week ===
                        selectedWeek
                          ? "selected"
                          : ""
                      )
                    }
                    title={
                      `${weekLabel(week.week)}: ` +
                      `${week.verified} kegiatan`
                    }
                    onClick={() =>
                      setSelectedWeek(
                        week.week
                      )
                    }
                  >
                    <span className="am-chart-value">
                      {week.verified}
                    </span>

                    <span className="am-chart-space">
                      <span
                        style={{
                          height:
                            `${height}%`,
                        }}
                      />
                    </span>

                    <span className="am-chart-label">
                      {pad(week.week)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* PETA 25 MINGGU */}
        <section className="am-section">
          <div className="am-section-head">
            <div>
              <h2>
                Ringkasan Week Global
              </h2>

              <p>
                Pilih kotak minggu untuk
                melihat pencapaiannya.
              </p>
            </div>
          </div>

          <div className="am-weeks-grid">
            {weeklyData.map((week) => {
              const available =
                programRangeForWeek(
                  week.week,
                  program
                );

              return (
                <button
                  key={week.week}
                  type="button"
                  className={
                    "am-week-tile " +
                    (
                      selectedWeek ===
                      week.week
                        ? "active "
                        : ""
                    ) +
                    (
                      !available
                        ? "outside"
                        : ""
                    )
                  }
                  onClick={() =>
                    setSelectedWeek(
                      week.week
                    )
                  }
                >
                  <strong>
                    W{pad(week.week)}
                  </strong>

                  <span>
                    {numberText(
                      week.overall,
                      0
                    )}%
                  </span>

                  <small>
                    {week.verified}
                    {" "}kegiatan
                  </small>
                </button>
              );
            })}
          </div>
        </section>

        {/* PROGRES PROGRAM */}
        <section className="am-section">
          <div className="am-section-head">
            <div>
              <h2>
                Ringkasan Periode OJT Peserta
              </h2>

              <p>
                Rata-rata pencapaian dari
                minggu global yang beririsan
                dengan periode peserta.
              </p>
            </div>
          </div>

          <div className="am-program-summary">
            <div>
              <span>
                Rata-rata Pencapaian
              </span>

              <strong>
                {numberText(
                  overallProgram.percentage,
                  2
                )}%
              </strong>
            </div>

            <div>
              <span>
                Minggu yang Beririsan
              </span>

              <strong>
                {overallProgram.weeks}
              </strong>
            </div>

            <div>
              <span>
                Minggu Semua Target Tercapai
              </span>

              <strong>
                {overallProgram.completed}
              </strong>
            </div>

            <div>
              <span>
                Total Kegiatan Tercatat
              </span>

              <strong>
                {verifiedRecords}
              </strong>
            </div>
          </div>

          <div className="am-program-bar">
            <div
              style={{
                width:
                  `${overallProgram.percentage}%`,
              }}
            />
          </div>

          <p className="am-footnote">
            Kelebihan realisasi satu minggu
            tidak menutupi kekurangan
            pada minggu lain. Setiap kategori
            dihitung maksimal 100% per minggu.
          </p>
        </section>

        {/* RIWAYAT KEGIATAN */}
        <section className="am-section">
          <div className="am-section-head">
            <div>
              <h2>
                Riwayat Achievement
              </h2>

              <p>
                Riwayat kegiatan menggunakan
                nomor Week Kalender Global.
              </p>
            </div>

            <span className="am-section-tag">
              {filteredHistory.length} data
            </span>
          </div>

          <div className="am-filters">
            <div>
              <label htmlFor="am-filter-week">
                Filter Minggu
              </label>

              <select
                id="am-filter-week"
                className="am-select"
                value={historyWeek}
                onChange={(event) =>
                  setHistoryWeek(
                    event.target.value
                  )
                }
              >
                <option value="selected">
                  Minggu yang dipilih
                </option>

                <option value="all">
                  Semua Minggu
                </option>

                {GLOBAL_WEEKS.map(
                  (week) => (
                    <option
                      key={week.week}
                      value={week.week}
                    >
                      {weekLabel(week.week)}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label htmlFor="am-filter-category">
                Kategori
              </label>

              <select
                id="am-filter-category"
                className="am-select"
                value={historyCategory}
                onChange={(event) =>
                  setHistoryCategory(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Semua Kategori
                </option>

                {TARGETS.map(
                  (item) => (
                    <option
                      key={item.name}
                      value={item.name}
                    >
                      {item.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label htmlFor="am-filter-status">
                Status
              </label>

              <select
                id="am-filter-status"
                className="am-select"
                value={historyStatus}
                onChange={(event) =>
                  setHistoryStatus(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Semua Status
                </option>

                <option value="verified">
                  Tercatat
                </option>

                <option value="pending">
                  Pending Lama
                </option>
              </select>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="am-empty">
              Belum ada kegiatan sesuai filter.
            </div>
          ) : (
            <div className="am-history-table-wrap">
              <table className="am-history-table">
                <thead>
                  <tr>
                    <th>TANGGAL</th>
                    <th>WEEK</th>
                    <th>KATEGORI</th>
                    <th>REALISASI</th>
                    <th>KETERANGAN</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistory.map(
                    (item) => {
                      const category =
                        getCategory(
                          item.type_code,
                          types
                        );

                      const week =
                        globalWeekOf(
                          item.activity_date
                        );

                      return (
                        <tr key={item.id}>
                          <td>
                            {dateText(
                              item.activity_date
                            )}
                          </td>

                          <td>
                            {week
                              ? weekLabel(week)
                              : "Di luar kalender"}
                          </td>

                          <td>
                            <strong>
                              {category?.icon ||
                                "📋"}
                              {" "}
                              {category?.name ||
                                item.type_code}
                            </strong>
                          </td>

                          <td>
                            {category?.name ===
                            "Fisik"
                              ? `${kmText(
                                  item.distance_km
                                )} km`
                              : "1 kegiatan"}
                          </td>

                          <td className="am-description">
                            {item.description ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className={
                                "am-status " +
                                (
                                  item.status ===
                                  "verified"
                                    ? "verified"
                                    : "pending"
                                )
                              }
                            >
                              {item.status ===
                              "verified"
                                ? "Tercatat"
                                : item.status ===
                                  "pending"
                                ? "Pending Lama"
                                : item.status ||
                                  "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* FOOTER RINGKAS */}
        <section className="am-footer-summary">
          <span>
            Total seluruh data:
            {" "}
            <strong>
              {totalRecords}
            </strong>
          </span>

          <span>
            Tercatat:
            {" "}
            <strong>
              {verifiedRecords}
            </strong>
          </span>

          <span>
            Pending lama:
            {" "}
            <strong>
              {pendingRecords}
            </strong>
          </span>

          <span>
            Persentase data tercatat:
            {" "}
            <strong>
              {numberText(
                verifiedRatio,
                2
              )}%
            </strong>
          </span>
        </section>

        <footer className="am-footer">
          OJT MineTrack v2.0 · Emergency Response
          Group · PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS DESKTOP, MOBILE, PRESENTASI, DAN CETAK
// =====================================================

const css = `
.am-root,
.am-root * {
  box-sizing: border-box;
}

.am-root {
  min-height: 100vh;
  background: #f0f5f3;
  color: #18362e;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
}

.am-loading {
  min-height: 100vh;
  background: #f0f5f3;
  padding: 32px;
  font-family: Arial, sans-serif;
}

.am-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 24px;
  gap: 15px;
  background: #071f25;
  color: white;
}

.am-brand {
  font-size: 22px;
  font-weight: 900;
  white-space: nowrap;
}

.am-brand span {
  color: #2dcc94;
}

.am-header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.am-account {
  text-align: right;
  max-width: 230px;
}

.am-account small {
  display: block;
  color: #a4c8b9;
  font-size: 10px;
}

.am-account strong {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.am-container {
  max-width: 1480px;
  margin: 0 auto;
  padding: 20px;
}

.am-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 30px;
  border-radius: 17px;
  color: white;
  background: linear-gradient(
    110deg,
    #081e28,
    #086448
  );
}

.am-hero small {
  color: #e5be67;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.am-hero h1 {
  font-size: clamp(25px,3vw,36px);
  margin: 12px 0 8px;
}

.am-hero p {
  color: #daebe1;
  font-size: 13px;
  line-height: 1.6;
}

.am-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 17px;
}

.am-hero-meta span {
  background: #ffffff16;
  border: 1px solid #ffffff30;
  padding: 8px 12px;
  border-radius: 30px;
  font-size: 11px;
}

.am-hero-badge {
  min-width: 165px;
  padding: 19px;
  text-align: center;
  background: #ffffff16;
  border: 1px solid #ffffff38;
  border-radius: 13px;
}

.am-hero-badge span {
  display: block;
  color: #d2ede1;
  font-size: 10px;
}

.am-hero-badge strong {
  display: block;
  font-size: 27px;
  margin-top: 7px;
}

.am-tabs {
  display: flex;
  gap: 8px;
  margin: 15px 0;
}

.am-tab {
  padding: 12px 17px;
  color: #296448;
  font-size: 12px;
  font-weight: 800;
  background: white;
  border: 1px solid #dbe7df;
  border-radius: 9px;
  cursor: pointer;
}

.am-tab.active {
  background: #07885c;
  color: white;
}

.am-alert {
  padding: 13px;
  border-radius: 10px;
  margin-bottom: 13px;
  font-size: 12px;
}

.am-alert.error {
  background: #ffebeb;
  color: #a52323;
}

.am-alert.success {
  background: #e1f7eb;
  color: #087751;
}

.am-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;
  background: white;
  border: 1px solid #dfe9e3;
  padding: 16px;
  border-radius: 13px;
  margin-bottom: 15px;
}

.am-toolbar-left {
  flex: 1;
  max-width: 430px;
}

.am-toolbar-left label,
.am-filters label {
  display: block;
  margin-bottom: 7px;
  font-size: 11px;
  font-weight: 800;
}

.am-select {
  width: 100%;
  min-width: 0;
  border: 1px solid #d1e0d8;
  border-radius: 9px;
  background: white;
  color: #234537;
  padding: 11px 12px;
  font-size: 12px;
}

.am-toolbar-actions {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.am-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 11px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.am-btn.primary {
  color: white;
  background: #09875d;
}

.am-btn.blue {
  color: white;
  background: #254a77;
}

.am-btn.light {
  color: #176547;
  background: #e4f2eb;
}

.am-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.am-week-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 21px 25px;
  background: white;
  border: 1px solid #dbe9e0;
  border-radius: 13px;
  margin-bottom: 15px;
}

.am-week-banner small {
  color: #6f9180;
  font-size: 10px;
  font-weight: 800;
}

.am-week-banner h2 {
  font-size: 27px;
  margin: 5px 0;
}

.am-week-banner p {
  font-size: 13px;
  color: #668878;
  margin: 0;
}

.am-week-banner-note {
  background: #eff8f2;
  border-radius: 10px;
  padding: 13px;
  min-width: 220px;
  text-align: right;
}

.am-week-banner-note strong,
.am-week-banner-note span {
  display: block;
}

.am-week-banner-note strong {
  color: #087a50;
  font-size: 11px;
}

.am-week-banner-note span {
  color: #748d80;
  font-size: 11px;
  margin-top: 6px;
}

.am-kpis {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.am-kpi {
  background: white;
  border: 1px solid #dfe9e4;
  border-radius: 13px;
  padding: 18px;
}

.am-kpi > span {
  font-size: 11px;
  color: #718b7c;
  display: block;
}

.am-kpi strong {
  display: block;
  font-size: 27px;
  margin: 9px 0;
}

.am-kpi small {
  color: #92a398;
  font-size: 10px;
}

.am-kpi.green strong {
  color: #0a8759;
}

.am-kpi.orange strong {
  color: #c88a19;
}

.am-kpi.blue strong {
  color: #286aaf;
}

.am-section {
  background: white;
  border: 1px solid #dfe9e3;
  border-radius: 15px;
  padding: 22px;
  margin-bottom: 15px;
}

.am-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.am-section-head h2 {
  font-size: 18px;
  margin: 0;
}

.am-section-head p {
  color: #85968b;
  font-size: 12px;
  line-height: 1.6;
  margin: 7px 0 0;
}

.am-section-tag {
  background: #e6f6ed;
  color: #087c54;
  font-size: 11px;
  font-weight: 800;
  border-radius: 30px;
  padding: 8px 12px;
}

.am-category-grid {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 13px;
}

.am-category {
  border: 1px solid #e1e9e5;
  border-radius: 13px;
  padding: 18px;
}

.am-category-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.am-category-icon {
  font-size: 23px;
}

.am-category-status {
  font-size: 10px;
  border-radius: 30px;
  padding: 7px 10px;
  color: #946b21;
  background: #fff3df;
  white-space: nowrap;
}

.am-category-status.achieved {
  color: #087e53;
  background: #e3f6e9;
}

.am-category h3 {
  font-size: 15px;
  margin: 14px 0 18px;
}

.am-category-values {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.am-category-values small {
  display: block;
  color: #8c9e94;
  font-size: 10px;
}

.am-category-values strong {
  display: block;
  font-size: 25px;
  margin-top: 6px;
}

.am-progress-row {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  font-size: 11px;
}

.am-progress-row strong {
  color: #0b855b;
}

.am-progress-track {
  margin-top: 8px;
  height: 10px;
  border-radius: 30px;
  background: #e6eee8;
  overflow: hidden;
}

.am-progress-track div {
  height: 100%;
  border-radius: inherit;
}

.am-unit {
  display: block;
  color: #859a8c;
  font-size: 10px;
  margin-top: 10px;
}

.am-chart-scroll {
  overflow-x: auto;
}

.am-chart {
  display: grid;
  grid-template-columns:
    repeat(25,minmax(25px,1fr));
  gap: 7px;
  min-width: 800px;
  height: 220px;
}

.am-chart-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 5px;
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
  color: #6e8779;
}

.am-chart-value {
  font-size: 10px;
  font-weight: 800;
}

.am-chart-space {
  height: 170px;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: #f4f8f5;
  border-radius: 5px;
}

.am-chart-space span {
  display: block;
  width: 80%;
  background: #2aab78;
  border-radius: 5px 5px 0 0;
}

.am-chart-column.selected
.am-chart-space span {
  background: #155790;
}

.am-chart-label {
  font-size: 9px;
  font-weight: 800;
}

.am-weeks-grid {
  display: grid;
  grid-template-columns:
    repeat(5,minmax(0,1fr));
  gap: 9px;
}

.am-week-tile {
  padding: 12px 7px;
  border: 1px solid #dbe8df;
  border-radius: 9px;
  background: #f8fbf9;
  text-align: center;
  cursor: pointer;
  color: #254e3c;
}

.am-week-tile strong,
.am-week-tile span,
.am-week-tile small {
  display: block;
}

.am-week-tile strong {
  font-size: 12px;
}

.am-week-tile span {
  font-size: 17px;
  font-weight: 900;
  margin-top: 5px;
}

.am-week-tile small {
  font-size: 9px;
  color: #8da197;
  margin-top: 5px;
}

.am-week-tile.active {
  color: white;
  background: #087f59;
  border-color: #087f59;
}

.am-week-tile.active small {
  color: #d0ebe0;
}

.am-week-tile.outside:not(.active) {
  background: #f1f2f2;
  opacity: .65;
}

.am-program-summary {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 10px;
}

.am-program-summary > div {
  padding: 16px;
  background: #f5f9f7;
  border-radius: 10px;
}

.am-program-summary span {
  display: block;
  color: #759082;
  font-size: 11px;
}

.am-program-summary strong {
  display: block;
  font-size: 25px;
  margin-top: 8px;
  color: #087b54;
}

.am-program-bar {
  margin-top: 15px;
  height: 13px;
  background: #e4eee8;
  border-radius: 30px;
  overflow: hidden;
}

.am-program-bar div {
  height: 100%;
  background: #1a9a6c;
  border-radius: inherit;
}

.am-footnote {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #84988b;
}

.am-filters {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.am-history-table-wrap {
  overflow-x: auto;
}

.am-history-table {
  width: 100%;
  min-width: 800px;
  border-collapse: collapse;
  font-size: 11px;
}

.am-history-table th,
.am-history-table td {
  border-bottom: 1px solid #e4ece7;
  padding: 12px 9px;
  text-align: left;
  vertical-align: top;
}

.am-history-table th {
  font-size: 10px;
  color: #6c8779;
  background: #f4f8f5;
}

.am-description {
  max-width: 280px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.am-status {
  display: inline-block;
  white-space: nowrap;
  padding: 7px 9px;
  border-radius: 30px;
  font-size: 10px;
  font-weight: 800;
}

.am-status.verified {
  color: #087b55;
  background: #e1f6e8;
}

.am-status.pending {
  color: #a16b15;
  background: #fff0d4;
}

.am-empty {
  text-align: center;
  padding: 38px;
  color: #8a9c91;
}

.am-footer-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 15px;
  background: #e7f0eb;
  border-radius: 10px;
  color: #587b67;
  font-size: 11px;
}

.am-footer-summary strong {
  color: #155b3d;
}

.am-footer {
  text-align: center;
  padding: 26px 0;
  font-size: 11px;
  color: #90a296;
}

/* =========================================
   MODE PRESENTASI
   ========================================= */

.am-presentation {
  background: white;
}

.am-presentation .am-topbar,
.am-presentation .am-tabs {
  display: none;
}

.am-presentation .am-container {
  max-width: 1700px;
}

.am-presentation .am-hero {
  padding: 27px;
}

.am-presentation .am-category h3 {
  font-size: 17px;
}

.am-presentation .am-category-values strong {
  font-size: 30px;
}

/* =========================================
   RESPONSIVE
   ========================================= */

@media(max-width:1100px) {
  .am-category-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .am-kpis,
  .am-program-summary {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }
}

@media(max-width:700px) {
  .am-topbar {
    padding: 12px;
  }

  .am-brand {
    font-size: 17px;
  }

  .am-account {
    max-width: 110px;
  }

  .am-account strong {
    font-size: 10px;
  }

  .am-container {
    padding: 11px;
  }

  .am-hero {
    padding: 20px;
    flex-direction: column;
    align-items: stretch;
  }

  .am-hero h1 {
    font-size: 25px;
  }

  .am-hero-badge {
    display: none;
  }

  .am-toolbar {
    align-items: stretch;
  }

  .am-toolbar-left {
    max-width: none;
    width: 100%;
  }

  .am-toolbar-actions {
    width: 100%;
  }

  .am-toolbar-actions .am-btn {
    flex: 1;
    font-size: 10px;
    padding: 10px 7px;
  }

  .am-week-banner {
    flex-direction: column;
    align-items: stretch;
    padding: 18px;
  }

  .am-week-banner-note {
    text-align: left;
    min-width: 0;
  }

  .am-section {
    padding: 15px;
  }

  .am-category-grid {
    grid-template-columns: 1fr;
  }

  .am-weeks-grid {
    grid-template-columns:
      repeat(5,minmax(0,1fr));
    gap: 5px;
  }

  .am-week-tile {
    padding: 10px 3px;
  }

  .am-week-tile span {
    font-size: 14px;
  }

  .am-kpis {
    gap: 7px;
  }

  .am-kpi {
    padding: 12px;
  }

  .am-kpi strong {
    font-size: 22px;
  }

  .am-program-summary {
    grid-template-columns: 1fr 1fr;
  }

  .am-filters {
    grid-template-columns: 1fr;
  }
}

/* =========================================
   CETAK PDF
   ========================================= */

@page {
  size: A4 landscape;
  margin: 8mm;
}

@media print {
  html,
  body {
    background: white !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .am-root {
    background: white !important;
    min-height: 0 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .am-topbar,
  .am-tabs,
  .am-toolbar-actions,
  .am-filters {
    display: none !important;
  }

  .am-container {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
  }

  .am-hero {
    padding: 14px !important;
    margin-bottom: 10px !important;
    break-inside: avoid;
  }

  .am-hero h1 {
    font-size: 22px !important;
  }

  .am-hero-badge {
    display: block !important;
  }

  .am-toolbar {
    padding: 8px !important;
    margin-bottom: 8px !important;
    border: 0 !important;
  }

  .am-toolbar-left label,
  .am-toolbar-left select {
    display: none !important;
  }

  .am-toolbar {
    display: none !important;
  }

  .am-week-banner {
    padding: 12px !important;
    margin-bottom: 8px !important;
    break-inside: avoid;
  }

  .am-kpis {
    grid-template-columns:
      repeat(4,minmax(0,1fr)) !important;
    gap: 7px !important;
    break-inside: avoid;
  }

  .am-kpi {
    padding: 11px !important;
  }

  .am-kpi strong {
    font-size: 20px !important;
  }

  .am-section {
    padding: 12px !important;
    margin-bottom: 9px !important;
  }

  .am-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr)) !important;
    gap: 8px !important;
  }

  .am-category {
    padding: 11px !important;
    break-inside: avoid;
  }

  .am-category h3 {
    font-size: 12px !important;
    margin: 9px 0 !important;
  }

  .am-category-values strong {
    font-size: 18px !important;
  }

  .am-chart-scroll,
  .am-history-table-wrap {
    overflow: visible !important;
  }

  .am-chart {
    min-width: 0 !important;
    height: 160px !important;
    gap: 4px !important;
  }

  .am-chart-space {
    height: 118px !important;
  }

  .am-weeks-grid {
    grid-template-columns:
      repeat(5,minmax(0,1fr)) !important;
  }

  .am-program-summary {
    grid-template-columns:
      repeat(4,minmax(0,1fr)) !important;
  }

  .am-program-summary strong {
    font-size: 18px !important;
  }

  .am-history-table {
    width: 100% !important;
    min-width: 0 !important;
    font-size: 9px !important;
  }

  .am-history-table th,
  .am-history-table td {
    padding: 6px 4px !important;
  }

  .am-history-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .am-footer {
    padding: 12px 0 !important;
  }
}
`;
