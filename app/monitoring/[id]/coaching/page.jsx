
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;
const TARGET_WEEK = 1;
const TARGET_TOTAL = TOTAL_WEEKS * TARGET_WEEK;

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (parts.length !== 3) return null;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

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

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const week =
    Math.floor(
      (date.getTime() - start.getTime()) / 604800000
    ) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

export default function MonitoringCoaching() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [coachingCode, setCoachingCode] = useState(null);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData(initial = false) {
    if (!programId) {
      setError("ID program tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (initial) setLoading(true);
    else setRefreshing(true);

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

      const role = String(profile?.role || "").toLowerCase();

      if (!["mentor", "participant", "peserta"].includes(role)) {
        throw new Error(
          "Akun tidak memiliki akses monitoring."
        );
      }

      let programQuery = supabase
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

      if (role !== "mentor") {
        programQuery = programQuery.eq(
          "participant_id",
          user.id
        );
      }

      const [programResult, typesResult] =
        await Promise.all([
          programQuery.single(),
          supabase
            .from("achievement_types")
            .select("code,name"),
        ]);

      if (programResult.error) {
        throw programResult.error;
      }

      if (typesResult.error) {
        throw typesResult.error;
      }

      const type = (typesResult.data || []).find(
        (item) => normalize(item.name) === "coaching"
      );

      if (!type) {
        throw new Error(
          "Kategori Coaching belum ditemukan pada achievement_types."
        );
      }

      const recordsResult = await supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description,status,created_at"
        )
        .eq("program_id", programId)
        .eq("type_code", type.code)
        .order("activity_date", { ascending: false });

      if (recordsResult.error) {
        throw recordsResult.error;
      }

      setProgram(programResult.data);
      setCoachingCode(type.code);
      setRecords(recordsResult.data || []);

      if (initial) {
        const currentWeek = weekOf(
          new Date().toISOString().slice(0, 10),
          programResult.data.start_date
        );

        setSelectedWeek(currentWeek || 1);
      }
    } catch (err) {
      setError(
        err?.message || "Gagal memuat Monitoring Coaching."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  const peserta = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const summary = useMemo(() => {
    const verified = records.filter(
      (item) => item.status === "verified"
    );

    const pending = records.filter(
      (item) => item.status === "pending"
    );

    const weeks = Array.from(
      { length: TOTAL_WEEKS },
      (_, index) => {
        const week = index + 1;

        const weekRecords = records.filter(
          (item) =>
            weekOf(
              item.activity_date,
              program?.start_date
            ) === week
        );

        const verifiedCount = weekRecords.filter(
          (item) => item.status === "verified"
        ).length;

        return {
          week,
          records: weekRecords,
          verifiedCount,
          pendingCount: weekRecords.filter(
            (item) => item.status === "pending"
          ).length,
          percent: Math.min(
            100,
            (verifiedCount / TARGET_WEEK) * 100
          ),
          achieved: verifiedCount >= TARGET_WEEK,
        };
      }
    );

    const totalVerified = verified.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    ).length;

    const totalPending = pending.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    ).length;

    const achievedWeeks = weeks.filter(
      (item) => item.achieved
    ).length;

    return {
      weeks,
      totalVerified,
      totalPending,
      achievedWeeks,
      overallPercent: Math.min(
        100,
        (totalVerified / TARGET_TOTAL) * 100
      ),
    };
  }, [records, program]);

  const selected =
    summary.weeks[selectedWeek - 1] || {
      records: [],
      verifiedCount: 0,
      pendingCount: 0,
      percent: 0,
      achieved: false,
    };

  const startWeek = program?.start_date
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7
      )
    : null;

  const endWeek = startWeek
    ? addDays(startWeek, 6)
    : null;

  const remaining = Math.max(
    0,
    TARGET_WEEK - selected.verifiedCount
  );

  return (
    <main className="mc-root">
      <style>{`
        .mc-root {
          min-height: 100vh;
          background: #f0f5f4;
          color: #10383a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .mc-root * {
          box-sizing: border-box;
        }

        .mc-header {
          background: #07313a;
          color: white;
          padding: 17px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mc-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .mc-brand span {
          color: #3bc78e;
        }

        .mc-back {
          background: #e1f2e9;
          color: #0a694d;
          border: 0;
          border-radius: 10px;
          padding: 12px 16px;
          font-weight: 800;
          cursor: pointer;
        }

        .mc-container {
          max-width: 1050px;
          margin: auto;
          padding: 20px;
        }

        .mc-title {
          font-size: 25px;
          margin: 0 0 12px;
        }

        .mc-subtitle {
          color: #718782;
          line-height: 1.7;
          margin-bottom: 22px;
        }

        .mc-card {
          background: white;
          border: 1px solid #dce8e3;
          border-radius: 17px;
          padding: 20px;
          margin-bottom: 18px;
        }

        .mc-profile {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .mc-profile strong {
          display: block;
          font-size: 19px;
        }

        .mc-muted {
          color: #748a85;
          font-size: 13px;
          line-height: 1.6;
        }

        .mc-section-title {
          font-size: 20px;
          margin: 0 0 20px;
        }

        .mc-select {
          width: 100%;
          border: 1px solid #cbded4;
          border-radius: 11px;
          background: white;
          color: #123d37;
          padding: 15px;
          font-size: 16px;
        }

        .mc-period {
          margin: 12px 0 0;
          color: #718782;
        }

        .mc-dark {
          background: #242424;
          border-radius: 16px;
          color: white;
          padding: 24px;
        }

        .mc-dark-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .mc-dark-label {
          color: #b5bec0;
        }

        .mc-percent {
          background: #3d302b;
          color: #ff914d;
          border-radius: 30px;
          padding: 9px 15px;
          font-weight: 900;
        }

        .mc-number {
          font-size: 35px;
          font-weight: 900;
          margin: 15px 0 22px;
        }

        .mc-number small {
          font-size: 16px;
          color: #b6c0c1;
        }

        .mc-progress {
          height: 12px;
          background: #404040;
          border-radius: 20px;
          overflow: hidden;
          margin: 22px 0 25px;
        }

        .mc-progress span {
          display: block;
          height: 100%;
          background: #31aa62;
          border-radius: inherit;
        }

        .mc-dark-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .mc-dark-grid small {
          display: block;
          color: #b5bec0;
          line-height: 1.5;
          margin-bottom: 9px;
        }

        .mc-dark-grid strong {
          font-size: 22px;
        }

        .mc-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .mc-stat {
          background: #eef8f2;
          border: 1px solid #d1e9d9;
          border-radius: 12px;
          padding: 17px;
        }

        .mc-stat small {
          display: block;
          color: #668379;
          line-height: 1.5;
          margin-bottom: 10px;
        }

        .mc-stat strong {
          display: block;
          color: #078052;
          font-size: 23px;
        }

        .mc-history-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 17px;
        }

        .mc-history-top h2 {
          margin: 0;
          font-size: 20px;
        }

        .mc-refresh {
          border: 0;
          background: #e4f6ec;
          color: #078052;
          border-radius: 10px;
          padding: 12px 15px;
          font-weight: 800;
          cursor: pointer;
        }

        .mc-refresh:disabled {
          opacity: .6;
        }

        .mc-history {
          border: 1px solid #dfebe5;
          border-radius: 12px;
          padding: 16px;
          margin-top: 13px;
        }

        .mc-history-heading {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .mc-icon {
          width: 44px;
          height: 44px;
          flex-shrink: 0;
          background: #edf7f1;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-size: 22px;
        }

        .mc-history-date {
          font-weight: 900;
          margin-bottom: 7px;
        }

        .mc-status {
          color: #088456;
          font-weight: 700;
          font-size: 13px;
        }

        .mc-status.pending {
          color: #c37b14;
        }

        .mc-description {
          color: #667e75;
          line-height: 1.7;
          margin: 12px 0 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .mc-error {
          background: #fff0f0;
          border: 1px solid #f1b8b8;
          border-radius: 12px;
          color: #a82632;
          padding: 15px;
          margin-bottom: 17px;
        }

        @media (max-width: 760px) {
          .mc-header {
            padding: 15px;
          }

          .mc-brand {
            font-size: 18px;
          }

          .mc-container {
            padding: 12px;
          }

          .mc-title {
            font-size: 22px;
          }

          .mc-card {
            padding: 16px;
            margin-bottom: 12px;
          }

          .mc-dark {
            padding: 20px;
          }

          .mc-number {
            font-size: 30px;
          }

          .mc-stat {
            padding: 13px;
          }

          .mc-stat strong {
            font-size: 19px;
          }

          .mc-section-title {
            font-size: 18px;
          }
        }
      `}</style>

      <header className="mc-header">
        <div className="mc-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="mc-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="mc-container">
        <h1 className="mc-title">
          Monitoring Coaching
        </h1>

        <p className="mc-subtitle">
          Monitoring kegiatan pembinaan peserta
          berdasarkan minggu OJT. Hanya kegiatan
          yang telah diverifikasi Mentor yang
          dihitung sebagai pencapaian.
        </p>

        {error && (
          <div className="mc-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mc-card">
            Memuat data Coaching...
          </div>
        ) : program ? (
          <>
            <section className="mc-card mc-profile">
              <div>
                <strong>
                  {peserta?.full_name || "Peserta OJT"}
                </strong>
                <div className="mc-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>
                  {program.site || "—"}
                </strong>
                <div className="mc-muted">
                  Site OJT
                </div>
              </div>
            </section>

            <section className="mc-card">
              <h2 className="mc-section-title">
                Pilih Minggu Monitoring
              </h2>

              <select
                className="mc-select"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(Number(event.target.value))
                }
              >
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => index + 1
                ).map((week) => (
                  <option key={week} value={week}>
                    {weekLabel(week)}
                  </option>
                ))}
              </select>

              <p className="mc-period">
                {formatDate(startWeek)} –{" "}
                {formatDate(endWeek)}
              </p>
            </section>

            <section className="mc-card">
              <div className="mc-dark">
                <div className="mc-dark-top">
                  <span className="mc-dark-label">
                    Realisasi {weekLabel(selectedWeek)}
                  </span>

                  <span className="mc-percent">
                    {selected.percent.toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </span>
                </div>

                <div className="mc-number">
                  {selected.verifiedCount}
                  <small> / 1 kegiatan</small>
                </div>

                <div className="mc-progress">
                  <span
                    style={{
                      width: `${selected.percent}%`,
                    }}
                  />
                </div>

                <div className="mc-dark-grid">
                  <div>
                    <small>
                      Kegiatan Terverifikasi
                    </small>
                    <strong>
                      {selected.verifiedCount} kali
                    </strong>
                  </div>

                  <div>
                    <small>Sisa Target</small>
                    <strong>
                      {remaining} kegiatan
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="mc-card">
              <h2 className="mc-section-title">
                Ringkasan Coaching
              </h2>

              <div className="mc-stats">
                <div className="mc-stat">
                  <small>
                    Total Terverifikasi 25 Minggu
                  </small>
                  <strong>
                    {summary.totalVerified} kegiatan
                  </strong>
                </div>

                <div className="mc-stat">
                  <small>Target 25 Minggu</small>
                  <strong>
                    {TARGET_TOTAL} kegiatan
                  </strong>
                </div>

                <div className="mc-stat">
                  <small>Menunggu Verifikasi</small>
                  <strong>
                    {summary.totalPending}
                  </strong>
                </div>

                <div className="mc-stat">
                  <small>
                    Minggu Mencapai Target
                  </small>
                  <strong>
                    {summary.achievedWeeks}/25
                  </strong>
                </div>
              </div>

              <p className="mc-muted" style={{ marginTop: 17 }}>
                Pencapaian keseluruhan:{" "}
                {summary.overallPercent.toLocaleString(
                  "id-ID",
                  { maximumFractionDigits: 2 }
                )}
                %. Jumlah kegiatan dihitung berdasarkan
                catatan yang telah diverifikasi.
              </p>
            </section>

            <section className="mc-card">
              <div className="mc-history-top">
                <h2>
                  Riwayat Coaching —{" "}
                  {weekLabel(selectedWeek)}
                </h2>

                <button
                  type="button"
                  className="mc-refresh"
                  disabled={refreshing}
                  onClick={() => loadData(false)}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <p className="mc-muted">
                {selected.records.length} catatan
                kegiatan pada minggu ini.
              </p>

              {!selected.records.length && (
                <p className="mc-muted">
                  Belum ada kegiatan Coaching pada
                  minggu ini.
                </p>
              )}

              {selected.records.map((item) => (
                <div
                  className="mc-history"
                  key={item.id}
                >
                  <div className="mc-history-heading">
                    <div className="mc-icon">
                      👥
                    </div>

                    <div>
                      <div className="mc-history-date">
                        {formatDate(item.activity_date)}
                      </div>

                      <div
                        className={`mc-status ${
                          item.status === "pending"
                            ? "pending"
                            : ""
                        }`}
                      >
                        {item.status === "verified"
                          ? "✓ Terverifikasi"
                          : item.status === "pending"
                          ? "⏳ Menunggu Verifikasi"
                          : item.status || "Status tidak tersedia"}
                      </div>

                      <p className="mc-description">
                        {item.description ||
                          "Tidak ada keterangan kegiatan."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : (
          <div className="mc-card">
            Data peserta belum dapat ditampilkan.
          </div>
        )}
      </div>
    </main>
  );
}
