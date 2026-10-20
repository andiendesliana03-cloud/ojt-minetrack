
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TESTS = [
  { key: "lari", name: "Lari 12 Menit", unit: "Meter" },
  { key: "pull", name: "Pull-Up", unit: "Repetisi" },
  { key: "push", name: "Push-Up", unit: "Repetisi" },
  { key: "sit", name: "Sit-Up", unit: "Repetisi" },
  { key: "shuttle", name: "Shuttle Run", unit: "Detik" },
];

const CARD = {
  background: "rgba(255,255,255,0.97)",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
};

const INPUT = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  marginTop: 7,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 16,
};

const BUTTON = {
  padding: "13px 18px",
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

function today() {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function emptyForm() {
  return {
    tanggal: today(),
    putaran: "",
    tambahan: "",
    pull: "",
    push: "",
    sit: "",
    shuttle: "",
    skorLari: "",
    skorPull: "",
    skorPush: "",
    skorSit: "",
    skorShuttle: "",
    catatan: "",
  };
}

function formatDate(date) {
  if (!date) return "-";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function numeric(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function category(score) {
  if (score == null) return "Belum Lengkap";
  if (score >= 81) return "Baik Sekali";
  if (score >= 61) return "Baik";
  if (score >= 50) return "Cukup";
  if (score >= 21) return "Kurang";
  if (score >= 1) return "Kurang Sekali";
  return "Nilai 0";
}

function scoreText(score) {
  return score == null ? "-" : score.toFixed(2);
}

function Field({
  label,
  value,
  onChange,
  step = "1",
  max,
  hint,
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>

      <input
        type="number"
        min="0"
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={INPUT}
        required
      />

      {hint && (
        <small
          style={{
            color: "#64748b",
            display: "block",
            marginTop: 5,
          }}
        >
          {hint}
        </small>
      )}
    </label>
  );
}

function ResultBox({ label, value, background }) {
  return (
    <div
      style={{
        background: background || "#f8fafc",
        borderRadius: 12,
        padding: 16,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#475569",
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 25,
          fontWeight: 800,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function calculate(form) {
  const laps = numeric(form.putaran);
  const extra = numeric(form.tambahan);

  const validDistance =
    laps !== null &&
    Number.isInteger(laps) &&
    laps >= 0 &&
    extra !== null &&
    Number.isInteger(extra) &&
    extra >= 0 &&
    extra < 400;

  const distance = validDistance
    ? laps * 400 + extra
    : null;

  const scores = [
    form.skorPull,
    form.skorPush,
    form.skorSit,
    form.skorShuttle,
  ].map(numeric);

  const scoreA = numeric(form.skorLari);

  const scoreB = scores.every((s) => s !== null)
    ? scores.reduce((sum, s) => sum + s, 0) / 4
    : null;

  const finalScore =
    scoreA !== null && scoreB !== null
      ? (scoreA + scoreB) / 2
      : null;

  const outcome =
    distance === null
      ? "pending"
      : distance >= 2600
      ? "pass"
      : "fail";

  return {
    distance,
    scoreA,
    scoreB,
    finalScore,
    outcome,
  };
}

export default function MonitoringSamapta() {
  const router = useRouter();
  const params = useParams();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingDate, setEditingDate] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const result = useMemo(
    () => calculate(form),
    [form]
  );

  function change(key, value) {
    setForm((old) => ({
      ...old,
      [key]: value,
    }));
  }

  async function loadRecords() {
    const { data, error: queryError } = await supabase
      .from("samapta_records")
      .select(
        "id,test_date,test_type,result_value,result_unit,score,notes,outcome"
      )
      .eq("program_id", programId)
      .order("test_date", { ascending: false });

    if (queryError) throw queryError;

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

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        const { data: programData, error: programError } =
          await supabase
            .from("ojt_programs")
            .select("id,start_date,end_date,status")
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        if (!active) return;

        setMentor(profile);
        setProgram(programData);

        await loadRecords();
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
  }, [programId, router]);

  const groups = useMemo(() => {
    const map = new Map();

    for (const record of records) {
      if (!map.has(record.test_date)) {
        map.set(record.test_date, []);
      }
      map.get(record.test_date).push(record);
    }

    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, items]) => {
        const byType = new Map();

        for (const item of items) {
          if (!byType.has(item.test_type)) {
            byType.set(item.test_type, item);
          }
        }

        const complete = TESTS.every((test) =>
          byType.has(test.name)
        );

        const lari = byType.get("Lari 12 Menit");
        const distance =
          lari?.result_value == null
            ? null
            : Number(lari.result_value);

        const a =
          lari?.score == null
            ? null
            : Number(lari.score);

        const bScores = TESTS.slice(1).map((test) => {
          const row = byType.get(test.name);
          return row?.score == null
            ? null
            : Number(row.score);
        });

        const b = bScores.every(
          (value) => value !== null
        )
          ? bScores.reduce((sum, value) => sum + value, 0) /
            4
          : null;

        const final =
          a !== null && b !== null
            ? (a + b) / 2
            : null;

        const outcome =
          distance === null
            ? "pending"
            : distance >= 2600
            ? "pass"
            : "fail";

        return {
          date,
          items,
          byType,
          complete,
          distance,
          a,
          b,
          final,
          outcome,
        };
      });
  }, [records]);

  function resetForm() {
    setForm(emptyForm());
    setEditingDate(null);
    setError("");
  }

  async function save(event) {
    event.preventDefault();

    if (!mentor || !program || saving) return;

    setError("");
    setMessage("");

    const values = [
      form.pull,
      form.push,
      form.sit,
    ].map(numeric);

    const shuttle = numeric(form.shuttle);

    const scores = [
      form.skorLari,
      form.skorPull,
      form.skorPush,
      form.skorSit,
      form.skorShuttle,
    ].map(numeric);

    if (
      result.distance === null ||
      !form.tanggal ||
      values.some(
        (v) =>
          v === null ||
          !Number.isInteger(v) ||
          v < 0
      ) ||
      shuttle === null ||
      shuttle < 0 ||
      Math.round(shuttle * 10) !== shuttle * 10 ||
      scores.some(
        (s) =>
          s === null ||
          s < 0 ||
          s > 100
      )
    ) {
      setError(
        "Periksa hasil tes dan seluruh skor. Repetisi harus bilangan bulat, Shuttle Run satu desimal, dan skor 0–100."
      );
      return;
    }

    const targetDate = editingDate || form.tanggal;

    if (
      editingDate &&
      form.tanggal !== editingDate
    ) {
      setError(
        "Tanggal tidak boleh diubah saat mengedit. Buat penilaian baru untuk tanggal berbeda."
      );
      return;
    }

    const existing = records.filter(
      (row) => row.test_date === targetDate
    );

    const existingTypes = new Map(
      existing.map((row) => [row.test_type, row])
    );

    // Hindari duplikasi data jika ada tes ganda
    // atau tes lama lain pada tanggal yang sama.
    if (
      existing.length > 0 &&
      !editingDate
    ) {
      setError(
        "Sudah ada hasil Samapta pada tanggal ini. Gunakan tombol Edit Penilaian."
      );
      return;
    }

    if (
      existing.some(
        (row) =>
          !TESTS.some(
            (test) => test.name === row.test_type
          )
      )
    ) {
      setError(
        "Tanggal ini memiliki tes lama dengan jenis berbeda. Periksa riwayat sebelum memperbarui."
      );
      return;
    }

    if (
      new Set(existing.map((r) => r.test_type)).size !==
      existing.length
    ) {
      setError(
        "Ada jenis tes ganda pada tanggal ini. Rapikan data lama sebelum mengedit."
      );
      return;
    }

    const measurements = [
      result.distance,
      ...values,
      shuttle,
    ];

    const payloads = TESTS.map((test, index) => ({
      test_date: targetDate,
      test_type: test.name,
      result_value: measurements[index],
      result_unit: test.unit,
      score: scores[index],
      outcome:
        test.key === "lari"
          ? result.outcome
          : "pending",
      notes:
        test.key === "lari"
          ? `Putaran: ${form.putaran}; Tambahan: ${form.tambahan} meter${form.catatan ? `; Catatan: ${form.catatan}` : ""}`
          : form.catatan.trim() || null,
    }));

    setSaving(true);

    try {
      for (const payload of payloads) {
        const old = existingTypes.get(payload.test_type);

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

        if (response.error) throw response.error;

        if (!response.data?.length) {
          throw new Error(
            `Gagal menyimpan ${payload.test_type}.`
          );
        }
      }

      await loadRecords();
      resetForm();
      setMessage(
        "Lima komponen Samapta berhasil disimpan."
      );
    } catch (err) {
      setError(
        `${err.message || "Gagal menyimpan data."} Periksa riwayat sebelum mencoba lagi karena sebagian tes mungkin sudah tersimpan.`
      );
      try {
        await loadRecords();
      } catch {}
    } finally {
      setSaving(false);
    }
  }

  function editGroup(group) {
    const get = (name) => group.byType.get(name);

    const lari = get("Lari 12 Menit");

    const distance = Number(
      lari?.result_value || 0
    );

    const readScore = (name) => {
      const score = get(name)?.score;
      return score == null ? "" : String(score);
    };

    const readResult = (name) => {
      const value = get(name)?.result_value;
      return value == null ? "" : String(value);
    };

    const notes =
      get("Push-Up")?.notes ||
      get("Sit-Up")?.notes ||
      "";

    setEditingDate(group.date);

    setForm({
      tanggal: group.date,
      putaran: String(Math.floor(distance / 400)),
      tambahan: String(distance % 400),
      pull: readResult("Pull-Up"),
      push: readResult("Push-Up"),
      sit: readResult("Sit-Up"),
      shuttle: readResult("Shuttle Run"),
      skorLari: readScore("Lari 12 Menit"),
      skorPull: readScore("Pull-Up"),
      skorPush: readScore("Push-Up"),
      skorSit: readScore("Sit-Up"),
      skorShuttle: readScore("Shuttle Run"),
      catatan: notes,
    });

    setError("");
    setMessage("");

    document
      .getElementById("form-samapta")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteGroup(group) {
    if (deleting || saving) return;

    if (
      !window.confirm(
        `Hapus seluruh hasil Samapta tanggal ${formatDate(
          group.date
        )}?`
      )
    ) {
      return;
    }

    setDeleting(true);
    setError("");
    setMessage("");

    try {
      const ids = group.items.map((item) => item.id);

      const { data, error: deleteError } =
        await supabase
          .from("samapta_records")
          .delete()
          .eq("program_id", programId)
          .in("id", ids)
          .select("id");

      if (deleteError) throw deleteError;

      if (data?.length !== ids.length) {
        throw new Error(
          "Sebagian data tidak terhapus. Periksa riwayat."
        );
      }

      if (editingDate === group.date) {
        resetForm();
      }

      await loadRecords();
      setMessage("Riwayat Samapta berhasil dihapus.");
    } catch (err) {
      setError(
        err.message || "Gagal menghapus data."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        backgroundImage:
          'linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.94)),url("/background-erg.png.PNG")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        padding: 18,
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
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
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 18,
          }}
        >
          <h1>Penilaian Samapta ERG</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>
            Monitoring OJT — Dashboard Mentor
          </small>
        </header>

        <button
          type="button"
          onClick={() =>
            router.push(`/peserta/${programId}`)
          }
          style={{
            ...BUTTON,
            background: "#475569",
            marginBottom: 18,
          }}
        >
          ← Kembali ke Detail Peserta
        </button>

        {loading ? (
          <section style={CARD}>
            Memuat data Samapta...
          </section>
        ) : !mentor || !program ? (
          <section style={CARD}>
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <p style={{ color: "#dc2626" }}>
              {error || "Akses tidak tersedia."}
            </p>
          </section>
        ) : (
          <>
            <section style={CARD}>
              <h2>Informasi Penilaian</h2>

              <p>
                Mentor:{" "}
                <strong>{mentor.full_name}</strong>
              </p>

              <p>
                Periode OJT:{" "}
                {formatDate(program.start_date)} –{" "}
                {formatDate(program.end_date)}
              </p>

              <p>
                <strong>Standar Kelulusan:</strong>{" "}
                Lari 12 menit minimal 2.600 meter.
              </p>

              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Skor komponen diisi berdasarkan tabel
                konversi resmi ERG. Status kelulusan
                ditentukan oleh jarak lari.
              </p>
            </section>

            {error && (
              <section style={CARD}>
                <p
                  role="alert"
                  style={{ color: "#b91c1c" }}
                >
                  {error}
                </p>
              </section>
            )}

            {message && (
              <section style={CARD}>
                <p
                  role="status"
                  style={{ color: "#15803d" }}
                >
                  {message}
                </p>
              </section>
            )}

            <section style={CARD} id="form-samapta">
              <h2>
                {editingDate
                  ? "Edit Penilaian Samapta"
                  : "Input Penilaian Samapta"}
              </h2>

              <form onSubmit={save}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 20,
                  }}
                >
                  <strong>Tanggal Pelaksanaan</strong>

                  <input
                    type="date"
                    value={form.tanggal}
                    disabled={Boolean(editingDate)}
                    onChange={(e) =>
                      change("tanggal", e.target.value)
                    }
                    style={INPUT}
                    required
                  />
                </label>

                <div
                  style={{
                    background: "#eff6ff",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <h3>Samapta A — Lari 12 Menit</h3>

                  <Field
                    label="Jumlah Putaran"
                    value={form.putaran}
                    onChange={(v) =>
                      change("putaran", v)
                    }
                    hint="1 putaran = 400 meter"
                  />

                  <Field
                    label="Tambahan Jarak (Meter)"
                    value={form.tambahan}
                    onChange={(v) =>
                      change("tambahan", v)
                    }
                    max="399"
                    hint="Masukkan 0–399 meter"
                  />

                  <ResultBox
                    label="Total Jarak Lari"
                    value={
                      result.distance === null
                        ? "-"
                        : `${result.distance.toLocaleString(
                            "id-ID"
                          )} meter`
                    }
                    background="#dbeafe"
                  />

                  <div style={{ marginTop: 16 }}>
                    <Field
                      label="Skor Lari / Nilai A (0–100)"
                      value={form.skorLari}
                      onChange={(v) =>
                        change("skorLari", v)
                      }
                      step="0.01"
                      max="100"
                      hint="Isi skor dari tabel konversi lari ERG."
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: "#f0fdf4",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <h3>Samapta B — Tes Fisik</h3>

                  {[
                    {
                      name: "Pull-Up",
                      result: "pull",
                      score: "skorPull",
                    },
                    {
                      name: "Push-Up",
                      result: "push",
                      score: "skorPush",
                    },
                    {
                      name: "Sit-Up",
                      result: "sit",
                      score: "skorSit",
                    },
                    {
                      name: "Shuttle Run",
                      result: "shuttle",
                      score: "skorShuttle",
                    },
                  ].map((test) => (
                    <div
                      key={test.name}
                      style={{
                        borderBottom:
                          "1px solid #bbf7d0",
                        marginBottom: 18,
                      }}
                    >
                      <h4>{test.name}</h4>

                      <Field
                        label={
                          test.name === "Shuttle Run"
                            ? "Waktu (Detik)"
                            : "Jumlah Repetisi"
                        }
                        value={form[test.result]}
                        onChange={(v) =>
                          change(test.result, v)
                        }
                        step={
                          test.name === "Shuttle Run"
                            ? "0.1"
                            : "1"
                        }
                      />

                      <Field
                        label="Skor Konversi (0–100)"
                        value={form[test.score]}
                        onChange={(v) =>
                          change(test.score, v)
                        }
                        step="0.01"
                        max="100"
                      />
                    </div>
                  ))}
                </div>

                <section
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <h3>Perhitungan Otomatis</h3>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: 12,
                    }}
                  >
                    <ResultBox
                      label="Nilai A"
                      value={scoreText(result.scoreA)}
                    />

                    <ResultBox
                      label="Nilai B"
                      value={scoreText(result.scoreB)}
                    />

                    <ResultBox
                      label="Nilai Akhir"
                      value={scoreText(
                        result.finalScore
                      )}
                      background="#dbeafe"
                    />

                    <ResultBox
                      label="Kategori CCR"
                      value={category(
                        result.finalScore
                      )}
                      background="#f5f3ff"
                    />
                  </div>

                  <div
                    style={{
                      textAlign: "center",
                      marginTop: 16,
                      padding: 16,
                      borderRadius: 12,
                      background:
                        result.outcome === "pass"
                          ? "#dcfce7"
                          : result.outcome === "fail"
                          ? "#fee2e2"
                          : "#e2e8f0",
                    }}
                  >
                    <strong>Status Kelulusan</strong>

                    <h2 style={{ marginBottom: 0 }}>
                      {result.outcome === "pass"
                        ? "LULUS"
                        : result.outcome === "fail"
                        ? "TIDAK LULUS"
                        : "BELUM DINILAI"}
                    </h2>
                  </div>
                </section>

                <label>
                  <strong>Catatan Mentor</strong>

                  <textarea
                    value={form.catatan}
                    onChange={(e) =>
                      change("catatan", e.target.value)
                    }
                    rows={4}
                    style={{
                      ...INPUT,
                      marginBottom: 18,
                    }}
                    placeholder="Catatan evaluasi peserta..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...BUTTON,
                    width: "100%",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving
                    ? "Menyimpan..."
                    : editingDate
                    ? "Simpan Perubahan Samapta"
                    : "Simpan Penilaian Samapta"}
                </button>

                {editingDate && (
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      ...BUTTON,
                      width: "100%",
                      marginTop: 10,
                      background: "#64748b",
                    }}
                  >
                    Batal Edit
                  </button>
                )}
              </form>
            </section>

            <section style={CARD}>
              <h2>Riwayat Penilaian Samapta</h2>

              {groups.length === 0 && (
                <p>Belum ada hasil Samapta.</p>
              )}

              {groups.map((group) => (
                <div
                  key={group.date}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <h3>
                    {formatDate(group.date)}
                  </h3>

                  <p>
                    Kelengkapan:{" "}
                    <strong>
                      {group.complete
                        ? "5 Tes Lengkap"
                        : "Belum Lengkap"}
                    </strong>
                  </p>

                  {group.items.map((item) => (
                    <p
                      key={item.id}
                      style={{
                        borderBottom:
                          "1px solid #f1f5f9",
                        paddingBottom: 8,
                      }}
                    >
                      <strong>{item.test_type}</strong>
                      <br />
                      Hasil: {item.result_value}{" "}
                      {item.result_unit}
                      <br />
                      Skor:{" "}
                      {item.score ?? "-"}
                    </p>
                  ))}

                  <hr
                    style={{
                      border: 0,
                      borderTop:
                        "1px solid #e2e8f0",
                    }}
                  />

                  <p>
                    Nilai A:{" "}
                    <strong>
                      {scoreText(group.a)}
                    </strong>
                  </p>

                  <p>
                    Nilai B:{" "}
                    <strong>
                      {scoreText(group.b)}
                    </strong>
                  </p>

                  <p>
                    Nilai Akhir:{" "}
                    <strong>
                      {scoreText(group.final)}
                    </strong>
                  </p>

                  <p>
                    Kategori:{" "}
                    <strong>
                      {category(group.final)}
                    </strong>
                  </p>

                  <p>
                    Status Lari:{" "}
                    <strong
                      style={{
                        color:
                          group.outcome === "pass"
                            ? "#15803d"
                            : group.outcome === "fail"
                            ? "#dc2626"
                            : "#64748b",
                      }}
                    >
                      {group.outcome === "pass"
                        ? "LULUS"
                        : group.outcome === "fail"
                        ? "TIDAK LULUS"
                        : "BELUM DINILAI"}
                    </strong>
                  </p>

                  {!group.complete && (
                    <p style={{ color: "#b45309" }}>
                      Penilaian belum lengkap.
                      Periksa komponen yang belum ada.
                    </p>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        editGroup(group)
                      }
                      disabled={saving || deleting}
                      style={BUTTON}
                    >
                      Edit Penilaian
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteGroup(group)
                      }
                      disabled={saving || deleting}
                      style={{
                        ...BUTTON,
                        background: "#dc2626",
                      }}
                    >
                      {deleting
                        ? "Memproses..."
                        : "Hapus Penilaian"}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
          }}
        >
          Monitoring OJT — Emergency Response Group
          <p>© 2026 PT Berau Coal</p>
        </footer>
      </div>
    </main>
  );
}
