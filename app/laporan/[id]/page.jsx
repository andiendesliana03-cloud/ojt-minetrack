
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// RAPOR TERINTEGRASI — TEMPLATE 3
// EARTH TONE PROFESSIONAL
// A4 PORTRAIT | WEEK 01–25
// =====================================================

const TOTAL_WEEKS = 25;
const POSITION = "Junior OJT";

const TARGETS = [
  { key: "Fisik", label: "Fisik", target: 25, unit: "km" },
  { key: "Training", label: "Internal Training", target: 4, unit: "kegiatan" },
  { key: "Sosialisasi", label: "Sosialisasi", target: 3, unit: "kegiatan" },
  { key: "Orientasi Area", label: "Orientasi Area", target: 2, unit: "kegiatan" },
  { key: "Coaching", label: "Coaching", target: 1, unit: "kegiatan" },
  { key: "Hazard", label: "Hazard", target: 2, unit: "kegiatan" },
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

function gradeOf(score) {
  if (score === null) return ["—", "BELUM ADA NILAI"];
  if (score >= 85) return ["A", "SANGAT BAIK"];
  if (score >= 75) return ["B", "BAIK"];
  if (score >= 60) return ["C", "CUKUP"];
  return ["D", "KURANG"];
}

// =====================================================
// KALENDER GLOBAL — TIDAK BERUBAH
// =====================================================

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
  return GLOBAL_WEEKS.find(
    (item) => item.week === Number(week)
  );
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
    global.start > programStart
      ? global.start
      : programStart;

  const end =
    programEnd && programEnd < global.end
      ? programEnd
      : global.end;

  return start <= end ? { start, end } : null;
}

function defaultWeek(program) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const available = GLOBAL_WEEKS.filter((week) =>
    programWeekRange(week.week, program)
  );

  if (!available.length) return 1;

  const active = available.find((week) => {
    const range = programWeekRange(week.week, program);
    return today >= range.start && today <= range.end;
  });

  if (active) return active.week;

  const next = available.find(
    (week) => programWeekRange(week.week, program).start > today
  );

  return next
    ? next.week
    : available[available.length - 1].week;
}

// =====================================================
// SIMPER — PERHITUNGAN ASLI DIPERTAHANKAN
// =====================================================

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

  const kmkop =
    roleOf(record?.theory_status) === "passed";

  const praktik =
    roleOf(record?.practice_status) === "passed";

  const orientasi =
    roleOf(meta?.orientation_status) === "completed";

  const completed = [
    kmkop,
    praktik,
    orientasi,
  ].filter(Boolean).length;

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
    issuanceStatus:
      roleOf(meta?.issuance_status) || "not_issued",
    orientationDate: meta?.orientation_date || null,
    issuanceDate: record?.graduation_date || null,
    issuanceNumber: meta?.issuance_number || "",
    kmkopValidation:
      meta?.theory_validation_status ??
      meta?.kmkop_validation_status ??
      null,
    practiceValidation:
      meta?.practice_validation_status ?? null,
    legacy:
      !!record && !meta && record.status === "passed",
  };
}

function simperStatus(status, type) {
  const value = roleOf(status);

  if (type === "orientation") {
    if (value === "completed") return "SELESAI";
    if (value === "scheduled") return "DIJADWALKAN";
    if (
      value === "in_progress" ||
      value === "ongoing"
    ) {
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
  if (
    status === null ||
    status === undefined ||
    status === ""
  ) {
    return "Belum ada validasi";
  }

  const value = roleOf(status);

  if (
    ["validated", "verified", "approved", "completed"]
      .includes(value)
  ) {
    return "TERVALIDASI";
  }

  if (["pending", "waiting"].includes(value)) {
    return "MENUNGGU";
  }

  if (["rejected", "failed"].includes(value)) {
    return "BELUM TERVALIDASI";
  }

  return String(status)
    .replace(/_/g, " ")
    .toUpperCase();
}

// =====================================================
// AKSES — ASLI DIPERTAHANKAN
// =====================================================

async function verifyAccess(programId) {
  const {
    data: auth,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !auth?.user) {
    return { redirect: "/login" };
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

  if (!profile) {
    throw new Error("Profil akun tidak ditemukan.");
  }

  const role = roleOf(profile.role);

  const isParticipant =
    ["participant", "peserta"].includes(role);

  if (
    !isParticipant &&
    !["admin", "mentor"].includes(role)
  ) {
    throw new Error(
      "Anda tidak memiliki akses Rapor OJT."
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
      "Program OJT tidak ditemukan atau tidak dapat diakses."
    );
  }

  if (!parseDate(program.start_date)) {
    throw new Error("Tanggal mulai OJT tidak valid.");
  }

  if (isParticipant) {
    const [request, registration] =
      await Promise.all([
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
    ].some(
      (item) => roleOf(item.status) === "approved"
    );

    if (
      !approved &&
      program.legacy_access !== true
    ) {
      throw new Error(
        "Akses program peserta belum disetujui."
      );
    }
  }

  let mentorName = "";

  if (program.mentor_id) {
    const { data: mentor } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", program.mentor_id)
      .maybeSingle();

    mentorName =
      mentor?.full_name?.trim() || "";
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

// =====================================================
// DATABASE — QUERY ASLI DIPERTAHANKAN
// =====================================================

async function fetchReportData(programId) {
  const results = await Promise.all([
    supabase
      .from("achievement_types")
      .select("code,name"),

    supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,distance_km,status"
      )
      .eq("program_id", programId),

    supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes")
      .eq("program_id", programId),

    supabase
      .from("weekly_practice_scores")
      .select(
        "id,practice_date,practice_name,score"
      )
      .eq("program_id", programId),

    supabase
      .from("simper_records")
      .select(
        "id,theory_status,practice_status,status,notes,graduation_date,created_at"
      )
      .eq("program_id", programId)
      .order("created_at", {
        ascending: false,
      })
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

// =====================================================
// KOMPONEN TAMPILAN
// =====================================================

function Icon({ name, size = 18 }) {
  const paths = {
    report: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    print: (
      <>
        <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6zM18 12h.01" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    back: <path d="M19 12H5m6-6-6 6 6 6" />,
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
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
      {paths[name] || paths.report}
    </svg>
  );
}

function SectionTitle({ number, children }) {
  return (
    <div className="report-section-title">
      {number && (
        <span className="report-section-number">
          {number}
        </span>
      )}
      <strong>{children}</strong>
    </div>
  );
}

function WeekSelect({ weeks, value, onChange }) {
  return (
    <select
      className="report-select"
      value={value}
      onChange={(event) =>
        onChange(Number(event.target.value))
      }
    >
      {weeks.map((week) => (
        <option
          key={week.week}
          value={week.week}
        >
          {weekLabel(week.week)} ·{" "}
          {dateText(week.start)} –{" "}
          {dateText(week.end)}
        </option>
      ))}
    </select>
  );
}

function WeeklyTable({ weeks }) {
  return (
    <table className="report-week-table">
      <thead>
        <tr>
          <th>WEEK</th>
          <th>POST 1</th>
          <th>POST 2</th>
          <th>PRAKTIK</th>
        </tr>
      </thead>

      <tbody>
        {weeks.map((week) => {
          const theory = [...week.theory].sort(
            (a, b) =>
              String(a.test_date).localeCompare(
                String(b.test_date)
              ) ||
              String(a.id).localeCompare(String(b.id))
          );

          const practices = [...week.practices].sort(
            (a, b) =>
              String(a.practice_date).localeCompare(
                String(b.practice_date)
              ) ||
              String(a.id).localeCompare(String(b.id))
          );

          return (
            <tr key={week.week}>
              <td className="report-week-label">
                W{pad(week.week)}
              </td>
              <td>{fmt(theory[0]?.score, 2)}</td>
              <td>{fmt(theory[1]?.score, 2)}</td>
              <td>{fmt(practices[0]?.score, 2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SimperBox({
  label,
  status,
  positive,
  detail,
}) {
  return (
    <div className="report-simper-box">
      <strong>{label}</strong>
      <span
        className={
          positive
            ? "report-simper-good"
            : "report-simper-wait"
        }
      >
        {status}
      </span>
      <small>{detail}</small>
    </div>
  );
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

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

  // ===================================================
  // LOAD DATA + PARAMETER PUSAT RAPOR
  // ===================================================

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

        const available = GLOBAL_WEEKS.filter(
          (week) =>
            programWeekRange(
              week.week,
              access.program
            )
        ).map((week) => week.week);

        const initial = defaultWeek(access.program);

        const params = new URLSearchParams(
          window.location.search
        );

        const urlFrom = Number(
          params.get("weekFrom")
        );

        const urlTo = Number(
          params.get("weekTo")
        );

        const validRange =
          params.has("weekFrom") &&
          params.has("weekTo") &&
          Number.isInteger(urlFrom) &&
          Number.isInteger(urlTo) &&
          urlFrom >= 1 &&
          urlTo <= TOTAL_WEEKS &&
          urlFrom <= urlTo;

        if (validRange) {
          const overlapping = available.filter(
            (week) =>
              week >= urlFrom &&
              week <= urlTo
          );

          if (overlapping.length) {
            setMode("range");
            setFromWeek(overlapping[0]);
            setToWeek(
              overlapping[overlapping.length - 1]
            );
            setSingleWeek(overlapping[0]);
            setCustomWeeks(overlapping);
          } else {
            setMode("single");
            setSingleWeek(initial);
            setFromWeek(initial);
            setToWeek(initial);
            setCustomWeeks([initial]);
          }
        } else {
          setMode("single");
          setSingleWeek(initial);
          setFromWeek(initial);
          setToWeek(initial);
          setCustomWeeks([initial]);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat Rapor OJT."
          );
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
        throw new Error(
          "Akun berubah. Buka kembali halaman Rapor."
        );
      }

      const records = await fetchReportData(programId);

      setData({
        ...access,
        ...records,
      });
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memperbarui Rapor."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const availableWeeks = useMemo(() => {
    if (!data?.program) return [];

    return GLOBAL_WEEKS.filter(
      (week) =>
        programWeekRange(
          week.week,
          data.program
        )
    );
  }, [data]);

  const availableSet = useMemo(
    () =>
      new Set(
        availableWeeks.map((week) => week.week)
      ),
    [availableWeeks]
  );

  const selectedWeeks = useMemo(() => {
    let weeks = [];

    if (mode === "single") {
      weeks = [singleWeek];
    } else if (mode === "range") {
      weeks = Array.from(
        {
          length: Math.max(
            0,
            toWeek - fromWeek + 1
          ),
        },
        (_, index) => fromWeek + index
      );
    } else {
      weeks = [
        ...new Set(customWeeks),
      ].sort((a, b) => a - b);
    }

    return weeks.filter(
      (week) => availableSet.has(week)
    );
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

  // ===================================================
  // PERHITUNGAN ASLI — TIDAK DIUBAH
  // ===================================================

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

    const weekly = selectedWeeks.map(
      (weekNumber) => {
        const achievementRecords =
          data.achievements.filter(
            (item) =>
              globalWeekOf(item.activity_date) ===
              weekNumber
          );

        const competencies = TARGETS.map(
          (target) => {
            const code = findType(target.key);

            const matching = code
              ? achievementRecords.filter(
                  (item) =>
                    item.type_code === code
                )
              : [];

            const verified = matching.filter(
              (item) =>
                roleOf(item.status) ===
                "verified"
            );

            let realized = 0;

            if (target.key === "Fisik") {
              realized =
                verified.reduce(
                  (sum, item) =>
                    sum +
                    Math.round(
                      (number(item.distance_km) ?? 0) *
                        1000
                    ),
                  0
                ) / 1000;
            } else {
              realized = verified.length;
            }

            return {
              ...target,
              realized,
              percentage: percent(
                realized,
                target.target
              ),
              achieved:
                realized >= target.target,
            };
          }
        );

        return {
          week: weekNumber,
          competencies,
          theory: data.theory.filter(
            (item) =>
              globalWeekOf(item.test_date) ===
              weekNumber
          ),
          practices: data.practices.filter(
            (item) =>
              globalWeekOf(item.practice_date) ===
              weekNumber
          ),
        };
      }
    );

    const summary = TARGETS.map((target) => {
      const entries = weekly
        .map((week) =>
          week.competencies.find(
            (item) => item.key === target.key
          )
        )
        .filter(Boolean);

      let realized;

      if (target.key === "Fisik") {
        realized =
          entries.reduce(
            (sum, item) =>
              sum +
              Math.round(
                item.realized * 1000
              ),
            0
          ) / 1000;
      } else {
        realized = entries.reduce(
          (sum, item) =>
            sum + item.realized,
          0
        );
      }

      return {
        ...target,
        realized,
        totalTarget:
          target.target * selectedWeeks.length,
        percentage: average(
          entries.map(
            (item) => item.percentage
          )
        ),
        achieved:
          entries.length > 0 &&
          entries.every(
            (item) => item.achieved
          ),
      };
    });

    const allTheory = weekly.flatMap(
      (week) => week.theory
    );

    const allPractices = weekly.flatMap(
      (week) => week.practices
    );

    const scores = [
      ...allTheory,
      ...allPractices,
    ]
      .map((item) => number(item.score))
      .filter((item) => item !== null);

    const totalScore = scores.reduce(
      (sum, item) => sum + item,
      0
    );

    const avgScore = scores.length
      ? totalScore / scores.length
      : null;

    const competencyAverage = average(
      summary.map(
        (item) => item.percentage
      )
    );

    return {
      weekly,
      summary,
      allTheory,
      allPractices,
      scoreCount: scores.length,
      totalScore,
      avgScore,
      grade: gradeOf(avgScore),
      competencyAverage,
      incomplete: summary.filter(
        (item) => !item.achieved
      ),
      simper: calculateSimper(data.simper),
    };
  }, [data, selectedWeeks]);

  // ===================================================
  // LOADING & ERROR
  // ===================================================

  if (loading) {
    return (
      <main className="report-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="report-loading">
        <h2>
          Rapor Tidak Dapat Ditampilkan
        </h2>

        <p>
          {error || "Data tidak tersedia."}
        </p>

        <button
          onClick={() => router.back()}
        >
          Kembali
        </button>
      </main>
    );
  }

  const {
    program,
    profile,
    mentorName,
  } = data;

  const participant = Array.isArray(
    program.peserta
  )
    ? program.peserta[0]
    : program.peserta;

  const participantName =
    participant?.full_name?.trim() ||
    "Peserta OJT";

  const site = program.site || "—";

  const department =
    participant?.department || "—";

  const accountRole = roleOf(
    profile.role
  );

  const isManager = [
    "admin",
    "mentor",
  ].includes(accountRole);

  const selectedLabel =
    selectedWeeks.length === 1
      ? weekLabel(selectedWeeks[0])
      : selectedWeeks.length
        ? `Week ${pad(selectedWeeks[0])} – ${pad(
            selectedWeeks[selectedWeeks.length - 1]
          )}`
        : "Belum dipilih";

  const ranges = selectedWeeks.map(
    (week) => {
      const global = weekByNumber(week);

      const participantRange =
        programWeekRange(week, program);

      return {
        week,
        start:
          participantRange?.start ||
          global?.start,
        end:
          participantRange?.end ||
          global?.end,
      };
    }
  );

  const periodStart = ranges[0]?.start;
  const periodEnd =
    ranges[ranges.length - 1]?.end;

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  const splitIndex = Math.ceil(
    report.weekly.length / 2
  );

  const leftWeeks =
    report.weekly.slice(0, splitIndex);

  const rightWeeks =
    report.weekly.slice(splitIndex);

  const targetTheory =
    selectedWeeks.length * 2;

  const targetPractice =
    selectedWeeks.length;

  return (
    <main className="report-root">
      <style>{css}</style>

      {/* NAVIGASI APLIKASI */}

      <header className="report-topbar">
        <div className="report-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="report-account">
          <small>
            {accountRole === "admin"
              ? "Administrator"
              : accountRole === "mentor"
                ? "Mentor OJT"
                : "Peserta OJT"}
          </small>

          <strong>
            {profile.full_name || "Pengguna"}
          </strong>
        </div>

        <button
          type="button"
          onClick={() => router.push(backPath)}
          className="report-back"
        >
          <Icon name="back" size={17} />
          Kembali
        </button>
      </header>

      <div className="report-container">

        {/* PENGATURAN RAPOR */}

        <section className="report-controls">
          <div className="report-control-head">
            <div>
              <span className="report-control-kicker">
                OJT MINETRACK · REPORT GENERATOR
              </span>

              <h2>Pengaturan Rapor OJT</h2>

              <p>
                Pilih periode penilaian dan cetak
                dengan Template 3 Earth Tone Professional.
              </p>
            </div>

            <span className="report-template-tag">
              TEMPLATE 3 · A4 PORTRAIT
            </span>
          </div>

          <div className="report-modes">
            {[
              ["single", "Satu Minggu"],
              ["range", "Rentang Minggu"],
              ["custom", "Minggu Tertentu"],
            ].map(([key, label]) => (
              <label
                key={key}
                className={
                  mode === key ? "chosen" : ""
                }
              >
                <input
                  type="radio"
                  name="reportMode"
                  checked={mode === key}
                  onChange={() => setMode(key)}
                />
                {label}
              </label>
            ))}
          </div>

          {mode === "single" &&
            availableWeeks.length > 0 && (
              <div className="report-selectors">
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

          {mode === "range" &&
            availableWeeks.length > 0 && (
              <div className="report-selectors">
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
                      (week) =>
                        week.week >= fromWeek
                    )}
                    value={toWeek}
                    onChange={setToWeek}
                  />
                </div>
              </div>
            )}

          {mode === "custom" && (
            <div className="report-week-picker">
              {GLOBAL_WEEKS.map((week) => (
                <button
                  key={week.week}
                  type="button"
                  disabled={
                    !availableSet.has(week.week)
                  }
                  className={
                    customWeeks.includes(week.week)
                      ? "selected"
                      : ""
                  }
                  onClick={() =>
                    toggleCustomWeek(week.week)
                  }
                >
                  {pad(week.week)}
                </button>
              ))}
            </div>
          )}

          <div className="report-selected">
            <strong>
              {selectedWeeks.length} Minggu Dipilih
            </strong>

            <span>{selectedLabel}</span>

            {selectedWeeks.length > 0 && (
              <small>
                {dateText(periodStart)}
                {" – "}
                {dateText(periodEnd)}
              </small>
            )}
          </div>

          <div className="report-quick-picks">
            {[
              [2, "2 Minggu"],
              [12, "12 Minggu"],
              [25, "25 Minggu"],
            ].map(([count, label]) => (
              <button
                type="button"
                key={count}
                onClick={() => {
                  const available = availableWeeks
                    .map((week) => week.week)
                    .filter(
                      (week) =>
                        week >= 1 &&
                        week <= count
                    );

                  if (!available.length) return;

                  setMode("range");
                  setFromWeek(available[0]);
                  setToWeek(
                    available[
                      available.length - 1
                    ]
                  );
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {error && (
            <div
              className="report-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="report-actions">
            <button
              type="button"
              className="secondary"
              onClick={refresh}
              disabled={refreshing}
            >
              <Icon name="refresh" size={17} />
              {refreshing
                ? "Memuat..."
                : "Refresh Data"}
            </button>

            <button
              type="button"
              className="secondary"
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
              className="primary"
              disabled={
                !selectedWeeks.length ||
                refreshing
              }
              onClick={() => window.print()}
            >
              <Icon name="print" size={18} />
              Cetak / Simpan PDF
            </button>
          </div>
        </section>

        {/* DOKUMEN RAPOR */}

        {selectedWeeks.length > 0 && (
          <article
            className={
              "report-paper " +
              (!preview
                ? "report-preview-hidden"
                : "")
            }
          >
            {/* HEADER */}

            <header className="report-document-header">
              <div className="report-header-top">
                <div className="report-company">
                  <strong>
                    BERAU<span>COAL</span>
                  </strong>
                  <small>PT BERAU COAL</small>
                </div>

                <div className="report-document-title">
                  <small>
                    EMERGENCY RESPONSE GROUP
                  </small>
                  <h1>RAPOR OJT</h1>
                  <p>
                    ON THE JOB TRAINING · JUNIOR OJT
                  </p>
                </div>

                <div className="report-header-mark">
                  <Icon name="shield" size={26} />
                  <span>OJT</span>
                </div>
              </div>

              <div className="report-header-strip">
                <span>MINETRACK V2.0</span>
                <span>PERIODE {selectedLabel.toUpperCase()}</span>
                <span>2026–2027</span>
              </div>
            </header>

            {/* IDENTITAS */}

            <section className="report-identity-section">
              <SectionTitle number="01">
                DATA PESERTA
              </SectionTitle>

              <div className="report-identity-grid">
                <div>
                  <span>Nama Peserta</span>
                  <strong>{participantName}</strong>
                </div>

                <div>
                  <span>Jabatan</span>
                  <strong>{POSITION}</strong>
                </div>

                <div>
                  <span>Departemen</span>
                  <strong>{department}</strong>
                </div>

                <div>
                  <span>Site Penempatan</span>
                  <strong>{site}</strong>
                </div>

                <div>
                  <span>Periode Program</span>
                  <strong>
                    {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </strong>
                </div>

                <div>
                  <span>Periode Rapor</span>
                  <strong>
                    {dateText(periodStart)}
                    {" – "}
                    {dateText(periodEnd)}
                  </strong>
                </div>
              </div>
            </section>

            {/* RINGKASAN NILAI */}

            <div className="report-summary-strip">
              <div>
                <span>RATA-RATA KOMPETENSI</span>
                <strong>
                  {fmt(
                    report.competencyAverage,
                    2
                  )}%
                </strong>
              </div>

              <div>
                <span>RATA-RATA NILAI</span>
                <strong>
                  {fmt(report.avgScore, 2)}
                </strong>
              </div>

              <div>
                <span>PREDIKAT</span>
                <strong>
                  {report.grade[0]}
                  {" · "}
                  {report.grade[1]}
                </strong>
              </div>
            </div>

            {/* KOMPETENSI */}

            <section className="report-section">
              <SectionTitle number="02">
                PENILAIAN KOMPETENSI UTAMA
              </SectionTitle>

              <table className="report-competency-table">
                <thead>
                  <tr>
                    <th>NO</th>
                    <th>KOMPETENSI</th>
                    <th>TARGET</th>
                    <th>REALISASI</th>
                    <th>CAPAIAN</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {report.summary.map(
                    (item, index) => (
                      <tr key={item.key}>
                        <td>{index + 1}</td>

                        <td>
                          <strong>
                            {item.label}
                          </strong>
                        </td>

                        <td>
                          {fmt(
                            item.totalTarget,
                            item.key === "Fisik"
                              ? 2
                              : 0
                          )}
                        </td>

                        <td>
                          {fmt(
                            item.realized,
                            item.key === "Fisik"
                              ? 3
                              : 0
                          )}
                        </td>

                        <td>
                          <div className="report-progress">
                            <div
                              style={{
                                width:
                                  `${item.percentage}%`,
                              }}
                            />
                          </div>

                          <span>
                            {fmt(
                              item.percentage,
                              1
                            )}%
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              item.achieved
                                ? "report-status good"
                                : "report-status pending"
                            }
                          >
                            {item.achieved
                              ? "TERCAPAI"
                              : "BELUM TERCAPAI"}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </section>

            {/* PENILAIAN MINGGUAN */}

            <section className="report-section">
              <SectionTitle number="03">
                PENILAIAN PEMBELAJARAN DAN PRAKTIK MINGGUAN
              </SectionTitle>

              <div className="report-week-heading">
                <span>
                  2 Post-Test + 1 Praktik per Minggu
                </span>

                <strong>
                  {selectedWeeks.length} Minggu
                </strong>
              </div>

              <div className="report-week-columns">
                <div>
                  <WeeklyTable weeks={leftWeeks} />
                </div>

                <div>
                  {rightWeeks.length > 0 ? (
                    <WeeklyTable weeks={rightWeeks} />
                  ) : (
                    <div className="report-week-empty">
                      Ringkasan Penilaian
                    </div>
                  )}
                </div>
              </div>

              <div className="report-week-footer">
                <span>
                  Post-Test:{" "}
                  <strong>
                    {report.allTheory.length}
                    /{targetTheory}
                  </strong>
                </span>

                <span>
                  Praktik:{" "}
                  <strong>
                    {report.allPractices.length}
                    /{targetPractice}
                  </strong>
                </span>

                <span>
                  Total Nilai:{" "}
                  <strong>
                    {report.scoreCount
                      ? fmt(
                          report.totalScore,
                          2
                        )
                      : "—"}
                  </strong>
                </span>

                <span>
                  Rata-Rata:{" "}
                  <strong>
                    {fmt(
                      report.avgScore,
                      2
                    )}
                  </strong>
                </span>
              </div>
            </section>

            {/* SIMPER */}

            <section className="report-section">
              <SectionTitle number="04">
                VALIDASI DAN STATUS SIMPER
              </SectionTitle>

              <div className="report-simper-grid">
                <SimperBox
                  label="KMKOP"
                  status={simperStatus(
                    report.simper.kmkopStatus,
                    "kmkop"
                  )}
                  positive={report.simper.kmkop}
                  detail={validationText(
                    report.simper.kmkopValidation
                  )}
                />

                <SimperBox
                  label="PRAKTIK"
                  status={simperStatus(
                    report.simper.practiceStatus,
                    "practice"
                  )}
                  positive={report.simper.praktik}
                  detail={validationText(
                    report.simper.practiceValidation
                  )}
                />

                <SimperBox
                  label="ORIENTASI AREA"
                  status={simperStatus(
                    report.simper.orientationStatus,
                    "orientation"
                  )}
                  positive={report.simper.orientasi}
                  detail={dateText(
                    report.simper.orientationDate
                  )}
                />

                <SimperBox
                  label="PENERBITAN"
                  status={issuanceText(
                    report.simper.issuanceStatus
                  )}
                  positive={
                    report.simper.issuanceStatus ===
                    "issued"
                  }
                  detail={dateText(
                    report.simper.issuanceDate
                  )}
                />
              </div>

              <div className="report-simper-summary">
                <span>
                  Progres SIMPER:{" "}
                  <strong>
                    {report.simper.percentage}%
                  </strong>
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
              </div>
            </section>

            {/* EVALUASI */}

            <section className="report-section report-evaluation">
              <SectionTitle number="05">
                CATATAN EVALUASI
              </SectionTitle>

              <p>
                {report.incomplete.length
                  ? (
                    <>
                      Kompetensi yang belum mencapai
                      target pada seluruh minggu pilihan:{" "}
                      <strong>
                        {report.incomplete
                          .map(
                            (item) => item.label
                          )
                          .join(", ")}
                      </strong>.
                    </>
                  )
                  : (
                    "Seluruh kompetensi utama mencapai target pada setiap minggu yang dipilih."
                  )}
              </p>

              <p>
                Nilai Post-Test dan Praktik dihitung
                berdasarkan data aktual yang tersedia.
                Nilai yang belum tercatat ditampilkan
                sebagai tanda (—), bukan dianggap nol.
              </p>

              <p>
                Predikat nilai merupakan ringkasan
                hasil teori dan praktik, bukan keputusan
                kelulusan resmi.
              </p>
            </section>

            {/* PENGESAHAN */}

            <footer className="report-document-footer">
              <div className="report-footer-meta">
                <strong>
                  OJT MineTrack v2.0
                </strong>

                <span>
                  Emergency Response Group · PT Berau Coal
                </span>

                <span>
                  Tanggal Cetak: {currentDate()}
                </span>
              </div>

              <div className="report-signature">
                <span>Mengetahui,</span>

                <strong>
                  Mentor / Penanggung Jawab
                </strong>

                <div className="report-sign-space" />

                <div className="report-sign-name">
                  {mentorName || "Mentor OJT"}
                </div>
              </div>
            </footer>

            <div className="report-bottom-line" />
          </article>
        )}
      </div>
    </main>
  );
}

// =====================================================
// CSS — TEMPLATE 3 EARTH TONE PROFESSIONAL
// =====================================================

const css = `
:root {
  --r-navy: #203d4a;
  --r-deep: #152e37;
  --r-earth: #ac8050;
  --r-gold: #c99a5f;
  --r-cream: #f7f1e7;
  --r-paper: #fffdf9;
  --r-green: #227b5a;
  --r-border: #ded9ce;
}

.report-root,
.report-root * {
  box-sizing: border-box;
}

.report-root {
  min-height: 100vh;
  background: #edf1f1;
  color: #263c44;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.report-root button,
.report-root select {
  font-family: inherit;
}

.report-root button {
  cursor: pointer;
}

.report-root button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* NAVIGATION */

.report-topbar {
  display: flex;
  align-items: center;
  gap: 17px;
  min-height: 65px;
  padding: 13px 23px;
  background: #193943;
  color: #fff;
}

.report-brand {
  font-size: 21px;
  font-weight: 900;
  white-space: nowrap;
}

.report-brand span {
  color: #69d5a5;
}

.report-brand small {
  margin-left: 6px;
  font-size: 10px;
  color: #b3d1c4;
}

.report-account {
  margin-left: auto;
  text-align: right;
}

.report-account small {
  display: block;
  color: #b6d0ca;
  font-size: 10px;
}

.report-account strong {
  display: block;
  margin-top: 5px;
  font-size: 12px;
}

.report-back {
  display: flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #ffffff55;
  border-radius: 8px;
  padding: 10px 13px;
  background: #ffffff14;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
}

/* CONTAINER */

.report-container {
  max-width: 1250px;
  margin: auto;
  padding: 20px;
}

/* CONTROLS */

.report-controls {
  padding: 20px;
  margin-bottom: 20px;
  background: white;
  border: 1px solid #dce5e5;
  border-radius: 13px;
  box-shadow: 0 5px 19px #1738470b;
}

.report-control-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.report-control-kicker {
  font-size: 10px;
  font-weight: 900;
  color: #ad824e;
  letter-spacing: 1px;
}

.report-controls h2 {
  margin: 9px 0;
  font-size: 22px;
}

.report-controls p {
  margin: 0;
  color: #788a8d;
  font-size: 12px;
  line-height: 1.7;
}

.report-template-tag {
  padding: 9px 12px;
  border: 1px solid #e9d5b5;
  border-radius: 20px;
  background: #fff8eb;
  color: #986e35;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.report-modes {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin: 21px 0 17px;
}

.report-modes label {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 13px;
  border: 1px solid #e0e6e5;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.report-modes label.chosen {
  border-color: #c79a62;
  background: #fcf5e9;
  color: #99703e;
}

.report-modes input {
  accent-color: #ac8050;
}

.report-selectors {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 13px;
  max-width: 850px;
}

.report-selectors label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 800;
}

.report-select {
  width: 100%;
  min-height: 43px;
  padding: 10px 12px;
  border: 1px solid #d7e0df;
  border-radius: 9px;
  background: #fff;
  color: #29454b;
  font-size: 12px;
}

.report-week-picker {
  display: grid;
  grid-template-columns: repeat(13,minmax(0,1fr));
  gap: 7px;
}

.report-week-picker button {
  min-height: 38px;
  border: 1px solid #dfded8;
  border-radius: 7px;
  background: #fff;
  color: #3b5356;
}

.report-week-picker button.selected {
  background: #ab8052;
  border-color: #ab8052;
  color: #fff;
  font-weight: 900;
}

.report-selected {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
  padding: 12px 14px;
  border: 1px solid #e8dbc6;
  border-radius: 9px;
  background: #fcf7ed;
}

.report-selected strong {
  color: #91683b;
}

.report-selected span {
  color: #4e645f;
}

.report-selected small {
  color: #8a897d;
}

.report-quick-picks {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.report-quick-picks button {
  padding: 8px 12px;
  border: 1px solid #dfd1bd;
  border-radius: 7px;
  background: #fffaf2;
  color: #92703f;
  font-size: 11px;
  font-weight: 800;
}

.report-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.report-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 43px;
  padding: 11px 14px;
  border: 0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 850;
}

.report-actions .secondary {
  background: #eaf0ee;
  color: #315b53;
}

.report-actions .primary {
  background: #a67d4e;
  color: white;
}

.report-error {
  padding: 12px;
  margin-top: 13px;
  background: #fff0f0;
  border-radius: 8px;
  color: #b12c2c;
}

/* PAPER */

.report-paper {
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  margin: 0 auto;
  padding: 9mm;
  background: var(--r-paper);
  color: #263c44;
  box-shadow: 0 10px 30px #1738471e;
}

.report-preview-hidden {
  display: none;
}

/* DOCUMENT HEADER */

.report-document-header {
  background: #fffdf9;
}

.report-header-top {
  display: grid;
  grid-template-columns: 1fr 1.7fr .45fr;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
}

.report-company strong {
  display: block;
  font-size: 22px;
  color: #204051;
  letter-spacing: -1px;
  white-space: nowrap;
}

.report-company strong span {
  color: #308354;
}

.report-company small {
  display: block;
  margin-top: 5px;
  color: #917b5e;
  font-size: 9px;
  letter-spacing: 1px;
}

.report-document-title {
  text-align: center;
}

.report-document-title small {
  display: block;
  color: #a47a49;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .9px;
}

.report-document-title h1 {
  margin: 4px 0;
  color: #193b4b;
  font-size: 26px;
  font-weight: 900;
}

.report-document-title p {
  margin: 0;
  font-size: 9px;
  color: #8e744f;
  font-weight: 800;
}

.report-header-mark {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 8px;
  border: 2px solid #c39a63;
  border-radius: 10px;
  color: #9e7646;
}

.report-header-mark span {
  font-size: 10px;
  font-weight: 900;
}

.report-header-strip {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 12px;
  background: #244553;
  color: white;
  font-size: 9px;
  font-weight: 800;
  border-bottom: 4px solid #c79a61;
}

/* SECTION */

.report-section {
  margin-top: 14px;
}

.report-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 7px;
  border-bottom: 1px solid #d8c6aa;
  color: #244553;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: .3px;
}

.report-section-number {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  border-radius: 5px;
  background: #b58a55;
  color: white;
  font-size: 10px;
}

.report-identity-section {
  margin-top: 15px;
}

.report-identity-grid {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 6px 13px;
}

.report-identity-grid > div {
  display: grid;
  grid-template-columns: 100px minmax(0,1fr);
  gap: 7px;
  padding: 6px 8px;
  background: #f9f5ed;
  border: 1px solid #e8e0d3;
  border-radius: 4px;
  font-size: 10px;
}

.report-identity-grid span {
  color: #8d7f6b;
}

.report-identity-grid strong {
  overflow-wrap: anywhere;
}

/* SUMMARY STRIP */

.report-summary-strip {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 8px;
  margin-top: 14px;
}

.report-summary-strip > div {
  padding: 11px;
  border-radius: 6px;
  background: #f3eadb;
  border: 1px solid #e4d2b5;
  text-align: center;
}

.report-summary-strip span {
  display: block;
  font-size: 9px;
  font-weight: 800;
  color: #91744d;
}

.report-summary-strip strong {
  display: block;
  margin-top: 5px;
  color: #294a4a;
  font-size: 17px;
}

/* COMPETENCY */

.report-competency-table,
.report-week-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.report-competency-table th,
.report-competency-table td,
.report-week-table th,
.report-week-table td {
  border: 1px solid #ddd9d1;
  padding: 7px 6px;
  text-align: center;
  font-size: 9px;
}

.report-competency-table th,
.report-week-table th {
  background: #e8eee9;
  color: #37564e;
  font-size: 9px;
  font-weight: 900;
}

.report-competency-table td:nth-child(2) {
  text-align: left;
}

.report-competency-table th:nth-child(1) {
  width: 7%;
}

.report-competency-table th:nth-child(2) {
  width: 30%;
}

.report-competency-table th:nth-child(3),
.report-competency-table th:nth-child(4) {
  width: 13%;
}

.report-competency-table th:nth-child(5) {
  width: 20%;
}

.report-competency-table th:nth-child(6) {
  width: 17%;
}

.report-progress {
  height: 6px;
  overflow: hidden;
  border-radius: 20px;
  background: #e4e8e5;
}

.report-progress > div {
  height: 100%;
  background: #4b9c75;
}

.report-competency-table td:nth-child(5) span {
  display: block;
  margin-top: 3px;
  font-size: 8px;
}

.report-status {
  display: inline-block;
  padding: 5px 6px;
  border-radius: 5px;
  font-size: 8px;
  font-weight: 900;
}

.report-status.good {
  background: #e1f2e7;
  color: #227a53;
}

.report-status.pending {
  background: #fff0df;
  color: #a77536;
}

/* WEEKLY */

.report-week-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  color: #8b7757;
  font-size: 9px;
}

.report-week-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: start;
}

.report-week-table th,
.report-week-table td {
  padding: 5px 4px;
  font-size: 9px;
}

.report-week-table tbody tr:nth-child(even) {
  background: #faf7f0;
}

.report-week-label {
  color: #9b7549;
  font-weight: 900;
}

.report-week-empty {
  display: grid;
  place-items: center;
  min-height: 70px;
  color: #b3a38c;
  border: 1px dashed #dfd3bd;
  font-size: 11px;
}

.report-week-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 9px;
  padding: 9px;
  background: #f7f1e6;
  color: #83745e;
  font-size: 9px;
}

.report-week-footer strong {
  color: #304c47;
}

/* SIMPER */

.report-simper-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 7px;
}

.report-simper-box {
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 0;
  padding: 10px 5px;
  border: 1px solid #e2d9cb;
  border-radius: 5px;
  background: #faf8f3;
  text-align: center;
}

.report-simper-box > strong {
  font-size: 9px;
  color: #4c645b;
}

.report-simper-box > span {
  font-size: 10px;
  font-weight: 900;
}

.report-simper-good {
  color: #25845a;
}

.report-simper-wait {
  color: #ae7d3d;
}

.report-simper-box small {
  font-size: 8px;
  color: #998b77;
  overflow-wrap: anywhere;
}

.report-simper-summary {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 9px;
  padding: 9px;
  background: #edf4ec;
  font-size: 9px;
  color: #69806f;
}

.report-simper-summary strong {
  color: #2c7255;
}

/* EVALUATION */

.report-evaluation p {
  margin: 5px 0;
  color: #65756d;
  font-size: 10px;
  line-height: 1.6;
}

/* FOOTER */

.report-document-footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.report-footer-meta {
  display: grid;
  gap: 5px;
  color: #8b968d;
  font-size: 9px;
}

.report-footer-meta strong {
  color: #315348;
}

.report-signature {
  width: 210px;
  text-align: center;
  font-size: 10px;
}

.report-signature > span,
.report-signature > strong {
  display: block;
}

.report-signature > strong {
  margin-top: 5px;
}

.report-sign-space {
  height: 35px;
}

.report-sign-name {
  padding-top: 6px;
  border-top: 1px solid #9c9d91;
  font-size: 10px;
  font-weight: 900;
}

.report-bottom-line {
  height: 5px;
  margin-top: 13px;
  background: linear-gradient(
    90deg,
    #254b4e 75%,
    #b58c56 75%
  );
}

.report-loading {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 25px;
  background: #f1f4f3;
  font-family: Arial, Helvetica, sans-serif;
  color: #28464a;
  text-align: center;
}

/* RESPONSIVE SCREEN */

@media(max-width:800px) {
  .report-container {
    padding: 12px;
  }

  .report-control-head {
    flex-direction: column;
  }

  .report-modes {
    flex-direction: column;
  }

  .report-selectors {
    grid-template-columns: 1fr;
  }

  .report-week-picker {
    grid-template-columns: repeat(5,1fr);
  }

  .report-paper {
    width: 100%;
    min-height: 0;
    padding: 12px;
  }

  .report-header-top {
    grid-template-columns: 1fr 1.7fr;
  }

  .report-header-mark {
    display: none;
  }

  .report-company strong {
    font-size: 15px;
  }

  .report-document-title h1 {
    font-size: 19px;
  }

  .report-identity-grid {
    grid-template-columns: 1fr;
  }

  .report-identity-grid > div {
    grid-template-columns: 110px 1fr;
  }

  .report-summary-strip strong {
    font-size: 14px;
  }

  .report-competency-table th,
  .report-competency-table td {
    padding: 5px 3px;
    font-size: 8px;
  }

  .report-status {
    font-size: 7px;
  }

  .report-week-columns {
    gap: 5px;
  }

  .report-week-table th,
  .report-week-table td {
    padding: 5px 2px;
    font-size: 8px;
  }

  .report-simper-grid {
    grid-template-columns: repeat(2,1fr);
  }
}

/* A4 PORTRAIT PRINT */

@page {
  size: A4 portrait;
  margin: 0;
}

@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  .report-root {
    min-height: 0 !important;
    background: white !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .report-topbar,
  .report-controls {
    display: none !important;
  }

  .report-container {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .report-paper,
  .report-preview-hidden {
    display: block !important;
    width: 210mm !important;
    max-width: none !important;
    min-height: 297mm !important;
    padding: 8mm !important;
    margin: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  .report-header-top {
    grid-template-columns: 1fr 1.7fr .45fr !important;
    padding-bottom: 7px !important;
  }

  .report-company strong {
    font-size: 17px !important;
  }

  .report-document-title h1 {
    font-size: 22px !important;
  }

  .report-header-mark {
    display: grid !important;
  }

  .report-header-strip {
    padding: 6px 9px !important;
    font-size: 8px !important;
  }

  .report-section,
  .report-identity-section {
    margin-top: 10px !important;
  }

  .report-section-title {
    margin-bottom: 6px !important;
    padding-bottom: 4px !important;
    font-size: 9px !important;
  }

  .report-section-number {
    width: 19px !important;
    height: 19px !important;
    font-size: 9px !important;
  }

  .report-identity-grid {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 4px 8px !important;
  }

  .report-identity-grid > div {
    grid-template-columns: 82px minmax(0,1fr) !important;
    padding: 4px 6px !important;
    font-size: 8px !important;
  }

  .report-summary-strip {
    margin-top: 9px !important;
    gap: 6px !important;
  }

  .report-summary-strip > div {
    padding: 7px !important;
  }

  .report-summary-strip span {
    font-size: 8px !important;
  }

  .report-summary-strip strong {
    margin-top: 3px !important;
    font-size: 14px !important;
  }

  .report-competency-table th,
  .report-competency-table td {
    padding: 4px 3px !important;
    font-size: 8px !important;
  }

  .report-status {
    padding: 3px !important;
    font-size: 7px !important;
  }

  .report-week-heading {
    margin-bottom: 5px !important;
    font-size: 8px !important;
  }

  .report-week-columns {
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
  }

  .report-week-table th,
  .report-week-table td {
    padding: 3px 2px !important;
    font-size: 7.5px !important;
    height: 17px !important;
  }

  .report-week-footer {
    margin-top: 5px !important;
    padding: 6px !important;
    font-size: 8px !important;
  }

  .report-simper-grid {
    grid-template-columns: repeat(4,minmax(0,1fr)) !important;
    gap: 5px !important;
  }

  .report-simper-box {
    padding: 6px 3px !important;
    gap: 4px !important;
  }

  .report-simper-box strong,
  .report-simper-box span {
    font-size: 8px !important;
  }

  .report-simper-box small {
    font-size: 7px !important;
  }

  .report-simper-summary {
    margin-top: 5px !important;
    padding: 5px !important;
    font-size: 8px !important;
  }

  .report-evaluation p {
    margin: 3px 0 !important;
    font-size: 8px !important;
    line-height: 1.35 !important;
  }

  .report-document-footer {
    margin-top: 10px !important;
  }

  .report-footer-meta,
  .report-signature {
    font-size: 8px !important;
  }

  .report-signature {
    width: 170px !important;
  }

  .report-sign-space {
    height: 24px !important;
  }

  .report-bottom-line {
    margin-top: 8px !important;
  }

  .report-identity-section,
  .report-summary-strip,
  .report-section,
  .report-document-footer {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .report-week-table tr,
  .report-simper-box {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;
