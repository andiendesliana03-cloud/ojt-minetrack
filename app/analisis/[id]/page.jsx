
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ====================================================
// OJT MINETRACK V2.0
// SKETSA 2 - KEGIATAN & NILAI PESERTA
//
// Perbaikan:
// - Metadata OJT_FILE_V1 tidak tampil sebagai teks
// - Nama dan jumlah lampiran ditampilkan terpisah
// - Deskripsi kegiatan dibersihkan
// - Detail dan format koreksi ikut dibersihkan
// - Tidak mengubah database
// - Kalender global dan rumus asli dipertahankan
// ====================================================

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
    name: "Teori",
    color: "#2670d6",
  },
  {
    key: "practice",
    name: "Praktik",
    color: "#119b80",
  },
  {
    key: "final",
    name: "Samapta",
    color: "#e7a53c",
  },
];

// ====================================================
// UTILITIES
// ====================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
  const values = records
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function cappedPercent(actual, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (actual / target) * 100)
  );
}

// ====================================================
// PARSER LAMPIRAN
//
// Menangani:
// [[OJT_FILE_V1:%7B...%7D]]
//
// Metadata dipisahkan dari deskripsi.
// Tidak menebak URL ataupun bucket Supabase.
// ====================================================

function validFileUrl(value) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function extractFileMetadata(description) {
  const original = String(description ?? "");

  const regex =
    /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g;

  const files = [];

  const cleaned = original.replace(
    regex,
    (_, encoded) => {
      try {
        let decoded = encoded.trim();

        try {
          decoded = decodeURIComponent(decoded);
        } catch {
          // Jika sudah berupa JSON, gunakan langsung.
        }

        const parsed = JSON.parse(decoded);

        const entries = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.files)
          ? parsed.files
          : [parsed];

        entries.forEach((entry) => {
          if (!entry || typeof entry !== "object") {
            return;
          }

          const rawName =
            entry.name ||
            entry.file_name ||
            entry.filename ||
            "Lampiran kegiatan";

          const name =
            String(rawName).split(/[\\/]/).pop() ||
            "Lampiran kegiatan";

          const path =
            typeof entry.path === "string"
              ? entry.path
              : "";

          // Hanya URL lengkap yang tersedia
          // di metadata yang boleh dibuka.
          const url = validFileUrl(
            entry.url ||
              entry.publicUrl ||
              entry.public_url ||
              entry.signedUrl ||
              entry.signed_url ||
              ""
          );

          files.push({
            name,
            path,
            url,
          });
        });
      } catch {
        files.push({
          name: "Lampiran kegiatan",
          path: "",
          url: null,
          unreadable: true,
        });
      }

      return " ";
    }
  );

  return {
    description: cleaned
      .replace(/\n[ \t]*\n[ \t]*\n/g, "\n\n")
      .trim(),
    files,
  };
}

// ====================================================
// KALENDER GLOBAL
// WEEK 01 = 12-18 SEPTEMBER 2026
// WEEK 02 = 20-26 SEPTEMBER 2026
// WEEK 25 = 28 FEB - 06 MAR 2027
// ====================================================

const GLOBAL_WEEKS = Array.from(
  { length: 25 },
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

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS.find(
    (item) => item.week === Number(week)
  );

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startDate = String(
    program.start_date
  ).slice(0, 10);

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

  return start > end
    ? null
    : { start, end };
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

// ====================================================
// ACHIEVEMENT ASLI
// ====================================================

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

  const meters = records.reduce(
    (sum, item) => {
      const distance = Number(item.distance_km);

      if (
        !Number.isFinite(distance) ||
        distance <= 0
      ) {
        return sum;
      }

      return sum + Math.round(distance * 1000);
    },
    0
  );

  return meters / 1000;
}

// ====================================================
// SAMAPTA ASLI
// ====================================================

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
          normalize(item.test_type) ===
          normalize(type)
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

// ====================================================
// NILAI MINGGUAN ASLI
// ====================================================

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
    if (
      !insideProgram(record[dateField], program)
    ) {
      return;
    }

    const week = globalWeekOf(
      record[dateField]
    );

    if (week === null) return;

    if (!map.has(week)) {
      map.set(week, []);
    }

    map.get(week).push(record);
  }

  postTests.forEach((item) =>
    addRecord(
      postByWeek,
      item,
      "test_date"
    )
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
      item[key] != null
  );

  return available.length
    ? available[available.length - 1][key]
    : null;
}

// ====================================================
// UI COMPONENTS
// ====================================================

function StatusTag({ status }) {
  const value = normalize(status);

  const label =
    value === "verified"
      ? "Terverifikasi"
      : value === "pending"
      ? "Menunggu Verifikasi"
      : status || "Belum tersedia";

  return (
    <span
      className={
        "wa-status " +
        (value === "verified"
          ? "verified"
          : value === "pending"
          ? "pending"
          : "neutral")
      }
    >
      {label}
    </span>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div className="wa-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function AttachmentList({ files }) {
  if (!files?.length) return null;

  return (
    <div className="wa-attachments">
      <strong>
        <span aria-hidden="true">📎</span>{" "}
        Bukti Kegiatan ({files.length})
      </strong>

      {files.map((file, index) => (
        <div
          className="wa-file"
          key={`${file.name}-${index}`}
        >
          <span aria-hidden="true">🖼️</span>

          <div className="wa-file-info">
            <strong>{file.name}</strong>

            {file.unreadable ? (
              <small>
                Metadata lampiran tidak dapat dibaca.
              </small>
            ) : !file.url ? (
              <small>
                File tercatat. Pratinjau belum tersedia.
              </small>
            ) : (
              <small>Pratinjau tersedia</small>
            )}
          </div>

          {file.url && (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="wa-file-link"
            >
              Lihat Bukti
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function TrendChart({
  data,
  selectedWeek,
  onSelectWeek,
}) {
  const width = 760;
  const height = 245;

  const left = 42;
  const right = 17;
  const top = 20;
  const bottom = 35;

  const x = (week) =>
    left +
    ((week - 1) / 24) *
      (width - left - right);

  const y = (value) =>
    top +
    ((100 - Math.max(
      0,
      Math.min(100, Number(value))
    )) / 100) *
      (height - top - bottom);

  const hasData = data.some(
    (item) =>
      item.available &&
      SERIES.some(
        (series) =>
          item[series.key] != null
      )
  );

  return (
    <div>
      <div className="wa-legend">
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
        className="wa-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Tren Teori, Praktik, dan Samapta"
      >
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e0eaf1"
              strokeDasharray="4 5"
            />

            <text
              x={left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#8094a4"
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
              y={height - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#8094a4"
            >
              W{week}
            </text>
          )
        )}

        {data.some(
          (item) => item.week === selectedWeek
        ) && (
          <line
            x1={x(selectedWeek)}
            x2={x(selectedWeek)}
            y1={top}
            y2={height - bottom}
            stroke="#9aafbd"
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
          let segment = [];
          let previous = null;

          points.forEach((point) => {
            if (
              previous !== null &&
              point.week !== previous + 1
            ) {
              if (segment.length > 1) {
                segments.push(segment);
              }

              segment = [];
            }

            segment.push(point);
            previous = point.week;
          });

          if (segment.length > 1) {
            segments.push(segment);
          }

          return (
            <g key={series.key}>
              {segments.map((part, index) => (
                <polyline
                  key={index}
                  points={part
                    .map(
                      (point) =>
                        `${point.x},${point.y}`
                    )
                    .join(" ")}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}

              {points.map((point) => (
                <circle
                  key={point.week}
                  cx={point.x}
                  cy={point.y}
                  r={
                    point.week === selectedWeek
                      ? 7
                      : 4.5
                  }
                  fill={series.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    onSelectWeek(point.week)
                  }
                >
                  <title>
                    {series.name} ·{" "}
                    {weekLabel(point.week)} ·{" "}
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
    </div>
  );
}

// ====================================================
// MAIN PAGE
// ====================================================

export default function GrafikPerkembanganOJT() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const isAdminReview =
    programId === ADMIN_REVIEW_ID;

  const [viewer, setViewer] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] =
    useState("activities");

  const [expandedActivity, setExpandedActivity] =
    useState(null);

  const [showTrend, setShowTrend] = useState(true);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [showCalculation, setShowCalculation] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const role = String(
    viewer?.role || ""
  ).toLowerCase();

  const isManager =
    role === "admin" ||
    role === "mentor";

  const backPath = isAdminReview
    ? "/dashboard-peserta"
    : isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  // ==================================================
  // DATABASE READ
  // ==================================================

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
      types: results[0].data || [],
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
        "Sesi login tidak tersedia."
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

    const currentRole = String(
      profile.role || ""
    ).toLowerCase();

    if (id === ADMIN_REVIEW_ID) {
      if (currentRole !== "admin") {
        throw new Error(
          "Mode tinjauan hanya tersedia untuk Admin."
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
        "Akun tidak memiliki akses."
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
      query = query.eq(
        "mentor_id",
        user.id
      );
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
        "Program tidak ditemukan atau akses ditolak."
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

    if (
      participant &&
      !["active", "approved", "aktif"].includes(
        normalize(programData.status)
      )
    ) {
      throw new Error(
        "Grafik peserta hanya tersedia untuk program aktif."
      );
    }

    return {
      user,
      profile,
      programData,
      adminReview: false,
    };
  }, []);

  // ==================================================
  // LOADING
  // ==================================================

  const load = useCallback(
    async (refreshOnly = false) => {
      if (!programId) {
        setError("ID program tidak tersedia.");
        setLoading(false);
        return;
      }

      if (refreshOnly) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const access = await verifyAccess(
          programId
        );

        if (access.adminReview) {
          setViewer(access.profile);
          setProgram(null);
          setTypes([]);
          setAchievements([]);
          setPostTests([]);
          setPractices([]);
          setSamapta([]);
          setSelectedWeek(1);
          return;
        }

        const data = await fetchData(
          access.programData.id
        );

        setViewer(access.profile);
        setProgram(access.programData);

        setTypes(data.types);
        setAchievements(data.achievements);
        setPostTests(data.postTests);
        setPractices(data.practices);
        setSamapta(data.samapta);

        const allowed = availableGlobalWeeks(
          access.programData
        ).map((item) => item.week);

        if (
          !refreshOnly ||
          !allowed.includes(selectedWeek)
        ) {
          setSelectedWeek(
            initialGlobalWeek(
              access.programData,
              data.achievements
            )
          );
        }
      } catch (err) {
        setError(
          err?.message ||
          "Gagal memuat Grafik Perkembangan."
        );

        if (!refreshOnly) {
          setViewer(null);
          setProgram(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      programId,
      verifyAccess,
      fetchData,
      selectedWeek,
    ]
  );

  useEffect(() => {
    // Load awal hanya saat ID program berubah.
    // Refresh manual menggunakan tombol.
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        if (!programId) {
          throw new Error(
            "ID program tidak tersedia."
          );
        }

        const access = await verifyAccess(
          programId
        );

        if (!active) return;

        if (access.adminReview) {
          setViewer(access.profile);
          setProgram(null);
          setTypes([]);
          setAchievements([]);
          setPostTests([]);
          setPractices([]);
          setSamapta([]);
          setSelectedWeek(1);
          return;
        }

        const data = await fetchData(
          access.programData.id
        );

        if (!active) return;

        setViewer(access.profile);
        setProgram(access.programData);

        setTypes(data.types);
        setAchievements(data.achievements);
        setPostTests(data.postTests);
        setPractices(data.practices);
        setSamapta(data.samapta);

        setSelectedWeek(
          initialGlobalWeek(
            access.programData,
            data.achievements
          )
        );
      } catch (err) {
        if (!active) return;

        setError(
          err?.message ||
          "Gagal memuat data."
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
  ]);

  // ==================================================
  // DATA TERHITUNG
  // ==================================================

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
    const verified = achievements.filter(
      (item) =>
        normalize(item.status) === "verified" &&
        insideProgram(
          item.activity_date,
          program
        )
    );

    const categorized = verified.map(
      (item) => ({
        ...item,
        category: resolveCategory(
          item.type_code,
          types
        ),
        week: globalWeekOf(
          item.activity_date
        ),
      })
    );

    return CATEGORIES.map((category) => {
      const matching = categorized.filter(
        (item) =>
          item.category === category.name
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
                    item.week === global.week
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

      return {
        ...category,
        weekly,
        percent: isAdminReview
          ? null
          : active.length
          ? active.reduce(
              (sum, item) =>
                sum + item.percent,
              0
            ) / active.length
          : 0,
      };
    });
  }, [
    achievements,
    types,
    program,
    isAdminReview,
  ]);

  const weeklySummary = useMemo(
    () =>
      weeklyScores.map((item) => {
        const details = categoryData.map(
          (category) => ({
            name: category.name,
            target: category.target,
            unit: category.unit,
            ...category.weekly[item.week - 1],
          })
        );

        if (isAdminReview) {
          return {
            ...item,
            details,
            totalActivities: null,
            progress: null,
          };
        }

        return {
          ...item,
          details,
          totalActivities: details.reduce(
            (sum, detail) =>
              sum + detail.count,
            0
          ),
          progress: item.available
            ? details.reduce(
                (sum, detail) =>
                  sum + (detail.percent || 0),
                0
              ) / CATEGORIES.length
            : null,
        };
      }),
    [
      weeklyScores,
      categoryData,
      isAdminReview,
    ]
  );

  const activeWeekData = weeklySummary.find(
    (item) =>
      item.week === selectedWeek &&
      item.available
  );

  const filteredAchievements = useMemo(
    () =>
      achievements
        .filter(
          (item) =>
            insideProgram(
              item.activity_date,
              program
            ) &&
            globalWeekOf(
              item.activity_date
            ) === selectedWeek
        )
        .map((item) => {
          const extracted = extractFileMetadata(
            item.description
          );

          return {
            ...item,
            category:
              resolveCategory(
                item.type_code,
                types
              ) || item.type_code,
            cleanDescription:
              extracted.description,
            attachments:
              extracted.files,
          };
        })
        .sort((a, b) =>
          String(a.activity_date).localeCompare(
            String(b.activity_date)
          )
        ),
    [
      achievements,
      types,
      program,
      selectedWeek,
    ]
  );

  const filteredPostTests = postTests.filter(
    (item) =>
      insideProgram(item.test_date, program) &&
      globalWeekOf(item.test_date) ===
        selectedWeek
  );

  const filteredPractices = practices.filter(
    (item) =>
      insideProgram(
        item.practice_date,
        program
      ) &&
      globalWeekOf(item.practice_date) ===
        selectedWeek
  );

  const filteredSamapta = samapta.filter(
    (item) =>
      insideProgram(item.test_date, program) &&
      globalWeekOf(item.test_date) ===
        selectedWeek
  );

  const verifiedCount = filteredAchievements.filter(
    (item) =>
      normalize(item.status) === "verified"
  ).length;

  const pendingCount = filteredAchievements.filter(
    (item) =>
      normalize(item.status) === "pending"
  ).length;

  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name ||
    "Peserta OJT";

  const selectedPeriod = GLOBAL_WEEKS.find(
    (item) =>
      item.week === selectedWeek
  );

  const canShowContent =
    !loading &&
    !error &&
    !!viewer &&
    (
      (isAdminReview && role === "admin") ||
      (!isAdminReview && !!program)
    );

  function changeWeek(week) {
    const value = Number(week);

    if (!allowedWeeks.has(value)) return;

    setSelectedWeek(value);
    setExpandedActivity(null);
    setNotice("");
  }

  // ==================================================
  // FORMAT KOREKSI
  // Metadata lampiran tidak disalin sebagai kode.
  // ==================================================

  async function copyCorrection(item = null) {
    if (isAdminReview) return;

    const itemDetails = item
      ? [
          `Tanggal: ${formatDate(
            item.activity_date
          )}`,
          `Kategori: ${item.category}`,
          `Deskripsi: ${
            item.cleanDescription ||
            "Belum tersedia"
          }`,
          `Realisasi: ${
            item.category === "Fisik"
              ? `${numberText(
                  item.distance_km,
                  3
                )} km`
              : "1 kegiatan"
          }`,
          `Status: ${item.status || "—"}`,
          `Jumlah Lampiran: ${
            item.attachments?.length || 0
          }`,
        ].join("\n")
      : [
          "Tanggal: [Isi tanggal]",
          "Kategori/Jenis Nilai: [Isi]",
          "Kegiatan/Nilai Tercatat: [Isi]",
        ].join("\n");

    const message = [
      "PERMOHONAN PEMERIKSAAN DATA OJT",
      "",
      `Nama: ${participantName}`,
      `Site: ${program?.site || "—"}`,
      `Minggu: ${weekLabel(selectedWeek)}`,
      `Periode: ${formatDate(
        selectedPeriod?.start
      )} - ${formatDate(
        selectedPeriod?.end
      )}`,
      "",
      itemDetails,
      "",
      "Data yang seharusnya: [Isi koreksi]",
      "Bukti pendukung: [Jika tersedia]",
      "",
      "Mohon bantuan Mentor/Admin untuk memeriksa data tersebut. Terima kasih.",
    ].join("\n");

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          "Clipboard tidak tersedia"
        );
      }

      await navigator.clipboard.writeText(
        message
      );

      setNotice(
        "Format koreksi berhasil disalin. Silakan kirim ke grup koordinasi."
      );
    } catch {
      window.prompt(
        "Salin pesan koreksi berikut:",
        message
      );
    }
  }

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <main className="wa-root">
      <style>{css}</style>

      <header className="wa-topbar">
        <div className="wa-brand">
          <span className="wa-logo">◇</span>

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
          className="wa-back"
          onClick={() =>
            router.push(backPath)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="wa-container">
        <section className="wa-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP ·
              PT BERAU COAL
            </small>

            <h1>
              Grafik <span>Perkembangan</span>
            </h1>

            <p>
              Monitoring kegiatan, nilai,
              dan capaian OJT peserta.
            </p>
          </div>

          {viewer && (
            <div className="wa-person">
              <div className="wa-avatar">
                {initials(
                  isAdminReview
                    ? viewer.full_name
                    : participantName
                )}
              </div>

              <div>
                <strong>
                  {isAdminReview
                    ? viewer.full_name
                    : participantName}
                </strong>

                <small>
                  {isAdminReview
                    ? "Tinjauan Administrator"
                    : `${
                        participant?.department ||
                        "—"
                      } · ${
                        program?.site || "—"
                      }`}
                </small>

                {!isAdminReview && (
                  <small>
                    {formatDate(
                      program?.start_date
                    )}
                    {" – "}
                    {formatDate(
                      program?.end_date
                    )}
                  </small>
                )}
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <section className="wa-card">
            Memuat Grafik Perkembangan...
          </section>
        ) : !canShowContent ? (
          <section className="wa-card">
            <h2>
              Grafik Tidak Dapat Ditampilkan
            </h2>

            <p className="wa-error">
              {error ||
                "Data tidak tersedia."}
            </p>
          </section>
        ) : (
          <>
            {isAdminReview && (
              <div className="wa-notice">
                Mode tinjauan Admin.
                Tidak menggunakan data peserta
                atau program fiktif.
              </div>
            )}

            {notice && (
              <div
                className="wa-notice"
                role="status"
              >
                {notice}
              </div>
            )}

            {/* MONITORING MINGGUAN */}

            <section className="wa-card">
              <div className="wa-heading">
                <div>
                  <h2>Monitoring Mingguan</h2>

                  <p>
                    Pilih minggu untuk melihat
                    kegiatan dan nilai.
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
                    changeWeek(
                      event.target.value
                    )
                  }
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

              <div className="wa-weeks">
                {availableWeeks.map((item) => (
                  <button
                    type="button"
                    key={item.week}
                    className={
                      selectedWeek === item.week
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      changeWeek(item.week)
                    }
                  >
                    W{String(
                      item.week
                    ).padStart(2, "0")}
                  </button>
                ))}
              </div>

              <div className="wa-period">
                <strong>
                  {weekLabel(selectedWeek)}
                </strong>

                <span>
                  {formatDate(
                    selectedPeriod?.start
                  )}
                  {" – "}
                  {formatDate(
                    selectedPeriod?.end
                  )}
                </span>
              </div>
            </section>

            {/* RINGKASAN */}

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
                detail="Perlu pemeriksaan Mentor"
              />

              <Metric
                label="Nilai Teori"
                value={scoreText(
                  activeWeekData?.theory
                )}
                detail="Rata-rata Post-Test"
              />

              <Metric
                label="Nilai Praktik"
                value={scoreText(
                  activeWeekData?.practice
                )}
                detail="Rata-rata Praktik"
              />
            </section>

            {/* KEGIATAN DAN NILAI */}

            <section
              className="wa-card"
              id="wa-activity-section"
            >
              <div className="wa-heading">
                <div>
                  <h2>
                    Kegiatan dan Nilai Mingguan
                  </h2>

                  <p>
                    Periksa kegiatan dan nilai
                    yang diinput.
                  </p>
                </div>
              </div>

              <div className="wa-tabs">
                <button
                  type="button"
                  className={
                    activeTab === "activities"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveTab(
                      "activities"
                    )
                  }
                >
                  Daftar Kegiatan
                </button>

                <button
                  type="button"
                  className={
                    activeTab === "scores"
                      ? "active"
                      : ""
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
                    activeTab === "targets"
                      ? "active"
                      : ""
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
                  <div className="wa-list-title">
                    <strong>
                      {isAdminReview
                        ? "Belum ada data peserta"
                        : `${filteredAchievements.length} kegiatan tercatat`}
                    </strong>

                    <span>
                      {isAdminReview
                        ? "—"
                        : `${verifiedCount} terverifikasi`}
                    </span>
                  </div>

                  {!filteredAchievements.length ? (
                    <div className="wa-empty">
                      Belum ada kegiatan Achievement
                      tercatat pada minggu ini.
                    </div>
                  ) : (
                    <div className="wa-list">
                      {filteredAchievements.map(
                        (item) => {
                          const expanded =
                            expandedActivity ===
                            item.id;

                          return (
                            <article
                              className="wa-activity"
                              key={item.id}
                            >
                              <button
                                type="button"
                                className="wa-activity-main"
                                onClick={() =>
                                  setExpandedActivity(
                                    expanded
                                      ? null
                                      : item.id
                                  )
                                }
                              >
                                <div className="wa-activity-info">
                                  <strong>
                                    {item.category}
                                  </strong>

                                  <small>
                                    {formatDate(
                                      item.activity_date
                                    )}
                                  </small>

                                  <p>
                                    {item.cleanDescription ||
                                      (
                                        item.attachments.length
                                          ? "Bukti kegiatan terlampir."
                                          : "Deskripsi kegiatan belum tersedia."
                                      )}
                                  </p>

                                  {item.attachments.length >
                                    0 && (
                                    <span className="wa-attachment-count">
                                      📎{" "}
                                      {
                                        item.attachments.length
                                      }{" "}
                                      lampiran
                                    </span>
                                  )}
                                </div>

                                <div className="wa-activity-status">
                                  <StatusTag
                                    status={item.status}
                                  />

                                  <span>
                                    {expanded
                                      ? "⌃"
                                      : "⌄"}
                                  </span>
                                </div>
                              </button>

                              {expanded && (
                                <div className="wa-expanded">
                                  <div className="wa-detail">
                                    <span>
                                      Kategori
                                    </span>
                                    <strong>
                                      {item.category}
                                    </strong>
                                  </div>

                                  <div className="wa-detail">
                                    <span>
                                      Tanggal
                                    </span>
                                    <strong>
                                      {formatDate(
                                        item.activity_date
                                      )}
                                    </strong>
                                  </div>

                                  <div className="wa-detail">
                                    <span>
                                      Deskripsi
                                    </span>
                                    <strong>
                                      {item.cleanDescription ||
                                        "Belum tersedia"}
                                    </strong>
                                  </div>

                                  <div className="wa-detail">
                                    <span>
                                      Realisasi
                                    </span>
                                    <strong>
                                      {item.category ===
                                      "Fisik"
                                        ? `${numberText(
                                            item.distance_km,
                                            3
                                          )} km`
                                        : "1 kegiatan"}
                                    </strong>
                                  </div>

                                  <div className="wa-detail">
                                    <span>
                                      Status
                                    </span>
                                    <StatusTag
                                      status={
                                        item.status
                                      }
                                    />
                                  </div>

                                  <AttachmentList
                                    files={
                                      item.attachments
                                    }
                                  />

                                  <button
                                    type="button"
                                    className="wa-primary"
                                    onClick={() =>
                                      copyCorrection(
                                        item
                                      )
                                    }
                                  >
                                    Salin Format Koreksi
                                  </button>
                                </div>
                              )}
                            </article>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* RINCIAN NILAI */}

              {activeTab === "scores" && (
                <div className="wa-scores">
                  <section className="wa-score-block">
                    <div className="wa-score-title">
                      <h3>
                        Post-Test / Teori
                      </h3>

                      <strong>
                        {scoreText(
                          activeWeekData?.theory
                        )}
                      </strong>
                    </div>

                    {!filteredPostTests.length ? (
                      <p>
                        Belum ada input nilai Teori.
                      </p>
                    ) : (
                      filteredPostTests.map(
                        (item, index) => (
                          <div
                            className="wa-score-row"
                            key={
                              item.id ||
                              index
                            }
                          >
                            <div>
                              <strong>
                                Post-Test{" "}
                                {index + 1}
                              </strong>

                              <small>
                                {formatDate(
                                  item.test_date
                                )}
                              </small>
                            </div>

                            <strong>
                              {scoreText(
                                item.score
                              )}
                            </strong>
                          </div>
                        )
                      )
                    )}
                  </section>

                  <section className="wa-score-block">
                    <div className="wa-score-title">
                      <h3>
                        Praktik Mingguan
                      </h3>

                      <strong>
                        {scoreText(
                          activeWeekData?.practice
                        )}
                      </strong>
                    </div>

                    {!filteredPractices.length ? (
                      <p>
                        Belum ada input nilai Praktik.
                      </p>
                    ) : (
                      filteredPractices.map(
                        (item, index) => (
                          <div
                            className="wa-score-row"
                            key={
                              item.id ||
                              index
                            }
                          >
                            <div>
                              <strong>
                                Praktik{" "}
                                {index + 1}
                              </strong>

                              <small>
                                {formatDate(
                                  item.practice_date
                                )}
                              </small>
                            </div>

                            <strong>
                              {scoreText(
                                item.score
                              )}
                            </strong>
                          </div>
                        )
                      )
                    )}
                  </section>

                  <section className="wa-score-block">
                    <div className="wa-score-title">
                      <h3>Samapta</h3>

                      <strong>
                        {scoreText(
                          activeWeekData?.final
                        )}
                      </strong>
                    </div>

                    {!filteredSamapta.length ? (
                      <p>
                        Belum ada catatan Samapta.
                      </p>
                    ) : (
                      filteredSamapta.map(
                        (item, index) => (
                          <div
                            className="wa-score-row"
                            key={
                              item.id ||
                              index
                            }
                          >
                            <div>
                              <strong>
                                {item.test_type}
                              </strong>

                              <small>
                                {formatDate(
                                  item.test_date
                                )}
                              </small>

                              {item.result_value != null &&
                                item.result_value !==
                                  "" && (
                                  <small>
                                    Hasil:{" "}
                                    {
                                      item.result_value
                                    }
                                  </small>
                                )}
                            </div>

                            <strong>
                              {scoreText(
                                item.score
                              )}
                            </strong>
                          </div>
                        )
                      )
                    )}

                    <div className="wa-samapta">
                      <span>
                        Nilai A:{" "}
                        <strong>
                          {scoreText(
                            activeWeekData?.a
                          )}
                        </strong>
                      </span>

                      <span>
                        Nilai B:{" "}
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
                  </section>

                  {!isAdminReview && (
                    <button
                      type="button"
                      className="wa-primary"
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
                <div className="wa-targets">
                  <div className="wa-list-title">
                    <strong>
                      Target vs Realisasi
                    </strong>

                    <span>
                      {weekLabel(
                        selectedWeek
                      )}
                    </span>
                  </div>

                  {categoryData.map(
                    (category) => {
                      const weekly =
                        category.weekly[
                          selectedWeek - 1
                        ];

                      const actual =
                        isAdminReview
                          ? null
                          : weekly?.achieved ??
                            null;

                      const percent =
                        isAdminReview
                          ? null
                          : weekly?.percent ??
                            null;

                      const missing =
                        actual === null
                          ? null
                          : Math.max(
                              0,
                              category.target -
                                actual
                            );

                      return (
                        <div
                          className="wa-target"
                          key={
                            category.name
                          }
                        >
                          <div className="wa-target-head">
                            <strong>
                              {category.name}
                            </strong>

                            <span>
                              {actual === null
                                ? "—"
                                : `${numberText(
                                    actual,
                                    category.name ===
                                      "Fisik"
                                      ? 3
                                      : 0
                                  )} / ${
                                    category.target
                                  } ${
                                    category.unit
                                  }`}
                            </span>
                          </div>

                          <div className="wa-track">
                            <div
                              style={{
                                width: `${
                                  percent ||
                                  0
                                }%`,
                              }}
                            />
                          </div>

                          <div className="wa-target-foot">
                            <span>
                              {percentText(
                                percent
                              )}
                            </span>

                            <span>
                              {missing === null
                                ? "Belum ada data"
                                : missing <= 0
                                ? "Target tercapai"
                                : `Kurang ${numberText(
                                    missing,
                                    category.name ===
                                      "Fisik"
                                      ? 3
                                      : 0
                                  )} ${
                                    category.unit
                                  }`}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  )}

                  <p className="wa-hint">
                    Target ditampilkan per minggu.
                    Hanya kegiatan terverifikasi
                    yang diperhitungkan.
                  </p>
                </div>
              )}
            </section>

            {/* TREN NILAI */}

            <section className="wa-card">
              <div className="wa-heading">
                <div>
                  <h2>
                    Tren Perkembangan Nilai
                  </h2>

                  <p>
                    Teori, Praktik, dan Samapta
                    dalam satu grafik.
                  </p>
                </div>

                <button
                  type="button"
                  className="wa-secondary"
                  onClick={() =>
                    setShowTrend(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  {showTrend
                    ? "Sembunyikan"
                    : "Tampilkan"}
                </button>
              </div>

              {showTrend && (
                <>
                  <div className="wa-trend-metrics">
                    <Metric
                      label="Teori Terakhir"
                      value={scoreText(
                        latestValue(
                          weeklyScores,
                          "theory"
                        )
                      )}
                      detail="Post-Test"
                    />

                    <Metric
                      label="Praktik Terakhir"
                      value={scoreText(
                        latestValue(
                          weeklyScores,
                          "practice"
                        )
                      )}
                      detail="Praktik Mingguan"
                    />

                    <Metric
                      label="Samapta Terakhir"
                      value={scoreText(
                        latestValue(
                          weeklyScores,
                          "final"
                        )
                      )}
                      detail="Nilai Akhir"
                    />
                  </div>

                  <TrendChart
                    data={weeklyScores}
                    selectedWeek={
                      selectedWeek
                    }
                    onSelectWeek={
                      changeWeek
                    }
                  />

                  <p className="wa-hint">
                    Minggu tanpa nilai tidak
                    dianggap bernilai nol.
                  </p>
                </>
              )}
            </section>

            {/* REKAP MINGGUAN */}

            <section className="wa-card">
              <div className="wa-heading">
                <div>
                  <h2>
                    Rekap Nilai Mingguan
                  </h2>

                  <p>
                    Klik Detail untuk memeriksa
                    kegiatan dan nilai minggu
                    terkait.
                  </p>
                </div>

                <button
                  type="button"
                  className="wa-secondary"
                  onClick={() =>
                    setShowAllWeeks(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  {showAllWeeks
                    ? "Minggu Ini"
                    : "Semua Minggu"}
                </button>
              </div>

              <div className="wa-table-scroll">
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
                            item.week ===
                              selectedWeek
                          )
                      )
                      .map((item) => (
                        <tr
                          key={item.week}
                          className={
                            selectedWeek ===
                            item.week
                              ? "selected"
                              : ""
                          }
                        >
                          <td>
                            {weekLabel(
                              item.week
                            )}
                          </td>

                          <td>
                            {scoreText(
                              item.theory
                            )}
                          </td>

                          <td>
                            {scoreText(
                              item.practice
                            )}
                          </td>

                          <td>
                            {scoreText(
                              item.final
                            )}
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
                                changeWeek(
                                  item.week
                                );

                                setActiveTab(
                                  "activities"
                                );

                                document
                                  .getElementById(
                                    "wa-activity-section"
                                  )
                                  ?.scrollIntoView({
                                    behavior:
                                      "smooth",
                                    block:
                                      "start",
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

            {/* KOREKSI */}

            <section className="wa-correction">
              <div>
                <h2>
                  Ada Data yang Tidak Sesuai?
                </h2>

                <p>
                  Periksa kegiatan, nilai, dan
                  lampiran. Jika terdapat
                  kesalahan input, salin format
                  koreksi untuk disampaikan
                  kepada Mentor melalui grup
                  koordinasi.
                </p>

                <small>
                  Peserta tidak mengubah data
                  secara langsung.
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

            {/* INFO PERHITUNGAN */}

            <section className="wa-card">
              <button
                type="button"
                className="wa-info-toggle"
                onClick={() =>
                  setShowCalculation(
                    (previous) =>
                      !previous
                  )
                }
              >
                <span>
                  ⓘ Informasi Perhitungan
                </span>

                <span>
                  {showCalculation
                    ? "−"
                    : "+"}
                </span>
              </button>

              {showCalculation && (
                <div className="wa-info-content">
                  <p>
                    Kalender global Week 01–25
                    berlaku untuk seluruh program.
                    Week 01 adalah 12–18 September
                    2026 dan Week 25 berakhir
                    6 Maret 2027.
                  </p>

                  <p>
                    Minggu di luar periode OJT
                    tidak dihitung. Minggu aktif
                    tanpa kegiatan dihitung 0%
                    untuk Achievement.
                  </p>

                  <p>
                    Fisik dihitung dalam kilometer.
                    Lima kategori lainnya dihitung
                    berdasarkan kegiatan
                    terverifikasi. Persentase
                    mingguan dibatasi 100%.
                  </p>

                  <p>
                    Nilai Samapta Akhir adalah
                    rata-rata Nilai A dan Nilai B.
                    Nilai B merupakan rata-rata
                    empat komponen Samapta B.
                  </p>
                </div>
              )}
            </section>

            <div className="wa-actions">
              <button
                type="button"
                disabled={refreshing}
                onClick={() =>
                  load(true)
                }
              >
                {refreshing
                  ? "Memperbarui..."
                  : "↻ Perbarui Data"}
              </button>

              <button
                type="button"
                onClick={() =>
                  window.print()
                }
              >
                Cetak / Simpan
              </button>
            </div>
          </>
        )}

        <footer className="wa-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// ====================================================
// STYLING
// ====================================================

const css = `
.wa-root,
.wa-root * {
  box-sizing: border-box;
}

.wa-root {
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

.wa-topbar {
  background: #081f38;
  color: white;
  padding: 14px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.wa-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wa-logo {
  background: #0d675c;
  border: 1px solid #279f8e;
  color: #79ebd0;
  width: 42px;
  height: 42px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 23px;
  flex-shrink: 0;
}

.wa-brand strong {
  display: block;
  font-size: 20px;
  font-weight: 900;
}

.wa-brand em {
  color: #48e0bf;
  font-style: normal;
}

.wa-brand strong small {
  background: #48e0bf;
  color: #081f38;
  border-radius: 5px;
  font-size: 9px;
  padding: 3px 5px;
  margin-left: 7px;
}

.wa-brand > div > span {
  display: block;
  font-size: 8px;
  color: #bdd5e2;
  letter-spacing: 1px;
  margin-top: 4px;
}

.wa-back {
  background: #ffffff15;
  border: 1px solid #ffffff38;
  color: white;
  border-radius: 9px;
  padding: 10px 14px;
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
    linear-gradient(
      110deg,
      rgba(5,25,46,.97),
      rgba(7,49,72,.86)
    ),
    url("/background-erg.png.PNG");
  background-size: cover;
  background-position: center;
  border-radius: 16px;
  padding: 27px;
  margin-bottom: 15px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.wa-hero small {
  display: block;
  color: #efbd65;
  font-size: 10px;
  font-weight: 800;
  line-height: 1.6;
}

.wa-hero h1 {
  font-size: 30px;
  margin: 10px 0;
}

.wa-hero h1 span {
  color: #48e0bf;
}

.wa-hero p {
  color: #d9e7f0;
  font-size: 12px;
  line-height: 1.7;
}

.wa-person {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wa-avatar {
  width: 49px;
  height: 49px;
  background: #def9ed;
  color: #087c65;
  font-weight: 900;
  border-radius: 13px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.wa-person strong {
  font-size: 13px;
}

.wa-person small {
  color: #d9e7f0;
}

.wa-card {
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 15px;
  padding: 20px;
  margin-bottom: 15px;
  box-shadow: 0 4px 16px #123b500a;
  min-width: 0;
}

.wa-card h2 {
  color: #123d71;
  font-size: 18px;
  margin: 0 0 7px;
}

.wa-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 13px;
  margin-bottom: 15px;
}

.wa-heading p {
  color: #758b9e;
  font-size: 11px;
  line-height: 1.6;
  margin: 0;
}

.wa-select {
  border: 1px solid #ccdeea;
  background: white;
  color: #17466e;
  border-radius: 9px;
  padding: 10px;
  min-width: 135px;
  font-size: 12px;
}

.wa-weeks {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 3px 2px 12px;
}

.wa-weeks button {
  flex: 0 0 auto;
  background: #f4f8fb;
  border: 1px solid #dce7ef;
  border-radius: 9px;
  padding: 10px 12px;
  color: #4c6a81;
  font-size: 11px;
  font-weight: 800;
}

.wa-weeks button.active {
  background: #087d67;
  border-color: #087d67;
  color: white;
}

.wa-period {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  background: #ecf8f3;
  color: #126d58;
  padding: 12px;
  border-radius: 10px;
  font-size: 12px;
}

.wa-metrics,
.wa-trend-metrics {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 11px;
  margin-bottom: 15px;
}

.wa-trend-metrics {
  grid-template-columns:
    repeat(3,minmax(0,1fr));
}

.wa-metric {
  background: white;
  border: 1px solid #dce7ef;
  border-radius: 12px;
  padding: 15px;
  min-width: 0;
}

.wa-metric span,
.wa-metric small {
  display: block;
  font-size: 10px;
  color: #73899d;
}

.wa-metric strong {
  display: block;
  color: #087d67;
  font-size: 25px;
  margin: 7px 0;
  overflow-wrap: anywhere;
}

.wa-tabs {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.wa-tabs button {
  background: #f3f8fb;
  color: #56738c;
  border: 1px solid #dce7ef;
  border-radius: 10px;
  padding: 12px 7px;
  font-size: 12px;
  font-weight: 800;
}

.wa-tabs button.active {
  background: #0b7966;
  color: white;
  border-color: #0b7966;
}

.wa-list-title,
.wa-target-head,
.wa-target-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.wa-list-title {
  font-size: 12px;
  margin-bottom: 14px;
}

.wa-list-title span {
  color: #7a8fa1;
}

.wa-list {
  display: grid;
  gap: 10px;
}

.wa-activity {
  border: 1px solid #dce7ef;
  border-radius: 12px;
  overflow: hidden;
}

.wa-activity-main {
  border: 0;
  background: white;
  color: #173755;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 15px;
  text-align: left;
}

.wa-activity-info {
  flex: 1;
  min-width: 0;
}

.wa-activity-info > strong {
  display: block;
  font-size: 15px;
}

.wa-activity-info > small {
  display: block;
  color: #8496a4;
  margin-top: 5px;
  font-size: 11px;
}

.wa-activity-info p {
  color: #637c90;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 10px 0;
}

.wa-attachment-count {
  display: inline-block;
  font-size: 11px;
  background: #edf6fc;
  color: #2b6989;
  border-radius: 8px;
  padding: 6px 9px;
}

.wa-activity-status {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-shrink: 0;
}

.wa-status {
  display: inline-block;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  padding: 6px 9px;
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
  color: #64788a;
}

.wa-expanded {
  background: #f8fbfd;
  border-top: 1px solid #e3edf2;
  padding: 14px;
}

.wa-detail {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e7eef3;
  padding: 11px 0;
  font-size: 12px;
}

.wa-detail > span {
  color: #758b9b;
}

.wa-detail > strong {
  text-align: right;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 70%;
}

.wa-attachments {
  border: 1px solid #d9e7ee;
  background: white;
  border-radius: 11px;
  padding: 13px;
  margin-top: 15px;
}

.wa-attachments > strong {
  display: block;
  color: #164669;
  font-size: 13px;
  margin-bottom: 10px;
}

.wa-file {
  display: flex;
  align-items: center;
  gap: 10px;
  border-top: 1px solid #edf1f4;
  padding: 12px 0;
}

.wa-file > span {
  font-size: 23px;
}

.wa-file-info {
  flex: 1;
  min-width: 0;
}

.wa-file-info strong {
  display: block;
  color: #234967;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.wa-file-info small {
  display: block;
  color: #8597a4;
  font-size: 10px;
  margin-top: 4px;
}

.wa-file-link {
  display: inline-block;
  background: #e4f6ef;
  color: #087b64;
  padding: 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 800;
  text-decoration: none;
}

.wa-primary {
  background: #087d67;
  border: 0;
  border-radius: 9px;
  color: white;
  padding: 12px;
  width: 100%;
  margin-top: 14px;
  font-size: 12px;
  font-weight: 800;
}

.wa-scores {
  display: grid;
  gap: 14px;
}

.wa-score-block {
  padding: 14px;
  border: 1px solid #e0e9ef;
  border-radius: 11px;
}

.wa-score-title,
.wa-score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.wa-score-title {
  border-bottom: 1px solid #e8eff3;
  padding-bottom: 12px;
}

.wa-score-title h3 {
  color: #153e67;
  font-size: 14px;
  margin: 0;
}

.wa-score-title > strong,
.wa-score-row > strong {
  color: #087b64;
}

.wa-score-row {
  border-bottom: 1px solid #edf1f4;
  padding: 12px 0;
  font-size: 12px;
}

.wa-score-row small {
  display: block;
  color: #8094a4;
  font-size: 10px;
  margin-top: 4px;
}

.wa-score-block > p {
  color: #8094a4;
  font-size: 12px;
}

.wa-samapta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  background: #eff8f5;
  padding: 12px;
  border-radius: 9px;
  margin-top: 13px;
  font-size: 12px;
}

.wa-targets {
  display: grid;
  gap: 15px;
}

.wa-target {
  display: grid;
  gap: 8px;
}

.wa-target-head {
  font-size: 12px;
}

.wa-target-head span,
.wa-target-foot {
  color: #70899b;
}

.wa-target-foot {
  font-size: 10px;
}

.wa-track {
  height: 10px;
  background: #e6eef1;
  border-radius: 20px;
  overflow: hidden;
}

.wa-track > div {
  height: 100%;
  background: linear-gradient(
    90deg,#0b9479,#4bc9a9
  );
  border-radius: 20px;
}

.wa-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}

.wa-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #688297;
}

.wa-legend i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

.wa-chart {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 14px;
}

.wa-secondary {
  border: 1px solid #c5e5dc;
  background: #e7f7f0;
  color: #08775e;
  border-radius: 9px;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.wa-table-scroll {
  overflow-x: auto;
}

.wa-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.wa-table th,
.wa-table td {
  padding: 12px;
  text-align: left;
  white-space: nowrap;
}

.wa-table th {
  background: #f0f6f9;
  color: #667f92;
}

.wa-table td {
  color: #375568;
  border-bottom: 1px solid #e9eff3;
}

.wa-table tr.selected td {
  background: #eaf8f2;
}

.wa-table button {
  background: #e0f5e9;
  color: #087a5c;
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 11px;
  font-weight: 800;
}

.wa-correction {
  background: #e0f3eb;
  border: 1px solid #b9e5d5;
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.wa-correction h2 {
  margin: 0 0 8px;
  color: #0b6855;
  font-size: 17px;
}

.wa-correction p {
  font-size: 12px;
  line-height: 1.7;
  color: #376b5c;
}

.wa-correction small {
  color: #638c7c;
  font-size: 10px;
}

.wa-correction button {
  background: #087d67;
  color: white;
  border: 0;
  border-radius: 10px;
  padding: 12px 15px;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.wa-info-toggle {
  display: flex;
  justify-content: space-between;
  width: 100%;
  border: 0;
  background: transparent;
  color: #184c72;
  font-weight: 800;
  font-size: 13px;
}

.wa-info-content {
  background: #f1f8f5;
  border-radius: 10px;
  padding: 14px;
  color: #55776d;
  font-size: 12px;
  line-height: 1.8;
  margin-top: 14px;
}

.wa-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 15px;
}

.wa-actions button {
  background: #087d67;
  color: white;
  border: 1px solid #087d67;
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 800;
}

.wa-actions button:last-child {
  background: white;
  color: #087d67;
  border-color: #c6ded7;
}

.wa-notice {
  background: #e7f7ee;
  color: #17694f;
  border: 1px solid #bde2cb;
  border-radius: 10px;
  padding: 13px;
  font-size: 12px;
  margin-bottom: 14px;
}

.wa-error {
  background: #fff0f1;
  color: #b42336;
  border-radius: 9px;
  padding: 13px;
  font-size: 12px;
}

.wa-empty {
  padding: 17px;
  background: #f9fbfc;
  border: 1px dashed #d2e0e8;
  border-radius: 10px;
  text-align: center;
  color: #8196a5;
  font-size: 12px;
  margin-top: 10px;
}

.wa-hint {
  color: #8196a5;
  font-size: 11px;
  line-height: 1.7;
}

.wa-footer {
  border-top: 1px solid #dce7ef;
  padding: 20px 5px;
  color: #879aab;
  text-align: center;
  font-size: 10px;
}

@media(max-width:900px) {
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

@media(max-width:600px) {
  .wa-topbar {
    padding: 12px;
  }

  .wa-logo {
    width: 36px;
    height: 36px;
  }

  .wa-brand strong {
    font-size: 16px;
  }

  .wa-brand > div > span {
    font-size: 6px;
    letter-spacing: .4px;
  }

  .wa-back {
    font-size: 10px;
    padding: 9px;
  }

  .wa-container {
    padding: 11px;
  }

  .wa-hero {
    padding: 19px 16px;
  }

  .wa-hero h1 {
    font-size: 24px;
  }

  .wa-card {
    padding: 14px;
    margin-bottom: 12px;
  }

  .wa-card h2 {
    font-size: 16px;
  }

  .wa-heading {
    flex-wrap: wrap;
  }

  .wa-select {
    width: 100%;
  }

  .wa-metrics {
    gap: 8px;
  }

  .wa-metric {
    padding: 12px;
  }

  .wa-metric strong {
    font-size: 22px;
  }

  .wa-tabs {
    gap: 5px;
  }

  .wa-tabs button {
    font-size: 10px;
    padding: 11px 5px;
  }

  .wa-activity-main {
    align-items: flex-start;
  }

  .wa-activity-status {
    flex-direction: column;
    align-items: flex-end;
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
  .wa-weeks,
  .wa-tabs,
  .wa-secondary,
  .wa-primary,
  .wa-actions,
  .wa-correction button {
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

  .wa-table-scroll {
    overflow: visible;
  }
}
`;
