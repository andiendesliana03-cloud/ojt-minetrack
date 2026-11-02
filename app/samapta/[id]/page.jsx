
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0 — PENILAIAN SAMAPTA
//
// REFERENSI:
// FCT CREW ER GMO PERIODE FEB–MARET 2026.xlsx
// Sheet: SCORE SAMAPTA
//
// Tidak mengubah database, tabel, atau policy.
// Skor 0 adalah nilai yang sah.
// Nilai di luar cakupan referensi tidak diperkirakan.
// =====================================================

const TESTS = [
  { key: "lari", name: "Lari 12 Menit", unit: "Meter" },
  { key: "pull", name: "Pull-Up", unit: "Repetisi" },
  { key: "push", name: "Push-Up", unit: "Repetisi" },
  { key: "sit", name: "Sit-Up", unit: "Repetisi" },
  { key: "shuttle", name: "Shuttle Run", unit: "Detik" },
];

const AGES = [
  { value: "21-30", label: "21–30 Tahun" },
  { value: "31-40", label: "31–40 Tahun" },
];

// =====================================================
// SAMAPTA A — LARI 12 MENIT
//
// Setiap angka adalah ambang bawah jarak untuk skor
// 100, 99, 98, dan seterusnya sesuai urutan.
//
// Nilai hasil antara dua ambang menggunakan ambang
// bawah terdekat yang telah tercantum di Excel.
//
// Catatan: sheet Excel juga memuat contoh perhitungan
// jarak tambahan di bawah tabel utama. Contoh itu
// bukan pengganti tabel konversi utama.
// =====================================================

const RUN_THRESHOLDS = {
  "21-30": `
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
`,
  "31-40": `
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
`,
};

function numberList(text) {
  return text
    .trim()
    .split(/\s+/)
    .map(Number);
}

const RUN_TABLES = Object.fromEntries(
  Object.entries(RUN_THRESHOLDS).map(([age, text]) => [
    age,
    numberList(text),
  ])
);

// =====================================================
// SAMAPTA B — REPETISI
//
// Array: skor berdasarkan jumlah repetisi dari
// MIN sampai MAX.
//
// Usia 21–30:
// - Pull-Up: data eksplisit 0–52 kali
// - Push-Up: data eksplisit 0–100 kali
// - Sit-Up: data eksplisit 0–100 kali
//
// Untuk nilai di atas skor maksimal 100, skor tetap
// 100. Untuk nilai di bawah cakupan tabel, hasil
// konversi tidak ditebak.
// =====================================================

const REP_TABLES = {
  "21-30": {
    pull: {
      min: 0,
      max: 52,
      values: numberList(`
0 0 0 1 14 17 21 29 30 43 50 57 64 71 79
86 93 100
`),
      plateauFrom: 17,
    },
    push: {
      min: 0,
      max: 100,
      values: numberList(`
0 0 0 0 0 0 0 0 0 0 0 0 0
1 4 8 12 16 20 24 28 32 36 40 44 48
52 56 60 64 68 72 76 80 84 88 92 96
100
`),
      plateauFrom: 38,
    },
    sit: {
      min: 0,
      max: 100,
      values: numberList(`
0 0 0 0 0 0 0 0 0 0 0 0
1 3 6 9 12 15 18 21 24 27 30 33 36
39 42 45 48 51 54 58 61 64 67 70 73
76 79 82 85 88 91 94 97 100
`),
      plateauFrom: 44,
    },
  },

  "31-40": {
    pull: {
      min: 2,
      max: 14,
      values: numberList(`
1 8 17 25 33 42 50 58 67 75 83 92 100
`),
      plateauFrom: 14,
    },
    push: {
      min: 12,
      max: 37,
      values: numberList(`
1 4 8 12 16 20 24 28 32 36 40 44 48
52 56 60 64 68 72 76 80 84 88 92 96 100
`),
      plateauFrom: 37,
    },
    sit: {
      min: 10,
      max: 42,
      values: numberList(`
1 3 6 9 12 16 19 22 25 28 31 34
37 41 44 47 50 53 56 59 62 66 69
72 75 79 81 84 87 91 94 97 100
`),
      plateauFrom: 42,
    },
  },
};

// Koreksi khusus nilai dari sheet Excel.
// Dalam tabel 21–30 tahun:
// Pull-Up 8 = 30, Pull-Up 7 = 29,
// Pull-Up 6 = 21.
//
// Baris Push-Up 10 = 0 dan Sit-Up 25 = 39
// tersedia secara eksplisit.

function repetitionScore(type, count, age) {
  if (count === null || count === undefined) {
    return null;
  }

  if (
    !Number.isInteger(count) ||
    count < 0
  ) {
    return null;
  }

  const table = REP_TABLES[age]?.[type];
  if (!table) return null;

  if (count >= table.plateauFrom) {
    return 100;
  }

  if (
    count < table.min ||
    count > table.max
  ) {
    return null;
  }

  const index = count - table.min;
  const score = table.values[index];

  return Number.isFinite(score) ? score : null;
}

// =====================================================
// SHUTTLE RUN
//
// Skor bersumber dari sheet SCORE SAMAPTA.
// Waktu dinilai dalam kelipatan 0,1 detik.
//
// Usia 31–40 memiliki entri khusus 30 detik = 1.
// Rentang 21,0–29,9 tidak diisi karena tidak ada
// konversi eksplisit untuk rentang tersebut.
// =====================================================

const SHUTTLE_21 = numberList(`
100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 100
100 100 100 100 100 100 100 100 100 99
97 97 94 92 90 88 86 84 82 79
77 75 73 71 69 67 65 62 60 58
56 52 50 48 45 45 41 40 37 35
33 31 28 26 24 22 20 18 16 14
11 9 7 5 3 1 0 0 0 0
0 0 0 0 0
`);

const SHUTTLE_31 = numberList(`
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

  const rounded = Math.round(seconds * 10);

  if (Math.abs(seconds * 10 - rounded) > 0.000001) {
    return null;
  }

  if (age === "21-30") {
    if (seconds < 13) return 100;

    const index = rounded - 130;
    return SHUTTLE_21[index] ?? null;
  }

  if (age === "31-40") {
    if (seconds < 16.4) return 100;

    if (rounded === 300) return 1;

    const index = rounded - 164;
    return SHUTTLE_31[index] ?? null;
  }

  return null;
}

function runScore(distance, age) {
  if (
    distance === null ||
    !Number.isInteger(distance) ||
    distance < 0
  ) {
    return null;
  }

  const thresholds = RUN_TABLES[age];
  if (!thresholds) return null;

  for (let index = 0; index < thresholds.length; index++) {
    if (distance >= thresholds[index]) {
      return 100 - index;
    }
  }

  // Excel mencantumkan contoh eksplisit 0 m = 0
  // untuk kelompok 21–30 tahun.
  if (age === "21-30" && distance === 0) {
    return 0;
  }

  return null;
}

// =====================================================
// UTILITAS
// =====================================================

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
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
  if (value === "" || value == null) return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function fmt(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toLocaleString("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}

function dateText(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : String(value);
}

function getParticipant(program) {
  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  return participant || null;
}

function rating(value) {
  if (value == null) return "Belum tersedia";
  if (value >= 81) return "Baik Sekali";
  if (value >= 61) return "Baik";
  if (value >= 50) return "Cukup";
  if (value >= 21) return "Kurang";
  if (value >= 1) return "Kurang Sekali";
  return "Nilai 0";
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
    lari: runScore(raw.lari, form.age),
    pull: repetitionScore("pull", raw.pull, form.age),
    push: repetitionScore("push", raw.push, form.age),
    sit: repetitionScore("sit", raw.sit, form.age),
    shuttle: shuttleScore(raw.shuttle, form.age),
  };

  const bParts = [
    scores.pull,
    scores.push,
    scores.sit,
    scores.shuttle,
  ];

  const b = bParts.every((value) => value !== null)
    ? bParts.reduce((sum, value) => sum + value, 0) / 4
    : null;

  const final =
    scores.lari !== null && b !== null
      ? (scores.lari + b) / 2
      : null;

  const outcome =
    distance === null
      ? "pending"
      : distance >= 2600
      ? "pass"
      : "fail";

  return { raw, scores, b, final, outcome };
}

function parseAge(notes) {
  const match = String(notes || "").match(
    /USIA=(21-30|31-40)/
  );

  return match?.[1] || "21-30";
}

function groupRecords(records) {
  const dates = new Map();

  records.forEach((record) => {
    const date = String(record.test_date).slice(0, 10);

    if (!dates.has(date)) dates.set(date, []);

    dates.get(date).push(record);
  });

  return [...dates.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => {
      const byType = new Map(
        items.map((item) => [item.test_type, item])
      );

      const run = byType.get("Lari 12 Menit");

      const a =
        run?.score == null ? null : Number(run.score);

      const components = TESTS.slice(1).map((test) => {
        const record = byType.get(test.name);

        return record?.score == null
          ? null
          : Number(record.score);
      });

      const b = components.every(
        (value) => value !== null && Number.isFinite(value)
      )
        ? components.reduce((sum, value) => sum + value, 0) /
          4
        : null;

      const final =
        a !== null && Number.isFinite(a) && b !== null
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
        complete: TESTS.every((test) =>
          byType.has(test.name)
        ),
        outcome:
          distance === null
            ? "pending"
            : distance >= 2600
            ? "pass"
            : "fail",
      };
    });
}

// =====================================================
// KOMPONEN
// =====================================================

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
      <span className="sa-label">{label}</span>

      <input
        className="sa-field"
        type="number"
        inputMode="decimal"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      />
    </label>
  );
}

function ScoreRow({ label, value }) {
  return (
    <div className="sa-score-row">
      <span>{label}</span>

      <strong className={value === null ? "missing" : ""}>
        {value === null ? "Belum ada konversi" : fmt(value)}
      </strong>
    </div>
  );
}

// =====================================================
// HALAMAN PENILAIAN
// =====================================================

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

  const calc = useMemo(() => calculate(form), [form]);

  const participant = getParticipant(program);
  const name = participant?.full_name || "Peserta OJT";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const groups = useMemo(
    () => groupRecords(records),
    [records]
  );

  function change(key, value) {
    setForm((old) => ({ ...old, [key]: value }));
  }

  async function fetchRecords(id) {
    const { data, error: fetchError } = await supabase
      .from("samapta_records")
      .select(
        "id,program_id,test_date,test_type,result_value,result_unit,score,notes,outcome"
      )
      .eq("program_id", id)
      .order("test_date", { ascending: false });

    if (fetchError) throw fetchError;

    return data || [];
  }

  async function reload() {
    const latest = await fetchRecords(programId);
    setRecords(latest);
  }

  // ===================================================
  // LOAD & VERIFIKASI AKSES
  // ===================================================

  useEffect(() => {
    if (!programId) return;

    let active = true;
    const requestId = ++requestRef.current;

    async function initialize() {
      setLoading(true);
      setError("");
      setNotice("");
      setMentor(null);
      setProgram(null);
      setRecords([]);
      setForm(blankForm());
      setEditDate(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (
          String(profile?.role || "").toLowerCase() !==
          "mentor"
        ) {
          router.replace("/dashboard-peserta");
          return;
        }

        const { data: programData, error: programError } =
          await supabase
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

        if (programError) throw programError;

        if (!programData) {
          throw new Error(
            "Program tidak ditemukan atau bukan binaan Mentor ini."
          );
        }

        if (programData.status !== "active") {
          throw new Error("Program OJT sudah tidak aktif.");
        }

        const history = await fetchRecords(programId);

        if (!active || requestId !== requestRef.current) {
          return;
        }

        setMentor(profile);
        setProgram(programData);
        setRecords(history);
      } catch (err) {
        if (active && requestId === requestRef.current) {
          setError(
            err?.message || "Gagal memuat data Samapta."
          );
        }
      } finally {
        if (active && requestId === requestRef.current) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
      requestRef.current += 1;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, router]);

  function reset() {
    setForm(blankForm());
    setEditDate(null);
    setError("");
  }

  // ===================================================
  // SIMPAN LIMA KOMPONEN
  // ===================================================

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

    const { raw, scores, outcome } = calc;

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
        raw.shuttle * 10 - Math.round(raw.shuttle * 10)
      ) > 0.000001;

    if (
      !form.date ||
      raw.lari === null ||
      invalidRepetitions ||
      invalidShuttle
    ) {
      setError(
        "Periksa tanggal, jumlah putaran, tambahan jarak, " +
          "repetisi, dan waktu Shuttle Run (1 desimal)."
      );
      return;
    }

    const missing = TESTS.filter(
      (test) => scores[test.key] === null
    );

    if (missing.length) {
      setError(
        "Konversi belum tersedia pada tabel Excel untuk: " +
          missing.map((test) => test.name).join(", ") +
          ". Periksa hasil input dan kelompok usia. " +
          "Data belum disimpan agar skor tidak diperkirakan."
      );
      return;
    }

    if (editDate && editDate !== form.date) {
      setError(
        "Tanggal penilaian tidak boleh diubah saat mengedit."
      );
      return;
    }

    const existing = records.filter(
      (record) =>
        String(record.test_date).slice(0, 10) === form.date
    );

    if (!editDate && existing.length) {
      setError(
        "Tanggal ini sudah memiliki data Samapta. " +
          "Gunakan tombol Edit pada riwayat."
      );
      return;
    }

    const unknownType = existing.some(
      (record) =>
        !TESTS.some(
          (test) => test.name === record.test_type
        )
    );

    const duplicateType =
      new Set(existing.map((record) => record.test_type))
        .size !== existing.length;

    if (unknownType || duplicateType) {
      setError(
        "Ditemukan jenis tes tidak dikenal atau duplikat " +
          "pada tanggal ini. Periksa riwayat terlebih dahulu."
      );
      return;
    }

    const oldByType = new Map(
      existing.map((record) => [
        record.test_type,
        record,
      ])
    );

    const payloads = TESTS.map((test) => ({
      test_date: form.date,
      test_type: test.name,
      result_value: raw[test.key],
      result_unit: test.unit,
      score: scores[test.key],
      outcome:
        test.key === "lari" ? outcome : "pending",
      notes:
        test.key === "lari"
          ? `USIA=${form.age}; PUTARAN=${form.laps}; TAMBAHAN=${form.extra}; ${form.notes.trim()}`
          : form.notes.trim() || null,
    }));

    setSaving(true);

    try {
      const { data: activeProgram, error: activeError } =
        await supabase
          .from("ojt_programs")
          .select("id,status,mentor_id")
          .eq("id", programId)
          .eq("mentor_id", mentor.id)
          .eq("status", "active")
          .maybeSingle();

      if (activeError) throw activeError;

      if (!activeProgram) {
        throw new Error(
          "Program sudah tidak aktif atau akses Mentor berubah."
        );
      }

      // Struktur penyimpanan tetap mengikuti
      // aplikasi sebelumnya: satu baris per komponen.
      for (const payload of payloads) {
        const old = oldByType.get(payload.test_type);

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

        if (result.error) throw result.error;

        if (!result.data?.length) {
          throw new Error(
            `Gagal menyimpan ${payload.test_type}`
          );
        }
      }

      await reload();
      reset();

      setNotice(
        "Samapta A dan seluruh empat komponen Samapta B " +
          "berhasil disimpan."
      );
    } catch (err) {
      setError(
        `${err?.message || "Gagal menyimpan"}. ` +
          "Penyimpanan dilakukan per komponen, sehingga " +
          "sebagian data mungkin sudah tersimpan. " +
          "Periksa riwayat sebelum mencoba kembali."
      );

      try {
        await reload();
      } catch {
        // Pertahankan pesan kesalahan utama.
      }
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // EDIT DATA TANGGAL YANG SAMA
  // ===================================================

  function edit(group) {
    if (saving || busy || !program) return;

    const get = (name) => group.byType.get(name);

    const run = get("Lari 12 Menit");
    const distance =
      run?.result_value == null
        ? null
        : Number(run.result_value);

    const saved = String(run?.notes || "");

    const age = parseAge(saved);

    const laps = saved.match(/PUTARAN=(\d+)/)?.[1];

    const extra = saved.match(/TAMBAHAN=(\d+)/)?.[1];

    setForm({
      date: group.date,
      age,
      laps:
        laps ??
        (distance === null
          ? ""
          : String(Math.floor(distance / 400))),
      extra:
        extra ??
        (distance === null
          ? ""
          : String(distance % 400)),
      pull:
        get("Pull-Up")?.result_value?.toString() ?? "",
      push:
        get("Push-Up")?.result_value?.toString() ?? "",
      sit:
        get("Sit-Up")?.result_value?.toString() ?? "",
      shuttle:
        get("Shuttle Run")?.result_value?.toString() ?? "",
      notes: get("Push-Up")?.notes || "",
    });

    setEditDate(group.date);
    setError("");
    setNotice("");

    document
      .getElementById("samapta-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  // ===================================================
  // HAPUS SELURUH SESI SAMAPTA
  // ===================================================

  async function remove(group) {
    if (
      saving ||
      busy ||
      !mentor ||
      !program ||
      program.id !== programId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Hapus semua penilaian Samapta tanggal ` +
          `${dateText(group.date)} untuk ${name}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const ids = group.items.map((record) => record.id);

      const { data, error: deleteError } = await supabase
        .from("samapta_records")
        .delete()
        .eq("program_id", programId)
        .in("id", ids)
        .select("id");

      if (deleteError) throw deleteError;

      if (data?.length !== ids.length) {
        throw new Error(
          "Sebagian data tidak berhasil dihapus."
        );
      }

      await reload();

      if (editDate === group.date) reset();

      setNotice(
        "Seluruh penilaian pada tanggal tersebut berhasil dihapus."
      );
    } catch (err) {
      setError(
        err?.message || "Gagal menghapus penilaian."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sa-root">
      <style>{styles}</style>

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
        <section className="sa-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Monitoring Samapta</h1>

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
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <p className="sa-error">
              {error || "Program tidak ditemukan."}
            </p>
          </section>
        ) : (
          <>
            <section className="sa-card">
              <div className="sa-identity">
                <div className="sa-avatar">
                  {initials}
                </div>

                <div className="sa-person">
                  <strong>{name}</strong>

                  <small>
                    {participant?.department || "—"}
                    {" · "}
                    {program.site || "—"}
                  </small>

                  <small>
                    {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </small>
                </div>

                <span className="sa-active">Aktif</span>
              </div>

              <div className="sa-lock">
                Penilaian hanya dapat dilakukan Mentor
                untuk peserta binaannya.
              </div>
            </section>

            {error && (
              <div className="sa-error" role="alert">
                {error}
              </div>
            )}

            {notice && (
              <div className="sa-success" role="status">
                ✓ {notice}
              </div>
            )}

            <form onSubmit={save} id="samapta-form">
              <section className="sa-card">
                <h2>
                  {editDate
                    ? "Edit Penilaian Samapta"
                    : "Data Penilaian Samapta"}
                </h2>

                <div className="sa-grid">
                  <label className="sa-field-wrap">
                    <span className="sa-label">
                      Tanggal Pelaksanaan
                    </span>

                    <input
                      className="sa-field"
                      type="date"
                      value={form.date}
                      disabled={!!editDate || saving}
                      onChange={(event) =>
                        change("date", event.target.value)
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
                        change("age", event.target.value)
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

              <div className="sa-grid">
                <section className="sa-card">
                  <h2>Samapta A — Lari 12 Menit</h2>

                  <p className="sa-muted">
                    Satu putaran = 400 meter.
                  </p>

                  <div className="sa-grid">
                    <Field
                      label="Jumlah Putaran"
                      value={form.laps}
                      disabled={saving}
                      onChange={(value) =>
                        change("laps", value)
                      }
                    />

                    <Field
                      label="Tambahan Jarak (0–399 m)"
                      value={form.extra}
                      max="399"
                      disabled={saving}
                      onChange={(value) =>
                        change("extra", value)
                      }
                    />
                  </div>

                  <div className="sa-result">
                    <small>Total Jarak</small>
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
                    value={calc.scores.lari}
                  />

                  <p className="sa-muted">
                    Batas kelulusan jarak lari yang
                    dipertahankan dari kode sebelumnya:
                    2.600 meter.
                  </p>
                </section>

                <section className="sa-card">
                  <h2>Samapta B — Tes Fisik</h2>

                  <p className="sa-muted">
                    Skor menggunakan tabel Excel
                    sesuai kelompok usia.
                  </p>

                  {[
                    ["pull", "Pull-Up", "1"],
                    ["push", "Push-Up", "1"],
                    ["sit", "Sit-Up", "1"],
                    ["shuttle", "Shuttle Run (detik)", "0.1"],
                  ].map(([key, label, step]) => (
                    <div className="sa-test-row" key={key}>
                      <span className="sa-test-name">
                        {label}
                      </span>

                      <Field
                        label="Hasil"
                        value={form[key]}
                        step={step}
                        disabled={saving}
                        onChange={(value) =>
                          change(key, value)
                        }
                      />

                      <div
                        className={
                          calc.scores[key] === null
                            ? "sa-test-score missing"
                            : "sa-test-score"
                        }
                      >
                        {calc.scores[key] === null
                          ? "—"
                          : `Skor ${calc.scores[key]}`}
                      </div>
                    </div>
                  ))}

                  <p className="sa-muted">
                    Skor 0 adalah nilai yang valid,
                    bukan data kosong.
                  </p>
                </section>
              </div>

              <section className="sa-card">
                <h2>Hasil Perhitungan Otomatis</h2>

                <div className="sa-summary">
                  <div className="sa-summary-box">
                    <span>Nilai A</span>
                    <strong>
                      {fmt(calc.scores.lari)}
                    </strong>
                  </div>

                  <div className="sa-summary-box">
                    <span>Nilai B</span>
                    <strong>{fmt(calc.b)}</strong>
                  </div>

                  <div className="sa-summary-box">
                    <span>Nilai Akhir</span>
                    <strong>
                      {fmt(calc.final)}
                    </strong>
                  </div>
                </div>

                <div className="sa-status-grid">
                  <div className="sa-status">
                    Kategori CCR
                    <strong>
                      {rating(calc.final)}
                    </strong>
                  </div>

                  <div className="sa-status">
                    Status Kelulusan Lari
                    <strong>
                      {calc.outcome === "pass"
                        ? "LULUS"
                        : calc.outcome === "fail"
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

              <section className="sa-card">
                <label className="sa-field-wrap">
                  <span className="sa-label">
                    Catatan Evaluasi Mentor
                  </span>

                  <textarea
                    className="sa-field"
                    rows={4}
                    value={form.notes}
                    disabled={saving}
                    onChange={(event) =>
                      change("notes", event.target.value)
                    }
                    placeholder="Catatan hasil tes fisik peserta..."
                  />
                </label>

                <button
                  type="submit"
                  className="sa-btn"
                  disabled={saving || busy}
                  style={{ width: "100%" }}
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
                    disabled={saving}
                    onClick={reset}
                    style={{
                      width: "100%",
                      marginTop: 10,
                    }}
                  >
                    Batal Edit
                  </button>
                )}

                <p className="sa-muted">
                  Data hanya dapat disimpan bila
                  seluruh komponen memiliki skor
                  konversi sesuai referensi.
                </p>
              </section>
            </form>

            <section className="sa-card">
              <h2>Riwayat Penilaian Samapta</h2>

              <p className="sa-muted">
                {groups.length} tanggal penilaian
                untuk {name}.
              </p>

              {!groups.length && (
                <div className="sa-empty">
                  Belum ada hasil tes Samapta
                  yang tersimpan.
                </div>
              )}

              {groups.map((group) => (
                <article
                  key={group.date}
                  className="sa-history"
                >
                  <div className="sa-history-head">
                    <strong>
                      {dateText(group.date)}
                    </strong>

                    <span
                      className={
                        "sa-badge " + group.outcome
                      }
                    >
                      {group.outcome === "pass"
                        ? "Lulus Lari"
                        : group.outcome === "fail"
                        ? "Belum Lulus Lari"
                        : "Belum Dinilai"}
                    </span>
                  </div>

                  <h3>Samapta A</h3>

                  <HistoryItem
                    test={TESTS[0]}
                    record={group.byType.get(
                      "Lari 12 Menit"
                    )}
                  />

                  <h3>Samapta B</h3>

                  {TESTS.slice(1).map((test) => (
                    <HistoryItem
                      key={test.key}
                      test={test}
                      record={group.byType.get(test.name)}
                    />
                  ))}

                  <div className="sa-summary">
                    <div className="sa-summary-box">
                      <span>Nilai A</span>
                      <strong>{fmt(group.a)}</strong>
                    </div>

                    <div className="sa-summary-box">
                      <span>Nilai B</span>
                      <strong>{fmt(group.b)}</strong>
                    </div>

                    <div className="sa-summary-box">
                      <span>Nilai Akhir</span>
                      <strong>{fmt(group.final)}</strong>
                    </div>
                  </div>

                  {!group.complete && (
                    <p className="sa-warning">
                      Sesi ini belum memiliki seluruh
                      lima komponen Samapta.
                    </p>
                  )}

                  <p className="sa-muted">
                    Kategori CCR:{" "}
                    <strong>
                      {rating(group.final)}
                    </strong>
                  </p>

                  <div className="sa-actions">
                    <button
                      type="button"
                      className="sa-btn blue"
                      disabled={saving || busy}
                      onClick={() => edit(group)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="sa-btn red"
                      disabled={saving || busy}
                      onClick={() => remove(group)}
                    >
                      {busy ? "Memproses..." : "Hapus"}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}

        <footer className="sa-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

function HistoryItem({ test, record }) {
  return (
    <div className="sa-history-item">
      <span>{test.name}</span>

      <strong>
        {record?.result_value == null
          ? "Belum tercatat"
          : `${record.result_value} ${
              record.result_unit || test.unit
            } · Skor ${
              record.score === null ||
              record.score === undefined
                ? "—"
                : record.score
            }`}
      </strong>
    </div>
  );
}

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

.sa-topbar {
  background: #081f27;
  color: #fff;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  color: #efc77b;
  letter-spacing: 1px;
  font-size: 10px;
  font-weight: 800;
}

.sa-hero h1 {
  margin: 14px 0 8px;
  font-size: 30px;
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
  margin: 0 0 15px;
  font-size: 18px;
}

.sa-card h3 {
  color: #0d7250;
  font-size: 14px;
  margin: 20px 0 10px;
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
  margin-top: 5px;
  font-size: 11px;
}

.sa-active {
  background: #dff7e8;
  color: #087d4e;
  padding: 7px 11px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 800;
}

.sa-lock {
  margin-top: 13px;
  background: #effaf3;
  border: 1px solid #d3ebdb;
  border-radius: 11px;
  padding: 12px;
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
  margin-bottom: 16px;
  min-width: 0;
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
  font: inherit;
  font-size: 16px;
  padding: 12px;
}

.sa-result {
  padding: 15px;
  background: #effaf4;
  border: 1px solid #d6ebdf;
  border-radius: 12px;
  margin-bottom: 14px;
}

.sa-result small {
  display: block;
  color: #718a7a;
}

.sa-result strong {
  display: block;
  color: #087a53;
  font-size: 25px;
  margin-top: 7px;
}

.sa-score-row,
.sa-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e8efeb;
  font-size: 12px;
}

.sa-score-row strong,
.sa-history-item strong {
  color: #087b56;
  text-align: right;
}

.sa-score-row strong.missing {
  color: #b36c2d;
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
  border-radius: 9px;
  text-align: center;
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
  border: 1px solid #e5ece8;
  background: #f7faf8;
  border-radius: 12px;
  padding: 17px 10px;
  text-align: center;
}

.sa-summary-box span {
  color: #778b7e;
  font-size: 11px;
  display: block;
}

.sa-summary-box strong {
  color: #174132;
  font-size: 24px;
  display: block;
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
  color: #087851;
  margin-top: 7px;
  font-size: 16px;
}

.sa-btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  border: 0;
  padding: 13px 17px;
  border-radius: 11px;
  background: #0f9064;
  color: white;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.sa-btn:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.sa-btn.blue {
  background: #347dca;
}

.sa-btn.red {
  background: #d33d43;
}

.sa-btn.gray {
  background: #64748b;
}

.sa-history {
  border: 1px solid #e3eae6;
  border-radius: 13px;
  padding: 16px;
  margin-bottom: 12px;
}

.sa-history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.sa-history-head strong {
  font-size: 15px;
}

.sa-badge {
  background: #eef3f0;
  color: #61766a;
  border-radius: 20px;
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 800;
}

.sa-badge.pass {
  background: #ddf7e7;
  color: #087a52;
}

.sa-badge.fail {
  background: #fee2e2;
  color: #b91c1c;
}

.sa-actions {
  display: flex;
  gap: 9px;
  margin-top: 15px;
}

.sa-error,
.sa-success,
.sa-warning {
  border-radius: 11px;
  padding: 14px;
  margin-bottom: 15px;
  font-size: 12px;
  line-height: 1.7;
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
  color: #788d82;
  font-size: 12px;
  padding: 15px;
  text-align: center;
  border: 1px dashed #d8e8de;
  border-radius: 10px;
}

.sa-footer {
  text-align: center;
  color: #90a198;
  font-size: 11px;
  padding: 20px;
}

@media(max-width:760px) {
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

  .sa-grid {
    grid-template-columns: 1fr;
  }

  .sa-identity {
    gap: 9px;
    padding: 12px;
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
}

@media(max-width:370px) {
  .sa-test-row {
    grid-template-columns: 1fr 1fr;
  }

  .sa-test-name {
    grid-column: 1 / -1;
  }

  .sa-status-grid {
    grid-template-columns: 1fr;
  }
}
`;
