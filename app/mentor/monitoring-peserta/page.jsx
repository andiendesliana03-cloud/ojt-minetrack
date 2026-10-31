
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

const normalizeKey = (value) =>
  normalize(value).replace(/[^a-z0-9]/g, "");

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(+match[1], +match[2] - 1, +match[3])
  );

  if (
    date.getUTCFullYear() !== +match[1] ||
    date.getUTCMonth() !== +match[2] - 1 ||
    date.getUTCDate() !== +match[3]
  ) return null;

  return date;
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
      (week) => date >= week.start && date <= week.end
    )?.week ?? null
  );
}

function programWeekRange(program, weekNumber) {
  const week = GLOBAL_WEEKS[weekNumber - 1];

  if (!week || !parseDate(program?.start_date)) {
    return null;
  }

  const programStart = String(program.start_date).slice(0, 10);
  const programEnd = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    week.start > programStart ? week.start : programStart;

  const end =
    programEnd && programEnd < week.end
      ? programEnd
      : week.end;

  return start <= end ? { start, end } : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date) || !parseDate(program?.start_date)) {
    return false;
  }

  const start = String(program.start_date).slice(0, 10);
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

function categoryOf(value) {
  const key = normalizeKey(value);

  if (["fisik", "physical"].includes(key)) return "Fisik";

  if (
    ["training", "internaltraining", "pelatihan"].includes(key)
  ) return "Training";

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) return "Sosialisasi";

  if (
    ["coaching", "pembinaan"].includes(key)
  ) return "Coaching";

  if (
    ["orientasi", "orientasiarea", "areaorientation"]
      .includes(key)
  ) return "Orientasi Area";

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"]
      .includes(key)
  ) return "Hazard";

  return null;
}

function resolveCategory(record, typeMap) {
  return (
    categoryOf(record.type_code) ||
    categoryOf(typeMap.get(normalizeKey(record.type_code))) ||
    null
  );
}

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

function activityValue(rows, categoryName) {
  if (categoryName !== "Fisik") return rows.length;

  const meters = rows.reduce((sum, item) => {
    const km = Number(item.distance_km);

    return sum + (
      Number.isFinite(km) && km > 0
        ? Math.round(km * 1000)
        : 0
    );
  }, 0);

  return meters / 1000;
}

function calculateProgress(program, records, typeMap) {
  const eligibleWeeks = GLOBAL_WEEKS.filter(
    (week) => programWeekRange(program, week.week)
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
          Math.min(100, (amount / target.target) * 100)
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
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{note}</span>
      </div>
    </div>
  );
}

export default function MonitoringPesertaPage() {
  const router = useRouter();

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
        .order("start_date", { ascending: false });

      if (userRole === "mentor") {
        query = query.eq("mentor_id", userId);
      }

      const [programResult, typeResult] = await Promise.all([
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

      const validPrograms = (programResult.data || [])
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

  const verifyAccess = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return null;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error("Profil pengguna tidak ditemukan.");
    }

    const currentRole = normalize(profile.role);

    if (["participant", "peserta"].includes(currentRole)) {
      router.replace("/dashboard-peserta");
      return null;
    }

    if (!["admin", "mentor"].includes(currentRole)) {
      throw new Error(
        "Monitoring Peserta hanya tersedia untuk Admin dan Mentor."
      );
    }

    return { user, profile, currentRole };
  }, [router]);

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
          err?.message || "Gagal memuat Monitoring Peserta."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [verifyAccess, fetchDashboardData, applyData]);

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
          err?.message || "Gagal memperbarui data peserta."
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

  useEffect(() => {
    if (!account || accessError) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [account, accessError, refresh]);

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
        simperRows.find(
          (item) =>
            String(item.notes || "").includes("[[SIMPER_V2]]")
        ) ||
        simperRows[0] ||
        null;

      output[id] = {
        ...progress,
        postAverage: averageScore(post),
        practiceAverage: averageScore(practice),
        samaptaRecords: samaptaRows.length,
        simperStatus: simperLabel(latestSimper),
        totalAchievements: achievementsForProgram.filter(
          (item) => insideProgram(item.activity_date, program)
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

      const matchesSite =
        selectedSite === "ALL" ||
        (selectedSite === "UNASSIGNED"
          ? !program.site
          : program.site === selectedSite);

      const matchesStatus =
        selectedStatus === "ALL" ||
        normalize(program.status) === selectedStatus;

      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [programs, search, selectedSite, selectedStatus]);

  const activeCount = programs.filter(
    (item) =>
      ["active", "approved", "aktif"].includes(
        normalize(item.status)
      )
  ).length;

  const siteCount = programs.filter(
    (item) => SITES.includes(item.site)
  ).length;

  const averageProgress = filtered.length
    ? filtered.reduce(
        (sum, program) =>
          sum + (dataByProgram[program.id]?.overall || 0),
        0
      ) / filtered.length
    : 0;

  const totalVerified = filtered.reduce(
    (sum, program) =>
      sum + (dataByProgram[program.id]?.verified || 0),
    0
  );

  const availableSites = [
    ...new Set([
      ...SITES,
      ...programs.map((item) => item.site).filter(Boolean),
    ]),
  ];

  if (loading) {
    return (
      <main className="mp-loading">
        <style>{css}</style>
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Peserta OJT...</p>
      </main>
    );
  }

  if (!account || accessError) {
    return (
      <main className="mp-loading">
        <style>{css}</style>
        <h2>Monitoring Peserta Tidak Dapat Ditampilkan</h2>
        <p>{error || "Akses tidak tersedia."}</p>

        <button onClick={() => router.push("/")}>
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="mp-root">
      <style>{css}</style>

      <header className="mp-topbar">
        <div className="mp-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="mp-account">
          <div className="mp-avatar">
            {initials(account.full_name)}
          </div>
          <div>
            <strong>{account.full_name || "Pengguna"}</strong>
            <small>
              {isAdmin ? "Administrator" : "Mentor OJT"}
            </small>
          </div>
        </div>
      </header>

      <div className="mp-container">
        <section className="mp-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>Monitoring Peserta OJT</h1>

            <p>
              Data peserta, pencapaian kompetensi,
              dan ringkasan penilaian dalam satu tampilan.
            </p>
          </div>

          <div className="mp-hero-actions">
            <button
              onClick={() => router.push("/")}
            >
              ← Dashboard
            </button>

            <button
              onClick={() =>
                router.push("/mentor/daftar-peserta")
              }
            >
              + Daftarkan Peserta
            </button>

            <button
              onClick={() =>
                router.push("/mentor/persetujuan-peserta")
              }
            >
              Persetujuan Peserta
            </button>
          </div>
        </section>

        {error && (
          <div className="mp-error" role="alert">
            {error}
          </div>
        )}

        <div className="mp-heading">
          <div>
            <h2>Ringkasan Peserta</h2>
            <p>
              Menampilkan program OJT sesuai hak akses akun.
            </p>
          </div>

          <button
            className="mp-refresh"
            onClick={() => refresh(false)}
            disabled={refreshing}
          >
            {refreshing ? "Memperbarui..." : "↻ Refresh Data"}
          </button>
        </div>

        <section className="mp-stats">
          <StatCard
            icon="👥"
            label="Total Program"
            value={programs.length}
            note="Program yang dapat diakses"
          />

          <StatCard
            icon="✅"
            label="Program Aktif"
            value={activeCount}
            note="Aktif atau disetujui"
          />

          <StatCard
            icon="📍"
            label="Site Terisi"
            value={siteCount}
            note="Site penempatan valid"
          />

          <StatCard
            icon="📊"
            label="Rata-rata Progres"
            value={`${formatNumber(averageProgress)}%`}
            note="Program sesuai filter"
          />

          <StatCard
            icon="🗂️"
            label="Verified"
            value={totalVerified}
            note="Achievement sesuai filter"
          />
        </section>

        <section className="mp-card">
          <div className="mp-heading">
            <div>
              <h2>Daftar & Monitoring Peserta</h2>
              <p>
                Cari peserta atau filter berdasarkan site
                dan status program.
              </p>
            </div>

            <span className="mp-count">
              {filtered.length} dari {programs.length} program
            </span>
          </div>

          <div className="mp-filters">
            <label>
              Cari Peserta
              <input
                type="search"
                placeholder="Nama atau departemen..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
            </label>

            <label>
              Site Penempatan
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
              Status Program
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
              className="mp-reset"
              onClick={() => {
                setSearch("");
                setSelectedSite("ALL");
                setSelectedStatus("ALL");
              }}
            >
              Reset Filter
            </button>
          </div>

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
                  const info = dataByProgram[program.id] || {};

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
                              {participant.full_name ||
                                "Peserta OJT"}
                            </strong>

                            <small>
                              {participant.department || "—"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        {program.site || "Belum Ditentukan"}
                      </td>

                      <td>
                        <span className="mp-date">
                          {formatDate(program.start_date)}
                        </span>
                        <span className="mp-date">
                          {formatDate(program.end_date)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            "mp-badge " +
                            (normalize(program.status) === "active"
                              ? "active"
                              : "neutral")
                          }
                        >
                          {programLabel(program.status)}
                        </span>
                      </td>

                      <td>
                        <div className="mp-progress-cell">
                          <div>
                            <strong>
                              {formatNumber(info.overall || 0)}%
                            </strong>

                            <small>
                              {info.activeWeeks || 0}/
                              {info.eligibleWeeks || 0} minggu
                              ada Verified
                            </small>
                          </div>

                          <ProgressBar
                            value={info.overall || 0}
                          />
                        </div>
                      </td>

                      <td>
                        <strong>{info.verified || 0}</strong>
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
                      Tidak ada peserta yang sesuai dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mp-card">
          <div className="mp-heading">
            <div>
              <h2>Informasi Monitoring</h2>
              <p>
                Data monitoring mengikuti Kalender Global
                OJT 2026–2027.
              </p>
            </div>
          </div>

          <div className="mp-info-grid">
            <div>
              <strong>Kalender Global</strong>
              <p>
                Week 01: 12–18 September 2026.
                Week 25: 28 Februari–6 Maret 2027.
              </p>
            </div>

            <div>
              <strong>Perhitungan Achievement</strong>
              <p>
                Hanya data Verified dalam periode
                OJT peserta yang dihitung.
                Target diterapkan per minggu.
              </p>
            </div>

            <div>
              <strong>Status Akun & Online</strong>
              <p>
                Tidak ditampilkan karena modul ini belum
                menggunakan sumber status aktivasi
                dan aktivitas login yang terverifikasi.
              </p>
            </div>
          </div>
        </section>

        <footer className="mp-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal

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
              : "—"}
            {" "}WITA
          </div>
        </footer>
      </div>
    </main>
  );
}

const css = `
  * {
    box-sizing: border-box;
  }

  .mp-root {
    min-height: 100vh;
    background: #f5f8fa;
    color: #173047;
    font-family: Arial, Helvetica, sans-serif;
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
    opacity: .5;
    cursor: not-allowed;
  }

  .mp-loading {
    min-height: 100vh;
    background: #f5f8fa;
    color: #173047;
    padding: 40px;
    font-family: Arial, sans-serif;
  }

  .mp-loading button {
    border: 0;
    padding: 12px 16px;
    border-radius: 9px;
    background: #087e58;
    color: white;
    font-weight: bold;
  }

  .mp-topbar {
    height: 70px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 35px;
    background: white;
    border-bottom: 1px solid #e2eaf0;
  }

  .mp-brand {
    font-size: 25px;
    font-weight: 900;
    letter-spacing: -.7px;
  }

  .mp-brand span {
    color: #07875e;
  }

  .mp-brand small {
    margin-left: 7px;
    font-size: 11px;
    font-weight: 700;
    color: #82909f;
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
    background: #dff4ea;
    color: #087b58;
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
  }

  .mp-account small {
    margin-top: 4px;
    color: #8394a4;
    font-size: 11px;
  }

  .mp-container {
    max-width: 1600px;
    padding: 22px;
    margin: auto;
  }

  .mp-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    padding: 28px;
    border-radius: 17px;
    color: white;
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

  .mp-hero small {
    color: #efca77;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .mp-hero h1 {
    font-size: clamp(26px, 3vw, 36px);
    margin: 10px 0;
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
    color: white;
    border-radius: 9px;
    padding: 11px 13px;
    font-size: 11px;
    font-weight: 800;
  }

  .mp-hero-actions button:hover {
    background: #ffffff30;
  }

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
  }

  .mp-heading p {
    color: #8191a0;
    font-size: 12px;
    margin: 6px 0 0;
  }

  .mp-refresh {
    border: 1px solid #dbe8e1;
    background: white;
    border-radius: 9px;
    color: #087c58;
    padding: 11px 15px;
    font-size: 12px;
    font-weight: 800;
  }

  .mp-stats {
    display: grid;
    grid-template-columns: repeat(5,minmax(0,1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .mp-stat {
    display: flex;
    gap: 11px;
    align-items: center;
    background: white;
    border: 1px solid #e1eaf0;
    border-radius: 14px;
    padding: 17px;
    min-width: 0;
  }

  .mp-stat-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 11px;
    flex-shrink: 0;
    background: #e7f7ee;
    font-size: 22px;
  }

  .mp-stat > div {
    min-width: 0;
  }

  .mp-stat small {
    display: block;
    color: #7e90a0;
    font-size: 11px;
  }

  .mp-stat strong {
    display: block;
    font-size: 24px;
    color: #0a7958;
    margin: 5px 0;
  }

  .mp-stat div > span {
    color: #8a98a6;
    font-size: 10px;
    line-height: 1.5;
  }

  .mp-card {
    background: white;
    border: 1px solid #e2eaf0;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 18px;
    box-shadow: 0 4px 16px rgba(20,43,65,.035);
  }

  .mp-count {
    display: inline-block;
    background: #e8f7ef;
    color: #087d58;
    border-radius: 20px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 800;
  }

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
  }

  .mp-filters input,
  .mp-filters select {
    border: 1px solid #dce6eb;
    border-radius: 9px;
    background: white;
    color: #173047;
    padding: 12px;
    width: 100%;
    min-width: 0;
    font-size: 12px;
  }

  .mp-reset {
    border: 1px solid #d9e4e9;
    background: #f4f7f9;
    padding: 12px 15px;
    border-radius: 9px;
    color: #426070;
    font-size: 11px;
    font-weight: 800;
  }

  .mp-table-scroll {
    width: 100%;
    overflow-x: auto;
  }

  .mp-table {
    border-collapse: collapse;
    min-width: 1150px;
    width: 100%;
    font-size: 12px;
  }

  .mp-table th {
    background: #f1f6f8;
    color: #607789;
    text-align: left;
    padding: 14px 10px;
    white-space: nowrap;
    font-size: 11px;
  }

  .mp-table td {
    padding: 15px 10px;
    border-bottom: 1px solid #eaf0f3;
    vertical-align: middle;
  }

  .mp-table tbody tr:hover {
    background: #fbfdfc;
  }

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
    color: #203646;
  }

  .mp-person small {
    display: block;
    margin-top: 5px;
    color: #8596a5;
    font-size: 10px;
  }

  .mp-date {
    display: block;
    white-space: nowrap;
    font-size: 11px;
    margin-bottom: 4px;
  }

  .mp-badge {
    display: inline-block;
    padding: 7px 10px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .mp-badge.active {
    color: #078155;
    background: #e0f7ea;
  }

  .mp-badge.neutral {
    background: #eef2f6;
    color: #657787;
  }

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
    color: #087c58;
  }

  .mp-progress-cell small {
    color: #8595a2;
    font-size: 9px;
  }

  .mp-progress {
    background: #e1eae6;
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

  .mp-simper {
    color: #536879;
    font-size: 11px;
    white-space: nowrap;
  }

  .mp-detail {
    border: 1px solid #0a966e;
    background: #eaf9f1;
    color: #087d58;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .mp-detail:hover {
    background: #d6f3e5;
  }

  .mp-empty {
    text-align: center;
    color: #8797a6;
    padding: 35px !important;
  }

  .mp-info-grid {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 12px;
  }

  .mp-info-grid > div {
    padding: 15px;
    background: #f5f9f7;
    border: 1px solid #e5eee9;
    border-radius: 11px;
  }

  .mp-info-grid strong {
    font-size: 12px;
  }

  .mp-info-grid p {
    color: #718798;
    font-size: 11px;
    line-height: 1.75;
    margin: 8px 0 0;
  }

  .mp-error {
    margin-bottom: 18px;
    padding: 15px;
    background: #fff1f1;
    color: #b91c1c;
    border: 1px solid #fecaca;
    border-radius: 11px;
    font-size: 13px;
  }

  .mp-footer {
    padding: 18px 0 30px;
    text-align: center;
    color: #8a9baa;
    font-size: 11px;
    line-height: 1.8;
  }

  @media(max-width:1200px) {
    .mp-stats {
      grid-template-columns: repeat(3,minmax(0,1fr));
    }
  }

  @media(max-width:900px) {
    .mp-filters {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .mp-info-grid {
      grid-template-columns: 1fr;
    }
  }

  @media(max-width:650px) {
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
      grid-template-columns: repeat(2,minmax(0,1fr));
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

  @media print {
    @page {
      size: A4 landscape;
      margin: 9mm;
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
      box-shadow: none;
    }

    .mp-root {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;
