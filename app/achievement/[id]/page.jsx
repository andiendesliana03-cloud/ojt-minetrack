
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const WEEKS = 25;

const TARGETS = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    label: "Detail Latihan Fisik",
    placeholder:
      "Contoh:\nJenis latihan: Lari pagi\nLokasi/rute: Area ERG\nKeterangan: Latihan ketahanan fisik bersama tim.",
    hint: "Jelaskan jenis latihan, lokasi/rute, dan hasil kegiatan.",
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
    label: "Detail Kegiatan Training",
    placeholder:
      "Contoh:\nJudul training: Basic Fire Fighting\nMateri: Penggunaan APAR dan pemadaman awal\nInstruktur: Tim ERG\nHasil: Memahami prosedur penggunaan APAR.",
    hint: "Tuliskan judul pelatihan, materi, instruktur, dan hasil belajar.",
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "📣",
    label: "Detail Kegiatan Sosialisasi",
    placeholder:
      "Contoh:\nTopik: Keselamatan kerja\nSasaran: Karyawan operasional\nLokasi: Area kerja\nHasil: Penyampaian informasi mengenai prosedur keselamatan.",
    hint: "Tuliskan topik, sasaran, lokasi, dan hasil sosialisasi.",
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "👥",
    label: "Detail Kegiatan Coaching",
    placeholder:
      "Contoh:\nMateri coaching: Prosedur tanggap darurat\nMentor: Mentor OJT\nPembahasan: Evaluasi pemahaman prosedur\nTindak lanjut: Praktik lanjutan.",
    hint: "Tuliskan materi, mentor, hasil pembinaan, dan tindak lanjut.",
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🗺️",
    label: "Detail Orientasi Area",
    placeholder:
      "Contoh:\nArea: Workshop GMO SOUTH\nTujuan: Mengenali area operasional\nKegiatan: Pengenalan fasilitas dan jalur evakuasi\nHasil: Memahami kondisi area kerja.",
    hint: "Tuliskan area, tujuan kunjungan, kegiatan, dan hasil orientasi.",
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    label: "Detail Identifikasi Hazard",
    placeholder:
      "Contoh:\nLokasi: Workshop\nPotensi bahaya: Material menghalangi akses\nRisiko: Tersandung\nPengendalian: Housekeeping dan pelaporan kepada PIC.",
    hint: "Tuliskan lokasi, potensi bahaya, risiko, dan tindakan pengendalian.",
  },
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function parseDate(value) {
  const match = String(value || "")
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
  ) return null;

  return date;
}

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function today() {
  const date = new Date();

  return new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
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
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

function errorText(error, fallback) {
  if (!error) return fallback;

  const message =
    error.message || error.details || fallback;

  return message + (
    error.code ? ` [${error.code}]` : ""
  );
}

// Rumus asli Minggu Program dipertahankan.
function weekOf(dateValue, startValue) {
  if (!dateValue || !startValue) return null;

  const date = new Date(
    `${String(dateValue).slice(0, 10)}T00:00:00Z`
  );

  const start = new Date(
    `${String(startValue).slice(0, 10)}T00:00:00Z`
  );

  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(start.getTime())
  ) return null;

  const week = Math.floor(
    (date.getTime() - start.getTime()) / 604800000
  ) + 1;

  return week >= 1 && week <= WEEKS
    ? week
    : null;
}

// Kalender global yang sudah disepakati.
const GLOBAL_WEEKS = Array.from(
  { length: WEEKS },
  (_, index) => {
    const start = index === 0
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
  const key = String(value || "").slice(0, 10);

  if (!parseDate(key)) return null;

  const found = GLOBAL_WEEKS.find(
    item =>
      key >= item.start &&
      key <= item.end
  );

  return found?.week ?? null;
}

function getAllowedRange(weekValue, program) {
  if (!program?.start_date) return null;

  const selected = GLOBAL_WEEKS.find(
    item => String(item.week) === String(weekValue)
  );

  const programEndByWeeks =
    addDays(program.start_date, WEEKS * 7 - 1);

  const programEnd = program.end_date
    ? (
        program.end_date < programEndByWeeks
          ? program.end_date
          : programEndByWeeks
      )
    : programEndByWeeks;

  const start = selected
    ? (
        selected.start > program.start_date
          ? selected.start
          : program.start_date
      )
    : program.start_date;

  const end = selected
    ? (
        selected.end < programEnd
          ? selected.end
          : programEnd
      )
    : programEnd;

  if (!start || !end || start > end) return null;

  return { start, end };
}

function firstSuitableDate(program, preferredDate) {
  const range = getAllowedRange("manual", program);
  if (!range) return preferredDate || today();

  const desired = preferredDate || today();

  if (desired < range.start) return range.start;
  if (desired > range.end) return range.end;

  return desired;
}

export default function AchievementPage() {
  const router = useRouter();
  const params = useParams();
  const formRef = useRef(null);

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [typeCode, setTypeCode] = useState("");
  const [activityDate, setActivityDate] = useState(today());

  // Pilihan Week baru.
  const [inputWeek, setInputWeek] = useState("manual");

  const [description, setDescription] = useState("");
  const [kilometer, setKilometer] = useState("0");
  const [meter, setMeter] = useState("0");
  const [editId, setEditId] = useState(null);

  const [filterWeek, setFilterWeek] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);

  const [confirmVerifyItem, setConfirmVerifyItem] =
    useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const role = normalizeRole(manager?.role);
  const canManage = role === "admin" || role === "mentor";
  const programActive = program?.status === "active";

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const selectedType = types.find(
    item => item.code === typeCode
  );

  const selectedTarget = TARGETS.find(
    target =>
      normalize(target.name) ===
      normalize(selectedType?.name)
  );

  const isFisik =
    normalize(selectedType?.name) === "fisik";

  const km = Number(kilometer);
  const m = Number(meter);

  // Validasi jarak asli dipertahankan.
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

  const distance = validDistance
    ? (km * 1000 + m) / 1000
    : null;

  const currentWeek = weekOf(
    activityDate,
    program?.start_date
  );

  const globalWeek = getGlobalWeek(activityDate);

  const allowedDateRange = getAllowedRange(
    inputWeek,
    program
  );

  // Minggu global yang beririsan dengan program.
  const availableWeeks = useMemo(
    () => GLOBAL_WEEKS.filter(
      item => getAllowedRange(item.week, program) !== null
    ),
    [program]
  );

  async function verifyManagerAccess() {
    const {
      data: auth,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
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

    if (profileError) throw profileError;

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

    if (programError) throw programError;

    if (
      !activeProgram ||
      activeProgram.status !== "active"
    ) {
      throw new Error(
        "Program OJT tidak aktif atau akses tidak tersedia."
      );
    }

    return profile;
  }

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
      .order("activity_date", {
        ascending: false,
      });

    if (queryError) throw queryError;

    setRecords(data || []);
    return data || [];
  }

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
          .select("id,full_name,role")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (
          !profile ||
          !["admin", "mentor"].includes(
            normalizeRole(profile.role)
          )
        ) {
          throw new Error(
            "Halaman Input Achievement hanya dapat diakses Admin atau Mentor."
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

        if (programError) throw programError;

        if (!programData) {
          throw new Error(
            "Program OJT tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        const [typeResult, recordResult] =
          await Promise.all([
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
              .order("activity_date", {
                ascending: false,
              }),
          ]);

        if (typeResult.error) throw typeResult.error;
        if (recordResult.error) throw recordResult.error;

        if (!active) return;

        setManager(profile);
        setProgram(programData);
        setTypes(typeResult.data || []);
        setRecords(recordResult.data || []);

        const firstType = TARGETS.map(target =>
          typeResult.data?.find(
            item =>
              normalize(item.name) ===
              normalize(target.name)
          )
        ).find(Boolean);

        setTypeCode(firstType?.code || "");

        const initialDate = firstSuitableDate(
          programData,
          today()
        );

        setActivityDate(initialDate);

        const initialGlobalWeek = getGlobalWeek(initialDate);

        setInputWeek(
          initialGlobalWeek !== null
            ? String(initialGlobalWeek)
            : "manual"
        );
      } catch (err) {
        if (!active) return;

        setManager(null);
        setProgram(null);
        setRecords([]);

        setError(
          errorText(err, "Gagal memuat Achievement.")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  const counts = useMemo(() => ({
    total: records.length,
    verified: records.filter(
      item => item.status === "verified"
    ).length,
    pending: records.filter(
      item => item.status === "pending"
    ).length,
  }), [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      const type = types.find(
        entry => entry.code === item.type_code
      );

      const matchWeek =
        filterWeek === "all" ||
        weekOf(
          item.activity_date,
          program?.start_date
        ) === Number(filterWeek);

      const matchCategory =
        filterCategory === "all" ||
        normalize(type?.name) ===
          normalize(filterCategory);

      const matchStatus =
        filterStatus === "all" ||
        item.status === filterStatus;

      return matchWeek && matchCategory && matchStatus;
    });
  }, [
    records,
    types,
    program?.start_date,
    filterWeek,
    filterCategory,
    filterStatus,
  ]);

  function changeInputWeek(value) {
    setInputWeek(value);
    setError("");
    setMessage("");

    const range = getAllowedRange(value, program);

    if (!range) return;

    // Saat memilih Week, tanggal otomatis menyesuaikan.
    const nextDate =
      activityDate >= range.start &&
      activityDate <= range.end
        ? activityDate
        : range.start;

    setActivityDate(nextDate);
  }

  function resetForm() {
    setEditId(null);
    setDescription("");
    setKilometer("0");
    setMeter("0");

    const defaultDate = firstSuitableDate(
      program,
      today()
    );

    setActivityDate(defaultDate);

    const global = getGlobalWeek(defaultDate);

    setInputWeek(
      global !== null ? String(global) : "manual"
    );
  }

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
      !types.some(item => item.code === typeCode)
    ) {
      setError("Pilih kategori yang tersedia.");
      return;
    }

    // Aturan minggu program lama tetap berlaku.
    if (currentWeek === null) {
      setError(
        "Tanggal harus berada dalam Week 01–25 program peserta."
      );
      return;
    }

    if (
      program.end_date &&
      activityDate > program.end_date
    ) {
      setError(
        "Tanggal kegiatan melewati akhir periode OJT."
      );
      return;
    }

    if (
      !allowedDateRange ||
      activityDate < allowedDateRange.start ||
      activityDate > allowedDateRange.end
    ) {
      setError(
        "Tanggal kegiatan harus berada dalam rentang Week yang dipilih dan periode OJT peserta."
      );
      return;
    }

    if (isFisik && !validDistance) {
      setError("Masukkan jarak Fisik yang valid.");
      return;
    }

    setSaving(true);

    const wasEditing = !!editId;

    try {
      await verifyManagerAccess();

      const payload = {
        type_code: typeCode,
        activity_date: activityDate,
        description: description.trim(),
        distance_km: isFisik ? distance : null,
        status: "pending",
        verified_by: null,
      };

      const result = editId
        ? await supabase
            .from("achievement_records")
            .update(payload)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("achievement_records")
            .insert({
              ...payload,
              program_id: programId,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          "Data tidak tersimpan. Periksa izin database."
        );
      }

      await reloadRecords();
      resetForm();

      setMessage(
        wasEditing
          ? "Perubahan Achievement berhasil disimpan dan menunggu verifikasi ulang."
          : "Achievement tersimpan dan menunggu verifikasi."
      );

      setFilterWeek("all");
      setFilterCategory("all");
      setFilterStatus("all");
    } catch (err) {
      setError(
        errorText(err, "Gagal menyimpan Achievement.")
      );
    } finally {
      setSaving(false);
    }
  }

  function edit(item) {
    if (
      !canManage ||
      !programActive ||
      saving ||
      actionId
    ) return;

    setConfirmVerifyItem(null);

    setEditId(item.id);
    setTypeCode(item.type_code);
    setActivityDate(item.activity_date);
    setDescription(item.description || "");

    const existingWeek = getGlobalWeek(
      item.activity_date
    );

    setInputWeek(
      existingWeek !== null
        ? String(existingWeek)
        : "manual"
    );

    const totalMeters = Math.round(
      Number(item.distance_km || 0) * 1000
    );

    setKilometer(
      String(Math.floor(totalMeters / 1000))
    );

    setMeter(String(totalMeters % 1000));

    setError("");
    setMessage("");

    formRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function requestVerification(item) {
    if (
      !canManage ||
      !programActive ||
      actionId ||
      saving ||
      item.status !== "pending"
    ) return;

    const itemType = types.find(
      type => type.code === item.type_code
    );

    if (
      normalize(itemType?.name) === "fisik" &&
      !(Number(item.distance_km) > 0)
    ) {
      setError(
        "Jarak Fisik harus valid sebelum diverifikasi."
      );
      setMessage("");
      return;
    }

    setError("");
    setMessage("");
    setConfirmVerifyItem(item);
  }

  async function confirmVerification() {
    const item = confirmVerifyItem;

    if (
      !item ||
      !canManage ||
      !programActive ||
      actionId ||
      saving
    ) return;

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      const verifiedManager =
        await verifyManagerAccess();

      const {
        data: currentRecord,
        error: readError,
      } = await supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,status,distance_km"
        )
        .eq("id", item.id)
        .eq("program_id", programId)
        .maybeSingle();

      if (readError) throw readError;

      if (!currentRecord) {
        throw new Error(
          "Kegiatan tidak ditemukan. Muat ulang halaman."
        );
      }

      if (currentRecord.status !== "pending") {
        throw new Error(
          "Status kegiatan sudah berubah. Muat ulang halaman."
        );
      }

      const currentType = types.find(
        type => type.code === currentRecord.type_code
      );

      if (
        normalize(currentType?.name) === "fisik" &&
        !(Number(currentRecord.distance_km) > 0)
      ) {
        throw new Error(
          "Jarak Fisik belum valid untuk diverifikasi."
        );
      }

      const {
        data,
        error: updateError,
      } = await supabase
        .from("achievement_records")
        .update({
          status: "verified",
          verified_by: verifiedManager.id,
        })
        .eq("id", item.id)
        .eq("program_id", programId)
        .eq("status", "pending")
        .select("id,status,verified_by");

      if (updateError) throw updateError;

      if (!data?.length) {
        throw new Error(
          "Verifikasi tidak berhasil. Periksa izin UPDATE Supabase, kebijakan RLS, atau status yang telah berubah."
        );
      }

      if (data[0].status !== "verified") {
        throw new Error(
          "Database belum mengembalikan status verified."
        );
      }

      await reloadRecords();

      setConfirmVerifyItem(null);

      setMessage(
        "Kegiatan berhasil diverifikasi. Data monitoring telah diperbarui."
      );
    } catch (err) {
      setError(
        errorText(
          err,
          "Gagal memverifikasi Achievement."
        )
      );

      setConfirmVerifyItem(null);
    } finally {
      setActionId(null);
    }
  }

  async function remove(item) {
    if (
      !canManage ||
      !programActive ||
      actionId ||
      saving
    ) return;

    if (
      !window.confirm(
        "Hapus kegiatan ini secara permanen?"
      )
    ) return;

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      await verifyManagerAccess();

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
          "Data tidak terhapus. Periksa izin database."
        );
      }

      if (editId === item.id) {
        resetForm();
      }

      await reloadRecords();

      setMessage("Kegiatan berhasil dihapus.");
    } catch (err) {
      setError(
        errorText(err, "Gagal menghapus Achievement.")
      );
    } finally {
      setActionId(null);
    }
  }

  async function refresh() {
    if (refreshing || saving || actionId) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      await reloadRecords();
      setMessage("Data Achievement berhasil diperbarui.");
    } catch (err) {
      setError(
        errorText(err, "Gagal memperbarui data.")
      );
    } finally {
      setRefreshing(false);
    }
  }

  const categoryHints = selectedTarget || {
    name: selectedType?.name || "Kegiatan",
    label: "Keterangan Kegiatan",
    placeholder: "Jelaskan kegiatan yang dilakukan.",
    hint: "Tuliskan uraian kegiatan secara jelas.",
  };

  if (loading) {
    return (
      <main className="in-loading">
        Memuat Input Achievement OJT...
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="in-loading">
        <h2>Input Achievement tidak dapat dibuka</h2>
        <p>{error || "Akses tidak tersedia."}</p>
        <button onClick={() => router.push("/")}>
          Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="in-root">
      <style>{css}</style>

      <header className="in-header">
        <div className="in-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="in-header-actions">
          <div className="in-login">
            <span>
              {role === "admin" ? "Administrator" : "Mentor"}
            </span>
            <strong>
              {manager.full_name || "Pengelola OJT"}
            </strong>
          </div>

          <button
            className="in-button light"
            type="button"
            onClick={() =>
              router.push(`/peserta/${programId}`)
            }
          >
            ← Detail Peserta
          </button>
        </div>
      </header>

      <div className="in-container">
        <section className="in-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>Input Achievement OJT</h1>

            <p>
              Pencatatan kegiatan, pengelolaan data,
              dan verifikasi Achievement.
            </p>

            <div className="in-hero-meta">
              <span>
                {participant?.full_name || "Peserta OJT"}
              </span>
              <span>
                {program.site || "Site belum diisi"}
              </span>
              <span>
                {dateText(program.start_date)}
                {" – "}
                {dateText(program.end_date)}
              </span>
            </div>
          </div>

          <button
            className="in-button hero-button"
            type="button"
            onClick={() =>
              router.push(
                `/achievement/${programId}/monitoring`
              )
            }
          >
            📊 Buka Monitoring Achievement →
          </button>
        </section>

        <nav className="in-tabs">
          <div className="in-tab active">
            ✍️ Input Achievement
          </div>

          <button
            className="in-tab"
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

        {error && (
          <div className="in-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="in-alert success" role="status">
            ✓ {message}
          </div>
        )}

        {!programActive && (
          <div className="in-alert warning">
            Program tidak aktif. Pengubahan Achievement
            tidak tersedia.
          </div>
        )}

        <section className="in-stats">
          <div className="in-stat">
            <span>Total Catatan</span>
            <strong>{counts.total}</strong>
          </div>

          <div className="in-stat green">
            <span>Terverifikasi</span>
            <strong>{counts.verified}</strong>
          </div>

          <div className="in-stat orange">
            <span>Menunggu Verifikasi</span>
            <strong>{counts.pending}</strong>
          </div>
        </section>

        <div className="in-layout">
          <section className="in-card" ref={formRef}>
            <div className="in-card-head">
              <div>
                <h2>
                  {editId
                    ? "Edit Achievement"
                    : "Formulir Input Achievement"}
                </h2>

                <p>
                  Pilih kategori dan minggu,
                  kemudian isi rincian kegiatan.
                </p>
              </div>

              <span className="in-pill">
                {editId ? "Mode Edit" : "Input Baru"}
              </span>
            </div>

            <form onSubmit={save}>
              <div className="in-field">
                <label htmlFor="in-category">
                  Kategori Pencapaian
                </label>

                <select
                  id="in-category"
                  className="in-input"
                  value={typeCode}
                  onChange={event => {
                    setTypeCode(event.target.value);

                    // Tidak mengisi otomatis teks dari kategori
                    // sebelumnya. Tiap kegiatan memiliki
                    // keterangannya sendiri.
                    if (!editId) setDescription("");
                  }}
                  required
                  disabled={
                    saving || !!actionId || !programActive
                  }
                >
                  {!typeCode && (
                    <option value="">Pilih kategori</option>
                  )}

                  {TARGETS.map(target => {
                    const type = types.find(
                      item =>
                        normalize(item.name) ===
                        normalize(target.name)
                    );

                    return type ? (
                      <option
                        key={type.code}
                        value={type.code}
                      >
                        {target.icon} {target.name}
                      </option>
                    ) : null;
                  })}
                </select>
              </div>

              <div className="in-field">
                <label htmlFor="in-week">
                  Week Kegiatan (Kalender Global)
                </label>

                <select
                  id="in-week"
                  className="in-input"
                  value={inputWeek}
                  onChange={event =>
                    changeInputWeek(event.target.value)
                  }
                  disabled={
                    saving || !!actionId || !programActive
                  }
                >
                  <option value="manual">
                    Tanggal Manual / Di Luar Kalender Global
                  </option>

                  {availableWeeks.map(item => (
                    <option
                      key={item.week}
                      value={String(item.week)}
                    >
                      {weekLabel(item.week)}
                      {" — "}
                      {dateText(item.start)}
                      {" s.d. "}
                      {dateText(item.end)}
                    </option>
                  ))}
                </select>

                <p className="in-help">
                  Memilih Week akan menyesuaikan
                  tanggal kegiatan secara otomatis.
                  Minggu yang tidak beririsan dengan
                  periode peserta tidak ditampilkan.
                </p>
              </div>

              <div className="in-field">
                <label htmlFor="in-date">
                  Tanggal Kegiatan
                </label>

                <input
                  id="in-date"
                  className="in-input"
                  type="date"
                  value={activityDate}
                  min={allowedDateRange?.start}
                  max={allowedDateRange?.end}
                  onChange={event =>
                    setActivityDate(event.target.value)
                  }
                  required
                  disabled={
                    saving || !!actionId || !programActive
                  }
                />

                {allowedDateRange && (
                  <div className="in-range-box">
                    Rentang yang diperbolehkan:
                    <strong>
                      {dateText(allowedDateRange.start)}
                      {" – "}
                      {dateText(allowedDateRange.end)}
                    </strong>
                  </div>
                )}

                <div className="in-date-info">
                  <span>
                    Minggu Program Peserta:{" "}
                    <strong>
                      {currentWeek
                        ? weekLabel(currentWeek)
                        : "Di luar Week 01–25"}
                    </strong>
                  </span>

                  <span>
                    Kalender Global:{" "}
                    <strong>
                      {globalWeek
                        ? weekLabel(globalWeek)
                        : "Di luar kalender global"}
                    </strong>
                  </span>
                </div>
              </div>

              {isFisik && (
                <div className="in-field">
                  <label>Jarak Tempuh Fisik</label>

                  <div className="in-two-fields">
                    <div>
                      <label htmlFor="in-km">
                        Kilometer
                      </label>

                      <select
                        id="in-km"
                        className="in-input"
                        value={kilometer}
                        onChange={event =>
                          setKilometer(event.target.value)
                        }
                        disabled={
                          saving || !!actionId || !programActive
                        }
                      >
                        {Array.from(
                          { length: 101 },
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
                      <label htmlFor="in-meter">
                        Tambahan Meter
                      </label>

                      <input
                        id="in-meter"
                        className="in-input"
                        type="number"
                        min="0"
                        max="999"
                        step="1"
                        value={meter}
                        onChange={event =>
                          setMeter(event.target.value)
                        }
                        disabled={
                          saving || !!actionId || !programActive
                        }
                      />
                    </div>
                  </div>

                  <div className="in-distance">
                    <span>Total Jarak Kegiatan</span>

                    <strong>
                      {distance === null
                        ? "—"
                        : kmText(distance)}{" "}
                      km
                    </strong>

                    <small>
                      Target Fisik: 25 km per minggu program
                    </small>
                  </div>
                </div>
              )}

              <div className="in-field">
                <label htmlFor="in-description">
                  {categoryHints.label} (Opsional)
                </label>

                <p className="in-help">
                  {categoryHints.hint}
                </p>

                <textarea
                  id="in-description"
                  className="in-input"
                  rows={6}
                  value={description}
                  onChange={event =>
                    setDescription(event.target.value)
                  }
                  placeholder={categoryHints.placeholder}
                  disabled={
                    saving || !!actionId || !programActive
                  }
                />
              </div>

              <div className="in-form-info">
                Setiap data baru atau hasil edit akan
                berstatus <strong>Pending</strong>.
                Achievement dihitung setelah
                diverifikasi.
              </div>

              <div className="in-form-actions">
                <button
                  className="in-button primary"
                  type="submit"
                  disabled={
                    saving ||
                    !!actionId ||
                    !typeCode ||
                    !canManage ||
                    !programActive ||
                    !allowedDateRange
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
                    className="in-button light"
                    type="button"
                    onClick={resetForm}
                    disabled={saving || !!actionId}
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="in-card">
            <div className="in-card-head">
              <div>
                <h2>Riwayat & Verifikasi</h2>
                <p>Kelola kegiatan yang telah tercatat.</p>
              </div>

              <button
                className="in-button light"
                type="button"
                onClick={refresh}
                disabled={refreshing || saving || !!actionId}
              >
                {refreshing ? "Memuat..." : "↻ Refresh"}
              </button>
            </div>

            <div className="in-filters">
              <div>
                <label htmlFor="in-filter-week">
                  Minggu Program
                </label>

                <select
                  id="in-filter-week"
                  className="in-input"
                  value={filterWeek}
                  onChange={event =>
                    setFilterWeek(event.target.value)
                  }
                >
                  <option value="all">
                    Semua Minggu
                  </option>

                  {Array.from(
                    { length: WEEKS },
                    (_, index) => index + 1
                  ).map(item => (
                    <option key={item} value={item}>
                      {weekLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="in-filter-category">
                  Kategori
                </label>

                <select
                  id="in-filter-category"
                  className="in-input"
                  value={filterCategory}
                  onChange={event =>
                    setFilterCategory(event.target.value)
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
              </div>

              <div>
                <label htmlFor="in-filter-status">
                  Status
                </label>

                <select
                  id="in-filter-status"
                  className="in-input"
                  value={filterStatus}
                  onChange={event =>
                    setFilterStatus(event.target.value)
                  }
                >
                  <option value="all">
                    Semua Status
                  </option>
                  <option value="pending">
                    Pending
                  </option>
                  <option value="verified">
                    Verified
                  </option>
                </select>
              </div>
            </div>

            <div className="in-list-summary">
              <strong>
                {filteredRecords.length} Kegiatan
              </strong>

              <span>
                Sesuai filter yang dipilih
              </span>
            </div>

            {!filteredRecords.length ? (
              <div className="in-empty">
                Belum ada Achievement sesuai filter.
              </div>
            ) : (
              <div className="in-record-list">
                {filteredRecords.map(item => {
                  const itemType = types.find(
                    type => type.code === item.type_code
                  );

                  const target = TARGETS.find(
                    entry =>
                      normalize(entry.name) ===
                      normalize(itemType?.name)
                  );

                  const itemWeek = weekOf(
                    item.activity_date,
                    program.start_date
                  );

                  const itemGlobalWeek = getGlobalWeek(
                    item.activity_date
                  );

                  return (
                    <article
                      className="in-record"
                      key={item.id}
                    >
                      <div className="in-record-top">
                        <div>
                          <div className="in-record-title">
                            <span>
                              {target?.icon || "📋"}
                            </span>

                            <strong>
                              {itemType?.name || item.type_code}
                            </strong>
                          </div>

                          <div className="in-record-date">
                            {dateText(item.activity_date)}
                            {" · "}
                            Program:{" "}
                            {itemWeek
                              ? weekLabel(itemWeek)
                              : "Di luar program"}
                            {" · "}
                            Global:{" "}
                            {itemGlobalWeek
                              ? weekLabel(itemGlobalWeek)
                              : "Di luar kalender"}
                          </div>
                        </div>

                        <span
                          className={`in-status ${
                            item.status === "verified"
                              ? "verified"
                              : "pending"
                          }`}
                        >
                          {item.status === "verified"
                            ? "Verified"
                            : item.status === "pending"
                            ? "Pending"
                            : item.status || "—"}
                        </span>
                      </div>

                      {item.distance_km != null && (
                        <div className="in-record-distance">
                          Jarak:{" "}
                          <strong>
                            {kmText(item.distance_km)} km
                          </strong>
                        </div>
                      )}

                      {item.description && (
                        <p className="in-record-description">
                          {item.description}
                        </p>
                      )}

                      <div className="in-record-actions">
                        {item.status === "pending" && (
                          <button
                            className="in-button primary small"
                            type="button"
                            onClick={() =>
                              requestVerification(item)
                            }
                            disabled={
                              !!actionId ||
                              saving ||
                              !canManage ||
                              !programActive
                            }
                          >
                            {actionId === item.id
                              ? "Memverifikasi..."
                              : "✓ Verifikasi"}
                          </button>
                        )}

                        <button
                          className="in-button blue small"
                          type="button"
                          onClick={() => edit(item)}
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
                          className="in-button red small"
                          type="button"
                          onClick={() => remove(item)}
                          disabled={
                            !!actionId ||
                            saving ||
                            !canManage ||
                            !programActive
                          }
                        >
                          {actionId === item.id
                            ? "Memproses..."
                            : "Hapus"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="in-bottom-nav">
          <button
            className="in-button light"
            type="button"
            onClick={() =>
              router.push(`/peserta/${programId}`)
            }
          >
            ← Detail Peserta
          </button>

          <button
            className="in-button primary"
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

        <footer className="in-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>

      {confirmVerifyItem && (
        <div className="in-overlay">
          <div
            className="in-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="in-verify-title"
          >
            <h2 id="in-verify-title">
              Konfirmasi Verifikasi Achievement
            </h2>

            <p>
              Apakah kegiatan ini sudah diperiksa
              dan dinyatakan valid?
            </p>

            <div className="in-confirm-info">
              <strong>
                {types.find(
                  item =>
                    item.code === confirmVerifyItem.type_code
                )?.name || "Achievement"}
              </strong>

              <p>
                Tanggal:{" "}
                {dateText(confirmVerifyItem.activity_date)}
              </p>

              {confirmVerifyItem.description && (
                <p>
                  {confirmVerifyItem.description}
                </p>
              )}
            </div>

            <div className="in-form-actions">
              <button
                className="in-button primary"
                type="button"
                onClick={confirmVerification}
                disabled={!!actionId || saving}
              >
                {actionId
                  ? "Memverifikasi..."
                  : "Ya, Verifikasi"}
              </button>

              <button
                className="in-button light"
                type="button"
                onClick={() =>
                  setConfirmVerifyItem(null)
                }
                disabled={!!actionId || saving}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const css = `
  * {
    box-sizing: border-box;
  }

  .in-root {
    min-height: 100vh;
    background: #f2f6f5;
    color: #18362e;
    font-family: Arial, Helvetica, sans-serif;
  }

  .in-loading {
    min-height: 100vh;
    padding: 30px;
    background: #f2f6f5;
    font-family: Arial, sans-serif;
  }

  .in-header {
    background: #071f25;
    color: white;
    padding: 16px 25px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .in-brand {
    font-size: 22px;
    font-weight: 900;
    white-space: nowrap;
  }

  .in-brand span {
    color: #29c990;
  }

  .in-header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .in-login {
    text-align: right;
    max-width: 210px;
  }

  .in-login span,
  .in-login strong {
    display: block;
  }

  .in-login span {
    font-size: 10px;
    color: #b7d1c7;
  }

  .in-login strong {
    margin-top: 4px;
    font-size: 12px;
    color: white;
    overflow-wrap: anywhere;
  }

  .in-container {
    max-width: 1450px;
    margin: 0 auto;
    padding: 22px;
  }

  .in-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 30px;
    border-radius: 17px;
    color: white;
    background: linear-gradient(
      100deg,
      #061d23,
      #064a3a
    );
    margin-bottom: 16px;
  }

  .in-hero small {
    color: #eac36b;
    font-size: 10px;
    letter-spacing: 1px;
    font-weight: 900;
  }

  .in-hero h1 {
    margin: 13px 0 9px;
    font-size: clamp(25px, 3vw, 34px);
  }

  .in-hero p {
    color: #d6eae1;
    font-size: 13px;
    line-height: 1.6;
  }

  .in-hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .in-hero-meta span {
    display: inline-block;
    border: 1px solid #ffffff30;
    border-radius: 20px;
    padding: 8px 12px;
    font-size: 11px;
    background: #ffffff13;
  }

  .in-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 18px;
  }

  .in-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 13px 18px;
    border: 1px solid #dce9e2;
    background: white;
    color: #32624e;
    border-radius: 11px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
  }

  .in-tab.active {
    background: #0d845e;
    color: white;
    border-color: #0d845e;
  }

  .in-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 10px;
    padding: 12px 16px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }

  .in-button:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .in-button.primary {
    color: white;
    background: #07875d;
  }

  .in-button.light {
    color: #176347;
    background: #e3f3e9;
  }

  .in-button.blue {
    color: white;
    background: #2b78be;
  }

  .in-button.red {
    color: white;
    background: #ce4646;
  }

  .in-button.small {
    padding: 9px 12px;
    font-size: 11px;
  }

  .in-button.hero-button {
    color: #0c4c37;
    background: white;
  }

  .in-alert {
    padding: 13px 16px;
    border-radius: 11px;
    margin-bottom: 16px;
    font-size: 13px;
    line-height: 1.6;
  }

  .in-alert.error {
    background: #fff0f0;
    color: #b91c1c;
    border: 1px solid #fecaca;
  }

  .in-alert.success {
    background: #e0f6e9;
    color: #08734c;
    border: 1px solid #b9e8ce;
  }

  .in-alert.warning {
    background: #fff8e5;
    color: #91610d;
  }

  .in-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .in-stat {
    background: white;
    border: 1px solid #e0eae6;
    border-radius: 14px;
    padding: 18px;
  }

  .in-stat span {
    display: block;
    font-size: 12px;
    color: #768c83;
  }

  .in-stat strong {
    display: block;
    font-size: 29px;
    margin-top: 9px;
    color: #183b32;
  }

  .in-stat.green strong {
    color: #07885b;
  }

  .in-stat.orange strong {
    color: #ce8b19;
  }

  .in-layout {
    display: grid;
    grid-template-columns:
      minmax(0, .9fr) minmax(0, 1.25fr);
    gap: 16px;
    align-items: start;
  }

  .in-card {
    min-width: 0;
    background: white;
    border: 1px solid #e0eae6;
    border-radius: 16px;
    padding: 22px;
    box-shadow: 0 4px 15px #123c3010;
    scroll-margin-top: 20px;
  }

  .in-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 23px;
  }

  .in-card-head h2 {
    margin: 0;
    font-size: 18px;
  }

  .in-card-head p {
    margin: 8px 0 0;
    color: #85958c;
    font-size: 12px;
    line-height: 1.6;
  }

  .in-pill {
    border-radius: 20px;
    padding: 8px 12px;
    background: #e2f5e9;
    color: #087a57;
    font-size: 11px;
    font-weight: 800;
  }

  .in-field {
    margin-bottom: 20px;
  }

  .in-field > label,
  .in-two-fields label,
  .in-filters label {
    display: block;
    font-size: 12px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .in-input {
    display: block;
    width: 100%;
    min-width: 0;
    border: 1px solid #d4e2d9;
    border-radius: 10px;
    background: white;
    color: #203b30;
    padding: 12px;
    font-family: inherit;
    font-size: 14px;
  }

  .in-input:focus {
    outline: 2px solid #a5dcc1;
    outline-offset: 1px;
  }

  .in-help {
    margin: 8px 0 0;
    font-size: 11px;
    line-height: 1.6;
    color: #779084;
  }

  .in-range-box {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    font-size: 11px;
    color: #6a8777;
  }

  .in-range-box strong {
    color: #0b7754;
  }

  .in-date-info {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 10px;
  }

  .in-date-info span {
    padding: 7px 9px;
    background: #f2f6f4;
    border-radius: 7px;
    font-size: 10px;
    color: #73867b;
  }

  .in-date-info strong {
    color: #12764f;
  }

  .in-two-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .in-distance {
    margin-top: 13px;
    padding: 15px;
    border-radius: 11px;
    background: #e6f6ed;
  }

  .in-distance span,
  .in-distance small {
    display: block;
    color: #738b7d;
    font-size: 11px;
  }

  .in-distance strong {
    display: block;
    color: #087a53;
    font-size: 23px;
    margin: 9px 0;
  }

  .in-form-info {
    padding: 12px;
    border-radius: 10px;
    background: #f4f7f5;
    color: #678073;
    font-size: 11px;
    line-height: 1.7;
    margin-bottom: 18px;
  }

  .in-form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .in-filters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0,1fr));
    gap: 9px;
  }

  .in-list-summary {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 17px 0;
    margin-top: 13px;
    border-bottom: 1px solid #edf1ee;
  }

  .in-list-summary strong {
    font-size: 13px;
  }

  .in-list-summary span {
    font-size: 11px;
    color: #86978c;
  }

  .in-record-list {
    max-height: 950px;
    overflow-y: auto;
  }

  .in-record {
    padding: 16px 0;
    border-bottom: 1px solid #edf1ee;
  }

  .in-record-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .in-record-title {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
  }

  .in-record-title span {
    font-size: 21px;
  }

  .in-record-date {
    margin-top: 7px;
    font-size: 11px;
    color: #86958d;
    line-height: 1.6;
  }

  .in-status {
    border-radius: 20px;
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 850;
    white-space: nowrap;
  }

  .in-status.verified {
    background: #def5e8;
    color: #087c55;
  }

  .in-status.pending {
    background: #fff1d2;
    color: #a7771c;
  }

  .in-record-distance {
    margin-top: 10px;
    font-size: 12px;
  }

  .in-record-description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 12px;
    color: #667b6e;
    line-height: 1.7;
  }

  .in-record-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 13px;
  }

  .in-empty {
    text-align: center;
    padding: 35px 10px;
    color: #899c8f;
    font-size: 12px;
  }

  .in-bottom-nav {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
  }

  .in-footer {
    text-align: center;
    color: #849b8e;
    font-size: 11px;
    padding: 28px 5px;
  }

  .in-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(4,24,25,.75);
  }

  .in-dialog {
    width: 100%;
    max-width: 460px;
    background: white;
    border-radius: 17px;
    padding: 24px;
  }

  .in-dialog h2 {
    margin: 0 0 13px;
    font-size: 20px;
  }

  .in-dialog > p {
    color: #6b7c70;
    font-size: 13px;
    line-height: 1.6;
  }

  .in-confirm-info {
    padding: 14px;
    background: #f2f6f4;
    border-radius: 10px;
    margin: 17px 0;
  }

  .in-confirm-info p {
    font-size: 12px;
    color: #677d6f;
    overflow-wrap: anywhere;
  }

  @media(max-width:1000px) {
    .in-layout {
      grid-template-columns: 1fr;
    }

    .in-record-list {
      max-height: none;
    }
  }

  @media(max-width:650px) {
    .in-header {
      padding: 12px;
    }

    .in-brand {
      font-size: 17px;
    }

    .in-header-actions {
      gap: 8px;
    }

    .in-login {
      max-width: 115px;
    }

    .in-login strong {
      font-size: 10px;
    }

    .in-container {
      padding: 12px;
    }

    .in-hero {
      padding: 21px;
      flex-direction: column;
      align-items: stretch;
    }

    .in-hero h1 {
      font-size: 23px;
    }

    .in-tabs {
      gap: 6px;
    }

    .in-tab {
      flex: 1;
      padding: 11px 7px;
      font-size: 11px;
      text-align: center;
    }

    .in-card {
      padding: 15px;
    }

    .in-stats {
      gap: 7px;
    }

    .in-stat {
      padding: 12px 9px;
    }

    .in-stat span {
      font-size: 10px;
    }

    .in-stat strong {
      font-size: 23px;
    }

    .in-filters {
      grid-template-columns: 1fr;
    }

    .in-bottom-nav .in-button {
      font-size: 10px;
      padding: 11px 9px;
    }
  }

  @media(max-width:350px) {
    .in-two-fields {
      grid-template-columns: 1fr;
    }

    .in-login {
      display: none;
    }

    .in-header-actions .in-button {
      font-size: 10px;
      padding: 10px;
    }
  }
`;
