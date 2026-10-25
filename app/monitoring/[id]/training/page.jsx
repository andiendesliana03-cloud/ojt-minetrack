
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TOTAL_WEEKS = 25;
const WEEKLY_TARGET = 4;
const TOTAL_TARGET = TOTAL_WEEKS * WEEKLY_TARGET;

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some((number) => !Number.isInteger(number))
  ) {
    return null;
  }

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

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
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
  if (!value) return "—";

  const date = parseDate(value);

  if (!date) return String(value);

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatPercent(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

export default function MonitoringTrainingPage() {
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
  const [trainingCodes, setTrainingCodes] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);

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

      const profileResult = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileResult.error) {
        throw profileResult.error;
      }

      const role = normalize(
        profileResult.data?.role
      );

      if (
        !["mentor", "participant", "peserta"].includes(
          role
        )
      ) {
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
        .eq("id", id);

      if (
        role === "participant" ||
        role === "peserta"
      ) {
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

      const [typesResult, recordsResult] =
        await Promise.all([
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
              verified_by,
              created_at
            `)
            .eq("program_id", id)
            .order("activity_date", {
              ascending: false,
            }),
        ]);

      if (typesResult.error) {
        throw typesResult.error;
      }

      if (recordsResult.error) {
        throw recordsResult.error;
      }

      const codes = (typesResult.data || [])
        .filter((item) =>
          ["training", "internaltraining"].includes(
            normalize(item.name)
          )
        )
        .map((item) => item.code);

      if (!codes.length) {
        throw new Error(
          "Kategori Training tidak ditemukan di achievement_types."
        );
      }

      setProgram(programResult.data);
      setTrainingCodes(codes);
      setRecords(recordsResult.data || []);

      if (!isRefresh) {
        const currentWeek = weekOf(
          new Date().toISOString().slice(0, 10),
          programResult.data.start_date
        );

        setSelectedWeek(currentWeek || 1);
      }
    } catch (err) {
      setError(
        err?.message ||
          "Gagal memuat Monitoring Internal Training."
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

  const trainingRecords = useMemo(() => {
    return records.filter((item) =>
      trainingCodes.includes(item.type_code)
    );
  }, [records, trainingCodes]);

  const verifiedRecords = useMemo(() => {
    return trainingRecords.filter(
      (item) =>
        item.status === "verified" &&
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    );
  }, [trainingRecords, program]);

  const pendingRecords = useMemo(() => {
    return trainingRecords.filter(
      (item) => item.status === "pending"
    );
  }, [trainingRecords]);

  const weekRecords = useMemo(() => {
    return trainingRecords.filter(
      (item) =>
        weekOf(
          item.activity_date,
          program?.start_date
        ) === selectedWeek
    );
  }, [
    trainingRecords,
    selectedWeek,
    program,
  ]);

  const weekVerified = weekRecords.filter(
    (item) => item.status === "verified"
  );

  const weekPending = weekRecords.filter(
    (item) => item.status === "pending"
  );

  const weekCount = weekVerified.length;

  const weekPercent =
    (weekCount / WEEKLY_TARGET) * 100;

  const remaining = Math.max(
    0,
    WEEKLY_TARGET - weekCount
  );

  const totalVerified = verifiedRecords.length;

  const totalPercent =
    (totalVerified / TOTAL_TARGET) * 100;

  const completedWeeks = useMemo(() => {
    let count = 0;

    for (
      let week = 1;
      week <= TOTAL_WEEKS;
      week++
    ) {
      const total = verifiedRecords.filter(
        (item) =>
          weekOf(
            item.activity_date,
            program?.start_date
          ) === week
      ).length;

      if (total >= WEEKLY_TARGET) {
        count++;
      }
    }

    return count;
  }, [verifiedRecords, program]);

  const startDate = program?.start_date
    ? addDays(
        program.start_date,
        (selectedWeek - 1) * 7
      )
    : null;

  const endDate = startDate
    ? addDays(startDate, 6)
    : null;

  return (
    <main className="tr-root">
      <style>{`
        .tr-root {
          min-height: 100vh;
          background: #f0f5f4;
          color: #153b37;
          font-family: Arial, Helvetica, sans-serif;
        }

        .tr-root * {
          box-sizing: border-box;
        }

        .tr-header {
          background: #07313a;
          color: white;
          padding: 17px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .tr-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .tr-brand span {
          color: #3bc78e;
        }

        .tr-button {
          border: none;
          border-radius: 10px;
          background: #118660;
          color: white;
          padding: 12px 16px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .tr-button.light {
          background: #e4f5ec;
          color: #086a4a;
        }

        .tr-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .tr-container {
          max-width: 1050px;
          margin: auto;
          padding: 20px;
        }

        .tr-title {
          font-size: 26px;
          margin: 0 0 10px;
        }

        .tr-subtitle {
          color: #73877e;
          line-height: 1.6;
          margin-bottom: 20px;
        }

        .tr-card {
          background: white;
          border: 1px solid #dce8e2;
          border-radius: 17px;
          padding: 20px;
          margin-bottom: 17px;
        }

        .tr-profile {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }

        .tr-profile strong {
          font-size: 19px;
        }

        .tr-muted {
          color: #73877e;
          font-size: 13px;
          line-height: 1.6;
        }

        .tr-select {
          width: 100%;
          padding: 15px;
          border: 1px solid #c9dbd2;
          border-radius: 11px;
          background: white;
          color: #173d34;
          font-size: 16px;
          margin-top: 10px;
        }

        .tr-dark {
          background: #242424;
          border-radius: 16px;
          color: white;
          padding: 25px;
        }

        .tr-dark-label {
          color: #aebbb7;
          font-size: 14px;
        }

        .tr-big {
          font-size: 38px;
          font-weight: 900;
          margin: 10px 0;
        }

        .tr-big small {
          font-size: 17px;
          color: #c2c9c6;
        }

        .tr-percent {
          display: inline-block;
          background: #3d3028;
          color: #ff9853;
          border-radius: 30px;
          padding: 9px 13px;
          font-weight: 900;
        }

        .tr-progress {
          height: 11px;
          background: #414141;
          border-radius: 30px;
          overflow: hidden;
          margin: 20px 0;
        }

        .tr-progress span {
          display: block;
          height: 100%;
          background: #2eaa67;
          border-radius: inherit;
        }

        .tr-dark-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .tr-dark-stats small {
          display: block;
          color: #aebbb7;
          margin-bottom: 8px;
        }

        .tr-dark-stats strong {
          font-size: 22px;
        }

        .tr-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .tr-stat {
          background: #eff8f2;
          border: 1px solid #d5eadd;
          border-radius: 13px;
          padding: 17px;
        }

        .tr-stat small {
          display: block;
          color: #698576;
          margin-bottom: 10px;
        }

        .tr-stat strong {
          color: #087c54;
          font-size: 25px;
        }

        .tr-history {
          border-top: 1px solid #e5eee9;
          padding: 17px 0;
        }

        .tr-history:first-child {
          border-top: none;
        }

        .tr-history-top {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .tr-history-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #eaf5ee;
          display: grid;
          place-items: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .tr-history-content {
          min-width: 0;
          flex: 1;
        }

        .tr-history-date {
          font-weight: 900;
          font-size: 15px;
        }

        .tr-history-status {
          font-size: 12px;
          font-weight: 800;
          margin-top: 6px;
        }

        .tr-history-status.verified {
          color: #0a8b58;
        }

        .tr-history-status.pending {
          color: #c07b1c;
        }

        .tr-history-desc {
          margin-top: 11px;
          color: #61786d;
          font-size: 13px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .tr-error {
          background: #fff0f0;
          border: 1px solid #f2bebe;
          color: #b32c2c;
          border-radius: 11px;
          padding: 14px;
          margin-bottom: 15px;
          overflow-wrap: anywhere;
        }

        .tr-actions {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 15px;
        }

        @media (max-width: 760px) {
          .tr-header {
            padding: 15px;
          }

          .tr-brand {
            font-size: 19px;
          }

          .tr-container {
            padding: 12px;
          }

          .tr-title {
            font-size: 23px;
          }

          .tr-card {
            padding: 15px;
          }

          .tr-dark {
            padding: 20px;
          }

          .tr-big {
            font-size: 32px;
          }

          .tr-stat strong {
            font-size: 22px;
          }
        }
      `}</style>

      <header className="tr-header">
        <div className="tr-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="tr-button light"
          onClick={() =>
            router.push(`/monitoring/${id}`)
          }
        >
          ← Kembali
        </button>
      </header>

      <div className="tr-container">
        <h1 className="tr-title">
          Monitoring Internal Training
        </h1>

        <p className="tr-subtitle">
          Monitoring kegiatan pelatihan berdasarkan
          minggu OJT. Hanya kegiatan yang sudah
          diverifikasi Mentor yang dihitung sebagai
          pencapaian.
        </p>

        {loading ? (
          <div className="tr-card">
            Memuat data Internal Training...
          </div>
        ) : error ? (
          <div className="tr-error">{error}</div>
        ) : (
          <>
            <section className="tr-card tr-profile">
              <div>
                <strong>
                  {peserta?.full_name || "Peserta OJT"}
                </strong>
                <div className="tr-muted">
                  {peserta?.department || "—"}
                </div>
              </div>

              <div>
                <strong>{program?.site || "—"}</strong>
                <div className="tr-muted">Site OJT</div>
              </div>
            </section>

            <section className="tr-card">
              <h3>Pilih Minggu Monitoring</h3>

              <select
                className="tr-select"
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
                    {weekLabel(week)}
                  </option>
                ))}
              </select>

              <p className="tr-muted">
                {formatDate(startDate)} –{" "}
                {formatDate(endDate)}
              </p>
            </section>

            <section className="tr-card">
              <div className="tr-dark">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="tr-dark-label">
                    Realisasi {weekLabel(selectedWeek)}
                  </span>

                  <span className="tr-percent">
                    {formatPercent(weekPercent)}%
                  </span>
                </div>

                <div className="tr-big">
                  {weekCount}{" "}
                  <small>/ {WEEKLY_TARGET} kegiatan</small>
                </div>

                <div className="tr-progress">
                  <span
                    style={{
                      width: `${Math.min(
                        100,
                        weekPercent
                      )}%`,
                    }}
                  />
                </div>

                <div className="tr-dark-stats">
                  <div>
                    <small>
                      Kegiatan Terverifikasi
                    </small>
                    <strong>{weekCount} kali</strong>
                  </div>

                  <div>
                    <small>Sisa Target</small>
                    <strong>
                      {remaining} kegiatan
                    </strong>
                  </div>
                </div>

                {weekPending.length > 0 && (
                  <p
                    style={{
                      color: "#f6d99e",
                      marginTop: 18,
                      fontSize: 12,
                    }}
                  >
                    {weekPending.length} kegiatan
                    minggu ini menunggu verifikasi.
                  </p>
                )}
              </div>
            </section>

            <section className="tr-card">
              <h2>Ringkasan Internal Training</h2>

              <div className="tr-summary">
                <div className="tr-stat">
                  <small>
                    Total Terverifikasi 25 Minggu
                  </small>
                  <strong>
                    {totalVerified} kegiatan
                  </strong>
                </div>

                <div className="tr-stat">
                  <small>Target 25 Minggu</small>
                  <strong>
                    {TOTAL_TARGET} kegiatan
                  </strong>
                </div>

                <div className="tr-stat">
                  <small>
                    Menunggu Verifikasi
                  </small>
                  <strong>
                    {pendingRecords.length}
                  </strong>
                </div>

                <div className="tr-stat">
                  <small>
                    Minggu Mencapai Target
                  </small>
                  <strong>
                    {completedWeeks}/25
                  </strong>
                </div>
              </div>

              <p className="tr-muted">
                Pencapaian keseluruhan:{" "}
                {formatPercent(totalPercent)}%.
                Jumlah kegiatan dihitung berdasarkan
                catatan yang sudah diverifikasi.
              </p>
            </section>

            <section className="tr-card">
              <div className="tr-actions">
                <button
                  type="button"
                  className="tr-button light"
                  onClick={() => loadData(true)}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memuat..."
                    : "↻ Refresh"}
                </button>
              </div>

              <h2>
                Riwayat Internal Training —{" "}
                {weekLabel(selectedWeek)}
              </h2>

              <p className="tr-muted">
                {weekRecords.length} catatan kegiatan
                pada minggu ini.
              </p>

              {!weekRecords.length ? (
                <p className="tr-muted">
                  Belum ada kegiatan Internal Training
                  pada minggu ini.
                </p>
              ) : (
                weekRecords.map((item) => (
                  <div
                    className="tr-history"
                    key={item.id}
                  >
                    <div className="tr-history-top">
                      <div className="tr-history-icon">
                        🎓
                      </div>

                      <div className="tr-history-content">
                        <div className="tr-history-date">
                          {formatDate(item.activity_date)}
                        </div>

                        <div
                          className={`tr-history-status ${
                            item.status === "verified"
                              ? "verified"
                              : "pending"
                          }`}
                        >
                          {item.status === "verified"
                            ? "✓ Terverifikasi"
                            : item.status === "pending"
                            ? "⏳ Menunggu Verifikasi"
                            : item.status || "Status belum diketahui"}
                        </div>

                        <div className="tr-history-desc">
                          {item.description?.trim() ||
                            "Tidak ada keterangan kegiatan."}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
