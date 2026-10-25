
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (parts.length !== 3) return null;

  const [year, month, day] = parts;

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const week =
    Math.floor(
      (date.getTime() - start.getTime()) /
        604800000
    ) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
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
    maximumFractionDigits: 2,
  });
}

function averageOf(items) {
  const values = items
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  if (values.length === 0) return null;

  return (
    values.reduce((total, value) => total + value, 0) /
    values.length
  );
}

export default function MonitoringPraktik() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(initial = false) {
    if (!programId) {
      setError("ID program OJT tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (initial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const { data: auth, error: authError } =
        await supabase.auth.getUser();

      if (authError || !auth?.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", auth.user.id)
          .single();

      if (profileError) throw profileError;

      const role = String(
        profile?.role || ""
      ).toLowerCase();

      const isMentor = role === "mentor";

      const isParticipant = [
        "participant",
        "peserta",
      ].includes(role);

      if (!isMentor && !isParticipant) {
        throw new Error(
          "Akun tidak memiliki akses monitoring."
        );
      }

      let query = supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          site,
          start_date,
          end_date,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("id", programId);

      if (isParticipant) {
        query = query.eq(
          "participant_id",
          auth.user.id
        );
      }

      const {
        data: programData,
        error: programError,
      } = await query.single();

      if (programError) throw programError;

      const {
        data: practiceData,
        error: practiceError,
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

      if (practiceError) throw practiceError;

      setProgram(programData);
      setRecords(practiceData || []);

      if (initial) {
        const today = new Date()
          .toISOString()
          .slice(0, 10);

        const currentWeek = weekOf(
          today,
          programData.start_date
        );

        setSelectedWeek(currentWeek || 1);
      }
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memuat data Monitoring Praktik."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(true);
  }, [programId]);

  const summary = useMemo(() => {
    const validRecords = records.filter(
      (item) =>
        weekOf(
          item.practice_date,
          program?.start_date
        ) !== null
    );

    const weeklyRecords = validRecords.filter(
      (item) =>
        weekOf(
          item.practice_date,
          program?.start_date
        ) === selectedWeek
    );

    const numericScores = validRecords
      .filter(
        (item) =>
          item.score !== null &&
          item.score !== undefined &&
          item.score !== ""
      )
      .map((item) => Number(item.score))
      .filter(Number.isFinite);

    const weeksWithScores = new Set(
      validRecords
        .filter(
          (item) =>
            item.score !== null &&
            item.score !== undefined &&
            Number.isFinite(Number(item.score))
        )
        .map((item) =>
          weekOf(
            item.practice_date,
            program?.start_date
          )
        )
    ).size;

    return {
      total: validRecords.length,
      average: averageOf(validRecords),
      weeklyAverage: averageOf(weeklyRecords),
      highest:
        numericScores.length > 0
          ? Math.max(...numericScores)
          : null,
      lowest:
        numericScores.length > 0
          ? Math.min(...numericScores)
          : null,
      weeksWithScores,
      weeklyRecords,
      weeklyCount: weeklyRecords.length,
    };
  }, [records, program, selectedWeek]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const startWeekDate = program?.start_date
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7
      )
    : null;

  const endWeekDate = startWeekDate
    ? addDays(startWeekDate, 6)
    : null;

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f0f6f4",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Praktik...</p>
      </main>
    );
  }

  return (
    <main className="pr-root">
      <style>{`
        .pr-root {
          min-height: 100vh;
          background: #f0f6f4;
          color: #10332e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .pr-root * {
          box-sizing: border-box;
        }

        .pr-header {
          background: #07343c;
          color: white;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pr-brand {
          font-size: 23px;
          font-weight: 900;
        }

        .pr-brand span {
          color: #27c68c;
        }

        .pr-back {
          border: none;
          border-radius: 12px;
          background: #e1f5eb;
          color: #08664a;
          font-weight: 800;
          padding: 13px 20px;
          cursor: pointer;
        }

        .pr-container {
          max-width: 960px;
          margin: auto;
          padding: 22px;
        }

        .pr-title {
          font-size: 28px;
          margin: 0 0 12px;
          font-weight: 900;
        }

        .pr-description {
          color: #738b82;
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .pr-card {
          background: white;
          border: 1px solid #d9e8e1;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .pr-card h2 {
          font-size: 22px;
          margin: 0 0 20px;
        }

        .pr-profile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .pr-profile strong {
          font-size: 21px;
        }

        .pr-muted {
          color: #748d82;
          line-height: 1.6;
        }

        .pr-select {
          width: 100%;
          padding: 17px;
          border: 1px solid #c8ded2;
          border-radius: 12px;
          background: white;
          color: #10332e;
          font-size: 17px;
        }

        .pr-period {
          margin: 14px 0 0;
          color: #748d82;
        }

        .pr-dark {
          background: #252525;
          border-radius: 19px;
          color: white;
          padding: 28px;
        }

        .pr-dark-label {
          color: #b5c2c5;
          font-size: 15px;
        }

        .pr-average {
          font-size: 48px;
          font-weight: 900;
          margin: 20px 0 10px;
        }

        .pr-dark-desc {
          color: #b5c2c5;
          font-size: 13px;
          line-height: 1.7;
        }

        .pr-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .pr-stat {
          background: #edf8f2;
          border: 1px solid #d2eadc;
          border-radius: 14px;
          padding: 19px;
        }

        .pr-stat small {
          display: block;
          color: #718d80;
          line-height: 1.5;
        }

        .pr-stat strong {
          display: block;
          color: #008755;
          font-size: 23px;
          margin-top: 11px;
          overflow-wrap: anywhere;
        }

        .pr-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .pr-refresh {
          border: none;
          border-radius: 11px;
          padding: 12px 17px;
          background: #e0f5e9;
          color: #008554;
          font-weight: 800;
          cursor: pointer;
        }

        .pr-refresh:disabled {
          opacity: .5;
        }

        .pr-history {
          border: 1px solid #deebe4;
          border-radius: 13px;
          padding: 18px;
          margin-top: 14px;
        }

        .pr-history-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .pr-history-title {
          font-weight: 800;
          color: #10332e;
          overflow-wrap: anywhere;
        }

        .pr-history-score {
          background: #e6f8ed;
          color: #008650;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 20px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .pr-history p {
          color: #71897e;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .pr-empty {
          text-align: center;
          padding: 32px 16px;
          background: #f4faf6;
          border-radius: 13px;
          color: #71897e;
          line-height: 1.8;
        }

        .pr-empty-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }

        .pr-alert {
          background: #fff1f1;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
          overflow-wrap: anywhere;
        }

        .pr-footer {
          text-align: center;
          color: #8ba398;
          font-size: 12px;
          padding: 20px;
        }

        @media (max-width: 650px) {
          .pr-header {
            padding: 16px;
          }

          .pr-brand {
            font-size: 19px;
          }

          .pr-back {
            padding: 11px 14px;
          }

          .pr-container {
            padding: 16px;
          }

          .pr-title {
            font-size: 24px;
          }

          .pr-card {
            padding: 19px;
          }

          .pr-card h2 {
            font-size: 20px;
          }

          .pr-dark {
            padding: 22px;
          }

          .pr-average {
            font-size: 42px;
          }

          .pr-stat {
            padding: 14px;
          }

          .pr-stat strong {
            font-size: 20px;
          }

          .pr-profile strong {
            font-size: 18px;
          }
        }
      `}</style>

      <header className="pr-header">
        <div className="pr-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="pr-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="pr-container">
        <h1 className="pr-title">
          Monitoring Praktik
        </h1>

        <p className="pr-description">
          Monitoring hasil penilaian praktik peserta
          selama 25 minggu OJT. Nilai dan riwayat
          praktik ditampilkan berdasarkan data
          yang telah diinput mentor.
        </p>

        {error && (
          <div className="pr-alert" role="alert">
            {error}
          </div>
        )}

        {program && (
          <>
            <section className="pr-card pr-profile">
              <div>
                <strong>
                  {peserta?.full_name ||
                    "Peserta OJT"}
                </strong>

                <div className="pr-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>
                  {program.site || "—"}
                </strong>

                <div className="pr-muted">
                  Site OJT
                </div>
              </div>
            </section>

            <section className="pr-card">
              <h2>Pilih Minggu Monitoring</h2>

              <select
                className="pr-select"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(
                    Number(event.target.value)
                  )
                }
              >
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => index + 1
                ).map((week) => (
                  <option key={week} value={week}>
                    Week {String(week).padStart(2, "0")}
                  </option>
                ))}
              </select>

              <p className="pr-period">
                {formatDate(startWeekDate)}
                {" – "}
                {formatDate(endWeekDate)}
              </p>
            </section>

            <section className="pr-card">
              <div className="pr-dark">
                <div className="pr-dark-label">
                  Rata-rata Nilai Praktik
                  {" — "}
                  Week {String(selectedWeek).padStart(2, "0")}
                </div>

                <div className="pr-average">
                  {formatScore(summary.weeklyAverage)}
                </div>

                <div className="pr-dark-desc">
                  Berdasarkan nilai praktik yang
                  tercatat pada minggu terpilih.
                </div>
              </div>
            </section>

            <section className="pr-card">
              <h2>Ringkasan Penilaian Praktik</h2>

              <div className="pr-grid">
                <div className="pr-stat">
                  <small>
                    Total Kegiatan Praktik
                  </small>

                  <strong>
                    {summary.total}
                  </strong>
                </div>

                <div className="pr-stat">
                  <small>
                    Rata-rata Keseluruhan
                  </small>

                  <strong>
                    {formatScore(summary.average)}
                  </strong>
                </div>

                <div className="pr-stat">
                  <small>
                    Nilai Tertinggi
                  </small>

                  <strong>
                    {formatScore(summary.highest)}
                  </strong>
                </div>

                <div className="pr-stat">
                  <small>
                    Nilai Terendah
                  </small>

                  <strong>
                    {formatScore(summary.lowest)}
                  </strong>
                </div>

                <div className="pr-stat">
                  <small>
                    Minggu Memiliki Nilai
                  </small>

                  <strong>
                    {summary.weeksWithScores}/{TOTAL_WEEKS}
                  </strong>
                </div>

                <div className="pr-stat">
                  <small>
                    Praktik Minggu Terpilih
                  </small>

                  <strong>
                    {summary.weeklyCount}
                  </strong>
                </div>
              </div>

              <p className="pr-muted">
                Ringkasan keseluruhan dihitung dari
                penilaian yang memiliki tanggal
                dalam periode 25 minggu OJT.
              </p>
            </section>

            <section className="pr-card">
              <div className="pr-actions">
                <button
                  type="button"
                  className="pr-refresh"
                  onClick={() => loadData(false)}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <h2>
                Riwayat Praktik — Week{" "}
                {String(selectedWeek).padStart(2, "0")}
              </h2>

              {summary.weeklyRecords.length === 0 ? (
                <div className="pr-empty">
                  <div className="pr-empty-icon">
                    📝
                  </div>

                  <strong>
                    Belum ada nilai praktik
                  </strong>

                  <p>
                    Data praktik akan muncul setelah
                    mentor melakukan input penilaian
                    pada minggu ini.
                  </p>
                </div>
              ) : (
                summary.weeklyRecords.map((item) => (
                  <div
                    className="pr-history"
                    key={item.id}
                  >
                    <div className="pr-history-top">
                      <div>
                        <div className="pr-history-title">
                          {item.practice_name ||
                            "Kegiatan Praktik"}
                        </div>

                        <div
                          className="pr-muted"
                          style={{ marginTop: 8 }}
                        >
                          {formatDate(
                            item.practice_date
                          )}
                        </div>
                      </div>

                      <span className="pr-history-score">
                        {formatScore(item.score)}
                      </span>
                    </div>

                    <p>
                      {item.notes ||
                        "Tidak ada catatan tambahan."}
                    </p>
                  </div>
                ))
              )}
            </section>
          </>
        )}

        <footer className="pr-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
