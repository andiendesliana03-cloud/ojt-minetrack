
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TOTAL_WEEKS = 25;
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const TARGETS = [
  { name: "Fisik", target: 25 },
  { name: "Training", target: 4 },
  { name: "Sosialisasi", target: 3 },
  { name: "Coaching", target: 1 },
  { name: "Orientasi Area", target: 2 },
  { name: "Hazard", target: 2 },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const C = {
  navy: "#081f38",
  navy2: "#103552",
  emerald: "#087d67",
  emerald2: "#0b967b",
  turquoise: "#48e0bf",
  gold: "#efbd65",
  bg: "#edf4f9",
  white: "#ffffff",
  text: "#173755",
  muted: "#6c859d",
  border: "#d9e5ee",
  red: "#bc394a",
  yellow: "#aa7623",
};

const panelStyle = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 5px 20px rgba(11,43,76,0.045)",
  minWidth: 0,
};

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeType(v) {
  return normalize(v).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return ["participant", "peserta"].includes(normalize(role));
}

function formatDate(value) {
  if (!value) return "—";
  const p = String(value).slice(0, 10).split("-");
  return p.length === 3
    ? `${p[2]}/${p[1]}/${p[0]}`
    : String(value);
}

function parseDate(value) {
  if (!value) return null;

  const p = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    p.length !== 3 ||
    p.some((n) => !Number.isInteger(n))
  ) {
    return null;
  }

  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));

  return d.getUTCFullYear() === p[0] &&
    d.getUTCMonth() === p[1] - 1 &&
    d.getUTCDate() === p[2]
    ? d
    : null;
}

function dateISO(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return null;

  return dateISO(
    new Date(date.getTime() + days * 86400000)
  );
}

// Kalender global tidak mengikuti start_date peserta.
function getGlobalWeek(number) {
  if (number < 1 || number > TOTAL_WEEKS) return null;

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

  for (let i = 1; i <= TOTAL_WEEKS; i++) {
    const week = getGlobalWeek(i);

    if (date >= week.start && date <= week.end) {
      return i;
    }
  }

  return null;
}

function getCurrentGlobalWeek() {
  const now = new Date();

  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return globalWeekOf(today) || 1;
}

// Dipertahankan dari rumus Achievement asli:
// minggu dihitung dari start_date program peserta.
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

function clamp(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

function emptyProgress() {
  return {
    achievement: 0,
    completedCategories: 0,
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

// =====================================================
// ACHIEVEMENT — LOGIKA ASLI DIPERTAHANKAN
// =====================================================

function calculateAchievements(records, types, startDate) {
  const codes = new Map(
    types.map((t) => [
      normalizeType(t.name),
      normalizeType(t.code),
    ])
  );

  const verified = records.filter(
    (r) =>
      normalize(r.status) === "verified" &&
      weekOf(r.activity_date, startDate) !== null
  );

  const categories = TARGETS.map((item) => {
    const code = codes.get(normalizeType(item.name));

    const matching = code
      ? verified.filter(
          (r) => normalizeType(r.type_code) === code
        )
      : [];

    let amount = 0;

    if (item.name === "Fisik") {
      amount = matching.reduce((sum, r) => {
        const km = Number(r.distance_km);

        return (
          sum +
          (Number.isFinite(km) && km > 0 ? km : 0)
        );
      }, 0);
    } else {
      amount = matching.length;
    }

    return {
      ...item,
      amount,
      progress: clamp((amount / item.target) * 100),
      completed: amount >= item.target,
    };
  });

  const total = categories.reduce(
    (sum, item) => sum + item.progress,
    0
  );

  return {
    progress: Math.round(total / TARGETS.length),
    completed: categories.filter((c) => c.completed).length,
  };
}

// =====================================================
// SIMPER V2 — LOGIKA ASLI DIPERTAHANKAN
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
      issued: false,
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
    issued: meta?.issuance_status === "issued",
  };
}

// =====================================================
// RINGKASAN PROGRAM — LOGIKA ASLI
// =====================================================

function buildProgress(program, data) {
  const achievement = calculateAchievements(
    data.achievements,
    data.types,
    program.start_date
  );

  const chosenSimper =
    data.simper.find((r) =>
      parseSimperMetadata(r.notes)
    ) ||
    data.simper[0] ||
    null;

  const simper = calculateSimper(chosenSimper);

  const weeks = new Set();

  function markWeek(date) {
    const week = weekOf(date, program.start_date);

    if (week !== null) {
      weeks.add(week);
    }
  }

  data.achievements.forEach((r) =>
    markWeek(r.activity_date)
  );

  data.postTests.forEach((r) =>
    markWeek(r.test_date)
  );

  data.practices.forEach((r) =>
    markWeek(r.practice_date)
  );

  data.samapta.forEach((r) =>
    markWeek(r.test_date)
  );

  return {
    achievement: achievement.progress,
    completedCategories: achievement.completed,
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
    pending: {
      label: "Menunggu Persetujuan Mentor",
      color: C.yellow,
      background: "#fff4df",
      icon: "clock",
    },
    rejected: {
      label: "Pengajuan Ditolak",
      color: C.red,
      background: "#fff0f2",
      icon: "alert",
    },
    approved: {
      label: "Program OJT Aktif",
      color: C.emerald,
      background: "#dff8ec",
      icon: "check",
    },
    no_program: {
      label: "Belum Ada Program",
      color: C.muted,
      background: "#eff3f6",
      icon: "clock",
    },
    error: {
      label: "Terjadi Kesalahan",
      color: C.red,
      background: "#fff0f2",
      icon: "alert",
    },
  };

  return statuses[access] || statuses.no_program;
}

// =====================================================
// IKON
// =====================================================

function Icon({ name, size = 20 }) {
  const shapes = {
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 17h.01" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
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
        <path d="M3 19h18" />
        <path d="m6 15 4-4 3 2 5-7" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="5" width="14" height="16" rx="2" />
        <rect x="9" y="3" width="6" height="5" rx="1" />
        <path d="M9 13h6M9 17h5" />
      </>
    ),
    award: (
      <>
        <circle cx="12" cy="8" r="5" />
        <path d="m8 12-2 9 6-3 6 3-2-9" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l5 5v15H6z" />
        <path d="M14 2v5h5M9 12h7M9 16h7" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    chevronLeft: <path d="m15 18-6-6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
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
      {shapes[name] || shapes.clipboard}
    </svg>
  );
}

function PanelTitle({ icon, title, subtitle }) {
  return (
    <div className="ojt-panel-title">
      <div className="ojt-panel-icon">
        <Icon name={icon} size={22} />
      </div>

      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail, tone }) {
  return (
    <div className="ojt-stat">
      <div className={`ojt-stat-icon ${tone || "blue"}`}>
        <Icon name={icon} size={23} />
      </div>

      <div className="ojt-stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </div>
  );
}

function ProgressBar({
  title,
  value,
  description,
  noData = false,
}) {
  const safe = clamp(value);

  return (
    <div className="ojt-progress-item">
      <div className="ojt-progress-label">
        <strong>{title}</strong>

        <strong className="ojt-progress-value">
          {noData ? "Belum ada data" : `${safe}%`}
        </strong>
      </div>

      <div
        className="ojt-progress-track"
        role={noData ? undefined : "progressbar"}
        aria-valuemin={noData ? undefined : 0}
        aria-valuemax={noData ? undefined : 100}
        aria-valuenow={noData ? undefined : safe}
      >
        {!noData && (
          <div
            className="ojt-progress-fill"
            style={{ width: `${safe}%` }}
          />
        )}
      </div>

      <p className="ojt-progress-desc">{description}</p>
    </div>
  );
}

function MenuCard({
  icon,
  title,
  description,
  disabled,
  onClick,
}) {
  return (
    <button
      type="button"
      className="ojt-menu-card"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="ojt-menu-icon">
        <Icon name={icon} size={22} />
      </span>

      <span className="ojt-menu-copy">
        <strong>{title}</strong>
        <small>{description}</small>

        {disabled && (
          <small className="ojt-disabled-text">
            Tersedia setelah program aktif
          </small>
        )}
      </span>

      <Icon name="arrow" size={17} />
    </button>
  );
}

function WeekSelector({
  selectedWeek,
  onSelect,
  weeksWithData,
}) {
  const weeks = Array.from(
    { length: TOTAL_WEEKS },
    (_, i) => i + 1
  );

  return (
    <div className="ojt-week-selector">
      <button
        type="button"
        aria-label="Minggu sebelumnya"
        className="ojt-week-nav"
        disabled={selectedWeek <= 1}
        onClick={() => onSelect(selectedWeek - 1)}
      >
        <Icon name="chevronLeft" size={18} />
      </button>

      <div className="ojt-week-scroll">
        {weeks.map((week) => (
          <button
            key={week}
            type="button"
            className={
              "ojt-week-button " +
              (selectedWeek === week ? "selected" : "")
            }
            onClick={() => onSelect(week)}
            aria-pressed={selectedWeek === week}
          >
            <strong>
              W{String(week).padStart(2, "0")}
            </strong>

            <small>
              {weeksWithData.has(week)
                ? "Ada data"
                : "—"}
            </small>
          </button>
        ))}
      </div>

      <button
        type="button"
        aria-label="Minggu berikutnya"
        className="ojt-week-nav"
        disabled={selectedWeek >= TOTAL_WEEKS}
        onClick={() => onSelect(selectedWeek + 1)}
      >
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}

// =====================================================
// DASHBOARD PESERTA
// =====================================================

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

  const [progress, setProgress] = useState(emptyProgress());
  const [weeklyData, setWeeklyData] = useState(emptyWeeklyData());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [mobileMenu, setMobileMenu] = useState(false);

  const requestIdRef = useRef(0);
  const selectedIdRef = useRef("");

  const isAdmin = normalize(account?.role) === "admin";
  const isAdminEmptyView = isAdmin && !profile;

  const hasActiveProgram =
    access === "approved" &&
    !!program?.id &&
    !!profile;

  const status = getStatusInfo(access);
  const noProgramData = !hasActiveProgram;

  function clearDashboard() {
    setProfile(null);
    setProgram(null);
    setRegistration(null);
    setProgress(emptyProgress());
    setWeeklyData(emptyWeeklyData());
    setAccess("loading");
  }

  // ===================================================
  // DAFTAR PESERTA ADMIN — LOGIKA ASLI
  // ===================================================

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

      if (!peserta || !isParticipantRole(peserta.role)) {
        return;
      }

      if (!unique.has(item.participant_id)) {
        unique.set(item.participant_id, {
          id: item.participant_id,
          full_name: peserta.full_name || "Peserta OJT",
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

  // ===================================================
  // MEMUAT DATA PROGRAM
  // RUMUS PROGRES TIDAK DIUBAH
  // ===================================================

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
        .select("id,program_id,test_date")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,program_id,practice_date")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select("id,program_id,test_date")
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
      progress: buildProgress(activeProgram, data),

      // Data mentah untuk panel mingguan baru.
      weekly: {
        achievements: data.achievements,
        postTests: data.postTests,
        practices: data.practices,
        samapta: data.samapta,
      },
    };
  }

  // ===================================================
  // VALIDASI PROGRAM DAN PENDAFTARAN — LOGIKA ASLI
  // ===================================================

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
      const { data, error: profileError } =
        await supabase
          .from("profiles")
          .select("id,full_name,department,role")
          .eq("id", participantId)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        throw new Error("Profil peserta tidak tersedia.");
      }

      if (!isParticipantRole(data.role)) {
        throw new Error(
          "Akun tidak terdaftar sebagai Peserta OJT."
        );
      }

      currentProfile = data;
    }

    const { data: activePrograms, error: programError } =
      await supabase
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
        .order("start_date", { ascending: false })
        .limit(1);

    if (programError) throw programError;

    const activeProgram = activePrograms?.[0] || null;

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
        access: activeProgram ? "approved" : "no_program",
        progress: bundle.progress,
        weekly: bundle.weekly,
      };
    }

    const { data: newRequests, error: newError } =
      await supabase
        .from("ojt_registration_requests")
        .select(`
          id,status,rejection_reason,site,
          start_date,end_date,created_at
        `)
        .eq("participant_id", participantId)
        .order("created_at", { ascending: false });

    if (newError) throw newError;

    const { data: oldRequests, error: oldError } =
      await supabase
        .from("participant_registrations")
        .select(`
          id,status,rejection_reason,site,created_at
        `)
        .eq("user_id", participantId)
        .order("created_at", { ascending: false })
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
      (item) => normalize(item.status) === "pending"
    );

    const hasApprovedNew = newList.some(
      (item) => normalize(item.status) === "approved"
    );

    const hasApprovedOld =
      normalize(oldRegistration?.status) === "approved";

    const hasPendingOld =
      normalize(oldRegistration?.status) === "pending";

    const approvedProgram =
      !!activeProgram &&
      (
        hasApprovedNew ||
        hasApprovedOld ||
        activeProgram.legacy_access === true
      );

    let nextAccess = "no_program";

    if (approvedProgram) {
      nextAccess = "approved";
    } else if (hasPendingNew || hasPendingOld) {
      nextAccess = "pending";
    } else if (
      normalize(latestRegistration?.status) === "rejected"
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
      registration: latestRegistration || null,
      program:
        nextAccess === "approved"
          ? activeProgram
          : null,
      access: nextAccess,
      progress: bundle.progress,
      weekly: bundle.weekly,
    };
  }

  function applyDashboard(data) {
    setProfile(data.profile);
    setRegistration(data.registration);
    setProgram(data.program);
    setProgress(data.progress || emptyProgress());
    setWeeklyData(data.weekly || emptyWeeklyData());
    setAccess(data.access);
  }

  // ===================================================
  // LOAD DASHBOARD — LOGIKA ASLI
  // ===================================================

  async function loadDashboard(
    isRefresh = false,
    requestedParticipantId = null
  ) {
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

      if (requestId !== requestIdRef.current) return;

      if (authError || !user) {
        setAccount(null);
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";
        clearDashboard();

        router.replace("/login");
        return;
      }

      const { data: currentAccount, error: accountError } =
        await supabase
          .from("profiles")
          .select("id,full_name,department,role")
          .eq("id", user.id)
          .maybeSingle();

      if (requestId !== requestIdRef.current) return;

      if (accountError) throw accountError;

      if (!currentAccount) {
        throw new Error("Profil akun tidak tersedia.");
      }

      const role = normalize(currentAccount.role);

      if (role === "mentor") {
        setAccount(null);
        clearDashboard();
        router.replace("/");
        return;
      }

      if (role !== "admin" && !isParticipantRole(role)) {
        throw new Error(
          "Akun tidak memiliki akses Dashboard Peserta."
        );
      }

      setAccount({ ...currentAccount, role });

      if (role === "admin") {
        const list = await fetchParticipantList();

        if (requestId !== requestIdRef.current) return;

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

        const next = await fetchParticipantDashboard(
          targetId,
          true,
          list
        );

        if (requestId !== requestIdRef.current) return;

        applyDashboard(next);
      } else {
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";

        const next = await fetchParticipantDashboard(
          user.id,
          false
        );

        if (requestId !== requestIdRef.current) return;

        applyDashboard(next);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      clearDashboard();
      setError(
        err?.message || "Gagal memuat Dashboard Peserta."
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
    setSelectedWeek(getCurrentGlobalWeek());
    loadDashboard();

    return () => {
      requestIdRef.current += 1;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===================================================
  // ADMIN PREVIEW — LOGIKA ASLI
  // ===================================================

  async function changePreviewParticipant(id) {
    if (!isAdmin || loading || refreshing) return;

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

      if (requestId !== requestIdRef.current) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: verifiedAccount, error: accountError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

      if (requestId !== requestIdRef.current) return;

      if (accountError) throw accountError;

      if (normalize(verifiedAccount?.role) !== "admin") {
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
        throw new Error("Peserta tidak ditemukan.");
      }

      const next = await fetchParticipantDashboard(
        id,
        true,
        participants
      );

      if (requestId !== requestIdRef.current) return;

      applyDashboard(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

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

  // ===================================================
  // LOGOUT DAN NAVIGASI — LOGIKA ASLI
  // ===================================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    requestIdRef.current += 1;

    try {
      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      setAccount(null);
      setParticipants([]);
      setSelectedParticipantId("");
      selectedIdRef.current = "";
      clearDashboard();

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Gagal keluar. Silakan coba kembali.");
      setLoggingOut(false);
    }
  }

  function openParticipantFeature(path) {
    if (!hasActiveProgram) return;
    router.push(path);
  }

  // ===================================================
  // DATA WEEKLY ACTIVITY HUB — FITUR TAMPILAN BARU
  // ===================================================

  const weekInfo = getGlobalWeek(selectedWeek);

  const weeklyAchievements = weeklyData.achievements.filter(
    (row) =>
      globalWeekOf(row.activity_date) === selectedWeek
  );

  const weeklyPostTests = weeklyData.postTests.filter(
    (row) =>
      globalWeekOf(row.test_date) === selectedWeek
  );

  const weeklyPractices = weeklyData.practices.filter(
    (row) =>
      globalWeekOf(row.practice_date) === selectedWeek
  );

  const weeklySamapta = weeklyData.samapta.filter(
    (row) =>
      globalWeekOf(row.test_date) === selectedWeek
  );

  const totalSelectedActivities =
    weeklyAchievements.length +
    weeklyPostTests.length +
    weeklyPractices.length +
    weeklySamapta.length;

  const verifiedWeeklyAchievements =
    weeklyAchievements.filter(
      (row) => normalize(row.status) === "verified"
    ).length;

  const weeksWithData = new Set();

  if (hasActiveProgram) {
    const markGlobal = (date) => {
      const week = globalWeekOf(date);
      if (week !== null) weeksWithData.add(week);
    };

    weeklyData.achievements.forEach((row) =>
      markGlobal(row.activity_date)
    );

    weeklyData.postTests.forEach((row) =>
      markGlobal(row.test_date)
    );

    weeklyData.practices.forEach((row) =>
      markGlobal(row.practice_date)
    );

    weeklyData.samapta.forEach((row) =>
      markGlobal(row.test_date)
    );
  }

  const showDashboardContent =
    !loading &&
    !error &&
    (profile || isAdminEmptyView);

  const selectedWeekLabel =
    `Week ${String(selectedWeek).padStart(2, "0")}`;

  const weeklyRows = [
    {
      label: "Achievement",
      count: weeklyAchievements.length,
    },
    {
      label: "Post-Test",
      count: weeklyPostTests.length,
    },
    {
      label: "Praktik",
      count: weeklyPractices.length,
    },
    {
      label: "Samapta",
      count: weeklySamapta.length,
    },
  ];

  // ===================================================
  // TAMPILAN SKETSA 3 — WEEKLY ACTIVITY HUB
  // ===================================================

  return (
    <main className="ojt-dashboard">
      <style>{dashboardCSS}</style>

      <header className="ojt-topbar">
        <button
          type="button"
          className="ojt-brand"
          onClick={() => router.push("/")}
        >
          <span className="ojt-logo">
            <Icon name="shield" size={24} />
          </span>

          <span className="ojt-brand-text">
            <strong>
              OJT <em>MineTrack</em>
              <small>v2.0</small>
            </strong>
            <span>
              ON THE JOB TRAINING MANAGEMENT SYSTEM
            </span>
          </span>
        </button>

        <div className="ojt-topbar-right">
          <span className="ojt-topbar-avatar">
            {initials(
              account?.full_name || "Peserta"
            )}
          </span>

          <span className="ojt-topbar-account">
            <strong>
              {account?.full_name || "Peserta OJT"}
            </strong>
            <small>
              {isAdmin ? "Administrator" : "Peserta OJT"}
            </small>
          </span>

          <button
            type="button"
            className="ojt-menu-toggle"
            aria-label="Buka menu"
            onClick={() =>
              setMobileMenu((prev) => !prev)
            }
          >
            <Icon name="menu" size={23} />
          </button>
        </div>
      </header>

      {mobileMenu && (
        <nav className="ojt-mobile-menu">
          <button
            type="button"
            onClick={() => {
              setMobileMenu(false);
              loadDashboard(true);
            }}
          >
            Perbarui Dashboard
          </button>

          {hasActiveProgram && (
            <>
              <button
                type="button"
                onClick={() => {
                  setMobileMenu(false);
                  openParticipantFeature(
                    `/analisis/${program.id}`
                  );
                }}
              >
                Grafik Perkembangan
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenu(false);
                  openParticipantFeature(
                    `/evaluasi/${program.id}`
                  );
                }}
              >
                Evaluasi Kesiapan
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenu(false);
                  openParticipantFeature(
                    `/laporan/${program.id}`
                  );
                }}
              >
                Laporan OJT
              </button>
            </>
          )}

          <button type="button" onClick={logout}>
            Keluar dari Akun
          </button>
        </nav>
      )}

      <div className="ojt-content">
        <section
          className="ojt-hero"
          style={{
            backgroundImage: `
              linear-gradient(
                100deg,
                rgba(5,24,45,.97),
                rgba(6,36,61,.88) 65%,
                rgba(6,42,65,.72)
              ),
              url("${BACKGROUND_IMAGE}")
            `,
          }}
        >
          <div className="ojt-eyebrow">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>

          <h1>
            Dashboard <span>Peserta OJT</span>
          </h1>

          <p className="ojt-hero-description">
            Monitoring aktivitas mingguan, progres,
            dan capaian OJT Anda.
          </p>

          <div className="ojt-hero-bottom">
            <div className="ojt-hero-identity">
              <div className="ojt-hero-avatar">
                {initials(
                  profile?.full_name ||
                    account?.full_name ||
                    "Peserta"
                )}
              </div>

              <div>
                <strong>
                  {profile?.full_name ||
                    account?.full_name ||
                    "Peserta OJT"}
                </strong>
                <small>
                  {isAdmin
                    ? "Tinjauan Administrator"
                    : profile?.department || "Peserta OJT"}
                </small>
              </div>

              {access !== "loading" && (
                <span className="ojt-hero-status">
                  <Icon name={status.icon} size={16} />
                  {access === "approved"
                    ? "Aktif"
                    : isAdminEmptyView
                    ? "Preview"
                    : status.label}
                </span>
              )}
            </div>

            <div className="ojt-hero-progress">
              <small>AKTIVITAS MINGGUAN</small>

              <strong>
                {hasActiveProgram
                  ? `${progress.activityWeeks}/${TOTAL_WEEKS}`
                  : `—/${TOTAL_WEEKS}`}
                <span> Minggu</span>
              </strong>

              <div className="ojt-hero-progress-row">
                <div className="ojt-hero-track">
                  <div
                    style={{
                      width: `${
                        hasActiveProgram
                          ? clamp(progress.activityPercent)
                          : 0
                      }%`,
                    }}
                  />
                </div>

                <b>
                  {hasActiveProgram
                    ? `${progress.activityPercent}%`
                    : "—"}
                </b>
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="ojt-notice">
            Memeriksa akun dan memuat data Dashboard Peserta...
          </div>
        )}

        {refreshing && (
          <div className="ojt-notice">
            Memperbarui data peserta...
          </div>
        )}

        {error && (
          <div className="ojt-notice error" role="alert">
            <Icon name="alert" size={18} />
            {error}
          </div>
        )}

        {/* ADMIN PREVIEW */}

        {isAdmin && (
          <section className="ojt-admin-panel">
            <div className="ojt-admin-heading">
              <Icon name="shield" size={23} />

              <div>
                <strong>Tinjauan Administrator</strong>
                <p>
                  Periksa Dashboard Peserta tanpa
                  mengubah data program.
                </p>
              </div>
            </div>

            <label htmlFor="admin-preview">
              Pilih Tampilan Dashboard
            </label>

            <select
              id="admin-preview"
              value={selectedParticipantId}
              disabled={loading || refreshing}
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
                <option key={item.id} value={item.id}>
                  {item.full_name}
                  {item.site ? ` — ${item.site}` : ""}
                </option>
              ))}
            </select>

            <p>
              {selectedParticipantId
                ? "Menampilkan data peserta aktif yang dipilih."
                : "Menampilkan kerangka dashboard tanpa data peserta atau program fiktif."}
            </p>

            <button
              type="button"
              className="ojt-outline-button"
              onClick={() => router.push("/")}
            >
              Kembali ke Dashboard Mentor
            </button>
          </section>
        )}

        {showDashboardContent && (
          <>
            {/* STATUS PENGAJUAN */}

            {access === "pending" && profile && (
              <section className="ojt-message amber">
                <h2>
                  <Icon name="clock" size={21} />
                  Menunggu Persetujuan Mentor
                </h2>

                <p>
                  Pengajuan OJT sudah tercatat dan
                  menunggu keputusan mentor.
                </p>

                <p>
                  <strong>Site:</strong>{" "}
                  {registration?.site || "—"}
                </p>

                <p>
                  <strong>Periode:</strong>{" "}
                  {formatDate(registration?.start_date)}
                  {" – "}
                  {formatDate(registration?.end_date)}
                </p>

                <p>
                  Fitur monitoring tersedia setelah
                  program disetujui mentor.
                </p>
              </section>
            )}

            {access === "rejected" && profile && (
              <section className="ojt-message red">
                <h2>
                  <Icon name="alert" size={21} />
                  Pengajuan Belum Disetujui
                </h2>

                <p>
                  Mentor telah menolak pengajuan OJT.
                </p>

                <div className="ojt-rejection-reason">
                  <strong>Alasan Penolakan</strong>
                  <p>
                    {registration?.rejection_reason ||
                      "Alasan belum tersedia."}
                  </p>
                </div>

                {!isAdmin && (
                  <button
                    type="button"
                    className="ojt-primary-button"
                    onClick={() =>
                      router.push("/pengajuan-peserta")
                    }
                  >
                    Lihat dan Perbaiki Pengajuan
                  </button>
                )}
              </section>
            )}

            {access === "no_program" &&
              profile &&
              !isAdminEmptyView && (
                <section className="ojt-message neutral">
                  <h2>Program OJT Belum Aktif</h2>
                  <p>
                    Belum ada program OJT aktif yang
                    dapat diakses. Gunakan Perbarui
                    Status untuk memeriksa kembali.
                  </p>
                </section>
              )}

            {(hasActiveProgram || isAdminEmptyView) && (
              <>
                {/* INFORMASI UTAMA */}

                <section className="ojt-stats-grid">
                  <StatCard
                    icon="user"
                    tone="blue"
                    label="Site Penempatan"
                    value={program?.site || "—"}
                  />

                  <StatCard
                    icon="calendar"
                    tone="gold"
                    label="Periode OJT"
                    value={
                      program
                        ? `${formatDate(program.start_date)} – ${formatDate(program.end_date)}`
                        : "Belum tersedia"
                    }
                  />

                  <StatCard
                    icon="chart"
                    tone="green"
                    label="Aktivitas Mingguan"
                    value={
                      hasActiveProgram
                        ? `${progress.activityWeeks}/${TOTAL_WEEKS}`
                        : "—"
                    }
                    detail="Minggu dengan catatan aktivitas"
                  />
                </section>

                {/* WEEKLY ACTIVITY HUB */}

                <section style={panelStyle}>
                  <PanelTitle
                    icon="calendar"
                    title="Monitoring Mingguan OJT"
                    subtitle="Pilih Week 01–25 untuk melihat catatan kegiatan sesuai kalender program global."
                  />

                  <WeekSelector
                    selectedWeek={selectedWeek}
                    onSelect={setSelectedWeek}
                    weeksWithData={weeksWithData}
                  />

                  <div className="ojt-selected-week">
                    <div className="ojt-selected-week-info">
                      <span className="ojt-week-kicker">
                        MINGGU TERPILIH
                      </span>

                      <strong>{selectedWeekLabel}</strong>

                      <span>
                        {formatDate(weekInfo.start)}
                        {" – "}
                        {formatDate(weekInfo.end)}
                      </span>

                      <div
                        className={
                          "ojt-data-badge " +
                          (totalSelectedActivities > 0
                            ? "has-data"
                            : "")
                        }
                      >
                        {hasActiveProgram
                          ? totalSelectedActivities > 0
                            ? "Memiliki catatan"
                            : "Belum ada catatan"
                          : "Tidak ada data program"}
                      </div>
                    </div>

                    <div className="ojt-week-details">
                      <div className="ojt-week-details-title">
                        <strong>
                          Ringkasan Aktivitas Mingguan
                        </strong>

                        <span>
                          {hasActiveProgram
                            ? `${totalSelectedActivities} catatan`
                            : "Belum tersedia"}
                        </span>
                      </div>

                      <div className="ojt-week-metrics">
                        {weeklyRows.map((item) => (
                          <div
                            key={item.label}
                            className="ojt-week-metric"
                          >
                            <span>{item.label}</span>

                            <strong>
                              {hasActiveProgram
                                ? item.count
                                : "—"}
                            </strong>
                          </div>
                        ))}
                      </div>

                      <div className="ojt-week-verification">
                        <Icon
                          name="check"
                          size={17}
                        />

                        <span>
                          Achievement terverifikasi:{" "}
                          <strong>
                            {hasActiveProgram
                              ? verifiedWeeklyAchievements
                              : "—"}
                          </strong>
                        </span>
                      </div>

                      <p className="ojt-week-note">
                        Jumlah di atas merupakan catatan
                        yang memiliki tanggal dalam minggu
                        terpilih. Ini bukan jumlah hari
                        kehadiran atau nilai kelulusan.
                      </p>

                      {hasActiveProgram && (
                        <button
                          type="button"
                          className="ojt-week-detail-button"
                          onClick={() =>
                            openParticipantFeature(
                              `/mingguan/${program.id}`
                            )
                          }
                        >
                          Lihat Evaluasi Mingguan
                          <Icon name="arrow" size={17} />
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* PROGRES ACHIEVEMENT & SIMPER */}

                <section className="ojt-dual-grid">
                  <div style={panelStyle}>
                    <PanelTitle
                      icon="award"
                      title="Achievement"
                      subtitle="Pencapaian enam kategori target OJT."
                    />

                    <ProgressBar
                      title="Progres Achievement"
                      value={progress.achievement}
                      noData={noProgramData}
                      description={
                        noProgramData
                          ? "Belum ada data program aktif."
                          : `${progress.completedCategories} dari 6 kategori mencapai target. Hanya aktivitas terverifikasi yang dihitung.`
                      }
                    />
                  </div>

                  <div style={panelStyle}>
                    <PanelTitle
                      icon="shield"
                      title="Status SIMPER"
                      subtitle="Pemenuhan tiga persyaratan SIMPER."
                    />

                    <ProgressBar
                      title="Progres SIMPER"
                      value={progress.simper}
                      noData={noProgramData}
                      description={
                        noProgramData
                          ? "Belum ada data persyaratan SIMPER."
                          : `${progress.simperCompleted} dari 3 persyaratan SIMPER terpenuhi.`
                      }
                    />

                    <div className="ojt-simper-status">
                      <strong>Status Penerbitan:</strong>{" "}
                      {noProgramData
                        ? "Belum ada data"
                        : progress.simperIssued
                        ? "Sudah Terbit"
                        : "Belum Terbit"}
                    </div>
                  </div>
                </section>

                {/* RINGKASAN PROGRAM */}

                <section style={panelStyle}>
                  <PanelTitle
                    icon="chart"
                    title="Ringkasan Progres Program"
                    subtitle="Perkembangan keseluruhan berdasarkan data aktual peserta."
                  />

                  <div className="ojt-summary-grid">
                    <div className="ojt-summary-item">
                      <span>Minggu Beraktivitas</span>
                      <strong>
                        {hasActiveProgram
                          ? `${progress.activityWeeks}/${TOTAL_WEEKS}`
                          : "—"}
                      </strong>
                    </div>

                    <div className="ojt-summary-item">
                      <span>Achievement Tercapai</span>
                      <strong>
                        {hasActiveProgram
                          ? `${progress.completedCategories}/6`
                          : "—"}
                      </strong>
                    </div>

                    <div className="ojt-summary-item">
                      <span>Persyaratan SIMPER</span>
                      <strong>
                        {hasActiveProgram
                          ? `${progress.simperCompleted}/3`
                          : "—"}
                      </strong>
                    </div>
                  </div>

                  <p className="ojt-summary-note">
                    Perhitungan Achievement dan SIMPER
                    menggunakan metode yang sudah
                    diterapkan sebelumnya. Aktivitas
                    mingguan dihitung dari minggu
                    yang memiliki catatan.
                  </p>
                </section>

                {/* MENU FITUR */}

                <section style={panelStyle}>
                  <PanelTitle
                    icon="grid"
                    title="Akses Cepat"
                    subtitle="Menu utama untuk melihat perkembangan, evaluasi, dan laporan OJT."
                  />

                  <div className="ojt-quick-menu">
                    <MenuCard
                      icon="chart"
                      title="Grafik Perkembangan"
                      description="Lihat grafik perkembangan OJT Anda."
                      disabled={!hasActiveProgram}
                      onClick={() =>
                        openParticipantFeature(
                          `/analisis/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="check"
                      title="Evaluasi Kesiapan"
                      description="Buka evaluasi kesiapan OJT."
                      disabled={!hasActiveProgram}
                      onClick={() =>
                        openParticipantFeature(
                          `/evaluasi/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="file"
                      title="Laporan OJT"
                      description="Lihat laporan OJT Anda."
                      disabled={!hasActiveProgram}
                      onClick={() =>
                        openParticipantFeature(
                          `/laporan/${program.id}`
                        )
                      }
                    />

                    {isAdmin && (
                      <MenuCard
                        icon="calendar"
                        title="Evaluasi Mingguan"
                        description="Lihat evaluasi mingguan dan fasilitas cetak atau PDF."
                        disabled={!hasActiveProgram}
                        onClick={() =>
                          openParticipantFeature(
                            `/mingguan/${program.id}`
                          )
                        }
                      />
                    )}
                  </div>

                  {isAdmin && (
                    <p className="ojt-admin-note">
                      Akses lanjutan mengikuti validasi
                      role dan kebijakan RLS tiap
                      halaman. Preview Admin tidak
                      menambahkan izin penulisan.
                    </p>
                  )}
                </section>
              </>
            )}

            <div className="ojt-actions">
              <button
                type="button"
                className="ojt-primary-button"
                disabled={refreshing}
                onClick={() => loadDashboard(true)}
              >
                <Icon name="refresh" size={19} />
                {refreshing
                  ? "Memperbarui..."
                  : "Perbarui Status"}
              </button>

              <button
                type="button"
                className="ojt-outline-button"
                disabled={loggingOut}
                onClick={logout}
              >
                <Icon name="logout" size={19} />
                {loggingOut
                  ? "Sedang keluar..."
                  : "Keluar dari Akun"}
              </button>
            </div>

            <footer className="ojt-footer">
              <span>
                OJT MineTrack v2.0 · Emergency Response Group
              </span>

              <span>
                PT Berau Coal · Program 2026–2027
              </span>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

// =====================================================
// CSS RESPONSIVE — CORPORATE NAVY & EMERALD
// =====================================================

const dashboardCSS = `
.ojt-dashboard,
.ojt-dashboard * {
  box-sizing: border-box;
}

.ojt-dashboard {
  min-height: 100vh;
  background: ${C.bg};
  color: ${C.text};
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  padding-bottom: 25px;
}

.ojt-dashboard button,
.ojt-dashboard select {
  font: inherit;
}

.ojt-dashboard button {
  cursor: pointer;
}

.ojt-dashboard button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.ojt-dashboard button:focus-visible,
.ojt-dashboard select:focus-visible {
  outline: 3px solid #5edfc1;
  outline-offset: 2px;
}

.ojt-topbar {
  min-height: 74px;
  padding: 12px 25px;
  background: ${C.navy};
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.ojt-brand {
  display: flex;
  align-items: center;
  gap: 11px;
  background: transparent;
  border: 0;
  color: white;
  padding: 0;
  text-align: left;
  min-width: 0;
}

.ojt-logo {
  display: grid;
  place-items: center;
  background: #0d665c;
  color: #84f3d5;
  width: 43px;
  height: 43px;
  border-radius: 11px;
  border: 1px solid #2ea99c;
  flex-shrink: 0;
}

.ojt-brand-text > strong {
  display: block;
  font-size: 21px;
  font-weight: 900;
  line-height: 1.15;
}

.ojt-brand-text em {
  color: ${C.turquoise};
  font-style: normal;
}

.ojt-brand-text strong small {
  display: inline-block;
  margin-left: 7px;
  padding: 4px 5px;
  border-radius: 5px;
  background: ${C.turquoise};
  color: ${C.navy};
  font-size: 9px;
  vertical-align: middle;
}

.ojt-brand-text > span {
  display: block;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-top: 5px;
  color: #bcd7e7;
}

.ojt-topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ojt-topbar-avatar {
  width: 37px;
  height: 37px;
  border-radius: 50%;
  background: #d9fbed;
  color: ${C.emerald};
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 900;
  flex-shrink: 0;
}

.ojt-topbar-account strong,
.ojt-topbar-account small {
  display: block;
}

.ojt-topbar-account strong {
  font-size: 11px;
}

.ojt-topbar-account small {
  font-size: 10px;
  color: #bbd4df;
  margin-top: 3px;
}

.ojt-menu-toggle {
  border: 0;
  background: transparent;
  color: white;
  display: grid;
  place-items: center;
  padding: 8px;
  margin-left: 12px;
}

.ojt-mobile-menu {
  padding: 10px 20px;
  background: ${C.navy2};
  display: grid;
  gap: 5px;
}

.ojt-mobile-menu button {
  padding: 12px;
  border: 0;
  border-radius: 8px;
  text-align: left;
  background: transparent;
  color: white;
  font-size: 12px;
}

.ojt-mobile-menu button:hover {
  background: #ffffff20;
}

.ojt-content {
  max-width: 1330px;
  margin: 0 auto;
  padding: 22px;
  display: grid;
  gap: 15px;
}

.ojt-hero {
  background-color: ${C.navy};
  background-size: cover;
  background-position: center;
  border-radius: 16px;
  color: white;
  padding: 29px 33px;
  box-shadow: 0 7px 20px #102f461c;
}

.ojt-eyebrow {
  color: ${C.gold};
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.3px;
}

.ojt-hero h1 {
  margin: 11px 0 9px;
  font-size: clamp(26px, 3vw, 39px);
  letter-spacing: -.5px;
}

.ojt-hero h1 span {
  color: ${C.turquoise};
}

.ojt-hero-description {
  font-size: 12px;
  line-height: 1.7;
  color: #daeaf2;
  margin: 0;
}

.ojt-hero-bottom {
  margin-top: 22px;
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 25px;
  align-items: center;
}

.ojt-hero-identity {
  display: flex;
  align-items: center;
  gap: 13px;
  min-width: 0;
}

.ojt-hero-avatar {
  width: 55px;
  height: 55px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #d9faed;
  display: grid;
  place-items: center;
  color: ${C.emerald};
  font-size: 20px;
  font-weight: 900;
}

.ojt-hero-identity > div:nth-child(2) {
  min-width: 0;
}

.ojt-hero-identity strong,
.ojt-hero-identity small {
  display: block;
  overflow-wrap: anywhere;
}

.ojt-hero-identity strong {
  font-size: 19px;
}

.ojt-hero-identity small {
  margin-top: 4px;
  color: #dceaf1;
  font-size: 11px;
}

.ojt-hero-status {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 9px;
  padding: 9px 11px;
  background: #d7fae9;
  color: #076b54;
  font-size: 11px;
  font-weight: 900;
  margin-left: 10px;
  flex-shrink: 0;
}

.ojt-hero-progress {
  border-left: 1px solid #ffffff55;
  padding-left: 24px;
}

.ojt-hero-progress > small {
  display: block;
  font-size: 10px;
  letter-spacing: .8px;
  color: #cfe1ed;
  font-weight: 800;
}

.ojt-hero-progress > strong {
  display: block;
  font-size: 32px;
  margin: 7px 0;
}

.ojt-hero-progress > strong span {
  font-size: 12px;
  font-weight: 500;
  color: #d8e5ee;
}

.ojt-hero-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ojt-hero-track {
  flex: 1;
  background: #486176;
  border-radius: 99px;
  height: 11px;
  overflow: hidden;
}

.ojt-hero-track > div {
  height: 100%;
  border-radius: inherit;
  background: ${C.turquoise};
}

.ojt-hero-progress-row b {
  min-width: 35px;
  font-size: 12px;
  text-align: right;
}

.ojt-notice {
  padding: 15px 17px;
  background: white;
  border: 1px solid ${C.border};
  border-radius: 11px;
  color: ${C.text};
  font-size: 12px;
}

.ojt-notice.error {
  background: #fff0f2;
  color: ${C.red};
  border-color: #f5cbd1;
  display: flex;
  align-items: center;
  gap: 9px;
}

.ojt-admin-panel {
  padding: 20px;
  border-radius: 14px;
  background: #e4f6f0;
  border: 1px solid #a3dccc;
  display: grid;
  gap: 12px;
}

.ojt-admin-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: ${C.emerald};
}

.ojt-admin-heading strong {
  font-size: 15px;
}

.ojt-admin-heading p,
.ojt-admin-panel > p {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: #497366;
}

.ojt-admin-panel label {
  font-weight: 800;
  font-size: 12px;
}

.ojt-admin-panel select {
  width: 100%;
  padding: 12px;
  border: 1px solid ${C.border};
  border-radius: 10px;
  background: white;
  color: ${C.text};
}

.ojt-message {
  border-radius: 13px;
  padding: 19px;
  font-size: 12px;
  line-height: 1.7;
  border: 1px solid ${C.border};
}

.ojt-message h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 10px;
  font-size: 17px;
}

.ojt-message p {
  margin: 7px 0;
}

.ojt-message.amber {
  background: #fff7e9;
  color: #805714;
  border-color: #f2d8a2;
}

.ojt-message.red {
  background: #fff1f3;
  color: #a52f42;
  border-color: #f2c7ce;
}

.ojt-message.neutral {
  background: white;
  color: ${C.text};
}

.ojt-rejection-reason {
  background: white;
  border-radius: 9px;
  padding: 12px;
  margin: 13px 0;
}

.ojt-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 13px;
}

.ojt-stat {
  border-radius: 14px;
  padding: 19px;
  min-width: 0;
  min-height: 112px;
  display: flex;
  align-items: center;
  gap: 13px;
  background: white;
  border: 1px solid ${C.border};
  box-shadow: 0 5px 18px #1035500a;
}

.ojt-stat-icon {
  width: 43px;
  height: 43px;
  border-radius: 12px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}

.ojt-stat-icon.blue {
  color: #127dc4;
  background: #dfedfc;
}

.ojt-stat-icon.gold {
  color: #c28b26;
  background: #fff0d5;
}

.ojt-stat-icon.green {
  color: ${C.emerald};
  background: #dcf7ec;
}

.ojt-stat-copy {
  min-width: 0;
}

.ojt-stat-copy > span {
  display: block;
  color: ${C.muted};
  font-size: 11px;
  font-weight: 700;
}

.ojt-stat-copy > strong {
  display: block;
  margin-top: 6px;
  color: #123c71;
  font-size: 20px;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.ojt-stat-copy > small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: ${C.muted};
}

.ojt-panel-title {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 19px;
}

.ojt-panel-icon {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border-radius: 10px;
  background: linear-gradient(135deg, #12548f, #1ba6d4);
  color: white;
}

.ojt-panel-title h2 {
  margin: 0;
  color: #123d71;
  font-size: 18px;
}

.ojt-panel-title p {
  margin: 5px 0 0;
  color: ${C.muted};
  font-size: 11px;
  line-height: 1.55;
}

.ojt-week-selector {
  display: flex;
  align-items: stretch;
  gap: 8px;
  margin-bottom: 16px;
}

.ojt-week-nav {
  width: 38px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  background: white;
  border: 1px solid ${C.border};
  border-radius: 10px;
  color: #1b4b76;
}

.ojt-week-scroll {
  flex: 1;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  scrollbar-width: thin;
}

.ojt-week-button {
  flex: 0 0 76px;
  min-height: 70px;
  background: #f7fafc;
  border: 1px solid ${C.border};
  border-radius: 11px;
  color: #174472;
  padding: 11px 7px;
  text-align: center;
}

.ojt-week-button strong,
.ojt-week-button small {
  display: block;
}

.ojt-week-button strong {
  font-size: 14px;
}

.ojt-week-button small {
  color: #7b91a5;
  margin-top: 7px;
  font-size: 10px;
}

.ojt-week-button.selected {
  background: #087c67;
  border-color: #087c67;
  color: white;
  box-shadow: 0 0 0 2px #b7eadb;
}

.ojt-week-button.selected small {
  color: #d9fff1;
}

.ojt-selected-week {
  display: grid;
  grid-template-columns: minmax(190px, .8fr) minmax(0, 2fr);
  border: 1px solid ${C.border};
  border-radius: 13px;
  overflow: hidden;
}

.ojt-selected-week-info {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 11px;
  padding: 22px;
  background: linear-gradient(140deg, #def7ed, #f1faf7);
  color: #0d5c4e;
}

.ojt-week-kicker {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .8px;
}

.ojt-selected-week-info > strong {
  font-size: 31px;
  color: #0b3e56;
}

.ojt-selected-week-info > span:nth-of-type(2) {
  font-size: 11px;
  color: #456e70;
}

.ojt-data-badge {
  background: #e5ebee;
  border-radius: 20px;
  padding: 7px 10px;
  font-size: 10px;
  font-weight: 800;
  color: #627c8d;
}

.ojt-data-badge.has-data {
  color: #067f64;
  background: #c8f5df;
}

.ojt-week-details {
  padding: 21px;
  min-width: 0;
}

.ojt-week-details-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.ojt-week-details-title strong {
  font-size: 15px;
  color: #123d71;
}

.ojt-week-details-title > span {
  background: #eff6fa;
  color: #486f8c;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
}

.ojt-week-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.ojt-week-metric {
  padding: 12px 8px;
  background: #f3f8fb;
  border-radius: 10px;
  text-align: center;
}

.ojt-week-metric span {
  display: block;
  color: ${C.muted};
  font-size: 10px;
}

.ojt-week-metric strong {
  display: block;
  color: #0e477b;
  font-size: 23px;
  margin-top: 7px;
}

.ojt-week-verification {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #087d67;
  background: #ecfaf3;
  border-radius: 9px;
  padding: 11px 13px;
  margin-top: 13px;
  font-size: 11px;
}

.ojt-week-note {
  font-size: 10px;
  line-height: 1.7;
  color: ${C.muted};
}

.ojt-week-detail-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 13px;
  margin-top: 4px;
  background: white;
  color: #0c567c;
  border: 1px solid #c9dce9;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 800;
}

.ojt-dual-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
}

.ojt-progress-item {
  margin-top: 12px;
}

.ojt-progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.ojt-progress-value {
  color: ${C.emerald};
}

.ojt-progress-track {
  width: 100%;
  height: 11px;
  background: #e4ebee;
  border-radius: 20px;
  overflow: hidden;
  margin-top: 11px;
}

.ojt-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0b8068, #41c4a4);
  border-radius: 20px;
}

.ojt-progress-desc {
  font-size: 11px;
  line-height: 1.7;
  color: ${C.muted};
  margin: 9px 0 0;
}

.ojt-simper-status {
  margin-top: 13px;
  padding: 11px;
  border-radius: 9px;
  background: #f1f7f5;
  color: #275e52;
  font-size: 11px;
}

.ojt-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ojt-summary-item {
  padding: 15px;
  border-radius: 11px;
  background: #f2f8f9;
  border: 1px solid #e1ebee;
}

.ojt-summary-item > span {
  display: block;
  font-size: 10px;
  color: ${C.muted};
  font-weight: 700;
}

.ojt-summary-item > strong {
  display: block;
  margin-top: 8px;
  font-size: 23px;
  color: #123d71;
}

.ojt-summary-note {
  color: ${C.muted};
  font-size: 10px;
  line-height: 1.7;
  margin: 15px 0 0;
}

.ojt-quick-menu {
  display: grid;
  gap: 10px;
}

.ojt-menu-card {
  display: flex;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 14px 15px;
  background: white;
  border: 1px solid ${C.border};
  border-radius: 12px;
  color: #173f67;
  text-align: left;
}

.ojt-menu-card:hover:not(:disabled) {
  background: #f7fbfd;
}

.ojt-menu-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #fff2d9;
  display: grid;
  place-items: center;
  color: #be8728;
}

.ojt-menu-copy {
  flex: 1;
  min-width: 0;
}

.ojt-menu-copy strong,
.ojt-menu-copy small {
  display: block;
}

.ojt-menu-copy strong {
  font-size: 13px;
}

.ojt-menu-copy small {
  font-size: 11px;
  line-height: 1.5;
  margin-top: 4px;
  color: ${C.muted};
}

.ojt-disabled-text {
  color: ${C.yellow} !important;
  font-weight: 800;
}

.ojt-menu-card > svg:last-child {
  color: #869db1;
  flex-shrink: 0;
}

.ojt-admin-note {
  font-size: 10px;
  color: ${C.muted};
  line-height: 1.7;
  margin: 14px 0 0;
}

.ojt-actions {
  display: grid;
  gap: 10px;
}

.ojt-primary-button,
.ojt-outline-button {
  min-height: 53px;
  padding: 12px;
  width: 100%;
  border-radius: 11px;
  font-weight: 800;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.ojt-primary-button {
  color: white;
  background: #146b56;
  border: 1px solid #146b56;
}

.ojt-outline-button {
  background: white;
  color: #193d64;
  border: 1px solid #cddce7;
}

.ojt-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  border-top: 1px solid #d7e4ec;
  padding: 17px 2px;
  color: ${C.muted};
  font-size: 10px;
}

@media (max-width: 900px) {
  .ojt-hero-bottom {
    grid-template-columns: 1fr;
  }

  .ojt-hero-progress {
    border-left: 0;
    border-top: 1px solid #ffffff55;
    padding: 16px 0 0;
  }

  .ojt-selected-week {
    grid-template-columns: 1fr;
  }

  .ojt-selected-week-info {
    gap: 7px;
  }

  .ojt-stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ojt-dual-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .ojt-topbar {
    padding: 12px;
    min-height: 64px;
  }

  .ojt-logo {
    width: 37px;
    height: 37px;
  }

  .ojt-brand-text > strong {
    font-size: 17px;
  }

  .ojt-brand-text > span {
    font-size: 6px;
    letter-spacing: .5px;
  }

  .ojt-topbar-account {
    display: none;
  }

  .ojt-menu-toggle {
    margin-left: 1px;
  }

  .ojt-content {
    padding: 11px;
    gap: 12px;
  }

  .ojt-hero {
    padding: 22px 18px;
    border-radius: 13px;
  }

  .ojt-hero h1 {
    font-size: 27px;
  }

  .ojt-hero-identity {
    gap: 9px;
    flex-wrap: wrap;
  }

  .ojt-hero-avatar {
    width: 43px;
    height: 43px;
    font-size: 17px;
  }

  .ojt-hero-identity strong {
    font-size: 16px;
  }

  .ojt-hero-status {
    margin-left: 0;
  }

  .ojt-stats-grid {
    gap: 9px;
  }

  .ojt-stat {
    padding: 12px;
    min-height: 115px;
    gap: 9px;
  }

  .ojt-stat-icon {
    width: 34px;
    height: 34px;
  }

  .ojt-stat-copy > strong {
    font-size: 16px;
  }

  .ojt-stats-grid > :nth-child(2) {
    grid-column: span 1;
  }

  .ojt-stats-grid > :nth-child(3) {
    grid-column: span 2;
  }

  .ojt-panel-title h2 {
    font-size: 16px;
  }

  .ojt-panel-icon {
    width: 39px;
    height: 39px;
  }

  .ojt-week-scroll {
    gap: 7px;
  }

  .ojt-week-button {
    flex-basis: 69px;
  }

  .ojt-week-details {
    padding: 14px;
  }

  .ojt-selected-week-info {
    padding: 16px;
  }

  .ojt-week-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ojt-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .ojt-summary-item {
    padding: 10px 7px;
    text-align: center;
  }

  .ojt-summary-item > strong {
    font-size: 18px;
  }

  .ojt-summary-item > span {
    font-size: 9px;
  }

  .ojt-footer {
    justify-content: center;
    text-align: center;
  }
}
`;
