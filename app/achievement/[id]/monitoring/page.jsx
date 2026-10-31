
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// MONITORING ACHIEVEMENT — TEMPLATE 5
// CLEAN ENTERPRISE + SPREADSHEET HISTORY
// ======================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Semua Status" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleText(value) {
  return String(value ?? "").trim().toLowerCase();
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
      item => date >= item.start && date <= item.end
    )?.week ?? null
  );
}

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS[week - 1];

  if (!global || !parseDate(program?.start_date)) {
    return null;
  }

  const programStart = String(
    program.start_date
  ).slice(0, 10);

  const programEnd = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    programStart > global.start
      ? programStart
      : global.start;

  const end =
    programEnd && programEnd < global.end
      ? programEnd
      : global.end;

  return start <= end
    ? { start, end }
    : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date) ||
    globalWeekOf(date) === null
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
    (!end || date <= end)
  );
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = type =>
    parts.find(item => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function currentGlobalWeek() {
  const today = todayWITA();

  const current = globalWeekOf(today);

  if (current !== null) return current;

  if (today < GLOBAL_WEEKS[0].start) return 1;

  if (today > GLOBAL_WEEKS[24].end) return 25;

  const previous = GLOBAL_WEEKS.filter(
    item => item.end < today
  );

  return previous.length
    ? previous[previous.length - 1].week
    : 1;
}

function initialWeek(program, records) {
  const available = GLOBAL_WEEKS.filter(
    item => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find(item => {
    const range = programWeekRange(
      program,
      item.week
    );

    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter(item =>
      insideProgram(item.activity_date, program)
    )
    .map(item => globalWeekOf(item.activity_date))
    .filter(value => value !== null);

  if (recorded.length) {
    return Math.max(...recorded);
  }

  return available.find(item => item.start > today)?.week ||
    available[available.length - 1].week;
}

function dateText(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function numberText(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function kmText(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) ? number : 0
  ).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function percentText(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) ? number : 0
  ).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function clamp(value) {
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] || "")
    .join("")
    .toUpperCase();
}

// ======================================================
// KATEGORI — SAMA DENGAN DETAIL PESERTA
// ======================================================

function categoryName(value) {
  const key = normalize(value);

  if (
    ["fisik", "physical"].includes(key)
  ) return "Fisik";

  if (
    ["training", "internaltraining", "pelatihan"]
      .includes(key)
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

function categoryFor(record, types) {
  const type = types.find(
    item =>
      normalize(item.code) ===
      normalize(record.type_code)
  );

  const name =
    categoryName(type?.code) ||
    categoryName(type?.name) ||
    categoryName(record.type_code);

  return TARGETS.find(
    item => item.name === name
  ) || null;
}

function isVerified(record) {
  return roleText(record.status) === "verified";
}

function isPending(record) {
  return roleText(record.status) === "pending";
}

function achievedValue(records, category) {
  if (category.name !== "Fisik") {
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

function amountText(value, category) {
  return category.name === "Fisik"
    ? `${kmText(value)} km`
    : `${numberText(value)} kegiatan`;
}

function recordDescription(record) {
  return (
    record.description ||
    record.notes ||
    "Tidak ada deskripsi tambahan."
  );
}

function recordAmount(record, category) {
  if (category?.name === "Fisik") {
    return `${kmText(record.distance_km)} km`;
  }

  return "1 kegiatan";
}

// ======================================================
// REUSABLE UI
// ======================================================

function Progress({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="am-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}) {
  return (
    <div className={`am-stat am-tone-${tone}`}>
      <div className="am-stat-icon">{icon}</div>

      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  right,
}) {
  return (
    <div className="am-section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      {right}
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function MonitoringAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [account, setAccount] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [week, setWeek] = useState(1);

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [presentation, setPresentation] = useState(false);

  const [error, setError] = useState("");

  const role = roleText(account?.role);

  const canManage =
    role === "admin" ||
    role === "mentor";

  const isParticipant =
    role === "participant" ||
    role === "peserta";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const accountName =
    account?.full_name || "Pengguna";

  const accountRole =
    role === "admin"
      ? "Administrator"
      : role === "mentor"
      ? "Mentor OJT"
      : "Peserta OJT";

  // ====================================================
  // SUPABASE
  // ====================================================

  const getData = useCallback(async id => {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name")
        .order("name"),

      supabase
        .from("achievement_records")
        .select("*")
        .eq("program_id", id)
        .order("activity_date", {
          ascending: false,
        }),
    ]);

    if (results[0].error) {
      throw new Error(
        `Kategori: ${results[0].error.message}`
      );
    }

    if (results[1].error) {
      throw new Error(
        `Achievement: ${results[1].error.message}`
      );
    }

    return {
      types: results[0].data || [],
      records: results[1].data || [],
    };
  }, []);

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const {
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const user = auth.user;

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        const currentRole = roleText(
          profile?.role
        );

        if (
          ![
            "admin",
            "mentor",
            "participant",
            "peserta",
          ].includes(currentRole)
        ) {
          throw new Error(
            "Akun tidak memiliki akses monitoring."
          );
        }

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            mentor_id,
            site,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (currentRole === "mentor") {
          query = query.eq(
            "mentor_id",
            user.id
          );
        }

        if (
          currentRole === "participant" ||
          currentRole === "peserta"
        ) {
          query = query.eq(
            "participant_id",
            user.id
          );
        }

        const {
          data: programData,
          error: programError,
        } = await query.maybeSingle();

        if (programError) throw programError;

        if (!programData) {
          throw new Error(
            "Program tidak ditemukan atau akses ditolak."
          );
        }

        if (
          !parseDate(programData.start_date)
        ) {
          throw new Error(
            "Tanggal mulai program OJT tidak valid."
          );
        }

        if (
          ["participant", "peserta"].includes(currentRole) &&
          !["active", "approved", "aktif"].includes(
            roleText(programData.status)
          )
        ) {
          throw new Error(
            "Peserta hanya dapat membuka program aktif dan disetujui."
          );
        }

        const data = await getData(programId);

        if (!active) return;

        setAccount(profile);
        setProgram(programData);
        setTypes(data.types);
        setRecords(data.records);

        setWeek(
          initialWeek(programData, data.records)
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memuat Monitoring Achievement."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router, getData]);

  async function refresh() {
    if (
      refreshing ||
      loading ||
      !programId ||
      !program
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const data = await getData(programId);

      setTypes(data.types);
      setRecords(data.records);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // GLOBAL WEEK
  // ====================================================

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(item =>
        programWeekRange(program, item.week)
      ),
    [program]
  );

  const availableWeekNumbers = useMemo(
    () => new Set(
      availableWeeks.map(item => item.week)
    ),
    [availableWeeks]
  );

  const selectedPeriod =
    GLOBAL_WEEKS[week - 1];

  const selectedProgramRange = useMemo(
    () => programWeekRange(program, week),
    [program, week]
  );

  const validRecords = useMemo(
    () =>
      records.filter(item =>
        insideProgram(
          item.activity_date,
          program
        )
      ),
    [records, program]
  );

  const verifiedRecords = useMemo(
    () => validRecords.filter(isVerified),
    [validRecords]
  );

  function changeWeek(value) {
    const number = Number(value);

    if (!Number.isInteger(number)) return;

    if (
      number < 1 ||
      number > TOTAL_WEEKS
    ) {
      return;
    }

    if (!availableWeekNumbers.has(number)) {
      return;
    }

    setWeek(number);
  }

  function goBack() {
    router.push(
      isParticipant
        ? "/dashboard-peserta"
        : `/peserta/${programId}`
    );
  }

  // ====================================================
  // WEEKLY DATA
  // ====================================================

  const weeklyRecords = useMemo(
    () =>
      validRecords.filter(
        item =>
          globalWeekOf(item.activity_date) === week
      ),
    [validRecords, week]
  );

  const weeklyVerified = useMemo(
    () => weeklyRecords.filter(isVerified),
    [weeklyRecords]
  );

  const weeklyPending = useMemo(
    () => weeklyRecords.filter(isPending),
    [weeklyRecords]
  );

  const verificationPercent =
    weeklyRecords.length > 0
      ? (
          weeklyVerified.length /
          weeklyRecords.length
        ) * 100
      : 0;

  const categories = useMemo(() => {
    return TARGETS.map(category => {
      const related = weeklyRecords.filter(
        record =>
          categoryFor(record, types)?.name ===
          category.name
      );

      const verified = related.filter(
        isVerified
      );

      const pending = related.filter(
        isPending
      );

      const actual = achievedValue(
        verified,
        category
      );

      const targetPercent = clamp(
        (actual / category.target) * 100
      );

      return {
        ...category,
        total: related.length,
        verified: verified.length,
        pending: pending.length,
        actual,
        targetPercent,
        completed:
          actual >= category.target,
      };
    });
  }, [weeklyRecords, types]);

  const weeklyAchievementPercent =
    categories.length
      ? categories.reduce(
          (sum, category) =>
            sum + category.targetPercent,
          0
        ) / categories.length
      : 0;

  const completedCategories =
    categories.filter(
      category => category.completed
    ).length;

  // ====================================================
  // PROGRAM PROGRESS — GLOBAL CALENDAR
  // ====================================================

  const programProgress = useMemo(() => {
    const weekly = GLOBAL_WEEKS.map(item => {
      const active = Boolean(
        programWeekRange(program, item.week)
      );

      const rows = active
        ? verifiedRecords.filter(
            record =>
              globalWeekOf(record.activity_date) ===
              item.week
          )
        : [];

      const categoryDetails = TARGETS.map(
        category => {
          const matching = rows.filter(
            record =>
              categoryFor(record, types)?.name ===
              category.name
          );

          const actual = achievedValue(
            matching,
            category
          );

          return {
            ...category,
            actual,
            count: matching.length,
            percent: clamp(
              (actual / category.target) * 100
            ),
            completed:
              actual >= category.target,
          };
        }
      );

      return {
        ...item,
        active,
        categories: categoryDetails,
        percent:
          categoryDetails.reduce(
            (sum, category) =>
              sum + category.percent,
            0
          ) / TARGETS.length,
      };
    });

    const activeWeeks = weekly.filter(
      item => item.active
    );

    const categoryProgress = TARGETS.map(
      category => {
        const details = activeWeeks.map(
          item =>
            item.categories.find(
              row => row.name === category.name
            )
        );

        const percent = details.length
          ? details.reduce(
              (sum, row) => sum + row.percent,
              0
            ) / details.length
          : 0;

        return {
          ...category,
          percent,
          completedWeeks:
            details.filter(
              row => row.completed
            ).length,
        };
      }
    );

    const overall = categoryProgress.length
      ? categoryProgress.reduce(
          (sum, category) =>
            sum + category.percent,
          0
        ) / categoryProgress.length
      : 0;

    return {
      weekly,
      categories: categoryProgress,
      activeWeeks: activeWeeks.length,
      overall,
    };
  }, [program, verifiedRecords, types]);

  // ====================================================
  // CHART
  // ====================================================

  const chart = useMemo(() => {
    return GLOBAL_WEEKS.map(item => {
      const rows = validRecords.filter(
        record =>
          globalWeekOf(record.activity_date) ===
          item.week
      );

      return {
        ...item,
        available:
          availableWeekNumbers.has(item.week),
        total: rows.length,
        verified:
          rows.filter(isVerified).length,
        pending:
          rows.filter(isPending).length,
      };
    });
  }, [validRecords, availableWeekNumbers]);

  const maxChart = Math.max(
    1,
    ...chart.map(item => item.verified)
  );

  const activityWeeks =
    chart.filter(item => item.total > 0).length;

  const outsideRecords = records.filter(
    item =>
      !insideProgram(
        item.activity_date,
        program
      )
  ).length;

  // ====================================================
  // HISTORY FILTERS
  // ====================================================

  const history = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    return weeklyRecords
      .filter(record => {
        const category = categoryFor(
          record,
          types
        );

        const matchesCategory =
          categoryFilter === "all" ||
          category?.name === categoryFilter;

        const matchesStatus =
          statusFilter === "all" ||
          roleText(record.status) ===
            statusFilter;

        const searchable = [
          category?.name,
          record.type_code,
          recordDescription(record),
          record.activity_date,
          record.status,
        ]
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !keyword ||
          searchable.includes(keyword);

        return (
          matchesCategory &&
          matchesStatus &&
          matchesSearch
        );
      })
      .sort((a, b) => {
        const dateCompare = String(
          b.activity_date
        ).localeCompare(
          String(a.activity_date)
        );

        if (dateCompare !== 0) {
          return dateCompare;
        }

        return String(
          b.created_at || ""
        ).localeCompare(
          String(a.created_at || "")
        );
      });
  }, [
    weeklyRecords,
    types,
    categoryFilter,
    statusFilter,
    search,
  ]);

  const historyVerified =
    history.filter(isVerified).length;

  const historyPending =
    history.filter(isPending).length;

  // ====================================================
  // LOADING / ERROR
  // ====================================================

  if (loading) {
    return (
      <main className="am-loading">
        <style>{css}</style>
        <div>
          <h2>OJT MineTrack</h2>
          <p>
            Memuat Monitoring Achievement...
          </p>
        </div>
      </main>
    );
  }

  if (!account || !program) {
    return (
      <main className="am-loading">
        <style>{css}</style>
        <div>
          <h2>
            Monitoring Achievement Tidak Tersedia
          </h2>

          <p>
            {error || "Data program tidak tersedia."}
          </p>

          <button
            onClick={() =>
              router.push(
                "/mentor/monitoring-peserta"
              )
            }
          >
            Kembali
          </button>
        </div>
      </main>
    );
  }

  // ====================================================
  // MAIN UI — TEMPLATE 5
  // ====================================================

  return (
    <main
      className={
        "am-root " +
        (presentation
          ? "am-presentation"
          : "")
      }
    >
      <style>{css}</style>

      {/* HEADER */}

      <header className="am-header">
        <button
          type="button"
          className="am-brand"
          onClick={() => router.push("/")}
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <nav className="am-topnav">
          <button
            type="button"
            onClick={goBack}
          >
            Detail Peserta
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/achievement/${programId}`
                )
              }
            >
              Input Achievement
            </button>
          )}

          <button
            type="button"
            className="active"
          >
            Monitoring
          </button>
        </nav>

        <div className="am-account">
          <div className="am-account-avatar">
            {initials(accountName)}
          </div>

          <div className="am-account-text">
            <strong>{accountName}</strong>
            <small>{accountRole}</small>
          </div>

          <button
            type="button"
            className="am-back"
            onClick={goBack}
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="am-container">

        {/* PAGE TITLE */}

        <div className="am-title-row">
          <div>
            <div className="am-eyebrow">
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </div>

            <h1>
              Monitoring{" "}
              <span>Achievement OJT</span>
            </h1>

            <p>
              Pemantauan pencapaian, verifikasi,
              dan perkembangan peserta selama
              25 minggu.
            </p>
          </div>

          <div className="am-header-actions">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              onClick={() =>
                setPresentation(value => !value)
              }
            >
              {presentation
                ? "Tampilan Normal"
                : "▣ Mode Presentasi"}
            </button>

            <button
              type="button"
              className="am-primary"
              onClick={() => window.print()}
            >
              🖨 Cetak
            </button>
          </div>
        </div>

        {error && (
          <div
            className="am-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* PROFILE */}

        <section className="am-profile-card">
          <div className="am-profile-main">
            <div className="am-profile-avatar">
              {initials(participantName)}
            </div>

            <div className="am-profile-copy">
              <small>Peserta OJT</small>

              <h2>{participantName}</h2>

              <p>
                {participant?.department || "—"}
                {" · "}
                {program.site || "—"}
              </p>

              <div className="am-profile-meta">
                <span>
                  📅 {dateText(program.start_date)}
                  {" – "}
                  {dateText(program.end_date)}
                </span>

                <span>
                  📊 {programProgress.activeWeeks}
                  {" "}Week Global dalam periode OJT
                </span>
              </div>
            </div>
          </div>

          <div className="am-profile-side">
            <span className="am-profile-badge">
              {roleText(program.status) === "active"
                ? "PROGRAM AKTIF"
                : String(program.status || "PROGRAM OJT")
                    .toUpperCase()}
            </span>

            <strong>
              Emergency Response Group
            </strong>

            <small>PT Berau Coal</small>
          </div>
        </section>

        {/* WEEK FILTER */}

        <section className="am-card am-week-selector">
          <div>
            <small>Periode Monitoring</small>

            <h2>{weekLabel(week)}</h2>

            <p>
              {dateText(selectedPeriod?.start)}
              {" – "}
              {dateText(selectedPeriod?.end)}
            </p>

            {selectedProgramRange && (
              <small className="am-program-range">
                Periode peserta:
                {" "}
                {dateText(selectedProgramRange.start)}
                {" – "}
                {dateText(selectedProgramRange.end)}
              </small>
            )}
          </div>

          <div className="am-week-controls">
            <button
              type="button"
              disabled={
                !availableWeeks.length ||
                week <= availableWeeks[0].week
              }
              onClick={() => {
                const index =
                  availableWeeks.findIndex(
                    item => item.week === week
                  );

                if (index > 0) {
                  changeWeek(
                    availableWeeks[index - 1].week
                  );
                }
              }}
            >
              ‹
            </button>

            <select
              aria-label="Pilih Week Global"
              value={
                availableWeekNumbers.has(week)
                  ? week
                  : ""
              }
              onChange={event =>
                changeWeek(event.target.value)
              }
            >
              {!availableWeeks.length && (
                <option value="">
                  Tidak ada Week tersedia
                </option>
              )}

              {availableWeeks.map(item => (
                <option
                  key={item.week}
                  value={item.week}
                >
                  {weekLabel(item.week)}
                  {" · "}
                  {dateText(item.start)}
                  {" – "}
                  {dateText(item.end)}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={
                !availableWeeks.length ||
                week >=
                  availableWeeks[
                    availableWeeks.length - 1
                  ].week
              }
              onClick={() => {
                const index =
                  availableWeeks.findIndex(
                    item => item.week === week
                  );

                if (
                  index >= 0 &&
                  index < availableWeeks.length - 1
                ) {
                  changeWeek(
                    availableWeeks[index + 1].week
                  );
                }
              }}
            >
              ›
            </button>
          </div>
        </section>

        {/* STATS */}

        <section className="am-stats">
          <StatCard
            icon="📋"
            label="Total Achievement"
            value={weeklyRecords.length}
            sub={weekLabel(week)}
          />

          <StatCard
            icon="✅"
            label="Verified"
            value={weeklyVerified.length}
            sub="Kegiatan terverifikasi"
            tone="green"
          />

          <StatCard
            icon="🕒"
            label="Pending"
            value={weeklyPending.length}
            sub="Menunggu verifikasi"
            tone="amber"
          />

          <StatCard
            icon="🎯"
            label="Capaian Achievement"
            value={`${percentText(
              weeklyAchievementPercent
            )}%`}
            sub={`${completedCategories}/6 kategori tercapai`}
            tone="blue"
          />
        </section>

        {/* SIX CATEGORIES */}

        <section className="am-card">
          <SectionHeading
            title="Progres Enam Kategori"
            subtitle={
              `Target dan realisasi Verified pada ${weekLabel(week)}.`
            }
            right={
              <span className="am-heading-chip">
                {completedCategories}/6 tercapai
              </span>
            }
          />

          <div className="am-category-grid">
            {categories.map(category => (
              <article
                className="am-category"
                key={category.name}
              >
                <div className="am-category-head">
                  <span className="am-category-icon">
                    {category.icon}
                  </span>

                  <div>
                    <strong>{category.name}</strong>
                    <small>
                      Target {category.target}
                      {" "}
                      {category.unit} / minggu
                    </small>
                  </div>
                </div>

                <div className="am-category-value">
                  <strong>
                    {amountText(
                      category.actual,
                      category
                    )}
                  </strong>

                  <span>
                    {percentText(
                      category.targetPercent
                    )}%
                  </span>
                </div>

                <Progress
                  value={category.targetPercent}
                />

                <div className="am-category-meta">
                  <span>
                    {category.verified} Verified
                  </span>

                  <span>
                    {category.pending} Pending
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="am-note">
            Realisasi dihitung hanya dari Achievement
            berstatus Verified. Jarak Fisik dihitung
            dalam kilometer dengan ketelitian tiga
            desimal. Persentase target dibatasi 100%,
            sedangkan realisasi tetap menunjukkan
            nilai sebenarnya.
          </p>
        </section>

        {/* CHART + HEATMAP */}

        <section className="am-visual-grid">

          <div className="am-card">
            <SectionHeading
              title="Grafik Achievement Mingguan"
              subtitle="Jumlah kegiatan Verified berdasarkan Kalender Global Week 01–25."
              right={
                <span className="am-heading-chip">
                  {weeklyVerified.length} Verified
                </span>
              }
            />

            <div className="am-chart-scroll">
              <div className="am-chart">
                {chart.map(item => {
                  const height = item.verified
                    ? Math.max(
                        6,
                        (item.verified / maxChart) * 100
                      )
                    : 0;

                  return (
                    <button
                      type="button"
                      key={item.week}
                      disabled={!item.available}
                      className={
                        "am-chart-column " +
                        (item.week === week
                          ? "selected "
                          : "") +
                        (!item.available
                          ? "unavailable"
                          : "")
                      }
                      onClick={() =>
                        changeWeek(item.week)
                      }
                      title={
                        `${weekLabel(item.week)}: ` +
                        `${item.verified} Verified`
                      }
                    >
                      <strong>
                        {item.verified}
                      </strong>

                      <div className="am-chart-track">
                        <span
                          style={{
                            height: `${height}%`,
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

            <p className="am-note">
              Klik batang untuk memilih minggu.
              Week di luar periode peserta
              ditampilkan sebagai referensi kalender,
              bukan sebagai nilai pencapaian.
            </p>
          </div>

          <div className="am-card">
            <SectionHeading
              title="Aktivitas 25 Minggu"
              subtitle="Sebaran minggu yang memiliki catatan Achievement."
              right={
                <span className="am-heading-chip">
                  {activityWeeks}/{TOTAL_WEEKS}
                </span>
              }
            />

            <div className="am-week-grid">
              {chart.map(item => (
                <button
                  type="button"
                  key={item.week}
                  disabled={!item.available}
                  className={
                    "am-week-box " +
                    (item.total > 0
                      ? "has-data "
                      : "") +
                    (item.week === week
                      ? "selected "
                      : "") +
                    (!item.available
                      ? "unavailable"
                      : "")
                  }
                  title={
                    `${weekLabel(item.week)}: ` +
                    `${item.total} kegiatan`
                  }
                  onClick={() =>
                    changeWeek(item.week)
                  }
                >
                  W{String(
                    item.week
                  ).padStart(2, "0")}
                </button>
              ))}
            </div>

            <div className="am-legend">
              <span>
                <i className="am-dot active" />
                Ada kegiatan
              </span>

              <span>
                <i className="am-dot inactive" />
                Belum ada kegiatan
              </span>

              <span>
                <i className="am-dot unavailable" />
                Di luar periode OJT
              </span>
            </div>

            {outsideRecords > 0 && (
              <p className="am-note">
                {outsideRecords} catatan berada
                di luar tanggal program peserta
                atau Kalender Global. Data tetap
                tersimpan dan tidak dihapus.
              </p>
            )}
          </div>
        </section>

        {/* PROGRAM PROGRESS */}

        <section className="am-card">
          <SectionHeading
            title="Progres Keseluruhan Program"
            subtitle={
              `Rata-rata pencapaian enam kategori pada ` +
              `${programProgress.activeWeeks} minggu ` +
              `Kalender Global yang termasuk periode OJT.`
            }
            right={
              <strong className="am-overall-value">
                {percentText(
                  programProgress.overall
                )}%
              </strong>
            }
          />

          <Progress
            value={programProgress.overall}
          />

          <div className="am-program-grid">
            {programProgress.categories.map(
              category => (
                <div
                  className="am-program-category"
                  key={category.name}
                >
                  <div className="am-program-head">
                    <strong>
                      {category.icon}
                      {" "}
                      {category.name}
                    </strong>

                    <strong>
                      {percentText(
                        category.percent
                      )}%
                    </strong>
                  </div>

                  <Progress
                    value={category.percent}
                  />

                  <small>
                    {category.completedWeeks}
                    /{programProgress.activeWeeks}
                    {" "}minggu mencapai target
                  </small>
                </div>
              )
            )}
          </div>

          <p className="am-note">
            Perhitungan progres menggunakan
            tanggal program masing-masing peserta
            dan Kalender Global Week 01–25.
            Minggu di luar periode peserta tidak
            dimasukkan dalam rata-rata.
            Minggu dalam periode yang belum
            memiliki Achievement tetap bernilai 0%.
          </p>
        </section>

        {/* SPREADSHEET HISTORY */}

        <section className="am-card">
          <SectionHeading
            title="Riwayat Achievement"
            subtitle={
              `${weekLabel(week)} · ` +
              `${dateText(selectedPeriod?.start)} – ` +
              `${dateText(selectedPeriod?.end)}`
            }
            right={
              <span className="am-heading-chip">
                {history.length} kegiatan
              </span>
            }
          />

          <div className="am-history-toolbar">
            <div className="am-search">
              <span>⌕</span>

              <input
                type="search"
                value={search}
                onChange={event =>
                  setSearch(event.target.value)
                }
                placeholder="Cari kegiatan atau deskripsi..."
                aria-label="Cari riwayat achievement"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={event =>
                setCategoryFilter(event.target.value)
              }
              aria-label="Filter kategori"
            >
              <option value="all">
                Semua Kategori
              </option>

              {TARGETS.map(category => (
                <option
                  key={category.name}
                  value={category.name}
                >
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={event =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter status"
            >
              {STATUS_OPTIONS.map(option => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="am-history-summary">
            <span>
              <strong>{history.length}</strong>
              {" "}ditampilkan
            </span>

            <span>
              <strong>{historyVerified}</strong>
              {" "}Verified
            </span>

            <span>
              <strong>{historyPending}</strong>
              {" "}Pending
            </span>

            <span>
              Verifikasi minggu:
              {" "}
              <strong>
                {percentText(
                  verificationPercent
                )}%
              </strong>
            </span>
          </div>

          <div className="am-table-scroll">
            <table className="am-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Tanggal</th>
                  <th>Kategori</th>
                  <th>Deskripsi Kegiatan</th>
                  <th>Realisasi</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {history.map((record, index) => {
                  const category = categoryFor(
                    record,
                    types
                  );

                  return (
                    <tr key={record.id}>
                      <td className="am-cell-number">
                        {index + 1}
                      </td>

                      <td className="am-cell-date">
                        {dateText(
                          record.activity_date
                        )}
                      </td>

                      <td>
                        <span className="am-cell-category">
                          <span>
                            {category?.icon || "📋"}
                          </span>

                          {category?.name ||
                            record.type_code}
                        </span>
                      </td>

                      <td className="am-cell-description">
                        {recordDescription(record)}
                      </td>

                      <td className="am-cell-amount">
                        {recordAmount(
                          record,
                          category
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            "am-status " +
                            (isVerified(record)
                              ? "verified"
                              : isPending(record)
                              ? "pending"
                              : "other")
                          }
                        >
                          {isVerified(record)
                            ? "Verified"
                            : isPending(record)
                            ? "Pending"
                            : record.status || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {!history.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="am-empty"
                    >
                      Belum ada kegiatan yang
                      sesuai dengan minggu dan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="am-table-footer">
            <span>
              Menampilkan {history.length}
              {" "}dari {weeklyRecords.length}
              {" "}Achievement pada minggu ini.
            </span>

            <span>
              Data mengikuti Supabase ·
              Kalender Global
            </span>
          </div>
        </section>

        {/* FOOTER ACTIONS */}

        <div className="am-bottom">
          <button
            type="button"
            onClick={goBack}
          >
            ← Kembali ke Detail Peserta
          </button>

          {canManage && (
            <button
              type="button"
              className="am-primary"
              onClick={() =>
                router.push(
                  `/achievement/${programId}`
                )
              }
            >
              ✍️ Input Achievement
            </button>
          )}
        </div>

        <footer className="am-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// STYLE — TEMPLATE 5 CLEAN ENTERPRISE
// ======================================================

const css = `
  .am-root,
  .am-root * {
    box-sizing: border-box;
  }

  .am-root {
    min-height: 100vh;
    background: #f5f8fa;
    color: #173047;
    font-family: Arial, Helvetica, sans-serif;
  }

  .am-root button,
  .am-root select,
  .am-root input {
    font-family: inherit;
  }

  .am-root button {
    cursor: pointer;
  }

  .am-root button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .am-loading {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 25px;
    background: #f5f8fa;
    color: #173047;
    font-family: Arial, Helvetica, sans-serif;
    text-align: center;
  }

  .am-loading button {
    border: 0;
    background: #07875e;
    color: white;
    border-radius: 10px;
    padding: 12px 17px;
    margin-top: 10px;
  }

  /* HEADER */

  .am-header {
    height: 72px;
    background: white;
    border-bottom: 1px solid #e4ebf1;
    padding: 0 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .am-brand {
    background: transparent;
    border: 0;
    padding: 0;
    color: #10293e;
    white-space: nowrap;
    font-size: 24px;
    font-weight: 900;
    letter-spacing: -.7px;
  }

  .am-brand span {
    color: #07875e;
  }

  .am-brand small {
    font-size: 10px;
    margin-left: 6px;
    color: #8393a4;
    letter-spacing: 0;
  }

  .am-topnav {
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .am-topnav button {
    border: 0;
    background: transparent;
    color: #637589;
    border-radius: 9px;
    font-size: 12px;
    font-weight: 800;
    padding: 12px 15px;
  }

  .am-topnav button.active,
  .am-topnav button:hover {
    background: #e7f6ee;
    color: #087f59;
  }

  .am-account {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .am-account-avatar {
    width: 37px;
    height: 37px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #dff4e9;
    color: #087d57;
    font-size: 12px;
    font-weight: 900;
  }

  .am-account-text strong,
  .am-account-text small {
    display: block;
  }

  .am-account-text strong {
    font-size: 11px;
    color: #1b3349;
  }

  .am-account-text small {
    color: #8291a2;
    font-size: 10px;
    margin-top: 4px;
  }

  .am-back {
    background: #f4f8f6;
    border: 1px solid #dce9e2;
    color: #276c51;
    border-radius: 9px;
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 800;
  }

  /* MAIN */

  .am-container {
    max-width: 1540px;
    margin: 0 auto;
    padding: 25px;
  }

  .am-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 18px;
    margin-bottom: 18px;
  }

  .am-eyebrow {
    color: #09875f;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
  }

  .am-title-row h1 {
    margin: 8px 0;
    font-size: clamp(24px, 3vw, 34px);
    letter-spacing: -.8px;
    color: #122d42;
  }

  .am-title-row h1 span {
    color: #07875e;
  }

  .am-title-row p {
    margin: 0;
    color: #78899b;
    font-size: 13px;
    line-height: 1.6;
  }

  .am-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .am-header-actions button,
  .am-bottom button {
    background: white;
    color: #27634e;
    border: 1px solid #dce8e1;
    border-radius: 10px;
    padding: 11px 15px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-header-actions .am-primary,
  .am-bottom .am-primary {
    background: #07875e;
    border-color: #07875e;
    color: white;
  }

  .am-error {
    background: #fff1f1;
    color: #b91c1c;
    border: 1px solid #fecaca;
    padding: 13px 16px;
    border-radius: 11px;
    margin-bottom: 16px;
    font-size: 12px;
  }

  /* PROFILE */

  .am-profile-card {
    display: grid;
    grid-template-columns: minmax(0,1.7fr) minmax(220px,.6fr);
    background: white;
    border: 1px solid #e3ebf0;
    border-radius: 16px;
    overflow: hidden;
    margin-bottom: 15px;
    box-shadow: 0 5px 18px #17304707;
  }

  .am-profile-main {
    display: flex;
    align-items: center;
    gap: 22px;
    min-width: 0;
    padding: 22px;
  }

  .am-profile-avatar {
    width: 85px;
    height: 85px;
    flex-shrink: 0;
    border-radius: 15px;
    background: #dff4e9;
    color: #078257;
    font-size: 32px;
    font-weight: 900;
    display: grid;
    place-items: center;
  }

  .am-profile-copy {
    min-width: 0;
  }

  .am-profile-copy > small {
    color: #07875e;
    font-weight: 800;
    font-size: 11px;
  }

  .am-profile-copy h2 {
    font-size: 23px;
    margin: 5px 0;
    overflow-wrap: anywhere;
  }

  .am-profile-copy p {
    font-size: 12px;
    color: #708296;
    margin: 0;
  }

  .am-profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 19px;
    margin-top: 15px;
    color: #6e8192;
    font-size: 11px;
  }

  .am-profile-side {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    padding: 24px;
    background:
      linear-gradient(
        90deg,
        #f6fbf8,
        #eef8f2dd
      ),
      url("/background-erg.png.PNG")
        center/cover;
  }

  .am-profile-badge {
    background: #07875e;
    border-radius: 6px;
    color: white;
    padding: 7px 11px;
    font-size: 10px;
    font-weight: 900;
    margin-bottom: 13px;
  }

  .am-profile-side strong {
    font-size: 13px;
  }

  .am-profile-side small {
    font-size: 12px;
    color: #72889a;
    margin-top: 6px;
  }

  /* COMMON */

  .am-card {
    background: white;
    border: 1px solid #e3ebf0;
    border-radius: 15px;
    padding: 20px;
    box-shadow: 0 5px 18px #17304706;
    margin-bottom: 15px;
    min-width: 0;
  }

  .am-section-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 17px;
  }

  .am-section-head h2 {
    margin: 0;
    font-size: 17px;
    color: #163047;
    font-weight: 900;
  }

  .am-section-head p {
    margin: 7px 0 0;
    color: #8090a0;
    font-size: 12px;
    line-height: 1.6;
  }

  .am-heading-chip {
    border-radius: 9px;
    padding: 9px 12px;
    background: #edf8f2;
    color: #07815b;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .am-note {
    color: #8493a0;
    font-size: 11px;
    line-height: 1.7;
    margin: 14px 0 0;
  }

  /* WEEK SELECT */

  .am-week-selector {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 17px 20px;
  }

  .am-week-selector > div:first-child > small {
    color: #788c9c;
    font-size: 11px;
    font-weight: 700;
  }

  .am-week-selector h2 {
    margin: 5px 0;
    font-size: 21px;
  }

  .am-week-selector p {
    margin: 0;
    color: #6e8295;
    font-size: 12px;
  }

  .am-program-range {
    display: block;
    margin-top: 8px;
  }

  .am-week-controls {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .am-week-controls button,
  .am-week-controls select {
    background: white;
    border: 1px solid #dbe7e4;
    color: #174e3e;
    border-radius: 9px;
    padding: 11px;
    font-size: 12px;
    font-weight: 800;
  }

  .am-week-controls button {
    width: 38px;
  }

  .am-week-controls select {
    max-width: 320px;
  }

  /* KPI */

  .am-stats {
    display: grid;
    grid-template-columns: repeat(4,minmax(0,1fr));
    gap: 12px;
    margin-bottom: 15px;
  }

  .am-stat {
    background: white;
    border: 1px solid #e3ebf0;
    border-radius: 14px;
    padding: 17px;
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
  }

  .am-stat-icon {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 11px;
    display: grid;
    place-items: center;
    font-size: 22px;
    background: #eef3f8;
  }

  .am-tone-green .am-stat-icon {
    background: #e2f7eb;
  }

  .am-tone-amber .am-stat-icon {
    background: #fff5e0;
  }

  .am-tone-blue .am-stat-icon {
    background: #eaf3ff;
  }

  .am-stat small,
  .am-stat strong,
  .am-stat span {
    display: block;
  }

  .am-stat small {
    font-size: 11px;
    color: #77889b;
  }

  .am-stat strong {
    margin: 7px 0 5px;
    font-size: 26px;
    font-weight: 900;
    color: #163047;
  }

  .am-tone-green .am-stat strong {
    color: #07875e;
  }

  .am-tone-amber .am-stat strong {
    color: #bb8218;
  }

  .am-tone-blue .am-stat strong {
    color: #2369ae;
  }

  .am-stat span {
    color: #8493a3;
    font-size: 10px;
    line-height: 1.4;
  }

  /* SIX CATEGORIES */

  .am-category-grid {
    display: grid;
    grid-template-columns: repeat(3,minmax(0,1fr));
    gap: 11px;
  }

  .am-category {
    border: 1px solid #e3eaf0;
    border-radius: 12px;
    padding: 16px;
    background: #fcfefd;
    min-width: 0;
  }

  .am-category-head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .am-category-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: #edf8f1;
    border-radius: 10px;
    font-size: 20px;
  }

  .am-category-head strong,
  .am-category-head small {
    display: block;
  }

  .am-category-head strong {
    font-size: 13px;
  }

  .am-category-head small {
    margin-top: 5px;
    color: #8493a2;
    font-size: 10px;
  }

  .am-category-value {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    margin: 17px 0 10px;
  }

  .am-category-value strong {
    color: #07875e;
    font-size: 18px;
  }

  .am-category-value span {
    color: #497e6a;
    font-size: 12px;
    font-weight: 800;
  }

  .am-progress {
    width: 100%;
    height: 9px;
    background: #e4ebe9;
    border-radius: 30px;
    overflow: hidden;
  }

  .am-progress span {
    display: block;
    height: 100%;
    background: linear-gradient(
      90deg,
      #2dc493,
      #07865e
    );
    border-radius: inherit;
  }

  .am-category-meta {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    color: #788a9a;
    font-size: 11px;
  }

  /* CHART AND HEATMAP */

  .am-visual-grid {
    display: grid;
    grid-template-columns:
      minmax(0,1.25fr)
      minmax(0,.85fr);
    gap: 15px;
  }

  .am-chart-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 7px;
  }

  .am-chart {
    display: flex;
    align-items: stretch;
    width: max-content;
    height: 215px;
    gap: 7px;
    border-bottom: 1px solid #dce6e9;
  }

  .am-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 31px;
    gap: 7px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #7c8c9a;
  }

  .am-chart-column strong,
  .am-chart-column small {
    font-size: 10px;
  }

  .am-chart-track {
    width: 21px;
    height: 155px;
    display: flex;
    align-items: flex-end;
  }

  .am-chart-track span {
    display: block;
    width: 100%;
    background: #3bc595;
    border-radius: 5px 5px 0 0;
  }

  .am-chart-column.selected .am-chart-track span {
    background: #267bcc;
  }

  .am-chart-column.selected {
    color: #236cba;
  }

  .am-chart-column.unavailable {
    opacity: .25;
  }

  .am-week-grid {
    display: grid;
    grid-template-columns:
      repeat(5,minmax(0,1fr));
    gap: 7px;
  }

  .am-week-box {
    border: 1px solid #dfe8ed;
    border-radius: 8px;
    background: #f3f6f8;
    color: #607386;
    padding: 11px 4px;
    font-size: 11px;
    font-weight: 800;
  }

  .am-week-box.has-data {
    background: #def5e9;
    border-color: #b2e0c8;
    color: #087e57;
  }

  .am-week-box.selected {
    background: #07875e;
    color: white;
    border-color: #07875e;
  }

  .am-week-box.unavailable {
    opacity: .35;
  }

  .am-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 13px;
    margin-top: 14px;
    color: #7d8f9d;
    font-size: 10px;
  }

  .am-legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .am-dot {
    width: 9px;
    height: 9px;
    display: inline-block;
    border-radius: 3px;
  }

  .am-dot.active {
    background: #11a475;
  }

  .am-dot.inactive {
    background: #dce5e9;
  }

  .am-dot.unavailable {
    background: #aebbc4;
    opacity: .5;
  }

  /* OVERALL */

  .am-overall-value {
    color: #07875e;
    font-size: 24px;
  }

  .am-program-grid {
    display: grid;
    grid-template-columns:
      repeat(3,minmax(0,1fr));
    gap: 12px;
    margin-top: 17px;
  }

  .am-program-category {
    padding: 13px;
    background: #fcfefd;
    border: 1px solid #e6edf1;
    border-radius: 11px;
  }

  .am-program-head {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 12px;
  }

  .am-program-head strong:last-child {
    color: #07875e;
  }

  .am-program-category small {
    display: block;
    color: #8595a4;
    font-size: 10px;
    margin-top: 10px;
  }

  /* HISTORY TABLE */

  .am-history-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 14px;
  }

  .am-search {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1;
    min-width: 220px;
    border: 1px solid #dce7ec;
    background: white;
    border-radius: 10px;
    padding: 0 12px;
  }

  .am-search span {
    color: #8194a5;
    font-size: 22px;
  }

  .am-search input {
    border: 0;
    outline: none;
    padding: 12px 0;
    width: 100%;
    min-width: 0;
    font-size: 12px;
    color: #183349;
  }

  .am-history-toolbar select {
    background: white;
    border: 1px solid #dce7ec;
    border-radius: 10px;
    color: #415e70;
    padding: 12px;
    font-size: 12px;
    font-weight: 700;
  }

  .am-history-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 18px;
    border: 1px solid #e5edf1;
    background: #f8fbfc;
    border-radius: 9px;
    padding: 11px 13px;
    margin-bottom: 13px;
    color: #74899a;
    font-size: 11px;
  }

  .am-history-summary strong {
    color: #173e58;
  }

  .am-table-scroll {
    width: 100%;
    overflow-x: auto;
    border: 1px solid #e3ebef;
    border-radius: 11px;
  }

  .am-table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }

  .am-table th {
    background: #f1f6f8;
    color: #526a7c;
    font-size: 11px;
    padding: 14px 12px;
    border-bottom: 1px solid #e0e9ed;
    white-space: nowrap;
  }

  .am-table td {
    padding: 14px 12px;
    border-bottom: 1px solid #edf1f4;
    color: #38556a;
    vertical-align: middle;
  }

  .am-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .am-table tbody tr:nth-child(even) {
    background: #fbfcfd;
  }

  .am-table tbody tr:hover {
    background: #f3faf6;
  }

  .am-cell-number {
    width: 50px;
    color: #889aaa !important;
  }

  .am-cell-date {
    white-space: nowrap;
    font-weight: 700;
  }

  .am-cell-category {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    font-weight: 800;
  }

  .am-cell-category span {
    font-size: 17px;
  }

  .am-cell-description {
    min-width: 230px;
    max-width: 490px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.6;
  }

  .am-cell-amount {
    white-space: nowrap;
    font-weight: 800;
    color: #087c58 !important;
  }

  .am-status {
    display: inline-block;
    border-radius: 999px;
    padding: 7px 11px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
  }

  .am-status.verified {
    background: #def6e8;
    color: #07815a;
  }

  .am-status.pending {
    background: #fff2dc;
    color: #ac7819;
  }

  .am-status.other {
    background: #e9eff3;
    color: #617586;
  }

  .am-empty {
    padding: 30px !important;
    text-align: center;
    color: #8595a3 !important;
    font-size: 12px;
  }

  .am-table-footer {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 13px;
    color: #8193a2;
    font-size: 11px;
  }

  /* BOTTOM */

  .am-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin: 20px 0;
  }

  .am-footer {
    text-align: center;
    color: #92a0ad;
    font-size: 11px;
    padding: 15px 0 25px;
  }

  /* PRESENTATION */

  .am-presentation .am-header {
    display: none;
  }

  .am-presentation .am-container {
    max-width: 1900px;
  }

  .am-presentation .am-title-row {
    padding-top: 7px;
  }

  /* RESPONSIVE */

  @media (max-width: 1180px) {
    .am-topnav {
      display: none;
    }

    .am-visual-grid {
      grid-template-columns: 1fr;
    }

    .am-category-grid,
    .am-program-grid {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }
  }

  @media (max-width: 850px) {
    .am-profile-card {
      grid-template-columns: 1fr;
    }

    .am-profile-side {
      min-height: 105px;
    }

    .am-stats {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }

    .am-header {
      padding: 0 15px;
    }

    .am-container {
      padding: 15px;
    }

    .am-brand {
      font-size: 20px;
    }

    .am-category-grid,
    .am-program-grid {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }
  }

  @media (max-width: 580px) {
    .am-header {
      height: 65px;
    }

    .am-account-text {
      display: none;
    }

    .am-back {
      padding: 9px;
      font-size: 10px;
    }

    .am-container {
      padding: 11px;
    }

    .am-title-row h1 {
      font-size: 25px;
    }

    .am-header-actions {
      width: 100%;
    }

    .am-header-actions button {
      flex: 1;
      padding: 10px 7px;
      font-size: 10px;
    }

    .am-profile-main {
      padding: 16px;
      gap: 13px;
    }

    .am-profile-avatar {
      width: 60px;
      height: 60px;
      font-size: 24px;
    }

    .am-profile-copy h2 {
      font-size: 19px;
    }

    .am-card {
      padding: 14px;
    }

    .am-week-selector {
      align-items: stretch;
    }

    .am-week-controls {
      width: 100%;
    }

    .am-week-controls select {
      flex: 1;
      min-width: 0;
      max-width: none;
    }

    .am-stats {
      gap: 8px;
    }

    .am-stat {
      padding: 12px;
      gap: 8px;
    }

    .am-stat-icon {
      width: 34px;
      height: 34px;
      font-size: 17px;
    }

    .am-stat strong {
      font-size: 21px;
    }

    .am-category-grid,
    .am-program-grid {
      grid-template-columns: 1fr;
    }

    .am-week-grid {
      gap: 5px;
    }

    .am-week-box {
      padding: 10px 2px;
      font-size: 10px;
    }

    .am-history-toolbar {
      align-items: stretch;
    }

    .am-search {
      min-width: 100%;
    }

    .am-history-toolbar select {
      flex: 1;
      min-width: 0;
    }

    .am-bottom {
      flex-direction: column;
    }

    .am-bottom button {
      width: 100%;
    }
  }

  /* PRINT */

  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  @media print {
    .am-header,
    .am-header-actions,
    .am-week-controls,
    .am-history-toolbar,
    .am-bottom {
      display: none !important;
    }

    .am-root {
      background: white !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .am-container {
      max-width: none;
      padding: 0;
    }

    .am-card,
    .am-profile-card,
    .am-stat {
      box-shadow: none !important;
      break-inside: avoid;
    }

    .am-visual-grid {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }

    .am-category-grid,
    .am-program-grid {
      grid-template-columns:
        repeat(3,minmax(0,1fr));
    }

    .am-table-scroll {
      overflow: visible;
    }

    .am-table {
      min-width: 0;
      font-size: 10px;
    }

    .am-table th,
    .am-table td {
      padding: 8px 7px;
    }

    .am-chart-scroll {
      overflow: visible;
    }
  }
`;
