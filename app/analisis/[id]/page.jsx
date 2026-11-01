
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// SIMPLE PROGRESS ANALYTICS - DESIGN A
//
// FILE: app/analisis/[id]/page.jsx
//
// - Satu grafik utama
// - Tiga ringkasan nilai
// - Enam kompetensi
// - Detail minggu interaktif
// - Admin Review permanen
// - Tanpa perubahan database
// =====================================================

const TOTAL_WEEKS = 25;
const ADMIN_REVIEW_ID = "admin-review";

const C = {
  navy: "#081f38",
  navy2: "#103653",
  emerald: "#07856a",
  teal: "#40d9b6",
  blue: "#2563eb",
  orange: "#e7a438",
  bg: "#edf4f9",
  white: "#ffffff",
  text: "#173755",
  muted: "#6f879d",
  border: "#dce7ef",
  gray: "#e7edf1",
};

const CATEGORIES = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    aliases: ["fisik", "physical"],
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
    aliases: [
      "training",
      "internaltraining",
      "pelatihan",
    ],
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "👥",
    aliases: ["sosialisasi", "socialization"],
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "💬",
    aliases: ["coaching", "pembinaan"],
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🧭",
    aliases: [
      "orientasi",
      "orientasiarea",
      "areaorientation",
    ],
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    aliases: [
      "hazard",
      "hazardidentification",
      "identifikasibahaya",
    ],
  },
];

const SERIES = [
  {
    key: "theory",
    name: "Teori (Post-Test)",
    color: C.emerald,
  },
  {
    key: "practice",
    name: "Praktik Mingguan",
    color: C.blue,
  },
  {
    key: "final",
    name: "Samapta Akhir",
    color: C.orange,
  },
];

// =====================================================
// UTILITIES ASLI
// =====================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

function numberText(value, digits = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
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
    String(name || "Peserta OJT")
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

// =====================================================
// KALENDER GLOBAL ASLI
//
// WEEK 01: 12-18 SEPTEMBER 2026
// 19 SEPTEMBER DIKECUALIKAN
// WEEK 02: 20-26 SEPTEMBER 2026
// WEEK 25: 28 FEBRUARI-06 MARET 2027
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
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(
      (item) =>
        date >= item.start &&
        date <= item.end
    )?.week ?? null
  );
}

function getGlobalWeek(week) {
  return (
    GLOBAL_WEEKS.find(
      (item) => item.week === Number(week)
    ) || null
  );
}

function programWeekRange(program, week) {
  const global = getGlobalWeek(week);

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startDate = String(program.start_date)
    .slice(0, 10);

  const endDate = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startDate
      ? global.start
      : startDate;

  const end =
    endDate && endDate < global.end
      ? endDate
      : global.end;

  if (start > end) return null;

  return { start, end };
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

  if (
    date <
    String(program.start_date).slice(0, 10)
  ) {
    return false;
  }

  if (
    parseDate(program.end_date) &&
    date >
      String(program.end_date).slice(0, 10)
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
    const range = programWeekRange(
      program,
      item.week
    );

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
    .map((item) =>
      globalWeekOf(item.activity_date)
    )
    .filter(Boolean);

  if (recorded.length) {
    return Math.max(...recorded);
  }

  const upcoming = available.find(
    (item) => item.end >= now
  );

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// =====================================================
// ACHIEVEMENT — RUMUS ASLI
// =====================================================

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

    if (
      !Number.isFinite(distance) ||
      distance <= 0
    ) {
      return sum;
    }

    return sum + Math.round(distance * 1000);
  }, 0);

  return meters / 1000;
}

// =====================================================
// SAMAPTA — RUMUS ASLI
// NILAI A = LARI 12 MENIT
// NILAI B = RATA-RATA 4 KOMPONEN
// NILAI AKHIR = (A+B)/2
// =====================================================

function calculateSamapta(records) {
  const byDate = new Map();

  records.forEach((record) => {
    if (!parseDate(record.test_date)) return;

    const date = String(record.test_date)
      .slice(0, 10);

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

      return Number.isFinite(score)
        ? score
        : null;
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
      components.reduce(
        (sum, value) => sum + value,
        0
      ) / components.length;

    results.push({
      date,
      a,
      b,
      final: (a + b) / 2,
    });
  });

  return results.sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

// =====================================================
// NILAI MINGGUAN — RUMUS ASLI
// =====================================================

function buildWeeklyScores(
  program,
  postTests,
  practices,
  samaptaResults
) {
  const weeks = GLOBAL_WEEKS.map((item) => ({
    week: item.week,
    start: item.start,
    end: item.end,
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
    if (!insideProgram(record[dateField], program)) {
      return;
    }

    const week = globalWeekOf(record[dateField]);

    if (week === null) return;

    if (!map.has(week)) {
      map.set(week, []);
    }

    map.get(week).push(record);
  }

  postTests.forEach((item) =>
    addRecord(postByWeek, item, "test_date")
  );

  practices.forEach((item) =>
    addRecord(
      practiceByWeek,
      item,
      "practice_date"
    )
  );

  weeks.forEach((item) => {
    if (!item.available) return;

    item.theory = average(
      postByWeek.get(item.week) || []
    );

    item.practice = average(
      practiceByWeek.get(item.week) || []
    );
  });

  samaptaResults.forEach((item) => {
    if (!insideProgram(item.date, program)) {
      return;
    }

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

// =====================================================
// GRAFIK UTAMA
// MINGGU TANPA NILAI TIDAK DISAMBUNG
// =====================================================

function TrendChart({
  data,
  onSelectWeek,
}) {
  const [focusedWeek, setFocusedWeek] = useState(null);

  const width = 780;
  const height = 295;

  const left = 48;
  const right = 22;
  const top = 24;
  const bottom = 44;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const x = (week) =>
    left +
    ((week - 1) / (TOTAL_WEEKS - 1)) *
      innerWidth;

  const y = (value) =>
    top +
    (
      (100 - Math.max(
        0,
        Math.min(100, Number(value))
      )) / 100
    ) * innerHeight;

  const hasData = data.some(
    (point) =>
      point.available &&
      SERIES.some(
        (series) =>
          point[series.key] != null
      )
  );

  const selected = data.find(
    (item) =>
      item.week === focusedWeek &&
      item.available
  );

  return (
    <div className="sp-chart-wrap">
      <div className="sp-legend">
        {SERIES.map((series) => (
          <span key={series.key}>
            <i
              style={{
                background: series.color,
              }}
            />
            {series.name}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="sp-chart"
        role="img"
        aria-label="Grafik perkembangan nilai Teori, Praktik, dan Samapta selama kalender OJT"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#dae5eb"
              strokeDasharray="4 5"
            />

            <text
              x={left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#778da0"
            >
              {tick}
            </text>
          </g>
        ))}

        {[1, 5, 9, 13, 17, 21, 25].map(
          (week) => (
            <text
              key={week}
              x={x(week)}
              y={height - 12}
              textAnchor="middle"
              fontSize="12"
              fill="#778da0"
            >
              W{week}
            </text>
          )
        )}

        {selected && (
          <line
            x1={x(selected.week)}
            x2={x(selected.week)}
            y1={top}
            y2={height - bottom}
            stroke="#7893a7"
            strokeDasharray="5 5"
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
              if (current.length > 1) {
                segments.push(current);
              }

              current = [];
            }

            current.push(point);
            previousWeek = point.week;
          });

          if (current.length > 1) {
            segments.push(current);
          }

          return (
            <g key={series.key}>
              {segments.map((segment, index) => (
                <polyline
                  key={index}
                  points={segment
                    .map(
                      (point) =>
                        `${point.x},${point.y}`
                    )
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
                  r={
                    selected?.week === point.week
                      ? 7
                      : 5
                  }
                  fill={series.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setFocusedWeek(point.week);
                    onSelectWeek(point.week);
                  }}
                >
                  <title>
                    {series.name} ·{" "}
                    {weekLabel(point.week)}
                    {" · "}
                    {scoreText(point.value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="sp-chart-detail">
          <strong>
            {weekLabel(selected.week)}
          </strong>

          <div className="sp-chart-detail-values">
            {SERIES.map((series) => (
              <span key={series.key}>
                <i
                  style={{
                    background: series.color,
                  }}
                />

                {series.name}:{" "}
                <strong>
                  {scoreText(
                    selected[series.key]
                  )}
                </strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="sp-empty">
          Belum ada nilai yang tercatat
          pada periode ini.
        </div>
      )}

      <p className="sp-hint">
        Tekan titik grafik untuk memilih minggu.
        Minggu tanpa nilai tidak dianggap 0
        dan garis tidak disambungkan melewati
        minggu kosong.
      </p>
    </div>
  );
}

// =====================================================
// KARTU INFORMASI
// =====================================================

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = "green",
}) {
  return (
    <div className={`sp-metric sp-${tone}`}>
      <div className="sp-metric-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  icon,
}) {
  return (
    <div className="sp-section-heading">
      <div className="sp-section-icon">
        {icon}
      </div>

      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function CompetencyList({
  items,
  totalWeeks,
  adminReview,
}) {
  return (
    <div className="sp-competency-list">
      {items.map((item) => (
        <div
          key={item.name}
          className="sp-competency-item"
        >
          <div className="sp-competency-top">
            <span>
              {item.icon}{" "}
              <strong>{item.name}</strong>
            </span>

            <strong className="sp-percentage">
              {adminReview
                ? "—"
                : percentText(item.percent)}
            </strong>
          </div>

          <div className="sp-progress-track">
            {!adminReview && (
              <div
                className="sp-progress-fill"
                style={{
                  width: `${
                    Math.max(
                      0,
                      Math.min(100, item.percent || 0)
                    )
                  }%`,
                }}
              />
            )}
          </div>

          <div className="sp-competency-bottom">
            <span>
              {adminReview
                ? "Belum ada data peserta"
                : `${item.completedWeeks}/${totalWeeks} minggu mencapai target`}
            </span>

            <span>
              {adminReview
                ? "—"
                : `${item.verified} kegiatan terverifikasi`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function GrafikPerkembanganOJT() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const isAdminReview =
    programId === ADMIN_REVIEW_ID;

  const [program, setProgram] = useState(null);
  const [viewer, setViewer] = useState(null);

  const [categories, setCategories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practice, setPractice] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [range, setRange] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [showFullRecap, setShowFullRecap] =
    useState(false);

  const [showSamaptaDetail, setShowSamaptaDetail] =
    useState(false);

  const [showCalculationInfo, setShowCalculationInfo] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = normalizeRole(viewer?.role);

  const isManager =
    role === "admin" ||
    role === "mentor";

  const backPath = isAdminReview
    ? "/dashboard-peserta"
    : isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  // ===================================================
  // BACA DATABASE - QUERY ASLI
  // ===================================================

  const fetchData = useCallback(async (id) => {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,status,distance_km"
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
      "Kategori",
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
      practice: results[3].data || [],
      samapta: results[4].data || [],
    };
  }, []);

  // ===================================================
  // VALIDASI AKSES ASLI
  // ===================================================

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
      throw new Error(
        "Profil pengguna tidak ditemukan."
      );
    }

    const currentRole = normalizeRole(
      profile.role
    );

    if (id === ADMIN_REVIEW_ID) {
      if (currentRole !== "admin") {
        throw new Error(
          "Tinjauan Grafik Perkembangan hanya dapat dibuka oleh Admin."
        );
      }

      return {
        user,
        profile,
        programData: null,
        adminReview: true,
      };
    }

    const manager = [
      "admin",
      "mentor",
    ].includes(currentRole);

    const participant = [
      "participant",
      "peserta",
    ].includes(currentRole);

    if (!manager && !participant) {
      throw new Error(
        "Akun tidak memiliki izin membuka grafik."
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
      query = query.eq(
        "participant_id",
        user.id
      );
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
      throw new Error(
        "Tanggal mulai OJT tidak valid."
      );
    }

    if (
      programData.end_date &&
      !parseDate(programData.end_date)
    ) {
      throw new Error(
        "Tanggal selesai OJT tidak valid."
      );
    }

    if (participant) {
      const status = normalize(
        programData.status
      );

      if (
        !["active", "approved", "aktif"].includes(
          status
        )
      ) {
        throw new Error(
          "Grafik peserta hanya tersedia untuk program aktif atau disetujui."
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
    setPractice(data.practice);
    setSamapta(data.samapta);
  }, []);

  const clearData = useCallback(() => {
    setCategories([]);
    setAchievements([]);
    setPostTests([]);
    setPractice([]);
    setSamapta([]);
  }, []);

  // ===================================================
  // LOAD AWAL
  // ===================================================

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError(
        "ID program OJT tidak tersedia."
      );
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setProgram(null);
      setViewer(null);
      clearData();

      try {
        const access = await verifyAccess(
          programId
        );

        if (!active) return;

        if (access.adminReview) {
          setViewer(access.profile);
          setProgram(null);
          setSelectedWeek(1);
          return;
        }

        const data = await fetchData(
          access.programData.id
        );

        if (!active) return;

        setProgram(access.programData);
        setViewer(access.profile);
        applyData(data);

        const initialWeek = initialGlobalWeek(
          access.programData,
          data.achievements
        );

        setSelectedWeek(initialWeek);
      } catch (err) {
        if (active) {
          setProgram(null);
          setViewer(null);
          clearData();

          setError(
            err?.message ||
              "Gagal memuat Grafik Perkembangan."
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
  }, [
    programId,
    verifyAccess,
    fetchData,
    applyData,
    clearData,
  ]);

  // ===================================================
  // REFRESH DATA
  // ===================================================

  async function refresh() {
    if (loading || refreshing || !viewer) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess(
        programId
      );

      if (access.user.id !== viewer.id) {
        throw new Error(
          "Akun login berubah. Buka ulang halaman."
        );
      }

      if (access.adminReview) {
        setProgram(null);
        clearData();
        setViewer(access.profile);
        return;
      }

      const data = await fetchData(
        access.programData.id
      );

      setProgram(access.programData);
      setViewer(access.profile);
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
      setProgram(null);
      setViewer(null);
      clearData();

      setError(
        err?.message ||
          "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // MINGGU DAN FILTER
  // ===================================================

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
        availableWeeks.map(
          (item) => item.week
        )
      ),
    [availableWeeks]
  );

  const filteredWeeks = useMemo(() => {
    if (range === "first") {
      return availableWeeks
        .filter((item) => item.week <= 13)
        .map((item) => item.week);
    }

    if (range === "second") {
      return availableWeeks
        .filter((item) => item.week >= 14)
        .map((item) => item.week);
    }

    if (range === "selected") {
      return allowedWeeks.has(selectedWeek)
        ? [selectedWeek]
        : [];
    }

    return availableWeeks.map(
      (item) => item.week
    );
  }, [
    range,
    availableWeeks,
    allowedWeeks,
    selectedWeek,
  ]);

  // ===================================================
  // NILAI PROGRAM
  // ===================================================

  const samaptaResults = useMemo(
    () => calculateSamapta(samapta),
    [samapta]
  );

  const weeklyData = useMemo(() => {
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
          practice,
          samaptaResults
        )
      : [];
  }, [
    isAdminReview,
    program,
    postTests,
    practice,
    samaptaResults,
  ]);

  const filteredData = useMemo(
    () =>
      weeklyData.filter(
        (item) =>
          item.available &&
          filteredWeeks.includes(item.week)
      ),
    [weeklyData, filteredWeeks]
  );

  const theoryLatest = latestValue(
    weeklyData,
    "theory"
  );

  const practiceLatest = latestValue(
    weeklyData,
    "practice"
  );

  const samaptaLatest = latestValue(
    weeklyData,
    "final"
  );

  // ===================================================
  // KOMPETENSI — LOGIKA ASLI
  // ===================================================

  const categoryData = useMemo(() => {
    const verifiedRecords = achievements.filter(
      (item) =>
        normalize(item.status) === "verified" &&
        insideProgram(item.activity_date, program)
    );

    const categorizedRecords =
      verifiedRecords.map((item) => ({
        ...item,
        resolvedCategory: resolveCategory(
          item.type_code,
          categories
        ),
        globalWeek: globalWeekOf(
          item.activity_date
        ),
      }));

    return CATEGORIES.map((category) => {
      const matching = categorizedRecords.filter(
        (item) =>
          item.resolvedCategory === category.name
      );

      const weekly = GLOBAL_WEEKS.map(
        (global) => {
          const available = isAdminReview
            ? true
            : Boolean(
                programWeekRange(
                  program,
                  global.week
                )
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
            ? actualAchievement(
                category,
                records
              )
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
            start: global.start,
            end: global.end,
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
        }
      );

      const active = weekly.filter(
        (item) => item.available
      );

      const percent = isAdminReview
        ? null
        : active.length
        ? active.reduce(
            (sum, item) =>
              sum + item.percent,
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

  const totalAvailableWeeks =
    availableWeeks.length;

  const overall = isAdminReview
    ? null
    : categoryData.length
    ? categoryData.reduce(
        (sum, category) =>
          sum + category.percent,
        0
      ) / categoryData.length
    : 0;

  const completedCategories = isAdminReview
    ? null
    : categoryData.filter(
        (item) =>
          item.activeWeeks > 0 &&
          item.completedWeeks === item.activeWeeks
      ).length;

  const totalVerified = isAdminReview
    ? null
    : categoryData.reduce(
        (sum, item) =>
          sum + item.verified,
        0
      );

  // ===================================================
  // RINGKASAN MINGGUAN — LOGIKA ASLI
  // ===================================================

  const weeklySummary = useMemo(
    () =>
      weeklyData.map((item) => {
        const details = categoryData.map(
          (category) => ({
            name: category.name,
            icon: category.icon,
            unit: category.unit,
            target: category.target,
            ...category.weekly[item.week - 1],
          })
        );

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
          (sum, detail) =>
            sum + detail.count,
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
      weeklyData,
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

  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name ||
    "Peserta OJT";

  const canShowContent =
    !loading &&
    !error &&
    !!viewer &&
    (
      (isAdminReview && role === "admin") ||
      (!isAdminReview && !!program)
    );

  function selectWeek(week) {
    if (!allowedWeeks.has(Number(week))) {
      return;
    }

    setSelectedWeek(Number(week));
  }

  function printPage() {
    window.print();
  }

  // ===================================================
  // UI DESAIN A
  // ===================================================

  return (
    <main className="sp-root">
      <style>{css}</style>

      {/* HEADER */}

      <header className="sp-topbar">
        <div className="sp-brand">
          <span className="sp-logo">
            ↗
          </span>

          <div>
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>

            <span>
              ON THE JOB TRAINING
              MANAGEMENT SYSTEM
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sp-back"
          onClick={() =>
            router.push(backPath)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="sp-container">
        {/* HERO */}

        <section className="sp-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP ·
              PT BERAU COAL
            </small>

            <h1>
              Grafik <span>Perkembangan</span>
            </h1>

            <p>
              Monitoring Teori, Praktik,
              Samapta, dan enam kompetensi OJT.
            </p>
          </div>

          {isAdminReview && viewer && (
            <div className="sp-person">
              <div className="sp-avatar">
                {initials(viewer.full_name)}
              </div>

              <div>
                <strong>
                  {viewer.full_name || "Administrator"}
                </strong>

                <small>
                  Tinjauan Grafik Perkembangan
                  <br />
                  Tanpa data peserta fiktif
                </small>
              </div>

              <span className="sp-status">
                ADMIN
              </span>
            </div>
          )}

          {!isAdminReview && program && (
            <div className="sp-person">
              <div className="sp-avatar">
                {initials(participantName)}
              </div>

              <div>
                <strong>
                  {participantName}
                </strong>

                <small>
                  {participant?.department || "—"}
                  {" · "}
                  {program.site || "—"}
                  <br />
                  {formatDate(program.start_date)}
                  {" – "}
                  {formatDate(program.end_date)}
                  <br />
                  Dibuka oleh:{" "}
                  {viewer?.full_name || "—"}
                </small>
              </div>

              <span className="sp-status">
                {["active", "approved", "aktif"].includes(
                  normalize(program.status)
                )
                  ? "Aktif"
                  : program.status || "—"}
              </span>
            </div>
          )}
        </section>

        {loading ? (
          <section className="sp-card">
            <h2>
              Memuat Grafik Perkembangan...
            </h2>

            <p className="sp-hint">
              Memeriksa akun dan hak akses.
            </p>
          </section>
        ) : !canShowContent ? (
          <section className="sp-card">
            <h2>
              Grafik Tidak Dapat Ditampilkan
            </h2>

            <div className="sp-error">
              {error ||
                "Data peserta tidak tersedia."}
            </div>

            <button
              type="button"
              className="sp-btn"
              onClick={() =>
                router.push(backPath)
              }
            >
              Kembali
            </button>
          </section>
        ) : (
          <>
            {isAdminReview && (
              <div className="sp-review">
                <strong>
                  Mode Tinjauan Administrator
                </strong>

                <p>
                  Tampilan dapat diperiksa tanpa
                  memilih peserta. Seluruh nilai
                  ditampilkan kosong dan tidak ada
                  data fiktif maupun perubahan database.
                </p>
              </div>
            )}

            {/* ===========================
                TIGA KARTU UTAMA
                =========================== */}

            <section className="sp-metrics">
              <MetricCard
                label="Nilai Teori Terakhir"
                value={scoreText(theoryLatest)}
                detail="Post-Test"
                icon="📘"
                tone="blue"
              />

              <MetricCard
                label="Nilai Praktik Terakhir"
                value={scoreText(practiceLatest)}
                detail="Praktik Mingguan"
                icon="⚙️"
                tone="green"
              />

              <MetricCard
                label="Achievement OJT"
                value={percentText(overall)}
                detail={
                  isAdminReview
                    ? "Belum ada data"
                    : `${completedCategories} dari 6 kategori lengkap`
                }
                icon="🎯"
                tone="green"
              />
            </section>

            {/* ===========================
                GRAFIK UTAMA
                =========================== */}

            <section className="sp-card">
              <div className="sp-card-header">
                <SectionHeader
                  title="Tren Nilai OJT"
                  subtitle="Perkembangan nilai Teori, Praktik, dan Samapta selama kalender global."
                  icon="📈"
                />

                <select
                  className="sp-select"
                  value={range}
                  onChange={(event) =>
                    setRange(event.target.value)
                  }
                  aria-label="Pilih periode grafik"
                >
                  <option value="all">
                    Week 01–25
                  </option>

                  <option value="first">
                    Week 01–13
                  </option>

                  <option value="second">
                    Week 14–25
                  </option>

                  <option value="selected">
                    Minggu Terpilih
                  </option>
                </select>
              </div>

              <TrendChart
                data={filteredData}
                onSelectWeek={selectWeek}
              />

              <div className="sp-filter-note">
                <span>
                  {filteredWeeks.length} minggu
                  dalam filter.
                </span>

                <span>
                  Minggu aktif peserta:{" "}
                  {totalAvailableWeeks}
                </span>
              </div>
            </section>

            {/* ===========================
                ENAM KOMPETENSI
                =========================== */}

            <section className="sp-card">
              <div className="sp-card-header">
                <SectionHeader
                  title="Pencapaian Enam Kompetensi"
                  subtitle="Rata-rata pencapaian target pada minggu aktif peserta."
                  icon="🎯"
                />

                <span className="sp-overall-pill">
                  {percentText(overall)}
                </span>
              </div>

              <CompetencyList
                items={categoryData}
                totalWeeks={totalAvailableWeeks}
                adminReview={isAdminReview}
              />

              <div className="sp-competency-footer">
                <div>
                  <small>
                    Kegiatan Terverifikasi
                  </small>

                  <strong>
                    {numberText(totalVerified)}
                  </strong>
                </div>

                <div>
                  <small>
                    Kategori Lengkap
                  </small>

                  <strong>
                    {isAdminReview
                      ? "—"
                      : `${completedCategories}/6`}
                  </strong>
                </div>
              </div>
            </section>

            {/* ===========================
                DETAIL MINGGU
                =========================== */}

            <section className="sp-card">
              <div className="sp-card-header">
                <SectionHeader
                  title="Detail Minggu Terpilih"
                  subtitle="Lihat nilai dan Achievement pada satu minggu tertentu."
                  icon="📅"
                />

                <select
                  className="sp-select"
                  value={
                    allowedWeeks.has(selectedWeek)
                      ? selectedWeek
                      : ""
                  }
                  onChange={(event) =>
                    selectWeek(
                      Number(event.target.value)
                    )
                  }
                  aria-label="Pilih minggu detail"
                >
                  {!availableWeeks.length && (
                    <option value="">
                      Tidak tersedia
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

              {activeWeekData ? (
                <>
                  <div className="sp-week-period">
                    <strong>
                      {weekLabel(activeWeekData.week)}
                    </strong>

                    <span>
                      {formatDate(activeWeekData.start)}
                      {" – "}
                      {formatDate(activeWeekData.end)}
                    </span>
                  </div>

                  <div className="sp-week-grid">
                    <MetricCard
                      label="Nilai Teori"
                      value={scoreText(
                        activeWeekData.theory
                      )}
                      detail="Post-Test"
                      icon="📘"
                      tone="blue"
                    />

                    <MetricCard
                      label="Nilai Praktik"
                      value={scoreText(
                        activeWeekData.practice
                      )}
                      detail="Praktik Mingguan"
                      icon="⚙️"
                    />

                    <MetricCard
                      label="Nilai Samapta"
                      value={scoreText(
                        activeWeekData.final
                      )}
                      detail="Nilai Akhir"
                      icon="🏃"
                      tone="orange"
                    />

                    <MetricCard
                      label="Achievement Minggu Ini"
                      value={percentText(
                        activeWeekData.progress
                      )}
                      detail={
                        isAdminReview
                          ? "Belum ada data"
                          : `${activeWeekData.totalActivities} kegiatan terverifikasi`
                      }
                      icon="🎯"
                    />
                  </div>

                  <div className="sp-week-actions">
                    <button
                      type="button"
                      className="sp-text-button"
                      onClick={() =>
                        setShowSamaptaDetail(
                          (previous) => !previous
                        )
                      }
                    >
                      {showSamaptaDetail
                        ? "Sembunyikan"
                        : "Lihat"}{" "}
                      Rincian Samapta
                      <span>
                        {showSamaptaDetail
                          ? "⌃"
                          : "⌄"}
                      </span>
                    </button>
                  </div>

                  {showSamaptaDetail && (
                    <div className="sp-detail-box">
                      <div>
                        <span>Nilai A</span>
                        <strong>
                          {scoreText(
                            activeWeekData.a
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Nilai B</span>
                        <strong>
                          {scoreText(
                            activeWeekData.b
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Nilai Akhir</span>
                        <strong>
                          {scoreText(
                            activeWeekData.final
                          )}
                        </strong>
                      </div>
                    </div>
                  )}

                  <details className="sp-details">
                    <summary>
                      Lihat Realisasi Enam Kompetensi
                    </summary>

                    <div className="sp-detail-box">
                      {activeWeekData.details.map(
                        (item) => (
                          <div key={item.name}>
                            <span>
                              {item.icon} {item.name}
                            </span>

                            <strong>
                              {isAdminReview
                                ? "—"
                                : `${numberText(
                                    item.achieved,
                                    item.name === "Fisik"
                                      ? 3
                                      : 0
                                  )} ${item.unit} · ${percentText(
                                    item.percent
                                  )}`}
                            </strong>
                          </div>
                        )
                      )}
                    </div>
                  </details>
                </>
              ) : (
                <div className="sp-empty">
                  Tidak ada minggu aktif
                  yang tersedia untuk ditampilkan.
                </div>
              )}
            </section>

            {/* ===========================
                REKAP LENGKAP OPSIONAL
                =========================== */}

            <section className="sp-card">
              <div className="sp-card-header">
                <SectionHeader
                  title="Rekap Nilai Mingguan"
                  subtitle="Data lengkap tetap tersedia tanpa memenuhi halaman utama."
                  icon="📋"
                />

                <button
                  type="button"
                  className="sp-small-btn"
                  onClick={() =>
                    setShowFullRecap(
                      (previous) => !previous
                    )
                  }
                >
                  {showFullRecap
                    ? "Tutup Rekap"
                    : "Lihat Rekap Lengkap"}
                </button>
              </div>

              {!showFullRecap && (
                <p className="sp-hint">
                  Buka rekap untuk melihat nilai
                  Teori, Praktik, Samapta, jumlah
                  kegiatan, dan Achievement
                  setiap minggu.
                </p>
              )}

              {showFullRecap && (
                <div className="sp-table-scroll">
                  <table className="sp-table">
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
                            item.available
                        )
                        .map((item) => (
                          <tr
                            key={item.week}
                            className={
                              selectedWeek === item.week
                                ? "selected"
                                : ""
                            }
                          >
                            <td>
                              {weekLabel(item.week)}
                            </td>

                            <td>
                              {scoreText(item.theory)}
                            </td>

                            <td>
                              {scoreText(item.practice)}
                            </td>

                            <td>
                              {scoreText(item.final)}
                            </td>

                            <td>
                              {numberText(
                                item.totalActivities
                              )}
                            </td>

                            <td>
                              {percentText(
                                item.progress
                              )}
                            </td>

                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  selectWeek(item.week);

                                  document
                                    .querySelector(
                                      ".sp-week-period"
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
              )}
            </section>

            {/* ===========================
                INFORMASI PERHITUNGAN
                =========================== */}

            <section className="sp-card">
              <button
                type="button"
                className="sp-info-toggle"
                onClick={() =>
                  setShowCalculationInfo(
                    (previous) => !previous
                  )
                }
              >
                <span>
                  ⓘ Informasi Perhitungan
                </span>

                <span>
                  {showCalculationInfo
                    ? "Tutup −"
                    : "Buka +"}
                </span>
              </button>

              {showCalculationInfo && (
                <div className="sp-info-content">
                  <p>
                    Seluruh nomor minggu mengikuti
                    kalender global Week 01–25.
                    Week 01 dimulai 12 September 2026
                    dan Week 25 berakhir
                    6 Maret 2027.
                  </p>

                  <p>
                    Minggu di luar periode OJT
                    peserta tidak dimasukkan
                    dalam perhitungan Achievement.
                    Minggu aktif tanpa kegiatan
                    dihitung 0%.
                  </p>

                  <p>
                    Fisik dihitung berdasarkan
                    kilometer, sedangkan lima
                    kategori lain berdasarkan
                    jumlah kegiatan terverifikasi.
                    Persentase tiap kategori
                    dibatasi maksimal 100%
                    per minggu.
                  </p>

                  <p>
                    Samapta dihitung dari Nilai A,
                    rata-rata empat komponen Nilai B,
                    kemudian rata-rata Nilai A dan B.
                    Hanya tes lengkap yang dihitung.
                  </p>

                  <p>
                    Grafik digunakan untuk monitoring
                    perkembangan OJT dan bukan
                    keputusan kelulusan akhir.
                  </p>
                </div>
              )}
            </section>

            {/* ===========================
                TOMBOL AKSI
                =========================== */}

            <div className="sp-actions">
              <button
                type="button"
                className="sp-btn secondary"
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing
                  ? "Memperbarui..."
                  : "↻ Refresh Data"}
              </button>

              <button
                type="button"
                className="sp-btn"
                onClick={printPage}
              >
                ↓ Cetak / Simpan Grafik
              </button>
            </div>
          </>
        )}

        <footer className="sp-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS - DESIGN A
// CORPORATE NAVY & EMERALD
// =====================================================

const css = `
.sp-root,
.sp-root * {
  box-sizing: border-box;
}

.sp-root {
  min-height: 100vh;
  background: #edf4f9;
  color: #173755;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

.sp-root button,
.sp-root select {
  font: inherit;
}

.sp-root button {
  cursor: pointer;
}

.sp-root button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.sp-root button:focus-visible,
.sp-root select:focus-visible,
.sp-root summary:focus-visible {
  outline: 3px solid #48dcc0;
  outline-offset: 3px;
}

.sp-topbar {
  background: #081f38;
  color: white;
  padding: 14px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sp-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.sp-logo {
  width: 42px;
  height: 42px;
  background: #0b665b;
  color: #75ebd1;
  border: 1px solid #249d8c;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 24px;
  font-weight: 900;
  flex-shrink: 0;
}

.sp-brand strong {
  display: block;
  font-size: 20px;
  font-weight: 900;
}

.sp-brand em {
  color: #48e0bf;
  font-style: normal;
}

.sp-brand strong small {
  display: inline-block;
  font-size: 9px;
  color: #071f38;
  background: #48e0bf;
  border-radius: 5px;
  margin-left: 7px;
  padding: 3px 5px;
  vertical-align: middle;
}

.sp-brand > div > span {
  display: block;
  margin-top: 4px;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #bfd5e1;
}

.sp-back {
  background: #ffffff13;
  border: 1px solid #ffffff38;
  border-radius: 9px;
  color: white;
  padding: 10px 15px;
  font-size: 12px;
  font-weight: 800;
}

.sp-container {
  max-width: 1150px;
  margin: 0 auto;
  padding: 20px;
}

.sp-hero {
  border-radius: 16px;
  padding: 25px 28px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: white;
  background:
    linear-gradient(
      100deg,
      rgba(5,25,46,.97),
      rgba(7,48,72,.86)
    ),
    url("/background-erg.png.PNG");
  background-size: cover;
  background-position: center;
}

.sp-hero > div:first-child > small {
  display: block;
  color: #efbd65;
  font-size: 10px;
  letter-spacing: 1.1px;
  font-weight: 900;
}

.sp-hero h1 {
  margin: 12px 0 8px;
  font-size: 30px;
  line-height: 1.2;
}

.sp-hero h1 span {
  color: #48e0bf;
}

.sp-hero p {
  margin: 0;
  color: #d5e6f0;
  font-size: 12px;
  line-height: 1.7;
}

.sp-person {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.sp-person > div:nth-child(2) {
  min-width: 0;
}

.sp-avatar {
  width: 47px;
  height: 47px;
  border-radius: 12px;
  background: #d9f9ed;
  color: #087d67;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 16px;
  flex-shrink: 0;
}

.sp-person strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 13px;
}

.sp-person small {
  display: block;
  margin-top: 5px;
  color: #d6e7ef;
  line-height: 1.7;
  font-size: 10px;
}

.sp-status {
  background: #dcf8eb;
  color: #087b61;
  border-radius: 18px;
  padding: 7px 9px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.sp-card {
  min-width: 0;
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 15px;
  box-shadow: 0 5px 18px #102f4610;
}

.sp-card h2 {
  color: #123d71;
  margin: 0 0 8px;
  font-size: 17px;
}

.sp-review {
  padding: 15px;
  margin-bottom: 15px;
  background: #e4f5ee;
  border: 1px solid #b3dfca;
  border-radius: 11px;
  color: #14664d;
  font-size: 12px;
  line-height: 1.7;
}

.sp-review p {
  margin: 5px 0 0;
}

.sp-metrics {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.sp-metric {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 13px;
  padding: 18px;
  box-shadow: 0 4px 15px #102f4609;
}

.sp-metric-icon {
  width: 45px;
  height: 45px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: #e5f7ef;
  border-radius: 12px;
  font-size: 23px;
}

.sp-blue .sp-metric-icon {
  background: #e7f0ff;
}

.sp-orange .sp-metric-icon {
  background: #fff2dc;
}

.sp-metric > div:last-child {
  min-width: 0;
}

.sp-metric span {
  display: block;
  color: #617f97;
  font-size: 11px;
  line-height: 1.5;
}

.sp-metric strong {
  display: block;
  color: #123d71;
  font-size: 25px;
  font-weight: 900;
  margin: 6px 0;
  overflow-wrap: anywhere;
}

.sp-metric small {
  display: block;
  color: #8096a8;
  font-size: 10px;
  line-height: 1.5;
}

.sp-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 18px;
}

.sp-section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sp-section-icon {
  width: 43px;
  height: 43px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: white;
  background: linear-gradient(
    135deg,
    #15518b,
    #1b9fc5
  );
  font-size: 21px;
}

.sp-section-heading h2 {
  margin: 0;
  color: #123d71;
  font-size: 18px;
}

.sp-section-heading p {
  color: #71899e;
  font-size: 11px;
  margin: 5px 0 0;
  line-height: 1.6;
}

.sp-select {
  min-width: 140px;
  max-width: 100%;
  color: #16446e;
  background: white;
  border: 1px solid #cadde9;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 800;
}

.sp-chart-wrap {
  width: 100%;
}

.sp-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
}

.sp-legend span,
.sp-chart-detail-values span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #688299;
}

.sp-legend i,
.sp-chart-detail-values i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.sp-chart {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 13px;
  overflow: visible;
}

.sp-chart-detail {
  background: #f1f8f6;
  padding: 12px;
  border: 1px solid #d5eae4;
  border-radius: 10px;
  color: #164f47;
  font-size: 12px;
}

.sp-chart-detail-values {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.sp-empty {
  background: #f7fafc;
  border: 1px dashed #ccdce5;
  border-radius: 10px;
  text-align: center;
  padding: 17px;
  font-size: 12px;
  color: #7b91a3;
  margin-top: 12px;
}

.sp-hint {
  font-size: 11px;
  color: #758c9d;
  line-height: 1.7;
  margin: 10px 0 0;
}

.sp-filter-note {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  border-top: 1px solid #e7eef2;
  padding-top: 12px;
  margin-top: 10px;
  font-size: 10px;
  color: #7590a3;
}

.sp-overall-pill {
  display: inline-block;
  border-radius: 20px;
  background: #dff7ec;
  color: #087e62;
  font-size: 13px;
  font-weight: 900;
  padding: 10px 14px;
  white-space: nowrap;
}

.sp-competency-list {
  display: grid;
  gap: 17px;
}

.sp-competency-item {
  display: grid;
  gap: 8px;
}

.sp-competency-top,
.sp-competency-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sp-competency-top {
  font-size: 13px;
  color: #173755;
}

.sp-percentage {
  color: #087d67;
}

.sp-progress-track {
  width: 100%;
  height: 11px;
  overflow: hidden;
  background: #e5edf0;
  border-radius: 20px;
}

.sp-progress-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    #07856a,
    #3ac8a5
  );
  border-radius: 20px;
}

.sp-competency-bottom {
  color: #8497a6;
  font-size: 10px;
  line-height: 1.5;
}

.sp-competency-footer {
  margin-top: 20px;
  border-top: 1px solid #e6eef2;
  padding-top: 16px;
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 12px;
}

.sp-competency-footer > div {
  padding: 14px;
  background: #f2f8f8;
  border-radius: 10px;
}

.sp-competency-footer small {
  display: block;
  color: #778d9e;
  font-size: 11px;
}

.sp-competency-footer strong {
  display: block;
  color: #087d67;
  font-size: 21px;
  margin-top: 6px;
}

.sp-week-period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  background: #e8f7f1;
  color: #0f755b;
  border-radius: 10px;
  padding: 13px;
  margin-bottom: 15px;
  font-size: 12px;
}

.sp-week-period strong {
  font-size: 16px;
}

.sp-week-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 10px;
}

.sp-week-grid .sp-metric {
  padding: 12px;
}

.sp-week-grid .sp-metric-icon {
  width: 33px;
  height: 33px;
  font-size: 17px;
}

.sp-week-grid .sp-metric strong {
  font-size: 20px;
}

.sp-week-actions {
  margin-top: 15px;
}

.sp-text-button {
  border: 0;
  background: transparent;
  color: #087d67;
  padding: 9px 0;
  font-size: 12px;
  font-weight: 800;
}

.sp-text-button span {
  margin-left: 8px;
}

.sp-detail-box {
  display: grid;
  gap: 0;
  margin: 10px 0;
  border: 1px solid #e4edf1;
  border-radius: 10px;
  padding: 5px 13px;
}

.sp-detail-box > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #eaf0f4;
  font-size: 12px;
}

.sp-detail-box > div:last-child {
  border-bottom: 0;
}

.sp-detail-box span {
  color: #658296;
}

.sp-detail-box strong {
  color: #087d67;
  text-align: right;
}

.sp-details {
  margin-top: 13px;
  border-top: 1px solid #e9eff3;
  padding-top: 14px;
}

.sp-details summary {
  color: #0a7c65;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.sp-small-btn {
  border: 1px solid #c3dfd5;
  background: #e7f8f0;
  color: #087d67;
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.sp-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.sp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.sp-table th {
  background: #f2f8fa;
  color: #668398;
  text-align: left;
  white-space: nowrap;
  padding: 12px;
}

.sp-table td {
  color: #37566d;
  border-bottom: 1px solid #e9eff3;
  white-space: nowrap;
  padding: 12px;
}

.sp-table tr.selected td {
  background: #e9f8f0;
}

.sp-table button {
  border: 0;
  background: #e0f5ea;
  color: #087b60;
  border-radius: 7px;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 800;
}

.sp-info-toggle {
  background: transparent;
  border: 0;
  color: #16456c;
  width: 100%;
  padding: 4px 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 800;
  font-size: 13px;
  text-align: left;
}

.sp-info-content {
  margin-top: 14px;
  background: #f2f8f5;
  border-radius: 10px;
  padding: 15px;
  color: #53736b;
  font-size: 12px;
  line-height: 1.8;
}

.sp-info-content p {
  margin: 0 0 10px;
}

.sp-info-content p:last-child {
  margin-bottom: 0;
}

.sp-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin: 16px 0;
  flex-wrap: wrap;
}

.sp-btn {
  border: 1px solid #087d67;
  background: #087d67;
  color: white;
  padding: 12px 17px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
}

.sp-btn.secondary {
  background: white;
  color: #0d6d5a;
  border-color: #c4ded6;
}

.sp-error {
  margin: 15px 0;
  background: #fff0f1;
  border: 1px solid #f4cbd0;
  color: #b42336;
  padding: 13px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}

.sp-footer {
  border-top: 1px solid #dce7ef;
  color: #8798a7;
  text-align: center;
  padding: 20px 0;
  font-size: 10px;
}

/* TABLET */

@media (max-width: 950px) {
  .sp-hero {
    flex-direction: column;
    align-items: stretch;
  }

  .sp-metrics {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .sp-week-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .sp-metric {
    padding: 13px;
    gap: 9px;
  }

  .sp-metric strong {
    font-size: 21px;
  }
}

/* MOBILE */

@media (max-width: 650px) {
  .sp-topbar {
    padding: 12px;
  }

  .sp-brand strong {
    font-size: 17px;
  }

  .sp-brand > div > span {
    font-size: 6px;
    letter-spacing: .5px;
  }

  .sp-logo {
    width: 36px;
    height: 36px;
    font-size: 20px;
  }

  .sp-back {
    padding: 9px;
    font-size: 10px;
  }

  .sp-container {
    padding: 11px;
  }

  .sp-hero {
    padding: 20px 16px;
    border-radius: 13px;
  }

  .sp-hero h1 {
    font-size: 25px;
  }

  .sp-person {
    flex-wrap: wrap;
    background: #ffffff10;
    border-radius: 11px;
    padding: 10px;
  }

  .sp-card {
    padding: 15px;
    margin-bottom: 12px;
    border-radius: 13px;
  }

  .sp-metrics {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
    gap: 7px;
  }

  .sp-metrics .sp-metric {
    display: block;
    min-width: 0;
    padding: 11px 8px;
    text-align: center;
  }

  .sp-metrics .sp-metric-icon {
    width: 34px;
    height: 34px;
    margin: 0 auto 7px;
    font-size: 18px;
  }

  .sp-metrics .sp-metric span {
    font-size: 10px;
    min-height: 29px;
  }

  .sp-metrics .sp-metric strong {
    font-size: 17px;
    margin: 6px 0;
  }

  .sp-metrics .sp-metric small {
    font-size: 9px;
  }

  .sp-card-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .sp-section-icon {
    width: 38px;
    height: 38px;
    font-size: 18px;
  }

  .sp-section-heading h2 {
    font-size: 16px;
  }

  .sp-select {
    width: 100%;
  }

  .sp-chart {
    margin-top: 12px;
  }

  .sp-legend {
    gap: 9px;
  }

  .sp-legend span {
    font-size: 10px;
  }

  .sp-competency-bottom {
    font-size: 9px;
  }

  .sp-competency-top {
    font-size: 12px;
  }

  .sp-week-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .sp-week-grid .sp-metric {
    padding: 11px;
  }

  .sp-week-grid .sp-metric strong {
    font-size: 19px;
  }

  .sp-week-grid .sp-metric span {
    font-size: 10px;
  }

  .sp-competency-footer strong {
    font-size: 19px;
  }

  .sp-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .sp-btn {
    font-size: 11px;
    padding: 12px 8px;
  }
}

/* CETAK */

@page {
  size: A4 landscape;
  margin: 9mm;
}

@media print {
  html,
  body {
    background: white !important;
  }

  .sp-root {
    background: white !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .sp-topbar,
  .sp-back,
  .sp-select,
  .sp-small-btn,
  .sp-text-button,
  .sp-info-toggle,
  .sp-actions,
  .sp-details summary,
  .sp-table button {
    display: none !important;
  }

  .sp-container {
    max-width: none;
    padding: 0;
  }

  .sp-card {
    box-shadow: none;
    break-inside: avoid;
  }

  .sp-metrics {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .sp-week-grid {
    grid-template-columns:
      repeat(4,minmax(0,1fr));
  }

  .sp-table-scroll {
    overflow: visible;
  }

  .sp-card,
  .sp-hero {
    break-inside: avoid;
  }
}
`;
