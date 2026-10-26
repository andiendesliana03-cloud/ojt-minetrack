
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

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

const ACHIEVEMENTS = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

const NAV = [
  { label: "Dashboard", url: "/", icon: "home" },
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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeType(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
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

  const d = new Date(
    Date.UTC(p[0], p[1] - 1, p[2])
  );

  if (
    d.getUTCFullYear() !== p[0] ||
    d.getUTCMonth() !== p[1] - 1 ||
    d.getUTCDate() !== p[2]
  ) {
    return null;
  }

  return d;
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

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function average(rows) {
  const numbers = rows
    .filter(
      (r) =>
        r.score !== null &&
        r.score !== undefined &&
        r.score !== ""
    )
    .map((r) => Number(r.score))
    .filter(Number.isFinite);

  if (!numbers.length) return null;

  return (
    numbers.reduce((a, b) => a + b, 0) /
    numbers.length
  );
}

function scoreText(value) {
  return value == null
    ? "—"
    : Number(value).toFixed(1);
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

function parseSimperMetadata(notes) {
  const text = String(notes || "");
  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) return null;

  try {
    const raw = text.slice(
      start + META_START.length,
      end
    );

    const meta = JSON.parse(raw);

    return meta?.version === 2 ? meta : null;
  } catch {
    return null;
  }
}

function calculateSimper(record) {
  if (!record) {
    return {
      progress: 0,
      released: false,
      steps: [false, false, false, false],
      legacy: false,
    };
  }

  const meta = parseSimperMetadata(record.notes);

  const validation =
    record.administration_status === "passed";

  const theory =
    record.theory_status === "passed";

  const practice =
    record.practice_status === "passed";

  const released =
    validation &&
    theory &&
    practice &&
    meta?.application_status === "approved" &&
    meta?.orientation_status === "completed" &&
    meta?.issuance_status === "issued" &&
    Boolean(record.graduation_date);

  const steps = [
    validation,
    theory,
    practice,
    released,
  ];

  return {
    progress: steps.filter(Boolean).length * 25,
    released,
    steps,
    legacy:
      !meta && record.status === "passed",
  };
}

function getSamaptaSessions(records) {
  const sessions = new Map();

  records.forEach((record) => {
    if (!record.test_date) return;

    const key = String(record.test_date).slice(0, 10);

    if (!sessions.has(key)) {
      sessions.set(key, []);
    }

    sessions.get(key).push(record);
  });

  const output = [];

  sessions.forEach((items, date) => {
    const getScore = (type) => {
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

      const n = Number(record.score);
      return Number.isFinite(n) ? n : null;
    };

    const a = getScore("Lari 12 Menit");

    const bParts = [
      getScore("Pull-Up"),
      getScore("Push-Up"),
      getScore("Sit-Up"),
      getScore("Shuttle Run"),
    ];

    if (
      a === null ||
      bParts.some((n) => n === null)
    ) {
      return;
    }

    const b =
      bParts.reduce((sum, n) => sum + n, 0) / 4;

    const run = items.find(
      (item) =>
        normalizeType(item.test_type) ===
        "lari12menit"
    );

    const distance =
      run?.result_value === null ||
      run?.result_value === undefined ||
      run?.result_value === ""
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
    (a, b) => a.date.localeCompare(b.date)
  );
}

function Icon({ name, size = 21 }) {
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
        <rect
          x="5"
          y="3"
          width="14"
          height="18"
          rx="2"
        />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),

    check: <path d="m4 12 5 5L20 6" />,

    chart: (
      <path d="M5 20v-7M11 20V5M17 20v-11M22 20V3" />
    ),

    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),

    arrow: <path d="m9 5 7 7-7 7" />,

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

    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l4 2" />
      </>
    ),

    flag: (
      <>
        <path d="M5 22V3M5 4c6-4 9 4 15 0v11c-6 4-9-4-15 0" />
      </>
    ),

    calendar: (
      <>
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />
        <path d="M7 3v4M17 3v4M3 10h18" />
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
  const safe = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div
      className="track-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function Metric({
  label,
  value,
  description,
  icon,
  color,
  onClick,
}) {
  return (
    <div className="track-metric">
      <div className="track-metric-main">
        <div
          className="track-metric-icon"
          style={{ background: color }}
        >
          <Icon name={icon} size={25} />
        </div>

        <div className="track-metric-text">
          <span className="track-metric-label">
            {label}
          </span>

          <strong className="track-metric-value">
            {value}
          </strong>

          <small className="track-metric-description">
            {description}
          </small>
        </div>

        {onClick && (
          <button
            type="button"
            className="track-icon-button"
            onClick={onClick}
            aria-label={`Buka ${label}`}
          >
            <Icon name="arrow" size={17} />
          </button>
        )}
      </div>

      <div
        className="track-sparkline"
        style={{ color }}
        aria-hidden="true"
      >
        {[30, 48, 58, 72, 95].map((n) => (
          <span
            key={n}
            style={{ height: `${n}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function MentorDashboard() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] =
    useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [menuOpen, setMenuOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [maintenanceMode, setMaintenanceMode] =
    useState(null);

  const [accessStatus, setAccessStatus] =
    useState("checking");

  const isAdmin =
    normalize(mentor?.role) === "admin";

  async function fetchMaintenanceStatus() {
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
        `Gagal membaca status maintenance: ${statusError.message}`
      );
    }

    if (typeof data?.maintenance_mode !== "boolean") {
      throw new Error(
        "Pengaturan Maintenance Mode belum tersedia."
      );
    }

    setMaintenanceMode(data.maintenance_mode);

    return data.maintenance_mode;
  }

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
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("status", "active")
        .order("start_date", {
          ascending: false,
        }),

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
        `Kategori: ${typeRes.error.message}`
      );
    }

    const list = programRes.data || [];
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
          "id,program_id,type_code,status,activity_date"
        )
        .in("program_id", ids),

      supabase
        .from("post_test_scores")
        .select(
          "id,program_id,score,test_date"
        )
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
      "Pencapaian",
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
  }

  function applyDashboard(data) {
    setPrograms(data.programs);
    setAchievementTypes(data.types);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractices(data.practices);
    setSamapta(data.samapta);
    setSimper(data.simper);
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setAccessStatus("checking");

      try {
        // 1. Periksa sesi login terlebih dahulu.
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

        // 2. Baca role pengguna.
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          throw new Error(
            `Gagal membaca profil: ${profileError.message}`
          );
        }

        if (!profile) {
          throw new Error(
            "Profil akun tidak ditemukan."
          );
        }

        const role = normalize(profile.role);

        const admin = role === "admin";
        const mentorRole = role === "mentor";

        const participant = [
          "participant",
          "peserta",
        ].includes(role);

        if (
          !admin &&
          !mentorRole &&
          !participant
        ) {
          throw new Error(
            "Akun tidak memiliki izin mengakses OJT MineTrack."
          );
        }

        // 3. Periksa status Maintenance Mode.
        // Status harus benar-benar diketahui sebelum
        // melakukan pengalihan atau memuat data OJT.
        const maintenance =
          await fetchMaintenanceStatus();

        if (!mounted) return;

        // 4. Saat maintenance ON, hanya Admin
        // yang boleh melanjutkan.
        if (maintenance && !admin) {
          setMentor(null);
          setAccessStatus("maintenance");
          return;
        }

        // 5. Peserta diarahkan ke Dashboard Peserta.
        if (participant) {
          setAccessStatus("redirecting");
          router.replace("/dashboard-peserta");
          return;
        }

        // 6. Admin dan Mentor memuat Dashboard.
        // Mentor tidak menggunakan filter mentor_id.
        const next = await fetchDashboardData();

        if (!mounted) return;

        setMentor({
          ...profile,
          role,
        });

        applyDashboard(next);
        setAccessStatus("allowed");
      } catch (err) {
        if (mounted) {
          setMentor(null);
          setAccessStatus("error");
          setError(
            err?.message ||
              "Gagal memuat Dashboard OJT MineTrack."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!isAdmin) return;

    let active = true;

    async function checkStatus() {
      try {
        const mode = await fetchMaintenanceStatus();

        if (!active) return;

        setMaintenanceMode(mode);
      } catch {
        if (active) {
          setMaintenanceMode(null);
        }
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

  async function refresh() {
    if (
      loading ||
      refreshing ||
      !mentor ||
      accessStatus !== "allowed"
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      // Status Maintenance diperiksa ulang sebelum
      // memperbarui data Dashboard.
      const mode = await fetchMaintenanceStatus();

      if (mode && !isAdmin) {
        setMentor(null);
        setPrograms([]);
        setAccessStatus("maintenance");
        return;
      }

      const next = await fetchDashboardData();

      applyDashboard(next);
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function navigate(path) {
    setMenuOpen(false);
    router.push(path);
  }

  const dataByProgram = useMemo(() => {
    const codes = new Map(
      achievementTypes.map((item) => [
        normalize(item.name),
        item.code,
      ])
    );

    const output = {};

    programs.forEach((program) => {
      const id = program.id;

      const a = achievements.filter(
        (r) => r.program_id === id
      );

      const pt = postTests.filter(
        (r) => r.program_id === id
      );

      const pr = practices.filter(
        (r) => r.program_id === id
      );

      const sm = samapta.filter(
        (r) => r.program_id === id
      );

      const sp = simper.filter(
        (r) => r.program_id === id
      );

      const verifiedCodes = new Set(
        a
          .filter((r) => r.status === "verified")
          .map((r) => r.type_code)
      );

      const done = ACHIEVEMENTS.filter((name) => {
        const code = codes.get(normalize(name));
        return code && verifiedCodes.has(code);
      }).length;

      const achievementProgress = Math.round(
        (done / ACHIEVEMENTS.length) * 100
      );

      const chosenSimper =
        sp.find((record) =>
          parseSimperMetadata(record.notes)
        ) ||
        sp[0] ||
        null;

      const simperInfo =
        calculateSimper(chosenSimper);

      const samaptaSessions =
        getSamaptaSessions(sm);

      const latestSamapta =
        samaptaSessions.length
          ? samaptaSessions[
              samaptaSessions.length - 1
            ]
          : null;

      const weeks = new Set();

      const markWeek = (value) => {
        const number = weekOf(
          value,
          program.start_date
        );

        if (number !== null) {
          weeks.add(number);
        }
      };

      a.forEach((r) =>
        markWeek(r.activity_date)
      );

      pt.forEach((r) =>
        markWeek(r.test_date)
      );

      pr.forEach((r) =>
        markWeek(r.practice_date)
      );

      sm.forEach((r) =>
        markWeek(r.test_date)
      );

      output[id] = {
        done,
        progress: achievementProgress,
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
        simperPassed: simperInfo.released,
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

  const filtered = useMemo(() => {
    const keyword = normalize(search);

    return programs.filter((program) => {
      const matchSite =
        siteFilter === "ALL" ||
        program.site === siteFilter;

      const name = normalize(
        program.peserta?.full_name
      );

      const department = normalize(
        program.peserta?.department
      );

      const matchKeyword =
        !keyword ||
        name.includes(keyword) ||
        department.includes(keyword);

      return matchSite && matchKeyword;
    });
  }, [programs, search, siteFilter]);

  const summary = useMemo(() => {
    const ids = new Set(
      filtered.map((program) => program.id)
    );

    const relevantPractices = practices.filter(
      (row) => ids.has(row.program_id)
    );

    const totalProgress = filtered.reduce(
      (sum, program) =>
        sum +
        (dataByProgram[program.id]?.progress || 0),
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
          (dataByProgram[program.id]?.[key]?.length ||
            0) > 0
      ).length;
    }

    return {
      active: filtered.length,

      progress: filtered.length
        ? Math.round(
            totalProgress / filtered.length
          )
        : 0,

      practiceAverage:
        average(relevantPractices),

      completed: filtered.filter(
        (program) =>
          dataByProgram[program.id]?.done === 6
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
          dataByProgram[program.id]?.simperPassed
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
  }, [filtered, practices, dataByProgram]);

  const siteProgress = useMemo(() => {
    const unique = [
      ...new Set(
        filtered.map(
          (program) =>
            program.site || "Belum diisi"
        )
      ),
    ];

    return unique.map((site) => {
      const entries = filtered.filter(
        (program) =>
          (program.site || "Belum diisi") === site
      );

      const value = entries.length
        ? Math.round(
            entries.reduce(
              (sum, program) =>
                sum +
                (dataByProgram[program.id]?.progress ||
                  0),
              0
            ) / entries.length
          )
        : 0;

      return {
        site,
        value,
        count: entries.length,
      };
    });
  }, [filtered, dataByProgram]);

  // Tampilan khusus saat maintenance ON
  // untuk pengguna selain Admin.
  if (accessStatus === "maintenance") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#061e24",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 49 }}>
            🛠️
          </div>

          <h1
            style={{
              fontSize: 30,
              marginBottom: 16,
            }}
          >
            OJT MineTrack Sedang Maintenance
          </h1>

          <p
            style={{
              color: "#cbd5d1",
              lineHeight: 1.8,
            }}
          >
            Sistem sedang dalam proses
            pemeliharaan. Akses Mentor dan
            Peserta untuk sementara tidak
            tersedia.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#d8b45a",
              color: "#061e24",
              border: 0,
              borderRadius: 12,
              padding: "14px 22px",
              fontWeight: 800,
              cursor: "pointer",
              marginTop: 17,
            }}
          >
            Coba Lagi
          </button>

          <div style={{ marginTop: 23 }}>
            <button
              type="button"
              onClick={logout}
              style={{
                background: "transparent",
                color: "#d8e8e2",
                border: "1px solid #526e67",
                padding: "12px 18px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Keluar Akun
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Jangan tampilkan data ketika status
  // akses belum dapat dipastikan.
  if (
    accessStatus === "checking" ||
    accessStatus === "redirecting"
  ) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#061e24",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2>OJT MineTrack</h2>
          <p style={{ color: "#cbd5d1" }}>
            Memeriksa akses pengguna...
          </p>
        </div>
      </main>
    );
  }

  // Error pemeriksaan akses tidak boleh
  // dianggap sebagai Maintenance OFF.
  if (accessStatus === "error") {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#061e24",
          color: "white",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h1>Gagal Memuat Dashboard</h1>

          <p
            style={{
              color: "#cbd5d1",
              lineHeight: 1.8,
            }}
          >
            {error ||
              "Pemeriksaan akses belum berhasil."}
          </p>

          <p
            style={{
              color: "#9db4ae",
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            Sistem tidak akan menampilkan data OJT
            sebelum akses berhasil diverifikasi.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#d8b45a",
              color: "#061e24",
              border: 0,
              borderRadius: 12,
              padding: "14px 22px",
              fontWeight: 800,
              cursor: "pointer",
              marginTop: 16,
            }}
          >
            Coba Lagi
          </button>

          <div style={{ marginTop: 20 }}>
            <button
              type="button"
              onClick={() => router.replace("/login")}
              style={{
                background: "transparent",
                color: "#d8e8e2",
                border: "1px solid #526e67",
                padding: "12px 18px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Buka Halaman Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="track-shell">
      <style>{`
        * { box-sizing: border-box; }

        .track-shell {
          min-height: 100vh;
          background: #f2f6f8;
          color: #142c26;
          font-family: Arial, Helvetica, sans-serif;
        }

        .track-sidebar {
          position: fixed;
          inset: 0 auto 0 0;
          width: 248px;
          z-index: 50;
          display: flex;
          flex-direction: column;
          padding: 25px 15px;
          overflow-y: auto;
          color: white;
          background: linear-gradient(
            180deg,
            #07141c 0%,
            #08252a 56%,
            #073b2e 100%
          );
        }

        .track-brand {
          padding: 11px 12px 29px;
        }

        .track-brand-title {
          font-size: 25px;
          letter-spacing: -.7px;
          font-weight: 900;
        }

        .track-brand-title span {
          color: #2cca95;
        }

        .track-brand-sub {
          margin-top: 9px;
          color: #bccdc8;
          font-size: 11px;
          line-height: 1.8;
        }

        .track-nav {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 14px;
          margin-bottom: 5px;
          color: #dae7e1;
          background: transparent;
          border: 0;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }

        .track-nav.active,
        .track-nav:hover {
          color: white;
          background: linear-gradient(
            90deg, #087854, #145c48
          );
        }

        .track-nav:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .track-admin-label {
          padding: 13px 14px 8px;
          margin-top: 12px;
          color: #8ee7c4;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1px;
          border-top: 1px solid #ffffff26;
        }

        .track-admin-nav {
          background: #0c513f;
          border: 1px solid #36c79555;
        }

        .track-admin-nav:hover {
          background: #087854;
        }

        .track-maintenance-nav {
          background: #243b32;
          border: 1px solid #d8b45a70;
          color: #f5d68c;
        }

        .track-maintenance-nav:hover {
          background: #40513a;
        }

        .track-maintenance-indicator {
          margin-left: auto;
          padding: 4px 7px;
          border-radius: 7px;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .track-maintenance-indicator.off {
          color: #b4f5d8;
          background: #0b654a;
        }

        .track-maintenance-indicator.on {
          color: #ffe6ab;
          background: #95520d;
        }

        .track-maintenance-indicator.unknown {
          color: #d6ded9;
          background: #52615a;
        }

        .track-sidebar-bottom {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid #ffffff26;
        }

        .track-main {
          margin-left: 248px;
          min-width: 0;
        }

        .track-mobile-header {
          display: none;
        }

        .track-hero {
          position: relative;
          min-height: 255px;
          padding: 67px 36px 37px;
          color: white;
          background:
            linear-gradient(
              90deg,
              rgba(2,17,23,.97),
              rgba(5,26,28,.77) 48%,
              rgba(4,25,25,.19)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
        }

        .track-hero-kicker {
          color: #f5cb75;
          font-weight: 800;
          letter-spacing: 2px;
          font-size: 11px;
        }

        .track-hero h1 {
          margin: 17px 0 5px;
          font-size: clamp(31px, 4vw, 54px);
          font-weight: 900;
          line-height: 1.15;
        }

        .track-hero h1 span {
          color: #28c58b;
        }

        .track-hero p {
          color: #eff9f5;
          font-size: 15px;
        }

        .track-values {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 24px;
          color: #e6e9dc;
          font-size: 12px;
        }

        .track-value {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .track-value svg {
          color: #f2c96e;
        }

        .track-mentor {
          position: absolute;
          top: 18px;
          right: 24px;
          background: #061f24d9;
          border: 1px solid #ffffff30;
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 800;
        }

        .track-admin-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
          padding: 15px 17px;
          background: #e0f6ec;
          border: 1px solid #a8dfc8;
          border-radius: 14px;
        }

        .track-admin-banner strong {
          display: block;
          font-size: 13px;
          color: #075a40;
        }

        .track-admin-banner p {
          margin: 5px 0 0;
          font-size: 11px;
          color: #477366;
          line-height: 1.5;
        }

        .track-admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
        }

        .track-admin-button {
          border: 0;
          border-radius: 9px;
          padding: 11px 14px;
          color: white;
          background: #087c57;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .track-admin-button.maintenance {
          background: #153c2e;
        }

        .track-admin-button:hover {
          opacity: .9;
        }

        .track-content {
          max-width: 1520px;
          padding: 23px 24px 30px;
          margin: auto;
        }

        .track-metrics {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0,1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .track-metric {
          position: relative;
          min-width: 0;
          min-height: 143px;
          padding: 19px 17px;
          background: white;
          border: 1px solid #e6edf0;
          border-radius: 17px;
          box-shadow: 0 6px 22px #17384709;
          overflow: hidden;
        }

        .track-metric-main {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .track-metric-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          color: white;
        }

        .track-metric-text {
          min-width: 0;
          padding-right: 10px;
        }

        .track-metric-label {
          display: block;
          color: #172f37;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.35;
        }

        .track-metric-value {
          display: block;
          margin-top: 7px;
          font-size: 31px;
          font-weight: 900;
          color: #0c1925;
        }

        .track-metric-description {
          display: block;
          margin-top: 8px;
          color: #81909c;
          font-size: 10px;
          line-height: 1.5;
        }

        .track-icon-button {
          margin-left: auto;
          flex-shrink: 0;
          width: 29px;
          height: 29px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: #f0f5f7;
          cursor: pointer;
        }

        .track-sparkline {
          position: absolute;
          right: 15px;
          bottom: 15px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 36px;
          opacity: .65;
        }

        .track-sparkline span {
          width: 5px;
          border-radius: 3px 3px 0 0;
          background: currentColor;
        }

        .track-card {
          min-width: 0;
          padding: 22px;
          margin-bottom: 16px;
          background: white;
          border: 1px solid #e6edf0;
          border-radius: 17px;
          box-shadow: 0 6px 22px #17384708;
        }

        .track-card h2 {
          margin: 0;
          color: #14212b;
          font-size: 18px;
          font-weight: 900;
        }

        .track-card-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 9px;
        }

        .track-card-sub {
          margin: 8px 0 17px;
          color: #83919d;
          line-height: 1.6;
          font-size: 12px;
        }

        .track-top-sections {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 15px;
        }

        .track-site-row {
          display: grid;
          grid-template-columns:
            45px 82px minmax(0,1fr) 46px;
          gap: 12px;
          align-items: center;
          padding: 13px 0;
          border-bottom: 1px solid #edf1f2;
          font-size: 12px;
        }

        .track-site-row:last-child {
          border: 0;
        }

        .track-site-icon {
          width: 41px;
          height: 41px;
          border-radius: 11px;
          background: #e3f7ef;
          color: #0d9b6b;
          display: grid;
          place-items: center;
        }

        .track-progress {
          width: 100%;
          height: 10px;
          overflow: hidden;
          border-radius: 20px;
          background: #e9eff1;
        }

        .track-progress span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(
            90deg, #2bbd8a, #109367
          );
        }

        .track-monitor-grid {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(0,1fr));
          gap: 12px;
          padding: 14px 0;
        }

        .track-monitor-item {
          text-align: center;
          border-right: 1px solid #e9eef0;
          min-width: 0;
        }

        .track-monitor-item:last-child {
          border: 0;
        }

        .track-monitor-circle {
          width: 39px;
          height: 39px;
          border-radius: 50%;
          background: #e3f7ef;
          color: #07986b;
          display: grid;
          place-items: center;
          margin: 0 auto 7px;
        }

        .track-monitor-item strong {
          display: block;
          font-size: 20px;
          font-weight: 900;
        }

        .track-monitor-item small {
          display: block;
          margin-top: 5px;
          color: #85949d;
          font-size: 10px;
          line-height: 1.45;
        }

        .track-monitor-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #edf1f2;
          font-size: 12px;
          color: #50676a;
        }

        .track-monitor-row strong {
          color: #07875c;
          text-align: right;
        }

        .track-monitor-row:last-child {
          border: 0;
        }

        .track-filters {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .track-field {
          min-width: 0;
          background: white;
          border: 1px solid #dbe5e8;
          border-radius: 9px;
          padding: 11px 12px;
          color: #1f3939;
          font-size: 12px;
        }

        .track-search {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 11px;
          border: 1px solid #dbe5e8;
          border-radius: 9px;
          background: white;
          color: #8b9ba4;
        }

        .track-search input {
          border: 0;
          outline: 0;
          padding: 11px 10px 11px 0;
          width: 190px;
          min-width: 0;
          background: transparent;
          color: #17382c;
          font-size: 12px;
        }

        .track-table-wrap {
          overflow-x: auto;
        }

        .track-table {
          width: 100%;
          min-width: 830px;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }

        .track-table th {
          background: #f3f7f8;
          color: #6a8184;
          font-size: 11px;
          padding: 13px;
          white-space: nowrap;
        }

        .track-table td {
          border-bottom: 1px solid #edf1f2;
          padding: 14px 13px;
        }

        .track-table-name {
          font-weight: 800;
          color: #1b3530;
        }

        .track-badge {
          display: inline-block;
          border-radius: 20px;
          background: #def7ec;
          color: #078a61;
          font-weight: 800;
          font-size: 11px;
          padding: 6px 12px;
          white-space: nowrap;
        }

        .track-view {
          cursor: pointer;
          border: 0;
          background: #e7f6ef;
          color: #087550;
          border-radius: 9px;
          padding: 9px 12px;
          font-size: 12px;
          font-weight: 800;
        }

        .track-mobile-people {
          display: none;
        }

        .track-person {
          display: grid;
          grid-template-columns:
            minmax(0,1fr) auto;
          align-items: center;
          gap: 10px;
          border: 1px solid #e5edef;
          border-radius: 13px;
          padding: 12px;
          margin-bottom: 9px;
        }

        .track-person-heading {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .track-avatar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #d9f3e8;
          color: #087a55;
          font-size: 15px;
          font-weight: 900;
        }

        .track-person-name {
          font-size: 13px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .track-person-detail {
          margin-top: 4px;
          font-size: 11px;
          color: #85929c;
          line-height: 1.5;
        }

        .track-person-score {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .track-person-actions button {
          border: 0;
          width: 35px;
          height: 35px;
          background: #eff5f6;
          border-radius: 50%;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .track-empty {
          padding: 23px;
          color: #80929a;
          font-size: 13px;
          text-align: center;
        }

        .track-alert {
          background: #fff1f1;
          border: 1px solid #ffc7c7;
          border-radius: 12px;
          padding: 14px;
          color: #b91c1c;
          margin-bottom: 17px;
          overflow-wrap: anywhere;
        }

        .track-footer {
          padding: 19px 8px;
          color: #899ba6;
          font-size: 11px;
          text-align: center;
        }

        .track-overlay {
          display: none;
        }

        @media(max-width:1200px) {
          .track-metrics {
            grid-template-columns:
              repeat(2, minmax(0,1fr));
          }

          .track-top-sections {
            grid-template-columns: 1fr;
          }
        }

        @media(max-width:760px) {
          .track-sidebar {
            width: 255px;
            transform: translateX(-105%);
            transition: transform .2s;
          }

          .track-sidebar.open {
            transform: translateX(0);
          }

          .track-overlay.open {
            display: block;
            position: fixed;
            inset: 0;
            background: #0019138c;
            z-index: 45;
          }

          .track-main {
            margin-left: 0;
          }

          .track-mobile-header {
            height: 60px;
            display: flex;
            position: sticky;
            top: 0;
            z-index: 35;
            justify-content: space-between;
            align-items: center;
            padding: 0 18px;
            color: white;
            background: #091c24;
          }

          .track-mobile-header strong {
            font-size: 20px;
          }

          .track-mobile-header strong span {
            color: #29c88e;
          }

          .track-mobile-header button {
            color: white;
            background: transparent;
            border: 0;
            cursor: pointer;
          }

          .track-hero {
            min-height: 177px;
            padding: 23px 18px 29px;
          }

          .track-hero-kicker {
            font-size: 9px;
            letter-spacing: 1.3px;
          }

          .track-hero h1 {
            font-size: 30px;
            margin-top: 13px;
          }

          .track-hero p {
            font-size: 12px;
          }

          .track-values {
            gap: 9px;
            margin-top: 18px;
            font-size: 9px;
          }

          .track-value {
            gap: 4px;
          }

          .track-value svg {
            width: 13px;
            height: 13px;
          }

          .track-mentor {
            display: none;
          }

          .track-content {
            padding: 0 12px 22px;
            margin-top: -10px;
            position: relative;
            z-index: 1;
          }

          .track-admin-banner {
            align-items: stretch;
          }

          .track-admin-actions {
            width: 100%;
            flex-direction: column;
          }

          .track-admin-button {
            width: 100%;
          }

          .track-metrics {
            gap: 9px;
            margin-bottom: 13px;
          }

          .track-metric {
            min-height: 128px;
            padding: 12px 10px;
            border-radius: 14px;
          }

          .track-metric-main {
            gap: 9px;
          }

          .track-metric-icon {
            width: 35px;
            height: 35px;
            border-radius: 10px;
          }

          .track-metric-icon svg {
            width: 20px;
            height: 20px;
          }

          .track-metric-label {
            font-size: 10px;
          }

          .track-metric-value {
            font-size: 25px;
          }

          .track-metric-description {
            font-size: 9px;
          }

          .track-icon-button {
            position: absolute;
            top: 11px;
            right: 9px;
            width: 23px;
            height: 23px;
          }

          .track-sparkline {
            right: 11px;
            bottom: 12px;
          }

          .track-sparkline span {
            width: 4px;
          }

          .track-card {
            padding: 15px 13px;
            border-radius: 15px;
            margin-bottom: 12px;
          }

          .track-card h2 {
            font-size: 16px;
          }

          .track-card-sub {
            font-size: 11px;
          }

          .track-site-row {
            grid-template-columns:
              35px 65px minmax(0,1fr) 38px;
            gap: 8px;
            font-size: 11px;
          }

          .track-site-icon {
            width: 32px;
            height: 32px;
          }

          .track-monitor-grid {
            gap: 4px;
          }

          .track-monitor-circle {
            width: 33px;
            height: 33px;
          }

          .track-monitor-item strong {
            font-size: 18px;
          }

          .track-monitor-item small {
            font-size: 9px;
          }

          .track-card-heading {
            flex-wrap: wrap;
          }

          .track-filters {
            width: 100%;
          }

          .track-search {
            flex: 1.3;
            min-width: 0;
          }

          .track-search input {
            width: 100%;
            font-size: 11px;
          }

          .track-field {
            flex: 1;
            width: 105px;
            font-size: 11px;
          }

          .track-table-wrap {
            display: none;
          }

          .track-mobile-people {
            display: block;
          }

          .track-person {
            padding: 11px;
          }
        }

        @media(max-width:380px) {
          .track-metric-main {
            display: block;
          }

          .track-metric-icon {
            margin-bottom: 8px;
          }

          .track-metric {
            min-height: 150px;
          }

          .track-filters {
            flex-direction: column;
          }

          .track-search,
          .track-field {
            width: 100%;
          }
        }
      `}</style>

      <div
        className={`track-overlay ${
          menuOpen ? "open" : ""
        }`}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        className={`track-sidebar ${
          menuOpen ? "open" : ""
        }`}
      >
        <div className="track-brand">
          <div className="track-brand-title">
            OJT <span>MineTrack</span>
          </div>

          <div className="track-brand-sub">
            Emergency Response Group
            <br />
            PT Berau Coal
          </div>
        </div>

        <nav aria-label="Menu Dashboard">
          {NAV.map((item) => (
            <button
              type="button"
              key={item.url}
              className={`track-nav ${
                item.url === "/" ? "active" : ""
              }`}
              onClick={() => navigate(item.url)}
            >
              <Icon name={item.icon} size={19} />
              {item.label}
            </button>
          ))}

          {isAdmin && (
            <>
              <div className="track-admin-label">
                AKSES ADMINISTRATOR
              </div>

              <button
                type="button"
                className="track-nav track-admin-nav"
                onClick={() =>
                  navigate("/dashboard-peserta")
                }
              >
                <Icon name="users" size={19} />
                Preview Dashboard Peserta
              </button>

              <button
                type="button"
                className="track-nav track-maintenance-nav"
                onClick={() =>
                  navigate("/admin/maintenance")
                }
              >
                <Icon name="gear" size={19} />

                <span style={{ flex: 1 }}>
                  Maintenance Mode
                </span>

                <span
                  className={`track-maintenance-indicator ${
                    maintenanceMode === true
                      ? "on"
                      : maintenanceMode === false
                      ? "off"
                      : "unknown"
                  }`}
                >
                  {maintenanceMode === true
                    ? "ON"
                    : maintenanceMode === false
                    ? "OFF"
                    : "—"}
                </span>
              </button>
            </>
          )}
        </nav>

        <div className="track-sidebar-bottom">
          <button
            type="button"
            className="track-nav"
            onClick={refresh}
            disabled={
              loading ||
              refreshing ||
              !mentor ||
              accessStatus !== "allowed"
            }
          >
            <Icon name="refresh" size={19} />
            {refreshing
              ? "Memperbarui..."
              : "Refresh Data"}
          </button>

          <button
            type="button"
            className="track-nav"
            onClick={logout}
          >
            <Icon name="logout" size={19} />
            Keluar Akun
          </button>
        </div>
      </aside>

      <main className="track-main">
        <div className="track-mobile-header">
          <strong>
            OJT <span>MineTrack</span>
          </strong>

          <button
            type="button"
            aria-label="Buka menu"
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={28} />
          </button>
        </div>

        <header className="track-hero">
          <div className="track-mentor">
            {isAdmin
              ? `Administrator · ${
                  mentor?.full_name || "Admin"
                }`
              : mentor?.full_name || "Mentor OJT"}
          </div>

          <div className="track-hero-kicker">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>

          <h1>
            OJT <span>MineTrack</span>
          </h1>

          <p>
            Monitoring dan Evaluasi On Job Training
          </p>

          <div className="track-values">
            <div className="track-value">
              <Icon name="shield" size={17} />
              Safe People
            </div>

            <div className="track-value">
              <Icon name="gear" size={17} />
              Safe Operation
            </div>

            <div className="track-value">
              <Icon name="leaf" size={17} />
              Sustainable Mining
            </div>
          </div>
        </header>

        <div className="track-content">
          {error && (
            <div role="alert" className="track-alert">
              {error}
            </div>
          )}

          {loading ? (
            <section className="track-card">
              Memuat Dashboard...
            </section>
          ) : !mentor ? (
            <section className="track-card">
              Akses Dashboard tidak tersedia.
            </section>
          ) : (
            <>
              {isAdmin && (
                <div className="track-admin-banner">
                  <div>
                    <strong>
                      Mode Administrator — Dashboard Mentor
                    </strong>

                    <p>
                      Kamu sedang melihat Dashboard Mentor
                      menggunakan akun Admin.
                    </p>

                    <p>
                      Status Maintenance:{" "}
                      <strong
                        style={{
                          display: "inline",
                          color:
                            maintenanceMode === true
                              ? "#b45309"
                              : maintenanceMode === false
                              ? "#087c57"
                              : "#64748b",
                        }}
                      >
                        {maintenanceMode === true
                          ? "ON — Pemeliharaan Aktif"
                          : maintenanceMode === false
                          ? "OFF — Website Normal"
                          : "Belum dapat diperiksa"}
                      </strong>
                    </p>
                  </div>

                  <div className="track-admin-actions">
                    <button
                      type="button"
                      className="track-admin-button"
                      onClick={() =>
                        navigate("/dashboard-peserta")
                      }
                    >
                      Preview Dashboard Peserta
                    </button>

                    <button
                      type="button"
                      className="track-admin-button maintenance"
                      onClick={() =>
                        navigate("/admin/maintenance")
                      }
                    >
                      ⚙ Maintenance Mode
                    </button>
                  </div>
                </div>
              )}

              <section className="track-metrics">
                <Metric
                  label="Peserta OJT Aktif"
                  value={summary.active}
                  description="Berdasarkan filter saat ini"
                  icon="users"
                  color="#14986d"
                  onClick={() =>
                    navigate(
                      "/mentor/monitoring-peserta"
                    )
                  }
                />

                <Metric
                  label="Rata-rata Progres OJT"
                  value={`${summary.progress}%`}
                  description="Enam kategori pencapaian"
                  icon="chart"
                  color="#102d39"
                />

                <Metric
                  label="Rata-rata Nilai Praktik"
                  value={scoreText(
                    summary.practiceAverage
                  )}
                  description="Dari penilaian yang tercatat"
                  icon="file"
                  color="#dfaa2e"
                />

                <Metric
                  label="Pencapaian Lengkap"
                  value={summary.completed}
                  description="Peserta dengan 6 kategori terverifikasi"
                  icon="check"
                  color="#408cde"
                />
              </section>

              <div className="track-top-sections">
                <section className="track-card">
                  <div className="track-card-heading">
                    <h2>Progres OJT per Site</h2>
                  </div>

                  <p className="track-card-sub">
                    Persentase rata-rata enam kategori
                    pencapaian terverifikasi per site.
                  </p>

                  {siteProgress.length ? (
                    siteProgress.map((item) => (
                      <div
                        className="track-site-row"
                        key={item.site}
                      >
                        <div className="track-site-icon">
                          <Icon name="chart" size={19} />
                        </div>

                        <strong>{item.site}</strong>

                        <Progress value={item.value} />

                        <strong>{item.value}%</strong>
                      </div>
                    ))
                  ) : (
                    <div className="track-empty">
                      Belum ada program aktif.
                    </div>
                  )}
                </section>

                <section className="track-card">
                  <div className="track-card-heading">
                    <h2>Ringkasan Monitoring</h2>
                  </div>

                  <div className="track-monitor-grid">
                    {[
                      {
                        label: "Program aktif",
                        value: summary.active,
                        icon: "users",
                      },
                      {
                        label: "Dengan Post-Test",
                        value: summary.postTest,
                        icon: "clock",
                      },
                      {
                        label: "Dinilai praktik",
                        value: summary.practice,
                        icon: "file",
                      },
                      {
                        label: "6 kategori lengkap",
                        value: summary.completed,
                        icon: "flag",
                      },
                    ].map((item) => (
                      <div
                        className="track-monitor-item"
                        key={item.label}
                      >
                        <div className="track-monitor-circle">
                          <Icon
                            name={item.icon}
                            size={20}
                          />
                        </div>

                        <strong>{item.value}</strong>
                        <small>{item.label}</small>
                      </div>
                    ))}
                  </div>

                  <div className="track-monitor-row">
                    <span>Samapta tes lengkap</span>
                    <strong>
                      {summary.samapta} / {summary.active}
                    </strong>
                  </div>

                  <div className="track-monitor-row">
                    <span>
                      Samapta lari lulus (tes terakhir)
                    </span>
                    <strong>
                      {summary.samaptaPassed} /{" "}
                      {summary.active}
                    </strong>
                  </div>

                  <div className="track-monitor-row">
                    <span>
                      Peserta memiliki catatan SIMPER
                    </span>
                    <strong>
                      {summary.simper} / {summary.active}
                    </strong>
                  </div>

                  <div className="track-monitor-row">
                    <span>SIMPER telah terbit</span>
                    <strong>
                      {summary.simperIssued} /{" "}
                      {summary.active}
                    </strong>
                  </div>

                  <div className="track-monitor-row">
                    <span>Rata-rata progres SIMPER</span>
                    <strong>
                      {summary.simperAverage}%
                    </strong>
                  </div>

                  <div className="track-monitor-row">
                    <span>
                      Rata-rata minggu dengan aktivitas
                    </span>
                    <strong>
                      {summary.averageWeeks} / 25
                    </strong>
                  </div>
                </section>
              </div>

              <section className="track-card">
                <div className="track-card-heading">
                  <h2>Daftar Peserta OJT Aktif</h2>

                  <div className="track-filters">
                    <div className="track-search">
                      <Icon name="search" size={17} />

                      <input
                        type="search"
                        value={search}
                        onChange={(event) =>
                          setSearch(event.target.value)
                        }
                        placeholder="Cari nama / departemen..."
                        aria-label="Cari peserta OJT"
                      />
                    </div>

                    <select
                      className="track-field"
                      value={siteFilter}
                      onChange={(event) =>
                        setSiteFilter(event.target.value)
                      }
                      aria-label="Filter berdasarkan site"
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
                  </div>
                </div>

                <p className="track-card-sub">
                  Progres OJT = enam kategori pencapaian.
                  Progres SIMPER dan aktivitas 25 minggu
                  ditampilkan terpisah.
                </p>

                <div className="track-table-wrap">
                  <table className="track-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Peserta</th>
                        <th>Departemen</th>
                        <th>Site</th>
                        <th>Periode OJT</th>
                        <th>Pencapaian</th>
                        <th>SIMPER</th>
                        <th>Aktivitas</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((program, index) => {
                        const info =
                          dataByProgram[program.id];

                        return (
                          <tr key={program.id}>
                            <td>{index + 1}</td>

                            <td>
                              <span className="track-table-name">
                                {program.peserta?.full_name ||
                                  "Peserta OJT"}
                              </span>
                            </td>

                            <td>
                              {program.peserta?.department ||
                                "—"}
                            </td>

                            <td>
                              {program.site || "—"}
                            </td>

                            <td>
                              {formatDate(
                                program.start_date
                              )}
                              {" – "}
                              {formatDate(
                                program.end_date
                              )}
                            </td>

                            <td>
                              <div
                                style={{
                                  minWidth: 100,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <Progress
                                  value={
                                    info?.progress || 0
                                  }
                                />

                                <strong>
                                  {info?.progress || 0}%
                                </strong>
                              </div>
                            </td>

                            <td>
                              <strong>
                                {info?.simperProgress || 0}%
                              </strong>
                            </td>

                            <td>
                              {info?.activityWeeks || 0}/25
                            </td>

                            <td>
                              <span className="track-badge">
                                Aktif
                              </span>
                            </td>

                            <td>
                              <button
                                className="track-view"
                                type="button"
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
                      })}
                    </tbody>
                  </table>

                  {!filtered.length && (
                    <div className="track-empty">
                      Tidak ada peserta ditemukan.
                    </div>
                  )}
                </div>

                <div className="track-mobile-people">
                  {!filtered.length && (
                    <div className="track-empty">
                      Tidak ada peserta yang sesuai filter.
                    </div>
                  )}

                  {filtered.map((program) => {
                    const info =
                      dataByProgram[program.id];

                    const name =
                      program.peserta?.full_name ||
                      "Peserta OJT";

                    return (
                      <article
                        className="track-person"
                        key={program.id}
                      >
                        <div>
                          <div className="track-person-heading">
                            <div className="track-avatar">
                              {initials(name)}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div className="track-person-name">
                                {name}
                              </div>

                              <div className="track-person-detail">
                                {program.peserta?.department ||
                                  "—"}
                                {" · "}
                                {program.site || "—"}
                              </div>
                            </div>
                          </div>

                          <div className="track-person-score">
                            <span style={{ minWidth: 67 }}>
                              OJT
                            </span>

                            <Progress
                              value={
                                info?.progress || 0
                              }
                            />

                            <span>
                              {info?.progress || 0}%
                            </span>
                          </div>

                          <div className="track-person-score">
                            <span style={{ minWidth: 67 }}>
                              SIMPER
                            </span>

                            <Progress
                              value={
                                info?.simperProgress || 0
                              }
                            />

                            <span>
                              {info?.simperProgress || 0}%
                            </span>
                          </div>

                          <div className="track-person-detail">
                            Aktivitas:{" "}
                            {info?.activityWeeks || 0}
                            /25 minggu
                            {" · "}
                            Samapta:{" "}
                            {info?.samaptaComplete
                              ? "Tes lengkap"
                              : "Belum lengkap"}
                          </div>
                        </div>

                        <div className="track-person-actions">
                          <button
                            type="button"
                            aria-label={
                              `Lihat detail ${name}`
                            }
                            onClick={() =>
                              navigate(
                                `/peserta/${program.id}`
                              )
                            }
                          >
                            <Icon
                              name="arrow"
                              size={17}
                            />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          <footer className="track-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </footer>
        </div>
      </main>
    </div>
  );
}
