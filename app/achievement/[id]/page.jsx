
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// INPUT ACHIEVEMENT — TEMPLATE 5
// MODERN SPREADSHEET + DOCUMENT PREVIEW
//
// - Global Calendar Week 01–25
// - Admin / Mentor
// - Automatic Verified
// - CRUD Achievement
// - Search / Filter / Pagination
// - Preview bukti jika didukung database
// - Tidak mengubah struktur Supabase
// =====================================================

const STORAGE_BUCKET = "achievement-files";
const TOTAL_WEEKS = 25;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const MAX_FILE_MB = 5;

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    tone: "green",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "🎓",
    tone: "gold",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "👥",
    tone: "teal",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "💬",
    tone: "blue",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "📍",
    tone: "purple",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    tone: "rose",
  },
];

// =====================================================
// GLOBAL CALENDAR
// =====================================================

function parseDate(value) {
  const match = String(value ?? "")
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

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

function programWeekRange(program, weekNumber) {
  const global = GLOBAL_WEEKS[Number(weekNumber) - 1];

  if (!global || !parseDate(program?.start_date)) {
    return null;
  }

  const programStart = String(program.start_date).slice(
    0,
    10
  );

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

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());

  const part = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function determineInitialWeek(program, records = []) {
  const available = GLOBAL_WEEKS.filter((item) =>
    programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const now = todayWITA();

  const current = available.find((item) => {
    const range = programWeekRange(program, item.week);

    return (
      range &&
      now >= range.start &&
      now <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter((item) =>
      insideProgram(item.activity_date, program)
    )
    .map((item) => globalWeekOf(item.activity_date))
    .filter((week) =>
      available.some((item) => item.week === week)
    );

  if (recorded.length) {
    return Math.max(...recorded);
  }

  const upcoming = available.find((item) => {
    const range = programWeekRange(program, item.week);

    return range && range.start > now;
  });

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// =====================================================
// FORMAT
// =====================================================

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeKey(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return normalize(value);
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

function formatDateShort(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function num(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "0";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function cap(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

// =====================================================
// CATEGORY MAPPING
// =====================================================

function categoryOf(value) {
  const key = normalizeKey(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    ["training", "internaltraining", "pelatihan"].includes(
      key
    )
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (
    ["coaching", "pembinaan"].includes(key)
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

function categoryFromRecord(record, typeMap) {
  return (
    typeMap.get(normalizeKey(record.type_code)) ||
    categoryOf(record.type_code) ||
    "Lainnya"
  );
}

function activityAmount(records, categoryName) {
  if (categoryName !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce((sum, record) => {
    const km = Number(record.distance_km);

    if (!Number.isFinite(km) || km <= 0) {
      return sum;
    }

    return sum + Math.round(km * 1000);
  }, 0);

  return meters / 1000;
}

function calculateWeekCategories(
  records,
  typeMap,
  weekNumber,
  program
) {
  const verified = records.filter(
    (record) =>
      roleOf(record.status) === "verified" &&
      insideProgram(record.activity_date, program) &&
      globalWeekOf(record.activity_date) === weekNumber
  );

  return TARGETS.map((target) => {
    const matching = verified.filter(
      (record) =>
        categoryFromRecord(record, typeMap) === target.name
    );

    const actual = activityAmount(
      matching,
      target.name
    );

    return {
      ...target,
      actual,
      count: matching.length,
      percent: cap((actual / target.target) * 100),
      achieved: actual >= target.target,
    };
  });
}

// =====================================================
// EVIDENCE HELPERS
// =====================================================

function getEvidenceName(record) {
  return (
    record.evidence_name ||
    record.file_name ||
    record.attachment_name ||
    record.document_name ||
    null
  );
}

function getEvidenceUrl(record) {
  return (
    record.evidence_url ||
    record.file_url ||
    record.attachment_url ||
    record.document_url ||
    null
  );
}

function isImageFile(nameOrUrl) {
  return /\.(png|jpe?g|webp|gif)(?:\?|#|$)/i.test(
    String(nameOrUrl || "")
  );
}

function isPdfFile(nameOrUrl) {
  return /\.pdf(?:\?|#|$)/i.test(
    String(nameOrUrl || "")
  );
}

function isSafeUrl(value) {
  if (!value || typeof value !== "string") return false;

  try {
    const url = new URL(value);

    return ["https:", "http:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function getEvidenceColumns(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const options = [
    ["evidence_name", "evidence_url"],
    ["file_name", "file_url"],
    ["attachment_name", "attachment_url"],
    ["document_name", "document_url"],
  ];

  return (
    options.find(
      ([name, url]) =>
        Object.prototype.hasOwnProperty.call(record, name) &&
        Object.prototype.hasOwnProperty.call(record, url)
    ) || null
  );
}

// =====================================================
// COMPONENTS
// =====================================================

function ProgressBar({ value }) {
  const safe = cap(value);

  return (
    <div
      className="ia-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const verified = roleOf(status) === "verified";
  const pending = roleOf(status) === "pending";

  return (
    <span
      className={
        "ia-status " +
        (verified
          ? "verified"
          : pending
          ? "pending"
          : "other")
      }
    >
      <span aria-hidden="true">
        {verified ? "✓" : pending ? "◷" : "•"}
      </span>

      {verified
        ? "Verified"
        : pending
        ? "Pending"
        : status || "—"}
    </span>
  );
}

function CategoryBadge({ name }) {
  const category = TARGETS.find(
    (item) => item.name === name
  );

  return (
    <span
      className={`ia-category-badge ${
        category?.tone || "gray"
      }`}
    >
      <span>{category?.icon || "📌"}</span>
      {name}
    </span>
  );
}

// =====================================================
// PAGE
// =====================================================

export default function InputAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const fileInputRef = useRef(null);
  const formRef = useRef(null);
  const requestRef = useRef(false);

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);

  // Form

  const [formTypeCode, setFormTypeCode] = useState("");
  const [formDate, setFormDate] = useState(todayWITA());
  const [formDescription, setFormDescription] = useState("");
  const [formKm, setFormKm] = useState("");
  const [formMeter, setFormMeter] = useState("");
  const [formFile, setFormFile] = useState(null);
  const [editId, setEditId] = useState(null);

  // Spreadsheet

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Preview

  const [previewRecord, setPreviewRecord] =
    useState(null);

  // Database storage capabilities

  const [evidenceColumns, setEvidenceColumns] =
    useState(null);

  // Status

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ===================================================
  // FETCH
  // ===================================================

  const fetchRecords = useCallback(async (id) => {
    const { data, error: queryError } = await supabase
      .from("achievement_records")
      .select("*")
      .eq("program_id", id)
      .order("activity_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (queryError) {
      throw new Error(
        `Achievement: ${queryError.message}`
      );
    }

    return data || [];
  }, []);

  const detectEvidenceColumns = useCallback(
    async () => {
      const { data, error: queryError } = await supabase
        .from("achievement_records")
        .select("*")
        .limit(1);

      if (queryError || !data?.length) {
        return null;
      }

      return getEvidenceColumns(data[0]);
    },
    []
  );

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
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError) throw profileError;

        const role = roleOf(profile?.role);

        if (["participant", "peserta"].includes(role)) {
          router.replace("/dashboard-peserta");
          return;
        }

        if (!["admin", "mentor"].includes(role)) {
          throw new Error(
            "Halaman ini hanya untuk Admin dan Mentor."
          );
        }

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            site,
            participant_id,
            mentor_id,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (role === "mentor") {
          query = query.eq("mentor_id", user.id);
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

        if (!parseDate(programData.start_date)) {
          throw new Error(
            "Tanggal mulai program OJT tidak valid."
          );
        }

        const [
          typeResult,
          achievementRows,
          evidenceSupport,
        ] = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name")
            .order("name"),

          fetchRecords(programId),

          detectEvidenceColumns(),
        ]);

        if (typeResult.error) {
          throw typeResult.error;
        }

        if (!active) return;

        setManager(profile);
        setProgram(programData);
        setTypes(typeResult.data || []);
        setRecords(achievementRows);

        setEvidenceColumns(
          evidenceSupport ||
            getEvidenceColumns(achievementRows[0])
        );

        setSelectedWeek(
          determineInitialWeek(
            programData,
            achievementRows
          )
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat Input Achievement."
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
    fetchRecords,
    detectEvidenceColumns,
  ]);

  async function refreshData() {
    if (
      !programId ||
      !manager ||
      !program ||
      refreshing ||
      saving
    ) {
      return;
    }

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      const [rows, columns] = await Promise.all([
        fetchRecords(programId),
        detectEvidenceColumns(),
      ]);

      setRecords(rows);
      setEvidenceColumns(
        columns || getEvidenceColumns(rows[0])
      );

      setMessage("Data Achievement berhasil diperbarui.");
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // PROGRAM
  // ===================================================

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const accountName =
    manager?.full_name || "Pengelola OJT";

  const roleName =
    roleOf(manager?.role) === "admin"
      ? "Administrator"
      : "Mentor OJT";

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter((item) =>
        programWeekRange(program, item.week)
      ),
    [program]
  );

  const selectedGlobalWeek =
    GLOBAL_WEEKS[selectedWeek - 1] || null;

  const selectedRange = useMemo(
    () => programWeekRange(program, selectedWeek),
    [program, selectedWeek]
  );

  // ===================================================
  // TYPE MAPPING
  // ===================================================

  const typeMap = useMemo(() => {
    const map = new Map();

    types.forEach((item) => {
      const name =
        categoryOf(item.code) ||
        categoryOf(item.name);

      if (name) {
        map.set(normalizeKey(item.code), name);
      }
    });

    return map;
  }, [types]);

  const typeOptions = useMemo(
    () =>
      types.map((item) => ({
        code: item.code,
        label:
          categoryOf(item.code) ||
          categoryOf(item.name) ||
          item.name,
      })),
    [types]
  );

  const currentCategory =
    typeMap.get(normalizeKey(formTypeCode)) ||
    categoryOf(formTypeCode);

  const isFisik = currentCategory === "Fisik";

  // ===================================================
  // WEEK DATA
  // ===================================================

  const validRecords = useMemo(
    () =>
      records.filter((item) =>
        insideProgram(item.activity_date, program)
      ),
    [records, program]
  );

  const weekRows = useMemo(
    () =>
      validRecords.filter(
        (item) =>
          globalWeekOf(item.activity_date) ===
          selectedWeek
      ),
    [validRecords, selectedWeek]
  );

  const weekVerified = useMemo(
    () =>
      weekRows.filter(
        (item) => roleOf(item.status) === "verified"
      ),
    [weekRows]
  );

  const weekPending = useMemo(
    () =>
      weekRows.filter(
        (item) => roleOf(item.status) === "pending"
      ),
    [weekRows]
  );

  const weekCategories = useMemo(
    () =>
      calculateWeekCategories(
        validRecords,
        typeMap,
        selectedWeek,
        program
      ),
    [
      validRecords,
      typeMap,
      selectedWeek,
      program,
    ]
  );

  const weekOverall = useMemo(
    () =>
      weekCategories.reduce(
        (sum, item) => sum + item.percent,
        0
      ) / TARGETS.length,
    [weekCategories]
  );

  const achievedCategories = weekCategories.filter(
    (item) => item.achieved
  ).length;

  // ===================================================
  // WHOLE PROGRAM COUNTS
  // ===================================================

  const programVerifiedCount = validRecords.filter(
    (item) => roleOf(item.status) === "verified"
  ).length;

  // ===================================================
  // FORM DATE
  // ===================================================

  useEffect(() => {
    if (!selectedRange || editId) return;

    setFormDate((current) => {
      if (
        parseDate(current) &&
        current >= selectedRange.start &&
        current <= selectedRange.end
      ) {
        return current;
      }

      const now = todayWITA();

      return now >= selectedRange.start &&
        now <= selectedRange.end
        ? now
        : selectedRange.end;
    });
  }, [selectedRange, editId]);

  // ===================================================
  // SPREADSHEET FILTER
  // ===================================================

  const filteredHistory = useMemo(() => {
    const keyword = normalize(search);

    return weekRows
      .filter((item) => {
        const category = categoryFromRecord(
          item,
          typeMap
        );

        if (
          categoryFilter !== "all" &&
          category !== categoryFilter
        ) {
          return false;
        }

        if (
          statusFilter !== "all" &&
          roleOf(item.status) !== statusFilter
        ) {
          return false;
        }

        if (!keyword) return true;

        const content = [
          category,
          item.description,
          item.activity_date,
          item.distance_km,
          getEvidenceName(item),
          item.status,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return content.includes(keyword);
      })
      .sort((a, b) => {
        const dateCompare = String(
          b.activity_date
        ).localeCompare(String(a.activity_date));

        if (dateCompare !== 0) return dateCompare;

        return String(b.created_at || "").localeCompare(
          String(a.created_at || "")
        );
      });
  }, [
    weekRows,
    search,
    categoryFilter,
    statusFilter,
    typeMap,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedWeek,
    search,
    categoryFilter,
    statusFilter,
    pageSize,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredHistory.length / pageSize)
  );

  const currentPage = Math.min(page, pageCount);

  const visibleRows = filteredHistory.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const firstVisible = filteredHistory.length
    ? (currentPage - 1) * pageSize + 1
    : 0;

  const lastVisible = Math.min(
    currentPage * pageSize,
    filteredHistory.length
  );

  // ===================================================
  // FORM ACTIONS
  // ===================================================

  function resetForm() {
    setEditId(null);
    setFormTypeCode("");
    setFormDescription("");
    setFormKm("");
    setFormMeter("");
    setFormFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    const now = todayWITA();

    setFormDate(
      selectedRange &&
        now >= selectedRange.start &&
        now <= selectedRange.end
        ? now
        : selectedRange?.end || now
    );
  }

  function handleWeekChange(value) {
    const nextWeek = Number(value);

    if (
      !availableWeeks.some(
        (item) => item.week === nextWeek
      )
    ) {
      return;
    }

    setSelectedWeek(nextWeek);

    if (editId) {
      setEditId(null);
      setFormTypeCode("");
      setFormDescription("");
      setFormKm("");
      setFormMeter("");
      setFormFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function startEdit(item) {
    const category = categoryFromRecord(
      item,
      typeMap
    );

    const type = types.find(
      (entry) =>
        normalizeKey(entry.code) ===
        normalizeKey(item.type_code)
    );

    const week = globalWeekOf(item.activity_date);

    if (week && week !== selectedWeek) {
      setSelectedWeek(week);
    }

    setEditId(item.id);
    setFormTypeCode(type?.code || item.type_code);
    setFormDate(
      String(item.activity_date).slice(0, 10)
    );

    setFormDescription(item.description || "");

    if (category === "Fisik") {
      const distance = Number(item.distance_km);

      if (
        Number.isFinite(distance) &&
        distance >= 0
      ) {
        const meters = Math.round(distance * 1000);

        setFormKm(String(Math.floor(meters / 1000)));
        setFormMeter(String(meters % 1000));
      } else {
        setFormKm("");
        setFormMeter("");
      }
    } else {
      setFormKm("");
      setFormMeter("");
    }

    setFormFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setError("");
    setMessage("");

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setFormFile(null);
      return;
    }

    const validTypes = [
      "image/png",
      "image/jpeg",
      "application/pdf",
    ];

    const validExtension = /\.(png|jpe?g|pdf)$/i.test(
      file.name
    );

    if (
      !validTypes.includes(file.type) ||
      !validExtension
    ) {
      setError(
        "Dokumentasi harus berupa PNG, JPG, atau PDF."
      );

      event.target.value = "";
      setFormFile(null);
      return;
    }

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(
        `Ukuran file maksimal ${MAX_FILE_MB} MB.`
      );

      event.target.value = "";
      setFormFile(null);
      return;
    }

    setError("");
    setFormFile(file);
  }

  async function uploadEvidence(file) {
    const suffix = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(-90);

    const path = [
      programId,
      Date.now(),
      crypto.randomUUID(),
      suffix,
    ].join("/");

    const { error: uploadError } =
      await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
        });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);

    return {
      path,
      name: file.name,
      url: data?.publicUrl || null,
    };
  }

  async function saveAchievement(event) {
    event.preventDefault();

    if (
      !manager ||
      !program ||
      saving ||
      deletingId ||
      requestRef.current
    ) {
      return;
    }

    requestRef.current = true;
    setSaving(true);
    setError("");
    setMessage("");

    let uploaded = null;

    try {
      if (!formTypeCode) {
        throw new Error(
          "Kategori Achievement wajib dipilih."
        );
      }

      if (!types.some(
        (item) => item.code === formTypeCode
      )) {
        throw new Error(
          "Kategori tidak tersedia di database."
        );
      }

      if (!parseDate(formDate)) {
        throw new Error(
          "Tanggal pencapaian tidak valid."
        );
      }

      if (
        !selectedRange ||
        formDate < selectedRange.start ||
        formDate > selectedRange.end ||
        !insideProgram(formDate, program)
      ) {
        throw new Error(
          "Tanggal harus sesuai Week Global dan periode OJT peserta."
        );
      }

      let distanceKm = null;

      if (isFisik) {
        if (
          String(formKm).trim() === "" &&
          String(formMeter).trim() === ""
        ) {
          throw new Error(
            "Masukkan jarak kegiatan Fisik."
          );
        }

        const km = formKm === "" ? 0 : Number(formKm);
        const meter =
          formMeter === "" ? 0 : Number(formMeter);

        if (
          !Number.isInteger(km) ||
          km < 0 ||
          !Number.isInteger(meter) ||
          meter < 0 ||
          meter > 999
        ) {
          throw new Error(
            "Km harus bilangan bulat positif dan meter harus 0–999."
          );
        }

        distanceKm = (km * 1000 + meter) / 1000;

        if (distanceKm <= 0) {
          throw new Error(
            "Jarak kegiatan Fisik harus lebih dari 0."
          );
        }
      }

      if (formFile && !evidenceColumns) {
        throw new Error(
          "Upload bukti belum dapat digunakan karena kolom nama dan URL dokumentasi belum terdeteksi pada tabel achievement_records. Simpan tanpa file terlebih dahulu."
        );
      }

      // Hanya kolom yang sudah diketahui dipakai.
      // Tidak memakai created_by atau notes.

      const payload = {
        type_code: formTypeCode,
        activity_date: formDate,
        description: formDescription.trim() || null,
        distance_km: distanceKm,
        status: "verified",
        verified_by: manager.id,
      };

      if (formFile) {
        uploaded = await uploadEvidence(formFile);

        if (!uploaded.url) {
          throw new Error(
            "URL dokumentasi tidak tersedia."
          );
        }

        const [nameColumn, urlColumn] =
          evidenceColumns;

        payload[nameColumn] = uploaded.name;
        payload[urlColumn] = uploaded.url;
      }

      let result;

      if (editId) {
        result = await supabase
          .from("achievement_records")
          .update(payload)
          .eq("id", editId)
          .eq("program_id", programId)
          .select("id");
      } else {
        result = await supabase
          .from("achievement_records")
          .insert({
            ...payload,
            program_id: programId,
          })
          .select("id");
      }

      if (result.error) {
        throw result.error;
      }

      if (!result.data?.length) {
        throw new Error(
          "Data tidak tersimpan. Periksa izin Supabase."
        );
      }

      const wasEditing = Boolean(editId);

      const updated = await fetchRecords(programId);

      setRecords(updated);
      resetForm();

      setMessage(
        wasEditing
          ? "Achievement berhasil diperbarui."
          : "Achievement berhasil disimpan dan otomatis Verified."
      );
    } catch (err) {
      // Membersihkan file baru jika upload berhasil
      // tetapi insert/update gagal. Tidak menyentuh
      // dokumentasi lama yang sudah terhubung.

      if (uploaded?.path) {
        try {
          await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([uploaded.path]);
        } catch {
          // Cleanup bersifat best effort.
        }
      }

      setError(
        err?.message ||
          "Gagal menyimpan Achievement."
      );
    } finally {
      requestRef.current = false;
      setSaving(false);
    }
  }

  async function deleteRecord(item) {
    if (
      deletingId ||
      saving ||
      !manager ||
      !program
    ) {
      return;
    }

    if (
      !window.confirm(
        "Hapus Achievement ini secara permanen?"
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    setError("");
    setMessage("");

    try {
      const {
        data,
        error: deleteError,
      } = await supabase
        .from("achievement_records")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (deleteError) throw deleteError;

      if (!data?.length) {
        throw new Error(
          "Achievement tidak terhapus. Periksa izin database."
        );
      }

      const updated = await fetchRecords(programId);

      setRecords(updated);

      if (editId === item.id) {
        resetForm();
      }

      if (previewRecord?.id === item.id) {
        setPreviewRecord(null);
      }

      setMessage(
        "Achievement berhasil dihapus."
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal menghapus Achievement."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ===================================================
  // PREVIEW
  // ===================================================

  function openPreview(item) {
    setPreviewRecord(item);
  }

  const previewUrl = previewRecord
    ? getEvidenceUrl(previewRecord)
    : null;

  const previewName = previewRecord
    ? getEvidenceName(previewRecord)
    : null;

  // ===================================================
  // LOADING / ERROR
  // ===================================================

  if (loading) {
    return (
      <main className="ia-loading">
        <style>{css}</style>

        <div>
          <h2>OJT MineTrack</h2>
          <p>Memuat Input Achievement...</p>
        </div>
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="ia-loading">
        <style>{css}</style>

        <div>
          <h2>
            Input Achievement Tidak Dapat Ditampilkan
          </h2>

          <p>
            {error || "Akses tidak tersedia."}
          </p>

          <button
            type="button"
            onClick={() => router.push("/")}
          >
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="ia-app">
      <style>{css}</style>

      {/* TOP NAV */}

      <header className="ia-topbar">
        <button
          type="button"
          className="ia-brand"
          onClick={() => router.push("/")}
        >
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </button>

        <nav className="ia-nav">
          <button
            type="button"
            onClick={() => router.push("/")}
          >
            Dashboard
          </button>

          <button
            type="button"
            onClick={() =>
              router.push("/mentor/monitoring-peserta")
            }
          >
            Peserta OJT
          </button>

          <button
            type="button"
            className="active"
          >
            Input Achievement
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            Monitoring
          </button>
        </nav>

        <div className="ia-account">
          <div className="ia-avatar">
            {initials(accountName)}
          </div>

          <div className="ia-account-text">
            <strong>{accountName}</strong>
            <small>{roleName}</small>
          </div>
        </div>
      </header>

      <main className="ia-content">
        {/* PAGE HEADING */}

        <div className="ia-heading">
          <div>
            <h1>
              Input <span>Achievement OJT</span>
            </h1>

            <p>
              Catat dan dokumentasikan pencapaian peserta
              OJT secara terstruktur.
            </p>
          </div>

          <button
            type="button"
            className="ia-back"
            onClick={() =>
              router.push(`/peserta/${programId}`)
            }
          >
            ← Detail Peserta
          </button>
        </div>

        {/* NOTIFICATIONS */}

        {error && (
          <div className="ia-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="ia-alert success" role="status">
            ✓ {message}
          </div>
        )}

        {/* PROFILE + WEEKLY STATISTICS */}

        <section className="ia-profile-strip">
          <div className="ia-profile-left">
            <div className="ia-profile-avatar">
              {initials(participantName)}
            </div>

            <div className="ia-profile-copy">
              <h2>{participantName}</h2>

              <p>
                {participant?.department || "—"}
                {" | "}
                {program.site || "—"}
              </p>

              <div className="ia-profile-period">
                <span>📅</span>

                <div>
                  <small>Periode OJT</small>

                  <strong>
                    {formatDate(program.start_date)}
                    {" – "}
                    {formatDate(program.end_date)}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <div className="ia-profile-stats">
            <div className="ia-stat donut">
              <div
                className="ia-donut"
                style={{
                  "--progress": `${cap(
                    weekOverall
                  )}%`,
                }}
              >
                <div>
                  <strong>
                    {num(weekOverall, 2)}%
                  </strong>
                </div>
              </div>

              <div>
                <strong>Capaian</strong>
                <small>
                  {weekLabel(selectedWeek)}
                </small>
              </div>
            </div>

            <div className="ia-stat green">
              <span>✅</span>
              <strong>{weekVerified.length}</strong>
              <small>Verified</small>
            </div>

            <div className="ia-stat rose">
              <span>◷</span>
              <strong>{weekPending.length}</strong>
              <small>Pending</small>
            </div>

            <div className="ia-stat blue">
              <span>▦</span>
              <strong>
                {achievedCategories}/6
              </strong>
              <small>Kategori Tercapai</small>
            </div>
          </div>
        </section>

        {/* FORM + SPREADSHEET */}

        <section className="ia-main-grid">
          {/* LEFT FORM */}

          <div className="ia-card ia-form-card" ref={formRef}>
            <div className="ia-card-title">
              <div className="ia-title-icon">
                ✎
              </div>

              <div>
                <h2>
                  {editId
                    ? "Edit Achievement"
                    : "Tambah Achievement"}
                </h2>

                <p>
                  Isi pencapaian pada Week Global
                  terpilih.
                </p>
              </div>
            </div>

            <form
              className="ia-form"
              onSubmit={saveAchievement}
            >
              <label>
                <span>Kategori Achievement</span>

                <select
                  value={formTypeCode}
                  onChange={(event) =>
                    setFormTypeCode(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Pilih Kategori
                  </option>

                  {typeOptions.map((item) => (
                    <option
                      key={item.code}
                      value={item.code}
                    >
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Week Global</span>

                <select
                  value={selectedWeek}
                  onChange={(event) =>
                    handleWeekChange(event.target.value)
                  }
                  disabled={!availableWeeks.length}
                >
                  {availableWeeks.map((item) => (
                    <option
                      key={item.week}
                      value={item.week}
                    >
                      {weekLabel(item.week)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Tanggal Pencapaian</span>

                <input
                  type="date"
                  value={formDate}
                  min={selectedRange?.start || undefined}
                  max={selectedRange?.end || undefined}
                  onChange={(event) =>
                    setFormDate(event.target.value)
                  }
                  required
                />
              </label>

              {selectedRange && (
                <div className="ia-range">
                  Rentang tanggal:
                  <strong>
                    {formatDate(selectedRange.start)}
                    {" – "}
                    {formatDate(selectedRange.end)}
                  </strong>
                </div>
              )}

              {isFisik && (
                <div className="ia-distance">
                  <label>
                    <span>Kilometer</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={formKm}
                      onChange={(event) =>
                        setFormKm(event.target.value)
                      }
                    />
                  </label>

                  <label>
                    <span>Tambahan Meter</span>

                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      placeholder="0"
                      value={formMeter}
                      onChange={(event) =>
                        setFormMeter(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}

              <label>
                <span>Deskripsi Pencapaian</span>

                <textarea
                  rows={4}
                  maxLength={500}
                  value={formDescription}
                  onChange={(event) =>
                    setFormDescription(event.target.value)
                  }
                  placeholder="Jelaskan kegiatan yang telah dilakukan..."
                />

                <small className="ia-char-count">
                  {formDescription.length}/500
                </small>
              </label>

              <label>
                <span>
                  Bukti / Dokumentasi (Opsional)
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileChange}
                  disabled={!evidenceColumns}
                />

                <small className="ia-upload-note">
                  {evidenceColumns
                    ? "PNG, JPG, PDF · Maksimal 5 MB"
                    : "Upload belum tersedia: kolom bukti belum terdeteksi. Form kegiatan tetap dapat digunakan."}
                </small>

                {formFile && (
                  <div className="ia-file-selected">
                    📎 {formFile.name}
                  </div>
                )}

                {editId && (
                  <small className="ia-upload-note">
                    Jika tidak memilih file baru,
                    dokumentasi lama tetap dipertahankan.
                  </small>
                )}
              </label>

              <button
                type="submit"
                className="ia-primary"
                disabled={
                  saving ||
                  Boolean(deletingId) ||
                  !availableWeeks.length
                }
              >
                {saving
                  ? "Menyimpan..."
                  : editId
                  ? "✓ Simpan Perubahan"
                  : "+ Simpan Achievement"}
              </button>

              {editId && (
                <button
                  type="button"
                  className="ia-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Batal Edit
                </button>
              )}

              <p className="ia-form-note">
                Kegiatan baru otomatis berstatus
                Verified dan langsung dihitung dalam
                pencapaian mingguan.
              </p>
            </form>
          </div>

          {/* RIGHT SPREADSHEET */}

          <div className="ia-card ia-history-card">
            <div className="ia-history-header">
              <div className="ia-card-title">
                <div className="ia-title-icon">
                  ▤
                </div>

                <div>
                  <h2>Riwayat Achievement</h2>

                  <p>
                    Spreadsheet kegiatan pada
                    Kalender Global.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="ia-refresh"
                onClick={refreshData}
                disabled={refreshing || saving}
              >
                {refreshing
                  ? "Memuat..."
                  : "↻ Refresh"}
              </button>
            </div>

            {/* FILTERS */}

            <div className="ia-toolbar">
              <div className="ia-search">
                <span>⌕</span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Cari kegiatan atau deskripsi..."
                  aria-label="Cari Achievement"
                />
              </div>

              <select
                value={selectedWeek}
                onChange={(event) =>
                  handleWeekChange(event.target.value)
                }
                aria-label="Filter Week Global"
              >
                {availableWeeks.map((item) => (
                  <option
                    value={item.week}
                    key={item.week}
                  >
                    {weekLabel(item.week)}
                    {" · "}
                    {formatDateShort(item.start)}
                    {" – "}
                    {formatDateShort(item.end)}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(event.target.value)
                }
                aria-label="Filter Kategori"
              >
                <option value="all">
                  Semua Kategori
                </option>

                {TARGETS.map((item) => (
                  <option
                    key={item.name}
                    value={item.name}
                  >
                    {item.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter Status"
              >
                <option value="all">
                  Semua Status
                </option>
                <option value="verified">
                  Verified
                </option>
                <option value="pending">
                  Pending
                </option>
              </select>
            </div>

            {/* WEEK SUMMARY */}

            <div className="ia-table-summary">
              <div>
                <strong>
                  {weekLabel(selectedWeek)}
                </strong>

                <span>
                  {formatDate(selectedGlobalWeek?.start)}
                  {" – "}
                  {formatDate(selectedGlobalWeek?.end)}
                </span>
              </div>

              <div className="ia-summary-count">
                {filteredHistory.length} kegiatan
              </div>
            </div>

            {/* TABLE */}

            <div className="ia-table-scroll">
              <table className="ia-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Deskripsi Kegiatan</th>
                    <th>Realisasi</th>
                    <th>Bukti</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map((item, index) => {
                    const category =
                      categoryFromRecord(
                        item,
                        typeMap
                      );

                    const fileName =
                      getEvidenceName(item);

                    const fileUrl =
                      getEvidenceUrl(item);

                    const hasEvidence =
                      Boolean(fileName || fileUrl);

                    return (
                      <tr key={item.id}>
                        <td className="ia-no">
                          {(currentPage - 1) *
                            pageSize +
                            index +
                            1}
                        </td>

                        <td className="ia-date-cell">
                          {formatDate(
                            item.activity_date
                          )}
                        </td>

                        <td>
                          <CategoryBadge
                            name={category}
                          />
                        </td>

                        <td>
                          <div className="ia-description">
                            {item.description?.trim()
                              ? item.description
                              : "—"}
                          </div>
                        </td>

                        <td className="ia-realisasi">
                          {category === "Fisik"
                            ? `${num(
                                item.distance_km,
                                3
                              )} km`
                            : "1 kegiatan"}
                        </td>

                        <td>
                          {hasEvidence ? (
                            <button
                              type="button"
                              className="ia-preview-button"
                              onClick={() =>
                                openPreview(item)
                              }
                              title={
                                fileName ||
                                "Lihat dokumentasi"
                              }
                            >
                              {fileUrl &&
                              isSafeUrl(fileUrl) &&
                              isImageFile(
                                fileName || fileUrl
                              ) ? (
                                <img
                                  src={fileUrl}
                                  alt="Bukti kegiatan"
                                  className="ia-thumb"
                                />
                              ) : (
                                <span className="ia-file-icon">
                                  {isPdfFile(
                                    fileName || fileUrl
                                  )
                                    ? "📕"
                                    : "📎"}
                                </span>
                              )}
                            </button>
                          ) : (
                            <span className="ia-no-file">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <StatusBadge
                            status={item.status}
                          />
                        </td>

                        <td>
                          <div className="ia-row-actions">
                            <button
                              type="button"
                              className="ia-edit"
                              onClick={() =>
                                startEdit(item)
                              }
                              disabled={
                                saving ||
                                Boolean(deletingId)
                              }
                              title="Edit Achievement"
                              aria-label="Edit Achievement"
                            >
                              ✎
                            </button>

                            <button
                              type="button"
                              className="ia-delete"
                              onClick={() =>
                                deleteRecord(item)
                              }
                              disabled={
                                saving ||
                                Boolean(deletingId)
                              }
                              title="Hapus Achievement"
                              aria-label="Hapus Achievement"
                            >
                              {deletingId ===
                              item.id
                                ? "…"
                                : "⌫"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!visibleRows.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="ia-empty"
                      >
                        Tidak ada Achievement
                        yang sesuai filter pada{" "}
                        {weekLabel(selectedWeek)}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}

            <div className="ia-pagination">
              <div className="ia-pagination-info">
                Menampilkan{" "}
                <strong>
                  {firstVisible}–{lastVisible}
                </strong>
                {" dari "}
                <strong>
                  {filteredHistory.length}
                </strong>
                {" kegiatan"}
              </div>

              <div className="ia-pagination-controls">
                <label>
                  Tampilkan

                  <select
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(
                        Number(event.target.value)
                      )
                    }
                  >
                    {PAGE_SIZE_OPTIONS.map(
                      (size) => (
                        <option
                          value={size}
                          key={size}
                        >
                          {size}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setPage((value) =>
                      Math.max(1, value - 1)
                    )
                  }
                  disabled={currentPage <= 1}
                  aria-label="Halaman sebelumnya"
                >
                  ‹
                </button>

                <span className="ia-page-number">
                  {currentPage}/{pageCount}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((value) =>
                      Math.min(pageCount, value + 1)
                    )
                  }
                  disabled={currentPage >= pageCount}
                  aria-label="Halaman berikutnya"
                >
                  ›
                </button>
              </div>
            </div>

            {/* SIMPLE FOOTER */}

            <div className="ia-history-note">
              <span>
                ✓ Verified otomatis
              </span>

              <span>
                📅 Mengikuti Kalender Global
              </span>

              <span>
                📊 Total Verified program:
                {" "}
                {programVerifiedCount}
              </span>
            </div>
          </div>
        </section>

        {/* NAVIGATION */}

        <div className="ia-bottom-navigation">
          <button
            type="button"
            onClick={() =>
              router.push(`/peserta/${programId}`)
            }
          >
            ← Detail Peserta
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            Monitoring Achievement →
          </button>
        </div>

        <footer className="ia-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </main>

      {/* DOCUMENT PREVIEW MODAL */}

      {previewRecord && (
        <div
          className="ia-modal-overlay"
          role="presentation"
          onClick={() => setPreviewRecord(null)}
        >
          <div
            className="ia-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Preview Dokumentasi Achievement"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="ia-modal-header">
              <div>
                <strong>Dokumentasi Achievement</strong>
                <small>
                  {formatDate(
                    previewRecord.activity_date
                  )}
                </small>
              </div>

              <button
                type="button"
                onClick={() =>
                  setPreviewRecord(null)
                }
                aria-label="Tutup preview"
              >
                ✕
              </button>
            </div>

            <div className="ia-modal-body">
              <div className="ia-preview-title">
                <CategoryBadge
                  name={categoryFromRecord(
                    previewRecord,
                    typeMap
                  )}
                />

                <p>
                  {previewRecord.description ||
                    "Tidak ada deskripsi."}
                </p>
              </div>

              {previewUrl &&
              isSafeUrl(previewUrl) ? (
                isImageFile(
                  previewName || previewUrl
                ) ? (
                  <img
                    className="ia-preview-image"
                    src={previewUrl}
                    alt={
                      previewName ||
                      "Dokumentasi Achievement"
                    }
                  />
                ) : isPdfFile(
                    previewName || previewUrl
                  ) ? (
                  <div className="ia-pdf-preview">
                    <iframe
                      title="Preview PDF Achievement"
                      src={previewUrl}
                    />
                  </div>
                ) : (
                  <div className="ia-preview-empty">
                    Preview langsung tidak tersedia
                    untuk jenis file ini.
                  </div>
                )
              ) : (
                <div className="ia-preview-empty">
                  URL dokumentasi belum tersedia.
                </div>
              )}

              <div className="ia-preview-filename">
                📎 {previewName || "Dokumentasi"}
              </div>
            </div>

            <div className="ia-modal-footer">
              <button
                type="button"
                onClick={() =>
                  setPreviewRecord(null)
                }
              >
                Tutup
              </button>

              {previewUrl &&
                isSafeUrl(previewUrl) && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Buka File ↗
                  </a>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================
// CSS — CLEAN ENTERPRISE SPREADSHEET
// =====================================================

const css = `
.ia-app,
.ia-app * {
  box-sizing: border-box;
}

.ia-app {
  min-height: 100vh;
  background: #f5f8fa;
  color: #173047;
  font-family: Arial, Helvetica, sans-serif;
}

.ia-app button,
.ia-app input,
.ia-app select,
.ia-app textarea {
  font-family: inherit;
}

.ia-app button {
  cursor: pointer;
}

.ia-app button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.ia-loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: Arial, sans-serif;
  background: #f5f8fa;
}

.ia-loading > div {
  text-align: center;
  max-width: 520px;
}

.ia-loading button {
  margin-top: 13px;
  padding: 12px 17px;
  border: none;
  border-radius: 10px;
  background: #08865e;
  color: white;
}

/* HEADER */

.ia-topbar {
  height: 69px;
  padding: 0 27px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  background: white;
  border-bottom: 1px solid #e1e9ef;
}

.ia-brand {
  display: flex;
  align-items: baseline;
  gap: 5px;
  border: none;
  background: transparent;
  white-space: nowrap;
  color: #102239;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -.7px;
}

.ia-brand span {
  color: #087f59;
}

.ia-brand small {
  color: #8090a0;
  font-size: 10px;
  letter-spacing: 0;
  margin-left: 4px;
}

.ia-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ia-nav button {
  padding: 11px 14px;
  border: 0;
  background: transparent;
  color: #53657b;
  font-size: 12px;
  font-weight: 800;
  border-radius: 10px;
}

.ia-nav button:hover,
.ia-nav button.active {
  background: #e5f5ed;
  color: #087c55;
}

.ia-account {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.ia-avatar {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  flex-shrink: 0;
  background: #e0f5e9;
  color: #087b56;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 900;
}

.ia-account-text {
  min-width: 0;
}

.ia-account-text strong {
  display: block;
  font-size: 11px;
  max-width: 150px;
  overflow-wrap: anywhere;
}

.ia-account-text small {
  display: block;
  margin-top: 5px;
  color: #8191a0;
  font-size: 10px;
}

/* CONTENT */

.ia-content {
  width: 100%;
  max-width: 1650px;
  margin: auto;
  padding: 24px;
}

.ia-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 18px;
}

.ia-heading h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 35px);
  font-weight: 900;
  letter-spacing: -.7px;
}

.ia-heading h1 span {
  color: #087f59;
}

.ia-heading p {
  margin: 8px 0 0;
  color: #728497;
  font-size: 13px;
}

.ia-back {
  padding: 11px 14px;
  border-radius: 9px;
  border: 1px solid #dbe7e3;
  background: #fff;
  color: #24674d;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.ia-alert {
  padding: 13px 15px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 15px;
}

.ia-alert.error {
  background: #fff1f1;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.ia-alert.success {
  background: #eaf9f0;
  border: 1px solid #bde7ca;
  color: #08784d;
}

/* PROFILE STRIP */

.ia-profile-strip {
  display: grid;
  grid-template-columns:
    minmax(250px, 1.2fr)
    minmax(0, 1.4fr);
  gap: 13px;
  margin-bottom: 15px;
}

.ia-profile-left,
.ia-profile-stats {
  background: #fff;
  border: 1px solid #e4ebf1;
  border-radius: 15px;
  padding: 16px;
  box-shadow: 0 4px 14px #16334d08;
}

.ia-profile-left {
  display: flex;
  align-items: center;
  gap: 17px;
}

.ia-profile-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 90px;
  height: 90px;
  border-radius: 14px;
  background: #def4e9;
  color: #087953;
  font-size: 34px;
  font-weight: 900;
}

.ia-profile-copy {
  min-width: 0;
}

.ia-profile-copy h2 {
  margin: 0;
  font-size: 20px;
  overflow-wrap: anywhere;
}

.ia-profile-copy > p {
  margin: 7px 0 14px;
  color: #76879a;
  font-size: 12px;
  font-weight: 700;
}

.ia-profile-period {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ia-profile-period > span {
  font-size: 21px;
}

.ia-profile-period small {
  display: block;
  color: #7f91a2;
  font-size: 10px;
}

.ia-profile-period strong {
  display: block;
  font-size: 11px;
  margin-top: 4px;
}

.ia-profile-stats {
  display: grid;
  grid-template-columns: repeat(4,minmax(0,1fr));
  gap: 9px;
}

.ia-stat {
  min-width: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  text-align: center;
  gap: 7px;
  border-radius: 11px;
  padding: 10px 7px;
  background: #f7faf8;
}

.ia-stat > span {
  font-size: 19px;
}

.ia-stat > strong {
  font-size: 23px;
  color: #193b30;
}

.ia-stat small {
  color: #718496;
  font-size: 10px;
  line-height: 1.3;
}

.ia-stat.green {
  background: #ebf9f1;
}

.ia-stat.rose {
  background: #fff2f2;
}

.ia-stat.blue {
  background: #edf5ff;
}

.ia-stat.donut {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  background: #f0faf5;
}

.ia-stat.donut > div:last-child strong {
  display: block;
  font-size: 12px;
}

.ia-donut {
  width: 73px;
  height: 73px;
  flex-shrink: 0;
  border-radius: 50%;
  background: conic-gradient(
    #0aae77 var(--progress),
    #dceae4 var(--progress)
  );
  padding: 7px;
  display: grid;
  place-items: center;
}

.ia-donut > div {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: white;
}

.ia-donut strong {
  font-size: 14px;
  color: #153345;
}

/* MAIN GRID */

.ia-main-grid {
  display: grid;
  grid-template-columns:
    minmax(310px, 370px)
    minmax(0, 1fr);
  align-items: start;
  gap: 14px;
}

.ia-card {
  min-width: 0;
  background: white;
  border: 1px solid #e2eaf0;
  border-radius: 15px;
  padding: 17px;
  box-shadow: 0 4px 15px #17304707;
}

.ia-form-card {
  scroll-margin-top: 20px;
}

.ia-card-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ia-title-icon {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  flex-shrink: 0;
  border-radius: 9px;
  background: #e3f5eb;
  color: #087b53;
  font-size: 20px;
  font-weight: 900;
}

.ia-card-title h2 {
  margin: 0;
  font-size: 17px;
  color: #1b3448;
}

.ia-card-title p {
  margin: 5px 0 0;
  color: #7a8a9a;
  font-size: 11px;
  line-height: 1.5;
}

/* FORM */

.ia-form {
  display: grid;
  gap: 15px;
  margin-top: 20px;
}

.ia-form label {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.ia-form label > span {
  font-size: 12px;
  font-weight: 800;
}

.ia-form select,
.ia-form input[type="date"],
.ia-form input[type="number"],
.ia-form input[type="file"],
.ia-form textarea {
  width: 100%;
  min-width: 0;
  padding: 12px;
  background: white;
  border: 1px solid #d7e3e9;
  border-radius: 9px;
  color: #173047;
  font-size: 13px;
  outline-color: #09a66f;
}

.ia-form textarea {
  resize: vertical;
  min-height: 95px;
}

.ia-char-count,
.ia-upload-note {
  color: #8292a1;
  font-size: 10px;
  font-weight: 400;
  line-height: 1.5;
}

.ia-char-count {
  text-align: right;
}

.ia-range {
  display: grid;
  gap: 4px;
  padding: 10px;
  background: #eff9f3;
  border-radius: 8px;
  color: #547969;
  font-size: 11px;
}

.ia-range strong {
  color: #207552;
}

.ia-distance {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.ia-file-selected {
  background: #eef7fb;
  color: #31647d;
  border-radius: 7px;
  padding: 8px;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.ia-primary {
  width: 100%;
  border: 0;
  border-radius: 9px;
  padding: 14px;
  background: #088a60;
  color: white;
  font-weight: 900;
  font-size: 13px;
}

.ia-primary:hover {
  background: #076f4e;
}

.ia-secondary {
  width: 100%;
  border: 1px solid #d7e3e9;
  border-radius: 9px;
  background: #edf2f5;
  color: #4a6071;
  padding: 12px;
  font-size: 12px;
  font-weight: 800;
}

.ia-form-note {
  margin: 0;
  color: #8091a0;
  font-size: 10px;
  line-height: 1.7;
}

/* HISTORY TOP */

.ia-history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 17px;
}

.ia-refresh {
  border: 1px solid #d8e8df;
  border-radius: 9px;
  padding: 9px 12px;
  background: #f1faf5;
  color: #087c55;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
}

.ia-toolbar {
  display: grid;
  grid-template-columns:
    minmax(160px, 1.5fr)
    minmax(175px, 1.3fr)
    minmax(130px, 1fr)
    minmax(110px, .9fr);
  gap: 8px;
  margin-bottom: 14px;
}

.ia-search {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid #dbe5ec;
  border-radius: 9px;
}

.ia-search > span {
  color: #7a8c9d;
  font-size: 21px;
}

.ia-search input {
  min-width: 0;
  width: 100%;
  border: none;
  outline: none;
  padding: 10px 0;
  background: transparent;
  font-size: 11px;
  color: #173047;
}

.ia-toolbar > select {
  min-width: 0;
  width: 100%;
  padding: 10px 7px;
  border: 1px solid #dbe5ec;
  border-radius: 9px;
  background: white;
  color: #334c5d;
  font-size: 11px;
}

.ia-table-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px;
  background: #f0f8f4;
  border: 1px solid #e2f0e9;
  border-radius: 9px;
  margin-bottom: 12px;
}

.ia-table-summary > div:first-child {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ia-table-summary strong {
  color: #087b54;
  font-size: 12px;
}

.ia-table-summary span {
  color: #748a7e;
  font-size: 11px;
}

.ia-summary-count {
  white-space: nowrap;
  color: #087a55;
  font-size: 11px;
  font-weight: 900;
}

/* SPREADSHEET TABLE */

.ia-table-scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid #e5edf2;
  border-radius: 10px;
}

.ia-table {
  width: 100%;
  min-width: 890px;
  border-collapse: collapse;
  font-size: 11px;
  text-align: left;
}

.ia-table thead {
  background: #edf7f2;
}

.ia-table th {
  padding: 13px 9px;
  color: #395b4b;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  border-bottom: 1px solid #dcebe2;
}

.ia-table td {
  padding: 11px 9px;
  border-bottom: 1px solid #edf1f4;
  vertical-align: middle;
  color: #425568;
}

.ia-table tbody tr:last-child td {
  border-bottom: none;
}

.ia-table tbody tr:hover {
  background: #f8fcfa;
}

.ia-no {
  text-align: center;
  color: #8b99a7 !important;
}

.ia-date-cell {
  white-space: nowrap;
  color: #344b5e !important;
  font-weight: 700;
}

.ia-description {
  max-width: 240px;
  min-width: 115px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.ia-realisasi {
  white-space: nowrap;
  font-weight: 800;
  color: #385d50 !important;
}

.ia-category-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 7px;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 800;
}

.ia-category-badge.green {
  background: #e7f7ed;
  color: #087b53;
}

.ia-category-badge.gold {
  background: #fff3de;
  color: #a66a08;
}

.ia-category-badge.teal {
  background: #e3f7f3;
  color: #087f78;
}

.ia-category-badge.blue {
  background: #e8f1ff;
  color: #266bc0;
}

.ia-category-badge.purple {
  background: #f2eafa;
  color: #7747b4;
}

.ia-category-badge.rose {
  background: #fff0e9;
  color: #b95532;
}

.ia-category-badge.gray {
  background: #edf1f3;
  color: #536576;
}

.ia-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 9px;
  border-radius: 7px;
  font-weight: 800;
  font-size: 10px;
  white-space: nowrap;
}

.ia-status.verified {
  background: #e8f8ef;
  color: #088054;
}

.ia-status.pending {
  background: #fff6e7;
  color: #ad751b;
}

.ia-status.other {
  background: #f0f2f5;
  color: #637386;
}

/* EVIDENCE */

.ia-preview-button {
  display: grid;
  place-items: center;
  width: 49px;
  height: 42px;
  border: 1px solid #dce7ed;
  border-radius: 7px;
  padding: 3px;
  background: #f5f8fa;
}

.ia-preview-button:hover {
  border-color: #11a779;
}

.ia-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
}

.ia-file-icon {
  font-size: 23px;
}

.ia-no-file {
  color: #a4afb7;
  display: block;
  text-align: center;
}

/* ACTIONS */

.ia-row-actions {
  display: flex;
  gap: 5px;
}

.ia-edit,
.ia-delete {
  width: 32px;
  height: 31px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 7px;
  font-size: 17px;
  font-weight: 900;
}

.ia-edit {
  background: #e6f0ff;
  color: #246ecb;
}

.ia-delete {
  background: #fff0f0;
  color: #d43845;
}

.ia-edit:hover {
  background: #d3e6ff;
}

.ia-delete:hover {
  background: #ffdadf;
}

.ia-empty {
  text-align: center;
  padding: 35px 12px !important;
  color: #8797a5 !important;
  font-size: 12px;
}

/* PAGINATION */

.ia-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 14px 2px;
}

.ia-pagination-info {
  color: #83919f;
  font-size: 11px;
}

.ia-pagination-info strong {
  color: #496376;
}

.ia-pagination-controls {
  display: flex;
  align-items: center;
  gap: 7px;
}

.ia-pagination-controls label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  color: #708194;
  margin-right: 8px;
}

.ia-pagination-controls select {
  padding: 7px;
  border: 1px solid #dde8ed;
  border-radius: 7px;
  background: white;
  color: #173047;
}

.ia-pagination-controls button {
  width: 31px;
  height: 31px;
  border: 1px solid #dce6ec;
  border-radius: 7px;
  background: #fff;
  color: #426477;
  font-size: 18px;
  font-weight: 800;
}

.ia-page-number {
  background: #088b61;
  color: white;
  padding: 8px 11px;
  border-radius: 7px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.ia-history-note {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
  padding-top: 13px;
  border-top: 1px solid #edf1f3;
  color: #7b8e9b;
  font-size: 10px;
}

/* BOTTOM */

.ia-bottom-navigation {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 17px;
}

.ia-bottom-navigation button {
  border: 1px solid #d7e7df;
  border-radius: 9px;
  padding: 12px 15px;
  background: #fff;
  color: #087e56;
  font-size: 12px;
  font-weight: 800;
}

.ia-footer {
  text-align: center;
  color: #94a2ad;
  font-size: 10px;
  padding: 24px 0;
}

/* PREVIEW MODAL */

.ia-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: #071a2bb8;
  display: grid;
  place-items: center;
  padding: 18px;
}

.ia-modal {
  display: flex;
  flex-direction: column;
  width: min(850px, 100%);
  max-height: 92vh;
  border-radius: 15px;
  background: white;
  overflow: hidden;
}

.ia-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 17px 20px;
  border-bottom: 1px solid #e6edf2;
}

.ia-modal-header strong {
  font-size: 16px;
}

.ia-modal-header small {
  display: block;
  margin-top: 5px;
  color: #8796a5;
  font-size: 11px;
}

.ia-modal-header button {
  border: 0;
  border-radius: 8px;
  background: #eef2f5;
  color: #344b5b;
  padding: 9px 12px;
}

.ia-modal-body {
  padding: 19px;
  overflow: auto;
}

.ia-preview-title p {
  font-size: 12px;
  line-height: 1.6;
  color: #617588;
  white-space: pre-wrap;
}

.ia-preview-image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  margin: 16px auto;
  border-radius: 9px;
}

.ia-pdf-preview iframe {
  display: block;
  width: 100%;
  height: 58vh;
  border: 1px solid #e1e8ef;
  border-radius: 9px;
}

.ia-preview-empty {
  padding: 40px 15px;
  text-align: center;
  background: #f6f8fa;
  border-radius: 10px;
  color: #8091a1;
  font-size: 13px;
}

.ia-preview-filename {
  color: #526779;
  font-size: 11px;
  margin-top: 12px;
  overflow-wrap: anywhere;
}

.ia-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding: 14px 19px;
  border-top: 1px solid #e6edf2;
}

.ia-modal-footer button,
.ia-modal-footer a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 9px;
  padding: 11px 15px;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
}

.ia-modal-footer button {
  background: #edf2f5;
  color: #455a6e;
}

.ia-modal-footer a {
  background: #078a60;
  color: white;
}

/* RESPONSIVE */

@media (max-width: 1400px) {
  .ia-profile-strip {
    grid-template-columns: 1fr;
  }

  .ia-main-grid {
    grid-template-columns: minmax(290px, 340px) minmax(0,1fr);
  }

  .ia-toolbar {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media (max-width: 1050px) {
  .ia-main-grid {
    grid-template-columns: 1fr;
  }

  .ia-profile-stats {
    grid-template-columns: repeat(4,minmax(0,1fr));
  }

  .ia-form-card {
    max-width: none;
  }
}

@media (max-width: 760px) {
  .ia-topbar {
    height: auto;
    padding: 13px;
    flex-wrap: wrap;
  }

  .ia-brand {
    font-size: 21px;
  }

  .ia-nav {
    order: 3;
    width: 100%;
    justify-content: space-between;
    gap: 2px;
  }

  .ia-nav button {
    font-size: 10px;
    padding: 10px 7px;
  }

  .ia-account-text {
    display: none;
  }

  .ia-content {
    padding: 13px 10px;
  }

  .ia-heading {
    align-items: flex-start;
    flex-direction: column;
  }

  .ia-heading h1 {
    font-size: 27px;
  }

  .ia-heading p {
    font-size: 12px;
    line-height: 1.6;
  }

  .ia-profile-left {
    gap: 10px;
    padding: 13px;
  }

  .ia-profile-avatar {
    width: 58px;
    height: 58px;
    font-size: 23px;
  }

  .ia-profile-copy h2 {
    font-size: 17px;
  }

  .ia-profile-copy > p {
    font-size: 10px;
  }

  .ia-profile-period strong {
    font-size: 10px;
  }

  .ia-profile-stats {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .ia-stat.donut {
    min-height: 105px;
  }

  .ia-card {
    padding: 13px;
  }

  .ia-toolbar {
    grid-template-columns: 1fr;
  }

  .ia-table-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .ia-pagination {
    align-items: flex-start;
    flex-direction: column;
  }

  .ia-history-header {
    flex-wrap: wrap;
  }

  .ia-bottom-navigation {
    flex-direction: column;
  }

  .ia-bottom-navigation button {
    width: 100%;
  }
}

@media (max-width: 380px) {
  .ia-profile-left {
    flex-wrap: wrap;
  }

  .ia-distance {
    grid-template-columns: 1fr;
  }

  .ia-stat.donut {
    flex-direction: column;
  }
}

@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .ia-topbar,
  .ia-form-card,
  .ia-toolbar,
  .ia-pagination,
  .ia-row-actions,
  .ia-bottom-navigation,
  .ia-back,
  .ia-refresh,
  .ia-modal-overlay {
    display: none !important;
  }

  .ia-content {
    max-width: none;
    padding: 0;
  }

  .ia-main-grid {
    display: block;
  }

  .ia-card,
  .ia-profile-left,
  .ia-profile-stats {
    box-shadow: none;
  }

  .ia-table {
    min-width: 0;
  }

  .ia-table-scroll {
    overflow: visible;
  }
}
`;
