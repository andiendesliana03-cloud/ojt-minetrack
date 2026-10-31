"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const STORAGE_BUCKET = "achievement-files";

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "🎓" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "📍" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeKey(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return normalize(value);
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
    ? date
    : null;
}

function addDays(dateText, days) {
  const date = parseDate(dateText);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from({ length: 25 }, (_, index) => {
  const start =
    index === 0
      ? "2026-09-12"
      : addDays("2026-09-20", (index - 1) * 7);

  return {
    week: index + 1,
    start,
    end: addDays(start, 6),
  };
});

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(item => date >= item.start && date <= item.end)?.week ??
    null
  );
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

function monthYear(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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

function num(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "0";
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] || "")
    .join("")
    .toUpperCase();
}

function categoryOf(value) {
  const key = normalizeKey(value);

  if (["fisik", "physical"].includes(key)) return "Fisik";
  if (["training", "internaltraining", "pelatihan"].includes(key)) return "Training";
  if (["sosialisasi", "socialization"].includes(key)) return "Sosialisasi";
  if (["coaching", "pembinaan"].includes(key)) return "Coaching";
  if (["orientasiarea", "orientasi", "areaorientation"].includes(key)) return "Orientasi Area";
  if (["hazard", "hazardidentification", "identifikasibahaya"].includes(key)) return "Hazard";

  return null;
}

function insideProgram(dateText, program) {
  const date = String(dateText ?? "").slice(0, 10);

  if (!parseDate(date) || !parseDate(program?.start_date)) {
    return false;
  }

  return (
    date >= String(program.start_date).slice(0, 10) &&
    (!parseDate(program.end_date) ||
      date <= String(program.end_date).slice(0, 10)) &&
    globalWeekOf(date) !== null
  );
}

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS[week - 1];

  if (!global || !parseDate(program?.start_date)) return null;

  const startProgram = String(program.start_date).slice(0, 10);
  const endProgram = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start = global.start > startProgram ? global.start : startProgram;
  const end = endProgram && endProgram < global.end ? endProgram : global.end;

  return start <= end ? { start, end } : null;
}

function initialWeek(program, rows) {
  const availableWeeks = GLOBAL_WEEKS.filter(item =>
    programWeekRange(program, item.week)
  );

  if (!availableWeeks.length) return 1;

  const today = todayWITA();

  const current = availableWeeks.find(item => {
    const range = programWeekRange(program, item.week);
    return range && today >= range.start && today <= range.end;
  });

  if (current) return current.week;

  const recorded = rows
    .filter(item => insideProgram(item.activity_date, program))
    .map(item => globalWeekOf(item.activity_date))
    .filter(Boolean);

  if (recorded.length) {
    return Math.max(...recorded);
  }

  return availableWeeks[0].week;
}

function getTypeLabel(item) {
  return categoryOf(item?.code) || categoryOf(item?.name) || item?.name || "Kategori";
}

function average(list) {
  if (!list.length) return 0;
  return list.reduce((sum, item) => sum + item, 0) / list.length;
}

function ProgressBar({ value, color = "green" }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="ia-progress">
      <span className={`ia-progress-fill ${color}`} style={{ width: `${safe}%` }} />
    </div>
  );
}

export default function InputAchievementPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);
  const [types, setTypes] = useState([]);
  const [records, setRecords] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);

  const [formTypeCode, setFormTypeCode] = useState("");
  const [formDate, setFormDate] = useState(todayWITA());
  const [formDescription, setFormDescription] = useState("");
  const [formKm, setFormKm] = useState("");
  const [formMeter, setFormMeter] = useState("");
  const [formFile, setFormFile] = useState(null);
  const [editId, setEditId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName = participant?.full_name || "Peserta OJT";
  const accountName = manager?.full_name || "Mentor OJT";
  const roleName = roleOf(manager?.role) === "admin" ? "Administrator" : "Mentor OJT";

  async function fetchAchievements(id) {
    const { data, error } = await supabase
      .from("achievement_records")
      .select("*")
      .eq("program_id", id)
      .order("activity_date", { ascending: false });

    if (error) {
      throw new Error(`Achievement: ${error.message}`);
    }

    return data || [];
  }

  async function loadPage() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
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
        throw new Error("Halaman hanya tersedia untuk Admin dan Mentor.");
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

      if (role === "mentor") {
        query = query.eq("mentor_id", user.id);
      }

      const { data: programData, error: programError } = await query.maybeSingle();

      if (programError) throw programError;

      if (!programData) {
        throw new Error("Program tidak ditemukan atau akses ditolak.");
      }

      const [typeResult, achievementRows] = await Promise.all([
        supabase.from("achievement_types").select("code,name").order("name"),
        fetchAchievements(programId),
      ]);

      if (typeResult.error) throw typeResult.error;

      setManager(profile);
      setProgram(programData);
      setTypes(typeResult.data || []);
      setRecords(achievementRows);
      setSelectedWeek(initialWeek(programData, achievementRows));
    } catch (err) {
      setError(err?.message || "Gagal memuat halaman Input Achievement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  async function refreshData() {
    if (!programId || refreshing) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      const rows = await fetchAchievements(programId);
      setRecords(rows);
      setMessage("Data achievement berhasil diperbarui.");
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  const selectedRange = useMemo(
    () => programWeekRange(program, selectedWeek),
    [program, selectedWeek]
  );

  const availableWeeks = useMemo(
    () => GLOBAL_WEEKS.filter(item => programWeekRange(program, item.week)),
    [program]
  );

  useEffect(() => {
    if (!selectedRange) return;

    if (!parseDate(formDate) || formDate < selectedRange.start || formDate > selectedRange.end) {
      setFormDate(selectedRange.end);
    }
  }, [selectedRange, formDate]);

  const typeOptions = useMemo(() => {
    if (types.length) {
      return types.map(item => ({
        code: item.code,
        label: getTypeLabel(item),
      }));
    }

    return TARGETS.map(item => ({
      code: item.name,
      label: item.name,
    }));
  }, [types]);

  const currentTypeLabel = useMemo(() => {
    return (
      typeOptions.find(item => item.code === formTypeCode)?.label ||
      categoryOf(formTypeCode) ||
      ""
    );
  }, [formTypeCode, typeOptions]);

  const isFisik = currentTypeLabel === "Fisik";

  function distanceValue() {
    const km = Number(formKm) || 0;
    const meter = Number(formMeter) || 0;
    return km + meter / 1000;
  }

  function safeDescription(item) {
    return (
      item.notes ||
      item.description ||
      item.detail ||
      item.activity_detail ||
      item.activity_name ||
      "Tidak ada deskripsi tambahan."
    );
  }

  function safeFileName(item) {
    return (
      item.evidence_name ||
      item.file_name ||
      item.attachment_name ||
      item.document_name ||
      null
    );
  }

  function safeFileUrl(item) {
    return (
      item.evidence_url ||
      item.file_url ||
      item.attachment_url ||
      item.document_url ||
      null
    );
  }

  function categoryLabelFromRecord(item) {
    const fromType =
      categoryOf(item.type_code) ||
      categoryOf(
        types.find(type => normalizeKey(type.code) === normalizeKey(item.type_code))?.name
      );

    return fromType || item.type_code || "Kategori";
  }

  const verifiedRows = useMemo(
    () => records.filter(item => roleOf(item.status) === "verified" && insideProgram(item.activity_date, program)),
    [records, program]
  );

  const pendingRows = useMemo(
    () => records.filter(item => roleOf(item.status) === "pending" && insideProgram(item.activity_date, program)),
    [records, program]
  );

  const overallCategoryStats = useMemo(() => {
    return TARGETS.map(target => {
      const matched = verifiedRows.filter(item => categoryLabelFromRecord(item) === target.name);

      const actual =
        target.name === "Fisik"
          ? matched.reduce((sum, item) => {
              const distance = Number(item.distance_km);
              return sum + (Number.isFinite(distance) && distance > 0 ? distance : 0);
            }, 0)
          : matched.length;

      const percent = Math.max(0, Math.min(100, (actual / target.target) * 100));

      return {
        ...target,
        actual,
        percent,
        achieved: actual >= target.target,
      };
    });
  }, [verifiedRows, types]);

  const overallProgress = useMemo(
    () => Math.round(average(overallCategoryStats.map(item => item.percent)) * 100) / 100,
    [overallCategoryStats]
  );

  const overallCategoryDone = useMemo(
    () => overallCategoryStats.filter(item => item.achieved).length,
    [overallCategoryStats]
  );

  const weekRows = useMemo(() => {
    return records.filter(item => {
      return (
        insideProgram(item.activity_date, program) &&
        globalWeekOf(item.activity_date) === selectedWeek
      );
    });
  }, [records, program, selectedWeek]);

  const weekVerified = useMemo(
    () => weekRows.filter(item => roleOf(item.status) === "verified"),
    [weekRows]
  );

  const weekSummary = useMemo(() => {
    const output = TARGETS.map(target => {
      const matched = weekVerified.filter(item => categoryLabelFromRecord(item) === target.name);

      const actual =
        target.name === "Fisik"
          ? matched.reduce((sum, item) => {
              const distance = Number(item.distance_km);
              return sum + (Number.isFinite(distance) && distance > 0 ? distance : 0);
            }, 0)
          : matched.length;

      const percent = Math.max(0, Math.min(100, (actual / target.target) * 100));

      return {
        ...target,
        actual,
        count: matched.length,
        percent,
      };
    });

    return output;
  }, [weekVerified, types]);

  function badgeTone(label) {
    switch (label) {
      case "Fisik":
        return "green";
      case "Training":
        return "gold";
      case "Sosialisasi":
        return "teal";
      case "Coaching":
        return "blue";
      case "Orientasi Area":
        return "purple";
      case "Hazard":
        return "rose";
      default:
        return "green";
    }
  }

  async function tryUpload(file) {
    if (!file) return null;

    const cleanName = `${programId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(cleanName, file, { upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanName);

    return {
      name: file.name,
      path: cleanName,
      url: data?.publicUrl || null,
    };
  }

  function resetForm() {
    setEditId(null);
    setFormTypeCode("");
    setFormDescription("");
    setFormKm("");
    setFormMeter("");
    setFormFile(null);
    setFormDate(selectedRange?.end || todayWITA());
  }

  async function saveAchievement(event) {
    event.preventDefault();

    if (!program || !manager || saving) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (!formTypeCode) {
        throw new Error("Kategori Achievement wajib dipilih.");
      }

      if (!parseDate(formDate)) {
        throw new Error("Tanggal pencapaian tidak valid.");
      }

      if (!selectedRange || formDate < selectedRange.start || formDate > selectedRange.end) {
        throw new Error("Tanggal pencapaian harus sesuai rentang Week yang dipilih.");
      }

      let uploadedFile = null;
      let uploadWarning = "";

      if (formFile) {
        try {
          uploadedFile = await tryUpload(formFile);
        } catch (uploadError) {
          uploadWarning =
            "Data achievement tetap disimpan, tetapi file tidak berhasil di-upload. Periksa bucket storage.";
        }
      }

      const primaryPayload = {
        program_id: programId,
        type_code: formTypeCode,
        activity_date: formDate,
        distance_km: isFisik ? distanceValue() : null,
        status: "verified",
        created_by: manager.id,
        notes: formDescription.trim() || null,
        evidence_name: uploadedFile?.name || formFile?.name || null,
        evidence_url: uploadedFile?.url || null,
      };

      const fallbackPayload = {
        program_id: programId,
        type_code: formTypeCode,
        activity_date: formDate,
        distance_km: isFisik ? distanceValue() : null,
        status: "verified",
      };

      let result;

      if (editId) {
        result = await supabase
          .from("achievement_records")
          .update(primaryPayload)
          .eq("id", editId)
          .eq("program_id", programId)
          .select("id");
      } else {
        result = await supabase
          .from("achievement_records")
          .insert(primaryPayload)
          .select("id");
      }

      if (result.error) {
        const maybeColumnError =
          /column|schema cache|could not find/i.test(result.error.message);

        if (!maybeColumnError) {
          throw result.error;
        }

        const fallback = editId
          ? await supabase
              .from("achievement_records")
              .update(fallbackPayload)
              .eq("id", editId)
              .eq("program_id", programId)
              .select("id")
          : await supabase
              .from("achievement_records")
              .insert(fallbackPayload)
              .select("id");

        if (fallback.error) {
          throw fallback.error;
        }
      }

      const refreshed = await fetchAchievements(programId);
      setRecords(refreshed);

      setMessage(
        editId
          ? "Achievement berhasil diperbarui."
          : "Achievement berhasil disimpan."
      );

      if (uploadWarning) {
        setMessage(
          `${editId ? "Achievement diperbarui." : "Achievement disimpan."} ${uploadWarning}`
        );
      }

      resetForm();
    } catch (err) {
      setError(err?.message || "Gagal menyimpan achievement.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item) {
    const label = categoryLabelFromRecord(item);

    setEditId(item.id);
    setSelectedWeek(globalWeekOf(item.activity_date) || selectedWeek);
    setFormTypeCode(
      types.find(type => getTypeLabel(type) === label)?.code || item.type_code || ""
    );
    setFormDate(String(item.activity_date).slice(0, 10));
    setFormDescription(
      item.notes || item.description || item.detail || item.activity_detail || ""
    );

    const distance = Number(item.distance_km);
    if (label === "Fisik" && Number.isFinite(distance) && distance > 0) {
      const km = Math.floor(distance);
      const meter = Math.round((distance - km) * 1000);
      setFormKm(String(km));
      setFormMeter(String(meter));
    } else {
      setFormKm("");
      setFormMeter("");
    }

    setFormFile(null);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function deleteRecord(item) {
    if (deletingId || saving) return;

    if (!window.confirm("Hapus achievement ini?")) return;

    setDeletingId(item.id);
    setError("");
    setMessage("");

    try {
      const { error } = await supabase
        .from("achievement_records")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId);

      if (error) throw error;

      const refreshed = await fetchAchievements(programId);
      setRecords(refreshed);
      setMessage("Achievement berhasil dihapus.");

      if (editId === item.id) {
        resetForm();
      }
    } catch (err) {
      setError(err?.message || "Gagal menghapus achievement.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main className="ia-loading">
        <style>{css}</style>
        <div>
          <h2>OJT MineTrack</h2>
          <p>Memuat halaman Input Achievement...</p>
        </div>
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="ia-loading">
        <style>{css}</style>
        <div>
          <h2>Halaman tidak dapat ditampilkan</h2>
          <p>{error || "Data program tidak tersedia."}</p>
          <button onClick={() => router.push("/")}>
            Kembali ke Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="ia-app">
      <style>{css}</style>

      <header className="ia-topbar">
        <div className="ia-brand" onClick={() => router.push("/")}>
          <strong>
            OJT <span>MineTrack</span>
          </strong>
          <small>v2.0</small>
        </div>

        <nav className="ia-nav">
          <button onClick={() => router.push("/")}>Dashboard</button>
          <button onClick={() => router.push("/mentor/monitoring-peserta")}>
            Peserta OJT
          </button>
          <button className="active" onClick={() => router.push(`/achievement/${programId}`)}>
            Input Achievement
          </button>
          <button onClick={() => router.push(`/achievement/${programId}/monitoring`)}>
            Monitoring
          </button>
        </nav>

        <div className="ia-account">
          <span className="ia-bell">🔔</span>

          <div className="ia-avatar">{initials(accountName)}</div>

          <div className="ia-account-text">
            <strong>{accountName}</strong>
            <small>{roleName}</small>
          </div>
        </div>
      </header>

      <main className="ia-content">
        <section className="ia-hero">
          <div>
            <h1>
              Input <span>Achievement OJT</span>
            </h1>
            <p>Catat dan dokumentasikan pencapaian peserta OJT secara terstruktur.</p>
          </div>
        </section>

        {error && <div className="ia-alert error">{error}</div>}
        {message && <div className="ia-alert success">✓ {message}</div>}

        <section className="ia-profile-strip">
          <div className="ia-profile-left">
            <div className="ia-profile-avatar">{initials(participantName)}</div>

            <div className="ia-profile-copy">
              <h2>{participantName}</h2>
              <p>
                {participant?.department || "—"} | {program.site || "—"}
              </p>

              <div className="ia-profile-meta">
                <div>
                  <span>📅</span>
                  <div>
                    <small>Periode OJT</small>
                    <strong>
                      {formatDate(program.start_date)} – {formatDate(program.end_date)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ia-profile-stats">
            <div className="ia-stat-card donut">
              <div
                className="ia-donut"
                style={{ "--progress": `${overallProgress}%` }}
              >
                <div>
                  <strong>{num(overallProgress)}%</strong>
                </div>
              </div>
              <div className="ia-stat-text">
                <strong>Capaian Keseluruhan</strong>
              </div>
            </div>

            <div className="ia-stat-card green">
              <span>🗂️</span>
              <strong>{verifiedRows.length}</strong>
              <small>Terverifikasi</small>
            </div>

            <div className="ia-stat-card rose">
              <span>🕘</span>
              <strong>{pendingRows.length}</strong>
              <small>Menunggu</small>
            </div>

            <div className="ia-stat-card blue">
              <span>📘</span>
              <strong>{overallCategoryDone}/6</strong>
              <small>Kategori</small>
            </div>
          </div>
        </section>

        <section className="ia-main-grid">
          <div className="ia-card">
            <div className="ia-card-head">
              <div>
                <h2>Tambah Achievement</h2>
                <p>Isi pencapaian OJT pada periode yang dipilih.</p>
              </div>
            </div>

            <form className="ia-form" onSubmit={saveAchievement}>
              <label>
                <span>Kategori</span>
                <select
                  value={formTypeCode}
                  onChange={event => setFormTypeCode(event.target.value)}
                  required
                >
                  <option value="">Pilih Kategori</option>
                  {typeOptions.map(item => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Week</span>
                <select
                  value={selectedWeek}
                  onChange={event => setSelectedWeek(Number(event.target.value))}
                >
                  {availableWeeks.map(item => (
                    <option key={item.week} value={item.week}>
                      Week {String(item.week).padStart(2, "0")}
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
                  onChange={event => setFormDate(event.target.value)}
                  required
                />
              </label>

              {selectedRange && (
                <div className="ia-range-note">
                  Rentang Week terpilih:
                  {" "}
                  <strong>
                    {formatDate(selectedRange.start)} – {formatDate(selectedRange.end)}
                  </strong>
                </div>
              )}

              {isFisik && (
                <div className="ia-distance-grid">
                  <label>
                    <span>Jarak (Km)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formKm}
                      onChange={event => setFormKm(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <label>
                    <span>Tambahan Meter</span>
                    <input
                      type="number"
                      min="0"
                      max="999"
                      step="1"
                      value={formMeter}
                      onChange={event => setFormMeter(event.target.value)}
                      placeholder="0"
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
                  onChange={event => setFormDescription(event.target.value)}
                  placeholder="Jelaskan pencapaian yang telah dilakukan..."
                />
                <small className="ia-char-count">{formDescription.length}/500</small>
              </label>

              <label>
                <span>Bukti/Dokumentasi (Opsional)</span>
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={event => setFormFile(event.target.files?.[0] || null)}
                />
                <small className="ia-upload-note">
                  PNG, JPG, PDF (maks. sesuai pengaturan storage)
                </small>
              </label>

              <div className="ia-form-actions">
                <button className="ia-primary" type="submit" disabled={saving}>
                  {saving
                    ? "Menyimpan..."
                    : editId
                    ? "Simpan Perubahan"
                    : "Simpan Achievement"}
                </button>

                {editId && (
                  <button
                    type="button"
                    className="ia-secondary"
                    onClick={resetForm}
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="ia-card">
            <div className="ia-card-head split">
              <div>
                <h2>Riwayat Achievement</h2>
                <p>Daftar pencapaian yang telah diinput pada periode OJT.</p>
              </div>

              <div className="ia-filter-week">
                <select
                  value={selectedWeek}
                  onChange={event => setSelectedWeek(Number(event.target.value))}
                >
                  {availableWeeks.map(item => (
                    <option key={item.week} value={item.week}>
                      Week {String(item.week).padStart(2, "0")}
                      {" "}
                      ({formatDateShort(item.start)} – {formatDateShort(item.end)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ia-history-list">
              {!weekRows.length && (
                <div className="ia-empty">
                  Belum ada achievement pada Week ini.
                </div>
              )}

              {weekRows.map(item => {
                const label = categoryLabelFromRecord(item);
                const fileName = safeFileName(item);
                const fileUrl = safeFileUrl(item);
                const tone = badgeTone(label);
                const date = String(item.activity_date).slice(0, 10);

                return (
                  <div className="ia-history-item" key={item.id}>
                    <div className="ia-history-date">
                      <strong>{date.slice(8, 10)}</strong>
                      <span>{monthYear(date)}</span>
                    </div>

                    <div className="ia-history-body">
                      <h3>{label}</h3>
                      <p>{safeDescription(item)}</p>

                      {label === "Fisik" && Number(item.distance_km) > 0 && (
                        <div className="ia-inline-info">
                          Jarak: <strong>{num(item.distance_km, 3)} km</strong>
                        </div>
                      )}

                      {fileName && (
                        <div className="ia-file-chip">
                          📎{" "}
                          {fileUrl ? (
                            <a href={fileUrl} target="_blank" rel="noreferrer">
                              {fileName}
                            </a>
                          ) : (
                            <span>{fileName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="ia-history-side">
                      <span className={`ia-tag ${tone}`}>{label}</span>

                      <span className={`ia-status ${roleOf(item.status) === "verified" ? "verified" : "pending"}`}>
                        {roleOf(item.status) === "verified" ? "Terverifikasi" : "Menunggu"}
                      </span>

                      <div className="ia-actions">
                        <button
                          type="button"
                          className="ia-action edit"
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="ia-action delete"
                          disabled={deletingId === item.id}
                          onClick={() => deleteRecord(item)}
                        >
                          {deletingId === item.id ? "Menghapus..." : "Hapus"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="ia-week-summary">
              <div className="ia-week-summary-head">
                <div>
                  <h3>Pencapaian Week {String(selectedWeek).padStart(2, "0")}</h3>
                  <p>Ringkasan capaian per kategori pada week ini.</p>
                </div>

                <strong>
                  Week {String(selectedWeek).padStart(2, "0")}
                  {" "}
                  ({formatDateShort(selectedRange?.start)} – {formatDateShort(selectedRange?.end)})
                </strong>
              </div>

              <div className="ia-week-grid">
                {weekSummary.map(item => (
                  <div className="ia-week-card" key={item.name}>
                    <div className="ia-week-top">
                      <span>{item.icon}</span>
                      <strong>{item.name}</strong>
                    </div>

                    <div className="ia-week-numbers">
                      <span>
                        {item.name === "Fisik"
                          ? `${num(item.actual, 3)} / ${item.target} ${item.unit}`
                          : `${item.count} / ${item.target}`}
                      </span>

                      <strong>{Math.round(item.percent)}%</strong>
                    </div>

                    <ProgressBar value={item.percent} color={badgeTone(item.name)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="ia-footer">
          OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal
        </footer>
      </main>
    </div>
  );
}

const css = `
  * {
    box-sizing: border-box;
  }

  .ia-app {
    min-height: 100vh;
    background: #f6f8fa;
    color: #163047;
    font-family: Arial, Helvetica, sans-serif;
  }

  .ia-app button,
  .ia-app input,
  .ia-app select,
  .ia-app textarea {
    font: inherit;
  }

  .ia-app button {
    cursor: pointer;
  }

  .ia-app button:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  .ia-loading {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: #f6f8fa;
    font-family: Arial, Helvetica, sans-serif;
    color: #163047;
  }

  .ia-loading > div {
    text-align: center;
    max-width: 520px;
  }

  .ia-loading button {
    margin-top: 14px;
    border: 0;
    background: #0b8b61;
    color: white;
    border-radius: 10px;
    padding: 12px 16px;
    font-weight: 700;
  }

  .ia-topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    height: 74px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 28px;
    background: rgba(255,255,255,.95);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid #e6edf1;
  }

  .ia-brand {
    display: flex;
    align-items: baseline;
    gap: 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .ia-brand strong {
    font-size: 26px;
    font-weight: 900;
    letter-spacing: -.7px;
  }

  .ia-brand strong span {
    color: #0b8b61;
  }

  .ia-brand small {
    color: #7e90a1;
    font-size: 11px;
    font-weight: 700;
  }

  .ia-nav {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
    justify-content: center;
  }

  .ia-nav button {
    border: 0;
    background: transparent;
    color: #516173;
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
  }

  .ia-nav button.active,
  .ia-nav button:hover {
    background: #e8f6ef;
    color: #0b8b61;
  }

  .ia-account {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .ia-bell {
    font-size: 18px;
  }

  .ia-avatar {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #dff4ea;
    color: #0a7a55;
    font-size: 14px;
    font-weight: 900;
  }

  .ia-account-text strong,
  .ia-account-text small {
    display: block;
  }

  .ia-account-text strong {
    font-size: 12px;
  }

  .ia-account-text small {
    color: #7f90a2;
    font-size: 11px;
    margin-top: 4px;
  }

  .ia-content {
    max-width: 1420px;
    margin: 0 auto;
    padding: 26px;
  }

  .ia-hero h1 {
    margin: 0;
    font-size: 48px;
    line-height: 1.05;
    letter-spacing: -.9px;
  }

  .ia-hero h1 span {
    color: #0b8b61;
  }

  .ia-hero p {
    margin: 10px 0 22px;
    color: #6e8092;
    font-size: 18px;
  }

  .ia-alert {
    margin-bottom: 16px;
    padding: 14px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .ia-alert.error {
    background: #fff0f0;
    border: 1px solid #f6caca;
    color: #b91c1c;
  }

  .ia-alert.success {
    background: #edf9f2;
    border: 1px solid #cbead6;
    color: #0a7a55;
  }

  .ia-profile-strip {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .ia-profile-left,
  .ia-profile-stats {
    background: white;
    border: 1px solid #e4ecf1;
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 6px 18px rgba(16,36,59,.04);
  }

  .ia-profile-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .ia-profile-avatar {
    width: 104px;
    height: 104px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 18px;
    background: #dff4ea;
    color: #0a7a55;
    font-size: 44px;
    font-weight: 900;
  }

  .ia-profile-copy h2 {
    margin: 0;
    font-size: 24px;
    line-height: 1.2;
  }

  .ia-profile-copy > p {
    margin: 8px 0 18px;
    color: #6f8193;
    font-weight: 700;
    font-size: 14px;
  }

  .ia-profile-meta {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }

  .ia-profile-meta > div {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ia-profile-meta span {
    font-size: 20px;
  }

  .ia-profile-meta small,
  .ia-profile-meta strong {
    display: block;
  }

  .ia-profile-meta small {
    color: #8192a4;
    font-size: 11px;
  }

  .ia-profile-meta strong {
    margin-top: 4px;
    font-size: 13px;
  }

  .ia-profile-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .ia-stat-card {
    min-width: 0;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid #edf2f5;
    background: #fbfdfc;
    display: grid;
    align-content: center;
    justify-items: center;
    text-align: center;
    gap: 8px;
  }

  .ia-stat-card strong {
    font-size: 16px;
  }

  .ia-stat-card small {
    color: #6e8092;
    font-size: 12px;
  }

  .ia-stat-card > span {
    font-size: 22px;
  }

  .ia-stat-card.green {
    background: #eff9f4;
  }

  .ia-stat-card.rose {
    background: #fff3f3;
  }

  .ia-stat-card.blue {
    background: #f1f6ff;
  }

  .ia-stat-card.donut {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    justify-items: stretch;
    text-align: left;
  }

  .ia-stat-text strong {
    font-size: 15px;
    line-height: 1.3;
  }

  .ia-donut {
    --progress: 0%;
    width: 88px;
    height: 88px;
    flex-shrink: 0;
    border-radius: 50%;
    background: conic-gradient(#0bb174 var(--progress), #dfe9e3 var(--progress));
    display: grid;
    place-items: center;
    padding: 8px;
  }

  .ia-donut > div {
    width: 100%;
    height: 100%;
    background: white;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }

  .ia-donut strong {
    font-size: 22px;
    color: #173047;
  }

  .ia-main-grid {
    display: grid;
    grid-template-columns: 440px minmax(0, 1fr);
    gap: 16px;
  }

  .ia-card {
    background: white;
    border: 1px solid #e4ecf1;
    border-radius: 18px;
    padding: 18px;
    box-shadow: 0 6px 18px rgba(16,36,59,.04);
  }

  .ia-card-head {
    margin-bottom: 16px;
  }

  .ia-card-head.split {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .ia-card-head h2 {
    margin: 0;
    font-size: 18px;
  }

  .ia-card-head p {
    margin: 6px 0 0;
    color: #708294;
    font-size: 13px;
  }

  .ia-form {
    display: grid;
    gap: 14px;
  }

  .ia-form label {
    display: grid;
    gap: 8px;
  }

  .ia-form label > span {
    font-size: 13px;
    font-weight: 700;
    color: #1e3a4f;
  }

  .ia-form select,
  .ia-form input[type="date"],
  .ia-form input[type="number"],
  .ia-form input[type="file"],
  .ia-form textarea {
    width: 100%;
    border: 1px solid #dbe5ea;
    border-radius: 12px;
    background: #fff;
    padding: 13px 14px;
    font-size: 14px;
    color: #173047;
    outline: none;
  }

  .ia-form textarea {
    resize: vertical;
    min-height: 110px;
  }

  .ia-char-count,
  .ia-upload-note {
    color: #8393a3;
    font-size: 11px;
  }

  .ia-char-count {
    text-align: right;
  }

  .ia-range-note {
    padding: 10px 12px;
    border-radius: 12px;
    background: #f3faf6;
    color: #4f6d60;
    font-size: 12px;
  }

  .ia-distance-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .ia-form-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .ia-primary,
  .ia-secondary {
    border: 0;
    border-radius: 12px;
    padding: 14px 18px;
    font-size: 14px;
    font-weight: 800;
  }

  .ia-primary {
    background: #0b8b61;
    color: white;
    flex: 1;
  }

  .ia-secondary {
    background: #ecf1f5;
    color: #3e5367;
  }

  .ia-filter-week select {
    border: 1px solid #dbe5ea;
    background: #fff;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13px;
    color: #173047;
  }

  .ia-history-list {
    display: grid;
    gap: 12px;
  }

  .ia-empty {
    border: 1px dashed #d8e3e9;
    border-radius: 14px;
    padding: 28px 18px;
    text-align: center;
    color: #7c8ea0;
    font-size: 14px;
  }

  .ia-history-item {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr) 210px;
    gap: 14px;
    border: 1px solid #e7eef2;
    border-radius: 16px;
    padding: 14px;
    background: #fff;
  }

  .ia-history-date {
    display: grid;
    align-content: center;
    justify-items: center;
    text-align: center;
    border-right: 1px solid #eef3f6;
    padding-right: 10px;
  }

  .ia-history-date strong {
    font-size: 28px;
    line-height: 1;
  }

  .ia-history-date span {
    margin-top: 6px;
    color: #76889b;
    font-size: 12px;
  }

  .ia-history-body h3 {
    margin: 0 0 8px;
    font-size: 18px;
  }

  .ia-history-body p {
    margin: 0;
    color: #64778b;
    font-size: 13px;
    line-height: 1.6;
  }

  .ia-inline-info {
    margin-top: 10px;
    color: #4f6378;
    font-size: 12px;
  }

  .ia-file-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    padding: 7px 11px;
    border-radius: 999px;
    background: #f2f7fa;
    color: #3e566d;
    font-size: 12px;
    max-width: 100%;
    overflow: hidden;
  }

  .ia-file-chip a,
  .ia-file-chip span {
    color: inherit;
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ia-history-side {
    display: grid;
    align-content: space-between;
    gap: 10px;
  }

  .ia-tag,
  .ia-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .ia-tag.green {
    background: #edf9f2;
    color: #0a7a55;
  }

  .ia-tag.gold {
    background: #fff7e9;
    color: #bb7b12;
  }

  .ia-tag.teal {
    background: #eefaf8;
    color: #0e7c73;
  }

  .ia-tag.blue {
    background: #eff5ff;
    color: #2a68c3;
  }

  .ia-tag.purple {
    background: #f4efff;
    color: #7a46cc;
  }

  .ia-tag.rose {
    background: #fff0f5;
    color: #c24772;
  }

  .ia-status.verified {
    background: #e9f9ef;
    color: #0a7a55;
  }

  .ia-status.pending {
    background: #fff5e8;
    color: #b97a12;
  }

  .ia-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ia-action {
    border: 0;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 800;
    flex: 1;
  }

  .ia-action.edit {
    background: #277bd2;
    color: white;
  }

  .ia-action.delete {
    background: #d94747;
    color: white;
  }

  .ia-week-summary {
    margin-top: 18px;
    border-top: 1px solid #eef3f6;
    padding-top: 18px;
  }

  .ia-week-summary-head {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .ia-week-summary-head h3 {
    margin: 0;
    color: #0a7a55;
    font-size: 18px;
  }

  .ia-week-summary-head p {
    margin: 4px 0 0;
    color: #718396;
    font-size: 13px;
  }

  .ia-week-summary-head strong {
    color: #6b7d90;
    font-size: 13px;
  }

  .ia-week-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px;
  }

  .ia-week-card {
    border: 1px solid #e6edf2;
    border-radius: 14px;
    padding: 12px;
    background: #fff;
  }

  .ia-week-top {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
  }

  .ia-week-top span {
    font-size: 17px;
  }

  .ia-week-top strong {
    font-size: 12px;
  }

  .ia-week-numbers {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin: 10px 0 8px;
  }

  .ia-week-numbers span {
    font-size: 12px;
    color: #687b8f;
  }

  .ia-week-numbers strong {
    font-size: 14px;
    color: #173047;
  }

  .ia-progress {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: #dfe7ec;
    overflow: hidden;
  }

  .ia-progress-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
  }

  .ia-progress-fill.green {
    background: linear-gradient(90deg, #19b67e, #0b8b61);
  }

  .ia-progress-fill.gold {
    background: linear-gradient(90deg, #f5bf4a, #d89614);
  }

  .ia-progress-fill.teal {
    background: linear-gradient(90deg, #4ec7c0, #1b9f97);
  }

  .ia-progress-fill.blue {
    background: linear-gradient(90deg, #5da3ff, #2a68c3);
  }

  .ia-progress-fill.purple {
    background: linear-gradient(90deg, #ae7aff, #7a46cc);
  }

  .ia-progress-fill.rose {
    background: linear-gradient(90deg, #ff8ab4, #d4527e);
  }

  .ia-footer {
    padding: 26px 0 10px;
    text-align: center;
    color: #8b9aa8;
    font-size: 12px;
  }

  @media (max-width: 1320px) {
    .ia-profile-strip {
      grid-template-columns: 1fr;
    }

    .ia-profile-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .ia-main-grid {
      grid-template-columns: 1fr;
    }

    .ia-week-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 1024px) {
    .ia-topbar {
      height: auto;
      padding: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .ia-nav {
      order: 3;
      width: 100%;
      flex-wrap: wrap;
    }

    .ia-content {
      padding: 18px;
    }

    .ia-hero h1 {
      font-size: 36px;
    }

    .ia-profile-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ia-history-item {
      grid-template-columns: 76px minmax(0, 1fr);
    }

    .ia-history-side {
      grid-column: 1 / -1;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: center;
    }

    .ia-week-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .ia-content {
      padding: 14px;
    }

    .ia-hero h1 {
      font-size: 30px;
    }

    .ia-hero p {
      font-size: 14px;
    }

    .ia-profile-left {
      flex-direction: column;
      align-items: flex-start;
    }

    .ia-profile-avatar {
      width: 82px;
      height: 82px;
      font-size: 34px;
    }

    .ia-profile-copy h2 {
      font-size: 22px;
    }

    .ia-profile-stats {
      grid-template-columns: 1fr;
    }

    .ia-card {
      padding: 14px;
    }

    .ia-distance-grid {
      grid-template-columns: 1fr;
    }

    .ia-history-item {
      grid-template-columns: 1fr;
    }

    .ia-history-date {
      border-right: 0;
      border-bottom: 1px solid #eef3f6;
      padding-right: 0;
      padding-bottom: 10px;
      justify-items: flex-start;
      text-align: left;
    }

    .ia-history-side {
      grid-template-columns: 1fr;
    }

    .ia-week-grid {
      grid-template-columns: 1fr;
    }

    .ia-form-actions {
      flex-direction: column;
    }

    .ia-primary,
    .ia-secondary {
      width: 100%;
    }
  }

  @media print {
    .ia-topbar,
    .ia-form-actions,
    .ia-actions {
      display: none !important;
    }

    .ia-content {
      max-width: none;
      padding: 0;
    }

    .ia-card,
    .ia-profile-left,
    .ia-profile-stats {
      box-shadow: none;
    }
  }
`;
