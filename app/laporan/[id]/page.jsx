
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  {
    key: "Fisik",
    title: "FISIK",
    target: 25,
    color: "#dc4843",
  },
  {
    key: "Training",
    title: "INTERNAL TRAINING",
    target: 4,
    color: "#eca72f",
  },
  {
    key: "Sosialisasi",
    title: "SOSIALISASI",
    target: 3,
    color: "#d6b918",
  },
  {
    key: "Orientasi Area",
    title: "ORIENTASI",
    target: 2,
    color: "#258c50",
  },
  {
    key: "Coaching",
    title: "COACHING",
    target: 1,
    color: "#249fc0",
  },
  {
    key: "Hazard",
    title: "HAZARD",
    target: 2,
    color: "#3070d5",
  },
];

const SIMPER_START = "[[SIMPER_V2]]";
const SIMPER_END = "[[/SIMPER_V2]]";

function pad(n) {
  return String(n).padStart(2, "0");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value ?? "").trim().toLowerCase();
}

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 0) {
  const n = num(value);

  if (n === null) return "—";

  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseDate(value) {
  if (!value) return null;

  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  return date;
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

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

// ====================================================
// SIMPER V2 / V4
// ====================================================

function parseSimper(notes) {
  const text = String(notes ?? "");

  const start = text.lastIndexOf(SIMPER_START);
  const end = text.lastIndexOf(SIMPER_END);

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const result = JSON.parse(
      text.slice(
        start + SIMPER_START.length,
        end
      )
    );

    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result)
    ) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

// ====================================================
// PROGRES SIMPER
//
// KMKOP: 1/3
// PRAKTIK: 1/3
// ORIENTASI AREA: 1/3
//
// PENERBITAN: STATUS TERPISAH
// ====================================================

function calculateSimper(record) {
  const meta = parseSimper(record?.notes);

  const kmkop =
    normalizeRole(record?.theory_status) === "passed";

  const praktik =
    normalizeRole(record?.practice_status) === "passed";

  const orientasi =
    normalizeRole(meta?.orientation_status) ===
    "completed";

  const completed = [
    kmkop,
    praktik,
    orientasi,
  ].filter(Boolean).length;

  const percentage = [0, 33, 67, 100][completed];

  const issuanceStatus =
    normalizeRole(meta?.issuance_status) ||
    "not_issued";

  const issued =
    issuanceStatus === "issued";

  return {
    kmkop,
    praktik,
    orientasi,
    completed,
    percentage,
    passed: completed === 3,

    kmkopStatus:
      record?.theory_status || null,

    practiceStatus:
      record?.practice_status || null,

    orientationStatus:
      meta?.orientation_status || null,

    issuanceStatus,
    issued,

    orientationDate:
      meta?.orientation_date || null,

    issuanceNumber:
      meta?.issuance_number || "",

    issuanceDate:
      record?.graduation_date || null,

    // Field validasi terpisah tidak diasumsikan.
    // Hanya digunakan jika memang tersedia
    // dalam metadata yang tersimpan.
    kmkopValidation:
      meta?.theory_validation_status ??
      meta?.kmkop_validation_status ??
      null,

    practiceValidation:
      meta?.practice_validation_status ??
      null,

    legacy:
      !!record &&
      !meta &&
      record.status === "passed",
  };
}

function getComponentText(status, type) {
  const value = normalizeRole(status);

  if (type === "orientation") {
    switch (value) {
      case "completed":
        return "SELESAI";
      case "scheduled":
        return "DIJADWALKAN";
      case "in_progress":
      case "ongoing":
        return "DALAM PROSES";
      default:
        return "BELUM SELESAI";
    }
  }

  switch (value) {
    case "passed":
      return "LULUS";
    case "failed":
      return "TIDAK LULUS";
    case "pending":
      return "MENUNGGU";
    case "scheduled":
      return "DIJADWALKAN";
    default:
      return "BELUM LULUS";
  }
}

function issuanceText(status) {
  switch (normalizeRole(status)) {
    case "issued":
      return "TERBIT";
    case "processing":
      return "DALAM PROSES";
    default:
      return "BELUM TERBIT";
  }
}

function validationText(status) {
  if (
    status === null ||
    status === undefined ||
    status === ""
  ) {
    return "Belum ada data validasi";
  }

  const value = normalizeRole(status);

  if (
    ["validated", "verified", "approved", "completed"].includes(value)
  ) {
    return "TERVALIDASI";
  }

  if (
    ["pending", "waiting"].includes(value)
  ) {
    return "MENUNGGU VALIDASI";
  }

  if (
    ["rejected", "failed"].includes(value)
  ) {
    return "BELUM TERVALIDASI";
  }

  return String(status).replace(/_/g, " ").toUpperCase();
}

function getGrade(value) {
  if (value === null) {
    return ["—", "BELUM ADA NILAI"];
  }

  if (value >= 85) {
    return ["A", "SANGAT BAIK"];
  }

  if (value >= 75) {
    return ["B", "BAIK"];
  }

  if (value >= 60) {
    return ["C", "CUKUP"];
  }

  return ["D", "KURANG"];
}

function chunks(items, size = 7) {
  const result = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}

function SectionTitle({ children }) {
  return (
    <div className="rp-section-title">
      {children}
    </div>
  );
}

function WeekSelect({
  value,
  onChange,
  start = 1,
}) {
  return (
    <select
      className="rp-select"
      value={value}
      onChange={(event) =>
        onChange(Number(event.target.value))
      }
    >
      {Array.from(
        { length: TOTAL_WEEKS - start + 1 },
        (_, i) => i + start
      ).map((week) => (
        <option value={week} key={week}>
          Week {pad(week)}
        </option>
      ))}
    </select>
  );
}

// ====================================================
// TABEL PEMBELAJARAN DAN PRAKTIK BARU
//
// Setiap baris berisi satu kegiatan/nilai
// dari masing-masing minggu.
//
// Tidak menggunakan sel tinggi yang
// menumpuk semua kegiatan dalam satu TD.
//
// Semua data asli tetap ditampilkan.
// ====================================================

function CompactWeekTable({
  weeks,
  site,
  type = "theory",
}) {
  if (!weeks.length) return null;

  const isPractice = type === "practice";

  const getItems = (week) =>
    isPractice
      ? week.practices || []
      : week.theory || [];

  const maxRows = Math.max(
    1,
    ...weeks.map((week) => getItems(week).length)
  );

  return (
    <div className="rp-scroll rp-compact-wrap">
      <table className="rp-table rp-compact-table">
        <thead>
          <tr>
            <th className="rp-compact-site">
              SITE
            </th>

            {weeks.map((item) => (
              <th key={item.week}>
                WEEK {pad(item.week)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {Array.from(
            { length: maxRows },
            (_, rowIndex) => (
              <tr key={rowIndex}>
                {rowIndex === 0 && (
                  <td
                    rowSpan={maxRows}
                    className="rp-site-value"
                  >
                    {site}
                  </td>
                )}

                {weeks.map((week) => {
                  const item =
                    getItems(week)[rowIndex];

                  if (!item) {
                    return (
                      <td
                        key={week.week}
                        className="rp-compact-empty"
                      >
                        —
                      </td>
                    );
                  }

                  const label = isPractice
                    ? item.practice_name
                    : item.notes;

                  const cleanLabel =
                    String(label ?? "").trim();

                  return (
                    <td
                      key={week.week}
                      className="rp-compact-cell"
                    >
                      <div className="rp-compact-entry">
                        {cleanLabel && (
                          <span className="rp-compact-name">
                            {cleanLabel}
                          </span>
                        )}

                        <strong className="rp-compact-score">
                          {fmt(item.score, 2)}
                        </strong>
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

// ====================================================
// PEMERIKSAAN AKSES
// ====================================================

async function verifyReportAccess(programId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { redirect: "/login" };
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id,role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile) {
    throw new Error(
      "Profil akun tidak ditemukan."
    );
  }

  const role = normalizeRole(profile.role);

  const isAdmin = role === "admin";
  const isMentor = role === "mentor";

  const isParticipant = [
    "participant",
    "peserta",
  ].includes(role);

  if (!isAdmin && !isMentor && !isParticipant) {
    throw new Error(
      "Akun tidak memiliki akses Rapor OJT."
    );
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

  const {
    data: program,
    error: programError,
  } = await query.maybeSingle();

  if (programError) throw programError;

  if (!program) {
    throw new Error(
      "Program OJT tidak ditemukan atau akun tidak memiliki izin."
    );
  }

  if (!parseDate(program.start_date)) {
    throw new Error(
      "Tanggal mulai OJT tidak valid."
    );
  }

  if (isParticipant) {
    const [
      requestResult,
      registrationResult,
    ] = await Promise.all([
      supabase
        .from("ojt_registration_requests")
        .select("status")
        .eq("participant_id", user.id),

      supabase
        .from("participant_registrations")
        .select("status")
        .eq("user_id", user.id),
    ]);

    if (requestResult.error) throw requestResult.error;
    if (registrationResult.error) throw registrationResult.error;

    const approvedNew = (
      requestResult.data || []
    ).some(
      (item) =>
        normalizeRole(item.status) === "approved"
    );

    const approvedOld = (
      registrationResult.data || []
    ).some(
      (item) =>
        normalizeRole(item.status) === "approved"
    );

    if (
      !approvedNew &&
      !approvedOld &&
      program.legacy_access !== true
    ) {
      throw new Error(
        "Program belum memiliki persetujuan akses yang sah."
      );
    }
  }

  return {
    profile,
    program,
    userId: user.id,
  };
}

// ====================================================
// AMBIL DATA RAPOR TERBARU
// ====================================================

async function fetchRecords(id) {
  const results = await Promise.all([
    supabase
      .from("achievement_types")
      .select("code,name"),

    supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,distance_km,status"
      )
      .eq("program_id", id),

    supabase
      .from("post_test_scores")
      .select(
        "id,test_date,score,notes"
      )
      .eq("program_id", id),

    supabase
      .from("weekly_practice_scores")
      .select(
        "id,practice_date,practice_name,score"
      )
      .eq("program_id", id),

    // Mengambil data tersimpan terbaru
    // dari Monitoring SIMPER.
    supabase
      .from("simper_records")
      .select(`
        id,
        theory_status,
        practice_status,
        status,
        notes,
        graduation_date,
        created_at
      `)
      .eq("program_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1),
  ]);

  const labels = [
    "Kategori",
    "Kompetensi",
    "Pembelajaran",
    "Praktik",
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
    types: results[0].data ?? [],
    achievements: results[1].data ?? [],
    theory: results[2].data ?? [],
    practices: results[3].data ?? [],
    simper: results[4].data?.[0] ?? null,
  };
}

// ====================================================
// HALAMAN RAPOR OJT
// ====================================================

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

  const [singleWeek, setSingleWeek] =
    useState(1);

  const [fromWeek, setFromWeek] =
    useState(1);

  const [toWeek, setToWeek] =
    useState(1);

  const [customWeeks, setCustomWeeks] =
    useState([1]);

  const [preview, setPreview] =
    useState(true);

  const requestRef = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = ++requestRef.current;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);

      if (!programId) {
        setError("ID program tidak tersedia.");
        setLoading(false);
        return;
      }

      try {
        const access =
          await verifyReportAccess(programId);

        if (
          !active ||
          requestId !== requestRef.current
        ) {
          return;
        }

        if (access.redirect) {
          router.replace(access.redirect);
          return;
        }

        const records =
          await fetchRecords(programId);

        if (
          !active ||
          requestId !== requestRef.current
        ) {
          return;
        }

        setData({
          profile: access.profile,
          program: access.program,
          userId: access.userId,
          ...records,
        });
      } catch (err) {
        if (
          active &&
          requestId === requestRef.current
        ) {
          setData(null);
          setError(
            err?.message || "Gagal memuat rapor."
          );
        }
      } finally {
        if (
          active &&
          requestId === requestRef.current
        ) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [programId, router]);

  // ====================================================
  // REFRESH DATA DENGAN VERIFIKASI AKSES
  // ====================================================

  async function refreshData() {
    if (!data || refreshing || !programId) {
      return;
    }

    const requestId = ++requestRef.current;

    setRefreshing(true);
    setError("");

    try {
      const access =
        await verifyReportAccess(programId);

      if (requestId !== requestRef.current) {
        return;
      }

      if (access.redirect) {
        setData(null);
        router.replace(access.redirect);
        return;
      }

      if (access.userId !== data.userId) {
        setData(null);
        throw new Error(
          "Akun pengguna berubah. Silakan buka ulang Rapor OJT."
        );
      }

      const records = await fetchRecords(programId);

      if (requestId !== requestRef.current) {
        return;
      }

      setData({
        profile: access.profile,
        program: access.program,
        userId: access.userId,
        ...records,
      });
    } catch (err) {
      if (requestId !== requestRef.current) {
        return;
      }

      setData(null);

      setError(
        err?.message || "Gagal memperbarui rapor."
      );
    } finally {
      if (requestId === requestRef.current) {
        setRefreshing(false);
      }
    }
  }

  // ====================================================
  // PILIHAN MINGGU
  // ====================================================

  const selectedWeeks = useMemo(() => {
    if (mode === "single") {
      return [singleWeek];
    }

    if (mode === "range") {
      return Array.from(
        {
          length: Math.max(
            0,
            toWeek - fromWeek + 1
          ),
        },
        (_, i) => fromWeek + i
      );
    }

    return [...new Set(customWeeks)]
      .filter(
        (w) => w >= 1 && w <= TOTAL_WEEKS
      )
      .sort((a, b) => a - b);
  }, [
    mode,
    singleWeek,
    fromWeek,
    toWeek,
    customWeeks,
  ]);

  function toggleCustomWeek(week) {
    setCustomWeeks((old) =>
      old.includes(week)
        ? old.filter((w) => w !== week)
        : [...old, week]
    );
  }

  // ====================================================
  // PERHITUNGAN RAPOR ASLI DIPERTAHANKAN
  // ====================================================

  const report = useMemo(() => {
    if (!data) return null;

    const {
      program,
      types,
      achievements,
      theory,
      practices,
      simper,
    } = data;

    const typeMap = new Map();

    types.forEach((type) => {
      typeMap.set(
        normalize(type.code),
        type.code
      );

      typeMap.set(
        normalize(type.name),
        type.code
      );
    });

    function typeCode(key) {
      if (key === "Training") {
        return (
          typeMap.get("training") ??
          typeMap.get("internaltraining")
        );
      }

      return typeMap.get(normalize(key));
    }

    const weekly = selectedWeeks.map((week) => {
      const weekAchievements =
        achievements.filter(
          (item) =>
            weekOf(
              item.activity_date,
              program.start_date
            ) === week
        );

      const competencies = TARGETS.map(
        (target) => {
          const code = typeCode(target.key);

          const records = code
            ? weekAchievements.filter(
                (item) =>
                  item.type_code === code
              )
            : [];

          const verified = records.filter(
            (item) =>
              item.status === "verified"
          );

          let realized = 0;

          if (target.key === "Fisik") {
            const meters = verified.reduce(
              (sum, item) =>
                sum +
                Math.round(
                  (num(item.distance_km) ?? 0) * 1000
                ),
              0
            );

            realized = meters / 1000;
          } else {
            realized = verified.length;
          }

          return {
            ...target,
            realized,
            recorded: records.length,
          };
        }
      );

      return {
        week,
        competencies,

        theory: theory.filter(
          (item) =>
            weekOf(
              item.test_date,
              program.start_date
            ) === week
        ),

        practices: practices.filter(
          (item) =>
            weekOf(
              item.practice_date,
              program.start_date
            ) === week
        ),
      };
    });

    const summary = TARGETS.map((target) => {
      const entries = weekly.map(
        (w) =>
          w.competencies.find(
            (item) =>
              item.key === target.key
          )
      );

      let realized;

      if (target.key === "Fisik") {
        const meters = entries.reduce(
          (sum, item) =>
            sum + Math.round(item.realized * 1000),
          0
        );

        realized = meters / 1000;
      } else {
        realized = entries.reduce(
          (sum, item) =>
            sum + item.realized,
          0
        );
      }

      const totalTarget =
        target.target * selectedWeeks.length;

      return {
        ...target,
        totalTarget,
        realized,

        percentage:
          totalTarget > 0
            ? (realized / totalTarget) * 100
            : 0,

        achieved:
          totalTarget > 0 &&
          realized >= totalTarget,
      };
    });

    const allTheory = weekly.flatMap(
      (item) => item.theory
    );

    const allPractices = weekly.flatMap(
      (item) => item.practices
    );

    const validScores = [
      ...allTheory,
      ...allPractices,
    ]
      .map((item) => num(item.score))
      .filter((value) => value !== null);

    const total = validScores.reduce(
      (sum, value) => sum + value,
      0
    );

    const average =
      validScores.length
        ? total / validScores.length
        : null;

    const simperInfo =
      calculateSimper(simper);

    return {
      weekly,
      summary,
      allTheory,
      allPractices,
      total,
      average,
      scoreCount: validScores.length,
      grade: getGrade(average),
      simper: simperInfo,

      incomplete: summary.filter(
        (item) => !item.achieved
      ),
    };
  }, [data, selectedWeeks]);

  // ====================================================
  // LOADING / ERROR
  // ====================================================

  if (loading) {
    return (
      <main className="rp-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="rp-loading">
        <h2>
          Rapor Tidak Dapat Ditampilkan
        </h2>

        <p>
          {error || "Data tidak tersedia."}
        </p>

        <button
          type="button"
          onClick={() => router.back()}
        >
          Kembali
        </button>
      </main>
    );
  }

  const { program, profile } = data;

  const role = normalizeRole(profile.role);

  const isManager = [
    "admin",
    "mentor",
  ].includes(role);

  const peserta =
    Array.isArray(program.peserta)
      ? program.peserta[0]
      : program.peserta;

  const participantName =
    peserta?.full_name?.trim() || "Peserta OJT";

  const department =
    peserta?.department || "—";

  const site = program.site || "—";

  const selectedLabel = selectedWeeks
    .map((w) => `Week ${pad(w)}`)
    .join(", ");

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  // ====================================================
  // CETAK / SIMPAN PDF
  // ====================================================

  function printReport() {
    if (!selectedWeeks.length) return;

    if (!preview) {
      setPreview(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() =>
          window.print()
        );
      });
    } else {
      window.print();
    }
  }

  return (
    <main className="rp-root">
      <style>{`
        .rp-root,.rp-root * {
          box-sizing:border-box;
        }

        .rp-root {
          min-height:100vh;
          background:#eff4f5;
          color:#173149;
          font-family:Arial,Helvetica,sans-serif;
          font-size:12px;
        }

        .rp-loading {
          min-height:100vh;
          padding:25px;
          font-family:Arial,sans-serif;
        }

        .rp-topbar {
          background:#082f39;
          color:white;
          padding:14px 20px;
          display:flex;
          align-items:center;
          justify-content:space-between;
        }

        .rp-brand {
          font-size:20px;
          font-weight:900;
        }

        .rp-brand span {
          color:#35c994;
        }

        .rp-container {
          max-width:1250px;
          margin:auto;
          padding:15px;
        }

        .rp-controls {
          background:white;
          border:1px solid #d4e0e5;
          border-radius:12px;
          padding:17px;
          margin-bottom:15px;
        }

        .rp-controls h2 {
          font-size:20px;
          margin:0 0 9px;
        }

        .rp-muted {
          color:#6a7b88;
          font-size:11px;
          line-height:1.5;
        }

        .rp-modes {
          display:flex;
          flex-wrap:wrap;
          gap:20px;
          margin:16px 0;
        }

        .rp-modes label {
          display:flex;
          align-items:center;
          gap:7px;
          font-weight:700;
        }

        .rp-options {
          display:grid;
          grid-template-columns:1fr 1fr;
          max-width:650px;
          gap:12px;
        }

        .rp-field-label {
          display:block;
          font-weight:800;
          margin-bottom:6px;
          font-size:11px;
        }

        .rp-select {
          width:100%;
          background:white;
          color:#183149;
          border:1px solid #cbd8de;
          border-radius:8px;
          padding:10px;
          font-size:14px;
        }

        .rp-custom {
          display:grid;
          grid-template-columns:repeat(13,1fr);
          gap:5px;
        }

        .rp-week-btn {
          border:1px solid #cad9dc;
          border-radius:6px;
          background:white;
          color:#173149;
          padding:8px 2px;
          cursor:pointer;
        }

        .rp-week-btn.active {
          background:#09835d;
          border-color:#09835d;
          color:white;
        }

        .rp-actions {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:13px;
        }

        .rp-btn {
          border:none;
          border-radius:8px;
          background:#0b8058;
          color:white;
          font-size:12px;
          font-weight:800;
          padding:11px 14px;
          cursor:pointer;
        }

        .rp-btn.blue {
          background:#173e68;
        }

        .rp-btn.light {
          background:#e3f1eb;
          color:#146c4b;
        }

        .rp-btn:disabled {
          opacity:.5;
        }

        .rp-error {
          padding:10px;
          border-radius:7px;
          background:#fff0f0;
          color:#a52333;
        }

        .rp-paper {
          background:white;
          border:1px solid #cbd6df;
          padding:16px;
          box-shadow:0 5px 20px #12345612;
        }

        .rp-header {
          display:grid;
          grid-template-columns:1fr 2fr 1fr;
          align-items:center;
          gap:10px;
          padding:10px;
          text-align:center;
          border-top:5px solid #178d46;
          border-bottom:5px solid #0b2d63;
        }

        .rp-company {
          text-align:left;
          font-size:19px;
          font-weight:900;
          color:#0c2d60;
        }

        .rp-company span {
          color:#168f47;
        }

        .rp-header h1 {
          margin:0;
          font-size:30px;
          color:#0b2c61;
        }

        .rp-header h2 {
          margin:3px 0 6px;
          font-size:13px;
          color:#168844;
        }

        .rp-header small {
          display:block;
          padding:5px;
          background:#0b2c60;
          color:white;
        }

        .rp-emblem {
          width:63px;
          height:63px;
          justify-self:center;
          display:grid;
          place-items:center;
          border:3px solid #d6b351;
          border-radius:50%;
          text-align:center;
          font-weight:900;
          color:#0b2c60;
        }

        .rp-intro {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin:10px 0;
        }

        .rp-box {
          min-width:0;
          border:1px solid #a7b6c5;
          border-radius:5px;
          padding:9px;
        }

        .rp-section-title {
          display:inline-block;
          padding:5px 11px;
          background:#0b2c61;
          color:white;
          font-size:10px;
          font-weight:900;
          margin-bottom:6px;
        }

        .rp-info {
          display:grid;
          grid-template-columns:108px 1fr;
          gap:5px;
          line-height:1.5;
        }

        .rp-description {
          font-size:10px;
          line-height:1.55;
          margin:3px 0 6px;
        }

        .rp-section {
          margin:10px 0;
        }

        .rp-scroll {
          overflow-x:auto;
        }

        .rp-table {
          width:100%;
          border-collapse:collapse;
          table-layout:fixed;
          font-size:9px;
        }

        .rp-table th,
        .rp-table td {
          border:1px solid #c0ccd7;
          text-align:center;
          vertical-align:middle;
          padding:4px 3px;
          overflow-wrap:anywhere;
        }

        .rp-table th {
          background:#eaf0f6;
        }

        .rp-competency {
          width:100%;
          table-layout:fixed;
        }

        .rp-competency .rp-group {
          background:#0b2c61;
          color:white;
          font-size:8px;
          font-weight:900;
          line-height:1.15;
          padding:6px 2px;
          overflow-wrap:normal;
        }

        .rp-competency thead tr:nth-child(2) th {
          font-size:6px;
          padding:5px 1px;
          letter-spacing:-.2px;
          white-space:nowrap;
          word-break:normal;
          overflow-wrap:normal;
        }

        .rp-competency tbody td {
          font-size:7px;
          padding:5px 1px;
          white-space:nowrap;
          overflow-wrap:normal;
        }

        /* ==========================================
           TABEL PEMBELAJARAN & PRAKTIK RINGKAS
           ========================================== */

        .rp-compact-wrap {
          margin-bottom:6px;
        }

        .rp-compact-table {
          table-layout:fixed;
          font-size:8px;
        }

        .rp-compact-table th {
          padding:5px 3px;
          font-size:8px;
          font-weight:900;
          height:22px;
          background:#eaf0f6;
        }

        .rp-compact-table td {
          padding:3px 4px;
          height:23px;
          vertical-align:middle;
        }

        .rp-compact-site {
          width:48px;
        }

        .rp-site-value {
          font-weight:900;
          color:#0b2c61;
          background:#fafcfd;
        }

        .rp-compact-entry {
          display:flex;
          align-items:center;
          justify-content:center;
          flex-wrap:wrap;
          gap:3px 6px;
          line-height:1.25;
          min-height:14px;
        }

        .rp-compact-name {
          font-size:8px;
          overflow-wrap:anywhere;
        }

        .rp-compact-score {
          font-size:8px;
          color:#0b2c61;
          white-space:nowrap;
        }

        .rp-compact-empty {
          color:#8795a0;
          font-size:9px;
        }

        /* ==========================================
           VALIDASI SIMPER
           ========================================== */

        .rp-simper-table th {
          font-size:8px;
          font-weight:900;
          padding:6px 3px;
        }

        .rp-simper-table td {
          font-size:8px;
          padding:6px 4px;
          line-height:1.45;
        }

        .rp-simper-status {
          display:block;
          font-size:9px;
          font-weight:900;
          color:#0b2c61;
        }

        .rp-simper-detail {
          display:block;
          font-size:7px;
          color:#687b89;
          margin-top:3px;
          line-height:1.35;
        }

        .rp-simper-positive {
          color:#087a42;
        }

        .rp-simper-pending {
          color:#aa761a;
        }

        .rp-simper-summary {
          margin-top:6px;
          padding:7px 9px;
          border:1px solid #d8e5eb;
          background:#f7fafc;
          font-size:9px;
          line-height:1.5;
        }

        .rp-small {
          font-size:9px;
          color:#6d7e8c;
          line-height:1.4;
          margin:5px 0;
        }

        .rp-bottom {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          margin-top:10px;
        }

        .rp-notes {
          font-size:10px;
          line-height:1.45;
        }

        .rp-notes p {
          margin:4px 0 8px;
        }

        .rp-numbers {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:8px;
          margin:6px 0;
        }

        .rp-number {
          padding:9px;
          background:#f7fafc;
          border:1px solid #dbe5eb;
          text-align:center;
        }

        .rp-number span {
          display:block;
          font-size:9px;
        }

        .rp-number strong {
          display:block;
          margin-top:3px;
          font-size:22px;
          color:#0b2c60;
        }

        .rp-grade-row {
          display:flex;
          align-items:center;
          gap:11px;
          margin-top:7px;
        }

        .rp-grade {
          width:58px;
          height:58px;
          display:grid;
          place-items:center;
          border:3px solid #1b8f4b;
          border-radius:50%;
          color:#167b40;
          font-size:29px;
          font-weight:900;
          flex-shrink:0;
        }

        .rp-footer {
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:12px;
          margin-top:12px;
          font-size:9px;
          color:#697b8b;
        }

        .rp-signature {
          text-align:center;
          min-width:170px;
        }

        .rp-sign-space {
          height:30px;
        }

        @media(max-width:700px) {
          .rp-container {
            padding:8px;
          }

          .rp-controls {
            padding:12px;
          }

          .rp-modes {
            flex-direction:column;
            gap:10px;
          }

          .rp-custom {
            grid-template-columns:repeat(5,1fr);
          }

          .rp-paper {
            padding:8px;
          }

          .rp-header {
            grid-template-columns:1fr 2fr;
          }

          .rp-company {
            font-size:12px;
          }

          .rp-header h1 {
            font-size:22px;
          }

          .rp-header h2 {
            font-size:10px;
          }

          .rp-emblem {
            display:none;
          }

          .rp-intro,
          .rp-bottom {
            grid-template-columns:1fr;
          }

          .rp-info {
            grid-template-columns:90px 1fr;
          }

          .rp-competency {
            min-width:760px;
          }

          .rp-compact-table {
            min-width:490px;
          }

          .rp-actions .rp-btn {
            flex:1;
          }
        }

        @page {
          size:A4 landscape;
          margin:5mm;
        }

        @media print {
          html,
          body {
            margin:0!important;
            padding:0!important;
            background:white!important;
          }

          .rp-topbar,
          .rp-controls {
            display:none!important;
          }

          .rp-root {
            background:white!important;
            min-height:0!important;
            print-color-adjust:exact;
            -webkit-print-color-adjust:exact;
          }

          .rp-container {
            max-width:none!important;
            padding:0!important;
            margin:0!important;
          }

          .rp-paper {
            padding:0!important;
            border:0!important;
            box-shadow:none!important;
          }

          .rp-header {
            grid-template-columns:1fr 2fr 1fr!important;
            padding:5px 8px!important;
            border-top-width:3px!important;
            border-bottom-width:3px!important;
          }

          .rp-company {
            font-size:16px!important;
          }

          .rp-header h1 {
            font-size:25px!important;
          }

          .rp-header h2 {
            font-size:12px!important;
          }

          .rp-emblem {
            display:grid!important;
            width:49px!important;
            height:49px!important;
            font-size:9px!important;
          }

          .rp-intro {
            grid-template-columns:1fr 1fr!important;
            gap:7px!important;
            margin:6px 0!important;
          }

          .rp-box {
            padding:6px!important;
          }

          .rp-info {
            gap:3px!important;
            line-height:1.35!important;
            font-size:10px!important;
          }

          .rp-description {
            font-size:9px!important;
            line-height:1.35!important;
            margin:2px 0 5px!important;
          }

          .rp-section {
            margin:6px 0!important;
          }

          .rp-section-title {
            padding:4px 9px!important;
            margin-bottom:4px!important;
            font-size:9px!important;
          }

          .rp-scroll {
            overflow:visible!important;
          }

          .rp-table,
          .rp-competency,
          .rp-compact-table,
          .rp-simper-table {
            width:100%!important;
            min-width:0!important;
          }

          .rp-table th,
          .rp-table td {
            padding:3px 2px!important;
          }

          .rp-competency {
            table-layout:fixed!important;
          }

          .rp-competency .rp-group {
            font-size:7px!important;
            line-height:1.1!important;
            padding:5px 1px!important;
          }

          .rp-competency thead tr:nth-child(2) th {
            font-size:5.5px!important;
            letter-spacing:-.25px!important;
            padding:4px 0!important;
            white-space:nowrap!important;
          }

          .rp-competency tbody td {
            font-size:7px!important;
            padding:4px 1px!important;
            white-space:nowrap!important;
          }

          /* Ukuran tabel 2 dan 3 lebih ringkas
             mengikuti tabel kompetensi utama. */

          .rp-compact-table {
            font-size:7px!important;
            table-layout:fixed!important;
          }

          .rp-compact-table th {
            font-size:7px!important;
            padding:3px 2px!important;
            height:17px!important;
          }

          .rp-compact-table td {
            padding:2px 3px!important;
            height:17px!important;
          }

          .rp-compact-site {
            width:42px!important;
          }

          .rp-compact-entry {
            min-height:12px!important;
            gap:2px 4px!important;
            line-height:1.15!important;
          }

          .rp-compact-name,
          .rp-compact-score {
            font-size:7px!important;
          }

          .rp-simper-table th {
            font-size:7px!important;
            padding:4px 2px!important;
          }

          .rp-simper-table td {
            font-size:7px!important;
            padding:4px 3px!important;
          }

          .rp-simper-status {
            font-size:8px!important;
          }

          .rp-simper-detail {
            font-size:6.5px!important;
          }

          .rp-simper-summary {
            font-size:8px!important;
            padding:5px 7px!important;
            margin-top:4px!important;
          }

          .rp-small {
            font-size:8px!important;
            margin:3px 0!important;
          }

          .rp-bottom {
            grid-template-columns:1fr 1fr!important;
            gap:7px!important;
            margin-top:6px!important;
            break-inside:avoid!important;
            page-break-inside:avoid!important;
          }

          .rp-notes {
            font-size:9px!important;
            line-height:1.3!important;
          }

          .rp-notes p {
            margin:3px 0 5px!important;
          }

          .rp-numbers {
            gap:6px!important;
            margin:3px 0!important;
          }

          .rp-number {
            padding:6px!important;
          }

          .rp-number strong {
            font-size:18px!important;
          }

          .rp-grade-row {
            gap:8px!important;
            margin-top:4px!important;
          }

          .rp-grade {
            width:42px!important;
            height:42px!important;
            font-size:22px!important;
          }

          .rp-footer {
            margin-top:6px!important;
          }

          .rp-sign-space {
            height:17px!important;
          }

          .rp-compact-wrap,
          .rp-section-title {
            break-after:avoid;
          }

          .rp-compact-table tr,
          .rp-simper-table tr {
            break-inside:avoid;
            page-break-inside:avoid;
          }
        }
      `}</style>

      <header className="rp-topbar">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="rp-btn light"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="rp-container">
        <section className="rp-controls">
          <h2>
            Pengaturan Cetak Rapor OJT
          </h2>

          <p className="rp-muted">
            Pilih minggu yang ingin ditampilkan.
            Seluruh target dan penilaian mengikuti
            minggu yang dipilih.
          </p>

          <div className="rp-modes">
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "single"}
                onChange={() =>
                  setMode("single")
                }
              />
              Satu minggu
            </label>

            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "range"}
                onChange={() =>
                  setMode("range")
                }
              />
              Rentang minggu
            </label>

            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "custom"}
                onChange={() =>
                  setMode("custom")
                }
              />
              Minggu tertentu
            </label>
          </div>

          {mode === "single" && (
            <div className="rp-options">
              <div>
                <label className="rp-field-label">
                  Pilih Minggu
                </label>

                <WeekSelect
                  value={singleWeek}
                  onChange={setSingleWeek}
                />
              </div>
            </div>
          )}

          {mode === "range" && (
            <div className="rp-options">
              <div>
                <label className="rp-field-label">
                  Dari Minggu
                </label>

                <WeekSelect
                  value={fromWeek}
                  onChange={(week) => {
                    setFromWeek(week);

                    if (toWeek < week) {
                      setToWeek(week);
                    }
                  }}
                />
              </div>

              <div>
                <label className="rp-field-label">
                  Sampai Minggu
                </label>

                <WeekSelect
                  start={fromWeek}
                  value={toWeek}
                  onChange={setToWeek}
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="rp-custom">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, i) => i + 1
              ).map((week) => (
                <button
                  key={week}
                  type="button"
                  className={
                    "rp-week-btn " +
                    (
                      customWeeks.includes(week)
                        ? "active"
                        : ""
                    )
                  }
                  onClick={() =>
                    toggleCustomWeek(week)
                  }
                >
                  {pad(week)}
                </button>
              ))}
            </div>
          )}

          <p className="rp-muted">
            <strong>
              {selectedWeeks.length} minggu:
            </strong>{" "}
            {selectedLabel || "Belum dipilih"}
          </p>

          {error && (
            <p className="rp-error">
              {error}
            </p>
          )}

          <div className="rp-actions">
            <button
              type="button"
              className="rp-btn light"
              onClick={refreshData}
              disabled={refreshing}
            >
              {refreshing
                ? "Memuat..."
                : "Refresh Data"}
            </button>

            <button
              type="button"
              className="rp-btn blue"
              onClick={() =>
                setPreview((old) => !old)
              }
            >
              {preview
                ? "Sembunyikan Pratinjau"
                : "Tampilkan Pratinjau"}
            </button>

            <button
              type="button"
              className="rp-btn"
              onClick={printReport}
              disabled={
                refreshing ||
                selectedWeeks.length === 0
              }
            >
              Cetak / Simpan PDF
            </button>
          </div>

          <p className="rp-muted">
            Format A4 Landscape. Predikat A–D
            mengikuti acuan template rapor.
          </p>
        </section>

        {preview &&
          selectedWeeks.length > 0 && (
            <article className="rp-paper">
              <div className="rp-header">
                <div className="rp-company">
                  BERAU <span>COAL</span>
                </div>

                <div>
                  <h1>RAPOR OJT</h1>
                  <h2>
                    ON THE JOB TRAINING
                  </h2>

                  <small>
                    PT. BERAU COAL
                  </small>
                </div>

                <div className="rp-emblem">
                  OJT
                  <br />
                  TRAINING
                </div>
              </div>

              <div className="rp-intro">
                <section className="rp-box">
                  <SectionTitle>
                    DATA PESERTA
                  </SectionTitle>

                  <div className="rp-info">
                    <strong>Nama</strong>
                    <span>: {participantName}</span>

                    <strong>Site</strong>
                    <span>: {site}</span>

                    <strong>Jabatan</strong>
                    <span>: —</span>

                    <strong>Periode OJT</strong>
                    <span>
                      : {dateText(program.start_date)}
                      {" – "}
                      {dateText(program.end_date)}
                    </span>

                    <strong>Departemen</strong>
                    <span>: {department}</span>

                    <strong>Minggu Rapor</strong>
                    <span>: {selectedLabel}</span>
                  </div>
                </section>

                <section className="rp-box">
                  <SectionTitle>
                    KETERANGAN
                  </SectionTitle>

                  <p className="rp-description">
                    On The Job Training (OJT)
                    merupakan program pelatihan
                    kerja yang bertujuan untuk
                    meningkatkan kompetensi,
                    pengetahuan, keterampilan
                    serta sikap kerja peserta
                    melalui pengalaman langsung
                    di tempat kerja.
                  </p>

                  <p className="rp-description">
                    Penilaian ini dilakukan
                    untuk mengetahui pencapaian
                    peserta selama mengikuti
                    program OJT sesuai standar
                    yang ditetapkan perusahaan.
                  </p>
                </section>
              </div>

              {/* =====================================
                  1. KOMPETENSI UTAMA
                  ===================================== */}

              <section className="rp-section">
                <SectionTitle>
                  1. PENILAIAN KOMPETENSI UTAMA
                </SectionTitle>

                <div className="rp-scroll">
                  <table className="rp-table rp-competency">
                    <thead>
                      <tr>
                        <th rowSpan={2}>NO</th>

                        {TARGETS.map((target) => (
                          <th
                            key={target.key}
                            colSpan={3}
                            className="rp-group"
                            style={{
                              background: target.color,
                            }}
                          >
                            {target.title}
                          </th>
                        ))}
                      </tr>

                      <tr>
                        {TARGETS.map((target) => (
                          <React.Fragment key={target.key}>
                            <th>TARGET</th>
                            <th>PENCAPAIAN</th>
                            <th>PERSENTASE</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>1</td>

                        {report.summary.map((item) => (
                          <React.Fragment key={item.key}>
                            <td>
                              {fmt(item.totalTarget)}
                            </td>

                            <td>
                              {fmt(
                                item.realized,
                                item.key === "Fisik"
                                  ? 3
                                  : 0
                              )}
                            </td>

                            <td
                              style={{
                                color: item.achieved
                                  ? "#087a42"
                                  : "#c33942",
                                fontWeight: 900,
                              }}
                            >
                              {fmt(item.percentage, 2)}%
                            </td>
                          </React.Fragment>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="rp-small">
                  Target berdasarkan{" "}
                  {selectedWeeks.length} minggu.
                  Fisik menggunakan kilometer,
                  sedangkan kompetensi lainnya
                  menggunakan jumlah kegiatan
                  terverifikasi.
                </p>
              </section>

              {/* =====================================
                  2. PEMBELAJARAN MINGGUAN
                  FORMAT HORIZONTAL RINGKAS
                  ===================================== */}

              <section className="rp-section">
                <SectionTitle>
                  2. PENILAIAN PEMBELAJARAN MINGGUAN
                </SectionTitle>

                {chunks(report.weekly).map(
                  (weeks, index) => (
                    <CompactWeekTable
                      key={index}
                      weeks={weeks}
                      site={site}
                      type="theory"
                    />
                  )
                )}
              </section>

              {/* =====================================
                  3. PRAKTIK MINGGUAN
                  FORMAT HORIZONTAL RINGKAS
                  ===================================== */}

              <section className="rp-section">
                <SectionTitle>
                  3. PENILAIAN PRAKTIK MINGGUAN
                </SectionTitle>

                {chunks(report.weekly).map(
                  (weeks, index) => (
                    <CompactWeekTable
                      key={index}
                      weeks={weeks}
                      site={site}
                      type="practice"
                    />
                  )
                )}
              </section>

              {/* =====================================
                  4. VALIDASI & KETERANGAN
                  OTOMATIS DARI MONITORING SIMPER
                  ===================================== */}

              <section className="rp-section">
                <SectionTitle>
                  4. VALIDASI DAN KETERANGAN SIMPER
                </SectionTitle>

                <div className="rp-scroll">
                  <table className="rp-table rp-simper-table">
                    <thead>
                      <tr>
                        <th>NAMA PERSONIL</th>
                        <th>KMKOP</th>
                        <th>PRAKTIK</th>
                        <th>ORIENTASI AREA</th>
                        <th>PENERBITAN SIMPER</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>
                          <strong>
                            {participantName}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              "rp-simper-status " +
                              (
                                report.simper.kmkop
                                  ? "rp-simper-positive"
                                  : "rp-simper-pending"
                              )
                            }
                          >
                            {getComponentText(
                              report.simper.kmkopStatus,
                              "kmkop"
                            )}
                          </span>

                          <span className="rp-simper-detail">
                            Validasi:{" "}
                            {validationText(
                              report.simper.kmkopValidation
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              "rp-simper-status " +
                              (
                                report.simper.praktik
                                  ? "rp-simper-positive"
                                  : "rp-simper-pending"
                              )
                            }
                          >
                            {getComponentText(
                              report.simper.practiceStatus,
                              "practice"
                            )}
                          </span>

                          <span className="rp-simper-detail">
                            Validasi:{" "}
                            {validationText(
                              report.simper.practiceValidation
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              "rp-simper-status " +
                              (
                                report.simper.orientasi
                                  ? "rp-simper-positive"
                                  : "rp-simper-pending"
                              )
                            }
                          >
                            {getComponentText(
                              report.simper.orientationStatus,
                              "orientation"
                            )}
                          </span>

                          <span className="rp-simper-detail">
                            Tanggal:{" "}
                            {dateText(
                              report.simper.orientationDate
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              "rp-simper-status " +
                              (
                                report.simper.issued
                                  ? "rp-simper-positive"
                                  : "rp-simper-pending"
                              )
                            }
                          >
                            {issuanceText(
                              report.simper.issuanceStatus
                            )}
                          </span>

                          <span className="rp-simper-detail">
                            Tanggal:{" "}
                            {dateText(
                              report.simper.issuanceDate
                            )}
                          </span>

                          {report.simper.issuanceNumber && (
                            <span className="rp-simper-detail">
                              Nomor:{" "}
                              {report.simper.issuanceNumber}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rp-simper-summary">
                  <strong>
                    PROGRES SIMPER:{" "}
                    {report.simper.percentage}%
                  </strong>

                  {" · "}

                  {report.simper.completed} dari 3
                  persyaratan terpenuhi.

                  {" · "}

                  <strong>
                    Status Akhir:{" "}
                    {report.simper.passed
                      ? "LULUS"
                      : "BELUM LULUS"}
                  </strong>

                  {" · "}

                  <strong>
                    Penerbitan:{" "}
                    {issuanceText(
                      report.simper.issuanceStatus
                    )}
                  </strong>
                </div>

                <p className="rp-small">
                  Informasi ini diambil otomatis
                  dari data Monitoring SIMPER
                  terbaru yang tersimpan di Supabase.
                  Tiga persyaratan progres meliputi
                  KMKOP, Praktik, dan Orientasi Area.
                  Penerbitan SIMPER ditampilkan
                  terpisah dan tidak memengaruhi
                  persentase progres.
                </p>

                {report.simper.legacy && (
                  <p className="rp-small">
                    Status SIMPER lama ditemukan.
                    Metadata komponen atau validasi
                    belum lengkap sehingga perlu
                    diperiksa oleh Mentor.
                  </p>
                )}
              </section>

              {/* =====================================
                  CATATAN DAN RINGKASAN HASIL
                  LOGIKA ASLI DIPERTAHANKAN
                  ===================================== */}

              <div className="rp-bottom">
                <section className="rp-box">
                  <SectionTitle>
                    CATATAN
                  </SectionTitle>

                  <div className="rp-notes">
                    {report.incomplete.length > 0 ? (
                      <p>
                        Kompetensi yang belum
                        mencapai target periode
                        pilihan:{" "}
                        <strong>
                          {report.incomplete
                            .map((item) => item.title)
                            .join(", ")}
                        </strong>.
                      </p>
                    ) : (
                      <p>
                        Target enam kompetensi
                        utama pada periode pilihan
                        telah terpenuhi.
                      </p>
                    )}

                    <p>
                      Penilaian teori tercatat:{" "}
                      <strong>
                        {report.allTheory.length}
                      </strong>
                      . Penilaian praktik tercatat:{" "}
                      <strong>
                        {report.allPractices.length}
                      </strong>.
                    </p>

                    <p>
                      Data yang belum tercatat
                      tidak otomatis menunjukkan
                      kegagalan peserta.
                      Monitoring dan validasi
                      tetap diperlukan.
                    </p>
                  </div>
                </section>

                <section className="rp-box">
                  <SectionTitle>
                    RINGKASAN HASIL
                  </SectionTitle>

                  <div className="rp-numbers">
                    <div className="rp-number">
                      <span>
                        NILAI TOTAL
                      </span>

                      <strong>
                        {report.scoreCount
                          ? fmt(report.total, 2)
                          : "—"}
                      </strong>
                    </div>

                    <div className="rp-number">
                      <span>
                        NILAI RATA-RATA
                      </span>

                      <strong>
                        {fmt(report.average, 2)}
                      </strong>
                    </div>
                  </div>

                  <div className="rp-grade-row">
                    <div className="rp-grade">
                      {report.grade[0]}
                    </div>

                    <div>
                      <strong>
                        {report.grade[1]}
                      </strong>

                      <p className="rp-small">
                        KETERANGAN PREDIKAT
                      </p>

                      <p className="rp-small">
                        85–100 = A (Sangat Baik)
                        <br />
                        75–84,99 = B (Baik)
                        <br />
                        60–74,99 = C (Cukup)
                        <br />
                        Di bawah 60 = D (Kurang)
                      </p>
                    </div>
                  </div>

                  <p className="rp-small">
                    Nilai total dan rata-rata
                    dihitung dari nilai teori
                    dan praktik yang tersedia.
                    Predikat mengikuti acuan
                    template, bukan ketetapan
                    kelulusan resmi.
                  </p>
                </section>
              </div>

              <footer className="rp-footer">
                <div>
                  OJT MineTrack · PT Berau Coal
                  <br />
                  Tanggal cetak:{" "}
                  {new Date().toLocaleDateString(
                    "id-ID"
                  )}
                </div>

                <div className="rp-signature">
                  Mengetahui,
                  <br />
                  Mentor / Penanggung Jawab

                  <div className="rp-sign-space" />

                  __________________________
                  <br />

                  {role === "mentor"
                    ? profile.full_name ||
                      "Nama Mentor"
                    : "Nama Mentor"}
                </div>
              </footer>
            </article>
          )}
      </div>
    </main>
  );
}
