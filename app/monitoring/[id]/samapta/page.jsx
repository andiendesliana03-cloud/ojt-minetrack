
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TARGETS = [
  {
    key: "lari",
    name: "Lari 12 Menit",
    target: 2600,
    unit: "meter",
    direction: "min",
  },
  {
    key: "pullup",
    name: "Pull-Up",
    target: 17,
    unit: "kali",
    direction: "min",
  },
  {
    key: "pushup",
    name: "Push-Up",
    target: 38,
    unit: "kali",
    direction: "min",
  },
  {
    key: "situp",
    name: "Sit-Up",
    target: 45,
    unit: "kali",
    direction: "min",
  },
  {
    key: "shuttle",
    name: "Shuttle Run",
    target: 15.08,
    unit: "detik",
    direction: "max",
  },
];

const PERIODS = [
  { value: "awal", label: "Tes Awal" },
  { value: "perkembangan", label: "Tes Perkembangan" },
  { value: "akhir", label: "Tes Akhir" },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getPeriod(value) {
  const text = normalize(value);

  if (
    ["awal", "baseline", "initial", "pretest", "tesawal"].includes(text)
  ) {
    return "awal";
  }

  if (
    [
      "perkembangan",
      "progress",
      "progres",
      "middle",
      "mid",
      "tengah",
      "tesperkembangan",
    ].includes(text)
  ) {
    return "perkembangan";
  }

  if (
    ["akhir", "final", "posttest", "tesakhir"].includes(text)
  ) {
    return "akhir";
  }

  return null;
}

function getExercise(value) {
  const text = normalize(value);

  if (
    ["lari", "lari12menit", "lari12", "run12min", "run12minute"].includes(text)
  ) {
    return "lari";
  }

  if (["pullup", "pullups"].includes(text)) {
    return "pullup";
  }

  if (["pushup", "pushups"].includes(text)) {
    return "pushup";
  }

  if (["situp", "situps"].includes(text)) {
    return "situp";
  }

  if (
    ["shuttle", "shuttlerun", "shuttleruns"].includes(text)
  ) {
    return "shuttle";
  }

  return null;
}

function formatNumber(value, decimals = 0) {
  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isValidValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function targetReached(value, target) {
  if (!isValidValue(value)) return null;

  const number = Number(value);

  return target.direction === "max"
    ? number <= target.target
    : number >= target.target;
}

export default function MonitoringSamaptaPage() {
  const router = useRouter();
  const params = useParams();

  const id = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [period, setPeriod] = useState("awal");

  async function loadData(isRefresh = false) {
    if (!id) {
      setError("ID program tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

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
          .select("role")
          .eq("id", user.id)
          .single();

      if (profileError) throw profileError;

      const role = String(profile?.role || "")
        .trim()
        .toLowerCase();

      const isAdmin = role === "admin";
      const isMentor = role === "mentor";
      const isParticipant = [
        "participant",
        "peserta",
      ].includes(role);

      if (!isAdmin && !isMentor && !isParticipant) {
        throw new Error(
          "Akun tidak memiliki akses monitoring."
        );
      }

      let programQuery = supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          mentor_id,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("id", id);

      // Admin: seluruh program OJT
      // Mentor: hanya program peserta binaannya
      // Peserta: hanya program OJT miliknya

      if (isMentor) {
        programQuery = programQuery.eq(
          "mentor_id",
          user.id
        );
      }

      if (isParticipant) {
        programQuery = programQuery.eq(
          "participant_id",
          user.id
        );
      }

      const programResult =
        await programQuery.maybeSingle();

      if (programResult.error) {
        throw programResult.error;
      }

      if (!programResult.data) {
        throw new Error(
          "Program OJT tidak ditemukan atau tidak dapat diakses."
        );
      }

      const recordsResult = await supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value"
        )
        .eq("program_id", programResult.data.id)
        .order("test_date", { ascending: false });

      if (recordsResult.error) {
        throw recordsResult.error;
      }

      setProgram(programResult.data);
      setRecords(recordsResult.data || []);
    } catch (err) {
      setError(
        err?.message || "Gagal memuat data Samapta."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const grouped = useMemo(() => {
    const result = {
      awal: [],
      perkembangan: [],
      akhir: [],
      lainnya: [],
    };

    for (const item of records) {
      const detected = getPeriod(item.test_type);

      if (detected) {
        result[detected].push(item);
      } else {
        result.lainnya.push(item);
      }
    }

    return result;
  }, [records]);

  const selectedRecords = grouped[period] || [];

  const latestResults = useMemo(() => {
    const result = {};

    for (const target of TARGETS) {
      const matches = selectedRecords.filter(
        (item) => getExercise(item.outcome) === target.key
      );

      const latest = matches.find((item) =>
        isValidValue(item.result_value)
      );

      result[target.key] = latest || null;
    }

    return result;
  }, [selectedRecords]);

  const knownCount = TARGETS.filter(
    (target) => latestResults[target.key] !== null
  ).length;

  const passedCount = TARGETS.filter((target) => {
    const record = latestResults[target.key];

    return (
      record &&
      targetReached(record.result_value, target) === true
    );
  }).length;

  return (
    <main className="sm-root">
      <style>{`
        .sm-root {
          min-height: 100vh;
          background: #f0f5f4;
          color: #153b37;
          font-family: Arial, Helvetica, sans-serif;
        }

        .sm-root * {
          box-sizing: border-box;
        }

        .sm-header {
          background: #07313a;
          color: white;
          padding: 17px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .sm-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .sm-brand span {
          color: #3bc78e;
        }

        .sm-button {
          background: #118660;
          color: white;
          border: none;
          border-radius: 10px;
          padding: 12px 16px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
        }

        .sm-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .sm-button.light {
          background: #e3f4eb;
          color: #086a4a;
        }

        .sm-container {
          max-width: 1050px;
          margin: auto;
          padding: 20px;
        }

        .sm-title {
          margin: 0 0 10px;
          font-size: 26px;
        }

        .sm-subtitle {
          color: #71857e;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .sm-card {
          background: white;
          border: 1px solid #dce8e2;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 17px;
        }

        .sm-profile {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .sm-profile strong {
          font-size: 19px;
        }

        .sm-muted {
          color: #73877e;
          font-size: 13px;
          line-height: 1.6;
        }

        .sm-select {
          width: 100%;
          padding: 15px;
          border: 1px solid #c9dbd2;
          border-radius: 11px;
          background: white;
          color: #173d34;
          font-size: 16px;
          margin-top: 10px;
        }

        .sm-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .sm-stat {
          background: #eef8f2;
          border: 1px solid #d4ebdc;
          border-radius: 12px;
          padding: 15px;
        }

        .sm-stat small {
          display: block;
          color: #678274;
          margin-bottom: 8px;
        }

        .sm-stat strong {
          font-size: 23px;
          color: #087c54;
        }

        .sm-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .sm-result {
          border: 1px solid #dfe9e4;
          border-radius: 13px;
          padding: 17px;
          background: #fff;
        }

        .sm-result h3 {
          margin: 0 0 14px;
          font-size: 16px;
        }

        .sm-value {
          font-size: 27px;
          font-weight: 900;
          margin: 12px 0;
        }

        .sm-target {
          color: #71877d;
          font-size: 12px;
        }

        .sm-status {
          display: inline-block;
          padding: 7px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 800;
          margin-top: 12px;
        }

        .sm-status.ok {
          background: #e0f7e8;
          color: #087e4d;
        }

        .sm-status.notyet {
          background: #fff1e5;
          color: #aa621d;
        }

        .sm-status.unknown {
          background: #eef1f3;
          color: #6a7b80;
        }

        .sm-history {
          border-bottom: 1px solid #e8efeb;
          padding: 13px 0;
        }

        .sm-history:last-child {
          border-bottom: none;
        }

        .sm-error {
          background: #fff0f0;
          color: #a52c2c;
          border: 1px solid #f3c0c0;
          border-radius: 11px;
          padding: 14px;
          margin-bottom: 15px;
          overflow-wrap: anywhere;
        }

        .sm-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-bottom: 15px;
        }

        @media (max-width: 760px) {
          .sm-container {
            padding: 12px;
          }

          .sm-header {
            padding: 15px;
          }

          .sm-brand {
            font-size: 19px;
          }

          .sm-card {
            padding: 15px;
          }

          .sm-title {
            font-size: 23px;
          }

          .sm-grid {
            grid-template-columns: 1fr;
          }

          .sm-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>

      <header className="sm-header">
        <div className="sm-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          className="sm-button light"
          onClick={() => router.push(`/monitoring/${id}`)}
        >
          ← Kembali
        </button>
      </header>

      <div className="sm-container">
        <h1 className="sm-title">Monitoring Samapta</h1>

        <p className="sm-subtitle">
          Monitoring hasil tes kesamaptaan peserta OJT
          berdasarkan periode pelaksanaan.
        </p>

        {loading ? (
          <div className="sm-card">Memuat data Samapta...</div>
        ) : error ? (
          <div className="sm-error">{error}</div>
        ) : (
          <>
            <section className="sm-card sm-profile">
              <div>
                <strong>
                  {peserta?.full_name || "Peserta OJT"}
                </strong>
                <div className="sm-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div>
                <strong>{program?.site || "—"}</strong>
                <div className="sm-muted">Site OJT</div>
              </div>
            </section>

            <section className="sm-card">
              <h2>Pilih Periode Tes</h2>

              <select
                className="sm-select"
                value={period}
                onChange={(event) =>
                  setPeriod(event.target.value)
                }
              >
                {PERIODS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </section>

            <section className="sm-card">
              <div className="sm-summary">
                <div className="sm-stat">
                  <small>Jenis Tes Terbaca</small>
                  <strong>{knownCount}/5</strong>
                </div>

                <div className="sm-stat">
                  <small>Memenuhi Target Akhir</small>
                  <strong>{passedCount}/5</strong>
                </div>

                <div className="sm-stat">
                  <small>Catatan Periode</small>
                  <strong>{selectedRecords.length}</strong>
                </div>
              </div>

              <p className="sm-muted">
                Target akhir ditampilkan sebagai pembanding.
                Hasil tes awal atau perkembangan tidak otomatis
                dinyatakan gagal jika belum memenuhi target akhir.
              </p>
            </section>

            <section className="sm-card">
              <h2>Hasil Tes Samapta</h2>

              <div className="sm-grid">
                {TARGETS.map((target) => {
                  const record = latestResults[target.key];

                  const value = record?.result_value;

                  const reached = record
                    ? targetReached(value, target)
                    : null;

                  const decimals =
                    target.key === "shuttle" ? 2 : 0;

                  return (
                    <div
                      className="sm-result"
                      key={target.key}
                    >
                      <h3>{target.name}</h3>

                      <div className="sm-value">
                        {record
                          ? `${formatNumber(value, decimals)} ${target.unit}`
                          : "Belum ada data"}
                      </div>

                      <div className="sm-target">
                        Target akhir:{" "}
                        {target.direction === "max"
                          ? "≤"
                          : "≥"}
                        {formatNumber(
                          target.target,
                          decimals
                        )}{" "}
                        {target.unit}
                      </div>

                      <span
                        className={`sm-status ${
                          reached === true
                            ? "ok"
                            : reached === false
                            ? "notyet"
                            : "unknown"
                        }`}
                      >
                        {reached === true
                          ? "Memenuhi target akhir"
                          : reached === false
                          ? "Belum memenuhi target akhir"
                          : "Belum ada hasil"}
                      </span>

                      {record && (
                        <div className="sm-muted">
                          Tanggal: {formatDate(record.test_date)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="sm-card">
              <div className="sm-actions">
                <button
                  className="sm-button light"
                  disabled={refreshing}
                  onClick={() => loadData(true)}
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              <h2>Riwayat Tes Samapta</h2>

              {!selectedRecords.length ? (
                <p className="sm-muted">
                  Belum ada hasil tes untuk periode ini.
                </p>
              ) : (
                selectedRecords.map((item) => (
                  <div className="sm-history" key={item.id}>
                    <strong>
                      {getExercise(item.outcome)
                        ? TARGETS.find(
                            (target) =>
                              target.key ===
                              getExercise(item.outcome)
                          )?.name
                        : item.outcome || "Jenis tes belum diketahui"}
                    </strong>

                    <div className="sm-muted">
                      Tanggal: {formatDate(item.test_date)}
                    </div>

                    <div className="sm-muted">
                      Hasil:{" "}
                      {isValidValue(item.result_value)
                        ? item.result_value
                        : "Belum tercatat"}
                    </div>

                    {item.score != null && (
                      <div className="sm-muted">
                        Nilai: {item.score}
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>

            {grouped.lainnya.length > 0 && (
              <section className="sm-card">
                <h2>Catatan Belum Terklasifikasi</h2>

                <p className="sm-muted">
                  Ada {grouped.lainnya.length} catatan
                  dengan jenis periode yang belum dikenali.
                  Data tersebut tetap tersimpan dan tidak
                  diubah oleh halaman monitoring.
                </p>

                {grouped.lainnya.map((item) => (
                  <div className="sm-history" key={item.id}>
                    <strong>{item.test_type || "—"}</strong>
                    <div className="sm-muted">
                      {formatDate(item.test_date)} ·{" "}
                      {item.outcome || "—"} ·{" "}
                      {item.result_value ?? "—"}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
