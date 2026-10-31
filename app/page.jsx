
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// DASHBOARD UTAMA ADMIN / MENTOR
// KALENDER GLOBAL WEEK 01-25
// ======================================================

const TOTAL_WEEKS = 25;

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
];

const TARGETS = [
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
    label: "Rapor OJT",
    url: "/rapor",
    icon: "file",
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

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

// ======================================================
// UTILITAS
// ======================================================

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeType(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return [
    "participant",
    "peserta",
  ].includes(normalize(role));
}

function getPeserta(program) {
  return Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;
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

  if (!date) return "";

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

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

function formatPeriod(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function clamp(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? Math.min(100, Math.max(0, number))
    : 0;
}

function formatNumber(value, digits = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "—";
}

function percentText(value) {
  return `${formatNumber(value, 2)}%`;
}

function average(rows) {
  const values = rows
    .filter(
      (row) =>
        row.score !== null &&
        row.score !== undefined &&
        row.score !== ""
    )
    .map((row) => Number(row.score))
    .filter(Number.isFinite);

  return values.length
    ? values.reduce((sum, value) => sum + value, 0) /
        values.length
    : null;
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
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function amountText(value, unit) {
  return unit === "km"
    ? `${formatNumber(value, 3)} km`
    : `${formatNumber(value)} kegiatan`;
}

// ======================================================
// KALENDER GLOBAL
//
// WEEK 01 : 12-18 SEPTEMBER 2026
// 19 SEPTEMBER DIKECUALIKAN
// WEEK 02 : 20-26 SEPTEMBER 2026
// WEEK 07 : 25-31 OKTOBER 2026
// WEEK 08 : 01-07 NOVEMBER 2026
// WEEK 25 : 28 FEBRUARI-06 MARET 2027
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
      (week) =>
        date >= week.start &&
        date <= week.end
    )?.week ?? null
  );
}

function currentGlobalWeek() {
  const today = todayWITA();

  const current = globalWeekOf(today);

  if (current !== null) return current;

  if (today < GLOBAL_WEEKS[0].start) return 1;

  if (
    today > GLOBAL_WEEKS[TOTAL_WEEKS - 1].end
  ) {
    return TOTAL_WEEKS;
  }

  const previous = GLOBAL_WEEKS.filter(
    (week) => week.end < today
  );

  return previous.length
    ? previous[previous.length - 1].week
    : 1;
}

function programWeekRange(program, weekNumber) {
  const global = GLOBAL_WEEKS.find(
    (item) => item.week === weekNumber
  );

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

  return start <= end ? { start, end } : null;
}

function getProgramWeeks(program) {
  return GLOBAL_WEEKS.filter(
    (week) =>
      programWeekRange(program, week.week)
  );
}

function recordInsideProgram(dateValue, program) {
  const date = String(dateValue ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  if (
    date < String(program.start_date).slice(0, 10)
  ) {
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

// ======================================================
// ACHIEVEMENT
// ======================================================

function resolveCategory(code, types) {
  const matched = types.find(
    (type) =>
      normalizeType(type.code) === normalizeType(code)
  );

  const candidates = [
    code,
    matched?.name,
  ].filter(Boolean);

  return (
    TARGETS.find((category) =>
      candidates.some((value) =>
        category.aliases.some(
          (alias) =>
            normalizeType(value) === normalizeType(alias)
        )
      )
    )?.name || null
  );
}

function activityAmount(records, categoryName) {
  if (categoryName !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce((sum, record) => {
    const distance = Number(record.distance_km);

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

function calculateAchievements(records, types, program) {
  const availableWeeks = getProgramWeeks(program);

  const verified = records
    .filter(
      (record) =>
        normalize(record.status) === "verified" &&
        recordInsideProgram(
          record.activity_date,
          program
        )
    )
    .map((record) => ({
      ...record,
      week: globalWeekOf(record.activity_date),
      category: resolveCategory(
        record.type_code,
        types
      ),
    }));

  const categories = TARGETS.map((category) => {
    const matched = verified.filter(
      (item) => item.category === category.name
    );

    const weekly = GLOBAL_WEEKS.map((week) => {
      const available = Boolean(
        programWeekRange(program, week.week)
      );

      const rows = available
        ? matched.filter(
            (item) => item.week === week.week
          )
        : [];

      const actual = available
        ? activityAmount(rows, category.name)
        : 0;

      const percent = available
        ? clamp((actual / category.target) * 100)
        : null;

      return {
        week: week.week,
        available,
        actual,
        count: rows.length,
        percent,
        completed:
          available && actual >= category.target,
      };
    });

    const activeWeeks = weekly.filter(
      (item) => item.available
    );

    const progress = activeWeeks.length
      ? activeWeeks.reduce(
          (sum, item) => sum + item.percent,
          0
        ) / activeWeeks.length
      : 0;

    const completedWeeks = activeWeeks.filter(
      (item) => item.completed
    ).length;

    return {
      ...category,
      weekly,
      progress,
      completedWeeks,
      completed:
        activeWeeks.length > 0 &&
        completedWeeks === activeWeeks.length,
      verified: matched.length,
    };
  });

  const progress =
    categories.reduce(
      (sum, item) => sum + item.progress,
      0
    ) / TARGETS.length;

  const done = categories.filter(
    (category) => category.completed
  ).length;

  return {
    categories,
    progress,
    done,
    completed: done === TARGETS.length,
    verified: verified.length,
    availableWeeks: availableWeeks.length,
  };
}

// ======================================================
// SIMPER - LOGIKA DIPERTAHANKAN
// ======================================================

function parseSimperMetadata(notes) {
  const text = String(notes || "");

  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const data = JSON.parse(
      text.slice(start + META_START.length, end)
    );

    return data &&
      typeof data === "object" &&
      !Array.isArray(data)
      ? data
      : null;
  } catch {
    return null;
  }
}

function calculateSimper(record) {
  if (!record) {
    return {
      progress: 0,
      completed: 0,
      passed: false,
      released: false,
      legacy: false,
    };
  }

  const meta = parseSimperMetadata(record.notes);

  const steps = [
    record.theory_status === "passed",
    record.practice_status === "passed",
    meta?.orientation_status === "completed",
  ];

  const completed = steps.filter(Boolean).length;

  return {
    progress: Math.round(
      (completed / 3) * 100
    ),
    completed,
    passed: completed === 3,
    released:
      meta?.issuance_status === "issued",
    legacy:
      !meta && record.status === "passed",
  };
}

// ======================================================
// SAMAPTA - LOGIKA DIPERTAHANKAN
// ======================================================

function getSamaptaSessions(records) {
  const sessions = new Map();

  records.forEach((record) => {
    if (!parseDate(record.test_date)) return;

    const date = String(record.test_date)
      .slice(0, 10);

    if (!sessions.has(date)) {
      sessions.set(date, []);
    }

    sessions.get(date).push(record);
  });

  const output = [];

  sessions.forEach((items, date) => {
    function getScore(type) {
      const record = items.find(
        (item) =>
          normalizeType(item.test_type) ===
          normalizeType(type)
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

    const a = getScore("Lari 12 Menit");

    const components = [
      getScore("Pull-Up"),
      getScore("Push-Up"),
      getScore("Sit-Up"),
      getScore("Shuttle Run"),
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

    const run = items.find(
      (item) =>
        normalizeType(item.test_type) === "lari12menit"
    );

    const distance =
      run?.result_value == null ||
      run.result_value === ""
        ? null
        : Number(run.result_value);

    const validDistance =
      distance !== null &&
      Number.isFinite(distance);

    output.push({
      date,
      a,
      b,
      final: (a + b) / 2,
      distance: validDistance ? distance : null,
      runPassed:
        validDistance && distance >= 2600,
    });
  });

  return output.sort(
    (a, b) =>
      a.date.localeCompare(b.date)
  );
}

// ======================================================
// ICON
// ======================================================

function Icon({ name, size = 20 }) {
  const icons = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
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
    chart: <path d="M5 20v-7M11 20V5M17 20v-11M22 20V3" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    left: <path d="m15 5-7 7 7 7" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="m16 17 5-5-5-5M21 12H9" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    gear: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    leaf: (
      <>
        <path d="M20 4C10 4 4 8 4 15a5 5 0 0 0 5 5c7 0 11-7 11-16Z" />
        <path d="M4 20c3-5 7-8 12-11" />
      </>
    ),
    presentation: (
      <>
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M12 17v4M8 21h8M7 9l3 3 3-4 4 2" />
      </>
    ),
    map: (
      <>
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
        <path d="M9 3v15M15 6v15" />
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
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name] || icons.check}
    </svg>
  );
}

function Progress({ value }) {
  const percent = clamp(value);

  return (
    <div
      className="mt-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span
        style={{
          width: `${percent}%`,
        }}
      />
    </div>
  );
}

function Metric({
  title,
  value,
  sub,
  icon,
  color,
  onClick,
}) {
  return (
    <div className="mt-metric">
      <div
        className="mt-metric-icon"
        style={{
          background: color,
        }}
      >
        <Icon name={icon} size={25} />
      </div>

      <div className="mt-metric-info">
        <div className="mt-metric-title">
          {title}
        </div>

        <div className="mt-metric-value">
          {value}
        </div>

        <div className="mt-metric-sub">
          {sub}
        </div>
      </div>

      {onClick && (
        <button
          type="button"
          className="mt-small-action"
          onClick={onClick}
          aria-label={`Buka ${title}`}
        >
          <Icon name="arrow" size={15} />
        </button>
      )}
    </div>
  );
}

// ======================================================
// DASHBOARD
// ======================================================

export default function MentorDashboard() {
  const router = useRouter();

  const [account, setAccount] = useState(null);

  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] =
    useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [presentationMode, setPresentationMode] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const [accessStatus, setAccessStatus] =
    useState("checking");
  const [maintenanceMode, setMaintenanceMode] =
    useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isAdmin = normalize(account?.role) === "admin";

  const currentWeek =
    GLOBAL_WEEKS[selectedWeek - 1];

  useEffect(() => {
    setSelectedWeek(currentGlobalWeek());
  }, []);

  // ====================================================
  // MAINTENANCE
  // ====================================================

  const fetchMaintenanceStatus = useCallback(
    async () => {
      const {
        data,
        error: statusError,
      } = await supabase
        .from("app_settings")
        .select("maintenance_mode")
        .eq("id", 1)
        .maybeSingle();

      if (statusError) {
        throw new Error(
          `Maintenance Mode: ${statusError.message}`
        );
      }

      if (
        typeof data?.maintenance_mode !== "boolean"
      ) {
        throw new Error(
          "Pengaturan Maintenance Mode belum tersedia."
        );
      }

      return data.maintenance_mode;
    },
    []
  );

  // ====================================================
  // FETCH DATA
  // ====================================================

  const fetchDashboardData = useCallback(
    async (userId, role) => {
      let query = supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          mentor_id,
          start_date,
          end_date,
          status,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            id,
            full_name,
            department,
            role
          )
        `)
        .eq("status", "active")
        .order("start_date", {
          ascending: false,
        });

      // Pembatasan eksplisit untuk Mentor.
      // RLS database tetap berlaku.
      if (role === "mentor") {
        query = query.eq("mentor_id", userId);
      }

      const [programRes, typeRes] =
        await Promise.all([
          query,
          supabase
            .from("achievement_types")
            .select("code,name"),
        ]);

      if (programRes.error) {
        throw new Error(
          `Program OJT: ${programRes.error.message}`
        );
      }

      if (typeRes.error) {
        throw new Error(
          `Kategori Achievement: ${typeRes.error.message}`
        );
      }

      const list = (programRes.data || [])
        .filter((item) => {
          const peserta = getPeserta(item);

          return (
            peserta &&
            isParticipantRole(peserta.role) &&
            peserta.id === item.participant_id
          );
        })
        .map((item) => ({
          ...item,
          peserta: getPeserta(item),
        }));

      const ids = list.map((item) => item.id);

      if (!ids.length) {
        return {
          programs: [],
          types: typeRes.data || [],
          achievements: [],
          postTests: [],
          practices: [],
          samapta: [],
          simper: [],
        };
      }

      const results = await Promise.all([
        supabase
          .from("achievement_records")
          .select(
            "id,program_id,type_code,status,activity_date,distance_km"
          )
          .in("program_id", ids),

        supabase
          .from("post_test_scores")
          .select("id,program_id,score,test_date")
          .in("program_id", ids),

        supabase
          .from("weekly_practice_scores")
          .select(
            "id,program_id,score,practice_date"
          )
          .in("program_id", ids),

        supabase
          .from("samapta_records")
          .select(
            "id,program_id,test_date,test_type,score,outcome,result_value"
          )
          .in("program_id", ids),

        supabase
          .from("simper_records")
          .select(`
            id,
            program_id,
            administration_status,
            training_status,
            theory_status,
            practice_status,
            status,
            application_date,
            graduation_date,
            notes
          `)
          .in("program_id", ids),
      ]);

      const labels = [
        "Achievement",
        "Post-Test",
        "Praktik",
        "Samapta",
        "SIMPER",
      ];

      results.forEach((result, index) => {
        if (result.error) {
          throw new Error(
            `${labels[index]}: ${result.error.message}`
          );
        }
      });

      return {
        programs: list,
        types: typeRes.data || [],
        achievements: results[0].data || [],
        postTests: results[1].data || [],
        practices: results[2].data || [],
        samapta: results[3].data || [],
        simper: results[4].data || [],
      };
    },
    []
  );

  const applyDashboard = useCallback((data) => {
    setPrograms(data.programs);
    setAchievementTypes(data.types);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractices(data.practices);
    setSamapta(data.samapta);
    setSimper(data.simper);
    setLastUpdated(new Date());
  }, []);

  // ====================================================
  // AUTH
  // ====================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setAccessStatus("checking");
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (mounted) {
            setAccessStatus("redirecting");
          }

          router.replace("/login");
          return;
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
            "Profil akun tidak ditemukan."
          );
        }

        const role = normalize(profile.role);

        const admin = role === "admin";
        const mentor = role === "mentor";
        const participant =
          isParticipantRole(role);

        if (!admin && !mentor && !participant) {
          throw new Error(
            "Akun tidak memiliki akses Dashboard."
          );
        }

        const maintenance =
          await fetchMaintenanceStatus();

        if (!mounted) return;

        setMaintenanceMode(maintenance);

        if (maintenance && !admin) {
          setAccessStatus("maintenance");
          return;
        }

        if (participant) {
          setAccessStatus("redirecting");
          router.replace("/dashboard-peserta");
          return;
        }

        const data = await fetchDashboardData(
          user.id,
          role
        );

        if (!mounted) return;

        setAccount({
          ...profile,
          role,
        });

        applyDashboard(data);
        setAccessStatus("allowed");
      } catch (err) {
        if (mounted) {
          setError(
            err?.message || "Gagal memuat Dashboard."
          );
          setAccessStatus("error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [
    router,
    fetchMaintenanceStatus,
    fetchDashboardData,
    applyDashboard,
  ]);

  // ====================================================
  // PEMANTAUAN MAINTENANCE ADMIN
  // ====================================================

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;

    async function checkStatus() {
      try {
        const value =
          await fetchMaintenanceStatus();

        if (active) {
          setMaintenanceMode(value);
        }
      } catch {
        if (active) {
          setMaintenanceMode(null);
        }
      }
    }

    checkStatus();

    const interval = setInterval(() => {
      if (
        document.visibilityState === "visible"
      ) {
        checkStatus();
      }
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    isAdmin,
    fetchMaintenanceStatus,
  ]);

  async function refresh() {
    if (
      loading ||
      refreshing ||
      !account ||
      accessStatus !== "allowed"
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !user ||
        user.id !== account.id
      ) {
        throw new Error(
          "Sesi akun berubah. Silakan masuk kembali."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const role = normalize(profile.role);

      if (!["admin", "mentor"].includes(role)) {
        throw new Error(
          "Hak akses Dashboard berubah."
        );
      }

      const maintenance =
        await fetchMaintenanceStatus();

      setMaintenanceMode(maintenance);

      if (maintenance && role !== "admin") {
        setPrograms([]);
        setAccount(null);
        setAccessStatus("maintenance");
        return;
      }

      const data = await fetchDashboardData(
        user.id,
        role
      );

      setAccount({
        ...profile,
        role,
      });

      applyDashboard(data);
    } catch (err) {
      // Tidak mempertahankan data lama ketika
      // pembacaan atau otorisasi ulang gagal.
      setPrograms([]);
      setAchievementTypes([]);
      setAchievements([]);
      setPostTests([]);
      setPractices([]);
      setSamapta([]);
      setSimper([]);

      setError(
        err?.message || "Gagal memperbarui data."
      );
      setAccessStatus("error");
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      setLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function navigate(path) {
    setMenuOpen(false);
    router.push(path);
  }

  function changeWeek(nextWeek) {
    const number = Number(nextWeek);

    if (!Number.isFinite(number)) return;

    setSelectedWeek(
      Math.max(
        1,
        Math.min(
          TOTAL_WEEKS,
          Math.floor(number)
        )
      )
    );
  }

  // ====================================================
  // INDEX RECORD PER PROGRAM
  // ====================================================

  const recordIndex = useMemo(() => {
    function index(rows) {
      const map = new Map();

      rows.forEach((row) => {
        if (!map.has(row.program_id)) {
          map.set(row.program_id, []);
        }

        map.get(row.program_id).push(row);
      });

      return map;
    }

    return {
      achievements: index(achievements),
      postTests: index(postTests),
      practices: index(practices),
      samapta: index(samapta),
      simper: index(simper),
    };
  }, [
    achievements,
    postTests,
    practices,
    samapta,
    simper,
  ]);

  // ====================================================
  // REKAP PER PESERTA
  // ====================================================

  const dataByProgram = useMemo(() => {
    const output = {};

    programs.forEach((program) => {
      const id = program.id;

      const a =
        recordIndex.achievements.get(id) || [];

      const pt =
        recordIndex.postTests.get(id) || [];

      const pr =
        recordIndex.practices.get(id) || [];

      const sm =
        recordIndex.samapta.get(id) || [];

      const sp =
        recordIndex.simper.get(id) || [];

      const achievementInfo =
        calculateAchievements(
          a,
          achievementTypes,
          program
        );

      const chosenSimper =
        sp.find((record) =>
          parseSimperMetadata(record.notes)
        ) || sp[0] || null;

      const simperInfo =
        calculateSimper(chosenSimper);

      const validSamapta = sm.filter(
        (row) =>
          recordInsideProgram(
            row.test_date,
            program
          )
      );

      const samaptaSessions =
        getSamaptaSessions(validSamapta);

      const latestSamapta =
        samaptaSessions.length
          ? samaptaSessions[
              samaptaSessions.length - 1
            ]
          : null;

      const activityWeeks = new Set();

      function markWeek(date) {
        if (!recordInsideProgram(date, program)) {
          return;
        }

        const week = globalWeekOf(date);

        if (week !== null) {
          activityWeeks.add(week);
        }
      }

      a.forEach((row) =>
        markWeek(row.activity_date)
      );

      pt.forEach((row) =>
        markWeek(row.test_date)
      );

      pr.forEach((row) =>
        markWeek(row.practice_date)
      );

      sm.forEach((row) =>
        markWeek(row.test_date)
      );

      const availableWeeks =
        achievementInfo.availableWeeks;

      output[id] = {
        done: achievementInfo.done,
        progress: achievementInfo.progress,
        achievementCompleted:
          achievementInfo.completed,
        categoryProgress:
          achievementInfo.categories,

        verified: achievementInfo.verified,

        pt,
        pr,
        sm,
        sp,

        postAverage: average(pt),
        practiceAverage: average(pr),

        samaptaSessions,
        latestSamapta,
        samaptaComplete:
          samaptaSessions.length > 0,
        samaptaPassed:
          latestSamapta?.runPassed === true,

        simperProgress: simperInfo.progress,
        simperPassed: simperInfo.passed,
        simperIssued: simperInfo.released,
        simperLegacy: simperInfo.legacy,

        availableWeeks,
        activityWeeks: activityWeeks.size,
        activityProgress: availableWeeks
          ? clamp(
              (activityWeeks.size / availableWeeks) *
                100
            )
          : 0,
      };
    });

    return output;
  }, [
    programs,
    recordIndex,
    achievementTypes,
  ]);

  // ====================================================
  // FILTER PESERTA
  // ====================================================

  const sitePrograms = useMemo(() => {
    return programs.filter(
      (program) =>
        isParticipantRole(
          program.peserta?.role
        ) &&
        (
          siteFilter === "ALL" ||
          program.site === siteFilter
        )
    );
  }, [
    programs,
    siteFilter,
  ]);

  const filtered = useMemo(() => {
    const keyword = normalize(search);

    return sitePrograms.filter((program) => {
      const name = normalize(
        program.peserta?.full_name
      );

      const department = normalize(
        program.peserta?.department
      );

      return (
        !keyword ||
        name.includes(keyword) ||
        department.includes(keyword)
      );
    });
  }, [
    sitePrograms,
    search,
  ]);

  const filteredIds = useMemo(
    () =>
      new Set(
        filtered.map((program) => program.id)
      ),
    [filtered]
  );

  const filteredPrograms = useMemo(
    () =>
      new Map(
        filtered.map((program) => [
          program.id,
          program,
        ])
      ),
    [filtered]
  );

  // ====================================================
  // RINGKASAN KESELURUHAN
  // ====================================================

  const summary = useMemo(() => {
    const relevantPractices =
      practices.filter(
        (row) =>
          filteredIds.has(row.program_id)
      );

    const progressTotal = filtered.reduce(
      (sum, program) =>
        sum +
        (dataByProgram[program.id]?.progress || 0),
      0
    );

    const completed = filtered.filter(
      (program) =>
        dataByProgram[program.id]
          ?.achievementCompleted
    ).length;

    return {
      active: filtered.length,

      progress: filtered.length
        ? progressTotal / filtered.length
        : 0,

      practiceAverage:
        average(relevantPractices),

      completed,

      averageAvailableWeeks:
        filtered.length
          ? filtered.reduce(
              (sum, program) =>
                sum +
                (
                  dataByProgram[program.id]
                    ?.availableWeeks || 0
                ),
              0
            ) / filtered.length
          : 0,
    };
  }, [
    filtered,
    filteredIds,
    practices,
    dataByProgram,
  ]);

  // ====================================================
  // PROGRES PER SITE
  // ====================================================

  const siteProgress = useMemo(() => {
    const names =
      siteFilter === "ALL"
        ? [
            ...SITES,
            ...new Set(
              filtered
                .map(
                  (program) =>
                    program.site || "Belum diisi"
                )
                .filter(
                  (site) =>
                    !SITES.includes(site)
                )
            ),
          ]
        : [siteFilter];

    return names.map((site) => {
      const entries = filtered.filter(
        (program) =>
          (program.site || "Belum diisi") ===
          site
      );

      const progress = entries.length
        ? entries.reduce(
            (sum, program) =>
              sum +
              (
                dataByProgram[program.id]
                  ?.progress || 0
              ),
            0
          ) / entries.length
        : 0;

      return {
        site,
        progress,
        count: entries.length,
      };
    });
  }, [
    filtered,
    dataByProgram,
    siteFilter,
  ]);

  // ====================================================
  // WEEK GLOBAL TERPILIH
  // ====================================================

  const weeklyRecords = useMemo(() => {
    return achievements.filter((record) => {
      const program = filteredPrograms.get(
        record.program_id
      );

      return (
        program &&
        recordInsideProgram(
          record.activity_date,
          program
        ) &&
        globalWeekOf(record.activity_date) ===
          selectedWeek
      );
    });
  }, [
    achievements,
    filteredPrograms,
    selectedWeek,
  ]);

  const weeklyPostTests = useMemo(() => {
    return postTests.filter((record) => {
      const program = filteredPrograms.get(
        record.program_id
      );

      return (
        program &&
        recordInsideProgram(
          record.test_date,
          program
        ) &&
        globalWeekOf(record.test_date) ===
          selectedWeek
      );
    });
  }, [
    postTests,
    filteredPrograms,
    selectedWeek,
  ]);

  const weeklyPractices = useMemo(() => {
    return practices.filter((record) => {
      const program = filteredPrograms.get(
        record.program_id
      );

      return (
        program &&
        recordInsideProgram(
          record.practice_date,
          program
        ) &&
        globalWeekOf(record.practice_date) ===
          selectedWeek
      );
    });
  }, [
    practices,
    filteredPrograms,
    selectedWeek,
  ]);

  const weeklySamapta = useMemo(() => {
    return samapta.filter((record) => {
      const program = filteredPrograms.get(
        record.program_id
      );

      return (
        program &&
        recordInsideProgram(
          record.test_date,
          program
        ) &&
        globalWeekOf(record.test_date) ===
          selectedWeek
      );
    });
  }, [
    samapta,
    filteredPrograms,
    selectedWeek,
  ]);

  const eligiblePrograms = useMemo(() => {
    return filtered.filter(
      (program) =>
        Boolean(
          programWeekRange(
            program,
            selectedWeek
          )
        )
    );
  }, [
    filtered,
    selectedWeek,
  ]);

  const weeklyProgressByProgram = useMemo(() => {
    return eligiblePrograms.map((program) => {
      const categories =
        dataByProgram[program.id]
          ?.categoryProgress || [];

      const details = categories.map(
        (category) =>
          category.weekly[selectedWeek - 1]
      );

      const progress = details.length
        ? details.reduce(
            (sum, detail) =>
              sum + (detail?.percent || 0),
            0
          ) / details.length
        : 0;

      const completed = details.length === 6 &&
        details.every(
          (detail) => detail?.completed
        );

      return {
        programId: program.id,
        progress,
        completed,
      };
    });
  }, [
    eligiblePrograms,
    dataByProgram,
    selectedWeek,
  ]);

  const weeklySummary = useMemo(() => {
    const verified = weeklyRecords.filter(
      (row) =>
        normalize(row.status) === "verified"
    );

    const pending = weeklyRecords.filter(
      (row) =>
        normalize(row.status) === "pending"
    );

    const participantsWithPostTest = new Set(
      weeklyPostTests.map(
        (record) => record.program_id
      )
    );

    const participantsWithPractice = new Set(
      weeklyPractices.map(
        (record) => record.program_id
      )
    );

    const meanAchievement =
      weeklyProgressByProgram.length
        ? weeklyProgressByProgram.reduce(
            (sum, item) =>
              sum + item.progress,
            0
          ) / weeklyProgressByProgram.length
        : 0;

    return {
      eligible: eligiblePrograms.length,
      postTest: participantsWithPostTest.size,
      practice: participantsWithPractice.size,
      completed:
        weeklyProgressByProgram.filter(
          (item) => item.completed
        ).length,
      progress: meanAchievement,
      verified: verified.length,
      pending: pending.length,
      samapta: weeklySamapta.length,
    };
  }, [
    weeklyRecords,
    weeklyPostTests,
    weeklyPractices,
    weeklySamapta,
    eligiblePrograms,
    weeklyProgressByProgram,
  ]);

  // ====================================================
  // KATEGORI MINGGUAN
  //
  // TARGET = TARGET SETIAP MINGGU
  // PROGRESS = RATA-RATA PERSENTASE MINGGU
  // ====================================================

  const weeklyCategories = useMemo(() => {
    return TARGETS.map((category) => {
      let weeklyAmount = 0;
      let cumulativeAmount = 0;
      let weeklyProgress = 0;
      let cumulativeProgress = 0;

      eligiblePrograms.forEach((program) => {
        const item =
          dataByProgram[program.id]
            ?.categoryProgress?.find(
              (entry) =>
                entry.name === category.name
            );

        if (!item) return;

        const thisWeek =
          item.weekly[selectedWeek - 1];

        weeklyAmount += thisWeek?.actual || 0;
        weeklyProgress += thisWeek?.percent || 0;

        const toDate = item.weekly.filter(
          (week) =>
            week.available &&
            week.week <= selectedWeek
        );

        cumulativeAmount += toDate.reduce(
          (sum, week) =>
            sum + week.actual,
          0
        );

        cumulativeProgress += toDate.length
          ? toDate.reduce(
              (sum, week) =>
                sum + week.percent,
              0
            ) / toDate.length
          : 0;
      });

      return {
        ...category,
        weeklyAmount,
        cumulativeAmount,
        weeklyProgress: eligiblePrograms.length
          ? weeklyProgress /
            eligiblePrograms.length
          : 0,
        cumulativeProgress: eligiblePrograms.length
          ? cumulativeProgress /
            eligiblePrograms.length
          : 0,
      };
    });
  }, [
    eligiblePrograms,
    dataByProgram,
    selectedWeek,
  ]);

  // ====================================================
  // PROGRES ENAM KATEGORI KESELURUHAN
  // ====================================================

  const overallCategories = useMemo(() => {
    return TARGETS.map((category) => {
      const progress = filtered.length
        ? filtered.reduce(
            (sum, program) => {
              const item =
                dataByProgram[program.id]
                  ?.categoryProgress?.find(
                    (entry) =>
                      entry.name === category.name
                  );

              return sum + (item?.progress || 0);
            },
            0
          ) / filtered.length
        : 0;

      return {
        ...category,
        progress,
      };
    });
  }, [
    filtered,
    dataByProgram,
  ]);

  // ====================================================
  // GRAFIK WEEK GLOBAL 01-25
  // ====================================================

  const weeklyChart = useMemo(() => {
    return GLOBAL_WEEKS.map((week) => {
      const count = achievements.filter((record) => {
        const program = filteredPrograms.get(
          record.program_id
        );

        return (
          program &&
          normalize(record.status) === "verified" &&
          recordInsideProgram(
            record.activity_date,
            program
          ) &&
          globalWeekOf(record.activity_date) ===
            week.week
        );
      }).length;

      return {
        ...week,
        count,
      };
    });
  }, [
    achievements,
    filteredPrograms,
  ]);

  const maxChart = Math.max(
    1,
    ...weeklyChart.map(
      (item) => item.count
    )
  );

  // ====================================================
  // AKTIVITAS WEEK GLOBAL
  // ====================================================

  const activityWeeks = useMemo(() => {
    const weeks = new Set();

    function add(date, programId) {
      const program = filteredPrograms.get(
        programId
      );

      if (
        !program ||
        !recordInsideProgram(date, program)
      ) {
        return;
      }

      const week = globalWeekOf(date);

      if (week !== null) weeks.add(week);
    }

    achievements.forEach(
      (row) =>
        add(row.activity_date, row.program_id)
    );

    postTests.forEach(
      (row) =>
        add(row.test_date, row.program_id)
    );

    practices.forEach(
      (row) =>
        add(row.practice_date, row.program_id)
    );

    samapta.forEach(
      (row) =>
        add(row.test_date, row.program_id)
    );

    return weeks;
  }, [
    achievements,
    postTests,
    practices,
    samapta,
    filteredPrograms,
  ]);

  // ====================================================
  // DISPLAY
  // ====================================================

  const accountRole = isAdmin
    ? "Administrator"
    : "Mentor OJT";

  const accountName =
    account?.full_name ||
    (isAdmin ? "Admin" : "Mentor OJT");

  const updatedText = lastUpdated
    ? lastUpdated.toLocaleString("id-ID", {
        timeZone: "Asia/Makassar",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Belum diperbarui";

  const chartHighlight =
    weeklyChart[selectedWeek - 1]?.count || 0;

  // ====================================================
  // MAINTENANCE
  // ====================================================

  if (accessStatus === "maintenance") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div>
          <div style={{ fontSize: 50 }}>
            🛠️
          </div>

          <h1>
            OJT MineTrack Sedang Maintenance
          </h1>

          <p>
            Sistem sedang dalam proses pemeliharaan.
            Akses Mentor dan Peserta sementara
            tidak tersedia.
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Coba Lagi
          </button>

          <button
            type="button"
            onClick={logout}
          >
            Keluar Akun
          </button>
        </div>
      </main>
    );
  }

  if (
    accessStatus === "checking" ||
    accessStatus === "redirecting"
  ) {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div>
          <h2>OJT MineTrack</h2>
          <p>
            Memeriksa akses pengguna...
          </p>
        </div>
      </main>
    );
  }

  if (accessStatus === "error") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div>
          <h1>Gagal Memuat Dashboard</h1>
          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
          >
            Coba Lagi
          </button>

          <button
            type="button"
            onClick={() =>
              router.replace("/login")
            }
          >
            Buka Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <div
      className={
        `mt-shell ` +
        (presentationMode
          ? "mt-presentation"
          : "")
      }
    >
      <style>{dashboardCSS}</style>

      <div
        className={
          `mt-overlay ` +
          (menuOpen ? "open" : "")
        }
        onClick={() =>
          setMenuOpen(false)
        }
      />

      {/* SIDEBAR */}

      <aside
        className={
          `mt-sidebar ` +
          (menuOpen ? "open" : "")
        }
      >
        <div className="mt-brand">
          <div className="mt-brand-title">
            OJT <span>MineTrack</span>
          </div>

          <small>
            Emergency Response Group
            <br />
            PT Berau Coal
          </small>
        </div>

        <nav aria-label="Menu Dashboard">
          {NAV.map((item) => (
            <button
              type="button"
              key={item.url}
              className={
                `mt-nav ` +
                (
                  item.url === "/"
                    ? "active"
                    : ""
                )
              }
              onClick={() =>
                navigate(item.url)
              }
            >
              <Icon
                name={item.icon}
                size={19}
              />
              {item.label}
            </button>
          ))}

          {isAdmin && (
            <>
              <div className="mt-nav-section">
                AKSES ADMINISTRATOR
              </div>

              <button
                type="button"
                className="mt-nav"
                onClick={() =>
                  navigate("/dashboard-peserta")
                }
              >
                <Icon
                  name="users"
                  size={19}
                />
                Preview Dashboard Peserta
              </button>

              <button
                type="button"
                className="mt-nav"
                onClick={() =>
                  navigate("/admin/maintenance")
                }
              >
                <Icon
                  name="gear"
                  size={19}
                />

                <span style={{ flex: 1 }}>
                  Maintenance Mode
                </span>

                <strong className="mt-maintenance-label">
                  {maintenanceMode === true
                    ? "ON"
                    : maintenanceMode === false
                    ? "OFF"
                    : "—"}
                </strong>
              </button>
            </>
          )}
        </nav>

        <div className="mt-sidebar-bottom">
          <button
            type="button"
            className="mt-nav"
            onClick={refresh}
            disabled={refreshing || loading}
          >
            <Icon
              name="refresh"
              size={19}
            />
            {refreshing
              ? "Memperbarui..."
              : "Refresh Data"}
          </button>

          <button
            type="button"
            className="mt-nav"
            onClick={logout}
            disabled={loggingOut}
          >
            <Icon
              name="logout"
              size={19}
            />
            {loggingOut
              ? "Sedang Keluar..."
              : "Keluar Akun"}
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <main className="mt-main">
        <div className="mt-mobile-header">
          <strong>
            OJT <span>MineTrack</span>
          </strong>

          <button
            type="button"
            onClick={() =>
              setMenuOpen(true)
            }
            aria-label="Buka menu"
          >
            <Icon
              name="menu"
              size={27}
            />
          </button>
        </div>

        {/* HERO */}

        <header className="mt-hero">
          <div className="mt-hero-top">
            <div>
              <div className="mt-kicker">
                EMERGENCY RESPONSE GROUP ·
                PT BERAU COAL
              </div>

              <h1>
                Dashboard OJT{" "}
                <span>MineTrack</span>
              </h1>

              <p>
                Monitoring dan Evaluasi
                On Job Training
              </p>

              <div className="mt-values">
                <span>
                  <Icon name="shield" size={16} />
                  Safe People
                </span>

                <span>
                  <Icon name="gear" size={16} />
                  Safe Operation
                </span>

                <span>
                  <Icon name="leaf" size={16} />
                  Sustainable Mining
                </span>
              </div>
            </div>

            <div className="mt-account">
              <div className="mt-account-avatar">
                {initials(accountName)}
              </div>

              <div>
                <strong>{accountRole}</strong>
                <small>{accountName}</small>
              </div>
            </div>
          </div>

          <div className="mt-hero-bottom">
            <div className="mt-hero-info">
              <Icon name="calendar" size={21} />

              <div>
                <small>
                  Kalender Global 25 Week
                </small>

                <strong>
                  12 Sep 2026 – 06 Mar 2027
                </strong>
              </div>
            </div>

            <div className="mt-hero-info">
              <Icon name="map" size={21} />

              <div>
                <small>Site yang Dipilih</small>

                <strong>
                  {siteFilter === "ALL"
                    ? "Semua Site"
                    : siteFilter}
                </strong>
              </div>
            </div>

            <div className="mt-hero-info">
              <Icon name="refresh" size={21} />

              <div>
                <small>
                  Terakhir Diperbarui
                </small>
                <strong>{updatedText}</strong>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-content">
          {/* TOOLBAR */}

          <div className="mt-toolbar">
            <div className="mt-toolbar-title">
              <strong>
                Overview Program OJT
              </strong>

              <span>
                Monitoring Kalender Global 2026–2027
              </span>
            </div>

            <div className="mt-toolbar-actions">
              <select
                value={siteFilter}
                aria-label="Pilih Site"
                onChange={(event) =>
                  setSiteFilter(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  Semua Site
                </option>

                {SITES.map((site) => (
                  <option
                    key={site}
                    value={site}
                  >
                    {site}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="mt-button-outline"
                onClick={refresh}
                disabled={refreshing || loading}
              >
                <Icon
                  name="refresh"
                  size={16}
                />
                {refreshing
                  ? "Memuat..."
                  : "Refresh"}
              </button>

              <button
                type="button"
                className="mt-button-green"
                onClick={() =>
                  setPresentationMode(
                    (value) => !value
                  )
                }
              >
                <Icon
                  name="presentation"
                  size={17}
                />

                {presentationMode
                  ? "Tampilan Normal"
                  : "Mode Presentasi"}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mt-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-card">
              Memuat Dashboard OJT...
            </div>
          ) : (
            <>
              {/* KPI */}

              <section className="mt-kpi-grid">
                <Metric
                  title="Peserta OJT Aktif"
                  value={summary.active}
                  sub="Sesuai filter site dan pencarian"
                  icon="users"
                  color="#09966c"
                  onClick={() =>
                    navigate(
                      "/mentor/monitoring-peserta"
                    )
                  }
                />

                <Metric
                  title="Rata-rata Progres OJT"
                  value={percentText(
                    summary.progress
                  )}
                  sub="Rata-rata enam kompetensi"
                  icon="chart"
                  color="#0d3441"
                />

                <Metric
                  title="Rata-rata Nilai Praktik"
                  value={scoreText(
                    summary.practiceAverage
                  )}
                  sub="Dari penilaian yang tercatat"
                  icon="file"
                  color="#efa91d"
                />

                <Metric
                  title="Pencapaian Lengkap"
                  value={summary.completed}
                  sub="Enam kategori lengkap pada seluruh minggu program"
                  icon="check"
                  color="#368ce5"
                />
              </section>

              {/* OVERVIEW */}

              <section className="mt-overview-grid">
                {/* SITE */}

                <div className="mt-card mt-site-panel">
                  <div className="mt-card-heading">
                    <div>
                      <h2>
                        <span className="mt-heading-icon">
                          <Icon
                            name="chart"
                            size={17}
                          />
                        </span>
                        Progres OJT per Site
                      </h2>

                      <p>
                        Rata-rata progres peserta
                        berdasarkan target setiap
                        Week Global.
                      </p>
                    </div>
                  </div>

                  <div className="mt-site-table">
                    <div className="mt-site-head">
                      <span>Site</span>
                      <span>Progres</span>
                      <span>Rata-rata</span>
                      <span>Peserta</span>
                    </div>

                    {siteProgress.map((item) => (
                      <div
                        className="mt-site-row"
                        key={item.site}
                      >
                        <strong>
                          {item.site}
                        </strong>

                        <Progress
                          value={item.progress}
                        />

                        <strong className="mt-green-text">
                          {percentText(
                            item.progress
                          )}
                        </strong>

                        <span>
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MONITORING WEEK */}

                <div className="mt-card mt-monitor-panel">
                  <div className="mt-card-heading">
                    <div>
                      <h2>
                        <span className="mt-heading-icon">
                          <Icon
                            name="calendar"
                            size={17}
                          />
                        </span>
                        Ringkasan Monitoring
                      </h2>

                      <p>
                        Data peserta yang memiliki
                        periode OJT pada Week Global
                        terpilih.
                      </p>
                    </div>

                    <div className="mt-week-controls">
                      <button
                        type="button"
                        disabled={
                          selectedWeek <= 1
                        }
                        onClick={() =>
                          changeWeek(
                            selectedWeek - 1
                          )
                        }
                        aria-label="Minggu sebelumnya"
                      >
                        <Icon
                          name="left"
                          size={16}
                        />
                      </button>

                      <select
                        value={selectedWeek}
                        onChange={(event) =>
                          changeWeek(
                            event.target.value
                          )
                        }
                        aria-label="Pilih minggu Global OJT"
                      >
                        {GLOBAL_WEEKS.map(
                          (week) => (
                            <option
                              key={week.week}
                              value={week.week}
                            >
                              {weekLabel(
                                week.week
                              )}
                            </option>
                          )
                        )}
                      </select>

                      <button
                        type="button"
                        disabled={
                          selectedWeek >= TOTAL_WEEKS
                        }
                        onClick={() =>
                          changeWeek(
                            selectedWeek + 1
                          )
                        }
                        aria-label="Minggu berikutnya"
                      >
                        <Icon
                          name="arrow"
                          size={16}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="mt-selected-period">
                    <Icon
                      name="calendar"
                      size={15}
                    />

                    <strong>
                      {weekLabel(selectedWeek)}
                    </strong>

                    <span>
                      {formatPeriod(
                        currentWeek.start,
                        currentWeek.end
                      )}
                    </span>
                  </div>

                  <div className="mt-week-stats">
                    <div className="mt-week-stat green">
                      <strong>
                        {weeklySummary.eligible}
                      </strong>
                      <span>
                        Peserta Periode Aktif
                      </span>
                    </div>

                    <div className="mt-week-stat blue">
                      <strong>
                        {weeklySummary.postTest}
                      </strong>
                      <span>
                        Dengan Post-Test
                      </span>
                    </div>

                    <div className="mt-week-stat gold">
                      <strong>
                        {weeklySummary.practice}
                      </strong>
                      <span>
                        Dinilai Praktik
                      </span>
                    </div>

                    <div className="mt-week-stat purple">
                      <strong>
                        {weeklySummary.completed}
                      </strong>
                      <span>
                        Enam Target Week Tercapai
                      </span>
                    </div>
                  </div>

                  <div className="mt-mini-summary">
                    <span>
                      <b>
                        {weeklySummary.verified}
                      </b>
                      {" "}Verified
                    </span>

                    <span>
                      <b>
                        {weeklySummary.pending}
                      </b>
                      {" "}Pending
                    </span>

                    <span>
                      <b>
                        {weeklyRecords.length}
                      </b>
                      {" "}Aktivitas
                    </span>
                  </div>

                  <div className="mt-week-progress">
                    <span>
                      Rata-rata Pencapaian Minggu
                    </span>

                    <strong>
                      {percentText(
                        weeklySummary.progress
                      )}
                    </strong>
                  </div>

                  <Progress
                    value={weeklySummary.progress}
                  />

                  <div className="mt-monitor-table-wrap">
                    <table className="mt-monitor-table">
                      <thead>
                        <tr>
                          <th>Kategori</th>
                          <th>Target/Minggu</th>
                          <th>Week Ini</th>
                          <th>Akumulasi</th>
                          <th>Progress Week</th>
                          <th>Rata-rata s.d. Week</th>
                        </tr>
                      </thead>

                      <tbody>
                        {weeklyCategories.map(
                          (item) => (
                            <tr key={item.name}>
                              <td>
                                <span className="mt-category-name">
                                  <span>
                                    {item.icon}
                                  </span>
                                  {item.name}
                                </span>
                              </td>

                              <td>
                                {amountText(
                                  item.target,
                                  item.unit
                                )}
                              </td>

                              <td>
                                {amountText(
                                  item.weeklyAmount,
                                  item.unit
                                )}
                              </td>

                              <td>
                                {amountText(
                                  item.cumulativeAmount,
                                  item.unit
                                )}
                              </td>

                              <td>
                                <div className="mt-table-progress">
                                  <Progress
                                    value={
                                      item.weeklyProgress
                                    }
                                  />

                                  <strong>
                                    {percentText(
                                      item.weeklyProgress
                                    )}
                                  </strong>
                                </div>
                              </td>

                              <td>
                                {percentText(
                                  item.cumulativeProgress
                                )}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-panel-note">
                    Akumulasi merupakan realisasi
                    Verified sejak minggu pertama
                    peserta yang berada dalam Kalender
                    Global hingga minggu terpilih.
                    Persentase tidak diperoleh dengan
                    membagi akumulasi banyak minggu
                    menggunakan target satu minggu.
                  </div>
                </div>

                {/* GRAFIK 25 WEEK */}

                <div className="mt-card mt-chart-panel">
                  <div className="mt-card-heading">
                    <div>
                      <h2>
                        <span className="mt-heading-icon">
                          <Icon
                            name="chart"
                            size={17}
                          />
                        </span>
                        Program OJT Mingguan
                      </h2>

                      <p>
                        Jumlah Achievement Verified
                        berdasarkan Kalender Global.
                      </p>
                    </div>
                  </div>

                  <div className="mt-chart-highlight">
                    <span>
                      {weekLabel(selectedWeek)}
                    </span>

                    <strong>
                      {chartHighlight}
                    </strong>

                    <small>
                      Kegiatan terverifikasi
                    </small>
                  </div>

                  <div className="mt-chart-scroll">
                    <div className="mt-chart-bars">
                      {weeklyChart.map((item) => {
                        const active =
                          item.week === selectedWeek;

                        const height = item.count
                          ? Math.max(
                              8,
                              (
                                item.count /
                                maxChart
                              ) * 100
                            )
                          : 0;

                        return (
                          <button
                            type="button"
                            key={item.week}
                            className={
                              `mt-chart-column ` +
                              (
                                active
                                  ? "active"
                                  : ""
                              )
                            }
                            onClick={() =>
                              changeWeek(item.week)
                            }
                            title={
                              `${weekLabel(item.week)}: ` +
                              `${item.count} kegiatan Verified`
                            }
                          >
                            <strong>
                              {item.count}
                            </strong>

                            <div className="mt-chart-bar-area">
                              <span
                                style={{
                                  height:
                                    `${height}%`,
                                }}
                              />
                            </div>

                            <small>
                              W{String(
                                item.week
                              ).padStart(2, "0")}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-chart-note">
                    Pilih batang untuk mengubah
                    minggu monitoring. Grafik tetap
                    menampilkan Week Global 01–25.
                  </div>
                </div>
              </section>

              {/* LOWER */}

              <section className="mt-lower-grid">
                {/* CATEGORY */}

                <div className="mt-card">
                  <div className="mt-card-heading">
                    <div>
                      <h2>
                        <span className="mt-heading-icon">
                          <Icon
                            name="check"
                            size={17}
                          />
                        </span>
                        Progres Enam Kategori
                        (Keseluruhan)
                      </h2>

                      <p>
                        Rata-rata capaian seluruh
                        minggu global dalam periode
                        program masing-masing peserta.
                      </p>
                    </div>

                    <div className="mt-overall-progress">
                      <small>
                        Rata-rata
                      </small>

                      <strong>
                        {percentText(
                          summary.progress
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-category-grid">
                    {overallCategories.map(
                      (item) => (
                        <div
                          className="mt-category-card"
                          key={item.name}
                        >
                          <div className="mt-category-card-title">
                            <span>
                              {item.icon}
                            </span>

                            <strong>
                              {item.name}
                            </strong>
                          </div>

                          <div className="mt-category-percent">
                            {percentText(
                              item.progress
                            )}
                          </div>

                          <Progress
                            value={
                              item.progress
                            }
                          />

                          <small>
                            Target per minggu:{" "}
                            {amountText(
                              item.target,
                              item.unit
                            )}
                          </small>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* AKTIVITAS */}

                <div className="mt-card">
                  <div className="mt-card-heading">
                    <div>
                      <h2>
                        <span className="mt-heading-icon">
                          <Icon
                            name="calendar"
                            size={17}
                          />
                        </span>
                        Aktivitas 25 Minggu
                      </h2>

                      <p>
                        Sebaran minggu global
                        yang memiliki catatan.
                      </p>
                    </div>
                  </div>

                  <div className="mt-activity-summary">
                    <div className="mt-activity-number">
                      <strong>
                        {activityWeeks.size}
                        <span>
                          {" "}/ 25
                        </span>
                      </strong>

                      <small>
                        Minggu memiliki aktivitas
                      </small>
                    </div>

                    <div className="mt-activity-percent">
                      {percentText(
                        (
                          activityWeeks.size /
                          TOTAL_WEEKS
                        ) * 100
                      )}
                    </div>
                  </div>

                  <div className="mt-week-grid">
                    {GLOBAL_WEEKS.map(
                      (item) => (
                        <button
                          type="button"
                          key={item.week}
                          title={
                            formatPeriod(
                              item.start,
                              item.end
                            )
                          }
                          className={[
                            "mt-week-box",
                            activityWeeks.has(
                              item.week
                            )
                              ? "has-activity"
                              : "",
                            item.week ===
                            selectedWeek
                              ? "selected"
                              : "",
                          ].join(" ")}
                          onClick={() =>
                            changeWeek(item.week)
                          }
                        >
                          W{String(
                            item.week
                          ).padStart(2, "0")}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-week-legend">
                    <span>
                      <i className="mt-dot active" />
                      Ada aktivitas
                    </span>

                    <span>
                      <i className="mt-dot inactive" />
                      Belum ada aktivitas
                    </span>
                  </div>
                </div>
              </section>

              {/* DAFTAR PESERTA */}

              <section className="mt-card mt-participant-panel">
                <div className="mt-card-heading">
                  <div>
                    <h2>
                      <span className="mt-heading-icon">
                        <Icon
                          name="users"
                          size={17}
                        />
                      </span>
                      Daftar Peserta OJT Aktif
                    </h2>

                    <p>
                      Progres Achievement,
                      SIMPER, dan aktivitas
                      Kalender Global.
                    </p>
                  </div>

                  <div className="mt-list-actions">
                    <div className="mt-search">
                      <Icon
                        name="search"
                        size={17}
                      />

                      <input
                        type="search"
                        placeholder="Cari nama / departemen..."
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <button
                      type="button"
                      className="mt-button-green"
                      onClick={() =>
                        navigate(
                          "/mentor/monitoring-peserta"
                        )
                      }
                    >
                      Lihat Semua
                      <Icon
                        name="arrow"
                        size={16}
                      />
                    </button>
                  </div>
                </div>

                {/* DESKTOP TABLE */}

                <div className="mt-participant-table-wrap">
                  <table className="mt-participant-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Peserta</th>
                        <th>Departemen</th>
                        <th>Site</th>
                        <th>Periode OJT</th>
                        <th>Progres OJT</th>
                        <th>SIMPER</th>
                        <th>Aktivitas</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map(
                        (program, index) => {
                          const info =
                            dataByProgram[
                              program.id
                            ];

                          return (
                            <tr key={program.id}>
                              <td>
                                {index + 1}
                              </td>

                              <td className="mt-name-cell">
                                {program.peserta
                                  ?.full_name ||
                                  "Peserta OJT"}
                              </td>

                              <td>
                                {program.peserta
                                  ?.department ||
                                  "—"}
                              </td>

                              <td>
                                {program.site ||
                                  "—"}
                              </td>

                              <td>
                                {formatPeriod(
                                  program.start_date,
                                  program.end_date
                                )}
                              </td>

                              <td>
                                <div className="mt-table-progress">
                                  <Progress
                                    value={
                                      info?.progress ||
                                      0
                                    }
                                  />

                                  <strong>
                                    {percentText(
                                      info?.progress ||
                                      0
                                    )}
                                  </strong>
                                </div>
                              </td>

                              <td>
                                {info?.simperProgress ||
                                  0}%
                              </td>

                              <td>
                                {info?.activityWeeks ||
                                  0}
                                /
                                {info?.availableWeeks ||
                                  0}
                              </td>

                              <td>
                                <span className="mt-active-badge">
                                  Aktif
                                </span>
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="mt-detail-button"
                                  onClick={() =>
                                    navigate(
                                      `/peserta/${program.id}`
                                    )
                                  }
                                >
                                  Lihat Detail
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      )}

                      {!filtered.length && (
                        <tr>
                          <td
                            colSpan={10}
                            className="mt-empty-cell"
                          >
                            Belum ada peserta OJT
                            aktif sesuai filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARDS */}

                <div className="mt-mobile-participants">
                  {filtered.map((program) => {
                    const info =
                      dataByProgram[program.id];

                    const name =
                      program.peserta?.full_name ||
                      "Peserta OJT";

                    return (
                      <div
                        className="mt-mobile-person"
                        key={program.id}
                      >
                        <div className="mt-person-top">
                          <div className="mt-person-avatar">
                            {initials(name)}
                          </div>

                          <div>
                            <strong>
                              {name}
                            </strong>

                            <small>
                              {program.peserta
                                ?.department ||
                                "—"}
                              {" · "}
                              {program.site ||
                                "—"}
                            </small>
                          </div>
                        </div>

                        <div className="mt-person-progress">
                          <span>
                            Progres OJT
                          </span>

                          <strong>
                            {percentText(
                              info?.progress ||
                              0
                            )}
                          </strong>
                        </div>

                        <Progress
                          value={
                            info?.progress || 0
                          }
                        />

                        <div className="mt-person-meta">
                          <span>
                            SIMPER:{" "}
                            {info?.simperProgress ||
                              0}%
                          </span>

                          <span>
                            Aktivitas:{" "}
                            {info?.activityWeeks ||
                              0}
                            /
                            {info?.availableWeeks ||
                              0}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="mt-detail-button"
                          onClick={() =>
                            navigate(
                              `/peserta/${program.id}`
                            )
                          }
                        >
                          Lihat Detail
                        </button>
                      </div>
                    );
                  })}

                  {!filtered.length && (
                    <div className="mt-empty-cell">
                      Belum ada peserta OJT aktif.
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          <footer className="mt-footer">
            OJT MineTrack v2.0 ·
            Emergency Response Group ·
            PT Berau Coal ·
            Program 2026–2027
          </footer>
        </div>
      </main>
    </div>
  );
}

// ======================================================
// CSS
// ======================================================

const dashboardCSS = `
* {
  box-sizing: border-box;
}

.mt-shell {
  min-height: 100vh;
  background: #f2f6f8;
  color: #122d2a;
  font-family: Arial, Helvetica, sans-serif;
}

.mt-shell button,
.mt-shell select,
.mt-shell input {
  font: inherit;
}

.mt-shell button {
  cursor: pointer;
}

.mt-shell button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.mt-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 245px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  padding: 24px 14px;
  overflow-y: auto;
  color: white;
  background: linear-gradient(
    180deg,
    #061920 0%,
    #082b2e 55%,
    #064035 100%
  );
}

.mt-brand {
  padding: 8px 8px 28px;
}

.mt-brand-title {
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -.7px;
}

.mt-brand-title span {
  color: #31d39b;
}

.mt-brand small {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  color: #b9ccc6;
  line-height: 1.7;
}

.mt-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: 0;
  border-radius: 9px;
  padding: 13px 12px;
  margin-bottom: 5px;
  background: transparent;
  color: #e4f1ed;
  font-size: 12px;
  font-weight: 750;
  text-align: left;
}

.mt-nav.active,
.mt-nav:hover {
  color: white;
  background: linear-gradient(
    90deg,
    #07845f,
    #08734f
  );
}

.mt-nav-section {
  margin: 17px 8px 10px;
  padding-top: 15px;
  border-top: 1px solid #ffffff2c;
  color: #a3e5d1;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .7px;
}

.mt-maintenance-label {
  font-size: 10px;
  border-radius: 7px;
  padding: 5px 8px;
  background: #ffffff21;
}

.mt-sidebar-bottom {
  margin-top: auto;
  border-top: 1px solid #ffffff2c;
  padding-top: 17px;
}

.mt-main {
  margin-left: 245px;
  min-width: 0;
}

.mt-mobile-header {
  display: none;
}

.mt-hero {
  min-height: 225px;
  padding: 27px 28px 23px;
  color: white;
  background:
    linear-gradient(
      90deg,
      rgba(2,25,31,.96),
      rgba(3,42,43,.82) 48%,
      rgba(2,28,35,.35)
    ),
    url("/background-erg.png.PNG");
  background-position: center;
  background-size: cover;
}

.mt-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.mt-kicker {
  color: #efca77;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.6px;
}

.mt-hero h1 {
  margin: 13px 0 6px;
  font-size: clamp(27px,2.7vw,43px);
  line-height: 1.15;
  letter-spacing: -.7px;
}

.mt-hero h1 span {
  color: #31d39b;
}

.mt-hero p {
  margin: 0;
  color: #e1eeeb;
  font-size: 14px;
}

.mt-values {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 18px;
}

.mt-values span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #e6f1e9;
  font-size: 11px;
}

.mt-values svg {
  color: #f2c765;
}

.mt-account {
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 280px;
  padding: 9px 13px;
  border: 1px solid #ffffff36;
  border-radius: 13px;
  background: #06232bdc;
}

.mt-account-avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: #0b4938;
  background: #d2f0e2;
  font-size: 12px;
  font-weight: 900;
}

.mt-account strong,
.mt-account small {
  display: block;
}

.mt-account strong {
  font-size: 12px;
}

.mt-account small {
  margin-top: 4px;
  color: #b8dcd0;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.mt-hero-bottom {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 25px;
}

.mt-hero-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 178px;
  padding: 10px 12px;
  background: #fffffff0;
  color: #12343a;
  border-radius: 10px;
}

.mt-hero-info small,
.mt-hero-info strong {
  display: block;
}

.mt-hero-info small {
  color: #789098;
  font-size: 10px;
  margin-bottom: 5px;
}

.mt-hero-info strong {
  font-size: 11px;
}

.mt-content {
  max-width: 1700px;
  margin: auto;
  padding: 18px 18px 26px;
}

.mt-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.mt-toolbar-title strong {
  display: block;
  font-size: 15px;
}

.mt-toolbar-title span {
  display: block;
  color: #8798a1;
  font-size: 11px;
  margin-top: 5px;
}

.mt-toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.mt-toolbar-actions select,
.mt-week-controls select {
  border: 1px solid #dbe7e9;
  background: white;
  padding: 10px;
  border-radius: 9px;
  font-size: 12px;
  color: #17372f;
}

.mt-button-green,
.mt-button-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 11px 13px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.mt-button-green {
  border: 1px solid #09855f;
  background: #09855f;
  color: white;
}

.mt-button-outline {
  border: 1px solid #dbe7e9;
  background: white;
  color: #164c3d;
}

.mt-error {
  padding: 14px;
  border-radius: 11px;
  border: 1px solid #fecaca;
  background: #fff1f1;
  color: #b91c1c;
  margin-bottom: 15px;
  font-size: 12px;
}

.mt-kpi-grid {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.mt-metric {
  position: relative;
  display: flex;
  gap: 11px;
  min-height: 126px;
  min-width: 0;
  padding: 17px 13px;
  background: white;
  border: 1px solid #e4edf0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 5px 15px #103c2d08;
}

.mt-metric-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  color: white;
  border-radius: 11px;
}

.mt-metric-info {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.mt-metric-title {
  font-size: 11px;
  line-height: 1.4;
  font-weight: 800;
}

.mt-metric-value {
  margin-top: 7px;
  color: #11202d;
  font-size: 29px;
  font-weight: 900;
}

.mt-metric-sub {
  margin-top: 6px;
  color: #8699a2;
  font-size: 10px;
  line-height: 1.5;
}

.mt-small-action {
  position: absolute;
  right: 9px;
  top: 9px;
  border: 0;
  background: #edf5f4;
  border-radius: 50%;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
}

.mt-overview-grid {
  display: grid;
  grid-template-columns:
    1.05fr 1.22fr .85fr;
  gap: 12px;
  align-items: stretch;
}

.mt-card {
  min-width: 0;
  padding: 17px;
  background: white;
  border: 1px solid #e4edf0;
  border-radius: 14px;
  box-shadow: 0 5px 15px #103c2d07;
}

.mt-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.mt-card-heading h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0;
  color: #142632;
  font-size: 15px;
  line-height: 1.35;
  font-weight: 900;
}

.mt-card-heading p {
  margin: 5px 0 0;
  color: #85959f;
  font-size: 10px;
  line-height: 1.55;
}

.mt-heading-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  flex-shrink: 0;
  border-radius: 7px;
  background: #079c6a;
  color: white;
}

.mt-site-head,
.mt-site-row {
  display: grid;
  grid-template-columns:
    93px minmax(0,1fr) 65px 48px;
  gap: 9px;
  align-items: center;
}

.mt-site-head {
  padding: 10px 0;
  color: #82939d;
  border-bottom: 1px solid #eaf0f1;
  font-size: 10px;
}

.mt-site-row {
  padding: 10px 0;
  border-bottom: 1px solid #edf1f2;
  font-size: 11px;
}

.mt-site-row > span:last-child {
  text-align: center;
}

.mt-green-text {
  color: #07875d;
}

.mt-progress {
  width: 100%;
  height: 9px;
  border-radius: 20px;
  background: #e5edef;
  overflow: hidden;
}

.mt-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #20bd89,
    #07956e
  );
}

.mt-week-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mt-week-controls button {
  display: grid;
  place-items: center;
  width: 27px;
  height: 30px;
  background: #f4f8f9;
  border: 1px solid #e2ecee;
  border-radius: 7px;
}

.mt-week-controls select {
  padding: 8px 5px;
  max-width: 112px;
}

.mt-selected-period {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
  padding: 9px 10px;
  border-radius: 9px;
  background: #f1f8f5;
  color: #397060;
  font-size: 10px;
  margin-bottom: 12px;
}

.mt-selected-period strong {
  color: #085e43;
}

.mt-week-stats {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.mt-week-stat {
  text-align: center;
  border-radius: 10px;
  padding: 13px 4px;
  min-width: 0;
}

.mt-week-stat strong {
  display: block;
  font-size: 21px;
  margin-bottom: 6px;
}

.mt-week-stat span {
  display: block;
  font-size: 9px;
  line-height: 1.35;
}

.mt-week-stat.green {
  background: #e2f8ee;
  color: #09855f;
}

.mt-week-stat.blue {
  background: #e7f0ff;
  color: #2874db;
}

.mt-week-stat.gold {
  background: #fff5d9;
  color: #bb8114;
}

.mt-week-stat.purple {
  background: #eee5ff;
  color: #7947c7;
}

.mt-mini-summary {
  display: flex;
  justify-content: space-between;
  gap: 7px;
  padding: 9px 4px;
  color: #53696c;
  font-size: 10px;
}

.mt-mini-summary b {
  color: #087b5a;
}

.mt-week-progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 2px;
  font-size: 11px;
  font-weight: 800;
  color: #456c60;
}

.mt-week-progress strong {
  color: #07875d;
  font-size: 16px;
}

.mt-monitor-table-wrap {
  width: 100%;
  overflow-x: auto;
  margin-top: 12px;
}

.mt-monitor-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 640px;
  text-align: left;
  font-size: 10px;
}

.mt-monitor-table th {
  padding: 10px 6px;
  background: #f1f6f7;
  color: #53666e;
  white-space: nowrap;
}

.mt-monitor-table td {
  padding: 10px 6px;
  border-bottom: 1px solid #edf1f3;
}

.mt-category-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 850;
  white-space: nowrap;
}

.mt-category-name span {
  font-size: 15px;
}

.mt-table-progress {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 90px;
}

.mt-table-progress strong {
  color: #087d5a;
  min-width: 42px;
  white-space: nowrap;
}

.mt-panel-note {
  margin-top: 10px;
  color: #8c9ba1;
  font-size: 10px;
  line-height: 1.6;
}

.mt-chart-highlight {
  display: grid;
  justify-items: center;
  gap: 5px;
  padding: 12px;
  background: #eff8f4;
  border-radius: 10px;
  color: #0a7956;
}

.mt-chart-highlight span {
  font-size: 10px;
  font-weight: 850;
}

.mt-chart-highlight strong {
  font-size: 27px;
}

.mt-chart-highlight small {
  font-size: 10px;
  color: #689184;
}

.mt-chart-scroll {
  overflow-x: auto;
  margin-top: 15px;
  padding-bottom: 8px;
}

.mt-chart-bars {
  display: flex;
  align-items: stretch;
  gap: 6px;
  min-width: max-content;
  height: 185px;
  border-bottom: 1px solid #dae5e6;
}

.mt-chart-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 29px;
  gap: 6px;
  border: none;
  padding: 0;
  background: transparent;
  color: #748b95;
}

.mt-chart-column strong {
  font-size: 10px;
}

.mt-chart-column small {
  font-size: 9px;
}

.mt-chart-bar-area {
  width: 17px;
  height: 125px;
  display: flex;
  align-items: flex-end;
}

.mt-chart-bar-area span {
  display: block;
  width: 100%;
  border-radius: 5px 5px 0 0;
  background: #46c89e;
}

.mt-chart-column.active
.mt-chart-bar-area span {
  background: #168dea;
}

.mt-chart-column.active {
  color: #1063bb;
  font-weight: 900;
}

.mt-chart-note {
  padding-top: 13px;
  color: #8b9aa0;
  font-size: 10px;
  line-height: 1.6;
}

.mt-lower-grid {
  display: grid;
  grid-template-columns: 1.55fr .9fr;
  gap: 12px;
  margin-top: 12px;
}

.mt-overall-progress {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.mt-overall-progress small {
  color: #8498a0;
  font-size: 10px;
}

.mt-overall-progress strong {
  font-size: 23px;
  color: #049b6a;
}

.mt-category-grid {
  display: grid;
  grid-template-columns:
    repeat(6,minmax(0,1fr));
  gap: 7px;
}

.mt-category-card {
  min-width: 0;
  border: 1px solid #e2ecef;
  border-radius: 11px;
  padding: 12px 9px;
}

.mt-category-card-title {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  font-size: 10px;
}

.mt-category-card-title span {
  font-size: 17px;
}

.mt-category-card-title strong {
  line-height: 1.3;
}

.mt-category-percent {
  text-align: center;
  font-size: 19px;
  font-weight: 900;
  margin: 15px 0 10px;
  color: #0a9c6e;
}

.mt-category-card small {
  display: block;
  margin-top: 10px;
  color: #8b99a3;
  font-size: 9px;
  line-height: 1.5;
}

.mt-activity-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.mt-activity-number strong {
  display: block;
  color: #11352f;
  font-size: 25px;
}

.mt-activity-number strong span {
  color: #91a29f;
  font-size: 16px;
}

.mt-activity-number small {
  display: block;
  color: #8a9b9f;
  font-size: 10px;
  margin-top: 5px;
}

.mt-activity-percent {
  display: grid;
  place-items: center;
  width: 65px;
  height: 65px;
  border: 9px solid #c9eadf;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 900;
  color: #068d65;
}

.mt-week-grid {
  display: grid;
  grid-template-columns:
    repeat(5,minmax(0,1fr));
  gap: 5px;
}

.mt-week-box {
  border: 1px solid #e0e8ea;
  border-radius: 7px;
  background: #f4f7f8;
  color: #4e6870;
  padding: 9px 2px;
  font-size: 10px;
  font-weight: 800;
}

.mt-week-box.has-activity {
  background: #d7f4e8;
  color: #07845f;
  border-color: #b6e7d1;
}

.mt-week-box.selected {
  background: #078e67;
  color: white;
  border-color: #078e67;
}

.mt-week-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin-top: 13px;
  font-size: 10px;
  color: #7e9099;
}

.mt-week-legend span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mt-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.mt-dot.active {
  background: #0da675;
}

.mt-dot.inactive {
  background: #d8e1e4;
}

.mt-participant-panel {
  margin-top: 12px;
}

.mt-list-actions {
  display: flex;
  gap: 8px;
}

.mt-search {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #dbe5e9;
  padding: 0 10px;
  border-radius: 9px;
  color: #8b9da4;
}

.mt-search input {
  border: 0;
  background: transparent;
  outline: 0;
  padding: 10px 0;
  width: 170px;
  font-size: 11px;
  color: #183d31;
}

.mt-participant-table-wrap {
  overflow-x: auto;
}

.mt-participant-table {
  width: 100%;
  min-width: 870px;
  border-collapse: collapse;
  text-align: left;
  font-size: 11px;
}

.mt-participant-table th {
  padding: 12px 10px;
  color: #617c84;
  background: #eef4f6;
  white-space: nowrap;
}

.mt-participant-table td {
  padding: 13px 10px;
  border-bottom: 1px solid #edf1f2;
}

.mt-name-cell {
  font-weight: 850;
  color: #213732;
}

.mt-active-badge {
  display: inline-block;
  border-radius: 20px;
  background: #d8f7e7;
  color: #078153;
  padding: 6px 13px;
  font-weight: 850;
}

.mt-detail-button {
  border: 1px solid #11a37a;
  border-radius: 8px;
  background: white;
  color: #07815a;
  font-size: 11px;
  font-weight: 850;
  padding: 9px 12px;
  white-space: nowrap;
}

.mt-detail-button:hover {
  background: #e7f7f0;
}

.mt-empty-cell {
  text-align: center;
  color: #81929a;
  padding: 25px;
  font-size: 12px;
}

.mt-mobile-participants {
  display: none;
}

.mt-footer {
  text-align: center;
  color: #8e9ea7;
  font-size: 10px;
  padding: 25px 8px;
}

.mt-overlay {
  display: none;
}

.mt-access {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 25px;
  background: #061e24;
  color: white;
  font-family: Arial, sans-serif;
  text-align: center;
}

.mt-access > div {
  max-width: 540px;
}

.mt-access p {
  color: #c0d8cf;
  line-height: 1.8;
}

.mt-access button {
  display: inline-block;
  margin: 8px;
  border: 1px solid #b6d8c4;
  border-radius: 10px;
  background: #d8b45a;
  color: #082f26;
  padding: 13px 17px;
  font-weight: 800;
}

/* PRESENTATION */

.mt-presentation .mt-sidebar {
  display: none;
}

.mt-presentation .mt-main {
  margin-left: 0;
}

.mt-presentation .mt-content {
  max-width: 1900px;
  padding: 20px 26px;
}

.mt-presentation .mt-hero {
  min-height: 190px;
}

/* RESPONSIVE */

@media (max-width:1450px) {
  .mt-overview-grid {
    grid-template-columns: 1fr 1.15fr;
  }

  .mt-chart-panel {
    grid-column: 1 / -1;
  }

  .mt-chart-bars {
    justify-content: space-around;
    min-width: 780px;
  }

  .mt-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }
}

@media (max-width:1150px) {
  .mt-kpi-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .mt-lower-grid {
    grid-template-columns: 1fr;
  }

  .mt-category-grid {
    grid-template-columns:
      repeat(6,minmax(0,1fr));
  }
}

@media (max-width:900px) {
  .mt-overview-grid {
    grid-template-columns: 1fr;
  }

  .mt-chart-panel {
    grid-column: auto;
  }

  .mt-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .mt-hero-top {
    flex-wrap: wrap;
  }
}

@media (max-width:760px) {
  .mt-sidebar {
    width: 260px;
    transform: translateX(-105%);
    transition: transform .2s;
  }

  .mt-sidebar.open {
    transform: translateX(0);
  }

  .mt-overlay.open {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 45;
    background: #001e1999;
  }

  .mt-main {
    margin-left: 0;
  }

  .mt-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 59px;
    padding: 0 16px;
    color: white;
    background: #071e25;
  }

  .mt-mobile-header strong {
    font-size: 19px;
  }

  .mt-mobile-header strong span {
    color: #2aca93;
  }

  .mt-mobile-header button {
    border: 0;
    color: white;
    background: transparent;
  }

  .mt-hero {
    padding: 18px 14px 25px;
  }

  .mt-hero h1 {
    font-size: 27px;
  }

  .mt-hero p {
    font-size: 12px;
  }

  .mt-kicker {
    font-size: 9px;
  }

  .mt-values {
    gap: 9px;
  }

  .mt-values span {
    font-size: 9px;
  }

  .mt-account {
    max-width: 100%;
  }

  .mt-hero-bottom {
    justify-content: flex-start;
    gap: 6px;
  }

  .mt-hero-info {
    flex: 1;
    min-width: 140px;
  }

  .mt-hero-info strong {
    font-size: 10px;
  }

  .mt-content,
  .mt-presentation .mt-content {
    padding: 12px 10px 20px;
  }

  .mt-toolbar-title {
    width: 100%;
  }

  .mt-toolbar-actions {
    width: 100%;
  }

  .mt-toolbar-actions select {
    flex: 1;
    min-width: 100px;
  }

  .mt-kpi-grid {
    gap: 9px;
  }

  .mt-metric {
    min-height: 125px;
    padding: 12px 10px;
    display: block;
  }

  .mt-metric-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 7px;
  }

  .mt-metric-title {
    font-size: 10px;
  }

  .mt-metric-value {
    font-size: 24px;
  }

  .mt-metric-sub {
    font-size: 9px;
  }

  .mt-card {
    padding: 13px 11px;
  }

  .mt-card-heading h2 {
    font-size: 14px;
  }

  .mt-site-head,
  .mt-site-row {
    grid-template-columns:
      79px minmax(0,1fr) 58px 37px;
    gap: 6px;
    font-size: 10px;
  }

  .mt-week-stats {
    gap: 5px;
  }

  .mt-week-stat {
    padding: 12px 3px;
  }

  .mt-week-stat strong {
    font-size: 19px;
  }

  .mt-week-stat span {
    font-size: 8px;
  }

  .mt-category-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .mt-chart-bars {
    justify-content: flex-start;
  }

  .mt-participant-table-wrap {
    display: none;
  }

  .mt-mobile-participants {
    display: block;
  }

  .mt-list-actions {
    width: 100%;
  }

  .mt-search {
    flex: 1;
  }

  .mt-search input {
    width: 100%;
  }

  .mt-mobile-person {
    padding: 13px;
    border: 1px solid #e3ebee;
    border-radius: 12px;
    margin-bottom: 10px;
  }

  .mt-person-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }

  .mt-person-avatar {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: #daf4e8;
    color: #067a58;
    border-radius: 50%;
    font-size: 13px;
    font-weight: 900;
  }

  .mt-person-top strong {
    display: block;
    font-size: 13px;
  }

  .mt-person-top small {
    display: block;
    margin-top: 4px;
    color: #82949a;
    font-size: 10px;
  }

  .mt-person-progress {
    display: flex;
    justify-content: space-between;
    margin-bottom: 7px;
    font-size: 11px;
  }

  .mt-person-meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 12px 0;
    color: #718b8e;
    font-size: 10px;
  }

  .mt-mobile-person
  .mt-detail-button {
    width: 100%;
  }

  .mt-presentation
  .mt-mobile-header {
    display: flex;
  }
}

@media (max-width:380px) {
  .mt-list-actions {
    flex-direction: column;
  }

  .mt-search {
    width: 100%;
  }
}

@media print {
  @page {
    size: A4 landscape;
    margin: 9mm;
  }

  .mt-sidebar,
  .mt-mobile-header,
  .mt-toolbar-actions,
  .mt-list-actions,
  .mt-overlay {
    display: none !important;
  }

  .mt-main {
    margin-left: 0 !important;
  }

  .mt-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-card,
  .mt-metric {
    break-inside: avoid;
    box-shadow: none;
  }
}
`;
