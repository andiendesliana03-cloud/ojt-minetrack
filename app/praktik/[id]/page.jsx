
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// PENILAIAN PRAKTIK MINGGUAN
//
// UPDATE:
// Dropdown 7 Materi Praktik
//
// FITUR DIPERTAHANKAN:
// - Admin dan Mentor
// - Pemilihan peserta
// - Input nilai 0–100
// - Edit penilaian
// - Hapus penilaian
// - Refresh
// - Riwayat dan pencarian
// - Rata-rata nilai
// - Supabase database asli
// ======================================================

// ======================================================
// DAFTAR MATERI PRAKTIK
// ======================================================

const PRACTICE_MATERIALS = [
  "Ektrikasi",
  "CPR & AED",
  "Patient Assesment",
  "Spinal Immobilition",
  "Simpul Dasar, System MA Hauling, dan Lowring",
  "SCBA",
  "TOG",
];

// ======================================================
// STYLE DASAR
// ======================================================

const CARD = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 20,
  marginBottom: 16,
};

const INPUT = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: "12px",
  fontSize: 16,
  background: "#fff",
  color: "#0f172a",
  fontFamily: "inherit",
};

const BUTTON = {
  border: "none",
  borderRadius: 10,
  background: "#0f8a62",
  color: "#fff",
  padding: "12px 16px",
  fontWeight: 800,
  cursor: "pointer",
};

// ======================================================
// HELPER
// ======================================================

function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((p) => p.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) {
    return String(value);
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatScore(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function getAverage(rows) {
  const values = rows
    .map((row) => row.score)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

// ======================================================
// PERHITUNGAN WEEK ASLI
// TIDAK DIUBAH
// ======================================================

function getWeek(dateValue, startValue) {
  if (!dateValue || !startValue) return null;

  const date = Date.parse(
    `${String(dateValue).slice(0, 10)}T00:00:00Z`
  );

  const start = Date.parse(
    `${String(startValue).slice(0, 10)}T00:00:00Z`
  );

  if (
    !Number.isFinite(date) ||
    !Number.isFinite(start)
  ) {
    return null;
  }

  const week =
    Math.floor((date - start) / 604800000) + 1;

  return week >= 1 && week <= 25
    ? week
    : null;
}

function participantOf(program) {
  if (!program) return null;

  return Array.isArray(program.peserta)
    ? program.peserta[0]
    : program.peserta;
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function PraktikMingguanPage() {
  const router = useRouter();
  const params = useParams();

  const initialProgramId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [profile, setProfile] = useState(null);

  const [programs, setPrograms] = useState([]);

  const [
    selectedProgramId,
    setSelectedProgramId,
  ] = useState(initialProgramId || "");

  const [records, setRecords] = useState([]);

  const [loading, setLoading] = useState(true);

  const [
    loadingRecords,
    setLoadingRecords,
  ] = useState(false);

  const [saving, setSaving] = useState(false);

  const [actionId, setActionId] = useState(null);

  // ====================================================
  // FORM PENILAIAN
  // ====================================================

  const [practiceDate, setPracticeDate] = useState(today());

  const [practiceName, setPracticeName] = useState("");

  const [score, setScore] = useState("");

  const [notes, setNotes] = useState("");

  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  // ====================================================
  // HAK AKSES
  // ====================================================

  const role = String(
    profile?.role || ""
  ).toLowerCase();

  const isAdmin = role === "admin";

  const isMentor = role === "mentor";

  const canManage = isAdmin || isMentor;

  const selectedProgram = programs.find(
    (item) =>
      String(item.id) === String(selectedProgramId)
  );

  const participant = participantOf(selectedProgram);

  const participantName =
    participant?.full_name || "Peserta OJT";

  const week = getWeek(
    practiceDate,
    selectedProgram?.start_date
  );

  // ====================================================
  // PILIHAN DROPDOWN
  //
  // Materi baru menggunakan 7 pilihan resmi.
  // Jika data lama memiliki nama yang berbeda,
  // pilihan tersebut tetap tersedia saat Edit.
  // ====================================================

  const materialOptions = useMemo(() => {
    const options = [...PRACTICE_MATERIALS];

    const currentName = practiceName.trim();

    if (
      editId &&
      currentName &&
      !options.includes(currentName)
    ) {
      options.push(currentName);
    }

    return options;
  }, [practiceName, editId]);

  // ====================================================
  // FILTER RIWAYAT
  // ====================================================

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return records.filter((item) => {
      if (!keyword) return true;

      return [
        item.practice_name,
        item.notes,
        item.practice_date,
      ]
        .map((value) =>
          String(value || "").toLowerCase()
        )
        .some((value) => value.includes(keyword));
    });
  }, [records, search]);

  // ====================================================
  // RINGKASAN NILAI
  // ====================================================

  const average = useMemo(
    () => getAverage(records),
    [records]
  );

  const scoredCount = records.filter(
    (item) =>
      item.score !== null &&
      item.score !== undefined &&
      Number.isFinite(Number(item.score))
  ).length;

  const selectedWeekRecords = useMemo(() => {
    if (!selectedProgram) return [];

    return records.filter(
      (item) =>
        getWeek(
          item.practice_date,
          selectedProgram.start_date
        ) === week
    );
  }, [records, selectedProgram, week]);

  const selectedWeekAverage = getAverage(
    selectedWeekRecords
  );

  // ====================================================
  // LOAD PROGRAM PESERTA
  // ====================================================

  const loadPrograms = useCallback(async () => {
    const {
      data: auth,
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !auth?.user) {
      router.replace("/login");
      return null;
    }

    const userId = auth.user.id;

    const profileResult = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", userId)
      .single();

    if (profileResult.error) {
      throw profileResult.error;
    }

    const currentRole = String(
      profileResult.data?.role || ""
    ).toLowerCase();

    if (
      !["admin", "mentor"].includes(currentRole)
    ) {
      throw new Error(
        "Halaman Praktik Mingguan hanya dapat diakses Admin atau Mentor."
      );
    }

    let query = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
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
      .order("start_date", {
        ascending: false,
      });

    if (currentRole === "mentor") {
      query = query.eq("mentor_id", userId);
    }

    const programResult = await query;

    if (programResult.error) {
      throw programResult.error;
    }

    return {
      profile: profileResult.data,
      programs: programResult.data || [],
    };
  }, [router]);

  // ====================================================
  // RELOAD PENILAIAN
  // ====================================================

  const reloadRecords = useCallback(
    async (programId) => {
      if (!programId) {
        setRecords([]);
        return;
      }

      const {
        data,
        error: queryError,
      } = await supabase
        .from("weekly_practice_scores")
        .select(`
          id,
          program_id,
          practice_date,
          practice_name,
          score,
          notes,
          created_at
        `)
        .eq("program_id", programId)
        .order("practice_date", {
          ascending: false,
        });

      if (queryError) throw queryError;

      setRecords(data || []);
    },
    []
  );

  // ====================================================
  // INISIALISASI
  // ====================================================

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const result = await loadPrograms();

        if (!result || !active) return;

        setProfile(result.profile);

        setPrograms(result.programs);

        const initialExists = result.programs.some(
          (item) =>
            String(item.id) ===
            String(initialProgramId)
        );

        const firstActive = result.programs.find(
          (item) => item.status === "active"
        );

        const initialSelection = initialExists
          ? initialProgramId
          : firstActive?.id ||
            result.programs[0]?.id ||
            "";

        setSelectedProgramId(initialSelection);
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Gagal memuat program OJT."
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
  }, [initialProgramId, loadPrograms]);

  // ====================================================
  // MUAT RIWAYAT PESERTA
  // ====================================================

  useEffect(() => {
    let active = true;

    async function load() {
      setRecords([]);
      setError("");
      setMessage("");
      setLoadingRecords(true);

      if (!selectedProgramId) {
        setLoadingRecords(false);
        return;
      }

      if (
        !programs.some(
          (item) =>
            String(item.id) ===
            String(selectedProgramId)
        )
      ) {
        setError("Program tidak dapat diakses.");
        setLoadingRecords(false);
        return;
      }

      try {
        const {
          data,
          error: queryError,
        } = await supabase
          .from("weekly_practice_scores")
          .select(`
            id,
            program_id,
            practice_date,
            practice_name,
            score,
            notes,
            created_at
          `)
          .eq("program_id", selectedProgramId)
          .order("practice_date", {
            ascending: false,
          });

        if (queryError) throw queryError;

        if (active) {
          setRecords(data || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Gagal memuat nilai praktik."
          );
        }
      } finally {
        if (active) {
          setLoadingRecords(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [selectedProgramId, programs]);

  // ====================================================
  // RESET FORM
  // ====================================================

  function resetForm() {
    setEditId(null);
    setPracticeDate(today());
    setPracticeName("");
    setScore("");
    setNotes("");
  }

  // ====================================================
  // PILIH PROGRAM
  // ====================================================

  function selectProgram(programId) {
    if (saving || actionId) return;

    if (
      !programs.some(
        (item) =>
          String(item.id) === String(programId)
      )
    ) {
      setError(
        "Peserta tidak tersedia untuk akun ini."
      );
      return;
    }

    setSelectedProgramId(programId);
    setSearch("");
    resetForm();

    router.replace(`/praktik/${programId}`);
  }

  // ====================================================
  // EDIT RIWAYAT
  // ====================================================

  function editRecord(item) {
    if (!canManage || saving || actionId) return;

    setEditId(item.id);

    setPracticeDate(
      item.practice_date || today()
    );

    // Materi lama tetap dapat diedit.
    setPracticeName(item.practice_name || "");

    setScore(
      item.score == null
        ? ""
        : String(item.score)
    );

    setNotes(item.notes || "");

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ====================================================
  // SIMPAN NILAI
  // ====================================================

  async function saveRecord(event) {
    event.preventDefault();

    if (
      !canManage ||
      !selectedProgram ||
      saving ||
      actionId ||
      loadingRecords
    ) {
      return;
    }

    const numericScore = Number(score);

    if (!practiceDate) {
      setError(
        "Tanggal praktik wajib diisi."
      );
      return;
    }

    if (
      getWeek(
        practiceDate,
        selectedProgram.start_date
      ) === null
    ) {
      setError(
        "Tanggal harus berada pada Week 01–25 program OJT."
      );
      return;
    }

    if (
      selectedProgram.end_date &&
      practiceDate > selectedProgram.end_date
    ) {
      setError(
        "Tanggal praktik melewati akhir periode OJT."
      );
      return;
    }

    if (!practiceName.trim()) {
      setError(
        "Materi Praktik wajib dipilih."
      );
      return;
    }

    // Pastikan materi baru berasal dari dropdown.
    // Saat edit, materi lama yang sudah tersimpan
    // tetap dapat digunakan.
    const isOfficialMaterial =
      PRACTICE_MATERIALS.includes(
        practiceName.trim()
      );

    const previousRecord = editId
      ? records.find(
          (item) => item.id === editId
        )
      : null;

    const isExistingLegacyMaterial =
      Boolean(editId) &&
      Boolean(previousRecord) &&
      previousRecord.practice_name ===
        practiceName.trim();

    if (
      !isOfficialMaterial &&
      !isExistingLegacyMaterial
    ) {
      setError(
        "Pilih salah satu materi Praktik dari daftar dropdown."
      );
      return;
    }

    if (
      score.trim() === "" ||
      !Number.isFinite(numericScore) ||
      numericScore < 0 ||
      numericScore > 100
    ) {
      setError(
        "Nilai praktik harus berada antara 0–100."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        practice_date: practiceDate,
        practice_name: practiceName.trim(),
        score: numericScore,
        notes: notes.trim() || null,
      };

      const result = editId
        ? await supabase
            .from("weekly_practice_scores")
            .update(payload)
            .eq("id", editId)
            .eq("program_id", selectedProgramId)
            .select("id")
        : await supabase
            .from("weekly_practice_scores")
            .insert({
              ...payload,
              program_id: selectedProgramId,
              created_by: profile.id,
            })
            .select("id");

      if (result.error) {
        throw result.error;
      }

      if (!result.data?.length) {
        throw new Error(
          "Data tidak berhasil disimpan. Periksa kebijakan akses database."
        );
      }

      await reloadRecords(selectedProgramId);

      const wasEditing = Boolean(editId);

      resetForm();

      setMessage(
        wasEditing
          ? "Perubahan nilai praktik berhasil disimpan."
          : "Nilai praktik berhasil disimpan."
      );
    } catch (err) {
      setError(
        err.message ||
          "Gagal menyimpan nilai praktik."
      );
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // HAPUS PENILAIAN
  // ====================================================

  async function deleteRecord(item) {
    if (
      !canManage ||
      saving ||
      actionId ||
      !selectedProgram
    ) {
      return;
    }

    if (
      !window.confirm(
        `Hapus penilaian praktik "${item.practice_name}"?`
      )
    ) {
      return;
    }

    setActionId(item.id);
    setError("");
    setMessage("");

    try {
      const {
        data,
        error: deleteError,
      } = await supabase
        .from("weekly_practice_scores")
        .delete()
        .eq("id", item.id)
        .eq("program_id", selectedProgramId)
        .select("id");

      if (deleteError) {
        throw deleteError;
      }

      if (!data?.length) {
        throw new Error(
          "Nilai tidak terhapus. Periksa kebijakan akses database."
        );
      }

      if (editId === item.id) {
        resetForm();
      }

      await reloadRecords(selectedProgramId);

      setMessage(
        "Nilai praktik berhasil dihapus."
      );
    } catch (err) {
      setError(
        err.message ||
          "Gagal menghapus nilai praktik."
      );
    } finally {
      setActionId(null);
    }
  }

  // ====================================================
  // REFRESH
  // ====================================================

  async function refresh() {
    if (
      !selectedProgramId ||
      saving ||
      actionId ||
      loadingRecords
    ) {
      return;
    }

    setLoadingRecords(true);
    setError("");
    setMessage("");

    try {
      await reloadRecords(selectedProgramId);

      setMessage(
        "Data praktik berhasil diperbarui."
      );
    } catch (err) {
      setError(
        err.message ||
          "Gagal memperbarui data."
      );
    } finally {
      setLoadingRecords(false);
    }
  }

  // ====================================================
  // TAMPILAN LOADING
  // ====================================================

  if (loading) {
    return (
      <main className="pm-loading">
        Memuat Praktik Mingguan OJT...
      </main>
    );
  }

  // ====================================================
  // TAMPILAN AKSES DITOLAK
  // ====================================================

  if (!profile || !canManage) {
    return (
      <main className="pm-loading">
        <h2>
          Praktik Mingguan Tidak Dapat Dibuka
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
      </main>
    );
  }

  // ====================================================
  // TAMPILAN UTAMA
  // ====================================================

  return (
    <main className="pm-root">
      <style>{css}</style>

      {/* HEADER */}

      <header className="pm-header">
        <h2>
          OJT <span>MineTrack</span>
        </h2>

        <button
          type="button"
          className="pm-btn secondary"
          onClick={() =>
            router.push(
              selectedProgramId
                ? `/peserta/${selectedProgramId}`
                : "/"
            )
          }
        >
          ← Detail Peserta
        </button>
      </header>

      <div className="pm-container">
        {/* BANNER */}

        <section className="pm-banner">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Penilaian Praktik Mingguan</h1>

          <p>
            Pengelola:{" "}
            {isAdmin ? "Administrator" : "Mentor"}
          </p>

          <p>
            Input, monitoring, dan evaluasi
            keterampilan praktik peserta OJT.
          </p>
        </section>

        {/* NOTIFIKASI */}

        {error && (
          <div
            className="pm-alert error"
            role="alert"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            className="pm-alert success"
            role="status"
          >
            ✓ {message}
          </div>
        )}

        {/* PILIH PESERTA */}

        <section className="pm-card">
          <h2>Pilih Peserta OJT</h2>

          <div className="pm-field">
            <label
              className="pm-label"
              htmlFor="pm-program"
            >
              Peserta / Program
            </label>

            <select
              id="pm-program"
              className="pm-input"
              value={selectedProgramId}
              onChange={(event) =>
                selectProgram(event.target.value)
              }
              disabled={
                saving ||
                !!actionId ||
                loadingRecords
              }
            >
              {!programs.length && (
                <option value="">
                  Tidak ada program
                </option>
              )}

              {programs.map((item) => {
                const currentParticipant =
                  participantOf(item);

                return (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {currentParticipant?.full_name ||
                      "Peserta OJT"}
                    {" · "}
                    {item.site || "Tanpa Site"}
                    {" · "}
                    {item.status === "active"
                      ? "Aktif"
                      : "Tidak Aktif"}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedProgram ? (
            <div className="pm-participant">
              <strong>{participantName}</strong>

              <p className="pm-muted">
                Departemen:{" "}
                {participant?.department || "—"}
              </p>

              <p className="pm-muted">
                Site:{" "}
                {selectedProgram.site || "—"}
              </p>

              <p className="pm-muted">
                Periode OJT:{" "}
                {formatDate(
                  selectedProgram.start_date
                )}
                {" – "}
                {formatDate(
                  selectedProgram.end_date
                )}
              </p>
            </div>
          ) : (
            <p className="pm-muted">
              Belum ada program yang dapat dipilih.
            </p>
          )}
        </section>

        {selectedProgram && (
          <>
            {/* RINGKASAN */}

            <div className="pm-stats">
              <div className="pm-stat">
                <small>
                  Total Penilaian
                </small>
                <strong>
                  {records.length}
                </strong>
              </div>

              <div className="pm-stat">
                <small>
                  Rata-rata Nilai
                </small>
                <strong>
                  {formatScore(average)}
                </strong>
              </div>

              <div className="pm-stat">
                <small>
                  Nilai Terisi
                </small>
                <strong>
                  {scoredCount}
                </strong>
              </div>
            </div>

            {/* FORM PENILAIAN */}

            <section className="pm-card">
              <h2>
                {editId
                  ? "Edit Penilaian Praktik"
                  : "Input Penilaian Praktik"}
              </h2>

              <p className="pm-muted">
                Pilih materi Praktik yang telah
                dilaksanakan, kemudian masukkan
                nilai pada skala 0–100.
              </p>

              <form onSubmit={saveRecord}>
                <div className="pm-grid">
                  <div className="pm-field">
                    <label
                      className="pm-label"
                      htmlFor="pm-date"
                    >
                      Tanggal Praktik
                    </label>

                    <input
                      id="pm-date"
                      className="pm-input"
                      type="date"
                      value={practiceDate}
                      onChange={(event) =>
                        setPracticeDate(
                          event.target.value
                        )
                      }
                      required
                    />

                    <p className="pm-muted">
                      {week
                        ? `Week ${String(
                            week
                          ).padStart(2, "0")}`
                        : "Tanggal di luar Week 01–25"}
                    </p>
                  </div>

                  <div className="pm-field">
                    <label
                      className="pm-label"
                      htmlFor="pm-score"
                    >
                      Nilai Praktik (0–100)
                    </label>

                    <input
                      id="pm-score"
                      className="pm-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={score}
                      onChange={(event) =>
                        setScore(
                          event.target.value
                        )
                      }
                      placeholder="Contoh: 85"
                      required
                    />
                  </div>
                </div>

                {/* DROPDOWN MATERI PRAKTIK */}

                <div className="pm-field">
                  <label
                    className="pm-label"
                    htmlFor="pm-name"
                  >
                    Pilih Materi Praktik
                  </label>

                  <select
                    id="pm-name"
                    className="pm-input"
                    value={practiceName}
                    onChange={(event) =>
                      setPracticeName(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      -- Pilih Materi Praktik --
                    </option>

                    {materialOptions.map(
                      (material) => (
                        <option
                          key={material}
                          value={material}
                        >
                          {material}
                        </option>
                      )
                    )}
                  </select>

                  <p className="pm-muted">
                    Tersedia 7 materi Praktik
                    sesuai daftar pembelajaran OJT.
                  </p>
                </div>

                {/* CATATAN */}

                <div className="pm-field">
                  <label
                    className="pm-label"
                    htmlFor="pm-notes"
                  >
                    Catatan Penilaian
                  </label>

                  <textarea
                    id="pm-notes"
                    className="pm-input"
                    rows={3}
                    value={notes}
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    placeholder="Catatan pelaksanaan praktik..."
                  />
                </div>

                {/* TOMBOL SIMPAN */}

                <div className="pm-actions">
                  <button
                    type="submit"
                    className="pm-btn"
                    disabled={
                      saving ||
                      !!actionId ||
                      loadingRecords
                    }
                  >
                    {saving
                      ? "Menyimpan..."
                      : editId
                      ? "Simpan Perubahan"
                      : "Simpan Nilai Praktik"}
                  </button>

                  {editId && (
                    <button
                      type="button"
                      className="pm-btn secondary"
                      onClick={resetForm}
                      disabled={saving}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* MONITORING NILAI */}

            <section className="pm-card">
              <h2>
                Monitoring Penilaian Praktik
              </h2>

              <div className="pm-grid">
                <div>
                  <p className="pm-muted">
                    Rata-rata nilai untuk minggu
                    pada tanggal formulir.
                  </p>

                  <div className="pm-score">
                    {formatScore(
                      selectedWeekAverage
                    )}
                  </div>
                </div>

                <div>
                  <p className="pm-muted">
                    Jumlah penilaian pada minggu
                    tersebut.
                  </p>

                  <div className="pm-score">
                    {week === null
                      ? "—"
                      : selectedWeekRecords.length}
                  </div>
                </div>
              </div>
            </section>

            {/* RIWAYAT */}

            <section className="pm-card">
              <div className="pm-heading">
                <h2>
                  Riwayat Penilaian Praktik
                </h2>

                <button
                  type="button"
                  className="pm-btn secondary"
                  onClick={refresh}
                  disabled={
                    loadingRecords ||
                    saving ||
                    !!actionId
                  }
                >
                  {loadingRecords
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <div className="pm-field">
                <label
                  className="pm-label"
                  htmlFor="pm-search"
                >
                  Cari Penilaian
                </label>

                <input
                  id="pm-search"
                  className="pm-input"
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Cari materi, catatan, atau tanggal..."
                />
              </div>

              {loadingRecords && (
                <p className="pm-muted">
                  Memuat riwayat praktik...
                </p>
              )}

              {!loadingRecords &&
                !filteredRecords.length && (
                  <p className="pm-muted">
                    Belum ada penilaian praktik
                    yang sesuai.
                  </p>
                )}

              {!loadingRecords &&
                filteredRecords.map(
                  (item) => (
                    <article
                      className="pm-record"
                      key={item.id}
                    >
                      <div className="pm-record-header">
                        <div>
                          <h3>
                            {item.practice_name ||
                              "Praktik OJT"}
                          </h3>

                          <p className="pm-muted">
                            Tanggal:{" "}
                            {formatDate(
                              item.practice_date
                            )}
                            {" · "}
                            Week{" "}
                            {String(
                              getWeek(
                                item.practice_date,
                                selectedProgram.start_date
                              ) || "—"
                            ).padStart(2, "0")}
                          </p>
                        </div>

                        <div className="pm-score">
                          {formatScore(
                            item.score
                          )}
                        </div>
                      </div>

                      {item.notes && (
                        <p className="pm-record-notes">
                          {item.notes}
                        </p>
                      )}

                      <div className="pm-actions">
                        <button
                          type="button"
                          className="pm-btn blue"
                          disabled={
                            saving || !!actionId
                          }
                          onClick={() =>
                            editRecord(item)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="pm-btn red"
                          disabled={
                            saving || !!actionId
                          }
                          onClick={() =>
                            deleteRecord(item)
                          }
                        >
                          {actionId === item.id
                            ? "Menghapus..."
                            : "Hapus"}
                        </button>
                      </div>
                    </article>
                  )
                )}
            </section>
          </>
        )}

        <footer className="pm-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group · PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// ======================================================
// CSS
// ======================================================

const css = `
.pm-root,
.pm-root * {
  box-sizing: border-box;
}

.pm-root {
  min-height: 100vh;
  background: #f1f5f4;
  color: #17352e;
  font-family: Arial, Helvetica, sans-serif;
  padding-bottom: 30px;
}

.pm-loading {
  padding: 25px;
  min-height: 100vh;
  background: #f1f5f4;
  color: #17352e;
  font-family: Arial, sans-serif;
}

.pm-header {
  background: #071e25;
  color: white;
  padding: 18px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pm-header h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 900;
}

.pm-header h2 span {
  color: #2dcc94;
}

.pm-container {
  width: 100%;
  max-width: 1060px;
  padding: 16px;
  margin: auto;
}

.pm-banner {
  padding: 25px;
  background:
    linear-gradient(110deg,#07242b,#086144);
  color: white;
  border-radius: 17px;
  margin-bottom: 16px;
}

.pm-banner small {
  color: #f1c76b;
  font-weight: 900;
  letter-spacing: 1px;
  font-size: 10px;
}

.pm-banner h1 {
  margin: 12px 0;
  font-size: 26px;
}

.pm-banner p {
  color: #d1ebe1;
  font-size: 12px;
  line-height: 1.6;
}

.pm-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 15px #123c3010;
}

.pm-card h2 {
  margin: 0 0 15px;
  font-size: 18px;
}

.pm-label {
  display: block;
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 7px;
}

.pm-field {
  margin-bottom: 16px;
}

.pm-input {
  width: 100%;
  min-width: 0;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 12px;
  background: white;
  color: #0f172a;
  font-size: 16px;
  font-family: inherit;
}

.pm-input:focus {
  outline: 2px solid #83d2af;
  outline-offset: 1px;
}

.pm-grid {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  gap: 15px;
}

.pm-stats {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.pm-stat {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  padding: 16px;
  text-align: center;
}

.pm-stat small {
  color: #64748b;
  font-size: 11px;
  line-height: 1.6;
}

.pm-stat strong {
  display: block;
  color: #087f5b;
  font-size: 24px;
  margin-top: 8px;
}

.pm-btn {
  border: 0;
  border-radius: 10px;
  background: #0f8a62;
  color: white;
  padding: 12px 15px;
  font-weight: 800;
  cursor: pointer;
  font-family: inherit;
}

.pm-btn:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.pm-btn.secondary {
  background: #e3f3eb;
  color: #106949;
}

.pm-btn.blue {
  background: #2874b8;
}

.pm-btn.red {
  background: #d13f48;
}

.pm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pm-alert {
  border-radius: 10px;
  padding: 13px;
  margin-bottom: 15px;
  font-size: 13px;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.pm-alert.error {
  color: #b91c1c;
  background: #fff0f0;
}

.pm-alert.success {
  color: #08784d;
  background: #e4f7eb;
}

.pm-participant {
  background: #f0f9f4;
  padding: 14px;
  border-radius: 12px;
}

.pm-participant strong {
  font-size: 15px;
}

.pm-muted {
  color: #72867d;
  font-size: 12px;
  line-height: 1.6;
}

.pm-score {
  font-size: 23px;
  font-weight: 900;
  color: #0c875c;
}

.pm-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.pm-heading h2 {
  margin: 0;
}

.pm-record {
  padding: 16px;
  border: 1px solid #e1eae5;
  border-radius: 12px;
  margin-top: 12px;
}

.pm-record-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.pm-record h3 {
  margin: 0 0 9px;
  font-size: 15px;
  overflow-wrap: anywhere;
}

.pm-record-notes {
  color: #72867d;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.pm-footer {
  text-align: center;
  color: #839a90;
  font-size: 11px;
  padding: 20px;
}

@media (max-width: 700px) {
  .pm-container {
    padding: 11px;
  }

  .pm-banner {
    padding: 19px;
  }

  .pm-banner h1 {
    font-size: 22px;
  }

  .pm-card {
    padding: 15px;
  }

  .pm-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .pm-stat {
    padding: 10px 6px;
  }

  .pm-stat strong {
    font-size: 19px;
  }

  .pm-header {
    padding: 15px;
  }

  .pm-header h2 {
    font-size: 18px;
  }
}
`;
