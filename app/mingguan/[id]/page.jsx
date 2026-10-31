
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// EVALUASI MINGGUAN - KALENDER GLOBAL
// =====================================================

const TOTAL_WEEKS = 25;

const CATEGORIES = [
  {
    name: "Fisik",
    icon: "🏃",
    target: 25,
    unit: "km",
    aliases: ["fisik", "physical"],
  },
  {
    name: "Training",
    icon: "📚",
    target: 4,
    unit: "kegiatan",
    aliases: [
      "training",
      "internaltraining",
      "internal training",
      "pelatihan",
    ],
  },
  {
    name: "Sosialisasi",
    icon: "👥",
    target: 3,
    unit: "kegiatan",
    aliases: [
      "sosialisasi",
      "socialization",
    ],
  },
  {
    name: "Coaching",
    icon: "💬",
    target: 1,
    unit: "kegiatan",
    aliases: [
      "coaching",
      "pembinaan",
    ],
  },
  {
    name: "Orientasi Area",
    icon: "🧭",
    target: 2,
    unit: "kegiatan",
    aliases: [
      "orientasi",
      "orientasi area",
      "orientasiarea",
      "areaorientation",
    ],
  },
  {
    name: "Hazard",
    icon: "⚠️",
    target: 2,
    unit: "kegiatan",
    aliases: [
      "hazard",
      "hazardidentification",
      "identifikasi bahaya",
    ],
  },
];

// =====================================================
// UTILITAS
// =====================================================

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
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

function dateKey(date) {
  return date
    ? date.toISOString().slice(0, 10)
    : "";
}

function addDays(value, days) {
  const source =
    value instanceof Date
      ? value
      : parseDate(value);

  if (!source) return "";

  const result = new Date(source.getTime());

  result.setUTCDate(
    result.getUTCDate() + days
  );

  return dateKey(result);
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const part = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return (
    `${part("year")}-${part("month")}-${part("day")}`
  );
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatNumber(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function average(records) {
  const numbers = records
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  if (!numbers.length) return null;

  return (
    numbers.reduce(
      (sum, number) => sum + number,
      0
    ) / numbers.length
  );
}

function cappedPercent(actual, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (actual / target) * 100)
  );
}

function verificationPercent(verified, total) {
  if (!total) return 0;

  return cappedPercent(verified, total);
}

function isVerified(record) {
  return normalize(record.status) === "verified";
}

function isPending(record) {
  return normalize(record.status) === "pending";
}

function getRole(profile) {
  const role = normalize(profile?.role);

  if (role === "admin") return "admin";
  if (role === "mentor") return "mentor";

  if (["participant", "peserta"].includes(role)) {
    return "participant";
  }

  return null;
}

// =====================================================
// KALENDER GLOBAL WEEK 01-25
//
// WEEK 01 = 12-18 SEPTEMBER 2026
// 19 SEPTEMBER TIDAK TERMASUK MINGGU
// WEEK 02 = 20-26 SEPTEMBER 2026
// WEEK 07 = 25-31 OKTOBER 2026
// WEEK 08 = 01-07 NOVEMBER 2026
// WEEK 25 = 28 FEBRUARI-06 MARET 2027
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

function getGlobalWeek(dateValue) {
  const date = String(dateValue ?? "").slice(0, 10);

  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(
      (item) =>
        date >= item.start &&
        date <= item.end
    )?.week ?? null
  );
}

function getWeekRange(week) {
  return (
    GLOBAL_WEEKS.find(
      (item) => item.week === Number(week)
    ) || null
  );
}

function getParticipantRange(program, week) {
  const global = getWeekRange(week);

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startDate = String(
    program.start_date
  ).slice(0, 10);

  const endDate = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startDate
      ? global.start
      : startDate;

  const end =
    endDate && endDate < global.end
      ? endDate
      : global.end;

  if (start > end) return null;

  return { start, end };
}

function getAvailableWeeks(program) {
  if (!program) return [];

  return GLOBAL_WEEKS.filter(
    (item) =>
      getParticipantRange(program, item.week)
  );
}

function isWithinProgram(dateValue, program) {
  const date = String(dateValue ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  const start = String(program.start_date).slice(0, 10);

  if (date < start) return false;

  if (
    parseDate(program.end_date) &&
    date > String(program.end_date).slice(0, 10)
  ) {
    return false;
  }

  return true;
}

function selectInitialWeek(program, achievements = []) {
  const available = getAvailableWeeks(program);

  if (!available.length) return 1;

  const now = todayWITA();

  const current = available.find((item) => {
    const range = getParticipantRange(
      program,
      item.week
    );

    return (
      range &&
      now >= range.start &&
      now <= range.end
    );
  });

  if (current) return current.week;

  const recorded = achievements
    .filter((item) =>
      isWithinProgram(item.activity_date, program)
    )
    .map((item) =>
      getGlobalWeek(item.activity_date)
    )
    .filter(
      (week) =>
        week !== null &&
        available.some((item) => item.week === week)
    );

  if (recorded.length) {
    return Math.max(...recorded);
  }

  const upcoming = available.find(
    (item) => item.end >= now
  );

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// =====================================================
// PEMETAAN KATEGORI
// =====================================================

function resolveCategory(typeCode, types) {
  const matched = types.find(
    (type) =>
      normalize(type.code) === normalize(typeCode)
  );

  const candidates = [
    typeCode,
    matched?.name,
  ].filter(Boolean);

  return (
    CATEGORIES.find((category) =>
      candidates.some((candidate) =>
        category.aliases.some(
          (alias) =>
            normalize(candidate) === normalize(alias)
        )
      )
    )?.name || null
  );
}

function getActual(category, verifiedRecords) {
  if (category.name !== "Fisik") {
    return verifiedRecords.length;
  }

  const meters = verifiedRecords.reduce(
    (sum, item) => {
      const distance = Number(item.distance_km);

      if (
        !Number.isFinite(distance) ||
        distance <= 0
      ) {
        return sum;
      }

      return sum + Math.round(distance * 1000);
    },
    0
  );

  return meters / 1000;
}

function getLatestSamapta(records) {
  const sorted = [...records].sort((a, b) => {
    const byDate = String(
      b.test_date || ""
    ).localeCompare(
      String(a.test_date || "")
    );

    if (byDate !== 0) return byDate;

    return String(b.id || "").localeCompare(
      String(a.id || "")
    );
  });

  return sorted[0] || null;
}

// =====================================================
// PDF TANPA LIBRARY EKSTERNAL
// A4 - DATA WEEK GLOBAL TERPILIH
// =====================================================

function createWeeklyPdf(report) {
  const safe = (value) =>
    String(value ?? "-")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  const pages = [];
  let current = [];
  let y = 795;

  function newPage() {
    if (current.length) {
      pages.push(current.join("\n"));
    }

    current = [];
    y = 795;
  }

  function write(value, x = 44, size = 10, bold = false) {
    const text = safe(value);

    const maxLength =
      x >= 58 ? 85 : 91;

    for (
      let i = 0;
      i < Math.max(1, text.length);
      i += maxLength
    ) {
      if (y < 53) newPage();

      const chunk = text.slice(
        i,
        i + maxLength
      );

      current.push(
        `BT /${bold ? "F2" : "F1"} ${size} Tf ` +
        `1 0 0 1 ${x} ${y} Tm (${chunk}) Tj ET`
      );

      y -= size + 7;

      if (!text.length) break;
    }
  }

  function line() {
    if (y < 60) newPage();

    current.push(
      `0.7 w 44 ${y} m 551 ${y} l S`
    );

    y -= 16;
  }

  write(
    "OJT MINETRACK - EVALUASI MINGGUAN",
    44,
    15,
    true
  );

  write(
    "LAPORAN ACHIEVEMENT KALENDER GLOBAL",
    44,
    10,
    true
  );

  line();

  write(`Peserta       : ${report.name}`);
  write(`Site          : ${report.site}`);
  write(`Minggu Global : ${report.weekLabel}`);
  write(`Periode       : ${report.period}`);
  write(`Periode OJT   : ${report.participantPeriod}`);
  write(`Filter        : ${report.filter}`);

  line();

  write("RINGKASAN ACHIEVEMENT", 44, 12, true);

  write(
    `Total kegiatan: ${report.total} | ` +
    `Verified: ${report.verified} | ` +
    `Pending: ${report.pending}`
  );

  write(
    `Verifikasi: ${report.verification}% | ` +
    `Pencapaian target: ${report.achievement}%`
  );

  write(
    `Kategori tercapai: ${report.achieved}/6`
  );

  line();

  write("PENCAPAIAN PER KATEGORI", 44, 12, true);

  report.categories.forEach((category) => {
    write(category.name, 44, 10, true);

    write(
      `Realisasi: ${category.actualText} | ` +
      `Target: ${category.targetText} | ` +
      `Capaian: ${category.achievementText}`,
      58,
      9
    );

    write(
      `Total: ${category.total} | ` +
      `Verified: ${category.verified} | ` +
      `Pending: ${category.pending}`,
      58,
      9
    );
  });

  line();

  write("RINGKASAN PENILAIAN", 44, 12, true);

  write(
    `Post-Test: ${report.postCount} nilai | ` +
    `Rata-rata: ${report.postAverage}`
  );

  write(
    `Praktik: ${report.practiceCount} nilai | ` +
    `Rata-rata: ${report.practiceAverage}`
  );

  write(
    `Samapta: ${report.samaptaCount} catatan | ` +
    `Nilai terbaru: ${report.samaptaLatest}`
  );

  line();

  write("RIWAYAT KEGIATAN", 44, 12, true);

  if (!report.activities.length) {
    write("Belum ada kegiatan sesuai filter.");
  }

  report.activities.forEach((activity, index) => {
    write(
      `${index + 1}. ${activity.date} - ${activity.category}`,
      44,
      9,
      true
    );

    write(
      `Status: ${activity.status}` +
      (
        activity.distance
          ? ` | Jarak: ${activity.distance} km`
          : ""
      ),
      58,
      9
    );

    if (activity.description) {
      write(
        activity.description,
        58,
        8
      );
    }
  });

  newPage();

  const objects = [null];

  const reserve = () => {
    objects.push("");
    return objects.length - 1;
  };

  const catalogId = reserve();
  const pagesId = reserve();
  const normalFontId = reserve();
  const boldFontId = reserve();

  objects[normalFontId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  objects[boldFontId] =
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  const pageIds = [];

  pages.forEach((content) => {
    const contentId = reserve();
    const pageId = reserve();

    objects[contentId] =
      `<< /Length ${content.length} >>\n` +
      `stream\n${content}\nendstream`;

    objects[pageId] =
      `<< /Type /Page /Parent ${pagesId} 0 R ` +
      `/MediaBox [0 0 595 842] ` +
      `/Resources << /Font << ` +
      `/F1 ${normalFontId} 0 R ` +
      `/F2 ${boldFontId} 0 R ` +
      `>> >> ` +
      `/Contents ${contentId} 0 R >>`;

    pageIds.push(pageId);
  });

  objects[pagesId] =
    `<< /Type /Pages /Kids [` +
    pageIds.map((id) => `${id} 0 R`).join(" ") +
    `] /Count ${pageIds.length} >>`;

  objects[catalogId] =
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets.push(pdf.length);

    pdf +=
      `${i} 0 obj\n` +
      `${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;

  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i++) {
    pdf +=
      `${String(offsets[i]).padStart(10, "0")} ` +
      `00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length} ` +
    `/Root ${catalogId} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);

  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 255;
  }

  const blob = new Blob([bytes], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `Evaluasi_Mingguan_Week_${String(
      report.week
    ).padStart(2, "0")}.pdf`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// =====================================================
// PROGRESS BAR
// =====================================================

function ProgressBar({ value, label }) {
  const percent = Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );

  return (
    <div
      className="wm-progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="wm-progress-fill"
        style={{
          width: `${percent}%`,
        }}
      />
    </div>
  );
}

// =====================================================
// KOMPONEN UTAMA
// =====================================================

export default function EvaluasiMingguanPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = getRole(profile);

  // ===================================================
  // AMBIL DATA SUPABASE
  // ===================================================

  const loadRecords = useCallback(async (id) => {
    const requests = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description," +
          "distance_km,status,verified_by,created_at"
        )
        .eq("program_id", id)
        .order("activity_date", {
          ascending: false,
        }),

      supabase
        .from("post_test_scores")
        .select(
          "id,test_date,score,notes,created_at"
        )
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,practice_date,practice_name,score"
        )
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value"
        )
        .eq("program_id", id),
    ]);

    const labels = [
      "Kategori",
      "Achievement",
      "Post-Test",
      "Praktik",
      "Samapta",
    ];

    requests.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    });

    return {
      types: requests[0].data || [],
      achievements: requests[1].data || [],
      postTests: requests[2].data || [],
      practices: requests[3].data || [],
      samapta: requests[4].data || [],
    };
  }, []);

  const applyRecords = useCallback((records) => {
    setTypes(records.types);
    setAchievements(records.achievements);
    setPostTests(records.postTests);
    setPractices(records.practices);
    setSamapta(records.samapta);
  }, []);

  // ===================================================
  // AUTHENTICATION DAN AKSES
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
          data: userProfile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        const currentRole = getRole(userProfile);

        if (!currentRole) {
          throw new Error(
            "Akun tidak memiliki akses Evaluasi Mingguan."
          );
        }

        let query = supabase
          .from("ojt_programs")
          .select(
            "id,participant_id,mentor_id,site,status," +
            "start_date,end_date," +
            "peserta:profiles!ojt_programs_participant_id_fkey" +
            "(full_name,department)"
          )
          .eq("id", programId);

        if (currentRole === "mentor") {
          query = query.eq(
            "mentor_id",
            user.id
          );
        }

        if (currentRole === "participant") {
          query = query.eq(
            "participant_id",
            user.id
          );
        }

        const {
          data: ojtProgram,
          error: programError,
        } = await query.maybeSingle();

        if (programError) throw programError;

        if (!ojtProgram) {
          throw new Error(
            "Program tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        if (!parseDate(ojtProgram.start_date)) {
          throw new Error(
            "Tanggal mulai program OJT tidak valid."
          );
        }

        if (
          ojtProgram.end_date &&
          !parseDate(ojtProgram.end_date)
        ) {
          throw new Error(
            "Tanggal selesai program OJT tidak valid."
          );
        }

        if (currentRole === "participant") {
          const status = normalize(
            ojtProgram.status
          );

          if (
            ![
              "active",
              "approved",
              "aktif",
            ].includes(status)
          ) {
            throw new Error(
              "Evaluasi Mingguan hanya tersedia untuk " +
              "peserta dengan program aktif atau disetujui."
            );
          }
        }

        const records = await loadRecords(programId);

        if (!active) return;

        setProfile(userProfile);
        setProgram(ojtProgram);
        applyRecords(records);

        // FIX: minggu dipilih berdasarkan
        // kalender global, bukan start_date peserta.

        setSelectedWeek(
          selectInitialWeek(
            ojtProgram,
            records.achievements
          )
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memuat Evaluasi Mingguan."
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
  }, [
    programId,
    router,
    loadRecords,
    applyRecords,
  ]);

  // ===================================================
  // REFRESH
  // ===================================================

  const refresh = useCallback(async () => {
    if (
      !programId ||
      loading ||
      refreshing ||
      !program
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const records = await loadRecords(programId);
      applyRecords(records);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }, [
    programId,
    program,
    loading,
    refreshing,
    loadRecords,
    applyRecords,
  ]);

  // ===================================================
  // MINGGU YANG TERSEDIA UNTUK PESERTA
  // ===================================================

  const availableWeeks = useMemo(
    () => getAvailableWeeks(program),
    [program]
  );

  const selectedIndex = availableWeeks.findIndex(
    (item) => item.week === selectedWeek
  );

  const period = useMemo(
    () => getWeekRange(selectedWeek),
    [selectedWeek]
  );

  const participantPeriod = useMemo(
    () =>
      getParticipantRange(
        program,
        selectedWeek
      ),
    [program, selectedWeek]
  );

  // ===================================================
  // FILTER TANGGAL GLOBAL + PERIODE OJT
  // ===================================================

  const filterWeekly = useCallback(
    (records, dateField) =>
      records.filter((item) => {
        const date = item[dateField];

        return (
          isWithinProgram(date, program) &&
          getGlobalWeek(date) === selectedWeek
        );
      }),
    [program, selectedWeek]
  );

  const weeklyAchievements = useMemo(
    () =>
      filterWeekly(
        achievements,
        "activity_date"
      ),
    [achievements, filterWeekly]
  );

  const weeklyPostTests = useMemo(
    () =>
      filterWeekly(
        postTests,
        "test_date"
      ),
    [postTests, filterWeekly]
  );

  const weeklyPractices = useMemo(
    () =>
      filterWeekly(
        practices,
        "practice_date"
      ),
    [practices, filterWeekly]
  );

  const weeklySamapta = useMemo(
    () =>
      filterWeekly(
        samapta,
        "test_date"
      ),
    [samapta, filterWeekly]
  );

  // ===================================================
  // MONITORING PER KATEGORI
  //
  // Progress target berbeda dengan
  // persentase verifikasi.
  // ===================================================

  const categoryMonitoring = useMemo(() => {
    return CATEGORIES.map((category) => {
      const records = weeklyAchievements.filter(
        (item) =>
          resolveCategory(
            item.type_code,
            types
          ) === category.name
      );

      const verifiedRecords = records.filter(
        isVerified
      );

      const verified = verifiedRecords.length;
      const total = records.length;
      const pending = records.filter(isPending).length;

      const actual = getActual(
        category,
        verifiedRecords
      );

      const achievement = cappedPercent(
        actual,
        category.target
      );

      return {
        ...category,
        records,
        total,
        verified,
        pending,
        actual,
        achievement,
        achieved:
          actual >= category.target,
        verification: verificationPercent(
          verified,
          total
        ),
      };
    });
  }, [
    weeklyAchievements,
    types,
  ]);

  // ===================================================
  // RINGKASAN MINGGUAN
  // ===================================================

  const summary = useMemo(() => {
    const total = weeklyAchievements.length;

    const verified = weeklyAchievements.filter(
      isVerified
    ).length;

    const pending = weeklyAchievements.filter(
      isPending
    ).length;

    const overallAchievement =
      categoryMonitoring.length
        ? categoryMonitoring.reduce(
            (sum, item) =>
              sum + item.achievement,
            0
          ) / categoryMonitoring.length
        : 0;

    return {
      total,
      verified,
      pending,

      verification:
        verificationPercent(verified, total),

      achievement:
        overallAchievement,

      achieved:
        categoryMonitoring.filter(
          (item) => item.achieved
        ).length,

      postAverage:
        average(weeklyPostTests),

      practiceAverage:
        average(weeklyPractices),

      samaptaLatest:
        getLatestSamapta(weeklySamapta),
    };
  }, [
    weeklyAchievements,
    weeklyPostTests,
    weeklyPractices,
    weeklySamapta,
    categoryMonitoring,
  ]);

  // ===================================================
  // TANDA MINGGU YANG MEMILIKI AKTIVITAS
  // ===================================================

  const activityWeeks = useMemo(() => {
    const weeks = new Set();

    function add(date) {
      if (!isWithinProgram(date, program)) return;

      const week = getGlobalWeek(date);

      if (week !== null) {
        weeks.add(week);
      }
    }

    achievements.forEach(
      (item) => add(item.activity_date)
    );

    postTests.forEach(
      (item) => add(item.test_date)
    );

    practices.forEach(
      (item) => add(item.practice_date)
    );

    samapta.forEach(
      (item) => add(item.test_date)
    );

    return weeks;
  }, [
    achievements,
    postTests,
    practices,
    samapta,
    program,
  ]);

  const weekHasActivity =
    weeklyAchievements.length > 0 ||
    weeklyPostTests.length > 0 ||
    weeklyPractices.length > 0 ||
    weeklySamapta.length > 0;

  // ===================================================
  // FILTER KATEGORI
  // ===================================================

  const visibleCategories = useMemo(() => {
    if (filter === "active") {
      return categoryMonitoring.filter(
        (item) => item.total > 0
      );
    }

    if (filter === "empty") {
      return categoryMonitoring.filter(
        (item) => item.total === 0
      );
    }

    return categoryMonitoring;
  }, [
    categoryMonitoring,
    filter,
  ]);

  // ===================================================
  // IDENTITAS PESERTA
  // ===================================================

  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const periodText = period
    ? `${formatDate(period.start)} – ${formatDate(period.end)}`
    : "-";

  const participantPeriodText = participantPeriod
    ? `${formatDate(participantPeriod.start)} – ${formatDate(participantPeriod.end)}`
    : "-";

  // ===================================================
  // REPORT PDF
  // ===================================================

  function buildReport() {
    const filterLabels = {
      all: "Semua Kategori",
      active: "Ada Aktivitas",
      empty: "Belum Ada Aktivitas",
    };

    return {
      week: selectedWeek,
      name: participantName,
      site: program?.site || "-",
      weekLabel: weekLabel(selectedWeek),
      period: periodText,
      participantPeriod: participantPeriodText,
      filter:
        filterLabels[filter] || "Semua Kategori",

      total: summary.total,
      verified: summary.verified,
      pending: summary.pending,

      verification:
        formatNumber(summary.verification, 2),

      achievement:
        formatNumber(summary.achievement, 2),

      achieved: summary.achieved,

      categories: visibleCategories.map(
        (category) => ({
          ...category,
          actualText:
            `${formatNumber(
              category.actual,
              category.name === "Fisik" ? 3 : 0
            )} ${category.unit}`,

          targetText:
            `${category.target} ${category.unit}`,

          achievementText:
            `${formatNumber(
              category.achievement,
              2
            )}%`,
        })
      ),

      postCount: weeklyPostTests.length,
      postAverage:
        summary.postAverage === null
          ? "-"
          : formatNumber(
              summary.postAverage,
              2
            ),

      practiceCount: weeklyPractices.length,
      practiceAverage:
        summary.practiceAverage === null
          ? "-"
          : formatNumber(
              summary.practiceAverage,
              2
            ),

      samaptaCount: weeklySamapta.length,
      samaptaLatest:
        summary.samaptaLatest?.score == null
          ? "-"
          : formatNumber(
              summary.samaptaLatest.score,
              2
            ),

      activities: visibleCategories.flatMap(
        (category) =>
          category.records.map((item) => ({
            date: formatDate(
              item.activity_date
            ),
            category: category.name,
            status: item.status || "-",
            description:
              item.description || "",
            distance:
              category.name === "Fisik" &&
              Number(item.distance_km) > 0
                ? formatNumber(
                    item.distance_km,
                    3
                  )
                : null,
          }))
      ),
    };
  }

  function downloadPdf() {
    if (!participantPeriod) return;

    try {
      setError("");
      createWeeklyPdf(buildReport());
    } catch (err) {
      setError(
        err?.message || "Gagal membuat PDF."
      );
    }
  }

  function printReport() {
    window.print();
  }

  function goBack() {
    router.back();
  }

  // ===================================================
  // LOADING
  // ===================================================

  if (loading) {
    return (
      <main className="wm-page">
        <style>{css}</style>

        <div className="wm-shell">
          <div className="wm-card">
            <h2>OJT MineTrack</h2>
            <p className="wm-muted">
              Memuat Evaluasi Mingguan...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="wm-page">
        <style>{css}</style>

        <div className="wm-shell">
          <div className="wm-card">
            <h2>
              Evaluasi Mingguan Tidak Dapat Ditampilkan
            </h2>

            <p className="wm-alert">
              {error || "Data program tidak tersedia."}
            </p>

            <button
              type="button"
              className="wm-button"
              onClick={goBack}
            >
              ← Kembali
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===================================================
  // TAMPILAN UTAMA
  // ===================================================

  return (
    <main className="wm-page">
      <style>{css}</style>

      <div className="wm-shell">
        {/* HEADER */}

        <header className="wm-top">
          <div>
            <div className="wm-eyebrow">
              OJT MineTrack v2.0
            </div>

            <h1 className="wm-title">
              Evaluasi Mingguan
            </h1>

            <div className="wm-subtitle">
              Monitoring pencapaian enam kategori
              dan penilaian berdasarkan Kalender
              Global Week 01–25.
            </div>
          </div>

          <div className="wm-actions wm-no-print">
            <button
              type="button"
              className="wm-button"
              onClick={goBack}
            >
              ← Kembali
            </button>

            <button
              type="button"
              className="wm-button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="wm-button"
              onClick={printReport}
              disabled={!participantPeriod}
            >
              Cetak Rekap
            </button>

            <button
              type="button"
              className="wm-button wm-primary"
              onClick={downloadPdf}
              disabled={!participantPeriod}
            >
              ↓ Unduh PDF
            </button>
          </div>
        </header>

        {error && (
          <div className="wm-alert" role="alert">
            {error}
          </div>
        )}

        {/* PROFIL DAN PILIH MINGGU */}

        <section className="wm-card">
          <div className="wm-profile">
            <div>
              <div className="wm-muted">
                Nama Peserta
              </div>

              <div className="wm-profile-name">
                {participantName}
              </div>

              <div className="wm-muted">
                Site: {program.site || "-"}
                {" · "}
                {participant?.department || "OJT"}
              </div>

              <div className="wm-muted">
                Periode OJT:{" "}
                {formatDate(program.start_date)}
                {" – "}
                {formatDate(program.end_date)}
              </div>
            </div>

            <div className="wm-profile-right">
              <span className="wm-pill">
                {role === "admin"
                  ? "Admin"
                  : role === "mentor"
                  ? "Mentor"
                  : "Peserta"}
              </span>

              <span className="wm-profile-user">
                {profile?.full_name || "-"}
              </span>
            </div>
          </div>

          <div className="wm-weekbar">
            <div className="wm-controlgroup">
              <button
                type="button"
                className="wm-button wm-no-print"
                disabled={selectedIndex <= 0}
                onClick={() => {
                  if (selectedIndex > 0) {
                    setSelectedWeek(
                      availableWeeks[selectedIndex - 1].week
                    );
                  }
                }}
              >
                ← Sebelumnya
              </button>

              <select
                className="wm-week-select wm-no-print"
                aria-label="Pilih Minggu Global"
                value={
                  availableWeeks.some(
                    (item) => item.week === selectedWeek
                  )
                    ? selectedWeek
                    : ""
                }
                onChange={(event) =>
                  setSelectedWeek(
                    Number(event.target.value)
                  )
                }
              >
                {!availableWeeks.length && (
                  <option value="">
                    Tidak ada minggu
                  </option>
                )}

                {availableWeeks.map((item) => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    {weekLabel(item.week)}
                    {activityWeeks.has(item.week)
                      ? " •"
                      : ""}
                    {" · "}
                    {formatDate(item.start)}
                    {" – "}
                    {formatDate(item.end)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="wm-button wm-no-print"
                disabled={
                  selectedIndex < 0 ||
                  selectedIndex >= availableWeeks.length - 1
                }
                onClick={() => {
                  if (
                    selectedIndex >= 0 &&
                    selectedIndex < availableWeeks.length - 1
                  ) {
                    setSelectedWeek(
                      availableWeeks[selectedIndex + 1].week
                    );
                  }
                }}
              >
                Berikutnya →
              </button>

              <strong className="wm-current-week">
                {weekLabel(selectedWeek)}
              </strong>
            </div>

            <select
              className="wm-week-select wm-no-print"
              aria-label="Filter kategori"
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value)
              }
            >
              <option value="all">
                Semua Kategori
              </option>

              <option value="active">
                Ada Aktivitas
              </option>

              <option value="empty">
                Belum Ada Aktivitas
              </option>
            </select>
          </div>

          <div className="wm-date">
            <strong>Kalender Global:</strong>{" "}
            {periodText}
          </div>

          <div className="wm-date">
            <strong>Periode Aktif Peserta:</strong>{" "}
            {participantPeriodText}
          </div>

          {!availableWeeks.length && (
            <div className="wm-alert wm-mt">
              Periode peserta tidak beririsan
              dengan Kalender Global Week 01–25.
            </div>
          )}
        </section>

        {/* STATISTIK GLOBAL MINGGU */}

        <section className="wm-stats">
          <div className="wm-stat">
            <div className="wm-stat-label">
              Total Achievement
            </div>

            <div className="wm-stat-value">
              {summary.total}
            </div>

            <small>
              {weekLabel(selectedWeek)}
            </small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Verified
            </div>

            <div className="wm-stat-value">
              {summary.verified}
            </div>

            <small>
              Kegiatan terverifikasi
            </small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Pending
            </div>

            <div className="wm-stat-value">
              {summary.pending}
            </div>

            <small>
              Data lama belum terverifikasi
            </small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Persentase Verifikasi
            </div>

            <div className="wm-stat-value">
              {formatNumber(
                summary.verification,
                2
              )}
              %
            </div>

            <small>
              Verified / Total kegiatan
            </small>
          </div>
        </section>

        {/* PROGRESS ACHIEVEMENT */}

        <section className="wm-card">
          <div className="wm-sectionhead">
            <div>
              <h2 className="wm-section-title">
                Progress Achievement Mingguan
              </h2>

              <div className="wm-muted">
                Rata-rata enam kategori terhadap
                target mingguan.
              </div>
            </div>

            <span className="wm-pill">
              {summary.achieved}/6 Kategori Tercapai
            </span>
          </div>

          <div className="wm-overall">
            <div>
              <div className="wm-overall-label">
                Pencapaian Target
              </div>

              <div className="wm-muted">
                Maksimal 100% per kategori
              </div>
            </div>

            <div className="wm-overall-value">
              {formatNumber(
                summary.achievement,
                2
              )}
              %
            </div>
          </div>

          <ProgressBar
            value={summary.achievement}
            label="Pencapaian target Achievement"
          />
        </section>

        {/* KATEGORI */}

        <section className="wm-card wm-mt">
          <div className="wm-sectionhead">
            <div>
              <h2 className="wm-section-title">
                Monitoring per Kategori
              </h2>

              <div className="wm-muted">
                Target dan realisasi pada{" "}
                {weekLabel(selectedWeek)}
              </div>
            </div>

            <span className="wm-pill">
              {visibleCategories.length} Kategori
            </span>
          </div>

          {visibleCategories.length === 0 ? (
            <div className="wm-empty">
              Tidak ada kategori sesuai filter.
            </div>
          ) : (
            <div className="wm-category-list">
              {visibleCategories.map((category) => (
                <div
                  className="wm-category"
                  key={category.name}
                >
                  <div className="wm-cat-top">
                    <div className="wm-cat-info">
                      <span className="wm-cat-icon">
                        {category.icon}
                      </span>

                      <div>
                        <div className="wm-cat-name">
                          {category.name}
                        </div>

                        <div className="wm-muted">
                          {category.total
                            ? `${category.total} kegiatan tercatat`
                            : "Belum ada kegiatan"}
                        </div>
                      </div>
                    </div>

                    <span className="wm-cat-badge">
                      {category.achieved
                        ? "Target Tercapai"
                        : "Belum Tercapai"}
                    </span>
                  </div>

                  <div className="wm-target-row">
                    <div>
                      <span>Realisasi</span>

                      <strong>
                        {formatNumber(
                          category.actual,
                          category.name === "Fisik"
                            ? 3
                            : 0
                        )}
                        {" "}
                        {category.unit}
                      </strong>
                    </div>

                    <div>
                      <span>Target</span>

                      <strong>
                        {category.target}
                        {" "}
                        {category.unit}
                      </strong>
                    </div>

                    <div>
                      <span>Pencapaian</span>

                      <strong>
                        {formatNumber(
                          category.achievement,
                          2
                        )}
                        %
                      </strong>
                    </div>
                  </div>

                  <ProgressBar
                    value={category.achievement}
                    label={`Pencapaian ${category.name}`}
                  />

                  <div className="wm-progress-label">
                    <span>
                      Progress terhadap target
                    </span>

                    <strong>
                      {formatNumber(
                        category.achievement,
                        2
                      )}
                      %
                    </strong>
                  </div>

                  <div className="wm-cat-stats">
                    <div className="wm-cat-stat">
                      <b>{category.total}</b>
                      <span>Total</span>
                    </div>

                    <div className="wm-cat-stat">
                      <b>{category.verified}</b>
                      <span>Verified</span>
                    </div>

                    <div className="wm-cat-stat">
                      <b>{category.pending}</b>
                      <span>Pending</span>
                    </div>

                    <div className="wm-cat-stat">
                      <b>
                        {formatNumber(
                          category.verification,
                          2
                        )}
                        %
                      </b>
                      <span>Verifikasi</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PENILAIAN MINGGUAN */}

        <section className="wm-assessments">
          <div className="wm-card">
            <div className="wm-assessment-title">
              📘 Post-Test
            </div>

            <div className="wm-assessment-value">
              {summary.postAverage === null
                ? "-"
                : formatNumber(
                    summary.postAverage,
                    2
                  )}
            </div>

            <div className="wm-muted">
              Rata-rata nilai pada minggu ini
            </div>

            <div className="wm-date">
              {weeklyPostTests.length} nilai tercatat
            </div>
          </div>

          <div className="wm-card">
            <div className="wm-assessment-title">
              📝 Praktik
            </div>

            <div className="wm-assessment-value">
              {summary.practiceAverage === null
                ? "-"
                : formatNumber(
                    summary.practiceAverage,
                    2
                  )}
            </div>

            <div className="wm-muted">
              Rata-rata nilai pada minggu ini
            </div>

            <div className="wm-date">
              {weeklyPractices.length} penilaian tercatat
            </div>
          </div>

          <div className="wm-card">
            <div className="wm-assessment-title">
              🏃 Samapta
            </div>

            <div className="wm-assessment-value">
              {summary.samaptaLatest?.score == null
                ? "-"
                : formatNumber(
                    summary.samaptaLatest.score,
                    2
                  )}
            </div>

            <div className="wm-muted">
              Nilai catatan terbaru pada minggu ini
            </div>

            <div className="wm-date">
              {weeklySamapta.length} catatan tercatat
            </div>
          </div>
        </section>

        {/* RIWAYAT KEGIATAN */}

        <section className="wm-card wm-mt">
          <div className="wm-sectionhead">
            <div>
              <h2 className="wm-section-title">
                Riwayat Achievement Mingguan
              </h2>

              <div className="wm-muted">
                Kegiatan sesuai minggu global
                dan filter kategori.
              </div>
            </div>

            <span className="wm-pill">
              {visibleCategories.reduce(
                (sum, category) =>
                  sum + category.total,
                0
              )} Kegiatan
            </span>
          </div>

          {visibleCategories.every(
            (category) =>
              category.records.length === 0
          ) ? (
            <div className="wm-empty">
              Belum ada Achievement sesuai filter
              pada {weekLabel(selectedWeek)}.
            </div>
          ) : (
            visibleCategories.flatMap((category) =>
              category.records.map((item) => (
                <div
                  className="wm-activity"
                  key={`${category.name}-${item.id}`}
                >
                  <div>
                    <div className="wm-activity-title">
                      {category.icon}
                      {" "}
                      {category.name}
                      {" · "}
                      {formatDate(
                        item.activity_date
                      )}
                    </div>

                    {item.description && (
                      <div className="wm-activity-description">
                        {item.description}
                      </div>
                    )}

                    {category.name === "Fisik" &&
                      Number(item.distance_km) > 0 && (
                        <div className="wm-activity-description">
                          Jarak:{" "}
                          {formatNumber(
                            item.distance_km,
                            3
                          )} km
                        </div>
                      )}
                  </div>

                  <strong
                    className={
                      isVerified(item)
                        ? "wm-verified"
                        : "wm-pending"
                    }
                    style={{
                      fontSize: 12,
                    }}
                  >
                    {isVerified(item)
                      ? "Verified"
                      : isPending(item)
                      ? "Pending"
                      : item.status || "-"}
                  </strong>
                </div>
              ))
            )
          )}
        </section>

        {/* KESIMPULAN */}

        <section className="wm-card wm-mt">
          <h2 className="wm-section-title">
            Kesimpulan Mingguan
          </h2>

          <p className="wm-muted" style={{ marginTop: 12 }}>
            Pada{" "}
            <strong>{weekLabel(selectedWeek)}</strong>
            {" "}({periodText}), tercatat{" "}
            <strong>
              {summary.total} Achievement
            </strong>
            , terdiri dari{" "}
            <strong>
              {summary.verified} Verified
            </strong>
            {" "}dan{" "}
            <strong>
              {summary.pending} Pending
            </strong>
            .
          </p>

          <p className="wm-muted">
            Persentase verifikasi kegiatan adalah{" "}
            <strong>
              {formatNumber(
                summary.verification,
                2
              )}%
            </strong>
            , sedangkan rata-rata pencapaian
            enam kategori terhadap target
            mingguan adalah{" "}
            <strong>
              {formatNumber(
                summary.achievement,
                2
              )}%
            </strong>
            .
          </p>

          <p className="wm-muted">
            Sebanyak{" "}
            <strong>
              {summary.achieved} dari 6 kategori
            </strong>
            {" "}telah memenuhi target minggu ini.
          </p>

          <p className="wm-muted">
            {weekHasActivity
              ? "Post-Test, Praktik, dan Samapta mengikuti tanggal penilaian pada Week Global yang dipilih. Kegiatan Pending tetap tercatat, tetapi tidak dihitung sebagai pencapaian target."
              : "Belum terdapat aktivitas Achievement, Post-Test, Praktik, atau Samapta pada minggu ini."}
          </p>
        </section>

        <div className="wm-footer">
          OJT MineTrack v2.0
          {" · "}
          Evaluasi Mingguan
          {" · "}
          {weekLabel(selectedWeek)}
        </div>
      </div>
    </main>
  );
}

// =====================================================
// STYLES
// =====================================================

const css = `
.wm-page {
  min-height: 100vh;
  background: #f5f7fb;
  color: #17243b;
  padding: 28px 18px 60px;
  font-family: Arial, Helvetica, sans-serif;
}

.wm-page * {
  box-sizing: border-box;
}

.wm-shell {
  max-width: 1120px;
  margin: 0 auto;
}

.wm-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 22px;
}

.wm-eyebrow {
  color: #5274a8;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 7px;
}

.wm-title {
  font-size: clamp(23px,3vw,31px);
  font-weight: 800;
  margin: 0 0 8px;
}

.wm-subtitle {
  color: #69788e;
  font-size: 14px;
  line-height: 1.6;
}

.wm-actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}

.wm-button {
  border: 1px solid #d9e2ef;
  border-radius: 11px;
  background: white;
  color: #263d60;
  padding: 11px 15px;
  font-size: 13px;
  font-weight: 750;
  cursor: pointer;
}

.wm-button:hover {
  background: #eef3fa;
}

.wm-button:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.wm-primary {
  background: #174b91;
  border-color: #174b91;
  color: white;
}

.wm-primary:hover {
  background: #113f7d;
}

.wm-card {
  background: white;
  border: 1px solid #e3e9f1;
  border-radius: 17px;
  padding: 22px;
  box-shadow: 0 4px 16px rgba(26,52,88,.035);
}

.wm-profile {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}

.wm-profile-name {
  font-size: 19px;
  font-weight: 800;
}

.wm-profile-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.wm-profile-user {
  font-size: 12px;
  color: #69788e;
  font-weight: 700;
}

.wm-muted {
  color: #718096;
  font-size: 13px;
  line-height: 1.6;
}

.wm-pill {
  border-radius: 30px;
  padding: 7px 12px;
  background: #edf4ff;
  color: #1c5eac;
  font-size: 12px;
  font-weight: 800;
}

.wm-weekbar {
  display: flex;
  align-items: center;
  gap: 11px;
  flex-wrap: wrap;
  justify-content: space-between;
}

.wm-week-select {
  min-width: 145px;
  max-width: 100%;
  border: 1px solid #d8e2ed;
  border-radius: 10px;
  background: white;
  padding: 11px;
  font-size: 13px;
  font-weight: 750;
  color: #243a5d;
}

.wm-controlgroup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 9px;
}

.wm-current-week {
  font-size: 13px;
  color: #174b91;
}

.wm-date {
  margin-top: 10px;
  font-size: 12px;
  color: #77869a;
}

.wm-stats {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 14px;
  margin: 18px 0;
}

.wm-stat {
  border: 1px solid #e4eaf3;
  background: white;
  padding: 19px;
  border-radius: 15px;
  min-width: 0;
}

.wm-stat-label {
  color: #75849a;
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 9px;
}

.wm-stat-value {
  font-size: 28px;
  font-weight: 850;
  color: #173e78;
}

.wm-stat small {
  display: block;
  margin-top: 5px;
  color: #8492a6;
  font-size: 11px;
}

.wm-sectionhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.wm-section-title {
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}

.wm-overall {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.wm-overall-label {
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 5px;
}

.wm-overall-value {
  font-size: 32px;
  font-weight: 900;
  color: #174b91;
  white-space: nowrap;
}

.wm-category-list {
  display: grid;
  gap: 12px;
}

.wm-category {
  border: 1px solid #e3e9f1;
  border-radius: 14px;
  padding: 17px;
  background: #fcfdff;
}

.wm-cat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.wm-cat-name {
  font-weight: 800;
  font-size: 15px;
}

.wm-cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 39px;
  height: 39px;
  border-radius: 11px;
  background: #edf3fb;
  margin-right: 11px;
  font-size: 19px;
}

.wm-cat-info {
  display: flex;
  align-items: center;
}

.wm-cat-badge {
  color: #537297;
  background: #eef3f9;
  border-radius: 20px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 750;
}

.wm-target-row {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 9px;
  margin-bottom: 15px;
}

.wm-target-row > div {
  padding: 12px;
  background: #f2f5fa;
  border-radius: 10px;
  min-width: 0;
}

.wm-target-row span {
  display: block;
  color: #76859a;
  font-size: 11px;
  margin-bottom: 7px;
}

.wm-target-row strong {
  display: block;
  color: #183e78;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.wm-cat-stats {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 9px;
  margin-top: 14px;
}

.wm-cat-stat {
  background: #f2f5fa;
  border-radius: 9px;
  text-align: center;
  padding: 10px 5px;
  min-width: 0;
}

.wm-cat-stat b {
  display: block;
  font-size: 18px;
  margin-bottom: 5px;
}

.wm-cat-stat span {
  font-size: 11px;
  color: #76859a;
}

.wm-progress {
  width: 100%;
  height: 9px;
  border-radius: 20px;
  overflow: hidden;
  background: #e5eaf2;
}

.wm-progress-fill {
  height: 100%;
  border-radius: 20px;
  background: linear-gradient(
    90deg,
    #2263b7,
    #27a5c5
  );
}

.wm-progress-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  font-size: 11px;
  color: #7a8799;
}

.wm-assessments {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 14px;
  margin-top: 16px;
}

.wm-assessment-value {
  font-size: 25px;
  font-weight: 850;
  color: #183e78;
  margin: 12px 0 8px;
}

.wm-assessment-title {
  font-size: 15px;
  font-weight: 800;
}

.wm-activity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #e9edf4;
  padding: 12px 0;
}

.wm-activity:last-child {
  border: none;
}

.wm-activity-title {
  font-size: 13px;
  font-weight: 750;
}

.wm-activity-description {
  margin-top: 5px;
  color: #76849a;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.wm-verified {
  color: #14845a;
}

.wm-pending {
  color: #bf7e16;
}

.wm-empty {
  padding: 22px;
  text-align: center;
  color: #8491a3;
  font-size: 13px;
  background: #f7f9fc;
  border-radius: 12px;
}

.wm-alert {
  background: #fff3f1;
  color: #af392e;
  border: 1px solid #f2d4d0;
  border-radius: 12px;
  padding: 13px 16px;
  margin-bottom: 15px;
  font-size: 13px;
}

.wm-footer {
  color: #8c98a8;
  text-align: center;
  font-size: 12px;
  margin-top: 24px;
}

.wm-mt {
  margin-top: 18px;
}

@media(max-width:720px) {
  .wm-page {
    padding: 15px 11px 45px;
  }

  .wm-card {
    padding: 16px;
  }

  .wm-stats {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .wm-assessments {
    grid-template-columns: 1fr;
  }

  .wm-cat-stats {
    gap: 5px;
  }

  .wm-cat-stat b {
    font-size: 16px;
  }

  .wm-cat-stat span {
    font-size: 10px;
  }

  .wm-button {
    padding: 10px 12px;
  }

  .wm-actions {
    width: 100%;
  }

  .wm-weekbar {
    align-items: stretch;
  }

  .wm-controlgroup {
    width: 100%;
  }

  .wm-week-select {
    flex: 1;
  }

  .wm-target-row {
    gap: 6px;
  }

  .wm-target-row > div {
    padding: 10px 7px;
  }

  .wm-target-row strong {
    font-size: 13px;
  }

  .wm-overall-value {
    font-size: 27px;
  }
}

@media print {
  @page {
    size: A4;
    margin: 14mm;
  }

  body {
    background: white !important;
  }

  .wm-page {
    background: white;
    padding: 0;
  }

  .wm-shell {
    max-width: none;
  }

  .wm-no-print {
    display: none !important;
  }

  .wm-card,
  .wm-category,
  .wm-stat {
    box-shadow: none !important;
    break-inside: avoid;
  }

  .wm-stats {
    grid-template-columns:
      repeat(4,minmax(0,1fr));
  }

  .wm-assessments {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }
}
`;
