
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;
const TARGET_WEEK = 2;
const TARGET_TOTAL = TOTAL_WEEKS * TARGET_WEEK;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value) {
  if (!value) return null;

  const parts = String(value).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n))) {
    return null;
  }

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

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const week =
    Math.floor((date.getTime() - start.getTime()) / 604800000) + 1;

  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
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

function formatWeek(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

export default function MonitoringOrientasiArea() {
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

  async function loadData(showLoading = false) {
    if (!programId) {
      setError("ID program OJT tidak ditemukan.");
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
    else setRefreshing(true);

    setError("");

    try {
      const { data: programData, error: programError } =
        await supabase
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
          .single();

      if (programError) throw programError;

      const { data: types, error: typesError } =
        await supabase
          .from("achievement_types")
          .select("code,name");

      if (typesError) throw typesError;

      const orientasiType = (types || []).find(
        (item) => normalize(item.name) === "orientasiarea"
      );

      if (!orientasiType) {
        throw new Error(
          "Kategori Orientasi Area belum ditemukan pada achievement_types."
        );
      }

      const { data: achievementData, error: achievementError } =
        await supabase
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
          .eq("type_code", orientasiType.code)
          .order("activity_date", { ascending: false });

      if (achievementError) throw achievementError;

      setProgram(programData);
      setRecords(achievementData || []);

      const currentWeek = weekOf(
        new Date().toISOString().slice(0, 10),
        programData.start_date
      );

      if (showLoading) {
        setSelectedWeek(currentWeek || 1);
      }
    } catch (err) {
      setError(err.message || "Gagal memuat data Orientasi Area.");
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
      (item) => weekOf(item.activity_date, program?.start_date) !== null
    );

    const verified = validRecords.filter(
      (item) => item.status === "verified"
    );

    const pending = validRecords.filter(
      (item) => item.status === "pending"
    );

    const weeklyRecords = validRecords.filter(
      (item) =>
        weekOf(item.activity_date, program?.start_date) === selectedWeek
    );

    const weeklyVerified = weeklyRecords.filter(
      (item) => item.status === "verified"
    );

    const completedWeeks = Array.from(
      { length: TOTAL_WEEKS },
      (_, index) => index + 1
    ).filter(
      (week) =>
        verified.filter(
          (item) =>
            weekOf(item.activity_date, program?.start_date) === week
        ).length >= TARGET_WEEK
    ).length;

    return {
      totalVerified: verified.length,
      totalPending: pending.length,
      weeklyRecords,
      weeklyVerified: weeklyVerified.length,
      completedWeeks,
      weeklyPercent: Math.min(
        100,
        (weeklyVerified.length / TARGET_WEEK) * 100
      ),
      totalPercent: Math.min(
        100,
        (verified.length / TARGET_TOTAL) * 100
      ),
    };
  }, [records, program, selectedWeek]);

  const startWeekDate = program?.start_date
    ? addDays(program.start_date, (selectedWeek - 1) * 7)
    : null;

  const endWeekDate = startWeekDate
    ? addDays(startWeekDate, 6)
    : null;

  const remaining = Math.max(
    0,
    TARGET_WEEK - summary.weeklyVerified
  );

  if (loading) {
    return (
      <main className="oa-loading">
        <h2>OJT MineTrack</h2>
        <p>Memuat Monitoring Orientasi Area...</p>
      </main>
    );
  }

  return (
    <main className="oa-root">
      <style>{`
        * { box-sizing: border-box; }

        .oa-root {
          min-height: 100vh;
          background: #f0f6f4;
          color: #10332e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .oa-loading {
          min-height: 100vh;
          background: #f0f6f4;
          padding: 24px;
          font-family: Arial, sans-serif;
        }

        .oa-header {
          background: #07343c;
          color: white;
          padding: 20px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .oa-brand {
          font-size: 23px;
          font-weight: 900;
        }

        .oa-brand span { color: #27c68c; }

        .oa-back {
          border: none;
          border-radius: 12px;
          background: #e1f5eb;
          color: #08664a;
          font-weight: 800;
          padding: 13px 20px;
          cursor: pointer;
        }

        .oa-container {
          max-width: 960px;
          margin: auto;
          padding: 22px;
        }

        .oa-title {
          font-size: 28px;
          margin: 0 0 12px;
          font-weight: 900;
        }

        .oa-description {
          color: #738b82;
          line-height: 1.7;
          margin-bottom: 24px;
        }

        .oa-card {
          background: white;
          border: 1px solid #d9e8e1;
          border-radius: 18px;
          padding: 22px;
          margin-bottom: 18px;
        }

        .oa-card h2 {
          font-size: 22px;
          margin: 0 0 22px;
        }

        .oa-profile {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .oa-profile strong {
          font-size: 22px;
        }

        .oa-muted {
          color: #748d82;
          line-height: 1.6;
        }

        .oa-select {
          width: 100%;
          padding: 17px;
          border: 1px solid #c8ded2;
          border-radius: 12px;
          background: white;
          color: #10332e;
          font-size: 17px;
        }

        .oa-period {
          margin: 14px 0 0;
          color: #748d82;
        }

        .oa-dark {
          background: #252525;
          border-radius: 19px;
          color: white;
          padding: 28px;
        }

        .oa-dark-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .oa-dark-label {
          color: #b5c2c5;
          font-size: 15px;
        }

        .oa-percent {
          background: #3c302c;
          color: #ff924d;
          padding: 12px 18px;
          border-radius: 30px;
          font-weight: 900;
        }

        .oa-value {
          font-size: 37px;
          font-weight: 900;
          margin: 22px 0 28px;
        }

        .oa-value small {
          font-size: 17px;
          color: #b5c2c5;
        }

        .oa-progress {
          height: 12px;
          border-radius: 20px;
          background: #454545;
          overflow: hidden;
          margin-bottom: 28px;
        }

        .oa-progress span {
          display: block;
          height: 100%;
          background: #32a65f;
          border-radius: inherit;
        }

        .oa-dark-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .oa-dark-stats strong {
          display: block;
          font-size: 23px;
          margin-top: 9px;
        }

        .oa-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .oa-stat {
          background: #edf8f2;
          border: 1px solid #d2eadc;
          border-radius: 14px;
          padding: 19px;
        }

        .oa-stat small {
          display: block;
          color: #718d80;
          line-height: 1.5;
        }

        .oa-stat strong {
          display: block;
          color: #008755;
          font-size: 23px;
          margin-top: 11px;
          overflow-wrap: anywhere;
        }

        .oa-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 18px;
        }

        .oa-refresh {
          border: none;
          border-radius: 11px;
          padding: 12px 17px;
          background: #e0f5e9;
          color: #008554;
          font-weight: 800;
          cursor: pointer;
        }

        .oa-refresh:disabled {
          opacity: .5;
        }

        .oa-history {
          border: 1px solid #deebe4;
          border-radius: 13px;
          padding: 17px;
          margin-top: 14px;
        }

        .oa-history strong {
          font-size: 17px;
        }

        .oa-history p {
          color: #71897e;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .oa-status {
          display: inline-block;
          margin-top: 8px;
          padding: 7px 10px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 800;
        }

        .oa-status.verified {
          color: #008650;
          background: #e6f8ed;
        }

        .oa-status.pending {
          color: #a36a12;
          background: #fff3da;
        }

        .oa-alert {
          background: #fff1f1;
          color: #b91c1c;
          border: 1px solid #fecaca;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 18px;
          overflow-wrap: anywhere;
        }

        .oa-footer {
          text-align: center;
          color: #8ba398;
          font-size: 12px;
          padding: 20px;
        }

        @media (max-width: 650px) {
          .oa-header { padding: 16px; }
          .oa-brand { font-size: 19px; }
          .oa-back { padding: 11px 14px; }
          .oa-container { padding: 16px; }
          .oa-title { font-size: 24px; }
          .oa-card { padding: 19px; }
          .oa-card h2 { font-size: 20px; }
          .oa-dark { padding: 22px; }
          .oa-value { font-size: 34px; }
          .oa-stat { padding: 14px; }
          .oa-stat strong { font-size: 20px; }
          .oa-profile strong { font-size: 19px; }
        }
      `}</style>

      <header className="oa-header">
        <div className="oa-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="oa-back"
          onClick={() => router.push(`/monitoring/${programId}`)}
        >
          ← Kembali
        </button>
      </header>

      <div className="oa-container">
        <h1 className="oa-title">Monitoring Orientasi Area</h1>

        <p className="oa-description">
          Monitoring kegiatan orientasi area berdasarkan minggu OJT.
          Hanya kegiatan yang telah diverifikasi Mentor yang
          dihitung sebagai pencapaian.
        </p>

        {error && (
          <div className="oa-alert" role="alert">
            {error}
          </div>
        )}

        {program && (
          <>
            <section className="oa-card oa-profile">
              <div>
                <strong>
                  {program.peserta?.full_name || "Peserta OJT"}
                </strong>
                <div className="oa-muted">
                  {program.peserta?.department || "ER & SS"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>{program.site || "—"}</strong>
                <div className="oa-muted">Site OJT</div>
              </div>
            </section>

            <section className="oa-card">
              <h2>Pilih Minggu Monitoring</h2>

              <select
                className="oa-select"
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
                    {formatWeek(week)}
                  </option>
                ))}
              </select>

              <p className="oa-period">
                {formatDate(startWeekDate)} – {formatDate(endWeekDate)}
              </p>
            </section>

            <section className="oa-card">
              <div className="oa-dark">
                <div className="oa-dark-top">
                  <span className="oa-dark-label">
                    Realisasi {formatWeek(selectedWeek)}
                  </span>

                  <span className="oa-percent">
                    {summary.weeklyPercent.toLocaleString("id-ID", {
                      maximumFractionDigits: 2,
                    })}
                    %
                  </span>
                </div>

                <div className="oa-value">
                  {summary.weeklyVerified}
                  <small> / {TARGET_WEEK} kegiatan</small>
                </div>

                <div className="oa-progress">
                  <span
                    style={{ width: `${summary.weeklyPercent}%` }}
                  />
                </div>

                <div className="oa-dark-stats">
                  <div>
                    <span className="oa-dark-label">
                      Kegiatan Terverifikasi
                    </span>
                    <strong>{summary.weeklyVerified} kali</strong>
                  </div>

                  <div>
                    <span className="oa-dark-label">
                      Sisa Target
                    </span>
                    <strong>{remaining} kegiatan</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="oa-card">
              <h2>Ringkasan Orientasi Area</h2>

              <div className="oa-grid">
                <div className="oa-stat">
                  <small>Total Terverifikasi 25 Minggu</small>
                  <strong>
                    {summary.totalVerified} kegiatan
                  </strong>
                </div>

                <div className="oa-stat">
                  <small>Target 25 Minggu</small>
                  <strong>{TARGET_TOTAL} kegiatan</strong>
                </div>

                <div className="oa-stat">
                  <small>Menunggu Verifikasi</small>
                  <strong>{summary.totalPending}</strong>
                </div>

                <div className="oa-stat">
                  <small>Minggu Mencapai Target</small>
                  <strong>
                    {summary.completedWeeks}/{TOTAL_WEEKS}
                  </strong>
                </div>
              </div>

              <p className="oa-muted" style={{ marginTop: 20 }}>
                Pencapaian keseluruhan:{" "}
                {summary.totalPercent.toLocaleString("id-ID", {
                  maximumFractionDigits: 2,
                })}
                %. Jumlah kegiatan dihitung berdasarkan catatan
                yang sudah diverifikasi.
              </p>
            </section>

            <section className="oa-card">
              <div className="oa-actions">
                <button
                  type="button"
                  className="oa-refresh"
                  onClick={() => loadData(false)}
                  disabled={refreshing}
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              <h2>
                Riwayat Orientasi Area — {formatWeek(selectedWeek)}
              </h2>

              <p className="oa-muted">
                {summary.weeklyRecords.length} catatan kegiatan
                pada minggu ini.
              </p>

              {summary.weeklyRecords.length === 0 && (
                <p className="oa-muted">
                  Belum ada kegiatan Orientasi Area pada minggu ini.
                </p>
              )}

              {summary.weeklyRecords.map((item) => (
                <div className="oa-history" key={item.id}>
                  <strong>{formatDate(item.activity_date)}</strong>

                  <div>
                    <span
                      className={`oa-status ${
                        item.status === "verified"
                          ? "verified"
                          : "pending"
                      }`}
                    >
                      {item.status === "verified"
                        ? "✓ Terverifikasi"
                        : item.status === "pending"
                        ? "Menunggu Verifikasi"
                        : item.status || "Status tidak diketahui"}
                    </span>
                  </div>

                  <p>
                    {item.description || "Tidak ada keterangan kegiatan."}
                  </p>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="oa-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
