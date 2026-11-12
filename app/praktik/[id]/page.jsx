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
// - Dropdown 7 Materi Praktik
// - Akses peserta aktif/disetujui ke programnya sendiri
// - Kalender Week global, tidak relatif ke tanggal mulai peserta
// - Alur pengajuan Pending dan verifikasi tetap dipertahankan
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
// - Nilai pengajuan Peserta + evidence wajib
// - Verifikasi nilai terpisah oleh Mentor/Admin
// - Nilai pending tidak dihitung pada rata-rata
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
// DOKUMENTASI PRAKTIK (METADATA DI KOLOM notes)
// Tidak membuat kolom ataupun tabel baru.
// Backup otomatis ke Google Drive untuk Praktik memerlukan
// perluasan Edge Function + webhook Praktik secara terpisah.
// ======================================================

const PRACTICE_BUCKET = "achievement-files";
const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg", "image/png", "image/webp", "application/pdf",
];
const FILE_METADATA_REGEX = /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g;
const REVIEW_METADATA_REGEX = /\[\[OJT_PRACTICE_REVIEW_V1:([\s\S]*?)\]\]/g;

// Metadata pengajuan skor Peserta disimpan di notes.
// Kolom score hanya menyimpan nilai resmi setelah verifikasi Mentor/Admin.
// Hal ini mempertahankan perhitungan nilai lama tanpa mengubah schema.
function parsePracticeNotes(raw) {
  let evidence = null;
  let review = null;
  const withoutFile = String(raw || "").replace(
    FILE_METADATA_REGEX,
    (_match, encoded) => {
      try {
        const data = JSON.parse(decodeURIComponent(encoded));
        if (typeof data?.path === "string" && data.path.trim()) {
          evidence = {
            name: String(data.name || "Dokumentasi Praktik"),
            path: data.path.trim(),
          };
        }
      } catch {
        // Metadata rusak tidak ditampilkan sebagai teks.
      }
      return "";
    }
  );
  const text = withoutFile.replace(
    REVIEW_METADATA_REGEX,
    (_match, encoded) => {
      try {
        const data = JSON.parse(decodeURIComponent(encoded));
        const score = Number(data?.submittedScore);
        if (
          data && typeof data === "object" &&
          ["pending", "verified"].includes(data.status) &&
          Number.isFinite(score) && score >= 0 && score <= 100
        ) {
          review = { ...data, submittedScore: score };
        }
      } catch {
        // Metadata rusak tetap tidak ditampilkan sebagai teks.
      }
      return "";
    }
  );
  return { text: text.trim(), evidence, review };
}

function composePracticeNotes(text, evidence, review = null) {
  const pieces = [];
  const description = String(text || "").trim();
  if (description) pieces.push(description);
  if (evidence?.path) {
    const meta = encodeURIComponent(JSON.stringify({
      name: evidence.name,
      path: evidence.path,
    }));
    pieces.push(`[[OJT_FILE_V1:${meta}]]`);
  }
  if (review) {
    const meta = encodeURIComponent(JSON.stringify(review));
    pieces.push(`[[OJT_PRACTICE_REVIEW_V1:${meta}]]`);
  }
  return pieces.join("\n") || null;
}

function safeUploadName(value) {
  return String(value || "dokumentasi.jpg")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-95) || "dokumentasi.jpg";
}

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
    .filter((row) => parsePracticeNotes(row.notes).review?.status !== "pending")
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
// KALENDER GLOBAL OJT MINETRACK (ASIA/MAKASSAR)
// Week 01: 12-18 Sep 2026
// 19 Sep: jeda, di luar Week
// Week 02: 20-26 Sep 2026
// Week 09: 08-14 Nov 2026
// Week 25: 28 Feb-06 Mar 2027
// Tanggal sebelum peserta mulai OJT tetap tidak diizinkan.
// ======================================================

function getWeek(dateValue, startValue) {
  const day = String(dateValue || "").slice(0, 10);
  const personalStart = String(startValue || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const ms = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== day) {
    return null;
  }

  if (personalStart && day < personalStart) return null;
  if (day < "2026-09-12" || day > "2027-03-06" || day === "2026-09-19") {
    return null;
  }
  if (day <= "2026-09-18") return 1;

  const weekTwoStart = Date.parse("2026-09-20T00:00:00Z");
  const week = Math.floor((ms - weekTwoStart) / 604800000) + 2;
  return week >= 2 && week <= 25 ? week : null;
}

function isActiveOJTStatus(status) {
  return ["active", "approved"].includes(String(status || "").trim().toLowerCase());
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

  // Dokumentasi bisa diunggah Peserta atau Mentor.
  const [documentFile, setDocumentFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [openingEvidenceId, setOpeningEvidenceId] = useState(null);

  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  // ====================================================
  // HAK AKSES
  // ====================================================

  const role = String(
    profile?.role || ""
  ).trim().toLowerCase();

  const isAdmin = role === "admin";

  const isMentor = role === "mentor";

  const isParticipant = ["participant", "peserta"].includes(role);

  // Peserta mengirim nilai pengajuan (0–100) dengan bukti wajib.
  // Mentor/Admin memverifikasi lalu menetapkan nilai resmi.
  // Angka pengajuan tidak langsung mempengaruhi nilai rata-rata.
  const canManage = isAdmin || isMentor;
  const canSubmit = isParticipant;
  const canUsePage = canManage || canSubmit;

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
        parsePracticeNotes(item.notes).text,
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
      parsePracticeNotes(item.notes).review?.status !== "pending" &&
      item.score !== null &&
      item.score !== undefined &&
      item.score !== "" &&
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
    ).trim().toLowerCase();

    if (
      !["admin", "mentor", "participant", "peserta"].includes(currentRole)
    ) {
      throw new Error("Akun tidak memiliki akses Praktik Mingguan.");
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
    } else if (["participant", "peserta"].includes(currentRole)) {
      // Wajib filter di database, bukan hanya dropdown UI.
      query = query.eq("participant_id", userId).in("status", ["active", "approved"]);
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
          (item) => isActiveOJTStatus(item.status)
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
        setError("Program tidak dapat diakses. Periksa akun peserta, status program OJT, dan kebijakan RLS Supabase.");
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
    setDocumentFile(null);
    setFileInputKey((value) => value + 1);
  }

  // ====================================================
  // PILIH PROGRAM
  // ====================================================

  function selectProgram(programId) {
    if (saving || actionId || isParticipant) return;

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

    const review = parsePracticeNotes(item.notes).review;
    setScore(
      item.score == null
        ? review ? String(review.submittedScore) : ""
        : String(item.score)
    );

    setNotes(parsePracticeNotes(item.notes).text);
    setDocumentFile(null);
    setFileInputKey((value) => value + 1);

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
      !canUsePage ||
      !selectedProgram ||
      saving || actionId || loadingRecords
    ) return;

    if (isParticipant && !isActiveOJTStatus(selectedProgram.status)) {
      setError("Penginputan hanya tersedia untuk program OJT aktif/disetujui.");
      return;
    }

    if (!practiceDate ||
        getWeek(practiceDate, selectedProgram.start_date) === null ||
        (selectedProgram.end_date && practiceDate > selectedProgram.end_date)) {
      setError("Tanggal harus berada pada Week global 01–25 dan periode OJT peserta.");
      return;
    }

    if (!practiceName.trim()) {
      setError("Materi Praktik wajib dipilih.");
      return;
    }

    const previousRecord = editId
      ? records.find((item) => item.id === editId)
      : null;
    const official = PRACTICE_MATERIALS.includes(practiceName.trim());
    const legacy = Boolean(canManage && editId && previousRecord &&
      previousRecord.practice_name === practiceName.trim());
    if (!official && !legacy) {
      setError("Pilih materi Praktik dari dropdown yang tersedia.");
      return;
    }

    // Peserta dan Mentor/Admin sama-sama wajib memasukkan angka.
    // Angka dari Peserta disimpan sebagai pengajuan, belum nilai resmi.
    const numericScore = Number(score);
    if (score.trim() === "" ||
        !Number.isFinite(numericScore) ||
        numericScore < 0 || numericScore > 100) {
      setError("Nilai praktik wajib diisi antara 0–100.");
      return;
    }

    const existingEvidence = previousRecord
      ? parsePracticeNotes(previousRecord.notes).evidence
      : null;
    if (!documentFile && !existingEvidence?.path) {
      setError("Dokumentasi Praktik wajib dilampirkan untuk setiap pengajuan baru atau perubahan nilai.");
      return;
    }

    if (documentFile && (
      documentFile.size > MAX_DOCUMENT_SIZE ||
      !ALLOWED_DOCUMENT_TYPES.includes(documentFile.type)
    )) {
      setError("Dokumentasi harus JPG, PNG, WEBP, atau PDF maksimal 5 MB.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    let uploadedPath = null;
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user || auth.user.id !== profile?.id) {
        throw new Error("Sesi akun tidak valid. Silakan login ulang.");
      }

      // Validasi ulang izin melalui program yang dibaca dari database.
      let ownershipQuery = supabase.from("ojt_programs")
        .select("id,status,participant_id,mentor_id")
        .eq("id", selectedProgramId);
      if (isParticipant) {
        ownershipQuery = ownershipQuery
          .eq("participant_id", auth.user.id)
          .in("status", ["active", "approved"]);
      } else if (isMentor) {
        ownershipQuery = ownershipQuery.eq("mentor_id", auth.user.id);
      }
      const { data: authorized, error: ownershipError } =
        await ownershipQuery.maybeSingle();
      if (ownershipError || !authorized?.id) {
        throw new Error("Akun tidak berhak mengisi program Praktik ini.");
      }

      let evidence = previousRecord
        ? parsePracticeNotes(previousRecord.notes).evidence
        : null;

      if (documentFile) {
        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        const fileName = safeUploadName(documentFile.name);
        const path = `${selectedProgramId}/praktik/${profile.id}/${uniqueId}-${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from(PRACTICE_BUCKET)
          .upload(path, documentFile, {
            upsert: false,
            contentType: documentFile.type,
          });
        if (uploadError) {
          throw new Error(`Upload dokumentasi gagal: ${uploadError.message}`);
        }
        uploadedPath = path;
        evidence = { name: documentFile.name, path };
      }

      if (!evidence?.path) {
        throw new Error("Dokumentasi Praktik wajib tersedia sebelum pengajuan dikirim untuk verifikasi.");
      }

      // Setiap input maupun perubahan nilai dari Peserta, Mentor, atau Admin
      // selalu kembali ke antrean Pending. Nilai resmi tetap null sampai
      // disetujui melalui proses verifikasi yang sudah tersedia.
      const review = {
        status: "pending",
        submittedScore: numericScore,
        submittedBy: profile.id,
        submittedAt: new Date().toISOString(),
        submittedByRole: role,
      };

      const payload = {
        practice_date: practiceDate,
        practice_name: practiceName.trim(),
        score: null,
        notes: composePracticeNotes(notes, evidence, review),
      };

      const result = canManage && editId
        ? await supabase.from("weekly_practice_scores")
          .update(payload)
          .eq("id", editId)
          .eq("program_id", selectedProgramId)
          .select("id")
        : await supabase.from("weekly_practice_scores")
          .insert({
            ...payload,
            program_id: selectedProgramId,
            created_by: profile.id,
          })
          .select("id");

      if (result.error) throw result.error;
      if (!result.data?.length) {
        throw new Error("Data tidak tersimpan. Periksa izin RLS Supabase.");
      }

      await reloadRecords(selectedProgramId);
      const wasEditing = Boolean(editId);
      resetForm();
      setMessage(
        `Pengajuan nilai Praktik ${numericScore} dan dokumentasi berhasil disimpan${wasEditing ? " kembali" : ""}. Status Pending dan menunggu verifikasi Admin/Mentor. Nilai belum masuk rata-rata resmi.`
      );
    } catch (err) {
      // Beri tahu jika file masuk ke Storage tetapi data gagal dicatat.
      const extra = uploadedPath
        ? " File telah terunggah, tetapi data penilaian belum tersimpan. Jangan mengunggah ulang berulang kali; periksa izin tabel."
        : "";
      setError((err?.message || "Gagal menyimpan Praktik.") + extra);
    } finally {
      setSaving(false);
    }
  }

  // Verifikasi eksplisit oleh Mentor/Admin. Nilai pengajuan tetap
  // disimpan dalam metadata supaya perbedaan nilai dapat dilihat.
  async function verifySubmittedScore(item) {
    if (!canManage || !selectedProgram || saving || actionId) return;
    const { evidence, review, text } = parsePracticeNotes(item.notes);
    if (!evidence?.path || review?.status !== "pending") {
      setError("Hanya laporan Pending dengan bukti yang dapat diverifikasi.");
      return;
    }
    const claimed = Number(review.submittedScore);
    if (!Number.isFinite(claimed) || claimed < 0 || claimed > 100) {
      setError("Nilai pengajuan tidak valid.");
      return;
    }
    if (!window.confirm(
      `Pastikan dokumentasi Praktik sudah diperiksa.\n\n` +
      `Setujui nilai pengajuan ${claimed} untuk ${item.practice_name}?\n\n` +
      `Jika nilai perlu dikoreksi, pilih Edit dan masukkan nilai hasil pemeriksaan.`
    )) return;

    setActionId(item.id);
    setError("");
    setMessage("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user || auth.user.id !== profile?.id) {
        throw new Error("Sesi akun tidak valid.");
      }
      let check = supabase.from("ojt_programs")
        .select("id")
        .eq("id", selectedProgramId);
      if (isMentor) check = check.eq("mentor_id", auth.user.id);
      const { data: authorized, error: checkError } = await check.maybeSingle();
      if (checkError || !authorized?.id) {
        throw new Error("Akun tidak memiliki izin verifikasi program ini.");
      }
      const approved = {
        ...review,
        status: "verified",
        approvedScore: claimed,
        reviewedBy: profile.id,
        reviewedAt: new Date().toISOString(),
      };
      const result = await supabase.from("weekly_practice_scores")
        .update({
          score: claimed,
          notes: composePracticeNotes(text, evidence, approved),
        })
        .eq("id", item.id)
        .eq("program_id", selectedProgramId)
        .is("score", null)
        .select("id");
      if (result.error) throw result.error;
      if (!result.data?.length) {
        throw new Error("Laporan telah diubah atau tidak dapat diverifikasi.");
      }
      await reloadRecords(selectedProgramId);
      setMessage("Nilai pengajuan telah diverifikasi oleh Mentor/Admin.");
    } catch (err) {
      setError(err?.message || "Verifikasi Praktik gagal.");
    } finally {
      setActionId(null);
    }
  }

  // Buka dokumentasi privat menggunakan signed URL Supabase.
  async function openEvidence(item) {
    const evidence = parsePracticeNotes(item.notes).evidence;
    if (!evidence?.path || openingEvidenceId !== null) return;
    setOpeningEvidenceId(item.id);
    setError("");
    const tab = window.open("about:blank", "_blank");
    try {
      const { data, error: signedError } = await supabase.storage
        .from(PRACTICE_BUCKET)
        .createSignedUrl(evidence.path, 600);
      if (signedError || !data?.signedUrl) {
        throw signedError || new Error("Tautan dokumentasi gagal dibuat.");
      }
      if (!tab || tab.closed) {
        throw new Error("Browser memblokir popup. Izinkan popup dokumentasi.");
      }
      tab.location.replace(data.signedUrl);
    } catch (err) {
      if (tab && !tab.closed) tab.close();
      setError(err?.message || "Dokumentasi tidak dapat dibuka.");
    } finally {
      setOpeningEvidenceId(null);
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

  if (!profile || !canUsePage) {
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
          onClick={() => router.push(
            isParticipant
              ? "/dashboard-peserta"
              : selectedProgramId
                ? `/peserta/${selectedProgramId}`
                : "/"
          )}
        >
          ← {isParticipant ? "Dashboard Peserta" : "Detail Peserta"}
        </button>
      </header>

      <div className="pm-container">
        {/* BANNER */}

        <section className="pm-banner">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>{isParticipant ? "Laporan Praktik Saya" : "Penilaian Praktik Mingguan"}</h1>

          <p>
            Pengelola:{" "}
            {isAdmin ? "Administrator" : isMentor ? "Mentor" : "Peserta OJT"}
          </p>

          <p>
            {isParticipant
              ? "Laporkan kegiatan dan dokumentasi. Nilai tetap diberikan Mentor."
              : "Input, monitoring, dan evaluasi keterampilan praktik peserta OJT."}
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
          <h2>{isParticipant ? "Program OJT Saya" : "Pilih Peserta OJT"}</h2>

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
                isParticipant ||
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
                    {isActiveOJTStatus(item.status)
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
                  {isParticipant ? "Total Laporan Praktik" : "Total Penilaian"}
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
                {isParticipant
                  ? "Kirim Laporan Praktik"
                  : editId
                    ? "Edit Penilaian Praktik"
                    : "Input Penilaian Praktik"}
              </h2>

              <p className="pm-muted">
                {isParticipant
                  ? "Pilih tanggal dan materi, isi nilai pengajuan 0–100, lalu wajib lampirkan dokumentasi. Nilai baru dihitung resmi setelah disetujui melalui verifikasi."
                  : "Setiap input atau perubahan nilai 0–100 wajib disertai dokumentasi dan otomatis berstatus Pending. Nilai baru dihitung resmi setelah disetujui Admin/Mentor."}
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
                      {isParticipant
                        ? "Nilai Pengajuan Praktik (0–100)"
                        : "Nilai Praktik (0–100)"}
                    </label>
                    <input
                      id="pm-score"
                      className="pm-input"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={score}
                      onChange={(event) => setScore(event.target.value)}
                      placeholder="Contoh: 85"
                      required
                    />
                    {isParticipant && (
                      <p className="pm-muted">
                        Nilai yang Anda masukkan merupakan pengajuan dan belum masuk rata-rata resmi sampai disetujui Admin/Mentor.
                      </p>
                    )}
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
                      {isParticipant ? "Catatan Pelaksanaan" : "Catatan Penilaian"}
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

                {/* DOKUMENTASI PRAKTIK — UPLOAD SUPABASE */}
                <div className="pm-field">
                  <label className="pm-label" htmlFor="pm-document">
                    Upload Dokumentasi Praktik (Wajib)
                  </label>
                  <input
                    key={fileInputKey}
                    id="pm-document"
                    className="pm-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) =>
                      setDocumentFile(event.target.files?.[0] || null)
                    }
                    disabled={saving}
                  />
                  <p className="pm-muted">
                    Format JPG, PNG, WEBP, atau PDF. Maksimal 5 MB per file.
                    File disimpan privat pada Supabase Storage.
                    {editId && parsePracticeNotes(records.find((r) => r.id === editId)?.notes).evidence
                      ? " Jika tidak memilih file baru, dokumentasi lama tetap dipertahankan."
                      : ""}
                  </p>
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
                      : isParticipant
                      ? "Kirim Nilai & Dokumentasi"
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
                    Jumlah laporan/penilaian pada minggu
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
                  {isParticipant ? "Riwayat Laporan Praktik Saya" : "Riwayat Penilaian Praktik"}
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
                          {item.score == null && parsePracticeNotes(item.notes).review
                            ? formatScore(parsePracticeNotes(item.notes).review.submittedScore)
                            : formatScore(item.score)}
                          {item.score == null && parsePracticeNotes(item.notes).review?.status === "pending" && (
                            <small style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#a57b28" }}>
                              Nilai pengajuan
                            </small>
                          )}
                        </div>
                      </div>

                      {parsePracticeNotes(item.notes).review && (
                        <div className="pm-review">
                          <strong>
                            {parsePracticeNotes(item.notes).review.status === "pending"
                              ? "Menunggu Verifikasi Admin/Mentor"
                              : "Sudah Diverifikasi Mentor/Admin"}
                          </strong>
                          <span>
                            Nilai diajukan: {formatScore(parsePracticeNotes(item.notes).review.submittedScore)}
                            {item.score != null ? ` · Nilai resmi: ${formatScore(item.score)}` : " · Belum masuk rata-rata resmi"}
                          </span>
                        </div>
                      )}

                      {parsePracticeNotes(item.notes).text && (
                        <p className="pm-record-notes">
                          {parsePracticeNotes(item.notes).text}
                        </p>
                      )}

                      {parsePracticeNotes(item.notes).evidence && (
                        <div className="pm-evidence">
                          <span>📎 {parsePracticeNotes(item.notes).evidence.name}</span>
                          <button
                            type="button"
                            className="pm-btn secondary"
                            onClick={() => openEvidence(item)}
                            disabled={openingEvidenceId !== null}
                          >
                            {openingEvidenceId === item.id ? "Membuka..." : "Lihat Dokumentasi"}
                          </button>
                        </div>
                      )}

                      {isParticipant && !parsePracticeNotes(item.notes).review && (
                        <p className="pm-muted">
                          {item.score == null ? "Menunggu penilaian Mentor" : "Sudah dinilai Mentor"}
                        </p>
                      )}

                      {canManage && (
                      <div className="pm-actions">
                        {parsePracticeNotes(item.notes).review?.status === "pending" &&
                          parsePracticeNotes(item.notes).evidence && (
                          <button
                            type="button"
                            className="pm-btn"
                            disabled={saving || !!actionId}
                            onClick={() => verifySubmittedScore(item)}
                          >
                            {actionId === item.id ? "Memverifikasi..." : "Verifikasi Nilai Pengajuan"}
                          </button>
                        )}
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
                      )}
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

.pm-review {
  border: 1px solid #d8e7e0;
  background: #eff9f4;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 10px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #17694d;
  font-size: 12px;
}

.pm-evidence {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  background: #eef7f2;
  border: 1px solid #d4e6d9;
  border-radius: 10px;
  padding: 10px 12px;
  margin: 12px 0;
  font-size: 12px;
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

/* =====================================================
   OJT MINETRACK V2.0
   PENILAIAN PRAKTIK MINGGUAN
   GLOBAL LIGHT / DARK MODE

   Tema mengikuti html[data-theme] dari RootLayout.
   Tidak mengubah fitur, database, dan perhitungan.
   ===================================================== */

/* BACKGROUND HALAMAN */

html[data-theme="dark"] .pm-root,
html[data-theme="dark"] .pm-loading {
  color-scheme: dark;
  background: #0d171b;
  color: #edf8f4;
}

/* HEADER DAN BANNER */

html[data-theme="dark"] .pm-header {
  background: #081f1d;
  color: #ffffff;
}

html[data-theme="dark"] .pm-banner {
  background: linear-gradient(
    110deg,
    #071c24,
    #103c35
  );
  color: #ffffff;
}

html[data-theme="dark"] .pm-banner h1 {
  color: #ffffff;
}

html[data-theme="dark"] .pm-banner p {
  color: #d0e5d9;
}

/* KARTU UTAMA */

html[data-theme="dark"] .pm-card {
  background: #17272b;
  color: #edf8f4;
  border-color: #30484b;
  box-shadow: 0 5px 18px rgba(0,0,0,.18);
}

html[data-theme="dark"] .pm-card h2,
html[data-theme="dark"] .pm-card h3 {
  color: #edf8f4;
}

/* IDENTITAS PESERTA */

html[data-theme="dark"] .pm-participant {
  background: #203438;
  border: 1px solid #30484b;
  color: #edf8f4;
}

html[data-theme="dark"] .pm-participant strong {
  color: #edf8f4;
}

html[data-theme="dark"] .pm-muted {
  color: #a5bbb8;
}

/* LABEL FORM */

html[data-theme="dark"] .pm-label {
  color: #d7ede3;
}

/* INPUT TANGGAL, NILAI, DROPDOWN, CATATAN */

html[data-theme="dark"] .pm-input {
  color-scheme: dark;
  background: #1b3034;
  color: #edf8f4;
  border-color: #3b5555;
}

html[data-theme="dark"] .pm-input::placeholder {
  color: #91aaa2;
  opacity: 1;
}

html[data-theme="dark"] .pm-input:focus {
  outline: 2px solid #43d499;
  outline-offset: 1px;
  border-color: #43d499;
}

html[data-theme="dark"] .pm-input:disabled {
  background: #243338;
  color: #b7cbc3;
  opacity: 1;
}

html[data-theme="dark"] select.pm-input option {
  background: #1b3034;
  color: #edf8f4;
}

/* RINGKASAN NILAI */

html[data-theme="dark"] .pm-stat {
  background: #203438;
  border-color: #30484b;
}

html[data-theme="dark"] .pm-stat small {
  color: #a5bbb8;
}

html[data-theme="dark"] .pm-stat strong {
  color: #83edb8;
}

/* MONITORING PENILAIAN PRAKTIK */

html[data-theme="dark"] .pm-score {
  color: #83edb8;
}

/* RIWAYAT PENILAIAN PRAKTIK */

html[data-theme="dark"] .pm-record {
  background: #192b2e;
  border-color: #30484b;
}

html[data-theme="dark"] .pm-record h3 {
  color: #edf8f4;
}

html[data-theme="dark"] .pm-record-notes {
  color: #b6cbc2;
}

/* TOMBOL SIMPAN DAN AKSI */

html[data-theme="dark"] .pm-btn {
  background: #078b61;
  color: #ffffff;
}

html[data-theme="dark"] .pm-btn.secondary {
  background: #25483e;
  color: #a4f4cd;
  border: 1px solid #35614d;
}

html[data-theme="dark"] .pm-btn.blue {
  background: #286ca9;
  color: #ffffff;
}

html[data-theme="dark"] .pm-btn.red {
  background: #c83e49;
  color: #ffffff;
}

html[data-theme="dark"] .pm-btn:disabled {
  opacity: .5;
}

/* NOTIFIKASI ERROR DAN SUKSES */

html[data-theme="dark"] .pm-alert.error {
  background: #42242c;
  color: #ffc3cb;
  border: 1px solid #7a414c;
}

html[data-theme="dark"] .pm-alert.success {
  background: #1b4534;
  color: #b2f2cc;
  border: 1px solid #35674f;
}

/* LAMPIRAN PRAKTIK */

html[data-theme="dark"] .pm-review {
  background: #203c35;
  border-color: #3a6254;
  color: #a4f4cd;
}

html[data-theme="dark"] .pm-evidence {
  background: #203438;
  border-color: #36524a;
  color: #d0ecdd;
}

/* FOOTER */

html[data-theme="dark"] .pm-footer {
  color: #a5bbb8;
}

/* CETAK — PAKSA TEMA TERANG */

@media print {
  html[data-theme="dark"] .pm-root {
    color-scheme: light;
    background: #ffffff;
    color: #17352e;
  }

  html[data-theme="dark"] .pm-card,
  html[data-theme="dark"] .pm-stat,
  html[data-theme="dark"] .pm-record {
    background: #ffffff;
    color: #17352e;
    border-color: #e2e8f0;
    box-shadow: none;
  }

  html[data-theme="dark"] .pm-card h2,
  html[data-theme="dark"] .pm-card h3,
  html[data-theme="dark"] .pm-record h3 {
    color: #17352e;
  }

  html[data-theme="dark"] .pm-input {
    color-scheme: light;
    background: #ffffff;
    color: #0f172a;
    border-color: #cbd5e1;
  }

  html[data-theme="dark"] .pm-muted,
  html[data-theme="dark"] .pm-record-notes {
    color: #72867d;
  }

  html[data-theme="dark"] .pm-stat strong,
  html[data-theme="dark"] .pm-score {
    color: #087f5b;
  }
}

`;
