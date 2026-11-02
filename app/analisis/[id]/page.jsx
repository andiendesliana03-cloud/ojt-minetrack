
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// SKETSA 2 - FOKUS KEGIATAN & NILAI
// FILE: app/analisis/[id]/page.jsx
//
// Hanya membaca database.
// Kalender global Week 01-25.
// Rumus Achievement dan Samapta dipertahankan.
// Admin Review: /analisis/admin-review
// ======================================================

const TOTAL_WEEKS = 25;
const ADMIN_REVIEW_ID = "admin-review";

const CATEGORIES = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    aliases: ["fisik", "physical"],
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    aliases: ["training", "internaltraining", "pelatihan"],
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    aliases: ["sosialisasi", "socialization"],
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    aliases: ["coaching", "pembinaan"],
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    aliases: ["orientasi", "orientasiarea", "areaorientation"],
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    aliases: ["hazard", "hazardidentification", "identifikasibahaya"],
  },
];

const SERIES = [
  { key: "theory", name: "Teori", color: "#2670d6" },
  { key: "practice", name: "Praktik", color: "#119b80" },
  { key: "final", name: "Samapta", color: "#e7a53c" },
];

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

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function numberText(value, digits = 0) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function scoreText(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percentText(value) {
  return value === null || value === undefined
    ? "—"
    : `${numberText(value, 2)}%`;
}

function initials(name) {
  return (
    String(name || "Peserta")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "P"
  );
}

function average(records) {
  const numbers = records
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  if (!numbers.length) return null;

  return (
    numbers.reduce((sum, value) => sum + value, 0) /
    numbers.length
  );
}

function cappedPercent(actual, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (actual / target) * 100)
  );
}

// ======================================================
// KALENDER GLOBAL ASLI
// ======================================================

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

  return (
    GLOBAL_WEEKS.find(
      (item) => date >= item.start && date <= item.end
    )?.week ?? null
  );
}

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS.find(
    (item) => item.week === Number(week)
  );

  if (!global || !parseDate(program?.start_date)) {
    return null;
  }

  const startDate = String(program.start_date).slice(0, 10);

  const endDate = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startDate ? global.start : startDate;

  const end =
    endDate && endDate < global.end
      ? endDate
      : global.end;

  return start > end ? null : { start, end };
}

function availableGlobalWeeks(program) {
  if (!program) return [];

  return GLOBAL_WEEKS.filter((item) =>
    programWeekRange(program, item.week)
  );
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  if (date < String(program.start_date).slice(0, 10)) {
    return false;
  }

  if (
    parseDate(program.end_date) &&
    date > String(program.end_date).slice(0, 10)
  ) {
    return false;
  }

  return globalWeekOf(date) !== null;
}

function initialGlobalWeek(program, records = []) {
  const available = availableGlobalWeeks(program);
  if (!available.length) return 1;

  const now = todayWITA();

  const current = available.find((item) => {
    const range = programWeekRange(program, item.week);

    return (
      range &&
      now >= range.start &&
      now <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter((item) =>
      insideProgram(item.activity_date, program)
    )
    .map((item) => globalWeekOf(item.activity_date))
    .filter(Boolean);

  if (recorded.length) return Math.max(...recorded);

  const upcoming = available.find((item) => item.end >= now);

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// ======================================================
// ACHIEVEMENT: RUMUS ASLI
// ======================================================

function resolveCategory(typeCode, types) {
  const match = types.find(
    (item) =>
      normalize(item.code) === normalize(typeCode)
  );

  const candidates = [
    typeCode,
    match?.name,
  ].filter(Boolean);

  return (
    CATEGORIES.find((category) =>
      candidates.some((candidate) =>
        category.aliases.some(
          (alias) =>
            normalize(candidate) === normalize(alias)
        )
      )
    )?.name || null
  );
}

function actualAchievement(category, records) {
  if (category.name !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce((sum, item) => {
    const distance = Number(item.distance_km);

    if (!Number.isFinite(distance) || distance <= 0) {
      return sum;
    }

    return sum + Math.round(distance * 1000);
  }, 0);

  return meters / 1000;
}

// ======================================================
// SAMAPTA: RUMUS ASLI
// A = LARI 12 MENIT
// B = RATA-RATA 4 KOMPONEN
// FINAL = (A + B) / 2
// ======================================================

function calculateSamapta(records) {
  const byDate = new Map();

  records.forEach((record) => {
    if (!parseDate(record.test_date)) return;

    const date = String(record.test_date).slice(0, 10);

    if (!byDate.has(date)) {
      byDate.set(date, []);
    }

    byDate.get(date).push(record);
  });

  const results = [];

  byDate.forEach((items, date) => {
    function get(type) {
      const record = items.find(
        (item) =>
          normalize(item.test_type) === normalize(type)
      );

      if (
        !record ||
        record.score === null ||
        record.score === undefined ||
        record.score === ""
      ) {
        return null;
      }

      const score = Number(record.score);

      return Number.isFinite(score) ? score : null;
    }

    const a = get("Lari 12 Menit");

    const components = [
      get("Pull-Up"),
      get("Push-Up"),
      get("Sit-Up"),
      get("Shuttle Run"),
    ];

    if (
      a === null ||
      components.some((item) => item === null)
    ) {
      return;
    }

    const b =
      components.reduce((sum, value) => sum + value, 0) /
      components.length;

    results.push({
      date,
      a,
      b,
      final: (a + b) / 2,
    });
  });

  return results.sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ======================================================
// NILAI PER MINGGU: RUMUS ASLI
// ======================================================

function buildWeeklyScores(
  program,
  postTests,
  practices,
  samaptaResults
) {
  const weeks = GLOBAL_WEEKS.map((item) => ({
    ...item,
    available: Boolean(
      programWeekRange(program, item.week)
    ),
    theory: null,
    practice: null,
    a: null,
    b: null,
    final: null,
  }));

  const postByWeek = new Map();
  const practiceByWeek = new Map();

  function addRecord(map, record, dateField) {
    if (!insideProgram(record[dateField], program)) return;

    const week = globalWeekOf(record[dateField]);

    if (week === null) return;

    if (!map.has(week)) map.set(week, []);

    map.get(week).push(record);
  }

  postTests.forEach((item) =>
    addRecord(postByWeek, item, "test_date")
  );

  practices.forEach((item) =>
    addRecord(practiceByWeek, item, "practice_date")
  );

  weeks.forEach((item) => {
    if (!item.available) return;

    item.theory = average(postByWeek.get(item.week) || []);
    item.practice = average(
      practiceByWeek.get(item.week) || []
    );
  });

  samaptaResults.forEach((item) => {
    if (!insideProgram(item.date, program)) return;

    const week = globalWeekOf(item.date);

    if (week === null) return;

    const target = weeks[week - 1];

    if (!target?.available) return;

    target.a = item.a;
    target.b = item.b;
    target.final = item.final;
  });

  return weeks;
}

function latestValue(data, key) {
  const available = data.filter(
    (item) =>
      item.available &&
      item[key] !== null &&
      item[key] !== undefined
  );

  return available.length
    ? available[available.length - 1][key]
    : null;
}

// ======================================================
// KOMPONEN ANTARMUKA
// ======================================================

function Metric({
  label,
  value,
  detail,
  tone = "",
}) {
  return (
    <div className={`wa-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function StatusTag({ status }) {
  const normalized = normalize(status);

  const label =
    normalized === "verified"
      ? "Terverifikasi"
      : normalized === "pending"
      ? "Menunggu Verifikasi"
      : status || "Belum tersedia";

  return (
    <span
      className={
        "wa-status " +
        (normalized === "verified"
          ? "verified"
          : normalized === "pending"
          ? "pending"
          : "neutral")
      }
    >
      {label}
    </span>
  );
}

function ScoreChart({
  data,
  selectedWeek,
  onSelectWeek,
}) {
  const width = 780;
  const height = 270;

  const left = 44;
  const right = 20;
  const top = 20;
  const bottom = 40;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const x = (week) =>
    left +
    ((week - 1) / (TOTAL_WEEKS - 1)) *
      innerWidth;

  const y = (value) =>
    top +
    ((100 - Math.max(0, Math.min(100, Number(value)))) /
      100) *
      innerHeight;

  const hasData = data.some(
    (item) =>
      item.available &&
      SERIES.some((series) => item[series.key] != null)
  );

  return (
    <div className="wa-chart-container">
      <div className="wa-legend">
        {SERIES.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>

      <svg
        className="wa-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Tren nilai Teori, Praktik, dan Samapta"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#dfebf1"
              strokeDasharray="4 5"
            />

            <text
              x={left - 9}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#7a91a3"
            >
              {tick}
            </text>
          </g>
        ))}

        {[1, 5, 9, 13, 17, 21, 25].map((week) => (
          <text
            key={week}
            x={x(week)}
            y={height - 11}
            textAnchor="middle"
            fontSize="12"
            fill="#7a91a3"
          >
            W{week}
          </text>
        ))}

        {data.some((item) => item.week === selectedWeek) && (
          <line
            x1={x(selectedWeek)}
            x2={x(selectedWeek)}
            y1={top}
            y2={height - bottom}
            stroke="#b3c5d0"
            strokeDasharray="4 5"
          />
        )}

        {SERIES.map((series) => {
          const points = data
            .filter(
              (item) =>
                item.available &&
                item[series.key] != null
            )
            .map((item) => ({
              week: item.week,
              x: x(item.week),
              y: y(item[series.key]),
              value: item[series.key],
            }));

          const segments = [];
          let current = [];
          let previousWeek = null;

          points.forEach((point) => {
            if (
              previousWeek !== null &&
              point.week !== previousWeek + 1
            ) {
              if (current.length > 1) segments.push(current);
              current = [];
            }

            current.push(point);
            previousWeek = point.week;
          });

          if (current.length > 1) segments.push(current);

          return (
            <g key={series.key}>
              {segments.map((segment, index) => (
                <polyline
                  key={index}
                  points={segment
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {points.map((point) => (
                <circle
                  key={point.week}
                  cx={point.x}
                  cy={point.y}
                  r={point.week === selectedWeek ? 7 : 5}
                  fill={series.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    onSelectWeek(point.week)
                  }
                >
                  <title>
                    {series.name} · {weekLabel(point.week)} ·{" "}
                    {scoreText(point.value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {!hasData && (
        <div className="wa-empty">
          Belum ada nilai pada periode ini.
        </div>
      )}

      <p className="wa-hint">
        Tekan titik untuk memeriksa minggu tersebut.
        Minggu tanpa nilai tidak dianggap bernilai nol.
      </p>
    </div>
  );
}

function AchievementTable({
  items,
  selectedWeek,
  adminReview,
}) {
  return (
    <div className="wa-target-table">
      {items.map((item) => {
        const weekly = item.weekly[selectedWeek - 1];

        const actual = adminReview
          ? null
          : weekly?.achieved ?? null;

        const progress = adminReview
          ? null
          : weekly?.percent ?? null;

        const missing =
          actual === null
            ? null
            : Math.max(0, item.target - actual);

        return (
          <div
            className="wa-target-item"
            key={item.name}
          >
            <div className="wa-target-top">
              <strong>{item.name}</strong>

              <span>
                {actual === null
                  ? "—"
                  : `${numberText(
                      actual,
                      item.name === "Fisik" ? 3 : 0
                    )} / ${item.target} ${item.unit}`}
              </span>
            </div>

            <div className="wa-track">
              <div
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, progress || 0)
                  )}%`,
                }}
              />
            </div>

            <div className="wa-target-footer">
              <span>{percentText(progress)}</span>

              <span>
                {missing === null
                  ? "Belum ada data"
                  : missing <= 0
                  ? "Target minggu ini tercapai"
                  : `Kurang ${numberText(
                      missing,
                      item.name === "Fisik" ? 3 : 0
                    )} ${item.unit}`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function GrafikPerkembanganOJT() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const isAdminReview = programId === ADMIN_REVIEW_ID;

  const [program, setProgram] = useState(null);
  const [viewer, setViewer] = useState(null);

  const [categories, setCategories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] = useState("activities");
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showTrend, setShowTrend] = useState(true);
  const [showCalculation, setShowCalculation] = useState(false);
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = normalizeRole(viewer?.role);
  const isManager = role === "admin" || role === "mentor";

  const backPath = isAdminReview
    ? "/dashboard-peserta"
    : isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  const fetchData = useCallback(async (id) => {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description,status,distance_km"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,score")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,result_value"
        )
        .eq("program_id", id),
    ]);

    const labels = [
      "Jenis Achievement",
      "Achievement",
      "Post-Test",
      "Praktik",
      "Samapta",
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    });

    return {
      categories: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practices: results[3].data || [],
      samapta: results[4].data || [],
    };
  }, []);

  const verifyAccess = useCallback(async (id) => {
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
      throw new Error("Profil pengguna tidak ditemukan.");
    }

    const currentRole = normalizeRole(profile.role);

    if (id === ADMIN_REVIEW_ID) {
      if (currentRole !== "admin") {
        throw new Error(
          "Tinjauan grafik hanya dapat dibuka oleh Admin."
        );
      }

      return {
        user,
        profile,
        programData: null,
        adminReview: true,
      };
    }

    const manager = ["admin", "mentor"].includes(
      currentRole
    );

    const participant = ["participant", "peserta"].includes(
      currentRole
    );

    if (!manager && !participant) {
      throw new Error(
        "Akun tidak memiliki akses halaman grafik."
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
      .eq("id", id);

    if (currentRole === "mentor") {
      query = query.eq("mentor_id", user.id);
    }

    if (participant) {
      query = query.eq("participant_id", user.id);
    }

    const {
      data: programData,
      error: programError,
    } = await query.maybeSingle();

    if (programError) throw programError;

    if (!programData) {
      throw new Error(
        "Program OJT tidak ditemukan atau akses ditolak."
      );
    }

    if (!parseDate(programData.start_date)) {
      throw new Error("Tanggal mulai OJT tidak valid.");
    }

    if (
      programData.end_date &&
      !parseDate(programData.end_date)
    ) {
      throw new Error("Tanggal selesai OJT tidak valid.");
    }

    if (participant) {
      const status = normalize(programData.status);

      if (
        !["active", "approved", "aktif"].includes(status)
      ) {
        throw new Error(
          "Grafik hanya tersedia untuk program aktif."
        );
      }
    }

    return {
      user,
      profile,
      programData,
      adminReview: false,
    };
  }, []);

  const applyData = useCallback((data) => {
    setCategories(data.categories);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractices(data.practices);
    setSamapta(data.samapta);
  }, []);

  const clearData = useCallback(() => {
    setCategories([]);
    setAchievements([]);
    setPostTests([]);
    setPractices([]);
    setSamapta([]);
  }, []);

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError("ID program tidak tersedia.");
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const access = await verifyAccess(programId);

        if (!active) return;

        setViewer(access.profile);

        if (access.adminReview) {
          setProgram(null);
          clearData();
          setSelectedWeek(1);
          return;
        }

        const data = await fetchData(
          access.programData.id
        );

        if (!active) return;

        setProgram(access.programData);
        applyData(data);

        setSelectedWeek(
          initialGlobalWeek(
            access.programData,
            data.achievements
          )
        );
      } catch (err) {
        if (!active) return;

        setProgram(null);
        setViewer(null);
        clearData();

        setError(
          err?.message || "Gagal memuat data perkembangan."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [
    programId,
    verifyAccess,
    fetchData,
    applyData,
    clearData,
  ]);

  async function refresh() {
    if (loading || refreshing || !viewer) return;

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess(programId);

      if (access.user.id !== viewer.id) {
        throw new Error("Akun login berubah. Buka ulang halaman.");
      }

      setViewer(access.profile);

      if (access.adminReview) {
        setProgram(null);
        clearData();
        return;
      }

      const data = await fetchData(access.programData.id);

      setProgram(access.programData);
      applyData(data);

      const allowed = availableGlobalWeeks(
        access.programData
      ).map((item) => item.week);

      if (!allowed.includes(selectedWeek)) {
        setSelectedWeek(
          initialGlobalWeek(
            access.programData,
            data.achievements
          )
        );
      }
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // DATA MINGGUAN
  // ====================================================

  const availableWeeks = useMemo(
    () =>
      isAdminReview
        ? GLOBAL_WEEKS
        : availableGlobalWeeks(program),
    [isAdminReview, program]
  );

  const allowedWeeks = useMemo(
    () =>
      new Set(
        availableWeeks.map((item) => item.week)
      ),
    [availableWeeks]
  );

  const samaptaResults = useMemo(
    () => calculateSamapta(samapta),
    [samapta]
  );

  const weeklyScores = useMemo(() => {
    if (isAdminReview) {
      return GLOBAL_WEEKS.map((item) => ({
        ...item,
        available: true,
        theory: null,
        practice: null,
        a: null,
        b: null,
        final: null,
      }));
    }

    return program
      ? buildWeeklyScores(
          program,
          postTests,
          practices,
          samaptaResults
        )
      : [];
  }, [
    isAdminReview,
    program,
    postTests,
    practices,
    samaptaResults,
  ]);

  const categoryData = useMemo(() => {
    const verifiedRecords = achievements.filter(
      (item) =>
        normalize(item.status) === "verified" &&
        insideProgram(item.activity_date, program)
    );

    const categorized = verifiedRecords.map((item) => ({
      ...item,
      resolvedCategory: resolveCategory(
        item.type_code,
        categories
      ),
      globalWeek: globalWeekOf(item.activity_date),
    }));

    return CATEGORIES.map((category) => {
      const matching = categorized.filter(
        (item) =>
          item.resolvedCategory === category.name
      );

      const weekly = GLOBAL_WEEKS.map((global) => {
        const available = isAdminReview
          ? true
          : Boolean(
              programWeekRange(program, global.week)
            );

        const records =
          available && !isAdminReview
            ? matching.filter(
                (item) =>
                  item.globalWeek === global.week
              )
            : [];

        const achieved = isAdminReview
          ? null
          : available
          ? actualAchievement(category, records)
          : 0;

        const percent = isAdminReview
          ? null
          : available
          ? cappedPercent(
              achieved,
              category.target
            )
          : null;

        return {
          week: global.week,
          available,
          achieved,
          count: isAdminReview
            ? null
            : records.length,
          percent,
          completed:
            !isAdminReview &&
            available &&
            achieved >= category.target,
        };
      });

      const active = weekly.filter(
        (item) => item.available
      );

      const percent = isAdminReview
        ? null
        : active.length
        ? active.reduce(
            (sum, item) => sum + item.percent,
            0
          ) / active.length
        : 0;

      return {
        ...category,
        verified: isAdminReview
          ? null
          : matching.length,
        weekly,
        activeWeeks: active.length,
        completedWeeks: isAdminReview
          ? null
          : active.filter(
              (item) => item.completed
            ).length,
        percent,
      };
    });
  }, [
    achievements,
    categories,
    program,
    isAdminReview,
  ]);

  const weeklySummary = useMemo(
    () =>
      weeklyScores.map((item) => {
        const details = categoryData.map((category) => ({
          name: category.name,
          target: category.target,
          unit: category.unit,
          ...category.weekly[item.week - 1],
        }));

        if (isAdminReview) {
          return {
            ...item,
            details,
            totalActivities: null,
            activeCategories: null,
            completedThisWeek: null,
            progress: null,
          };
        }

        const totalActivities = details.reduce(
          (sum, detail) => sum + detail.count,
          0
        );

        const activeCategories = details.filter(
          (detail) => detail.count > 0
        ).length;

        const completedThisWeek = details.filter(
          (detail) => detail.completed
        ).length;

        const progress = item.available
          ? details.reduce(
              (sum, detail) =>
                sum + (detail.percent || 0),
              0
            ) / CATEGORIES.length
          : null;

        return {
          ...item,
          details,
          totalActivities,
          activeCategories,
          completedThisWeek,
          progress,
        };
      }),
    [
      weeklyScores,
      categoryData,
      isAdminReview,
    ]
  );

  const activeWeekData =
    weeklySummary.find(
      (item) =>
        item.week === selectedWeek &&
        item.available
    ) || null;

  const filteredAchievements = useMemo(
    () =>
      achievements
        .filter(
          (item) =>
            insideProgram(item.activity_date, program) &&
            globalWeekOf(item.activity_date) === selectedWeek
        )
        .map((item) => ({
          ...item,
          category:
            resolveCategory(item.type_code, categories) ||
            item.type_code,
        }))
        .sort((a, b) =>
          String(a.activity_date).localeCompare(
            String(b.activity_date)
          )
        ),
    [
      achievements,
      categories,
      program,
      selectedWeek,
    ]
  );

  const filteredPostTests = postTests.filter(
    (item) =>
      insideProgram(item.test_date, program) &&
      globalWeekOf(item.test_date) === selectedWeek
  );

  const filteredPractices = practices.filter(
    (item) =>
      insideProgram(item.practice_date, program) &&
      globalWeekOf(item.practice_date) === selectedWeek
  );

  const filteredSamapta = samapta.filter(
    (item) =>
      insideProgram(item.test_date, program) &&
      globalWeekOf(item.test_date) === selectedWeek
  );

  const verifiedCount = filteredAchievements.filter(
    (item) => normalize(item.status) === "verified"
  ).length;

  const pendingCount = filteredAchievements.filter(
    (item) => normalize(item.status) === "pending"
  ).length;

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const canShowContent =
    !loading &&
    !error &&
    !!viewer &&
    (
      (isAdminReview && role === "admin") ||
      (!isAdminReview && !!program)
    );

  const availableScores = weeklyScores.filter(
    (item) => item.available
  );

  const latestTheory = latestValue(
    availableScores,
    "theory"
  );

  const latestPractice = latestValue(
    availableScores,
    "practice"
  );

  const latestSamapta = latestValue(
    availableScores,
    "final"
  );

  const overall = isAdminReview
    ? null
    : categoryData.length
    ? categoryData.reduce(
        (sum, item) => sum + item.percent,
        0
      ) / categoryData.length
    : 0;

  const selectedPeriod = GLOBAL_WEEKS.find(
    (item) => item.week === selectedWeek
  );

  function changeWeek(week) {
    const number = Number(week);

    if (!allowedWeeks.has(number)) return;

    setSelectedWeek(number);
    setSelectedActivity(null);
  }

  function copyCorrection(item = null) {
    const detail = item
      ? [
          `Tanggal: ${formatDate(item.activity_date)}`,
          `Kategori: ${item.category}`,
          `Kegiatan: ${item.description || "Tidak ada deskripsi"}`,
          `Realisasi: ${
            item.category === "Fisik"
              ? `${numberText(item.distance_km, 3)} km`
              : "1 kegiatan"
          }`,
          `Status: ${item.status || "—"}`,
        ].join("\n")
      : [
          "Tanggal: [Isi tanggal]",
          "Kategori/Jenis Nilai: [Isi]",
          "Kegiatan: [Isi]",
          "Nilai/Realisasi tercatat: [Isi]",
        ].join("\n");

    const message = [
      "PERMOHONAN PEMERIKSAAN DATA OJT",
      "",
      `Nama Peserta: ${participantName}`,
      `Site: ${program?.site || "—"}`,
      `Minggu: ${weekLabel(selectedWeek)}`,
      `${formatDate(selectedPeriod?.start)} - ${formatDate(
        selectedPeriod?.end
      )}`,
      "",
      detail,
      "",
      "Data yang seharusnya: [Isi koreksi]",
      "Bukti pendukung: [Jika tersedia]",
      "",
      "Mohon bantuan Mentor/Admin untuk memeriksa data tersebut. Terima kasih.",
    ].join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(message)
        .then(() =>
          window.alert(
            "Format koreksi berhasil disalin. Silakan kirim ke grup koordinasi."
          )
        )
        .catch(() =>
          window.prompt(
            "Salin pesan koreksi berikut:",
            message
          )
        );
    } else {
      window.prompt(
        "Salin pesan koreksi berikut:",
        message
      );
    }
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <main className="wa-root">
      <style>{css}</style>

      <header className="wa-topbar">
        <div className="wa-brand">
          <span className="wa-brand-icon">◇</span>
          <div>
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>
            <span>
              ON THE JOB TRAINING MANAGEMENT SYSTEM
            </span>
          </div>
        </div>

        <button
          type="button"
          className="wa-top-back"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="wa-container">
        <section className="wa-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>
              Grafik <span>Perkembangan</span>
            </h1>

            <p>
              Periksa kegiatan, nilai, dan capaian OJT
              Anda setiap minggu.
            </p>
          </div>

          {viewer && (
            <div className="wa-person">
              <span className="wa-avatar">
                {initials(
                  isAdminReview
                    ? viewer.full_name
                    : participantName
                )}
              </span>

              <div>
                <strong>
                  {isAdminReview
                    ? viewer.full_name
                    : participantName}
                </strong>

                <small>
                  {isAdminReview
                    ? "Tinjauan Administrator"
                    : `${participant?.department || "—"} · ${
                        program?.site || "—"
                      }`}
                </small>

                {!isAdminReview && (
                  <small>
                    {formatDate(program?.start_date)}
                    {" – "}
                    {formatDate(program?.end_date)}
                  </small>
                )}
              </div>

              <span className="wa-program-tag">
                {isAdminReview
                  ? "PREVIEW"
                  : "OJT"}
              </span>
            </div>
          )}
        </section>

        {loading ? (
          <section className="wa-card">
            Memuat data dan memeriksa hak akses...
          </section>
        ) : !canShowContent ? (
          <section className="wa-card">
            <h2>Grafik Tidak Dapat Ditampilkan</h2>
            <div className="wa-error">
              {error || "Data tidak tersedia."}
            </div>
          </section>
        ) : (
          <>
            {isAdminReview && (
              <div className="wa-review">
                <strong>Mode Tinjauan Administrator</strong>
                <p>
                  Seluruh bagian dapat diperiksa tanpa
                  data peserta fiktif. Tidak ada
                  perubahan ke database.
                </p>
              </div>
            )}

            {/* PILIH MINGGU */}

            <section className="wa-card wa-week-panel">
              <div className="wa-section-head">
                <div>
                  <h2>Monitoring Mingguan</h2>
                  <p>
                    Pilih minggu untuk melihat data
                    kegiatan dan nilai yang tercatat.
                  </p>
                </div>

                <select
                  className="wa-select"
                  value={
                    allowedWeeks.has(selectedWeek)
                      ? selectedWeek
                      : ""
                  }
                  onChange={(event) =>
                    changeWeek(event.target.value)
                  }
                >
                  {!availableWeeks.length && (
                    <option value="">
                      Tidak ada minggu aktif
                    </option>
                  )}

                  {availableWeeks.map((item) => (
                    <option
                      key={item.week}
                      value={item.week}
                    >
                      {weekLabel(item.week)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="wa-week-strip">
                {availableWeeks.map((item) => (
                  <button
                    type="button"
                    key={item.week}
                    className={
                      "wa-week-chip " +
                      (selectedWeek === item.week
                        ? "active"
                        : "")
                    }
                    onClick={() =>
                      changeWeek(item.week)
                    }
                  >
                    W{String(item.week).padStart(2, "0")}
                  </button>
                ))}
              </div>

              <div className="wa-selected-period">
                <strong>{weekLabel(selectedWeek)}</strong>

                <span>
                  {formatDate(selectedPeriod?.start)}
                  {" – "}
                  {formatDate(selectedPeriod?.end)}
                </span>
              </div>
            </section>

            {/* RINGKASAN MINGGU */}

            <section className="wa-metrics">
              <Metric
                label="Kegiatan Terverifikasi"
                value={
                  isAdminReview
                    ? "—"
                    : numberText(verifiedCount)
                }
                detail="Achievement"
              />

              <Metric
                label="Menunggu Verifikasi"
                value={
                  isAdminReview
                    ? "—"
                    : numberText(pendingCount)
                }
                detail="Perlu diperiksa Mentor"
                tone="amber"
              />

              <Metric
                label="Nilai Teori"
                value={scoreText(activeWeekData?.theory)}
                detail="Rata-rata Post-Test"
                tone="blue"
              />

              <Metric
                label="Nilai Praktik"
                value={scoreText(activeWeekData?.practice)}
                detail="Rata-rata Praktik"
              />
            </section>

            {/* TAB KEGIATAN DAN NILAI */}

            <section className="wa-card">
              <div className="wa-section-head">
                <div>
                  <h2>Kegiatan dan Nilai Mingguan</h2>
                  <p>
                    Setiap catatan dapat diperiksa
                    untuk memastikan hasil input sesuai.
                  </p>
                </div>
              </div>

              <div className="wa-tabs">
                <button
                  type="button"
                  className={
                    activeTab === "activities" ? "active" : ""
                  }
                  onClick={() =>
                    setActiveTab("activities")
                  }
                >
                  Daftar Kegiatan
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "scores" ? "active" : ""
                  }
                  onClick={() =>
                    setActiveTab("scores")
                  }
                >
                  Rincian Nilai
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "targets" ? "active" : ""
                  }
                  onClick={() =>
                    setActiveTab("targets")
                  }
                >
                  Target Kompetensi
                </button>
              </div>

              {/* DAFTAR KEGIATAN */}

              {activeTab === "activities" && (
                <div>
                  <div className="wa-list-head">
                    <strong>
                      {isAdminReview
                        ? "Belum ada data peserta"
                        : `${filteredAchievements.length} kegiatan tercatat`}
                    </strong>

                    <span>
                      {verifiedCount} terverifikasi
                    </span>
                  </div>

                  {!filteredAchievements.length ? (
                    <div className="wa-empty">
                      Belum ada kegiatan Achievement
                      tercatat pada minggu ini.
                    </div>
                  ) : (
                    <div className="wa-activity-list">
                      {filteredAchievements.map((item) => {
                        const expanded =
                          selectedActivity === item.id;

                        return (
                          <div
                            className="wa-activity"
                            key={item.id}
                          >
                            <button
                              type="button"
                              className="wa-activity-trigger"
                              onClick={() =>
                                setSelectedActivity(
                                  expanded ? null : item.id
                                )
                              }
                            >
                              <div className="wa-activity-left">
                                <strong>
                                  {item.category}
                                </strong>

                                <span>
                                  {formatDate(
                                    item.activity_date
                                  )}
                                </span>

                                <small>
                                  {item.description ||
                                    "Deskripsi kegiatan belum tersedia"}
                                </small>
                              </div>

                              <div className="wa-activity-right">
                                <StatusTag
                                  status={item.status}
                                />

                                <span className="wa-chevron">
                                  {expanded ? "⌃" : "⌄"}
                                </span>
                              </div>
                            </button>

                            {expanded && (
                              <div className="wa-activity-expanded">
                                <div className="wa-detail-line">
                                  <span>Kategori</span>
                                  <strong>
                                    {item.category}
                                  </strong>
                                </div>

                                <div className="wa-detail-line">
                                  <span>Tanggal</span>
                                  <strong>
                                    {formatDate(
                                      item.activity_date
                                    )}
                                  </strong>
                                </div>

                                <div className="wa-detail-line">
                                  <span>Deskripsi</span>
                                  <strong>
                                    {item.description ||
                                      "Belum tersedia"}
                                  </strong>
                                </div>

                                <div className="wa-detail-line">
                                  <span>Realisasi</span>
                                  <strong>
                                    {item.category === "Fisik"
                                      ? `${numberText(
                                          item.distance_km,
                                          3
                                        )} km`
                                      : "1 kegiatan"}
                                  </strong>
                                </div>

                                <div className="wa-detail-line">
                                  <span>Status</span>
                                  <StatusTag
                                    status={item.status}
                                  />
                                </div>

                                <button
                                  type="button"
                                  className="wa-copy-button"
                                  onClick={() =>
                                    copyCorrection(item)
                                  }
                                >
                                  Salin Format Koreksi Kegiatan
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* RINCIAN NILAI */}

              {activeTab === "scores" && (
                <div className="wa-score-groups">
                  <div className="wa-score-group">
                    <div className="wa-group-heading">
                      <h3>Post-Test / Teori</h3>
                      <strong>
                        Rata-rata:{" "}
                        {scoreText(
                          activeWeekData?.theory
                        )}
                      </strong>
                    </div>

                    {!filteredPostTests.length ? (
                      <p className="wa-no-record">
                        Belum ada input nilai Teori.
                      </p>
                    ) : (
                      filteredPostTests.map((item, index) => (
                        <div
                          className="wa-score-line"
                          key={item.id || index}
                        >
                          <div>
                            <strong>
                              Post-Test {index + 1}
                            </strong>
                            <small>
                              {formatDate(item.test_date)}
                            </small>
                          </div>

                          <strong>
                            {scoreText(item.score)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="wa-score-group">
                    <div className="wa-group-heading">
                      <h3>Praktik Mingguan</h3>
                      <strong>
                        Rata-rata:{" "}
                        {scoreText(
                          activeWeekData?.practice
                        )}
                      </strong>
                    </div>

                    {!filteredPractices.length ? (
                      <p className="wa-no-record">
                        Belum ada input nilai Praktik.
                      </p>
                    ) : (
                      filteredPractices.map((item, index) => (
                        <div
                          className="wa-score-line"
                          key={item.id || index}
                        >
                          <div>
                            <strong>
                              Praktik {index + 1}
                            </strong>
                            <small>
                              {formatDate(
                                item.practice_date
                              )}
                            </small>
                          </div>

                          <strong>
                            {scoreText(item.score)}
                          </strong>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="wa-score-group">
                    <div className="wa-group-heading">
                      <h3>Samapta</h3>
                      <strong>
                        Nilai Akhir:{" "}
                        {scoreText(
                          activeWeekData?.final
                        )}
                      </strong>
                    </div>

                    {!filteredSamapta.length ? (
                      <p className="wa-no-record">
                        Belum ada catatan Samapta.
                      </p>
                    ) : (
                      filteredSamapta
                        .slice()
                        .sort((a, b) =>
                          String(a.test_date).localeCompare(
                            String(b.test_date)
                          )
                        )
                        .map((item, index) => (
                          <div
                            className="wa-score-line"
                            key={item.id || index}
                          >
                            <div>
                              <strong>
                                {item.test_type}
                              </strong>

                              <small>
                                {formatDate(item.test_date)}
                                {item.result_value !== null &&
                                  item.result_value !==
                                    undefined &&
                                  item.result_value !== "" &&
                                  ` · Hasil: ${item.result_value}`}
                              </small>
                            </div>

                            <strong>
                              {scoreText(item.score)}
                            </strong>
                          </div>
                        ))
                    )}

                    <div className="wa-samapta-summary">
                      <span>
                        A:{" "}
                        <strong>
                          {scoreText(
                            activeWeekData?.a
                          )}
                        </strong>
                      </span>

                      <span>
                        B:{" "}
                        <strong>
                          {scoreText(
                            activeWeekData?.b
                          )}
                        </strong>
                      </span>

                      <span>
                        Akhir:{" "}
                        <strong>
                          {scoreText(
                            activeWeekData?.final
                          )}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {!isAdminReview && (
                    <button
                      type="button"
                      className="wa-copy-button"
                      onClick={() =>
                        copyCorrection()
                      }
                    >
                      Salin Format Koreksi Nilai
                    </button>
                  )}
                </div>
              )}

              {/* TARGET KOMPETENSI */}

              {activeTab === "targets" && (
                <>
                  <div className="wa-list-head">
                    <strong>
                      Target vs Realisasi
                    </strong>

                    <span>
                      {weekLabel(selectedWeek)}
                    </span>
                  </div>

                  <AchievementTable
                    items={categoryData}
                    selectedWeek={selectedWeek}
                    adminReview={isAdminReview}
                  />

                  <p className="wa-hint">
                    Target ditampilkan per minggu.
                    Kegiatan hanya dihitung apabila
                    sudah terverifikasi.
                  </p>
                </>
              )}
            </section>

            {/* TREN NILAI */}

            <section className="wa-card">
              <div className="wa-section-head">
                <div>
                  <h2>Tren Perkembangan Nilai</h2>
                  <p>
                    Satu grafik untuk Teori,
                    Praktik, dan Samapta.
                  </p>
                </div>

                <button
                  type="button"
                  className="wa-small-button"
                  onClick={() =>
                    setShowTrend((previous) => !previous)
                  }
                >
                  {showTrend ? "Sembunyikan" : "Tampilkan"}
                </button>
              </div>

              {showTrend && (
                <>
                  <div className="wa-trend-summary">
                    <span>
                      Teori terakhir:
                      <strong>
                        {scoreText(latestTheory)}
                      </strong>
                    </span>

                    <span>
                      Praktik terakhir:
                      <strong>
                        {scoreText(latestPractice)}
                      </strong>
                    </span>

                    <span>
                      Samapta terakhir:
                      <strong>
                        {scoreText(latestSamapta)}
                      </strong>
                    </span>
                  </div>

                  <ScoreChart
                    data={weeklyScores}
                    selectedWeek={selectedWeek}
                    onSelectWeek={changeWeek}
                  />
                </>
              )}
            </section>

            {/* REKAP NILAI MINGGUAN */}

            <section className="wa-card">
              <div className="wa-section-head">
                <div>
                  <h2>Rekap Nilai Mingguan</h2>
                  <p>
                    Buka minggu untuk melihat
                    daftar kegiatan dan semua nilai.
                  </p>
                </div>

                <button
                  type="button"
                  className="wa-small-button"
                  onClick={() =>
                    setShowAllWeeks((previous) => !previous)
                  }
                >
                  {showAllWeeks
                    ? "Tampilkan Minggu Ini"
                    : "Lihat Semua Minggu"}
                </button>
              </div>

              <div className="wa-table-wrap">
                <table className="wa-table">
                  <thead>
                    <tr>
                      <th>Minggu</th>
                      <th>Teori</th>
                      <th>Praktik</th>
                      <th>Samapta</th>
                      <th>Kegiatan</th>
                      <th>Achievement</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>
                    {weeklySummary
                      .filter(
                        (item) =>
                          item.available &&
                          (
                            showAllWeeks ||
                            item.week === selectedWeek
                          )
                      )
                      .map((item) => (
                        <tr
                          key={item.week}
                          className={
                            item.week === selectedWeek
                              ? "selected"
                              : ""
                          }
                        >
                          <td>{weekLabel(item.week)}</td>
                          <td>{scoreText(item.theory)}</td>
                          <td>{scoreText(item.practice)}</td>
                          <td>{scoreText(item.final)}</td>
                          <td>
                            {numberText(
                              item.totalActivities
                            )}
                          </td>
                          <td>
                            {percentText(item.progress)}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => {
                                changeWeek(item.week);
                                setActiveTab("activities");

                                document
                                  .querySelector(
                                    ".wa-tabs"
                                  )
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  });
                              }}
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* PEMERIKSAAN DATA */}

            <section className="wa-correction">
              <div>
                <h2>Ada Data yang Tidak Sesuai?</h2>

                <p>
                  Jika kegiatan atau nilai belum tercatat,
                  salah input, atau belum diverifikasi,
                  peserta dapat menyampaikan koreksi
                  kepada Mentor melalui grup koordinasi
                  yang sudah tersedia.
                </p>

                <small>
                  Peserta hanya memeriksa data.
                  Perubahan nilai tetap dilakukan oleh
                  pihak yang berwenang.
                </small>
              </div>

              {!isAdminReview && (
                <button
                  type="button"
                  onClick={() =>
                    copyCorrection()
                  }
                >
                  Salin Format Koreksi
                </button>
              )}
            </section>

            {/* INFORMASI PERHITUNGAN */}

            <section className="wa-card wa-calculation">
              <button
                type="button"
                onClick={() =>
                  setShowCalculation(
                    (previous) => !previous
                  )
                }
              >
                <span>ⓘ Informasi Perhitungan</span>
                <span>
                  {showCalculation ? "−" : "+"}
                </span>
              </button>

              {showCalculation && (
                <div className="wa-calculation-content">
                  <p>
                    Kalender global Week 01–25 berlaku
                    untuk semua peserta. Week 01 adalah
                    12–18 September 2026 dan Week 25
                    berakhir pada 6 Maret 2027.
                  </p>

                  <p>
                    Tanggal di luar periode OJT peserta
                    tidak ikut dihitung. Minggu aktif
                    tanpa kegiatan bernilai 0%
                    untuk Achievement.
                  </p>

                  <p>
                    Achievement Fisik dihitung dari
                    kilometer, sedangkan lima kategori
                    lain dihitung dari jumlah kegiatan
                    terverifikasi. Persentase mingguan
                    dibatasi maksimal 100%.
                  </p>

                  <p>
                    Nilai Samapta Akhir dihitung dari
                    rata-rata Nilai A dan Nilai B.
                    Nilai B merupakan rata-rata
                    Pull-Up, Push-Up, Sit-Up, dan
                    Shuttle Run.
                  </p>
                </div>
              )}
            </section>

            <div className="wa-actions">
              <button
                type="button"
                className="wa-refresh"
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing
                  ? "Memperbarui..."
                  : "↻ Perbarui Data"}
              </button>

              <button
                type="button"
                className="wa-print"
                onClick={() => window.print()}
              >
                Cetak / Simpan
              </button>
            </div>
          </>
        )}

        <footer className="wa-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// CSS
// ======================================================

const css = `
.wa-root,
.wa-root * {
  box-sizing: border-box;
}

.wa-root {
  min-height: 100vh;
  background: #edf4f9;
  color: #173755;
  font-family: Inter, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.wa-root button,
.wa-root select {
  font: inherit;
}

.wa-root button {
  cursor: pointer;
}

.wa-root button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.wa-root button:focus-visible,
.wa-root select:focus-visible {
  outline: 3px solid #49d9bb;
  outline-offset: 2px;
}

.wa-topbar {
  min-height: 73px;
  background: #081f38;
  padding: 13px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: white;
}

.wa-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.wa-brand-icon {
  width: 43px;
  height: 43px;
  border-radius: 12px;
  background: #0d675c;
  border: 1px solid #239f8e;
  display: grid;
  place-items: center;
  color: #7af0d4;
  font-size: 24px;
}

.wa-brand strong {
  display: block;
  font-weight: 900;
  font-size: 20px;
}

.wa-brand em {
  font-style: normal;
  color: #48e0bf;
}

.wa-brand strong small {
  display: inline-block;
  background: #48e0bf;
  color: #081f38;
  padding: 3px 5px;
  margin-left: 7px;
  border-radius: 5px;
  font-size: 9px;
}

.wa-brand > div > span {
  display: block;
  color: #bfd4e3;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-top: 4px;
}

.wa-top-back {
  border: 1px solid #ffffff38;
  background: #ffffff12;
  border-radius: 9px;
  padding: 10px 13px;
  color: white;
  font-size: 12px;
  font-weight: 800;
}

.wa-container {
  max-width: 1180px;
  margin: auto;
  padding: 20px;
}

.wa-hero {
  background:
    linear-gradient(110deg,
      rgba(5,25,46,.97),
      rgba(7,49,72,.86)),
    url("/background-erg.png.PNG");
  background-size: cover;
  background-position: center;
  border-radius: 16px;
  color: white;
  padding: 27px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22px;
}

.wa-hero > div:first-child > small {
  display: block;
  color: #efbd65;
  font-weight: 900;
  font-size: 10px;
  letter-spacing: 1px;
}

.wa-hero h1 {
  margin: 12px 0 8px;
  font-size: 31px;
}

.wa-hero h1 span {
  color: #48e0bf;
}

.wa-hero p {
  margin: 0;
  color: #d9e7f0;
  font-size: 12px;
  line-height: 1.7;
}

.wa-person {
  display: flex;
  align-items: center;
  gap: 11px;
}

.wa-avatar {
  flex-shrink: 0;
  width: 49px;
  height: 49px;
  background: #dff9ed;
  color: #087c65;
  border-radius: 13px;
  display: grid;
  place-items: center;
  font-weight: 900;
}

.wa-person strong {
  display: block;
  font-size: 13px;
}

.wa-person small {
  display: block;
  color: #d8e8ee;
  font-size: 10px;
  margin-top: 5px;
  line-height: 1.5;
}

.wa-program-tag {
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 900;
  background: #d6f6e5;
  color: #087d60;
}

.wa-card {
  padding: 20px;
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 15px;
  margin-bottom: 15px;
  min-width: 0;
  box-shadow: 0 4px 16px #123b500a;
}

.wa-card h2 {
  margin: 0 0 7px;
  color: #123d71;
  font-size: 18px;
}

.wa-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  margin-bottom: 16px;
}

.wa-section-head p {
  margin: 0;
  color: #728b9f;
  line-height: 1.6;
  font-size: 11px;
}

.wa-select {
  min-width: 130px;
  max-width: 100%;
  padding: 10px;
  background: white;
  border: 1px solid #ccdeea;
  border-radius: 9px;
  color: #17466e;
  font-size: 12px;
  font-weight: 800;
}

.wa-week-strip {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 3px 2px 10px;
  scrollbar-width: thin;
}

.wa-week-chip {
  flex: 0 0 auto;
  min-width: 53px;
  padding: 11px 9px;
  background: #f4f8fb;
  border: 1px solid #dce7ef;
  border-radius: 10px;
  color: #4c6a81;
  font-size: 11px;
  font-weight: 800;
}

.wa-week-chip.active {
  background: #087d67;
  color: white;
  border-color: #087d67;
}

.wa-selected-period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 9px;
  background: #ecf8f3;
  border-radius: 10px;
  color: #126d58;
  padding: 12px 14px;
  font-size: 12px;
}

.wa-selected-period strong {
  font-size: 16px;
}

.wa-metrics {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.wa-metric {
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  padding: 17px;
  min-width: 0;
}

.wa-metric span {
  display: block;
  font-size: 11px;
  color: #6a849a;
}

.wa-metric strong {
  display: block;
  font-size: 27px;
  color: #087d67;
  margin: 8px 0 5px;
  overflow-wrap: anywhere;
}

.wa-metric small {
  display: block;
  font-size: 10px;
  color: #8a9bab;
}

.wa-metric.blue strong {
  color: #2670d6;
}

.wa-metric.amber strong {
  color: #bb852b;
}

.wa-tabs {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 8px;
  margin-bottom: 17px;
}

.wa-tabs button {
  padding: 12px 8px;
  background: #f3f8fb;
  border: 1px solid #dce7ef;
  color: #56738c;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
}

.wa-tabs button.active {
  background: #0b7966;
  color: white;
  border-color: #0b7966;
}

.wa-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.wa-list-head strong {
  font-size: 13px;
}

.wa-list-head span {
  color: #718b9e;
  font-size: 11px;
}

.wa-activity-list {
  display: grid;
  gap: 9px;
}

.wa-activity {
  border: 1px solid #dce7ef;
  border-radius: 11px;
  overflow: hidden;
}

.wa-activity-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: white;
  border: 0;
  width: 100%;
  text-align: left;
  padding: 13px;
  color: #173755;
}

.wa-activity-left {
  min-width: 0;
}

.wa-activity-left strong,
.wa-activity-left span,
.wa-activity-left small {
  display: block;
}

.wa-activity-left strong {
  font-size: 13px;
}

.wa-activity-left span {
  color: #7a8f9f;
  font-size: 10px;
  margin-top: 4px;
}

.wa-activity-left small {
  color: #627f94;
  font-size: 11px;
  line-height: 1.5;
  margin-top: 5px;
  overflow-wrap: anywhere;
}

.wa-activity-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.wa-chevron {
  font-size: 19px;
  color: #608097;
}

.wa-status {
  display: inline-flex;
  border-radius: 20px;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.wa-status.verified {
  background: #ddf6e8;
  color: #087d63;
}

.wa-status.pending {
  background: #fff2dc;
  color: #a97922;
}

.wa-status.neutral {
  background: #edf1f4;
  color: #5f7483;
}

.wa-activity-expanded {
  padding: 14px;
  background: #f8fbfd;
  border-top: 1px solid #e2ecf1;
}

.wa-detail-line {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #e6eef3;
  font-size: 12px;
}

.wa-detail-line span:first-child {
  color: #6b859b;
}

.wa-detail-line > strong {
  text-align: right;
  overflow-wrap: anywhere;
}

.wa-copy-button {
  width: 100%;
  border: 1px solid #087d67;
  background: #087d67;
  color: white;
  padding: 12px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  margin-top: 14px;
}

.wa-score-groups {
  display: grid;
  gap: 15px;
}

.wa-score-group {
  border: 1px solid #e0e9ef;
  border-radius: 12px;
  padding: 15px;
}

.wa-group-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  border-bottom: 1px solid #edf1f4;
}

.wa-group-heading h3 {
  margin: 0;
  color: #153e67;
  font-size: 14px;
}

.wa-group-heading strong {
  color: #087b64;
  font-size: 12px;
}

.wa-score-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #edf1f4;
}

.wa-score-line:last-child {
  border-bottom: none;
}

.wa-score-line strong {
  font-size: 12px;
}

.wa-score-line small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #8295a5;
}

.wa-score-line > strong {
  font-size: 16px;
  color: #087c65;
}

.wa-no-record {
  font-size: 12px;
  color: #8296a5;
}

.wa-samapta-summary {
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: #eff8f5;
  border-radius: 9px;
  padding: 12px;
  font-size: 11px;
  color: #426e62;
}

.wa-target-table {
  display: grid;
  gap: 17px;
  margin-top: 16px;
}

.wa-target-item {
  display: grid;
  gap: 8px;
}

.wa-target-top,
.wa-target-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.wa-target-top {
  font-size: 12px;
}

.wa-target-top span {
  color: #638097;
}

.wa-track {
  height: 10px;
  background: #e6eef1;
  border-radius: 20px;
  overflow: hidden;
}

.wa-track > div {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(
    90deg,
    #0b9479,
    #4bc9a9
  );
}

.wa-target-footer {
  font-size: 10px;
  color: #71899a;
}

.wa-trend-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.wa-trend-summary > span {
  flex: 1 1 130px;
  display: block;
  background: #f1f7fa;
  border-radius: 9px;
  padding: 11px;
  color: #6f8699;
  font-size: 11px;
}

.wa-trend-summary strong {
  display: block;
  font-size: 17px;
  color: #184c7d;
  margin-top: 5px;
}

.wa-chart {
  width: 100%;
  height: auto;
  display: block;
  margin-top: 12px;
}

.wa-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 17px;
}

.wa-legend span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #658199;
  font-size: 11px;
}

.wa-legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: block;
}

.wa-hint {
  color: #8397a8;
  font-size: 11px;
  line-height: 1.7;
  margin: 13px 0 0;
}

.wa-empty {
  text-align: center;
  border: 1px dashed #d2e0e8;
  padding: 17px;
  color: #8095a5;
  background: #f9fbfc;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.7;
  margin-top: 12px;
}

.wa-small-button {
  border: 1px solid #c5e5dc;
  background: #e7f7f0;
  color: #08775e;
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.wa-table-wrap {
  overflow-x: auto;
}

.wa-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.wa-table th {
  background: #f0f6f9;
  color: #667f92;
  text-align: left;
  padding: 12px;
  white-space: nowrap;
}

.wa-table td {
  border-bottom: 1px solid #e9eff3;
  padding: 12px;
  color: #375568;
  white-space: nowrap;
}

.wa-table tr.selected td {
  background: #eaf8f2;
}

.wa-table button {
  border: 0;
  background: #e0f5e9;
  color: #087a5c;
  border-radius: 8px;
  padding: 8px 10px;
  font-weight: 800;
  font-size: 11px;
}

.wa-correction {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 15px;
  background: #e0f3eb;
  border: 1px solid #b9e5d5;
}

.wa-correction h2 {
  font-size: 17px;
  margin: 0 0 8px;
  color: #0b6855;
}

.wa-correction p {
  color: #376b5c;
  font-size: 12px;
  line-height: 1.7;
  margin: 0 0 9px;
}

.wa-correction small {
  color: #638c7c;
  font-size: 10px;
}

.wa-correction button {
  flex-shrink: 0;
  padding: 12px 15px;
  border-radius: 10px;
  background: #087d67;
  color: white;
  border: 0;
  font-size: 12px;
  font-weight: 800;
}

.wa-calculation > button {
  width: 100%;
  padding: 4px 0;
  background: transparent;
  color: #184c72;
  border: 0;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  font-weight: 800;
}

.wa-calculation-content {
  margin-top: 14px;
  border-radius: 10px;
  background: #f1f8f5;
  color: #55776d;
  font-size: 12px;
  padding: 14px;
  line-height: 1.8;
}

.wa-calculation-content p {
  margin: 0 0 11px;
}

.wa-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 15px;
}

.wa-actions button {
  border: 1px solid #c6ded7;
  border-radius: 10px;
  background: white;
  color: #0b745c;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 800;
}

.wa-actions .wa-refresh {
  background: #087d67;
  border-color: #087d67;
  color: white;
}

.wa-review {
  margin-bottom: 15px;
  padding: 15px;
  border-radius: 11px;
  background: #e7f7ee;
  border: 1px solid #bde2cb;
  color: #17694f;
  font-size: 12px;
  line-height: 1.7;
}

.wa-review p {
  margin: 6px 0 0;
}

.wa-error {
  padding: 13px;
  background: #fff0f1;
  color: #b42336;
  border-radius: 9px;
  font-size: 12px;
}

.wa-footer {
  text-align: center;
  border-top: 1px solid #dce7ef;
  padding: 20px 5px;
  color: #879aab;
  font-size: 10px;
}

@media (max-width: 900px) {
  .wa-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .wa-metrics {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .wa-correction {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 600px) {
  .wa-topbar {
    padding: 12px;
  }

  .wa-brand-icon {
    width: 35px;
    height: 35px;
  }

  .wa-brand strong {
    font-size: 17px;
  }

  .wa-brand > div > span {
    font-size: 6px;
    letter-spacing: .4px;
  }

  .wa-top-back {
    padding: 9px;
    font-size: 10px;
  }

  .wa-container {
    padding: 11px;
  }

  .wa-hero {
    padding: 20px 17px;
    border-radius: 13px;
  }

  .wa-hero h1 {
    font-size: 25px;
  }

  .wa-person {
    flex-wrap: wrap;
  }

  .wa-card {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 12px;
  }

  .wa-card h2 {
    font-size: 16px;
  }

  .wa-section-head {
    flex-wrap: wrap;
  }

  .wa-select {
    width: 100%;
  }

  .wa-metrics {
    gap: 8px;
  }

  .wa-metric {
    padding: 13px;
  }

  .wa-metric strong {
    font-size: 23px;
  }

  .wa-tabs {
    gap: 5px;
  }

  .wa-tabs button {
    font-size: 10px;
    padding: 11px 5px;
  }

  .wa-activity-trigger {
    align-items: flex-start;
  }

  .wa-activity-right {
    display: grid;
    justify-items: end;
    gap: 5px;
  }

  .wa-status {
    font-size: 9px;
  }

  .wa-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@page {
  size: A4 landscape;
  margin: 9mm;
}

@media print {
  .wa-root {
    background: white !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .wa-topbar,
  .wa-week-strip,
  .wa-tabs,
  .wa-small-button,
  .wa-copy-button,
  .wa-correction button,
  .wa-actions,
  .wa-calculation {
    display: none !important;
  }

  .wa-container {
    max-width: none;
    padding: 0;
  }

  .wa-card {
    box-shadow: none;
    break-inside: avoid;
  }

  .wa-table-wrap {
    overflow: visible;
  }

  .wa-metrics {
    grid-template-columns:
      repeat(4,minmax(0,1fr));
  }
}
`;
