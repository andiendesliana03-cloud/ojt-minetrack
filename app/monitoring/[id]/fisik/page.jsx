
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;
const TARGET_KM = 25;

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some((n) => !Number.isInteger(n))
  ) {
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

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function formatKm(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function validDistance(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  const number = Number(value);

  return Number.isFinite(number) && number > 0;
}

function ProgressBar({ percentage }) {
  const width = Math.min(
    100,
    Math.max(0, Number(percentage) || 0)
  );

  return (
    <div
      className="mf-progress"
      role="progressbar"
      aria-label="Persentase pencapaian Fisik"
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${width}%` }} />
    </div>
  );
}

export default function MonitoringFisikPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [records, setRecords] = useState([]);
  const [fisikCode, setFisikCode] = useState(null);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function fetchData() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return null;
    }

    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError) throw profileError;

    const role = String(profile?.role || "").toLowerCase();

    if (
      role !== "mentor" &&
      role !== "participant" &&
      role !== "peserta"
    ) {
      throw new Error(
        "Akun tidak memiliki akses monitoring Fisik."
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

    if (role === "participant" || role === "peserta") {
      programQuery = programQuery.eq(
        "participant_id",
        user.id
      );
    }

    const programResult = await programQuery.maybeSingle();

    if (programResult.error) {
      throw programResult.error;
    }

    if (!programResult.data) {
      throw new Error(
        "Program OJT tidak ditemukan atau tidak dapat diakses."
      );
    }

    const typeResult = await supabase
      .from("achievement_types")
      .select("code,name");

    if (typeResult.error) throw typeResult.error;

    const fisikType = (typeResult.data || []).find(
      (item) =>
        String(item.name || "")
          .trim()
          .toLowerCase() === "fisik"
    );

    if (!fisikType) {
      throw new Error(
        "Kategori Fisik tidak ditemukan di achievement_types."
      );
    }

    const recordResult = await supabase
      .from("achievement_records")
      .select(`
        id,
        type_code,
        activity_date,
        description,
        distance_km,
        status,
        verified_by,
        created_at
      `)
      .eq("program_id", programId)
      .eq("type_code", fisikType.code)
      .order("activity_date", { ascending: false });

    if (recordResult.error) {
      throw recordResult.error;
    }

    return {
      program: programResult.data,
      fisikCode: fisikType.code,
      records: recordResult.data || [],
    };
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (!programId) {
          throw new Error("ID program OJT tidak tersedia.");
        }

        const result = await fetchData();

        if (!active || !result) return;

        setProgram(result.program);
        setFisikCode(result.fisikCode);
        setRecords(result.records);

        const today = new Date();
        const localToday = new Date(
          today.getTime() -
            today.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 10);

        const currentWeek = weekOf(
          localToday,
          result.program.start_date
        );

        const latestRecordedWeek = result.records
          .map((item) =>
            weekOf(
              item.activity_date,
              result.program.start_date
            )
          )
          .filter((week) => week !== null)
          .sort((a, b) => b - a)[0];

        setSelectedWeek(
          currentWeek || latestRecordedWeek || 1
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat monitoring Fisik."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (refreshing || loading) return;

    setRefreshing(true);
    setError("");

    try {
      const result = await fetchData();

      if (!result) return;

      setProgram(result.program);
      setFisikCode(result.fisikCode);
      setRecords(result.records);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data Fisik."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const summary = useMemo(() => {
    const allRecords = records.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    );

    const verifiedRecords = allRecords.filter(
      (item) =>
        item.status === "verified" &&
        validDistance(item.distance_km)
    );

    const totalMeters = verifiedRecords.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.distance_km) * 1000),
      0
    );

    const weeklyRecords = allRecords.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) === selectedWeek
    );

    const weeklyVerified = weeklyRecords.filter(
      (item) =>
        item.status === "verified" &&
        validDistance(item.distance_km)
    );

    const weeklyMeters = weeklyVerified.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.distance_km) * 1000),
      0
    );

    const weeklyKm = weeklyMeters / 1000;

    const percentage = (weeklyKm / TARGET_KM) * 100;

    const pendingCount = weeklyRecords.filter(
      (item) => item.status === "pending"
    ).length;

    const achieved = weeklyMeters >= TARGET_KM * 1000;

    const remainingKm = Math.max(
      0,
      (TARGET_KM * 1000 - weeklyMeters) / 1000
    );

    return {
      totalKm: totalMeters / 1000,
      weeklyKm,
      percentage,
      achieved,
      remainingKm,
      pendingCount,
      weeklyRecords,
      weeklyVerifiedCount: weeklyVerified.length,
      weeklyActivityCount: weeklyRecords.length,
    };
  }, [records, program, selectedWeek]);

  const participant = Array.isArray(program?.peserta)
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

  return (
    <main className="mf-root">
      <style>{`
        .mf-root {
          min-height: 100vh;
          background: #f1f6f5;
          color: #19362e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .mf-root * {
          box-sizing: border-box;
        }

        .mf-header {
          background: #07313a;
          color: white;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .mf-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .mf-brand span {
          color: #3bc78e;
        }

        .mf-back {
          border: 0;
          border-radius: 10px;
          background: #e2f3e9;
          color: #0a694d;
          padding: 11px 15px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .mf-container {
          max-width: 1050px;
          margin: 0 auto;
          padding: 24px;
        }

        .mf-title {
          font-size: 27px;
          font-weight: 900;
          margin: 0 0 8px;
        }

        .mf-subtitle {
          color: #758780;
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 20px;
        }

        .mf-card {
          background: white;
          border: 1px solid #e0e9e5;
          border-radius: 16px;
          padding: 21px;
          margin-bottom: 17px;
          box-shadow: 0 4px 18px #183d2b0a;
        }

        .mf-profile-name {
          font-size: 19px;
          font-weight: 900;
          margin-bottom: 7px;
        }

        .mf-profile-meta {
          font-size: 12px;
          color: #74867d;
          line-height: 1.7;
        }

        .mf-section-title {
          font-size: 18px;
          font-weight: 900;
          margin: 0 0 12px;
        }

        .mf-label {
          display: block;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 9px;
        }

        .mf-select {
          display: block;
          width: 100%;
          padding: 13px;
          border: 1px solid #cddbd4;
          border-radius: 10px;
          background: white;
          color: #183b2b;
          font-size: 16px;
        }

        .mf-week-dates {
          margin-top: 10px;
          color: #778980;
          font-size: 12px;
        }

        .mf-target-card {
          background: #242424;
          color: white;
          border-radius: 17px;
          padding: 24px;
        }

        .mf-target-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }

        .mf-target-label {
          font-size: 14px;
          color: #b7b7b7;
          margin-bottom: 10px;
        }

        .mf-target-value {
          font-size: 38px;
          font-weight: 900;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .mf-target-value span {
          font-size: 18px;
          color: #b6b6b6;
          font-weight: 700;
        }

        .mf-percent {
          background: #3b3028;
          color: #ff8c47;
          border-radius: 40px;
          padding: 9px 12px;
          font-weight: 900;
          font-size: 15px;
          white-space: nowrap;
        }

        .mf-percent.done {
          background: #153f2b;
          color: #5ae1a0;
        }

        .mf-progress {
          background: #373737;
          height: 11px;
          border-radius: 20px;
          overflow: hidden;
          margin-top: 22px;
        }

        .mf-progress div {
          background: #39a75b;
          height: 100%;
          border-radius: inherit;
          transition: width .2s;
        }

        .mf-target-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
          margin-top: 24px;
        }

        .mf-target-stats span {
          display: block;
          color: #b7b7b7;
          font-size: 12px;
          margin-bottom: 9px;
        }

        .mf-target-stats strong {
          font-size: 25px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .mf-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .mf-stat {
          background: #f2faf5;
          border: 1px solid #d9ede0;
          border-radius: 12px;
          padding: 15px;
        }

        .mf-stat span {
          display: block;
          color: #6c8575;
          font-size: 11px;
          margin-bottom: 8px;
        }

        .mf-stat strong {
          display: block;
          color: #0d7952;
          font-size: 22px;
          overflow-wrap: anywhere;
        }

        .mf-history {
          display: flex;
          flex-direction: column;
        }

        .mf-history-item {
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          gap: 13px;
          align-items: start;
          padding: 17px 0;
          border-bottom: 1px solid #edf0ed;
        }

        .mf-history-item:last-child {
          border-bottom: 0;
        }

        .mf-history-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          background: #edf4ef;
          border-radius: 12px;
          font-size: 23px;
        }

        .mf-history-date {
          font-size: 14px;
          font-weight: 900;
          margin-bottom: 6px;
        }

        .mf-history-status {
          font-size: 12px;
          color: #73877a;
        }

        .mf-history-desc {
          color: #7a8b80;
          font-size: 12px;
          line-height: 1.5;
          margin-top: 7px;
          overflow-wrap: anywhere;
        }

        .mf-history-distance {
          text-align: right;
          font-size: 17px;
          font-weight: 900;
          white-space: nowrap;
        }

        .mf-verified {
          color: #0a8758;
        }

        .mf-pending {
          color: #c28624;
        }

        .mf-muted {
          color: #809187;
          font-size: 12px;
          line-height: 1.6;
        }

        .mf-alert {
          background: #fff0f0;
          border: 1px solid #f1c1c1;
          color: #a52535;
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 16px;
          overflow-wrap: anywhere;
        }

        .mf-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 15px;
        }

        .mf-refresh {
          border: 1px solid #cde7d7;
          background: #e9f7ee;
          color: #0b8057;
          border-radius: 9px;
          padding: 10px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .mf-refresh:disabled {
          opacity: .6;
        }

        @media (max-width: 760px) {
          .mf-header {
            padding: 15px;
          }

          .mf-brand {
            font-size: 19px;
          }

          .mf-container {
            padding: 12px;
          }

          .mf-title {
            font-size: 22px;
          }

          .mf-card {
            padding: 16px;
            border-radius: 14px;
            margin-bottom: 12px;
          }

          .mf-target-card {
            padding: 19px;
          }

          .mf-target-value {
            font-size: 30px;
          }

          .mf-target-value span {
            font-size: 15px;
          }

          .mf-percent {
            font-size: 13px;
          }

          .mf-target-stats strong {
            font-size: 20px;
          }

          .mf-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .mf-history-item {
            grid-template-columns: 40px minmax(0, 1fr);
            gap: 10px;
          }

          .mf-history-icon {
            width: 38px;
            height: 38px;
            font-size: 19px;
          }

          .mf-history-distance {
            grid-column: 2;
            text-align: left;
            font-size: 17px;
          }
        }

        @media (max-width: 370px) {
          .mf-target-top {
            flex-wrap: wrap;
          }

          .mf-target-value {
            font-size: 27px;
          }
        }
      `}</style>

      <header className="mf-header">
        <div className="mf-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="mf-back"
          onClick={() =>
            router.push(`/monitoring/${programId}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="mf-container">
        <h1 className="mf-title">
          Monitoring Fisik
        </h1>

        <p className="mf-subtitle">
          Monitoring jarak lari berdasarkan minggu OJT.
          Hanya kegiatan yang sudah diverifikasi Mentor
          yang masuk perhitungan pencapaian.
        </p>

        {loading ? (
          <section className="mf-card">
            Memuat data monitoring Fisik...
          </section>
        ) : error && !program ? (
          <div className="mf-alert">{error}</div>
        ) : (
          <>
            {error && (
              <div className="mf-alert">{error}</div>
            )}

            <section className="mf-card">
              <div className="mf-profile-name">
                {participant?.full_name || "Peserta OJT"}
              </div>

              <div className="mf-profile-meta">
                {participant?.department || "—"}
                {" · "}
                {program?.site || "Site belum tersedia"}
              </div>
            </section>

            <section className="mf-card">
              <label
                htmlFor="mf-week"
                className="mf-label"
              >
                Pilih Minggu Monitoring
              </label>

              <select
                id="mf-week"
                className="mf-select"
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

              <div className="mf-week-dates">
                {startWeekDate && endWeekDate
                  ? `${formatDate(startWeekDate)} – ${formatDate(endWeekDate)}`
                  : "Periode minggu belum tersedia"}
              </div>
            </section>

            <section className="mf-card">
              <div className="mf-target-card">
                <div className="mf-target-top">
                  <div>
                    <div className="mf-target-label">
                      Realisasi {weekLabel(selectedWeek)}
                    </div>

                    <div className="mf-target-value">
                      {formatKm(summary.weeklyKm)}
                      <span> / 25 km</span>
                    </div>
                  </div>

                  <div
                    className={
                      `mf-percent ${
                        summary.achieved ? "done" : ""
                      }`
                    }
                  >
                    {summary.percentage.toLocaleString(
                      "id-ID",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}%
                  </div>
                </div>

                <ProgressBar
                  percentage={summary.percentage}
                />

                <div className="mf-target-stats">
                  <div>
                    <span>
                      Jumlah kegiatan lari terverifikasi
                    </span>

                    <strong>
                      {summary.weeklyVerifiedCount} kali
                    </strong>
                  </div>

                  <div>
                    <span>Sisa target</span>

                    <strong>
                      {formatKm(summary.remainingKm)} km
                    </strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="mf-card">
              <h2 className="mf-section-title">
                Ringkasan Fisik
              </h2>

              <div className="mf-stats-grid">
                <div className="mf-stat">
                  <span>Total 25 Minggu</span>
                  <strong>
                    {formatKm(summary.totalKm)} km
                  </strong>
                </div>

                <div className="mf-stat">
                  <span>Target 25 Minggu</span>
                  <strong>625 km</strong>
                </div>

                <div className="mf-stat">
                  <span>Menunggu Verifikasi</span>
                  <strong>
                    {summary.pendingCount}
                  </strong>
                </div>
              </div>
            </section>

            <section className="mf-card">
              <div className="mf-actions">
                <button
                  type="button"
                  className="mf-refresh"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <h2 className="mf-section-title">
                Riwayat Lari — {weekLabel(selectedWeek)}
              </h2>

              <p className="mf-muted">
                {summary.weeklyActivityCount} catatan
                kegiatan pada minggu ini.
              </p>

              {!summary.weeklyRecords.length ? (
                <p className="mf-muted">
                  Belum ada kegiatan lari yang tercatat
                  pada {weekLabel(selectedWeek)}.
                </p>
              ) : (
                <div className="mf-history">
                  {summary.weeklyRecords.map((item) => {
                    const verified =
                      item.status === "verified";

                    return (
                      <div
                        className="mf-history-item"
                        key={item.id}
                      >
                        <div className="mf-history-icon">
                          🏃
                        </div>

                        <div>
                          <div className="mf-history-date">
                            {formatDate(item.activity_date)}
                          </div>

                          <div
                            className={
                              `mf-history-status ${
                                verified
                                  ? "mf-verified"
                                  : "mf-pending"
                              }`
                            }
                          >
                            {verified
                              ? "✓ Terverifikasi"
                              : item.status === "pending"
                              ? "Menunggu Verifikasi"
                              : item.status || "Status belum tersedia"}
                          </div>

                          {item.description && (
                            <div className="mf-history-desc">
                              {item.description}
                            </div>
                          )}
                        </div>

                        <div className="mf-history-distance">
                          {validDistance(item.distance_km)
                            ? formatKm(item.distance_km)
                            : "—"}{" "}
                          km
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
