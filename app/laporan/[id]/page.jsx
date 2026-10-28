
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// RAPOR OJT - TEMPLATE 10 PREMIUM CORPORATE
// NAVY / GOLD / WHITE
// KALENDER GLOBAL 25 MINGGU
// ======================================================

const TOTAL_WEEKS = 25;
const POSITION = "Junior OJT";

const TARGETS = [
  {
    key: "Fisik",
    label: "FISIK",
    target: 25,
    unit: "km",
    color: "#c88c21",
  },
  {
    key: "Training",
    label: "INTERNAL TRAINING",
    target: 4,
    unit: "kegiatan",
    color: "#c88c21",
  },
  {
    key: "Sosialisasi",
    label: "SOSIALISASI",
    target: 3,
    unit: "kegiatan",
    color: "#c88c21",
  },
  {
    key: "Orientasi Area",
    label: "ORIENTASI AREA",
    target: 2,
    unit: "kegiatan",
    color: "#c88c21",
  },
  {
    key: "Coaching",
    label: "COACHING",
    target: 1,
    unit: "kegiatan",
    color: "#c88c21",
  },
  {
    key: "Hazard",
    label: "HAZARD",
    target: 2,
    unit: "kegiatan",
    color: "#c88c21",
  },
];

const SIMPER_START = "[[SIMPER_V2]]";
const SIMPER_END = "[[/SIMPER_V2]]";

function pad(value) {
  return String(value).padStart(2, "0");
}

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return String(value ?? "").trim().toLowerCase();
}

function number(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 0) {
  const n = number(value);
  if (n === null) return "—";

  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  );

  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
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

function dateText(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function currentDate() {
  return new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function average(items) {
  if (!items.length) return 0;
  return items.reduce((a, b) => a + b, 0) / items.length;
}

function percent(realized, target) {
  if (!(target > 0)) return 0;
  return Math.min(100, Math.max(0, (realized / target) * 100));
}

function chunks(list, size = 7) {
  const results = [];
  for (let i = 0; i < list.length; i += size) {
    results.push(list.slice(i, i + size));
  }
  return results;
}

// ======================================================
// KALENDER GLOBAL
// ======================================================

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

function weekByNumber(week) {
  return GLOBAL_WEEKS.find((item) => item.week === Number(week));
}

function weekLabel(week) {
  return `Week ${pad(week)}`;
}

function programWeekRange(week, program) {
  const global = weekByNumber(week);
  if (!global || !parseDate(program?.start_date)) return null;

  const programStart = String(program.start_date).slice(0, 10);
  const programEnd = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > programStart ? global.start : programStart;

  const end =
    programEnd && programEnd < global.end
      ? programEnd
      : global.end;

  return start <= end ? { start, end } : null;
}

function defaultWeek(program) {
  const today = new Date()
    .toLocaleDateString("en-CA", {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const available = GLOBAL_WEEKS.filter((item) =>
    programWeekRange(item.week, program)
  );

  if (!available.length) return 1;

  const active = available.find((item) => {
    const range = programWeekRange(item.week, program);
    return today >= range.start && today <= range.end;
  });

  if (active) return active.week;

  const next = available.find(
    (item) => programWeekRange(item.week, program).start > today
  );

  return next ? next.week : available[available.length - 1].week;
}

// ======================================================
// SIMPER
// ======================================================

function parseSimper(notes) {
  const text = String(notes ?? "");
  const start = text.lastIndexOf(SIMPER_START);
  const end = text.lastIndexOf(SIMPER_END);

  if (start < 0 || end <= start) return null;

  try {
    const meta = JSON.parse(
      text.slice(start + SIMPER_START.length, end)
    );

    return meta &&
      typeof meta === "object" &&
      !Array.isArray(meta)
      ? meta
      : null;
  } catch {
    return null;
  }
}

function calculateSimper(record) {
  const meta = parseSimper(record?.notes);

  const kmkop = roleOf(record?.theory_status) === "passed";
  const praktik = roleOf(record?.practice_status) === "passed";
  const orientasi =
    roleOf(meta?.orientation_status) === "completed";

  const completed = [kmkop, praktik, orientasi].filter(Boolean).length;

  return {
    kmkop,
    praktik,
    orientasi,
    completed,
    percentage: [0, 33, 67, 100][completed],
    passed: completed === 3,
    kmkopStatus: record?.theory_status || null,
    practiceStatus: record?.practice_status || null,
    orientationStatus: meta?.orientation_status || null,
    issuanceStatus: roleOf(meta?.issuance_status) || "not_issued",
    orientationDate: meta?.orientation_date || null,
    issuanceDate: record?.graduation_date || null,
    issuanceNumber: meta?.issuance_number || "",
    kmkopValidation:
      meta?.theory_validation_status ??
      meta?.kmkop_validation_status ??
      null,
    practiceValidation:
      meta?.practice_validation_status ?? null,
    legacy: !!record && !meta && record.status === "passed",
  };
}

function simperStatus(status, type) {
  const value = roleOf(status);

  if (type === "orientation") {
    if (value === "completed") return "SELESAI";
    if (value === "scheduled") return "DIJADWALKAN";
    if (value === "in_progress" || value === "ongoing") {
      return "DALAM PROSES";
    }
    return "BELUM SELESAI";
  }

  if (value === "passed") return "LULUS";
  if (value === "failed") return "TIDAK LULUS";
  if (value === "pending") return "MENUNGGU";
  if (value === "scheduled") return "DIJADWALKAN";

  return "BELUM LULUS";
}

function issuanceText(status) {
  const value = roleOf(status);
  if (value === "issued") return "TERBIT";
  if (value === "processing") return "DALAM PROSES";
  return "BELUM TERBIT";
}

function validationText(status) {
  if (status === null || status === undefined || status === "") {
    return "Belum ada data validasi";
  }

  const value = roleOf(status);

  if (
    ["validated", "verified", "approved", "completed"].includes(value)
  ) {
    return "TERVALIDASI";
  }

  if (["pending", "waiting"].includes(value)) {
    return "MENUNGGU VALIDASI";
  }

  if (["rejected", "failed"].includes(value)) {
    return "BELUM TERVALIDASI";
  }

  return String(status).replace(/_/g, " ").toUpperCase();
}

function getGrade(score) {
  if (score === null) return ["—", "BELUM ADA NILAI"];
  if (score >= 85) return ["A", "SANGAT BAIK"];
  if (score >= 75) return ["B", "BAIK"];
  if (score >= 60) return ["C", "CUKUP"];
  return ["D", "KURANG"];
}

// ======================================================
// AKSES RAPOR
// ======================================================

async function verifyAccess(programId) {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth?.user) {
    return { redirect: "/login" };
  }

  const user = auth.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("Profil akun tidak ditemukan.");

  const role = roleOf(profile.role);
  const isParticipant = ["participant", "peserta"].includes(role);

  if (!isParticipant && !["admin", "mentor"].includes(role)) {
    throw new Error("Anda tidak memiliki akses Rapor OJT.");
  }

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
      legacy_access,
      peserta:profiles!ojt_programs_participant_id_fkey(
        full_name,
        department
      )
    `)
    .eq("id", programId);

  if (isParticipant) {
    query = query
      .eq("participant_id", user.id)
      .eq("status", "active");
  }

  const { data: program, error: programError } =
    await query.maybeSingle();

  if (programError) throw programError;

  if (!program) {
    throw new Error("Program OJT tidak ditemukan atau tidak dapat diakses.");
  }

  if (!parseDate(program.start_date)) {
    throw new Error("Tanggal mulai OJT tidak valid.");
  }

  if (isParticipant) {
    const [request, registration] = await Promise.all([
      supabase
        .from("ojt_registration_requests")
        .select("status")
        .eq("participant_id", user.id),

      supabase
        .from("participant_registrations")
        .select("status")
        .eq("user_id", user.id),
    ]);

    if (request.error) throw request.error;
    if (registration.error) throw registration.error;

    const approved = [
      ...(request.data || []),
      ...(registration.data || []),
    ].some((item) => roleOf(item.status) === "approved");

    if (!approved && program.legacy_access !== true) {
      throw new Error("Akses program peserta belum disetujui.");
    }
  }

  let mentorName = "";

  if (program.mentor_id) {
    const { data: mentor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", program.mentor_id)
      .maybeSingle();

    mentorName = mentor?.full_name?.trim() || "";
  }

  if (
    !mentorName &&
    role === "mentor" &&
    profile.id === program.mentor_id
  ) {
    mentorName = profile.full_name || "";
  }

  return {
    userId: user.id,
    profile,
    program,
    mentorName,
  };
}

// ======================================================
// DATABASE RAPOR
// ======================================================

async function fetchReportData(programId) {
  const results = await Promise.all([
    supabase
      .from("achievement_types")
      .select("code,name"),

    supabase
      .from("achievement_records")
      .select("id,type_code,activity_date,distance_km,status")
      .eq("program_id", programId),

    supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes")
      .eq("program_id", programId),

    supabase
      .from("weekly_practice_scores")
      .select("id,practice_date,practice_name,score")
      .eq("program_id", programId),

    supabase
      .from("simper_records")
      .select(
        "id,theory_status,practice_status,status,notes,graduation_date,created_at"
      )
      .eq("program_id", programId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const labels = [
    "Kategori",
    "Achievement",
    "Teori",
    "Praktik",
    "SIMPER",
  ];

  for (let index = 0; index < results.length; index++) {
    if (results[index].error) {
      throw new Error(
        `${labels[index]}: ${results[index].error.message}`
      );
    }
  }

  return {
    types: results[0].data || [],
    achievements: results[1].data || [],
    theory: results[2].data || [],
    practices: results[3].data || [],
    simper: results[4].data?.[0] || null,
  };
}

// ======================================================
// KOMPONEN LAPORAN
// ======================================================

function SectionHeader({ number, title }) {
  return (
    <div className="premium-section-heading">
      {number && <span className="premium-section-no">{number}</span>}
      <strong>{title}</strong>
    </div>
  );
}

function WeekSelect({ weeks, value, onChange }) {
  return (
    <select
      className="premium-select"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {weeks.map((week) => (
        <option key={week.week} value={week.week}>
          {weekLabel(week.week)} — {dateText(week.start)} s.d.{" "}
          {dateText(week.end)}
        </option>
      ))}
    </select>
  );
}

function WeeklyScoreTable({ weeks, site, type }) {
  const getItems = (week) =>
    type === "practice" ? week.practices : week.theory;

  return (
    <div className="premium-table-scroll">
      <table className="premium-table premium-week-table">
        <thead>
          <tr>
            <th>SITE</th>
            {weeks.map((week) => (
              <th key={week.week}>WEEK {pad(week.week)}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            {
              length: Math.max(
                1,
                ...weeks.map((week) => getItems(week).length)
              ),
            },
            (_, rowIndex) => (
              <tr key={rowIndex}>
                {rowIndex === 0 && (
                  <td
                    className="premium-site-cell"
                    rowSpan={Math.max(
                      1,
                      ...weeks.map((week) => getItems(week).length)
                    )}
                  >
                    {site}
                  </td>
                )}

                {weeks.map((week) => {
                  const item = getItems(week)[rowIndex];

                  if (!item) {
                    return <td key={week.week}>—</td>;
                  }

                  const label = String(
                    (type === "practice"
                      ? item.practice_name
                      : item.notes) ?? ""
                  ).trim();

                  return (
                    <td key={week.week}>
                      <div className="premium-score-entry">
                        {label && <span>{label}</span>}
                        <strong>{fmt(item.score, 2)}</strong>
                      </div>
                    </td>
                  );
                })}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function SimperItem({ title, status, positive, detail }) {
  return (
    <div className="premium-simper-item">
      <span className="premium-simper-title">{title}</span>

      <div className="premium-simper-content">
        <span
          className={
            "premium-simper-symbol " +
            (positive ? "positive" : "pending")
          }
        >
          {positive ? "✓" : "!"}
        </span>

        <strong className={positive ? "positive-text" : "pending-text"}>
          {status}
        </strong>
      </div>

      <small>{detail}</small>
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function RaporOJTPage() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [mode, setMode] = useState("range");
  const [singleWeek, setSingleWeek] = useState(1);
  const [fromWeek, setFromWeek] = useState(1);
  const [toWeek, setToWeek] = useState(1);
  const [customWeeks, setCustomWeeks] = useState([1]);
  const [preview, setPreview] = useState(true);

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const access = await verifyAccess(programId);

        if (!active) return;

        if (access.redirect) {
          router.replace(access.redirect);
          return;
        }

        const records = await fetchReportData(programId);

        if (!active) return;

        setData({
          ...access,
          ...records,
        });

        const initial = defaultWeek(access.program);

        setSingleWeek(initial);
        setFromWeek(initial);
        setToWeek(initial);
        setCustomWeeks([initial]);
      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal memuat Rapor OJT.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (refreshing || !programId || !data) return;

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess(programId);

      if (access.redirect) {
        setData(null);
        router.replace(access.redirect);
        return;
      }

      if (access.userId !== data.userId) {
        throw new Error("Akun berubah. Buka kembali halaman Rapor.");
      }

      const records = await fetchReportData(programId);

      setData({
        ...access,
        ...records,
      });
    } catch (err) {
      setError(err?.message || "Gagal memperbarui Rapor.");
    } finally {
      setRefreshing(false);
    }
  }

  const availableWeeks = useMemo(() => {
    if (!data?.program) return [];

    return GLOBAL_WEEKS.filter((week) =>
      programWeekRange(week.week, data.program)
    );
  }, [data]);

  const availableSet = useMemo(
    () => new Set(availableWeeks.map((week) => week.week)),
    [availableWeeks]
  );

  const selectedWeeks = useMemo(() => {
    let weeks = [];

    if (mode === "single") {
      weeks = [singleWeek];
    } else if (mode === "range") {
      weeks = Array.from(
        { length: Math.max(0, toWeek - fromWeek + 1) },
        (_, index) => fromWeek + index
      );
    } else {
      weeks = [...new Set(customWeeks)].sort((a, b) => a - b);
    }

    return weeks.filter((week) => availableSet.has(week));
  }, [
    mode,
    singleWeek,
    fromWeek,
    toWeek,
    customWeeks,
    availableSet,
  ]);

  function toggleCustomWeek(week) {
    setCustomWeeks((old) =>
      old.includes(week)
        ? old.filter((value) => value !== week)
        : [...old, week]
    );
  }

  function changeFromWeek(week) {
    setFromWeek(week);
    if (toWeek < week) setToWeek(week);
  }

  // ====================================================
  // PERHITUNGAN
  // ====================================================

  const report = useMemo(() => {
    if (!data) return null;

    const typeMap = new Map();

    data.types.forEach((type) => {
      typeMap.set(norm(type.code), type.code);
      typeMap.set(norm(type.name), type.code);
    });

    function findType(key) {
      if (key === "Training") {
        return (
          typeMap.get("training") ??
          typeMap.get("internaltraining")
        );
      }
      return typeMap.get(norm(key));
    }

    const weekly = selectedWeeks.map((weekNumber) => {
      const achievementRecords = data.achievements.filter(
        (item) => globalWeekOf(item.activity_date) === weekNumber
      );

      const competencies = TARGETS.map((target) => {
        const code = findType(target.key);

        const matching = code
          ? achievementRecords.filter((item) => item.type_code === code)
          : [];

        const verified = matching.filter(
          (item) => roleOf(item.status) === "verified"
        );

        let realized = 0;

        if (target.key === "Fisik") {
          realized =
            verified.reduce(
              (sum, item) =>
                sum +
                Math.round((number(item.distance_km) ?? 0) * 1000),
              0
            ) / 1000;
        } else {
          realized = verified.length;
        }

        return {
          ...target,
          realized,
          percentage: percent(realized, target.target),
          achieved: realized >= target.target,
        };
      });

      return {
        week: weekNumber,
        competencies,
        theory: data.theory.filter(
          (item) => globalWeekOf(item.test_date) === weekNumber
        ),
        practices: data.practices.filter(
          (item) => globalWeekOf(item.practice_date) === weekNumber
        ),
      };
    });

    const summary = TARGETS.map((target) => {
      const entries = weekly
        .map((week) =>
          week.competencies.find((item) => item.key === target.key)
        )
        .filter(Boolean);

      let realized;

      if (target.key === "Fisik") {
        realized =
          entries.reduce(
            (sum, item) =>
              sum + Math.round(item.realized * 1000),
            0
          ) / 1000;
      } else {
        realized = entries.reduce(
          (sum, item) => sum + item.realized,
          0
        );
      }

      return {
        ...target,
        realized,
        totalTarget: target.target * selectedWeeks.length,
        percentage: average(entries.map((item) => item.percentage)),
        achieved:
          entries.length > 0 &&
          entries.every((item) => item.achieved),
      };
    });

    const allTheory = weekly.flatMap((week) => week.theory);
    const allPractices = weekly.flatMap((week) => week.practices);

    const scores = [...allTheory, ...allPractices]
      .map((item) => number(item.score))
      .filter((item) => item !== null);

    const totalScore = scores.reduce((sum, item) => sum + item, 0);
    const avgScore = scores.length
      ? totalScore / scores.length
      : null;

    const competencyAverage = average(
      summary.map((item) => item.percentage)
    );

    return {
      weekly,
      summary,
      allTheory,
      allPractices,
      scoreCount: scores.length,
      totalScore,
      avgScore,
      grade: getGrade(avgScore),
      competencyAverage,
      incomplete: summary.filter((item) => !item.achieved),
      simper: calculateSimper(data.simper),
    };
  }, [data, selectedWeeks]);

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="premium-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="premium-loading">
        <h2>Rapor Tidak Dapat Ditampilkan</h2>
        <p>{error || "Data tidak tersedia."}</p>
        <button onClick={() => router.back()}>Kembali</button>
      </main>
    );
  }

  const { program, profile, mentorName } = data;

  const participant = Array.isArray(program.peserta)
    ? program.peserta[0]
    : program.peserta;

  const participantName =
    participant?.full_name?.trim() || "Peserta OJT";

  const site = program.site || "—";
  const department = participant?.department || "—";

  const accountRole = roleOf(profile.role);
  const isManager = ["admin", "mentor"].includes(accountRole);

  const selectedLabel = selectedWeeks
    .map((week) => weekLabel(week))
    .join(", ");

  const ranges = selectedWeeks.map((week) => {
    const global = weekByNumber(week);
    const participantRange = programWeekRange(week, program);

    return {
      week,
      start: participantRange?.start || global?.start,
      end: participantRange?.end || global?.end,
    };
  });

  const periodStart = ranges[0]?.start;
  const periodEnd = ranges[ranges.length - 1]?.end;

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  return (
    <main className="premium-root">
      <style>{css}</style>

      {/* =============================================
          NAVIGASI APLIKASI
      ============================================= */}

      <header className="premium-topbar">
        <div className="premium-app-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="premium-account">
          <small>
            {accountRole === "admin"
              ? "Administrator"
              : accountRole === "mentor"
              ? "Mentor"
              : "Peserta"}
          </small>
          <strong>{profile.full_name || "Pengguna"}</strong>
        </div>

        <button
          className="premium-button light"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="premium-container">

        {/* =========================================
            PENGATURAN RAPOR
        ========================================= */}

        <section className="premium-controls">
          <div className="premium-controls-head">
            <div>
              <small className="premium-eyebrow">
                OJT MINETRACK · REPORT GENERATOR
              </small>

              <h2>Pengaturan Rapor OJT</h2>

              <p>
                Pilih periode Kalender Global dan cetak
                dengan Template 10 Premium Corporate.
              </p>
            </div>

            <span className="premium-template-tag">
              TEMPLATE 10 · NAVY & GOLD
            </span>
          </div>

          <div className="premium-modes">
            {[
              ["single", "Satu Minggu"],
              ["range", "Rentang Minggu"],
              ["custom", "Minggu Tertentu"],
            ].map(([key, label]) => (
              <label key={key} className={mode === key ? "chosen" : ""}>
                <input
                  type="radio"
                  name="premiumMode"
                  checked={mode === key}
                  onChange={() => setMode(key)}
                />
                {label}
              </label>
            ))}
          </div>

          {mode === "single" && availableWeeks.length > 0 && (
            <div className="premium-selectors">
              <div>
                <label>Pilih Minggu</label>
                <WeekSelect
                  weeks={availableWeeks}
                  value={singleWeek}
                  onChange={setSingleWeek}
                />
              </div>
            </div>
          )}

          {mode === "range" && availableWeeks.length > 0 && (
            <div className="premium-selectors">
              <div>
                <label>Dari Minggu</label>
                <WeekSelect
                  weeks={availableWeeks}
                  value={fromWeek}
                  onChange={changeFromWeek}
                />
              </div>

              <div>
                <label>Sampai Minggu</label>
                <WeekSelect
                  weeks={availableWeeks.filter(
                    (week) => week.week >= fromWeek
                  )}
                  value={toWeek}
                  onChange={setToWeek}
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="premium-week-selector">
              {GLOBAL_WEEKS.map((week) => {
                const selected = customWeeks.includes(week.week);

                return (
                  <button
                    key={week.week}
                    type="button"
                    disabled={!availableSet.has(week.week)}
                    className={selected ? "selected" : ""}
                    onClick={() => toggleCustomWeek(week.week)}
                    title={`${dateText(week.start)} - ${dateText(week.end)}`}
                  >
                    {pad(week.week)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="premium-selected-summary">
            <strong>
              {selectedWeeks.length} Minggu Dipilih
            </strong>

            <span>{selectedLabel || "Belum ada minggu dipilih"}</span>

            {selectedWeeks.length > 0 && (
              <small>
                {dateText(periodStart)} – {dateText(periodEnd)}
              </small>
            )}
          </div>

          {error && <div className="premium-error">{error}</div>}

          <div className="premium-actions">
            <button
              className="premium-button light"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing ? "Memuat..." : "↻ Refresh Data"}
            </button>

            <button
              className="premium-button navy"
              onClick={() => setPreview((old) => !old)}
            >
              {preview ? "Sembunyikan Pratinjau" : "Tampilkan Pratinjau"}
            </button>

            <button
              className="premium-button gold"
              onClick={() => window.print()}
              disabled={!selectedWeeks.length || refreshing}
            >
              Cetak / Simpan PDF
            </button>
          </div>
        </section>

        {/* =========================================
            DOKUMEN RAPOR
        ========================================= */}

        {selectedWeeks.length > 0 && (
          <article
            className={
              "premium-paper " +
              (!preview ? "premium-preview-hidden" : "")
            }
          >
            {/* HEADER CORPORATE */}
            <div className="premium-report-header">
              <div className="premium-header-gold-line" />

              <div className="premium-header-content">
                <div className="premium-corporate-name">
                  <strong>BERAU<span>COAL</span></strong>
                  <small>PT BERAU COAL</small>
                </div>

                <div className="premium-report-title">
                  <span>OFFICIAL TRAINING REPORT</span>
                  <h1>RAPOR OJT</h1>
                  <h2>ON THE JOB TRAINING</h2>
                  <p>EMERGENCY RESPONSE GROUP</p>
                </div>

                <div className="premium-report-seal">
                  <div>
                    <strong>OJT</strong>
                    <small>TRAINING</small>
                  </div>
                </div>
              </div>

              <div className="premium-header-bottom">
                <span>MINETRACK V2.0</span>
                <span>EVALUASI KOMPETENSI PESERTA</span>
                <span>KALENDER GLOBAL 2026–2027</span>
              </div>
            </div>

            {/* IDENTITAS DAN KETERANGAN */}
            <div className="premium-intro">
              <section className="premium-panel">
                <SectionHeader title="DATA PESERTA" />

                <div className="premium-identity">
                  <span>Nama</span>
                  <strong>{participantName}</strong>

                  <span>Site</span>
                  <strong>{site}</strong>

                  <span>Jabatan</span>
                  <strong>{POSITION}</strong>

                  <span>Departemen</span>
                  <strong>{department}</strong>

                  <span>Periode OJT</span>
                  <strong>
                    {dateText(program.start_date)} –{" "}
                    {dateText(program.end_date)}
                  </strong>

                  <span>Minggu Rapor</span>
                  <strong>{selectedLabel}</strong>
                </div>
              </section>

              <section className="premium-panel premium-description-panel">
                <SectionHeader title="KETERANGAN PROGRAM" />

                <p>
                  On The Job Training (OJT) merupakan program
                  pengembangan kompetensi kerja melalui
                  pembelajaran, kegiatan lapangan, pembinaan,
                  dan praktik langsung di lingkungan kerja.
                </p>

                <p>
                  Penilaian menggunakan Kalender Global OJT
                  Week 01–25. Realisasi dicatat berdasarkan
                  hasil aktual, sedangkan persentase setiap
                  kompetensi dibatasi maksimal 100% per minggu.
                </p>

                <div className="premium-period-tag">
                  <strong>PERIODE LAPORAN</strong>
                  <span>
                    {dateText(periodStart)} – {dateText(periodEnd)}
                  </span>
                </div>
              </section>
            </div>

            {/* KOMPETENSI + RINGKASAN */}
            <div className="premium-main-grid">
              <section className="premium-panel premium-competency-panel">
                <SectionHeader
                  number="01"
                  title="PENILAIAN KOMPETENSI UTAMA"
                />

                <div className="premium-table-scroll">
                  <table className="premium-table premium-competency-table">
                    <thead>
                      <tr>
                        <th>NO</th>
                        <th>KOMPETENSI</th>
                        <th>TARGET</th>
                        <th>REALISASI</th>
                        <th>PROGRES</th>
                        <th>%</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {report.summary.map((item, index) => (
                        <tr key={item.key}>
                          <td>{index + 1}</td>

                          <td className="premium-competency-name">
                            <span className="premium-gold-dot" />
                            {item.label}
                          </td>

                          <td>
                            {fmt(item.totalTarget)} {item.unit}
                          </td>

                          <td>
                            <strong>
                              {fmt(
                                item.realized,
                                item.key === "Fisik" ? 3 : 0
                              )}
                            </strong>{" "}
                            {item.unit}
                          </td>

                          <td>
                            <div className="premium-progress-track">
                              <div
                                className={
                                  item.achieved ? "complete" : "partial"
                                }
                                style={{
                                  width: `${item.percentage}%`,
                                }}
                              />
                            </div>
                          </td>

                          <td>
                            <strong
                              className={
                                item.achieved
                                  ? "premium-positive"
                                  : "premium-warning"
                              }
                            >
                              {fmt(item.percentage, 2)}%
                            </strong>
                          </td>

                          <td>
                            <span
                              className={
                                "premium-status " +
                                (item.achieved ? "yes" : "no")
                              }
                            >
                              {item.achieved
                                ? "TERCAPAI"
                                : "BELUM TERCAPAI"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="premium-competency-note">
                  Persentase merupakan rata-rata capaian tiap
                  minggu yang masing-masing dibatasi 100%.
                  Status Tercapai mensyaratkan seluruh
                  target minggu pilihan terpenuhi.
                </p>
              </section>

              <aside className="premium-kpi-column">
                <div className="premium-average-card">
                  <small>RATA-RATA KOMPETENSI</small>
                  <strong>
                    {fmt(report.competencyAverage, 2)}%
                  </strong>

                  <div className="premium-average-track">
                    <div
                      style={{
                        width: `${report.competencyAverage}%`,
                      }}
                    />
                  </div>

                  <span>Achievement Performance</span>
                </div>

                <div className="premium-grade-card">
                  <div className="premium-grade-title">
                    RINGKASAN NILAI
                  </div>

                  <div className="premium-grade-numbers">
                    <div>
                      <span>NILAI TOTAL</span>
                      <strong>
                        {report.scoreCount
                          ? fmt(report.totalScore, 2)
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <span>RATA-RATA</span>
                      <strong>{fmt(report.avgScore, 2)}</strong>
                    </div>
                  </div>

                  <div className="premium-grade-bottom">
                    <div className="premium-grade-circle">
                      {report.grade[0]}
                    </div>

                    <div>
                      <strong>{report.grade[1]}</strong>
                      <small>
                        Berdasarkan nilai teori dan praktik
                      </small>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            {/* TEORI DAN PRAKTIK */}
            <div className="premium-learning-grid">
              <section className="premium-panel">
                <SectionHeader
                  number="02"
                  title="PENILAIAN PEMBELAJARAN MINGGUAN"
                />

                {chunks(report.weekly).map((group, index) => (
                  <WeeklyScoreTable
                    key={index}
                    weeks={group}
                    site={site}
                    type="theory"
                  />
                ))}
              </section>

              <section className="premium-panel">
                <SectionHeader
                  number="03"
                  title="PENILAIAN PRAKTIK MINGGUAN"
                />

                {chunks(report.weekly).map((group, index) => (
                  <WeeklyScoreTable
                    key={index}
                    weeks={group}
                    site={site}
                    type="practice"
                  />
                ))}
              </section>
            </div>

            {/* SIMPER */}
            <section className="premium-panel premium-simper-panel">
              <SectionHeader
                number="04"
                title="VALIDASI DAN KETERANGAN SIMPER"
              />

              <div className="premium-simper-grid">
                <SimperItem
                  title="KMKOP"
                  status={simperStatus(
                    report.simper.kmkopStatus,
                    "kmkop"
                  )}
                  positive={report.simper.kmkop}
                  detail={`Validasi: ${validationText(
                    report.simper.kmkopValidation
                  )}`}
                />

                <SimperItem
                  title="PRAKTIK"
                  status={simperStatus(
                    report.simper.practiceStatus,
                    "practice"
                  )}
                  positive={report.simper.praktik}
                  detail={`Validasi: ${validationText(
                    report.simper.practiceValidation
                  )}`}
                />

                <SimperItem
                  title="ORIENTASI AREA"
                  status={simperStatus(
                    report.simper.orientationStatus,
                    "orientation"
                  )}
                  positive={report.simper.orientasi}
                  detail={`Tanggal: ${dateText(
                    report.simper.orientationDate
                  )}`}
                />

                <SimperItem
                  title="PENERBITAN SIMPER"
                  status={issuanceText(
                    report.simper.issuanceStatus
                  )}
                  positive={
                    report.simper.issuanceStatus === "issued"
                  }
                  detail={`Tanggal: ${dateText(
                    report.simper.issuanceDate
                  )}`}
                />
              </div>

              <div className="premium-simper-footer">
                <span>
                  PROGRES SIMPER:{" "}
                  <strong>{report.simper.percentage}%</strong>
                </span>

                <span>
                  Persyaratan:{" "}
                  <strong>
                    {report.simper.completed}/3
                  </strong>
                </span>

                <span>
                  Status:{" "}
                  <strong>
                    {report.simper.passed
                      ? "LULUS"
                      : "BELUM LULUS"}
                  </strong>
                </span>

                <span>
                  Penerbitan:{" "}
                  <strong>
                    {issuanceText(report.simper.issuanceStatus)}
                  </strong>
                </span>
              </div>

              {report.simper.issuanceNumber && (
                <p className="premium-footnote">
                  Nomor SIMPER: {report.simper.issuanceNumber}
                </p>
              )}

              {report.simper.legacy && (
                <p className="premium-footnote">
                  Catatan: Data SIMPER lama terdeteksi.
                  Validasi komponen perlu diperiksa.
                </p>
              )}
            </section>

            {/* EVALUASI DAN PREDIKAT */}
            <div className="premium-bottom-grid">
              <section className="premium-panel premium-evaluation">
                <SectionHeader title="CATATAN EVALUASI" />

                {report.incomplete.length ? (
                  <p>
                    Kompetensi yang belum memenuhi target
                    pada seluruh minggu pilihan:{" "}
                    <strong>
                      {report.incomplete
                        .map((item) => item.label)
                        .join(", ")}
                    </strong>.
                  </p>
                ) : (
                  <p>
                    Seluruh kompetensi utama telah mencapai
                    target pada setiap minggu yang dipilih.
                  </p>
                )}

                <p>
                  Jumlah penilaian teori:{" "}
                  <strong>{report.allTheory.length}</strong>.
                  Jumlah penilaian praktik:{" "}
                  <strong>{report.allPractices.length}</strong>.
                </p>

                <p>
                  Kegiatan yang belum tercatat tidak otomatis
                  menunjukkan kegagalan. Monitoring dan evaluasi
                  Mentor tetap diperlukan.
                </p>
              </section>

              <section className="premium-panel premium-grade-description">
                <SectionHeader title="PREDIKAT PENILAIAN" />

                <div className="premium-predicate">
                  <div className="premium-predicate-medal">
                    {report.grade[0]}
                  </div>

                  <div>
                    <strong>{report.grade[1]}</strong>

                    <p>
                      A: 85–100 · B: 75–84,99
                      <br />
                      C: 60–74,99 · D: di bawah 60
                    </p>
                  </div>
                </div>

                <p>
                  Predikat menggunakan rata-rata nilai teori
                  dan praktik, bukan persentase Achievement.
                  Predikat merupakan acuan template dan bukan
                  keputusan kelulusan resmi.
                </p>
              </section>
            </div>

            {/* RINCIAN WEEK */}
            <section className="premium-week-details">
              <SectionHeader title="RINCIAN MINGGU GLOBAL" />

              <div className="premium-week-detail-grid">
                {ranges.map((week) => (
                  <div key={week.week}>
                    <strong>W{pad(week.week)}</strong>
                    <span>
                      {dateText(week.start)} – {dateText(week.end)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* TANDA TANGAN */}
            <footer className="premium-report-footer">
              <div className="premium-footer-info">
                <strong>OJT MineTrack · PT Berau Coal</strong>
                <span>
                  Tanggal cetak: {currentDate()}
                </span>
                <span>
                  Kalender Global OJT Week 01–25
                </span>
                <span>
                  Dokumen Evaluasi OJT · Emergency Response Group
                </span>
              </div>

              <div className="premium-mentor-sign">
                <span>Mengetahui,</span>
                <strong>Mentor / Penanggung Jawab</strong>

                <div className="premium-sign-space" />

                <div className="premium-sign-line">
                  {mentorName || "Mentor OJT"}
                </div>
              </div>
            </footer>

            <div className="premium-footer-line" />
          </article>
        )}
      </div>
    </main>
  );
}

// ======================================================
// STYLING PREMIUM CORPORATE
// ======================================================

const css = `
:root {
  --premium-navy: #0b2643;
  --premium-dark: #061b30;
  --premium-gold: #c79636;
  --premium-lightgold: #f7ebcf;
  --premium-border: #d6dee5;
}

.premium-root,
.premium-root * {
  box-sizing: border-box;
}

.premium-root {
  min-height: 100vh;
  background: #edf1f5;
  color: #172f47;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.premium-loading {
  min-height: 100vh;
  background: #edf1f5;
  padding: 30px;
  font-family: Arial, sans-serif;
}

.premium-topbar {
  background: #081d32;
  color: white;
  padding: 14px 22px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.premium-app-brand {
  font-size: 21px;
  font-weight: 900;
  white-space: nowrap;
}

.premium-app-brand span {
  color: #3bc596;
}

.premium-account {
  margin-left: auto;
  text-align: right;
  max-width: 230px;
}

.premium-account small {
  display: block;
  color: #a9c3d2;
  font-size: 10px;
}

.premium-account strong {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.premium-container {
  max-width: 1400px;
  margin: auto;
  padding: 20px;
}

.premium-controls {
  background: white;
  border: 1px solid #d6dee5;
  border-radius: 13px;
  padding: 22px;
  margin-bottom: 19px;
  box-shadow: 0 4px 15px #102c4010;
}

.premium-controls-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
  flex-wrap: wrap;
}

.premium-eyebrow {
  color: #b78c3a;
  font-weight: 900;
  letter-spacing: 1px;
  font-size: 10px;
}

.premium-controls h2 {
  font-size: 23px;
  margin: 8px 0;
}

.premium-controls p {
  color: #6d7c88;
  line-height: 1.5;
}

.premium-template-tag {
  border: 1px solid #e0c382;
  color: #916a20;
  background: #fff8e8;
  padding: 9px 12px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 900;
}

.premium-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 20px 0;
}

.premium-modes label {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #dbe2e8;
  border-radius: 9px;
  padding: 11px 14px;
  cursor: pointer;
  font-weight: 700;
}

.premium-modes label.chosen {
  border-color: #c79636;
  color: #81601e;
  background: #fff8e7;
}

.premium-selectors {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 800px;
  gap: 12px;
}

.premium-selectors label {
  display: block;
  margin-bottom: 7px;
  font-weight: 800;
}

.premium-select {
  width: 100%;
  border: 1px solid #cbd7e0;
  color: #172f47;
  padding: 12px;
  background: white;
  border-radius: 8px;
}

.premium-week-selector {
  display: grid;
  grid-template-columns: repeat(13, minmax(0, 1fr));
  gap: 6px;
}

.premium-week-selector button {
  padding: 10px 4px;
  border: 1px solid #d8e1e8;
  background: white;
  color: #17304a;
  border-radius: 7px;
  cursor: pointer;
}

.premium-week-selector button.selected {
  background: #b8872c;
  border-color: #b8872c;
  color: white;
  font-weight: 900;
}

.premium-week-selector button:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.premium-selected-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 13px;
  margin-top: 15px;
  background: #f8f3e8;
  border: 1px solid #efe0bb;
  border-radius: 9px;
}

.premium-selected-summary strong {
  color: #9e7628;
}

.premium-selected-summary small {
  width: 100%;
  color: #7d786c;
}

.premium-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 15px;
}

.premium-button {
  border: none;
  border-radius: 8px;
  padding: 12px 15px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.premium-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.premium-button.light {
  background: #e6edf0;
  color: #214663;
}

.premium-button.navy {
  background: #113451;
  color: white;
}

.premium-button.gold {
  background: #b98629;
  color: white;
}

.premium-error {
  background: #fff0f0;
  color: #ae2929;
  padding: 12px;
  margin-top: 12px;
  border-radius: 8px;
}

.premium-paper {
  background: white;
  border: 1px solid #d4dce4;
  padding: 17px;
  box-shadow: 0 5px 23px #102c401c;
}

.premium-preview-hidden {
  display: none;
}

/* HEADER */

.premium-report-header {
  position: relative;
  overflow: hidden;
  border-bottom: 4px solid #c79636;
  background: linear-gradient(
    125deg,
    #ffffff 0%,
    #ffffff 43%,
    #fbf7ec 65%,
    #e7ecf0 100%
  );
}

.premium-header-gold-line {
  height: 5px;
  background: linear-gradient(
    90deg,
    #0b2643 0%,
    #0b2643 22%,
    #c79636 22%,
    #e4bb61 100%
  );
}

.premium-header-content {
  display: grid;
  grid-template-columns: 1fr 2.1fr .7fr;
  align-items: center;
  gap: 10px;
  min-height: 115px;
  padding: 14px 19px;
}

.premium-corporate-name strong {
  display: block;
  font-size: 23px;
  letter-spacing: -1px;
  color: #0b2643;
  white-space: nowrap;
}

.premium-corporate-name strong span {
  color: #158145;
}

.premium-corporate-name small {
  display: block;
  margin-top: 7px;
  font-size: 9px;
  letter-spacing: 1px;
  color: #8a8a81;
}

.premium-report-title {
  text-align: center;
}

.premium-report-title > span {
  color: #a37e36;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 2px;
}

.premium-report-title h1 {
  font-size: 31px;
  color: #0b2643;
  margin: 4px 0;
  letter-spacing: 1px;
}

.premium-report-title h2 {
  font-size: 13px;
  color: #a57c2a;
  letter-spacing: 1px;
  margin: 0 0 6px;
}

.premium-report-title p {
  font-size: 10px;
  font-weight: 900;
  color: #25415b;
  margin: 0;
}

.premium-report-seal {
  display: flex;
  justify-content: center;
}

.premium-report-seal > div {
  width: 68px;
  height: 68px;
  border: 3px solid #c79636;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #0b2643;
}

.premium-report-seal strong {
  font-size: 18px;
}

.premium-report-seal small {
  font-size: 8px;
  font-weight: bold;
}

.premium-header-bottom {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  background: #0b2643;
  color: white;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .3px;
}

/* PANELS */

.premium-intro {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
  margin: 13px 0;
}

.premium-panel {
  min-width: 0;
  padding: 12px;
  border: 1px solid #d3dce4;
  border-radius: 7px;
  background: white;
}

.premium-section-heading {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 23px;
  padding: 5px 11px;
  margin-bottom: 11px;
  background: #0b2643;
  color: white;
  border-left: 4px solid #c79636;
  font-size: 10px;
  font-weight: 900;
}

.premium-section-no {
  color: #f1c46c;
}

.premium-identity {
  display: grid;
  grid-template-columns: 100px minmax(0,1fr);
  gap: 6px 11px;
  font-size: 10px;
}

.premium-identity span {
  color: #687b88;
}

.premium-identity strong {
  font-size: 10px;
  overflow-wrap: anywhere;
}

.premium-description-panel p {
  font-size: 10px;
  line-height: 1.65;
  color: #526777;
  margin: 0 0 10px;
}

.premium-period-tag {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: #f9f4e9;
  border-radius: 5px;
  color: #78591f;
  font-size: 9px;
}

.premium-period-tag span {
  font-weight: bold;
}

/* KOMPETENSI */

.premium-main-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.5fr) minmax(220px, 1fr);
  gap: 10px;
  margin-bottom: 12px;
  align-items: stretch;
}

.premium-table-scroll {
  overflow-x: auto;
  margin-bottom: 7px;
}

.premium-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9px;
}

.premium-table th,
.premium-table td {
  border: 1px solid #d1dbe3;
  padding: 8px 5px;
  text-align: center;
  vertical-align: middle;
  overflow-wrap: anywhere;
}

.premium-table th {
  background: #eaf0f5;
  color: #0b2643;
  font-size: 8px;
  font-weight: 900;
}

.premium-competency-table th:nth-child(1) {width: 6%;}
.premium-competency-table th:nth-child(2) {width: 25%;}
.premium-competency-table th:nth-child(3) {width: 14%;}
.premium-competency-table th:nth-child(4) {width: 16%;}
.premium-competency-table th:nth-child(5) {width: 13%;}
.premium-competency-table th:nth-child(6) {width: 12%;}
.premium-competency-table th:nth-child(7) {width: 14%;}

.premium-competency-name {
  text-align: left !important;
  font-weight: 800;
}

.premium-gold-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #c79636;
  border-radius: 50%;
  margin-right: 6px;
}

.premium-progress-track {
  width: 100%;
  height: 8px;
  background: #e8edf0;
  border-radius: 30px;
  overflow: hidden;
}

.premium-progress-track > div {
  height: 100%;
  border-radius: 30px;
}

.premium-progress-track .complete {
  background: linear-gradient(90deg, #13835a, #23b07e);
}

.premium-progress-track .partial {
  background: linear-gradient(90deg, #bc8428, #e9bd65);
}

.premium-positive {
  color: #087d55;
}

.premium-warning {
  color: #b97a1b;
}

.premium-status {
  display: inline-block;
  padding: 5px 6px;
  border-radius: 12px;
  font-size: 8px;
  font-weight: 800;
}

.premium-status.yes {
  background: #e3f5e9;
  color: #08754d;
}

.premium-status.no {
  background: #fff1df;
  color: #b17323;
}

.premium-competency-note {
  color: #7e8c95;
  font-size: 9px;
  line-height: 1.6;
  margin: 8px 0 0;
}

/* RINGKASAN KANAN */

.premium-kpi-column {
  display: flex;
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}

.premium-average-card {
  padding: 15px;
  background: linear-gradient(
    125deg,
    #a4711f,
    #d4a951
  );
  border-radius: 7px;
  color: white;
  text-align: center;
}

.premium-average-card small {
  font-size: 10px;
  font-weight: 900;
}

.premium-average-card > strong {
  display: block;
  margin: 8px 0;
  font-size: 32px;
}

.premium-average-track {
  height: 9px;
  background: #ffffff44;
  border-radius: 30px;
  overflow: hidden;
}

.premium-average-track div {
  height: 100%;
  background: white;
  border-radius: 30px;
}

.premium-average-card > span {
  display: block;
  margin-top: 9px;
  font-size: 9px;
}

.premium-grade-card {
  border: 1px solid #e1d2af;
  background: #fffdfa;
  border-radius: 7px;
  padding: 11px;
  flex: 1;
}

.premium-grade-title {
  text-align: center;
  background: #0b2643;
  color: #f1cc80;
  padding: 7px;
  font-weight: 900;
  font-size: 10px;
}

.premium-grade-numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}

.premium-grade-numbers div {
  background: white;
  border: 1px solid #e9e0cf;
  padding: 10px 4px;
  text-align: center;
}

.premium-grade-numbers span {
  display: block;
  color: #718493;
  font-size: 8px;
}

.premium-grade-numbers strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  color: #0b2643;
}

.premium-grade-bottom {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 14px;
}

.premium-grade-circle {
  width: 55px;
  height: 55px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 4px solid #bd8e36;
  border-radius: 50%;
  color: #90681e;
  font-size: 27px;
  font-weight: 900;
}

.premium-grade-bottom strong {
  display: block;
  font-size: 13px;
}

.premium-grade-bottom small {
  display: block;
  font-size: 9px;
  color: #7d8b93;
  line-height: 1.5;
  margin-top: 5px;
}

/* NILAI MINGGUAN */

.premium-learning-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
  align-items: start;
}

.premium-week-table {
  font-size: 9px;
}

.premium-week-table td {
  padding: 6px 4px;
}

.premium-site-cell {
  width: 70px;
  color: #163551;
  font-weight: 900;
  background: #f5f8fa;
}

.premium-score-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-height: 17px;
}

.premium-score-entry span {
  font-size: 9px;
  color: #6a7983;
}

.premium-score-entry strong {
  font-size: 10px;
  color: #173955;
}

/* SIMPER */

.premium-simper-panel {
  margin-bottom: 12px;
}

.premium-simper-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 8px;
}

.premium-simper-item {
  border: 1px solid #dce4eb;
  border-radius: 6px;
  min-width: 0;
  padding: 10px;
  background: #fafbfd;
  text-align: center;
}

.premium-simper-title {
  display: block;
  color: #4a6174;
  font-size: 9px;
  font-weight: 900;
}

.premium-simper-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin: 12px 0 8px;
}

.premium-simper-symbol {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-weight: 900;
  color: white;
}

.premium-simper-symbol.positive {
  background: #108454;
}

.premium-simper-symbol.pending {
  background: #c68b23;
}

.premium-simper-content strong {
  font-size: 10px;
}

.positive-text {
  color: #08784d;
}

.pending-text {
  color: #aa731a;
}

.premium-simper-item > small {
  display: block;
  color: #82909a;
  font-size: 8px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.premium-simper-footer {
  display: flex;
  gap: 8px 16px;
  flex-wrap: wrap;
  background: #f4f7fa;
  border: 1px solid #e0e6eb;
  margin-top: 9px;
  padding: 10px;
  color: #667a88;
  font-size: 9px;
}

.premium-simper-footer strong {
  color: #173955;
}

.premium-footnote {
  color: #7d8d98;
  font-size: 9px;
  line-height: 1.5;
}

/* EVALUASI */

.premium-bottom-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.premium-evaluation p,
.premium-grade-description > p {
  font-size: 10px;
  line-height: 1.7;
  color: #516b7a;
  margin: 5px 0 10px;
}

.premium-predicate {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 5px 0 11px;
}

.premium-predicate-medal {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 4px solid #c79636;
  display: grid;
  place-items: center;
  color: #966d24;
  background: #fff7e4;
  font-size: 25px;
  font-weight: 900;
}

.premium-predicate strong {
  font-size: 14px;
  color: #183651;
}

.premium-predicate p {
  margin: 6px 0 0;
  font-size: 9px;
  color: #778995;
  line-height: 1.5;
}

/* RINCIAN MINGGU */

.premium-week-details {
  margin-top: 12px;
  border: 1px solid #d5dfe5;
  border-radius: 6px;
  padding: 11px;
}

.premium-week-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0,1fr));
  gap: 7px;
}

.premium-week-detail-grid > div {
  padding: 7px 9px;
  border-radius: 5px;
  border: 1px solid #e5e4dd;
  background: #fffdf9;
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 9px;
}

.premium-week-detail-grid strong {
  color: #a07524;
}

.premium-week-detail-grid span {
  color: #526977;
}

/* FOOTER */

.premium-report-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
  padding: 18px 10px 12px;
}

.premium-footer-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #6c8090;
  font-size: 9px;
}

.premium-footer-info strong {
  color: #0b2643;
}

.premium-mentor-sign {
  min-width: 220px;
  text-align: center;
  font-size: 10px;
}

.premium-mentor-sign > span,
.premium-mentor-sign > strong {
  display: block;
}

.premium-mentor-sign > strong {
  margin-top: 4px;
}

.premium-sign-space {
  height: 36px;
}

.premium-sign-line {
  padding-top: 6px;
  border-top: 1px solid #82909b;
  font-weight: 900;
  color: #0b2643;
}

.premium-footer-line {
  height: 5px;
  background: linear-gradient(
    90deg,
    #0b2643,
    #0b2643 75%,
    #c79636 75%,
    #c79636
  );
  margin-top: 5px;
}

/* RESPONSIVE */

@media (max-width: 1050px) {
  .premium-main-grid {
    grid-template-columns: 1fr;
  }

  .premium-kpi-column {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 700px) {
  .premium-topbar {
    padding: 11px;
    gap: 8px;
  }

  .premium-app-brand {
    font-size: 17px;
  }

  .premium-account {
    max-width: 110px;
  }

  .premium-account strong {
    font-size: 10px;
  }

  .premium-container {
    padding: 8px;
  }

  .premium-controls {
    padding: 14px;
  }

  .premium-controls h2 {
    font-size: 20px;
  }

  .premium-modes {
    flex-direction: column;
    gap: 7px;
  }

  .premium-selectors {
    grid-template-columns: 1fr;
  }

  .premium-week-selector {
    grid-template-columns: repeat(5, minmax(0,1fr));
  }

  .premium-actions .premium-button {
    flex: 1;
  }

  .premium-paper {
    padding: 8px;
  }

  .premium-header-content {
    grid-template-columns: .8fr 2fr;
    gap: 5px;
    padding: 10px;
  }

  .premium-corporate-name strong {
    font-size: 14px;
  }

  .premium-report-title h1 {
    font-size: 23px;
  }

  .premium-report-title h2 {
    font-size: 10px;
  }

  .premium-report-seal {
    display: none;
  }

  .premium-header-bottom {
    font-size: 7px;
    gap: 6px;
  }

  .premium-intro,
  .premium-learning-grid,
  .premium-bottom-grid {
    grid-template-columns: 1fr;
  }

  .premium-competency-table {
    min-width: 640px;
  }

  .premium-week-table {
    min-width: 470px;
  }

  .premium-kpi-column {
    grid-template-columns: 1fr;
  }

  .premium-simper-grid {
    grid-template-columns: 1fr 1fr;
  }

  .premium-week-detail-grid {
    grid-template-columns: 1fr 1fr;
  }

  .premium-mentor-sign {
    min-width: 125px;
  }

  .premium-report-footer {
    padding: 12px 2px;
  }
}

/* PRINT A4 LANDSCAPE */

@page {
  size: A4 landscape;
  margin: 7mm;
}

@media print {
  html,
  body {
    padding: 0 !important;
    margin: 0 !important;
    background: white !important;
  }

  .premium-root {
    background: white !important;
    min-height: 0 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .premium-topbar,
  .premium-controls {
    display: none !important;
  }

  .premium-container {
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .premium-paper,
  .premium-preview-hidden {
    display: block !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }

  .premium-header-content {
    grid-template-columns: 1fr 2.1fr .7fr !important;
    min-height: 72px !important;
    padding: 7px 13px !important;
  }

  .premium-report-title h1 {
    font-size: 24px !important;
  }

  .premium-report-title h2 {
    font-size: 10px !important;
  }

  .premium-corporate-name strong {
    font-size: 17px !important;
  }

  .premium-report-seal {
    display: flex !important;
  }

  .premium-report-seal > div {
    width: 50px !important;
    height: 50px !important;
  }

  .premium-header-bottom {
    padding: 5px 10px !important;
    font-size: 8px !important;
  }

  .premium-intro {
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
    margin: 7px 0 !important;
  }

  .premium-panel {
    padding: 7px !important;
  }

  .premium-section-heading {
    padding: 4px 8px !important;
    margin-bottom: 6px !important;
    min-height: 19px !important;
    font-size: 9px !important;
  }

  .premium-identity {
    grid-template-columns: 80px 1fr !important;
    gap: 3px 8px !important;
    font-size: 9px !important;
  }

  .premium-identity strong {
    font-size: 9px !important;
  }

  .premium-description-panel p {
    font-size: 8px !important;
    line-height: 1.35 !important;
    margin-bottom: 5px !important;
  }

  .premium-period-tag {
    padding: 5px !important;
    font-size: 8px !important;
  }

  .premium-main-grid {
    grid-template-columns: minmax(0,2.5fr) minmax(0,1fr) !important;
    gap: 7px !important;
    margin-bottom: 7px !important;
  }

  .premium-table-scroll {
    overflow: visible !important;
  }

  .premium-table,
  .premium-competency-table,
  .premium-week-table {
    min-width: 0 !important;
    width: 100% !important;
  }

  .premium-table th,
  .premium-table td {
    padding: 4px 3px !important;
    font-size: 8px !important;
  }

  .premium-competency-table th,
  .premium-competency-table td {
    font-size: 7px !important;
  }

  .premium-status {
    font-size: 6px !important;
    padding: 3px 4px !important;
  }

  .premium-progress-track {
    height: 6px !important;
  }

  .premium-competency-note {
    font-size: 7px !important;
    margin: 5px 0 0 !important;
  }

  .premium-kpi-column {
    display: flex !important;
    flex-direction: column !important;
    gap: 6px !important;
  }

  .premium-average-card {
    padding: 10px !important;
  }

  .premium-average-card > strong {
    font-size: 24px !important;
    margin: 5px 0 !important;
  }

  .premium-grade-card {
    padding: 8px !important;
  }

  .premium-grade-numbers div {
    padding: 6px 2px !important;
  }

  .premium-grade-numbers strong {
    font-size: 16px !important;
  }

  .premium-grade-bottom {
    margin-top: 7px !important;
  }

  .premium-grade-circle {
    width: 40px !important;
    height: 40px !important;
    font-size: 20px !important;
  }

  .premium-grade-bottom strong {
    font-size: 10px !important;
  }

  .premium-learning-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
    margin-bottom: 7px !important;
  }

  .premium-week-table th,
  .premium-week-table td {
    font-size: 7px !important;
    padding: 4px 2px !important;
  }

  .premium-score-entry span,
  .premium-score-entry strong {
    font-size: 7px !important;
  }

  .premium-simper-panel {
    margin-bottom: 7px !important;
  }

  .premium-simper-grid {
    grid-template-columns: repeat(4,minmax(0,1fr)) !important;
    gap: 5px !important;
  }

  .premium-simper-item {
    padding: 6px 4px !important;
  }

  .premium-simper-content {
    margin: 6px 0 !important;
  }

  .premium-simper-content strong {
    font-size: 8px !important;
  }

  .premium-simper-item > small {
    font-size: 7px !important;
  }

  .premium-simper-footer {
    padding: 6px !important;
    margin-top: 6px !important;
    font-size: 8px !important;
  }

  .premium-bottom-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
  }

  .premium-evaluation p,
  .premium-grade-description > p {
    font-size: 8px !important;
    margin: 3px 0 7px !important;
    line-height: 1.45 !important;
  }

  .premium-predicate-medal {
    width: 42px !important;
    height: 42px !important;
    font-size: 19px !important;
  }

  .premium-predicate strong {
    font-size: 11px !important;
  }

  .premium-week-details {
    padding: 7px !important;
    margin-top: 7px !important;
  }

  .premium-week-detail-grid {
    grid-template-columns: repeat(4,minmax(0,1fr)) !important;
    gap: 4px !important;
  }

  .premium-week-detail-grid > div {
    padding: 4px !important;
    font-size: 7px !important;
  }

  .premium-report-footer {
    padding: 10px 6px 6px !important;
  }

  .premium-footer-info {
    gap: 3px !important;
    font-size: 8px !important;
  }

  .premium-sign-space {
    height: 23px !important;
  }

  .premium-mentor-sign {
    min-width: 180px !important;
    font-size: 8px !important;
  }

  .premium-header-content,
  .premium-intro,
  .premium-main-grid,
  .premium-bottom-grid,
  .premium-simper-panel,
  .premium-report-footer {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .premium-table tr,
  .premium-simper-item,
  .premium-week-detail-grid > div {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
`;
