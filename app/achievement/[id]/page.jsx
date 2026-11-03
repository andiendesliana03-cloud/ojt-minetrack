
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// INPUT ACHIEVEMENT — LIGHT / DARK MODE
//
// Tema mengikuti html[data-theme] dari RootLayout.
// Tidak menambahkan tombol tema di halaman ini.
//
// DIPERTAHANKAN:
// - Supabase dan struktur database
// - CRUD Achievement
// - Dokumentasi Supabase Storage
// - Kalender Global Week 01–25
// - Target dan perhitungan Achievement
// - Filter kategori, status, dan pencarian
// - Hak akses Admin dan Mentor
// - Tampilan desktop dan mobile
// =====================================================

const BUCKET = "achievement-files";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const FILE_MARKER = "[[OJT_FILE_V1:";
const FILE_END = "]]";

// =====================================================
// HELPERS
// =====================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
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

// =====================================================
// KALENDER GLOBAL — 25 MINGGU
// =====================================================

const GLOBAL_WEEKS = Array.from(
  { length: 25 },
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

function formatShort(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function numberText(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
      })
    : "0";
}

function kmText(value) {
  const number = Number(value) || 0;

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] || "")
    .join("")
    .toUpperCase();
}

function clamp(value) {
  return Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );
}

function categoryOf(value) {
  const key = normalize(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    ["training", "internaltraining", "pelatihan"]
      .includes(key)
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (["coaching", "pembinaan"].includes(key)) {
    return "Coaching";
  }

  if (
    ["orientasi", "orientasiarea", "areaorientation"]
      .includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"]
      .includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function programWeekRange(program, weekNumber) {
  const global = GLOBAL_WEEKS[weekNumber - 1];

  if (!global || !parseDate(program?.start_date)) {
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

  if (start > end) return null;

  return { start, end };
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
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

function initialWeek(program, rows) {
  const available = GLOBAL_WEEKS.filter(
    item => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find(item => {
    const range = programWeekRange(program, item.week);

    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const recordedWeeks = rows
    .filter(item =>
      insideProgram(item.activity_date, program)
    )
    .map(item => globalWeekOf(item.activity_date))
    .filter(Boolean);

  if (recordedWeeks.length) {
    return Math.max(...recordedWeeks);
  }

  return (
    available.find(item => item.start > today)?.week ||
    available[available.length - 1].week
  );
}

// =====================================================
// FILE METADATA
// =====================================================

function unpackDescription(raw) {
  const text = String(raw || "");
  const start = text.lastIndexOf(FILE_MARKER);

  if (start < 0) {
    return {
      description: text,
      file: null,
    };
  }

  const end = text.indexOf(
    FILE_END,
    start + FILE_MARKER.length
  );

  if (end < 0) {
    return {
      description: text,
      file: null,
    };
  }

  const encoded = text.slice(
    start + FILE_MARKER.length,
    end
  );

  try {
    const file = JSON.parse(
      decodeURIComponent(encoded)
    );

    if (
      !file ||
      typeof file !== "object" ||
      typeof file.path !== "string" ||
      !file.path
    ) {
      throw new Error("Invalid file metadata");
    }

    return {
      description: (
        text.slice(0, start) +
        text.slice(end + FILE_END.length)
      ).trim(),
      file,
    };
  } catch {
    return {
      description: text,
      file: null,
    };
  }
}

function packDescription(description, file) {
  const clean = String(description || "").trim();

  if (!file?.path) return clean;

  const encoded = encodeURIComponent(
    JSON.stringify({
      name: file.name,
      path: file.path,
    })
  );

  return `${clean}\n${FILE_MARKER}${encoded}${FILE_END}`.trim();
}

function getRecordDescription(record) {
  const raw =
    record.description ||
    record.notes ||
    record.detail ||
    record.activity_detail ||
    "";

  return unpackDescription(raw).description;
}

function getRecordFile(record) {
  const raw =
    record.description ||
    record.notes ||
    "";

  const embedded = unpackDescription(raw).file;

  if (embedded) return embedded;

  const url =
    record.evidence_url ||
    record.file_url ||
    record.attachment_url ||
    record.document_url ||
    null;

  const name =
    record.evidence_name ||
    record.file_name ||
    record.attachment_name ||
    record.document_name ||
    null;

  return url
    ? {
        name: name || "Dokumentasi Achievement",
        url,
      }
    : null;
}

// =====================================================
// PROGRESS BAR
// =====================================================

function ProgressBar({ value }) {
  return (
    <div
      className="ia-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamp(value)}
    >
      <span style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

export default function InputAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [week, setWeek] = useState(1);

  const [formType, setFormType] = useState("");
  const [formDate, setFormDate] = useState(todayWITA());

  const [formDescription, setFormDescription] =
    useState("");

  const [formKm, setFormKm] = useState("");
  const [formMeter, setFormMeter] = useState("");

  const [formFile, setFormFile] = useState(null);
  const [retainedFile, setRetainedFile] = useState(null);

  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] =
    useState("all");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const role = roleOf(manager?.role);

  const roleName =
    role === "admin"
      ? "Administrator"
      : "Mentor OJT";

  const accountName =
    manager?.full_name || roleName;

  const selectedGlobal = GLOBAL_WEEKS[week - 1];

  // ===================================================
  // SUPABASE — EXISTING SCHEMA
  // ===================================================

  async function fetchAchievements(id) {
    const { data, error: queryError } = await supabase
      .from("achievement_records")
      .select("*")
      .eq("program_id", id)
      .order("activity_date", { ascending: false });

    if (queryError) throw queryError;

    return data || [];
  }

  async function verifyAccess() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      throw new Error("Silakan login kembali.");
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;

    const currentRole = roleOf(profile?.role);

    if (["peserta", "participant"].includes(currentRole)) {
      router.replace("/dashboard-peserta");
      throw new Error("Akses khusus Admin dan Mentor.");
    }

    if (!["admin", "mentor"].includes(currentRole)) {
      throw new Error("Akun tidak memiliki izin akses.");
    }

    let query = supabase
      .from("ojt_programs")
      .select(`
        id,
        site,
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

    if (currentRole === "mentor") {
      query = query.eq("mentor_id", user.id);
    }

    const { data: programData, error: programError } =
      await query.maybeSingle();

    if (programError) throw programError;

    if (
      !programData ||
      !parseDate(programData.start_date)
    ) {
      throw new Error(
        "Program OJT tidak ditemukan atau akses ditolak."
      );
    }

    return {
      profile,
      programData,
    };
  }

  // ===================================================
  // INITIAL LOAD
  // ===================================================

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
        const access = await verifyAccess();

        const [typeResult, achievementRows] =
          await Promise.all([
            supabase
              .from("achievement_types")
              .select("code,name")
              .order("name"),

            fetchAchievements(access.programData.id),
          ]);

        if (typeResult.error) {
          throw typeResult.error;
        }

        if (!active) return;

        setManager(access.profile);
        setProgram(access.programData);
        setTypes(typeResult.data || []);
        setRecords(achievementRows);

        setWeek(
          initialWeek(
            access.programData,
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

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router]);

  // ===================================================
  // REFRESH
  // ===================================================

  async function refresh() {
    if (refreshing || loading || saving) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await verifyAccess();

      const rows = await fetchAchievements(programId);

      setRecords(rows);
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
  // GLOBAL WEEKS AND CATEGORIES
  // ===================================================

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(item =>
        programWeekRange(program, item.week)
      ),
    [program]
  );

  const selectedRange = useMemo(
    () => programWeekRange(program, week),
    [program, week]
  );

  const typeMap = useMemo(() => {
    return new Map(
      types.map(item => [
        normalize(item.code),
        categoryOf(item.code) ||
          categoryOf(item.name),
      ])
    );
  }, [types]);

  function recordCategory(record) {
    return (
      typeMap.get(normalize(record.type_code)) ||
      categoryOf(record.type_code) ||
      "Kategori Lain"
    );
  }

  const typeOptions = useMemo(() => {
    return types.map(item => ({
      code: item.code,
      label:
        categoryOf(item.code) ||
        categoryOf(item.name) ||
        item.name,
    }));
  }, [types]);

  const currentCategory =
    typeOptions.find(item => item.code === formType)
      ?.label || "";

  const isFisik = currentCategory === "Fisik";

  // ===================================================
  // WEEKLY RECORDS
  // ===================================================

  const weeklyRows = useMemo(() => {
    return records.filter(item =>
      insideProgram(item.activity_date, program) &&
      globalWeekOf(item.activity_date) === week
    );
  }, [records, program, week]);

  const verified = useMemo(
    () =>
      weeklyRows.filter(
        item => roleOf(item.status) === "verified"
      ),
    [weeklyRows]
  );

  const pending = useMemo(
    () =>
      weeklyRows.filter(
        item => roleOf(item.status) === "pending"
      ),
    [weeklyRows]
  );

  // ===================================================
  // CATEGORY PROGRESS — ORIGINAL FORMULA
  // ===================================================

  const categories = useMemo(() => {
    return TARGETS.map(target => {
      const matching = verified.filter(
        item => recordCategory(item) === target.name
      );

      const actual =
        target.name === "Fisik"
          ? matching.reduce((sum, item) => {
              const km = Number(item.distance_km);

              return sum +
                (Number.isFinite(km) && km > 0
                  ? Math.round(km * 1000)
                  : 0);
            }, 0) / 1000
          : matching.length;

      const percent = clamp(
        (actual / target.target) * 100
      );

      return {
        ...target,
        actual,
        percent,
        count: matching.length,
        achieved: actual >= target.target,
      };
    });
  }, [verified, typeMap]);

  const overall = useMemo(() => {
    return categories.reduce(
      (sum, item) => sum + item.percent,
      0
    ) / TARGETS.length;
  }, [categories]);

  const completedCategories = categories.filter(
    item => item.achieved
  ).length;

  // ===================================================
  // HISTORY FILTER
  // ===================================================

  const history = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return weeklyRows.filter(item => {
      const category = recordCategory(item);

      const description =
        getRecordDescription(item);

      const matchesCategory =
        categoryFilter === "all" ||
        category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" ||
        roleOf(item.status) === statusFilter;

      const searchable = [
        category,
        description,
        item.activity_date,
        item.distance_km,
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesCategory &&
        matchesStatus &&
        (!keyword || searchable.includes(keyword))
      );
    });
  }, [
    weeklyRows,
    search,
    categoryFilter,
    statusFilter,
    typeMap,
  ]);

  // ===================================================
  // FORM ACTIONS
  // ===================================================

  function changeWeek(value) {
    const nextWeek = Number(value);

    if (
      !availableWeeks.some(
        item => item.week === nextWeek
      )
    ) {
      return;
    }

    setWeek(nextWeek);

    if (!editId) {
      const range = programWeekRange(
        program,
        nextWeek
      );

      if (range) {
        setFormDate(range.end);
      }
    }
  }

  function resetForm() {
    setEditId(null);
    setFormType("");
    setFormDescription("");
    setFormKm("");
    setFormMeter("");
    setFormFile(null);
    setRetainedFile(null);

    setFormDate(
      selectedRange?.end || todayWITA()
    );

    const input =
      document.getElementById("ia-evidence-file");

    if (input) input.value = "";
  }

  function beginEdit(item) {
    const category = recordCategory(item);

    const matchingType = types.find(
      type =>
        normalize(type.code) ===
        normalize(item.type_code)
    );

    setEditId(item.id);
    setWeek(globalWeekOf(item.activity_date) || week);

    setFormType(
      matchingType?.code || item.type_code
    );

    setFormDate(
      String(item.activity_date).slice(0, 10)
    );

    setFormDescription(
      getRecordDescription(item)
    );

    setRetainedFile(getRecordFile(item));
    setFormFile(null);

    const input =
      document.getElementById("ia-evidence-file");

    if (input) input.value = "";

    if (category === "Fisik") {
      const meters = Math.round(
        Math.max(0, Number(item.distance_km) || 0) *
          1000
      );

      setFormKm(String(Math.floor(meters / 1000)));
      setFormMeter(String(meters % 1000));
    } else {
      setFormKm("");
      setFormMeter("");
    }

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function calculateDistance() {
    const km = Number(formKm || 0);
    const meters = Number(formMeter || 0);

    if (
      !Number.isInteger(km) ||
      !Number.isInteger(meters) ||
      km < 0 ||
      meters < 0 ||
      meters > 999
    ) {
      throw new Error(
        "Jarak harus berupa kilometer dan meter yang valid."
      );
    }

    const result = km + meters / 1000;

    if (result <= 0) {
      throw new Error(
        "Masukkan jarak Fisik lebih dari 0 meter."
      );
    }

    return result;
  }

  // ===================================================
  // FILE UPLOAD
  // ===================================================

  async function uploadFile(file) {
    if (!file) return null;

    const extensions = ["png", "jpg", "jpeg", "pdf"];

    const extension =
      file.name.split(".").pop()?.toLowerCase() || "";

    if (!extensions.includes(extension)) {
      throw new Error(
        "Dokumentasi harus berupa PNG, JPG, JPEG, atau PDF."
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        "Ukuran dokumentasi maksimal 5 MB."
      );
    }

    const unique =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    const path =
      `${programId}/${unique}.${extension}`;

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType:
            file.type ||
            (extension === "pdf"
              ? "application/pdf"
              : "image/jpeg"),
        });

    if (uploadError) {
      throw new Error(
        `Upload dokumentasi gagal: ${uploadError.message}`
      );
    }

    return {
      name: file.name,
      path,
    };
  }

  async function removeUploadedFile(file) {
    if (!file?.path) return;

    await supabase.storage
      .from(BUCKET)
      .remove([file.path]);
  }

  // ===================================================
  // SAVE ACHIEVEMENT
  // ===================================================

  async function saveAchievement(event) {
    event.preventDefault();

    if (
      saving ||
      deletingId ||
      !program ||
      !manager
    ) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let newlyUploadedFile = null;
    let databaseSaved = false;

    try {
      await verifyAccess();

      if (!formType) {
        throw new Error(
          "Pilih kategori Achievement."
        );
      }

      if (!selectedRange) {
        throw new Error(
          "Week tidak termasuk periode OJT peserta."
        );
      }

      if (
        !parseDate(formDate) ||
        formDate < selectedRange.start ||
        formDate > selectedRange.end
      ) {
        throw new Error(
          "Tanggal harus sesuai rentang Week Global dan periode peserta."
        );
      }

      const distance = isFisik
        ? calculateDistance()
        : null;

      if (formFile) {
        newlyUploadedFile =
          await uploadFile(formFile);
      }

      const file =
        newlyUploadedFile || retainedFile;

      const payload = {
        program_id: programId,
        type_code: formType,
        activity_date: formDate,
        description: packDescription(
          formDescription,
          file?.path ? file : null
        ),
        distance_km: distance,
        status: "verified",
        verified_by: manager.id,
      };

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
          .insert(payload)
          .select("id");
      }

      if (result.error) {
        throw result.error;
      }

      if (!result.data?.length) {
        throw new Error(
          "Database tidak mengonfirmasi penyimpanan. Periksa izin Supabase."
        );
      }

      databaseSaved = true;

      if (
        editId &&
        newlyUploadedFile &&
        retainedFile?.path &&
        retainedFile.path !== newlyUploadedFile.path
      ) {
        await removeUploadedFile(retainedFile);
      }

      const rows =
        await fetchAchievements(programId);

      setRecords(rows);

      setMessage(
        editId
          ? "Achievement berhasil diperbarui."
          : "Achievement berhasil disimpan."
      );

      resetForm();
    } catch (err) {
      if (!databaseSaved && newlyUploadedFile) {
        await removeUploadedFile(newlyUploadedFile);
      }

      if (databaseSaved) {
        setMessage(
          "Achievement tersimpan, tetapi pembaruan tampilan belum berhasil. Gunakan Refresh."
        );
      } else {
        setError(
          err?.message ||
          "Gagal menyimpan Achievement."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // DELETE ACHIEVEMENT
  // ===================================================

  async function deleteAchievement(item) {
    if (
      saving ||
      deletingId ||
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
      await verifyAccess();

      const { data, error: deleteError } =
        await supabase
          .from("achievement_records")
          .delete()
          .eq("id", item.id)
          .eq("program_id", programId)
          .select("id");

      if (deleteError) {
        throw deleteError;
      }

      if (!data?.length) {
        throw new Error(
          "Penghapusan tidak dikonfirmasi oleh database."
        );
      }

      const file = getRecordFile(item);

      if (file?.path) {
        await removeUploadedFile(file);
      }

      setRecords(previous =>
        previous.filter(row => row.id !== item.id)
      );

      if (editId === item.id) {
        resetForm();
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
  // OPEN DOCUMENTATION
  // ===================================================

  async function openEvidence(item) {
    const file = getRecordFile(item);

    if (!file) {
      setError(
        "Tidak ada dokumentasi yang tersimpan pada kegiatan ini."
      );
      return;
    }

    const tab = window.open(
      "about:blank",
      "_blank"
    );

    setOpeningId(item.id);
    setError("");

    try {
      let url = file.url || null;

      if (file.path) {
        const { data, error: signedError } =
          await supabase.storage
            .from(BUCKET)
            .createSignedUrl(file.path, 60 * 10);

        if (signedError || !data?.signedUrl) {
          throw new Error(
            signedError?.message ||
            "Tidak dapat membuat tautan dokumentasi."
          );
        }

        url = data.signedUrl;
      }

      if (!url || !/^https?:\/\//i.test(url)) {
        throw new Error(
          "Alamat dokumentasi tidak valid."
        );
      }

      if (tab && !tab.closed) {
        tab.location.replace(url);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (tab && !tab.closed) tab.close();

      setError(
        `Dokumentasi gagal dibuka: ${
          err?.message || "File tidak tersedia."
        }`
      );
    } finally {
      setOpeningId(null);
    }
  }

  // ===================================================
  // LOADING / ACCESS SCREEN
  // ===================================================

  if (loading) {
    return (
      <main className="ia-loading">
        <style>{css}</style>
        Memuat Input Achievement OJT...
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="ia-loading">
        <style>{css}</style>
        <div>
          <h2>Input Achievement tidak tersedia</h2>
          <p>{error || "Akses tidak tersedia."}</p>
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
  // MAIN UI
  // ===================================================

  return (
    <main className="ia-root">
      <style>{css}</style>

      {/* ================================================
          HEADER
          ================================================ */}

      <header className="ia-header">
        <div className="ia-brand">
          OJT <span>MineTrack</span>
          <small>v2.0</small>
        </div>

        <div className="ia-account">
          <div>
            <small>{roleName}</small>
            <strong>{accountName}</strong>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(`/peserta/${programId}`)
            }
          >
            ← Detail Peserta
          </button>
        </div>
      </header>

      <div className="ia-container">

        {/* ============================================
            HERO
            ============================================ */}

        <section className="ia-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Input Achievement OJT</h1>

          <p>
            Pencatatan kegiatan dan dokumentasi
            pencapaian peserta berdasarkan Kalender
            Global 25 Minggu.
          </p>

          <div className="ia-person">
            <div className="ia-avatar">
              {initials(participantName)}
            </div>

            <div>
              <strong>{participantName}</strong>

              <span>
                {participant?.department || "—"}
                {" · "}
                {program.site || "—"}
              </span>

              <small>
                {formatDate(program.start_date)}
                {" – "}
                {formatDate(program.end_date)}
              </small>
            </div>
          </div>
        </section>

        {/* ============================================
            NAVIGATION
            ============================================ */}

        <nav className="ia-tabs">
          <span className="active">
            ✍️ Input Achievement
          </span>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            📊 Monitoring Achievement
          </button>
        </nav>

        {/* ALERTS */}

        {error && (
          <div
            className="ia-alert error"
            role="alert"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="ia-alert success"
            role="status"
          >
            ✓ {message}
          </div>
        )}

        {/* ============================================
            TOOLBAR
            ============================================ */}

        <div className="ia-toolbar">
          <div>
            <strong>
              Dashboard Input Achievement
            </strong>
            <small>
              Kalender Global OJT 2026–2027
            </small>
          </div>

          <div className="ia-toolbar-actions">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || saving}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh"}
            </button>

            <button
              type="button"
              className="primary"
              onClick={() =>
                router.push(
                  `/achievement/${programId}/monitoring`
                )
              }
            >
              📊 Monitoring
            </button>
          </div>
        </div>

        {/* ============================================
            WEEKLY SUMMARY
            ============================================ */}

        <section className="ia-card">
          <div className="ia-section-head">
            <div>
              <h2>
                Ringkasan Achievement Mingguan
              </h2>

              <p>
                Target dan kegiatan terverifikasi
                pada minggu terpilih.
              </p>
            </div>

            <div className="ia-week-control">
              <button
                type="button"
                disabled={
                  !availableWeeks.some(
                    item => item.week === week - 1
                  )
                }
                onClick={() => changeWeek(week - 1)}
                aria-label="Minggu sebelumnya"
              >
                ‹
              </button>

              <select
                aria-label="Pilih Week Global"
                value={week}
                onChange={event =>
                  changeWeek(event.target.value)
                }
              >
                {availableWeeks.map(item => (
                  <option
                    value={item.week}
                    key={item.week}
                  >
                    Week {String(item.week).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={
                  !availableWeeks.some(
                    item => item.week === week + 1
                  )
                }
                onClick={() => changeWeek(week + 1)}
                aria-label="Minggu berikutnya"
              >
                ›
              </button>
            </div>
          </div>

          <div className="ia-period">
            <strong>
              Week {String(week).padStart(2, "0")}
            </strong>

            <span>
              {formatDate(selectedGlobal?.start)}
              {" – "}
              {formatDate(selectedGlobal?.end)}
            </span>

            {selectedRange && (
              <small>
                Periode peserta:{" "}
                {formatShort(selectedRange.start)}
                {" – "}
                {formatShort(selectedRange.end)}
              </small>
            )}
          </div>

          <div className="ia-summary-grid">
            <div className="ia-summary-card progress">
              <div>
                <small>
                  Rata-rata Pencapaian
                </small>

                <strong>
                  {numberText(overall)}%
                </strong>

                <span>
                  Enam kategori mingguan
                </span>
              </div>

              <div
                className="ia-donut"
                style={{
                  "--progress": `${clamp(overall)}%`,
                }}
              >
                <div>📊</div>
              </div>
            </div>

            <div className="ia-summary-card">
              <span>📋</span>
              <small>Total Kegiatan</small>
              <strong>{weeklyRows.length}</strong>
            </div>

            <div className="ia-summary-card green">
              <span>✅</span>
              <small>Verified</small>
              <strong>{verified.length}</strong>
            </div>

            <div className="ia-summary-card orange">
              <span>◷</span>
              <small>Pending</small>
              <strong>{pending.length}</strong>
            </div>

            <div className="ia-summary-card blue">
              <span>🎯</span>
              <small>Kategori Tercapai</small>
              <strong>{completedCategories}/6</strong>
            </div>
          </div>
        </section>

        {/* ============================================
            FORM AND HISTORY
            ============================================ */}

        <div className="ia-main-grid">

          {/* INPUT FORM */}

          <section className="ia-card">
            <div className="ia-section-head">
              <div>
                <h2>
                  {editId
                    ? "Edit Achievement"
                    : "Tambah Achievement"}
                </h2>

                <p>
                  Isi pencapaian sesuai minggu
                  dan kategori kegiatan.
                </p>
              </div>

              <span className="ia-form-icon">
                ✍️
              </span>
            </div>

            <form
              className="ia-form"
              onSubmit={saveAchievement}
            >
              <label>
                <span>
                  Kategori Achievement
                </span>

                <select
                  value={formType}
                  onChange={event =>
                    setFormType(event.target.value)
                  }
                  required
                >
                  <option value="">
                    Pilih Kategori
                  </option>

                  {typeOptions.map(item => (
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
                  value={week}
                  onChange={event =>
                    changeWeek(event.target.value)
                  }
                >
                  {availableWeeks.map(item => (
                    <option
                      key={item.week}
                      value={item.week}
                    >
                      Week {String(item.week).padStart(2, "0")}
                      {" · "}
                      {formatShort(item.start)}
                      {" – "}
                      {formatShort(item.end)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>
                  Tanggal Pencapaian
                </span>

                <input
                  type="date"
                  value={formDate}
                  min={selectedRange?.start}
                  max={selectedRange?.end}
                  onChange={event =>
                    setFormDate(event.target.value)
                  }
                  required
                />
              </label>

              {selectedRange && (
                <div className="ia-range-note">
                  Tanggal yang diperbolehkan:

                  <strong>
                    {formatDate(selectedRange.start)}
                    {" – "}
                    {formatDate(selectedRange.end)}
                  </strong>
                </div>
              )}

              {isFisik && (
                <div className="ia-distance-grid">
                  <label>
                    <span>Kilometer</span>

                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={formKm}
                      onChange={event =>
                        setFormKm(event.target.value)
                      }
                    />
                  </label>

                  <label>
                    <span>
                      Tambahan Meter
                    </span>

                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      placeholder="0"
                      value={formMeter}
                      onChange={event =>
                        setFormMeter(event.target.value)
                      }
                    />
                  </label>
                </div>
              )}

              <label>
                <span>
                  Deskripsi Pencapaian
                </span>

                <textarea
                  rows={4}
                  value={formDescription}
                  maxLength={500}
                  placeholder="Tuliskan kegiatan yang telah dilaksanakan..."
                  onChange={event =>
                    setFormDescription(event.target.value)
                  }
                />

                <small className="ia-character">
                  {formDescription.length}/500
                </small>
              </label>

              <label>
                <span>
                  Bukti / Dokumentasi (Opsional)
                </span>

                <input
                  id="ia-evidence-file"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={event =>
                    setFormFile(
                      event.target.files?.[0] || null
                    )
                  }
                />

                <small className="ia-file-note">
                  PNG, JPG, JPEG atau PDF · Maksimal 5 MB
                </small>
              </label>

              {retainedFile && (
                <div className="ia-existing-file">
                  <span>
                    📎 Dokumentasi saat ini:{" "}
                    {retainedFile.name ||
                      "File tersimpan"}
                  </span>

                  <small>
                    Pilih file baru untuk mengganti
                    dokumentasi lama.
                  </small>
                </div>
              )}

              <div className="ia-form-actions">
                <button
                  className="ia-primary"
                  type="submit"
                  disabled={
                    saving ||
                    Boolean(deletingId)
                  }
                >
                  {saving
                    ? "Menyimpan..."
                    : editId
                    ? "✓ Simpan Perubahan"
                    : "＋ Simpan Achievement"}
                </button>

                {editId && (
                  <button
                    className="ia-secondary"
                    type="button"
                    onClick={resetForm}
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* ========================================
              HISTORY TABLE
              ======================================== */}

          <section className="ia-card ia-history-card">
            <div className="ia-section-head">
              <div>
                <h2>
                  Riwayat Achievement
                </h2>

                <p>
                  Catatan kegiatan pada{" "}
                  Week {String(week).padStart(2, "0")}.
                </p>
              </div>

              <strong className="ia-count">
                {history.length} kegiatan
              </strong>
            </div>

            <div className="ia-filters">
              <input
                type="search"
                value={search}
                placeholder="Cari kegiatan atau deskripsi..."
                onChange={event =>
                  setSearch(event.target.value)
                }
              />

              <select
                value={categoryFilter}
                onChange={event =>
                  setCategoryFilter(event.target.value)
                }
              >
                <option value="all">
                  Semua Kategori
                </option>

                {TARGETS.map(item => (
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
                onChange={event =>
                  setStatusFilter(event.target.value)
                }
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

            <div className="ia-table-scroll">
              <table className="ia-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Deskripsi Kegiatan</th>
                    <th>Realisasi</th>
                    <th>Dokumentasi</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item, index) => {
                    const category =
                      recordCategory(item);

                    const file =
                      getRecordFile(item);

                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>

                        <td className="ia-nowrap">
                          {formatDate(item.activity_date)}
                        </td>

                        <td>
                          <span className="ia-category-cell">
                            {
                              TARGETS.find(
                                target =>
                                  target.name === category
                              )?.icon || "📋"
                            }
                            {" "}
                            {category}
                          </span>
                        </td>

                        <td className="ia-description">
                          {getRecordDescription(item) ||
                            "Tidak ada deskripsi tambahan."}
                        </td>

                        <td className="ia-nowrap">
                          {category === "Fisik"
                            ? `${kmText(item.distance_km)} km`
                            : "1 kegiatan"}
                        </td>

                        <td>
                          {file ? (
                            <button
                              type="button"
                              className="ia-document-button"
                              disabled={openingId === item.id}
                              onClick={() =>
                                openEvidence(item)
                              }
                              title={
                                file.name ||
                                "Buka dokumentasi"
                              }
                            >
                              {openingId === item.id
                                ? "Membuka..."
                                : "📎 Lihat Bukti"}
                            </button>
                          ) : (
                            <span className="ia-muted">
                              —
                            </span>
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              "ia-status " +
                              (roleOf(item.status) ===
                              "verified"
                                ? "verified"
                                : "pending")
                            }
                          >
                            {roleOf(item.status) ===
                            "verified"
                              ? "✓ Verified"
                              : "◷ Pending"}
                          </span>
                        </td>

                        <td>
                          <div className="ia-table-actions">
                            <button
                              type="button"
                              className="ia-edit"
                              disabled={
                                saving ||
                                Boolean(deletingId)
                              }
                              onClick={() =>
                                beginEdit(item)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="ia-delete"
                              disabled={
                                saving ||
                                Boolean(deletingId)
                              }
                              onClick={() =>
                                deleteAchievement(item)
                              }
                            >
                              {deletingId === item.id
                                ? "..."
                                : "Hapus"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!history.length && (
                    <tr>
                      <td
                        colSpan={8}
                        className="ia-empty"
                      >
                        Belum ada kegiatan yang
                        sesuai dengan filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="ia-table-footer">
              <span>
                Total {history.length} kegiatan ditampilkan
              </span>

              <span>
                Week {String(week).padStart(2, "0")}
                {" · "}
                {formatShort(selectedGlobal?.start)}
                {" – "}
                {formatShort(selectedGlobal?.end)}
              </span>
            </div>
          </section>
        </div>

        {/* ============================================
            SIX CATEGORY PROGRESS
            ============================================ */}

        <section className="ia-card">
          <div className="ia-section-head">
            <div>
              <h2>
                Progres Enam Kategori
              </h2>

              <p>
                Realisasi Verified pada Week{" "}
                {String(week).padStart(2, "0")}.
              </p>
            </div>

            <strong className="ia-overall">
              {numberText(overall)}%
            </strong>
          </div>

          <div className="ia-category-grid">
            {categories.map(item => (
              <div
                className="ia-category-card"
                key={item.name}
              >
                <div className="ia-category-top">
                  <strong>
                    {item.icon} {item.name}
                  </strong>

                  <b>
                    {numberText(item.percent)}%
                  </b>
                </div>

                <div className="ia-category-amount">
                  {item.name === "Fisik"
                    ? `${kmText(item.actual)} km`
                    : `${item.actual} kegiatan`}
                </div>

                <ProgressBar value={item.percent} />

                <small>
                  Target: {item.target} {item.unit}
                </small>
              </div>
            ))}
          </div>

          <p className="ia-note">
            Capaian dihitung hanya dari Achievement
            berstatus Verified. Persentase dibatasi
            maksimal 100%, tetapi realisasi aktual
            tetap ditampilkan sepenuhnya.
          </p>
        </section>

        {/* ============================================
            BOTTOM NAVIGATION
            ============================================ */}

        <div className="ia-bottom">
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
            className="primary"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            📊 Monitoring Achievement
          </button>
        </div>

        <footer className="ia-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS — LIGHT / DARK MODE
// =====================================================

const css = `

/* =====================================================
   THEME VARIABLES — LIGHT MODE
   ===================================================== */

.ia-root,
.ia-root *,
.ia-loading,
.ia-loading * {
  box-sizing: border-box;
}

.ia-root,
.ia-loading {
  --ia-bg: #f2f6f7;
  --ia-surface: #ffffff;
  --ia-surface-soft: #f7faf8;
  --ia-surface-muted: #edf8f1;

  --ia-text: #17352d;
  --ia-heading: #18372e;
  --ia-muted: #82948a;
  --ia-border: #e1ebe6;
  --ia-border-soft: #ecf1ed;

  --ia-input: #ffffff;
  --ia-input-text: #18392e;
  --ia-table-head: #eaf5ee;
  --ia-table-even: #fbfdfb;
  --ia-table-hover: #f0f9f4;

  --ia-green: #07885f;
  --ia-progress-track: #e2ece5;
  --ia-shadow: rgba(21,61,43,.035);

  min-height: 100vh;

  background: var(--ia-bg);
  color: var(--ia-text);

  font-family: Arial, Helvetica, sans-serif;
}

/* =====================================================
   THEME VARIABLES — DARK MODE
   ===================================================== */

:root[data-theme="dark"] .ia-root,
:root[data-theme="dark"] .ia-loading {
  --ia-bg: #0d171b;
  --ia-surface: #17272b;
  --ia-surface-soft: #203438;
  --ia-surface-muted: #1b3933;

  --ia-text: #e6f4ef;
  --ia-heading: #f0faf6;
  --ia-muted: #a5bbb8;
  --ia-border: #30484b;
  --ia-border-soft: #2b4145;

  --ia-input: #1b3034;
  --ia-input-text: #edf8f4;
  --ia-table-head: #233b3d;
  --ia-table-even: #1a2c30;
  --ia-table-hover: #25413d;

  --ia-green: #55d6a7;
  --ia-progress-track: #344b4b;
  --ia-shadow: rgba(0,0,0,.18);
}

/* =====================================================
   GLOBAL CONTROLS
   ===================================================== */

.ia-root button,
.ia-root input,
.ia-root select,
.ia-root textarea {
  font-family: inherit;
}

.ia-root button {
  cursor: pointer;
}

.ia-root button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.ia-root button:focus-visible,
.ia-root input:focus-visible,
.ia-root select:focus-visible,
.ia-root textarea:focus-visible {
  outline: 3px solid #61d8ae;
  outline-offset: 2px;
}

/* =====================================================
   LOADING / ACCESS
   ===================================================== */

.ia-loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 30px;

  font-size: 14px;
  text-align: center;
}

.ia-loading h2 {
  color: var(--ia-heading);
}

.ia-loading p {
  color: var(--ia-muted);
  line-height: 1.6;
}

.ia-loading button {
  padding: 12px 15px;
  border: 0;
  border-radius: 9px;

  background: #07885f;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

/* =====================================================
   HEADER
   ===================================================== */

.ia-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;

  padding: 15px 25px;

  background: #071e25;
  color: white;
}

.ia-brand {
  font-size: 23px;
  font-weight: 900;
  letter-spacing: -.5px;
}

.ia-brand span {
  color: #2cc992;
}

.ia-brand small {
  font-size: 10px;
  margin-left: 6px;
  color: #a9c7bc;
}

.ia-account {
  display: flex;
  align-items: center;
  gap: 17px;
}

.ia-account strong,
.ia-account small {
  display: block;
  text-align: right;
}

.ia-account small {
  font-size: 10px;
  color: #bad5cc;
  margin-bottom: 4px;
}

.ia-account strong {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.ia-account button {
  border: 1px solid #ffffff40;
  background: #ffffff15;
  color: white;

  border-radius: 9px;
  padding: 11px 13px;

  font-size: 12px;
  font-weight: 800;
}

.ia-account button:hover {
  background: #ffffff2a;
}

/* =====================================================
   LAYOUT
   ===================================================== */

.ia-container {
  max-width: 1500px;
  margin: auto;
  padding: 20px;
}

/* =====================================================
   HERO
   ===================================================== */

.ia-hero {
  padding: 28px;
  border-radius: 17px;
  color: white;

  background:
    linear-gradient(
      100deg,
      rgba(4,25,33,.97),
      rgba(5,61,53,.75)
    ),
    url("/background-erg.png.PNG");

  background-size: cover;
  background-position: center;
}

.ia-hero > small {
  color: #e7c777;

  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.ia-hero h1 {
  font-size: clamp(26px,3vw,38px);
  margin: 12px 0 9px;
}

.ia-hero > p {
  color: #d5e6df;
  font-size: 13px;
  line-height: 1.7;
  max-width: 650px;
}

.ia-person {
  display: flex;
  align-items: center;
  gap: 12px;

  margin-top: 20px;
  width: fit-content;
  max-width: 100%;

  padding: 12px;
  border-radius: 11px;

  background: #092a2dcc;
  border: 1px solid #ffffff38;
}

.ia-avatar {
  display: grid;
  place-items: center;
  flex-shrink: 0;

  width: 44px;
  height: 44px;

  background: #e2f4e8;
  color: #087655;

  border-radius: 10px;

  font-size: 16px;
  font-weight: 900;
}

.ia-person strong,
.ia-person span,
.ia-person small {
  display: block;
}

.ia-person strong {
  font-size: 13px;
  overflow-wrap: anywhere;
}

.ia-person span,
.ia-person small {
  margin-top: 5px;
  color: #c5dfd5;
  font-size: 11px;
}

/* =====================================================
   NAVIGATION TABS
   ===================================================== */

.ia-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 15px 0;
}

.ia-tabs button,
.ia-tabs span {
  border: 1px solid var(--ia-border);
  background: var(--ia-surface);
  color: var(--ia-green);

  border-radius: 10px;
  padding: 12px 16px;

  font-size: 12px;
  font-weight: 800;
}

.ia-tabs .active {
  background: #078b61;
  color: white;
  border-color: #078b61;
}

.ia-tabs button:hover {
  background: var(--ia-surface-soft);
}

/* =====================================================
   ALERTS
   ===================================================== */

.ia-alert {
  padding: 13px 15px;
  border-radius: 10px;
  margin-bottom: 14px;

  font-size: 12px;
  line-height: 1.6;
}

.ia-alert.error {
  background: #fff1f1;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.ia-alert.success {
  background: #eaf9f0;
  color: #087b56;
  border: 1px solid #bce8ce;
}

:root[data-theme="dark"] .ia-alert.error {
  background: #44272c;
  color: #ffbdc6;
  border-color: #76434c;
}

:root[data-theme="dark"] .ia-alert.success {
  background: #1b4534;
  color: #b2f2cc;
  border-color: #35674f;
}

/* =====================================================
   TOOLBAR
   ===================================================== */

.ia-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;

  gap: 12px;
  margin-bottom: 14px;
}

.ia-toolbar strong,
.ia-toolbar small {
  display: block;
}

.ia-toolbar strong {
  font-size: 14px;
  color: var(--ia-heading);
}

.ia-toolbar small {
  font-size: 11px;
  margin-top: 5px;
  color: var(--ia-muted);
}

.ia-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ia-toolbar-actions button,
.ia-bottom button {
  background: var(--ia-surface);
  color: var(--ia-green);

  border: 1px solid var(--ia-border);

  padding: 11px 14px;
  border-radius: 9px;

  font-size: 12px;
  font-weight: 800;
}

.ia-toolbar-actions button:hover:not(:disabled),
.ia-bottom button:hover:not(:disabled) {
  background: var(--ia-surface-soft);
}

.ia-toolbar-actions .primary,
.ia-bottom .primary {
  background: #07885f;
  color: white;
  border-color: #07885f;
}

.ia-toolbar-actions .primary:hover,
.ia-bottom .primary:hover {
  background: #09996c;
}

/* =====================================================
   MAIN CARDS
   ===================================================== */

.ia-card {
  background: var(--ia-surface);
  border: 1px solid var(--ia-border);
  border-radius: 15px;

  padding: 19px;
  margin-bottom: 15px;

  min-width: 0;

  box-shadow: 0 5px 17px var(--ia-shadow);
}

.ia-section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;

  gap: 12px;
  margin-bottom: 16px;
}

.ia-section-head h2 {
  font-size: 18px;
  margin: 0;
  color: var(--ia-heading);
}

.ia-section-head p {
  margin: 7px 0 0;
  color: var(--ia-muted);

  font-size: 12px;
  line-height: 1.5;
}

/* =====================================================
   WEEK CONTROLS
   ===================================================== */

.ia-week-control {
  display: flex;
  gap: 5px;
}

.ia-week-control select,
.ia-week-control button {
  padding: 10px;

  border: 1px solid var(--ia-border);
  background: var(--ia-surface-soft);
  color: var(--ia-green);

  border-radius: 8px;

  font-size: 12px;
  font-weight: 800;
}

.ia-week-control select {
  color-scheme: light;
}

:root[data-theme="dark"] .ia-week-control select {
  color-scheme: dark;
}

.ia-week-control option {
  color: var(--ia-input-text);
  background: var(--ia-input);
}

.ia-period {
  display: flex;
  align-items: center;
  gap: 13px;
  flex-wrap: wrap;

  background: var(--ia-surface-muted);
  color: var(--ia-muted);

  padding: 12px;
  border-radius: 10px;

  font-size: 12px;
  margin-bottom: 14px;
}

.ia-period strong {
  color: var(--ia-green);
}

.ia-period small {
  font-size: 11px;
}

/* =====================================================
   SUMMARY GRID
   ===================================================== */

.ia-summary-grid {
  display: grid;

  grid-template-columns:
    1.45fr repeat(4,minmax(0,1fr));

  gap: 10px;
}

.ia-summary-card {
  min-width: 0;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;

  padding: 15px;
  border-radius: 12px;

  background: var(--ia-surface-soft);
  border: 1px solid var(--ia-border);
}

.ia-summary-card small {
  font-size: 11px;
  color: var(--ia-muted);
}

.ia-summary-card > span {
  font-size: 22px;
}

.ia-summary-card > strong {
  font-size: 28px;
  color: var(--ia-heading);
}

.ia-summary-card.green {
  background: #e9f8ef;
}

.ia-summary-card.orange {
  background: #fff5e3;
}

.ia-summary-card.blue {
  background: #eaf3ff;
}

:root[data-theme="dark"] .ia-summary-card.green {
  background: #214b39;
}

:root[data-theme="dark"] .ia-summary-card.orange {
  background: #4a3922;
}

:root[data-theme="dark"] .ia-summary-card.blue {
  background: #253f58;
}

.ia-summary-card.progress {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;

  gap: 12px;
  background: #e8f8ef;
}

:root[data-theme="dark"] .ia-summary-card.progress {
  background: #1b4235;
}

.ia-summary-card.progress strong {
  display: block;
  margin: 7px 0;

  font-size: 29px;
  color: var(--ia-green);
}

.ia-summary-card.progress span {
  color: var(--ia-muted);
  font-size: 10px;
}

/* =====================================================
   DONUT
   ===================================================== */

.ia-donut {
  --progress: 0%;

  width: 74px;
  height: 74px;
  padding: 8px;

  border-radius: 50%;
  flex-shrink: 0;

  display: grid;
  place-items: center;

  background: conic-gradient(
    #0aa875 var(--progress),
    var(--ia-progress-track) var(--progress)
  );
}

.ia-donut > div {
  width: 100%;
  height: 100%;

  border-radius: 50%;

  background: var(--ia-surface);

  display: grid;
  place-items: center;

  font-size: 19px;
}

/* =====================================================
   MAIN GRID
   ===================================================== */

.ia-main-grid {
  display: grid;

  grid-template-columns:
    minmax(300px,.8fr)
    minmax(0,1.7fr);

  gap: 15px;
  align-items: start;
}

/* =====================================================
   FORM
   ===================================================== */

.ia-form-icon {
  width: 37px;
  height: 37px;

  display: grid;
  place-items: center;

  background: #e2f5e9;
  border-radius: 9px;

  font-size: 19px;
}

:root[data-theme="dark"] .ia-form-icon {
  background: #2b4b3c;
}

.ia-form {
  display: grid;
  gap: 14px;
}

.ia-form label {
  display: grid;
  gap: 7px;
}

.ia-form label > span {
  font-size: 12px;
  color: var(--ia-heading);
  font-weight: 800;
}

.ia-form select,
.ia-form input,
.ia-form textarea {
  width: 100%;
  min-width: 0;

  background: var(--ia-input);
  color: var(--ia-input-text);

  border: 1px solid var(--ia-border);
  border-radius: 9px;

  padding: 12px;
  font-size: 13px;

  outline: none;
  color-scheme: light;
}

:root[data-theme="dark"] .ia-form select,
:root[data-theme="dark"] .ia-form input,
:root[data-theme="dark"] .ia-form textarea {
  color-scheme: dark;
}

.ia-form select option {
  background: var(--ia-input);
  color: var(--ia-input-text);
}

.ia-form input::placeholder,
.ia-form textarea::placeholder {
  color: var(--ia-muted);
  opacity: 1;
}

.ia-form select:focus,
.ia-form input:focus,
.ia-form textarea:focus,
.ia-filters input:focus,
.ia-filters select:focus {
  border-color: #0c9b6c;
  outline: 2px solid #0c9b6c40;
  outline-offset: 1px;
}

.ia-form textarea {
  resize: vertical;
  min-height: 100px;
  line-height: 1.6;
}

.ia-character {
  text-align: right;
  color: var(--ia-muted);
  font-size: 10px;
}

.ia-file-note {
  color: var(--ia-muted);
  font-size: 10px;
}

.ia-form input[type="file"] {
  cursor: pointer;
}

.ia-form input[type="file"]::file-selector-button {
  border: 1px solid var(--ia-border);
  border-radius: 7px;

  padding: 8px 11px;
  margin-right: 10px;

  background: var(--ia-surface-soft);
  color: var(--ia-text);

  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

/* =====================================================
   INPUT NOTES
   ===================================================== */

.ia-range-note {
  background: var(--ia-surface-muted);
  border-radius: 8px;

  padding: 10px;
  color: var(--ia-muted);

  font-size: 11px;
  line-height: 1.7;
}

.ia-range-note strong {
  display: block;
  color: var(--ia-green);
  margin-top: 4px;
}

.ia-distance-grid {
  display: grid;

  grid-template-columns:
    repeat(2,minmax(0,1fr));

  gap: 10px;
}

.ia-existing-file {
  padding: 11px;

  background: var(--ia-surface-muted);
  border-radius: 9px;

  font-size: 11px;
  overflow-wrap: anywhere;
}

.ia-existing-file span,
.ia-existing-file small {
  display: block;
}

.ia-existing-file small {
  margin-top: 5px;
  color: var(--ia-muted);
}

/* =====================================================
   FORM BUTTONS
   ===================================================== */

.ia-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ia-primary,
.ia-secondary {
  border: 0;
  border-radius: 9px;

  padding: 13px 15px;

  font-size: 12px;
  font-weight: 900;
}

.ia-primary {
  flex: 1;
  background: #07885f;
  color: white;
}

.ia-primary:hover:not(:disabled) {
  background: #09996c;
}

.ia-secondary {
  background: #e8efeb;
  color: #466451;
}

:root[data-theme="dark"] .ia-secondary {
  background: #30484b;
  color: #e8f5ef;
}

/* =====================================================
   HISTORY FILTERS
   ===================================================== */

.ia-count {
  color: var(--ia-green);
  font-size: 12px;
}

.ia-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  margin-bottom: 14px;
}

.ia-filters input,
.ia-filters select {
  min-width: 0;
  padding: 10px;

  border-radius: 8px;

  background: var(--ia-input);
  border: 1px solid var(--ia-border);
  color: var(--ia-input-text);

  font-size: 11px;
  color-scheme: light;
}

:root[data-theme="dark"] .ia-filters input,
:root[data-theme="dark"] .ia-filters select {
  color-scheme: dark;
}

.ia-filters select option {
  color: var(--ia-input-text);
  background: var(--ia-input);
}

.ia-filters input::placeholder {
  color: var(--ia-muted);
  opacity: 1;
}

.ia-filters input {
  flex: 1 1 170px;
}

/* =====================================================
   HISTORY TABLE
   ===================================================== */

.ia-table-scroll {
  overflow-x: auto;
  width: 100%;

  border: 1px solid var(--ia-border);
  border-radius: 10px;
}

.ia-table {
  width: 100%;
  min-width: 880px;

  border-collapse: collapse;
  text-align: left;

  font-size: 11px;
}

.ia-table th {
  padding: 13px 10px;

  color: var(--ia-heading);
  background: var(--ia-table-head);

  white-space: nowrap;
  font-size: 10px;
  font-weight: 900;
}

.ia-table td {
  padding: 12px 10px;

  border-bottom: 1px solid var(--ia-border-soft);

  vertical-align: middle;
  color: var(--ia-text);
}

.ia-table tbody tr:nth-child(even) {
  background: var(--ia-table-even);
}

.ia-table tbody tr:hover {
  background: var(--ia-table-hover);
}

.ia-nowrap {
  white-space: nowrap;
}

.ia-description {
  min-width: 160px;
  max-width: 280px;

  white-space: pre-wrap;
  overflow-wrap: anywhere;

  line-height: 1.55;
}

.ia-category-cell {
  font-weight: 800;
  white-space: nowrap;
}

.ia-muted {
  color: var(--ia-muted);
}

/* =====================================================
   STATUS BADGES
   ===================================================== */

.ia-status {
  display: inline-block;

  padding: 7px 9px;
  border-radius: 20px;

  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.ia-status.verified {
  color: #087b53;
  background: #e0f7e9;
}

.ia-status.pending {
  color: #a67113;
  background: #fff2d9;
}

:root[data-theme="dark"] .ia-status.verified {
  background: #214b39;
  color: #a5f0c6;
}

:root[data-theme="dark"] .ia-status.pending {
  background: #4b391d;
  color: #ffd393;
}

/* =====================================================
   DOCUMENT BUTTONS
   ===================================================== */

.ia-document-button {
  background: #e8f3ff;
  color: #236eb2;

  border: 1px solid #cddff4;
  border-radius: 7px;

  padding: 8px;

  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

:root[data-theme="dark"] .ia-document-button {
  background: #223f58;
  border-color: #345f82;
  color: #b0d9ff;
}

/* =====================================================
   EDIT / DELETE
   ===================================================== */

.ia-table-actions {
  display: flex;
  gap: 5px;
}

.ia-table-actions button {
  border: 0;
  border-radius: 6px;

  font-size: 10px;
  font-weight: 900;

  padding: 8px 10px;
}

.ia-edit {
  background: #e5f0ff;
  color: #246fc2;
}

.ia-delete {
  background: #ffe8e8;
  color: #b92f3b;
}

:root[data-theme="dark"] .ia-edit {
  background: #263f60;
  color: #acd2ff;
}

:root[data-theme="dark"] .ia-delete {
  background: #4d2930;
  color: #ffb8c1;
}

/* =====================================================
   EMPTY / FOOTER TABLE
   ===================================================== */

.ia-empty {
  text-align: center;
  padding: 35px !important;
  color: var(--ia-muted) !important;
}

.ia-table-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;

  gap: 10px;
  margin-top: 12px;

  font-size: 10px;
  color: var(--ia-muted);
}

/* =====================================================
   CATEGORY PROGRESS
   ===================================================== */

.ia-overall {
  font-size: 23px;
  color: var(--ia-green);
}

.ia-category-grid {
  display: grid;

  grid-template-columns:
    repeat(6,minmax(0,1fr));

  gap: 10px;
}

.ia-category-card {
  min-width: 0;

  background: var(--ia-surface-soft);
  border: 1px solid var(--ia-border);

  padding: 13px;
  border-radius: 11px;
}

.ia-category-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;

  gap: 5px;
  font-size: 11px;
}

.ia-category-top strong {
  color: var(--ia-heading);
}

.ia-category-top b {
  color: var(--ia-green);
}

.ia-category-amount {
  font-size: 16px;
  font-weight: 900;

  margin: 14px 0 10px;
  color: var(--ia-heading);
}

/* =====================================================
   PROGRESS BARS
   ===================================================== */

.ia-progress {
  background: var(--ia-progress-track);

  height: 9px;
  border-radius: 20px;

  overflow: hidden;
}

.ia-progress span {
  display: block;
  height: 100%;

  background: linear-gradient(
    90deg,
    #2fc38c,
    #078b61
  );

  border-radius: inherit;
}

.ia-category-card small {
  display: block;
  margin-top: 10px;

  font-size: 10px;
  color: var(--ia-muted);
}

.ia-note {
  font-size: 11px;
  color: var(--ia-muted);

  line-height: 1.7;
  margin: 15px 0 0;
}

/* =====================================================
   BOTTOM NAVIGATION
   ===================================================== */

.ia-bottom {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;

  gap: 10px;
  margin-bottom: 15px;
}

.ia-bottom button {
  font-size: 12px;
}

.ia-footer {
  padding: 20px 0;

  text-align: center;
  font-size: 11px;
  color: var(--ia-muted);
}

/* =====================================================
   RESPONSIVE — DESKTOP / TABLET
   ===================================================== */

@media(max-width:1250px) {
  .ia-summary-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .ia-summary-card.progress {
    grid-column: span 2;
  }

  .ia-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .ia-main-grid {
    grid-template-columns:
      minmax(280px,.8fr)
      minmax(0,1.2fr);
  }
}

@media(max-width:900px) {
  .ia-main-grid {
    grid-template-columns: 1fr;
  }

  .ia-summary-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .ia-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }
}

/* =====================================================
   RESPONSIVE — MOBILE
   ===================================================== */

@media(max-width:650px) {
  .ia-header {
    padding: 13px;
  }

  .ia-brand {
    font-size: 18px;
  }

  .ia-account {
    gap: 8px;
  }

  .ia-account > div {
    display: none;
  }

  .ia-account button {
    padding: 9px;
    font-size: 11px;
  }

  .ia-container {
    padding: 12px;
  }

  .ia-hero {
    padding: 20px;
  }

  .ia-hero h1 {
    font-size: 25px;
  }

  .ia-tabs button,
  .ia-tabs span {
    flex: 1;
    text-align: center;

    font-size: 11px;
    padding: 11px 8px;
  }

  .ia-card {
    padding: 14px;
  }

  .ia-section-head h2 {
    font-size: 16px;
  }

  .ia-summary-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .ia-summary-card.progress {
    grid-column: 1 / -1;
  }

  .ia-summary-card strong {
    font-size: 23px;
  }

  .ia-category-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .ia-filters input {
    flex-basis: 100%;
  }

  .ia-toolbar-actions {
    width: 100%;
  }

  .ia-toolbar-actions button {
    flex: 1;
  }

  .ia-bottom button {
    flex: 1;
  }
}

@media(max-width:390px) {
  .ia-category-grid {
    grid-template-columns: 1fr;
  }

  .ia-distance-grid {
    grid-template-columns: 1fr;
  }
}

/* =====================================================
   PRINT — FORCE LIGHT MODE
   ===================================================== */

@media print {
  @page {
    size: A4 landscape;
    margin: 10mm;
  }

  .ia-root,
  :root[data-theme="dark"] .ia-root {
    --ia-bg: #ffffff;
    --ia-surface: #ffffff;
    --ia-surface-soft: #f7faf8;
    --ia-surface-muted: #edf8f1;

    --ia-text: #17352d;
    --ia-heading: #18372e;
    --ia-muted: #82948a;
    --ia-border: #e1ebe6;
    --ia-border-soft: #ecf1ed;

    --ia-input: #ffffff;
    --ia-input-text: #18392e;
    --ia-table-head: #eaf5ee;
    --ia-table-even: #fbfdfb;
    --ia-table-hover: #f0f9f4;

    --ia-green: #07885f;
    --ia-progress-track: #e2ece5;

    background: white !important;
    color: #17352d !important;
  }

  .ia-header,
  .ia-tabs,
  .ia-toolbar-actions,
  .ia-form,
  .ia-filters,
  .ia-table-actions,
  .ia-bottom {
    display: none !important;
  }

  .ia-container {
    padding: 0;
    max-width: none;
  }

  .ia-card,
  .ia-category-card,
  .ia-summary-card {
    box-shadow: none !important;
    break-inside: avoid;
  }

  .ia-main-grid {
    grid-template-columns: 1fr;
  }

  .ia-table-wrap,
  .ia-table-scroll {
    overflow: visible;
  }

  .ia-hero,
  .ia-progress,
  .ia-progress span,
  .ia-donut,
  .ia-summary-card {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}

`;
