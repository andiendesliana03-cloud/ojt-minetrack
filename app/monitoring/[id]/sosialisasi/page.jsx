
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;
const WEEKLY_TARGET = 3;
const TOTAL_TARGET = TOTAL_WEEKS * WEEKLY_TARGET;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value) {
  if (!value) return null;

  const [year, month, day] = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (![year, month, day].every(Number.isInteger)) {
    return null;
  }

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
  return date;
}

function formatDate(value) {
  const date =
    value instanceof Date ? value : parseDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
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

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function Stat({ label, value }) {
  return (
    <div className="ms-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

export default function MonitoringSosialisasi() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    const [programResult, typesResult, recordsResult] =
      await Promise.all([
        supabase
          .from("ojt_programs")
          .select(`
            id,
            site,
            start_date,
            end_date,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId)
          .single(),

        supabase
          .from("achievement_types")
          .select("code,name"),

        supabase
          .from("achievement_records")
          .select(`
            id,
            type_code,
            activity_date,
            description,
            status,
            created_at
          `)
          .eq("program_id", programId)
          .order("activity_date", {
            ascending: false,
          }),
      ]);

    if (programResult.error) {
      throw programResult.error;
    }

    if (typesResult.error) {
      throw typesResult.error;
    }

    if (recordsResult.error) {
      throw recordsResult.error;
    }

    const type = (typesResult.data || []).find(
      (item) => normalize(item.name) === "sosialisasi"
    );

    if (!type) {
      throw new Error(
        "Kategori Sosialisasi belum ditemukan pada achievement_types."
      );
    }

    return {
      program: programResult.data,
      records: (recordsResult.data || []).filter(
        (item) => item.type_code === type.code
      ),
    };
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak ditemukan.");
      setLoading(false);
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const result = await loadData();

        if (!active) return;

        setProgram(result.program);
        setRecords(result.records);

        const currentWeek = weekOf(
          new Date().toISOString().slice(0, 10),
          result.program.start_date
        );

        setSelectedWeek(currentWeek || 1);
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat monitoring."
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
  }, [programId]);

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const result = await loadData();
      setProgram(result.program);
      setRecords(result.records);
    } catch (err) {
      setError(
        err.message || "Gagal memperbarui monitoring."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const summary = useMemo(() => {
    const verified = records.filter(
      (item) =>
        item.status === "verified" &&
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    );

    const pending = records.filter(
      (item) => item.status === "pending"
    );

    const weeklyCounts = Array.from(
      { length: TOTAL_WEEKS },
      () => 0
    );

    verified.forEach((item) => {
      const week = weekOf(
        item.activity_date,
        program?.start_date
      );

      if (week !== null) {
        weeklyCounts[week - 1] += 1;
      }
    });

    const weekCount =
      weeklyCounts[selectedWeek - 1] || 0;

    const totalVerified = verified.length;

    const achievedWeeks = weeklyCounts.filter(
      (count) => count >= WEEKLY_TARGET
    ).length;

    const weekRecords = records.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) === selectedWeek
    );

    return {
      weekCount,
      weekRecords,
      totalVerified,
      pending: pending.length,
      achievedWeeks,
      weeklyPercent:
        (weekCount / WEEKLY_TARGET) * 100,
      overallPercent:
        (totalVerified / TOTAL_TARGET) * 100,
      remaining: Math.max(
        0,
        WEEKLY_TARGET - weekCount
      ),
    };
  }, [records, program, selectedWeek]);

  const startDate = program
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7
      )
    : null;

  const endDate = program
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7 + 6
      )
    : null;

  const participantName =
    program?.peserta?.full_name || "Peserta OJT";

  if (loading) {
    return (
      <main className="ms-loading">
        Memuat Monitoring Sosialisasi...
      </main>
    );
  }

  return (
    <main className="ms-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .ms-root {
          min-height: 100vh;
          background: #eff5f3;
          color: #103532;
          font-family: Arial, Helvetica, sans-serif;
        }

        .ms-loading {
          padding: 30px;
          font-family: Arial, sans-serif;
        }

        .ms-header {
          background: #07343d;
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .ms-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .ms-brand span {
          color: #27c992;
        }

        .ms-back {
          background: #e2f6ec;
          color: #17664c;
          border: none;
          border-radius: 12px;
          padding: 14px 20px;
          font-weight: 800;
          cursor: pointer;
        }

        .ms-container {
          max-width: 1050px;
          margin: auto;
          padding: 22px;
        }

        .ms-title {
          font-size: 27px;
          margin: 0 0 15px;
          font-weight: 900;
        }

        .ms-subtitle {
          color: #718b84;
          line-height: 1.8;
          margin-bottom: 25px;
        }

        .ms-card {
          background: white;
          border: 1px solid #dbe9e3;
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 18px;
        }

        .ms-card h2 {
          font-size: 21px;
          margin: 0 0 22px;
        }

        .ms-profile {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
        }

        .ms-profile strong {
          display: block;
          font-size: 22px;
        }

        .ms-profile small {
          display: block;
          color: #728c84;
          margin-top: 5px;
        }

        .ms-site {
          text-align: right;
        }

        .ms-select {
          width: 100%;
          border: 1px solid #c9ded3;
          border-radius: 12px;
          padding: 18px;
          background: white;
          color: #103532;
          font-size: 17px;
        }

        .ms-period {
          color: #718b84;
          margin: 15px 0 0;
        }

        .ms-dark {
          background: #252525;
          border-radius: 20px;
          color: white;
          padding: 28px;
        }

        .ms-dark-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ms-dark-top span {
          color: #c2c2c2;
        }

        .ms-percent {
          background: #3b302b;
          color: #ff924f;
          padding: 12px 16px;
          border-radius: 40px;
          font-weight: 900;
        }

        .ms-value {
          font-size: 35px;
          font-weight: 900;
          margin: 20px 0 28px;
        }

        .ms-value small {
          font-size: 16px;
          color: #c6c6c6;
        }

        .ms-progress {
          background: #414141;
          border-radius: 30px;
          height: 13px;
          overflow: hidden;
        }

        .ms-progress span {
          display: block;
          height: 100%;
          background: #2da35d;
          border-radius: inherit;
        }

        .ms-dark-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-top: 30px;
        }

        .ms-dark-stats small {
          display: block;
          color: #bcbcbc;
          margin-bottom: 10px;
        }

        .ms-dark-stats strong {
          font-size: 24px;
        }

        .ms-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .ms-stat {
          background: #edf8f2;
          border: 1px solid #d2e9dc;
          border-radius: 14px;
          padding: 20px;
          min-width: 0;
        }

        .ms-stat small {
          display: block;
          color: #708a7d;
          line-height: 1.6;
        }

        .ms-stat strong {
          display: block;
          font-size: 23px;
          color: #00834f;
          margin-top: 12px;
          overflow-wrap: anywhere;
        }

        .ms-note {
          color: #718b84;
          line-height: 1.7;
          margin-top: 18px;
        }

        .ms-history {
          border: 1px solid #dce9e2;
          border-radius: 13px;
          padding: 18px;
          margin-top: 13px;
        }

        .ms-history strong {
          font-size: 17px;
        }

        .ms-history p {
          color: #718b84;
          line-height: 1.6;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .ms-status {
          display: inline-block;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 12px;
          font-weight: 800;
          margin-top: 9px;
        }

        .ms-status.verified {
          background: #e2f8ea;
          color: #008650;
        }

        .ms-status.pending {
          background: #fff4e2;
          color: #a86600;
        }

        .ms-refresh {
          background: #e2f6eb;
          color: #008350;
          border: 0;
          border-radius: 12px;
          padding: 13px 17px;
          font-weight: 800;
          cursor: pointer;
        }

        .ms-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 15px;
        }

        .ms-error {
          background: #fff0f0;
          border: 1px solid #f3baba;
          color: #b52c2c;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        @media (max-width: 700px) {
          .ms-header {
            padding: 16px;
          }

          .ms-brand {
            font-size: 19px;
          }

          .ms-back {
            padding: 12px;
          }

          .ms-container {
            padding: 16px;
          }

          .ms-title {
            font-size: 24px;
          }

          .ms-card {
            padding: 19px;
          }

          .ms-dark {
            padding: 22px;
          }

          .ms-value {
            font-size: 30px;
          }

          .ms-stat {
            padding: 15px;
          }

          .ms-stat strong {
            font-size: 20px;
          }
        }
      `}</style>

      <header className="ms-header">
        <div className="ms-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          className="ms-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="ms-container">
        <h1 className="ms-title">
          Monitoring Sosialisasi
        </h1>

        <p className="ms-subtitle">
          Monitoring kegiatan sosialisasi berdasarkan
          minggu OJT. Hanya kegiatan yang telah
          diverifikasi Mentor yang dihitung sebagai
          pencapaian.
        </p>

        {error && (
          <div className="ms-error">{error}</div>
        )}

        {program && (
          <>
            <section className="ms-card ms-profile">
              <div>
                <strong>{participantName}</strong>
                <small>
                  {program.peserta?.department || "ER & SS"}
                </small>
              </div>

              <div className="ms-site">
                <strong>{program.site || "—"}</strong>
                <small>Site OJT</small>
              </div>
            </section>

            <section className="ms-card">
              <h2>Pilih Minggu Monitoring</h2>

              <select
                className="ms-select"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(
                    Number(event.target.value)
                  )
                }
              >
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => (
                    <option
                      key={index + 1}
                      value={index + 1}
                    >
                      {weekLabel(index + 1)}
                    </option>
                  )
                )}
              </select>

              <p className="ms-period">
                {formatDate(startDate)} –{" "}
                {formatDate(endDate)}
              </p>
            </section>

            <section className="ms-card">
              <div className="ms-dark">
                <div className="ms-dark-top">
                  <span>
                    Realisasi {weekLabel(selectedWeek)}
                  </span>

                  <strong className="ms-percent">
                    {Number(
                      summary.weeklyPercent.toFixed(2)
                    ).toLocaleString("id-ID")}%
                  </strong>
                </div>

                <div className="ms-value">
                  {summary.weekCount}
                  <small>
                    {" "} / {WEEKLY_TARGET} kegiatan
                  </small>
                </div>

                <div className="ms-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        summary.weeklyPercent
                      )}%`,
                    }}
                  />
                </div>

                <div className="ms-dark-stats">
                  <div>
                    <small>Kegiatan Terverifikasi</small>
                    <strong>
                      {summary.weekCount} kali
                    </strong>
                  </div>

                  <div>
                    <small>Sisa Target</small>
                    <strong>
                      {summary.remaining} kegiatan
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="ms-card">
              <h2>Ringkasan Sosialisasi</h2>

              <div className="ms-stats">
                <Stat
                  label="Total Terverifikasi 25 Minggu"
                  value={`${summary.totalVerified} kegiatan`}
                />

                <Stat
                  label="Target 25 Minggu"
                  value={`${TOTAL_TARGET} kegiatan`}
                />

                <Stat
                  label="Menunggu Verifikasi"
                  value={summary.pending}
                />

                <Stat
                  label="Minggu Mencapai Target"
                  value={`${summary.achievedWeeks}/25`}
                />
              </div>

              <p className="ms-note">
                Pencapaian keseluruhan:{" "}
                {Number(
                  summary.overallPercent.toFixed(2)
                ).toLocaleString("id-ID")}
                %. Jumlah kegiatan dihitung berdasarkan
                catatan yang sudah diverifikasi.
              </p>
            </section>

            <section className="ms-card">
              <div className="ms-history-header">
                <h2 style={{ margin: 0 }}>
                  Riwayat Sosialisasi —{" "}
                  {weekLabel(selectedWeek)}
                </h2>

                <button
                  className="ms-refresh"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <p className="ms-note">
                {summary.weekRecords.length} catatan
                kegiatan pada minggu ini.
              </p>

              {summary.weekRecords.length === 0 && (
                <p className="ms-note">
                  Belum ada kegiatan Sosialisasi pada
                  minggu ini.
                </p>
              )}

              {summary.weekRecords.map((item) => (
                <div
                  className="ms-history"
                  key={item.id}
                >
                  <strong>
                    {formatDate(item.activity_date)}
                  </strong>

                  <div>
                    <span
                      className={`ms-status ${
                        item.status === "verified"
                          ? "verified"
                          : "pending"
                      }`}
                    >
                      {item.status === "verified"
                        ? "✓ Terverifikasi"
                        : item.status === "pending"
                        ? "Menunggu Verifikasi"
                        : item.status}
                    </span>
                  </div>

                  <p>
                    {item.description ||
                      "Tidak ada keterangan kegiatan."}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
