
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0 — DASHBOARD PESERTA
//
// PERBAIKAN:
// 1. Dashboard selalu mengikuti minggu berjalan (WITA).
// 2. Jadwal Kegiatan memiliki pilihan Week tersendiri.
// 3. Mengubah Week Jadwal tidak mengubah Dashboard.
// 4. Dashboard diperbarui saat tanggal/minggu berganti.
// 5. Tidak mengubah rumus Achievement, SIMPER, dan akses.
// ======================================================

const TOTAL_WEEKS = 25;
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const TARGETS = [
  { name: "Fisik", target: 25, icon: "run" },
  { name: "Training", target: 4, icon: "training" },
  { name: "Sosialisasi", target: 3, icon: "users" },
  { name: "Coaching", target: 1, icon: "message" },
  { name: "Orientasi Area", target: 2, icon: "compass" },
  { name: "Hazard", target: 2, icon: "warning" },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

// ======================================================
// JADWAL KEGIATAN
// Sementara menggunakan agenda Week 08.
// Agenda minggu lainnya belum diisi agar tidak fiktif.
// ======================================================

const WEEKLY_SCHEDULE = [
  {
    id: "w08-navigation",
    week: 8,
    start: "2026-11-03",
    end: "2026-11-03",
    type: "Post-Test",
    title: "Post Test Navigasi Darat",
    description:
      "Evaluasi kompas, pembacaan peta, penentuan arah, dan koordinat.",
    icon: "compass",
  },
  {
    id: "w08-water",
    week: 8,
    start: "2026-11-05",
    end: "2026-11-05",
    type: "Post-Test",
    title: "Post Test Water Rescue",
    description:
      "Evaluasi keselamatan perairan, penyelamatan korban, dan penggunaan peralatan rescue.",
    icon: "water",
  },
  {
    id: "w08-tog",
    week: 8,
    start: "2026-11-01",
    end: "2026-11-07",
    type: "Praktik",
    title: "Praktik Donning & Doffing TOG",
    description:
      "Praktik penggunaan dan pelepasan Turnout Gear sesuai prosedur. Waktu pelaksanaan menyesuaikan jadwal site.",
    icon: "vest",
  },
];

// ======================================================
// UTILITIES
// ======================================================

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeType(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return ["participant", "peserta"].includes(
    normalize(role)
  );
}

function initials(value) {
  return (
    String(value || "Peserta")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "P"
  );
}

function parseDate(value) {
  const text = String(value ?? "").slice(0, 10);

  const match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

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

function addDays(value, count) {
  const date = parseDate(value);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + count);

  return date.toISOString().slice(0, 10);
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

function shortDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function dayName(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    weekday: "short",
    timeZone: "UTC",
  });
}

// ======================================================
// TANGGAL WITA
// Tidak memakai tanggal UTC agar pergantian minggu
// sesuai waktu Indonesia Tengah.
// ======================================================

function todayWITA() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)
      ?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

// ======================================================
// KALENDER GLOBAL OJT
// Week 01 = 12–18 September 2026
// Week 02 = 20–26 September 2026
// Week 25 = 28 Februari–6 Maret 2027
// ======================================================

function getGlobalWeek(number) {
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > TOTAL_WEEKS
  ) {
    return null;
  }

  if (number === 1) {
    return {
      number: 1,
      start: "2026-09-12",
      end: "2026-09-18",
    };
  }

  const start = addDays(
    "2026-09-20",
    (number - 2) * 7
  );

  return {
    number,
    start,
    end: addDays(start, 6),
  };
}

function globalWeekOf(value) {
  const date = String(value || "").slice(0, 10);

  if (!parseDate(date)) return null;

  for (let number = 1; number <= TOTAL_WEEKS; number++) {
    const week = getGlobalWeek(number);

    if (
      date >= week.start &&
      date <= week.end
    ) {
      return number;
    }
  }

  return null;
}

function getCurrentGlobalWeek() {
  const today = todayWITA();
  const matched = globalWeekOf(today);

  if (matched !== null) {
    return matched;
  }

  // Di luar tanggal program, tampilkan batas program.
  if (today < "2026-09-12") return 1;
  if (today > "2027-03-06") return TOTAL_WEEKS;

  // 19 September 2026 adalah jeda antara Week 01 dan 02.
  return 1;
}

// ======================================================
// RUMUS MINGGU PROGRAM ASLI
// Berdasarkan start_date masing-masing program.
// ======================================================

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) /
      86400000
  );

  if (days < 0) return null;

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function clamp(value) {
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
}

function scoreText(value) {
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
    maximumFractionDigits: 2,
  });
}

function averageScores(rows) {
  const values = rows
    .map((item) => item.score)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function emptyProgress() {
  return {
    achievement: 0,
    completedCategories: 0,
    categories: [],
    activityWeeks: 0,
    activityPercent: 0,
    simper: 0,
    simperCompleted: 0,
    simperIssued: false,
  };
}

function emptyWeeklyData() {
  return {
    achievements: [],
    postTests: [],
    practices: [],
    samapta: [],
  };
}

// ======================================================
// ACHIEVEMENT — RUMUS TETAP
// ======================================================

function calculateAchievements(
  records,
  types,
  startDate
) {
  const codes = new Map(
    types.map((type) => [
      normalizeType(type.name),
      normalizeType(type.code),
    ])
  );

  const verified = records.filter(
    (record) =>
      normalize(record.status) === "verified" &&
      weekOf(
        record.activity_date,
        startDate
      ) !== null
  );

  const categories = TARGETS.map((target) => {
    const code = codes.get(
      normalizeType(target.name)
    );

    const matching = code
      ? verified.filter(
          (record) =>
            normalizeType(record.type_code) ===
            code
        )
      : [];

    let amount = 0;

    if (target.name === "Fisik") {
      amount = matching.reduce((sum, record) => {
        const km = Number(record.distance_km);

        return (
          sum +
          (Number.isFinite(km) && km > 0
            ? km
            : 0)
        );
      }, 0);
    } else {
      amount = matching.length;
    }

    return {
      ...target,
      amount,
      progress: clamp(
        (amount / target.target) * 100
      ),
      completed: amount >= target.target,
    };
  });

  const total = categories.reduce(
    (sum, category) => sum + category.progress,
    0
  );

  return {
    progress: Math.round(
      total / TARGETS.length
    ),
    completed: categories.filter(
      (item) => item.completed
    ).length,
    categories,
  };
}

// ======================================================
// SIMPER V2 — RUMUS TETAP
// ======================================================

function parseSimperMetadata(notes) {
  const text = String(notes || "");

  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) return null;

  try {
    const data = JSON.parse(
      text.slice(
        start + META_START.length,
        end
      )
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
      issued: false,
    };
  }

  const meta = parseSimperMetadata(
    record.notes
  );

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
    issued:
      meta?.issuance_status === "issued",
  };
}

// ======================================================
// RINGKASAN PROGRAM — RUMUS TETAP
// ======================================================

function buildProgress(program, data) {
  const achievement = calculateAchievements(
    data.achievements,
    data.types,
    program.start_date
  );

  const selectedSimper =
    data.simper.find((record) =>
      parseSimperMetadata(record.notes)
    ) ||
    data.simper[0] ||
    null;

  const simper = calculateSimper(
    selectedSimper
  );

  const weeks = new Set();

  function markWeek(date) {
    const week = weekOf(
      date,
      program.start_date
    );

    if (week !== null) {
      weeks.add(week);
    }
  }

  data.achievements.forEach((record) =>
    markWeek(record.activity_date)
  );

  data.postTests.forEach((record) =>
    markWeek(record.test_date)
  );

  data.practices.forEach((record) =>
    markWeek(record.practice_date)
  );

  data.samapta.forEach((record) =>
    markWeek(record.test_date)
  );

  return {
    achievement: achievement.progress,
    completedCategories:
      achievement.completed,
    categories: achievement.categories,
    activityWeeks: weeks.size,
    activityPercent: Math.round(
      (weeks.size / TOTAL_WEEKS) * 100
    ),
    simper: simper.progress,
    simperCompleted: simper.completed,
    simperIssued: simper.issued,
  };
}

function getStatusInfo(access) {
  const statuses = {
    pending: "Menunggu Persetujuan Mentor",
    rejected: "Pengajuan Ditolak",
    approved: "Program OJT Aktif",
    no_program: "Belum Ada Program",
    error: "Terjadi Kesalahan",
  };

  return statuses[access] || "Memuat...";
}

// ======================================================
// ICON
// ======================================================

function Icon({ name, size = 20 }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9M9 21v-8h6v8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    chart: (
      <>
        <path d="M3 21h18M6 17v-5M12 17V7M18 17V3" />
      </>
    ),
    trophy: (
      <>
        <path d="M7 3h10v7a5 5 0 0 1-10 0V3Z" />
        <path d="M7 5H4v3a4 4 0 0 0 4 4M17 5h3v3a4 4 0 0 1-4 4" />
        <path d="M12 15v5M8 21h8" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l5 5v15H6z" />
        <path d="M14 2v5h5M9 12h7M9 16h7" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20v-2a7 7 0 0 1 14 0v2" />
        <path d="M17 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: (
      <path d="M5 12h14m-6-6 6 6-6 6" />
    ),
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
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
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15 9-2 5-4 1 2-5 4-1Z" />
      </>
    ),
    water: (
      <>
        <path d="M2 8c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />
        <path d="M2 14c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />
        <path d="M2 20c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />
      </>
    ),
    vest: (
      <>
        <path d="m8 3 4 3 4-3 4 4v14H4V7l4-4Z" />
        <path d="M8 3v18M16 3v18M4 13h16" />
      </>
    ),
    run: (
      <>
        <circle cx="15" cy="4" r="2" />
        <path d="m7 21 4-6 2-4-4-2-3 3M11 15l6 2 3 4M13 11l4-2 3 1" />
      </>
    ),
    training: (
      <>
        <path d="M3 9v6M21 9v6M6 7v10M18 7v10M6 12h12" />
      </>
    ),
    message: (
      <path d="M4 4h16v12H9l-5 4V4Z" />
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}

// ======================================================
// COMPONENTS
// ======================================================

function ProgressBar({ value }) {
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

function WeekSelector({
  week,
  onChange,
  weeksWithData,
}) {
  return (
    <div className="mt-week-nav">
      <button
        type="button"
        disabled={week <= 1}
        onClick={() => onChange(week - 1)}
        aria-label="Minggu sebelumnya"
      >
        <Icon name="left" size={17} />
      </button>

      <select
        value={week}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        aria-label="Pilih minggu OJT"
      >
        {Array.from(
          { length: TOTAL_WEEKS },
          (_, index) => index + 1
        ).map((number) => (
          <option key={number} value={number}>
            Week {String(number).padStart(2, "0")}
            {weeksWithData.has(number)
              ? " · Ada catatan"
              : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={week >= TOTAL_WEEKS}
        onClick={() => onChange(week + 1)}
        aria-label="Minggu berikutnya"
      >
        <Icon name="right" size={17} />
      </button>
    </div>
  );
}

function ActivityItem({ activity }) {
  const isRange = activity.start !== activity.end;

  return (
    <div className="mt-activity">
      <div
        className={
          "mt-date-block " +
          (activity.type === "Praktik"
            ? "practice"
            : activity.icon === "water"
            ? "orange"
            : "")
        }
      >
        <small>
          {isRange
            ? "PERIODE"
            : dayName(activity.start).toUpperCase()}
        </small>

        <strong>
          {isRange
            ? `${activity.start.slice(8)}–${activity.end.slice(8)}`
            : activity.start.slice(8)}
        </strong>

        <span>
          {parseDate(activity.start)
            ?.toLocaleDateString("id-ID", {
              month: "short",
              timeZone: "UTC",
            })
            .toUpperCase() || "—"}
        </span>
      </div>

      <span className="mt-activity-icon">
        <Icon name={activity.icon} size={27} />
      </span>

      <div className="mt-activity-content">
        <strong>{activity.title}</strong>
        <p>{activity.description}</p>
      </div>

      <span
        className={
          "mt-activity-type " +
          (activity.type === "Praktik"
            ? "practice"
            : activity.icon === "water"
            ? "orange"
            : "")
        }
      >
        {activity.type}
      </span>
    </div>
  );
}

function CategoryCard({ category }) {
  return (
    <div className="mt-category-card">
      <div className="mt-category-heading">
        <Icon name={category.icon} size={23} />
        <strong>{category.name}</strong>
      </div>

      <div className="mt-category-value">
        {Math.round(category.progress)}%
      </div>

      <ProgressBar value={category.progress} />
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="mt-empty">
      <Icon name="info" size={23} />
      <p>{children}</p>
    </div>
  );
}

// ======================================================
// COMPONENT UTAMA
// ======================================================

export default function DashboardPeserta() {
  const router = useRouter();

  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [
    selectedParticipantId,
    setSelectedParticipantId,
  ] = useState("");

  const [access, setAccess] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [error, setError] = useState("");
  const [progress, setProgress] =
    useState(emptyProgress());

  const [weeklyData, setWeeklyData] =
    useState(emptyWeeklyData());

  // ====================================================
  // PERBAIKAN UTAMA
  //
  // currentWeek:
  //   Khusus Dashboard Awal.
  //   Otomatis mengikuti tanggal hari ini.
  //
  // selectedWeek:
  //   Pilihan manual pada Jadwal, Monitoring, Evaluasi.
  //   Tidak boleh mengubah currentWeek.
  // ====================================================

  const [currentWeek, setCurrentWeek] =
    useState(1);

  const [selectedWeek, setSelectedWeek] =
    useState(1);

  const [page, setPage] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [resultTab, setResultTab] =
    useState("posttest");

  const [reportTab, setReportTab] =
    useState("evaluasi");

  const requestIdRef = useRef(0);
  const selectedIdRef = useRef("");
  const currentWeekRef = useRef(1);

  const isAdmin =
    normalize(account?.role) === "admin";

  const hasActiveProgram =
    access === "approved" &&
    Boolean(program?.id) &&
    Boolean(profile);

  const isAdminEmptyView = isAdmin && !profile;

  // ====================================================
  // OTOMATISASI MINGGU BERJALAN
  //
  // - Saat halaman pertama dibuka
  // - Saat tab kembali aktif
  // - Saat browser kembali fokus
  // - Pemeriksaan berkala setiap menit
  //
  // Tidak mengubah pilihan selectedWeek kecuali
  // saat pertama kali masuk halaman.
  // ====================================================

  useEffect(() => {
    const initialWeek = getCurrentGlobalWeek();

    currentWeekRef.current = initialWeek;
    setCurrentWeek(initialWeek);
    setSelectedWeek(initialWeek);

    const syncCurrentWeek = () => {
      const latest = getCurrentGlobalWeek();

      if (latest !== currentWeekRef.current) {
        currentWeekRef.current = latest;
        setCurrentWeek(latest);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncCurrentWeek();
      }
    };

    window.addEventListener("focus", syncCurrentWeek);

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    const interval = window.setInterval(
      syncCurrentWeek,
      60000
    );

    return () => {
      window.removeEventListener(
        "focus",
        syncCurrentWeek
      );

      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );

      window.clearInterval(interval);
    };
  }, []);

  // ====================================================
  // DATA PESERTA UNTUK ADMIN PREVIEW
  // ====================================================

  async function fetchParticipantList() {
    const { data, error: listError } = await supabase
      .from("ojt_programs")
      .select(`
        participant_id,
        site,
        peserta:profiles!ojt_programs_participant_id_fkey(
          id,
          full_name,
          department,
          role
        )
      `)
      .eq("status", "active");

    if (listError) throw listError;

    const unique = new Map();

    (data || []).forEach((item) => {
      if (!item.participant_id) return;

      const peserta = Array.isArray(item.peserta)
        ? item.peserta[0]
        : item.peserta;

      if (
        !peserta ||
        !isParticipantRole(peserta.role)
      ) {
        return;
      }

      if (!unique.has(item.participant_id)) {
        unique.set(item.participant_id, {
          id: item.participant_id,
          full_name:
            peserta.full_name || "Peserta OJT",
          department: peserta.department || "",
          site: item.site || "",
          role: normalize(peserta.role),
        });
      }
    });

    return [...unique.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }

  // ====================================================
  // AMBIL DATA PROGRES
  // ====================================================

  async function fetchProgramProgress(activeProgram) {
    if (!activeProgram?.id) {
      return {
        progress: emptyProgress(),
        weekly: emptyWeeklyData(),
      };
    }

    const id = activeProgram.id;

    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,status,activity_date,distance_km"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select(
          "id,program_id,test_date,score,notes"
        )
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,program_id,practice_date,score"
        )
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,program_id,test_date"
        )
        .eq("program_id", id),

      supabase
        .from("simper_records")
        .select(
          "id,program_id,theory_status,practice_status,status,notes"
        )
        .eq("program_id", id),
    ]);

    const labels = [
      "Kategori Achievement",
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

    const data = {
      types: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practices: results[3].data || [],
      samapta: results[4].data || [],
      simper: results[5].data || [],
    };

    return {
      progress: buildProgress(
        activeProgram,
        data
      ),
      weekly: {
        achievements: data.achievements,
        postTests: data.postTests,
        practices: data.practices,
        samapta: data.samapta,
      },
    };
  }

  // ====================================================
  // DATA PESERTA DAN PERSETUJUAN
  // ====================================================

  async function fetchParticipantDashboard(
    participantId,
    adminPreview = false,
    previewParticipants = []
  ) {
    let currentProfile = null;

    if (adminPreview) {
      const selected = previewParticipants.find(
        (item) =>
          item.id === participantId &&
          isParticipantRole(item.role)
      );

      if (!selected) {
        throw new Error(
          "Peserta tidak tersedia dalam daftar preview."
        );
      }

      currentProfile = {
        id: selected.id,
        full_name: selected.full_name,
        department: selected.department,
        role: selected.role,
      };
    } else {
      const {
        data,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,department,role")
        .eq("id", participantId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        throw new Error(
          "Profil peserta tidak tersedia."
        );
      }

      if (!isParticipantRole(data.role)) {
        throw new Error(
          "Akun tidak terdaftar sebagai Peserta OJT."
        );
      }

      currentProfile = data;
    }

    const {
      data: activePrograms,
      error: programError,
    } = await supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        start_date,
        end_date,
        status,
        site,
        legacy_access
      `)
      .eq("participant_id", participantId)
      .eq("status", "active")
      .order("start_date", {
        ascending: false,
      })
      .limit(1);

    if (programError) throw programError;

    const activeProgram =
      activePrograms?.[0] || null;

    if (adminPreview) {
      const bundle = activeProgram
        ? await fetchProgramProgress(activeProgram)
        : {
            progress: emptyProgress(),
            weekly: emptyWeeklyData(),
          };

      return {
        profile: currentProfile,
        registration: null,
        program: activeProgram,
        access: activeProgram
          ? "approved"
          : "no_program",
        progress: bundle.progress,
        weekly: bundle.weekly,
      };
    }

    const {
      data: newRequests,
      error: newError,
    } = await supabase
      .from("ojt_registration_requests")
      .select(`
        id,
        status,
        rejection_reason,
        site,
        start_date,
        end_date,
        created_at
      `)
      .eq("participant_id", participantId)
      .order("created_at", {
        ascending: false,
      });

    if (newError) throw newError;

    const {
      data: oldRequests,
      error: oldError,
    } = await supabase
      .from("participant_registrations")
      .select(`
        id,
        status,
        rejection_reason,
        site,
        created_at
      `)
      .eq("user_id", participantId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (oldError) throw oldError;

    const newList = newRequests || [];
    const oldRegistration = oldRequests?.[0] || null;
    const latestNew = newList[0] || null;

    const latestRegistration =
      latestNew && oldRegistration
        ? new Date(latestNew.created_at || 0) >=
          new Date(oldRegistration.created_at || 0)
          ? latestNew
          : oldRegistration
        : latestNew || oldRegistration;

    const hasPendingNew = newList.some(
      (item) =>
        normalize(item.status) === "pending"
    );

    const hasApprovedNew = newList.some(
      (item) =>
        normalize(item.status) === "approved"
    );

    const hasApprovedOld =
      normalize(oldRegistration?.status) ===
      "approved";

    const hasPendingOld =
      normalize(oldRegistration?.status) ===
      "pending";

    const approvedProgram =
      Boolean(activeProgram) &&
      (
        hasApprovedNew ||
        hasApprovedOld ||
        activeProgram.legacy_access === true
      );

    let nextAccess = "no_program";

    if (approvedProgram) {
      nextAccess = "approved";
    } else if (
      hasPendingNew ||
      hasPendingOld
    ) {
      nextAccess = "pending";
    } else if (
      normalize(latestRegistration?.status) ===
      "rejected"
    ) {
      nextAccess = "rejected";
    }

    const bundle =
      nextAccess === "approved"
        ? await fetchProgramProgress(activeProgram)
        : {
            progress: emptyProgress(),
            weekly: emptyWeeklyData(),
          };

    return {
      profile: currentProfile,
      registration:
        latestRegistration || null,
      program:
        nextAccess === "approved"
          ? activeProgram
          : null,
      access: nextAccess,
      progress: bundle.progress,
      weekly: bundle.weekly,
    };
  }

  function clearDashboard() {
    setProfile(null);
    setProgram(null);
    setRegistration(null);
    setProgress(emptyProgress());
    setWeeklyData(emptyWeeklyData());
    setAccess("loading");
  }

  function applyDashboard(data) {
    setProfile(data.profile);
    setRegistration(data.registration);
    setProgram(data.program);
    setProgress(
      data.progress || emptyProgress()
    );
    setWeeklyData(
      data.weekly || emptyWeeklyData()
    );
    setAccess(data.access);
  }

  // ====================================================
  // LOAD DASHBOARD
  // ====================================================

  async function loadDashboard(
    isRefresh = false,
    requestedParticipantId = null
  ) {
    // Perbarui minggu otomatis ketika refresh,
    // tanpa mengubah selectedWeek pengguna.
    const latestWeek = getCurrentGlobalWeek();
    currentWeekRef.current = latestWeek;
    setCurrentWeek(latestWeek);

    const requestId = ++requestIdRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      clearDashboard();
    }

    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (authError || !user) {
        setAccount(null);
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";
        clearDashboard();

        router.replace("/login");
        return;
      }

      const {
        data: currentAccount,
        error: accountError,
      } = await supabase
        .from("profiles")
        .select(
          "id,full_name,department,role"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (accountError) throw accountError;

      if (!currentAccount) {
        throw new Error(
          "Profil akun tidak tersedia."
        );
      }

      const role = normalize(
        currentAccount.role
      );

      if (role === "mentor") {
        setAccount(null);
        clearDashboard();
        router.replace("/");
        return;
      }

      if (
        role !== "admin" &&
        !isParticipantRole(role)
      ) {
        throw new Error(
          "Akun tidak memiliki akses Dashboard Peserta."
        );
      }

      setAccount({
        ...currentAccount,
        role,
        email: user.email || "",
      });

      if (role === "admin") {
        const list = await fetchParticipantList();

        if (requestId !== requestIdRef.current) {
          return;
        }

        setParticipants(list);

        if (!list.length) {
          selectedIdRef.current = "";
          setSelectedParticipantId("");
          setProfile(null);
          setRegistration(null);
          setProgram(null);
          setProgress(emptyProgress());
          setWeeklyData(emptyWeeklyData());
          setAccess("no_program");
          return;
        }

        const requestedId =
          requestedParticipantId ??
          selectedIdRef.current;

        if (requestedId === "") {
          selectedIdRef.current = "";
          setSelectedParticipantId("");
          setProfile(null);
          setRegistration(null);
          setProgram(null);
          setProgress(emptyProgress());
          setWeeklyData(emptyWeeklyData());
          setAccess("no_program");
          return;
        }

        const validSelection = list.some(
          (item) => item.id === requestedId
        );

        const targetId = validSelection
          ? requestedId
          : list[0].id;

        selectedIdRef.current = targetId;
        setSelectedParticipantId(targetId);

        const next =
          await fetchParticipantDashboard(
            targetId,
            true,
            list
          );

        if (requestId !== requestIdRef.current) {
          return;
        }

        applyDashboard(next);
      } else {
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";

        const next =
          await fetchParticipantDashboard(
            user.id,
            false
          );

        if (requestId !== requestIdRef.current) {
          return;
        }

        applyDashboard(next);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      clearDashboard();

      setError(
        err?.message ||
          "Gagal memuat Dashboard Peserta."
      );

      setAccess("error");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();

    return () => {
      requestIdRef.current += 1;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====================================================
  // PREVIEW ADMIN
  // ====================================================

  async function changePreviewParticipant(id) {
    if (!isAdmin || loading || refreshing) {
      return;
    }

    const requestId = ++requestIdRef.current;

    selectedIdRef.current = id;
    setSelectedParticipantId(id);
    setRefreshing(true);
    setError("");
    clearDashboard();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const {
        data: verifiedAccount,
        error: accountError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (accountError) throw accountError;

      if (
        normalize(verifiedAccount?.role) !==
        "admin"
      ) {
        throw new Error(
          "Hanya Admin yang dapat menggunakan tinjauan peserta."
        );
      }

      if (!id) {
        setProfile(null);
        setRegistration(null);
        setProgram(null);
        setProgress(emptyProgress());
        setWeeklyData(emptyWeeklyData());
        setAccess("no_program");
        return;
      }

      const selected = participants.find(
        (item) =>
          item.id === id &&
          isParticipantRole(item.role)
      );

      if (!selected) {
        throw new Error(
          "Peserta tidak ditemukan."
        );
      }

      const next =
        await fetchParticipantDashboard(
          id,
          true,
          participants
        );

      if (requestId !== requestIdRef.current) {
        return;
      }

      applyDashboard(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      clearDashboard();

      setError(
        err?.message ||
          "Gagal mengganti peserta tinjauan."
      );

      setAccess("error");
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    requestIdRef.current += 1;

    try {
      const {
        error: logoutError,
      } = await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      setAccount(null);
      setParticipants([]);
      setSelectedParticipantId("");
      selectedIdRef.current = "";
      clearDashboard();

      router.replace("/login");
      router.refresh();
    } catch {
      setError(
        "Gagal keluar. Silakan coba kembali."
      );
      setLoggingOut(false);
    }
  }

  // ====================================================
  // NAVIGASI
  // ====================================================

  function navigatePage(nextPage) {
    if (nextPage === "dashboard") {
      // Dashboard selalu kembali menggunakan
      // tanggal WITA terbaru, bukan selectedWeek.
      const latestWeek = getCurrentGlobalWeek();

      currentWeekRef.current = latestWeek;
      setCurrentWeek(latestWeek);
    }

    setPage(nextPage);
    setMobileMenu(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function openFeature(path) {
    if (!hasActiveProgram || !path) return;
    router.push(path);
  }

  // ====================================================
  // PEMISAHAN DATA WEEK
  // ====================================================

  // A. DASHBOARD OTOMATIS
  const dashboardWeekInfo =
    getGlobalWeek(currentWeek);

  const dashboardSchedule =
    WEEKLY_SCHEDULE.filter(
      (item) => item.week === currentWeek
    );

  // B. HALAMAN JADWAL MANUAL
  const selectedWeekInfo =
    getGlobalWeek(selectedWeek);

  const selectedSchedule =
    WEEKLY_SCHEDULE.filter(
      (item) => item.week === selectedWeek
    );

  // ====================================================
  // DATA PER MINGGU (GLOBAL)
  // ====================================================

  function getWeekRecords(weekNumber) {
    const achievements =
      weeklyData.achievements.filter(
        (item) =>
          globalWeekOf(item.activity_date) ===
          weekNumber
      );

    const postTests =
      weeklyData.postTests.filter(
        (item) =>
          globalWeekOf(item.test_date) ===
          weekNumber
      );

    const practices =
      weeklyData.practices.filter(
        (item) =>
          globalWeekOf(item.practice_date) ===
          weekNumber
      );

    const samapta =
      weeklyData.samapta.filter(
        (item) =>
          globalWeekOf(item.test_date) ===
          weekNumber
      );

    return {
      achievements,
      postTests,
      practices,
      samapta,
      total:
        achievements.length +
        postTests.length +
        practices.length +
        samapta.length,
      verifiedAchievements:
        achievements.filter(
          (item) =>
            normalize(item.status) ===
            "verified"
        ).length,
      average: averageScores([
        ...postTests,
        ...practices,
      ]),
    };
  }

  // Data khusus dashboard awal.
  // Hanya berubah saat currentWeek berubah.
  const dashboardWeekly =
    getWeekRecords(currentWeek);

  // Data halaman yang menggunakan selectedWeek.
  const selectedWeekly =
    getWeekRecords(selectedWeek);

  const weeksWithData = new Set();

  if (hasActiveProgram) {
    const markGlobal = (date) => {
      const number = globalWeekOf(date);

      if (number !== null) {
        weeksWithData.add(number);
      }
    };

    weeklyData.achievements.forEach(
      (item) => markGlobal(item.activity_date)
    );

    weeklyData.postTests.forEach(
      (item) => markGlobal(item.test_date)
    );

    weeklyData.practices.forEach(
      (item) => markGlobal(item.practice_date)
    );

    weeklyData.samapta.forEach(
      (item) => markGlobal(item.test_date)
    );
  }

  const categories =
    progress.categories.length
      ? progress.categories
      : TARGETS.map((item) => ({
          ...item,
          amount: 0,
          progress: 0,
          completed: false,
        }));

  const allScores = [
    ...weeklyData.postTests,
    ...weeklyData.practices,
  ];

  const overallScore =
    averageScores(allScores);

  const showDashboardContent =
    !loading &&
    !error &&
    (profile || isAdminEmptyView);

  const sidebarMenus = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: "home",
    },
    {
      id: "jadwal",
      label: "Jadwal Kegiatan",
      icon: "calendar",
    },
    {
      id: "monitoring",
      label: "Monitoring Mingguan",
      icon: "chart",
    },
    {
      id: "achievement",
      label: "Achievement OJT",
      icon: "trophy",
    },
    {
      id: "hasil",
      label: "Hasil Post-Test & Praktik",
      icon: "file",
    },
    {
      id: "simper",
      label: "Status SIMPER",
      icon: "shield",
    },
    {
      id: "rapor",
      label: "Rapor & Evaluasi",
      icon: "file",
    },
  ];

  const pageTitles = {
    dashboard: "Dashboard Peserta OJT",
    jadwal: "Jadwal Kegiatan",
    monitoring: "Monitoring Mingguan",
    achievement: "Achievement OJT",
    hasil: "Hasil Post-Test & Praktik",
    simper: "Status SIMPER",
    rapor: "Rapor & Evaluasi",
    profil: "Profil Akun",
  };

  const participantName =
    profile?.full_name ||
    (isAdmin
      ? "Tinjauan Peserta"
      : account?.full_name) ||
    "Peserta OJT";

  const dashboardWeekLabel =
    `Week ${String(currentWeek).padStart(2, "0")}`;

  const selectedWeekLabel =
    `Week ${String(selectedWeek).padStart(2, "0")}`;

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="mt-app">
      <style>{dashboardCSS}</style>

      {/* HEADER */}

      <header className="mt-topbar">
        <button
          type="button"
          className="mt-mobile-trigger"
          onClick={() =>
            setMobileMenu((old) => !old)
          }
          aria-label="Buka menu"
          aria-expanded={mobileMenu}
        >
          <Icon
            name={mobileMenu ? "close" : "menu"}
            size={23}
          />
        </button>

        <button
          type="button"
          className="mt-top-brand"
          onClick={() =>
            navigatePage("dashboard")
          }
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <span className="mt-top-description">
          Emergency Response & Safety System
        </span>

        <div className="mt-top-user">
          <span className="mt-top-avatar">
            {initials(account?.full_name)}
          </span>

          <div>
            <strong>
              {account?.full_name ||
                "Pengguna"}
            </strong>

            <small>
              {isAdmin
                ? "Administrator"
                : "Peserta OJT"}
            </small>
          </div>
        </div>
      </header>

      <div className="mt-layout">

        {/* SIDEBAR */}

        <aside
          className={
            "mt-sidebar " +
            (mobileMenu ? "mobile-open" : "")
          }
        >
          <div className="mt-sidebar-brand">
            <div className="mt-mountain">
              ⛰
            </div>

            <strong>
              OJT <span>MineTrack</span>
              <small> v2.0</small>
            </strong>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>
          </div>

          <div className="mt-sidebar-label">
            MENU PESERTA
          </div>

          <nav className="mt-sidebar-nav">
            {sidebarMenus.map((item) => (
              <button
                type="button"
                key={item.id}
                className={
                  "mt-sidebar-item " +
                  (page === item.id
                    ? "active"
                    : "")
                }
                onClick={() =>
                  navigatePage(item.id)
                }
              >
                <Icon
                  name={item.icon}
                  size={20}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-sidebar-bottom">
            <button
              type="button"
              className={
                "mt-sidebar-item " +
                (page === "profil"
                  ? "active"
                  : "")
              }
              onClick={() =>
                navigatePage("profil")
              }
            >
              <Icon name="user" size={20} />
              Profil Akun
            </button>

            <button
              type="button"
              className="mt-sidebar-item"
              disabled={loggingOut}
              onClick={logout}
            >
              <Icon name="logout" size={20} />

              {loggingOut
                ? "Sedang keluar..."
                : "Keluar Akun"}
            </button>
          </div>

          <div className="mt-sidebar-mountains" />
        </aside>

        {mobileMenu && (
          <button
            type="button"
            className="mt-mobile-overlay"
            onClick={() =>
              setMobileMenu(false)
            }
            aria-label="Tutup menu"
          />
        )}

        {/* MAIN CONTENT */}

        <main className="mt-main">
          <div className="mt-page-heading">
            <div>
              <h1>
                {pageTitles[page] ||
                  "Dashboard Peserta"}
              </h1>

              <p>
                {page === "dashboard"
                  ? "Monitoring aktivitas mingguan, capaian, dan hasil evaluasi OJT Anda."
                  : "Informasi program OJT berdasarkan data peserta."}
              </p>
            </div>

            <button
              type="button"
              className="mt-refresh"
              disabled={
                loading || refreshing
              }
              onClick={() =>
                loadDashboard(true)
              }
            >
              <Icon
                name="refresh"
                size={17}
              />

              <span>
                {refreshing
                  ? "Memuat..."
                  : "Refresh"}
              </span>
            </button>
          </div>

          {/* BANNER DASHBOARD OTOMATIS */}

          {page === "dashboard" && (
            <section
              className="mt-hero"
              style={{
                backgroundImage: `
                  linear-gradient(
                    100deg,
                    rgba(0,55,42,.97),
                    rgba(0,87,57,.87) 54%,
                    rgba(0,70,56,.34)
                  ),
                  url("${BACKGROUND_IMAGE}")
                `,
              }}
            >
              <div className="mt-hero-copy">
                <small>
                  EMERGENCY RESPONSE GROUP —
                  PT BERAU COAL
                </small>

                <h2>
                  OJT <span>MineTrack</span>
                </h2>

                <p>
                  Emergency Response & Safety Service
                </p>

                <div className="mt-hero-period">
                  <Icon
                    name="calendar"
                    size={20}
                  />

                  {formatDate(
                    dashboardWeekInfo?.start
                  )}
                  {" – "}
                  {formatDate(
                    dashboardWeekInfo?.end
                  )}
                  {" "}
                  ({dashboardWeekLabel})
                </div>

                <div className="mt-hero-profile">
                  <span>
                    {initials(participantName)}
                  </span>

                  <div>
                    <strong>
                      {participantName}
                    </strong>

                    <small>
                      {isAdmin
                        ? "Tinjauan Administrator"
                        : "Peserta OJT"}
                    </small>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* LOADING & ERROR */}

          {loading && (
            <div className="mt-alert">
              Memuat Dashboard Peserta...
            </div>
          )}

          {refreshing && (
            <div className="mt-alert">
              Memperbarui data OJT...
            </div>
          )}

          {error && (
            <div
              className="mt-alert error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* ADMIN PREVIEW */}

          {isAdmin && (
            <section className="mt-admin-preview">
              <div>
                <strong>
                  <Icon
                    name="shield"
                    size={18}
                  />
                  Tinjauan Administrator
                </strong>

                <p>
                  Melihat Dashboard Peserta
                  tanpa mengubah data program.
                </p>
              </div>

              <select
                value={
                  selectedParticipantId
                }
                disabled={
                  loading || refreshing
                }
                onChange={(event) =>
                  changePreviewParticipant(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Tinjauan Dashboard Peserta
                </option>

                {participants.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.full_name}
                    {item.site
                      ? ` — ${item.site}`
                      : ""}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() =>
                  router.push("/")
                }
              >
                Kembali ke Dashboard Admin
              </button>
            </section>
          )}

          {/* STATUS PENDAFTARAN */}

          {!loading &&
            access === "pending" && (
              <section className="mt-status-message amber">
                <h3>
                  Menunggu Persetujuan Mentor
                </h3>

                <p>
                  Pengajuan OJT sudah tercatat
                  dan menunggu persetujuan.
                </p>

                <p>
                  <strong>Site:</strong>{" "}
                  {registration?.site || "—"}
                </p>

                <p>
                  <strong>Periode:</strong>{" "}
                  {formatDate(
                    registration?.start_date
                  )}
                  {" – "}
                  {formatDate(
                    registration?.end_date
                  )}
                </p>

                <p>
                  Monitoring tersedia setelah
                  program disetujui Mentor.
                </p>
              </section>
            )}

          {!loading &&
            access === "rejected" && (
              <section className="mt-status-message red">
                <h3>
                  Pengajuan Belum Disetujui
                </h3>

                <p>
                  Pengajuan ditolak oleh Mentor.
                </p>

                <p>
                  <strong>Alasan:</strong>{" "}
                  {registration?.rejection_reason ||
                    "Belum tersedia."}
                </p>

                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/pengajuan-peserta"
                      )
                    }
                  >
                    Perbaiki Pengajuan
                  </button>
                )}
              </section>
            )}

          {!loading &&
            !error &&
            access === "no_program" &&
            profile &&
            !isAdminEmptyView && (
              <section className="mt-status-message">
                <h3>
                  Program OJT Belum Aktif
                </h3>

                <p>
                  Belum ada program OJT aktif.
                  Silakan perbarui status
                  atau hubungi Mentor.
                </p>
              </section>
            )}

          {showDashboardContent && (
            <>

              {/* =====================================
                  DASHBOARD AWAL
                  MENGGUNAKAN currentWeek
                  BUKAN selectedWeek
                  ===================================== */}

              {page === "dashboard" && (
                <>
                  {/* KARTU STATISTIK */}

                  <section className="mt-stat-grid">
                    <div className="mt-stat-card">
                      <span className="mt-stat-icon">
                        <Icon
                          name="calendar"
                          size={26}
                        />
                      </span>

                      <div>
                        <small>
                          Minggu Program
                        </small>

                        <strong>
                          {dashboardWeekLabel}
                          {" / 25"}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-stat-card">
                      <span className="mt-stat-icon">
                        <Icon
                          name="chart"
                          size={26}
                        />
                      </span>

                      <div>
                        <small>
                          Progres OJT
                        </small>

                        <strong>
                          {hasActiveProgram
                            ? `${progress.activityPercent}%`
                            : "—"}
                        </strong>

                        <ProgressBar
                          value={
                            hasActiveProgram
                              ? progress.activityPercent
                              : 0
                          }
                        />
                      </div>
                    </div>

                    <div className="mt-stat-card">
                      <span className="mt-stat-icon">
                        <Icon
                          name="shield"
                          size={26}
                        />
                      </span>

                      <div>
                        <small>
                          Status SIMPER
                        </small>

                        <strong className="mt-status-text">
                          {!hasActiveProgram
                            ? "Belum ada data"
                            : progress.simperIssued
                            ? "Sudah Terbit"
                            : progress.simperCompleted === 3
                            ? "Persyaratan Terpenuhi"
                            : "Belum Dipenuhi"}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {/* JADWAL & RINGKASAN */}

                  <section className="mt-dashboard-columns">

                    {/* JADWAL MINGGU BERJALAN */}

                    <div className="mt-panel">
                      <div className="mt-panel-header">
                        <div>
                          <Icon
                            name="calendar"
                            size={23}
                          />

                          <strong>
                            Jadwal Kegiatan Minggu Ini
                          </strong>
                        </div>

                        <span>
                          {dashboardWeekLabel}
                        </span>
                      </div>

                      <div className="mt-period-strip">
                        <Icon
                          name="calendar"
                          size={18}
                        />

                        {formatDate(
                          dashboardWeekInfo?.start
                        )}
                        {" – "}
                        {formatDate(
                          dashboardWeekInfo?.end
                        )}
                      </div>

                      <div className="mt-activities">
                        {dashboardSchedule.length ? (
                          dashboardSchedule.map(
                            (item) => (
                              <ActivityItem
                                key={item.id}
                                activity={item}
                              />
                            )
                          )
                        ) : (
                          <EmptyState>
                            Belum ada jadwal kegiatan
                            yang diumumkan untuk
                            minggu berjalan.
                          </EmptyState>
                        )}
                      </div>

                      <button
                        type="button"
                        className="mt-panel-link"
                        onClick={() =>
                          navigatePage("jadwal")
                        }
                      >
                        Lihat Semua Jadwal
                        <Icon
                          name="arrow"
                          size={17}
                        />
                      </button>
                    </div>

                    {/* RINGKASAN MINGGU BERJALAN */}

                    <div className="mt-panel">
                      <div className="mt-panel-header">
                        <div>
                          <Icon
                            name="chart"
                            size={23}
                          />

                          <strong>
                            Ringkasan Mingguan
                          </strong>
                        </div>

                        <span>
                          {dashboardWeekLabel}
                        </span>
                      </div>

                      <div className="mt-score-summary">
                        <div>
                          <small>
                            Rata-Rata Nilai Tercatat
                          </small>

                          <strong>
                            {hasActiveProgram
                              ? scoreText(
                                  dashboardWeekly.average
                                )
                              : "—"}
                          </strong>
                        </div>

                        <div>
                          <small>
                            Catatan Minggu Ini
                          </small>

                          <strong>
                            {hasActiveProgram
                              ? dashboardWeekly.total
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-category-heading-main">
                        <strong>
                          Capaian Achievement
                          (6 Kategori)
                        </strong>

                        <button
                          type="button"
                          onClick={() =>
                            navigatePage(
                              "achievement"
                            )
                          }
                        >
                          Lihat Detail
                          <Icon
                            name="arrow"
                            size={15}
                          />
                        </button>
                      </div>

                      <div className="mt-category-grid">
                        {categories.map((item) => (
                          <CategoryCard
                            key={item.name}
                            category={item}
                          />
                        ))}
                      </div>

                      <p className="mt-panel-note">
                        Ringkasan nilai dan aktivitas
                        mengikuti minggu berjalan.
                        Achievement merupakan
                        progres keseluruhan program.
                      </p>
                    </div>
                  </section>
                </>
              )}

              {/* =====================================
                  JADWAL KEGIATAN
                  MENGGUNAKAN selectedWeek
                  ===================================== */}

              {page === "jadwal" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Jadwal Kegiatan OJT
                      </h2>

                      <p>
                        Pilih Week 01–25 untuk
                        melihat agenda kegiatan.
                      </p>
                    </div>

                    <WeekSelector
                      week={selectedWeek}
                      onChange={setSelectedWeek}
                      weeksWithData={weeksWithData}
                    />
                  </div>

                  <div className="mt-week-info">
                    <strong>
                      {selectedWeekLabel}
                    </strong>

                    <span>
                      {formatDate(
                        selectedWeekInfo?.start
                      )}
                      {" – "}
                      {formatDate(
                        selectedWeekInfo?.end
                      )}
                    </span>

                    <small>
                      {selectedSchedule.length}
                      {" kegiatan dijadwalkan"}
                    </small>
                  </div>

                  <div className="mt-activities mt-full-activities">
                    {selectedSchedule.length ? (
                      selectedSchedule.map(
                        (item) => (
                          <ActivityItem
                            key={item.id}
                            activity={item}
                          />
                        )
                      )
                    ) : (
                      <EmptyState>
                        Belum ada agenda yang
                        diumumkan untuk{" "}
                        {selectedWeekLabel}.
                      </EmptyState>
                    )}
                  </div>

                  <div className="mt-info-box">
                    <Icon
                      name="info"
                      size={19}
                    />

                    <span>
                      Peserta dapat melihat
                      jadwal minggu sebelumnya
                      maupun berikutnya.
                      Mengganti Week pada halaman
                      ini tidak memengaruhi
                      Dashboard awal.
                    </span>
                  </div>
                </section>
              )}

              {/* =====================================
                  MONITORING MINGGUAN
                  MENGGUNAKAN selectedWeek
                  ===================================== */}

              {page === "monitoring" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Monitoring Mingguan OJT
                      </h2>

                      <p>
                        Rekap aktivitas dan
                        status verifikasi.
                      </p>
                    </div>

                    <WeekSelector
                      week={selectedWeek}
                      onChange={setSelectedWeek}
                      weeksWithData={weeksWithData}
                    />
                  </div>

                  <div className="mt-week-info">
                    <strong>
                      {selectedWeekLabel}
                    </strong>

                    <span>
                      {formatDate(
                        selectedWeekInfo?.start
                      )}
                      {" – "}
                      {formatDate(
                        selectedWeekInfo?.end
                      )}
                    </span>
                  </div>

                  <div className="mt-four-grid">
                    {[
                      {
                        label: "Achievement",
                        value:
                          selectedWeekly.achievements.length,
                      },
                      {
                        label: "Post-Test",
                        value:
                          selectedWeekly.postTests.length,
                      },
                      {
                        label: "Praktik",
                        value:
                          selectedWeekly.practices.length,
                      },
                      {
                        label: "Samapta",
                        value:
                          selectedWeekly.samapta.length,
                      },
                    ].map((item) => (
                      <div
                        className="mt-mini-stat"
                        key={item.label}
                      >
                        <span>
                          {item.label}
                        </span>

                        <strong>
                          {hasActiveProgram
                            ? item.value
                            : "—"}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="mt-info-box">
                    <Icon
                      name="check"
                      size={19}
                    />

                    <span>
                      Achievement terverifikasi:
                      {" "}
                      <strong>
                        {hasActiveProgram
                          ? selectedWeekly.verifiedAchievements
                          : "—"}
                      </strong>
                    </span>
                  </div>

                  <p className="mt-panel-note">
                    Data monitoring dihitung
                    berdasarkan tanggal catatan
                    pada Week yang dipilih.
                  </p>

                  {hasActiveProgram && (
                    <button
                      type="button"
                      className="mt-action-button"
                      onClick={() =>
                        openFeature(
                          `/mingguan/${program.id}`
                        )
                      }
                    >
                      Buka Monitoring Mingguan
                      Lengkap
                      <Icon
                        name="arrow"
                        size={18}
                      />
                    </button>
                  )}
                </section>
              )}

              {/* =====================================
                  ACHIEVEMENT
                  ===================================== */}

              {page === "achievement" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Achievement OJT
                      </h2>

                      <p>
                        Progres enam kategori
                        berdasarkan kegiatan
                        terverifikasi.
                      </p>
                    </div>
                  </div>

                  <div className="mt-achievement-total">
                    <Icon
                      name="trophy"
                      size={30}
                    />

                    <div>
                      <small>
                        Total Achievement
                      </small>

                      <strong>
                        {hasActiveProgram
                          ? `${progress.achievement}%`
                          : "—"}
                      </strong>

                      <ProgressBar
                        value={
                          hasActiveProgram
                            ? progress.achievement
                            : 0
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-category-grid mt-large-categories">
                    {categories.map((item) => (
                      <div
                        className="mt-achievement-card"
                        key={item.name}
                      >
                        <div>
                          <Icon
                            name={item.icon}
                            size={25}
                          />
                          <strong>
                            {item.name}
                          </strong>
                        </div>

                        <h3>
                          {Math.round(
                            item.progress
                          )}%
                        </h3>

                        <ProgressBar
                          value={
                            item.progress
                          }
                        />

                        <p>
                          Realisasi:{" "}
                          {Number(
                            item.amount
                          ).toLocaleString(
                            "id-ID",
                            {
                              maximumFractionDigits: 3,
                            }
                          )}
                          {" / "}
                          {item.target}
                          {item.name === "Fisik"
                            ? " km"
                            : " kegiatan"}
                        </p>
                      </div>
                    ))}
                  </div>

                  {hasActiveProgram && (
                    <button
                      type="button"
                      className="mt-action-button"
                      onClick={() =>
                        openFeature(
                          `/achievement/${program.id}/monitoring`
                        )
                      }
                    >
                      Lihat Riwayat Achievement
                      <Icon
                        name="arrow"
                        size={18}
                      />
                    </button>
                  )}
                </section>
              )}

              {/* =====================================
                  HASIL POST-TEST & PRAKTIK
                  ===================================== */}

              {page === "hasil" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Hasil Post-Test & Praktik
                      </h2>

                      <p>
                        Daftar nilai yang telah
                        tercatat selama OJT.
                      </p>
                    </div>

                    <div className="mt-tab-buttons">
                      <button
                        type="button"
                        className={
                          resultTab === "posttest"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setResultTab("posttest")
                        }
                      >
                        Post-Test
                      </button>

                      <button
                        type="button"
                        className={
                          resultTab === "praktik"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setResultTab("praktik")
                        }
                      >
                        Praktik
                      </button>
                    </div>
                  </div>

                  <div className="mt-score-summary">
                    <div>
                      <small>
                        Rata-Rata Nilai
                      </small>

                      <strong>
                        {hasActiveProgram
                          ? scoreText(overallScore)
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Penilaian Tercatat
                      </small>

                      <strong>
                        {hasActiveProgram
                          ? allScores.length
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <div className="mt-table-wrap">
                    <table className="mt-table">
                      <thead>
                        <tr>
                          <th>No</th>
                          <th>Kegiatan</th>
                          <th>Tanggal</th>
                          <th>Week</th>
                          <th>Nilai</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(resultTab === "posttest"
                          ? weeklyData.postTests
                          : weeklyData.practices
                        )
                          .slice()
                          .sort((a, b) =>
                            String(
                              resultTab === "posttest"
                                ? b.test_date
                                : b.practice_date
                            ).localeCompare(
                              String(
                                resultTab === "posttest"
                                  ? a.test_date
                                  : a.practice_date
                              )
                            )
                          )
                          .map((item, index) => {
                            const date =
                              resultTab === "posttest"
                                ? item.test_date
                                : item.practice_date;

                            const week =
                              globalWeekOf(date);

                            return (
                              <tr key={item.id}>
                                <td>
                                  {index + 1}
                                </td>

                                <td>
                                  {resultTab === "posttest"
                                    ? "Post-Test"
                                    : "Praktik OJT"}
                                </td>

                                <td>
                                  {formatDate(date)}
                                </td>

                                <td>
                                  {week
                                    ? `W${String(
                                        week
                                      ).padStart(2, "0")}`
                                    : "—"}
                                </td>

                                <td>
                                  <strong>
                                    {scoreText(
                                      item.score
                                    )}
                                  </strong>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {(resultTab === "posttest"
                    ? weeklyData.postTests
                    : weeklyData.practices
                  ).length === 0 && (
                    <EmptyState>
                      Belum ada nilai tercatat.
                    </EmptyState>
                  )}

                  <p className="mt-panel-note">
                    Data bersifat hanya-baca.
                    Nama materi yang belum
                    tersedia pada query ini
                    tidak dibuat secara fiktif.
                  </p>
                </section>
              )}

              {/* =====================================
                  STATUS SIMPER
                  ===================================== */}

              {page === "simper" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Status SIMPER
                      </h2>

                      <p>
                        Pemenuhan persyaratan
                        dan penerbitan SIMPER.
                      </p>
                    </div>
                  </div>

                  <div className="mt-simper-overview">
                    <Icon
                      name="shield"
                      size={34}
                    />

                    <div>
                      <small>
                        Progres Pemenuhan
                      </small>

                      <strong>
                        {hasActiveProgram
                          ? `${progress.simper}%`
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <ProgressBar
                    value={
                      hasActiveProgram
                        ? progress.simper
                        : 0
                    }
                  />

                  <div className="mt-simper-list">
                    <div>
                      <Icon
                        name="check"
                        size={21}
                      />

                      <span>
                        Persyaratan Terpenuhi
                      </span>

                      <strong>
                        {hasActiveProgram
                          ? `${progress.simperCompleted}/3`
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <Icon
                        name="shield"
                        size={21}
                      />

                      <span>
                        Status Penerbitan
                      </span>

                      <strong>
                        {hasActiveProgram
                          ? progress.simperIssued
                            ? "Sudah Terbit"
                            : "Belum Terbit"
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  {hasActiveProgram && (
                    <button
                      type="button"
                      className="mt-action-button"
                      onClick={() =>
                        openFeature(
                          `/simper/${program.id}`
                        )
                      }
                    >
                      Lihat Detail SIMPER
                      <Icon
                        name="arrow"
                        size={18}
                      />
                    </button>
                  )}
                </section>
              )}

              {/* =====================================
                  RAPOR & EVALUASI
                  MENGGUNAKAN selectedWeek
                  ===================================== */}

              {page === "rapor" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-section-heading">
                    <div>
                      <h2>
                        Rapor & Evaluasi OJT
                      </h2>

                      <p>
                        Rekap evaluasi mingguan
                        dan laporan program.
                      </p>
                    </div>

                    <div className="mt-tab-buttons">
                      <button
                        type="button"
                        className={
                          reportTab === "evaluasi"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setReportTab("evaluasi")
                        }
                      >
                        Evaluasi Mingguan
                      </button>

                      <button
                        type="button"
                        className={
                          reportTab === "rapor"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setReportTab("rapor")
                        }
                      >
                        Rapor OJT
                      </button>
                    </div>
                  </div>

                  {reportTab === "evaluasi" ? (
                    <>
                      <WeekSelector
                        week={selectedWeek}
                        onChange={setSelectedWeek}
                        weeksWithData={weeksWithData}
                      />

                      <div className="mt-week-info">
                        <strong>
                          {selectedWeekLabel}
                        </strong>

                        <span>
                          {formatDate(
                            selectedWeekInfo?.start
                          )}
                          {" – "}
                          {formatDate(
                            selectedWeekInfo?.end
                          )}
                        </span>
                      </div>

                      <div className="mt-four-grid">
                        <div className="mt-mini-stat">
                          <span>
                            Achievement
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? selectedWeekly.achievements.length
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            Post-Test
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? selectedWeekly.postTests.length
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            Praktik
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? selectedWeekly.practices.length
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            Rata-Rata Nilai
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? scoreText(
                                  selectedWeekly.average
                                )
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      {hasActiveProgram && (
                        <button
                          type="button"
                          className="mt-action-button"
                          onClick={() =>
                            openFeature(
                              `/mingguan/${program.id}`
                            )
                          }
                        >
                          Buka Evaluasi Mingguan
                          <Icon
                            name="arrow"
                            size={18}
                          />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mt-four-grid">
                        <div className="mt-mini-stat">
                          <span>
                            Achievement
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? `${progress.achievement}%`
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            Minggu Beraktivitas
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? `${progress.activityWeeks}/25`
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            SIMPER
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? `${progress.simper}%`
                              : "—"}
                          </strong>
                        </div>

                        <div className="mt-mini-stat">
                          <span>
                            Rata-Rata Nilai
                          </span>

                          <strong>
                            {hasActiveProgram
                              ? scoreText(overallScore)
                              : "—"}
                          </strong>
                        </div>
                      </div>

                      {hasActiveProgram && (
                        <button
                          type="button"
                          className="mt-action-button"
                          onClick={() =>
                            openFeature(
                              `/laporan/${program.id}`
                            )
                          }
                        >
                          Buka Rapor OJT
                          <Icon
                            name="arrow"
                            size={18}
                          />
                        </button>
                      )}
                    </>
                  )}

                  {hasActiveProgram && (
                    <div className="mt-secondary-actions">
                      <button
                        type="button"
                        onClick={() =>
                          openFeature(
                            `/analisis/${program.id}`
                          )
                        }
                      >
                        Grafik Perkembangan
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openFeature(
                            `/evaluasi/${program.id}`
                          )
                        }
                      >
                        Evaluasi Kesiapan
                      </button>
                    </div>
                  )}
                </section>
              )}

              {/* =====================================
                  PROFIL AKUN
                  ===================================== */}

              {page === "profil" && (
                <section className="mt-panel mt-page-panel">
                  <div className="mt-profile-card">
                    <span>
                      {initials(participantName)}
                    </span>

                    <div>
                      <h2>
                        {participantName}
                      </h2>

                      <p>
                        {isAdmin
                          ? "Tinjauan Administrator"
                          : "Peserta OJT"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-profile-rows">
                    <div>
                      <span>
                        Departemen
                      </span>

                      <strong>
                        {profile?.department || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Site Penempatan
                      </span>

                      <strong>
                        {program?.site || "—"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Periode OJT
                      </span>

                      <strong>
                        {program
                          ? `${formatDate(
                              program.start_date
                            )} – ${formatDate(
                              program.end_date
                            )}`
                          : "Belum tersedia"}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Status Program
                      </span>

                      <strong>
                        {getStatusInfo(access)}
                      </strong>
                    </div>

                    <div>
                      <span>
                        Email Akun Login
                      </span>

                      <strong>
                        {isAdmin
                          ? "Tidak ditampilkan dalam preview"
                          : account?.email || "—"}
                      </strong>
                    </div>
                  </div>
                </section>
              )}

              <footer className="mt-footer">
                <span>
                  OJT MineTrack v2.0 ·
                  Emergency Response Group
                </span>

                <span>
                  PT Berau Coal ·
                  Program 2026–2027
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ======================================================
// CSS DESKTOP + MOBILE
// ======================================================

const dashboardCSS = `
.mt-app,
.mt-app * {
  box-sizing: border-box;
}

.mt-app {
  --green: #008b58;
  --green-dark: #003e35;
  --green-deep: #002c28;
  --green-light: #e7f8ef;
  --text: #14283a;
  --muted: #718293;
  --border: #dce7eb;

  min-height: 100vh;
  background: #f2f7fb;
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

.mt-app button,
.mt-app select {
  font-family: inherit;
}

.mt-app button {
  cursor: pointer;
}

.mt-app button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.mt-app button:focus-visible,
.mt-app select:focus-visible {
  outline: 3px solid #62dca5;
  outline-offset: 2px;
}

/* HEADER */

.mt-topbar {
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 0 25px;
  background: #003e35;
  color: white;
}

.mt-top-brand {
  border: 0;
  background: transparent;
  color: white;
  font-size: 20px;
  font-weight: 900;
  white-space: nowrap;
}

.mt-top-brand span {
  color: #59dfa0;
}

.mt-top-brand small {
  margin-left: 5px;
  font-size: 10px;
  color: #d7eee3;
}

.mt-top-description {
  padding-left: 17px;
  border-left: 1px solid #ffffff44;
  font-size: 12px;
  color: #cfe8de;
}

.mt-top-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 11px;
}

.mt-top-avatar {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  border-radius: 50%;
  background: #d8f6e6;
  color: #075b43;
  font-weight: 900;
  flex-shrink: 0;
}

.mt-top-user strong,
.mt-top-user small {
  display: block;
}

.mt-top-user strong {
  font-size: 12px;
}

.mt-top-user small {
  margin-top: 4px;
  color: #cce9d9;
  font-size: 10px;
}

.mt-mobile-trigger {
  display: none;
  background: transparent;
  color: white;
  border: 0;
  padding: 7px;
}

/* LAYOUT */

.mt-layout {
  display: flex;
  min-height: calc(100vh - 64px);
}

.mt-sidebar {
  position: sticky;
  top: 64px;
  align-self: flex-start;
  width: 264px;
  height: calc(100vh - 64px);
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: linear-gradient(
    165deg,
    #004d3f 0%,
    #00352f 53%,
    #002a27 100%
  );
  color: white;
  padding: 25px 14px;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.mt-sidebar-brand {
  text-align: center;
  padding: 0 7px 22px;
  border-bottom: 1px solid #ffffff29;
}

.mt-mountain {
  font-size: 45px;
  line-height: 1;
  margin-bottom: 12px;
}

.mt-sidebar-brand > strong {
  font-size: 22px;
  white-space: nowrap;
}

.mt-sidebar-brand > strong span {
  color: #f4d45e;
}

.mt-sidebar-brand > strong small {
  font-size: 10px;
}

.mt-sidebar-brand p {
  font-size: 11px;
  line-height: 1.6;
  color: #c9e9dd;
}

.mt-sidebar-label {
  color: #b9d8cc;
  font-size: 10px;
  letter-spacing: 1px;
  font-weight: 900;
  margin: 24px 13px 12px;
}

.mt-sidebar-nav {
  display: grid;
  gap: 6px;
}

.mt-sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #f1fff9;
  text-align: left;
  font-size: 12px;
  font-weight: 700;
}

.mt-sidebar-item svg {
  flex-shrink: 0;
}

.mt-sidebar-item:hover {
  background: #ffffff15;
}

.mt-sidebar-item.active {
  background: #079b62;
  box-shadow: 0 4px 11px #001d1829;
}

.mt-sidebar-bottom {
  display: grid;
  gap: 6px;
  border-top: 1px solid #ffffff2d;
  margin-top: 26px;
  padding-top: 17px;
}

.mt-sidebar-mountains {
  margin-top: auto;
  min-height: 60px;
  opacity: .35;
  background:
    linear-gradient(
      140deg,
      transparent 35%,
      #12aa7c 35% 51%,
      transparent 51%
    ),
    linear-gradient(
      35deg,
      transparent 35%,
      #29b88b 35% 55%,
      transparent 55%
    );
}

.mt-mobile-overlay {
  display: none;
}

/* MAIN */

.mt-main {
  min-width: 0;
  flex: 1;
  padding: 23px;
  max-width: 1700px;
  margin: 0 auto;
}

.mt-page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 17px;
}

.mt-page-heading h1 {
  font-size: 27px;
  margin: 0 0 6px;
  color: #173b34;
  letter-spacing: -.6px;
}

.mt-page-heading p {
  font-size: 12px;
  color: #718293;
  margin: 0;
}

.mt-refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #bfe5d1;
  border-radius: 9px;
  background: white;
  color: #087c58;
  font-size: 11px;
  font-weight: 800;
  padding: 10px 13px;
}

/* HERO */

.mt-hero {
  min-height: 205px;
  border-radius: 14px;
  padding: 25px 35px;
  margin-bottom: 17px;
  background-color: #00513e;
  background-size: cover;
  background-position: center;
  overflow: hidden;
  box-shadow: 0 5px 16px #194d3a19;
}

.mt-hero-copy {
  max-width: 760px;
  color: white;
}

.mt-hero-copy > small {
  color: #f1c95f;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1px;
}

.mt-hero-copy h2 {
  margin: 10px 0 5px;
  font-size: 39px;
  font-weight: 900;
  letter-spacing: -.8px;
}

.mt-hero-copy h2 span {
  color: #54dda1;
}

.mt-hero-copy > p {
  font-size: 16px;
  margin: 0;
  color: #e0f5e9;
}

.mt-hero-period {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 17px;
  font-size: 15px;
  font-weight: 800;
}

.mt-hero-profile {
  display: flex;
  gap: 9px;
  align-items: center;
  margin-top: 18px;
}

.mt-hero-profile > span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  background: #e5f8ed;
  color: #00543a;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 900;
}

.mt-hero-profile strong,
.mt-hero-profile small {
  display: block;
}

.mt-hero-profile strong {
  font-size: 12px;
}

.mt-hero-profile small {
  margin-top: 3px;
  font-size: 10px;
  color: #d3f1e0;
}

/* COMMON */

.mt-alert {
  padding: 14px;
  margin-bottom: 15px;
  border-radius: 10px;
  background: #e4f4eb;
  border: 1px solid #b8e2c7;
  color: #146e4b;
  font-size: 12px;
}

.mt-alert.error {
  background: #fff1f1;
  border-color: #f1bcbc;
  color: #b72d2d;
}

.mt-admin-preview {
  display: grid;
  gap: 12px;
  background: #e8f7f0;
  padding: 17px;
  border: 1px solid #b8e7cf;
  border-radius: 13px;
  margin-bottom: 16px;
}

.mt-admin-preview strong {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #056e4f;
}

.mt-admin-preview p {
  margin: 7px 0 0;
  font-size: 11px;
  color: #607c70;
}

.mt-admin-preview select {
  width: 100%;
  padding: 11px;
  background: white;
  border: 1px solid #cfe2d8;
  border-radius: 9px;
}

.mt-admin-preview button {
  min-height: 40px;
  background: white;
  color: #146f50;
  border: 1px solid #cce2d5;
  border-radius: 9px;
  font-weight: 800;
}

.mt-status-message {
  margin-bottom: 17px;
  padding: 20px;
  background: white;
  border: 1px solid #dce7eb;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.8;
}

.mt-status-message h3 {
  margin-top: 0;
}

.mt-status-message.amber {
  background: #fff7e9;
  border-color: #f5d7a5;
}

.mt-status-message.red {
  background: #fff0f0;
  border-color: #eec6c6;
}

.mt-status-message button {
  padding: 12px 16px;
  color: white;
  background: #078a59;
  border: 0;
  border-radius: 9px;
  font-weight: 800;
}

/* STATS */

.mt-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.mt-stat-card {
  min-height: 115px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 17px;
  padding: 18px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 13px;
  box-shadow: 0 5px 17px #143b3a0c;
}

.mt-stat-icon {
  display: grid;
  place-items: center;
  width: 53px;
  height: 53px;
  flex-shrink: 0;
  border-radius: 12px;
  color: #047c4e;
  background: #dcf6e7;
}

.mt-stat-card > div {
  flex: 1;
  min-width: 0;
}

.mt-stat-card small {
  display: block;
  margin-bottom: 7px;
  font-size: 12px;
  color: #516779;
}

.mt-stat-card strong {
  display: block;
  font-size: 25px;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.mt-stat-card .mt-status-text {
  font-size: 15px;
  color: #075c39;
}

.mt-progress {
  width: 100%;
  height: 9px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 30px;
  background: #dbe4e9;
}

.mt-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #00a74e, #078d35);
}

/* DASHBOARD COLUMNS */

.mt-dashboard-columns {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  align-items: stretch;
  gap: 16px;
}

.mt-panel {
  min-width: 0;
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 5px 20px #18394e0e;
}

.mt-panel-header {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 17px;
  background: linear-gradient(110deg, #004f39, #007b4d);
  color: white;
}

.mt-panel-header > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mt-panel-header strong {
  font-size: 17px;
}

.mt-panel-header > span {
  padding: 7px 14px;
  background: #ddf9e6;
  border-radius: 20px;
  color: #065a3f;
  font-weight: 900;
  font-size: 12px;
  white-space: nowrap;
}

.mt-period-strip {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px 17px;
  background: #f5faf7;
  font-size: 12px;
  font-weight: 800;
}

.mt-activities {
  padding: 3px 12px;
}

.mt-activity {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 5px;
  border-bottom: 1px solid #edf0f3;
}

.mt-activity:last-child {
  border-bottom: 0;
}

.mt-date-block {
  width: 54px;
  min-width: 54px;
  overflow: hidden;
  text-align: center;
  border-radius: 10px;
  background: #dcf5e7;
  color: #07563b;
}

.mt-date-block small {
  display: block;
  background: #009d55;
  color: white;
  font-size: 9px;
  font-weight: 900;
  padding: 6px 2px;
}

.mt-date-block strong {
  display: block;
  font-size: 21px;
  margin-top: 6px;
}

.mt-date-block span {
  display: block;
  margin: 2px 0 8px;
  font-size: 9px;
  font-weight: 900;
}

.mt-date-block.orange {
  background: #fff0dd;
  color: #824016;
}

.mt-date-block.orange small {
  background: #ff8b00;
}

.mt-date-block.practice small {
  background: #0b9656;
}

.mt-activity-icon {
  color: #087d58;
  flex-shrink: 0;
}

.mt-date-block.orange + .mt-activity-icon {
  color: #f38d14;
}

.mt-activity-content {
  flex: 1;
  min-width: 0;
}

.mt-activity-content strong {
  display: block;
  font-size: 12px;
  color: #142b38;
}

.mt-activity-content p {
  margin: 6px 0 0;
  color: #607484;
  font-size: 10px;
  line-height: 1.65;
}

.mt-activity-type {
  padding: 8px;
  max-width: 78px;
  text-align: center;
  font-size: 10px;
  font-weight: 900;
  border-radius: 10px;
  color: #05643a;
  background: #e6f8eb;
}

.mt-activity-type.orange {
  background: #fff1df;
  color: #9c5517;
}

.mt-activity-type.practice {
  background: #dff6e4;
  color: #126b3b;
}

.mt-panel-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  width: calc(100% - 26px);
  min-height: 41px;
  margin: 4px 13px 13px;
  border: 1px solid #bce7c7;
  border-radius: 9px;
  background: #ecfaf0;
  color: #087442;
  font-weight: 900;
  font-size: 11px;
}

.mt-score-summary {
  margin: 14px;
  padding: 15px;
  background: #e7f8ef;
  border-radius: 11px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mt-score-summary > div {
  text-align: center;
  padding: 6px 3px;
}

.mt-score-summary > div + div {
  border-left: 1px solid #a9d4be;
}

.mt-score-summary small {
  display: block;
  font-size: 10px;
  font-weight: 800;
  color: #22543a;
}

.mt-score-summary strong {
  display: block;
  color: #07572d;
  font-size: 31px;
  margin-top: 7px;
}

.mt-category-heading-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 16px;
}

.mt-category-heading-main strong {
  font-size: 13px;
}

.mt-category-heading-main button {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  font-size: 11px;
  color: #087947;
  font-weight: 900;
  white-space: nowrap;
}

.mt-category-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 14px;
}

.mt-category-card {
  min-width: 0;
  padding: 14px 9px;
  border: 1px solid #dde8e8;
  border-radius: 12px;
  background: white;
  text-align: center;
}

.mt-category-heading {
  display: grid;
  justify-items: center;
  gap: 6px;
  color: #067f4d;
}

.mt-category-heading strong {
  color: #223441;
  font-size: 10px;
}

.mt-category-value {
  margin-top: 9px;
  font-size: 20px;
  font-weight: 900;
  color: #066b32;
}

.mt-category-card .mt-progress {
  height: 7px;
  margin-top: 9px;
}

.mt-panel-note {
  font-size: 10px;
  color: #748493;
  line-height: 1.6;
  margin: 4px 15px 15px;
}

/* INNER PAGES */

.mt-page-panel {
  padding: 23px;
  min-height: 330px;
}

.mt-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 19px;
}

.mt-section-heading h2 {
  margin: 0;
  font-size: 21px;
  color: #143d32;
}

.mt-section-heading p {
  margin: 6px 0 0;
  color: #728392;
  font-size: 12px;
}

.mt-week-nav {
  display: flex;
  align-items: center;
  gap: 7px;
}

.mt-week-nav button {
  min-width: 38px;
  height: 39px;
  border: 1px solid #d8e6e2;
  background: #fff;
  border-radius: 9px;
  color: #096b4b;
}

.mt-week-nav select {
  min-height: 39px;
  max-width: 240px;
  border: 1px solid #d8e6e2;
  border-radius: 9px;
  padding: 9px;
  background: #f7fbf9;
  color: #214637;
  font-size: 12px;
  font-weight: 800;
}

.mt-week-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 17px;
  border-radius: 11px;
  background: #e6f7ed;
  margin-bottom: 13px;
}

.mt-week-info strong {
  font-size: 21px;
  color: #075a39;
}

.mt-week-info span {
  font-size: 12px;
  color: #41695b;
}

.mt-week-info small {
  margin-left: auto;
  font-size: 11px;
  color: #087047;
}

.mt-full-activities {
  padding: 0;
  border: 1px solid #e6eded;
  border-radius: 11px;
}

.mt-full-activities .mt-activity {
  padding: 17px;
}

.mt-info-box {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 13px;
  margin-top: 17px;
  border-radius: 10px;
  background: #ecf8f2;
  color: #416d5a;
  font-size: 11px;
  line-height: 1.7;
}

.mt-info-box svg {
  flex-shrink: 0;
}

.mt-empty {
  display: grid;
  justify-items: center;
  padding: 28px;
  color: #80918d;
  text-align: center;
}

.mt-empty p {
  margin: 9px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

.mt-four-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 15px 0;
}

.mt-mini-stat {
  padding: 17px 8px;
  text-align: center;
  background: #f2f9f5;
  border: 1px solid #e1ece6;
  border-radius: 11px;
}

.mt-mini-stat span {
  display: block;
  color: #647a70;
  font-size: 11px;
}

.mt-mini-stat strong {
  display: block;
  margin-top: 9px;
  font-size: 26px;
  color: #066f43;
}

.mt-action-button {
  width: 100%;
  min-height: 48px;
  margin-top: 18px;
  border: 0;
  border-radius: 10px;
  background: #008a55;
  color: white;
  font-size: 12px;
  font-weight: 900;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.mt-achievement-total {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 19px;
  background: #eaf8ee;
  border-radius: 12px;
  color: #067944;
}

.mt-achievement-total > div {
  flex: 1;
}

.mt-achievement-total small {
  display: block;
  color: #456b58;
  font-size: 12px;
}

.mt-achievement-total strong {
  display: block;
  margin-top: 4px;
  font-size: 29px;
}

.mt-large-categories {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 16px 0 0;
}

.mt-achievement-card {
  border: 1px solid #e0e9e8;
  border-radius: 12px;
  padding: 16px;
  background: white;
}

.mt-achievement-card > div:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #087d4a;
}

.mt-achievement-card > div:first-child strong {
  font-size: 12px;
  color: #193b30;
}

.mt-achievement-card h3 {
  font-size: 27px;
  color: #087941;
  margin: 12px 0;
}

.mt-achievement-card p {
  font-size: 11px;
  color: #798b81;
}

.mt-tab-buttons {
  display: flex;
  background: #ecf2f0;
  padding: 4px;
  border-radius: 10px;
  gap: 3px;
}

.mt-tab-buttons button {
  border: 0;
  border-radius: 7px;
  padding: 10px 13px;
  background: transparent;
  color: #5b756b;
  font-size: 11px;
  font-weight: 800;
}

.mt-tab-buttons button.selected {
  background: #078a56;
  color: white;
}

.mt-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.mt-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 480px;
  font-size: 12px;
}

.mt-table th,
.mt-table td {
  padding: 13px;
  border-bottom: 1px solid #e4ebeb;
  text-align: left;
}

.mt-table th {
  background: #eaf4ed;
  font-size: 11px;
  color: #305e46;
}

.mt-simper-overview {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 18px;
  color: #067343;
  background: #e9f8ed;
  border-radius: 11px;
  margin-bottom: 10px;
}

.mt-simper-overview small {
  display: block;
  font-size: 12px;
}

.mt-simper-overview strong {
  display: block;
  margin-top: 5px;
  font-size: 28px;
}

.mt-simper-list {
  margin-top: 20px;
  display: grid;
  gap: 10px;
}

.mt-simper-list > div {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  background: #f8fbf8;
  border: 1px solid #e5eee8;
  border-radius: 10px;
  font-size: 12px;
}

.mt-simper-list svg {
  color: #078a52;
}

.mt-simper-list span {
  flex: 1;
}

.mt-secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 17px;
}

.mt-secondary-actions button {
  flex: 1;
  min-height: 44px;
  border: 1px solid #bdddc8;
  color: #087d4f;
  background: #f0fbf4;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 800;
}

.mt-profile-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 20px;
  background: #edf9f2;
  border-radius: 12px;
}

.mt-profile-card > span {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: #d4f2df;
  color: #086943;
  font-size: 24px;
  font-weight: 900;
  display: grid;
  place-items: center;
}

.mt-profile-card h2 {
  font-size: 20px;
  margin: 0;
}

.mt-profile-card p {
  font-size: 12px;
  color: #688673;
}

.mt-profile-rows {
  margin-top: 17px;
  display: grid;
}

.mt-profile-rows > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 15px 8px;
  border-bottom: 1px solid #e8eeee;
}

.mt-profile-rows span {
  color: #738391;
  font-size: 12px;
}

.mt-profile-rows strong {
  font-size: 12px;
  text-align: right;
  overflow-wrap: anywhere;
}

.mt-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 23px 0;
  margin-top: 22px;
  color: #8a999f;
  border-top: 1px solid #dce7e9;
  font-size: 10px;
}

/* TABLET */

@media (max-width: 1200px) {
  .mt-sidebar {
    width: 235px;
  }

  .mt-main {
    padding: 16px;
  }

  .mt-dashboard-columns {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 850px) {
  .mt-sidebar {
    width: 220px;
  }

  .mt-stat-grid {
    gap: 8px;
  }

  .mt-stat-card {
    padding: 11px;
    gap: 10px;
  }

  .mt-stat-icon {
    width: 39px;
    height: 39px;
  }

  .mt-stat-card strong {
    font-size: 18px;
  }
}

/* MOBILE */

@media (max-width: 700px) {
  .mt-topbar {
    height: 61px;
    padding: 0 12px;
    gap: 8px;
  }

  .mt-mobile-trigger {
    display: grid;
    place-items: center;
  }

  .mt-top-brand {
    font-size: 17px;
  }

  .mt-top-description {
    display: none;
  }

  .mt-top-user > div {
    display: none;
  }

  .mt-top-avatar {
    width: 32px;
    height: 32px;
    font-size: 11px;
  }

  .mt-layout {
    min-height: calc(100vh - 61px);
  }

  .mt-sidebar {
    position: fixed;
    z-index: 55;
    top: 61px;
    bottom: 0;
    left: 0;
    width: 278px;
    height: calc(100vh - 61px);
    transform: translateX(-105%);
    transition: transform .2s ease;
    box-shadow: 5px 0 22px #0000002d;
  }

  .mt-sidebar.mobile-open {
    transform: translateX(0);
  }

  .mt-mobile-overlay {
    position: fixed;
    z-index: 54;
    inset: 61px 0 0;
    display: block;
    width: 100%;
    background: #001b1780;
    border: 0;
  }

  .mt-main {
    width: 100%;
    padding: 12px;
  }

  .mt-page-heading h1 {
    font-size: 22px;
  }

  .mt-page-heading p {
    font-size: 11px;
    line-height: 1.5;
  }

  .mt-refresh {
    padding: 9px;
  }

  .mt-refresh span {
    display: none;
  }

  .mt-hero {
    min-height: 185px;
    padding: 20px;
    border-radius: 12px;
  }

  .mt-hero-copy > small {
    font-size: 9px;
  }

  .mt-hero-copy h2 {
    font-size: 30px;
  }

  .mt-hero-copy > p {
    font-size: 12px;
  }

  .mt-hero-period {
    font-size: 11px;
    flex-wrap: wrap;
  }

  .mt-stat-grid {
    grid-template-columns: repeat(
      3,
      minmax(0, 1fr)
    );
    gap: 7px;
  }

  .mt-stat-card {
    min-height: 112px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 8px;
    padding: 10px;
  }

  .mt-stat-icon {
    width: 34px;
    height: 34px;
    border-radius: 9px;
  }

  .mt-stat-icon svg {
    width: 19px;
    height: 19px;
  }

  .mt-stat-card small {
    font-size: 9px;
  }

  .mt-stat-card strong {
    font-size: 14px;
  }

  .mt-stat-card .mt-status-text {
    font-size: 10px;
  }

  .mt-dashboard-columns {
    grid-template-columns: 1fr;
  }

  .mt-panel-header {
    padding: 12px;
    min-height: 60px;
  }

  .mt-panel-header strong {
    font-size: 14px;
  }

  .mt-panel-header > span {
    padding: 6px 10px;
    font-size: 10px;
  }

  .mt-activity {
    gap: 8px;
  }

  .mt-date-block {
    width: 47px;
    min-width: 47px;
  }

  .mt-date-block strong {
    font-size: 17px;
  }

  .mt-activity-icon svg {
    width: 21px;
    height: 21px;
  }

  .mt-activity-content strong {
    font-size: 11px;
  }

  .mt-activity-content p {
    font-size: 9px;
  }

  .mt-activity-type {
    max-width: 60px;
    font-size: 8px;
    padding: 6px;
  }

  .mt-category-grid {
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
    gap: 8px;
  }

  .mt-category-card {
    padding: 12px;
  }

  .mt-page-panel {
    padding: 15px;
  }

  .mt-section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .mt-section-heading h2 {
    font-size: 18px;
  }

  .mt-week-nav select {
    flex: 1;
    max-width: none;
  }

  .mt-four-grid {
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
  }

  .mt-large-categories {
    grid-template-columns: repeat(
      2,
      minmax(0, 1fr)
    );
  }

  .mt-tab-buttons button {
    flex: 1;
    font-size: 10px;
  }

  .mt-footer {
    flex-direction: column;
    text-align: center;
  }
}

@media (max-width: 380px) {
  .mt-stat-grid {
    gap: 5px;
  }

  .mt-stat-card {
    padding: 8px;
  }

  .mt-activity-icon {
    display: none;
  }

  .mt-activity-content strong {
    font-size: 10px;
  }

  .mt-category-heading strong {
    font-size: 9px;
  }
}
`;
