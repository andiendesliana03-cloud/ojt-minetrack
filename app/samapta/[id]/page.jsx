
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// Tabel konversi asli tetap digunakan.
// Angka di luar tabel tidak diperkirakan.

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
  [1836, 1856]
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
  [1999, 2019]
];

const SHUTTLE_31 = [
  100, 99, 96, 94, 92, 90, 88, 86, 83, 81,
  79, 77, 75, 73, 70, 68, 66, 64, 62, 59,
  57, 55, 53, 51, 49, 46, 44, 42, 40, 37,
  35, 33, 31, 30, 28, 26, 24, 22, 20, 18,
  16, 14, 12, 10, 7, 5, 3
];

const SHUTTLE_21 = [
  ...Array(29).fill(100),
  99, 97, 97, 94, 92, 90, 88, 86, 84, 82,
  79, 77, 75, 73, 71, 69, 67, 65, 62, 60,
  58, 56, 53, 50, 48, 45, 43, 41, 40, 37,
  35, 33, 31, 28, 26, 24, 22, 20, 18,
  16, 14
];

const PUSH_31 = {
  37:100,36:96,35:92,34:88,33:84,32:80,
  31:76,30:72,29:68,28:64,27:60,26:56,
  25:52,24:48,23:44,22:40,21:36,20:32,
  19:28,18:24,17:20,16:16,15:12,14:8,
  13:4,12:1
};

const SIT_31 = {
  42:100,41:97,40:94,39:91,38:87,37:84,
  36:81,35:79,34:75,33:72,32:69,31:66,
  30:62,29:59,28:56,27:53,26:50,25:47,
  24:44,23:41,22:37,21:34,20:31,19:28,
  18:25,17:22,16:19,15:16,14:12,13:9,
  12:6,11:3,10:1
};

const PULL_31 = {
  14:100,13:92,12:83,11:75,10:67,9:58,
  8:50,7:42,6:33,5:25,4:17,3:8,
  2:1,1:0,0:0
};

const PULL_21 = {
  17:100,16:93,15:86,14:79,13:71,
  12:64,11:57,10:50,9:43,8:36,
  7:29,6:21
};

const PUSH_21 = {
  37:96,36:92,35:88,34:84,
  33:80,32:76,31:72
};

const SIT_21 = {
  44:97,43:94,42:91,41:88,
  40:85,39:82,38:79,37:76,
  36:73,35:70,34:67,33:64,
  32:61,31:58
};

const TESTS = [
  { key:"lari", name:"Lari 12 Menit", unit:"Meter" },
  { key:"pull", name:"Pull-Up", unit:"Repetisi" },
  { key:"push", name:"Push-Up", unit:"Repetisi" },
  { key:"sit", name:"Sit-Up", unit:"Repetisi" },
  { key:"shuttle", name:"Shuttle Run", unit:"Detik" }
];

function localToday() {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0,10);
}

function blank() {
  return {
    date: localToday(),
    age:"21-30",
    laps:"",
    extra:"",
    pull:"",
    push:"",
    sit:"",
    shuttle:"",
    notes:""
  };
}

function num(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function dateText(value) {
  if (!value) return "—";
  return String(value).slice(0,10).split("-").reverse().join("/");
}

function participantName(program) {
  return program?.peserta?.full_name || "Peserta OJT";
}

function runScore(distance, age) {
  if (distance == null) return null;
  const rows = age === "31-40" ? RUN_31 : RUN_21;
  const index = rows.findIndex(
    ([min,max]) => distance >= min && distance <= max
  );
  return index < 0 ? null : 100 - index;
}

function shuttleScore(seconds, age) {
  if (seconds == null) return null;

  if (age === "31-40") {
    if (seconds <= 16.4) return 100;
    const index = Math.round((seconds - 16.4) * 10);
    return SHUTTLE_31[index] ?? null;
  }

  if (seconds <= 13) return 100;

  const index = Math.round((seconds - 13) * 10);
  return SHUTTLE_21[index] ?? null;
}

function repetitionScore(type, count, age) {
  if (count == null) return null;

  if (age === "31-40") {
    const table = type === "pull"
      ? PULL_31
      : type === "push"
      ? PUSH_31
      : SIT_31;

    const max = type === "pull" ? 14
      : type === "push" ? 37 : 42;

    if (count >= max) return 100;
    return table[count] ?? null;
  }

  if (type === "pull") {
    return count >= 17 ? 100 : PULL_21[count] ?? null;
  }

  if (type === "push") {
    return count >= 38 ? 100 : PUSH_21[count] ?? null;
  }

  if (type === "sit") {
    return count >= 45 ? 100 : SIT_21[count] ?? null;
  }

  return null;
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
    shuttle: num(form.shuttle)
  };

  const scores = {
    lari: runScore(raw.lari, form.age),
    pull: repetitionScore("pull", raw.pull, form.age),
    push: repetitionScore("push", raw.push, form.age),
    sit: repetitionScore("sit", raw.sit, form.age),
    shuttle: shuttleScore(raw.shuttle, form.age)
  };

  const bParts = [
    scores.pull,
    scores.push,
    scores.sit,
    scores.shuttle
  ];

  const b = bParts.every(v => v != null)
    ? bParts.reduce((sum,v) => sum + v, 0) / 4
    : null;

  const final = scores.lari != null && b != null
    ? (scores.lari + b) / 2
    : null;

  const outcome = distance == null
    ? "pending"
    : distance >= 2600
    ? "pass"
    : "fail";

  return { raw, scores, b, final, outcome };
}

function Icon({ name, size = 20 }) {
  const paths = {
    back:<path d="m15 18-6-6 6-6M9 12h12"/>,
    lock:<>
      <rect x="5" y="10" width="14" height="11" rx="2"/>
      <path d="M8 10V7a4 4 0 0 1 8 0v3"/>
    </>,
    run:<>
      <circle cx="15" cy="4" r="2"/>
      <path d="m13 8-4 4 4 3-2 6M13 8l4 3 4 1M9 12l-5 3M13 15l5 5"/>
    </>,
    fitness:<>
      <path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12"/>
    </>,
    check:<path d="m4 12 5 5L20 6"/>,
    calendar:<>
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M7 3v4M17 3v4M3 10h18"/>
    </>,
    chart:<path d="M4 20V10M10 20V4M16 20v-8M22 20V7"/>,
    edit:<path d="m4 20 4-.8L20 7a2 2 0 0 0-3-3L5 16z"/>,
    trash:<>
      <path d="M4 7h16M9 4h6M6 7l1 14h10l1-14M10 11v6M14 11v6"/>
    </>
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

function Field({
  label,value,onChange,step="1",max,disabled=false
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
        onChange={e => onChange(e.target.value)}
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
      <strong>
        {value == null ? "Belum ada konversi" : value}
      </strong>
    </div>
  );
}

export default function MonitoringSamapta() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [mentor,setMentor] = useState(null);
  const [program,setProgram] = useState(null);
  const [records,setRecords] = useState([]);
  const [form,setForm] = useState(blank);

  const [editDate,setEditDate] = useState(null);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");

  const calc = useMemo(() => calculate(form),[form]);

  function change(key,value) {
    setForm(old => ({ ...old,[key]:value }));
  }

  async function fetchRecords(id) {
    const { data,error:err } = await supabase
      .from("samapta_records")
      .select(
        "id,program_id,test_date,test_type,result_value,result_unit,score,notes,outcome"
      )
      .eq("program_id",id)
      .order("test_date",{ascending:false});

    if (err) throw err;
    return data || [];
  }

  async function reload() {
    const latest = await fetchRecords(programId);
    setRecords(latest);
  }

  useEffect(() => {
    if (!programId) return;

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setNotice("");
      setMentor(null);
      setProgram(null);
      setRecords([]);
      setForm(blank());
      setEditDate(null);

      try {
        const {
          data:{user},
          error:authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data:profile,
          error:profileError
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id",user.id)
          .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        const {
          data:programData,
          error:programError
        } = await supabase
          .from("ojt_programs")
          .select(`
            id,
            site,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id",programId)
          .single();

        if (programError) throw programError;

        if (programData?.status !== "active") {
          throw new Error("Program OJT sudah tidak aktif.");
        }

        const history = await fetchRecords(programId);

        if (!active) return;

        setMentor(profile);
        setProgram(programData);
        setRecords(history);

      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  },[programId,router]);

  const groups = useMemo(() => {
    const dates = new Map();

    records.forEach(record => {
      if (!dates.has(record.test_date)) {
        dates.set(record.test_date,[]);
      }
      dates.get(record.test_date).push(record);
    });

    return [...dates.entries()]
      .sort((a,b) => b[0].localeCompare(a[0]))
      .map(([date,items]) => {
        const byType = new Map(
          items.map(record => [record.test_type,record])
        );

        const run = byType.get("Lari 12 Menit");

        const distance = run?.result_value == null
          ? null
          : Number(run.result_value);

        const a = run?.score == null
          ? null
          : Number(run.score);

        const others = TESTS.slice(1).map(test => {
          const score = byType.get(test.name)?.score;
          return score == null ? null : Number(score);
        });

        const b = others.every(v => v != null)
          ? others.reduce((sum,v) => sum + v,0) / 4
          : null;

        const final = a != null && b != null
          ? (a+b)/2
          : null;

        return {
          date,items,byType,distance,a,b,final,
          outcome: distance == null
            ? "pending"
            : distance >= 2600
            ? "pass"
            : "fail"
        };
      });
  },[records]);

  const name = participantName(program);

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map(part => part[0])
    .slice(0,2)
    .join("")
    .toUpperCase();

  function reset() {
    setForm(blank());
    setEditDate(null);
    setError("");
  }

  async function save(event) {
    event.preventDefault();

    if (
      saving ||
      busy ||
      !mentor ||
      !program ||
      program.id !== programId
    ) return;

    setError("");
    setNotice("");

    const {raw,scores,outcome} = calc;

    const invalidRepetitions = [
      raw.pull,raw.push,raw.sit
    ].some(
      value => value == null ||
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
        "Periksa jumlah putaran, tambahan jarak, " +
        "repetisi, dan waktu Shuttle Run (1 desimal)."
      );
      return;
    }

    if (
      Object.values(scores).some(value => value == null)
    ) {
      setError(
        "Ada hasil tes yang belum mempunyai angka " +
        "konversi terverifikasi dari tabel referensi. " +
        "Data belum dapat disimpan."
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
      record => record.test_date === form.date
    );

    if (!editDate && existing.length) {
      setError(
        "Tanggal ini sudah memiliki data. " +
        "Gunakan Edit Penilaian."
      );
      return;
    }

    const unknownType = existing.some(
      record => !TESTS.some(
        test => test.name === record.test_type
      )
    );

    const duplicateType = new Set(
      existing.map(record => record.test_type)
    ).size !== existing.length;

    if (unknownType || duplicateType) {
      setError(
        "Ada data tes lama atau duplikat pada tanggal ini. " +
        "Periksa riwayat sebelum menyimpan."
      );
      return;
    }

    const oldByType = new Map(
      existing.map(record => [record.test_type,record])
    );

    const payloads = TESTS.map(test => ({
      test_date:form.date,
      test_type:test.name,
      result_value:raw[test.key],
      result_unit:test.unit,
      score:scores[test.key],
      outcome:test.key === "lari"
        ? outcome
        : "pending",
      notes:test.key === "lari"
        ? `USIA=${form.age}; PUTARAN=${form.laps}; TAMBAHAN=${form.extra}; ${form.notes.trim()}`
        : form.notes.trim() || null
    }));

    setSaving(true);

    try {
      const {
        data:activeProgram,
        error:activeError
      } = await supabase
        .from("ojt_programs")
        .select("id,status")
        .eq("id",programId)
        .eq("status","active")
        .maybeSingle();

      if (activeError) throw activeError;

      if (!activeProgram) {
        throw new Error("Program OJT sudah tidak aktif.");
      }

      for (const payload of payloads) {
        const old = oldByType.get(payload.test_type);

        const result = old
          ? await supabase
              .from("samapta_records")
              .update(payload)
              .eq("id",old.id)
              .eq("program_id",programId)
              .select("id")
          : await supabase
              .from("samapta_records")
              .insert({
                ...payload,
                program_id:programId,
                created_by:mentor.id,
                recorded_by:mentor.id
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
        "Kelima hasil tes Samapta berhasil disimpan."
      );
    } catch (err) {
      setError(
        `${err.message || "Gagal menyimpan"}. ` +
        "Sebagian komponen mungkin sudah tersimpan. " +
        "Periksa riwayat sebelum mencoba kembali."
      );

      try {
        await reload();
      } catch {
        // Pesan kesalahan utama dipertahankan.
      }
    } finally {
      setSaving(false);
    }
  }

  function edit(group) {
    if (
      saving ||
      busy ||
      !program ||
      program.id !== programId
    ) return;

    const get = name => group.byType.get(name);
    const run = get("Lari 12 Menit");

    const distance = run?.result_value == null
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
      date:group.date,
      age:age || "21-30",
      laps:laps ?? (
        distance == null
          ? ""
          : String(Math.floor(distance/400))
      ),
      extra:extra ?? (
        distance == null
          ? ""
          : String(distance%400)
      ),
      pull:get("Pull-Up")?.result_value?.toString() ?? "",
      push:get("Push-Up")?.result_value?.toString() ?? "",
      sit:get("Sit-Up")?.result_value?.toString() ?? "",
      shuttle:get("Shuttle Run")?.result_value?.toString() ?? "",
      notes:get("Push-Up")?.notes || ""
    });

    setEditDate(group.date);
    setError("");
    setNotice("");

    document
      .getElementById("samapta-form")
      ?.scrollIntoView({
        behavior:"smooth",
        block:"start"
      });
  }

  async function remove(group) {
    if (
      saving ||
      busy ||
      !mentor ||
      !program ||
      program.id !== programId
    ) return;

    if (!window.confirm(
      `Hapus seluruh penilaian Samapta untuk ` +
      `${name}, tanggal ${dateText(group.date)}?`
    )) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const ids = group.items.map(record => record.id);

      const {
        data,
        error:deleteError
      } = await supabase
        .from("samapta_records")
        .delete()
        .eq("program_id",programId)
        .in("id",ids)
        .select("id");

      if (deleteError) throw deleteError;

      if (data?.length !== ids.length) {
        throw new Error(
          "Sebagian data tidak terhapus."
        );
      }

      await reload();

      if (editDate === group.date) reset();

      setNotice(
        "Penilaian Samapta berhasil dihapus."
      );
    } catch (err) {
      setError(err.message || "Gagal menghapus data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="sa-root">
      <style>{`
        * { box-sizing:border-box; }

        .sa-root {
          min-height:100vh;
          background:#f2f6f7;
          color:#19352d;
          font-family:Arial,Helvetica,sans-serif;
        }

        .sa-topbar {
          background:#081f27;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:15px 22px;
          gap:12px;
          min-height:65px;
        }

        .sa-brand {
          font-size:21px;
          font-weight:900;
        }

        .sa-brand span { color:#2ac58e; }

        .sa-back {
          border:1px solid #ffffff30;
          border-radius:10px;
          padding:10px 13px;
          display:flex;
          align-items:center;
          gap:7px;
          font-size:12px;
          font-weight:700;
          background:#ffffff16;
          color:#fff;
          cursor:pointer;
        }

        .sa-container {
          max-width:1100px;
          margin:auto;
          padding:22px;
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
          background-size:cover;
          background-position:center;
          color:#fff;
          border-radius:18px;
          padding:30px;
          margin-bottom:16px;
        }

        .sa-kicker {
          color:#efc77b;
          letter-spacing:1.7px;
          font-size:10px;
          font-weight:800;
        }

        .sa-hero h1 {
          font-size:30px;
          margin:14px 0 8px;
        }

        .sa-hero p {
          font-size:13px;
          color:#d9e9e1;
          margin:0;
        }

        .sa-card {
          background:#fff;
          border:1px solid #e2eae6;
          border-radius:16px;
          padding:20px;
          margin-bottom:16px;
          box-shadow:0 5px 18px #1235270b;
          min-width:0;
        }

        .sa-card h2 {
          font-size:18px;
          color:#173a2c;
          margin:0 0 11px;
        }

        .sa-title {
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:16px;
        }

        .sa-title h2 { margin:0; }

        .sa-title-icon {
          height:39px;
          width:39px;
          border-radius:11px;
          display:grid;
          place-items:center;
          color:#11875f;
          background:#e4f7ed;
          flex-shrink:0;
        }

        .sa-muted {
          color:#778c80;
          font-size:12px;
          line-height:1.6;
        }

        .sa-identity {
          display:flex;
          align-items:center;
          gap:13px;
          background:#f5fbf7;
          border:1px solid #dcefe3;
          border-radius:13px;
          padding:15px;
        }

        .sa-avatar {
          width:52px;
          height:52px;
          border-radius:14px;
          background:#d8f4e5;
          color:#087d56;
          display:grid;
          place-items:center;
          font-size:18px;
          font-weight:900;
          flex-shrink:0;
        }

        .sa-name {
          font-size:16px;
          font-weight:900;
          overflow-wrap:anywhere;
        }

        .sa-meta {
          font-size:11px;
          color:#74867b;
          line-height:1.7;
          margin-top:5px;
        }

        .sa-active {
          margin-left:auto;
          white-space:nowrap;
          background:#dff7e8;
          color:#087d4e;
          padding:7px 11px;
          border-radius:20px;
          font-size:11px;
          font-weight:800;
        }

        .sa-lock {
          margin-top:13px;
          display:flex;
          gap:8px;
          align-items:center;
          background:#effaf3;
          border:1px solid #d3ebdb;
          border-radius:11px;
          padding:12px;
          color:#137a55;
          font-size:12px;
          line-height:1.6;
        }

        .sa-grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:15px;
        }

        .sa-field-wrap {
          display:block;
          margin-bottom:16px;
          min-width:0;
        }

        .sa-label {
          display:block;
          font-size:12px;
          font-weight:800;
          color:#365247;
          margin-bottom:8px;
        }

        .sa-field {
          width:100%;
          font-size:16px;
          font-family:inherit;
          padding:12px 13px;
          border:1px solid #d7e4dd;
          border-radius:10px;
          background:#fff;
          color:#193b2d;
          outline-color:#50ba91;
        }

        .sa-field:disabled {
          background:#edf2ef;
          opacity:.8;
        }

        .sa-result {
          background:#effaf4;
          border:1px solid #d6ebdf;
          padding:14px;
          border-radius:12px;
          margin-bottom:14px;
        }

        .sa-result-label {
          color:#718a7a;
          font-size:11px;
        }

        .sa-result-value {
          color:#087a53;
          font-size:25px;
          font-weight:900;
          margin-top:5px;
        }

        .sa-score-row {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          border-bottom:1px solid #e8efeb;
          padding:13px 0;
          font-size:12px;
        }

        .sa-score-row strong {
          color:#087b56;
          font-size:13px;
          text-align:right;
        }

        .sa-test-row {
          display:grid;
          grid-template-columns:minmax(0,1fr) 110px 100px;
          align-items:center;
          gap:10px;
          padding:12px 0;
          border-bottom:1px solid #ecf0ed;
        }

        .sa-test-row .sa-field-wrap {
          margin:0;
        }

        .sa-test-name {
          font-size:12px;
          font-weight:800;
        }

        .sa-test-score {
          background:#e9f8ef;
          border-radius:9px;
          padding:12px 6px;
          color:#11805a;
          text-align:center;
          font-size:12px;
          font-weight:800;
          overflow-wrap:anywhere;
        }

        .sa-summary {
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:11px;
          margin-bottom:16px;
        }

        .sa-summary-box {
          border:1px solid #e5ece8;
          background:#f7faf8;
          border-radius:12px;
          padding:17px 10px;
          text-align:center;
        }

        .sa-summary-box span {
          color:#778b7e;
          font-size:11px;
          display:block;
        }

        .sa-summary-box strong {
          color:#174132;
          font-size:24px;
          display:block;
          margin-top:8px;
        }

        .sa-status-grid {
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
        }

        .sa-status {
          background:#f8faf9;
          border:1px solid #e8efea;
          border-radius:11px;
          padding:14px;
          font-size:12px;
          line-height:1.8;
        }

        .sa-status strong {
          display:block;
          font-size:16px;
          color:#087851;
        }

        .sa-btn {
          border:0;
          padding:13px 17px;
          border-radius:11px;
          background:#0f9064;
          color:#fff;
          font-size:13px;
          font-weight:800;
          cursor:pointer;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:8px;
        }

        .sa-btn:disabled {
          opacity:.55;
          cursor:not-allowed;
        }

        .sa-btn.blue { background:#347dca; }
        .sa-btn.red { background:#d33d43; }
        .sa-btn.gray { background:#64748b; }

        .sa-actions {
          display:flex;
          flex-wrap:wrap;
          gap:9px;
          margin-top:15px;
        }

        .sa-history {
          border:1px solid #e3eae6;
          border-radius:13px;
          padding:16px;
          margin-bottom:12px;
          background:#fff;
        }

        .sa-history-head {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          margin-bottom:10px;
        }

        .sa-history-date {
          color:#173a30;
          font-size:15px;
          font-weight:900;
        }

        .sa-badge {
          border-radius:20px;
          padding:7px 10px;
          font-size:11px;
          font-weight:800;
          background:#eef3f0;
          color:#61766a;
        }

        .sa-badge.pass {
          color:#087a52;
          background:#ddf7e7;
        }

        .sa-badge.fail {
          color:#b91c1c;
          background:#fee2e2;
        }

        .sa-history-item {
          font-size:12px;
          padding:9px 0;
          border-bottom:1px solid #edf1ee;
          display:flex;
          justify-content:space-between;
          gap:10px;
        }

        .sa-history-item strong {
          text-align:right;
        }

        .sa-error {
          background:#fff1f2;
          color:#b91c1c;
          border:1px solid #fecdd3;
          border-radius:11px;
          padding:14px;
          margin-bottom:15px;
          font-size:13px;
          line-height:1.6;
          overflow-wrap:anywhere;
        }

        .sa-success {
          background:#edfbf2;
          color:#087a52;
          border:1px solid #b9ebcf;
          border-radius:11px;
          padding:14px;
          margin-bottom:15px;
          font-size:13px;
        }

        .sa-footer {
          text-align:center;
          color:#90a198;
          font-size:11px;
          padding:20px;
        }

        @media(max-width:760px) {
          .sa-topbar {
            padding:13px 16px;
            min-height:60px;
          }

          .sa-brand { font-size:18px; }

          .sa-back {
            padding:9px;
            font-size:0;
          }

          .sa-back svg {
            width:20px;
            height:20px;
          }

          .sa-container { padding:12px; }

          .sa-hero {
            padding:23px 17px;
            border-radius:14px;
            margin-bottom:12px;
          }

          .sa-hero h1 { font-size:24px; }

          .sa-card {
            padding:15px;
            border-radius:14px;
            margin-bottom:12px;
          }

          .sa-card h2 { font-size:16px; }

          .sa-identity {
            padding:12px;
            gap:10px;
          }

          .sa-avatar {
            width:44px;
            height:44px;
            font-size:15px;
          }

          .sa-name { font-size:14px; }
          .sa-meta { font-size:10px; }

          .sa-grid { grid-template-columns:1fr; }

          .sa-test-row {
            grid-template-columns:minmax(0,1fr) 90px 83px;
            gap:7px;
          }

          .sa-test-score { font-size:10px; }
          .sa-test-name { font-size:11px; }

          .sa-summary { gap:8px; }

          .sa-summary-box {
            padding:14px 6px;
          }

          .sa-summary-box strong {
            font-size:19px;
          }

          .sa-summary-box span {
            font-size:10px;
          }

          .sa-status-grid { gap:8px; }
        }

        @media(max-width:370px) {
          .sa-test-row {
            grid-template-columns:1fr 1fr;
          }

          .sa-test-name {
            grid-column:1 / -1;
          }

          .sa-status-grid {
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <header className="sa-topbar">
        <div className="sa-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="sa-back"
          onClick={() => router.push(
            programId ? `/peserta/${programId}` : "/"
          )}
          aria-label="Kembali ke Detail Peserta"
        >
          <Icon name="back" size={18}/>
          Detail Peserta
        </button>
      </header>

      <div className="sa-container">
        <section className="sa-hero">
          <div className="sa-kicker">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>
          <h1>Monitoring Samapta</h1>
          <p>Penilaian Tes Fisik dan Kesiapan Personel OJT</p>
        </section>

        {loading ? (
          <section className="sa-card">
            <h2>Memuat Data Samapta...</h2>
            <p className="sa-muted">
              Mengambil identitas peserta dan riwayat tes.
            </p>
          </section>
        ) : !mentor || !program ? (
          <section className="sa-card">
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <p className="sa-error">
              {error || "Program peserta tidak ditemukan."}
            </p>
            <button
              type="button"
              className="sa-btn"
              onClick={() => router.push("/")}
            >
              Kembali ke Dashboard
            </button>
          </section>
        ) : (
          <>
            <section className="sa-card">
              <div className="sa-identity">
                <div className="sa-avatar">
                  {initials}
                </div>

                <div style={{ minWidth:0,flex:1 }}>
                  <div className="sa-name">{name}</div>
                  <div className="sa-meta">
                    {program.peserta?.department || "-"}
                    {" · "}
                    {program.site || "-"}
                    <br/>
                    {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </div>
                </div>

                <span className="sa-active">Aktif</span>
              </div>

              <div className="sa-lock">
                <Icon name="lock" size={17}/>
                <span>
                  Peserta otomatis mengikuti Detail Peserta.
                  Penilaian hanya disimpan untuk{" "}
                  <strong>{name}</strong>.
                </span>
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
                <div className="sa-title">
                  <div className="sa-title-icon">
                    <Icon name="calendar"/>
                  </div>
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
                      disabled={!!editDate || saving}
                      onChange={e =>
                        change("date",e.target.value)
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
                      onChange={e =>
                        change("age",e.target.value)
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
                </div>
              </section>

              <div className="sa-grid">
                <section className="sa-card">
                  <div className="sa-title">
                    <div className="sa-title-icon"
                      style={{
                        background:"#e7f2ff",
                        color:"#347dca"
                      }}
                    >
                      <Icon name="run"/>
                    </div>
                    <h2>Samapta A — Lari 12 Menit</h2>
                  </div>

                  <p className="sa-muted">
                    Masukkan jumlah putaran dan tambahan jarak.
                    Satu putaran = 400 meter.
                  </p>

                  <div className="sa-grid">
                    <Field
                      label="Jumlah Putaran"
                      value={form.laps}
                      disabled={saving}
                      onChange={v => change("laps",v)}
                    />
                    <Field
                      label="Tambahan Jarak (0–399 m)"
                      value={form.extra}
                      max="399"
                      disabled={saving}
                      onChange={v => change("extra",v)}
                    />
                  </div>

                  <div className="sa-result">
                    <div className="sa-result-label">
                      Total Jarak
                    </div>
                    <div className="sa-result-value">
                      {calc.raw.lari == null
                        ? "—"
                        : calc.raw.lari.toLocaleString("id-ID") +
                          " meter"}
                    </div>
                  </div>

                  <ScoreRow
                    label="Skor Lari / Nilai A"
                    value={calc.scores.lari}
                  />

                  <p className="sa-muted">
                    Syarat kelulusan lari 12 menit pada
                    sistem ini: minimal 2.600 meter.
                  </p>
                </section>

                <section className="sa-card">
                  <div className="sa-title">
                    <div className="sa-title-icon">
                      <Icon name="fitness"/>
                    </div>
                    <h2>Samapta B — Tes Fisik</h2>
                  </div>

                  <p className="sa-muted">
                    Skor otomatis berdasarkan kelompok usia
                    dan tabel konversi yang tersedia.
                  </p>

                  {[
                    ["pull","Pull-Up","1"],
                    ["push","Push-Up","1"],
                    ["sit","Sit-Up","1"],
                    ["shuttle","Shuttle Run (detik)","0.1"]
                  ].map(([key,label,step]) => (
                    <div className="sa-test-row" key={key}>
                      <span className="sa-test-name">
                        {label}
                      </span>

                      <Field
                        label="Hasil"
                        value={form[key]}
                        step={step}
                        disabled={saving}
                        onChange={v => change(key,v)}
                      />

                      <div className="sa-test-score">
                        {calc.scores[key] == null
                          ? "—"
                          : `Skor ${calc.scores[key]}`}
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              <section className="sa-card">
                <div className="sa-title">
                  <div className="sa-title-icon"
                    style={{
                      background:"#e8f1ff",
                      color:"#347dca"
                    }}
                  >
                    <Icon name="chart"/>
                  </div>
                  <h2>Hasil Perhitungan Otomatis</h2>
                </div>

                <div className="sa-summary">
                  <div className="sa-summary-box">
                    <span>Nilai A</span>
                    <strong>
                      {fmt(calc.scores.lari)}
                    </strong>
                  </div>

                  <div className="sa-summary-box">
                    <span>Nilai B</span>
                    <strong>
                      {fmt(calc.b)}
                    </strong>
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
                    <strong style={{
                      color:calc.outcome === "pass"
                        ? "#087a52"
                        : calc.outcome === "fail"
                        ? "#b91c1c"
                        : "#64748b"
                    }}>
                      {calc.outcome === "pass"
                        ? "LULUS"
                        : calc.outcome === "fail"
                        ? "TIDAK LULUS"
                        : "BELUM DINILAI"}
                    </strong>
                  </div>
                </div>

                <p className="sa-muted" style={{
                  marginTop:15
                }}>
                  Kelulusan menggunakan batas jarak lari
                  2.600 meter sesuai aturan pada kode
                  sebelumnya. Kategori CCR dihitung dari
                  rata-rata Nilai A dan Nilai B.
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
                    onChange={e =>
                      change("notes",e.target.value)
                    }
                    placeholder="Catatan hasil tes fisik peserta..."
                    style={{resize:"vertical"}}
                  />
                </label>

                <button
                  type="submit"
                  className="sa-btn"
                  disabled={saving || busy}
                  style={{width:"100%"}}
                >
                  <Icon name="check" size={17}/>
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
                    onClick={reset}
                    disabled={saving}
                    style={{
                      width:"100%",
                      marginTop:10
                    }}
                  >
                    Batal Edit
                  </button>
                )}

                <p className="sa-muted" style={{
                  marginTop:13,
                  marginBottom:0
                }}>
                  Jika salah satu skor belum memiliki
                  angka konversi, penyimpanan ditolak
                  agar nilai peserta tidak keliru.
                </p>
              </section>
            </form>

            <section className="sa-card">
              <div className="sa-title">
                <div className="sa-title-icon">
                  <Icon name="calendar"/>
                </div>
                <h2>Riwayat Penilaian Samapta</h2>
              </div>

              <p className="sa-muted">
                {groups.length} tanggal penilaian
                untuk {name}.
              </p>

              {!groups.length && (
                <p className="sa-muted">
                  Belum ada hasil tes Samapta.
                </p>
              )}

              {groups.map(group => (
                <article
                  key={group.date}
                  className="sa-history"
                >
                  <div className="sa-history-head">
                    <div className="sa-history-date">
                      {dateText(group.date)}
                    </div>

                    <span className={
                      "sa-badge " +
                      (group.outcome === "pass"
                        ? "pass"
                        : group.outcome === "fail"
                        ? "fail"
                        : "")
                    }>
                      {group.outcome === "pass"
                        ? "Lulus"
                        : group.outcome === "fail"
                        ? "Tidak Lulus"
                        : "Belum Dinilai"}
                    </span>
                  </div>

                  {group.items.map(record => (
                    <div
                      key={record.id}
                      className="sa-history-item"
                    >
                      <span>
                        {record.test_type}
                      </span>
                      <strong>
                        {record.result_value}{" "}
                        {record.result_unit}{" "}
                        · Skor {record.score ?? "—"}
                      </strong>
                    </div>
                  ))}

                  <div className="sa-summary"
                    style={{marginTop:15}}
                  >
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

                  <p className="sa-muted">
                    Kategori CCR:{" "}
                    <strong>{rating(group.final)}</strong>
                  </p>

                  <div className="sa-actions">
                    <button
                      type="button"
                      className="sa-btn blue"
                      disabled={saving || busy}
                      onClick={() => edit(group)}
                    >
                      <Icon name="edit" size={16}/>
                      Edit
                    </button>

                    <button
                      type="button"
                      className="sa-btn red"
                      disabled={saving || busy}
                      onClick={() => remove(group)}
                    >
                      <Icon name="trash" size={16}/>
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
