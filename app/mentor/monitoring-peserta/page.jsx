
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
 * =====================================================
 * OJT MINETRACK V2.0
 * MONITORING PESERTA — LIGHT & DARK MODE
 * =====================================================
 *
 * PENAMBAHAN SITE:
 * - PMO
 * - TSP
 *
 * Dipertahankan:
 * - Supabase dan struktur database
 * - Hak akses Admin dan Mentor
 * - Filter pencarian, site, dan status
 * - Refresh manual dan otomatis
 * - Kalender global Week 01–25
 * - Rumus progres Achievement
 * - Ringkasan Post-Test, Praktik, Samapta, SIMPER
 * - Navigasi detail peserta
 * - Light & Dark Mode
 *
 * Tidak menambahkan tabel atau kolom database.
 */

// =====================================================
// CONSTANTS
// =====================================================

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
  "PMO",
  "TSP",
  "HO",
];

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "👥",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "💬",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🧭",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
  },
];

// =====================================================
// GENERAL HELPERS
// =====================================================

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeKey = (value) =>
  normalize(value).replace(/[^a-z0-9]/g, "");

function normalizeSite(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
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

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

// =====================================================
// KALENDER GLOBAL 25 MINGGU
//
// WEEK 01: 12–18 SEPTEMBER 2026
// WEEK 02: 20–26 SEPTEMBER 2026
// WEEK 03: 27 SEPTEMBER–03 OKTOBER 2026
// WEEK 25: 28 FEBRUARI–06 MARET 2027
//
// 19 SEPTEMBER 2026 BUKAN MINGGU PROGRAM.
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
  const date = String(value ?? "").slice(
    0,
    10
  );

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

function programWeekRange(
  program,
  weekNumber
) {
  const week =
    GLOBAL_WEEKS[weekNumber - 1];

  if (
    !week ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const programStart = String(
    program.start_date
  ).slice(0, 10);

  const programEnd = parseDate(
    program.end_date
  )
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    week.start > programStart
      ? week.start
      : programStart;

  const end =
    programEnd &&
    programEnd < week.end
      ? programEnd
      : week.end;

  return start <= end
    ? { start, end }
    : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(
    0,
    10
  );

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  const start = String(
    program.start_date
  ).slice(0, 10);

  const end = parseDate(
    program.end_date
  )
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

  if (
    ["fisik", "physical"].includes(key)
  ) {
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
    [
      "sosialisasi",
      "socialization",
    ].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (
    [
      "coaching",
      "pembinaan",
    ].includes(key)
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

function resolveCategory(
  record,
  typeMap
) {
  return (
    categoryOf(record.type_code) ||
    categoryOf(
      typeMap.get(
        normalizeKey(record.type_code)
      )
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
    ? values.reduce(
        (sum, value) => sum + value,
        0
      ) / values.length
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

  return (
    labels[normalize(value)] ||
    value ||
    "—"
  );
}

function simperLabel(record) {
  if (!record) {
    return "Belum Ada Data";
  }

  const status = normalize(
    record.status
  );

  const labels = {
    passed: "Lulus",
    failed: "Tidak Lulus",
    in_progress: "Dalam Proses",
    not_started: "Belum Mulai",
    completed: "Selesai",
  };

  return (
    labels[status] ||
    record.status ||
    "Dalam Proses"
  );
}

function getParticipant(program) {
  return Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;
}

// =====================================================
// ACTIVITY VALUES
// RUMUS ASLI DIPERTAHANKAN
// =====================================================

function activityValue(
  rows,
  categoryName
) {
  if (categoryName !== "Fisik") {
    return rows.length;
  }

  const meters = rows.reduce(
    (sum, item) => {
      const km = Number(
        item.distance_km
      );

      return (
        sum +
        (
          Number.isFinite(km) &&
          km > 0
            ? Math.round(km * 1000)
            : 0
        )
      );
    },
    0
  );

  return meters / 1000;
}

// =====================================================
// CALCULATE PROGRESS
// RUMUS ASLI DIPERTAHANKAN
// =====================================================

function calculateProgress(
  program,
  records,
  typeMap
) {
  const eligibleWeeks =
    GLOBAL_WEEKS.filter(
      (week) =>
        programWeekRange(
          program,
          week.week
        )
    );

  const validRecords =
    records.filter(
      (record) =>
        normalize(record.status) ===
          "verified" &&
        insideProgram(
          record.activity_date,
          program
        )
    );

  const categoryDetails =
    TARGETS.map((target) => {
      const matching =
        validRecords.filter(
          (record) =>
            resolveCategory(
              record,
              typeMap
            ) === target.name
        );

      const weekly =
        eligibleWeeks.map((week) => {
          const rows =
            matching.filter(
              (record) =>
                globalWeekOf(
                  record.activity_date
                ) === week.week
            );

          const amount =
            activityValue(
              rows,
              target.name
            );

          return {
            week: week.week,
            amount,

            percent: Math.max(
              0,
              Math.min(
                100,
                (amount / target.target) *
                  100
              )
            ),

            achieved:
              amount >= target.target,
          };
        });

      const percent = weekly.length
        ? weekly.reduce(
            (sum, item) =>
              sum + item.percent,
            0
          ) / weekly.length
        : 0;

      return {
        ...target,
        percent,

        completedWeeks:
          weekly.filter(
            (item) =>
              item.achieved
          ).length,
      };
    });

  const overall =
    categoryDetails.length
      ? categoryDetails.reduce(
          (sum, item) =>
            sum + item.percent,
          0
        ) / categoryDetails.length
      : 0;

  const activeWeeks =
    new Set(
      validRecords
        .map(
          (item) =>
            globalWeekOf(
              item.activity_date
            )
        )
        .filter(Boolean)
    ).size;

  return {
    overall,
    categoryDetails,
    verified:
      validRecords.length,

    completedCategories:
      categoryDetails.filter(
        (item) =>
          eligibleWeeks.length > 0 &&
          item.completedWeeks ===
            eligibleWeeks.length
      ).length,

    activeWeeks,
    eligibleWeeks:
      eligibleWeeks.length,
  };
}

// =====================================================
// UI COMPONENTS
// =====================================================

function ProgressBar({ value }) {
  const safe = Math.max(
    0,
    Math.min(
      100,
      Number(value) || 0
    )
  );

  return (
    <div
      className="mp-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span
        style={{
          width: `${safe}%`,
        }}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
}) {
  return (
    <div className="mp-stat">
      <span className="mp-stat-icon">
        {icon}
      </span>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </div>
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

  const [account, setAccount] =
    useState(null);

  const [programs, setPrograms] =
    useState([]);

  const [types, setTypes] =
    useState([]);

  const [
    achievements,
    setAchievements,
  ] = useState([]);

  const [
    postTests,
    setPostTests,
  ] = useState([]);

  const [
    practices,
    setPractices,
  ] = useState([]);

  const [
    samapta,
    setSamapta,
  ] = useState([]);

  const [
    simper,
    setSimper,
  ] = useState([]);

  const [search, setSearch] =
    useState("");

  const [
    selectedSite,
    setSelectedSite,
  ] = useState("ALL");

  const [
    selectedStatus,
    setSelectedStatus,
  ] = useState("ALL");

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    accessError,
    setAccessError,
  ] = useState(false);

  const [
    lastUpdated,
    setLastUpdated,
  ] = useState(null);

  const role = normalize(
    account?.role
  );

  const isAdmin =
    role === "admin";

  // ===================================================
  // FETCH DATA
  // ===================================================

  const fetchDashboardData =
    useCallback(
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
          query = query.eq(
            "mentor_id",
            userId
          );
        }

        const [
          programResult,
          typeResult,
        ] = await Promise.all([
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

        const validPrograms =
          (
            programResult.data || []
          )
            .filter((item) => {
              const participant =
                getParticipant(
                  item
                );

              return (
                participant &&
                participant.id ===
                  item.participant_id &&
                [
                  "participant",
                  "peserta",
                ].includes(
                  normalize(
                    participant.role
                  )
                )
              );
            })
            .map((item) => ({
              ...item,

              peserta:
                getParticipant(
                  item
                ),
            }));

        const ids =
          validPrograms.map(
            (item) => item.id
          );

        if (!ids.length) {
          return {
            programs: [],
            types:
              typeResult.data || [],
            achievements: [],
            postTests: [],
            practices: [],
            samapta: [],
            simper: [],
          };
        }

        const results =
          await Promise.all([
            supabase
              .from(
                "achievement_records"
              )
              .select(
                "id,program_id,type_code,activity_date,status,distance_km"
              )
              .in(
                "program_id",
                ids
              ),

            supabase
              .from(
                "post_test_scores"
              )
              .select(
                "id,program_id,test_date,score"
              )
              .in(
                "program_id",
                ids
              ),

            supabase
              .from(
                "weekly_practice_scores"
              )
              .select(
                "id,program_id,practice_date,score"
              )
              .in(
                "program_id",
                ids
              ),

            supabase
              .from(
                "samapta_records"
              )
              .select(
                "id,program_id,test_date,test_type,score,result_value"
              )
              .in(
                "program_id",
                ids
              ),

            supabase
              .from(
                "simper_records"
              )
              .select(
                "id,program_id,status,notes"
              )
              .in(
                "program_id",
                ids
              ),
          ]);

        const names = [
          "Achievement",
          "Post-Test",
          "Praktik",
          "Samapta",
          "SIMPER",
        ];

        results.forEach(
          (result, index) => {
            if (result.error) {
              throw new Error(
                `${names[index]}: ${result.error.message}`
              );
            }
          }
        );

        return {
          programs:
            validPrograms,

          types:
            typeResult.data || [],

          achievements:
            results[0].data || [],

          postTests:
            results[1].data || [],

          practices:
            results[2].data || [],

          samapta:
            results[3].data || [],

          simper:
            results[4].data || [],
        };
      },
      []
    );

  // ===================================================
  // APPLY DATA
  // ===================================================

  const applyData =
    useCallback((data) => {
      setPrograms(
        data.programs
      );

      setTypes(
        data.types
      );

      setAchievements(
        data.achievements
      );

      setPostTests(
        data.postTests
      );

      setPractices(
        data.practices
      );

      setSamapta(
        data.samapta
      );

      setSimper(
        data.simper
      );

      setLastUpdated(
        new Date()
      );
    }, []);

  // ===================================================
  // VERIFY ACCESS
  // ===================================================

  const verifyAccess =
    useCallback(
      async () => {
        const {
          data: { user },
          error: authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !user
        ) {
          router.replace(
            "/login"
          );

          return null;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id,full_name,role"
          )
          .eq(
            "id",
            user.id
          )
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profile) {
          throw new Error(
            "Profil pengguna tidak ditemukan."
          );
        }

        const currentRole =
          normalize(
            profile.role
          );

        if (
          [
            "participant",
            "peserta",
          ].includes(
            currentRole
          )
        ) {
          router.replace(
            "/dashboard-peserta"
          );

          return null;
        }

        if (
          ![
            "admin",
            "mentor",
          ].includes(
            currentRole
          )
        ) {
          throw new Error(
            "Monitoring Peserta hanya tersedia untuk Admin dan Mentor."
          );
        }

        return {
          user,
          profile,
          currentRole,
        };
      },
      [router]
    );

  // ===================================================
  // INITIALIZE
  // ===================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const access =
          await verifyAccess();

        if (
          !access ||
          !active
        ) {
          return;
        }

        const data =
          await fetchDashboardData(
            access.user.id,
            access.currentRole
          );

        if (!active) return;

        setAccount(
          access.profile
        );

        applyData(data);

        setAccessError(
          false
        );
      } catch (err) {
        if (!active) return;

        setAccessError(
          true
        );

        setError(
          err?.message ||
            "Gagal memuat Monitoring Peserta."
        );
      } finally {
        if (active) {
          setLoading(
            false
          );
        }
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
      if (
        !account ||
        loading ||
        refreshing
      ) {
        return;
      }

      if (!silent) {
        setRefreshing(
          true
        );
      }

      setError("");

      try {
        const access =
          await verifyAccess();

        if (!access) {
          return;
        }

        if (
          access.user.id !==
          account.id
        ) {
          setAccessError(
            true
          );

          setPrograms(
            []
          );

          throw new Error(
            "Akun login berubah. Silakan buka ulang halaman."
          );
        }

        const data =
          await fetchDashboardData(
            access.user.id,
            access.currentRole
          );

        setAccount(
          access.profile
        );

        applyData(data);

        setAccessError(
          false
        );
      } catch (err) {
        setError(
          err?.message ||
            "Gagal memperbarui data peserta."
        );
      } finally {
        setRefreshing(
          false
        );
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
    if (
      !account ||
      accessError
    ) {
      return;
    }

    const interval =
      setInterval(() => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refresh(true);
        }
      }, 60000);

    return () =>
      clearInterval(
        interval
      );
  }, [
    account,
    accessError,
    refresh,
  ]);

  // ===================================================
  // TYPE MAP
  // ===================================================

  const typeMap = useMemo(
    () =>
      new Map(
        types.map(
          (item) => [
            normalizeKey(
              item.code
            ),
            item.name,
          ]
        )
      ),
    [types]
  );

  // ===================================================
  // DATA BY PROGRAM
  // ===================================================

  const dataByProgram = useMemo(
    () => {
      const output = {};

      programs.forEach(
        (program) => {
          const id =
            program.id;

          const achievementsForProgram =
            achievements.filter(
              (item) =>
                item.program_id ===
                id
            );

          const post =
            postTests.filter(
              (item) =>
                item.program_id ===
                id
            );

          const practice =
            practices.filter(
              (item) =>
                item.program_id ===
                id
            );

          const samaptaRows =
            samapta.filter(
              (item) =>
                item.program_id ===
                id
            );

          const simperRows =
            simper.filter(
              (item) =>
                item.program_id ===
                id
            );

          const progress =
            calculateProgress(
              program,
              achievementsForProgram,
              typeMap
            );

          const latestSimper =
            simperRows.find(
              (item) =>
                String(
                  item.notes || ""
                ).includes(
                  "[[SIMPER_V2]]"
                )
            ) ||
            simperRows[0] ||
            null;

          output[id] = {
            ...progress,

            postAverage:
              averageScore(
                post
              ),

            practiceAverage:
              averageScore(
                practice
              ),

            samaptaRecords:
              samaptaRows.length,

            simperStatus:
              simperLabel(
                latestSimper
              ),

            totalAchievements:
              achievementsForProgram.filter(
                (item) =>
                  insideProgram(
                    item.activity_date,
                    program
                  )
              ).length,
          };
        }
      );

      return output;
    },
    [
      programs,
      achievements,
      postTests,
      practices,
      samapta,
      simper,
      typeMap,
    ]
  );

  // ===================================================
  // FILTER PROGRAMS
  // ===================================================

  const filtered = useMemo(
    () => {
      const keyword =
        normalize(
          search
        );

      return programs.filter(
        (program) => {
          const participant =
            program.peserta ||
            {};

          const matchesSearch =
            !keyword ||
            normalize(
              `${participant.full_name || ""} ${
                participant.department || ""
              }`
            ).includes(
              keyword
            );

          const programSite =
            normalizeSite(
              program.site
            );

          const matchesSite =
            selectedSite ===
              "ALL" ||
            (
              selectedSite ===
              "UNASSIGNED"
                ? !programSite
                : programSite ===
                  selectedSite
            );

          const matchesStatus =
            selectedStatus ===
              "ALL" ||
            normalize(
              program.status
            ) ===
              selectedStatus;

          return (
            matchesSearch &&
            matchesSite &&
            matchesStatus
          );
        }
      );
    },
    [
      programs,
      search,
      selectedSite,
      selectedStatus,
    ]
  );

  // ===================================================
  // SUMMARY COUNTERS
  // ===================================================

  const activeCount =
    programs.filter(
      (item) =>
        [
          "active",
          "approved",
          "aktif",
        ].includes(
          normalize(
            item.status
          )
        )
    ).length;

  const siteCount =
    programs.filter(
      (item) =>
        SITES.includes(
          normalizeSite(item.site)
        )
    ).length;

  const averageProgress =
    filtered.length
      ? filtered.reduce(
          (sum, program) =>
            sum +
            (
              dataByProgram[
                program.id
              ]?.overall ||
              0
            ),
          0
        ) /
        filtered.length
      : 0;

  const totalVerified =
    filtered.reduce(
      (sum, program) =>
        sum +
        (
          dataByProgram[
            program.id
          ]?.verified ||
          0
        ),
      0
    );

  // Gabungkan daftar site resmi dan site
  // yang sudah tersimpan pada program lama.
  const availableSites = [
    ...new Set([
      ...SITES,
      ...programs
        .map(
          (item) =>
            normalizeSite(item.site)
        )
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

        <h2>
          OJT MineTrack
        </h2>

        <p>
          Memuat Monitoring
          Peserta OJT...
        </p>
      </main>
    );
  }

  // ===================================================
  // ACCESS ERROR
  // ===================================================

  if (
    !account ||
    accessError
  ) {
    return (
      <main className="mp-loading">
        <style>{css}</style>

        <h2>
          Monitoring Peserta
          Tidak Dapat Ditampilkan
        </h2>

        <p>
          {error ||
            "Akses tidak tersedia."}
        </p>

        <button
          type="button"
          onClick={() =>
            router.push("/")
          }
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  // ===================================================
  // MAIN RENDER
  // ===================================================

  return (
    <main className="mp-root">
      <style>{css}</style>

      {/* ==============================================
          TOP BAR
          ============================================== */}

      <header className="mp-topbar">
        <div className="mp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="mp-account">
          <div className="mp-avatar">
            {initials(
              account.full_name
            )}
          </div>

          <div>
            <strong>
              {account.full_name ||
                "Pengguna"}
            </strong>

            <small>
              {isAdmin
                ? "Administrator"
                : "Mentor OJT"}
            </small>
          </div>
        </div>
      </header>

      <div className="mp-container">

        {/* ============================================
            HERO
            ============================================ */}

        <section className="mp-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP ·
              PT BERAU COAL
            </small>

            <h1>
              Monitoring Peserta OJT
            </h1>

            <p>
              Data peserta, pencapaian
              kompetensi, dan ringkasan
              penilaian dalam satu tampilan.
            </p>
          </div>

          <div className="mp-hero-actions">
            <button
              type="button"
              onClick={() =>
                router.push("/")
              }
            >
              ← Dashboard
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/mentor/daftar-peserta"
                )
              }
            >
              + Daftarkan Peserta
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/mentor/persetujuan-peserta"
                )
              }
            >
              Persetujuan Peserta
            </button>
          </div>
        </section>

        {/* ============================================
            ERROR
            ============================================ */}

        {error && (
          <div
            className="mp-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* ============================================
            SUMMARY HEADING
            ============================================ */}

        <div className="mp-heading">
          <div>
            <h2>
              Ringkasan Peserta
            </h2>

            <p>
              Menampilkan program OJT
              sesuai hak akses akun.
            </p>
          </div>

          <button
            type="button"
            className="mp-refresh"
            onClick={() =>
              refresh(false)
            }
            disabled={refreshing}
          >
            {refreshing
              ? "Memperbarui..."
              : "↻ Refresh Data"}
          </button>
        </div>

        {/* ============================================
            STATISTICS
            ============================================ */}

        <section className="mp-stats">
          <StatCard
            icon="👥"
            label="Total Program"
            value={
              programs.length
            }
            note="Program yang dapat diakses"
          />

          <StatCard
            icon="✅"
            label="Program Aktif"
            value={
              activeCount
            }
            note="Aktif atau disetujui"
          />

          <StatCard
            icon="📍"
            label="Site Terisi"
            value={
              siteCount
            }
            note="Site penempatan valid"
          />

          <StatCard
            icon="📊"
            label="Rata-rata Progres"
            value={`${formatNumber(
              averageProgress
            )}%`}
            note="Program sesuai filter"
          />

          <StatCard
            icon="🗂️"
            label="Verified"
            value={
              totalVerified
            }
            note="Achievement sesuai filter"
          />
        </section>

        {/* ============================================
            PARTICIPANTS TABLE
            ============================================ */}

        <section className="mp-card">
          <div className="mp-heading">
            <div>
              <h2>
                Daftar & Monitoring Peserta
              </h2>

              <p>
                Cari peserta atau filter
                berdasarkan site dan
                status program.
              </p>
            </div>

            <span className="mp-count">
              {filtered.length}
              {" dari "}
              {programs.length}
              {" program"}
            </span>
          </div>

          {/* ==========================================
              FILTER
              ========================================== */}

          <div className="mp-filters">

            {/* SEARCH */}

            <label>
              Cari Peserta

              <input
                type="search"
                placeholder="Nama atau departemen..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />
            </label>

            {/* SITE */}

            <label>
              Site Penempatan

              <select
                value={
                  selectedSite
                }
                onChange={(event) =>
                  setSelectedSite(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  Semua Site
                </option>

                {availableSites.map(
                  (site) => (
                    <option
                      key={site}
                      value={site}
                    >
                      {site}
                    </option>
                  )
                )}

                <option value="UNASSIGNED">
                  Belum Ditentukan
                </option>
              </select>
            </label>

            {/* STATUS */}

            <label>
              Status Program

              <select
                value={
                  selectedStatus
                }
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value
                  )
                }
              >
                <option value="ALL">
                  Semua Status
                </option>

                <option value="active">
                  Aktif
                </option>

                <option value="approved">
                  Disetujui
                </option>

                <option value="pending">
                  Menunggu
                </option>

                <option value="completed">
                  Selesai
                </option>

                <option value="finished">
                  Finished
                </option>

                <option value="cancelled">
                  Dibatalkan
                </option>
              </select>
            </label>

            {/* RESET FILTER */}

            <button
              type="button"
              className="mp-reset"
              onClick={() => {
                setSearch("");

                setSelectedSite(
                  "ALL"
                );

                setSelectedStatus(
                  "ALL"
                );
              }}
            >
              Reset Filter
            </button>
          </div>

          {/* ==========================================
              TABLE
              ========================================== */}

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
                {filtered.map(
                  (program, index) => {
                    const participant =
                      program.peserta ||
                      {};

                    const info =
                      dataByProgram[
                        program.id
                      ] || {};

                    return (
                      <tr key={program.id}>
                        <td>
                          {index + 1}
                        </td>

                        {/* PARTICIPANT */}

                        <td>
                          <div className="mp-person">
                            <span className="mp-person-avatar">
                              {initials(
                                participant.full_name
                              )}
                            </span>

                            <div>
                              <strong>
                                {participant.full_name ||
                                  "Peserta OJT"}
                              </strong>

                              <small>
                                {participant.department ||
                                  "—"}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* SITE */}

                        <td>
                          {normalizeSite(
                            program.site
                          ) ||
                            "Belum Ditentukan"}
                        </td>

                        {/* PROGRAM PERIOD */}

                        <td>
                          <span className="mp-date">
                            {formatDate(
                              program.start_date
                            )}
                          </span>

                          <span className="mp-date">
                            {formatDate(
                              program.end_date
                            )}
                          </span>
                        </td>

                        {/* STATUS */}

                        <td>
                          <span
                            className={
                              "mp-badge " +
                              (
                                normalize(
                                  program.status
                                ) ===
                                "active"
                                  ? "active"
                                  : "neutral"
                              )
                            }
                          >
                            {programLabel(
                              program.status
                            )}
                          </span>
                        </td>

                        {/* PROGRESS */}

                        <td>
                          <div className="mp-progress-cell">
                            <div>
                              <strong>
                                {formatNumber(
                                  info.overall ||
                                    0
                                )}
                                %
                              </strong>

                              <small>
                                {info.activeWeeks ||
                                  0}
                                /
                                {info.eligibleWeeks ||
                                  0}
                                {" minggu ada Verified"}
                              </small>
                            </div>

                            <ProgressBar
                              value={
                                info.overall ||
                                0
                              }
                            />
                          </div>
                        </td>

                        {/* VERIFIED */}

                        <td>
                          <strong>
                            {info.verified ||
                              0}
                          </strong>
                        </td>

                        {/* POST TEST */}

                        <td>
                          {info.postAverage ==
                          null
                            ? "—"
                            : formatNumber(
                                info.postAverage
                              )}
                        </td>

                        {/* PRACTICE */}

                        <td>
                          {info.practiceAverage ==
                          null
                            ? "—"
                            : formatNumber(
                                info.practiceAverage
                              )}
                        </td>

                        {/* SIMPER */}

                        <td>
                          <span className="mp-simper">
                            {info.simperStatus ||
                              "Belum Ada Data"}
                          </span>
                        </td>

                        {/* DETAIL */}

                        <td>
                          <button
                            type="button"
                            className="mp-detail"
                            onClick={() =>
                              router.push(
                                `/peserta/${program.id}`
                              )
                            }
                          >
                            Detail →
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}

                {!filtered.length && (
                  <tr>
                    <td
                      colSpan={11}
                      className="mp-empty"
                    >
                      Tidak ada peserta yang
                      sesuai dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================
            MONITORING INFORMATION
            ============================================ */}

        <section className="mp-card">
          <div className="mp-heading">
            <div>
              <h2>
                Informasi Monitoring
              </h2>

              <p>
                Data monitoring mengikuti
                Kalender Global OJT
                2026–2027.
              </p>
            </div>
          </div>

          <div className="mp-info-grid">

            {/* GLOBAL CALENDAR */}

            <div>
              <strong>
                Kalender Global
              </strong>

              <p>
                Week 01: 12–18
                September 2026.
                Week 25: 28 Februari–6
                Maret 2027.
              </p>
            </div>

            {/* ACHIEVEMENT CALCULATION */}

            <div>
              <strong>
                Perhitungan Achievement
              </strong>

              <p>
                Hanya data Verified dalam
                periode OJT peserta
                yang dihitung. Target
                diterapkan per minggu.
              </p>
            </div>

            {/* ACCOUNT STATUS */}

            <div>
              <strong>
                Status Akun & Online
              </strong>

              <p>
                Tidak ditampilkan karena
                modul ini belum menggunakan
                sumber status aktivasi
                dan aktivitas login
                yang terverifikasi.
              </p>
            </div>
          </div>
        </section>

        {/* ============================================
            FOOTER
            ============================================ */}

        <footer className="mp-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal

          <div>
            Terakhir diperbarui:
            {" "}
            {lastUpdated
              ? lastUpdated.toLocaleString(
                  "id-ID",
                  {
                    timeZone:
                      "Asia/Makassar",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }
                )
              : "—"}
            {" "}
            WITA
          </div>
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// COMPLETE CSS — LIGHT & DARK MODE
// =====================================================

const css = `
/* =====================================================
   RESET & LIGHT THEME
   ===================================================== */

.mp-root,
.mp-root *,
.mp-loading,
.mp-loading * {
  box-sizing: border-box;
}

.mp-root,
.mp-loading {
  --mp-page-bg: #f5f8fa;
  --mp-surface: #ffffff;
  --mp-surface-alt: #f1f6f8;

  --mp-text: #173047;
  --mp-heading: #203646;
  --mp-muted: #8191a0;
  --mp-muted-soft: #8a98a6;

  --mp-border: #e2eaf0;
  --mp-border-soft: #eaf0f3;

  --mp-primary: #087c58;
  --mp-primary-hover: #076c4e;
  --mp-primary-text: #087c58;

  --mp-input-bg: #ffffff;

  --mp-soft-green: #e8f7ef;
  --mp-soft-green-text: #087d58;

  --mp-neutral-bg: #eef2f6;
  --mp-neutral-text: #657787;

  --mp-progress-bg: #e1eae6;
  --mp-table-hover: #fbfdfc;

  --mp-reset-bg: #f4f7f9;
  --mp-reset-text: #426070;

  --mp-header-bg: #ffffff;
  --mp-shadow: rgba(20, 43, 65, .035);

  min-height: 100vh;
  background: var(--mp-page-bg);
  color: var(--mp-text);
  font-family: Arial, Helvetica, sans-serif;

  transition:
    background-color .2s ease,
    color .2s ease;
}

/* =====================================================
   DARK THEME
   ===================================================== */

:root[data-theme="dark"] .mp-root,
:root[data-theme="dark"] .mp-loading {
  --mp-page-bg: #0d171b;
  --mp-surface: #17272b;
  --mp-surface-alt: #203438;

  --mp-text: #edf8f4;
  --mp-heading: #f0faf6;
  --mp-muted: #a5bbb8;
  --mp-muted-soft: #91aaa7;

  --mp-border: #30484b;
  --mp-border-soft: #293f42;

  --mp-primary: #0a9568;
  --mp-primary-hover: #0caf78;
  --mp-primary-text: #80eab4;

  --mp-input-bg: #1c3235;

  --mp-soft-green: #214638;
  --mp-soft-green-text: #aaf0c9;

  --mp-neutral-bg: #294044;
  --mp-neutral-text: #d0e5df;

  --mp-progress-bg: #30484b;
  --mp-table-hover: #20383a;

  --mp-reset-bg: #263b3f;
  --mp-reset-text: #d4e8e2;

  --mp-header-bg: #102328;
  --mp-shadow: rgba(0, 0, 0, .19);
}

/* =====================================================
   GENERAL
   ===================================================== */

.mp-root button,
.mp-root input,
.mp-root select {
  font: inherit;
}

.mp-root button,
.mp-loading button {
  cursor: pointer;
}

.mp-root button:disabled,
.mp-loading button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.mp-root button:focus-visible,
.mp-root input:focus-visible,
.mp-root select:focus-visible,
.mp-loading button:focus-visible {
  outline: 3px solid #46d39c;
  outline-offset: 2px;
}

/* =====================================================
   LOADING & ACCESS SCREEN
   ===================================================== */

.mp-loading {
  padding: 40px;
}

.mp-loading h2 {
  color: var(--mp-heading);
}

.mp-loading p {
  color: var(--mp-muted);
  line-height: 1.7;
}

.mp-loading button {
  border: 0;
  padding: 12px 16px;
  border-radius: 9px;

  background: var(--mp-primary);
  color: #ffffff;

  font-weight: bold;
}

.mp-loading button:hover {
  background: var(--mp-primary-hover);
}

/* =====================================================
   TOP BAR
   ===================================================== */

.mp-topbar {
  height: 70px;

  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 0 35px;

  background: var(--mp-header-bg);
  border-bottom: 1px solid var(--mp-border);
}

.mp-brand {
  font-size: 25px;
  font-weight: 900;
  letter-spacing: -.7px;
  color: var(--mp-heading);
}

.mp-brand span {
  color: var(--mp-primary-text);
}

.mp-brand small {
  margin-left: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--mp-muted);
}

.mp-account {
  display: flex;
  align-items: center;
  gap: 11px;
}

.mp-avatar,
.mp-person-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  border-radius: 50%;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  font-weight: 900;
}

.mp-avatar {
  width: 40px;
  height: 40px;
  font-size: 12px;
}

.mp-account strong,
.mp-account small {
  display: block;
}

.mp-account strong {
  font-size: 12px;
  color: var(--mp-heading);
}

.mp-account small {
  margin-top: 4px;
  color: var(--mp-muted);
  font-size: 11px;
}

/* =====================================================
   CONTAINER
   ===================================================== */

.mp-container {
  max-width: 1600px;
  padding: 22px;
  margin: auto;
}

/* =====================================================
   HERO
   ===================================================== */

.mp-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 20px;
  flex-wrap: wrap;

  padding: 28px;
  border-radius: 17px;

  color: #ffffff;

  background:
    linear-gradient(
      100deg,
      rgba(6,26,36,.97),
      rgba(5,70,59,.85)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;

  margin-bottom: 22px;
}

:root[data-theme="dark"] .mp-hero {
  background:
    linear-gradient(
      100deg,
      rgba(3,15,21,.98),
      rgba(4,42,36,.94)
    ),
    url("/background-erg.png.PNG");

  background-position: center;
  background-size: cover;
}

.mp-hero small {
  color: #efca77;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.mp-hero h1 {
  font-size: clamp(26px, 3vw, 36px);
  margin: 10px 0;
  color: #ffffff;
}

.mp-hero p {
  margin: 0;
  color: #d5e9e3;
  font-size: 13px;
  line-height: 1.7;
}

.mp-hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mp-hero-actions button {
  border: 1px solid #ffffff40;

  background: #ffffff18;
  color: #ffffff;

  border-radius: 9px;
  padding: 11px 13px;

  font-size: 11px;
  font-weight: 800;
}

.mp-hero-actions button:hover {
  background: #ffffff30;
}

/* =====================================================
   SECTION HEADING
   ===================================================== */

.mp-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 12px;
  flex-wrap: wrap;

  margin-bottom: 15px;
}

.mp-heading h2 {
  font-size: 18px;
  margin: 0;
  color: var(--mp-heading);
}

.mp-heading p {
  color: var(--mp-muted);
  font-size: 12px;
  margin: 6px 0 0;
  line-height: 1.5;
}

/* =====================================================
   REFRESH BUTTON
   ===================================================== */

.mp-refresh {
  border: 1px solid var(--mp-border);

  background: var(--mp-surface);
  color: var(--mp-primary-text);

  border-radius: 9px;
  padding: 11px 15px;

  font-size: 12px;
  font-weight: 800;
}

.mp-refresh:hover:not(:disabled) {
  background: var(--mp-soft-green);
}

/* =====================================================
   STATISTICS
   ===================================================== */

.mp-stats {
  display: grid;

  grid-template-columns:
    repeat(5, minmax(0, 1fr));

  gap: 12px;
  margin-bottom: 20px;
}

.mp-stat {
  display: flex;
  gap: 11px;
  align-items: center;

  background: var(--mp-surface);
  border: 1px solid var(--mp-border);

  border-radius: 14px;
  padding: 17px;

  min-width: 0;

  box-shadow:
    0 4px 14px var(--mp-shadow);
}

.mp-stat-icon {
  display: grid;
  place-items: center;

  width: 42px;
  height: 42px;

  border-radius: 11px;
  flex-shrink: 0;

  background: var(--mp-soft-green);
  font-size: 22px;
}

.mp-stat > div {
  min-width: 0;
}

.mp-stat small {
  display: block;
  color: var(--mp-muted);
  font-size: 11px;
}

.mp-stat strong {
  display: block;

  font-size: 24px;
  color: var(--mp-primary-text);

  margin: 5px 0;
}

.mp-stat div > span {
  color: var(--mp-muted-soft);
  font-size: 10px;
  line-height: 1.5;
}

/* =====================================================
   CARDS
   ===================================================== */

.mp-card {
  background: var(--mp-surface);

  border: 1px solid var(--mp-border);
  border-radius: 16px;

  padding: 20px;
  margin-bottom: 18px;

  color: var(--mp-text);

  box-shadow:
    0 4px 16px var(--mp-shadow);
}

/* =====================================================
   PARTICIPANT COUNT
   ===================================================== */

.mp-count {
  display: inline-block;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  border-radius: 20px;
  padding: 8px 12px;

  font-size: 11px;
  font-weight: 800;
}

/* =====================================================
   FILTERS
   ===================================================== */

.mp-filters {
  display: grid;

  grid-template-columns:
    minmax(190px,1.5fr)
    repeat(2,minmax(160px,1fr))
    auto;

  align-items: end;
  gap: 11px;

  margin-bottom: 18px;
}

.mp-filters label {
  display: grid;
  gap: 7px;

  font-weight: 800;
  font-size: 11px;

  color: var(--mp-text);
}

.mp-filters input,
.mp-filters select {
  border: 1px solid var(--mp-border);

  border-radius: 9px;

  background: var(--mp-input-bg);
  color: var(--mp-text);

  padding: 12px;
  width: 100%;
  min-width: 0;

  font-size: 12px;
}

.mp-filters input::placeholder {
  color: var(--mp-muted);
  opacity: 1;
}

.mp-filters select option {
  background: var(--mp-input-bg);
  color: var(--mp-text);
}

.mp-filters input:focus,
.mp-filters select:focus {
  border-color: #20bb87;
}

/* =====================================================
   RESET BUTTON
   ===================================================== */

.mp-reset {
  border: 1px solid var(--mp-border);

  background: var(--mp-reset-bg);
  color: var(--mp-reset-text);

  padding: 12px 15px;
  border-radius: 9px;

  font-size: 11px;
  font-weight: 800;
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
}

.mp-table {
  border-collapse: collapse;
  min-width: 1150px;
  width: 100%;

  font-size: 12px;
  color: var(--mp-text);
}

.mp-table th {
  background: var(--mp-surface-alt);
  color: var(--mp-muted);

  text-align: left;
  padding: 14px 10px;

  white-space: nowrap;
  font-size: 11px;
}

.mp-table td {
  padding: 15px 10px;

  border-bottom:
    1px solid var(--mp-border-soft);

  vertical-align: middle;
  color: var(--mp-text);
}

.mp-table tbody tr:hover {
  background: var(--mp-table-hover);
}

.mp-table td strong {
  color: var(--mp-heading);
}

/* =====================================================
   PARTICIPANT PROFILE
   ===================================================== */

.mp-person {
  display: flex;
  gap: 10px;
  align-items: center;

  min-width: 170px;
}

.mp-person-avatar {
  width: 38px;
  height: 38px;
  font-size: 11px;
}

.mp-person strong {
  display: block;

  font-size: 12px;
  color: var(--mp-heading);
}

.mp-person small {
  display: block;
  margin-top: 5px;

  color: var(--mp-muted);
  font-size: 10px;
}

/* =====================================================
   DATE
   ===================================================== */

.mp-date {
  display: block;
  white-space: nowrap;

  font-size: 11px;
  margin-bottom: 4px;

  color: var(--mp-text);
}

/* =====================================================
   STATUS BADGE
   ===================================================== */

.mp-badge {
  display: inline-block;

  padding: 7px 10px;
  border-radius: 20px;

  font-size: 10px;
  font-weight: 800;

  white-space: nowrap;
}

.mp-badge.active {
  color: var(--mp-soft-green-text);
  background: var(--mp-soft-green);
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

.mp-progress-cell > div:first-child {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 8px;
  margin-bottom: 9px;
}

.mp-progress-cell strong {
  color: var(--mp-primary-text);
}

.mp-progress-cell small {
  color: var(--mp-muted);
  font-size: 9px;
}

.mp-progress {
  background: var(--mp-progress-bg);

  height: 8px;
  width: 100%;

  border-radius: 20px;
  overflow: hidden;
}

.mp-progress span {
  display: block;
  height: 100%;

  border-radius: inherit;

  background: linear-gradient(
    90deg,
    #25c38d,
    #07875e
  );
}

:root[data-theme="dark"] .mp-progress span {
  background: linear-gradient(
    90deg,
    #24c48d,
    #58e5ab
  );
}

/* =====================================================
   SIMPER
   ===================================================== */

.mp-simper {
  color: var(--mp-muted);
  font-size: 11px;
  white-space: nowrap;
}

/* =====================================================
   DETAIL BUTTON
   ===================================================== */

.mp-detail {
  border: 1px solid #0a966e;

  background: var(--mp-soft-green);
  color: var(--mp-soft-green-text);

  padding: 9px 12px;
  border-radius: 8px;

  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.mp-detail:hover {
  background: var(--mp-surface-alt);
}

.mp-empty {
  text-align: center;
  color: var(--mp-muted);
  padding: 35px !important;
}

/* =====================================================
   MONITORING INFO
   ===================================================== */

.mp-info-grid {
  display: grid;

  grid-template-columns:
    repeat(3, minmax(0, 1fr));

  gap: 12px;
}

.mp-info-grid > div {
  padding: 15px;

  background: var(--mp-surface-alt);
  border: 1px solid var(--mp-border);

  border-radius: 11px;
}

.mp-info-grid strong {
  font-size: 12px;
  color: var(--mp-heading);
}

.mp-info-grid p {
  color: var(--mp-muted);

  font-size: 11px;
  line-height: 1.75;

  margin: 8px 0 0;
}

/* =====================================================
   ERROR
   ===================================================== */

.mp-error {
  margin-bottom: 18px;
  padding: 15px;

  background: #fff1f1;
  color: #b91c1c;

  border: 1px solid #fecaca;
  border-radius: 11px;

  font-size: 13px;
}

:root[data-theme="dark"] .mp-error {
  background: #45252b;
  color: #ffbec4;
  border-color: #704047;
}

/* =====================================================
   FOOTER
   ===================================================== */

.mp-footer {
  padding: 18px 0 30px;

  text-align: center;
  color: var(--mp-muted);

  font-size: 11px;
  line-height: 1.8;
}

/* =====================================================
   TABLET
   ===================================================== */

@media (max-width: 1200px) {
  .mp-stats {
    grid-template-columns:
      repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .mp-filters {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .mp-info-grid {
    grid-template-columns: 1fr;
  }
}

/* =====================================================
   MOBILE
   ===================================================== */

@media (max-width: 650px) {
  .mp-topbar {
    padding: 0 14px;
    height: 61px;
  }

  .mp-brand {
    font-size: 19px;
  }

  .mp-account strong {
    font-size: 10px;
  }

  .mp-account small {
    font-size: 9px;
  }

  .mp-avatar {
    width: 34px;
    height: 34px;
  }

  .mp-container {
    padding: 12px;
  }

  .mp-hero {
    padding: 20px;
  }

  .mp-hero h1 {
    font-size: 26px;
  }

  .mp-hero-actions {
    width: 100%;
  }

  .mp-hero-actions button {
    flex: 1;
  }

  .mp-stats {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));

    gap: 8px;
  }

  .mp-stat {
    padding: 12px;
    gap: 7px;
  }

  .mp-stat-icon {
    width: 33px;
    height: 33px;
    font-size: 17px;
  }

  .mp-stat strong {
    font-size: 21px;
  }

  .mp-card {
    padding: 13px;
  }

  .mp-filters {
    grid-template-columns: 1fr;
  }

  .mp-heading h2 {
    font-size: 16px;
  }
}

/* =====================================================
   PRINT — ALWAYS LIGHT
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

  .mp-root,
  :root[data-theme="dark"] .mp-root {
    --mp-page-bg: #ffffff;
    --mp-surface: #ffffff;
    --mp-surface-alt: #f1f6f8;

    --mp-text: #173047;
    --mp-heading: #203646;
    --mp-muted: #617789;
    --mp-muted-soft: #718597;

    --mp-border: #d8e3e9;
    --mp-border-soft: #e5edf0;

    --mp-primary-text: #087c58;

    --mp-soft-green: #e8f7ef;
    --mp-soft-green-text: #087d58;

    --mp-neutral-bg: #eef2f6;
    --mp-neutral-text: #657787;

    --mp-progress-bg: #e1eae6;

    background: #ffffff !important;
    color: #173047 !important;
  }

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
    box-shadow: none !important;
    background: #ffffff !important;

    border: 1px solid #d8e3e9 !important;

    break-inside: avoid-page;
  }

  .mp-root {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
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
  .mp-info-grid strong,
  .mp-heading h2 {
    color: #173047 !important;
  }

  .mp-progress,
  .mp-progress span,
  .mp-badge {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;
