
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// Tabel konversi yang ditranskripsi dari foto.
// Nilai yang belum dapat diverifikasi tidak ditebak.

const RUN_31 = [
  [3244, Infinity], [3223, 3243], [3203, 3222],
  [3183, 3202], [3162, 3182], [3142, 3161],
  [3121, 3141], [3101, 3120], [3081, 3100],
  [3060, 3080], [3040, 3059], [3019, 3039],
  [2999, 3018], [2979, 2998], [2958, 2978],
  [2938, 2957], [2917, 2937], [2897, 2916],
  [2877, 2896], [2856, 2876], [2836, 2855],
  [2815, 2835], [2795, 2814], [2775, 2794],
  [2754, 2774], [2734, 2753], [2713, 2733],
  [2693, 2712], [2673, 2692], [2652, 2672],
  [2632, 2651], [2612, 2631], [2591, 2611],
  [2571, 2590], [2550, 2570], [2530, 2549],
  [2509, 2529], [2489, 2508], [2469, 2488],
  [2448, 2468], [2428, 2447], [2407, 2427],
  [2387, 2406], [2367, 2386], [2346, 2366],
  [2326, 2345], [2305, 2325], [2285, 2304],
  [2265, 2284], [2244, 2264], [2224, 2243],
  [2203, 2223], [2183, 2202], [2163, 2182],
  [2142, 2162], [2122, 2141], [2101, 2121],
  [2081, 2100], [2061, 2080], [2040, 2060],
  [2020, 2039], [1999, 2019], [1979, 1998],
  [1959, 1978], [1938, 1958], [1918, 1937],
  [1897, 1917], [1877, 1896], [1857, 1876],
  [1836, 1856],
];

const RUN_21 = [
  [3400, Infinity], [3387, 3399], [3362, 3386],
  [3346, 3361], [3323, 3345], [3305, 3322],
  [3285, 3304], [3264, 3284], [3244, 3263],
  [3223, 3243], [3203, 3222], [3181, 3202],
  [3162, 3180], [3142, 3161], [3121, 3141],
  [3101, 3120], [3081, 3100], [3060, 3080],
  [3040, 3059], [3019, 3039], [2999, 3018],
  [2979, 2998], [2958, 2978], [2938, 2957],
  [2917, 2937], [2897, 2916], [2877, 2896],
  [2856, 2876], [2836, 2855], [2815, 2835],
  [2795, 2814], [2775, 2794], [2754, 2774],
  [2734, 2753], [2713, 2733], [2693, 2712],
  [2673, 2692], [2652, 2672], [2632, 2651],
  [2612, 2631], [2591, 2611], [2571, 2590],
  [2550, 2570], [2530, 2549], [2509, 2529],
  [2489, 2508], [2469, 2488], [2448, 2468],
  [2428, 2447], [2407, 2427], [2387, 2406],
  [2367, 2386], [2346, 2366], [2326, 2345],
  [2305, 2325], [2285, 2304], [2265, 2284],
  [2244, 2263], [2224, 2243], [2203, 2223],
  [2183, 2202], [2163, 2182], [2142, 2162],
  [2122, 2141], [2101, 2121], [2081, 2100],
  [2061, 2080], [2040, 2060], [2020, 2039],
  [1999, 2019],
];

function runScore(distance, age) {
  if (distance == null) return null;

  const rows = age === "31-40" ? RUN_31 : RUN_21;

  const index = rows.findIndex(
    ([min, max]) => distance >= min && distance <= max
  );

  return index < 0 ? null : 100 - index;
}

const SHUTTLE_31 = [
  100, 99, 96, 94, 92, 90, 88, 86, 83, 81,
  79, 77, 75, 73, 70, 68, 66, 64, 62, 59,
  57, 55, 53, 51, 49, 46, 44, 42, 40, 37,
  35, 33, 31, 30, 28, 26, 24, 22, 20, 18,
  16, 14, 12, 10, 7, 5, 3,
];

const SHUTTLE_21 = [
  ...Array(29).fill(100),
  99, 97, 97, 94, 92, 90, 88, 86, 84, 82,
  79, 77, 75, 73, 71, 69, 67, 65, 62, 60,
  58, 56, 53, 50, 48, 45, 43, 41, 40, 37,
  35, 33, 31, 28, 26, 24, 22, 20, 18,
  16, 14,
];

function shuttleScore(seconds, age) {
  if (seconds == null) return null;

  if (age === "31-40") {
    if (seconds <= 16.4) return 100;

    const index = Math.round(
      (seconds - 16.4) * 10
    );

    return SHUTTLE_31[index] ?? null;
  }

  if (seconds <= 13) return 100;

  const index = Math.round(
    (seconds - 13) * 10
  );

  return SHUTTLE_21[index] ?? null;
}

const PUSH_31 = {
  37: 100, 36: 96, 35: 92, 34: 88,
  33: 84, 32: 80, 31: 76, 30: 72,
  29: 68, 28: 64, 27: 60, 26: 56,
  25: 52, 24: 48, 23: 44, 22: 40,
  21: 36, 20: 32, 19: 28, 18: 24,
  17: 20, 16: 16, 15: 12, 14: 8,
  13: 4, 12: 1,
};

const SIT_31 = {
  42: 100, 41: 97, 40: 94, 39: 91,
  38: 87, 37: 84, 36: 81, 35: 79,
  34: 75, 33: 72, 32: 69, 31: 66,
  30: 62, 29: 59, 28: 56, 27: 53,
  26: 50, 25: 47, 24: 44, 23: 41,
  22: 37, 21: 34, 20: 31, 19: 28,
  18: 25, 17: 22, 16: 19, 15: 16,
  14: 12, 13: 9, 12: 6, 11: 3,
  10: 1,
};

const PULL_31 = {
  14: 100, 13: 92, 12: 83, 11: 75,
  10: 67, 9: 58, 8: 50, 7: 42,
  6: 33, 5: 25, 4: 17, 3: 8,
  2: 1, 1: 0, 0: 0,
};

const PULL_21 = {
  17: 100, 16: 93, 15: 86, 14: 79,
  13: 71, 12: 64, 11: 57, 10: 50,
  9: 43, 8: 36, 7: 29, 6: 21,
};

const PUSH_21 = {
  37: 96, 36: 92, 35: 88, 34: 84,
  33: 80, 32: 76, 31: 72,
};

const SIT_21 = {
  44: 97, 43: 94, 42: 91, 41: 88,
  40: 85, 39: 82, 38: 79, 37: 76,
  36: 73, 35: 70, 34: 67, 33: 64,
  32: 61, 31: 58,
};

function repetitionScore(type, count, age) {
  if (count == null) return null;

  if (age === "31-40") {
    const table =
      type === "pull"
        ? PULL_31
        : type === "push"
        ? PUSH_31
        : SIT_31;

    const max =
      type === "pull"
        ? 14
        : type === "push"
        ? 37
        : 42;

    if (count >= max) return 100;

    return table[count] ?? null;
  }

  if (type === "pull") {
    return count >= 17
      ? 100
      : PULL_21[count] ?? null;
  }

  if (type === "push") {
    return count >= 38
      ? 100
      : PUSH_21[count] ?? null;
  }

  if (type === "sit") {
    return count >= 45
      ? 100
      : SIT_21[count] ?? null;
  }

  return null;
}

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

const box = {
  background: "rgba(255,255,255,.97)",
  border: "1px solid #e2e8f0",
  borderRadius: 15,
  padding: 18,
  marginBottom: 16,
};

const field = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  padding: 12,
  fontSize: 16,
  marginTop: 6,
};

const button = {
  background: "#2563eb",
  color: "white",
  border: 0,
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

function localToday() {
  const d = new Date();

  return new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 10);
}

function blank() {
  return {
    date: localToday(),
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
  if (value === "" || value == null) {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function fmt(value) {
  return value == null
    ? "—"
    : Number(value).toFixed(2);
}

function dateText(value) {
  return value
    ? value.split("-").reverse().join("/")
    : "—";
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
    laps != null &&
    extra != null &&
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
    (value) => value != null
  )
    ? bParts.reduce(
        (sum, value) => sum + value,
        0
      ) / 4
    : null;

  const final =
    scores.lari != null && b != null
      ? (scores.lari + b) / 2
      : null;

  const outcome =
    distance == null
      ? "pending"
      : distance >= 2600
      ? "pass"
      : "fail";

  return {
    raw,
    scores,
    b,
    final,
    outcome,
  };
}

function Input({
  title,
  value,
  change,
  step = "1",
  max,
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 14,
      }}
    >
      <strong>{title}</strong>

      <input
        type="number"
        min="0"
        max={max}
        step={step}
        required
        value={value}
        onChange={(e) =>
          change(e.target.value)
        }
        style={field}
      />
    </label>
  );
}

function Score({ name, score }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <span>{name}</span>

      <strong>
        {score == null
          ? "Belum ada konversi"
          : score}
      </strong>
    </div>
  );
}

export default function MonitoringSamapta() {
  const router = useRouter();
  const params = useParams();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(blank);

  const [editDate, setEditDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const calc = useMemo(
    () => calculate(form),
    [form]
  );

  const change = (key, value) => {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  };

  async function reload() {
    const {
      data,
      error: queryError,
    } = await supabase
      .from("samapta_records")
      .select(
        "id,test_date,test_type,result_value,result_unit,score,notes,outcome"
      )
      .eq("program_id", programId)
      .order("test_date", {
        ascending: false,
      });

    if (queryError) {
      throw queryError;
    }

    setRecords(data || []);
  }

  useEffect(() => {
    if (!programId) return;

    let active = true;

    async function initialize() {
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

        if (profileError) {
          throw profileError;
        }

        if (profile?.role !== "mentor") {
          router.replace("/peserta");
          return;
        }

        const {
          data: programData,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(
            "id,start_date,end_date,status"
          )
          .eq("id", programId)
          .single();

        if (programError) {
          throw programError;
        }

        if (!active) return;

        setMentor(profile);
        setProgram(programData);

        await reload();
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat data."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router]);

  const groups = useMemo(() => {
    const dates = new Map();

    records.forEach((record) => {
      if (!dates.has(record.test_date)) {
        dates.set(record.test_date, []);
      }

      dates.get(record.test_date).push(record);
    });

    return [...dates.entries()]
      .sort((a, b) =>
        b[0].localeCompare(a[0])
      )
      .map(([date, items]) => {
        const byType = new Map(
          items.map((record) => [
            record.test_type,
            record,
          ])
        );

        const run = byType.get(
          "Lari 12 Menit"
        );

        const distance =
          run?.result_value == null
            ? null
            : Number(run.result_value);

        const a =
          run?.score == null
            ? null
            : Number(run.score);

        const others = TESTS.slice(1).map(
          (test) => {
            const value = byType.get(
              test.name
            )?.score;

            return value == null
              ? null
              : Number(value);
          }
        );

        const b = others.every(
          (value) => value != null
        )
          ? others.reduce(
              (sum, value) => sum + value,
              0
            ) / 4
          : null;

        const final =
          a != null && b != null
            ? (a + b) / 2
            : null;

        return {
          date,
          items,
          byType,
          distance,
          a,
          b,
          final,
          outcome:
            distance == null
              ? "pending"
              : distance >= 2600
              ? "pass"
              : "fail",
        };
      });
  }, [records]);

  function reset() {
    setForm(blank());
    setEditDate(null);
    setError("");
  }

  async function save(event) {
    event.preventDefault();

    if (saving || !mentor || !program) {
      return;
    }

    setError("");
    setNotice("");

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
        value == null ||
        !Number.isInteger(value) ||
        value < 0
    );

    const invalidShuttle =
      raw.shuttle == null ||
      raw.shuttle < 0 ||
      Math.abs(
        raw.shuttle * 10 -
          Math.round(raw.shuttle * 10)
      ) > 0.000001;

    if (
      !form.date ||
      raw.lari == null ||
      invalidRepetitions ||
      invalidShuttle
    ) {
      setError(
        "Periksa putaran, tambahan jarak, repetisi, dan waktu Shuttle Run (1 desimal)."
      );
      return;
    }

    if (
      Object.values(scores).some(
        (value) => value == null
      )
    ) {
      setError(
        "Ada hasil tes yang belum memiliki angka konversi pada foto Excel. Data tidak disimpan agar skor peserta tidak keliru."
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
        record.test_date === form.date
    );

    if (
      !editDate &&
      existing.length
    ) {
      setError(
        "Tanggal ini sudah memiliki data. Gunakan Edit Penilaian."
      );
      return;
    }

    const unknownType = existing.some(
      (record) =>
        !TESTS.some(
          (test) =>
            test.name === record.test_type
        )
    );

    const duplicateType =
      new Set(
        existing.map(
          (record) => record.test_type
        )
      ).size !== existing.length;

    if (unknownType || duplicateType) {
      setError(
        "Ada data tes lama atau duplikat pada tanggal ini. Periksa riwayat sebelum menyimpan."
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
      for (const payload of payloads) {
        const old = oldByType.get(
          payload.test_type
        );

        const response = old
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

        if (response.error) {
          throw response.error;
        }

        if (!response.data?.length) {
          throw new Error(
            `Gagal menyimpan ${payload.test_type}`
          );
        }
      }

      await reload();

      reset();

      setNotice(
        "Kelima hasil tes dan skor otomatis berhasil disimpan."
      );
    } catch (err) {
      setError(
        `${err.message || "Gagal menyimpan"}. Sebagian komponen mungkin sudah tersimpan; periksa riwayat sebelum mengulang.`
      );

      try {
        await reload();
      } catch {
        // Pesan kesalahan utama tetap ditampilkan.
      }
    } finally {
      setSaving(false);
    }
  }

  function edit(group) {
    const get = (name) =>
      group.byType.get(name);

    const run = get("Lari 12 Menit");

    const distance =
      run?.result_value == null
        ? null
        : Number(run.result_value);

    const saved = run?.notes || "";

    const age = saved.match(
      /USIA=(21-30|31-40)/
    )?.[1];

    const laps = saved.match(
      /PUTARAN=(\d+)/
    )?.[1];

    const extra = saved.match(
      /TAMBAHAN=(\d+)/
    )?.[1];

    setForm({
      date: group.date,
      age: age || "21-30",
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
          ?.result_value?.toString() ?? "",
      push:
        get("Push-Up")
          ?.result_value?.toString() ?? "",
      sit:
        get("Sit-Up")
          ?.result_value?.toString() ?? "",
      shuttle:
        get("Shuttle Run")
          ?.result_value?.toString() ?? "",
      notes:
        get("Push-Up")?.notes || "",
    });

    setEditDate(group.date);
    setError("");
    setNotice("");

    document
      .getElementById("samapta-form")
      ?.scrollIntoView({
        behavior: "smooth",
      });
  }

  async function remove(group) {
    if (busy || saving) return;

    if (
      !window.confirm(
        `Hapus seluruh penilaian Samapta tanggal ${dateText(group.date)}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const ids = group.items.map(
        (record) => record.id
      );

      const {
        data,
        error: deleteError,
      } = await supabase
        .from("samapta_records")
        .delete()
        .eq("program_id", programId)
        .in("id", ids)
        .select("id");

      if (deleteError) {
        throw deleteError;
      }

      if (data?.length !== ids.length) {
        throw new Error(
          "Sebagian data tidak terhapus."
        );
      }

      await reload();

      if (editDate === group.date) {
        reset();
      }

      setNotice(
        "Penilaian berhasil dihapus."
      );
    } catch (err) {
      setError(
        err.message || "Gagal menghapus data."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        backgroundImage:
          'linear-gradient(rgba(241,245,249,.87),rgba(241,245,249,.95)),url("/background-erg.png.PNG")',
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
        padding: 18,
        color: "#0f172a",
        fontFamily: "Arial,sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 850,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            ...box,
            background: "#0f172a",
            color: "white",
          }}
        >
          <h1>Penilaian Samapta ERG</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>
            OJT MineTrack — Dashboard Mentor
          </small>
        </header>

        <button
          type="button"
          style={{
            ...button,
            background: "#475569",
            marginBottom: 16,
          }}
          onClick={() =>
            router.push(
              `/peserta/${programId}`
            )
          }
        >
          ← Kembali ke Detail Peserta
        </button>

        {loading ? (
          <section style={box}>
            Memuat data...
          </section>
        ) : !mentor || !program ? (
          <section style={box}>
            <strong>
              Data tidak dapat ditampilkan.
            </strong>
            <p>
              {error ||
                "Akses tidak tersedia."}
            </p>
          </section>
        ) : (
          <>
            <section style={box}>
              <h2>Informasi Monitoring</h2>

              <p>
                Mentor:{" "}
                <strong>
                  {mentor.full_name}
                </strong>
              </p>

              <p>
                Periode OJT:{" "}
                {dateText(
                  program.start_date
                )}{" "}
                –{" "}
                {dateText(
                  program.end_date
                )}
              </p>

              <p>
                Kelulusan:{" "}
                <strong>
                  lari 12 menit minimal
                  2.600 meter
                </strong>
                .
              </p>
            </section>

            {error && (
              <section
                style={{
                  ...box,
                  color: "#b91c1c",
                }}
                role="alert"
              >
                {error}
              </section>
            )}

            {notice && (
              <section
                style={{
                  ...box,
                  color: "#15803d",
                }}
                role="status"
              >
                {notice}
              </section>
            )}

            <section
              style={box}
              id="samapta-form"
            >
              <h2>
                {editDate
                  ? "Edit Penilaian Samapta"
                  : "Input Penilaian Samapta"}
              </h2>

              <form onSubmit={save}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 14,
                  }}
                >
                  <strong>
                    Tanggal Pelaksanaan
                  </strong>

                  <input
                    type="date"
                    style={field}
                    value={form.date}
                    disabled={!!editDate}
                    onChange={(e) =>
                      change(
                        "date",
                        e.target.value
                      )
                    }
                    required
                  />
                </label>

                <label
                  style={{
                    display: "block",
                    marginBottom: 14,
                  }}
                >
                  <strong>
                    Kelompok Usia Peserta
                  </strong>

                  <select
                    style={field}
                    value={form.age}
                    onChange={(e) =>
                      change(
                        "age",
                        e.target.value
                      )
                    }
                  >
                    <option value="21-30">
                      21–30 Tahun
                    </option>

                    <option value="31-40">
                      31–40 Tahun
                    </option>
                  </select>
                </label>

                <div
                  style={{
                    background: "#eff6ff",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <h3>
                    Samapta A — Lari 12 Menit
                  </h3>

                  <Input
                    title="Jumlah Putaran (1 putaran = 400 m)"
                    value={form.laps}
                    change={(value) =>
                      change("laps", value)
                    }
                  />

                  <Input
                    title="Tambahan Jarak (0–399 meter)"
                    value={form.extra}
                    max="399"
                    change={(value) =>
                      change("extra", value)
                    }
                  />

                  <p>
                    Total jarak:{" "}
                    <strong>
                      {calc.raw.lari == null
                        ? "—"
                        : `${calc.raw.lari.toLocaleString("id-ID")} meter`}
                    </strong>
                  </p>

                  <Score
                    name="Skor Lari / Nilai A"
                    score={calc.scores.lari}
                  />
                </div>

                <div
                  style={{
                    background: "#f0fdf4",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <h3>
                    Samapta B — Tes Fisik
                  </h3>

                  {[
                    {
                      key: "pull",
                      title:
                        "Pull-Up (repetisi)",
                    },
                    {
                      key: "push",
                      title:
                        "Push-Up (repetisi)",
                    },
                    {
                      key: "sit",
                      title:
                        "Sit-Up (repetisi)",
                    },
                    {
                      key: "shuttle",
                      title:
                        "Shuttle Run (detik)",
                    },
                  ].map((test) => (
                    <div
                      key={test.key}
                      style={{
                        marginBottom: 18,
                      }}
                    >
                      <Input
                        title={test.title}
                        step={
                          test.key ===
                          "shuttle"
                            ? "0.1"
                            : "1"
                        }
                        value={
                          form[test.key]
                        }
                        change={(value) =>
                          change(
                            test.key,
                            value
                          )
                        }
                      />

                      <Score
                        name="Skor otomatis"
                        score={
                          calc.scores[
                            test.key
                          ]
                        }
                      />
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border:
                      "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <h3>
                    Hasil Perhitungan
                    Otomatis
                  </h3>

                  <Score
                    name="Nilai A"
                    score={
                      calc.scores.lari
                    }
                  />

                  <Score
                    name="Nilai B"
                    score={
                      calc.b == null
                        ? null
                        : fmt(calc.b)
                    }
                  />

                  <Score
                    name="Nilai Akhir"
                    score={
                      calc.final == null
                        ? null
                        : fmt(calc.final)
                    }
                  />

                  <p>
                    Kategori CCR:{" "}
                    <strong>
                      {rating(
                        calc.final
                      )}
                    </strong>
                  </p>

                  <p>
                    Status Kelulusan:{" "}
                    <strong
                      style={{
                        color:
                          calc.outcome ===
                          "pass"
                            ? "#15803d"
                            : calc.outcome ===
                              "fail"
                            ? "#dc2626"
                            : "#64748b",
                      }}
                    >
                      {calc.outcome ===
                      "pass"
                        ? "LULUS"
                        : calc.outcome ===
                          "fail"
                        ? "TIDAK LULUS"
                        : "BELUM DINILAI"}
                    </strong>
                  </p>
                </div>

                <label
                  style={{
                    display: "block",
                    marginBottom: 14,
                  }}
                >
                  <strong>
                    Catatan Mentor
                  </strong>

                  <textarea
                    rows={3}
                    style={field}
                    value={
                      form.notes
                    }
                    onChange={(e) =>
                      change(
                        "notes",
                        e.target.value
                      )
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...button,
                    width: "100%",
                    opacity:
                      saving ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? "Menyimpan..."
                    : editDate
                    ? "Simpan Perubahan"
                    : "Simpan Penilaian Samapta"}
                </button>

                {editDate && (
                  <button
                    type="button"
                    style={{
                      ...button,
                      width: "100%",
                      marginTop: 10,
                      background:
                        "#64748b",
                    }}
                    onClick={reset}
                  >
                    Batal Edit
                  </button>
                )}
              </form>

              <p
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Jika muncul
                "Belum ada konversi",
                hasil berada di luar
                angka tabel yang dapat
                dipastikan dari foto.
                Data tidak dapat
                disimpan sebelum skor
                referensinya tersedia.
              </p>
            </section>

            <section style={box}>
              <h2>
                Riwayat Penilaian
              </h2>

              {!groups.length && (
                <p>
                  Belum ada data.
                </p>
              )}

              {groups.map(
                (group) => (
                  <article
                    key={
                      group.date
                    }
                    style={{
                      border:
                        "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 14,
                    }}
                  >
                    <h3>
                      {dateText(
                        group.date
                      )}
                    </h3>

                    {group.items.map(
                      (record) => (
                        <p
                          key={
                            record.id
                          }
                        >
                          <strong>
                            {
                              record.test_type
                            }
                          </strong>
                          :{" "}
                          {
                            record.result_value
                          }{" "}
                          {
                            record.result_unit
                          }{" "}
                          — Skor{" "}
                          {record.score ??
                            "—"}
                        </p>
                      )
                    )}

                    <Score
                      name="Nilai A"
                      score={
                        group.a
                      }
                    />

                    <Score
                      name="Nilai B"
                      score={
                        group.b ==
                        null
                          ? null
                          : fmt(
                              group.b
                            )
                      }
                    />

                    <Score
                      name="Nilai Akhir"
                      score={
                        group.final ==
                        null
                          ? null
                          : fmt(
                              group.final
                            )
                      }
                    />

                    <p>
                      Kategori:{" "}
                      <strong>
                        {rating(
                          group.final
                        )}
                      </strong>
                    </p>

                    <p>
                      Status lari:{" "}
                      <strong>
                        {group.outcome ===
                        "pass"
                          ? "LULUS"
                          : group.outcome ===
                            "fail"
                          ? "TIDAK LULUS"
                          : "BELUM DINILAI"}
                      </strong>
                    </p>

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 10,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <button
                        type="button"
                        disabled={
                          busy ||
                          saving
                        }
                        style={
                          button
                        }
                        onClick={() =>
                          edit(
                            group
                          )
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy ||
                          saving
                        }
                        style={{
                          ...button,
                          background:
                            "#dc2626",
                        }}
                        onClick={() =>
                          remove(
                            group
                          )
                        }
                      >
                        Hapus
                      </button>
                    </div>
                  </article>
                )
              )}
            </section>
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            padding: 24,
          }}
        >
          Monitoring OJT —
          Emergency Response
          Group · © 2026 PT
          Berau Coal
        </footer>
      </div>
    </main>
  );
}
