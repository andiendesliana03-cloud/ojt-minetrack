"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

/*
=====================================================
OJT MINETRACK V2.0
MONITORING PESERTA MENTOR
DESAIN TERINTEGRASI DASHBOARD MENTOR
=====================================================

DESAIN:
- Sidebar Mentor
- Header Emergency Response Group
- Background ERG Light & Dark
- Glassmorphism panels
- Responsive desktop, tablet, mobile

DIPERTAHANKAN:
- Supabase dan struktur database
- Hak akses Admin dan Mentor
- Filter pencarian, site dan status
- Refresh manual dan otomatis
- Kalender global Week 01–25
- Rumus progres Achievement
- Ringkasan Post-Test, Praktik, Samapta, SIMPER
- Navigasi detail peserta
- Light & Dark Mode global

Tidak menambahkan tabel atau kolom database.
Theme toggle tetap hanya di Dashboard utama.
=====================================================
*/

// =====================================================
// CONSTANTS
// =====================================================

const TOTAL_WEEKS = 25;
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
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

// =====================================================
// GENERAL HELPERS
// =====================================================

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeKey = (value) =>
  normalize(value).replace(/[^a-z0-9]/g, "");

function normalizeSite(value) {
  return String(value ?? "").trim().toUpperCase();
}

// =====================================================
// DATE HELPERS
// =====================================================

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(
      +match[1],
      +match[2] - 1,
      +match[3]
    )
  );

  if (
    date.getUTCFullYear() !== +match[1] ||
    date.getUTCMonth() !== +match[2] - 1 ||
    date.getUTCDate() !== +match[3]
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

// =====================================================
// GLOBAL CALENDAR WEEK 01–25
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
      (week) =>
        date >= week.start &&
        date <= week.end
    )?.week ?? null
  );
}

// =====================================================
// PROGRAM DATE RANGE
// =====================================================

function programWeekRange(program, weekNumber) {
  const week = GLOBAL_WEEKS[weekNumber - 1];

  if (
    !week ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const programStart = String(
    program.start_date
  ).slice(0, 10);

  const programEnd = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    week.start > programStart
      ? week.start
      : programStart;

  const end =
    programEnd && programEnd < week.end
      ? programEnd
      : week.end;

  return start <= end ? { start, end } : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  const start = String(
    program.start_date
  ).slice(0, 10);

  const end = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  return (
    date >= start &&
    (!end || date <= end) &&
    globalWeekOf(date) !== null
  );
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

function formatNumber(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "—";
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

// =====================================================
// ACHIEVEMENT CATEGORY
// =====================================================

function categoryOf(value) {
  const key = normalizeKey(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    [
      "training",
      "internaltraining",
      "pelatihan",
    ].includes(key)
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (
    ["coaching", "pembinaan"].includes(key)
  ) {
    return "Coaching";
  }

  if (
    [
      "orientasi",
      "orientasiarea",
      "areaorientation",
    ].includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    [
      "hazard",
      "hazardidentification",
      "identifikasibahaya",
    ].includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function resolveCategory(record, typeMap) {
  return (
    categoryOf(record.type_code) ||
    categoryOf(
      typeMap.get(normalizeKey(record.type_code))
    ) ||
    null
  );
}

// =====================================================
// SCORE CALCULATIONS
// =====================================================

function averageScore(rows) {
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

  return values.length
    ? values.reduce((sum, value) => sum + value, 0) /
        values.length
    : null;
}

function programLabel(value) {
  const labels = {
    active: "Aktif",
    approved: "Disetujui",
    aktif: "Aktif",
    completed: "Selesai",
    finished: "Selesai",
    pending: "Menunggu",
    cancelled: "Dibatalkan",
  };

  return labels[normalize(value)] || value || "—";
}

function simperLabel(record) {
  if (!record) return "Belum Ada Data";

  const status = normalize(record.status);

  const labels = {
    passed: "Lulus",
    failed: "Tidak Lulus",
    in_progress: "Dalam Proses",
    not_started: "Belum Mulai",
    completed: "Selesai",
  };

  return labels[status] || record.status || "Dalam Proses";
}

function getParticipant(program) {
  return Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;
}

// =====================================================
// ACTIVITY VALUES
// RUMUS ASLI
// =====================================================

function activityValue(rows, categoryName) {
  if (categoryName !== "Fisik") {
    return rows.length;
  }

  const meters = rows.reduce((sum, item) => {
    const km = Number(item.distance_km);

    return (
      sum +
      (
        Number.isFinite(km) && km > 0
          ? Math.round(km * 1000)
          : 0
      )
    );
  }, 0);

  return meters / 1000;
}

// =====================================================
// CALCULATE PROGRESS
// RUMUS ASLI
// =====================================================

function calculateProgress(program, records, typeMap) {
  const eligibleWeeks = GLOBAL_WEEKS.filter(
    (week) =>
      programWeekRange(program, week.week)
  );

  const validRecords = records.filter(
    (record) =>
      normalize(record.status) === "verified" &&
      insideProgram(record.activity_date, program)
  );

  const categoryDetails = TARGETS.map((target) => {
    const matching = validRecords.filter(
      (record) =>
        resolveCategory(record, typeMap) === target.name
    );

    const weekly = eligibleWeeks.map((week) => {
      const rows = matching.filter(
        (record) =>
          globalWeekOf(record.activity_date) === week.week
      );

      const amount = activityValue(rows, target.name);

      return {
        week: week.week,
        amount,
        percent: Math.max(
          0,
          Math.min(
            100,
            (amount / target.target) * 100
          )
        ),
        achieved: amount >= target.target,
      };
    });

    const percent = weekly.length
      ? weekly.reduce(
          (sum, item) => sum + item.percent,
          0
        ) / weekly.length
      : 0;

    return {
      ...target,
      percent,
      completedWeeks: weekly.filter(
        (item) => item.achieved
      ).length,
    };
  });

  const overall = categoryDetails.length
    ? categoryDetails.reduce(
        (sum, item) => sum + item.percent,
        0
      ) / categoryDetails.length
    : 0;

  const activeWeeks = new Set(
    validRecords
      .map((item) => globalWeekOf(item.activity_date))
      .filter(Boolean)
  ).size;

  return {
    overall,
    categoryDetails,
    verified: validRecords.length,

    completedCategories: categoryDetails.filter(
      (item) =>
        eligibleWeeks.length > 0 &&
        item.completedWeeks === eligibleWeeks.length
    ).length,

    activeWeeks,
    eligibleWeeks: eligibleWeeks.length,
  };
}

// =====================================================
// UI COMPONENTS
// =====================================================

function ProgressBar({ value }) {
  const safe = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div
      className="mp-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function StatCard({ icon, label, value, note }) {
  return (
    <div className="mp-stat">
      <span className="mp-stat-icon">{icon}</span>

      <div className="mp-stat-content">
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

function SidebarItem({
  icon,
  label,
  active = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`mp-nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="mp-nav-icon">{icon}</span>
      <span>{label}</span>
      {active && <span className="mp-nav-active-dot" />}
    </button>
  );
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function MonitoringPesertaPage() {
  const router = useRouter();

  // ===================================================
  // APPLICATION STATE
  // ===================================================

  const [account, setAccount] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const role = normalize(account?.role);
  const isAdmin = role === "admin";

  // ===================================================
  // FETCH DATA
  // ===================================================

  const fetchDashboardData = useCallback(
    async (userId, userRole) => {
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
          peserta:profiles!ojt_programs_participant_id_fkey(
            id,
            full_name,
            department,
            role
          )
        `)
        .order("start_date", {
          ascending: false,
        });

      if (userRole === "mentor") {
        query = query.eq("mentor_id", userId);
      }

      const [programResult, typeResult] =
        await Promise.all([
          query,
          supabase
            .from("achievement_types")
            .select("code,name"),
        ]);

      if (programResult.error) {
        throw new Error(
          `Program OJT: ${programResult.error.message}`
        );
      }

      if (typeResult.error) {
        throw new Error(
          `Kategori: ${typeResult.error.message}`
        );
      }

      const validPrograms = (
        programResult.data || []
      )
        .filter((item) => {
          const participant = getParticipant(item);

          return (
            participant &&
            participant.id === item.participant_id &&
            ["participant", "peserta"].includes(
              normalize(participant.role)
            )
          );
        })
        .map((item) => ({
          ...item,
          peserta: getParticipant(item),
        }));

      const ids = validPrograms.map((item) => item.id);

      if (!ids.length) {
        return {
          programs: [],
          types: typeResult.data || [],
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
            "id,program_id,type_code,activity_date,status,distance_km"
          )
          .in("program_id", ids),

        supabase
          .from("post_test_scores")
          .select("id,program_id,test_date,score")
          .in("program_id", ids),

        supabase
          .from("weekly_practice_scores")
          .select("id,program_id,practice_date,score")
          .in("program_id", ids),

        supabase
          .from("samapta_records")
          .select(
            "id,program_id,test_date,test_type,score,result_value"
          )
          .in("program_id", ids),

        supabase
          .from("simper_records")
          .select("id,program_id,status,notes")
          .in("program_id", ids),
      ]);

      const names = [
        "Achievement",
        "Post-Test",
        "Praktik",
        "Samapta",
        "SIMPER",
      ];

      results.forEach((result, index) => {
        if (result.error) {
          throw new Error(
            `${names[index]}: ${result.error.message}`
          );
        }
      });

      return {
        programs: validPrograms,
        types: typeResult.data || [],
        achievements: results[0].data || [],
        postTests: results[1].data || [],
        practices: results[2].data || [],
        samapta: results[3].data || [],
        simper: results[4].data || [],
      };
    },
    []
  );

  // ===================================================
  // APPLY DATA
  // ===================================================

  const applyData = useCallback((data) => {
    setPrograms(data.programs);
    setTypes(data.types);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractices(data.practices);
    setSamapta(data.samapta);
    setSimper(data.simper);
    setLastUpdated(new Date());
  }, []);

  // ===================================================
  // VERIFY ACCESS
  // ===================================================

  const verifyAccess = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return null;
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

    const currentRole = normalize(profile.role);

    if (
      ["participant", "peserta"].includes(currentRole)
    ) {
      router.replace("/dashboard-peserta");
      return null;
    }

    if (!["admin", "mentor"].includes(currentRole)) {
      throw new Error(
        "Monitoring Peserta hanya tersedia untuk Admin dan Mentor."
      );
    }

    return {
      user,
      profile,
      currentRole,
    };
  }, [router]);

  // ===================================================
  // INITIALIZE
  // ===================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const access = await verifyAccess();

        if (!access || !active) return;

        const data = await fetchDashboardData(
          access.user.id,
          access.currentRole
        );

        if (!active) return;

        setAccount(access.profile);
        applyData(data);
        setAccessError(false);
      } catch (err) {
        if (!active) return;

        setAccessError(true);
        setError(
          err?.message ||
            "Gagal memuat Monitoring Peserta."
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
    verifyAccess,
    fetchDashboardData,
    applyData,
  ]);

  // ===================================================
  // REFRESH
  // ===================================================

  const refresh = useCallback(
    async (silent = false) => {
      if (!account || loading || refreshing) return;

      if (!silent) setRefreshing(true);

      setError("");

      try {
        const access = await verifyAccess();

        if (!access) return;

        if (access.user.id !== account.id) {
          setAccessError(true);
          setPrograms([]);

          throw new Error(
            "Akun login berubah. Silakan buka ulang halaman."
          );
        }

        const data = await fetchDashboardData(
          access.user.id,
          access.currentRole
        );

        setAccount(access.profile);
        applyData(data);
        setAccessError(false);
      } catch (err) {
        setError(
          err?.message ||
            "Gagal memperbarui data peserta."
        );
      } finally {
        setRefreshing(false);
      }
    },
    [
      account,
      loading,
      refreshing,
      verifyAccess,
      fetchDashboardData,
      applyData,
    ]
  );

  // ===================================================
  // AUTO REFRESH 60 SECONDS
  // ===================================================

  useEffect(() => {
    if (!account || accessError) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [account, accessError, refresh]);

  // ===================================================
  // TYPE MAP
  // ===================================================

  const typeMap = useMemo(
    () =>
      new Map(
        types.map((item) => [
          normalizeKey(item.code),
          item.name,
        ])
      ),
    [types]
  );

  // ===================================================
  // DATA BY PROGRAM
  // ===================================================

  const dataByProgram = useMemo(() => {
    const output = {};

    programs.forEach((program) => {
      const id = program.id;

      const achievementsForProgram = achievements.filter(
        (item) => item.program_id === id
      );

      const post = postTests.filter(
        (item) => item.program_id === id
      );

      const practice = practices.filter(
        (item) => item.program_id === id
      );

      const samaptaRows = samapta.filter(
        (item) => item.program_id === id
      );

      const simperRows = simper.filter(
        (item) => item.program_id === id
      );

      const progress = calculateProgress(
        program,
        achievementsForProgram,
        typeMap
      );

      const latestSimper =
        simperRows.find((item) =>
          String(item.notes || "").includes(
            "[[SIMPER_V2]]"
          )
        ) ||
        simperRows[0] ||
        null;

      output[id] = {
        ...progress,

        postAverage: averageScore(post),
        practiceAverage: averageScore(practice),
        samaptaRecords: samaptaRows.length,

        simperStatus: simperLabel(latestSimper),

        totalAchievements:
          achievementsForProgram.filter((item) =>
            insideProgram(item.activity_date, program)
          ).length,
      };
    });

    return output;
  }, [
    programs,
    achievements,
    postTests,
    practices,
    samapta,
    simper,
    typeMap,
  ]);

  // ===================================================
  // FILTER PROGRAMS
  // ===================================================

  const filtered = useMemo(() => {
    const keyword = normalize(search);

    return programs.filter((program) => {
      const participant = program.peserta || {};

      const matchesSearch =
        !keyword ||
        normalize(
          `${participant.full_name || ""} ${
            participant.department || ""
          }`
        ).includes(keyword);

      const programSite = normalizeSite(program.site);

      const matchesSite =
        selectedSite === "ALL" ||
        (
          selectedSite === "UNASSIGNED"
            ? !programSite
            : programSite === selectedSite
        );

      const matchesStatus =
        selectedStatus === "ALL" ||
        normalize(program.status) === selectedStatus;

      return (
        matchesSearch &&
        matchesSite &&
        matchesStatus
      );
    });
  }, [
    programs,
    search,
    selectedSite,
    selectedStatus,
  ]);

  // ===================================================
  // SUMMARY COUNTERS
  // ===================================================

  const activeCount = programs.filter(
    (item) =>
      ["active", "approved", "aktif"].includes(
        normalize(item.status)
      )
  ).length;

  const siteCount = programs.filter(
    (item) =>
      SITES.includes(normalizeSite(item.site))
  ).length;

  const averageProgress = filtered.length
    ? filtered.reduce(
        (sum, program) =>
          sum +
          (dataByProgram[program.id]?.overall || 0),
        0
      ) / filtered.length
    : 0;

  const totalVerified = filtered.reduce(
    (sum, program) =>
      sum +
      (dataByProgram[program.id]?.verified || 0),
    0
  );

  const availableSites = [
    ...new Set([
      ...SITES,
      ...programs
        .map((item) => normalizeSite(item.site))
        .filter(Boolean),
    ]),
  ];

  // ===================================================
  // LOADING SCREEN
  // ===================================================

  if (loading) {
    return (
      <main className="mp-loading">
        <style>{css}</style>

        <div className="mp-loading-card">
          <div className="mp-loading-logo">
            OJT <span>MineTrack</span>
          </div>

          <div className="mp-loader" />

          <h2>Monitoring Peserta OJT</h2>

          <p>
            Memuat data Emergency Response Group...
          </p>
        </div>
      </main>
    );
  }

  // ===================================================
  // ACCESS ERROR
  // ===================================================

  if (!account || accessError) {
    return (
      <main className="mp-loading">
        <style>{css}</style>

        <div className="mp-loading-card">
          <div className="mp-loading-logo">
            OJT <span>MineTrack</span>
          </div>

          <div className="mp-error-icon">!</div>

          <h2>Monitoring Peserta Tidak Dapat Ditampilkan</h2>

          <p>{error || "Akses tidak tersedia."}</p>

          <button
            type="button"
            className="mp-primary-button"
            onClick={() => router.push("/")}
          >
            ← Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ===================================================
  // MAIN RENDER
  // ===================================================

  return (
    <main className="mp-root">
      <style>{css}</style>

      <div className="mp-shell">

        {/* ==========================================
            SIDEBAR
            ========================================== */}

        <aside className="mp-sidebar">

          <div className="mp-sidebar-brand">
            <div className="mp-brand">
              OJT <span>MineTrack</span>
              <small>v2.0</small>
            </div>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>
          </div>

          <div className="mp-sidebar-divider" />

          <div className="mp-sidebar-label">
            MENU MENTOR
          </div>

          <nav className="mp-nav">

            <SidebarItem
              icon="⌂"
              label="Dashboard Mentor"
              onClick={() => router.push("/")}
            />

            <SidebarItem
              icon="▤"
              label="Monitoring Peserta"
              active
              onClick={() => {}}
            />

            <SidebarItem
              icon="♙"
              label="Peserta OJT"
              onClick={() =>
                router.push("/mentor/daftar-peserta")
              }
            />

            <SidebarItem
              icon="▣"
              label="Pendaftaran Peserta"
              onClick={() =>
                router.push("/mentor/daftar-peserta")
              }
            />

            <SidebarItem
              icon="☑"
              label="Persetujuan Peserta"
              onClick={() =>
                router.push("/mentor/persetujuan-peserta")
              }
            />

          </nav>

          <div className="mp-sidebar-divider" />

          <div className="mp-sidebar-label">
            PENGELOLAAN OJT
          </div>

          <div className="mp-sidebar-info">
            <div className="mp-sidebar-info-icon">
              ◈
            </div>

            <div>
              <strong>Monitoring OJT</strong>
              <small>
                Program dan pencapaian peserta
              </small>
            </div>
          </div>

          <div className="mp-sidebar-bottom">

            <button
              type="button"
              onClick={() => refresh(false)}
              disabled={refreshing}
            >
              <span>↻</span>
              {refreshing ? "Memperbarui..." : "Refresh Data"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/")}
            >
              <span>←</span>
              Kembali ke Dashboard
            </button>

          </div>

          <div className="mp-sidebar-version">
            OJT MineTrack v2.0
            <br />
            Emergency Response Group
          </div>

        </aside>

        {/* ==========================================
            MAIN CONTENT
            ========================================== */}

        <div className="mp-main">

          {/* ========================================
              TOPBAR
              ======================================== */}

          <header className="mp-topbar">

            <div className="mp-topbar-left">
              <small>
                EMERGENCY RESPONSE GROUP — PT BERAU COAL
              </small>

              <strong>
                Monitoring Peserta OJT
              </strong>
            </div>

            <div className="mp-account">

              <div className="mp-avatar">
                {initials(account.full_name)}
              </div>

              <div>
                <strong>
                  {account.full_name || "Pengguna"}
                </strong>

                <small>
                  {isAdmin ? "Administrator" : "Mentor OJT"}
                </small>
              </div>

            </div>

          </header>

          <div className="mp-container">

            {/* ======================================
                HERO
                ====================================== */}

            <section className="mp-hero">

              <div className="mp-hero-content">

                <div className="mp-eyebrow">
                  <span className="mp-live-dot" />
                  OJT PERFORMANCE MONITORING
                </div>

                <h1>
                  Monitoring Peserta
                  <span> OJT MineTrack</span>
                </h1>

                <p>
                  Monitoring progres kompetensi, pencapaian
                  kegiatan, dan evaluasi peserta On Job Training
                  secara terintegrasi.
                </p>

                <div className="mp-hero-tags">
                  <span>🛡 Safe People</span>
                  <span>☀ Safe Operation</span>
                  <span>♻ Sustainable Mining</span>
                </div>

              </div>

              <div className="mp-hero-actions">

                <button
                  type="button"
                  onClick={() => router.push("/mentor/daftar-peserta")}
                >
                  + Daftarkan Peserta
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/mentor/persetujuan-peserta")
                  }
                >
                  Persetujuan Peserta →
                </button>

              </div>

            </section>

            {/* ======================================
                ERROR
                ====================================== */}

            {error && (
              <div className="mp-error" role="alert">
                <span>⚠</span>
                {error}
              </div>
            )}

            {/* ======================================
                SUMMARY HEADING
                ====================================== */}

            <div className="mp-section-heading">

              <div>
                <h2>Ringkasan Monitoring</h2>

                <p>
                  Rekap keseluruhan program peserta OJT
                  berdasarkan data yang dapat diakses.
                </p>
              </div>

              <div className="mp-section-actions">

                <span className="mp-updated">
                  <span className="mp-live-dot" />
                  {lastUpdated
                    ? `Update ${lastUpdated.toLocaleTimeString(
                        "id-ID",
                        {
                          timeZone: "Asia/Makassar",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )} WITA`
                    : "Belum diperbarui"}
                </span>

                <button
                  type="button"
                  className="mp-refresh"
                  onClick={() => refresh(false)}
                  disabled={refreshing}
                >
                  <span>↻</span>
                  {refreshing ? "Memperbarui..." : "Refresh"}
                </button>

              </div>

            </div>

            {/* ======================================
                STATISTICS
                ====================================== */}

            <section className="mp-stats">

              <StatCard
                icon="👥"
                label="Total Program"
                value={programs.length}
                note="Program yang dapat diakses"
              />

              <StatCard
                icon="✓"
                label="Program Aktif"
                value={activeCount}
                note="Aktif atau disetujui"
              />

              <StatCard
                icon="📍"
                label="Site Terisi"
                value={siteCount}
                note="Program dengan site valid"
              />

              <StatCard
                icon="▥"
                label="Rata-rata Progres"
                value={`${formatNumber(averageProgress)}%`}
                note="Program sesuai filter"
              />

              <StatCard
                icon="◈"
                label="Verified"
                value={totalVerified}
                note="Achievement sesuai filter"
              />

            </section>

            {/* ======================================
                PARTICIPANTS TABLE
                ====================================== */}

            <section className="mp-card">

              <div className="mp-card-heading">

                <div>
                  <div className="mp-title-row">
                    <span className="mp-title-icon">👥</span>

                    <h2>
                      Daftar & Monitoring Peserta
                    </h2>
                  </div>

                  <p>
                    Monitoring progres kompetensi, site,
                    periode OJT, dan status evaluasi peserta.
                  </p>
                </div>

                <span className="mp-count">
                  {filtered.length} dari {programs.length} program
                </span>

              </div>

              {/* FILTER */}

              <div className="mp-filters">

                <label>
                  <span>Cari Peserta</span>

                  <div className="mp-input-wrap">
                    <span>⌕</span>

                    <input
                      type="search"
                      placeholder="Nama atau departemen..."
                      value={search}
                      onChange={(event) =>
                        setSearch(event.target.value)
                      }
                    />
                  </div>
                </label>

                <label>
                  <span>Site Penempatan</span>

                  <select
                    value={selectedSite}
                    onChange={(event) =>
                      setSelectedSite(event.target.value)
                    }
                  >
                    <option value="ALL">Semua Site</option>

                    {availableSites.map((site) => (
                      <option key={site} value={site}>
                        {site}
                      </option>
                    ))}

                    <option value="UNASSIGNED">
                      Belum Ditentukan
                    </option>
                  </select>
                </label>

                <label>
                  <span>Status Program</span>

                  <select
                    value={selectedStatus}
                    onChange={(event) =>
                      setSelectedStatus(event.target.value)
                    }
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="active">Aktif</option>
                    <option value="approved">Disetujui</option>
                    <option value="pending">Menunggu</option>
                    <option value="completed">Selesai</option>
                    <option value="finished">Finished</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </label>

                <button
                  type="button"
                  className="mp-reset"
                  onClick={() => {
                    setSearch("");
                    setSelectedSite("ALL");
                    setSelectedStatus("ALL");
                  }}
                >
                  ↺ Reset
                </button>

              </div>

              {/* TABLE */}

              <div className="mp-table-scroll">

                <table className="mp-table">

                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Peserta OJT</th>
                      <th>Site</th>
                      <th>Periode OJT</th>
                      <th>Status</th>
                      <th>Progres Kompetensi</th>
                      <th>Verified</th>
                      <th>Post-Test</th>
                      <th>Praktik</th>
                      <th>SIMPER</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>

                  <tbody>

                    {filtered.map((program, index) => {
                      const participant = program.peserta || {};

                      const info =
                        dataByProgram[program.id] || {};

                      const statusClass =
                        normalize(program.status) === "active" ||
                        normalize(program.status) === "approved" ||
                        normalize(program.status) === "aktif"
                          ? "active"
                          : normalize(program.status) === "pending"
                            ? "warning"
                            : "neutral";

                      return (
                        <tr key={program.id}>

                          <td>{index + 1}</td>

                          <td>
                            <div className="mp-person">

                              <span className="mp-person-avatar">
                                {initials(participant.full_name)}
                              </span>

                              <div>
                                <strong>
                                  {participant.full_name || "Peserta OJT"}
                                </strong>

                                <small>
                                  {participant.department || "—"}
                                </small>
                              </div>

                            </div>
                          </td>

                          <td>
                            <span className="mp-site">
                              {normalizeSite(program.site) ||
                                "Belum Ditentukan"}
                            </span>
                          </td>

                          <td>
                            <div className="mp-date">
                              {formatDate(program.start_date)}
                            </div>

                            <div className="mp-date mp-date-muted">
                              {formatDate(program.end_date)}
                            </div>
                          </td>

                          <td>
                            <span
                              className={`mp-badge ${statusClass}`}
                            >
                              {programLabel(program.status)}
                            </span>
                          </td>

                          <td>
                            <div className="mp-progress-cell">

                              <div className="mp-progress-info">
                                <strong>
                                  {formatNumber(info.overall || 0)}%
                                </strong>

                                <small>
                                  {info.activeWeeks || 0}/
                                  {info.eligibleWeeks || 0} minggu ada Verified
                                </small>
                              </div>

                              <ProgressBar
                                value={info.overall || 0}
                              />

                            </div>
                          </td>

                          <td>
                            <strong className="mp-number">
                              {info.verified || 0}
                            </strong>
                          </td>

                          <td>
                            {info.postAverage == null
                              ? "—"
                              : formatNumber(info.postAverage)}
                          </td>

                          <td>
                            {info.practiceAverage == null
                              ? "—"
                              : formatNumber(info.practiceAverage)}
                          </td>

                          <td>
                            <span className="mp-simper">
                              {info.simperStatus || "Belum Ada Data"}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="mp-detail"
                              onClick={() =>
                                router.push(`/peserta/${program.id}`)
                              }
                            >
                              Detail →
                            </button>
                          </td>

                        </tr>
                      );
                    })}

                    {!filtered.length && (
                      <tr>
                        <td colSpan={11} className="mp-empty">
                          <span>⌕</span>

                          <strong>
                            Tidak ada peserta ditemukan
                          </strong>

                          <small>
                            Coba ubah kata kunci atau filter pencarian.
                          </small>
                        </td>
                      </tr>
                    )}

                  </tbody>

                </table>

              </div>

              <div className="mp-table-footer">
                <span>
                  Menampilkan {filtered.length} dari {programs.length} program.
                </span>

                <span>
                  Kalender Global OJT 2026–2027
                </span>
              </div>

            </section>

            {/* ======================================
                MONITORING INFORMATION
                ====================================== */}

            <section className="mp-card">

              <div className="mp-card-heading">

                <div>
                  <div className="mp-title-row">
                    <span className="mp-title-icon">▥</span>

                    <h2>Informasi Monitoring</h2>
                  </div>

                  <p>
                    Ketentuan dasar pengolahan data monitoring.
                  </p>
                </div>

              </div>

              <div className="mp-info-grid">

                <div className="mp-info-item">
                  <span className="mp-info-icon">▦</span>

                  <strong>Kalender Global</strong>

                  <p>
                    Week 01: 12–18 September 2026.
                    Week 25: 28 Februari–6 Maret 2027.
                    Tanggal 19 September 2026 berada di luar
                    minggu program.
                  </p>
                </div>

                <div className="mp-info-item">
                  <span className="mp-info-icon">✓</span>

                  <strong>Perhitungan Achievement</strong>

                  <p>
                    Hanya data berstatus Verified dalam
                    periode OJT peserta yang dihitung.
                    Target diterapkan berdasarkan masing-masing
                    kategori per minggu.
                  </p>
                </div>

                <div className="mp-info-item">
                  <span className="mp-info-icon">◉</span>

                  <strong>Status Akun & Online</strong>

                  <p>
                    Status akun dan aktivitas online tidak
                    ditampilkan karena belum tersedia sumber
                    data aktivasi dan aktivitas login yang
                    terverifikasi.
                  </p>
                </div>

              </div>

            </section>

            {/* ======================================
                FOOTER
                ====================================== */}

            <footer className="mp-footer">

              <div>
                <strong>OJT MineTrack v2.0</strong>
                <span>Emergency Response Group · PT Berau Coal</span>
              </div>

              <div>
                Terakhir diperbarui:{" "}
                {lastUpdated
                  ? lastUpdated.toLocaleString("id-ID", {
                      timeZone: "Asia/Makassar",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}{" "}
                WITA
              </div>

            </footer>

          </div>
        </div>
      </div>
    </main>
  );
}

// =====================================================
// COMPLETE CSS
// LIGHT & DARK MODE WITH ERG BACKGROUND
// =====================================================

const css = `

/* =====================================================
   RESET
   ===================================================== */

.mp-root,
.mp-root *,
.mp-loading,
.mp-loading * {
  box-sizing: border-box;
}

.mp-root {
  --mp-surface: rgba(255,255,255,.87);
  --mp-surface-alt: rgba(242,248,245,.91);

  --mp-text: #193a37;
  --mp-heading: #15342f;
  --mp-muted: #718782;
  --mp-muted-soft: #8c9f99;

  --mp-border: rgba(191,213,203,.72);
  --mp-border-soft: rgba(209,225,217,.75);

  --mp-primary: #07875d;
  --mp-primary-text: #087c58;

  --mp-input-bg: rgba(255,255,255,.9);

  --mp-soft-green: rgba(221,247,233,.92);
  --mp-soft-green-text: #087c58;

  --mp-neutral-bg: rgba(233,240,237,.94);
  --mp-neutral-text: #60756e;

  --mp-progress-bg: rgba(216,230,222,.95);
  --mp-table-hover: rgba(224,245,233,.65);

  --mp-reset-bg: rgba(240,247,243,.9);
  --mp-reset-text: #42665a;

  --mp-shadow: rgba(13,55,42,.09);

  min-height: 100vh;
  color: var(--mp-text);
  font-family: Arial, Helvetica, sans-serif;

  background:
    linear-gradient(
      135deg,
      rgba(242,249,245,.87),
      rgba(225,239,231,.80)
    ),
    url("${BACKGROUND_IMAGE}");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;

  transition: background-color .2s ease, color .2s ease;
}

.mp-root button,
.mp-root input,
.mp-root select {
  font: inherit;
}

.mp-root button {
  cursor: pointer;
}

.mp-root button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.mp-root button:focus-visible,
.mp-root input:focus-visible,
.mp-root select:focus-visible {
  outline: 3px solid #42d69d;
  outline-offset: 2px;
}

/* =====================================================
   DARK THEME
   Background image tetap digunakan.
   ===================================================== */

:root[data-theme="dark"] .mp-root {
  --mp-surface: rgba(11,35,32,.88);
  --mp-surface-alt: rgba(22,49,44,.92);

  --mp-text: #e5f5ee;
  --mp-heading: #f1fbf6;
  --mp-muted: #a2bcb1;
  --mp-muted-soft: #8da79c;

  --mp-border: rgba(65,103,88,.62);
  --mp-border-soft: rgba(54,85,73,.65);

  --mp-primary: #10aa77;
  --mp-primary-text: #62e2a8;

  --mp-input-bg: rgba(15,43,39,.96);

  --mp-soft-green: rgba(23,74,55,.88);
  --mp-soft-green-text: #a6f0c7;

  --mp-neutral-bg: rgba(43,65,59,.94);
  --mp-neutral-text: #d0e4da;

  --mp-progress-bg: rgba(47,77,66,.95);
  --mp-table-hover: rgba(32,75,57,.55);

  --mp-reset-bg: rgba(33,62,53,.94);
  --mp-reset-text: #d2e9dd;

  --mp-shadow: rgba(0,0,0,.2);

  background:
    linear-gradient(
      135deg,
      rgba(3,18,19,.88),
      rgba(3,34,28,.83)
    ),
    url("${BACKGROUND_IMAGE}");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;
}

/* =====================================================
   MAIN SHELL
   ===================================================== */

.mp-shell {
  display: grid;
  grid-template-columns: 220px minmax(0,1fr);
  min-height: 100vh;
}

.mp-main {
  min-width: 0;
  min-height: 100vh;
}

/* =====================================================
   SIDEBAR
   ===================================================== */

.mp-sidebar {
  position: sticky;
  top: 0;

  height: 100vh;
  min-height: 600px;

  display: flex;
  flex-direction: column;

  padding: 23px 15px 15px;

  background:
    linear-gradient(
      180deg,
      rgba(4,39,35,.98),
      rgba(3,27,28,.98)
    );

  border-right: 1px solid rgba(73,135,110,.22);

  color: #e8f7ee;
  z-index: 10;

  overflow-y: auto;
}

.mp-sidebar-brand {
  padding: 0 6px 18px;
}

.mp-brand {
  font-size: 21px;
  font-weight: 900;
  letter-spacing: -.8px;
  color: #eafff1;
  white-space: nowrap;
}

.mp-brand span {
  color: #3be0a0;
}

.mp-brand small {
  font-size: 10px;
  margin-left: 5px;
  color: #a7c6b7;
}

.mp-sidebar-brand p {
  font-size: 10px;
  color: #9bb9ac;
  line-height: 1.65;
  margin: 10px 0 0;
}

.mp-sidebar-divider {
  height: 1px;
  background: rgba(159,201,178,.15);
  margin: 3px 0 17px;
}

.mp-sidebar-label {
  padding: 0 8px;
  margin-bottom: 10px;

  font-size: 10px;
  font-weight: 900;
  letter-spacing: .7px;

  color: #43d69c;
}

.mp-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 19px;
}

.mp-nav-item {
  position: relative;

  width: 100%;
  min-height: 41px;

  display: flex;
  align-items: center;
  gap: 11px;

  padding: 10px 11px;

  border: 1px solid transparent;
  border-radius: 9px;

  background: transparent;
  color: #d1e5da;

  text-align: left;
  font-size: 11px;
  font-weight: 600;

  transition: .2s ease;
}

.mp-nav-item:hover:not(.active) {
  background: rgba(255,255,255,.075);
  color: #ffffff;
}

.mp-nav-item.active {
  color: #ffffff;
  font-weight: 800;

  background:
    linear-gradient(
      100deg,
      rgba(8,157,104,.95),
      rgba(5,126,88,.95)
    );

  box-shadow: 0 5px 17px rgba(0,177,117,.18);
}

.mp-nav-icon {
  width: 19px;
  flex-shrink: 0;
  text-align: center;
  font-size: 16px;
}

.mp-nav-active-dot {
  width: 6px;
  height: 6px;
  margin-left: auto;
  border-radius: 50%;
  background: #c4ffdc;
}

.mp-sidebar-info {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 11px 9px;

  background: rgba(255,255,255,.055);
  border: 1px solid rgba(255,255,255,.075);
  border-radius: 10px;
}

.mp-sidebar-info-icon {
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;

  border-radius: 9px;
  background: rgba(17,180,119,.2);
  color: #5be6ab;
  font-size: 18px;
}

.mp-sidebar-info strong,
.mp-sidebar-info small {
  display: block;
}

.mp-sidebar-info strong {
  color: #e8f8ee;
  font-size: 10px;
}

.mp-sidebar-info small {
  color: #9db9ac;
  font-size: 9px;
  line-height: 1.5;
  margin-top: 4px;
}

.mp-sidebar-bottom {
  margin-top: auto;
  padding-top: 18px;

  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mp-sidebar-bottom button {
  display: flex;
  align-items: center;
  gap: 10px;

  padding: 10px 9px;

  border: 0;
  border-radius: 8px;

  background: transparent;
  color: #b8d2c5;

  text-align: left;
  font-size: 10px;
  font-weight: 600;
}

.mp-sidebar-bottom button:hover:not(:disabled) {
  background: rgba(255,255,255,.08);
  color: #ffffff;
}

.mp-sidebar-bottom button span {
  font-size: 17px;
}

.mp-sidebar-version {
  margin-top: 13px;
  padding: 12px 8px 0;

  border-top: 1px solid rgba(255,255,255,.1);

  color: #779c8b;
  font-size: 9px;
  line-height: 1.7;
}

/* =====================================================
   TOPBAR
   ===================================================== */

.mp-topbar {
  min-height: 76px;

  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 15px;

  padding: 13px 28px;

  background: rgba(255,255,255,.66);
  border-bottom: 1px solid var(--mp-border);

  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
}

:root[data-theme="dark"] .mp-topbar {
  background: rgba(6,28,27,.76);
}

.mp-topbar-left small,
.mp-topbar-left strong {
  display: block;
}

.mp-topbar-left small {
  color: var(--mp-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .9px;
}

.mp-topbar-left strong {
  color: var(--mp-heading);
  font-size: 17px;
  margin-top: 6px;
}

.mp-account {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mp-avatar {
  width: 40px;
  height: 40px;

  display: grid;
  place-items: center;

  border-radius: 50%;

  background: var(--mp-soft-green);
  border: 1px solid var(--mp-border);

  color: var(--mp-soft-green-text);
  font-size: 12px;
  font-weight: 900;
}

.mp-account strong,
.mp-account small {
  display: block;
}

.mp-account strong {
  color: var(--mp-heading);
  font-size: 11px;
}

.mp-account small {
  margin-top: 4px;
  color: var(--mp-muted);
  font-size: 10px;
}

/* =====================================================
   CONTAINER
   ===================================================== */

.mp-container {
  width: 100%;
  max-width: 1700px;

  margin: 0 auto;
  padding: 23px 25px 30px;
}

/* =====================================================
   HERO
   ===================================================== */

.mp-hero {
  position: relative;
  overflow: hidden;

  min-height: 205px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 20px;
  flex-wrap: wrap;

  padding: 27px 29px;

  border: 1px solid rgba(90,177,135,.23);
  border-radius: 16px;

  background:
    linear-gradient(
      100deg,
      rgba(3,28,29,.79),
      rgba(4,73,54,.66)
    ),
    url("${BACKGROUND_IMAGE}");

  background-size: cover;
  background-position: center 47%;

  box-shadow: 0 9px 27px rgba(0,0,0,.12);

  margin-bottom: 23px;
}

:root[data-theme="dark"] .mp-hero {
  background:
    linear-gradient(
      100deg,
      rgba(1,15,18,.82),
      rgba(2,43,33,.72)
    ),
    url("${BACKGROUND_IMAGE}");

  background-size: cover;
  background-position: center 47%;
}

.mp-hero-content {
  max-width: 650px;
  position: relative;
  z-index: 1;
}

.mp-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;

  color: #9af0c5;

  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.2px;
}

.mp-live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #24d99a;
  box-shadow: 0 0 10px rgba(36,217,154,.65);
}

.mp-hero h1 {
  color: #ffffff;
  font-size: clamp(24px, 2.7vw, 34px);
  line-height: 1.2;
  margin: 12px 0 10px;
  letter-spacing: -.8px;
}

.mp-hero h1 span {
  color: #3de0a2;
}

.mp-hero p {
  max-width: 620px;
  color: #d1e9dd;
  font-size: 12px;
  line-height: 1.75;
  margin: 0;
}

.mp-hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  margin-top: 17px;

  color: #e3f7e9;
  font-size: 10px;
  font-weight: 600;
}

.mp-hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  position: relative;
  z-index: 1;
}

.mp-hero-actions button {
  padding: 11px 13px;

  border: 1px solid rgba(255,255,255,.35);
  border-radius: 8px;

  background: rgba(255,255,255,.12);
  color: #ffffff;

  font-size: 10px;
  font-weight: 800;

  backdrop-filter: blur(7px);
}

.mp-hero-actions button:hover {
  background: rgba(255,255,255,.24);
}

/* =====================================================
   SECTION HEADING
   ===================================================== */

.mp-section-heading,
.mp-card-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 14px;
  flex-wrap: wrap;
}

.mp-section-heading {
  margin-bottom: 14px;
}

.mp-section-heading h2 {
  color: var(--mp-heading);
  font-size: 17px;
  margin: 0;
}

.mp-section-heading p,
.mp-card-heading p {
  color: var(--mp-muted);
  font-size: 11px;
  line-height: 1.6;
  margin: 5px 0 0;
}

.mp-section-actions {
  display: flex;
  align-items: center;
  gap: 11px;
}

.mp-updated {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--mp-muted);
  font-size: 10px;
}

/* =====================================================
   REFRESH
   ===================================================== */

.mp-refresh {
  display: flex;
  align-items: center;
  gap: 7px;

  padding: 10px 13px;

  border: 1px solid var(--mp-border);
  border-radius: 8px;

  background: var(--mp-surface);
  color: var(--mp-primary-text);

  font-size: 10px;
  font-weight: 800;

  backdrop-filter: blur(8px);
}

.mp-refresh:hover:not(:disabled) {
  background: var(--mp-soft-green);
}

.mp-refresh span {
  font-size: 16px;
}

/* =====================================================
   STATISTICS
   ===================================================== */

.mp-stats {
  display: grid;
  grid-template-columns: repeat(5,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.mp-stat {
  min-width: 0;

  display: flex;
  align-items: center;
  gap: 11px;

  padding: 16px;

  border: 1px solid var(--mp-border);
  border-radius: 13px;

  background: var(--mp-surface);

  backdrop-filter: blur(13px);
  -webkit-backdrop-filter: blur(13px);

  box-shadow: 0 5px 17px var(--mp-shadow);

  transition: transform .2s ease, border-color .2s ease;
}

.mp-stat:hover {
  transform: translateY(-2px);
  border-color: rgba(28,178,117,.5);
}

.mp-stat-icon {
  width: 42px;
  height: 42px;

  display: grid;
  place-items: center;
  flex-shrink: 0;

  border-radius: 11px;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  font-size: 21px;
  font-weight: 900;
}

.mp-stat-content {
  min-width: 0;
}

.mp-stat small {
  display: block;
  color: var(--mp-muted);
  font-size: 10px;
}

.mp-stat strong {
  display: block;
  color: var(--mp-primary-text);
  font-size: 23px;
  margin: 4px 0;
}

.mp-stat-content > span {
  display: block;
  color: var(--mp-muted-soft);
  font-size: 9px;
  line-height: 1.4;
}

/* =====================================================
   CARD
   ===================================================== */

.mp-card {
  padding: 19px;

  margin-bottom: 18px;

  border: 1px solid var(--mp-border);
  border-radius: 15px;

  background: var(--mp-surface);

  color: var(--mp-text);

  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);

  box-shadow: 0 6px 20px var(--mp-shadow);
}

.mp-card-heading {
  margin-bottom: 18px;
}

.mp-title-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.mp-title-row h2 {
  margin: 0;
  color: var(--mp-heading);
  font-size: 15px;
}

.mp-title-icon {
  width: 31px;
  height: 31px;

  display: grid;
  place-items: center;

  border-radius: 9px;
  background: var(--mp-soft-green);

  font-size: 16px;
}

.mp-count {
  display: inline-block;

  padding: 8px 12px;

  border-radius: 20px;
  background: var(--mp-soft-green);

  color: var(--mp-soft-green-text);
  font-size: 10px;
  font-weight: 800;
}

/* =====================================================
   FILTERS
   ===================================================== */

.mp-filters {
  display: grid;

  grid-template-columns:
    minmax(180px,1.5fr)
    minmax(145px,1fr)
    minmax(145px,1fr)
    auto;

  gap: 10px;
  align-items: end;

  margin-bottom: 17px;
}

.mp-filters label {
  display: grid;
  gap: 7px;

  min-width: 0;

  color: var(--mp-text);
  font-size: 10px;
  font-weight: 800;
}

.mp-filters input,
.mp-filters select {
  width: 100%;
  min-width: 0;
  height: 39px;

  padding: 0 11px;

  border: 1px solid var(--mp-border);
  border-radius: 8px;

  background: var(--mp-input-bg);
  color: var(--mp-text);

  font-size: 10px;
}

.mp-filters input::placeholder {
  color: var(--mp-muted);
  opacity: 1;
}

.mp-filters select option {
  background: var(--mp-input-bg);
  color: var(--mp-text);
}

.mp-input-wrap {
  position: relative;
}

.mp-input-wrap > span {
  position: absolute;
  left: 11px;
  top: 8px;

  color: var(--mp-muted);
  font-size: 18px;
}

.mp-input-wrap input {
  padding-left: 34px;
}

.mp-filters input:focus,
.mp-filters select:focus {
  border-color: #22b985;
}

.mp-reset {
  height: 39px;
  padding: 0 13px;

  border: 1px solid var(--mp-border);
  border-radius: 8px;

  background: var(--mp-reset-bg);
  color: var(--mp-reset-text);

  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.mp-reset:hover {
  background: var(--mp-soft-green);
}

/* =====================================================
   TABLE
   ===================================================== */

.mp-table-scroll {
  width: 100%;
  overflow-x: auto;

  border: 1px solid var(--mp-border-soft);
  border-radius: 10px;
}

.mp-table {
  width: 100%;
  min-width: 1160px;

  border-collapse: separate;
  border-spacing: 0;

  color: var(--mp-text);
  font-size: 10px;
}

.mp-table th {
  padding: 13px 10px;

  background: var(--mp-surface-alt);
  color: var(--mp-muted);

  text-align: left;
  white-space: nowrap;

  font-size: 9px;
  font-weight: 900;
  letter-spacing: .2px;

  border-bottom: 1px solid var(--mp-border);
}

.mp-table td {
  padding: 13px 10px;

  border-bottom: 1px solid var(--mp-border-soft);

  color: var(--mp-text);
  vertical-align: middle;
}

.mp-table tbody tr:last-child td {
  border-bottom: 0;
}

.mp-table tbody tr:hover {
  background: var(--mp-table-hover);
}

.mp-table td strong {
  color: var(--mp-heading);
}

/* =====================================================
   PARTICIPANT
   ===================================================== */

.mp-person {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 165px;
}

.mp-person-avatar {
  width: 34px;
  height: 34px;

  display: grid;
  place-items: center;
  flex-shrink: 0;

  border-radius: 50%;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  font-size: 10px;
  font-weight: 900;
}

.mp-person strong {
  display: block;
  color: var(--mp-heading);
  font-size: 10px;
}

.mp-person small {
  display: block;
  color: var(--mp-muted);
  font-size: 9px;
  margin-top: 4px;
}

.mp-site {
  color: var(--mp-primary-text);
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.mp-date {
  color: var(--mp-text);
  font-size: 10px;
  white-space: nowrap;
  margin-bottom: 4px;
}

.mp-date-muted {
  color: var(--mp-muted);
}

/* =====================================================
   BADGES
   ===================================================== */

.mp-badge {
  display: inline-block;

  padding: 6px 9px;

  border-radius: 20px;

  font-size: 9px;
  font-weight: 900;
  white-space: nowrap;
}

.mp-badge.active {
  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);
}

.mp-badge.warning {
  background: rgba(255,220,126,.23);
  color: #a46b08;
}

:root[data-theme="dark"] .mp-badge.warning {
  color: #ffd779;
}

.mp-badge.neutral {
  background: var(--mp-neutral-bg);
  color: var(--mp-neutral-text);
}

/* =====================================================
   PROGRESS
   ===================================================== */

.mp-progress-cell {
  min-width: 145px;
}

.mp-progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 7px;

  margin-bottom: 8px;
}

.mp-progress-info strong {
  color: var(--mp-primary-text);
  font-size: 11px;
}

.mp-progress-info small {
  color: var(--mp-muted);
  font-size: 8px;
  white-space: nowrap;
}

.mp-progress {
  width: 100%;
  height: 7px;

  overflow: hidden;

  border-radius: 20px;
  background: var(--mp-progress-bg);
}

.mp-progress span {
  display: block;
  height: 100%;

  border-radius: inherit;

  background: linear-gradient(
    90deg,
    #079969,
    #21d69a
  );

  transition: width .3s ease;
}

.mp-number {
  color: var(--mp-primary-text) !important;
}

.mp-simper {
  color: var(--mp-muted);
  font-size: 9px;
  white-space: nowrap;
}

/* =====================================================
   DETAIL
   ===================================================== */

.mp-detail {
  padding: 8px 10px;

  border: 1px solid rgba(12,160,108,.55);
  border-radius: 7px;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  font-size: 9px;
  font-weight: 900;
  white-space: nowrap;
}

.mp-detail:hover {
  filter: brightness(.96);
}

/* =====================================================
   EMPTY STATE
   ===================================================== */

.mp-empty {
  height: 145px;
  text-align: center;
}

.mp-empty > span {
  display: block;
  font-size: 24px;
  color: var(--mp-muted);
}

.mp-empty strong {
  display: block;
  color: var(--mp-heading);
  margin: 7px 0;
}

.mp-empty small {
  color: var(--mp-muted);
  font-size: 9px;
}

/* =====================================================
   TABLE FOOTER
   ===================================================== */

.mp-table-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;

  margin-top: 12px;

  color: var(--mp-muted);
  font-size: 9px;
}

/* =====================================================
   INFORMATION GRID
   ===================================================== */

.mp-info-grid {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 12px;
}

.mp-info-item {
  padding: 15px;

  border: 1px solid var(--mp-border);
  border-radius: 11px;

  background: var(--mp-surface-alt);
}

.mp-info-icon {
  width: 31px;
  height: 31px;

  display: grid;
  place-items: center;

  border-radius: 9px;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  font-size: 17px;
  margin-bottom: 11px;
}

.mp-info-item strong {
  display: block;
  color: var(--mp-heading);
  font-size: 11px;
}

.mp-info-item p {
  color: var(--mp-muted);
  font-size: 10px;
  line-height: 1.75;
  margin: 8px 0 0;
}

/* =====================================================
   ERROR
   ===================================================== */

.mp-error {
  display: flex;
  align-items: center;
  gap: 10px;

  margin-bottom: 17px;
  padding: 13px;

  border: 1px solid #f0bcbc;
  border-radius: 9px;

  background: rgba(255,239,239,.95);
  color: #b42323;

  font-size: 11px;
}

:root[data-theme="dark"] .mp-error {
  background: rgba(75,35,39,.94);
  color: #ffbdc4;
  border-color: #79434b;
}

/* =====================================================
   FOOTER
   ===================================================== */

.mp-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  padding: 17px 3px 10px;

  color: var(--mp-muted);
  font-size: 9px;
  line-height: 1.7;
}

.mp-footer strong,
.mp-footer span {
  display: block;
}

.mp-footer strong {
  color: var(--mp-heading);
  font-size: 10px;
}

.mp-footer span {
  margin-top: 3px;
}

/* =====================================================
   LOADING SCREEN
   ===================================================== */

.mp-loading {
  min-height: 100vh;

  display: grid;
  place-items: center;

  padding: 25px;

  background:
    linear-gradient(
      135deg,
      rgba(242,249,245,.85),
      rgba(225,239,231,.78)
    ),
    url("${BACKGROUND_IMAGE}");

  background-position: center;
  background-size: cover;
  background-attachment: fixed;

  color: var(--mp-text);
}

:root[data-theme="dark"] .mp-loading {
  background:
    linear-gradient(
      135deg,
      rgba(3,18,19,.88),
      rgba(3,34,28,.83)
    ),
    url("${BACKGROUND_IMAGE}");

  background-position: center;
  background-size: cover;
}

.mp-loading-card {
  width: min(430px,100%);

  padding: 35px;

  text-align: center;

  border: 1px solid var(--mp-border);
  border-radius: 17px;

  background: var(--mp-surface);

  backdrop-filter: blur(18px);
  box-shadow: 0 12px 35px var(--mp-shadow);
}

.mp-loading-logo {
  color: var(--mp-heading);
  font-size: 23px;
  font-weight: 900;
}

.mp-loading-logo span {
  color: var(--mp-primary-text);
}

.mp-loader {
  width: 37px;
  height: 37px;

  margin: 25px auto;

  border: 4px solid var(--mp-progress-bg);
  border-top-color: var(--mp-primary);

  border-radius: 50%;
  animation: mp-spin .8s linear infinite;
}

@keyframes mp-spin {
  to { transform: rotate(360deg); }
}

.mp-loading-card h2 {
  color: var(--mp-heading);
  font-size: 17px;
}

.mp-loading-card p {
  color: var(--mp-muted);
  font-size: 11px;
  line-height: 1.7;
}

.mp-error-icon {
  width: 40px;
  height: 40px;

  display: grid;
  place-items: center;

  margin: 25px auto 15px;

  border-radius: 50%;
  background: #fff0d1;
  color: #bd7900;

  font-size: 22px;
  font-weight: 900;
}

.mp-primary-button {
  margin-top: 14px;
  padding: 11px 17px;

  border: 0;
  border-radius: 8px;

  background: var(--mp-primary);
  color: white;

  font-size: 11px;
  font-weight: 800;
}

/* =====================================================
   TABLET
   ===================================================== */

@media (max-width: 1250px) {
  .mp-stats {
    grid-template-columns: repeat(3,minmax(0,1fr));
  }

  .mp-container {
    padding: 20px;
  }

  .mp-sidebar {
    width: 210px;
  }

  .mp-shell {
    grid-template-columns: 210px minmax(0,1fr);
  }
}

@media (max-width: 1050px) {
  .mp-filters {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .mp-info-grid {
    grid-template-columns: 1fr;
  }

  .mp-hero {
    align-items: flex-start;
  }
}

/* =====================================================
   MOBILE / SMALL TABLET
   ===================================================== */

@media (max-width: 800px) {
  .mp-shell {
    display: flex;
    flex-direction: column;
  }

  .mp-sidebar {
    position: relative;
    top: auto;

    width: 100%;
    height: auto;
    min-height: 0;

    padding: 13px 14px;

    overflow: visible;
  }

  .mp-sidebar-brand {
    padding: 0 5px 10px;
  }

  .mp-sidebar-brand p {
    margin-top: 5px;
  }

  .mp-sidebar-divider,
  .mp-sidebar-label,
  .mp-sidebar-info,
  .mp-sidebar-version {
    display: none;
  }

  .mp-nav {
    flex-direction: row;
    overflow-x: auto;

    gap: 6px;
    margin: 8px 0 0;

    padding-bottom: 4px;
  }

  .mp-nav-item {
    width: auto;
    min-width: max-content;
    min-height: 37px;

    padding: 9px 11px;
  }

  .mp-sidebar-bottom {
    display: none;
  }

  .mp-topbar {
    min-height: 65px;
    padding: 10px 15px;
  }

  .mp-container {
    padding: 15px;
  }
}

/* =====================================================
   SMALL MOBILE
   ===================================================== */

@media (max-width: 600px) {
  .mp-brand {
    font-size: 19px;
  }

  .mp-topbar-left small {
    font-size: 8px;
  }

  .mp-topbar-left strong {
    font-size: 13px;
  }

  .mp-account strong {
    font-size: 9px;
  }

  .mp-account small {
    font-size: 8px;
  }

  .mp-avatar {
    width: 34px;
    height: 34px;
  }

  .mp-hero {
    padding: 20px;
    min-height: 0;
  }

  .mp-hero h1 {
    font-size: 25px;
  }

  .mp-hero p {
    font-size: 11px;
  }

  .mp-hero-tags {
    gap: 9px;
    font-size: 9px;
  }

  .mp-hero-actions {
    width: 100%;
  }

  .mp-hero-actions button {
    flex: 1;
    font-size: 9px;
  }

  .mp-stats {
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 8px;
  }

  .mp-stat {
    padding: 11px;
    gap: 8px;
  }

  .mp-stat-icon {
    width: 33px;
    height: 33px;
    font-size: 16px;
  }

  .mp-stat strong {
    font-size: 19px;
  }

  .mp-stat small {
    font-size: 9px;
  }

  .mp-stat-content > span {
    font-size: 8px;
  }

  .mp-card {
    padding: 13px;
  }

  .mp-section-heading h2 {
    font-size: 15px;
  }

  .mp-section-actions {
    width: 100%;
    justify-content: space-between;
  }

  .mp-filters {
    grid-template-columns: 1fr;
  }

  .mp-card-heading h2 {
    font-size: 13px;
  }

  .mp-count {
    font-size: 9px;
  }

  .mp-table-footer {
    flex-direction: column;
  }

  .mp-footer {
    flex-direction: column;
    align-items: flex-start;
  }

  .mp-loading-card {
    padding: 25px;
  }
}

/* =====================================================
   PRINT
   ===================================================== */

@page {
  size: A4 landscape;
  margin: 9mm;
}

@media print {
  html,
  body {
    background: #ffffff !important;
    color: #173047 !important;
  }

  .mp-root {
    background: #ffffff !important;
    color: #173047 !important;
  }

  .mp-shell {
    display: block !important;
  }

  .mp-sidebar,
  .mp-topbar,
  .mp-hero-actions,
  .mp-refresh,
  .mp-filters,
  .mp-detail {
    display: none !important;
  }

  .mp-container {
    max-width: none;
    padding: 0;
  }

  .mp-card,
  .mp-stat {
    background: #ffffff !important;
    color: #173047 !important;
    box-shadow: none !important;
    border: 1px solid #d8e3e9 !important;
    break-inside: avoid-page;
  }

  .mp-table {
    color: #173047 !important;
  }

  .mp-table th {
    background: #f1f6f8 !important;
    color: #607789 !important;
  }

  .mp-table td,
  .mp-table td strong,
  .mp-person strong,
  .mp-info-item strong,
  .mp-section-heading h2 {
    color: #173047 !important;
  }

  .mp-root {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

`;
