
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// RAPOR OJT - KALENDER GLOBAL
// WEEK 01-25 | CAPAIAN MAKSIMAL 100%
// =====================================================

const TOTAL_WEEKS = 25;
const PARTICIPANT_POSITION = "Junior OJT";

const TARGETS = [
  {
    key: "Fisik",
    title: "FISIK",
    target: 25,
    unit: "km",
    color: "#dc4843",
  },
  {
    key: "Training",
    title: "INTERNAL TRAINING",
    target: 4,
    unit: "kegiatan",
    color: "#eca72f",
  },
  {
    key: "Sosialisasi",
    title: "SOSIALISASI",
    target: 3,
    unit: "kegiatan",
    color: "#d6b918",
  },
  {
    key: "Orientasi Area",
    title: "ORIENTASI AREA",
    target: 2,
    unit: "kegiatan",
    color: "#258c50",
  },
  {
    key: "Coaching",
    title: "COACHING",
    target: 1,
    unit: "kegiatan",
    color: "#249fc0",
  },
  {
    key: "Hazard",
    title: "HAZARD",
    target: 2,
    unit: "kegiatan",
    color: "#3070d5",
  },
];

const SIMPER_START = "[[SIMPER_V2]]";
const SIMPER_END = "[[/SIMPER_V2]]";

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function num(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const valueNumber = Number(value);

  return Number.isFinite(valueNumber)
    ? valueNumber
    : null;
}

function fmt(value, digits = 0) {
  const valueNumber = num(value);

  if (valueNumber === null) {
    return "—";
  }

  return valueNumber.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

function addDays(value, count) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(
    date.getUTCDate() + count
  );

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

function currentDateText() {
  return new Date().toLocaleDateString(
    "id-ID",
    {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

function percentage(realized, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(
      0,
      (realized / target) * 100
    )
  );
}

function average(values) {
  if (!values.length) return 0;

  return (
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

function chunks(items, size = 7) {
  const result = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    result.push(
      items.slice(index, index + size)
    );
  }

  return result;
}

// =====================================================
// KALENDER GLOBAL OJT
//
// WEEK 01 = 12-18 SEPTEMBER 2026
// WEEK 02 = 20-26 SEPTEMBER 2026
// WEEK 07 = 25-31 OKTOBER 2026
// WEEK 25 = 28 FEBRUARI-6 MARET 2027
//
// 19 SEPTEMBER 2026 TIDAK TERMASUK WEEK.
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

function getGlobalWeek(value) {
  const date = String(value ?? "")
    .slice(0, 10);

  if (!parseDate(date)) return null;

  const selected = GLOBAL_WEEKS.find(
    (item) =>
      date >= item.start &&
      date <= item.end
  );

  return selected?.week ?? null;
}

function getWeekData(week) {
  return (
    GLOBAL_WEEKS.find(
      (item) =>
        item.week === Number(week)
    ) || null
  );
}

function weekLabel(week) {
  return `Week ${pad(week)}`;
}

function programWeekRange(week, program) {
  const item = getWeekData(week);

  if (
    !item ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startDate = String(
    program.start_date
  ).slice(0, 10);

  const endDate = parseDate(
    program.end_date
  )
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    item.start > startDate
      ? item.start
      : startDate;

  const end =
    endDate && endDate < item.end
      ? endDate
      : item.end;

  if (start > end) return null;

  return { start, end };
}

function defaultGlobalWeek(program) {
  const today = new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(new Date());

  const available = GLOBAL_WEEKS.filter(
    (item) =>
      programWeekRange(
        item.week,
        program
      )
  );

  if (!available.length) return 1;

  const current = available.find(
    (item) => {
      const range = programWeekRange(
        item.week,
        program
      );

      return (
        today >= range.start &&
        today <= range.end
      );
    }
  );

  if (current) return current.week;

  const upcoming = available.find(
    (item) => {
      const range = programWeekRange(
        item.week,
        program
      );

      return range.start > today;
    }
  );

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// =====================================================
// SIMPER
// =====================================================

function parseSimper(notes) {
  const text = String(notes ?? "");

  const start = text.lastIndexOf(
    SIMPER_START
  );

  const end = text.lastIndexOf(
    SIMPER_END
  );

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

    return result &&
      typeof result === "object" &&
      !Array.isArray(result)
      ? result
      : null;
  } catch {
    return null;
  }
}

function calculateSimper(record) {
  const meta = parseSimper(
    record?.notes
  );

  const kmkop =
    normalizeRole(
      record?.theory_status
    ) === "passed";

  const praktik =
    normalizeRole(
      record?.practice_status
    ) === "passed";

  const orientasi =
    normalizeRole(
      meta?.orientation_status
    ) === "completed";

  const completed = [
    kmkop,
    praktik,
    orientasi,
  ].filter(Boolean).length;

  const issuanceStatus =
    normalizeRole(
      meta?.issuance_status
    ) || "not_issued";

  return {
    kmkop,
    praktik,
    orientasi,
    completed,
    percentage: [0, 33, 67, 100][completed],
    passed: completed === 3,

    kmkopStatus:
      record?.theory_status || null,

    practiceStatus:
      record?.practice_status || null,

    orientationStatus:
      meta?.orientation_status || null,

    issuanceStatus,
    issued: issuanceStatus === "issued",

    orientationDate:
      meta?.orientation_date || null,

    issuanceNumber:
      meta?.issuance_number || "",

    issuanceDate:
      record?.graduation_date || null,

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

function componentStatus(
  status,
  type
) {
  const value = normalizeRole(status);

  if (type === "orientation") {
    if (value === "completed") {
      return "SELESAI";
    }

    if (value === "scheduled") {
      return "DIJADWALKAN";
    }

    if (
      value === "in_progress" ||
      value === "ongoing"
    ) {
      return "DALAM PROSES";
    }

    return "BELUM SELESAI";
  }

  if (value === "passed") {
    return "LULUS";
  }

  if (value === "failed") {
    return "TIDAK LULUS";
  }

  if (value === "pending") {
    return "MENUNGGU";
  }

  if (value === "scheduled") {
    return "DIJADWALKAN";
  }

  return "BELUM LULUS";
}

function issuanceText(value) {
  const status = normalizeRole(value);

  if (status === "issued") {
    return "TERBIT";
  }

  if (status === "processing") {
    return "DALAM PROSES";
  }

  return "BELUM TERBIT";
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
    return "MENUNGGU VALIDASI";
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

function getGrade(value) {
  if (value === null) {
    return [
      "—",
      "BELUM ADA NILAI",
    ];
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

// =====================================================
// KOMPONEN TAMPILAN
// =====================================================

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
  weeks,
}) {
  return (
    <select
      className="rp-select"
      value={value}
      onChange={(event) =>
        onChange(
          Number(event.target.value)
        )
      }
    >
      {weeks.map((item) => (
        <option
          value={item.week}
          key={item.week}
        >
          {weekLabel(item.week)}
          {" — "}
          {dateText(item.start)}
          {" s.d. "}
          {dateText(item.end)}
        </option>
      ))}
    </select>
  );
}

function CompactWeekTable({
  weeks,
  site,
  type = "theory",
}) {
  if (!weeks.length) return null;

  const getItems = (week) =>
    type === "practice"
      ? week.practices || []
      : week.theory || [];

  const maxRows = Math.max(
    1,
    ...weeks.map(
      (week) =>
        getItems(week).length
    )
  );

  return (
    <div className="rp-scroll rp-compact-wrap">
      <table className="rp-table rp-compact-table">
        <thead>
          <tr>
            <th className="rp-compact-site">
              SITE
            </th>

            {weeks.map((week) => (
              <th key={week.week}>
                WEEK {pad(week.week)}
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
                        className="rp-empty"
                      >
                        —
                      </td>
                    );
                  }

                  const label = String(
                    (
                      type === "practice"
                        ? item.practice_name
                        : item.notes
                    ) ?? ""
                  ).trim();

                  return (
                    <td key={week.week}>
                      <div className="rp-compact-entry">
                        {label && (
                          <span className="rp-entry-name">
                            {label}
                          </span>
                        )}

                        <strong className="rp-entry-score">
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

// =====================================================
// KEAMANAN / AKSES RAPOR
// =====================================================

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
    .select(
      "id,role,full_name"
    )
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

  const role = normalizeRole(
    profile.role
  );

  const isParticipant =
    ["participant", "peserta"].includes(
      role
    );

  if (
    !["admin", "mentor"].includes(role) &&
    !isParticipant
  ) {
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

  if (programError) {
    throw programError;
  }

  if (!program) {
    throw new Error(
      "Program OJT tidak ditemukan atau akun tidak memiliki izin."
    );
  }

  if (!parseDate(program.start_date)) {
    throw new Error(
      "Tanggal mulai program OJT tidak valid."
    );
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
        normalizeRole(
          item.status
        ) === "approved"
    );

    if (
      !approved &&
      program.legacy_access !== true
    ) {
      throw new Error(
        "Program belum memiliki persetujuan akses yang sah."
      );
    }
  }

  // Nama Mentor sesuai mentor_id.
  // Gagal membaca profil Mentor tidak
  // boleh menyebabkan Rapor gagal dibuka.

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
    profile,
    program,
    userId: user.id,
    mentorName,
  };
}

// =====================================================
// AMBIL DATA SUPABASE
// =====================================================

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

    supabase
      .from("simper_records")
      .select(
        "id,theory_status,practice_status,status,notes,graduation_date,created_at"
      )
      .eq("program_id", id)
      .order("created_at", {
        ascending: false,
      })
      .limit(1),
  ]);

  const labels = [
    "Kategori Achievement",
    "Data Achievement",
    "Nilai Teori",
    "Nilai Praktik",
    "Data SIMPER",
  ];

  results.forEach(
    (result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    }
  );

  return {
    types: results[0].data || [],
    achievements: results[1].data || [],
    theory: results[2].data || [],
    practices: results[3].data || [],
    simper: results[4].data?.[0] || null,
  };
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

export default function RaporOJTPage() {
  const params = useParams();
  const router = useRouter();

  const requestRef = useRef(0);

  const programId = Array.isArray(
    params?.id
  )
    ? params.id[0]
    : params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const [mode, setMode] =
    useState("range");

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

  // ===================================================
  // LOAD DATA
  // ===================================================

  useEffect(() => {
    let active = true;

    const requestId =
      ++requestRef.current;

    async function load() {
      setLoading(true);
      setError("");
      setData(null);

      if (!programId) {
        setError(
          "ID program tidak tersedia."
        );
        setLoading(false);
        return;
      }

      try {
        const access =
          await verifyReportAccess(
            programId
          );

        if (
          !active ||
          requestId !==
            requestRef.current
        ) {
          return;
        }

        if (access.redirect) {
          router.replace(
            access.redirect
          );
          return;
        }

        const records =
          await fetchRecords(
            programId
          );

        if (
          !active ||
          requestId !==
            requestRef.current
        ) {
          return;
        }

        setData({
          ...access,
          ...records,
        });

        const initial =
          defaultGlobalWeek(
            access.program
          );

        setSingleWeek(initial);
        setFromWeek(initial);
        setToWeek(initial);
        setCustomWeeks([initial]);
      } catch (err) {
        if (
          active &&
          requestId ===
            requestRef.current
        ) {
          setData(null);
          setError(
            err?.message ||
              "Gagal memuat Rapor OJT."
          );
        }
      } finally {
        if (
          active &&
          requestId ===
            requestRef.current
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

  async function refreshData() {
    if (
      !data ||
      refreshing ||
      !programId
    ) {
      return;
    }

    const requestId =
      ++requestRef.current;

    setRefreshing(true);
    setError("");

    try {
      const access =
        await verifyReportAccess(
          programId
        );

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      if (access.redirect) {
        setData(null);
        router.replace(
          access.redirect
        );
        return;
      }

      if (
        access.userId !==
        data.userId
      ) {
        throw new Error(
          "Akun pengguna berubah. Buka ulang Rapor OJT."
        );
      }

      const records =
        await fetchRecords(
          programId
        );

      if (
        requestId !==
        requestRef.current
      ) {
        return;
      }

      setData({
        ...access,
        ...records,
      });
    } catch (err) {
      if (
        requestId ===
        requestRef.current
      ) {
        setData(null);
        setError(
          err?.message ||
            "Gagal memperbarui Rapor OJT."
        );
      }
    } finally {
      if (
        requestId ===
        requestRef.current
      ) {
        setRefreshing(false);
      }
    }
  }

  // ===================================================
  // DAFTAR WEEK PESERTA YANG TERSEDIA
  // ===================================================

  const availableWeeks = useMemo(() => {
    if (!data?.program) {
      return [];
    }

    return GLOBAL_WEEKS.filter(
      (item) =>
        programWeekRange(
          item.week,
          data.program
        )
    );
  }, [data]);

  const availableNumbers = useMemo(
    () =>
      new Set(
        availableWeeks.map(
          (item) => item.week
        )
      ),
    [availableWeeks]
  );

  // ===================================================
  // PILIHAN MINGGU
  // ===================================================

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
        (_, index) =>
          fromWeek + index
      );
    } else {
      weeks = [
        ...new Set(customWeeks),
      ].sort(
        (a, b) => a - b
      );
    }

    return weeks.filter(
      (week) =>
        availableNumbers.has(week)
    );
  }, [
    mode,
    singleWeek,
    fromWeek,
    toWeek,
    customWeeks,
    availableNumbers,
  ]);

  function changeFromWeek(week) {
    setFromWeek(week);

    if (toWeek < week) {
      setToWeek(week);
    }
  }

  function toggleCustomWeek(week) {
    setCustomWeeks((old) =>
      old.includes(week)
        ? old.filter(
            (item) =>
              item !== week
          )
        : [...old, week]
    );
  }

  // ===================================================
  // PERHITUNGAN RAPOR
  //
  // PENTING:
  // - Semua tanggal memakai Week Global.
  // - Hanya Achievement verified dihitung.
  // - Realisasi asli tidak dibatasi.
  // - Persentase masing-masing minggu
  //   maksimal 100%.
  // - Multiweek = rata-rata persentase
  //   mingguan, bukan rasio total mentah.
  // ===================================================

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

      return typeMap.get(
        normalize(key)
      );
    }

    const weekly = selectedWeeks.map(
      (week) => {
        const weekAchievements =
          achievements.filter(
            (item) =>
              getGlobalWeek(
                item.activity_date
              ) === week
          );

        const competencies = TARGETS.map(
          (target) => {
            const code =
              typeCode(target.key);

            const matchingRecords =
              code
                ? weekAchievements.filter(
                    (item) =>
                      item.type_code === code
                  )
                : [];

            const verified =
              matchingRecords.filter(
                (item) =>
                  normalizeRole(
                    item.status
                  ) === "verified"
              );

            let realized = 0;

            if (
              target.key === "Fisik"
            ) {
              const totalMeters =
                verified.reduce(
                  (sum, item) =>
                    sum +
                    Math.round(
                      (
                        num(
                          item.distance_km
                        ) ?? 0
                      ) * 1000
                    ),
                  0
                );

              realized =
                totalMeters / 1000;
            } else {
              realized =
                verified.length;
            }

            return {
              ...target,
              realized,
              recorded:
                matchingRecords.length,

              percentage: percentage(
                realized,
                target.target
              ),

              achieved:
                realized >=
                target.target,
            };
          }
        );

        return {
          week,
          competencies,

          theory: theory.filter(
            (item) =>
              getGlobalWeek(
                item.test_date
              ) === week
          ),

          practices:
            practices.filter(
              (item) =>
                getGlobalWeek(
                  item.practice_date
                ) === week
            ),
        };
      }
    );

    // =================================================
    // RINGKASAN KOMPETENSI
    // =================================================

    const summary = TARGETS.map(
      (target) => {
        const entries =
          weekly.map(
            (week) =>
              week.competencies.find(
                (item) =>
                  item.key ===
                  target.key
              )
          ).filter(Boolean);

        let realized = 0;

        if (
          target.key === "Fisik"
        ) {
          const meters =
            entries.reduce(
              (sum, item) =>
                sum +
                Math.round(
                  item.realized * 1000
                ),
              0
            );

          realized =
            meters / 1000;
        } else {
          realized =
            entries.reduce(
              (sum, item) =>
                sum +
                item.realized,
              0
            );
        }

        const totalTarget =
          target.target *
          selectedWeeks.length;

        // Persentase tiap minggu dibatasi
        // 100%, lalu dirata-ratakan.

        const cappedPercentage =
          average(
            entries.map(
              (item) =>
                item.percentage
            )
          );

        const achieved =
          entries.length > 0 &&
          entries.every(
            (item) =>
              item.achieved
          );

        return {
          ...target,
          realized,
          totalTarget,
          percentage:
            cappedPercentage,
          achieved,
        };
      }
    );

    // =================================================
    // NILAI TEORI DAN PRAKTIK
    // =================================================

    const allTheory =
      weekly.flatMap(
        (item) => item.theory
      );

    const allPractices =
      weekly.flatMap(
        (item) =>
          item.practices
      );

    const validScores = [
      ...allTheory,
      ...allPractices,
    ]
      .map(
        (item) =>
          num(item.score)
      )
      .filter(
        (value) =>
          value !== null
      );

    const total =
      validScores.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    const scoreAverage =
      validScores.length
        ? total /
          validScores.length
        : null;

    // =================================================
    // RATA-RATA 6 KOMPETENSI
    // =================================================

    const competencyAverage =
      summary.length
        ? average(
            summary.map(
              (item) =>
                item.percentage
            )
          )
        : 0;

    const incomplete =
      summary.filter(
        (item) =>
          !item.achieved
      );

    return {
      weekly,
      summary,
      allTheory,
      allPractices,

      total,
      average: scoreAverage,
      scoreCount:
        validScores.length,

      grade:
        getGrade(scoreAverage),

      competencyAverage,

      simper:
        calculateSimper(
          simper
        ),

      incomplete,
    };
  }, [data, selectedWeeks]);

  function printReport() {
    if (
      !data ||
      !report ||
      !selectedWeeks.length ||
      refreshing
    ) {
      return;
    }

    window.print();
  }

  // ===================================================
  // LOADING
  // ===================================================

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
          {error ||
            "Data Rapor tidak tersedia."}
        </p>

        <button
          type="button"
          onClick={() =>
            router.back()
          }
        >
          Kembali
        </button>
      </main>
    );
  }

  // ===================================================
  // IDENTITAS RAPOR
  // ===================================================

  const {
    program,
    profile,
  } = data;

  const role = normalizeRole(
    profile.role
  );

  const isManager =
    ["admin", "mentor"].includes(
      role
    );

  const participant = Array.isArray(
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
    program.site ||
    "—";

  const mentorName =
    data.mentorName || "Nama Mentor";

  const selectedLabel =
    selectedWeeks.map(
      (week) =>
        weekLabel(week)
    ).join(", ");

  const selectedRanges =
    selectedWeeks.map(
      (week) => {
        const global =
          getWeekData(week);

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
    selectedRanges[0]?.start ||
    null;

  const periodEnd =
    selectedRanges[
      selectedRanges.length - 1
    ]?.end || null;

  const backPath =
    isManager
      ? `/peserta/${programId}`
      : "/dashboard-peserta";

  // ===================================================
  // TAMPILAN RAPOR
  // ===================================================

  return (
    <main className="rp-root">
      <style>{css}</style>

      {/* HEADER APLIKASI */}
      <header className="rp-topbar">
        <div className="rp-brand-wrap">
          <div className="rp-brand">
            OJT <span>MineTrack</span>
          </div>

          <small>
            Rapor Evaluasi Peserta
          </small>
        </div>

        <div className="rp-account">
          <span>
            {role === "admin"
              ? "Administrator"
              : role === "mentor"
              ? "Mentor"
              : "Peserta"}
          </span>

          <strong>
            {profile.full_name ||
              "Pengguna"}
          </strong>
        </div>

        <button
          type="button"
          className="rp-btn light"
          onClick={() =>
            router.push(
              backPath
            )
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="rp-container">
        {/* PENGATURAN RAPOR */}
        <section className="rp-controls">
          <div className="rp-controls-head">
            <div>
              <h2>
                Pengaturan Rapor OJT
              </h2>

              <p className="rp-muted">
                Pilih minggu sesuai
                Kalender Global OJT.
                Seluruh penilaian mengikuti
                Week 01–25 yang tetap.
              </p>
            </div>

            <span className="rp-chip">
              KALENDER GLOBAL
            </span>
          </div>

          {/* PILIH MODE */}
          <div className="rp-modes">
            <label>
              <input
                type="radio"
                name="raporMode"
                checked={
                  mode === "single"
                }
                onChange={() =>
                  setMode("single")
                }
              />

              Satu Minggu
            </label>

            <label>
              <input
                type="radio"
                name="raporMode"
                checked={
                  mode === "range"
                }
                onChange={() =>
                  setMode("range")
                }
              />

              Rentang Minggu
            </label>

            <label>
              <input
                type="radio"
                name="raporMode"
                checked={
                  mode === "custom"
                }
                onChange={() =>
                  setMode("custom")
                }
              />

              Minggu Tertentu
            </label>
          </div>

          {/* SATU MINGGU */}
          {mode === "single" &&
            availableWeeks.length > 0 && (
              <div className="rp-options">
                <div>
                  <label className="rp-field-label">
                    Pilih Week Global
                  </label>

                  <WeekSelect
                    value={singleWeek}
                    onChange={
                      setSingleWeek
                    }
                    weeks={
                      availableWeeks
                    }
                  />
                </div>
              </div>
            )}

          {/* RENTANG MINGGU */}
          {mode === "range" &&
            availableWeeks.length > 0 && (
              <div className="rp-options">
                <div>
                  <label className="rp-field-label">
                    Dari Week
                  </label>

                  <WeekSelect
                    value={fromWeek}
                    onChange={
                      changeFromWeek
                    }
                    weeks={
                      availableWeeks
                    }
                  />
                </div>

                <div>
                  <label className="rp-field-label">
                    Sampai Week
                  </label>

                  <WeekSelect
                    value={toWeek}
                    onChange={
                      setToWeek
                    }
                    weeks={
                      availableWeeks.filter(
                        (item) =>
                          item.week >=
                          fromWeek
                      )
                    }
                  />
                </div>
              </div>
            )}

          {/* MINGGU TERTENTU */}
          {mode === "custom" && (
            <div className="rp-custom">
              {GLOBAL_WEEKS.map(
                (item) => {
                  const available =
                    availableNumbers.has(
                      item.week
                    );

                  const active =
                    customWeeks.includes(
                      item.week
                    );

                  return (
                    <button
                      key={item.week}
                      type="button"
                      disabled={
                        !available
                      }
                      aria-pressed={
                        active
                      }
                      title={
                        `${weekLabel(
                          item.week
                        )}: ${dateText(
                          item.start
                        )} - ${dateText(
                          item.end
                        )}`
                      }
                      className={
                        "rp-week-btn " +
                        (
                          active
                            ? "active"
                            : ""
                        )
                      }
                      onClick={() =>
                        toggleCustomWeek(
                          item.week
                        )
                      }
                    >
                      {pad(
                        item.week
                      )}
                    </button>
                  );
                }
              )}
            </div>
          )}

          {/* INFORMASI PILIHAN */}
          <div className="rp-selected">
            <strong>
              {selectedWeeks.length} minggu dipilih
            </strong>

            <span>
              {selectedLabel ||
                "Belum ada minggu dipilih"}
            </span>

            {selectedWeeks.length > 0 && (
              <small>
                Rentang terluar:
                {" "}
                {dateText(periodStart)}
                {" – "}
                {dateText(periodEnd)}
              </small>
            )}
          </div>

          {error && (
            <div
              className="rp-error"
              role="alert"
            >
              {error}
            </div>
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
                : "↻ Refresh Data"}
            </button>

            <button
              type="button"
              className="rp-btn blue"
              onClick={() =>
                setPreview(
                  (value) => !value
                )
              }
            >
              {preview
                ? "Sembunyikan Pratinjau"
                : "Tampilkan Pratinjau"}
            </button>

            <button
              type="button"
              className="rp-btn primary"
              onClick={
                printReport
              }
              disabled={
                refreshing ||
                !selectedWeeks.length
              }
            >
              Cetak / Simpan PDF
            </button>
          </div>

          <p className="rp-muted">
            Format cetak A4 Landscape.
            Semua persentase kompetensi
            maksimal 100%, tetapi
            realisasi tetap ditampilkan
            sesuai jumlah sebenarnya.
          </p>
        </section>

        {/* RAPOR CETAK */}
        {selectedWeeks.length > 0 && (
          <article
            className={
              "rp-paper " +
              (
                preview
                  ? ""
                  : "rp-hidden-preview"
              )
            }
          >
            {/* KOP RAPOR */}
            <div className="rp-header">
              <div className="rp-company">
                BERAU{" "}
                <span>
                  COAL
                </span>
              </div>

              <div>
                <h1>
                  RAPOR OJT
                </h1>

                <h2>
                  ON THE JOB TRAINING
                </h2>

                <small>
                  PT BERAU COAL ·
                  EMERGENCY RESPONSE GROUP
                </small>
              </div>

              <div className="rp-emblem">
                OJT
                <br />
                TRAINING
              </div>
            </div>

            {/* IDENTITAS PESERTA */}
            <div className="rp-intro">
              <section className="rp-box">
                <SectionTitle>
                  DATA PESERTA
                </SectionTitle>

                <div className="rp-info">
                  <strong>
                    Nama
                  </strong>

                  <span>
                    : {participantName}
                  </span>

                  <strong>
                    Site
                  </strong>

                  <span>
                    : {site}
                  </span>

                  <strong>
                    Jabatan
                  </strong>

                  <span>
                    : {PARTICIPANT_POSITION}
                  </span>

                  <strong>
                    Departemen
                  </strong>

                  <span>
                    : {department}
                  </span>

                  <strong>
                    Periode OJT
                  </strong>

                  <span>
                    : {dateText(
                      program.start_date
                    )}
                    {" – "}
                    {dateText(
                      program.end_date
                    )}
                  </span>

                  <strong>
                    Minggu Rapor
                  </strong>

                  <span>
                    : {selectedLabel}
                  </span>
                </div>
              </section>

              <section className="rp-box">
                <SectionTitle>
                  KETERANGAN
                </SectionTitle>

                <p className="rp-description">
                  On The Job Training (OJT)
                  merupakan program pelatihan
                  kerja untuk meningkatkan
                  pengetahuan, keterampilan,
                  kompetensi, dan sikap kerja
                  peserta melalui kegiatan
                  langsung di lapangan.
                </p>

                <p className="rp-description">
                  Penilaian kompetensi
                  menggunakan Kalender Global
                  OJT. Setiap target mingguan
                  memiliki batas pencapaian
                  maksimal 100%, sedangkan
                  realisasi tetap dicatat
                  sesuai hasil aktual.
                </p>
              </section>
            </div>

            {/* BAGIAN 1 */}
            <section className="rp-section rp-keep">
              <SectionTitle>
                1. PENILAIAN KOMPETENSI UTAMA
              </SectionTitle>

              <div className="rp-scroll">
                <table className="rp-table rp-competency">
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
                        PENCAPAIAN
                      </th>

                      <th>
                        PERSENTASE
                      </th>

                      <th>
                        STATUS
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.summary.map(
                      (item, index) => (
                        <tr key={item.key}>
                          <td>
                            {index + 1}
                          </td>

                          <td className="rp-competency-name">
                            <span
                              className="rp-color"
                              style={{
                                background:
                                  item.color,
                              }}
                            />

                            <strong>
                              {item.title}
                            </strong>
                          </td>

                          <td>
                            {fmt(
                              item.totalTarget,
                              item.key ===
                                "Fisik"
                                ? 0
                                : 0
                            )}
                            {" "}
                            {item.unit}
                          </td>

                          <td>
                            <strong>
                              {fmt(
                                item.realized,
                                item.key ===
                                  "Fisik"
                                  ? 3
                                  : 0
                              )}
                            </strong>
                            {" "}
                            {item.unit}
                          </td>

                          <td>
                            <strong
                              style={{
                                color:
                                  item.achieved
                                    ? "#087b4c"
                                    : "#c13c43",
                              }}
                            >
                              {fmt(
                                item.percentage,
                                2
                              )}%
                            </strong>
                          </td>

                          <td>
                            <span
                              className={
                                "rp-status " +
                                (
                                  item.achieved
                                    ? "achieved"
                                    : "incomplete"
                                )
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
              </div>

              <div className="rp-competency-total">
                <span>
                  Rata-rata Kompetensi
                </span>

                <strong>
                  {fmt(
                    report.competencyAverage,
                    2
                  )}%
                </strong>
              </div>

              <p className="rp-small">
                Persentase dihitung dari
                rata-rata capaian mingguan
                yang masing-masing dibatasi
                100%. Realisasi dan target
                menampilkan jumlah sebenarnya
                untuk minggu terpilih.
                Status Tercapai diberikan
                jika target setiap minggu
                pilihan terpenuhi.
              </p>
            </section>

            {/* BAGIAN 2 */}
            <section className="rp-section">
              <SectionTitle>
                2. PENILAIAN PEMBELAJARAN MINGGUAN
              </SectionTitle>

              {chunks(
                report.weekly
              ).map(
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

            {/* BAGIAN 3 */}
            <section className="rp-section">
              <SectionTitle>
                3. PENILAIAN PRAKTIK MINGGUAN
              </SectionTitle>

              {chunks(
                report.weekly
              ).map(
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

            {/* BAGIAN 4 */}
            <section className="rp-section rp-keep">
              <SectionTitle>
                4. VALIDASI DAN KETERANGAN SIMPER
              </SectionTitle>

              <div className="rp-scroll">
                <table className="rp-table rp-simper-table">
                  <thead>
                    <tr>
                      <th>
                        NAMA PERSONIL
                      </th>

                      <th>
                        KMKOP
                      </th>

                      <th>
                        PRAKTIK
                      </th>

                      <th>
                        ORIENTASI AREA
                      </th>

                      <th>
                        PENERBITAN SIMPER
                      </th>
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
                                ? "positive"
                                : "pending"
                            )
                          }
                        >
                          {componentStatus(
                            report.simper.kmkopStatus,
                            "kmkop"
                          )}
                        </span>

                        <span className="rp-simper-detail">
                          Validasi:
                          {" "}
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
                                ? "positive"
                                : "pending"
                            )
                          }
                        >
                          {componentStatus(
                            report.simper.practiceStatus,
                            "practice"
                          )}
                        </span>

                        <span className="rp-simper-detail">
                          Validasi:
                          {" "}
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
                                ? "positive"
                                : "pending"
                            )
                          }
                        >
                          {componentStatus(
                            report.simper.orientationStatus,
                            "orientation"
                          )}
                        </span>

                        <span className="rp-simper-detail">
                          Tanggal:
                          {" "}
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
                                ? "positive"
                                : "pending"
                            )
                          }
                        >
                          {issuanceText(
                            report.simper.issuanceStatus
                          )}
                        </span>

                        <span className="rp-simper-detail">
                          Tanggal:
                          {" "}
                          {dateText(
                            report.simper.issuanceDate
                          )}
                        </span>

                        {report.simper.issuanceNumber && (
                          <span className="rp-simper-detail">
                            Nomor:
                            {" "}
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
                  PROGRES SIMPER:
                  {" "}
                  {report.simper.percentage}%
                </strong>

                {" · "}
                {report.simper.completed}
                {" dari 3 persyaratan terpenuhi"}

                {" · "}
                <strong>
                  Status:
                  {" "}
                  {report.simper.passed
                    ? "LULUS"
                    : "BELUM LULUS"}
                </strong>

                {" · "}
                <strong>
                  Penerbitan:
                  {" "}
                  {issuanceText(
                    report.simper.issuanceStatus
                  )}
                </strong>
              </div>

              <p className="rp-small">
                Data diambil dari catatan
                Monitoring SIMPER terbaru.
                Penerbitan SIMPER dihitung
                terpisah dari tiga komponen
                persyaratan.
              </p>

              {report.simper.legacy && (
                <p className="rp-small">
                  Data status SIMPER lama
                  ditemukan. Informasi
                  komponen dan validasi
                  perlu diperiksa kembali.
                </p>
              )}
            </section>

            {/* BAGIAN 5 */}
            <div className="rp-bottom">
              <section className="rp-box">
                <SectionTitle>
                  CATATAN EVALUASI
                </SectionTitle>

                <div className="rp-notes">
                  {report.incomplete.length > 0 ? (
                    <p>
                      Kompetensi yang belum
                      mencapai target pada
                      seluruh minggu pilihan:
                      {" "}
                      <strong>
                        {report.incomplete
                          .map(
                            (item) =>
                              item.title
                          )
                          .join(", ")}
                      </strong>.
                    </p>
                  ) : (
                    <p>
                      Seluruh kompetensi utama
                      mencapai target pada
                      semua minggu pilihan.
                    </p>
                  )}

                  <p>
                    Jumlah penilaian teori:
                    {" "}
                    <strong>
                      {report.allTheory.length}
                    </strong>.
                    {" "}
                    Jumlah penilaian praktik:
                    {" "}
                    <strong>
                      {report.allPractices.length}
                    </strong>.
                  </p>

                  <p>
                    Kegiatan yang belum
                    tercatat tidak otomatis
                    menunjukkan kegagalan.
                    Monitoring tetap diperlukan.
                  </p>
                </div>
              </section>

              <section className="rp-box">
                <SectionTitle>
                  RINGKASAN NILAI
                </SectionTitle>

                <div className="rp-numbers">
                  <div className="rp-number">
                    <span>
                      NILAI TOTAL
                    </span>

                    <strong>
                      {report.scoreCount
                        ? fmt(
                            report.total,
                            2
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div className="rp-number">
                    <span>
                      NILAI RATA-RATA
                    </span>

                    <strong>
                      {fmt(
                        report.average,
                        2
                      )}
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
                      A: 85–100
                      <br />
                      B: 75–84,99
                      <br />
                      C: 60–74,99
                      <br />
                      D: di bawah 60
                    </p>
                  </div>
                </div>

                <p className="rp-small">
                  Predikat dihasilkan dari
                  rata-rata nilai teori dan
                  praktik yang tersedia,
                  bukan dari persentase
                  Achievement. Predikat
                  merupakan acuan template,
                  bukan keputusan kelulusan
                  resmi.
                </p>
              </section>
            </div>

            {/* RINCIAN PERIODE */}
            <section className="rp-section rp-dates-section">
              <SectionTitle>
                RINCIAN MINGGU GLOBAL
              </SectionTitle>

              <div className="rp-date-list">
                {selectedRanges.map(
                  (item) => (
                    <span key={item.week}>
                      <strong>
                        W{pad(item.week)}
                      </strong>
                      {" "}
                      {dateText(item.start)}
                      {" – "}
                      {dateText(item.end)}
                    </span>
                  )
                )}
              </div>
            </section>

            {/* FOOTER DAN TANDA TANGAN */}
            <footer className="rp-footer">
              <div>
                <strong>
                  OJT MineTrack · PT Berau Coal
                </strong>

                <br />

                Tanggal cetak:
                {" "}
                {currentDateText()}

                <br />

                Kalender Global OJT Week 01–25
              </div>

              <div className="rp-signature">
                Mengetahui,
                <br />
                Mentor / Penanggung Jawab

                <div className="rp-sign-space" />

                <span className="rp-sign-line">
                  {mentorName}
                </span>
              </div>
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}

// =====================================================
// CSS LAYAR, MOBILE DAN PRINT
// =====================================================

const css = `
.rp-root,
.rp-root * {
  box-sizing: border-box;
}

.rp-root {
  min-height: 100vh;
  background: #eff4f5;
  color: #173149;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 12px;
}

.rp-loading {
  min-height: 100vh;
  padding: 25px;
  background: #eff4f5;
  font-family: Arial, sans-serif;
}

.rp-topbar {
  background: #082f39;
  color: white;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.rp-brand {
  font-size: 20px;
  font-weight: 900;
  white-space: nowrap;
}

.rp-brand span {
  color: #35c994;
}

.rp-brand-wrap small {
  display: block;
  font-size: 10px;
  color: #a5d9ca;
  margin-top: 4px;
}

.rp-account {
  margin-left: auto;
  text-align: right;
  max-width: 240px;
}

.rp-account span {
  display: block;
  font-size: 10px;
  color: #a6d6c9;
}

.rp-account strong {
  display: block;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.rp-container {
  max-width: 1250px;
  margin: auto;
  padding: 15px;
}

.rp-controls {
  background: white;
  border: 1px solid #d4e0e5;
  border-radius: 12px;
  padding: 17px;
  margin-bottom: 15px;
}

.rp-controls-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  flex-wrap: wrap;
  gap: 12px;
}

.rp-controls h2 {
  font-size: 20px;
  margin: 0 0 9px;
}

.rp-chip {
  border-radius: 20px;
  background: #e4f5e9;
  color: #087a51;
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 900;
}

.rp-muted {
  color: #6a7b88;
  font-size: 11px;
  line-height: 1.55;
}

.rp-modes {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 16px 0;
}

.rp-modes label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
  cursor: pointer;
}

.rp-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-width: 760px;
  gap: 12px;
}

.rp-field-label {
  display: block;
  font-weight: 800;
  margin-bottom: 6px;
  font-size: 11px;
}

.rp-select {
  width: 100%;
  background: white;
  color: #183149;
  border: 1px solid #cbd8de;
  border-radius: 8px;
  padding: 10px;
  font-size: 12px;
}

.rp-custom {
  display: grid;
  grid-template-columns: repeat(13, minmax(0, 1fr));
  gap: 5px;
}

.rp-week-btn {
  border: 1px solid #cad9dc;
  border-radius: 6px;
  background: white;
  color: #173149;
  padding: 8px 2px;
  cursor: pointer;
}

.rp-week-btn.active {
  background: #09835d;
  border-color: #09835d;
  color: white;
}

.rp-week-btn:disabled {
  opacity: .3;
  cursor: not-allowed;
}

.rp-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 11px;
  margin-top: 14px;
  border-radius: 9px;
  background: #f0f7f3;
}

.rp-selected strong {
  color: #087a4f;
}

.rp-selected small {
  display: block;
  width: 100%;
  color: #6f887a;
}

.rp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 13px;
}

.rp-btn {
  border: none;
  border-radius: 8px;
  background: #0b8058;
  color: white;
  font-size: 12px;
  font-weight: 800;
  padding: 11px 14px;
  cursor: pointer;
}

.rp-btn.primary {
  background: #087d56;
}

.rp-btn.blue {
  background: #173e68;
}

.rp-btn.light {
  background: #e3f1eb;
  color: #146c4b;
}

.rp-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.rp-error {
  padding: 10px;
  border-radius: 7px;
  background: #fff0f0;
  color: #a52333;
  margin: 10px 0;
}

.rp-paper {
  background: white;
  border: 1px solid #cbd6df;
  padding: 16px;
  box-shadow: 0 5px 20px #12345612;
}

.rp-hidden-preview {
  display: none;
}

.rp-header {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  align-items: center;
  gap: 10px;
  padding: 10px;
  text-align: center;
  border-top: 5px solid #178d46;
  border-bottom: 5px solid #0b2d63;
}

.rp-company {
  text-align: left;
  font-size: 19px;
  font-weight: 900;
  color: #0c2d60;
}

.rp-company span {
  color: #168f47;
}

.rp-header h1 {
  margin: 0;
  font-size: 30px;
  color: #0b2c61;
}

.rp-header h2 {
  margin: 3px 0 6px;
  font-size: 13px;
  color: #168844;
}

.rp-header small {
  display: block;
  padding: 5px;
  background: #0b2c60;
  color: white;
}

.rp-emblem {
  width: 63px;
  height: 63px;
  justify-self: center;
  display: grid;
  place-items: center;
  border: 3px solid #d6b351;
  border-radius: 50%;
  text-align: center;
  font-weight: 900;
  color: #0b2c60;
}

.rp-intro {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 10px 0;
}

.rp-box {
  min-width: 0;
  border: 1px solid #a7b6c5;
  border-radius: 5px;
  padding: 9px;
}

.rp-section-title {
  display: inline-block;
  padding: 5px 11px;
  background: #0b2c61;
  color: white;
  font-size: 10px;
  font-weight: 900;
  margin-bottom: 6px;
}

.rp-info {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 5px;
  line-height: 1.5;
}

.rp-info span {
  overflow-wrap: anywhere;
}

.rp-description {
  font-size: 10px;
  line-height: 1.55;
  margin: 3px 0 6px;
}

.rp-section {
  margin: 10px 0;
}

.rp-scroll {
  overflow-x: auto;
}

.rp-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9px;
}

.rp-table th,
.rp-table td {
  border: 1px solid #c0ccd7;
  text-align: center;
  vertical-align: middle;
  padding: 5px 4px;
  overflow-wrap: anywhere;
}

.rp-table th {
  background: #eaf0f6;
  color: #163858;
}

.rp-competency th {
  font-weight: 900;
  font-size: 9px;
}

.rp-competency th:nth-child(1) {
  width: 5%;
}

.rp-competency th:nth-child(2) {
  width: 26%;
}

.rp-competency th:nth-child(3) {
  width: 15%;
}

.rp-competency th:nth-child(4) {
  width: 17%;
}

.rp-competency th:nth-child(5) {
  width: 17%;
}

.rp-competency th:nth-child(6) {
  width: 20%;
}

.rp-competency-name {
  text-align: left !important;
}

.rp-color {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
  margin-right: 7px;
}

.rp-status {
  display: inline-block;
  padding: 5px 7px;
  font-size: 8px;
  font-weight: 900;
  border-radius: 15px;
  white-space: nowrap;
}

.rp-status.achieved {
  background: #e0f4e9;
  color: #087a4b;
}

.rp-status.incomplete {
  background: #fff0e5;
  color: #ad6827;
}

.rp-competency-total {
  display: flex;
  justify-content: space-between;
  padding: 8px 11px;
  margin-top: 6px;
  border-radius: 6px;
  background: #e7f5ed;
  color: #0a7b52;
  font-size: 11px;
  font-weight: 900;
}

.rp-compact-wrap {
  margin-bottom: 8px;
}

.rp-compact-table {
  table-layout: fixed;
  font-size: 8px;
}

.rp-compact-table th {
  padding: 6px 3px;
  font-size: 8px;
  font-weight: 900;
  background: #eaf0f6;
}

.rp-compact-table td {
  padding: 5px 4px;
  vertical-align: middle;
}

.rp-compact-site {
  width: 60px;
}

.rp-site-value {
  font-weight: 900;
  background: #fafcfd;
  color: #0b2c61;
}

.rp-compact-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 4px 6px;
  line-height: 1.4;
  min-height: 18px;
}

.rp-entry-name {
  overflow-wrap: anywhere;
  font-size: 8px;
}

.rp-entry-score {
  color: #0b2c61;
  white-space: nowrap;
  font-size: 9px;
}

.rp-empty {
  color: #8795a0;
}

.rp-simper-table th {
  font-size: 8px;
  font-weight: 900;
  padding: 6px 3px;
}

.rp-simper-table td {
  font-size: 8px;
  padding: 6px 4px;
  line-height: 1.45;
}

.rp-simper-status {
  display: block;
  font-size: 9px;
  font-weight: 900;
}

.rp-simper-status.positive {
  color: #087a42;
}

.rp-simper-status.pending {
  color: #aa761a;
}

.rp-simper-detail {
  display: block;
  margin-top: 3px;
  font-size: 7px;
  color: #687b89;
  line-height: 1.35;
}

.rp-simper-summary {
  margin-top: 6px;
  padding: 7px 9px;
  background: #f7fafc;
  border: 1px solid #d8e5eb;
  font-size: 9px;
  line-height: 1.5;
}

.rp-small {
  font-size: 9px;
  color: #6d7e8c;
  line-height: 1.5;
  margin: 5px 0;
}

.rp-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 10px;
}

.rp-notes {
  font-size: 10px;
  line-height: 1.5;
}

.rp-notes p {
  margin: 4px 0 8px;
}

.rp-numbers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 6px 0;
}

.rp-number {
  padding: 9px;
  background: #f7fafc;
  border: 1px solid #dbe5eb;
  text-align: center;
}

.rp-number span {
  display: block;
  font-size: 9px;
}

.rp-number strong {
  display: block;
  margin-top: 3px;
  font-size: 22px;
  color: #0b2c60;
}

.rp-grade-row {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 7px;
}

.rp-grade {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border: 3px solid #1b8f4b;
  border-radius: 50%;
  color: #167b40;
  font-size: 29px;
  font-weight: 900;
  flex-shrink: 0;
}

.rp-date-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.rp-date-list span {
  border: 1px solid #e0e8eb;
  border-radius: 5px;
  padding: 6px 8px;
  font-size: 9px;
}

.rp-date-list strong {
  color: #087951;
  margin-right: 5px;
}

.rp-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-top: 14px;
  font-size: 9px;
  color: #697b8b;
}

.rp-signature {
  text-align: center;
  min-width: 185px;
}

.rp-sign-space {
  height: 32px;
}

.rp-sign-line {
  display: block;
  border-top: 1px solid #697b8b;
  padding-top: 5px;
  font-weight: bold;
  color: #173149;
}

/* =====================================
   RESPONSIVE TABLET DAN MOBILE
   ===================================== */

@media (max-width: 700px) {
  .rp-container {
    padding: 8px;
  }

  .rp-topbar {
    padding: 11px;
    gap: 8px;
  }

  .rp-brand {
    font-size: 16px;
  }

  .rp-account {
    max-width: 110px;
  }

  .rp-account strong {
    font-size: 10px;
  }

  .rp-controls {
    padding: 12px;
  }

  .rp-controls h2 {
    font-size: 18px;
  }

  .rp-modes {
    flex-direction: column;
    gap: 10px;
  }

  .rp-options {
    grid-template-columns: 1fr;
  }

  .rp-custom {
    grid-template-columns:
      repeat(5, minmax(0, 1fr));
  }

  .rp-paper {
    padding: 8px;
  }

  .rp-header {
    grid-template-columns: 1fr 2fr;
  }

  .rp-company {
    font-size: 12px;
  }

  .rp-header h1 {
    font-size: 22px;
  }

  .rp-header h2 {
    font-size: 10px;
  }

  .rp-emblem {
    display: none;
  }

  .rp-intro,
  .rp-bottom {
    grid-template-columns: 1fr;
  }

  .rp-info {
    grid-template-columns:
      90px minmax(0, 1fr);
  }

  .rp-competency {
    min-width: 620px;
  }

  .rp-compact-table {
    min-width: 500px;
  }

  .rp-simper-table {
    min-width: 620px;
  }

  .rp-actions .rp-btn {
    flex: 1;
  }

  .rp-date-list {
    grid-template-columns: 1fr 1fr;
  }

  .rp-footer {
    gap: 8px;
  }

  .rp-signature {
    min-width: 130px;
  }
}

/* =====================================
   CETAK PDF - A4 LANDSCAPE
   ===================================== */

@page {
  size: A4 landscape;
  margin: 7mm;
}

@media print {
  html,
  body {
    margin: 0 !important;
    padding: 0 !important;
    background: white !important;
  }

  .rp-topbar,
  .rp-controls {
    display: none !important;
  }

  .rp-root {
    background: white !important;
    min-height: 0 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .rp-container {
    max-width: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }

  .rp-paper,
  .rp-hidden-preview {
    display: block !important;
    padding: 0 !important;
    border: none !important;
    box-shadow: none !important;
  }

  .rp-header {
    display: grid !important;
    grid-template-columns:
      1fr 2fr 1fr !important;
    padding: 6px 8px !important;
    border-top-width: 3px !important;
    border-bottom-width: 3px !important;
    break-inside: avoid !important;
  }

  .rp-company {
    font-size: 16px !important;
  }

  .rp-header h1 {
    font-size: 25px !important;
  }

  .rp-header h2 {
    font-size: 12px !important;
  }

  .rp-emblem {
    display: grid !important;
    width: 49px !important;
    height: 49px !important;
    font-size: 9px !important;
  }

  .rp-intro {
    display: grid !important;
    grid-template-columns:
      1fr 1fr !important;
    gap: 7px !important;
    margin: 6px 0 !important;
    break-inside: avoid !important;
  }

  .rp-box {
    padding: 7px !important;
  }

  .rp-info {
    grid-template-columns:
      95px minmax(0, 1fr) !important;
    gap: 3px !important;
    line-height: 1.4 !important;
    font-size: 10px !important;
  }

  .rp-description {
    font-size: 9px !important;
    line-height: 1.35 !important;
    margin: 2px 0 5px !important;
  }

  .rp-section {
    margin: 7px 0 !important;
  }

  .rp-section-title {
    padding: 4px 9px !important;
    margin-bottom: 4px !important;
    font-size: 9px !important;
    break-after: avoid !important;
    page-break-after: avoid !important;
  }

  .rp-scroll {
    overflow: visible !important;
  }

  .rp-table,
  .rp-competency,
  .rp-compact-table,
  .rp-simper-table {
    width: 100% !important;
    min-width: 0 !important;
  }

  .rp-table th,
  .rp-table td {
    padding: 4px 3px !important;
  }

  .rp-competency th {
    font-size: 8px !important;
  }

  .rp-competency td {
    font-size: 8px !important;
  }

  .rp-status {
    font-size: 7px !important;
    padding: 4px 6px !important;
  }

  .rp-competency-total {
    padding: 6px !important;
    font-size: 10px !important;
  }

  .rp-compact-table {
    font-size: 8px !important;
  }

  .rp-compact-table th {
    font-size: 8px !important;
    padding: 4px 3px !important;
  }

  .rp-compact-table td {
    padding: 3px !important;
  }

  .rp-compact-site {
    width: 45px !important;
  }

  .rp-compact-entry {
    min-height: 14px !important;
    gap: 2px 4px !important;
  }

  .rp-entry-name,
  .rp-entry-score {
    font-size: 7px !important;
  }

  .rp-simper-table th {
    font-size: 7px !important;
    padding: 4px 2px !important;
  }

  .rp-simper-table td {
    font-size: 7px !important;
    padding: 4px 3px !important;
  }

  .rp-simper-status {
    font-size: 8px !important;
  }

  .rp-simper-detail {
    font-size: 7px !important;
  }

  .rp-simper-summary {
    font-size: 8px !important;
    padding: 5px 7px !important;
  }

  .rp-small {
    font-size: 8px !important;
    margin: 4px 0 !important;
  }

  .rp-bottom {
    display: grid !important;
    grid-template-columns:
      1fr 1fr !important;
    gap: 7px !important;
    margin-top: 7px !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .rp-notes {
    font-size: 9px !important;
  }

  .rp-notes p {
    margin: 3px 0 6px !important;
  }

  .rp-numbers {
    gap: 6px !important;
    margin: 4px 0 !important;
  }

  .rp-number {
    padding: 6px !important;
  }

  .rp-number strong {
    font-size: 18px !important;
  }

  .rp-grade-row {
    gap: 8px !important;
    margin-top: 4px !important;
  }

  .rp-grade {
    width: 43px !important;
    height: 43px !important;
    font-size: 23px !important;
  }

  .rp-date-list {
    display: grid !important;
    grid-template-columns:
      repeat(4, minmax(0, 1fr)) !important;
    gap: 4px !important;
  }

  .rp-date-list span {
    font-size: 8px !important;
    padding: 4px !important;
  }

  .rp-footer {
    margin-top: 7px !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .rp-sign-space {
    height: 20px !important;
  }

  .rp-compact-wrap {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    margin-bottom: 5px !important;
  }

  .rp-compact-table thead,
  .rp-simper-table thead {
    display: table-header-group;
  }

  .rp-compact-table tr,
  .rp-simper-table tr,
  .rp-competency tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  .rp-keep {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
}
`;
