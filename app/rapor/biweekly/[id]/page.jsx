
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TARGETS = [
  {
    key: "Fisik",
    title: "FISIK",
    target: 25,
    unit: "km",
    color: "#dc4843",
  },
  {
    key: "Training",
    title: "INTERNAL TRAINING",
    target: 4,
    unit: "kegiatan",
    color: "#eca72f",
  },
  {
    key: "Sosialisasi",
    title: "SOSIALISASI",
    target: 3,
    unit: "kegiatan",
    color: "#d6b918",
  },
  {
    key: "Orientasi Area",
    title: "ORIENTASI",
    target: 2,
    unit: "kegiatan",
    color: "#258c50",
  },
  {
    key: "Coaching",
    title: "COACHING",
    target: 1,
    unit: "kegiatan",
    color: "#249fc0",
  },
  {
    key: "Hazard",
    title: "HAZARD",
    target: 2,
    unit: "kegiatan",
    color: "#3070d5",
  },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function formatDate(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return "—";

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatNumber(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getParticipant(program) {
  if (!program) return null;

  return Array.isArray(program.peserta)
    ? program.peserta[0]
    : program.peserta;
}

export default function BiweeklyReportPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const [savedReport, setSavedReport] = useState(null);
  const [savedScores, setSavedScores] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError("ID program OJT tidak ditemukan.");
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const auth = await supabase.auth.getUser();

        if (auth.error || !auth.data?.user) {
          router.replace("/login");
          return;
        }

        const userId = auth.data.user.id;

        const profileResult = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", userId)
          .single();

        if (profileResult.error) {
          throw profileResult.error;
        }

        const currentProfile = profileResult.data;
        const role = String(
          currentProfile.role || ""
        ).toLowerCase();

        if (
          ![
            "admin",
            "mentor",
            "participant",
            "peserta",
          ].includes(role)
        ) {
          throw new Error(
            "Akun tidak memiliki akses ke rapor."
          );
        }

        let programQuery = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            mentor_id,
            start_date,
            end_date,
            site,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (
          role === "participant" ||
          role === "peserta"
        ) {
          programQuery = programQuery.eq(
            "participant_id",
            userId
          );
        }

        if (role === "mentor") {
          programQuery = programQuery.eq(
            "mentor_id",
            userId
          );
        }

        const results = await Promise.all([
          programQuery.single(),

          supabase
            .from("ojt_report_periods")
            .select(
              "id,report_type,period_label,start_date,end_date"
            )
            .eq("report_type", "biweekly")
            .order("start_date", {
              ascending: false,
            }),

          supabase
            .from("achievement_types")
            .select("code,name"),

          supabase
            .from("achievement_records")
            .select(
              "id,program_id,type_code,activity_date,status,distance_km"
            )
            .eq("program_id", programId),
        ]);

        const labels = [
          "Program OJT",
          "Periode rapor",
          "Kategori pencapaian",
          "Data pencapaian",
        ];

        results.forEach((result, index) => {
          if (result.error) {
            throw new Error(
              `${labels[index]}: ${result.error.message}`
            );
          }
        });

        const currentProgram = results[0].data;

        const availablePeriods = (
          results[1].data || []
        ).filter((period) => {
          const startsBeforeEnd =
            !currentProgram.end_date ||
            period.start_date <=
              currentProgram.end_date;

          const endsAfterStart =
            !currentProgram.start_date ||
            period.end_date >=
              currentProgram.start_date;

          return startsBeforeEnd && endsAfterStart;
        });

        if (!active) return;

        setProfile(currentProfile);
        setProgram(currentProgram);
        setPeriods(availablePeriods);
        setTypes(results[2].data || []);
        setAchievements(results[3].data || []);

        const today = todayISO();

        const currentPeriod =
          availablePeriods.find(
            (period) =>
              period.start_date <= today &&
              period.end_date >= today
          );

        setPeriodId(
          currentPeriod?.id ||
            availablePeriods[0]?.id ||
            ""
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat Rapor 2 Mingguan."
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

  useEffect(() => {
    if (!programId || !periodId) {
      setSavedReport(null);
      setSavedScores([]);
      return;
    }

    let active = true;

    async function loadSaved() {
      setLoadingSaved(true);
      setSavedReport(null);
      setSavedScores([]);

      try {
        const reportResult = await supabase
          .from("ojt_reports")
          .select(`
            id,
            period_id,
            program_id,
            status,
            mentor_notes,
            recommendation,
            finalized_at,
            finalized_by
          `)
          .eq("program_id", programId)
          .eq("period_id", periodId)
          .maybeSingle();

        if (reportResult.error) {
          throw reportResult.error;
        }

        if (!active) return;

        const report = reportResult.data;

        setSavedReport(report);

        if (!report) return;

        const scoresResult = await supabase
          .from("ojt_report_scores")
          .select(
            "indicator_code,indicator_label,score,score_unit,details"
          )
          .eq("report_id", report.id);

        if (scoresResult.error) {
          throw scoresResult.error;
        }

        if (active) {
          setSavedScores(scoresResult.data || []);
        }
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
              "Gagal memuat rapor tersimpan."
          );
        }
      } finally {
        if (active) setLoadingSaved(false);
      }
    }

    loadSaved();

    return () => {
      active = false;
    };
  }, [programId, periodId]);

  async function refreshData() {
    if (!programId || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const [typeResult, achievementResult] =
        await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name"),

          supabase
            .from("achievement_records")
            .select(
              "id,program_id,type_code,activity_date,status,distance_km"
            )
            .eq("program_id", programId),
        ]);

      if (typeResult.error) {
        throw typeResult.error;
      }

      if (achievementResult.error) {
        throw achievementResult.error;
      }

      setTypes(typeResult.data || []);
      setAchievements(achievementResult.data || []);
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const selectedPeriod = useMemo(() => {
    return (
      periods.find(
        (period) => period.id === periodId
      ) || null
    );
  }, [periods, periodId]);

  const summary = useMemo(() => {
    if (!program || !selectedPeriod) return [];

    const typeMap = new Map();

    types.forEach((type) => {
      typeMap.set(
        normalize(type.code),
        type.code
      );

      typeMap.set(
        normalize(type.name),
        type.code
      );
    });

    const periodRecords = achievements.filter(
      (record) => {
        const date = record.activity_date;

        return (
          date &&
          date >= selectedPeriod.start_date &&
          date <= selectedPeriod.end_date &&
          (!program.start_date ||
            date >= program.start_date) &&
          (!program.end_date ||
            date <= program.end_date)
        );
      }
    );

    return TARGETS.map((target) => {
      const code =
        target.key === "Training"
          ? typeMap.get("training") ||
            typeMap.get("internaltraining")
          : typeMap.get(normalize(target.key));

      const matching = periodRecords.filter(
        (record) =>
          code && record.type_code === code
      );

      const verified = matching.filter(
        (record) =>
          normalize(record.status) === "verified"
      );

      let realized = 0;

      if (target.key === "Fisik") {
        realized = verified.reduce(
          (total, record) => {
            const distance = Number(
              record.distance_km
            );

            return (
              total +
              (Number.isFinite(distance)
                ? distance
                : 0)
            );
          },
          0
        );
      } else {
        realized = verified.length;
      }

      const percentage =
        target.target > 0
          ? (realized / target.target) * 100
          : 0;

      return {
        ...target,
        realized,
        percentage,
        recorded: matching.length,
        verified: verified.length,
        achieved: realized >= target.target,
      };
    });
  }, [
    program,
    selectedPeriod,
    types,
    achievements,
  ]);

  const participant = getParticipant(program);

  const isFinal =
    savedReport?.status === "final";

  const role = String(
    profile?.role || ""
  ).toLowerCase();

  const isParticipant =
    role === "participant" ||
    role === "peserta";

  const showReport =
    !isParticipant || isFinal;

  const completed = summary.filter(
    (item) => item.achieved
  ).length;

  const pending = summary.length - completed;

  const backPath = isParticipant
    ? "/dashboard-peserta"
    : "/rapor";

  function printReport() {
    if (!selectedPeriod || !showReport) return;
    window.print();
  }

  return (
    <main className="bw-root">
      <style>{`
        .bw-root,
        .bw-root * {
          box-sizing: border-box;
        }

        .bw-root {
          min-height: 100vh;
          background: #eef3f6;
          color: #193047;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          padding-bottom: 35px;
        }

        .bw-topbar {
          background: #092c37;
          color: white;
          padding: 15px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .bw-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .bw-brand span {
          color: #2ec994;
        }

        .bw-container {
          max-width: 1150px;
          margin: auto;
          padding: 18px;
        }

        .bw-panel {
          background: white;
          border: 1px solid #dce5ec;
          border-radius: 13px;
          padding: 19px;
          margin-bottom: 17px;
        }

        .bw-panel h2 {
          margin: 0 0 9px;
          font-size: 19px;
        }

        .bw-muted {
          font-size: 12px;
          color: #657786;
          line-height: 1.6;
        }

        .bw-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          margin-top: 14px;
        }

        .bw-btn {
          border: 0;
          border-radius: 8px;
          background: #0a805a;
          color: white;
          padding: 11px 15px;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .bw-btn.secondary {
          background: #dff0e9;
          color: #0a6349;
        }

        .bw-btn.blue {
          background: #153b69;
        }

        .bw-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .bw-select {
          width: 100%;
          max-width: 470px;
          border: 1px solid #c9d6e0;
          border-radius: 8px;
          padding: 11px;
          color: #193047;
          background: white;
          font-size: 13px;
        }

        .bw-label {
          display: block;
          font-size: 12px;
          font-weight: 800;
          margin: 13px 0 7px;
        }

        .bw-error {
          background: #fff0f0;
          color: #aa2333;
          border: 1px solid #ffd0d0;
          padding: 13px;
          border-radius: 9px;
          margin-bottom: 15px;
        }

        .bw-paper {
          background: white;
          padding: 23px;
          border: 1px solid #d7e0e7;
          box-shadow: 0 5px 25px #19304710;
        }

        .bw-paper-header {
          border-top: 5px solid #168f4d;
          border-bottom: 4px solid #0b2c61;
          padding: 15px 8px;
          text-align: center;
        }

        .bw-paper-header h1 {
          font-size: 29px;
          color: #0b2c61;
          margin: 0;
        }

        .bw-paper-header p {
          margin: 7px 0 0;
          color: #168f4d;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .bw-company {
          font-size: 12px;
          color: #617181;
          margin-top: 7px;
        }

        .bw-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin: 17px 0;
        }

        .bw-info-card {
          border: 1px solid #b9c7d2;
          padding: 13px;
          border-radius: 7px;
        }

        .bw-section-title {
          display: inline-block;
          background: #0b2c61;
          color: white;
          padding: 6px 11px;
          font-size: 11px;
          font-weight: 900;
          margin-bottom: 11px;
        }

        .bw-info-row {
          display: grid;
          grid-template-columns: 115px 1fr;
          gap: 8px;
          padding: 4px 0;
          font-size: 12px;
        }

        .bw-scroll {
          overflow-x: auto;
        }

        .bw-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 12px;
        }

        .bw-table th,
        .bw-table td {
          border: 1px solid #c9d5df;
          padding: 10px 8px;
          text-align: center;
        }

        .bw-table th {
          background: #eaf0f6;
          font-size: 11px;
        }

        .bw-table td:first-child {
          text-align: left;
        }

        .bw-table .bw-category {
          color: white;
          font-weight: 900;
          text-align: left;
        }

        .bw-status {
          display: inline-block;
          padding: 5px 9px;
          border-radius: 20px;
          background: #e5f0f6;
          color: #34556b;
          font-size: 11px;
          font-weight: 800;
        }

        .bw-status.success {
          background: #def5e9;
          color: #0b8252;
        }

        .bw-note {
          border: 1px solid #cbd8e1;
          border-radius: 7px;
          padding: 14px;
          margin-top: 17px;
          line-height: 1.6;
          font-size: 12px;
        }

        .bw-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 11px;
          margin-top: 15px;
        }

        .bw-summary-card {
          padding: 16px;
          text-align: center;
          background: #f4f8fa;
          border: 1px solid #dbe5ec;
        }

        .bw-summary-card strong {
          display: block;
          font-size: 26px;
          margin-top: 6px;
          color: #0b2c61;
        }

        .bw-footer {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 30px;
          font-size: 11px;
          color: #6b7c88;
        }

        @media (max-width: 700px) {
          .bw-container {
            padding: 9px;
          }

          .bw-paper {
            padding: 12px;
          }

          .bw-info {
            grid-template-columns: 1fr;
          }

          .bw-summary {
            grid-template-columns: 1fr 1fr;
          }

          .bw-paper-header h1 {
            font-size: 22px;
          }

          .bw-table {
            min-width: 650px;
          }

          .bw-footer {
            flex-direction: column;
          }
        }

        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            background: white !important;
          }

          .bw-topbar,
          .bw-panel,
          .bw-error {
            display: none !important;
          }

          .bw-root {
            background: white !important;
            min-height: 0 !important;
            padding: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .bw-container {
            max-width: none !important;
            padding: 0 !important;
          }

          .bw-paper {
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .bw-info {
            grid-template-columns: 1fr 1fr !important;
          }

          .bw-scroll {
            overflow: visible !important;
          }

          .bw-table {
            min-width: 0 !important;
          }

          .bw-summary {
            grid-template-columns: repeat(3, 1fr) !important;
          }

          .bw-paper-header,
          .bw-info-card,
          .bw-note,
          .bw-summary,
          .bw-footer {
            break-inside: avoid;
          }
        }
      `}</style>

      <header className="bw-topbar">
        <div className="bw-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="bw-btn secondary"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="bw-container">
        {error && (
          <div className="bw-error">
            {error}
          </div>
        )}

        {loading ? (
          <section className="bw-panel">
            Memuat Rapor 2 Mingguan...
          </section>
        ) : !program ? (
          <section className="bw-panel">
            Data program OJT tidak tersedia.
          </section>
        ) : (
          <>
            <section className="bw-panel">
              <h2>
                Rapor Pencapaian 2 Mingguan
              </h2>

              <p className="bw-muted">
                Periode mengikuti kalender
                bersama seluruh peserta OJT:
                tanggal 1–14 dan tanggal 15
                sampai akhir bulan.
              </p>

              <label
                className="bw-label"
                htmlFor="bw-period"
              >
                Pilih Periode Rapor
              </label>

              <select
                id="bw-period"
                className="bw-select"
                value={periodId}
                onChange={(event) =>
                  setPeriodId(event.target.value)
                }
              >
                {periods.length === 0 && (
                  <option value="">
                    Tidak ada periode tersedia
                  </option>
                )}

                {periods.map((period) => (
                  <option
                    value={period.id}
                    key={period.id}
                  >
                    {period.period_label}
                    {" · "}
                    {formatDate(period.start_date)}
                    {" – "}
                    {formatDate(period.end_date)}
                  </option>
                ))}
              </select>

              <div className="bw-actions">
                <button
                  type="button"
                  className="bw-btn secondary"
                  onClick={refreshData}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memperbarui..."
                    : "Refresh Data"}
                </button>

                <button
                  type="button"
                  className="bw-btn blue"
                  onClick={printReport}
                  disabled={
                    !selectedPeriod ||
                    !showReport ||
                    loadingSaved
                  }
                >
                  Cetak / Simpan PDF
                </button>
              </div>

              <p className="bw-muted">
                Status dokumen:{" "}
                <strong>
                  {loadingSaved
                    ? "MEMUAT..."
                    : isFinal
                    ? "FINAL"
                    : savedReport?.status === "draft"
                    ? "DRAFT"
                    : "BELUM DIFINALISASI"}
                </strong>
              </p>

              <p className="bw-muted">
                Perhitungan pencapaian masih
                berupa pratinjau otomatis.
                Penyimpanan draft dan finalisasi
                oleh Mentor akan ditambahkan
                pada tahap berikutnya.
              </p>
            </section>

            {!selectedPeriod ? (
              <section className="bw-panel">
                Tidak ada periode rapor yang
                sesuai dengan masa OJT peserta.
              </section>
            ) : loadingSaved ? (
              <section className="bw-panel">
                Memeriksa status rapor...
              </section>
            ) : !showReport ? (
              <section className="bw-panel">
                <h2>Rapor Belum Tersedia</h2>

                <p className="bw-muted">
                  Rapor periode ini belum
                  difinalisasi oleh Mentor.
                  Peserta hanya dapat melihat
                  rapor yang sudah final.
                </p>
              </section>
            ) : (
              <article className="bw-paper">
                <div className="bw-paper-header">
                  <h1>
                    RAPOR PENCAPAIAN OJT
                  </h1>

                  <p>PERIODE 2 MINGGUAN</p>

                  <div className="bw-company">
                    PT BERAU COAL
                  </div>
                </div>

                <div className="bw-info">
                  <section className="bw-info-card">
                    <div className="bw-section-title">
                      DATA PESERTA
                    </div>

                    {[
                      [
                        "Nama",
                        participant?.full_name ||
                          "Peserta OJT",
                      ],
                      [
                        "Departemen",
                        participant?.department || "—",
                      ],
                      [
                        "Site",
                        program.site || "—",
                      ],
                      [
                        "Periode OJT",
                        `${formatDate(
                          program.start_date
                        )} – ${formatDate(
                          program.end_date
                        )}`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="bw-info-row"
                        key={label}
                      >
                        <strong>{label}</strong>
                        <span>: {value}</span>
                      </div>
                    ))}
                  </section>

                  <section className="bw-info-card">
                    <div className="bw-section-title">
                      PERIODE PENILAIAN
                    </div>

                    {[
                      [
                        "Nama Periode",
                        selectedPeriod.period_label,
                      ],
                      [
                        "Tanggal Mulai",
                        formatDate(
                          selectedPeriod.start_date
                        ),
                      ],
                      [
                        "Tanggal Selesai",
                        formatDate(
                          selectedPeriod.end_date
                        ),
                      ],
                      [
                        "Status Rapor",
                        isFinal
                          ? "FINAL"
                          : "PRATINJAU",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="bw-info-row"
                        key={label}
                      >
                        <strong>{label}</strong>
                        <span>: {value}</span>
                      </div>
                    ))}
                  </section>
                </div>

                <section>
                  <div className="bw-section-title">
                    1. PENILAIAN KOMPETENSI UTAMA
                  </div>

                  <div className="bw-scroll">
                    <table className="bw-table">
                      <thead>
                        <tr>
                          <th>KATEGORI</th>
                          <th>TARGET</th>
                          <th>PENCAPAIAN</th>
                          <th>PERSENTASE</th>
                          <th>STATUS</th>
                        </tr>
                      </thead>

                      <tbody>
                        {summary.map((item) => (
                          <tr key={item.key}>
                            <td
                              className="bw-category"
                              style={{
                                background:
                                  item.color,
                              }}
                            >
                              {item.title}
                            </td>

                            <td>
                              {formatNumber(
                                item.target
                              )}{" "}
                              {item.unit}
                            </td>

                            <td>
                              {formatNumber(
                                item.realized,
                                item.key === "Fisik"
                                  ? 3
                                  : 0
                              )}{" "}
                              {item.unit}
                            </td>

                            <td>
                              <strong>
                                {formatNumber(
                                  item.percentage,
                                  2
                                )}
                                %
                              </strong>
                            </td>

                            <td>
                              <span
                                className={
                                  "bw-status " +
                                  (item.achieved
                                    ? "success"
                                    : "")
                                }
                              >
                                {item.achieved
                                  ? "Target tercapai"
                                  : "Belum mencapai target"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="bw-summary">
                  <div className="bw-summary-card">
                    Kategori Dinilai
                    <strong>
                      {summary.length}
                    </strong>
                  </div>

                  <div className="bw-summary-card">
                    Target Tercapai
                    <strong>
                      {completed}/{summary.length}
                    </strong>
                  </div>

                  <div className="bw-summary-card">
                    Kategori Belum Tercapai
                    <strong>
                      {pending}
                    </strong>
                  </div>
                </div>

                <section className="bw-note">
                  <div className="bw-section-title">
                    2. CATATAN DAN EVALUASI
                  </div>

                  {pending === 0 ? (
                    <p>
                      Seluruh target kompetensi
                      pada periode yang dipilih
                      telah tercapai berdasarkan
                      data terverifikasi.
                    </p>
                  ) : (
                    <p>
                      Sebanyak{" "}
                      <strong>{pending}</strong>{" "}
                      kategori belum mencapai
                      target pada periode
                      yang dipilih.
                    </p>
                  )}

                  <p>
                    Data yang belum tercatat
                    atau belum diverifikasi
                    tidak otomatis menunjukkan
                    kegagalan peserta.
                  </p>

                  {savedReport?.mentor_notes && (
                    <p>
                      <strong>
                        Catatan Mentor:
                      </strong>{" "}
                      {savedReport.mentor_notes}
                    </p>
                  )}

                  {savedReport?.recommendation && (
                    <p>
                      <strong>
                        Rekomendasi:
                      </strong>{" "}
                      {savedReport.recommendation}
                    </p>
                  )}

                  {isFinal && savedScores.length > 0 && (
                    <p>
                      Rapor ini memiliki{" "}
                      <strong>
                        {savedScores.length}
                      </strong>{" "}
                      indikator penilaian tersimpan.
                      Tampilan pencapaian di atas
                      masih dihitung dari data
                      kegiatan terkini.
                    </p>
                  )}
                </section>

                <footer className="bw-footer">
                  <div>
                    OJT MineTrack · PT Berau Coal
                    <br />
                    Tanggal cetak:{" "}
                    {formatDate(todayISO())}
                  </div>

                  <div>
                    Status:{" "}
                    {isFinal
                      ? "FINAL"
                      : "PRATINJAU"}

                    {savedReport?.finalized_at && (
                      <>
                        <br />
                        Difinalisasi:{" "}
                        {new Date(
                          savedReport.finalized_at
                        ).toLocaleString("id-ID")}
                      </>
                    )}
                  </div>
                </footer>
              </article>
            )}
          </>
        )}
      </div>
    </main>
  );
}
