"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// DASHBOARD UTAMA ADMIN / MENTOR
//
// TEMPLATE DASHBOARD MENTOR — ACUAN GAMBAR 2
//
// SUSUNAN TAMPILAN:
// - Header ERG dan identitas akun
// - Empat KPI utama
// - Jadwal Kegiatan Minggu Ini di sisi kiri
// - Ringkasan Monitoring Mingguan di sisi kanan
// - Enam kategori target mingguan
// - Daftar peserta beserta target mingguan setiap peserta
// - Sidebar ringkas tanpa grup Pengelolaan OJT
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

// Jadwal Week 08 mengikuti isi pada gambar referensi kedua.
// Jadwal untuk minggu lain ditampilkan sebagai belum tersedia sampai
// data jadwal resminya dimasukkan ke sumber jadwal aplikasi.
const WEEKLY_SCHEDULE = [
  {
    week: 8,
    date: "2026-11-02",
    day: "Sen",
    title: "Training K3 Dasar",
    time: "08.00 – 12.00 WITA",
    location: "Ruang Training",
    category: "Training",
    icon: "clipboard",
    tone: "training",
  },
  {
    week: 8,
    date: "2026-11-04",
    day: "Rab",
    title: "Praktik Lapangan (Site)",
    time: "08.00 – 15.00 WITA",
    location: "Area Tambang",
    category: "Praktik",
    icon: "shield",
    tone: "practice",
  },
  {
    week: 8,
    date: "2026-11-05",
    day: "Kam",
    title: "Coaching Peserta",
    time: "13.00 – 15.00 WITA",
    location: "Ruang Meeting",
    category: "Coaching",
    icon: "users",
    tone: "coaching",
  },
  {
    week: 8,
    date: "2026-11-06",
    day: "Jum",
    title: "Evaluasi Mingguan",
    time: "08.00 – 11.00 WITA",
    location: "Ruang Training",
    category: "Evaluasi",
    icon: "check",
    tone: "evaluation",
  },
];

const INPUT_TOOLS = [
  { key: "achievement", label: "Input Achievement", icon: "activity" },
  { key: "posttest", label: "Input Post-Test", icon: "clipboard" },
  { key: "practice", label: "Input Praktik", icon: "check" },
  { key: "samapta", label: "Input Samapta", icon: "activity" },
  { key: "simper", label: "Input SIMPER", icon: "shield" },
  { key: "calendar", label: "Kalender Kegiatan Mingguan", icon: "calendar" },
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

// Perhitungan khusus target mingguan untuk setiap peserta.
// Hanya aktivitas VERIFIED pada Week Global yang dipilih yang dihitung.
function calculateWeeklyAchievements(records, types, startDate, selectedWeek) {
  const codes = new Map(
    types.map((type) => [
      normalizeType(type.name),
      normalizeType(type.code),
    ])
  );

  const weekRecords = records.filter(
    (record) =>
      weekOf(record.activity_date, startDate) !== null &&
      globalWeekOf(record.activity_date) === selectedWeek
  );

  const categories = TARGETS.map((item) => {
    const code = codes.get(normalizeType(item.name));
    const matching = code
      ? weekRecords.filter(
          (record) => normalizeType(record.type_code) === code
        )
      : [];

    const verified = matching.filter(
      (record) => normalize(record.status) === "verified"
    );
    const pending = matching.filter(
      (record) => normalize(record.status) === "pending"
    );
    const amount = activityAmount(verified, item.name);

    return {
      ...item,
      amount,
      progress: clamp((amount / item.target) * 100),
      pendingCount: pending.length,
      completed: amount >= item.target,
    };
  });

  const total = categories.reduce(
    (sum, category) => sum + category.progress,
    0
  );
  const done = categories.filter((category) => category.completed).length;

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
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l-1.42 1.42" />
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
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
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
        ? Number((totalProgress / filtered.length).toFixed(1))
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

  const participantsWithSamapta = new Set(
    weeklySamapta.map((record) => record.program_id)
  );

  return {
    active: filtered.length,
    postTest: participantsWithPostTest.size,
    practice: participantsWithPractice.size,
    completed: summary.completed,
    verified: verified.length,
    pending: pending.length,
    samapta: participantsWithSamapta.size,
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


  // =====================================================
  // JADWAL KEGIATAN MINGGUAN
  // Menggunakan data WEEKLY_SCHEDULE dari Bagian 1.
  // =====================================================
  const scheduleThisWeek = useMemo(() => {
    return WEEKLY_SCHEDULE.filter(
      (item) => Number(item.week) === selectedWeek
    ).sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || ""))
    );
  }, [selectedWeek]);

  // =====================================================
  // TARGET MINGGUAN SEMUA PESERTA
  // Hanya Achievement Verified yang dihitung.
  // Target masing-masing kategori tidak diubah.
  // =====================================================

  const participantWeeklyTargets = useMemo(() => {
    return filtered.map((program) => {
      const records = achievements.filter(
        (record) =>
          record.program_id === program.id &&
          globalWeekOf(record.activity_date) === selectedWeek
      );

      const result = calculateAchievements(
        records,
        achievementTypes,
        program.start_date
      );

      const verified = records.filter(
        (record) => normalize(record.status) === "verified"
      ).length;

      const pending = records.filter(
        (record) => normalize(record.status) === "pending"
      ).length;

      return {
        program,
        categories: result.categories,
        progress: result.progress,
        completed: result.done,
        verified,
        pending,
      };
    });
  }, [
    filtered,
    achievements,
    achievementTypes,
    selectedWeek,
  ]);

  const weeklyTargetSummary = useMemo(() => {
    return TARGETS.map((target) => {
      const values = participantWeeklyTargets.map((participant) =>
        participant.categories.find(
          (category) => category.name === target.name
        )
      );

      const totalProgress = values.reduce(
        (sum, item) => sum + (item?.progress || 0),
        0
      );

      const totalAmount = values.reduce(
        (sum, item) => sum + (item?.amount || 0),
        0
      );

      const completed = values.filter(
        (item) => item?.completed
      ).length;

      return {
        ...target,
        amount: totalAmount,
        progress: participantWeeklyTargets.length
          ? Math.round(totalProgress / participantWeeklyTargets.length)
          : 0,
        completed,
      };
    });
  }, [participantWeeklyTargets]);

  const accountName =
    account?.full_name ||
    (isAdmin ? "Administrator" : "Mentor OJT");

  const accountRole = isAdmin ? "Administrator" : "Mentor OJT";

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

  // =====================================================
  // NAVIGASI SIDEBAR
  // Tidak menggunakan modal pemilihan peserta.
  // =====================================================

  function scrollToSection(id) {
    setMenuOpen(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function openParticipantDetail(programId) {
    if (!programId) return;
    navigate(`/peserta/${programId}`);
  }

  // =====================================================
  // AKSES MAINTENANCE
  // =====================================================

  if (accessStatus === "maintenance") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <div className="mt-access-icon">🛠️</div>

          <h1>OJT MineTrack Sedang Maintenance</h1>

          <p>
            Sistem sedang dalam pemeliharaan.
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
            Keluar Akun
          </button>
        </div>
      </main>
    );
  }

  // =====================================================
  // PEMERIKSAAN AKSES
  // =====================================================

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
        </div>
      </main>
    );
  }

  // =====================================================
  // DASHBOARD UTAMA ADMIN / MENTOR
  // =====================================================

  return (
    <div
      className={`mt-shell ${
        presentationMode ? "mt-presentation" : ""
      }`}
      data-dashboard-theme={theme}
    >
      <style>{dashboardCSS}</style>

      {menuOpen && (
        <button
          type="button"
          className="mt-overlay"
          aria-label="Tutup navigasi"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* =================================================
          SIDEBAR — MENU FINAL
      ================================================= */}

      <aside className={`mt-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="mt-sidebar-top">
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

          <div className="mt-menu-label">MENU MENTOR</div>

          <nav className="mt-nav-group">
            <button
              type="button"
              className="mt-nav active"
              onClick={() => navigate("/")}
            >
              <Icon name="home" size={18} />
              <span>Dashboard Mentor</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() => navigate("/mentor/monitoring-peserta")}
            >
              <Icon name="chart" size={18} />
              <span>Monitoring Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() => scrollToSection("mt-peserta")}
            >
              <Icon name="users" size={18} />
              <span>Peserta OJT</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() => navigate("/mentor/daftar-peserta")}
            >
              <Icon name="file" size={18} />
              <span>Pendaftaran Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() => navigate("/mentor/persetujuan-peserta")}
            >
              <Icon name="check" size={18} />
              <span>Persetujuan Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() => scrollToSection("mt-jadwal")}
            >
              <Icon name="calendar" size={18} />
              <span>Kalender Kegiatan Mingguan</span>
            </button>
          </nav>
        </div>

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
              {refreshing ? "Memperbarui..." : "Refresh Data"}
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
              {loggingOut ? "Sedang Keluar..." : "Keluar Akun"}
            </span>
          </button>
        </div>
      </aside>

      {/* =================================================
          KONTEN UTAMA
      ================================================= */}

      <main className="mt-main">
        <div className="mt-mobile-header">
          <strong>
            OJT <span>MineTrack</span>
          </strong>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu"
          >
            ☰
          </button>
        </div>

        {/* HEADER SESUAI TEMPLATE */}

        <header className="mt-hero">
          <div className="mt-hero-background" />

          <div className="mt-hero-content">
            <div className="mt-hero-top">
              <div className="mt-hero-title">
                <div className="mt-kicker">
                  EMERGENCY RESPONSE GROUP · PT BERAU COAL
                </div>

                <h1>
                  Dashboard Mentor OJT <span>MineTrack</span>
                </h1>

                <p>
                  Monitoring dan Evaluasi Pelaksanaan
                  On Job Training
                </p>

                <div className="mt-values">
                  <span>
                    <Icon name="shield" size={15} />
                    Safe People
                  </span>

                  <span>
                    <Icon name="gear" size={15} />
                    Safe Operation
                  </span>

                  <span>
                    <Icon name="leaf" size={15} />
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
          </div>
        </header>

        {/* TOOLBAR */}

        <div className="mt-content">
          <section className="mt-toolbar">
            <div className="mt-toolbar-heading">
              <span className="mt-section-kicker">
                PROGRAM OJT 2026–2027
              </span>

              <h2>Monitoring Program OJT</h2>

              <p>
                Jadwal mingguan, detail peserta, dan target
                pencapaian seluruh peserta OJT.
              </p>
            </div>

            <div className="mt-toolbar-actions">
              <div className="mt-control">
                <Icon name="calendar" size={17} />

                <select
                  value={selectedWeek}
                  onChange={(event) =>
                    changeWeek(event.target.value)
                  }
                  aria-label="Pilih minggu program"
                >
                  {GLOBAL_WEEKS.map((week) => (
                    <option key={week.week} value={week.week}>
                      {weekLabel(week.week)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="mt-theme-toggle"
                onClick={toggleTheme}
              >
                <Icon
                  name={theme === "dark" ? "sun" : "moon"}
                  size={18}
                />
                {theme === "dark"
                  ? "Mode Terang"
                  : "Mode Gelap"}
              </button>

              <div className="mt-control">
                <Icon name="map" size={17} />

                <select
                  value={siteFilter}
                  onChange={(event) =>
                    setSiteFilter(event.target.value)
                  }
                  aria-label="Pilih site"
                >
                  <option value="ALL">Semua Site</option>
                  {SITES.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="mt-button-outline"
                onClick={refresh}
                disabled={loading || refreshing}
              >
                <Icon name="refresh" size={17} />
                Refresh
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
            </div>
          ) : (
            <>
              {/* ==========================================
                  1. JADWAL KEGIATAN MINGGUAN
              ========================================== */}

              <section
                id="mt-jadwal"
                className="mt-panel mt-schedule-panel"
              >
                <div className="mt-panel-heading">
                  <div className="mt-panel-title">
                    <span className="mt-panel-icon">
                      <Icon name="calendar" size={20} />
                    </span>

                    <div>
                      <h3>Jadwal Kegiatan Minggu Ini</h3>
                      <p>
                        {formatPeriod(
                          currentWeek.start,
                          currentWeek.end
                        )}
                      </p>
                    </div>
                  </div>

                  <span className="mt-panel-badge">
                    {weekLabel(selectedWeek)}
                  </span>
                </div>

                <div className="mt-schedule-list">
                  {scheduleThisWeek.length ? (
                    scheduleThisWeek.map((activity, index) => (
                      <article
                        className="mt-schedule-item"
                        key={activity.id || `${selectedWeek}-${index}`}
                      >
                        <div className="mt-schedule-date">
                          <small>
                            {activity.day || "Jadwal"}
                          </small>

                          <strong>
                            {formatDate(activity.date)}
                          </strong>
                        </div>

                        <span className="mt-schedule-icon">
                          <Icon
                            name={activity.icon || "calendar"}
                            size={24}
                          />
                        </span>

                        <div className="mt-schedule-description">
                          <strong>{activity.title}</strong>

                          <small>
                            {activity.time
                              ? `${activity.time} WITA`
                              : formatDate(activity.date)}
                            {activity.location
                              ? ` · ${activity.location}`
                              : ""}
                          </small>

                          {activity.description && (
                            <details>
                              <summary>Lihat Materi</summary>
                              <p>{activity.description}</p>
                            </details>
                          )}
                        </div>

                        <span className="mt-schedule-type">
                          {activity.category || "Kegiatan"}
                        </span>
                      </article>
                    ))
                  ) : (
                    <div className="mt-empty">
                      Belum ada jadwal kegiatan yang ditetapkan
                      untuk {weekLabel(selectedWeek)}.
                    </div>
                  )}
                </div>

                <div className="mt-schedule-footer">
                  <span>
                    Kalender Global Week 01–25
                  </span>

                  <div className="mt-week-stepper">
                    <button
                      type="button"
                      disabled={selectedWeek <= 1}
                      onClick={() => changeWeek(selectedWeek - 1)}
                      aria-label="Minggu sebelumnya"
                    >
                      <Icon name="left" size={17} />
                    </button>

                    <strong>{weekLabel(selectedWeek)}</strong>

                    <button
                      type="button"
                      disabled={selectedWeek >= TOTAL_WEEKS}
                      onClick={() => changeWeek(selectedWeek + 1)}
                      aria-label="Minggu berikutnya"
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </div>
              </section>

              {/* ==========================================
                  2. DETAIL PESERTA
              ========================================== */}

              <section
                id="mt-peserta"
                className="mt-panel mt-participant-panel"
              >
                <div className="mt-participant-heading">
                  <div className="mt-panel-title">
                    <span className="mt-panel-icon">
                      <Icon name="users" size={20} />
                    </span>

                    <div>
                      <h3>Detail Peserta OJT</h3>
                      <p>
                        Pilih peserta untuk melihat detail,
                        melakukan input, dan monitoring OJT.
                      </p>
                    </div>
                  </div>

                  <label className="mt-search">
                    <Icon name="search" size={17} />

                    <input
                      type="search"
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                      placeholder="Cari nama / departemen..."
                    />
                  </label>
                </div>

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
                        <th>SIMPER</th>
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
                              {formatPeriod(
                                program.start_date,
                                program.end_date
                              )}
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
                              {info?.simperProgress || 0}%
                            </td>

                            <td>
                              <span className="mt-status-active">
                                Aktif
                              </span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="mt-button-primary"
                                onClick={() =>
                                  openParticipantDetail(program.id)
                                }
                              >
                                Detail / Input
                                <Icon name="arrow" size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {!filtered.length && (
                        <tr>
                          <td colSpan={9} className="mt-empty-cell">
                            Tidak ada peserta aktif sesuai filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-mobile-participants">
                  {filtered.map((program) => {
                    const info = dataByProgram[program.id];

                    return (
                      <article
                        key={program.id}
                        className="mt-mobile-person"
                      >
                        <div className="mt-person-top">
                          <div className="mt-person-avatar">
                            {initials(
                              program.peserta?.full_name
                            )}
                          </div>

                          <div className="mt-person-info">
                            <strong>
                              {program.peserta?.full_name ||
                                "Peserta OJT"}
                            </strong>

                            <small>
                              {program.peserta?.department || "—"}
                              {" · "}
                              {program.site || "—"}
                            </small>
                          </div>
                        </div>

                        <div className="mt-person-period">
                          {formatPeriod(
                            program.start_date,
                            program.end_date
                          )}
                        </div>

                        <div className="mt-person-progress-heading">
                          <span>Progres OJT</span>
                          <strong>{info?.progress || 0}%</strong>
                        </div>

                        <Progress value={info?.progress || 0} />

                        <button
                          type="button"
                          className="mt-button-primary mt-detail-full"
                          onClick={() =>
                            openParticipantDetail(program.id)
                          }
                        >
                          Detail Peserta / Input
                          <Icon name="arrow" size={15} />
                        </button>
                      </article>
                    );
                  })}
                </div>

                <div className="mt-list-footer">
                  <span>
                    {filtered.length} peserta aktif ditampilkan.
                  </span>
                </div>
              </section>

              {/* ==========================================
                  3. TARGET MINGGUAN SEMUA PESERTA
              ========================================== */}

              <section
                id="mt-target"
                className="mt-panel mt-target-panel"
              >
                <div className="mt-panel-heading">
                  <div className="mt-panel-title">
                    <span className="mt-panel-icon">
                      <Icon name="chart" size={20} />
                    </span>

                    <div>
                      <h3>Target Mingguan Seluruh Peserta</h3>
                      <p>
                        Pencapaian enam kategori pada{" "}
                        {weekLabel(selectedWeek)}.
                      </p>
                    </div>
                  </div>

                  <span className="mt-panel-badge">
                    {participantWeeklyTargets.length} Peserta
                  </span>
                </div>

                <div className="mt-target-grid">
                  {weeklyTargetSummary.map((item) => (
                    <div
                      key={item.name}
                      className="mt-target-card"
                    >
                      <div className="mt-target-top">
                        <span className="mt-target-icon">
                          {item.icon}
                        </span>

                        <strong>{item.name}</strong>

                        <b>{item.progress}%</b>
                      </div>

                      <Progress value={item.progress} />

                      <div className="mt-target-meta">
                        <span>
                          {item.completed} dari{" "}
                          {participantWeeklyTargets.length} peserta
                          mencapai target
                        </span>

                        <span>
                          Target: {amountText(
                            item.target,
                            item.unit
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-target-table-wrap">
                  <table className="mt-target-table">
                    <thead>
                      <tr>
                        <th>Nama Peserta</th>
                        <th>Site</th>

                        {TARGETS.map((item) => (
                          <th key={item.name}>
                            {item.name}
                          </th>
                        ))}

                        <th>Rata-rata</th>
                        <th>Tercapai</th>
                      </tr>
                    </thead>

                    <tbody>
                      {participantWeeklyTargets.map((item) => (
                        <tr key={item.program.id}>
                          <td className="mt-name-cell">
                            {item.program.peserta?.full_name ||
                              "Peserta OJT"}
                          </td>

                          <td>
                            {item.program.site || "—"}
                          </td>

                          {TARGETS.map((target) => {
                            const category =
                              item.categories.find(
                                (entry) =>
                                  entry.name === target.name
                              );

                            return (
                              <td key={target.name}>
                                <div className="mt-target-cell">
                                  <strong>
                                    {Math.round(
                                      category?.progress || 0
                                    )}%
                                  </strong>

                                  <small>
                                    {amountText(
                                      category?.amount || 0,
                                      target.unit
                                    )}
                                  </small>
                                </div>
                              </td>
                            );
                          })}

                          <td>
                            <strong>
                              {item.progress}%
                            </strong>
                          </td>

                          <td>
                            {item.completed}/6
                          </td>
                        </tr>
                      ))}

                      {!participantWeeklyTargets.length && (
                        <tr>
                          <td
                            colSpan={10}
                            className="mt-empty-cell"
                          >
                            Belum ada data peserta sesuai filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-panel-footnote">
                  Target dihitung dari Achievement berstatus
                  Verified pada minggu yang dipilih. Data Pending
                  tidak dihitung sebagai pencapaian.
                </div>
              </section>
            </>
          )}

          <footer className="mt-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </footer>
        </div>
      </main>
    </div>
  );
}

const dashboardCSS = `

/* =====================================================
   OJT MINETRACK V2.0
   DASHBOARD MENTOR / ADMIN
   TEMPLATE FINAL - LIGHT & DARK MODE
===================================================== */

/* =====================================================
   01. GLOBAL & COLOR SYSTEM
===================================================== */

.mt-shell,
.mt-shell * {
  box-sizing: border-box;
}

.mt-shell {
  --mt-bg: #edf4f0;
  --mt-surface: #ffffff;
  --mt-surface-alt: #f3f8f5;
  --mt-text: #233b34;
  --mt-heading: #13362c;
  --mt-muted: #70877c;
  --mt-border: #dce9e1;
  --mt-border-soft: #e9f0eb;
  --mt-green: #087d56;
  --mt-green-light: #13ad77;
  --mt-green-soft: #e7f7ed;
  --mt-input: #ffffff;
  --mt-progress-bg: #e4eee8;
  --mt-shadow: rgba(18, 58, 43, 0.065);

  position: relative;
  isolation: isolate;
  min-height: 100vh;

  background:
    linear-gradient(
      135deg,
      rgba(243, 249, 245, 0.97),
      rgba(232, 244, 236, 0.95)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;

  color: var(--mt-text);
  font-family: Arial, Helvetica, sans-serif;
  font-size: 13px;
  line-height: 1.55;
}

html[data-theme="dark"] .mt-shell {
  color-scheme: dark;

  --mt-bg: #0c1a18;
  --mt-surface: #162b26;
  --mt-surface-alt: #1d3730;
  --mt-text: #e5f1ea;
  --mt-heading: #f1fbf5;
  --mt-muted: #a3b9ae;
  --mt-border: #345047;
  --mt-border-soft: #294239;
  --mt-green: #7ee4b1;
  --mt-green-light: #43d39b;
  --mt-green-soft: #214738;
  --mt-input: #1b342c;
  --mt-progress-bg: #365347;
  --mt-shadow: rgba(0, 0, 0, 0.18);

  background:
    linear-gradient(
      135deg,
      rgba(6, 22, 20, 0.97),
      rgba(9, 34, 28, 0.94)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;
}

.mt-shell button,
.mt-shell input,
.mt-shell select {
  font: inherit;
}

.mt-shell button {
  cursor: pointer;
  touch-action: manipulation;
}

.mt-shell button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mt-shell button:focus-visible,
.mt-shell input:focus-visible,
.mt-shell select:focus-visible,
.mt-shell summary:focus-visible {
  outline: 3px solid #3fc996;
  outline-offset: 3px;
}

.mt-shell h1,
.mt-shell h2,
.mt-shell h3,
.mt-shell p {
  overflow-wrap: break-word;
}

/* =====================================================
   02. SIDEBAR
===================================================== */

.mt-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;

  display: flex;
  flex-direction: column;
  justify-content: space-between;

  width: 254px;
  padding: 21px 13px 15px;

  overflow-y: auto;

  background: linear-gradient(
    175deg,
    #07251f 0%,
    #074032 55%,
    #053127 100%
  );

  color: #ffffff;

  box-shadow: 5px 0 24px rgba(0, 0, 0, 0.12);
}

html[data-theme="dark"] .mt-sidebar {
  background: linear-gradient(
    175deg,
    #061815,
    #0b2c24 60%,
    #081f1a
  );
}

.mt-sidebar-top {
  min-height: 0;
}

.mt-brand {
  padding: 8px 11px 22px;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.17);
}

.mt-brand-name {
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -0.7px;
  color: #ffffff;
  white-space: nowrap;
}

.mt-brand-name span {
  color: #4adea4;
}

.mt-brand-name small {
  margin-left: 5px;
  color: #b1cfc0;
  font-size: 10px;
  letter-spacing: 0;
}

.mt-brand p {
  margin: 9px 0 0;
  color: #bad6ca;
  font-size: 11px;
  line-height: 1.7;
}

.mt-menu-label {
  margin: 7px 0 9px;
  padding: 9px 11px;

  color: #9bd4bb;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.1px;
}

.mt-nav-group {
  display: grid;
  gap: 5px;
}

.mt-nav {
  display: flex;
  align-items: center;
  gap: 12px;

  width: 100%;
  min-height: 44px;
  padding: 11px 12px;

  border: 1px solid transparent;
  border-radius: 9px;

  background: transparent;
  color: #e0f0e7;

  font-size: 12px;
  font-weight: 700;
  text-align: left;

  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.mt-nav > svg {
  flex-shrink: 0;
}

.mt-nav > span {
  flex: 1;
  min-width: 0;
}

.mt-nav:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.mt-nav.active {
  background: #0c9065;
  border-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.mt-sidebar-bottom {
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
}

.mt-side-user {
  display: flex;
  align-items: center;
  gap: 11px;

  padding: 12px;
  margin-bottom: 11px;

  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.075);
}

.mt-side-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 37px;
  height: 37px;
  border-radius: 50%;

  background: #d8f4e5;
  color: #07593b;

  font-size: 12px;
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
  color: #ffffff;
  font-size: 11px;
}

.mt-side-user-info small {
  margin-top: 4px;
  color: #b9d9cb;
  font-size: 10px;
}

.mt-side-action {
  display: flex;
  align-items: center;
  gap: 11px;

  width: 100%;
  min-height: 42px;
  margin-bottom: 5px;
  padding: 10px 12px;

  border: 1px solid transparent;
  border-radius: 9px;

  background: rgba(255, 255, 255, 0.06);
  color: #e1f6e9;

  text-align: left;
  font-size: 11px;
  font-weight: 700;
}

.mt-side-action:hover {
  background: rgba(255, 255, 255, 0.12);
}

.mt-side-action.logout {
  background: transparent;
  color: #ffd2c9;
}

.mt-side-action.logout:hover {
  background: rgba(220, 38, 38, 0.14);
}

/* =====================================================
   03. MAIN LAYOUT
===================================================== */

.mt-main {
  margin-left: 254px;
  min-width: 0;
  min-height: 100vh;
}

.mt-mobile-header {
  display: none;
}

.mt-content {
  width: 100%;
  max-width: 1660px;
  margin: 0 auto;
  padding: 24px 25px 35px;
}

.mt-overlay {
  display: none;
}

/* =====================================================
   04. HERO HEADER
===================================================== */

.mt-hero {
  position: relative;
  min-height: 190px;
  padding: 29px 30px;
  overflow: hidden;

  background: #06352b;
  color: #ffffff;
}

.mt-hero-background {
  position: absolute;
  inset: 0;
  z-index: 0;

  background:
    linear-gradient(
      95deg,
      rgba(2, 28, 27, 0.98),
      rgba(3, 56, 45, 0.88) 58%,
      rgba(6, 51, 43, 0.6)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
}

.mt-hero-content {
  position: relative;
  z-index: 1;
}

.mt-hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.mt-kicker {
  color: #efd18c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.mt-hero h1 {
  margin: 12px 0 8px;

  color: #ffffff;
  font-size: clamp(25px, 2.7vw, 35px);
  font-weight: 900;
  line-height: 1.2;
  letter-spacing: -0.6px;
}

.mt-hero h1 span {
  color: #52e0a6;
}

.mt-hero-title > p {
  margin: 0;
  color: #d8efe2;
  font-size: 12px;
}

.mt-values {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 20px;
}

.mt-values span {
  display: inline-flex;
  align-items: center;
  gap: 7px;

  color: #e4f2eb;
  font-size: 10px;
  font-weight: 700;
}

.mt-values svg {
  color: #f0ce79;
}

.mt-account {
  display: flex;
  align-items: center;
  gap: 10px;

  max-width: 280px;
  padding: 11px 13px;

  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 11px;

  background: rgba(3, 35, 31, 0.75);
}

.mt-account-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 39px;
  height: 39px;
  border-radius: 50%;

  background: #ddf5e7;
  color: #07593b;

  font-size: 12px;
  font-weight: 900;
}

.mt-account-info {
  min-width: 0;
}

.mt-account-info strong,
.mt-account-info small {
  display: block;
  overflow-wrap: anywhere;
}

.mt-account-info strong {
  font-size: 12px;
}

.mt-account-info small {
  margin-top: 4px;
  color: #c6e1d1;
  font-size: 10px;
}

/* =====================================================
   05. TOOLBAR
===================================================== */

.mt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;

  margin-bottom: 22px;
}

.mt-toolbar-heading {
  min-width: 210px;
}

.mt-section-kicker {
  color: var(--mt-green);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.2px;
}

.mt-toolbar-heading h2 {
  margin: 6px 0 5px;
  color: var(--mt-heading);
  font-size: 22px;
  font-weight: 900;
}

.mt-toolbar-heading p {
  margin: 0;
  color: var(--mt-muted);
  font-size: 12px;
}

.mt-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.mt-control {
  display: inline-flex;
  align-items: center;
  gap: 9px;

  min-height: 42px;
  padding: 0 12px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;

  background: var(--mt-surface);
  color: var(--mt-green);
}

.mt-control select {
  min-width: 95px;
  max-width: 150px;
  padding: 9px 3px;

  border: 0;
  outline: 0;

  background: transparent;
  color: var(--mt-text);

  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.mt-control select option {
  background: var(--mt-surface);
  color: var(--mt-text);
}

.mt-theme-toggle,
.mt-button-outline,
.mt-button-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  min-height: 42px;
  padding: 10px 14px;

  border-radius: 9px;

  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;

  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

.mt-theme-toggle {
  border: 1px solid var(--mt-border);
  background: var(--mt-surface);
  color: var(--mt-green);
}

.mt-button-outline {
  border: 1px solid var(--mt-border);
  background: var(--mt-surface);
  color: var(--mt-green);
}

.mt-button-primary {
  border: 1px solid #087f57;
  background: #087f57;
  color: #ffffff;
}

.mt-button-primary:hover {
  background: #076c4b;
}

.mt-theme-toggle:hover,
.mt-button-outline:hover {
  background: var(--mt-green-soft);
}

/* =====================================================
   06. MAIN PANELS
===================================================== */

.mt-panel {
  min-width: 0;
  margin-bottom: 22px;
  padding: 23px;

  border: 1px solid var(--mt-border);
  border-radius: 15px;

  background: var(--mt-surface);
  box-shadow: 0 5px 20px var(--mt-shadow);
}

.mt-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  margin-bottom: 19px;
}

.mt-panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.mt-panel-title > div {
  min-width: 0;
}

.mt-panel-title h3 {
  margin: 0;

  color: var(--mt-heading);
  font-size: 17px;
  font-weight: 900;
}

.mt-panel-title p {
  margin: 5px 0 0;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-panel-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 42px;
  height: 42px;
  border-radius: 10px;

  background: #09845e;
  color: #ffffff;
}

.mt-panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  padding: 7px 13px;
  border-radius: 30px;

  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 11px;
  font-weight: 900;
}

.mt-panel-footnote {
  margin-top: 18px;
  color: var(--mt-muted);
  font-size: 11px;
  line-height: 1.7;
}

.mt-empty {
  padding: 32px 15px;
  border: 1px dashed var(--mt-border);
  border-radius: 10px;

  background: var(--mt-surface-alt);
  color: var(--mt-muted);

  font-size: 12px;
  text-align: center;
}

/* =====================================================
   07. JADWAL KEGIATAN MINGGUAN
===================================================== */

.mt-schedule-panel {
  scroll-margin-top: 20px;
}

.mt-schedule-list {
  display: grid;
}

.mt-schedule-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;

  min-width: 0;
  padding: 19px 5px;

  border-bottom: 1px solid var(--mt-border-soft);
}

.mt-schedule-item:first-child {
  padding-top: 6px;
}

.mt-schedule-item:last-child {
  border-bottom: none;
}

.mt-schedule-date {
  display: grid;
  align-content: center;
  gap: 4px;
  flex-shrink: 0;

  width: 108px;
  min-height: 59px;
  padding: 8px;

  border: 1px solid var(--mt-border);
  border-radius: 10px;

  background: var(--mt-surface-alt);
  text-align: center;
}

.mt-schedule-date small {
  color: var(--mt-muted);
  font-size: 10px;
}

.mt-schedule-date strong {
  color: var(--mt-heading);
  font-size: 11px;
  line-height: 1.5;
}

.mt-schedule-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 47px;
  height: 47px;

  border-radius: 11px;
  background: var(--mt-green-soft);
  color: var(--mt-green);
}

.mt-schedule-description {
  flex: 1;
  min-width: 0;
  padding-top: 3px;
}

.mt-schedule-description > strong {
  display: block;
  color: var(--mt-heading);
  font-size: 14px;
  font-weight: 850;
  line-height: 1.5;
}

.mt-schedule-description > small {
  display: block;
  margin-top: 5px;

  color: var(--mt-muted);
  font-size: 11px;
}

.mt-schedule-description details {
  margin-top: 9px;
}

.mt-schedule-description summary {
  width: fit-content;

  color: var(--mt-green);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.mt-schedule-description details p {
  max-width: 750px;
  margin: 9px 0 0;
  padding: 12px 14px;

  border-radius: 9px;
  background: var(--mt-surface-alt);

  color: var(--mt-text);
  font-size: 12px;
  line-height: 1.7;
}

.mt-schedule-type {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  min-width: 85px;
  padding: 7px 10px;
  border-radius: 30px;

  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.mt-schedule-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  margin-top: 15px;
  padding-top: 18px;
  border-top: 1px solid var(--mt-border);
}

.mt-schedule-footer > span {
  color: var(--mt-muted);
  font-size: 11px;
  font-weight: 700;
}

.mt-week-stepper {
  display: flex;
  align-items: center;
  gap: 11px;
}

.mt-week-stepper strong {
  min-width: 70px;
  color: var(--mt-heading);
  font-size: 12px;
  text-align: center;
}

.mt-week-stepper button {
  display: grid;
  place-items: center;

  width: 35px;
  height: 35px;

  border: 1px solid var(--mt-border);
  border-radius: 8px;

  background: var(--mt-surface-alt);
  color: var(--mt-green);
}

/* =====================================================
   08. DETAIL PESERTA
===================================================== */

.mt-participant-panel {
  scroll-margin-top: 20px;
}

.mt-participant-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;

  margin-bottom: 20px;
}

.mt-search {
  display: flex;
  align-items: center;
  gap: 9px;

  min-height: 42px;
  padding: 0 12px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;

  background: var(--mt-input);
  color: var(--mt-muted);
}

.mt-search input {
  width: 210px;
  min-width: 0;
  padding: 11px 0;

  border: 0;
  outline: 0;

  background: transparent;
  color: var(--mt-text);

  font-size: 12px;
}

.mt-search input::placeholder {
  color: var(--mt-muted);
}

.mt-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--mt-border);
  border-radius: 10px;
}

.mt-participant-table {
  width: 100%;
  min-width: 910px;

  border-collapse: collapse;
  color: var(--mt-text);

  font-size: 11px;
  text-align: left;
}

.mt-participant-table th {
  padding: 14px 12px;
  border-bottom: 1px solid var(--mt-border);

  background: var(--mt-surface-alt);
  color: var(--mt-muted);

  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mt-participant-table td {
  padding: 15px 12px;
  border-bottom: 1px solid var(--mt-border-soft);
  vertical-align: middle;
}

.mt-participant-table tbody tr:last-child td {
  border-bottom: 0;
}

.mt-participant-table tbody tr:hover {
  background: var(--mt-surface-alt);
}

.mt-name-cell {
  color: var(--mt-heading);
  font-weight: 850;
}

.mt-site-badge {
  display: inline-flex;
  align-items: center;

  padding: 6px 9px;
  border-radius: 7px;

  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.mt-period-cell {
  color: var(--mt-muted);
  white-space: nowrap;
}

.mt-progress-cell {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 100px;
}

.mt-progress-cell .mt-progress {
  flex: 1;
  min-width: 50px;
}

.mt-progress-cell strong {
  color: var(--mt-green);
  font-size: 11px;
}

.mt-progress {
  width: 100%;
  height: 9px;
  overflow: hidden;

  border-radius: 20px;
  background: var(--mt-progress-bg);
}

.mt-progress.compact {
  height: 7px;
}

.mt-progress > span {
  display: block;
  height: 100%;

  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #19b883,
    #07885e
  );

  transition: width 0.2s ease;
}

html[data-theme="dark"] .mt-progress > span {
  background: linear-gradient(
    90deg,
    #2dc88e,
    #6be8b0
  );
}

.mt-status-active {
  display: inline-flex;
  align-items: center;

  padding: 6px 11px;
  border-radius: 30px;

  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 850;
}

.mt-empty-cell {
  padding: 30px 15px !important;
  color: var(--mt-muted);
  text-align: center;
}

.mt-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;

  margin-top: 14px;
  color: var(--mt-muted);
  font-size: 11px;
}

/* =====================================================
   09. MOBILE PARTICIPANT CARDS
===================================================== */

.mt-mobile-participants {
  display: none;
}

.mt-mobile-person {
  padding: 16px;
  margin-bottom: 12px;

  border: 1px solid var(--mt-border);
  border-radius: 12px;

  background: var(--mt-surface-alt);
}

.mt-person-top {
  display: flex;
  align-items: center;
  gap: 11px;
}

.mt-person-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 43px;
  height: 43px;

  border-radius: 50%;

  background: var(--mt-green-soft);
  color: var(--mt-green);

  font-size: 13px;
  font-weight: 900;
}

.mt-person-info {
  flex: 1;
  min-width: 0;
}

.mt-person-info strong {
  display: block;
  color: var(--mt-heading);
  font-size: 13px;
}

.mt-person-info small {
  display: block;
  margin-top: 4px;

  color: var(--mt-muted);
  font-size: 11px;
}

.mt-person-period {
  margin: 13px 0;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-person-progress-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;

  margin-bottom: 7px;
  color: var(--mt-text);
  font-size: 12px;
}

.mt-person-progress-heading strong {
  color: var(--mt-green);
}

.mt-detail-full {
  width: 100%;
  margin-top: 16px;
}

/* =====================================================
   10. TARGET MINGGUAN SELURUH PESERTA
===================================================== */

.mt-target-panel {
  scroll-margin-top: 20px;
}

.mt-target-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;

  margin-bottom: 22px;
}

.mt-target-card {
  min-width: 0;
  padding: 17px;

  border: 1px solid var(--mt-border);
  border-radius: 12px;

  background: var(--mt-surface-alt);
}

.mt-target-top {
  display: flex;
  align-items: center;
  gap: 10px;

  margin-bottom: 14px;
}

.mt-target-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 37px;
  height: 37px;
  border-radius: 9px;

  background: var(--mt-green-soft);
  font-size: 18px;
}

.mt-target-top strong {
  flex: 1;
  min-width: 0;

  color: var(--mt-heading);
  font-size: 12px;
  font-weight: 900;
}

.mt-target-top b {
  color: var(--mt-green);
  font-size: 17px;
}

.mt-target-meta {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 5px 12px;

  margin-top: 12px;
  color: var(--mt-muted);
  font-size: 10px;
  line-height: 1.6;
}

.mt-target-table-wrap {
  width: 100%;
  overflow-x: auto;

  border: 1px solid var(--mt-border);
  border-radius: 10px;
}

.mt-target-table {
  width: 100%;
  min-width: 1050px;

  border-collapse: collapse;
  color: var(--mt-text);

  font-size: 11px;
  text-align: left;
}

.mt-target-table th {
  padding: 14px 12px;

  border-bottom: 1px solid var(--mt-border);

  background: var(--mt-surface-alt);
  color: var(--mt-muted);

  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mt-target-table td {
  padding: 14px 12px;
  border-bottom: 1px solid var(--mt-border-soft);
  vertical-align: middle;
}

.mt-target-table tbody tr:hover {
  background: var(--mt-surface-alt);
}

.mt-target-table tbody tr:last-child td {
  border-bottom: 0;
}

.mt-target-cell {
  display: grid;
  gap: 5px;
}

.mt-target-cell strong {
  color: var(--mt-green);
  font-size: 12px;
}

.mt-target-cell small {
  color: var(--mt-muted);
  font-size: 10px;
  white-space: nowrap;
}

/* =====================================================
   11. ERROR & LOADING
===================================================== */

.mt-error {
  margin-bottom: 18px;
  padding: 14px 16px;

  border: 1px solid #edb8b8;
  border-radius: 10px;

  background: #fff0f0;
  color: #a32432;

  font-size: 12px;
}

html[data-theme="dark"] .mt-error {
  background: #482a2b;
  border-color: #734547;
  color: #ffcccc;
}

.mt-loading-card {
  display: grid;
  justify-items: center;
  gap: 15px;

  padding: 70px 20px;

  border: 1px solid var(--mt-border);
  border-radius: 13px;

  background: var(--mt-surface);
  color: var(--mt-heading);
}

.mt-loading-spinner {
  width: 38px;
  height: 38px;

  border: 4px solid var(--mt-progress-bg);
  border-top-color: var(--mt-green);
  border-radius: 50%;

  animation: mt-spin 0.8s linear infinite;
}

@keyframes mt-spin {
  to {
    transform: rotate(360deg);
  }
}

/* =====================================================
   12. ACCESS & MAINTENANCE SCREEN
===================================================== */

.mt-access {
  display: flex;
  align-items: center;
  justify-content: center;

  min-height: 100vh;
  padding: 20px;

  background: linear-gradient(
    135deg,
    #031d19,
    #07563f
  );

  color: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
  text-align: center;
}

.mt-access-card {
  width: 100%;
  max-width: 470px;
  padding: 35px 25px;

  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 17px;

  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 15px 45px rgba(0, 0, 0, 0.2);
}

.mt-access-icon,
.mt-loading-mark {
  display: grid;
  place-items: center;

  width: 66px;
  height: 66px;
  margin: 0 auto 20px;

  border-radius: 16px;
  background: #0a8e63;

  color: #ffffff;
  font-size: 27px;
  font-weight: 900;
}

.mt-access h1,
.mt-access h2 {
  margin: 0 0 14px;
  color: #ffffff;
  font-size: 22px;
}

.mt-access p {
  margin-bottom: 20px;
  color: #d0e5d8;
  font-size: 12px;
  line-height: 1.8;
}

.mt-access button {
  min-height: 41px;
  margin: 5px;
  padding: 10px 16px;

  border: 1px solid #c9ecd8;
  border-radius: 9px;

  background: #ddf6e7;
  color: #094631;

  font-size: 12px;
  font-weight: 800;
}

.mt-access button.secondary {
  background: transparent;
  color: #ffffff;
}

/* =====================================================
   13. FOOTER
===================================================== */

.mt-footer {
  padding: 17px 10px 5px;
  margin-top: 12px;

  border-top: 1px solid var(--mt-border);

  color: var(--mt-muted);
  font-size: 11px;
  text-align: center;
}

/* =====================================================
   14. PRESENTATION MODE
===================================================== */

.mt-presentation .mt-sidebar {
  display: none;
}

.mt-presentation .mt-main {
  margin-left: 0;
}

.mt-presentation .mt-content {
  max-width: 1800px;
}

/* =====================================================
   15. TABLET
===================================================== */

@media (max-width: 1200px) {
  .mt-sidebar {
    width: 225px;
  }

  .mt-main {
    margin-left: 225px;
  }

  .mt-content {
    padding: 20px 17px 30px;
  }

  .mt-hero {
    padding: 25px 20px;
  }

  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mt-toolbar {
    align-items: flex-start;
  }

  .mt-toolbar-actions {
    justify-content: flex-start;
  }
}

/* =====================================================
   16. MOBILE
===================================================== */

@media (max-width: 760px) {
  .mt-sidebar {
    width: 270px;
    transform: translateX(-105%);
    transition: transform 0.25s ease;
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
    background: rgba(0, 24, 19, 0.7);
  }

  .mt-main {
    margin-left: 0;
  }

  .mt-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    min-height: 58px;
    padding: 10px 15px;

    background: #062920;
    color: #ffffff;
  }

  .mt-mobile-header strong {
    font-size: 19px;
    font-weight: 900;
  }

  .mt-mobile-header strong span {
    color: #4adea4;
  }

  .mt-mobile-header button {
    display: grid;
    place-items: center;

    width: 38px;
    height: 38px;

    border: 0;
    border-radius: 7px;

    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;

    font-size: 24px;
  }

  .mt-hero {
    min-height: auto;
    padding: 23px 15px;
  }

  .mt-hero-top {
    flex-direction: column;
    gap: 15px;
  }

  .mt-hero h1 {
    font-size: 26px;
  }

  .mt-account {
    max-width: 100%;
  }

  .mt-kicker {
    font-size: 9px;
  }

  .mt-values {
    gap: 11px;
  }

  .mt-values span {
    font-size: 9px;
  }

  .mt-content {
    padding: 17px 12px 25px;
  }

  .mt-toolbar {
    display: block;
  }

  .mt-toolbar-heading {
    margin-bottom: 16px;
  }

  .mt-toolbar-heading h2 {
    font-size: 20px;
  }

  .mt-toolbar-actions {
    justify-content: flex-start;
    gap: 7px;
  }

  .mt-control {
    flex: 1 1 125px;
    min-width: 0;
  }

  .mt-control select {
    width: 100%;
    min-width: 0;
  }

  .mt-theme-toggle {
    flex: 1 1 auto;
  }

  .mt-panel {
    padding: 17px 14px;
    margin-bottom: 15px;
    border-radius: 12px;
  }

  .mt-panel-title {
    gap: 10px;
  }

  .mt-panel-title h3 {
    font-size: 15px;
  }

  .mt-panel-title p {
    font-size: 10px;
  }

  .mt-panel-icon {
    width: 36px;
    height: 36px;
  }

  .mt-schedule-item {
    gap: 10px;
    flex-wrap: wrap;
  }

  .mt-schedule-date {
    width: 90px;
    min-height: 50px;
  }

  .mt-schedule-icon {
    width: 38px;
    height: 38px;
  }

  .mt-schedule-description {
    flex: 1 1 calc(100% - 155px);
  }

  .mt-schedule-description > strong {
    font-size: 12px;
  }

  .mt-schedule-type {
    margin-left: auto;
    min-width: 0;
  }

  .mt-table-wrap {
    display: none;
  }

  .mt-mobile-participants {
    display: block;
  }

  .mt-participant-heading {
    align-items: stretch;
  }

  .mt-search {
    width: 100%;
  }

  .mt-search input {
    width: 100%;
    flex: 1;
  }

  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .mt-target-card {
    padding: 12px;
  }

  .mt-target-top {
    flex-wrap: wrap;
    gap: 7px;
  }

  .mt-target-top strong {
    font-size: 11px;
  }

  .mt-target-top b {
    font-size: 15px;
  }

  .mt-target-meta {
    font-size: 9px;
  }

  .mt-target-table {
    min-width: 1000px;
  }

  .mt-presentation .mt-mobile-header {
    display: flex;
  }
}

/* =====================================================
   17. SMALL MOBILE
===================================================== */

@media (max-width: 420px) {
  .mt-hero h1 {
    font-size: 23px;
  }

  .mt-hero-title > p {
    font-size: 11px;
  }

  .mt-toolbar-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .mt-control,
  .mt-theme-toggle,
  .mt-button-outline {
    width: 100%;
    min-width: 0;
  }

  .mt-schedule-date {
    width: 78px;
  }

  .mt-schedule-date strong {
    font-size: 10px;
  }

  .mt-schedule-icon {
    width: 34px;
    height: 34px;
  }

  .mt-schedule-icon svg {
    width: 20px;
    height: 20px;
  }

  .mt-schedule-description {
    flex-basis: calc(100% - 132px);
  }

  .mt-target-grid {
    grid-template-columns: 1fr;
  }

  .mt-target-top strong {
    font-size: 13px;
  }

  .mt-target-card {
    padding: 14px;
  }

  .mt-schedule-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .mt-week-stepper {
    width: 100%;
    justify-content: space-between;
  }

  .mt-panel-badge {
    font-size: 10px;
  }
}

/* =====================================================
   18. REDUCED MOTION
===================================================== */

@media (prefers-reduced-motion: reduce) {
  .mt-sidebar,
  .mt-progress > span,
  .mt-nav,
  .mt-button-primary,
  .mt-theme-toggle {
    transition: none;
  }

  .mt-loading-spinner {
    animation-duration: 2s;
  }
}

/* =====================================================
   19. PRINT
===================================================== */

@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .mt-shell,
  html[data-theme="dark"] .mt-shell {
    --mt-surface: #ffffff;
    --mt-surface-alt: #f1f6f3;
    --mt-text: #17332a;
    --mt-heading: #0d2b20;
    --mt-muted: #52665c;
    --mt-border: #d3dfd6;
    --mt-border-soft: #e5ede7;
    --mt-green: #087d56;
    --mt-green-soft: #e8f6ec;
    --mt-progress-bg: #e0eae2;

    background: #ffffff !important;
    color: #17332a !important;
  }

  .mt-sidebar,
  .mt-mobile-header,
  .mt-overlay,
  .mt-toolbar-actions,
  .mt-search,
  .mt-week-stepper,
  .mt-detail-full {
    display: none !important;
  }

  .mt-main {
    margin-left: 0 !important;
  }

  .mt-content {
    max-width: none;
    padding: 10px 0;
  }

  .mt-hero {
    min-height: 130px;
    padding: 15px;
  }

  .mt-panel {
    box-shadow: none;
    break-inside: auto;
  }

  .mt-target-card,
  .mt-schedule-item,
  .mt-mobile-person {
    break-inside: avoid;
  }

  .mt-table-wrap {
    display: block !important;
    overflow: visible;
  }

  .mt-mobile-participants {
    display: none !important;
  }

  .mt-participant-table {
    min-width: 0;
    font-size: 9px;
  }

  .mt-participant-table th,
  .mt-participant-table td {
    padding: 8px 6px;
  }

  .mt-target-table-wrap {
    overflow: visible;
  }

  .mt-target-table {
    min-width: 0;
    font-size: 9px;
  }

  .mt-target-table th,
  .mt-target-table td {
    padding: 8px 6px;
  }

  .mt-progress,
  .mt-progress > span,
  .mt-panel-icon,
  .mt-schedule-type,
  .mt-target-icon {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

`;


