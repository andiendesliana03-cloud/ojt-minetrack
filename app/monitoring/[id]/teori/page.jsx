
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

export default function MonitoringTeori() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(showLoading = false) {
    if (!programId) {
      setError("ID program OJT tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (showLoading) {
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
        data: scoreData,
        error: scoreError,
      } = await supabase
        .from("post_test_scores")
        .select(`
          id,
          program_id,
          test_date,
          score,
          notes,
          created_at
        `)
        .eq("program_id", programId)
        .order("test_date", {
          ascending: false,
        });

      if (scoreError) throw scoreError;

      setProgram(programData);
      setScores(scoreData || []);
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memuat data Monitoring Teori."
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
    const values = scores
      .filter(
        (item) =>
          item.score !== null &&
          item.score !== undefined &&
          item.score !== ""
      )
      .map((item) => Number(item.score))
      .filter(Number.isFinite);

    const total = values.length;

    if (total === 0) {
      return {
        totalTests: scores.length,
        average: null,
        highest: null,
        lowest: null,
        latest: null,
      };
    }

    const sum = values.reduce(
      (acc, value) => acc + value,
      0
    );

    const latestScore = scores.find(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        Number.isFinite(Number(item.score))
    );

    return {
      totalTests: scores.length,
      average: sum / total,
      highest: Math.max(...values),
      lowest: Math.min(...values),
      latest: latestScore
        ? Number(latestScore.score)
        : null,
    };
  }, [scores]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  if (loading) {
    return (
      <main className="te-loading">
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Teori...</p>
      </main>
    );
  }

  return (
    <main className="te-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .te-root {
          min-height: 100vh;
          background: #f0f6f4;
          color: #10332e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .te-loading {
          min-height: 100vh;
          background: #f0f6f4;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .te-header {
          background: #07343c;
          color: white;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .te-brand {
          font-size: 23px;
          font-weight: 900;
        }

        .te-brand span {
          color: #27c68c;
        }

        .te-back {
          border: none;
          border-radius: 12px;
          background: #e1f5eb;
          color: #08664a;
          font-weight: 800;
          padding: 13px 20px;
          cursor: pointer;
        }

        .te-container {
          max-width: 960px;
          margin: auto;
          padding: 22px;
        }

        .te-title {
          font-size: 28px;
          margin: 0 0 12px;
          font-weight: 900;
        }

        .te-description {
          color: #738b82;
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .te-card {
          background: white;
          border: 1px solid #d9e8e1;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .te-card h2 {
          font-size: 22px;
          margin: 0 0 20px;
        }

        .te-profile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .te-profile strong {
          font-size: 21px;
        }

        .te-muted {
          color: #748d82;
          line-height: 1.6;
        }

        .te-dark {
          background: #252525;
          border-radius: 19px;
          color: white;
          padding: 28px;
        }

        .te-dark-label {
          color: #b5c2c5;
          font-size: 15px;
        }

        .te-average {
          font-size: 48px;
          font-weight: 900;
          margin: 20px 0 10px;
        }

        .te-dark-desc {
          color: #b5c2c5;
          font-size: 13px;
          line-height: 1.7;
        }

        .te-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .te-stat {
          background: #edf8f2;
          border: 1px solid #d2eadc;
          border-radius: 14px;
          padding: 19px;
        }

        .te-stat small {
          display: block;
          color: #718d80;
          line-height: 1.5;
        }

        .te-stat strong {
          display: block;
          color: #008755;
          font-size: 25px;
          margin-top: 11px;
          overflow-wrap: anywhere;
        }

        .te-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .te-refresh {
          border: none;
          border-radius: 11px;
          padding: 12px 17px;
          background: #e0f5e9;
          color: #008554;
          font-weight: 800;
          cursor: pointer;
        }

        .te-refresh:disabled {
          opacity: .5;
        }

        .te-history {
          border: 1px solid #deebe4;
          border-radius: 13px;
          padding: 18px;
          margin-top: 14px;
        }

        .te-history-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .te-history-date {
          font-weight: 800;
          color: #10332e;
        }

        .te-history-score {
          background: #e6f8ed;
          color: #008650;
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 20px;
          font-weight: 900;
        }

        .te-history p {
          color: #71897e;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
          margin-bottom: 0;
        }

        .te-empty {
          text-align: center;
          padding: 32px 16px;
          background: #f4faf6;
          border-radius: 13px;
          color: #71897e;
          line-height: 1.8;
        }

        .te-empty-icon {
          font-size: 40px;
          margin-bottom: 10px;
        }

        .te-alert {
          background: #fff1f1;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
          overflow-wrap: anywhere;
        }

        .te-footer {
          text-align: center;
          color: #8ba398;
          font-size: 12px;
          padding: 20px;
        }

        @media (max-width: 650px) {
          .te-header {
            padding: 16px;
          }

          .te-brand {
            font-size: 19px;
          }

          .te-back {
            padding: 11px 14px;
          }

          .te-container {
            padding: 16px;
          }

          .te-title {
            font-size: 24px;
          }

          .te-card {
            padding: 19px;
          }

          .te-card h2 {
            font-size: 20px;
          }

          .te-dark {
            padding: 22px;
          }

          .te-average {
            font-size: 42px;
          }

          .te-stat {
            padding: 14px;
          }

          .te-stat strong {
            font-size: 22px;
          }

          .te-profile strong {
            font-size: 18px;
          }
        }
      `}</style>

      <header className="te-header">
        <div className="te-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="te-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="te-container">
        <h1 className="te-title">
          Monitoring Teori
        </h1>

        <p className="te-description">
          Monitoring hasil pembelajaran teori
          berdasarkan nilai post-test peserta OJT.
          Data ditampilkan sesuai hasil penilaian
          yang telah tersimpan di sistem.
        </p>

        {error && (
          <div className="te-alert" role="alert">
            {error}
          </div>
        )}

        {program && (
          <>
            <section className="te-card te-profile">
              <div>
                <strong>
                  {peserta?.full_name ||
                    "Peserta OJT"}
                </strong>

                <div className="te-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>
                  {program.site || "—"}
                </strong>

                <div className="te-muted">
                  Site OJT
                </div>
              </div>
            </section>

            <section className="te-card">
              <div className="te-dark">
                <div className="te-dark-label">
                  Rata-rata Nilai Post-Test
                </div>

                <div className="te-average">
                  {formatScore(summary.average)}
                </div>

                <div className="te-dark-desc">
                  Dihitung berdasarkan seluruh nilai
                  post-test peserta yang tersedia.
                </div>
              </div>
            </section>

            <section className="te-card">
              <h2>Ringkasan Penilaian Teori</h2>

              <div className="te-grid">
                <div className="te-stat">
                  <small>
                    Jumlah Post-Test
                  </small>

                  <strong>
                    {summary.totalTests}
                  </strong>
                </div>

                <div className="te-stat">
                  <small>
                    Nilai Tertinggi
                  </small>

                  <strong>
                    {formatScore(summary.highest)}
                  </strong>
                </div>

                <div className="te-stat">
                  <small>
                    Nilai Terendah
                  </small>

                  <strong>
                    {formatScore(summary.lowest)}
                  </strong>
                </div>

                <div className="te-stat">
                  <small>
                    Nilai Terbaru
                  </small>

                  <strong>
                    {formatScore(summary.latest)}
                  </strong>
                </div>
              </div>
            </section>

            <section className="te-card">
              <div className="te-actions">
                <button
                  type="button"
                  className="te-refresh"
                  onClick={() => loadData(false)}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <h2>Riwayat Nilai Post-Test</h2>

              {scores.length === 0 ? (
                <div className="te-empty">
                  <div className="te-empty-icon">
                    📚
                  </div>

                  <strong>
                    Belum ada nilai post-test
                  </strong>

                  <p>
                    Data nilai akan muncul setelah
                    mentor melakukan input penilaian.
                  </p>
                </div>
              ) : (
                scores.map((item) => (
                  <div
                    className="te-history"
                    key={item.id}
                  >
                    <div className="te-history-top">
                      <span className="te-history-date">
                        {formatDate(item.test_date)}
                      </span>

                      <span className="te-history-score">
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

        <footer className="te-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
