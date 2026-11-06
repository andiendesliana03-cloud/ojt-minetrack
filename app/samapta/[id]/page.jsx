
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =========================================================
// OJT MINETRACK V2.0
// PENILAIAN SAMAPTA MENTOR
//
// REFERENSI:
// Salinan dari FCT CREW ER GMO
// PERIODE FEB-MARET 2026.xlsx
// Sheet: SCORE SAMAPTA
//
// Kolom sumber:
// A,B,C = Lari 12 Menit
// D,E,F,G = Shuttle Run
// H,I,J,K = Push-Up
// L,M,N,O = Sit-Up
// P,Q,R,S = Pull-Up
//
// REVISI:
// 1. Perbaikan validasi status program.
// 2. Mendukung status Active / ACTIVE / active.
// 3. Mempertahankan validasi Mentor dan program aktif.
// 4. Perbaikan tombol Hapus menggunakan modal.
// 5. Hapus berdasarkan ID dan tanggal penilaian.
// 6. Refresh riwayat setelah penghapusan.
// 7. Pesan error Supabase lebih jelas.
//
// Tidak mengubah database.
// Tidak mengubah rumus dan tabel konversi.
// Tidak mengubah kalender global.
// Tidak mengubah fitur lain.
// =========================================================

const TESTS = [
  {
    key: "lari",
    name: "Lari 12 Menit",
    unit: "Meter",
  },
  {
    key: "pull",
    name: "Pull-Up",
    unit: "Repetisi",
  },
  {
    key: "push",
    name: "Push-Up",
    unit: "Repetisi",
  },
  {
    key: "sit",
    name: "Sit-Up",
    unit: "Repetisi",
  },
  {
    key: "shuttle",
    name: "Shuttle Run",
    unit: "Detik",
  },
];

const AGES = [
  {
    value: "21-30",
    label: "21–30 Tahun",
  },
  {
    value: "31-40",
    label: "31–40 Tahun",
  },
];

function numbers(text) {
  return text.trim().split(/\s+/).map(Number);
}

// =========================================================
// SAMAPTA A — LARI 12 MENIT
// =========================================================

const RUN_21 = numbers(`
3400 3387 3362 3346 3323 3305 3285 3264 3244
3223 3203 3181 3162 3124 3121 3101 3081 3060
3040 3019 2999 2979 2958 2938 2917 2897 2877
2856 2836 2815 2795 2775 2754 2734 2713 2693
2673 2652 2632 2611 2591 2571 2550 2530 2509
2489 2469 2448 2428 2407 2387 2367 2347 2326
2305 2285 2265 2244 2224 2203 2183 2163 2142
2122 2101 2081 2061 2040 2020 1999 1979 1959
1938 1918 1897 1877 1857 1836 1816 1795 1775
1755 1734 1714 1693 1673 1653 1632 1612
`);

const RUN_31 = numbers(`
3244 3223 3203 3183 3162 3142 3121 3101 3081
3060 3040 3019 2999 2979 2958 2938 2917 2897
2877 2856 2836 2815 2795 2775 2754 2734 2713
2693 2673 2652 2632 2600 2591 2571 2550 2530
2509 2489 2469 2448 2428 2407 2387 2367 2347
2326 2305 2285 2265 2244 2224 2203 2183 2163
2142 2122 2101 2081 2061 2040 2020 1999 1979
1959 1938 1918 1897 1877 1857 1836 1816 1795
1775 1755 1734 1714 1693 1673 1653 1632 1612
1591 1571 1551 1530 1510 1489 1469 1449
`);

function runScore(distance, age) {
  if (
    distance === null ||
    !Number.isInteger(distance) ||
    distance < 0
  ) {
    return null;
  }

  const table =
    age === "21-30"
      ? RUN_21
      : age === "31-40"
      ? RUN_31
      : null;

  if (!table) return null;

  for (
    let index = 0;
    index < table.length;
    index++
  ) {
    if (distance >= table[index]) {
      return 100 - index;
    }
  }

  return null;
}

// =========================================================
// SAMAPTA B — PULL-UP
// =========================================================

const PULL_21 = numbers(`
0 0 0 1 14 17 21 29 30 43 50 57 64 71 79
86 93 100
`);

const PULL_31 = numbers(`
1 8 17 25 33 42 50 58 67 75 83 92 100
`);

// =========================================================
// SAMAPTA B — PUSH-UP
// =========================================================

const PUSH_21 = numbers(`
0 0 0 0 0 0 0 0 0 0 0
1 4 8 12 16 20 24 28 32 36 40 44 48
52 56 60 64 68 72 76 80 84 88 92 96 100
`);

const PUSH_31 = numbers(`
1 4 8 12 16 20 24 28 32 36 40 44 48
52 56 60 64 68 72 76 80 84 88 92 96 100
`);

// =========================================================
// SAMAPTA B — SIT-UP
// =========================================================

const SIT_21 = numbers(`
0 0 0 0 0 0 0 0 0 0
1 3 6 9 12 15 18 21 24 27 30 33 36 39
42 45 48 51 54 58 61 64 67 70 73 76
79 82 85 88 91 94 97 100
`);

const SIT_31 = numbers(`
1 3 6 9 12 16 19 22 25 28 31 34 37
41 44 47 50 53 56 59 62 66 69 72 75
79 81 84 87 91 94 97 100
`);

function repetitionScore(type, count, age) {
  if (
    count === null ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return null;
  }

  if (age === "21-30") {
    if (type === "pull") {
      if (count >= 17) return 100;

      return PULL_21[count] ?? null;
    }

    if (type === "push") {
      if (count >= 38) return 100;
      if (count < 2) return null;

      return PUSH_21[count - 2] ?? null;
    }

    if (type === "sit") {
      if (count >= 45) return 100;
      if (count < 2) return null;

      return SIT_21[count - 2] ?? null;
    }
  }

  if (age === "31-40") {
    if (type === "pull") {
      if (count >= 14) return 100;
      if (count < 2) return null;

      return PULL_31[count - 2] ?? null;
    }

    if (type === "push") {
      if (count >= 37) return 100;
      if (count < 12) return null;

      return PUSH_31[count - 12] ?? null;
    }

    if (type === "sit") {
      if (count >= 42) return 100;
      if (count < 10) return null;

      return SIT_31[count - 10] ?? null;
    }
  }

  return null;
}

// =========================================================
// SAMAPTA B — SHUTTLE RUN
// =========================================================

const SHUTTLE_21 = numbers(`
100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 99
97 97 94 92 90 88 86 84 82 79
77 75 73 71 69 67 65 62 60 58
56 52 50 48 45 45 41 40 37 35
33 31 28 26 24 22 20 18 16 14
11 9 7 5 3 1 0 0 0 0
0 0 0 0 0 0
`);

const SHUTTLE_31 = numbers(`
100 99 96 94 92 90 88 86 83 81
79 77 75 73 70 68 66 64 62 59
57 55 53 51 49 46 44 42 40 38
36 33 31 29 27 25 23 20 18 16
14 12 10 7 5 3
`);

function shuttleScore(seconds, age) {
  if (
    seconds === null ||
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return null;
  }

  const tenths = Math.round(seconds * 10);

  if (
    Math.abs(seconds * 10 - tenths) > 0.000001
  ) {
    return null;
  }

  if (age === "21-30") {
    if (tenths < 130) return 100;

    return SHUTTLE_21[tenths - 130] ?? null;
  }

  if (age === "31-40") {
    if (tenths < 164) return 100;
    if (tenths === 300) return 1;

    return SHUTTLE_31[tenths - 164] ?? null;
  }

  return null;
}

// =========================================================
// VALIDASI TABEL KONVERSI
// =========================================================

function validateReference() {
  const tests = [
    [RUN_21.length, 89],
    [RUN_31.length, 89],
    [PULL_21.length, 18],
    [PULL_31.length, 13],
    [PUSH_21.length, 37],
    [PUSH_31.length, 26],
    [SIT_21.length, 44],
    [SIT_31.length, 33],
    [SHUTTLE_21.length, 86],
    [SHUTTLE_31.length, 46],

    [runScore(1850, "21-30"), 23],
    [runScore(1800, "21-30"), 21],
    [runScore(2600, "21-30"), 60],

    [repetitionScore("pull", 10, "21-30"), 50],
    [repetitionScore("push", 10, "21-30"), 0],
    [repetitionScore("push", 30, "21-30"), 68],
    [repetitionScore("sit", 10, "21-30"), 0],
    [repetitionScore("sit", 25, "21-30"), 39],

    [shuttleScore(15, "21-30"), 100],
    [shuttleScore(20, "21-30"), 11],
  ];

  return tests.every(
    ([actual, expected]) => actual === expected
  );
}

// =========================================================
// HELPER
// =========================================================

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value || "";

  return (
    `${get("year")}-` +
    `${get("month")}-` +
    `${get("day")}`
  );
}

function blankForm() {
  return {
    date: todayWITA(),
    age: "21-30",
    laps: "",
    extra: "",
    pull: "",
    push: "",
    sit: "",
    shuttle: "",
    notes: "",
  };
}

function num(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function fmt(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function dateText(value) {
  if (!value) return "—";

  const parts = String(value)
    .slice(0, 10)
    .split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : String(value);
}

function rating(value) {
  if (value == null) {
    return "Belum tersedia";
  }

  if (value >= 81) return "Baik Sekali";
  if (value >= 61) return "Baik";
  if (value >= 50) return "Cukup";
  if (value >= 21) return "Kurang";
  if (value >= 1) return "Kurang Sekali";

  return "Nilai 0";
}

function participantOf(program) {
  return Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;
}

function calculate(form) {
  const laps = num(form.laps);
  const extra = num(form.extra);

  const distance =
    Number.isInteger(laps) &&
    Number.isInteger(extra) &&
    laps >= 0 &&
    extra >= 0 &&
    extra < 400
      ? laps * 400 + extra
      : null;

  const raw = {
    lari: distance,
    pull: num(form.pull),
    push: num(form.push),
    sit: num(form.sit),
    shuttle: num(form.shuttle),
  };

  const scores = {
    lari: runScore(
      raw.lari,
      form.age
    ),

    pull: repetitionScore(
      "pull",
      raw.pull,
      form.age
    ),

    push: repetitionScore(
      "push",
      raw.push,
      form.age
    ),

    sit: repetitionScore(
      "sit",
      raw.sit,
      form.age
    ),

    shuttle: shuttleScore(
      raw.shuttle,
      form.age
    ),
  };

  const bParts = [
    scores.pull,
    scores.push,
    scores.sit,
    scores.shuttle,
  ];

  const b = bParts.every(
    (value) => value !== null
  )
    ? bParts.reduce(
        (sum, value) => sum + value,
        0
      ) / 4
    : null;

  const final =
    scores.lari !== null &&
    b !== null
      ? (scores.lari + b) / 2
      : null;

  return {
    raw,
    scores,
    b,
    final,

    outcome:
      distance === null
        ? "pending"
        : distance >= 2600
        ? "pass"
        : "fail",
  };
}

// =========================================================
// NORMALISASI STATUS PROGRAM
//
// Revisi:
// Active, ACTIVE, active, atau " active "
// diperlakukan sebagai status yang sama.
//
// Program dengan status selain active tetap ditolak.
// =========================================================

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

// =========================================================
// KOMPONEN FORM
// =========================================================

function Field({
  label,
  value,
  onChange,
  step = "1",
  max,
  disabled = false,
}) {
  return (
    <label className="sa-field-wrap">
      <span className="sa-label">
        {label}
      </span>

      <input
        className="sa-field"
        type="number"
        min="0"
        max={max}
        step={step}
        inputMode="decimal"
        value={value}
        disabled={disabled}
        required
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function ScoreRow({ label, value }) {
  return (
    <div className="sa-score-row">
      <span>{label}</span>

      <strong>
        {value === null
          ? "Belum ada konversi"
          : fmt(value)}
      </strong>
    </div>
  );
}

function HistoryItem({ test, record }) {
  return (
    <div className="sa-history-item">
      <span>
        {test.name}
      </span>

      <strong>
        {record?.result_value == null
          ? "Belum tercatat"
          : `${record.result_value} ${
              record.result_unit || test.unit
            } · Skor ${
              record.score == null
                ? "—"
                : record.score
            }`}
      </strong>
    </div>
  );
}

// =========================================================
// PENGELOMPOKAN RIWAYAT
// =========================================================

function groupHistory(records) {
  const dates = new Map();

  records.forEach((record) => {
    const date = String(
      record.test_date || ""
    ).slice(0, 10);

    if (!date) return;

    if (!dates.has(date)) {
      dates.set(date, []);
    }

    dates.get(date).push(record);
  });

  return [...dates.entries()]
    .sort(
      (a, b) => b[0].localeCompare(a[0])
    )
    .map(([date, items]) => {
      const byType = new Map();

      items.forEach((record) => {
        if (!byType.has(record.test_type)) {
          byType.set(
            record.test_type,
            record
          );
        }
      });

      const get = (name) =>
        byType.get(name);

      const run = get("Lari 12 Menit");

      const a =
        run?.score == null
          ? null
          : Number(run.score);

      const bValues = TESTS.slice(1).map(
        (test) => {
          const value = get(
            test.name
          )?.score;

          return value == null
            ? null
            : Number(value);
        }
      );

      const b = bValues.every(
        (value) =>
          value !== null &&
          Number.isFinite(value)
      )
        ? bValues.reduce(
            (sum, value) => sum + value,
            0
          ) / 4
        : null;

      const final =
        a !== null &&
        Number.isFinite(a) &&
        b !== null
          ? (a + b) / 2
          : null;

      const distance =
        run?.result_value == null
          ? null
          : Number(run.result_value);

      return {
        date,
        items,
        byType,
        a,
        b,
        final,
        distance,

        complete:
          TESTS.every((test) =>
            byType.has(test.name)
          ) &&
          Number.isFinite(a) &&
          b !== null &&
          items.length === TESTS.length,

        outcome:
          distance === null
            ? "pending"
            : distance >= 2600
            ? "pass"
            : "fail",
      };
    });
}

// =========================================================
// HALAMAN UTAMA
// =========================================================

export default function MonitoringSamapta() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const requestRef = useRef(0);

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);

  const [form, setForm] = useState(blankForm);

  const [editDate, setEditDate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Modal konfirmasi penghapusan.
  const [deleteTarget, setDeleteTarget] =
    useState(null);

  const calc = useMemo(
    () => calculate(form),
    [form]
  );

  const referenceValid = useMemo(
    () => validateReference(),
    []
  );

  const participant = participantOf(program);

  const name =
    participant?.full_name ||
    "Peserta OJT";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const groups = useMemo(
    () => groupHistory(records),
    [records]
  );

  // =====================================================
  // UBAH FORM
  // =====================================================

  function change(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  // =====================================================
  // AMBIL DATA SAMAPTA
  // =====================================================

  async function fetchRecords(id) {
    const {
      data,
      error: fetchError,
    } = await supabase
      .from("samapta_records")
      .select(
        "id,program_id,test_date,test_type,result_value,result_unit,score,notes,outcome"
      )
      .eq("program_id", id)
      .order("test_date", {
        ascending: false,
      });

    if (fetchError) {
      throw fetchError;
    }

    return data || [];
  }

  async function reload() {
    const latest = await fetchRecords(programId);

    setRecords(latest);

    return latest;
  }

  // =====================================================
  // VERIFIKASI PROGRAM SEBELUM SIMPAN / HAPUS
  //
  // PERBAIKAN UTAMA:
  // Tidak lagi memakai filter
  // .eq("status", "active")
  //
  // Status divalidasi setelah data dibaca.
  // =====================================================

  async function verifyActiveProgram() {
    if (
      !mentor ||
      !program ||
      !programId
    ) {
      throw new Error(
        "Identitas Mentor atau program belum tersedia."
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
      );
    }

    if (user.id !== mentor.id) {
      throw new Error(
        "Akun aktif tidak sesuai dengan Mentor yang terdaftar."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (
      normalizeStatus(profile?.role) !==
      "mentor"
    ) {
      throw new Error(
        "Akun tidak memiliki hak akses sebagai Mentor."
      );
    }

    const {
      data: activeProgram,
      error: activeError,
    } = await supabase
      .from("ojt_programs")
      .select("id,status,mentor_id")
      .eq("id", programId)
      .eq("mentor_id", user.id)
      .maybeSingle();

    if (activeError) {
      throw activeError;
    }

    if (!activeProgram) {
      throw new Error(
        "Program tidak ditemukan, tidak dapat diakses, " +
        "atau bukan binaan Mentor."
      );
    }

    if (
      normalizeStatus(
        activeProgram.status
      ) !== "active"
    ) {
      throw new Error(
        "Program OJT tidak aktif. Status saat ini: " +
        (activeProgram.status || "Tidak diketahui")
      );
    }

    return activeProgram;
  }

  // =====================================================
  // VERIFIKASI MENTOR SAAT HALAMAN DIBUKA
  // =====================================================

  useEffect(() => {
    if (!programId) return;

    let active = true;

    const requestNumber =
      ++requestRef.current;

    async function initialize() {
      setLoading(true);
      setError("");
      setNotice("");

      setMentor(null);
      setProgram(null);
      setRecords([]);

      setForm(blankForm());
      setEditDate(null);
      setDeleteTarget(null);

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
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (
          normalizeStatus(
            profile?.role
          ) !== "mentor"
        ) {
          router.replace(
            "/dashboard-peserta"
          );
          return;
        }

        const {
          data: programData,
          error: programError,
        } = await supabase
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
          .eq("id", programId)
          .eq("mentor_id", user.id)
          .maybeSingle();

        if (programError) {
          throw programError;
        }

        if (!programData) {
          throw new Error(
            "Program tidak ditemukan atau bukan binaan Mentor."
          );
        }

        if (
          normalizeStatus(
            programData.status
          ) !== "active"
        ) {
          throw new Error(
            "Program OJT tidak aktif. Status: " +
            (programData.status || "Tidak diketahui")
          );
        }

        const history =
          await fetchRecords(programId);

        if (
          !active ||
          requestNumber !== requestRef.current
        ) {
          return;
        }

        setMentor(profile);
        setProgram(programData);
        setRecords(history);
      } catch (err) {
        if (
          active &&
          requestNumber === requestRef.current
        ) {
          setError(
            err?.message ||
              "Gagal memuat data Samapta."
          );
        }
      } finally {
        if (
          active &&
          requestNumber === requestRef.current
        ) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [programId, router]);

  // =====================================================
  // RESET FORM
  // =====================================================

  function reset() {
    setForm(blankForm());
    setEditDate(null);
    setError("");
  }

  // =====================================================
  // SIMPAN SAMAPTA A DAN B
  // =====================================================

  async function save(event) {
    event.preventDefault();

    if (
      saving ||
      busy ||
      !mentor ||
      !program ||
      program.id !== programId
    ) {
      return;
    }

    setError("");
    setNotice("");

    if (!referenceValid) {
      setError(
        "Pemeriksaan internal tabel konversi gagal. " +
        "Penilaian belum dapat disimpan."
      );
      return;
    }

    const {
      raw,
      scores,
      outcome,
    } = calc;

    const invalidRepetitions = [
      raw.pull,
      raw.push,
      raw.sit,
    ].some(
      (value) =>
        value === null ||
        !Number.isInteger(value) ||
        value < 0
    );

    const invalidShuttle =
      raw.shuttle === null ||
      raw.shuttle <= 0 ||
      Math.abs(
        raw.shuttle * 10 -
          Math.round(raw.shuttle * 10)
      ) > 0.000001;

    if (
      !form.date ||
      raw.lari === null ||
      invalidRepetitions ||
      invalidShuttle
    ) {
      setError(
        "Periksa tanggal, putaran, tambahan jarak, " +
        "repetisi, dan waktu Shuttle Run (1 desimal)."
      );
      return;
    }

    const missing = TESTS.filter(
      (test) =>
        scores[test.key] === null
    );

    if (missing.length) {
      setError(
        "Konversi belum tercantum pada tabel Excel untuk: " +
        missing
          .map((test) => test.name)
          .join(", ") +
        ". Data belum disimpan agar skor tidak ditebak."
      );
      return;
    }

    if (
      editDate &&
      editDate !== form.date
    ) {
      setError(
        "Tanggal penilaian tidak boleh diubah saat mengedit."
      );
      return;
    }

    const existing = records.filter(
      (record) =>
        String(record.test_date)
          .slice(0, 10) === form.date
    );

    if (
      !editDate &&
      existing.length
    ) {
      setError(
        "Tanggal tersebut sudah memiliki penilaian. " +
        "Gunakan Edit pada riwayat."
      );
      return;
    }

    const invalidExisting =
      existing.some(
        (record) =>
          !TESTS.some(
            (test) =>
              test.name ===
              record.test_type
          )
      );

    const duplicateExisting =
      new Set(
        existing.map(
          (record) => record.test_type
        )
      ).size !== existing.length;

    if (
      invalidExisting ||
      duplicateExisting
    ) {
      setError(
        "Terdapat jenis tes tidak dikenal atau duplikat. " +
        "Periksa riwayat sebelum menyimpan."
      );
      return;
    }

    const oldByType = new Map(
      existing.map((record) => [
        record.test_type,
        record,
      ])
    );

    const payloads = TESTS.map(
      (test) => ({
        test_date: form.date,
        test_type: test.name,
        result_value: raw[test.key],
        result_unit: test.unit,
        score: scores[test.key],

        outcome:
          test.key === "lari"
            ? outcome
            : "pending",

        notes:
          test.key === "lari"
            ? `USIA=${form.age}; PUTARAN=${form.laps}; TAMBAHAN=${form.extra}; ${form.notes.trim()}`
            : form.notes.trim() || null,
      })
    );

    setSaving(true);

    try {
      // Periksa ulang program dan Mentor.
      // Status diperiksa tanpa membedakan kapital.

      await verifyActiveProgram();

      // Simpan dengan logika asli.
      for (const payload of payloads) {
        const old = oldByType.get(
          payload.test_type
        );

        const result = old
          ? await supabase
              .from("samapta_records")
              .update(payload)
              .eq("id", old.id)
              .eq("program_id", programId)
              .select("id")
          : await supabase
              .from("samapta_records")
              .insert({
                ...payload,
                program_id: programId,
                created_by: mentor.id,
                recorded_by: mentor.id,
              })
              .select("id");

        if (result.error) {
          throw result.error;
        }

        if (!result.data?.length) {
          throw new Error(
            `Gagal menyimpan ${payload.test_type}.`
          );
        }
      }

      await reload();

      reset();

      setNotice(
        "Seluruh lima komponen Samapta A dan B berhasil disimpan."
      );
    } catch (err) {
      setError(
        `${err?.message || "Gagal menyimpan"}. ` +
        "Sebagian komponen mungkin sudah tersimpan. " +
        "Periksa riwayat sebelum mengulangi penyimpanan."
      );

      try {
        await reload();
      } catch {
        // Pertahankan pesan utama.
      }
    } finally {
      setSaving(false);
    }
  }

  // =====================================================
  // EDIT PENILAIAN
  // =====================================================

  function edit(group) {
    if (
      saving ||
      busy ||
      !program
    ) {
      return;
    }

    const get = (type) =>
      group.byType.get(type);

    const run = get(
      "Lari 12 Menit"
    );

    const distance =
      run?.result_value == null
        ? null
        : Number(run.result_value);

    const saved = String(
      run?.notes || ""
    );

    const age =
      saved.match(
        /USIA=(21-30|31-40)/
      )?.[1] || "21-30";

    const laps =
      saved.match(
        /PUTARAN=(\d+)/
      )?.[1];

    const extra =
      saved.match(
        /TAMBAHAN=(\d+)/
      )?.[1];

    setForm({
      date: group.date,
      age,

      laps:
        laps ??
        (distance == null
          ? ""
          : String(
              Math.floor(distance / 400)
            )),

      extra:
        extra ??
        (distance == null
          ? ""
          : String(distance % 400)),

      pull:
        get("Pull-Up")
          ?.result_value
          ?.toString() ?? "",

      push:
        get("Push-Up")
          ?.result_value
          ?.toString() ?? "",

      sit:
        get("Sit-Up")
          ?.result_value
          ?.toString() ?? "",

      shuttle:
        get("Shuttle Run")
          ?.result_value
          ?.toString() ?? "",

      notes:
        get("Push-Up")
          ?.notes || "",
    });

    setEditDate(group.date);
    setError("");
    setNotice("");

    document
      .getElementById(
        "samapta-form"
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  // =====================================================
  // MODAL KONFIRMASI HAPUS
  // =====================================================

  function openDeleteDialog(group) {
    if (saving || busy) {
      return;
    }

    setError("");
    setNotice("");

    if (
      !mentor ||
      !program ||
      String(program.id) !==
        String(programId)
    ) {
      setError(
        "Identitas Mentor atau program tidak valid. " +
        "Muat ulang halaman sebelum menghapus."
      );
      return;
    }

    if (
      !group ||
      !group.date ||
      !Array.isArray(group.items) ||
      group.items.length === 0
    ) {
      setError(
        "Catatan Samapta yang akan dihapus tidak ditemukan."
      );
      return;
    }

    const ids = group.items
      .map((item) => item.id)
      .filter(
        (id) =>
          id !== null &&
          id !== undefined
      );

    const uniqueIds = [
      ...new Set(ids),
    ];

    if (
      ids.length !== group.items.length ||
      uniqueIds.length !== group.items.length
    ) {
      setError(
        "ID catatan Samapta tidak lengkap atau duplikat. " +
        "Penghapusan dibatalkan."
      );
      return;
    }

    setDeleteTarget({
      date: group.date,
      ids: uniqueIds,
      count: uniqueIds.length,
    });
  }

  function closeDeleteDialog() {
    if (busy) return;

    setDeleteTarget(null);
  }

  // =====================================================
  // HAPUS PENILAIAN
  // =====================================================

  async function confirmDelete() {
    if (
      busy ||
      saving ||
      !deleteTarget
    ) {
      return;
    }

    const target = deleteTarget;

    if (
      !mentor ||
      !program ||
      String(program.id) !==
        String(programId)
    ) {
      setDeleteTarget(null);

      setError(
        "Akses Mentor atau identitas program tidak valid."
      );

      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      // ================================================
      // 1. Validasi program aktif dan akses Mentor
      // ================================================

      await verifyActiveProgram();

      // ================================================
      // 2. Validasi ID catatan
      // ================================================

      if (!target.ids.length) {
        throw new Error(
          "Tidak ada ID penilaian yang dapat dihapus."
        );
      }

      const {
        data: selectedRecords,
        error: selectError,
      } = await supabase
        .from("samapta_records")
        .select("id,test_date")
        .eq("program_id", programId)
        .in("id", target.ids);

      if (selectError) {
        throw selectError;
      }

      if (
        !selectedRecords ||
        selectedRecords.length !==
          target.ids.length
      ) {
        throw new Error(
          "Sebagian catatan tidak ditemukan. " +
          "Muat ulang riwayat sebelum menghapus."
        );
      }

      // ================================================
      // 3. Validasi tanggal penilaian
      // ================================================

      const validDate =
        selectedRecords.every(
          (record) =>
            String(
              record.test_date || ""
            ).slice(0, 10) ===
            target.date
        );

      if (!validDate) {
        throw new Error(
          "Tanggal salah satu catatan tidak sesuai. " +
          "Penghapusan dibatalkan untuk melindungi data."
        );
      }

      // ================================================
      // 4. Hapus hanya catatan terpilih
      // ================================================

      const {
        data: deletedRecords,
        error: deleteError,
      } = await supabase
        .from("samapta_records")
        .delete()
        .eq("program_id", programId)
        .in("id", target.ids)
        .select("id");

      if (deleteError) {
        throw new Error(
          `Supabase: ${deleteError.message}`
        );
      }

      const deletedIds = new Set(
        (deletedRecords || []).map(
          (item) => item.id
        )
      );

      const allDeleted =
        deletedIds.size ===
          target.ids.length &&
        target.ids.every(
          (id) => deletedIds.has(id)
        );

      if (!allDeleted) {
        throw new Error(
          "Jumlah data yang terhapus tidak sesuai. " +
          "Periksa izin DELETE Supabase dan muat ulang riwayat."
        );
      }

      // ================================================
      // 5. Perbarui riwayat lokal
      // ================================================

      setRecords((previous) =>
        previous.filter(
          (item) =>
            !deletedIds.has(item.id)
        )
      );

      setDeleteTarget(null);

      if (editDate === target.date) {
        reset();
      }

      setNotice(
        `Penilaian Samapta tanggal ${dateText(
          target.date
        )} berhasil dihapus (${target.count} komponen).`
      );

      // ================================================
      // 6. Sinkronisasi ulang dengan Supabase
      // ================================================

      try {
        await reload();
      } catch {
        setNotice(
          "Penghapusan berhasil, tetapi riwayat terbaru " +
          "belum dapat dimuat. Silakan refresh halaman."
        );
      }
    } catch (err) {
      setError(
        err?.message ||
          "Gagal menghapus penilaian Samapta."
      );

      try {
        await reload();
      } catch {
        // Pertahankan error utama.
      }

      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <main className="sa-root">
      <style>{styles}</style>

      {/* HEADER */}

      <header className="sa-topbar">
        <strong className="sa-brand">
          OJT <span>MineTrack</span>
        </strong>

        <button
          type="button"
          className="sa-back"
          onClick={() =>
            router.push(
              programId
                ? `/peserta/${programId}`
                : "/"
            )
          }
        >
          ← Detail Peserta
        </button>
      </header>

      <div className="sa-container">
        {/* HERO */}

        <section className="sa-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>
            Monitoring Samapta
          </h1>

          <p>
            Penilaian Tes Fisik dan Kesiapan Personel OJT
          </p>
        </section>

        {loading ? (
          <section className="sa-card">
            Memuat data Samapta...
          </section>
        ) : !mentor || !program ? (
          <section className="sa-card">
            <h2>
              Data Tidak Dapat Ditampilkan
            </h2>

            <p className="sa-error">
              {error ||
                "Program tidak ditemukan."}
            </p>
          </section>
        ) : (
          <>
            {/* IDENTITAS PESERTA */}

            <section className="sa-card">
              <div className="sa-identity">
                <div className="sa-avatar">
                  {initials}
                </div>

                <div className="sa-person">
                  <strong>
                    {name}
                  </strong>

                  <small>
                    {participant?.department ||
                      "—"}
                    {" · "}
                    {program.site || "—"}
                  </small>

                  <small>
                    {dateText(
                      program.start_date
                    )}
                    {" – "}
                    {dateText(
                      program.end_date
                    )}
                  </small>
                </div>

                <span className="sa-active">
                  Aktif
                </span>
              </div>

              <div className="sa-lock">
                Penilaian hanya dapat dilakukan Mentor
                untuk peserta OJT binaannya.
              </div>
            </section>

            {/* NOTIFIKASI */}

            {!referenceValid && (
              <div className="sa-error">
                Pemeriksaan tabel referensi gagal.
                Periksa kode konversi sebelum menyimpan.
              </div>
            )}

            {error && (
              <div
                className="sa-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                className="sa-success"
                role="status"
              >
                ✓ {notice}
              </div>
            )}

            {/* FORM PENILAIAN */}

            <form
              id="samapta-form"
              onSubmit={save}
            >
              {/* DATA PENILAIAN */}

              <section className="sa-card">
                <div className="sa-title">
                  <span className="sa-title-icon">
                    📅
                  </span>

                  <h2>
                    {editDate
                      ? "Edit Penilaian Samapta"
                      : "Data Penilaian Samapta"}
                  </h2>
                </div>

                <div className="sa-grid">
                  <label className="sa-field-wrap">
                    <span className="sa-label">
                      Tanggal Pelaksanaan
                    </span>

                    <input
                      className="sa-field"
                      type="date"
                      value={form.date}
                      disabled={
                        !!editDate ||
                        saving
                      }
                      onChange={(event) =>
                        change(
                          "date",
                          event.target.value
                        )
                      }
                      required
                    />
                  </label>

                  <label className="sa-field-wrap">
                    <span className="sa-label">
                      Kelompok Usia Peserta
                    </span>

                    <select
                      className="sa-field"
                      value={form.age}
                      disabled={saving}
                      onChange={(event) =>
                        change(
                          "age",
                          event.target.value
                        )
                      }
                    >
                      {AGES.map((age) => (
                        <option
                          key={age.value}
                          value={age.value}
                        >
                          {age.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              {/* SAMAPTA A DAN B */}

              <div className="sa-grid">
                {/* SAMAPTA A */}

                <section className="sa-card">
                  <div className="sa-title">
                    <span className="sa-title-icon blue">
                      🏃
                    </span>

                    <h2>
                      Samapta A — Lari 12 Menit
                    </h2>
                  </div>

                  <p className="sa-muted">
                    Masukkan jumlah putaran dan
                    tambahan jarak. Satu putaran
                    = 400 meter.
                  </p>

                  <div className="sa-grid">
                    <Field
                      label="Jumlah Putaran"
                      value={form.laps}
                      disabled={saving}
                      onChange={(value) =>
                        change(
                          "laps",
                          value
                        )
                      }
                    />

                    <Field
                      label="Tambahan Jarak (0–399 m)"
                      value={form.extra}
                      max="399"
                      disabled={saving}
                      onChange={(value) =>
                        change(
                          "extra",
                          value
                        )
                      }
                    />
                  </div>

                  <div className="sa-result">
                    <small>
                      Total Jarak
                    </small>

                    <strong>
                      {calc.raw.lari === null
                        ? "—"
                        : `${calc.raw.lari.toLocaleString(
                            "id-ID"
                          )} meter`}
                    </strong>
                  </div>

                  <ScoreRow
                    label="Skor Lari / Nilai A"
                    value={
                      calc.scores.lari
                    }
                  />

                  <p className="sa-muted">
                    Target kelulusan lari 12 menit:
                    minimal 2.600 meter.
                  </p>
                </section>

                {/* SAMAPTA B */}

                <section className="sa-card">
                  <div className="sa-title">
                    <span className="sa-title-icon">
                      🏋️
                    </span>

                    <h2>
                      Samapta B — Tes Fisik
                    </h2>
                  </div>

                  <p className="sa-muted">
                    Konversi mengikuti tabel Excel
                    berdasarkan kelompok usia peserta.
                  </p>

                  {[
                    [
                      "pull",
                      "Pull-Up",
                      "1",
                    ],
                    [
                      "push",
                      "Push-Up",
                      "1",
                    ],
                    [
                      "sit",
                      "Sit-Up",
                      "1",
                    ],
                    [
                      "shuttle",
                      "Shuttle Run (detik)",
                      "0.1",
                    ],
                  ].map(
                    ([
                      key,
                      label,
                      step,
                    ]) => (
                      <div
                        className="sa-test-row"
                        key={key}
                      >
                        <span className="sa-test-name">
                          {label}
                        </span>

                        <Field
                          label="Hasil"
                          value={
                            form[key]
                          }
                          step={step}
                          disabled={
                            saving
                          }
                          onChange={(
                            value
                          ) =>
                            change(
                              key,
                              value
                            )
                          }
                        />

                        <span
                          className={
                            calc.scores[
                              key
                            ] === null
                              ? "sa-test-score missing"
                              : "sa-test-score"
                          }
                        >
                          {calc.scores[
                            key
                          ] === null
                            ? "—"
                            : `Skor ${
                                calc
                                  .scores[
                                  key
                                ]
                              }`}
                        </span>
                      </div>
                    )
                  )}

                  <p className="sa-muted">
                    Skor 0 tetap ditampilkan sebagai
                    nilai sah dan ikut dihitung
                    dalam Nilai B.
                  </p>
                </section>
              </div>

              {/* RINGKASAN NILAI */}

              <section className="sa-card">
                <div className="sa-title">
                  <span className="sa-title-icon blue">
                    📊
                  </span>

                  <h2>
                    Hasil Perhitungan Otomatis
                  </h2>
                </div>

                <div className="sa-summary">
                  <div className="sa-summary-box">
                    <span>
                      Nilai A
                    </span>

                    <strong>
                      {fmt(
                        calc.scores.lari
                      )}
                    </strong>
                  </div>

                  <div className="sa-summary-box">
                    <span>
                      Nilai B
                    </span>

                    <strong>
                      {fmt(calc.b)}
                    </strong>
                  </div>

                  <div className="sa-summary-box">
                    <span>
                      Nilai Akhir
                    </span>

                    <strong>
                      {fmt(
                        calc.final
                      )}
                    </strong>
                  </div>
                </div>

                <div className="sa-status-grid">
                  <div className="sa-status">
                    Kategori CCR

                    <strong>
                      {rating(
                        calc.final
                      )}
                    </strong>
                  </div>

                  <div className="sa-status">
                    Status Kelulusan Lari

                    <strong
                      className={
                        calc.outcome ===
                        "pass"
                          ? "pass-text"
                          : calc.outcome ===
                            "fail"
                          ? "fail-text"
                          : ""
                      }
                    >
                      {calc.outcome ===
                      "pass"
                        ? "LULUS"
                        : calc.outcome ===
                          "fail"
                        ? "TIDAK LULUS"
                        : "BELUM DINILAI"}
                    </strong>
                  </div>
                </div>

                <p className="sa-muted">
                  Nilai B = (Pull-Up + Push-Up +
                  Sit-Up + Shuttle Run) / 4.
                  Nilai Akhir = (Nilai A + Nilai B) / 2.
                </p>
              </section>

              {/* CATATAN DAN SIMPAN */}

              <section className="sa-card">
                <label className="sa-field-wrap">
                  <span className="sa-label">
                    Catatan Evaluasi Mentor
                  </span>

                  <textarea
                    className="sa-field"
                    rows={4}
                    value={
                      form.notes
                    }
                    disabled={
                      saving
                    }
                    placeholder="Catatan hasil tes fisik..."
                    onChange={(
                      event
                    ) =>
                      change(
                        "notes",
                        event.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  className="sa-btn"
                  disabled={
                    saving ||
                    busy ||
                    !referenceValid
                  }
                  style={{
                    width: "100%",
                  }}
                >
                  {saving
                    ? "Menyimpan..."
                    : editDate
                    ? "Simpan Perubahan Samapta"
                    : "Simpan Penilaian Samapta"}
                </button>

                {editDate && (
                  <button
                    type="button"
                    className="sa-btn gray"
                    disabled={
                      saving
                    }
                    onClick={
                      reset
                    }
                    style={{
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    Batal Edit
                  </button>
                )}

                <p className="sa-muted">
                  Penyimpanan hanya dilakukan apabila
                  seluruh lima komponen memiliki
                  angka konversi dari referensi.
                </p>
              </section>
            </form>

            {/* RIWAYAT SAMAPTA */}

            <section className="sa-card">
              <div className="sa-title">
                <span className="sa-title-icon">
                  📋
                </span>

                <h2>
                  Riwayat Penilaian Samapta
                </h2>
              </div>

              <p className="sa-muted">
                {groups.length} tanggal penilaian
                untuk {name}.
              </p>

              {!groups.length && (
                <div className="sa-empty">
                  Belum ada riwayat Samapta tersimpan.
                </div>
              )}

              {groups.map(
                (group) => (
                  <article
                    className="sa-history"
                    key={
                      group.date
                    }
                  >
                    <div className="sa-history-head">
                      <strong>
                        {dateText(
                          group.date
                        )}
                      </strong>

                      <span
                        className={
                          "sa-badge " +
                          (group.outcome ===
                          "pass"
                            ? "pass"
                            : group.outcome ===
                              "fail"
                            ? "fail"
                            : "")
                        }
                      >
                        {group.outcome ===
                        "pass"
                          ? "Lulus Lari"
                          : group.outcome ===
                            "fail"
                          ? "Belum Lulus Lari"
                          : "Belum Dinilai"}
                      </span>
                    </div>

                    <h3>
                      Samapta A
                    </h3>

                    <HistoryItem
                      test={
                        TESTS[0]
                      }
                      record={
                        group.byType.get(
                          "Lari 12 Menit"
                        )
                      }
                    />

                    <h3>
                      Samapta B
                    </h3>

                    {TESTS.slice(
                      1
                    ).map(
                      (test) => (
                        <HistoryItem
                          key={
                            test.key
                          }
                          test={
                            test
                          }
                          record={
                            group.byType.get(
                              test.name
                            )
                          }
                        />
                      )
                    )}

                    <div className="sa-summary">
                      <div className="sa-summary-box">
                        <span>
                          Nilai A
                        </span>

                        <strong>
                          {fmt(
                            group.a
                          )}
                        </strong>
                      </div>

                      <div className="sa-summary-box">
                        <span>
                          Nilai B
                        </span>

                        <strong>
                          {fmt(
                            group.b
                          )}
                        </strong>
                      </div>

                      <div className="sa-summary-box">
                        <span>
                          Nilai Akhir
                        </span>

                        <strong>
                          {fmt(
                            group.final
                          )}
                        </strong>
                      </div>
                    </div>

                    {!group.complete && (
                      <p className="sa-warning">
                        Sebagian komponen penilaian
                        belum lengkap.
                      </p>
                    )}

                    <p className="sa-muted">
                      Kategori CCR:{" "}
                      <strong>
                        {rating(
                          group.final
                        )}
                      </strong>
                    </p>

                    <div className="sa-actions">
                      <button
                        type="button"
                        className="sa-btn blue"
                        disabled={
                          saving ||
                          busy
                        }
                        onClick={() =>
                          edit(group)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="sa-btn red"
                        disabled={
                          saving ||
                          busy
                        }
                        onClick={() =>
                          openDeleteDialog(
                            group
                          )
                        }
                      >
                        {busy &&
                        deleteTarget?.date ===
                          group.date
                          ? "Memproses..."
                          : "Hapus"}
                      </button>
                    </div>
                  </article>
                )
              )}
            </section>
          </>
        )}

        <footer className="sa-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </div>

      {/* ==============================================
          MODAL KONFIRMASI HAPUS
          ============================================== */}

      {deleteTarget && (
        <div
          className="sa-modal-overlay"
          role="presentation"
          onClick={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDeleteDialog();
            }
          }}
        >
          <div
            className="sa-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sa-delete-title"
            aria-describedby="sa-delete-description"
          >
            <div className="sa-modal-icon">
              🗑️
            </div>

            <h2 id="sa-delete-title">
              Hapus Penilaian Samapta?
            </h2>

            <p id="sa-delete-description">
              Anda akan menghapus hasil penilaian
              Samapta untuk peserta:
            </p>

            <div className="sa-modal-detail">
              <div>
                <span>
                  Nama Peserta
                </span>

                <strong>
                  {name}
                </strong>
              </div>

              <div>
                <span>
                  Tanggal Penilaian
                </span>

                <strong>
                  {dateText(
                    deleteTarget.date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Jumlah Komponen
                </span>

                <strong>
                  {deleteTarget.count} catatan
                </strong>
              </div>
            </div>

            <div className="sa-modal-warning">
              Seluruh komponen Samapta A dan B yang
              tercatat pada tanggal tersebut akan
              dihapus permanen.
              <br />
              Data pada tanggal lain tidak akan dihapus.
            </div>

            <div className="sa-modal-actions">
              <button
                type="button"
                className="sa-btn gray"
                disabled={busy}
                onClick={
                  closeDeleteDialog
                }
              >
                Batal
              </button>

              <button
                type="button"
                className="sa-btn red"
                disabled={busy}
                onClick={
                  confirmDelete
                }
              >
                {busy
                  ? "Menghapus..."
                  : "Ya, Hapus Penilaian"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// =========================================================
// CSS
// =========================================================

const styles = `
.sa-root,
.sa-root * {
  box-sizing: border-box;
}

.sa-root {
  min-height: 100vh;
  background: #f2f6f7;
  color: #19352d;
  font-family: Arial, Helvetica, sans-serif;
}

.sa-root button,
.sa-root input,
.sa-root select,
.sa-root textarea {
  font: inherit;
}

.sa-topbar {
  background: #081f27;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 22px;
}

.sa-brand {
  font-size: 21px;
  font-weight: 900;
}

.sa-brand span {
  color: #2ac58e;
}

.sa-back {
  background: #ffffff16;
  color: white;
  border: 1px solid #ffffff30;
  border-radius: 10px;
  padding: 10px 13px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.sa-container {
  max-width: 1100px;
  margin: auto;
  padding: 22px;
}

.sa-hero {
  background:
    linear-gradient(
      90deg,
      rgba(5,24,31,.97),
      rgba(5,43,37,.83),
      rgba(5,34,32,.35)
    ),
    url("/background-erg.png.PNG");
  background-size: cover;
  background-position: center;
  color: white;
  border-radius: 18px;
  padding: 30px;
  margin-bottom: 16px;
}

.sa-hero small {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #efc77b;
}

.sa-hero h1 {
  font-size: 30px;
  margin: 14px 0 8px;
}

.sa-hero p {
  font-size: 13px;
  color: #d9e9e1;
}

.sa-card {
  background: white;
  border: 1px solid #e2eae6;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 5px 18px #1235270b;
}

.sa-card h2 {
  font-size: 18px;
  margin: 0;
}

.sa-card h3 {
  font-size: 14px;
  color: #087a53;
  margin: 20px 0 10px;
}

.sa-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.sa-title-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #e4f7ed;
  font-size: 20px;
}

.sa-title-icon.blue {
  background: #e7f2ff;
}

.sa-muted {
  color: #778c80;
  font-size: 12px;
  line-height: 1.7;
}

.sa-identity {
  display: flex;
  align-items: center;
  gap: 13px;
  background: #f5fbf7;
  border: 1px solid #dcefe3;
  border-radius: 13px;
  padding: 15px;
}

.sa-avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 14px;
  background: #d8f4e5;
  color: #087d56;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 900;
}

.sa-person {
  flex: 1;
  min-width: 0;
}

.sa-person strong {
  display: block;
  font-size: 16px;
}

.sa-person small {
  display: block;
  color: #74867b;
  font-size: 11px;
  margin-top: 5px;
}

.sa-active {
  background: #dff7e8;
  color: #087d4e;
  border-radius: 20px;
  padding: 7px 11px;
  font-size: 11px;
  font-weight: 800;
}

.sa-lock {
  margin-top: 13px;
  padding: 12px;
  background: #effaf3;
  border: 1px solid #d3ebdb;
  border-radius: 11px;
  color: #137a55;
  font-size: 12px;
}

.sa-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.sa-field-wrap {
  display: block;
  min-width: 0;
  margin-bottom: 16px;
}

.sa-label {
  display: block;
  color: #365247;
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 8px;
}

.sa-field {
  width: 100%;
  background: white;
  color: #193b2d;
  border: 1px solid #d7e4dd;
  border-radius: 10px;
  padding: 12px;
  font-size: 16px;
}

.sa-field:disabled {
  background: #edf2ef;
  opacity: .8;
}

.sa-result {
  background: #effaf4;
  border: 1px solid #d6ebdf;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 14px;
}

.sa-result small {
  display: block;
  color: #718a7a;
  font-size: 11px;
}

.sa-result strong {
  display: block;
  color: #087a53;
  font-size: 25px;
  margin-top: 7px;
}

.sa-score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-bottom: 1px solid #e8efeb;
  padding: 13px 0;
  font-size: 12px;
}

.sa-score-row strong {
  color: #087b56;
}

.sa-test-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) 110px 100px;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid #ecf0ed;
}

.sa-test-row .sa-field-wrap {
  margin: 0;
}

.sa-test-name {
  font-size: 12px;
  font-weight: 800;
}

.sa-test-score {
  background: #e9f8ef;
  color: #11805a;
  padding: 12px 6px;
  text-align: center;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 800;
}

.sa-test-score.missing {
  background: #f4f1ec;
  color: #9c7043;
}

.sa-summary {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 11px;
  margin: 16px 0;
}

.sa-summary-box {
  background: #f7faf8;
  border: 1px solid #e5ece8;
  border-radius: 12px;
  padding: 17px 10px;
  text-align: center;
}

.sa-summary-box span {
  display: block;
  color: #778b7e;
  font-size: 11px;
}

.sa-summary-box strong {
  display: block;
  color: #174132;
  font-size: 24px;
  margin-top: 8px;
}

.sa-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.sa-status {
  background: #f8faf9;
  border: 1px solid #e8efea;
  border-radius: 11px;
  padding: 14px;
  font-size: 12px;
}

.sa-status strong {
  display: block;
  margin-top: 7px;
  font-size: 16px;
  color: #087851;
}

.sa-status strong.fail-text {
  color: #b91c1c;
}

.sa-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 11px;
  background: #0f9064;
  color: white;
  padding: 13px 17px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.sa-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.sa-btn.gray {
  background: #64748b;
}

.sa-btn.blue {
  background: #347dca;
}

.sa-btn.red {
  background: #d33d43;
}

.sa-history {
  border: 1px solid #e3eae6;
  border-radius: 13px;
  padding: 16px;
  margin-bottom: 12px;
}

.sa-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.sa-history-head strong {
  font-size: 15px;
}

.sa-badge {
  border-radius: 20px;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 800;
  background: #eef3f0;
  color: #61766a;
}

.sa-badge.pass {
  background: #ddf7e7;
  color: #087a52;
}

.sa-badge.fail {
  background: #fee2e2;
  color: #b91c1c;
}

.sa-history-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid #edf1ee;
  padding: 11px 0;
  font-size: 12px;
}

.sa-history-item strong {
  text-align: right;
  overflow-wrap: anywhere;
}

.sa-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 15px;
}

.sa-error,
.sa-success,
.sa-warning {
  padding: 14px;
  margin: 12px 0;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.sa-error {
  background: #fff1f2;
  color: #b91c1c;
  border: 1px solid #fecdd3;
}

.sa-success {
  background: #edfbf2;
  color: #087a52;
  border: 1px solid #b9ebcf;
}

.sa-warning {
  background: #fff7e7;
  color: #98620d;
  border: 1px solid #f1dfb5;
}

.sa-empty {
  text-align: center;
  font-size: 12px;
  color: #788d82;
  border: 1px dashed #d8e8de;
  border-radius: 10px;
  padding: 15px;
}

.sa-footer {
  text-align: center;
  color: #90a198;
  font-size: 11px;
  padding: 20px;
}

/* =====================================================
   MODAL KONFIRMASI HAPUS
   ===================================================== */

.sa-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(5, 25, 23, .65);
}

.sa-modal {
  width: 100%;
  max-width: 440px;
  max-height: 90dvh;
  overflow-y: auto;
  background: #ffffff;
  color: #19352d;
  border-radius: 18px;
  padding: 25px;
  box-shadow: 0 22px 70px rgba(0,0,0,.25);
}

.sa-modal-icon {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin-bottom: 15px;
  border-radius: 15px;
  background: #fee8e9;
  font-size: 25px;
}

.sa-modal h2 {
  margin: 0 0 10px;
  font-size: 21px;
  font-weight: 900;
  color: #19352d;
}

.sa-modal p {
  margin: 0 0 16px;
  color: #64776d;
  font-size: 13px;
  line-height: 1.7;
}

.sa-modal-detail {
  border: 1px solid #e4ebe7;
  border-radius: 12px;
  padding: 4px 14px;
  background: #f8faf9;
}

.sa-modal-detail > div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px 0;
  border-bottom: 1px solid #e7eeea;
}

.sa-modal-detail > div:last-child {
  border-bottom: 0;
}

.sa-modal-detail span {
  color: #788e82;
  font-size: 11px;
}

.sa-modal-detail strong {
  color: #193d30;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.sa-modal-warning {
  margin-top: 16px;
  padding: 13px;
  border: 1px solid #f4dfb7;
  background: #fff8e9;
  color: #98620d;
  border-radius: 11px;
  font-size: 12px;
  line-height: 1.7;
}

.sa-modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 22px;
}

.sa-modal-actions .sa-btn {
  flex: 1;
  min-height: 46px;
  text-align: center;
}

/* =====================================================
   RESPONSIVE MOBILE
   ===================================================== */

@media (max-width: 760px) {
  .sa-topbar {
    padding: 13px 16px;
  }

  .sa-brand {
    font-size: 18px;
  }

  .sa-container {
    padding: 12px;
  }

  .sa-hero {
    padding: 23px 17px;
  }

  .sa-hero h1 {
    font-size: 24px;
  }

  .sa-card {
    padding: 15px;
  }

  .sa-card h2 {
    font-size: 16px;
  }

  .sa-grid {
    grid-template-columns: 1fr;
  }

  .sa-identity {
    padding: 12px;
    gap: 9px;
  }

  .sa-avatar {
    width: 44px;
    height: 44px;
  }

  .sa-test-row {
    grid-template-columns: minmax(0,1fr) 85px 80px;
    gap: 7px;
  }

  .sa-test-name {
    font-size: 11px;
  }

  .sa-test-score {
    font-size: 10px;
  }

  .sa-summary {
    gap: 7px;
  }

  .sa-summary-box {
    padding: 12px 5px;
  }

  .sa-summary-box strong {
    font-size: 19px;
  }

  .sa-summary-box span {
    font-size: 10px;
  }

  .sa-modal {
    padding: 20px;
  }

  .sa-modal h2 {
    font-size: 19px;
  }
}

@media (max-width: 370px) {
  .sa-test-row {
    grid-template-columns: 1fr 1fr;
  }

  .sa-test-name {
    grid-column: 1 / -1;
  }

  .sa-status-grid {
    grid-template-columns: 1fr;
  }

  .sa-modal-actions {
    flex-direction: column;
  }

  .sa-modal-actions .sa-btn {
    width: 100%;
  }
}
`;
