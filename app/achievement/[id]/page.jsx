
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
// OJT MINETRACK v2.0
// INPUT ACHIEVEMENT - KALENDER GLOBAL
// =====================================================

const TOTAL_WEEKS = 25;

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    label: "Detail Latihan Fisik",
    hint: "Tuliskan jenis latihan, rute/lokasi, dan hasil kegiatan.",
    placeholder:
      "Jenis latihan: Lari pagi\nLokasi: Area ERG\nHasil: Latihan ketahanan fisik.",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
    label: "Detail Kegiatan Training",
    hint: "Tuliskan judul pelatihan, materi, instruktur, dan hasil belajar.",
    placeholder:
      "Judul: Basic Fire Fighting\nMateri: Penggunaan APAR\nInstruktur: Tim ERG\nHasil: Memahami penggunaan APAR.",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "📣",
    label: "Detail Kegiatan Sosialisasi",
    hint: "Tuliskan topik, sasaran, lokasi, dan hasil sosialisasi.",
    placeholder:
      "Topik: Keselamatan kerja\nSasaran: Tim operasional\nLokasi: Area kerja\nHasil: Penyampaian prosedur.",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🗺️",
    label: "Detail Orientasi Area",
    hint: "Tuliskan area, tujuan kunjungan, dan hasil orientasi.",
    placeholder:
      "Area: Workshop\nTujuan: Mengenal area kerja\nKegiatan: Pengenalan fasilitas\nHasil: Memahami jalur evakuasi.",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "👥",
    label: "Detail Kegiatan Coaching",
    hint: "Tuliskan materi, Mentor, pembahasan, dan tindak lanjut.",
    placeholder:
      "Materi: Prosedur tanggap darurat\nMentor: Mentor OJT\nHasil: Evaluasi pemahaman\nTindak lanjut: Praktik lanjutan.",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    label: "Detail Identifikasi Hazard",
    hint: "Tuliskan lokasi, potensi bahaya, risiko, dan pengendalian.",
    placeholder:
      "Lokasi: Workshop\nBahaya: Material menghalangi akses\nRisiko: Tersandung\nPengendalian: Housekeeping.",
  },
];

function pad(number) {
  return String(number).padStart(2, "0");
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
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

function addDays(value, count) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(
    date.getUTCDate() + count
  );

  return date.toISOString().slice(0, 10);
}

function todayLocal() {
  const date = new Date();

  return new Date(
    date.getTime() -
    date.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
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

function kmText(value) {
  return Number(value || 0).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    }
  );
}

function weekLabel(value) {
  return `Week ${pad(value)}`;
}

// =====================================================
// KALENDER GLOBAL OJT - 25 MINGGU
//
// Week 01 khusus: 12 - 18 Sep 2026
// Week 02: 20 - 26 Sep 2026
// Week 07: 25 - 31 Okt 2026
// Week 25: 28 Feb - 06 Mar 2027
//
// 19 Sep 2026 tidak termasuk minggu global.
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

function globalWeekOf(dateValue) {
  const date = String(dateValue ?? "")
    .slice(0, 10);

  if (!parseDate(date)) return null;

  const match = GLOBAL_WEEKS.find(
    (item) =>
      date >= item.start &&
      date <= item.end
  );

  return match?.week ?? null;
}

function getWeekRange(week, program) {
  const selected = GLOBAL_WEEKS.find(
    (item) =>
      item.week === Number(week)
  );

  if (!selected || !program?.start_date) {
    return null;
  }

  const programStart =
    String(program.start_date).slice(0, 10);

  const programEnd =
    program.end_date
      ? String(program.end_date).slice(0, 10)
      : null;

  const start =
    selected.start > programStart
      ? selected.start
      : programStart;

  const end =
    programEnd && programEnd < selected.end
      ? programEnd
      : selected.end;

  if (start > end) return null;

  return {
    start,
    end,
    globalStart: selected.start,
    globalEnd: selected.end,
  };
}

function isDateInWeek(date, week, program) {
  const range = getWeekRange(week, program);

  return !!(
    range &&
    date >= range.start &&
    date <= range.end &&
    globalWeekOf(date) === Number(week)
  );
}

function getDefaultWeek(program) {
  const now = todayLocal();

  const available = GLOBAL_WEEKS.filter(
    (item) =>
      getWeekRange(item.week, program)
  );

  if (!available.length) return null;

  const current = available.find(
    (item) =>
      isDateInWeek(
        now,
        item.week,
        program
      )
  );

  if (current) return current.week;

  const firstFuture = available.find(
    (item) => {
      const range =
        getWeekRange(item.week, program);

      return range && range.start > now;
    }
  );

  return firstFuture
    ? firstFuture.week
    : available[available.length - 1].week;
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

function formatPercent(value) {
  return Number(value || 0).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  );
}

function errorText(error, fallback) {
  return error?.message ||
    error?.details ||
    fallback;
}

function targetForType(type) {
  return TARGETS.find(
    (target) =>
      normalize(target.name) ===
      normalize(type?.name)
  );
}

// =====================================================
// HALAMAN INPUT ACHIEVEMENT
// =====================================================

export default function AchievementPage() {
  const params = useParams();
  const router = useRouter();
  const formRef = useRef(null);

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [manager, setManager] =
    useState(null);

  const [program, setProgram] =
    useState(null);

  const [types, setTypes] =
    useState([]);

  const [records, setRecords] =
    useState([]);

  const [selectedWeek, setSelectedWeek] =
    useState(null);

  const [activityDate, setActivityDate] =
    useState("");

  const [typeCode, setTypeCode] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [kilometer, setKilometer] =
    useState("0");

  const [meter, setMeter] =
    useState("0");

  const [editId, setEditId] =
    useState(null);

  const [filterWeek, setFilterWeek] =
    useState("all");

  const [filterCategory, setFilterCategory] =
    useState("all");

  const [filterStatus, setFilterStatus] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [actionId, setActionId] =
    useState(null);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const role =
    normalizeRole(manager?.role);

  const canManage =
    role === "admin" ||
    role === "mentor";

  const programActive =
    normalizeRole(program?.status) ===
    "active";

  const peserta =
    Array.isArray(program?.peserta)
      ? program.peserta[0]
      : program?.peserta;

  const selectedType = types.find(
    (item) =>
      item.code === typeCode
  );

  const category =
    targetForType(selectedType);

  const isFisik =
    normalize(selectedType?.name) ===
    "fisik";

  const km = Number(kilometer);
  const m = Number(meter);

  const validDistance =
    kilometer !== "" &&
    meter !== "" &&
    Number.isInteger(km) &&
    Number.isInteger(m) &&
    km >= 0 &&
    km <= 100 &&
    m >= 0 &&
    m <= 999 &&
    km * 1000 + m > 0;

  const distanceKm =
    validDistance
      ? (km * 1000 + m) / 1000
      : null;

  const allowedRange =
    getWeekRange(
      selectedWeek,
      program
    );

  const actualGlobalWeek =
    globalWeekOf(activityDate);

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(
        (item) =>
          !!getWeekRange(
            item.week,
            program
          )
      ),
    [program]
  );

  const currentRecords = useMemo(
    () =>
      records.filter(
        (item) =>
          item.status === "verified"
      ),
    [records]
  );

  const pendingRecords = useMemo(
    () =>
      records.filter(
        (item) =>
          item.status === "pending"
      ),
    [records]
  );

  // ===================================================
  // VERIFIKASI HAK AKSES SEBELUM PERUBAHAN DATABASE
  // ===================================================

  async function checkManagerAccess() {
    const {
      data: auth,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      throw new Error(
        "Sesi login tidak tersedia. Login kembali."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (
      !profile ||
      !["admin", "mentor"].includes(
        normalizeRole(profile.role)
      )
    ) {
      throw new Error(
        "Hanya Admin dan Mentor yang dapat mengelola Achievement."
      );
    }

    const {
      data: activeProgram,
      error: programError,
    } = await supabase
      .from("ojt_programs")
      .select("id,status")
      .eq("id", programId)
      .maybeSingle();

    if (programError) {
      throw programError;
    }

    if (
      !activeProgram ||
      normalizeRole(
        activeProgram.status
      ) !== "active"
    ) {
      throw new Error(
        "Program OJT tidak aktif atau akses tidak tersedia."
      );
    }

    return profile;
  }

  // ===================================================
  // AMBIL DATA ACHIEVEMENT
  // ===================================================

  async function reloadRecords() {
    const {
      data,
      error: queryError,
    } = await supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
      )
      .eq("program_id", programId)
      .order(
        "activity_date",
        { ascending: false }
      );

    if (queryError) {
      throw queryError;
    }

    setRecords(data || []);

    return data || [];
  }

  useEffect(() => {
    if (!programId) {
      setError(
        "ID program tidak tersedia."
      );
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setMessage("");

      try {
        const {
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id,full_name,role"
          )
          .eq(
            "id",
            auth.user.id
          )
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (
          !profile ||
          !["admin", "mentor"].includes(
            normalizeRole(profile.role)
          )
        ) {
          throw new Error(
            "Akses Input Achievement hanya tersedia untuk Admin dan Mentor."
          );
        }

        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(`
            id,
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
          .eq("id", programId)
          .maybeSingle();

        if (programError) {
          throw programError;
        }

        if (!programData) {
          throw new Error(
            "Program OJT tidak ditemukan."
          );
        }

        const [
          typeResult,
          recordResult,
        ] = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name")
            .order("name"),

          supabase
            .from("achievement_records")
            .select(
              "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
            )
            .eq("program_id", programId)
            .order(
              "activity_date",
              { ascending: false }
            ),
        ]);

        if (typeResult.error) {
          throw typeResult.error;
        }

        if (recordResult.error) {
          throw recordResult.error;
        }

        if (!active) return;

        const loadedTypes =
          typeResult.data || [];

        setManager(profile);
        setProgram(programData);
        setTypes(loadedTypes);
        setRecords(
          recordResult.data || []
        );

        const fisikType =
          loadedTypes.find(
            (item) =>
              normalize(item.name) ===
              "fisik"
          );

        setTypeCode(
          fisikType?.code ||
          loadedTypes[0]?.code ||
          ""
        );

        const defaultWeek =
          getDefaultWeek(programData);

        setSelectedWeek(defaultWeek);

        if (defaultWeek !== null) {
          const range =
            getWeekRange(
              defaultWeek,
              programData
            );

          const today =
            todayLocal();

          const initialDate =
            today >= range.start &&
            today <= range.end
              ? today
              : range.start;

          setActivityDate(initialDate);
        }
      } catch (err) {
        if (!active) return;

        setManager(null);
        setProgram(null);
        setRecords([]);

        setError(
          errorText(
            err,
            "Gagal memuat Achievement."
          )
        );
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
  }, [programId, router]);

  // ===================================================
  // DATA PER MINGGU GLOBAL
  // ===================================================

  const weeklyProgress = useMemo(() => {
    const week =
      Number(selectedWeek);

    if (!week) return [];

    const weekRecords =
      currentRecords.filter(
        (item) =>
          globalWeekOf(
            item.activity_date
          ) === week
      );

    return TARGETS.map((target) => {
      const type = types.find(
        (entry) =>
          normalize(entry.name) ===
          normalize(target.name)
      );

      const items =
        weekRecords.filter(
          (item) =>
            item.type_code ===
            type?.code
        );

      let realized = 0;

      if (target.name === "Fisik") {
        const meters =
          items.reduce(
            (sum, item) =>
              sum +
              Math.round(
                Number(
                  item.distance_km || 0
                ) * 1000
              ),
            0
          );

        realized =
          meters / 1000;
      } else {
        realized =
          items.length;
      }

      return {
        ...target,
        realized,
        percent: percentage(
          realized,
          target.target
        ),
        achieved:
          realized >= target.target,
      };
    });
  }, [
    selectedWeek,
    currentRecords,
    types,
  ]);

  const overallWeek = useMemo(() => {
    if (!weeklyProgress.length) return 0;

    return weeklyProgress.reduce(
      (sum, item) =>
        sum + item.percent,
      0
    ) / weeklyProgress.length;
  }, [weeklyProgress]);

  const filteredRecords = useMemo(() => {
    return records.filter((item) => {
      const itemType = types.find(
        (type) =>
          type.code ===
          item.type_code
      );

      const matchWeek =
        filterWeek === "all" ||
        globalWeekOf(
          item.activity_date
        ) === Number(filterWeek);

      const matchCategory =
        filterCategory === "all" ||
        normalize(
          itemType?.name
        ) ===
        normalize(
          filterCategory
        );

      const matchStatus =
        filterStatus === "all" ||
        item.status ===
        filterStatus;

      return (
        matchWeek &&
        matchCategory &&
        matchStatus
      );
    });
  }, [
    records,
    types,
    filterWeek,
    filterCategory,
    filterStatus,
  ]);

  // ===================================================
  // PILIH WEEK GLOBAL
  // ===================================================

  function changeWeek(weekValue) {
    const week =
      Number(weekValue);

    const range =
      getWeekRange(
        week,
        program
      );

    if (!range) {
      setError(
        "Week ini tidak beririsan dengan periode OJT peserta."
      );
      return;
    }

    setSelectedWeek(week);

    // Jika tanggal lama tidak termasuk minggu pilihan,
    // otomatis dipindahkan ke hari pertama yang sah.
    setActivityDate((old) =>
      old >= range.start &&
      old <= range.end
        ? old
        : range.start
    );

    setError("");
    setMessage("");
  }

  // ===================================================
  // RESET FORM
  // ===================================================

  function resetForm() {
    setEditId(null);
    setDescription("");
    setKilometer("0");
    setMeter("0");

    const defaultWeek =
      getDefaultWeek(program);

    setSelectedWeek(defaultWeek);

    if (defaultWeek !== null) {
      const range =
        getWeekRange(
          defaultWeek,
          program
        );

      const now = todayLocal();

      setActivityDate(
        now >= range.start &&
        now <= range.end
          ? now
          : range.start
      );
    } else {
      setActivityDate("");
    }
  }

  // ===================================================
  // SIMPAN LANGSUNG VERIFIED
  // ===================================================

  async function save(event) {
    event.preventDefault();

    if (
      saving ||
      actionId ||
      !canManage ||
      !programActive
    ) return;

    setError("");
    setMessage("");

    if (
      !typeCode ||
      !types.some(
        (item) =>
          item.code === typeCode
      )
    ) {
      setError(
        "Pilih kategori Achievement."
      );
      return;
    }

    if (
      !selectedWeek ||
      !getWeekRange(
        selectedWeek,
        program
      )
    ) {
      setError(
        "Pilih Week Global yang tersedia."
      );
      return;
    }

    if (
      !isDateInWeek(
        activityDate,
        selectedWeek,
        program
      )
    ) {
      setError(
        "Tanggal kegiatan harus sesuai Week Global yang dipilih dan periode peserta."
      );
      return;
    }

    if (
      isFisik &&
      !validDistance
    ) {
      setError(
        "Jarak Fisik harus valid dan lebih dari 0 km."
      );
      return;
    }

    setSaving(true);

    const wasEditing =
      !!editId;

    try {
      const activeManager =
        await checkManagerAccess();

      // Tetap menggunakan kolom database lama.
      // Tidak perlu menambah kolom week.
      const payload = {
        type_code: typeCode,
        activity_date: activityDate,
        description:
          description.trim(),
        distance_km:
          isFisik
            ? distanceKm
            : null,

        // TIDAK ADA LAGI PENDING UNTUK INPUT BARU.
        status: "verified",

        // Identitas akun yang mencatat kegiatan.
        // Kolom ini sebelumnya dipakai verifikasi.
        verified_by:
          activeManager.id,
      };

      let result;

      if (editId) {
        result =
          await supabase
            .from(
              "achievement_records"
            )
            .update(payload)
            .eq("id", editId)
            .eq(
              "program_id",
              programId
            )
            .select("id,status");
      } else {
        result =
          await supabase
            .from(
              "achievement_records"
            )
            .insert({
              ...payload,
              program_id:
                programId,
            })
            .select("id,status");
      }

      if (result.error) {
        throw result.error;
      }

      if (
        !result.data?.length ||
        result.data[0].status !==
          "verified"
      ) {
        throw new Error(
          "Database belum mengonfirmasi status Verified. Periksa kebijakan Supabase."
        );
      }

      await reloadRecords();
      resetForm();

      setFilterWeek("all");
      setFilterCategory("all");
      setFilterStatus("all");

      setMessage(
        wasEditing
          ? "Perubahan Achievement berhasil disimpan dan langsung tercatat."
          : "Achievement berhasil disimpan dan langsung dihitung."
      );
    } catch (err) {
      setError(
        errorText(
          err,
          "Gagal menyimpan Achievement."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // EDIT KEGIATAN
  // ===================================================

  function edit(item) {
    if (
      !canManage ||
      !programActive ||
      saving ||
      actionId
    ) return;

    const week =
      globalWeekOf(
        item.activity_date
      );

    if (
      week === null ||
      !isDateInWeek(
        item.activity_date,
        week,
        program
      )
    ) {
      setError(
        "Catatan lama berada di luar Kalender Global atau periode peserta. Catatan tersebut tetap tersimpan, tetapi tidak dapat diedit melalui formulir minggu global."
      );

      setMessage("");
      return;
    }

    setEditId(item.id);
    setTypeCode(
      item.type_code
    );
    setSelectedWeek(week);
    setActivityDate(
      item.activity_date
    );
    setDescription(
      item.description || ""
    );

    const meters =
      Math.round(
        Number(
          item.distance_km || 0
        ) * 1000
      );

    setKilometer(
      String(
        Math.floor(
          meters / 1000
        )
      )
    );

    setMeter(
      String(
        meters % 1000
      )
    );

    setError("");
    setMessage("");

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // ===================================================
  // HAPUS KEGIATAN
  // ===================================================

  async function remove(item) {
    if (
      !canManage ||
      !programActive ||
      actionId ||
      saving
    ) return;

    const confirmDelete =
      window.confirm(
        "Hapus kegiatan ini secara permanen?"
      );

    if (!confirmDelete) return;

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      await checkManagerAccess();

      const {
        data,
        error: deleteError,
      } = await supabase
        .from(
          "achievement_records"
        )
        .delete()
        .eq("id", item.id)
        .eq(
          "program_id",
          programId
        )
        .select("id");

      if (deleteError) {
        throw deleteError;
      }

      if (!data?.length) {
        throw new Error(
          "Data tidak terhapus. Periksa izin database."
        );
      }

      if (
        editId === item.id
      ) {
        resetForm();
      }

      await reloadRecords();

      setMessage(
        "Achievement berhasil dihapus."
      );
    } catch (err) {
      setError(
        errorText(
          err,
          "Gagal menghapus Achievement."
        )
      );
    } finally {
      setActionId(null);
    }
  }

  // ===================================================
  // REFRESH
  // ===================================================

  async function refresh() {
    if (
      refreshing ||
      saving ||
      actionId
    ) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await reloadRecords();

      setMessage(
        "Data Achievement berhasil diperbarui."
      );
    } catch (err) {
      setError(
        errorText(
          err,
          "Gagal memperbarui data."
        )
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ===================================================
  // HALAMAN LOADING / ERROR
  // ===================================================

  if (loading) {
    return (
      <main className="ia-loading">
        Memuat Input Achievement OJT...
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="ia-loading">
        <h2>
          Input Achievement tidak dapat dibuka
        </h2>

        <p>
          {error ||
            "Akses tidak tersedia."}
        </p>

        <button
          onClick={() =>
            router.push("/")
          }
        >
          Kembali
        </button>
      </main>
    );
  }

  const categoryHint =
    category || {
      label: "Detail Kegiatan",
      hint: "Tuliskan rincian kegiatan.",
      placeholder:
        "Jelaskan kegiatan yang dilakukan.",
    };

  return (
    <main className="ia-root">
      <style>{css}</style>

      {/* HEADER */}
      <header className="ia-header">
        <div className="ia-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="ia-header-right">
          <div className="ia-account">
            <span>
              {role === "admin"
                ? "Administrator"
                : "Mentor"}
            </span>

            <strong>
              {manager.full_name ||
                "Pengelola OJT"}
            </strong>
          </div>

          <button
            type="button"
            className="ia-btn light"
            onClick={() =>
              router.push(
                `/peserta/${programId}`
              )
            }
          >
            ← Detail Peserta
          </button>
        </div>
      </header>

      <div className="ia-container">
        {/* HERO */}
        <section className="ia-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP ·
              PT BERAU COAL
            </small>

            <h1>
              Input Achievement OJT
            </h1>

            <p>
              Pencatatan pencapaian
              berdasarkan Kalender Global
              OJT Week 01–25.
            </p>

            <div className="ia-hero-meta">
              <span>
                {peserta?.full_name ||
                  "Peserta OJT"}
              </span>

              <span>
                {program.site || "—"}
              </span>

              <span>
                {dateText(
                  program.start_date
                )}
                {" – "}
                {dateText(
                  program.end_date
                )}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="ia-btn hero-btn"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            📊 Monitoring Achievement →
          </button>
        </section>

        <nav className="ia-tabs">
          <div className="ia-tab active">
            ✍️ Input Achievement
          </div>

          <button
            type="button"
            className="ia-tab"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            📊 Monitoring Achievement
          </button>
        </nav>

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

        {!programActive && (
          <div className="ia-alert warning">
            Program tidak aktif.
            Penginputan dinonaktifkan.
          </div>
        )}

        {/* RINGKASAN DATA */}
        <div className="ia-stats">
          <div className="ia-stat">
            <span>
              Total Catatan
            </span>

            <strong>
              {records.length}
            </strong>
          </div>

          <div className="ia-stat green">
            <span>
              Tercatat Langsung
            </span>

            <strong>
              {currentRecords.length}
            </strong>
          </div>

          <div className="ia-stat orange">
            <span>
              Pending Lama
            </span>

            <strong>
              {pendingRecords.length}
            </strong>
          </div>
        </div>

        {pendingRecords.length > 0 && (
          <div className="ia-alert warning">
            Terdapat{" "}
            <strong>
              {pendingRecords.length}
            </strong>{" "}
            catatan Pending dari alur lama.
            Data tetap disimpan dan belum
            dihitung sebagai capaian.
            Catatan lama dapat ditinjau
            melalui Riwayat; penghapusan
            verifikasi tidak mengubah
            statusnya secara otomatis.
          </div>
        )}

        <div className="ia-layout">
          {/* FORMULIR */}
          <section
            ref={formRef}
            className="ia-card"
          >
            <div className="ia-card-head">
              <div>
                <h2>
                  {editId
                    ? "Edit Achievement"
                    : "Formulir Input Achievement"}
                </h2>

                <p>
                  Pilih minggu global,
                  tanggal, dan kategori kegiatan.
                </p>
              </div>

              <span className="ia-pill">
                {editId
                  ? "Mode Edit"
                  : "Input Baru"}
              </span>
            </div>

            <form onSubmit={save}>
              <div className="ia-field">
                <label htmlFor="ia-category">
                  Kategori Pencapaian
                </label>

                <select
                  id="ia-category"
                  className="ia-input"
                  value={typeCode}
                  onChange={(event) => {
                    setTypeCode(
                      event.target.value
                    );

                    if (!editId) {
                      setDescription("");
                    }
                  }}
                  required
                  disabled={
                    saving ||
                    !!actionId ||
                    !programActive
                  }
                >
                  <option value="">
                    Pilih Kategori
                  </option>

                  {TARGETS.map((target) => {
                    const type =
                      types.find(
                        (item) =>
                          normalize(
                            item.name
                          ) ===
                          normalize(
                            target.name
                          )
                      );

                    if (!type) {
                      return null;
                    }

                    return (
                      <option
                        key={type.code}
                        value={type.code}
                      >
                        {target.icon}{" "}
                        {target.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* WEEK GLOBAL */}
              <div className="ia-field">
                <label htmlFor="ia-week">
                  Week Kegiatan
                  (Kalender Global)
                </label>

                <select
                  id="ia-week"
                  className="ia-input"
                  value={
                    selectedWeek ?? ""
                  }
                  onChange={(event) =>
                    changeWeek(
                      event.target.value
                    )
                  }
                  required
                  disabled={
                    saving ||
                    !!actionId ||
                    !programActive
                  }
                >
                  <option value="">
                    Pilih Week
                  </option>

                  {availableWeeks.map(
                    (item) => (
                      <option
                        key={item.week}
                        value={item.week}
                      >
                        {weekLabel(
                          item.week
                        )}
                        {" — "}
                        {dateText(
                          item.start
                        )}
                        {" s.d. "}
                        {dateText(
                          item.end
                        )}
                      </option>
                    )
                  )}
                </select>

                <p className="ia-help">
                  Nomor Week bersifat tetap
                  sesuai Kalender Global.
                  Tidak dihitung ulang dari
                  tanggal mulai peserta.
                </p>
              </div>

              {/* TANGGAL */}
              <div className="ia-field">
                <label htmlFor="ia-date">
                  Tanggal Kegiatan
                </label>

                <input
                  id="ia-date"
                  className="ia-input"
                  type="date"
                  value={activityDate}
                  min={
                    allowedRange?.start
                  }
                  max={
                    allowedRange?.end
                  }
                  onChange={(event) =>
                    setActivityDate(
                      event.target.value
                    )
                  }
                  required
                  disabled={
                    saving ||
                    !!actionId ||
                    !programActive ||
                    !allowedRange
                  }
                />

                {allowedRange && (
                  <div className="ia-range">
                    Rentang tanggal
                    yang diperbolehkan:
                    <strong>
                      {dateText(
                        allowedRange.start
                      )}
                      {" – "}
                      {dateText(
                        allowedRange.end
                      )}
                    </strong>
                  </div>
                )}

                <div className="ia-week-info">
                  <span>
                    Week Dipilih:{" "}
                    <strong>
                      {selectedWeek
                        ? weekLabel(
                            selectedWeek
                          )
                        : "—"}
                    </strong>
                  </span>

                  <span>
                    Week Tanggal:{" "}
                    <strong>
                      {actualGlobalWeek
                        ? weekLabel(
                            actualGlobalWeek
                          )
                        : "—"}
                    </strong>
                  </span>
                </div>

                {selectedWeek &&
                  actualGlobalWeek &&
                  selectedWeek !==
                    actualGlobalWeek && (
                    <p className="ia-help danger">
                      Tanggal belum sesuai
                      dengan Week Global
                      yang dipilih.
                    </p>
                  )}
              </div>

              {/* FISIK */}
              {isFisik && (
                <div className="ia-field">
                  <label>
                    Jarak Tempuh Fisik
                  </label>

                  <div className="ia-two">
                    <div>
                      <label htmlFor="ia-km">
                        Kilometer
                      </label>

                      <select
                        id="ia-km"
                        className="ia-input"
                        value={kilometer}
                        onChange={(event) =>
                          setKilometer(
                            event.target.value
                          )
                        }
                        disabled={
                          saving ||
                          !!actionId ||
                          !programActive
                        }
                      >
                        {Array.from(
                          {
                            length: 101,
                          },
                          (_, index) => (
                            <option
                              key={index}
                              value={index}
                            >
                              {index} km
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="ia-meter">
                        Tambahan Meter
                      </label>

                      <input
                        id="ia-meter"
                        className="ia-input"
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={meter}
                        onChange={(event) =>
                          setMeter(
                            event.target.value
                          )
                        }
                        disabled={
                          saving ||
                          !!actionId ||
                          !programActive
                        }
                      />
                    </div>
                  </div>

                  <div className="ia-distance">
                    <span>
                      Total Jarak Kegiatan
                    </span>

                    <strong>
                      {distanceKm === null
                        ? "—"
                        : kmText(
                            distanceKm
                          )}{" "}
                      km
                    </strong>

                    <small>
                      Target Fisik:
                      25 km / Week Global
                    </small>
                  </div>
                </div>
              )}

              {/* DETAIL KATEGORI */}
              <div className="ia-field">
                <label htmlFor="ia-description">
                  {categoryHint.label}
                  {" (Opsional)"}
                </label>

                <p className="ia-help">
                  {categoryHint.hint}
                </p>

                <textarea
                  id="ia-description"
                  className="ia-input"
                  rows={6}
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder={
                    categoryHint.placeholder
                  }
                  disabled={
                    saving ||
                    !!actionId ||
                    !programActive
                  }
                />
              </div>

              <div className="ia-form-note">
                <strong>
                  Pencatatan Langsung
                </strong>

                <p>
                  Achievement langsung
                  tersimpan sebagai capaian
                  dan dihitung pada
                  monitoring. Tidak
                  memerlukan verifikasi
                  manual tambahan.
                </p>
              </div>

              <div className="ia-form-actions">
                <button
                  type="submit"
                  className="ia-btn primary"
                  disabled={
                    saving ||
                    !!actionId ||
                    !programActive ||
                    !canManage ||
                    !typeCode ||
                    !allowedRange
                  }
                >
                  {saving
                    ? "Menyimpan..."
                    : editId
                    ? "Simpan Perubahan"
                    : "✓ Simpan Achievement"}
                </button>

                {editId && (
                  <button
                    type="button"
                    className="ia-btn light"
                    onClick={resetForm}
                    disabled={
                      saving ||
                      !!actionId
                    }
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* RIWAYAT */}
          <section className="ia-card">
            <div className="ia-card-head">
              <div>
                <h2>
                  Riwayat Achievement
                </h2>

                <p>
                  Kegiatan dikelompokkan
                  berdasarkan Kalender Global.
                </p>
              </div>

              <button
                type="button"
                className="ia-btn light"
                onClick={refresh}
                disabled={
                  refreshing ||
                  saving ||
                  !!actionId
                }
              >
                {refreshing
                  ? "Memuat..."
                  : "↻ Refresh"}
              </button>
            </div>

            <div className="ia-filters">
              <div>
                <label htmlFor="ia-filter-week">
                  Kalender Global
                </label>

                <select
                  id="ia-filter-week"
                  className="ia-input"
                  value={filterWeek}
                  onChange={(event) =>
                    setFilterWeek(
                      event.target.value
                    )
                  }
                >
                  <option value="all">
                    Semua Minggu
                  </option>

                  {GLOBAL_WEEKS.map(
                    (week) => (
                      <option
                        key={week.week}
                        value={week.week}
                      >
                        {weekLabel(
                          week.week
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="ia-filter-category">
                  Kategori
                </label>

                <select
                  id="ia-filter-category"
                  className="ia-input"
                  value={filterCategory}
                  onChange={(event) =>
                    setFilterCategory(
                      event.target.value
                    )
                  }
                >
                  <option value="all">
                    Semua Kategori
                  </option>

                  {TARGETS.map(
                    (target) => (
                      <option
                        key={target.name}
                        value={target.name}
                      >
                        {target.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="ia-filter-status">
                  Status Data
                </label>

                <select
                  id="ia-filter-status"
                  className="ia-input"
                  value={filterStatus}
                  onChange={(event) =>
                    setFilterStatus(
                      event.target.value
                    )
                  }
                >
                  <option value="all">
                    Semua Status
                  </option>

                  <option value="verified">
                    Tercatat
                  </option>

                  <option value="pending">
                    Pending Lama
                  </option>
                </select>
              </div>
            </div>

            <div className="ia-list-summary">
              <strong>
                {filteredRecords.length}
                {" "}Kegiatan
              </strong>

              <span>
                Berdasarkan filter
                yang dipilih
              </span>
            </div>

            {filteredRecords.length === 0 ? (
              <div className="ia-empty">
                Belum ada kegiatan
                sesuai filter.
              </div>
            ) : (
              <div className="ia-record-list">
                {filteredRecords.map(
                  (item) => {
                    const type =
                      types.find(
                        (entry) =>
                          entry.code ===
                          item.type_code
                      );

                    const target =
                      targetForType(type);

                    const week =
                      globalWeekOf(
                        item.activity_date
                      );

                    const isPending =
                      item.status ===
                      "pending";

                    return (
                      <article
                        key={item.id}
                        className="ia-record"
                      >
                        <div className="ia-record-top">
                          <div>
                            <div className="ia-record-title">
                              <span>
                                {target?.icon ||
                                  "📋"}
                              </span>

                              <strong>
                                {type?.name ||
                                  item.type_code}
                              </strong>
                            </div>

                            <p className="ia-record-date">
                              {dateText(
                                item.activity_date
                              )}

                              {" · "}

                              {week
                                ? weekLabel(
                                    week
                                  )
                                : "Di luar kalender global"}
                            </p>
                          </div>

                          <span
                            className={
                              `ia-status ${
                                isPending
                                  ? "pending"
                                  : "verified"
                              }`
                            }
                          >
                            {isPending
                              ? "Pending Lama"
                              : item.status ===
                                  "verified"
                              ? "Tercatat"
                              : item.status ||
                                "—"}
                          </span>
                        </div>

                        {item.distance_km != null && (
                          <p className="ia-record-distance">
                            Jarak:{" "}
                            <strong>
                              {kmText(
                                item.distance_km
                              )}{" "}
                              km
                            </strong>
                          </p>
                        )}

                        {item.description && (
                          <p className="ia-record-description">
                            {item.description}
                          </p>
                        )}

                        {isPending && (
                          <p className="ia-pending-note">
                            Data lama belum
                            dihitung karena
                            masih berstatus
                            Pending.
                          </p>
                        )}

                        <div className="ia-record-actions">
                          <button
                            type="button"
                            className="ia-btn blue small"
                            onClick={() =>
                              edit(item)
                            }
                            disabled={
                              !!actionId ||
                              saving ||
                              !canManage ||
                              !programActive
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className="ia-btn red small"
                            onClick={() =>
                              remove(item)
                            }
                            disabled={
                              !!actionId ||
                              saving ||
                              !canManage ||
                              !programActive
                            }
                          >
                            {actionId ===
                            item.id
                              ? "Memproses..."
                              : "Hapus"}
                          </button>
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </div>

        {/* PROGRES WEEK GLOBAL */}
        {selectedWeek && (
          <section className="ia-card ia-progress">
            <div className="ia-card-head">
              <div>
                <h2>
                  Pencapaian{" "}
                  {weekLabel(
                    selectedWeek
                  )}
                </h2>

                <p>
                  Target mingguan global.
                  Persentase maksimal 100%.
                </p>
              </div>

              <div className="ia-overall">
                {formatPercent(
                  overallWeek
                )}%
              </div>
            </div>

            <div className="ia-progress-grid">
              {weeklyProgress.map(
                (item) => (
                  <div
                    className="ia-progress-item"
                    key={item.name}
                  >
                    <div className="ia-progress-head">
                      <strong>
                        {item.icon}{" "}
                        {item.name}
                      </strong>

                      <span>
                        {formatPercent(
                          item.percent
                        )}%
                      </span>
                    </div>

                    <div className="ia-progress-bar">
                      <div
                        style={{
                          width:
                            `${item.percent}%`,
                        }}
                      />
                    </div>

                    <small>
                      {item.name === "Fisik"
                        ? kmText(
                            item.realized
                          )
                        : item.realized}

                      {" / "}

                      {item.target}
                      {" "}
                      {item.unit}

                      {item.achieved
                        ? " · Tercapai"
                        : ""}
                    </small>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* NAVIGASI */}
        <div className="ia-bottom-nav">
          <button
            type="button"
            className="ia-btn light"
            onClick={() =>
              router.push(
                `/peserta/${programId}`
              )
            }
          >
            ← Detail Peserta
          </button>

          <button
            type="button"
            className="ia-btn primary"
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
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =====================================================
// CSS
// =====================================================

const css = `
.ia-root,
.ia-root * {
  box-sizing: border-box;
}

.ia-root {
  min-height: 100vh;
  color: #18372e;
  background: #f2f6f5;
  font-family: Arial, Helvetica, sans-serif;
}

.ia-loading {
  min-height: 100vh;
  padding: 30px;
  background: #f2f6f5;
  font-family: Arial, sans-serif;
}

.ia-header {
  background: #071f25;
  color: white;
  padding: 15px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ia-brand {
  font-size: 22px;
  font-weight: 900;
  white-space: nowrap;
}

.ia-brand span {
  color: #29c990;
}

.ia-header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.ia-account {
  max-width: 210px;
  text-align: right;
}

.ia-account span {
  display: block;
  color: #a9cfc0;
  font-size: 10px;
}

.ia-account strong {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.ia-container {
  max-width: 1450px;
  margin: 0 auto;
  padding: 22px;
}

.ia-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 22px;
  padding: 29px;
  border-radius: 16px;
  margin-bottom: 16px;
  color: white;
  background: linear-gradient(
    100deg,
    #061d23,
    #07513f
  );
}

.ia-hero small {
  color: #e8be6d;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}

.ia-hero h1 {
  margin: 12px 0 8px;
  font-size: clamp(25px, 3vw, 34px);
}

.ia-hero p {
  color: #d7e8e0;
  line-height: 1.6;
  font-size: 13px;
}

.ia-hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 16px;
}

.ia-hero-meta span {
  padding: 8px 12px;
  border: 1px solid #ffffff30;
  border-radius: 30px;
  background: #ffffff12;
  font-size: 11px;
}

.ia-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.ia-tab {
  padding: 13px 18px;
  border: 1px solid #dce9e2;
  border-radius: 10px;
  background: white;
  color: #32624e;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.ia-tab.active {
  background: #07855d;
  color: white;
}

.ia-btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 12px 15px;
  border: none;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.ia-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.ia-btn.primary {
  background: #07875d;
  color: white;
}

.ia-btn.light {
  background: #e3f3e9;
  color: #176347;
}

.ia-btn.blue {
  background: #2b78be;
  color: white;
}

.ia-btn.red {
  background: #ce4646;
  color: white;
}

.ia-btn.small {
  padding: 9px 12px;
  font-size: 11px;
}

.ia-btn.hero-btn {
  background: white;
  color: #0c4c37;
  white-space: nowrap;
}

.ia-alert {
  margin-bottom: 16px;
  padding: 13px 16px;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.6;
}

.ia-alert.error {
  background: #fff0f0;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.ia-alert.success {
  background: #e0f6e9;
  border: 1px solid #b9e8ce;
  color: #08734c;
}

.ia-alert.warning {
  background: #fff8e5;
  border: 1px solid #f1d992;
  color: #91610d;
}

.ia-stats {
  display: grid;
  grid-template-columns: repeat(
    3,
    minmax(0, 1fr)
  );
  gap: 12px;
  margin-bottom: 16px;
}

.ia-stat {
  padding: 19px;
  background: white;
  border: 1px solid #e0eae6;
  border-radius: 13px;
}

.ia-stat span {
  display: block;
  color: #758a7e;
  font-size: 12px;
}

.ia-stat strong {
  display: block;
  margin-top: 9px;
  font-size: 29px;
  color: #17372e;
}

.ia-stat.green strong {
  color: #07885b;
}

.ia-stat.orange strong {
  color: #cc8916;
}

.ia-layout {
  display: grid;
  grid-template-columns:
    minmax(0, .9fr)
    minmax(0, 1.25fr);
  gap: 16px;
  align-items: start;
}

.ia-card {
  min-width: 0;
  padding: 22px;
  border: 1px solid #e0eae6;
  border-radius: 16px;
  background: white;
  box-shadow: 0 4px 15px #123c3010;
  scroll-margin-top: 20px;
}

.ia-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 23px;
}

.ia-card-head h2 {
  margin: 0;
  font-size: 18px;
}

.ia-card-head p {
  margin: 8px 0 0;
  color: #85958c;
  font-size: 12px;
  line-height: 1.6;
}

.ia-pill {
  background: #e2f5e9;
  color: #087a57;
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 800;
}

.ia-field {
  margin-bottom: 20px;
}

.ia-field > label,
.ia-two label,
.ia-filters label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 800;
}

.ia-input {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 12px;
  color: #203b30;
  background: white;
  border: 1px solid #d4e2d9;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
}

.ia-input:focus {
  outline: 2px solid #a5dcc1;
  outline-offset: 1px;
}

.ia-help {
  margin: 8px 0 0;
  color: #779084;
  font-size: 11px;
  line-height: 1.6;
}

.ia-help.danger {
  color: #b91c1c;
}

.ia-range {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  color: #6a8777;
  font-size: 11px;
}

.ia-range strong {
  color: #0b7754;
}

.ia-week-info {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 11px;
}

.ia-week-info span {
  background: #f2f6f4;
  border-radius: 7px;
  padding: 7px 9px;
  color: #73867b;
  font-size: 10px;
}

.ia-week-info strong {
  color: #12764f;
}

.ia-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.ia-distance {
  background: #e6f6ed;
  padding: 15px;
  border-radius: 11px;
  margin-top: 13px;
}

.ia-distance span,
.ia-distance small {
  display: block;
  color: #738b7d;
  font-size: 11px;
}

.ia-distance strong {
  display: block;
  color: #087a53;
  font-size: 23px;
  margin: 9px 0;
}

.ia-form-note {
  padding: 14px;
  margin-bottom: 18px;
  border-radius: 10px;
  background: #eef8f1;
  color: #246b4a;
  font-size: 12px;
}

.ia-form-note p {
  margin: 7px 0 0;
  line-height: 1.7;
}

.ia-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.ia-filters {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 9px;
}

.ia-list-summary {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 13px;
  padding: 17px 0;
  border-bottom: 1px solid #edf1ee;
}

.ia-list-summary strong {
  font-size: 13px;
}

.ia-list-summary span {
  color: #86978c;
  font-size: 11px;
}

.ia-record-list {
  max-height: 1000px;
  overflow-y: auto;
}

.ia-record {
  padding: 17px 0;
  border-bottom: 1px solid #edf1ee;
}

.ia-record-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.ia-record-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.ia-record-title span {
  font-size: 20px;
}

.ia-record-date {
  margin: 8px 0 0;
  color: #86958d;
  font-size: 11px;
}

.ia-status {
  display: inline-block;
  padding: 7px 10px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
}

.ia-status.verified {
  background: #def5e8;
  color: #087c55;
}

.ia-status.pending {
  background: #fff1d2;
  color: #a7771c;
}

.ia-record-distance {
  font-size: 12px;
  margin: 12px 0 0;
}

.ia-record-description {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
  color: #667b6e;
  line-height: 1.7;
}

.ia-record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 13px;
}

.ia-pending-note {
  background: #fff7e7;
  color: #946d24;
  padding: 9px;
  border-radius: 8px;
  font-size: 11px;
}

.ia-empty {
  padding: 35px 10px;
  text-align: center;
  color: #899c8f;
  font-size: 12px;
}

.ia-progress {
  margin-top: 16px;
}

.ia-overall {
  background: #def6e9;
  color: #087a53;
  font-size: 23px;
  font-weight: 900;
  border-radius: 12px;
  padding: 10px 16px;
}

.ia-progress-grid {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.ia-progress-item {
  border: 1px solid #e1eae5;
  border-radius: 11px;
  padding: 14px;
}

.ia-progress-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.ia-progress-head span {
  color: #0b865b;
  font-weight: 800;
}

.ia-progress-bar {
  height: 9px;
  border-radius: 20px;
  background: #e7eee9;
  overflow: hidden;
  margin: 12px 0 9px;
}

.ia-progress-bar div {
  background: #159667;
  height: 100%;
  border-radius: inherit;
}

.ia-progress-item small {
  font-size: 11px;
  color: #768a7e;
}

.ia-bottom-nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.ia-footer {
  text-align: center;
  font-size: 11px;
  color: #849b8e;
  padding: 28px 5px;
}

@media(max-width:1000px) {
  .ia-layout {
    grid-template-columns: 1fr;
  }

  .ia-progress-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .ia-record-list {
    max-height: none;
  }
}

@media(max-width:650px) {
  .ia-header {
    padding: 12px;
  }

  .ia-brand {
    font-size: 17px;
  }

  .ia-header-right {
    gap: 8px;
  }

  .ia-account {
    max-width: 115px;
  }

  .ia-account strong {
    font-size: 10px;
  }

  .ia-container {
    padding: 12px;
  }

  .ia-hero {
    flex-direction: column;
    align-items: stretch;
    padding: 21px;
  }

  .ia-hero h1 {
    font-size: 23px;
  }

  .ia-tabs {
    gap: 6px;
  }

  .ia-tab {
    flex: 1;
    padding: 11px 7px;
    font-size: 11px;
    text-align: center;
  }

  .ia-card {
    padding: 15px;
  }

  .ia-stats {
    gap: 7px;
  }

  .ia-stat {
    padding: 12px 9px;
  }

  .ia-stat span {
    font-size: 10px;
  }

  .ia-stat strong {
    font-size: 23px;
  }

  .ia-filters {
    grid-template-columns: 1fr;
  }

  .ia-progress-grid {
    grid-template-columns: 1fr;
  }

  .ia-bottom-nav .ia-btn {
    font-size: 10px;
    padding: 11px 9px;
  }
}

@media(max-width:350px) {
  .ia-two {
    grid-template-columns: 1fr;
  }
}
`;
