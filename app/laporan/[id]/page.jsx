
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// RAPOR OJT TERINTEGRASI
// TEMPLATE 3 — EARTH TONE PROFESSIONAL
// A4 PORTRAIT | WEEK 01–25
//
// DIPERTAHANKAN:
// - Akses Admin, Mentor, Peserta
// - Query Supabase
// - Rumus Achievement
// - Rumus Post-Test dan Praktik
// - Validasi SIMPER
// - Kalender Global 25 Minggu
//
// TIDAK MENAMPILKAN SAMAPTA
// ======================================================

const TOTAL_WEEKS = 25;
const POSITION = "Junior OJT";

const TARGETS = [
  {
    key: "Fisik",
    label: "Fisik",
    target: 25,
    unit: "km",
  },
  {
    key: "Training",
    label: "Internal Training",
    target: 4,
    unit: "kegiatan",
  },
  {
    key: "Sosialisasi",
    label: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
  },
  {
    key: "Orientasi Area",
    label: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
  },
  {
    key: "Coaching",
    label: "Coaching",
    target: 1,
    unit: "kegiatan",
  },
  {
    key: "Hazard",
    label: "Hazard",
    target: 2,
    unit: "kegiatan",
  },
];

const SIMPER_START = "[[SIMPER_V2]]";
const SIMPER_END = "[[/SIMPER_V2]]";

// ======================================================
// HELPERS
// ======================================================

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

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const item = (type) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${item("year")}-${item("month")}-${item("day")}`;
}

function average(items) {
  if (!items.length) return 0;

  return items.reduce(
    (sum, value) => sum + value,
    0
  ) / items.length;
}

function percent(realized, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (realized / target) * 100)
  );
}

function gradeOf(score) {
  if (score === null) {
    return ["—", "BELUM ADA NILAI"];
  }

  if (score >= 85) return ["A", "SANGAT BAIK"];
  if (score >= 75) return ["B", "BAIK"];
  if (score >= 60) return ["C", "CUKUP"];

  return ["D", "KURANG"];
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
      (week) =>
        date >= week.start &&
        date <= week.end
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

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const programStart =
    String(program.start_date).slice(0, 10);

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

  return start <= end
    ? { start, end }
    : null;
}

function defaultWeek(program) {
  const today = todayISO();

  const available = GLOBAL_WEEKS.filter(
    (week) =>
      programWeekRange(week.week, program)
  );

  if (!available.length) return 1;

  const active = available.find((week) => {
    const range = programWeekRange(
      week.week,
      program
    );

    return (
      today >= range.start &&
      today <= range.end
    );
  });

  if (active) return active.week;

  const next = available.find((week) => {
    const range = programWeekRange(
      week.week,
      program
    );

    return range.start > today;
  });

  return next
    ? next.week
    : available[available.length - 1].week;
}

// ======================================================
// SIMPER
// ======================================================

function parseSimper(notes) {
  const text = String(notes ?? "");

  const start = text.lastIndexOf(SIMPER_START);
  const end = text.lastIndexOf(SIMPER_END);

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const meta = JSON.parse(
      text.slice(
        start + SIMPER_START.length,
        end
      )
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
    roleOf(meta?.orientation_status) ===
    "completed";

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

    percentage: [
      0,
      33,
      67,
      100,
    ][completed],

    passed: completed === 3,

    kmkopStatus:
      record?.theory_status || null,

    practiceStatus:
      record?.practice_status || null,

    orientationStatus:
      meta?.orientation_status || null,

    issuanceStatus:
      roleOf(meta?.issuance_status) ||
      "not_issued",

    orientationDate:
      meta?.orientation_date || null,

    issuanceDate:
      record?.graduation_date || null,

    issuanceNumber:
      meta?.issuance_number || "",

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
    [
      "validated",
      "verified",
      "approved",
      "completed",
    ].includes(value)
  ) {
    return "TERVALIDASI";
  }

  if (
    ["pending", "waiting"].includes(value)
  ) {
    return "MENUNGGU";
  }

  if (
    ["rejected", "failed"].includes(value)
  ) {
    return "BELUM TERVALIDASI";
  }

  return String(status)
    .replace(/_/g, " ")
    .toUpperCase();
}

// ======================================================
// VERIFIKASI AKSES
// ======================================================

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

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error(
      "Profil akun tidak ditemukan."
    );
  }

  const role = roleOf(profile.role);

  const isParticipant = [
    "participant",
    "peserta",
  ].includes(role);

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

  if (programError) {
    throw programError;
  }

  if (!program) {
    throw new Error(
      "Program OJT tidak ditemukan atau tidak dapat diakses."
    );
  }

  if (!parseDate(program.start_date)) {
    throw new Error(
      "Tanggal mulai OJT tidak valid."
    );
  }

  if (isParticipant) {
    const [
      request,
      registration,
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

    if (request.error) {
      throw request.error;
    }

    if (registration.error) {
      throw registration.error;
    }

    const approved = [
      ...(request.data || []),
      ...(registration.data || []),
    ].some(
      (item) =>
        roleOf(item.status) === "approved"
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
    mentorName =
      profile.full_name || "";
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
      .select(
        "id,type_code,activity_date,distance_km,status"
      )
      .eq("program_id", programId),

    supabase
      .from("post_test_scores")
      .select(
        "id,test_date,score,notes"
      )
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

  for (
    let index = 0;
    index < results.length;
    index++
  ) {
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
// KOMPONEN
// ======================================================

function Icon({ name, size = 18 }) {
  const paths = {
    print: (
      <>
        <path d="M6 9V3h12v6" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v7H6z" />
      </>
    ),
    back: (
      <path d="M19 12H5m6-6-6 6 6 6" />
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
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
      {paths[name] || paths.shield}
    </svg>
  );
}

function SectionTitle({ number, title }) {
  return (
    <div className="r3-section-title">
      <span>{number}</span>
      <strong>{title}</strong>
    </div>
  );
}

function WeekSelect({ weeks, value, onChange }) {
  return (
    <select
      className="r3-select"
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
          {dateText(week.start)}
          {" – "}
          {dateText(week.end)}
        </option>
      ))}
    </select>
  );
}

function orderByDate(items, field) {
  return [...items].sort(
    (a, b) =>
      String(a[field] ?? "").localeCompare(
        String(b[field] ?? "")
      ) ||
      String(a.id ?? "").localeCompare(
        String(b.id ?? "")
      )
  );
}

function WeeklyTable({ weeks }) {
  return (
    <table className="r3-week-table">
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
          const theory = orderByDate(
            week.theory,
            "test_date"
          );

          const practices = orderByDate(
            week.practices,
            "practice_date"
          );

          return (
            <tr key={week.week}>
              <td className="r3-week-number">
                W{pad(week.week)}
              </td>

              <td>
                {fmt(theory[0]?.score, 2)}
              </td>

              <td>
                {fmt(theory[1]?.score, 2)}
              </td>

              <td>
                {fmt(practices[0]?.score, 2)}
              </td>
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
    <div className="r3-simper-item">
      <strong>{label}</strong>

      <span
        className={
          positive
            ? "r3-positive"
            : "r3-warning"
        }
      >
        {status}
      </span>

      <small>{detail}</small>
    </div>
  );
}

// ======================================================
// HALAMAN RAPOR
// ======================================================

export default function RaporOJTPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const urlWeekFrom = searchParams.get("weekFrom");
  const urlWeekTo = searchParams.get("weekTo");

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
  // MEMUAT DATA
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
        const access = await verifyAccess(
          programId
        );

        if (!active) return;

        if (access.redirect) {
          router.replace(access.redirect);
          return;
        }

        const records = await fetchReportData(
          programId
        );

        if (!active) return;

        setData({
          ...access,
          ...records,
        });

        const available = GLOBAL_WEEKS
          .filter((week) =>
            programWeekRange(
              week.week,
              access.program
            )
          )
          .map((week) => week.week);

        const initial = defaultWeek(
          access.program
        );

        const urlFrom = Number(urlWeekFrom);
        const urlTo = Number(urlWeekTo);

        const validRange =
          urlWeekFrom !== null &&
          urlWeekTo !== null &&
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
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [
    programId,
    router,
    urlWeekFrom,
    urlWeekTo,
  ]);

  async function refresh() {
    if (
      refreshing ||
      !programId ||
      !data
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess(
        programId
      );

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

      const records = await fetchReportData(
        programId
      );

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

  // ===================================================
  // PEMILIHAN MINGGU
  // ===================================================

  const availableWeeks = useMemo(() => {
    if (!data?.program) return [];

    return GLOBAL_WEEKS.filter((week) =>
      programWeekRange(
        week.week,
        data.program
      )
    );
  }, [data]);

  const availableSet = useMemo(
    () =>
      new Set(
        availableWeeks.map(
          (week) => week.week
        )
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
        ? old.filter(
            (value) => value !== week
          )
        : [...old, week]
    );
  }

  function changeFromWeek(week) {
    setFromWeek(week);

    if (toWeek < week) {
      setToWeek(week);
    }
  }

  function quickSelect(count) {
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
      available[available.length - 1]
    );
  }

  // ===================================================
  // PERHITUNGAN PENILAIAN — RUMUS LAMA
  // ===================================================

  const report = useMemo(() => {
    if (!data) return null;

    const typeMap = new Map();

    data.types.forEach((type) => {
      typeMap.set(
        norm(type.code),
        type.code
      );

      typeMap.set(
        norm(type.name),
        type.code
      );
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
              globalWeekOf(
                item.activity_date
              ) === weekNumber
          );

        const competencies = TARGETS.map(
          (target) => {
            const code = findType(
              target.key
            );

            const matching = code
              ? achievementRecords.filter(
                  (item) =>
                    item.type_code === code
                )
              : [];

            const verified =
              matching.filter(
                (item) =>
                  roleOf(
                    item.status
                  ) === "verified"
              );

            let realized = 0;

            if (
              target.key === "Fisik"
            ) {
              realized =
                verified.reduce(
                  (sum, item) =>
                    sum +
                    Math.round(
                      (
                        number(
                          item.distance_km
                        ) ?? 0
                      ) * 1000
                    ),
                  0
                ) / 1000;
            } else {
              realized =
                verified.length;
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
              globalWeekOf(
                item.test_date
              ) === weekNumber
          ),

          practices:
            data.practices.filter(
              (item) =>
                globalWeekOf(
                  item.practice_date
                ) === weekNumber
            ),
        };
      }
    );

    const summary = TARGETS.map(
      (target) => {
        const entries = weekly
          .map((week) =>
            week.competencies.find(
              (item) =>
                item.key === target.key
            )
          )
          .filter(Boolean);

        let realized;

        if (
          target.key === "Fisik"
        ) {
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
            target.target *
            selectedWeeks.length,

          percentage: average(
            entries.map(
              (item) =>
                item.percentage
            )
          ),

          achieved:
            entries.length > 0 &&
            entries.every(
              (item) =>
                item.achieved
            ),
        };
      }
    );

    const allTheory =
      weekly.flatMap(
        (week) =>
          week.theory
      );

    const allPractices =
      weekly.flatMap(
        (week) =>
          week.practices
      );

    const scores = [
      ...allTheory,
      ...allPractices,
    ]
      .map(
        (item) =>
          number(item.score)
      )
      .filter(
        (item) =>
          item !== null
      );

    const totalScore =
      scores.reduce(
        (sum, item) =>
          sum + item,
        0
      );

    const avgScore =
      scores.length
        ? totalScore /
          scores.length
        : null;

    const competencyAverage =
      average(
        summary.map(
          (item) =>
            item.percentage
        )
      );

    return {
      weekly,
      summary,
      allTheory,
      allPractices,

      scoreCount:
        scores.length,

      totalScore,
      avgScore,

      grade:
        gradeOf(avgScore),

      competencyAverage,

      incomplete:
        summary.filter(
          (item) =>
            !item.achieved
        ),

      simper:
        calculateSimper(
          data.simper
        ),
    };
  }, [
    data,
    selectedWeeks,
  ]);

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <main className="r3-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="r3-loading">
        <h2>
          Rapor Tidak Dapat Ditampilkan
        </h2>

        <p>
          {error ||
            "Data tidak tersedia."}
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

  const {
    program,
    profile,
    mentorName,
  } = data;

  const participant =
    Array.isArray(
      program.peserta
    )
      ? program.peserta[0]
      : program.peserta;

  const participantName =
    participant?.full_name?.trim() ||
    "Peserta OJT";

  const department =
    participant?.department ||
    "—";

  const site =
    program.site || "—";

  const accountRole =
    roleOf(profile.role);

  const isManager =
    ["admin", "mentor"].includes(
      accountRole
    );

  const selectedLabel =
    selectedWeeks.length === 0
      ? "Belum dipilih"
      : selectedWeeks.length === 1
      ? weekLabel(
          selectedWeeks[0]
        )
      : `Week ${pad(
          selectedWeeks[0]
        )} – ${pad(
          selectedWeeks[
            selectedWeeks.length - 1
          ]
        )}`;

  const ranges =
    selectedWeeks.map(
      (week) => {
        const global =
          weekByNumber(week);

        const participantRange =
          programWeekRange(
            week,
            program
          );

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

  const periodStart =
    ranges[0]?.start;

  const periodEnd =
    ranges[
      ranges.length - 1
    ]?.end;

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  const splitIndex =
    Math.ceil(
      report.weekly.length / 2
    );

  const leftWeeks =
    report.weekly.slice(
      0,
      splitIndex
    );

  const rightWeeks =
    report.weekly.slice(
      splitIndex
    );

  const targetTheory =
    selectedWeeks.length * 2;

  const targetPractice =
    selectedWeeks.length;

  const fullReport =
    selectedWeeks.length >= 20;

  const densityClass =
    fullReport
      ? "r3-density-full"
      : selectedWeeks.length >= 10
      ? "r3-density-medium"
      : "r3-density-short";

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <main className="r3-root">
      <style>{css}</style>

      {/* TOPBAR */}

      <header className="r3-topbar">
        <div className="r3-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="r3-account">
          <small>
            {accountRole === "admin"
              ? "Administrator"
              : accountRole === "mentor"
              ? "Mentor OJT"
              : "Peserta OJT"}
          </small>

          <strong>
            {profile.full_name ||
              "Pengguna"}
          </strong>
        </div>

        <button
          type="button"
          className="r3-back"
          onClick={() =>
            router.push(backPath)
          }
        >
          <Icon
            name="back"
            size={17}
          />
          Kembali
        </button>
      </header>

      <div className="r3-container">

        {/* PENGATURAN */}

        <section className="r3-controls">
          <div className="r3-controls-heading">
            <div>
              <small>
                OJT MINETRACK · REPORT GENERATOR
              </small>

              <h2>
                Pengaturan Rapor OJT
              </h2>

              <p>
                Pilih minggu penilaian.
                Dokumen akan mengikuti format
                A4 Portrait Template 3.
              </p>
            </div>

            <span className="r3-template-tag">
              TEMPLATE 3 · A4 PORTRAIT
            </span>
          </div>

          <div className="r3-modes">
            {[
              [
                "single",
                "Satu Minggu",
              ],
              [
                "range",
                "Rentang Minggu",
              ],
              [
                "custom",
                "Minggu Tertentu",
              ],
            ].map(
              ([key, label]) => (
                <label
                  key={key}
                  className={
                    mode === key
                      ? "chosen"
                      : ""
                  }
                >
                  <input
                    type="radio"
                    name="reportMode"
                    checked={
                      mode === key
                    }
                    onChange={() =>
                      setMode(key)
                    }
                  />

                  {label}
                </label>
              )
            )}
          </div>

          {mode === "single" &&
            availableWeeks.length > 0 && (
              <div className="r3-selectors">
                <div>
                  <label>
                    Pilih Minggu
                  </label>

                  <WeekSelect
                    weeks={
                      availableWeeks
                    }
                    value={
                      singleWeek
                    }
                    onChange={
                      setSingleWeek
                    }
                  />
                </div>
              </div>
            )}

          {mode === "range" &&
            availableWeeks.length > 0 && (
              <div className="r3-selectors">
                <div>
                  <label>
                    Dari Minggu
                  </label>

                  <WeekSelect
                    weeks={
                      availableWeeks
                    }
                    value={
                      fromWeek
                    }
                    onChange={
                      changeFromWeek
                    }
                  />
                </div>

                <div>
                  <label>
                    Sampai Minggu
                  </label>

                  <WeekSelect
                    weeks={
                      availableWeeks.filter(
                        (week) =>
                          week.week >=
                          fromWeek
                      )
                    }
                    value={
                      toWeek
                    }
                    onChange={
                      setToWeek
                    }
                  />
                </div>
              </div>
            )}

          {mode === "custom" && (
            <div className="r3-week-picker">
              {GLOBAL_WEEKS.map(
                (week) => (
                  <button
                    type="button"
                    key={
                      week.week
                    }
                    disabled={
                      !availableSet.has(
                        week.week
                      )
                    }
                    className={
                      customWeeks.includes(
                        week.week
                      )
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      toggleCustomWeek(
                        week.week
                      )
                    }
                  >
                    {pad(
                      week.week
                    )}
                  </button>
                )
              )}
            </div>
          )}

          <div className="r3-quick">
            <span>
              Pilihan cepat:
            </span>

            <button
              type="button"
              onClick={() =>
                quickSelect(2)
              }
            >
              2 Minggu
            </button>

            <button
              type="button"
              onClick={() =>
                quickSelect(12)
              }
            >
              12 Minggu
            </button>

            <button
              type="button"
              onClick={() =>
                quickSelect(25)
              }
            >
              25 Minggu
            </button>
          </div>

          <div className="r3-selected">
            <strong>
              {
                selectedWeeks.length
              }{" "}
              Minggu Dipilih
            </strong>

            <span>
              {
                selectedLabel
              }
            </span>

            {selectedWeeks.length > 0 && (
              <small>
                {dateText(
                  periodStart
                )}
                {" – "}
                {dateText(
                  periodEnd
                )}
              </small>
            )}
          </div>

          {error && (
            <div
              className="r3-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="r3-actions">
            <button
              type="button"
              className="secondary"
              disabled={
                refreshing
              }
              onClick={
                refresh
              }
            >
              <Icon
                name="refresh"
              />

              {refreshing
                ? "Memuat..."
                : "Refresh Data"}
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() =>
                setPreview(
                  (old) => !old
                )
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
              onClick={() =>
                window.print()
              }
            >
              <Icon
                name="print"
              />

              Cetak / Simpan PDF
            </button>
          </div>
        </section>

        {/* DOKUMEN */}

        {selectedWeeks.length > 0 && (
          <article
            className={
              `r3-paper ${densityClass} ` +
              (!preview
                ? "r3-preview-hidden"
                : "")
            }
          >
            {/* HEADER */}

            <header className="r3-document-header">
              <div className="r3-header-main">
                <div className="r3-company">
                  <strong>
                    BERAU
                    <span>
                      COAL
                    </span>
                  </strong>

                  <small>
                    PT BERAU COAL
                  </small>
                </div>

                <div className="r3-title">
                  <small>
                    EMERGENCY RESPONSE GROUP
                  </small>

                  <h1>
                    RAPOR OJT
                  </h1>

                  <p>
                    ON THE JOB TRAINING
                  </p>
                </div>

                <div className="r3-seal">
                  <Icon
                    name="shield"
                    size={24}
                  />
                  <strong>
                    OJT
                  </strong>
                </div>
              </div>

              <div className="r3-header-band">
                <span>
                  MINETRACK V2.0
                </span>

                <span>
                  {
                    selectedLabel.toUpperCase()
                  }
                </span>

                <span>
                  PROGRAM 2026–2027
                </span>
              </div>
            </header>

            {/* IDENTITAS */}

            <section className="r3-section">
              <SectionTitle
                number="01"
                title="DATA PESERTA OJT"
              />

              <div className="r3-identity">
                <div>
                  <span>
                    Nama Peserta
                  </span>
                  <strong>
                    {
                      participantName
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Jabatan
                  </span>
                  <strong>
                    {POSITION}
                  </strong>
                </div>

                <div>
                  <span>
                    Departemen
                  </span>
                  <strong>
                    {department}
                  </strong>
                </div>

                <div>
                  <span>
                    Site
                  </span>
                  <strong>
                    {site}
                  </strong>
                </div>

                <div>
                  <span>
                    Periode OJT
                  </span>
                  <strong>
                    {dateText(
                      program.start_date
                    )}
                    {" – "}
                    {dateText(
                      program.end_date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Periode Rapor
                  </span>
                  <strong>
                    {dateText(
                      periodStart
                    )}
                    {" – "}
                    {dateText(
                      periodEnd
                    )}
                  </strong>
                </div>
              </div>
            </section>

            {/* KPI */}

            <div className="r3-kpis">
              <div>
                <span>
                  RATA-RATA KOMPETENSI
                </span>

                <strong>
                  {fmt(
                    report.competencyAverage,
                    2
                  )}%
                </strong>
              </div>

              <div>
                <span>
                  RATA-RATA NILAI
                </span>

                <strong>
                  {fmt(
                    report.avgScore,
                    2
                  )}
                </strong>
              </div>

              <div>
                <span>
                  PREDIKAT
                </span>

                <strong>
                  {report.grade[0]}
                  {" · "}
                  {
                    report.grade[1]
                  }
                </strong>
              </div>
            </div>

            {/* KOMPETENSI */}

            <section className="r3-section">
              <SectionTitle
                number="02"
                title="PENILAIAN KOMPETENSI UTAMA"
              />

              <table className="r3-competency-table">
                <thead>
                  <tr>
                    <th>
                      NO
                    </th>
                    <th>
                      KOMPETENSI
                    </th>
                    <th>
                      TARGET
                    </th>
                    <th>
                      REALISASI
                    </th>
                    <th>
                      CAPAIAN
                    </th>
                    <th>
                      STATUS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {report.summary.map(
                    (item, index) => (
                      <tr
                        key={
                          item.key
                        }
                      >
                        <td>
                          {index + 1}
                        </td>

                        <td>
                          <strong>
                            {
                              item.label
                            }
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
                          <div className="r3-progress">
                            <div
                              style={{
                                width:
                                  `${item.percentage}%`,
                              }}
                            />
                          </div>

                          <small>
                            {fmt(
                              item.percentage,
                              1
                            )}%
                          </small>
                        </td>

                        <td>
                          <span
                            className={
                              item.achieved
                                ? "r3-achieved"
                                : "r3-incomplete"
                            }
                          >
                            {item.achieved
                              ? "TERCAPAI"
                              : "BELUM"}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </section>

            {/* TABEL WEEK 01–25 */}

            <section className="r3-section">
              <SectionTitle
                number="03"
                title="PENILAIAN PEMBELAJARAN & PRAKTIK MINGGUAN"
              />

              <div className="r3-week-heading">
                <span>
                  2 Post-Test dan 1 Praktik
                  per minggu
                </span>

                <strong>
                  {
                    selectedWeeks.length
                  }{" "}
                  Minggu
                </strong>
              </div>

              <div className="r3-week-grid">
                <div>
                  <WeeklyTable
                    weeks={
                      leftWeeks
                    }
                  />
                </div>

                <div>
                  {rightWeeks.length ? (
                    <WeeklyTable
                      weeks={
                        rightWeeks
                      }
                    />
                  ) : (
                    <div className="r3-week-placeholder">
                      Ringkasan
                      Penilaian
                    </div>
                  )}
                </div>
              </div>

              <div className="r3-week-summary">
                <span>
                  Post-Test:{" "}
                  <strong>
                    {
                      report.allTheory.length
                    }
                    /
                    {
                      targetTheory
                    }
                  </strong>
                </span>

                <span>
                  Praktik:{" "}
                  <strong>
                    {
                      report.allPractices.length
                    }
                    /
                    {
                      targetPractice
                    }
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

            <section className="r3-section">
              <SectionTitle
                number="04"
                title="VALIDASI DAN STATUS SIMPER"
              />

              <div className="r3-simper-grid">
                <SimperBox
                  label="KMKOP"
                  status={simperStatus(
                    report.simper.kmkopStatus,
                    "kmkop"
                  )}
                  positive={
                    report.simper.kmkop
                  }
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
                  positive={
                    report.simper.praktik
                  }
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
                  positive={
                    report.simper.orientasi
                  }
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

              <div className="r3-simper-summary">
                <span>
                  Progres SIMPER:{" "}
                  <strong>
                    {
                      report.simper.percentage
                    }%
                  </strong>
                </span>

                <span>
                  Persyaratan:{" "}
                  <strong>
                    {
                      report.simper.completed
                    }/3
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
                    {issuanceText(
                      report.simper.issuanceStatus
                    )}
                  </strong>
                </span>
              </div>

              {report.simper.legacy && (
                <p className="r3-small-note">
                  Data SIMPER lama terdeteksi.
                  Validasi komponen perlu diperiksa.
                </p>
              )}

              {report.simper.issuanceNumber && (
                <p className="r3-small-note">
                  Nomor SIMPER:{" "}
                  {
                    report.simper.issuanceNumber
                  }
                </p>
              )}
            </section>

            {/* EVALUASI */}

            <section className="r3-section">
              <SectionTitle
                number="05"
                title="CATATAN EVALUASI"
              />

              <div className="r3-evaluation">
                <p>
                  {report.incomplete.length ? (
                    <>
                      Kompetensi yang belum
                      mencapai target pada seluruh
                      minggu pilihan:{" "}
                      <strong>
                        {report.incomplete
                          .map(
                            (item) =>
                              item.label
                          )
                          .join(", ")}
                      </strong>.
                    </>
                  ) : (
                    "Seluruh kompetensi utama mencapai target pada setiap minggu yang dipilih."
                  )}
                </p>

                <p>
                  Penilaian yang belum tercatat
                  ditampilkan sebagai (—).
                  Rata-rata dihitung dari nilai
                  teori dan praktik yang tersedia.
                </p>

                <p>
                  Predikat merupakan alat bantu
                  evaluasi, bukan penetapan
                  kelulusan resmi.
                </p>
              </div>
            </section>

            {/* PENGESAHAN */}

            <footer className="r3-footer">
              <div className="r3-footer-info">
                <strong>
                  OJT MineTrack v2.0
                </strong>

                <span>
                  Emergency Response Group
                  · PT Berau Coal
                </span>

                <span>
                  Tanggal Cetak:
                  {" "}
                  {
                    currentDate()
                  }
                </span>
              </div>

              <div className="r3-signature">
                <span>
                  Mengetahui,
                </span>

                <strong>
                  Mentor / Penanggung Jawab
                </strong>

                <div className="r3-sign-space" />

                <div className="r3-sign-name">
                  {
                    mentorName ||
                    "Mentor OJT"
                  }
                </div>
              </div>
            </footer>

            <div className="r3-bottom-accent" />
          </article>
        )}
      </div>
    </main>
  );
}

// ======================================================
// CSS TEMPLATE 3
// ======================================================

const css = `
:root {
  --r3-navy: #28454d;
  --r3-dark: #17363d;
  --r3-earth: #a87d4d;
  --r3-gold: #c79a62;
  --r3-cream: #f8f3e9;
  --r3-green: #287a59;
  --r3-border: #e3ddd2;
}

.r3-root,
.r3-root * {
  box-sizing: border-box;
}

.r3-root {
  min-height: 100vh;
  background: #edf1f1;
  color: #2e4547;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.r3-root button,
.r3-root select {
  font-family: inherit;
}

.r3-root button {
  cursor: pointer;
}

.r3-root button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

/* NAVBAR */

.r3-topbar {
  min-height: 66px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 13px 24px;
  background: #183a42;
  color: white;
}

.r3-brand {
  font-size: 21px;
  font-weight: 900;
}

.r3-brand span {
  color: #66d7a3;
}

.r3-brand small {
  margin-left: 7px;
  color: #a4c9bb;
  font-size: 10px;
}

.r3-account {
  margin-left: auto;
  text-align: right;
}

.r3-account small {
  display: block;
  color: #bed6cc;
  font-size: 10px;
}

.r3-account strong {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.r3-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #ffffff40;
  border-radius: 8px;
  background: #ffffff12;
  color: white;
  font-weight: 800;
}

/* CONTAINER */

.r3-container {
  max-width: 1320px;
  margin: auto;
  padding: 20px;
}

/* CONTROLS */

.r3-controls {
  margin-bottom: 20px;
  padding: 21px;
  border: 1px solid #dae4e1;
  border-radius: 13px;
  background: white;
  box-shadow: 0 5px 19px #1738470c;
}

.r3-controls-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 15px;
}

.r3-controls-heading small {
  color: #b08550;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.r3-controls h2 {
  margin: 9px 0;
  font-size: 22px;
}

.r3-controls p {
  margin: 0;
  color: #7c8e8a;
  font-size: 12px;
  line-height: 1.7;
}

.r3-template-tag {
  padding: 9px 12px;
  border: 1px solid #e4d1b7;
  border-radius: 20px;
  background: #fff8ed;
  color: #97703d;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.r3-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin: 20px 0 17px;
}

.r3-modes label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 13px;
  border: 1px solid #dde4df;
  border-radius: 9px;
  font-weight: 800;
  cursor: pointer;
}

.r3-modes label.chosen {
  border-color: #c49b68;
  background: #fcf5e9;
  color: #96703e;
}

.r3-modes input {
  accent-color: #ac8050;
}

.r3-selectors {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  max-width: 850px;
  gap: 13px;
}

.r3-selectors label {
  display: block;
  margin-bottom: 8px;
  font-weight: 800;
}

.r3-select {
  width: 100%;
  min-height: 43px;
  padding: 11px 12px;
  border: 1px solid #d6dfda;
  border-radius: 8px;
  background: #fff;
  color: #2b4845;
}

.r3-week-picker {
  display: grid;
  grid-template-columns: repeat(13,minmax(0,1fr));
  gap: 7px;
}

.r3-week-picker button {
  padding: 10px 3px;
  border: 1px solid #e2ddd4;
  border-radius: 7px;
  background: white;
  color: #3f5450;
}

.r3-week-picker button.selected {
  background: #ad8352;
  border-color: #ad8352;
  color: white;
  font-weight: 900;
}

.r3-quick {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 15px;
}

.r3-quick span {
  margin-right: 5px;
  color: #849089;
  font-size: 11px;
  font-weight: 800;
}

.r3-quick button {
  padding: 9px 12px;
  border: 1px solid #e5d7bd;
  border-radius: 8px;
  background: #fff9ee;
  color: #967340;
  font-size: 11px;
  font-weight: 800;
}

.r3-selected {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 15px;
  padding: 13px;
  border: 1px solid #eadac3;
  border-radius: 9px;
  background: #fcf6ea;
}

.r3-selected strong {
  color: #976d3a;
}

.r3-selected span {
  color: #4f665a;
}

.r3-selected small {
  color: #887e6f;
}

.r3-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 17px;
}

.r3-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  padding: 11px 14px;
  border: 0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 850;
}

.r3-actions .secondary {
  background: #ebf1ee;
  color: #315d54;
}

.r3-actions .primary {
  background: #a67b4b;
  color: white;
}

.r3-error {
  margin-top: 13px;
  padding: 12px;
  border-radius: 8px;
  background: #fff0f0;
  color: #ac2626;
}

/* A4 SCREEN PREVIEW */

.r3-paper {
  width: 210mm;
  max-width: 100%;
  min-height: 297mm;
  margin: 0 auto;
  padding: 8mm;
  background: #fffdfa;
  box-shadow: 0 8px 28px #17384724;
  color: #30474a;
}

.r3-preview-hidden {
  display: none;
}

/* REPORT HEADER */

.r3-document-header {
  background: #fffdfa;
}

.r3-header-main {
  display: grid;
  grid-template-columns: 1fr 1.7fr .45fr;
  align-items: center;
  gap: 9px;
  padding-bottom: 10px;
}

.r3-company strong {
  display: block;
  color: #224853;
  font-size: 21px;
  font-weight: 900;
  letter-spacing: -1px;
  white-space: nowrap;
}

.r3-company strong span {
  color: #287c53;
}

.r3-company small {
  display: block;
  margin-top: 5px;
  color: #987c59;
  font-size: 9px;
}

.r3-title {
  text-align: center;
}

.r3-title small {
  color: #a67d4e;
  font-size: 9px;
  font-weight: 900;
}

.r3-title h1 {
  margin: 4px 0;
  color: #21434c;
  font-size: 27px;
  font-weight: 900;
}

.r3-title p {
  margin: 0;
  color: #907753;
  font-size: 9px;
  font-weight: 800;
}

.r3-seal {
  display: grid;
  justify-items: center;
  gap: 3px;
  padding: 8px 5px;
  border: 2px solid #c8a16c;
  border-radius: 10px;
  color: #a17c47;
}

.r3-seal strong {
  font-size: 10px;
}

.r3-header-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 11px;
  border-bottom: 4px solid #c49a64;
  background: #284951;
  color: white;
  font-size: 9px;
  font-weight: 850;
}

/* SECTIONS */

.r3-section {
  margin-top: 13px;
}

.r3-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  padding-bottom: 7px;
  border-bottom: 1px solid #ddcaac;
  color: #294c50;
  font-size: 10px;
  font-weight: 900;
}

.r3-section-title > span {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: #b28b5c;
  color: white;
}

/* IDENTITY */

.r3-identity {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 6px 11px;
}

.r3-identity > div {
  display: grid;
  grid-template-columns: 95px minmax(0,1fr);
  gap: 7px;
  align-items: center;
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #e8dfd0;
  border-radius: 5px;
  background: #faf6ed;
  font-size: 9px;
}

.r3-identity span {
  color: #8b7e6d;
}

.r3-identity strong {
  overflow-wrap: anywhere;
}

/* KPI */

.r3-kpis {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 8px;
  margin-top: 13px;
}

.r3-kpis > div {
  padding: 10px;
  border: 1px solid #e6d5b9;
  border-radius: 6px;
  background: #f5ecde;
  text-align: center;
}

.r3-kpis span {
  display: block;
  color: #907149;
  font-size: 9px;
  font-weight: 850;
}

.r3-kpis strong {
  display: block;
  margin-top: 6px;
  color: #2f4c4b;
  font-size: 17px;
}

/* COMPETENCY */

.r3-competency-table,
.r3-week-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.r3-competency-table th,
.r3-competency-table td {
  padding: 7px 5px;
  border: 1px solid #e2ddd3;
  font-size: 9px;
  text-align: center;
  vertical-align: middle;
}

.r3-competency-table th {
  background: #eaf0e9;
  color: #3c5a4f;
  font-weight: 900;
}

.r3-competency-table td:nth-child(2) {
  text-align: left;
}

.r3-competency-table th:nth-child(1) {
  width: 7%;
}

.r3-competency-table th:nth-child(2) {
  width: 30%;
}

.r3-competency-table th:nth-child(3),
.r3-competency-table th:nth-child(4) {
  width: 13%;
}

.r3-competency-table th:nth-child(5) {
  width: 20%;
}

.r3-competency-table th:nth-child(6) {
  width: 17%;
}

.r3-progress {
  height: 6px;
  overflow: hidden;
  border-radius: 20px;
  background: #e1e7e0;
}

.r3-progress > div {
  height: 100%;
  background: #4d9d76;
}

.r3-competency-table small {
  display: block;
  margin-top: 4px;
  font-size: 8px;
}

.r3-achieved,
.r3-incomplete {
  display: inline-block;
  padding: 4px 6px;
  border-radius: 5px;
  font-size: 8px;
  font-weight: 900;
}

.r3-achieved {
  color: #287a53;
  background: #e3f3e7;
}

.r3-incomplete {
  color: #a67939;
  background: #fff0de;
}

/* WEEKLY */

.r3-week-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
  color: #8f795c;
  font-size: 9px;
}

.r3-week-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
  align-items: start;
}

.r3-week-grid > div {
  min-width: 0;
}

.r3-week-table th,
.r3-week-table td {
  border: 1px solid #e2ddd3;
  padding: 5px 4px;
  text-align: center;
  font-size: 9px;
  line-height: 1.2;
}

.r3-week-table th {
  background: #eaf0e9;
  color: #466152;
  font-weight: 900;
}

.r3-week-table tbody tr:nth-child(even) {
  background: #faf7f1;
}

.r3-week-number {
  color: #a27b4a;
  font-weight: 900;
}

.r3-week-placeholder {
  min-height: 70px;
  display: grid;
  place-items: center;
  border: 1px dashed #e0d2bb;
  color: #b0a08a;
  font-size: 10px;
}

.r3-week-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 7px;
  padding: 8px;
  margin-top: 8px;
  background: #f8f1e6;
  color: #85715a;
  font-size: 9px;
}

.r3-week-summary strong {
  color: #31554b;
}

/* SIMPER */

.r3-simper-grid {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 7px;
}

.r3-simper-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 9px 5px;
  border: 1px solid #e4d9c8;
  border-radius: 6px;
  background: #faf8f3;
  text-align: center;
}

.r3-simper-item > strong {
  color: #496356;
  font-size: 9px;
}

.r3-simper-item > span {
  font-size: 10px;
  font-weight: 900;
}

.r3-positive {
  color: #2a8559;
}

.r3-warning {
  color: #ad7d39;
}

.r3-simper-item small {
  color: #938674;
  font-size: 8px;
  overflow-wrap: anywhere;
}

.r3-simper-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  flex-wrap: wrap;
  padding: 8px;
  margin-top: 8px;
  background: #edf4ed;
  color: #718676;
  font-size: 9px;
}

.r3-simper-summary strong {
  color: #317854;
}

.r3-small-note {
  margin: 6px 0 0;
  color: #887b68;
  font-size: 8px;
}

/* EVALUATION */

.r3-evaluation p {
  margin: 5px 0;
  color: #65776d;
  font-size: 9px;
  line-height: 1.55;
}

/* FOOTER */

.r3-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-top: 15px;
}

.r3-footer-info {
  display: grid;
  gap: 5px;
  color: #88978b;
  font-size: 9px;
}

.r3-footer-info strong {
  color: #2d564a;
}

.r3-signature {
  width: 205px;
  text-align: center;
  font-size: 9px;
}

.r3-signature > span,
.r3-signature > strong {
  display: block;
}

.r3-signature > strong {
  margin-top: 5px;
}

.r3-sign-space {
  height: 35px;
}

.r3-sign-name {
  padding-top: 6px;
  border-top: 1px solid #9c9d91;
  font-weight: 900;
}

.r3-bottom-accent {
  height: 5px;
  margin-top: 12px;
  background: linear-gradient(
    90deg,
    #284951 75%,
    #c3965a 75%
  );
}

/* SCREEN DENSITY */

.r3-density-full .r3-week-table th,
.r3-density-full .r3-week-table td {
  padding: 3px 3px;
  font-size: 8px;
}

.r3-density-full .r3-section {
  margin-top: 10px;
}

.r3-density-medium .r3-week-table th,
.r3-density-medium .r3-week-table td {
  padding: 4px;
}

/* RESPONSIVE SCREEN */

@media(max-width:800px) {
  .r3-container {
    padding: 12px;
  }

  .r3-controls-heading {
    flex-direction: column;
  }

  .r3-modes {
    flex-direction: column;
  }

  .r3-selectors {
    grid-template-columns: 1fr;
  }

  .r3-week-picker {
    grid-template-columns: repeat(5,1fr);
  }

  .r3-paper {
    width: 100%;
    min-height: 0;
    padding: 12px;
  }

  .r3-header-main {
    grid-template-columns: 1fr 1.6fr;
  }

  .r3-seal {
    display: none;
  }

  .r3-company strong {
    font-size: 15px;
  }

  .r3-title h1 {
    font-size: 20px;
  }

  .r3-identity {
    grid-template-columns: 1fr;
  }

  .r3-kpis strong {
    font-size: 13px;
  }

  .r3-competency-table th,
  .r3-competency-table td {
    padding: 5px 2px;
    font-size: 8px;
  }

  .r3-week-grid {
    gap: 5px;
  }

  .r3-week-table th,
  .r3-week-table td {
    padding: 4px 2px;
    font-size: 8px;
  }

  .r3-simper-grid {
    grid-template-columns: repeat(2,1fr);
  }
}

/* ====================================================
   PRINT A4 PORTRAIT — COMPACT
   ==================================================== */

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

  .r3-root {
    min-height: 0 !important;
    background: white !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .r3-topbar,
  .r3-controls {
    display: none !important;
  }

  .r3-container {
    width: 100% !important;
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .r3-paper,
  .r3-preview-hidden {
    display: block !important;
    box-sizing: border-box !important;
    width: 210mm !important;
    max-width: 210mm !important;

    /* Jangan pakai min-height 297mm + padding
       yang dapat memicu halaman tambahan. */
    min-height: 0 !important;
    height: auto !important;
    padding: 7mm !important;
    margin: 0 !important;

    border: 0 !important;
    box-shadow: none !important;
  }

  .r3-header-main {
    grid-template-columns: 1fr 1.7fr .45fr !important;
    padding-bottom: 6px !important;
  }

  .r3-company strong {
    font-size: 17px !important;
  }

  .r3-title h1 {
    margin: 2px 0 !important;
    font-size: 21px !important;
  }

  .r3-title small,
  .r3-title p {
    font-size: 8px !important;
  }

  .r3-seal {
    display: grid !important;
    padding: 4px !important;
  }

  .r3-header-band {
    padding: 5px 9px !important;
    border-bottom-width: 3px !important;
    font-size: 7px !important;
  }

  .r3-section,
  .r3-density-full .r3-section {
    margin-top: 8px !important;
  }

  .r3-section-title {
    gap: 6px !important;
    margin-bottom: 5px !important;
    padding-bottom: 4px !important;
    font-size: 8px !important;
  }

  .r3-section-title > span {
    width: 18px !important;
    height: 18px !important;
    font-size: 8px !important;
  }

  .r3-identity {
    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
    gap: 3px 7px !important;
  }

  .r3-identity > div {
    grid-template-columns: 75px minmax(0,1fr) !important;
    gap: 4px !important;
    padding: 4px 5px !important;
    font-size: 8px !important;
  }

  .r3-kpis {
    gap: 6px !important;
    margin-top: 8px !important;
  }

  .r3-kpis > div {
    padding: 6px !important;
  }

  .r3-kpis span {
    font-size: 7px !important;
  }

  .r3-kpis strong {
    margin-top: 3px !important;
    font-size: 13px !important;
  }

  .r3-competency-table th,
  .r3-competency-table td {
    padding: 4px 3px !important;
    font-size: 8px !important;
  }

  .r3-progress {
    height: 4px !important;
  }

  .r3-competency-table small {
    margin-top: 2px !important;
    font-size: 7px !important;
  }

  .r3-achieved,
  .r3-incomplete {
    padding: 3px !important;
    font-size: 7px !important;
  }

  .r3-week-heading {
    margin-bottom: 5px !important;
    font-size: 8px !important;
  }

  .r3-week-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 7px !important;
  }

  .r3-week-table th,
  .r3-week-table td,
  .r3-density-full .r3-week-table th,
  .r3-density-full .r3-week-table td {
    padding: 3px 2px !important;
    font-size: 7.5px !important;
    line-height: 1.05 !important;
    height: 17px !important;
  }

  .r3-week-summary {
    margin-top: 5px !important;
    padding: 5px !important;
    font-size: 7px !important;
  }

  .r3-simper-grid {
    grid-template-columns: repeat(4,minmax(0,1fr)) !important;
    gap: 5px !important;
  }

  .r3-simper-item {
    gap: 3px !important;
    padding: 5px 3px !important;
  }

  .r3-simper-item strong,
  .r3-simper-item span {
    font-size: 8px !important;
  }

  .r3-simper-item small {
    font-size: 7px !important;
  }

  .r3-simper-summary {
    gap: 5px !important;
    margin-top: 5px !important;
    padding: 5px !important;
    font-size: 7px !important;
  }

  .r3-evaluation p {
    margin: 3px 0 !important;
    font-size: 8px !important;
    line-height: 1.3 !important;
  }

  .r3-footer {
    margin-top: 8px !important;
  }

  .r3-footer-info,
  .r3-signature {
    font-size: 8px !important;
  }

  .r3-footer-info {
    gap: 3px !important;
  }

  .r3-signature {
    width: 165px !important;
  }

  .r3-sign-space {
    height: 21px !important;
  }

  .r3-bottom-accent {
    height: 4px !important;
    margin-top: 7px !important;
  }

  .r3-document-header,
  .r3-identity,
  .r3-kpis,
  .r3-simper-grid,
  .r3-footer {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .r3-week-grid {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .r3-week-table tr,
  .r3-competency-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .r3-root,
  .r3-paper {
    overflow: visible !important;
  }
}
`;
