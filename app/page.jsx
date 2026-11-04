"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// DASHBOARD UTAMA ADMIN / MENTOR
//
// TEMPLATE BARU — MONITORING & EVALUASI
//
// PERUBAHAN VISUAL:
// - Layout dashboard lebih ringkas
// - Sidebar pengelolaan OJT
// - Header ERG
// - Empat KPI utama
// - Program OJT Mingguan (Week 01–25)
// - Ringkasan Monitoring Mingguan
// - Enam kategori Achievement
// - Daftar Peserta OJT
//
// DIPERTAHANKAN:
// - Supabase dan struktur database
// - Hak akses Admin / Mentor / Peserta
// - Maintenance Mode
// - Kalender global Week 01–25
// - Site PMO dan TSP
// - Rumus Achievement
// - SIMPER dan Samapta
// - Filter Site dan pencarian
// - Refresh dan Logout
// - Navigasi halaman
// - Light Mode dan Dark Mode
// - Mode Presentasi
// =====================================================

const TOTAL_WEEKS = 25;
const THEME_KEY = "ojt-minetrack-theme";

const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "PMO",
  "TSP",
  "HO",
];

const TARGETS = [
  { name: "Fisik", short: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", short: "Train", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", short: "Sos", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", short: "Coach", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", short: "Orient", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", short: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const INPUT_TOOLS = [
  { key: "achievement", label: "Input Achievement", icon: "activity" },
  { key: "posttest", label: "Input Post-Test", icon: "clipboard" },
  { key: "practice", label: "Input Praktik", icon: "check" },
  { key: "samapta", label: "Input Samapta", icon: "activity" },
  { key: "simper", label: "Input SIMPER", icon: "shield" },
  { key: "calendar", label: "Jadwal & Kalender", icon: "calendar" },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

// =====================================================
// GLOBAL CALENDAR
// =====================================================

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? utcDate(2026, 9, 12)
        : addDays(utcDate(2026, 9, 20), (index - 1) * 7);

    return {
      week: index + 1,
      start: dateKey(start),
      end: dateKey(addDays(start, 6)),
    };
  }
);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeType(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return ["participant", "peserta"].includes(normalize(role));
}

function parseDate(value) {
  if (!value) return null;

  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = utcDate(year, month, day);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
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

function shortWeekLabel(week) {
  return `W${String(week).padStart(2, "0")}`;
}

function globalWeekOf(value) {
  const date = String(value || "").slice(0, 10);

  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(
      (item) => date >= item.start && date <= item.end
    )?.week ?? null
  );
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

function currentGlobalWeek() {
  const today = todayWITA();
  const current = globalWeekOf(today);

  if (current !== null) return current;
  if (today < GLOBAL_WEEKS[0].start) return 1;
  if (today > GLOBAL_WEEKS[24].end) return 25;

  const previous = GLOBAL_WEEKS.filter(
    (item) => item.end < today
  );

  return previous.length
    ? previous[previous.length - 1].week
    : 1;
}

// =====================================================
// PARTICIPANT PROGRAM CALCULATION
// =====================================================

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (days < 0) return null;

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function average(rows) {
  const numbers = rows
    .filter(
      (row) =>
        row.score !== null &&
        row.score !== undefined &&
        row.score !== ""
    )
    .map((row) => Number(row.score))
    .filter(Number.isFinite);

  return numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : null;
}

function scoreText(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString("id-ID", {
        maximumFractionDigits: 2,
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
  const number = Number(value) || 0;

  if (unit === "km") {
    return `${number.toLocaleString("id-ID", {
      maximumFractionDigits: 3,
    })} km`;
  }

  return `${number} kegiatan`;
}

function activityAmount(records, categoryName) {
  if (categoryName === "Fisik") {
    return records.reduce((sum, record) => {
      const km = Number(record.distance_km);

      return (
        sum +
        (Number.isFinite(km) && km > 0 ? km : 0)
      );
    }, 0);
  }

  return records.length;
}

// =====================================================
// ACHIEVEMENT CALCULATION
// =====================================================

function calculateAchievements(records, types, startDate) {
  const codes = new Map(
    types.map((type) => [
      normalizeType(type.name),
      normalizeType(type.code),
    ])
  );

  const verified = records.filter(
    (record) =>
      normalize(record.status) === "verified" &&
      weekOf(record.activity_date, startDate) !== null
  );

  const categories = TARGETS.map((item) => {
    const code = codes.get(normalizeType(item.name));

    const matching = code
      ? verified.filter(
          (record) =>
            normalizeType(record.type_code) === code
        )
      : [];

    const amount = activityAmount(matching, item.name);
    const progress = clamp((amount / item.target) * 100);

    return {
      ...item,
      amount,
      progress,
      completed: amount >= item.target,
    };
  });

  const total = categories.reduce(
    (sum, category) => sum + category.progress,
    0
  );

  const done = categories.filter(
    (category) => category.completed
  ).length;

  return {
    categories,
    done,
    progress: Math.round(total / TARGETS.length),
    completed: done === TARGETS.length,
  };
}

// =====================================================
// SIMPER V2
// =====================================================

function parseSimperMetadata(notes) {
  const text = String(notes || "");
  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) return null;

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
  const issuanceStatus = meta?.issuance_status || "not_issued";

  return {
    progress: Math.round((completed / 3) * 100),
    completed,
    passed: completed === 3,
    released: issuanceStatus === "issued",
    legacy: !meta && record.status === "passed",
  };
}

// =====================================================
// SAMAPTA
// =====================================================

function getSamaptaSessions(records) {
  const sessions = new Map();

  records.forEach((record) => {
    if (!record.test_date) return;

    const key = String(record.test_date).slice(0, 10);

    if (!sessions.has(key)) sessions.set(key, []);
    sessions.get(key).push(record);
  });

  const output = [];

  sessions.forEach((items, date) => {
    const getScore = (type) => {
      const record = items.find(
        (item) =>
          normalizeType(item.test_type) === normalizeType(type)
      );

      if (
        !record ||
        record.score === null ||
        record.score === undefined ||
        record.score === ""
      ) {
        return null;
      }

      const number = Number(record.score);

      return Number.isFinite(number) ? number : null;
    };

    const a = getScore("Lari 12 Menit");

    const parts = [
      getScore("Pull-Up"),
      getScore("Push-Up"),
      getScore("Sit-Up"),
      getScore("Shuttle Run"),
    ];

    if (a === null || parts.some((number) => number === null)) {
      return;
    }

    const b =
      parts.reduce((sum, number) => sum + number, 0) / 4;

    const run = items.find(
      (item) =>
        normalizeType(item.test_type) === "lari12menit"
    );

    const distance =
      run?.result_value === null ||
      run?.result_value === undefined ||
      run?.result_value === ""
        ? null
        : Number(run.result_value);

    const validDistance =
      distance !== null && Number.isFinite(distance);

    output.push({
      date,
      a,
      b,
      final: (a + b) / 2,
      distance: validDistance ? distance : null,
      runPassed: validDistance && distance >= 2600,
    });
  });

  return output.sort((a, b) => a.date.localeCompare(b.date));
}

// =====================================================
// ICON COMPONENT
// =====================================================

function Icon({ name, size = 20 }) {
  const icons = {
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
    chart: (
      <path d="M5 20v-7M11 20V5M17 20v-11M22 20V3" />
    ),
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
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    activity: (
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    ),
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" />
      </>
    ),
    alert: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
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

// =====================================================
// REUSABLE COMPONENTS
// =====================================================

function Progress({ value, compact = false }) {
  const safe = clamp(value);

  return (
    <div
      className={`mt-progress ${compact ? "compact" : ""}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function Metric({ title, value, sub, icon, tone, onClick }) {
  return (
    <div
      className={`mt-metric ${tone || ""} ${
        onClick ? "clickable" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="mt-metric-icon">
        <Icon name={icon} size={23} />
      </div>

      <div className="mt-metric-content">
        <span className="mt-metric-title">{title}</span>
        <strong className="mt-metric-value">{value}</strong>
        <small className="mt-metric-sub">{sub}</small>
      </div>

      <div className="mt-metric-decoration" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

// =====================================================
// MAIN DASHBOARD
// =====================================================

export default function MentorDashboard() {
  const router = useRouter();

  // THEME
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    function syncTheme() {
      const current =
        document.documentElement.getAttribute("data-theme");

      setTheme(current === "dark" ? "dark" : "light");
    }

    syncTheme();

    const observer = new MutationObserver(syncTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      nextTheme
    );

    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);

    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // Tema tetap aktif selama sesi berjalan.
    }
  }

  // MAIN STATE
  const [account, setAccount] = useState(null);

  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [inputTool, setInputTool] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [accessStatus, setAccessStatus] = useState("checking");
  const [maintenanceMode, setMaintenanceMode] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isAdmin = normalize(account?.role) === "admin";
  const currentWeek = GLOBAL_WEEKS[selectedWeek - 1];

  useEffect(() => {
    setSelectedWeek(currentGlobalWeek());
  }, []);

  // ===================================================
  // MAINTENANCE STATUS
  // ===================================================

  async function fetchMaintenanceStatus() {
    const { data, error: statusError } = await supabase
      .from("app_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .maybeSingle();

    if (statusError) {
      throw new Error(
        `Gagal membaca Maintenance Mode: ${statusError.message}`
      );
    }

    if (typeof data?.maintenance_mode !== "boolean") {
      throw new Error(
        "Pengaturan Maintenance Mode belum tersedia."
      );
    }

    return data.maintenance_mode;
  }

  // ===================================================
  // FETCH DASHBOARD DATA
  // ===================================================

  async function fetchDashboardData() {
    const [programRes, typeRes] = await Promise.all([
      supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          start_date,
          end_date,
          status,
          site
        `)
        .eq("status", "active")
        .order("start_date", { ascending: false }),

      supabase
        .from("achievement_types")
        .select("code,name"),
    ]);

    if (programRes.error) {
      throw new Error(`Program OJT: ${programRes.error.message}`);
    }

    if (typeRes.error) {
      throw new Error(
        `Kategori Achievement: ${typeRes.error.message}`
      );
    }

    const rawPrograms = programRes.data || [];
    const types = typeRes.data || [];

    const participantIds = [
      ...new Set(
        rawPrograms
          .map((program) => program.participant_id)
          .filter(Boolean)
      ),
    ];

    if (!participantIds.length) {
      return {
        programs: [],
        types,
        achievements: [],
        postTests: [],
        practices: [],
        samapta: [],
        simper: [],
      };
    }

    const profileRes = await supabase
      .from("profiles")
      .select("id,full_name,department,role")
      .in("id", participantIds);

    if (profileRes.error) {
      throw new Error(
        `Validasi Profil Peserta: ${profileRes.error.message}`
      );
    }

    const profileMap = new Map(
      (profileRes.data || []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const list = rawPrograms
      .map((program) => ({
        ...program,
        peserta: profileMap.get(program.participant_id) || null,
      }))
      .filter((program) => {
        const profile = program.peserta;

        return (
          profile &&
          profile.id === program.participant_id &&
          isParticipantRole(profile.role)
        );
      });

    const ids = [
      ...new Set(list.map((program) => program.id)),
    ];

    if (!ids.length) {
      return {
        programs: [],
        types,
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
        .select("id,program_id,score,practice_date")
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
      types,
      achievements: results[0].data || [],
      postTests: results[1].data || [],
      practices: results[2].data || [],
      samapta: results[3].data || [],
      simper: results[4].data || [],
    };
  }

  function applyDashboard(data) {
    setPrograms(data.programs);
    setAchievementTypes(data.types);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractices(data.practices);
    setSamapta(data.samapta);
    setSimper(data.simper);
    setLastUpdated(new Date());
  }

  // ===================================================
  // AUTHENTICATION
  // ===================================================

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
          if (mounted) setAccessStatus("redirecting");
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
          throw new Error("Profil akun tidak ditemukan.");
        }

        const role = normalize(profile.role);
        const admin = role === "admin";
        const mentor = role === "mentor";
        const participant = isParticipantRole(role);

        if (!admin && !mentor && !participant) {
          throw new Error(
            "Akun tidak memiliki akses Dashboard."
          );
        }

        const maintenance = await fetchMaintenanceStatus();

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

        const data = await fetchDashboardData();

        if (!mounted) return;

        setAccount({ ...profile, role });
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
  }, [router]);

  // ===================================================
  // ADMIN MAINTENANCE MONITORING
  // ===================================================

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;

    async function checkStatus() {
      try {
        const status = await fetchMaintenanceStatus();

        if (active) setMaintenanceMode(status);
      } catch {
        if (active) setMaintenanceMode(null);
      }
    }

    checkStatus();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        checkStatus();
      }
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isAdmin]);

  // ===================================================
  // ACTIONS
  // ===================================================

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
      const maintenance = await fetchMaintenanceStatus();

      setMaintenanceMode(maintenance);

      if (maintenance && !isAdmin) {
        setAccount(null);
        setPrograms([]);
        setAccessStatus("maintenance");
        return;
      }

      const data = await fetchDashboardData();

      applyDashboard(data);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

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
      Math.max(1, Math.min(TOTAL_WEEKS, number))
    );
  }

  // ===================================================
  // SIDEBAR INPUT NAVIGATION
  // Peserta dipilih terlebih dahulu sebelum input.
  // ===================================================

  function openInputTool(tool) {
    setInputTool(tool);
    setMenuOpen(false);
  }

  function chooseInputProgram(programId) {
    const routes = {
      achievement: (id) => `/achievement/${id}`,
      posttest: (id) => `/mingguan/${id}`,
      practice: (id) => `/praktik/${id}`,
      samapta: (id) => `/samapta/${id}`,
      simper: (id) => `/simper/${id}`,
      calendar: (id) => `/mingguan/${id}`,
    };

    const route = routes[inputTool];

    if (!route) return;

    setInputTool(null);
    router.push(route(programId));
  }

  // ===================================================
  // DATA PER PROGRAM
  // ===================================================

  const dataByProgram = useMemo(() => {
    const output = {};

    programs.forEach((program) => {
      const id = program.id;

      const a = achievements.filter(
        (row) => row.program_id === id
      );

      const pt = postTests.filter(
        (row) => row.program_id === id
      );

      const pr = practices.filter(
        (row) => row.program_id === id
      );

      const sm = samapta.filter(
        (row) => row.program_id === id
      );

      const sp = simper.filter(
        (row) => row.program_id === id
      );

      const achievementInfo = calculateAchievements(
        a,
        achievementTypes,
        program.start_date
      );

      const chosenSimper =
        sp.find((record) =>
          parseSimperMetadata(record.notes)
        ) ||
        sp[0] ||
        null;

      const simperInfo = calculateSimper(chosenSimper);
      const samaptaSessions = getSamaptaSessions(sm);

      const latestSamapta = samaptaSessions.length
        ? samaptaSessions[samaptaSessions.length - 1]
        : null;

      const weeks = new Set();

      const markWeek = (value) => {
        const week = weekOf(value, program.start_date);

        if (week !== null) weeks.add(week);
      };

      a.forEach((row) => markWeek(row.activity_date));
      pt.forEach((row) => markWeek(row.test_date));
      pr.forEach((row) => markWeek(row.practice_date));
      sm.forEach((row) => markWeek(row.test_date));

      output[id] = {
        done: achievementInfo.done,
        progress: achievementInfo.progress,
        achievementCompleted: achievementInfo.completed,
        categoryProgress: achievementInfo.categories,

        pt,
        pr,
        sm,
        sp,

        postAverage: average(pt),
        practiceAverage: average(pr),

        samaptaSessions,
        latestSamapta,
        samaptaComplete: samaptaSessions.length > 0,
        samaptaPassed: latestSamapta?.runPassed === true,

        simperProgress: simperInfo.progress,
        simperPassed: simperInfo.passed,
        simperIssued: simperInfo.released,
        simperLegacy: simperInfo.legacy,

        activityWeeks: weeks.size,
        activityProgress: Math.round(
          (weeks.size / TOTAL_WEEKS) * 100
        ),
      };
    });

    return output;
  }, [
    programs,
    achievementTypes,
    achievements,
    postTests,
    practices,
    samapta,
    simper,
  ]);

  // ===================================================
  // SITE FILTER AND SEARCH
  // ===================================================

  const sitePrograms = useMemo(() => {
    return programs.filter(
      (program) =>
        isParticipantRole(program.peserta?.role) &&
        (siteFilter === "ALL" ||
          program.site === siteFilter)
    );
  }, [programs, siteFilter]);

  const filtered = useMemo(() => {
    const keyword = normalize(search);

    return sitePrograms.filter((program) => {
      const name = normalize(program.peserta?.full_name);
      const department = normalize(
        program.peserta?.department
      );

      return (
        !keyword ||
        name.includes(keyword) ||
        department.includes(keyword)
      );
    });
  }, [sitePrograms, search]);

  const filteredIds = useMemo(
    () => new Set(filtered.map((program) => program.id)),
    [filtered]
  );

  // ===================================================
  // PROGRAM SUMMARY
  // ===================================================

  const summary = useMemo(() => {
    const relevantPractices = practices.filter(
      (row) => filteredIds.has(row.program_id)
    );

    const totalProgress = filtered.reduce(
      (sum, program) =>
        sum + (dataByProgram[program.id]?.progress || 0),
      0
    );

    const totalSimperProgress = filtered.reduce(
      (sum, program) =>
        sum +
        (dataByProgram[program.id]?.simperProgress || 0),
      0
    );

    const totalWeeks = filtered.reduce(
      (sum, program) =>
        sum +
        (dataByProgram[program.id]?.activityWeeks || 0),
      0
    );

    function countWithRecords(key) {
      return filtered.filter(
        (program) =>
          (dataByProgram[program.id]?.[key]?.length || 0) > 0
      ).length;
    }

    return {
      active: filtered.length,

      progress: filtered.length
        ? Math.round(totalProgress / filtered.length)
        : 0,

      practiceAverage: average(relevantPractices),

      completed: filtered.filter(
        (program) =>
          dataByProgram[program.id]?.achievementCompleted
      ).length,

      attention: filtered.filter(
        (program) =>
          (dataByProgram[program.id]?.progress || 0) < 50
      ).length,

      postTest: countWithRecords("pt"),
      practice: countWithRecords("pr"),

      samapta: filtered.filter(
        (program) =>
          dataByProgram[program.id]?.samaptaComplete
      ).length,

      samaptaPassed: filtered.filter(
        (program) =>
          dataByProgram[program.id]?.samaptaPassed
      ).length,

      simper: countWithRecords("sp"),

      simperIssued: filtered.filter(
        (program) =>
          dataByProgram[program.id]?.simperIssued
      ).length,

      simperAverage: filtered.length
        ? Math.round(
            totalSimperProgress / filtered.length
          )
        : 0,

      averageWeeks: filtered.length
        ? (totalWeeks / filtered.length).toFixed(1)
        : "0.0",
    };
  }, [
    filtered,
    filteredIds,
    practices,
    dataByProgram,
  ]);

  // ===================================================
  // WEEKLY RECORDS
  // ===================================================

  const weeklyRecords = useMemo(
    () =>
      achievements.filter(
        (record) =>
          filteredIds.has(record.program_id) &&
          globalWeekOf(record.activity_date) === selectedWeek
      ),
    [achievements, filteredIds, selectedWeek]
  );

  const weeklyPostTests = useMemo(
    () =>
      postTests.filter(
        (record) =>
          filteredIds.has(record.program_id) &&
          globalWeekOf(record.test_date) === selectedWeek
      ),
    [postTests, filteredIds, selectedWeek]
  );

  const weeklyPractices = useMemo(
    () =>
      practices.filter(
        (record) =>
          filteredIds.has(record.program_id) &&
          globalWeekOf(record.practice_date) === selectedWeek
      ),
    [practices, filteredIds, selectedWeek]
  );

  const weeklySamapta = useMemo(
    () =>
      samapta.filter(
        (record) =>
          filteredIds.has(record.program_id) &&
          globalWeekOf(record.test_date) === selectedWeek
      ),
    [samapta, filteredIds, selectedWeek]
  );

  const weeklySummary = useMemo(() => {
    const verified = weeklyRecords.filter(
      (record) =>
        normalize(record.status) === "verified"
    );

    const pending = weeklyRecords.filter(
      (record) =>
        normalize(record.status) === "pending"
    );

    const participantsWithPostTest = new Set(
      weeklyPostTests.map((record) => record.program_id)
    );

    const participantsWithPractice = new Set(
      weeklyPractices.map((record) => record.program_id)
    );

    return {
      active: filtered.length,
      postTest: participantsWithPostTest.size,
      practice: participantsWithPractice.size,
      completed: summary.completed,
      verified: verified.length,
      pending: pending.length,
      samapta: weeklySamapta.length,
      total: weeklyRecords.length,
    };
  }, [
    weeklyRecords,
    weeklyPostTests,
    weeklyPractices,
    weeklySamapta,
    filtered,
    summary.completed,
  ]);

  // ===================================================
  // WEEKLY CATEGORY PROGRESS
  // ===================================================

  const weeklyCategories = useMemo(() => {
    const codes = new Map(
      achievementTypes.map((type) => [
        normalizeType(type.name),
        normalizeType(type.code),
      ])
    );

    return TARGETS.map((category) => {
      const code = codes.get(
        normalizeType(category.name)
      );

      let weeklyAmount = 0;
      let cumulativeAmount = 0;
      let totalProgress = 0;
      let pendingCount = 0;

      filtered.forEach((program) => {
        const records = achievements.filter(
          (record) =>
            record.program_id === program.id &&
            code &&
            normalizeType(record.type_code) === code &&
            weekOf(
              record.activity_date,
              program.start_date
            ) !== null
        );

        const thisWeek = records.filter(
          (record) =>
            globalWeekOf(record.activity_date) ===
            selectedWeek
        );

        const verifiedThisWeek = thisWeek.filter(
          (record) =>
            normalize(record.status) === "verified"
        );

        const pendingThisWeek = thisWeek.filter(
          (record) =>
            normalize(record.status) === "pending"
        );

        const cumulative = records.filter((record) => {
          const week = globalWeekOf(record.activity_date);

          return (
            week !== null &&
            week <= selectedWeek &&
            normalize(record.status) === "verified"
          );
        });

        const weekValue = activityAmount(
          verifiedThisWeek,
          category.name
        );

        const cumulativeValue = activityAmount(
          cumulative,
          category.name
        );

        weeklyAmount += weekValue;
        cumulativeAmount += cumulativeValue;
        pendingCount += pendingThisWeek.length;

        totalProgress += clamp(
          (cumulativeValue / category.target) * 100
        );
      });

      return {
        ...category,
        weeklyAmount,
        cumulativeAmount,
        pendingCount,
        progress: filtered.length
          ? Math.round(totalProgress / filtered.length)
          : 0,
      };
    });
  }, [
    achievementTypes,
    achievements,
    filtered,
    selectedWeek,
  ]);

  // ===================================================
  // GLOBAL WEEKLY CHART
  // ===================================================

  const weeklyChart = useMemo(
    () =>
      GLOBAL_WEEKS.map((week) => {
        const verifiedRecords = achievements.filter(
          (record) =>
            filteredIds.has(record.program_id) &&
            normalize(record.status) === "verified" &&
            globalWeekOf(record.activity_date) === week.week
        );

        return {
          ...week,
          count: verifiedRecords.length,
        };
      }),
    [achievements, filteredIds]
  );

  const maxChart = Math.max(
    1,
    ...weeklyChart.map((item) => item.count)
  );

  // ===================================================
  // ACTIVITY WEEKS
  // ===================================================

  const activityWeeks = useMemo(() => {
    const weeks = new Set();

    const add = (date, id) => {
      if (!filteredIds.has(id)) return;

      const week = globalWeekOf(date);

      if (week !== null) weeks.add(week);
    };

    achievements.forEach((row) =>
      add(row.activity_date, row.program_id)
    );

    postTests.forEach((row) =>
      add(row.test_date, row.program_id)
    );

    practices.forEach((row) =>
      add(row.practice_date, row.program_id)
    );

    samapta.forEach((row) =>
      add(row.test_date, row.program_id)
    );

    return weeks;
  }, [
    achievements,
    postTests,
    practices,
    samapta,
    filteredIds,
  ]);

  // ===================================================
  // ACCOUNT AND DISPLAY
  // =====================================================

  const accountRole = isAdmin
    ? "Administrator"
    : "Mentor OJT";
   const accountName =
    account?.full_name ||
    (isAdmin ? "Admin" : "Mentor OJT");

  const updatedText = lastUpdated
    ? lastUpdated.toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      })
    : "Belum diperbarui";

  const activeInputTool = INPUT_TOOLS.find(
    (item) => item.key === inputTool
  );

  // ===================================================
  // ACCESS SCREEN: MAINTENANCE
  // ===================================================

  if (accessStatus === "maintenance") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <div className="mt-access-icon">🛠️</div>

          <h1>OJT MineTrack Sedang Maintenance</h1>

          <p>
            Sistem sedang dalam proses pemeliharaan.
            Akses Mentor dan Peserta sementara tidak tersedia.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Coba Lagi
          </button>

          <button
            type="button"
            className="secondary"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "Sedang Keluar..." : "Keluar Akun"}
          </button>
        </div>
      </main>
    );
  }

  // ===================================================
  // ACCESS SCREEN: CHECKING
  // ===================================================

  if (
    accessStatus === "checking" ||
    accessStatus === "redirecting"
  ) {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <div className="mt-loading-mark">MT</div>
          <h2>OJT MineTrack</h2>
          <p>Memeriksa akses pengguna...</p>
        </div>
      </main>
    );
  }

  // ===================================================
  // ACCESS SCREEN: ERROR
  // ===================================================

  if (accessStatus === "error") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <div className="mt-access-icon">!</div>

          <h1>Gagal Memuat Dashboard</h1>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Coba Lagi
          </button>

          <button
            type="button"
            className="secondary"
            onClick={() => router.replace("/login")}
          >
            Buka Login
          </button>
        </div>
      </main>
    );
  }

  // ===================================================
  // MAIN DASHBOARD UI
  // ===================================================

  return (
    <div
      className={`mt-shell ${
        presentationMode ? "mt-presentation" : ""
      }`}
      data-dashboard-theme={theme}
    >
      <style>{dashboardCSS}</style>

      {/* MOBILE OVERLAY */}

      {menuOpen && (
        <button
          type="button"
          className="mt-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Tutup menu navigasi"
        />
      )}

      {/* =================================================
          SIDEBAR
      ================================================= */}

      <aside
        className={`mt-sidebar ${
          menuOpen ? "open" : ""
        }`}
      >
        <div className="mt-sidebar-top">
          {/* BRAND */}

          <div className="mt-brand">
            <div className="mt-brand-name">
              OJT <span>MineTrack</span>
              <small>v2.0</small>
            </div>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>
          </div>

          {/* MAIN MENU */}

          <div className="mt-menu-label">
            MENU MENTOR
          </div>

          <nav className="mt-nav-group">
            <button
              type="button"
              className="mt-nav active"
              onClick={() => navigate("/")}
            >
              <Icon name="home" size={18} />
              <span>Dashboard Mentor</span>
              <i className="mt-nav-indicator" />
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/monitoring-peserta")
              }
            >
              <Icon name="users" size={18} />
              <span>Monitoring Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/daftar-peserta")
              }
            >
              <Icon name="file" size={18} />
              <span>Pendaftaran Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/persetujuan-peserta")
              }
            >
              <Icon name="check" size={18} />
              <span>Persetujuan Peserta</span>
            </button>
          </nav>

          {/* OJT MANAGEMENT */}

          <div className="mt-menu-label">
            PENGELOLAAN OJT
          </div>

          <nav className="mt-nav-group">
            {INPUT_TOOLS.map((item) => (
              <button
                type="button"
                className="mt-nav"
                key={item.key}
                onClick={() => openInputTool(item.key)}
              >
                <Icon name={item.icon} size={18} />
                <span>{item.label}</span>
                <Icon name="arrow" size={13} />
              </button>
            ))}
          </nav>

          {/* ADMIN MENU */}

          {isAdmin && (
            <>
              <div className="mt-menu-label admin">
                ADMINISTRATOR
              </div>

              <nav className="mt-nav-group">
                <button
                  type="button"
                  className="mt-nav"
                  onClick={() =>
                    navigate("/mingguan/admin-review")
                  }
                >
                  <Icon name="calendar" size={18} />
                  <span>Evaluasi Mingguan</span>
                </button>

                <button
                  type="button"
                  className="mt-nav"
                  onClick={() =>
                    navigate("/dashboard-peserta")
                  }
                >
                  <Icon name="users" size={18} />
                  <span>Preview Dashboard Peserta</span>
                </button>

                <button
                  type="button"
                  className="mt-nav"
                  onClick={() =>
                    navigate("/admin/maintenance")
                  }
                >
                  <Icon name="gear" size={18} />
                  <span>Maintenance Mode</span>

                  <strong
                    className={`mt-maintenance-label ${
                      maintenanceMode === true ? "on" : ""
                    }`}
                  >
                    {maintenanceMode === true
                      ? "ON"
                      : maintenanceMode === false
                      ? "OFF"
                      : "—"}
                  </strong>
                </button>
              </nav>
            </>
          )}
        </div>

        {/* SIDEBAR BOTTOM */}

        <div className="mt-sidebar-bottom">
          <div className="mt-side-user">
            <div className="mt-side-avatar">
              {initials(accountName)}
            </div>

            <div className="mt-side-user-info">
              <strong>{accountName}</strong>
              <small>{accountRole}</small>
            </div>
          </div>

          <button
            type="button"
            className="mt-side-action"
            onClick={refresh}
            disabled={refreshing || loading}
          >
            <Icon name="refresh" size={17} />

            <span>
              {refreshing
                ? "Memperbarui Data..."
                : "Refresh Data"}
            </span>
          </button>

          <button
            type="button"
            className="mt-side-action logout"
            onClick={logout}
            disabled={loggingOut}
          >
            <Icon name="logout" size={17} />

            <span>
              {loggingOut
                ? "Sedang Keluar..."
                : "Keluar Akun"}
            </span>
          </button>

          <div className="mt-side-footer">
            <strong>OJT MineTrack v2.0</strong>
            <small>© 2026 · PT Berau Coal</small>
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN CONTENT
      ================================================= */}

      <main className="mt-main">
        {/* MOBILE HEADER */}

        <div className="mt-mobile-header">
          <div className="mt-mobile-brand">
            OJT <span>MineTrack</span>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu navigasi"
          >
            <Icon name="menu" size={25} />
          </button>
        </div>

        {/* =================================================
            HERO HEADER
        ================================================= */}

        <header className="mt-hero">
          <div className="mt-hero-background" />

          <div className="mt-hero-content">
            <div className="mt-hero-top">
              <div className="mt-hero-title">
                <div className="mt-kicker">
                  EMERGENCY RESPONSE GROUP · PT BERAU COAL
                </div>

                <h1>
                  Dashboard Mentor OJT{" "}
                  <span>MineTrack</span>
                </h1>

                <p>
                  Monitoring dan Evaluasi Pelaksanaan On Job Training
                </p>

                <div className="mt-values">
                  <span>
                    <Icon name="shield" size={14} />
                    Safe People
                  </span>

                  <span>
                    <Icon name="gear" size={14} />
                    Safe Operation
                  </span>

                  <span>
                    <Icon name="leaf" size={14} />
                    Sustainable Mining
                  </span>
                </div>
              </div>

              <div className="mt-account">
                <div className="mt-account-avatar">
                  {initials(accountName)}
                </div>

                <div className="mt-account-info">
                  <strong>{accountName}</strong>
                  <small>{accountRole}</small>
                </div>
              </div>
            </div>

            <div className="mt-hero-info">
              <div className="mt-hero-info-item">
                <span className="mt-hero-info-icon">
                  <Icon name="calendar" size={18} />
                </span>

                <div>
                  <small>Periode Program 25 Week</small>
                  <strong>12 Sep 2026 – 06 Mar 2027</strong>
                </div>
              </div>

              <div className="mt-hero-info-item">
                <span className="mt-hero-info-icon">
                  <Icon name="map" size={18} />
                </span>

                <div>
                  <small>Site yang Dipilih</small>
                  <strong>
                    {siteFilter === "ALL"
                      ? "Semua Site"
                      : siteFilter}
                  </strong>
                </div>
              </div>

              <div className="mt-hero-info-item">
                <span className="mt-hero-info-icon">
                  <Icon name="refresh" size={18} />
                </span>

                <div>
                  <small>Terakhir Diperbarui</small>
                  <strong>{updatedText}</strong>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            DASHBOARD CONTENT
        ================================================= */}

        <div className="mt-content">
          {/* TOOLBAR */}

          <section className="mt-toolbar">
            <div className="mt-toolbar-heading">
              <span className="mt-section-kicker">
                DASHBOARD OVERVIEW
              </span>

              <h2>Monitoring Program OJT</h2>

              <p>
                Ringkasan perkembangan peserta dan pencapaian
                program 2026–2027.
              </p>
            </div>

            <div className="mt-toolbar-actions">
              {/* WEEK */}

              <div className="mt-control mt-week-control">
                <Icon name="calendar" size={17} />

                <select
                  value={selectedWeek}
                  onChange={(event) =>
                    changeWeek(event.target.value)
                  }
                  aria-label="Pilih minggu OJT"
                >
                  {GLOBAL_WEEKS.map((week) => (
                    <option
                      key={week.week}
                      value={week.week}
                    >
                      {weekLabel(week.week)}
                    </option>
                  ))}
                </select>
              </div>

              {/* THEME */}

              <button
                type="button"
                className="mt-theme-toggle"
                onClick={toggleTheme}
                aria-label={
                  theme === "dark"
                    ? "Aktifkan Mode Terang"
                    : "Aktifkan Mode Gelap"
                }
                title={
                  theme === "dark"
                    ? "Ubah ke Mode Terang"
                    : "Ubah ke Mode Gelap"
                }
              >
                <span className="mt-theme-icon">
                  <Icon
                    name={theme === "dark" ? "sun" : "moon"}
                    size={17}
                  />
                </span>

                <span>
                  {theme === "dark"
                    ? "Mode Gelap"
                    : "Mode Terang"}
                </span>
              </button>

              {/* SITE FILTER */}

              <div className="mt-control mt-site-control">
                <Icon name="map" size={16} />

                <select
                  value={siteFilter}
                  onChange={(event) =>
                    setSiteFilter(event.target.value)
                  }
                  aria-label="Pilih Site"
                >
                  <option value="ALL">Semua Site</option>

                  {SITES.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>

              {/* REFRESH */}

              <button
                type="button"
                className="mt-button-outline"
                onClick={refresh}
                disabled={refreshing}
              >
                <Icon name="refresh" size={16} />
                {refreshing ? "Memuat..." : "Refresh"}
              </button>

              {/* PRESENTATION */}

              <button
                type="button"
                className="mt-button-primary"
                onClick={() =>
                  setPresentationMode((value) => !value)
                }
              >
                <Icon name="presentation" size={16} />

                {presentationMode
                  ? "Tampilan Normal"
                  : "Presentasi"}
              </button>
            </div>
          </section>

          {/* CURRENT WEEK */}

          <section className="mt-current-week">
            <div className="mt-current-week-left">
              <span className="mt-current-week-icon">
                <Icon name="calendar" size={17} />
              </span>

              <div>
                <strong>{weekLabel(selectedWeek)}</strong>
                <small>
                  {formatPeriod(
                    currentWeek.start,
                    currentWeek.end
                  )}
                </small>
              </div>
            </div>

            <div className="mt-current-week-actions">
              <button
                type="button"
                disabled={selectedWeek <= 1}
                onClick={() =>
                  changeWeek(selectedWeek - 1)
                }
                aria-label="Minggu sebelumnya"
              >
                <Icon name="left" size={16} />
              </button>

              <button
                type="button"
                disabled={selectedWeek >= TOTAL_WEEKS}
                onClick={() =>
                  changeWeek(selectedWeek + 1)
                }
                aria-label="Minggu berikutnya"
              >
                <Icon name="arrow" size={16} />
              </button>
            </div>
          </section>

          {error && (
            <div className="mt-error" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="mt-loading-card">
              <div className="mt-loading-spinner" />
              <strong>Memuat Dashboard OJT...</strong>
              <small>Mohon tunggu sebentar.</small>
            </div>
          ) : (
            <>
              {/* =================================================
                  KPI
              ================================================= */}

              <section className="mt-kpi-grid">
                <Metric
                  title="Peserta OJT Aktif"
                  value={summary.active}
                  sub="Berdasarkan filter saat ini"
                  icon="users"
                  tone="green"
                  onClick={() =>
                    navigate("/mentor/monitoring-peserta")
                  }
                />

                <Metric
                  title="Rata-rata Progres"
                  value={`${summary.progress}%`}
                  sub="Rata-rata enam kategori"
                  icon="chart"
                  tone="blue"
                />

                <Metric
                  title="Perlu Perhatian"
                  value={summary.attention}
                  sub="Progres OJT di bawah 50%"
                  icon="alert"
                  tone="gold"
                />

                <Metric
                  title="Target Lengkap"
                  value={summary.completed}
                  sub="Peserta memenuhi enam target"
                  icon="check"
                  tone="green"
                />
              </section>

              {/* =================================================
                  MAIN MONITORING GRID
              ================================================= */}

              <section className="mt-monitoring-grid">
                {/* PROGRAM OJT MINGGUAN */}

                <div className="mt-panel mt-program-panel">
                  <div className="mt-panel-heading">
                    <div>
                      <div className="mt-panel-title">
                        <span className="mt-panel-icon">
                          <Icon name="chart" size={18} />
                        </span>

                        <h3>Program OJT Mingguan</h3>
                      </div>

                      <p>
                        Jumlah Achievement Verified pada setiap
                        minggu program.
                      </p>
                    </div>

                    <span className="mt-panel-badge">
                      25 Weeks
                    </span>
                  </div>

                  <div className="mt-program-summary">
                    <div>
                      <small>Minggu Terpilih</small>
                      <strong>{weekLabel(selectedWeek)}</strong>
                      <span>
                        {formatPeriod(
                          currentWeek.start,
                          currentWeek.end
                        )}
                      </span>
                    </div>

                    <div>
                      <small>Achievement Verified</small>
                      <strong>
                        {weeklyChart[selectedWeek - 1]?.count || 0}
                      </strong>
                      <span>Kegiatan pada minggu terpilih</span>
                    </div>

                    <div>
                      <small>Minggu Beraktivitas</small>
                      <strong>{activityWeeks.size}/25</strong>
                      <span>Minggu dengan catatan aktivitas</span>
                    </div>
                  </div>

                  <div className="mt-week-chart-scroll">
                    <div className="mt-week-chart">
                      {weeklyChart.map((item) => {
                        const active =
                          item.week === selectedWeek;

                        const hasActivity =
                          activityWeeks.has(item.week);

                        const height = item.count
                          ? Math.max(
                              7,
                              (item.count / maxChart) * 100
                            )
                          : 3;

                        return (
                          <button
                            type="button"
                            key={item.week}
                            className={[
                              "mt-week-chart-item",
                              active ? "selected" : "",
                              hasActivity ? "has-activity" : "",
                            ].join(" ")}
                            onClick={() =>
                              changeWeek(item.week)
                            }
                            title={`${weekLabel(item.week)} · ${formatPeriod(
                              item.start,
                              item.end
                            )} · ${item.count} Verified`}
                          >
                            <strong>{item.count}</strong>

                            <div className="mt-week-chart-bar">
                              <span
                                style={{
                                  height: `${height}%`,
                                }}
                              />
                            </div>

                            <small>
                              {shortWeekLabel(item.week)}
                            </small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-program-legend">
                    <span>
                      <i className="legend-verified" />
                      Achievement Verified
                    </span>

                    <span>
                      <i className="legend-selected" />
                      Minggu terpilih
                    </span>
                  </div>

                  <div className="mt-week-calendar">
                    <div className="mt-week-calendar-heading">
                      <strong>Jadwal Kalender OJT</strong>
                      <small>
                        Pilih Week 01–25 untuk melihat periode
                        pelaksanaan.
                      </small>
                    </div>

                    <div className="mt-week-calendar-grid">
                      {GLOBAL_WEEKS.map((item) => (
                        <button
                          type="button"
                          key={item.week}
                          className={[
                            "mt-week-calendar-item",
                            activityWeeks.has(item.week)
                              ? "has-activity"
                              : "",
                            item.week === selectedWeek
                              ? "selected"
                              : "",
                          ].join(" ")}
                          onClick={() =>
                            changeWeek(item.week)
                          }
                          title={`${weekLabel(item.week)}: ${formatPeriod(
                            item.start,
                            item.end
                          )}`}
                        >
                          {shortWeekLabel(item.week)}
                          {activityWeeks.has(item.week) && (
                            <i />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-panel-footnote">
                    Kalender mengikuti jadwal global program
                    OJT, bukan tanggal mulai masing-masing peserta.
                  </div>
                </div>

                {/* RINGKASAN MONITORING */}

                <div className="mt-panel mt-weekly-panel">
                  <div className="mt-panel-heading">
                    <div>
                      <div className="mt-panel-title">
                        <span className="mt-panel-icon">
                          <Icon name="calendar" size={18} />
                        </span>

                        <h3>Ringkasan Monitoring Mingguan</h3>
                      </div>

                      <p>
                        Rekap pencapaian peserta pada{" "}
                        {weekLabel(selectedWeek)}.
                      </p>
                    </div>
                  </div>

                  <div className="mt-week-stats">
                    <div className="mt-week-stat green">
                      <span className="mt-stat-icon">
                        <Icon name="users" size={19} />
                      </span>

                      <strong>{weeklySummary.active}</strong>
                      <small>Peserta Aktif</small>
                    </div>

                    <div className="mt-week-stat blue">
                      <span className="mt-stat-icon">
                        <Icon name="clipboard" size={19} />
                      </span>

                      <strong>{weeklySummary.postTest}</strong>
                      <small>Post-Test</small>
                    </div>

                    <div className="mt-week-stat gold">
                      <span className="mt-stat-icon">
                        <Icon name="check" size={19} />
                      </span>

                      <strong>{weeklySummary.practice}</strong>
                      <small>Praktik</small>
                    </div>

                    <div className="mt-week-stat purple">
                      <span className="mt-stat-icon">
                        <Icon name="activity" size={19} />
                      </span>

                      <strong>{weeklySummary.samapta}</strong>
                      <small>Samapta</small>
                    </div>
                  </div>

                  {/* VERIFICATION */}

                  <div className="mt-verification">
                    <div className="mt-verification-item verified">
                      <i />
                      <div>
                        <strong>{weeklySummary.verified}</strong>
                        <small>Verified</small>
                      </div>
                    </div>

                    <div className="mt-verification-item pending">
                      <i />
                      <div>
                        <strong>{weeklySummary.pending}</strong>
                        <small>Pending</small>
                      </div>
                    </div>

                    <div className="mt-verification-item total">
                      <i />
                      <div>
                        <strong>{weeklySummary.total}</strong>
                        <small>Total Aktivitas</small>
                      </div>
                    </div>
                  </div>

                  {/* SIX CATEGORIES */}

                  <div className="mt-category-heading">
                    <strong>
                      Capaian Achievement (6 Kategori)
                    </strong>

                    <span>
                      Rata-rata: {summary.progress}%
                    </span>
                  </div>

                  <div className="mt-week-category-grid">
                    {weeklyCategories.map((item) => (
                      <div
                        className="mt-week-category"
                        key={item.name}
                      >
                        <div className="mt-week-category-top">
                          <span>{item.icon}</span>
                          <strong>{item.name}</strong>
                          <b>{item.progress}%</b>
                        </div>

                        <Progress value={item.progress} />

                        <div className="mt-category-amount">
                          <span>
                            {amountText(
                              item.cumulativeAmount,
                              item.unit
                            )}
                          </span>

                          <span>
                            / {amountText(
                              item.target,
                              item.unit
                            )}
                          </span>
                        </div>

                        {item.pendingCount > 0 && (
                          <small className="mt-pending-note">
                            {item.pendingCount} aktivitas pending
                          </small>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-panel-footnote">
                    Progres kategori dihitung dari aktivitas
                    Verified. Akumulasi mengikuti minggu yang dipilih.
                  </div>
                </div>
              </section>

              {/* =================================================
                  PARTICIPANT MONITORING
              ================================================= */}

              <section className="mt-panel mt-participant-panel">
                <div className="mt-participant-heading">
                  <div>
                    <div className="mt-panel-title">
                      <span className="mt-panel-icon">
                        <Icon name="users" size={18} />
                      </span>

                      <h3>Daftar Peserta OJT Aktif</h3>
                    </div>

                    <p>
                      Monitoring progres, enam kategori Achievement,
                      SIMPER, dan aktivitas peserta.
                    </p>
                  </div>

                  <div className="mt-participant-actions">
                    <label className="mt-search">
                      <Icon name="search" size={17} />

                      <input
                        type="search"
                        placeholder="Cari nama / departemen..."
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="mt-button-primary"
                      onClick={() =>
                        navigate("/mentor/monitoring-peserta")
                      }
                    >
                      Lihat Semua
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                </div>

                {/* DESKTOP TABLE */}

                <div className="mt-table-wrap">
                  <table className="mt-participant-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Peserta</th>
                        <th>Departemen</th>
                        <th>Site</th>
                        <th>Periode OJT</th>
                        <th>Progres</th>
                        <th>6 Kategori</th>
                        <th>SIMPER</th>
                        <th>Aktivitas</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((program, index) => {
                        const info = dataByProgram[program.id];

                        return (
                          <tr key={program.id}>
                            <td>{index + 1}</td>

                            <td className="mt-name-cell">
                              {program.peserta?.full_name ||
                                "Peserta OJT"}
                            </td>

                            <td>
                              {program.peserta?.department || "—"}
                            </td>

                            <td>
                              <span className="mt-site-badge">
                                {program.site || "—"}
                              </span>
                            </td>

                            <td className="mt-period-cell">
                              {formatDate(program.start_date)}
                              <span>–</span>
                              {formatDate(program.end_date)}
                            </td>

                            <td>
                              <div className="mt-progress-cell">
                                <Progress
                                  value={info?.progress || 0}
                                  compact
                                />

                                <strong>
                                  {info?.progress || 0}%
                                </strong>
                              </div>
                            </td>

                            <td>
                              <div className="mt-category-mini">
                                {TARGETS.map((category) => {
                                  const item =
                                    info?.categoryProgress?.find(
                                      (row) =>
                                        row.name === category.name
                                    );

                                  return (
                                    <span
                                      key={category.name}
                                      title={`${category.name}: ${
                                        item?.progress || 0
                                      }%`}
                                    >
                                      <small>
                                        {category.short}
                                      </small>

                                      <strong>
                                        {item?.progress || 0}%
                                      </strong>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            <td>
                              <strong className="mt-table-value">
                                {info?.simperProgress || 0}%
                              </strong>
                            </td>

                            <td>
                              {info?.activityWeeks || 0}/25
                            </td>

                            <td>
                              <span className="mt-status-active">
                                Aktif
                              </span>
                            </td>

                            <td>
                              <div className="mt-row-actions">
                                <button
                                  type="button"
                                  className="mt-action-button input"
                                  onClick={() =>
                                    navigate(
                                      `/achievement/${program.id}`
                                    )
                                  }
                                  title="Input Achievement"
                                >
                                  <Icon name="plus" size={13} />
                                  Input
                                </button>

                                <button
                                  type="button"
                                  className="mt-action-button monitoring"
                                  onClick={() =>
                                    navigate(
                                      `/achievement/${program.id}/monitoring`
                                    )
                                  }
                                  title="Monitoring Achievement"
                                >
                                  <Icon name="activity" size={13} />
                                  Monitoring
                                </button>

                                <button
                                  type="button"
                                  className="mt-action-button detail"
                                  onClick={() =>
                                    navigate(
                                      `/peserta/${program.id}`
                                    )
                                  }
                                  title="Detail Peserta"
                                >
                                  Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {!filtered.length && (
                        <tr>
                          <td
                            colSpan={11}
                            className="mt-empty-cell"
                          >
                            Belum ada Peserta OJT aktif yang
                            sesuai dengan filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE PARTICIPANT CARDS */}

                <div className="mt-mobile-participants">
                  {filtered.map((program) => {
                    const info = dataByProgram[program.id];

                    const name =
                      program.peserta?.full_name ||
                      "Peserta OJT";

                    return (
                      <article
                        className="mt-mobile-person"
                        key={program.id}
                      >
                        <div className="mt-person-top">
                          <div className="mt-person-avatar">
                            {initials(name)}
                          </div>

                          <div className="mt-person-info">
                            <strong>{name}</strong>

                            <small>
                              {program.peserta?.department || "—"}
                              {" · "}
                              {program.site || "—"}
                            </small>
                          </div>

                          <span className="mt-status-active">
                            Aktif
                          </span>
                        </div>

                        <div className="mt-person-period">
                          <Icon name="calendar" size={14} />
                          {formatPeriod(
                            program.start_date,
                            program.end_date
                          )}
                        </div>

                        <div className="mt-person-progress-heading">
                          <span>Progres OJT</span>
                          <strong>
                            {info?.progress || 0}%
                          </strong>
                        </div>

                        <Progress
                          value={info?.progress || 0}
                        />

                        <div className="mt-person-categories">
                          {TARGETS.map((category) => {
                            const item =
                              info?.categoryProgress?.find(
                                (row) =>
                                  row.name === category.name
                              );

                            return (
                              <div
                                className="mt-person-category"
                                key={category.name}
                              >
                                <span>
                                  {category.icon} {category.short}
                                </span>

                                <strong>
                                  {item?.progress || 0}%
                                </strong>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-person-meta">
                          <span>
                            SIMPER: {info?.simperProgress || 0}%
                          </span>

                          <span>
                            Aktivitas: {info?.activityWeeks || 0}/25
                          </span>
                        </div>

                        <div className="mt-mobile-action-grid">
                          <button
                            type="button"
                            className="mt-action-button input"
                            onClick={() =>
                              navigate(
                                `/achievement/${program.id}`
                              )
                            }
                          >
                            <Icon name="plus" size={14} />
                            Input
                          </button>

                          <button
                            type="button"
                            className="mt-action-button monitoring"
                            onClick={() =>
                              navigate(
                                `/achievement/${program.id}/monitoring`
                              )
                            }
                          >
                            <Icon name="activity" size={14} />
                            Monitoring
                          </button>

                          <button
                            type="button"
                            className="mt-action-button detail"
                            onClick={() =>
                              navigate(`/peserta/${program.id}`)
                            }
                          >
                            Detail Peserta
                          </button>
                        </div>
                      </article>
                    );
                  })}

                  {!filtered.length && (
                    <div className="mt-empty-cell">
                      Belum ada Peserta OJT aktif.
                    </div>
                  )}
                </div>

                <div className="mt-list-footer">
                  <span>
                    Menampilkan {filtered.length} dari{" "}
                    {programs.length} peserta aktif.
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/mentor/monitoring-peserta")
                    }
                  >
                    Buka Monitoring Peserta
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </section>
            </>
          )}

          <footer className="mt-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal · Program 2026–2027
          </footer>
        </div>
      </main>

      {/* =================================================
          INPUT TOOL — PARTICIPANT SELECTOR
      ================================================= */}

      {inputTool && (
        <div
          className="mt-modal-overlay"
          onClick={() => setInputTool(null)}
        >
          <div
            className="mt-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mt-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mt-modal-heading">
              <div>
                <span className="mt-modal-icon">
                  <Icon
                    name={activeInputTool?.icon || "file"}
                    size={21}
                  />
                </span>

                <div>
                  <h3 id="mt-modal-title">
                    {activeInputTool?.label || "Pengelolaan OJT"}
                  </h3>

                  <p>
                    Pilih peserta untuk melanjutkan ke halaman
                    pengelolaan OJT.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="mt-modal-close"
                onClick={() => setInputTool(null)}
                aria-label="Tutup"
              >
                <Icon name="close" size={19} />
              </button>
            </div>

            <div className="mt-modal-list">
              {filtered.map((program) => (
                <button
                  type="button"
                  key={program.id}
                  className="mt-modal-person"
                  onClick={() =>
                    chooseInputProgram(program.id)
                  }
                >
                  <span className="mt-modal-avatar">
                    {initials(program.peserta?.full_name)}
                  </span>

                  <span className="mt-modal-person-info">
                    <strong>
                      {program.peserta?.full_name ||
                        "Peserta OJT"}
                    </strong>

                    <small>
                      {program.peserta?.department || "—"}
                      {" · "}
                      {program.site || "—"}
                    </small>
                  </span>

                  <Icon name="arrow" size={17} />
                </button>
              ))}

              {!filtered.length && (
                <div className="mt-modal-empty">
                  Tidak ada peserta yang sesuai dengan filter.
                  Silakan ubah filter Site atau pencarian.
                </div>
              )}
            </div>

            <div className="mt-modal-footer">
              <span>
                {filtered.length} peserta tersedia
              </span>

              <button
                type="button"
                onClick={() => setInputTool(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// COMPLETE DASHBOARD CSS
// TEMPLATE MONITORING OJT — LIGHT / DARK MODE
// =====================================================

const dashboardCSS = `

/* =====================================================
   GLOBAL
===================================================== */

.mt-shell,
.mt-shell * {
  box-sizing: border-box;
}

.mt-shell {
  --mt-bg: rgba(239,247,243,.88);
  --mt-surface: rgba(255,255,255,.94);
  --mt-surface-alt: rgba(238,247,242,.94);
  --mt-text: #17352f;
  --mt-heading: #102c28;
  --mt-muted: #718a80;
  --mt-border: rgba(175,205,190,.70);
  --mt-border-soft: rgba(180,210,194,.43);
  --mt-input: rgba(255,255,255,.95);
  --mt-green: #07875d;
  --mt-green-light: #16a878;
  --mt-green-soft: #e0f5e9;
  --mt-progress-bg: #dcebe3;
  --mt-shadow: rgba(9,48,35,.08);

  min-height: 100vh;
  position: relative;
  isolation: isolate;

  background:
    linear-gradient(
      135deg,
      rgba(237,248,241,.88),
      rgba(229,244,236,.86)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;

  color: var(--mt-text);
  font-family: Arial, Helvetica, sans-serif;

  transition:
    background-color .25s ease,
    color .25s ease;
}

/* DARK MODE */

:root[data-theme="dark"] .mt-shell {
  --mt-bg: rgba(7,24,23,.87);
  --mt-surface: rgba(12,37,33,.94);
  --mt-surface-alt: rgba(22,49,43,.94);
  --mt-text: #e6f4ec;
  --mt-heading: #f1fbf5;
  --mt-muted: #a0b9ae;
  --mt-border: rgba(65,105,88,.62);
  --mt-border-soft: rgba(65,105,88,.38);
  --mt-input: rgba(17,45,39,.96);
  --mt-green: #75e5ae;
  --mt-green-light: #42d69a;
  --mt-green-soft: #193e32;
  --mt-progress-bg: #294a40;
  --mt-shadow: rgba(0,0,0,.23);

  background:
    linear-gradient(
      135deg,
      rgba(3,17,18,.93),
      rgba(4,27,24,.89)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;
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

.mt-shell button:focus-visible,
.mt-shell input:focus-visible,
.mt-shell select:focus-visible {
  outline: 3px solid #42d49a;
  outline-offset: 2px;
}

/* =====================================================
   SIDEBAR
===================================================== */

.mt-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 255px;
  z-index: 50;

  display: flex;
  flex-direction: column;
  justify-content: space-between;

  padding: 19px 13px 13px;
  overflow-y: auto;

  color: #fff;

  background: linear-gradient(
    180deg,
    #041d1b 0%,
    #06332c 55%,
    #064437 100%
  );

  box-shadow: 5px 0 25px rgba(0,0,0,.13);
}

.mt-sidebar-top {
  min-height: 0;
}

.mt-brand {
  padding: 8px 10px 19px;
  margin-bottom: 8px;
  border-bottom: 1px solid #ffffff20;
}

.mt-brand-name {
  color: #fff;
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -.8px;
  white-space: nowrap;
}

.mt-brand-name span {
  color: #35d49d;
}

.mt-brand-name small {
  display: inline-block;
  margin-left: 5px;
  color: #b8d2c8;
  font-size: 9px;
  letter-spacing: 0;
}

.mt-brand p {
  margin: 9px 0 0;
  color: #b6cec5;
  font-size: 10px;
  line-height: 1.65;
}

.mt-menu-label {
  padding: 14px 11px 8px;
  color: #8bc6b2;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.15px;
}

.mt-menu-label.admin {
  margin-top: 11px;
  padding-top: 17px;
  border-top: 1px solid #ffffff20;
}

.mt-nav-group {
  display: grid;
  gap: 3px;
}

.mt-nav {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 40px;

  border: 1px solid transparent;
  border-radius: 9px;
  padding: 9px 10px;

  background: transparent;
  color: #d9eae3;

  font-size: 11px;
  font-weight: 700;
  text-align: left;

  transition: background .18s ease, color .18s ease;
}

.mt-nav:hover {
  color: #fff;
  background: #ffffff13;
}

.mt-nav.active {
  color: #fff;
  background: linear-gradient(90deg,#07996d,#087451);
  border-color: #ffffff18;
  box-shadow: 0 4px 12px #00000015;
}

.mt-nav > svg:first-child {
  flex-shrink: 0;
  color: #b9d9cd;
}

.mt-nav.active > svg:first-child {
  color: #fff;
}

.mt-nav > span {
  flex: 1;
  min-width: 0;
  line-height: 1.4;
}

.mt-nav > svg:last-child:not(:first-child) {
  color: #8cb7a7;
  flex-shrink: 0;
}

.mt-nav-indicator {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  background: #baf4d8;
  border-radius: 50%;
}

.mt-maintenance-label {
  flex-shrink: 0;
  padding: 4px 7px;
  border-radius: 6px;
  background: #ffffff1b;
  color: #c8e9da;
  font-size: 9px;
}

.mt-maintenance-label.on {
  background: #fef3c7;
  color: #92400e;
}

/* SIDEBAR BOTTOM */

.mt-sidebar-bottom {
  margin-top: 20px;
}

.mt-side-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  margin-bottom: 10px;

  border: 1px solid #ffffff1d;
  background: #ffffff0c;
  border-radius: 10px;
}

.mt-side-avatar {
  width: 35px;
  height: 35px;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;
  background: #d2f0e2;
  color: #0b4938;

  font-size: 11px;
  font-weight: 900;
}

.mt-side-user-info {
  min-width: 0;
}

.mt-side-user-info strong,
.mt-side-user-info small {
  display: block;
  overflow-wrap: anywhere;
}

.mt-side-user-info strong {
  color: #fff;
  font-size: 10px;
}

.mt-side-user-info small {
  margin-top: 4px;
  color: #9ec9ba;
  font-size: 9px;
}

.mt-side-action {
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 38px;
  margin-bottom: 5px;
  padding: 9px 11px;

  border: 1px solid transparent;
  border-radius: 8px;

  background: #ffffff0e;
  color: #dff7ed;

  text-align: left;
  font-size: 10px;
  font-weight: 750;
}

.mt-side-action:hover {
  background: #ffffff1b;
  border-color: #ffffff20;
}

.mt-side-action.logout {
  background: transparent;
  color: #ffd4cd;
}

.mt-side-action.logout:hover {
  background: #dc26261c;
}

.mt-side-footer {
  display: grid;
  gap: 4px;
  padding: 12px 10px 2px;
  margin-top: 8px;
  border-top: 1px solid #ffffff18;
}

.mt-side-footer strong {
  color: #afcec4;
  font-size: 9px;
}

.mt-side-footer small {
  color: #7aa89c;
  font-size: 9px;
}

/* =====================================================
   MAIN / MOBILE HEADER
===================================================== */

.mt-main {
  margin-left: 255px;
  min-width: 0;
  background: transparent;
}

.mt-mobile-header {
  display: none;
}

/* =====================================================
   HERO
===================================================== */

.mt-hero {
  position: relative;
  min-height: 205px;
  overflow: hidden;

  padding: 23px 27px 18px;

  color: #fff;
  background: #052a28;

  border-bottom: 1px solid #ffffff18;
}

.mt-hero-background {
  position: absolute;
  inset: 0;

  background:
    linear-gradient(
      90deg,
      rgba(2,22,25,.96) 0%,
      rgba(3,35,34,.85) 52%,
      rgba(3,25,27,.60) 100%
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;

  z-index: 0;
}

.mt-hero-content {
  position: relative;
  z-index: 1;
}

.mt-hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.mt-kicker {
  color: #efca77;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.mt-hero h1 {
  margin: 11px 0 5px;
  font-size: clamp(25px,2.5vw,37px);
  line-height: 1.17;
  letter-spacing: -.8px;
}

.mt-hero h1 span {
  color: #31d39b;
}

.mt-hero-title > p {
  margin: 0;
  color: #e1eeeb;
  font-size: 12px;
}

.mt-values {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  margin-top: 15px;
}

.mt-values span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #e6f1e9;
  font-size: 10px;
}

.mt-values svg {
  color: #f2c765;
}

.mt-account {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 280px;
  padding: 8px 11px;

  border: 1px solid #ffffff36;
  border-radius: 11px;
  background: #06232bdc;
}

.mt-account-avatar {
  width: 35px;
  height: 35px;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;
  background: #d2f0e2;
  color: #0b4938;

  font-size: 11px;
  font-weight: 900;
}

.mt-account-info strong,
.mt-account-info small {
  display: block;
}

.mt-account-info strong {
  font-size: 11px;
 }

.mt-account-info small {
  margin-top: 4px;
  color: #b8dcd0;
  font-size: 10px;
  overflow-wrap: anywhere;
}

/* HERO INFO */

.mt-hero-info {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}

.mt-hero-info-item {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 175px;
  padding: 9px 11px;

  border: 1px solid #ffffff21;
  border-radius: 9px;

  background: rgba(6,42,38,.84);
  color: #fff;
  backdrop-filter: blur(10px);
}

.mt-hero-info-icon {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;
  border-radius: 8px;
  color: #6ee7b7;
  background: #ffffff12;
}

.mt-hero-info-item small,
.mt-hero-info-item strong {
  display: block;
}

.mt-hero-info-item small {
  margin-bottom: 4px;
  color: #a9c9bd;
  font-size: 9px;
}

.mt-hero-info-item strong {
  color: #f1faf5;
  font-size: 10px;
}

/* =====================================================
   CONTENT / TOOLBAR
===================================================== */

.mt-content {
  max-width: 1850px;
  margin: auto;
  padding: 17px 19px 25px;
}

.mt-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  margin-bottom: 12px;
}

.mt-toolbar-heading {
  min-width: 200px;
}

.mt-section-kicker {
  color: var(--mt-green);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.15px;
}

.mt-toolbar-heading h2 {
  margin: 5px 0 4px;
  color: var(--mt-heading);
  font-size: 17px;
  font-weight: 900;
}

.mt-toolbar-heading p {
  margin: 0;
  color: var(--mt-muted);
  font-size: 10px;
  line-height: 1.5;
}

.mt-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 7px;
}

.mt-control {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 10px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;

  background: var(--mt-surface);
  color: var(--mt-green);

  backdrop-filter: blur(10px);
}

.mt-control select {
  max-width: 125px;
  border: 0;
  outline: 0;
  padding: 8px 2px;
  background: transparent;
  color: var(--mt-text);
  font-size: 10px;
  font-weight: 800;
}

.mt-control select option {
  background: #fff;
  color: #16362c;
}

:root[data-theme="dark"] .mt-control select option {
  background: #18342e;
  color: #eaf8ef;
}

/* THEME */

.mt-theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 6px 10px;

  border: 1px solid #13a778;
  border-radius: 30px;

  background: var(--mt-surface);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;

  transition: .2s ease;
}

.mt-theme-toggle:hover {
  background: var(--mt-green-soft);
  transform: translateY(-1px);
}

.mt-theme-icon {
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--mt-green-soft);
}

/* BUTTONS */

.mt-button-primary,
.mt-button-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  min-height: 38px;
  padding: 9px 12px;

  border-radius: 9px;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.mt-button-primary {
  border: 1px solid #09855f;
  background: #09855f;
  color: #fff;
}

.mt-button-primary:hover {
  background: #08744f;
}

.mt-button-outline {
  border: 1px solid var(--mt-border);
  background: var(--mt-surface);
  color: var(--mt-green);
}

.mt-button-outline:hover {
  background: var(--mt-green-soft);
}

/* CURRENT WEEK */

.mt-current-week {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  padding: 9px 13px;
  margin-bottom: 12px;

  border: 1px solid var(--mt-border);
  border-radius: 10px;

  background: var(--mt-surface);
  box-shadow: 0 3px 12px var(--mt-shadow);
  backdrop-filter: blur(10px);
}

.mt-current-week-left {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mt-current-week-icon {
  display: grid;
  place-items: center;
  width: 31px;
  height: 31px;
  border-radius: 8px;
  background: var(--mt-green-soft);
  color: var(--mt-green);
}

.mt-current-week-left strong,
.mt-current-week-left small {
  display: block;
}

.mt-current-week-left strong {
  color: var(--mt-heading);
  font-size: 11px;
}

.mt-current-week-left small {
  margin-top: 3px;
  color: var(--mt-muted);
  font-size: 9px;
}

.mt-current-week-actions {
  display: flex;
  gap: 5px;
}

.mt-current-week-actions button {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;

  border: 1px solid var(--mt-border);
  border-radius: 7px;

  background: var(--mt-surface-alt);
  color: var(--mt-green);
}

/* ERROR / LOADING */

.mt-error {
  padding: 12px 14px;
  margin-bottom: 12px;

  border: 1px solid #fecaca;
  border-radius: 9px;

  background: #fff1f1;
  color: #b91c1c;

  font-size: 11px;
}

:root[data-theme="dark"] .mt-error {
  background: #44252b;
  color: #ffbec4;
  border-color: #704047;
}

.mt-loading-card {
  display: grid;
  justify-items: center;
  gap: 9px;

  padding: 60px 20px;

  border: 1px solid var(--mt-border);
  border-radius: 13px;

  background: var(--mt-surface);
  color: var(--mt-heading);
}

.mt-loading-card strong {
  font-size: 13px;
}

.mt-loading-card small {
  color: var(--mt-muted);
  font-size: 10px;
}

.mt-loading-spinner {
  width: 33px;
  height: 33px;
  border: 3px solid var(--mt-progress-bg);
  border-top-color: var(--mt-green);
  border-radius: 50%;
  animation: mt-spin .8s linear infinite;
}

@keyframes mt-spin {
  to { transform: rotate(360deg); }
}

/* =====================================================
   KPI
===================================================== */

.mt-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 11px;
  margin-bottom: 12px;
}

.mt-metric {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-height: 102px;
  min-width: 0;

  padding: 15px 13px;
  overflow: hidden;

  border: 1px solid var(--mt-border);
  border-radius: 12px;

  background: var(--mt-surface);
  box-shadow: 0 4px 14px var(--mt-shadow);
  backdrop-filter: blur(10px);
}

.mt-metric.clickable {
  cursor: pointer;
}

.mt-metric.clickable:hover {
  border-color: #20b981;
  transform: translateY(-1px);
}

.mt-metric-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;

  border-radius: 10px;
  color: #fff;
}

.mt-metric.green .mt-metric-icon {
  background: #09966c;
}

.mt-metric.blue .mt-metric-icon {
  background: #2874db;
}

.mt-metric.gold .mt-metric-icon {
  background: #d69b1b;
}

.mt-metric-content {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.mt-metric-title {
  display: block;
  color: var(--mt-text);
  font-size: 10px;
  font-weight: 800;
}

.mt-metric-value {
  display: block;
  margin-top: 5px;
  color: var(--mt-heading);
  font-size: 27px;
  line-height: 1.1;
  font-weight: 900;
}

.mt-metric-sub {
  display: block;
  margin-top: 5px;
  color: var(--mt-muted);
  font-size: 9px;
  line-height: 1.4;
}

.mt-metric-decoration {
  position: absolute;
  right: 12px;
  bottom: 12px;

  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 27px;
  opacity: .38;
}

.mt-metric-decoration i {
  display: block;
  width: 5px;
  border-radius: 3px 3px 0 0;
  background: #079b68;
}

.mt-metric-decoration i:nth-child(1) { height: 8px; }
.mt-metric-decoration i:nth-child(2) { height: 14px; }
.mt-metric-decoration i:nth-child(3) { height: 20px; }
.mt-metric-decoration i:nth-child(4) { height: 27px; }

.mt-metric.blue .mt-metric-decoration i {
  background: #2874db;
}

.mt-metric.gold .mt-metric-decoration i {
  background: #d69b1b;
}

/* =====================================================
   MAIN MONITORING PANELS
===================================================== */

.mt-monitoring-grid {
  display: grid;
  grid-template-columns: minmax(0,1.02fr) minmax(0,1.18fr);
  gap: 12px;
  align-items: stretch;
}

.mt-panel {
  min-width: 0;
  padding: 16px;

  border: 1px solid var(--mt-border);
  border-radius: 13px;

  background: var(--mt-surface);
  box-shadow: 0 4px 16px var(--mt-shadow);
  backdrop-filter: blur(12px);
}

.mt-panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 13px;
}

.mt-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mt-panel-title h3 {
  margin: 0;
  color: var(--mt-heading);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.4;
}

.mt-panel-icon {
  display: grid;
  place-items: center;
  width: 29px;
  height: 29px;
  flex-shrink: 0;

  border-radius: 8px;
  background: #07966b;
  color: #fff;
}

.mt-panel-heading p {
  margin: 5px 0 0 37px;
  color: var(--mt-muted);
  font-size: 9px;
  line-height: 1.5;
}

.mt-panel-badge {
  flex-shrink: 0;
  padding: 6px 9px;
  border-radius: 20px;
  background: var(--mt-green-soft);
  color: var(--mt-green);
  font-size: 9px;
  font-weight: 900;
}

/* =====================================================
   PROGRAM WEEKLY
===================================================== */

.mt-program-summary {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 7px;
  margin-bottom: 12px;
}

.mt-program-summary > div {
  min-width: 0;
  padding: 10px;
  border-radius: 9px;
  background: var(--mt-surface-alt);
}

.mt-program-summary small,
.mt-program-summary strong,
.mt-program-summary span {
  display: block;
}

.mt-program-summary small {
  color: var(--mt-muted);
  font-size: 8px;
  line-height: 1.4;
}

.mt-program-summary strong {
  margin-top: 5px;
  color: var(--mt-heading);
  font-size: 19px;
  font-weight: 900;
}

.mt-program-summary span {
  margin-top: 4px;
  color: var(--mt-muted);
  font-size: 8px;
  line-height: 1.4;
}

/* WEEKLY CHART */

.mt-week-chart-scroll {
  width: 100%;
  overflow-x: auto;
  padding: 2px 0 8px;
}

.mt-week-chart {
  display: flex;
  align-items: flex-end;
  gap: 5px;
  min-width: 640px;
  height: 145px;
  padding: 5px 3px 0;

  border-bottom: 1px solid var(--mt-border);
}

.mt-week-chart-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;

  width: 22px;
  min-width: 22px;
  height: 100%;
  padding: 0;

  border: 0;
  border-radius: 5px 5px 0 0;
  background: transparent;
  color: var(--mt-muted);
}

.mt-week-chart-item > strong {
  font-size: 8px;
  font-weight: 800;
}

.mt-week-chart-bar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 15px;
  height: 91px;
}

.mt-week-chart-bar span {
  display: block;
  width: 100%;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background: #44c59a;
  transition: height .2s ease;
}

.mt-week-chart-item small {
  font-size: 8px;
  font-weight: 800;
}

.mt-week-chart-item.has-activity .mt-week-chart-bar span {
  background: #16a878;
}

.mt-week-chart-item.selected {
  color: #168dea;
}

.mt-week-chart-item.selected .mt-week-chart-bar span {
  background: #168dea;
}

.mt-week-chart-item.selected small {
  font-weight: 900;
}

.mt-program-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 13px;
  padding: 8px 2px 10px;

  color: var(--mt-muted);
  font-size: 8px;
}

.mt-program-legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.mt-program-legend i {
  width: 8px;
  height: 8px;
  border-radius: 3px;
}

.legend-verified {
  background: #16a878;
}

.legend-selected {
  background: #168dea;
}

/* WEEK CALENDAR */

.mt-week-calendar {
  padding: 11px;
  border: 1px solid var(--mt-border-soft);
  border-radius: 10px;
  background: var(--mt-surface-alt);
}

.mt-week-calendar-heading {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 9px;
}

.mt-week-calendar-heading strong {
  color: var(--mt-heading);
  font-size: 10px;
}

.mt-week-calendar-heading small {
  color: var(--mt-muted);
  font-size: 8px;
}

.mt-week-calendar-grid {
  display: grid;
  grid-template-columns: repeat(5,minmax(0,1fr));
  gap: 5px;
}

.mt-week-calendar-item {
  position: relative;
  min-height: 29px;

  border: 1px solid var(--mt-border);
  border-radius: 6px;

  background: var(--mt-surface);
  color: var(--mt-text);

  font-size: 8px;
  font-weight: 850;
}

.mt-week-calendar-item.has-activity {
  border-color: #a4dfc5;
  background: #dff6e9;
  color: #087b58;
}

:root[data-theme="dark"] .mt-week-calendar-item.has-activity {
  border-color: #326b53;
  background: #214b3c;
  color: #a2efc3;
}

.mt-week-calendar-item.selected {
  border-color: #078e67;
  background: #078e67;
  color: #fff;
}

.mt-week-calendar-item i {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #0ca56f;
}

.mt-week-calendar-item.selected i {
  background: #fff;
}

.mt-panel-footnote {
  margin-top: 10px;
  color: var(--mt-muted);
  font-size: 8px;
  line-height: 1.5;
}

/* =====================================================
   WEEKLY SUMMARY
===================================================== */

.mt-week-stats {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 6px;
  margin-bottom: 10px;
}

.mt-week-stat {
  min-width: 0;
  padding: 10px 5px;
  border-radius: 9px;
  text-align: center;
}

.mt-week-stat .mt-stat-icon {
  display: grid;
  place-items: center;
  margin: 0 auto 5px;
}

.mt-week-stat strong {
  display: block;
  font-size: 20px;
  line-height: 1.15;
  font-weight: 900;
}

.mt-week-stat small {
  display: block;
  margin-top: 5px;
  font-size: 8px;
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

:root[data-theme="dark"] .mt-week-stat.green {
  background: #173e34;
  color: #83e8b3;
}

:root[data-theme="dark"] .mt-week-stat.blue {
  background: #1d3449;
  color: #8fc2ff;
}

:root[data-theme="dark"] .mt-week-stat.gold {
  background: #44371d;
  color: #f4cf83;
}

:root[data-theme="dark"] .mt-week-stat.purple {
  background: #332b46;
  color: #c6a8ff;
}

/* VERIFICATION */

.mt-verification {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 6px;
  margin: 10px 0;
}

.mt-verification-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 8px;
  border-radius: 8px;
  background: var(--mt-surface-alt);
}

.mt-verification-item > i {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
}

.mt-verification-item strong,
.mt-verification-item small {
  display: block;
}

.mt-verification-item strong {
  color: var(--mt-heading);
  font-size: 16px;
  line-height: 1.15;
}

.mt-verification-item small {
  margin-top: 3px;
  color: var(--mt-muted);
  font-size: 8px;
}

.mt-verification-item.verified > i {
  background: #079b68;
}

.mt-verification-item.pending > i {
  background: #eab647;
}

.mt-verification-item.total > i {
  background: #368ce5;
}

/* SIX CATEGORIES */

.mt-category-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 7px;
  margin: 15px 0 10px;
}

.mt-category-heading strong {
  color: var(--mt-heading);
  font-size: 10px;
}

.mt-category-heading span {
  color: var(--mt-green);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mt-week-category-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 7px;
}

.mt-week-category {
  min-width: 0;
  padding: 10px;

  border: 1px solid var(--mt-border-soft);
  border-radius: 9px;

  background: var(--mt-surface-alt);
}

.mt-week-category-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.mt-week-category-top > span {
  font-size: 14px;
}

.mt-week-category-top strong {
  flex: 1;
  min-width: 0;
  color: var(--mt-heading);
  font-size: 9px;
}

.mt-week-category-top b {
  color: var(--mt-green);
  font-size: 10px;
}

.mt-progress {
  width: 100%;
  height: 7px;
  overflow: hidden;
  border-radius: 20px;
  background: var(--mt-progress-bg);
}

.mt-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#20bd89,#07956e);
  transition: width .2s ease;
}

:root[data-theme="dark"] .mt-progress span {
  background: linear-gradient(90deg,#1ab984,#56e0a5);
}

.mt-progress.compact {
  height: 6px;
}

.mt-category-amount {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-top: 6px;
  color: var(--mt-muted);
  font-size: 8px;
}

.mt-pending-note {
  display: block;
  margin-top: 5px;
  color: #d69b1b;
  font-size: 8px;
}

/* =====================================================
   PARTICIPANT PANEL
===================================================== */

.mt-participant-panel {
  margin-top: 12px;
}

.mt-participant-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 13px;
}

.mt-participant-heading > div:first-child > p {
  margin: 5px 0 0 37px;
  color: var(--mt-muted);
  font-size: 9px;
  line-height: 1.5;
}

.mt-participant-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}

.mt-search {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 0 10px;

  border: 1px solid var(--mt-border);
  border-radius: 8px;

  background: var(--mt-input);
  color: var(--mt-muted);
}

.mt-search input {
  width: 180px;
  padding: 8px 0;

  border: 0;
  outline: 0;
  background: transparent;

  color: var(--mt-text);
  font-size: 10px;
}

.mt-search input::placeholder {
  color: var(--mt-muted);
  opacity: 1;
}

/* TABLE */

.mt-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.mt-participant-table {
  width: 100%;
  min-width: 1280px;
  border-collapse: collapse;

  color: var(--mt-text);
  text-align: left;
  font-size: 9px;
}

.mt-participant-table th {
  padding: 11px 8px;
  border-bottom: 1px solid var(--mt-border);

  background: var(--mt-surface-alt);
  color: var(--mt-muted);

  font-size: 8px;
  font-weight: 850;
  white-space: nowrap;
}

.mt-participant-table td {
  padding: 11px 8px;
  border-bottom: 1px solid var(--mt-border-soft);
  vertical-align: middle;
}

.mt-participant-table tbody tr:hover {
  background: var(--mt-green-soft);
}

.mt-name-cell {
  color: var(--mt-heading);
  font-weight: 850;
  min-width: 125px;
}

.mt-site-badge {
  display: inline-block;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--mt-green-soft);
  color: var(--mt-green);
  font-weight: 850;
  white-space: nowrap;
}

.mt-period-cell {
  white-space: nowrap;
  color: var(--mt-muted);
}

.mt-period-cell span {
  margin: 0 4px;
}

.mt-progress-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 90px;
}

.mt-progress-cell .mt-progress {
  width: 65px;
}

.mt-progress-cell strong {
  min-width: 30px;
  color: var(--mt-green);
  font-size: 9px;
}

.mt-category-mini {
  display: grid;
  grid-template-columns: repeat(6,minmax(31px,1fr));
  gap: 3px;
  min-width: 210px;
}

.mt-category-mini span {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 4px 2px;
  border-radius: 5px;
  background: var(--mt-surface-alt);
}

.mt-category-mini small {
  color: var(--mt-muted);
  font-size: 7px;
}

.mt-category-mini strong {
  color: var(--mt-green);
  font-size: 8px;
}

.mt-table-value {
  color: var(--mt-green);
}

.mt-status-active {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 20px;
  background: #d8f7e7;
  color: #078153;
  font-size: 8px;
  font-weight: 850;
  white-space: nowrap;
}

:root[data-theme="dark"] .mt-status-active {
  background: #234c3d;
  color: #a2ebbf;
}

/* TABLE ACTIONS */

.mt-row-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  min-width: 205px;
}

.mt-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  min-height: 27px;
  padding: 5px 7px;

  border: 1px solid var(--mt-border);
  border-radius: 6px;

  background: var(--mt-surface);
  color: var(--mt-green);

  font-size: 8px;
  font-weight: 850;
  white-space: nowrap;
}

.mt-action-button:hover {
  background: var(--mt-green-soft);
}

.mt-action-button.input {
  border-color: #07875d;
  background: #07875d;
  color: #fff;
}

.mt-action-button.monitoring {
  border-color: #368ce5;
  color: #368ce5;
}

.mt-action-button.detail {
  color: var(--mt-text);
}

/* EMPTY */

.mt-empty-cell {
  padding: 28px 15px !important;
  text-align: center;
  color: var(--mt-muted);
  font-size: 10px;
}

/* LIST FOOTER */

.mt-list-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
  color: var(--mt-muted);
  font-size: 9px;
}

.mt-list-footer button {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  border: 0;
  background: transparent;
  color: var(--mt-green);

  font-size: 9px;
  font-weight: 850;
}

/* MOBILE PARTICIPANTS */

.mt-mobile-participants {
  display: none;
}

.mt-mobile-person {
  padding: 13px;
  margin-bottom: 10px;

  border: 1px solid var(--mt-border);
  border-radius: 11px;

  background: var(--mt-surface);
}

.mt-person-top {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 11px;
}

.mt-person-avatar {
  width: 39px;
  height: 39px;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;
  background: #daf4e8;
  color: #067a58;

  font-size: 12px;
  font-weight: 900;
}

:root[data-theme="dark"] .mt-person-avatar {
  background: #285241;
  color: #aaf2cc;
}

.mt-person-info {
  flex: 1;
  min-width: 0;
}

.mt-person-info strong {
  display: block;
  color: var(--mt-heading);
  font-size: 11px;
}

.mt-person-info small {
  display: block;
  margin-top: 4px;
  color: var(--mt-muted);
  font-size: 9px;
}

.mt-person-period {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 10px 0;

  color: var(--mt-muted);
  font-size: 9px;
}

.mt-person-progress-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;

  color: var(--mt-text);
  font-size: 10px;
}

.mt-person-progress-heading strong {
  color: var(--mt-green);
}

.mt-person-categories {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 5px;
  margin-top: 12px;
}

.mt-person-category {
  display: flex;
  justify-content: space-between;
  gap: 5px;
  padding: 7px;

  border-radius: 6px;
  background: var(--mt-surface-alt);

  font-size: 8px;
}

.mt-person-category span {
  color: var(--mt-muted);
}

.mt-person-category strong {
  color: var(--mt-green);
}

.mt-person-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 11px 0;

  color: var(--mt-muted);
  font-size: 9px;
}

.mt-mobile-action-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mt-mobile-action-grid .mt-action-button {
  min-height: 34px;
  font-size: 9px;
}

.mt-mobile-action-grid .mt-action-button:last-child {
  grid-column: 1 / -1;
}

/* =====================================================
   INPUT PARTICIPANT MODAL
===================================================== */

.mt-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;

  display: flex;
  align-items: center;
  justify-content: center;

  padding: 18px;
  background: rgba(0,18,16,.67);
  backdrop-filter: blur(5px);
}

.mt-modal {
  width: 100%;
  max-width: 490px;
  max-height: min(80vh,680px);
  overflow: hidden;

  display: flex;
  flex-direction: column;

  border: 1px solid var(--mt-border);
  border-radius: 15px;

  background: var(--mt-surface);
  color: var(--mt-text);

  box-shadow: 0 20px 70px rgba(0,0,0,.3);
}

.mt-modal-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;

  padding: 17px;
  border-bottom: 1px solid var(--mt-border-soft);
}

.mt-modal-heading > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mt-modal-icon {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  flex-shrink: 0;

  border-radius: 10px;
  background: var(--mt-green-soft);
  color: var(--mt-green);
}

.mt-modal-heading h3 {
  margin: 0;
  color: var(--mt-heading);
  font-size: 13px;
}

.mt-modal-heading p {
  margin: 5px 0 0;
  color: var(--mt-muted);
  font-size: 9px;
  line-height: 1.5;
}

.mt-modal-close {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;

  border: 1px solid var(--mt-border);
  border-radius: 7px;

  background: var(--mt-surface-alt);
  color: var(--mt-text);
}

.mt-modal-list {
  overflow-y: auto;
  padding: 8px 12px;
}

.mt-modal-person {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 7px;

  border: 0;
  border-bottom: 1px solid var(--mt-border-soft);
  background: transparent;
  color: var(--mt-text);
  text-align: left;
}

.mt-modal-person:hover {
  background: var(--mt-green-soft);
}

.mt-modal-avatar {
  width: 34px;
  height: 34px;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;
  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 900;
}

.mt-modal-person-info {
  flex: 1;
  min-width: 0;
}

.mt-modal-person-info strong,
.mt-modal-person-info small {
  display: block;
}

.mt-modal-person-info strong {
  color: var(--mt-heading);
  font-size: 10px;
}

.mt-modal-person-info small {
  margin-top: 4px;
  color: var(--mt-muted);
  font-size: 9px;
}

.mt-modal-person > svg {
  color: var(--mt-green);
}

.mt-modal-empty {
  padding: 28px 12px;
  color: var(--mt-muted);
  text-align: center;
  font-size: 10px;
  line-height: 1.6;
}

.mt-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;

  padding: 12px 16px;
  border-top: 1px solid var(--mt-border-soft);

  color: var(--mt-muted);
  font-size: 9px;
}

.mt-modal-footer button {
  padding: 7px 13px;
  border: 1px solid var(--mt-border);
  border-radius: 7px;
  background: var(--mt-surface-alt);
  color: var(--mt-green);
  font-size: 9px;
  font-weight: 850;
}

/* =====================================================
   FOOTER
===================================================== */

.mt-footer {
  padding: 22px 8px 8px;
  text-align: center;
  color: var(--mt-muted);
  font-size: 9px;
}

/* =====================================================
   ACCESS SCREEN
===================================================== */

.mt-access {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 25px;

  background:
    linear-gradient(135deg,#041d1b,#07513e);

  color: #fff;
  font-family: Arial,Helvetica,sans-serif;
  text-align: center;
}

.mt-access-card {
  width: 100%;
  max-width: 480px;
  padding: 35px 25px;

  border: 1px solid #ffffff20;
  border-radius: 17px;

  background: #ffffff0d;
  box-shadow: 0 15px 45px #00000025;
}

.mt-access-icon {
  display: grid;
  place-items: center;
  width: 65px;
  height: 65px;
  margin: 0 auto 18px;

  border-radius: 17px;
  background: #ffffff15;
  color: #8ce8bd;

  font-size: 35px;
  font-weight: 900;
}

.mt-loading-mark {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 18px;

  border-radius: 16px;
  background: #0b9569;
  color: #fff;

  font-size: 20px;
  font-weight: 900;
}

.mt-access h1,
.mt-access h2 {
  margin: 0 0 12px;
  font-size: 22px;
}

.mt-access p {
  color: #c0d8cf;
  font-size: 12px;
  line-height: 1.8;
}

.mt-access button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  margin: 7px 4px 0;
  padding: 11px 16px;

  border: 1px solid #b6d8c4;
  border-radius: 9px;

  background: #d8f3e5;
  color: #082f26;

  font-size: 11px;
  font-weight: 850;
}

.mt-access button.secondary {
  background: transparent;
  color: #fff;
}

/* =====================================================
   PRESENTATION MODE
===================================================== */

.mt-presentation .mt-sidebar {
  display: none;
}

.mt-presentation .mt-main {
  margin-left: 0;
}

.mt-presentation .mt-content {
  max-width: 1900px;
  padding: 20px 25px;
}

.mt-presentation .mt-hero {
  min-height: 180px;
}

/* =====================================================
   RESPONSIVE
===================================================== */

@media (max-width:1450px) {
  .mt-monitoring-grid {
    grid-template-columns: minmax(0,1fr) minmax(0,1.1fr);
  }

  .mt-content {
    padding-left: 14px;
    padding-right: 14px;
  }

  .mt-category-mini {
    min-width: 190px;
  }
}

@media (max-width:1120px) {
  .mt-sidebar {
    width: 225px;
  }

  .mt-main {
    margin-left: 225px;
  }

  .mt-kpi-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .mt-monitoring-grid {
    grid-template-columns: 1fr;
  }

  .mt-week-chart {
    min-width: 680px;
  }

  .mt-toolbar {
    align-items: flex-start;
  }
}

@media (max-width:760px) {
  .mt-sidebar {
    width: 265px;
    transform: translateX(-105%);
    transition: transform .22s ease;
  }

  .mt-sidebar.open {
    transform: translateX(0);
  }

  .mt-overlay {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 45;

    width: 100%;
    height: 100%;

    border: 0;
    background: #001e1999;
  }

  .mt-main {
    margin-left: 0;
  }

  .mt-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    height: 55px;
    padding: 0 14px;

    background: #061f20;
    color: #fff;
  }

  .mt-mobile-brand {
    font-size: 19px;
    font-weight: 900;
  }

  .mt-mobile-brand span {
    color: #35d49d;
  }

  .mt-mobile-header button {
    display: grid;
    place-items: center;
    width: 35px;
    height: 35px;

    border: 0;
    background: transparent;
    color: #fff;
  }

  .mt-hero {
    min-height: auto;
    padding: 17px 13px 15px;
  }

  .mt-hero-top {
    flex-wrap: wrap;
    gap: 12px;
  }

  .mt-hero h1 {
    font-size: 25px;
  }

  .mt-hero-title > p {
    font-size: 11px;
  }

  .mt-kicker {
    font-size: 8px;
  }

  .mt-values {
    gap: 10px;
    margin-top: 12px;
  }

  .mt-values span {
    font-size: 8px;
  }

  .mt-account {
    max-width: 100%;
    padding: 7px 9px;
  }

  .mt-hero-info {
    justify-content: flex-start;
    gap: 6px;
    margin-top: 14px;
  }

  .mt-hero-info-item {
    flex: 1 1 140px;
    min-width: 0;
    padding: 8px;
  }

  .mt-hero-info-item strong {
    font-size: 9px;
  }

  .mt-hero-info-item small {
    font-size: 8px;
  }

  .mt-content {
    padding: 12px 10px 20px;
  }

  .mt-toolbar {
    display: block;
  }

  .mt-toolbar-heading {
    margin-bottom: 12px;
  }

  .mt-toolbar-heading h2 {
    font-size: 16px;
  }

  .mt-toolbar-actions {
    justify-content: flex-start;
    gap: 6px;
  }

  .mt-week-control {
    flex: 1 1 110px;
  }

  .mt-week-control select {
    width: 100%;
    max-width: none;
  }

  .mt-theme-toggle {
    flex: 1 1 auto;
    justify-content: center;
  }

  .mt-site-control {
    flex: 1 1 100px;
  }

  .mt-site-control select {
    width: 100%;
    max-width: none;
  }

  .mt-button-outline,
  .mt-button-primary {
    flex: 1 1 auto;
  }

  .mt-current-week {
    padding: 8px 10px;
  }

  .mt-kpi-grid {
    gap: 8px;
  }

  .mt-metric {
    min-height: 112px;
    padding: 11px 9px;
    gap: 8px;
  }

  .mt-metric-icon {
    width: 34px;
    height: 34px;
  }

  .mt-metric-icon svg {
    width: 19px;
    height: 19px;
  }

  .mt-metric-title {
    font-size: 9px;
  }

  .mt-metric-value {
    font-size: 23px;
  }

  .mt-metric-sub {
    font-size: 8px;
  }

  .mt-panel {
    padding: 12px 10px;
  }

  .mt-panel-title h3 {
    font-size: 12px;
  }

  .mt-panel-heading p {
    font-size: 8px;
  }

  .mt-program-summary {
    gap: 5px;
  }

  .mt-program-summary > div {
    padding: 8px 6px;
  }

  .mt-program-summary small {
    font-size: 7px;
  }

  .mt-program-summary strong {
    font-size: 17px;
  }

  .mt-program-summary span {
    font-size: 7px;
  }

  .mt-week-chart {
    min-width: 650px;
  }

  .mt-week-calendar {
    padding: 9px;
  }

  .mt-week-calendar-heading {
    display: block;
  }

  .mt-week-calendar-heading small {
    display: block;
    margin-top: 4px;
  }

  .mt-week-stats {
    gap: 5px;
  }

  .mt-week-stat {
    padding: 9px 3px;
  }

  .mt-week-stat strong {
    font-size: 18px;
  }

  .mt-week-stat small {
    font-size: 7px;
  }

  .mt-verification {
    gap: 5px;
  }

  .mt-verification-item {
    gap: 5px;
    padding: 8px 5px;
  }

  .mt-verification-item strong {
    font-size: 14px;
  }

  .mt-verification-item small {
    font-size: 7px;
  }

  .mt-week-category-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .mt-week-category {
    padding: 8px;
  }

  .mt-week-category-top strong {
    font-size: 8px;
  }

  .mt-category-amount {
    font-size: 7px;
  }

  .mt-participant-heading {
    display: block;
  }

  .mt-participant-actions {
    margin-top: 12px;
  }

  .mt-search {
    flex: 1;
    min-width: 0;
  }

  .mt-search input {
    width: 100%;
    min-width: 0;
  }

  .mt-table-wrap {
    display: none;
  }

  .mt-mobile-participants {
    display: block;
  }

  .mt-list-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .mt-presentation .mt-mobile-header {
    display: flex;
  }

  .mt-presentation .mt-content {
    padding: 12px 10px 20px;
  }
}

@media (max-width:420px) {
  .mt-hero h1 {
    font-size: 22px;
  }

  .mt-hero-info-item {
    flex-basis: 100%;
  }

  .mt-kpi-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .mt-metric {
    display: block;
    min-height: 124px;
  }

  .mt-metric-icon {
    margin-bottom: 7px;
  }

  .mt-metric-decoration {
    opacity: .2;
  }

  .mt-week-category-grid {
    grid-template-columns: 1fr;
  }

  .mt-category-heading {
    align-items: flex-start;
  }

  .mt-category-heading strong {
    font-size: 9px;
  }

  .mt-category-heading span {
    font-size: 9px;
  }

  .mt-participant-actions {
    flex-wrap: wrap;
  }

  .mt-search {
    flex: 1 1 100%;
  }

  .mt-participant-actions .mt-button-primary {
    flex: 1 1 100%;
  }

  .mt-week-calendar-grid {
    gap: 4px;
  }

  .mt-week-calendar-item {
    min-height: 27px;
    font-size: 7px;
  }

  .mt-mobile-action-grid {
    grid-template-columns: 1fr 1fr;
  }

  .mt-modal-overlay {
    padding: 10px;
  }

  .mt-modal {
    max-height: 85vh;
  }
}

/* =====================================================
   PRESENTATION RESPONSIVE
===================================================== */

@media (min-width:761px) {
  .mt-presentation .mt-monitoring-grid {
    grid-template-columns: minmax(0,1fr) minmax(0,1.1fr);
  }

  .mt-presentation .mt-week-chart {
    min-width: 650px;
  }
}

/* =====================================================
   PRINT
===================================================== */

@media print {
  @page {
    size: A4 landscape;
    margin: 9mm;
  }

  .mt-shell,
  :root[data-theme="dark"] .mt-shell {
    --mt-surface: #fff;
    --mt-surface-alt: #f1f6f7;
    --mt-text: #122d2a;
    --mt-heading: #142632;
    --mt-muted: #657b82;
    --mt-border: #d9e4e7;
    --mt-border-soft: #e7edef;
    --mt-progress-bg: #e5edef;

    background: #fff !important;
    color: #122d2a !important;
  }

  .mt-sidebar,
  .mt-mobile-header,
  .mt-toolbar-actions,
  .mt-participant-actions,
  .mt-overlay,
  .mt-modal-overlay,
  .mt-current-week-actions {
    display: none !important;
  }

  .mt-main {
    margin-left: 0 !important;
  }

  .mt-hero {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-panel,
  .mt-metric {
    break-inside: avoid;
    box-shadow: none !important;
    background: #fff !important;
    color: #122d2a !important;
  }

  .mt-week-stat,
  .mt-progress,
  .mt-week-chart-bar span,
  .mt-week-calendar-item {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-table-wrap {
    display: block !important;
  }

  .mt-mobile-participants {
    display: none !important;
  }

  .mt-participant-table {
    color: #122d2a !important;
  }
}

`;
