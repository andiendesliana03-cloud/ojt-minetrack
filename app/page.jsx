
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// DASHBOARD UTAMA ADMIN / MENTOR
// BAGIAN 1/3 — KONFIGURASI, DATA, DAN SUPABASE
//
// TEMPLATE:
// - Jadwal kegiatan mingguan di kiri
// - Target mingguan seluruh peserta di kanan
// - Daftar dan detail peserta di bawah
// - Light / Dark Mode
// - Kalender global 25 minggu
// - Tanpa perubahan struktur database
// =====================================================

const TOTAL_WEEKS = 25;
const THEME_KEY = "ojt-minetrack-theme";
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN",
  "PMO", "TSP", "HO",
];

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "run" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "training" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "users" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "message" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "compass" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "warning" },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

// =====================================================
// KALENDER GLOBAL OJT — WEEK 01 SAMPAI 25
// =====================================================

function utcDate(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d));
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

function clean(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeType(value) {
  return clean(value).replace(/[^a-z0-9]/g, "");
}

function isParticipant(role) {
  return ["participant", "peserta"].includes(clean(role));
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = utcDate(y, m, d);

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) return null;

  return date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPeriod(start, end) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function weekLabel(number) {
  return `Week ${String(number).padStart(2, "0")}`;
}

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date)) return null;

  return GLOBAL_WEEKS.find(
    (item) => date >= item.start && date <= item.end
  )?.week ?? null;
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-GB", {
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
  const found = globalWeekOf(today);

  if (found !== null) return found;
  if (today < GLOBAL_WEEKS[0].start) return 1;
  if (today > GLOBAL_WEEKS[24].end) return 25;

  const previous = GLOBAL_WEEKS.filter(
    (item) => item.end < today
  );

  return previous.length
    ? previous[previous.length - 1].week
    : 1;
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (days < 0) return null;

  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function initials(name) {
  return (
    String(name || "Pengguna")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "P"
  );
}

function scoreText(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: 2,
      })
    : "—";
}

function amountText(value, unit) {
  const amount = Number(value) || 0;

  return `${amount.toLocaleString("id-ID", {
    maximumFractionDigits: 3,
  })} ${unit}`;
}

function average(records) {
  const values = records
    .map((item) => item.score)
    .filter((value) => value != null && value !== "")
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return values.reduce((sum, n) => sum + n, 0) /
    values.length;
}

// =====================================================
// JADWAL MINGGUAN SAMA DENGAN DASHBOARD PESERTA
// WEEK 08–15
// =====================================================

const WEEKLY_SCHEDULE = [
  {
    id: "w08-navigation", week: 8,
    start: "2026-11-03", end: "2026-11-03",
    type: "Post-Test", icon: "compass",
    title: "Post Test Navigasi Darat",
    description: "Evaluasi kompas, pembacaan peta, penentuan arah, dan koordinat.",
  },
  {
    id: "w08-water", week: 8,
    start: "2026-11-05", end: "2026-11-05",
    type: "Post-Test", icon: "water",
    title: "Post Test Water Rescue",
    description: "Evaluasi keselamatan perairan, penyelamatan korban, dan penggunaan peralatan rescue.",
  },
  {
    id: "w08-tog", week: 8,
    start: "2026-11-01", end: "2026-11-07",
    type: "Praktik", icon: "vest",
    title: "Praktik Donning & Doffing TOG",
    description: "Praktik penggunaan dan pelepasan Turnout Gear sesuai prosedur. Pelaksanaan mengikuti jadwal site.",
  },
  {
    id: "w09-medical", week: 9,
    start: "2026-11-10", end: "2026-11-10",
    type: "Post-Test", icon: "medical",
    title: "Post Test Materi Medical",
    description: "Evaluasi scene size-up, primary assessment, penanganan awal korban, bantuan hidup dasar, trauma, stabilisasi, dan evakuasi medis.",
  },
  {
    id: "w09-cssr", week: 9,
    start: "2026-11-12", end: "2026-11-12",
    type: "Post-Test", icon: "rescue",
    title: "Post Test Materi CSSR",
    description: "Evaluasi bahaya struktur runtuh, prosedur keselamatan, pencarian dan penyelamatan korban, serta penggunaan peralatan CSSR.",
  },
  {
    id: "w09-extrication", week: 9,
    start: "2026-11-08", end: "2026-11-14",
    type: "Praktik", icon: "tools",
    title: "Praktik Ekstrikasi Ram, Spreader & Cutter",
    description: "Praktik penggunaan peralatan hidraulik Ram, Spreader, dan Cutter. Pelaksanaan mengikuti jadwal site.",
  },
  {
    id: "w10-sizeup", week: 10,
    start: "2026-11-17", end: "2026-11-17",
    type: "Post-Test", icon: "clipboard",
    title: "Post Test Materi Scene Size Up",
    description: "Evaluasi identifikasi bahaya, penilaian situasi awal, prioritas penanganan, kebutuhan sumber daya, dan sistem komando.",
  },
  {
    id: "w10-rar", week: 10,
    start: "2026-11-19", end: "2026-11-19",
    type: "Post-Test", icon: "rescue",
    title: "Post Test Materi RAR",
    description: "Evaluasi Road Accident Rescue, pengamanan lokasi, stabilisasi kendaraan, teknik ekstrikasi, penggunaan peralatan rescue, dan evakuasi.",
  },
  {
    id: "w10-cpr", week: 10,
    start: "2026-11-15", end: "2026-11-21",
    type: "Praktik", icon: "medical",
    title: "Praktik CPR & AED",
    description: "Praktik bantuan hidup dasar, teknik CPR, penggunaan AED, koordinasi tim, dan evaluasi sesuai prosedur. Jadwal mengikuti site.",
  },
  {
    id: "w11-har", week: 11,
    start: "2026-11-24", end: "2026-11-24",
    type: "Post-Test", icon: "rope",
    title: "Post Test Materi HAR",
    description: "Evaluasi High Angle Rescue, identifikasi bahaya ketinggian, anchor dan belay, rope rescue, serta pengangkatan dan penurunan korban.",
  },
  {
    id: "w11-fire", week: 11,
    start: "2026-11-26", end: "2026-11-26",
    type: "Post-Test", icon: "fire",
    title: "Post Test Materi Fire",
    description: "Evaluasi klasifikasi dan bahaya kebakaran, teknik pemadaman, penggunaan APAR dan peralatan fire fighting, serta keselamatan.",
  },
  {
    id: "w11-patient", week: 11,
    start: "2026-11-22", end: "2026-11-28",
    type: "Praktik", icon: "medical",
    title: "Praktik Patient Assessment (Trauma)",
    description: "Praktik scene size-up, primary assessment, secondary assessment, trauma management, dan patient handover. Jadwal mengikuti site.",
  },
  {
    id: "w12-hazmat", week: 12,
    start: "2026-12-01", end: "2026-12-01",
    type: "Post-Test", icon: "warning",
    title: "Post Test Materi Hazmat",
    description: "Evaluasi identifikasi bahan berbahaya, karakteristik bahaya, penggunaan APD, penanganan insiden HAZMAT, dan pengendalian risiko.",
  },
  {
    id: "w12-csr", week: 12,
    start: "2026-12-03", end: "2026-12-03",
    type: "Post-Test", icon: "rescue",
    title: "Post Test Materi CSR",
    description: "Evaluasi Confined Space Rescue, bahaya ruang terbatas, prosedur keselamatan, akses dan evakuasi korban, serta penggunaan peralatan rescue.",
  },
  {
    id: "w12-spinal", week: 12,
    start: "2026-11-29", end: "2026-12-05",
    type: "Praktik", icon: "medical",
    title: "Praktik Spinal Immobilization",
    description: "Praktik penanganan korban dengan dugaan cedera tulang belakang menggunakan teknik dan peralatan imobilisasi. Jadwal mengikuti site.",
  },
  {
    id: "w13-navigation", week: 13,
    start: "2026-12-08", end: "2026-12-08",
    type: "Post-Test", icon: "compass",
    title: "Post Test Materi Navigasi Darat",
    description: "Evaluasi kompas, GPS, pembacaan peta topografi, penentuan arah dan koordinat, serta perencanaan rute aman.",
  },
  {
    id: "w13-water", week: 13,
    start: "2026-12-10", end: "2026-12-10",
    type: "Post-Test", icon: "water",
    title: "Post Test Materi Water Rescue",
    description: "Evaluasi keselamatan perairan, penggunaan peralatan rescue, serta metode Reach, Throw, Row, dan Go.",
  },
  {
    id: "w13-knots", week: 13,
    start: "2026-12-06", end: "2026-12-12",
    type: "Praktik", icon: "rope",
    title: "Praktik Simpul (Rescue Knots)",
    description: "Praktik Figure Eight Knot, Bowline Knot, Clove Hitch, Double Fisherman's Knot, Prusik Knot, serta pemeriksaan simpul dan keselamatan.",
  },
  {
    id: "w14-medical", week: 14,
    start: "2026-12-15", end: "2026-12-15",
    type: "Post-Test", icon: "medical",
    title: "Post Test Materi Medical",
    description: "Evaluasi scene size-up, primary assessment, bantuan hidup dasar, trauma management, stabilisasi, dan evakuasi medis.",
  },
  {
    id: "w14-cssr", week: 14,
    start: "2026-12-17", end: "2026-12-17",
    type: "Post-Test", icon: "rescue",
    title: "Post Test Materi CSSR",
    description: "Evaluasi bahaya struktur runtuh, teknik pencarian dan penyelamatan korban, stabilisasi struktur, serta keselamatan operasi.",
  },
  {
    id: "w14-ma", week: 14,
    start: "2026-12-13", end: "2026-12-19",
    type: "Praktik", icon: "tools",
    title: "Praktik Mechanical Advantage (MA)",
    description: "Praktik Basic Mechanical Advantage, sistem 3:1 dan 5:1, Anchor & Pulley System, koordinasi hauling dan lowering, serta keselamatan.",
  },
  {
    id: "w15-sizeup", week: 15,
    start: "2026-12-22", end: "2026-12-22",
    type: "Post-Test", icon: "clipboard",
    title: "Post Test Materi Scene Size Up",
    description: "Evaluasi identifikasi bahaya, penilaian situasi, prioritas penanganan, kebutuhan sumber daya, sistem komando, dan pengendalian risiko.",
  },
  {
    id: "w15-rar", week: 15,
    start: "2026-12-24", end: "2026-12-24",
    type: "Post-Test", icon: "rescue",
    title: "Post Test Materi RAR",
    description: "Evaluasi pengamanan lokasi kecelakaan, stabilisasi kendaraan, akses dan ekstrikasi korban, serta koordinasi penanganan medis dan evakuasi.",
  },
  {
    id: "w15-scba", week: 15,
    start: "2026-12-20", end: "2026-12-26",
    type: "Praktik", icon: "shield",
    title: "Praktik SCBA",
    description: "Praktik identifikasi komponen SCBA, inspeksi, pemeriksaan facepiece, air management, prosedur darurat, serta pengembalian peralatan.",
  },
];

// =====================================================
// RUMUS ACHIEVEMENT
// TARGET DAN PERHITUNGAN TETAP
// =====================================================

function activityAmount(records, name) {
  if (name === "Fisik") {
    return records.reduce((sum, record) => {
      const km = Number(record.distance_km);
      return sum + (Number.isFinite(km) && km > 0 ? km : 0);
    }, 0);
  }

  return records.length;
}

function calculateAchievements(records, types, startDate) {
  const codes = new Map(
    types.map((type) => [
      normalizeType(type.name),
      normalizeType(type.code),
    ])
  );

  const verified = records.filter(
    (record) =>
      clean(record.status) === "verified" &&
      weekOf(record.activity_date, startDate) !== null
  );

  const categories = TARGETS.map((target) => {
    const code = codes.get(normalizeType(target.name));

    const matching = code
      ? verified.filter(
          (record) =>
            normalizeType(record.type_code) === code
        )
      : [];

    const amount = activityAmount(matching, target.name);
    const progress = clamp((amount / target.target) * 100);

    return {
      ...target,
      amount,
      progress,
      completed: amount >= target.target,
    };
  });

  const progress = Math.round(
    categories.reduce(
      (sum, item) => sum + item.progress,
      0
    ) / TARGETS.length
  );

  return {
    categories,
    progress,
    done: categories.filter((item) => item.completed).length,
    completed: categories.every((item) => item.completed),
  };
}

// =====================================================
// SIMPER
// =====================================================

function parseSimperMetadata(notes) {
  const text = String(notes || "");
  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(
      text.slice(start + META_START.length, end)
    );
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
    progress: Math.round((completed / 3) * 100),
    completed,
    passed: completed === 3,
    released: meta?.issuance_status === "issued",
  };
}

// =====================================================
// KOMPONEN ICON
// =====================================================

function Icon({ name, size = 20 }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    chart: <path d="M3 21h18M6 17v-5M12 17V7M18 17V3" />,
    file: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    shield: <><path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" /><path d="m8 12 3 3 5-6" /></>,
    run: <><circle cx="15" cy="4" r="2" /><path d="m7 21 4-6 2-4-4-2-3 3M11 15l6 2 3 4M13 11l4-2 3 1" /></>,
    training: <path d="M3 9v6M21 9v6M6 7v10M18 7v10M6 12h12" />,
    message: <path d="M4 4h16v12H9l-5 4V4Z" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5 4-1Z" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 18h.01" /></>,
    water: <path d="M2 8c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />,
    vest: <path d="m8 3 4 3 4-3 4 4v14H4V7l4-4ZM8 3v18M16 3v18M4 13h16" />,
    medical: <path d="M4 7h16v14H4zM9 7V4h6v3M12 11v7M8.5 14.5h7" />,
    rescue: <path d="M3 20h18M5 20V9l6-5 6 5v11M13 11l-3 5h4l-2 4" />,
    tools: <path d="M14 7a5 5 0 0 0-7 7L2 19l3 3 5-5a5 5 0 0 0 7-7M14 7l4-4 3 3-4 4" />,
    rope: <path d="M5 6c2-4 7-4 9 0s-2 7-5 7-5 3-3 6 7 3 9 0M16 5c4-1 6 2 5 5s-4 4-6 3" />,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 3h6v5H9zM9 13h6M9 17h5" /></>,
    fire: <path d="M12 22c-5 0-8-4-8-9 0-4 3-7 5-10 0 4 3 5 4 8 2-2 3-4 3-6 4 4 5 7 5 10 0 4-4 7-9 7Z" />,
    refresh: <path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />,
    logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M5 5l1 1M18 18l1 1M2 12h2M20 12h2M5 19l1-1M18 6l1-1" /></>,
    moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

function Progress({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="mt-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

// =====================================================
// KOMPONEN UTAMA
// =====================================================

export default function MentorDashboard() {
  const router = useRouter();
  const mounted = useRef(false);

  const [theme, setTheme] = useState("light");
  const [account, setAccount] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [access, setAccess] = useState("checking");
  const [maintenance, setMaintenance] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = clean(account?.role) === "admin";
  const currentWeek = GLOBAL_WEEKS[selectedWeek - 1];

  // ===================================================
  // LIGHT / DARK MODE GLOBAL
  // ===================================================

  useEffect(() => {
    function syncTheme() {
      setTheme(
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "dark"
          : "light"
      );
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
    const next = theme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;

    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}

    setTheme(next);
  }

  useEffect(() => {
    setSelectedWeek(currentGlobalWeek());
  }, []);

  // ===================================================
  // MAINTENANCE MODE
  // ===================================================

  async function maintenanceStatus() {
    const { data, error: statusError } = await supabase
      .from("app_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .maybeSingle();

    if (statusError) {
      throw new Error(
        `Maintenance Mode: ${statusError.message}`
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
  // FETCH DATA DARI SUPABASE
  // ===================================================

  async function fetchAll() {
    const [programRes, typeRes] = await Promise.all([
      supabase
        .from("ojt_programs")
        .select(
          "id,participant_id,start_date,end_date,status,site"
        )
        .eq("status", "active")
        .order("start_date", { ascending: false }),

      supabase
        .from("achievement_types")
        .select("code,name"),
    ]);

    if (programRes.error) {
      throw new Error(programRes.error.message);
    }

    if (typeRes.error) {
      throw new Error(typeRes.error.message);
    }

    const rawPrograms = programRes.data || [];
    const typeList = typeRes.data || [];

    const participantIds = [
      ...new Set(
        rawPrograms
          .map((item) => item.participant_id)
          .filter(Boolean)
      ),
    ];

    const empty = {
      programs: [],
      types: typeList,
      achievements: [],
      postTests: [],
      practices: [],
      samapta: [],
      simper: [],
    };

    if (!participantIds.length) return empty;

    const profileRes = await supabase
      .from("profiles")
      .select("id,full_name,department,role")
      .in("id", participantIds);

    if (profileRes.error) {
      throw new Error(profileRes.error.message);
    }

    const profileMap = new Map(
      (profileRes.data || []).map(
        (profile) => [profile.id, profile]
      )
    );

    const activePrograms = rawPrograms
      .map((program) => ({
        ...program,
        peserta: profileMap.get(program.participant_id) || null,
      }))
      .filter(
        (program) =>
          program.peserta &&
          isParticipant(program.peserta.role)
      );

    const ids = activePrograms.map((item) => item.id);

    if (!ids.length) return empty;

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
        .select(
          "id,program_id,theory_status,practice_status,status,notes"
        )
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
      programs: activePrograms,
      types: typeList,
      achievements: results[0].data || [],
      postTests: results[1].data || [],
      practices: results[2].data || [],
      samapta: results[3].data || [],
      simper: results[4].data || [],
    };
  }

  // =====================================================
  // BAGIAN 2/3
  // LANJUTAN LANGSUNG DARI BAGIAN 1
  // =====================================================

  // =====================================================
  // MENERAPKAN DATA DASHBOARD
  // =====================================================

  function applyData(data) {
    setPrograms(data.programs || []);
    setTypes(data.types || []);
    setAchievements(data.achievements || []);
    setPostTests(data.postTests || []);
    setPractices(data.practices || []);
    setSamapta(data.samapta || []);
    setSimper(data.simper || []);
  }

  // =====================================================
  // AUTHENTICATION & HAK AKSES
  // =====================================================

  useEffect(() => {
    let active = true;
    mounted.current = true;

    async function initialize() {
      setAccess("checking");
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          setAccess("redirecting");
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,department,role")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (profileError) throw profileError;

        if (!profile) {
          throw new Error("Profil akun tidak ditemukan.");
        }

        const role = clean(profile.role);

        if (
          role !== "admin" &&
          role !== "mentor" &&
          !isParticipant(role)
        ) {
          throw new Error(
            "Akun tidak memiliki akses Dashboard OJT."
          );
        }

        const maintenanceMode = await maintenanceStatus();

        if (!active) return;

        setMaintenance(maintenanceMode);

        if (maintenanceMode && role !== "admin") {
          setAccess("maintenance");
          return;
        }

        if (isParticipant(role)) {
          setAccess("redirecting");
          router.replace("/dashboard-peserta");
          return;
        }

        const data = await fetchAll();

        if (!active) return;

        setAccount({
          ...profile,
          role,
          email: user.email || "",
        });

        applyData(data);
        setAccess("allowed");
      } catch (err) {
        if (!active) return;

        setError(
          err?.message || "Gagal memuat Dashboard OJT."
        );
        setAccess("error");
      }
    }

    initialize();

    return () => {
      active = false;
      mounted.current = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // =====================================================
  // PEMANTAUAN MAINTENANCE UNTUK ADMIN
  // =====================================================

  useEffect(() => {
    if (!isAdmin || access !== "allowed") return;

    let active = true;

    async function checkMaintenance() {
      try {
        const status = await maintenanceStatus();

        if (active) setMaintenance(status);
      } catch {
        if (active) setMaintenance(null);
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        checkMaintenance();
      }
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, access]);

  // =====================================================
  // REFRESH & LOGOUT
  // =====================================================

  async function refresh() {
    if (refreshing || access !== "allowed") return;

    setRefreshing(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== account?.id) {
        router.replace("/login");
        return;
      }

      const {
        data: verifiedProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const verifiedRole = clean(verifiedProfile?.role);

      if (
        verifiedRole !== "admin" &&
        verifiedRole !== "mentor"
      ) {
        throw new Error(
          "Hak akses berubah. Silakan login kembali."
        );
      }

      const status = await maintenanceStatus();
      setMaintenance(status);

      if (status && verifiedRole !== "admin") {
        setAccess("maintenance");
        return;
      }

      const data = await fetchAll();

      if (mounted.current) applyData(data);
    } catch (err) {
      if (mounted.current) {
        setError(
          err?.message || "Gagal memperbarui data."
        );
      }
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Gagal keluar dari akun.");
      setLoggingOut(false);
    }
  }

  // =====================================================
  // NAVIGASI
  // =====================================================

  function navigate(path) {
    setMenuOpen(false);
    router.push(path);
  }

  function scrollToSection(id) {
    setMenuOpen(false);

    window.requestAnimationFrame(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  function openCalendar() {
    setCalendarOpen(true);
    scrollToSection("jadwal-kegiatan");
  }

  function changeWeek(value) {
    const number = Number(value);

    if (!Number.isInteger(number)) return;

    setSelectedWeek(
      Math.max(1, Math.min(TOTAL_WEEKS, number))
    );
  }

  function openParticipant(programId) {
    navigate(`/peserta/${encodeURIComponent(programId)}`);
  }

  function openAchievement(programId) {
    navigate(
      `/achievement/${encodeURIComponent(programId)}`
    );
  }

  function openMonitoring(programId) {
    navigate(
      `/achievement/${encodeURIComponent(programId)}/monitoring`
    );
  }

  function openAdminPreview(participantId) {
    if (!isAdmin) return;

    navigate(
      `/dashboard-peserta?participant=${encodeURIComponent(
        participantId
      )}`
    );
  }

  // =====================================================
  // FILTER PESERTA AKTIF
  // =====================================================

  const filtered = useMemo(() => {
    const keyword = clean(search);

    return programs.filter((program) => {
      const participant = program.peserta;

      if (!participant || !isParticipant(participant.role)) {
        return false;
      }

      if (
        siteFilter !== "ALL" &&
        clean(program.site) !== clean(siteFilter)
      ) {
        return false;
      }

      if (!keyword) return true;

      return (
        clean(participant.full_name).includes(keyword) ||
        clean(participant.department).includes(keyword) ||
        clean(program.site).includes(keyword)
      );
    });
  }, [programs, siteFilter, search]);

  // =====================================================
  // DATA PER PESERTA DAN PER MINGGU
  // =====================================================

  const participantReports = useMemo(() => {
    const codeMap = new Map(
      types.map((type) => [
        normalizeType(type.name),
        normalizeType(type.code),
      ])
    );

    return filtered.map((program) => {
      const programAchievements = achievements.filter(
        (record) => record.program_id === program.id
      );

      const weekAchievements = programAchievements.filter(
        (record) =>
          globalWeekOf(record.activity_date) ===
            selectedWeek &&
          weekOf(
            record.activity_date,
            program.start_date
          ) !== null
      );

      const verified = weekAchievements.filter(
        (record) => clean(record.status) === "verified"
      );

      const pending = weekAchievements.filter(
        (record) => clean(record.status) === "pending"
      );

      const categories = TARGETS.map((target) => {
        const code = codeMap.get(
          normalizeType(target.name)
        );

        const matching = code
          ? verified.filter(
              (record) =>
                normalizeType(record.type_code) === code
            )
          : [];

        const amount = activityAmount(
          matching,
          target.name
        );

        return {
          ...target,
          amount,
          progress: clamp(
            (amount / target.target) * 100
          ),
          records: matching.length,
        };
      });

      const weeklyProgress = Math.round(
        categories.reduce(
          (sum, category) =>
            sum + category.progress,
          0
        ) / TARGETS.length
      );

      const allProgress = calculateAchievements(
        programAchievements,
        types,
        program.start_date
      );

      const simperRecords = simper.filter(
        (record) => record.program_id === program.id
      );

      const chosenSimper =
        simperRecords.find((record) =>
          parseSimperMetadata(record.notes)
        ) ||
        simperRecords[0] ||
        null;

      const simperInfo = calculateSimper(
        chosenSimper
      );

      const weekPostTests = postTests.filter(
        (record) =>
          record.program_id === program.id &&
          globalWeekOf(record.test_date) === selectedWeek
      );

      const weekPractices = practices.filter(
        (record) =>
          record.program_id === program.id &&
          globalWeekOf(record.practice_date) === selectedWeek
      );

      const weekSamapta = samapta.filter(
        (record) =>
          record.program_id === program.id &&
          globalWeekOf(record.test_date) === selectedWeek
      );

      return {
        ...program,
        verified: verified.length,
        pending: pending.length,
        categories,
        weeklyProgress,
        totalProgress: allProgress.progress,
        completedCategories: allProgress.done,
        simperProgress: simperInfo.progress,
        simperIssued: simperInfo.released,
        postTestCount: weekPostTests.length,
        practiceCount: weekPractices.length,
        samaptaCount: weekSamapta.length,
        averageScore: average([
          ...weekPostTests,
          ...weekPractices,
        ]),
      };
    });
  }, [
    filtered,
    types,
    achievements,
    postTests,
    practices,
    samapta,
    simper,
    selectedWeek,
  ]);

  // =====================================================
  // TARGET MINGGUAN SELURUH PESERTA
  //
  // Rata-rata persentase tiap kategori dihitung
  // dari pencapaian Verified per peserta.
  // Target tetap 25 km, 4, 3, 1, 2, 2.
  // =====================================================

  const weeklyTargets = useMemo(() => {
    return TARGETS.map((target, index) => {
      const totalAmount = participantReports.reduce(
        (sum, program) =>
          sum + (program.categories[index]?.amount || 0),
        0
      );

      const totalProgress = participantReports.reduce(
        (sum, program) =>
          sum + (program.categories[index]?.progress || 0),
        0
      );

      const participantCount = participantReports.length;

      return {
        ...target,
        totalAmount,
        totalTarget: target.target * participantCount,
        progress: participantCount
          ? Math.round(totalProgress / participantCount)
          : 0,
        achieved: participantReports.filter(
          (program) =>
            (program.categories[index]?.amount || 0) >=
            target.target
        ).length,
        participantCount,
      };
    });
  }, [participantReports]);

  const overallWeeklyProgress = useMemo(() => {
    if (!weeklyTargets.length) return 0;

    return Math.round(
      weeklyTargets.reduce(
        (sum, item) => sum + item.progress,
        0
      ) / weeklyTargets.length
    );
  }, [weeklyTargets]);

  // =====================================================
  // JADWAL KEGIATAN TERPILIH
  // TIDAK MENGGUNAKAN DATA CONTOH / FIKTIF
  // =====================================================

  const selectedSchedule = useMemo(() => {
    return WEEKLY_SCHEDULE.filter(
      (item) => item.week === selectedWeek
    );
  }, [selectedWeek]);

  const accountName =
    account?.full_name ||
    (isAdmin ? "Administrator" : "Mentor OJT");

  const accountRole =
    isAdmin ? "Administrator" : "Mentor OJT";

  // =====================================================
  // HALAMAN PEMERIKSAAN AKSES
  // =====================================================

  if (
    access === "checking" ||
    access === "redirecting"
  ) {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <div className="mt-access-logo">MT</div>
          <h2>OJT MineTrack v2.0</h2>
          <p>Memeriksa akses akun...</p>
        </div>
      </main>
    );
  }

  if (access === "maintenance") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <Icon name="warning" size={42} />
          <h2>Sistem Sedang Maintenance</h2>
          <p>
            Akses Mentor sementara tidak tersedia
            selama pemeliharaan sistem.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Coba Lagi
          </button>

          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
          >
            Keluar Akun
          </button>
        </div>
      </main>
    );
  }

  if (access === "error") {
    return (
      <main className="mt-access">
        <style>{dashboardCSS}</style>

        <div className="mt-access-card">
          <Icon name="warning" size={42} />
          <h2>Gagal Memuat Dashboard</h2>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Coba Lagi
          </button>

          <button
            type="button"
            onClick={() => router.replace("/login")}
          >
            Halaman Login
          </button>
        </div>
      </main>
    );
  }

  // =====================================================
  // TAMPILAN DASHBOARD ADMIN / MENTOR
  // =====================================================

  return (
    <div className="mt-shell">
      <style>{dashboardCSS}</style>

      {/* OVERLAY MOBILE */}

      {menuOpen && (
        <button
          type="button"
          className="mt-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}

      {/* =================================================
          SIDEBAR SESUAI REVISI
      ================================================= */}

      <aside
        className={`mt-sidebar ${menuOpen ? "open" : ""}`}
      >
        <div>
          <div className="mt-brand">
            <div className="mt-brand-title">
              OJT <span>MineTrack</span>
              <small> v2.0</small>
            </div>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>
          </div>

          <div className="mt-menu-label">
            MENU {isAdmin ? "ADMIN" : "MENTOR"}
          </div>

          <nav className="mt-sidebar-nav">
            <button
              type="button"
              className="mt-nav active"
              onClick={() =>
                scrollToSection("dashboard-utama")
              }
            >
              <Icon name="home" size={19} />
              <span>Dashboard Mentor</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/monitoring-peserta")
              }
            >
              <Icon name="chart" size={19} />
              <span>Monitoring Peserta</span>
            </button>
           
<button
  type="button"
  className="mt-nav"
  onClick={() =>
    navigate("/mentor/verifikasi-kegiatan")
  }
>
  <Icon name="check" size={19} />
  <span>Verifikasi & Monitoring</span>
  {achievements.filter(
    (item) => item.status === "pending"
  ).length > 0 && (
    <span className="mt-pending-count">
      {achievements.filter(
        (item) => item.status === "pending"
      ).length}
    </span>
  )}
</button>


            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                scrollToSection("daftar-peserta")
              }
            >
              <Icon name="users" size={19} />
              <span>Peserta OJT</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/daftar-peserta")
              }
            >
              <Icon name="file" size={19} />
              <span>Pendaftaran Peserta</span>
            </button>

            <button
              type="button"
              className="mt-nav"
              onClick={() =>
                navigate("/mentor/persetujuan-peserta")
              }
            >
              <Icon name="check" size={19} />
              <span>Persetujuan Peserta</span>
            </button>
           
{isAdmin && (
  <button
    type="button"
    className="mt-nav"
    onClick={() =>
      navigate("/admin/persetujuan-mentor")
    }
  >
    <Icon name="check" size={19} />
    <span>Persetujuan Mentor</span>
  </button>
)}

            <button
              type="button"
              className="mt-nav"
              onClick={openCalendar}
            >
              <Icon name="calendar" size={19} />
              <span>Kalender Kegiatan Mingguan</span>
            </button>
          </nav>
        </div>

        <div className="mt-sidebar-bottom">
          <div className="mt-sidebar-user">
            <div className="mt-avatar">
              {initials(accountName)}
            </div>

            <div>
              <strong>{accountName}</strong>
              <small>{accountRole}</small>
            </div>
          </div>

          <button
            type="button"
            className="mt-nav"
            onClick={refresh}
            disabled={refreshing}
          >
            <Icon name="refresh" size={19} />
            <span>
              {refreshing
                ? "Memperbarui..."
                : "Refresh Data"}
            </span>
          </button>

          <button
            type="button"
            className="mt-nav"
            onClick={logout}
            disabled={loggingOut}
          >
            <Icon name="logout" size={19} />
            <span>
              {loggingOut
                ? "Sedang Keluar..."
                : "Keluar Akun"}
            </span>
          </button>
        </div>
      </aside>

      {/* =================================================
          KONTEN UTAMA
      ================================================= */}

      <main
        className="mt-main"
        id="dashboard-utama"
      >
        {/* HEADER MOBILE */}

        <div className="mt-mobile-header">
          <strong>
            OJT <span>MineTrack</span>
          </strong>

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka sidebar"
          >
            <Icon name="menu" size={23} />
          </button>
        </div>

        {/* HERO */}

        <header
          className="mt-hero"
          style={{
            backgroundImage: `linear-gradient(90deg,rgba(2,26,24,.96),rgba(2,43,34,.78),rgba(3,25,25,.58)),url("${BACKGROUND_IMAGE}")`,
          }}
        >
          <div className="mt-hero-copy">
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>
              Dashboard Mentor OJT{" "}
              <span>MineTrack</span>
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
                <Icon name="check" size={15} />
                Safe Operation
              </span>

              <span>
                <Icon name="compass" size={15} />
                Sustainable Mining
              </span>
            </div>
          </div>

          <div className="mt-hero-user">
            <span className="mt-avatar">
              {initials(accountName)}
            </span>

            <div>
              <strong>{accountName}</strong>
              <small>{accountRole}</small>
            </div>
          </div>
        </header>

        {/* =================================================
            TOOLBAR
        ================================================= */}

        <div className="mt-content">
          <div className="mt-toolbar">
            <div className="mt-toolbar-copy">
              <small>PROGRAM OJT 2026–2027</small>
              <h2>Monitoring Program OJT</h2>
              <p>
                Jadwal mingguan, target, dan perkembangan
                seluruh peserta OJT.
              </p>
            </div>

            <div className="mt-toolbar-actions">
              <button
                type="button"
                className="mt-theme-button"
                onClick={toggleTheme}
              >
                <Icon
                  name={
                    theme === "dark" ? "sun" : "moon"
                  }
                  size={18}
                />

                {theme === "dark"
                  ? "Mode Terang"
                  : "Mode Gelap"}
              </button>

              <label className="mt-select-control">
                <Icon name="calendar" size={17} />

                <select
                  value={selectedWeek}
                  onChange={(event) =>
                    changeWeek(event.target.value)
                  }
                  aria-label="Pilih minggu"
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
              </label>

              <label className="mt-select-control">
                <Icon name="compass" size={17} />

                <select
                  value={siteFilter}
                  onChange={(event) =>
                    setSiteFilter(event.target.value)
                  }
                  aria-label="Filter site"
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
              </label>

              <button
                type="button"
                className="mt-refresh-button"
                onClick={refresh}
                disabled={refreshing}
              >
                <Icon name="refresh" size={17} />

                {refreshing ? "Memuat..." : "Refresh"}
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

          {/* =================================================
              BARIS PERTAMA
              KIRI: JADWAL
              KANAN: TARGET MINGGUAN
          ================================================= */}

          <div className="mt-main-grid">
            {/* JADWAL KEGIATAN */}

            <section
              className="mt-panel mt-schedule-panel"
              id="jadwal-kegiatan"
            >
              <div className="mt-panel-heading">
                <div className="mt-heading-with-icon">
                  <span className="mt-heading-icon">
                    <Icon name="calendar" size={23} />
                  </span>

                  <div>
                    <h2>
                      Jadwal Kegiatan Minggu Ini
                    </h2>
                    <small>
                      {formatPeriod(
                        currentWeek.start,
                        currentWeek.end
                      )}
                    </small>
                  </div>
                </div>

                <span className="mt-week-badge">
                  {weekLabel(selectedWeek)}
                </span>
              </div>

              <div className="mt-schedule-period">
                <Icon name="calendar" size={18} />

                <strong>
                  {formatPeriod(
                    currentWeek.start,
                    currentWeek.end
                  )}
                </strong>
              </div>

              <div className="mt-schedule-list">
                {selectedSchedule.length > 0 ? (
                  selectedSchedule.map((item) => {
                    const startDate = parseDate(item.start);

                    const dayName = startDate
                      ? startDate.toLocaleDateString(
                          "id-ID",
                          {
                            weekday: "short",
                            timeZone: "UTC",
                          }
                        )
                      : "—";

                    const dateNumber = startDate
                      ? String(
                          startDate.getUTCDate()
                        ).padStart(2, "0")
                      : "—";

                    const monthName = startDate
                      ? startDate.toLocaleDateString(
                          "id-ID",
                          {
                            month: "short",
                            timeZone: "UTC",
                          }
                        )
                      : "";

                    const isRange =
                      item.start !== item.end;

                    return (
                      <article
                        className="mt-schedule-item"
                        key={item.id}
                      >
                        <div className="mt-date-card">
                          <span>
                            {isRange
                              ? "Periode"
                              : dayName}
                          </span>

                          <strong>
                            {isRange
                              ? `${String(
                                  parseDate(item.start)
                                    ?.getUTCDate() || ""
                                ).padStart(2, "0")}–${String(
                                  parseDate(item.end)
                                    ?.getUTCDate() || ""
                                ).padStart(2, "0")}`
                              : dateNumber}
                          </strong>

                          <small>{monthName}</small>
                        </div>

                        <div className="mt-activity-symbol">
                          <Icon
                            name={item.icon}
                            size={29}
                          />
                        </div>

                        <div className="mt-schedule-description">
                          <h3>{item.title}</h3>

                          <p>{item.description}</p>

                          <details className="mt-material">
                            <summary>
                              Lihat Materi
                            </summary>

                            <p>
                              {item.description}
                            </p>
                          </details>
                        </div>

                        <div
                          className={`mt-type-badge ${
                            item.type === "Praktik"
                              ? "practice"
                              : "posttest"
                          }`}
                        >
                          {item.type}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className="mt-empty">
                    Belum ada kegiatan yang
                    dijadwalkan pada{" "}
                    {weekLabel(selectedWeek)}.
                  </div>
                )}
              </div>

              <div className="mt-calendar-actions">
                <button
                  type="button"
                  disabled={selectedWeek <= 1}
                  onClick={() =>
                    changeWeek(selectedWeek - 1)
                  }
                >
                  <Icon name="left" size={19} />
                </button>

                <button
                  type="button"
                  className="mt-calendar-label"
                  onClick={() =>
                    setCalendarOpen((old) => !old)
                  }
                >
                  <Icon name="calendar" size={17} />

                  {weekLabel(selectedWeek)}
                </button>

                <button
                  type="button"
                  disabled={
                    selectedWeek >= TOTAL_WEEKS
                  }
                  onClick={() =>
                    changeWeek(selectedWeek + 1)
                  }
                >
                  <Icon name="right" size={19} />
                </button>
              </div>

              {calendarOpen && (
                <div className="mt-calendar-expanded">
                  <strong>
                    Kalender Global OJT
                  </strong>

                  <div className="mt-calendar-grid">
                    {GLOBAL_WEEKS.map((week) => (
                      <button
                        type="button"
                        key={week.week}
                        className={
                          week.week === selectedWeek
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          changeWeek(week.week)
                        }
                        title={formatPeriod(
                          week.start,
                          week.end
                        )}
                      >
                        W{String(week.week).padStart(
                          2,
                          "0"
                        )}
                      </button>
                    ))}
                  </div>

                  <small>
                    Kalender program Week 01–25.
                  </small>
                </div>
              )}
            </section>

            {/* TARGET MINGGUAN */}

            <section
              className="mt-panel mt-target-panel"
              id="target-mingguan"
            >
              <div className="mt-panel-heading">
                <div className="mt-heading-with-icon">
                  <span className="mt-heading-icon">
                    <Icon name="chart" size={23} />
                  </span>

                  <div>
                    <h2>
                      Target Mingguan Seluruh Peserta
                    </h2>

                    <small>
                      Pencapaian enam kategori pada{" "}
                      {weekLabel(selectedWeek)}
                    </small>
                  </div>
                </div>

                <span className="mt-week-badge">
                  {participantReports.length} Peserta
                </span>
              </div>

              <div className="mt-target-summary">
                <div>
                  <small>
                    Rata-rata Pencapaian
                  </small>

                  <strong>
                    {overallWeeklyProgress}%
                  </strong>
                </div>

                <div>
                  <small>
                    Minggu Monitoring
                  </small>

                  <strong>
                    {weekLabel(selectedWeek)}
                  </strong>
                </div>
              </div>

              <div className="mt-target-grid">
                {weeklyTargets.map((item) => (
                  <article
                    className="mt-target-card"
                    key={item.name}
                  >
                    <div className="mt-target-card-top">
                      <span className="mt-target-icon">
                        <Icon
                          name={item.icon}
                          size={21}
                        />
                      </span>

                      <strong>{item.name}</strong>

                      <b>{item.progress}%</b>
                    </div>

                    <Progress value={item.progress} />

                    <div className="mt-target-card-bottom">
                      <span>
                        {amountText(
                          item.totalAmount,
                          item.unit
                        )}
                      </span>

                      <span>
                        Target:{" "}
                        {amountText(
                          item.totalTarget,
                          item.unit
                        )}
                      </span>
                    </div>

                    <small className="mt-target-note">
                      {item.achieved} dari{" "}
                      {item.participantCount} peserta
                      memenuhi target
                    </small>
                  </article>
                ))}
              </div>

              <p className="mt-target-footnote">
                Hanya Achievement berstatus Verified
                yang dihitung. Persentase setiap
                kategori maksimal 100% per peserta.
              </p>
            </section>
          </div>

          {/* =================================================
              BARIS KEDUA
              DAFTAR PESERTA OJT
          ================================================= */}

          <section
            className="mt-panel mt-participant-panel"
            id="daftar-peserta"
          >
            <div className="mt-participant-header">
              <div className="mt-heading-with-icon">
                <span className="mt-heading-icon">
                  <Icon name="users" size={23} />
                </span>

                <div>
                  <h2>Daftar Peserta OJT Aktif</h2>
                  <small>
                    Pilih Detail, Input, atau Monitoring
                    untuk mengelola peserta.
                  </small>
                </div>
              </div>

              <div className="mt-participant-actions">
                <label className="mt-search">
                  <Icon name="search" size={17} />

                  <input
                    type="search"
                    placeholder="Cari nama peserta..."
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                  />
                </label>

                <button
                  type="button"
                  className="mt-list-button"
                  onClick={() =>
                    navigate(
                      "/mentor/monitoring-peserta"
                    )
                  }
                >
                  Lihat Semua
                  <Icon name="right" size={15} />
                </button>
              </div>
            </div>

            {/* TABEL PESERTA */}

            <div className="mt-table-wrap">
              <table className="mt-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Peserta</th>
                    <th>Departemen</th>
                    <th>Site</th>
                    <th>Periode OJT</th>
                    <th>Target Mingguan</th>
                    <th>SIMPER</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {participantReports.map(
                    (program, index) => (
                      <tr key={program.id}>
                        <td>{index + 1}</td>

                        <td className="mt-name-cell">
                          {program.peserta?.full_name ||
                            "Peserta OJT"}
                        </td>

                        <td>
                          {program.peserta
                            ?.department || "—"}
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
                          <div className="mt-table-progress">
                            <Progress
                              value={
                                program.weeklyProgress
                              }
                            />

                            <strong>
                              {program.weeklyProgress}%
                            </strong>
                          </div>
                        </td>

                        <td>
                          {program.simperProgress}%
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
                              onClick={() =>
                                openParticipant(
                                  program.id
                                )
                              }
                            >
                              Detail
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openAchievement(
                                  program.id
                                )
                              }
                            >
                              Input
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openMonitoring(
                                  program.id
                                )
                              }
                            >
                              Monitoring
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  openAdminPreview(
                                    program.participant_id
                                  )
                                }
                              >
                                Preview
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                  {!participantReports.length && (
                    <tr>
                      <td
                        colSpan={9}
                        className="mt-empty"
                      >
                        Belum ada peserta aktif
                        sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* KARTU PESERTA MOBILE */}

            <div className="mt-mobile-participants">
              {participantReports.map((program) => (
                <article
                  key={program.id}
                  className="mt-person-card"
                >
                  <div className="mt-person-card-top">
                    <span className="mt-avatar">
                      {initials(
                        program.peserta?.full_name
                      )}
                    </span>

                    <div>
                      <strong>
                        {program.peserta
                          ?.full_name ||
                          "Peserta OJT"}
                      </strong>

                      <small>
                        {program.peserta
                          ?.department || "—"}
                        {" · "}
                        {program.site || "—"}
                      </small>
                    </div>

                    <span className="mt-status-active">
                      Aktif
                    </span>
                  </div>

                  <div className="mt-person-meta">
                    {formatPeriod(
                      program.start_date,
                      program.end_date
                    )}
                  </div>

                  <div className="mt-person-progress">
                    <span>
                      Target Mingguan
                    </span>

                    <strong>
                      {program.weeklyProgress}%
                    </strong>
                  </div>

                  <Progress
                    value={program.weeklyProgress}
                  />

                  <div className="mt-person-meta">
                    SIMPER: {program.simperProgress}%
                  </div>

                  <div className="mt-mobile-actions">
                    <button
                      type="button"
                      onClick={() =>
                        openParticipant(program.id)
                      }
                    >
                      Detail
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openAchievement(program.id)
                      }
                    >
                      Input
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openMonitoring(program.id)
                      }
                    >
                      Monitoring
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          openAdminPreview(
                            program.participant_id
                          )
                        }
                      >
                        Preview
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-participant-footer">
              Menampilkan{" "}
              <strong>
                {participantReports.length}
              </strong>{" "}
              peserta OJT aktif.
            </div>
          </section>

          <footer className="mt-footer">
            OJT MineTrack v2.0 · Emergency
            Response Group · PT Berau Coal
          </footer>
        </div>
      </main>
    </div>
  );
}

// =====================================================
// BAGIAN 3/3 BERISI CSS LENGKAP
// LANJUTKAN LANGSUNG SETELAH BARIS INI
// =====================================================

// =====================================================
// BAGIAN 3/3
// OJT MINETRACK V2.0
// CSS DASHBOARD UTAMA ADMIN / MENTOR
// LIGHT MODE + DARK MODE + RESPONSIVE
// =====================================================

const dashboardCSS = `

/* =====================================================
   GLOBAL THEME
===================================================== */

.mt-shell {
  --mt-bg: #f2f7f5;
  --mt-surface: #ffffff;
  --mt-surface-alt: #f4faf7;
  --mt-text: #18332e;
  --mt-heading: #12362c;
  --mt-muted: #6c837a;
  --mt-border: #dce9e3;
  --mt-green: #07865b;
  --mt-green-dark: #065c41;
  --mt-green-light: #e1f5eb;
  --mt-progress-bg: #deebe4;
  --mt-input: #ffffff;
  --mt-shadow: 0 5px 20px rgba(18, 65, 45, .06);

  min-height: 100vh;
  background: var(--mt-bg);
  color: var(--mt-text);
  font-family: Arial, Helvetica, sans-serif;
  line-height: 1.5;
  transition: background .2s ease, color .2s ease;
}

html[data-theme="dark"] .mt-shell {
  color-scheme: dark;
  --mt-bg: #0c1918;
  --mt-surface: #172925;
  --mt-surface-alt: #203731;
  --mt-text: #e8f6ee;
  --mt-heading: #f2fff8;
  --mt-muted: #a3bbb0;
  --mt-border: #345047;
  --mt-green: #6ce4a7;
  --mt-green-dark: #75edb4;
  --mt-green-light: #244439;
  --mt-progress-bg: #355248;
  --mt-input: #1b302a;
  --mt-shadow: 0 7px 24px rgba(0, 0, 0, .18);
}

.mt-shell,
.mt-shell * {
  box-sizing: border-box;
}

.mt-shell button,
.mt-shell input,
.mt-shell select {
  font-family: inherit;
}

.mt-shell button {
  cursor: pointer;
  touch-action: manipulation;
}

.mt-shell button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.mt-shell button:focus-visible,
.mt-shell input:focus-visible,
.mt-shell select:focus-visible,
.mt-shell summary:focus-visible {
  outline: 3px solid #37c996;
  outline-offset: 2px;
}

.mt-shell button,
.mt-shell input,
.mt-shell select {
  font-size: 12px;
}

.mt-shell h1,
.mt-shell h2,
.mt-shell h3,
.mt-shell p {
  overflow-wrap: anywhere;
}

.mt-shell h1,
.mt-shell h2,
.mt-shell h3 {
  color: var(--mt-heading);
}

.mt-shell select,
.mt-shell input {
  color: var(--mt-text);
}

.mt-shell select option {
  background: var(--mt-surface);
  color: var(--mt-text);
}

#dashboard-utama,
#jadwal-kegiatan,
#target-mingguan,
#daftar-peserta {
  scroll-margin-top: 18px;
}

/* =====================================================
   SIDEBAR
===================================================== */

.mt-sidebar {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 50;

  width: 255px;
  padding: 20px 14px 15px;

  display: flex;
  flex-direction: column;
  justify-content: space-between;

  overflow-y: auto;
  color: #ffffff;

  background: linear-gradient(
    170deg,
    #063c32 0%,
    #042e29 55%,
    #03231f 100%
  );

  box-shadow: 5px 0 22px rgba(0, 0, 0, .10);
}

html[data-theme="dark"] .mt-sidebar {
  background: linear-gradient(
    170deg,
    #0b2a26,
    #071d1b 60%,
    #061514
  );
}

/* BRAND */

.mt-brand {
  padding: 12px 10px 22px;
  margin-bottom: 20px;
  border-bottom: 1px solid #ffffff25;
}

.mt-brand-title {
  color: #ffffff;
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -.7px;
  white-space: nowrap;
}

.mt-brand-title span {
  color: #48dfa7;
}

.mt-brand-title small {
  color: #b8dbce;
  font-size: 10px;
  letter-spacing: 0;
}

.mt-brand p {
  margin: 9px 0 0;
  color: #c0ddd0;
  font-size: 11px;
  line-height: 1.7;
}

.mt-menu-label {
  padding: 10px 12px;
  color: #95cebb;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.1px;
}

/* NAVIGATION */

.mt-sidebar-nav {
  display: grid;
  gap: 7px;
}

.mt-nav {
  display: flex;
  align-items: center;
  gap: 12px;

  width: 100%;
  min-height: 45px;
  padding: 12px 13px;

  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;

  color: #e5f6ed;
  text-align: left;
  font-size: 12px;
  font-weight: 700;

  transition: background .15s ease;
}

.mt-nav svg {
  flex-shrink: 0;
}

.mt-nav span {
  min-width: 0;
  flex: 1;
}

.mt-nav:hover {
  background: #ffffff16;
}

.mt-nav.active {
  color: #ffffff;
  background: #07885c;
  border-color: #ffffff19;
}

/* HANYA MENU SESUAI KESEPAKATAN:
   DASHBOARD
   PERSETUJUAN PESERTA
   KALENDER KEGIATAN MINGGUAN
   REFRESH DATA
   KELUAR AKUN

/* SIDEBAR BOTTOM */

.mt-sidebar-bottom {
  margin-top: 24px;
  padding-top: 17px;
  border-top: 1px solid #ffffff25;
}

.mt-sidebar-user {
  display: flex;
  align-items: center;
  gap: 11px;

  min-width: 0;
  padding: 12px;
  margin-bottom: 13px;

  border: 1px solid #ffffff22;
  border-radius: 11px;
  background: #ffffff0e;
}

.mt-sidebar-user > div:last-child {
  min-width: 0;
}

.mt-sidebar-user strong,
.mt-sidebar-user small {
  display: block;
  overflow-wrap: anywhere;
}

.mt-sidebar-user strong {
  color: #ffffff;
  font-size: 11px;
}

.mt-sidebar-user small {
  margin-top: 4px;
  color: #b9d8c9;
  font-size: 10px;
}

.mt-sidebar-bottom .mt-nav {
  min-height: 40px;
  padding: 10px 12px;
}

.mt-sidebar-bottom .mt-nav:last-child {
  color: #ffd6cd;
}

/* =====================================================
   AVATAR
===================================================== */

.mt-avatar {
  width: 38px;
  height: 38px;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  border-radius: 50%;
  background: #d4f4e3;
  color: #07573d;

  font-size: 12px;
  font-weight: 900;
}

/* =====================================================
   MAIN CONTENT
===================================================== */

.mt-main {
  min-width: 0;
  min-height: 100vh;
  margin-left: 255px;
  background: var(--mt-bg);
}

.mt-content {
  width: 100%;
  max-width: 1740px;
  margin: 0 auto;
  padding: 21px 23px 30px;
}

.mt-mobile-header {
  display: none;
}

.mt-overlay {
  display: none;
}

/* =====================================================
   HERO HEADER
===================================================== */

.mt-hero {
  position: relative;

  min-height: 194px;
  padding: 26px 28px;

  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;

  background-color: #05382d;
  background-position: center;
  background-size: cover;

  color: #ffffff;
}

.mt-hero-copy {
  min-width: 0;
}

.mt-hero-copy > small {
  display: block;
  color: #eccc7e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
}

.mt-hero h1 {
  margin: 12px 0 7px;
  color: #ffffff;
  font-size: clamp(25px, 2.7vw, 36px);
  line-height: 1.2;
  letter-spacing: -.6px;
}

.mt-hero h1 span {
  color: #55e9a8;
}

.mt-hero-copy > p {
  margin: 0;
  color: #d7eee3;
  font-size: 12px;
}

.mt-values {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  margin-top: 19px;
}

.mt-values span {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #e6f6eb;
  font-size: 10px;
}

.mt-values svg {
  color: #efd18d;
}

.mt-hero-user {
  display: flex;
  align-items: center;
  gap: 10px;

  max-width: 280px;
  padding: 10px 13px;

  border: 1px solid #ffffff35;
  border-radius: 12px;
  background: rgba(3, 35, 33, .77);
}

.mt-hero-user > div {
  min-width: 0;
}

.mt-hero-user strong,
.mt-hero-user small {
  display: block;
}

.mt-hero-user strong {
  color: #ffffff;
  font-size: 11px;
}

.mt-hero-user small {
  margin-top: 4px;
  color: #c7e4d4;
  font-size: 10px;
}

/* =====================================================
   TOOLBAR
===================================================== */

.mt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;

  margin-bottom: 19px;
}

.mt-toolbar-copy {
  min-width: 0;
}

.mt-toolbar-copy > small {
  color: var(--mt-green);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.mt-toolbar-copy h2 {
  margin: 5px 0;
  color: var(--mt-heading);
  font-size: 21px;
}

.mt-toolbar-copy p {
  margin: 0;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-toolbar-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9px;
}

.mt-theme-button,
.mt-refresh-button,
.mt-select-control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  min-height: 40px;
  padding: 9px 13px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;
  background: var(--mt-surface);

  color: var(--mt-green);
  font-size: 11px;
  font-weight: 800;

  box-shadow: 0 2px 8px var(--mt-shadow);
}

.mt-theme-button {
  border-color: #0ba674;
  border-radius: 22px;
}

.mt-theme-button:hover,
.mt-refresh-button:hover {
  background: var(--mt-green-light);
}

.mt-select-control {
  padding: 0 10px;
}

.mt-select-control select {
  min-height: 38px;
  max-width: 160px;

  border: 0;
  outline: none;
  background: transparent;

  color: var(--mt-text);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

/* =====================================================
   ERROR MESSAGE
===================================================== */

.mt-error {
  padding: 13px 15px;
  margin-bottom: 16px;

  border: 1px solid #ec9aa2;
  border-radius: 10px;

  background: #fff1f2;
  color: #a32636;
  font-size: 12px;
}

html[data-theme="dark"] .mt-error {
  background: #45262c;
  border-color: #80454d;
  color: #ffd0d4;
}

/* =====================================================
   MAIN GRID
   LEFT = SCHEDULE
   RIGHT = TARGET
===================================================== */

.mt-main-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 1.12fr)
    minmax(0, 1fr);

  align-items: start;
  gap: 17px;
  margin-bottom: 19px;
}

.mt-panel {
  min-width: 0;
  padding: 20px;

  border: 1px solid var(--mt-border);
  border-radius: 15px;
  background: var(--mt-surface);

  box-shadow: var(--mt-shadow);
}

.mt-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  margin-bottom: 17px;
}

.mt-heading-with-icon {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

.mt-heading-with-icon > div:last-child {
  min-width: 0;
}

.mt-heading-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 43px;
  height: 43px;

  border-radius: 11px;
  background: #078b61;
  color: #ffffff;
}

.mt-heading-with-icon h2 {
  margin: 0;
  color: var(--mt-heading);
  font-size: 17px;
  font-weight: 900;
  line-height: 1.35;
}

.mt-heading-with-icon small {
  display: block;
  margin-top: 4px;

  color: var(--mt-muted);
  font-size: 10px;
  line-height: 1.5;
}

.mt-week-badge {
  display: inline-flex;
  align-items: center;

  padding: 7px 11px;

  border-radius: 20px;
  background: var(--mt-green-light);
  color: var(--mt-green);

  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

/* =====================================================
   SCHEDULE PANEL
===================================================== */

.mt-schedule-period {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;

  padding: 13px 15px;
  margin-bottom: 7px;

  border: 1px solid var(--mt-border);
  border-radius: 10px;

  background: var(--mt-surface-alt);
  color: var(--mt-green);
}

.mt-schedule-period strong {
  color: var(--mt-heading);
  font-size: 12px;
}

.mt-schedule-list {
  display: grid;
}

.mt-schedule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;

  min-width: 0;
  padding: 19px 2px;

  border-bottom: 1px solid var(--mt-border);
}

.mt-schedule-item:last-child {
  border-bottom: 0;
}

.mt-date-card {
  width: 61px;
  min-width: 61px;
  min-height: 75px;

  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;

  padding: 8px 4px;

  border: 1px solid var(--mt-border);
  border-radius: 10px;

  background: var(--mt-surface-alt);
  text-align: center;
}

.mt-date-card span {
  color: var(--mt-muted);
  font-size: 9px;
  text-transform: uppercase;
}

.mt-date-card strong {
  margin: 2px 0;
  color: var(--mt-green);
  font-size: 22px;
  font-weight: 900;
  line-height: 1.3;
}

.mt-date-card small {
  color: var(--mt-muted);
  font-size: 9px;
  text-transform: uppercase;
}

.mt-activity-symbol {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 45px;
  height: 45px;

  border-radius: 12px;
  background: var(--mt-green-light);
  color: var(--mt-green);
}

.mt-schedule-description {
  flex: 1;
  min-width: 0;
}

.mt-schedule-description h3 {
  margin: 0 0 7px;
  color: var(--mt-heading);
  font-size: 13px;
  font-weight: 900;
  line-height: 1.4;
}

.mt-schedule-description > p {
  margin: 0;
  color: var(--mt-muted);
  font-size: 11px;
  line-height: 1.7;
}

.mt-material {
  margin-top: 9px;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-material summary {
  width: fit-content;
  color: var(--mt-green);
  font-weight: 800;
  cursor: pointer;
}

.mt-material p {
  margin: 8px 0 0;
  line-height: 1.7;
}

.mt-type-badge {
  flex-shrink: 0;
  padding: 6px 9px;

  border-radius: 7px;
  background: #e5f0ff;
  color: #2a6fc5;

  font-size: 9px;
  font-weight: 900;
  white-space: nowrap;
}

.mt-type-badge.practice {
  background: #fff1dd;
  color: #986400;
}

html[data-theme="dark"] .mt-type-badge {
  background: #223b51;
  color: #9bcaff;
}

html[data-theme="dark"] .mt-type-badge.practice {
  background: #45361e;
  color: #f4d18b;
}

/* WEEK NAV */

.mt-calendar-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;

  margin-top: 16px;
}

.mt-calendar-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;

  min-width: 40px;
  min-height: 39px;

  padding: 9px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;

  background: var(--mt-surface-alt);
  color: var(--mt-green);
}

.mt-calendar-actions .mt-calendar-label {
  min-width: 150px;
  gap: 8px;
  padding: 9px 15px;

  font-size: 11px;
  font-weight: 900;
}

.mt-calendar-expanded {
  margin-top: 14px;
  padding: 15px;

  border: 1px solid var(--mt-border);
  border-radius: 11px;

  background: var(--mt-surface-alt);
}

.mt-calendar-expanded > strong {
  display: block;
  margin-bottom: 12px;
  color: var(--mt-heading);
  font-size: 12px;
}

.mt-calendar-expanded > small {
  display: block;
  margin-top: 11px;
  color: var(--mt-muted);
  font-size: 10px;
}

.mt-calendar-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.mt-calendar-grid button {
  min-width: 0;
  min-height: 36px;

  border: 1px solid var(--mt-border);
  border-radius: 7px;

  background: var(--mt-surface);
  color: var(--mt-text);

  font-size: 10px;
  font-weight: 800;
}

.mt-calendar-grid button.active {
  background: #078b61;
  color: #ffffff;
  border-color: #078b61;
}

/* =====================================================
   TARGET MINGGUAN PANEL
===================================================== */

.mt-target-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;

  margin-bottom: 16px;
}

.mt-target-summary > div {
  padding: 15px;

  border: 1px solid var(--mt-border);
  border-radius: 11px;

  background: var(--mt-surface-alt);
}

.mt-target-summary small {
  display: block;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-target-summary strong {
  display: block;
  margin-top: 8px;

  color: var(--mt-green);
  font-size: 26px;
  font-weight: 900;
  line-height: 1.2;
}

.mt-target-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.mt-target-card {
  min-width: 0;
  padding: 15px;

  border: 1px solid var(--mt-border);
  border-radius: 12px;

  background: var(--mt-surface-alt);
}

.mt-target-card-top {
  display: flex;
  align-items: center;
  gap: 9px;

  margin-bottom: 13px;
}

.mt-target-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 36px;
  height: 36px;

  border-radius: 9px;
  background: var(--mt-green-light);
  color: var(--mt-green);
}

.mt-target-card-top > strong {
  flex: 1;
  min-width: 0;

  color: var(--mt-heading);
  font-size: 11px;
  font-weight: 900;
}

.mt-target-card-top > b {
  color: var(--mt-green);
  font-size: 15px;
  white-space: nowrap;
}

.mt-progress {
  width: 100%;
  height: 9px;

  overflow: hidden;
  border-radius: 20px;

  background: var(--mt-progress-bg);
}

.mt-progress > span {
  display: block;
  height: 100%;

  border-radius: inherit;
  background: linear-gradient(
    90deg,
    #21bd87,
    #078b61
  );

  transition: width .2s ease;
}

html[data-theme="dark"] .mt-progress > span {
  background: linear-gradient(
    90deg,
    #18ae79,
    #65e4ab
  );
}

.mt-target-card-bottom {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 5px;

  margin-top: 11px;

  color: var(--mt-text);
  font-size: 10px;
  font-weight: 800;
}

.mt-target-card-bottom span:last-child {
  color: var(--mt-muted);
  font-weight: 500;
}

.mt-target-note {
  display: block;
  margin-top: 9px;

  color: var(--mt-muted);
  font-size: 9px;
}

.mt-target-footnote {
  margin: 15px 0 0;
  padding: 12px 13px;

  border-radius: 9px;
  background: var(--mt-green-light);

  color: var(--mt-green-dark);
  font-size: 10px;
  line-height: 1.7;
}

/* =====================================================
   PARTICIPANT PANEL
===================================================== */

.mt-participant-panel {
  margin-top: 0;
}

.mt-participant-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;

  margin-bottom: 18px;
}

.mt-participant-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.mt-search {
  display: flex;
  align-items: center;
  gap: 9px;

  min-height: 40px;
  padding: 0 12px;

  border: 1px solid var(--mt-border);
  border-radius: 9px;

  background: var(--mt-input);
  color: var(--mt-muted);
}

.mt-search input {
  min-width: 0;
  width: 205px;
  min-height: 38px;

  border: 0;
  outline: 0;

  background: transparent;
  color: var(--mt-text);

  font-size: 11px;
}

.mt-search input::placeholder {
  color: var(--mt-muted);
}

.mt-list-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  min-height: 40px;
  padding: 10px 14px;

  border: 1px solid #078b61;
  border-radius: 9px;

  background: #078b61;
  color: #ffffff;

  font-size: 11px;
  font-weight: 800;
}

.mt-list-button:hover {
  background: #06744f;
}

/* =====================================================
   PARTICIPANT TABLE
===================================================== */

.mt-table-wrap {
  width: 100%;
  overflow-x: auto;
  border: 1px solid var(--mt-border);
  border-radius: 10px;
}

.mt-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;

  color: var(--mt-text);
  font-size: 11px;
  text-align: left;
}

.mt-table th {
  padding: 14px 12px;

  border-bottom: 1px solid var(--mt-border);
  background: var(--mt-surface-alt);

  color: var(--mt-muted);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.mt-table td {
  padding: 14px 12px;

  border-bottom: 1px solid var(--mt-border);

  color: var(--mt-text);
  vertical-align: middle;
}

.mt-table tbody tr:last-child td {
  border-bottom: 0;
}

.mt-table tbody tr:hover {
  background: var(--mt-surface-alt);
}

.mt-name-cell {
  min-width: 150px;
  color: var(--mt-heading) !important;
  font-weight: 900;
}

.mt-site-badge {
  display: inline-block;
  padding: 6px 9px;

  border-radius: 7px;
  background: var(--mt-green-light);

  color: var(--mt-green);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.mt-period-cell {
  min-width: 175px;
  color: var(--mt-muted) !important;
  white-space: nowrap;
}

.mt-table-progress {
  display: flex;
  align-items: center;
  gap: 9px;

  min-width: 115px;
}

.mt-table-progress .mt-progress {
  width: 76px;
  height: 7px;
}

.mt-table-progress strong {
  color: var(--mt-green);
  font-size: 11px;
}

.mt-status-active {
  display: inline-block;
  padding: 6px 10px;

  border-radius: 20px;
  background: #e0f8e9;
  color: #087c52;

  font-size: 10px;
  font-weight: 900;
}

html[data-theme="dark"] .mt-status-active {
  background: #244b39;
  color: #a1efc5;
}

.mt-row-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 6px;
}

.mt-row-actions button {
  min-height: 32px;
  padding: 7px 10px;

  border: 1px solid var(--mt-border);
  border-radius: 7px;

  background: var(--mt-surface-alt);
  color: var(--mt-green);

  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.mt-row-actions button:first-child {
  background: #078b61;
  border-color: #078b61;
  color: #ffffff;
}

.mt-row-actions button:hover {
  filter: brightness(.95);
}

.mt-participant-footer {
  padding-top: 17px;
  color: var(--mt-muted);
  font-size: 11px;
}

.mt-participant-footer strong {
  color: var(--mt-green);
}

/* =====================================================
   MOBILE PARTICIPANT CARDS
===================================================== */

.mt-mobile-participants {
  display: none;
}

.mt-person-card {
  padding: 16px;
  margin-bottom: 12px;

  border: 1px solid var(--mt-border);
  border-radius: 12px;

  background: var(--mt-surface-alt);
}

.mt-person-card-top {
  display: flex;
  align-items: center;
  gap: 10px;

  margin-bottom: 12px;
}

.mt-person-card-top > div {
  min-width: 0;
  flex: 1;
}

.mt-person-card-top strong {
  display: block;
  color: var(--mt-heading);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.mt-person-card-top small {
  display: block;
  margin-top: 4px;

  color: var(--mt-muted);
  font-size: 10px;
}

.mt-person-meta {
  margin: 12px 0;
  color: var(--mt-muted);
  font-size: 10px;
}

.mt-person-progress {
  display: flex;
  justify-content: space-between;
  gap: 10px;

  margin: 13px 0 7px;

  color: var(--mt-text);
  font-size: 11px;
}

.mt-person-progress strong {
  color: var(--mt-green);
}

.mt-mobile-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;

  margin-top: 14px;
}

.mt-mobile-actions button {
  min-height: 38px;
  padding: 9px 10px;

  border: 1px solid var(--mt-border);
  border-radius: 8px;

  background: var(--mt-surface);
  color: var(--mt-green);

  font-size: 11px;
  font-weight: 800;
}

.mt-mobile-actions button:first-child {
  background: #078b61;
  border-color: #078b61;
  color: #ffffff;
}

/* =====================================================
   EMPTY STATES
===================================================== */

.mt-empty {
  padding: 35px 15px !important;
  color: var(--mt-muted) !important;
  font-size: 12px;
  text-align: center;
}

/* =====================================================
   FOOTER
===================================================== */

.mt-footer {
  margin-top: 24px;
  padding: 22px 8px;

  border-top: 1px solid var(--mt-border);

  color: var(--mt-muted);
  font-size: 10px;
  text-align: center;
}

/* =====================================================
   ACCESS SCREENS
===================================================== */

.mt-access {
  min-height: 100vh;
  padding: 24px;

  display: flex;
  align-items: center;
  justify-content: center;

  background: linear-gradient(
    135deg,
    #052e27,
    #064c38
  );

  color: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
}

.mt-access-card {
  width: 100%;
  max-width: 460px;
  padding: 34px 27px;

  border: 1px solid #ffffff2e;
  border-radius: 17px;

  background: #ffffff11;
  text-align: center;

  box-shadow: 0 15px 40px #00000024;
}

.mt-access-logo {
  display: grid;
  place-items: center;

  width: 64px;
  height: 64px;
  margin: 0 auto 19px;

  border-radius: 16px;
  background: #078b61;

  font-size: 23px;
  font-weight: 900;
}

.mt-access-card > svg {
  color: #ffe1a6;
}

.mt-access-card h2 {
  margin: 10px 0;
  color: #ffffff;
  font-size: 22px;
}

.mt-access-card p {
  color: #d5e8de;
  font-size: 12px;
  line-height: 1.8;
}

.mt-access-card button {
  min-height: 40px;
  padding: 10px 15px;
  margin: 8px 4px 0;

  border: 1px solid #c4e8d5;
  border-radius: 9px;

  background: #d9f5e6;
  color: #064730;

  font-size: 11px;
  font-weight: 900;
}

/* =====================================================
   RESPONSIVE — LAPTOP
===================================================== */

@media (max-width: 1400px) {
  .mt-sidebar {
    width: 235px;
  }

  .mt-main {
    margin-left: 235px;
  }

  .mt-content {
    padding: 18px 17px 25px;
  }

  .mt-panel {
    padding: 17px;
  }

  .mt-target-card {
    padding: 12px;
  }

  .mt-main-grid {
    gap: 13px;
  }

  .mt-target-card-top {
    gap: 6px;
  }

  .mt-target-icon {
    width: 32px;
    height: 32px;
  }

  .mt-schedule-item {
    gap: 9px;
  }

  .mt-type-badge {
    font-size: 8px;
  }
}

/* =====================================================
   RESPONSIVE — TABLET
===================================================== */

@media (max-width: 1120px) {
  .mt-main-grid {
    grid-template-columns: 1fr;
  }

  .mt-target-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .mt-toolbar {
    align-items: flex-start;
  }

  .mt-toolbar-actions {
    justify-content: flex-start;
  }

  .mt-schedule-item {
    gap: 12px;
  }
}

@media (max-width: 900px) {
  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mt-hero-user {
    max-width: 210px;
  }

  .mt-hero h1 {
    font-size: 25px;
  }
}

/* =====================================================
   RESPONSIVE — MOBILE
===================================================== */

@media (max-width: 760px) {
  .mt-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;

    width: 275px;
    transform: translateX(-105%);
    transition: transform .2s ease;

    z-index: 55;
  }

  .mt-sidebar.open {
    transform: translateX(0);
  }

  .mt-overlay {
    display: block;

    position: fixed;
    inset: 0;
    z-index: 54;

    width: 100%;
    height: 100%;

    border: 0;
    background: rgba(0, 20, 17, .65);
  }

  .mt-main {
    margin-left: 0;
    width: 100%;
  }

  .mt-mobile-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    min-height: 58px;
    padding: 11px 15px;

    background: #06392e;
    color: #ffffff;
  }

  .mt-mobile-header strong {
    font-size: 18px;
    font-weight: 900;
  }

  .mt-mobile-header strong span {
    color: #53e7a5;
  }

  .mt-mobile-header button {
    display: grid;
    place-items: center;

    width: 37px;
    height: 37px;

    border: 0;
    background: transparent;
    color: #ffffff;
  }

  .mt-hero {
    flex-wrap: wrap;
    min-height: auto;
    gap: 15px;
    padding: 22px 16px;
  }

  .mt-hero h1 {
    font-size: 24px;
  }

  .mt-hero-copy > small {
    font-size: 9px;
  }

  .mt-hero-copy > p {
    font-size: 11px;
  }

  .mt-values {
    margin-top: 14px;
    gap: 12px;
  }

  .mt-values span {
    font-size: 9px;
  }

  .mt-hero-user {
    max-width: 100%;
  }

  .mt-content {
    padding: 14px 11px 24px;
  }

  .mt-toolbar {
    display: block;
  }

  .mt-toolbar-copy {
    margin-bottom: 14px;
  }

  .mt-toolbar-copy h2 {
    font-size: 19px;
  }

  .mt-toolbar-actions {
    justify-content: flex-start;
    gap: 8px;
  }

  .mt-theme-button {
    flex: 1 1 140px;
  }

  .mt-select-control {
    flex: 1 1 120px;
  }

  .mt-select-control select {
    flex: 1;
    min-width: 0;
    max-width: none;
  }

  .mt-refresh-button {
    flex: 1 1 100px;
  }

  .mt-main-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    margin-bottom: 13px;
  }

  .mt-panel {
    padding: 15px;
    border-radius: 12px;
  }

  .mt-heading-with-icon h2 {
    font-size: 16px;
  }

  .mt-heading-icon {
    width: 39px;
    height: 39px;
  }

  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
  }

  .mt-target-summary {
    gap: 9px;
  }

  .mt-target-summary strong {
    font-size: 22px;
  }

  .mt-target-card {
    padding: 11px;
  }

  .mt-target-card-top {
    flex-wrap: wrap;
    gap: 7px;
  }

  .mt-target-card-top > strong {
    font-size: 10px;
  }

  .mt-target-card-top > b {
    font-size: 13px;
  }

  .mt-schedule-item {
    gap: 10px;
    padding: 15px 0;
  }

  .mt-date-card {
    width: 52px;
    min-width: 52px;
    min-height: 67px;
  }

  .mt-date-card strong {
    font-size: 19px;
  }

  .mt-activity-symbol {
    width: 37px;
    height: 37px;
  }

  .mt-activity-symbol svg {
    width: 23px;
    height: 23px;
  }

  .mt-schedule-description h3 {
    font-size: 12px;
  }

  .mt-schedule-description > p {
    font-size: 10px;
  }

  .mt-type-badge {
    padding: 5px 7px;
  }

  .mt-participant-header {
    display: block;
  }

  .mt-participant-actions {
    margin-top: 15px;
  }

  .mt-search {
    flex: 1 1 100%;
  }

  .mt-search input {
    width: 100%;
  }

  .mt-list-button {
    flex: 1 1 100%;
    justify-content: center;
  }

  .mt-table-wrap {
    display: none;
  }

  .mt-mobile-participants {
    display: block;
  }

  .mt-participant-footer {
    padding-top: 10px;
  }
}

/* =====================================================
   SMALL MOBILE
===================================================== */

@media (max-width: 440px) {
  .mt-hero h1 {
    font-size: 22px;
  }

  .mt-values {
    gap: 9px;
  }

  .mt-values span {
    font-size: 8px;
  }

  .mt-panel {
    padding: 12px;
  }

  .mt-panel-heading {
    gap: 9px;
  }

  .mt-week-badge {
    padding: 6px 9px;
    font-size: 10px;
  }

  .mt-heading-with-icon {
    gap: 8px;
  }

  .mt-heading-with-icon h2 {
    font-size: 14px;
  }

  .mt-heading-with-icon small {
    font-size: 9px;
  }

  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
  }

  .mt-target-card {
    padding: 9px;
  }

  .mt-target-icon {
    width: 29px;
    height: 29px;
  }

  .mt-target-card-top > strong {
    font-size: 9px;
  }

  .mt-target-card-bottom {
    font-size: 9px;
  }

  .mt-target-note {
    font-size: 8px;
  }

  .mt-schedule-item {
    display: grid;
    grid-template-columns: 48px 34px minmax(0,1fr);
    gap: 8px;
  }

  .mt-date-card {
    width: 48px;
    min-width: 48px;
    min-height: 60px;
  }

  .mt-date-card strong {
    font-size: 17px;
  }

  .mt-activity-symbol {
    width: 34px;
    height: 34px;
  }

  .mt-schedule-description {
    min-width: 0;
  }

  .mt-type-badge {
    grid-column: 3;
    width: fit-content;
    margin-top: -2px;
  }

  .mt-calendar-grid {
    gap: 5px;
  }

  .mt-calendar-grid button {
    min-height: 33px;
    font-size: 9px;
  }

  .mt-person-card {
    padding: 12px;
  }

  .mt-person-card-top {
    flex-wrap: wrap;
  }

  .mt-person-card-top > .mt-status-active {
    margin-left: auto;
  }

  .mt-mobile-actions {
    gap: 6px;
  }

  .mt-mobile-actions button {
    font-size: 10px;
  }
}

/* =====================================================
   PRINT
===================================================== */

@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  html,
  body {
    background: #ffffff !important;
  }

  .mt-shell,
  html[data-theme="dark"] .mt-shell {
    color-scheme: light;
    --mt-bg: #ffffff;
    --mt-surface: #ffffff;
    --mt-surface-alt: #f4f7f5;
    --mt-text: #172d25;
    --mt-heading: #102c22;
    --mt-muted: #576e63;
    --mt-border: #d5dfd9;
    --mt-green: #087c53;
    --mt-green-light: #e2f4e9;
    --mt-progress-bg: #dce9e1;
    --mt-shadow: none;

    background: #ffffff !important;
    color: #172d25 !important;
  }

  .mt-sidebar,
  .mt-overlay,
  .mt-mobile-header,
  .mt-toolbar-actions,
  .mt-calendar-actions,
  .mt-calendar-expanded,
  .mt-participant-actions,
  .mt-row-actions,
  .mt-mobile-actions,
  .mt-footer {
    display: none !important;
  }

  .mt-main {
    margin-left: 0 !important;
    background: #ffffff !important;
  }

  .mt-content {
    padding: 0;
    max-width: none;
  }

  .mt-hero {
    min-height: 130px;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-main-grid {
    grid-template-columns: 1fr 1fr;
  }

  .mt-panel {
    box-shadow: none !important;
    break-inside: avoid;
  }

  .mt-target-grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }

  .mt-target-card,
  .mt-progress,
  .mt-date-card,
  .mt-week-badge,
  .mt-status-active {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-table-wrap {
    display: block !important;
    overflow: visible;
  }

  .mt-table {
    min-width: 0;
    font-size: 9px;
  }

  .mt-table th,
  .mt-table td {
    padding: 8px;
  }

  .mt-mobile-participants {
    display: none !important;
  }
}

/* =====================================================
   REDUCED MOTION
===================================================== */

@media (prefers-reduced-motion: reduce) {
  .mt-sidebar,
  .mt-progress > span {
    transition: none;
  }
}

`;
