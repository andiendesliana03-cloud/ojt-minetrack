
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const TARGETS = [
  { key: "Fisik", title: "FISIK", target: 25, unit: "km", color: "#dc4843" },
  { key: "Training", title: "INTERNAL TRAINING", target: 4, unit: "kegiatan", color: "#eca72f" },
  { key: "Sosialisasi", title: "SOSIALISASI", target: 3, unit: "kegiatan", color: "#d6b918" },
  { key: "Orientasi Area", title: "ORIENTASI", target: 2, unit: "kegiatan", color: "#258c50" },
  { key: "Coaching", title: "COACHING", target: 1, unit: "kegiatan", color: "#249fc0" },
  { key: "Hazard", title: "HAZARD", target: 2, unit: "kegiatan", color: "#3070d5" },
];

const normalize = (value) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function dateText(value) {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

function numberText(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function localToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getPerson(program) {
  return Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;
}

function statusLabel(status) {
  if (status === "final") return "FINAL";
  if (status === "draft") return "DRAFT";
  return "BELUM DIBUAT";
}

export default function BiweeklyReportPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const programId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const requestedPeriod = searchParams.get("period");

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);

  const [savedReport, setSavedReport] = useState(null);
  const [savedScores, setSavedScores] = useState([]);
  const [mentorNotes, setMentorNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");

  const role = String(profile?.role || "").toLowerCase();
  const isMentor = role === "mentor";
  const isParticipant = ["participant", "peserta"].includes(role);
  const isFinal = savedReport?.status === "final";

  const canEdit =
    isMentor &&
    program?.mentor_id === profile?.id &&
    !isFinal;

  const loadInitial = useCallback(async () => {
    if (!programId) {
      setError("ID program tidak ditemukan.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const auth = await supabase.auth.getUser();

      if (auth.error || !auth.data?.user) {
        router.replace("/login");
        return;
      }

      const userId = auth.data.user.id;

      const profileRes = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", userId)
        .single();

      if (profileRes.error) throw profileRes.error;

      const currentProfile = profileRes.data;
      const currentRole = String(currentProfile.role || "").toLowerCase();

      if (!["admin", "mentor", "participant", "peserta"].includes(currentRole)) {
        throw new Error("Akun tidak memiliki akses ke rapor.");
      }

      let programQuery = supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          mentor_id,
          start_date,
          end_date,
          status,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("id", programId);

      if (currentRole === "mentor") {
        programQuery = programQuery.eq("mentor_id", userId);
      }

      if (["participant", "peserta"].includes(currentRole)) {
        programQuery = programQuery.eq("participant_id", userId);
      }

      const [programRes, periodsRes, typesRes, achievementsRes] =
        await Promise.all([
          programQuery.single(),

          supabase
            .from("ojt_report_periods")
            .select("id,report_type,period_label,start_date,end_date")
            .eq("report_type", "biweekly")
            .order("start_date", { ascending: false }),

          supabase
            .from("achievement_types")
            .select("code,name"),

          supabase
            .from("achievement_records")
            .select("id,type_code,activity_date,status,distance_km")
            .eq("program_id", programId),
        ]);

      for (const [name, result] of [
        ["Program", programRes],
        ["Periode", periodsRes],
        ["Kategori", typesRes],
        ["Pencapaian", achievementsRes],
      ]) {
        if (result.error) throw new Error(`${name}: ${result.error.message}`);
      }

      const p = programRes.data;

      const available = (periodsRes.data || []).filter(
        (period) =>
          period.end_date >= p.start_date &&
          period.start_date <= p.end_date
      );

      setProfile(currentProfile);
      setProgram(p);
      setPeriods(available);
      setTypes(typesRes.data || []);
      setAchievements(achievementsRes.data || []);

      setPeriodId((old) => {
        if (available.some((p) => p.id === old)) return old;

        if (requestedPeriod && available.some((p) => p.id === requestedPeriod)) {
          return requestedPeriod;
        }

        const today = localToday();
        const current = available.find(
          (p) => p.start_date <= today && p.end_date >= today
        );

        return current?.id || available[0]?.id || "";
      });
    } catch (err) {
      setError(err?.message || "Gagal memuat rapor.");
    } finally {
      setLoading(false);
    }
  }, [programId, requestedPeriod, router]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadSaved = useCallback(async () => {
    if (!programId || !periodId) return;

    setLoadingReport(true);
    setReportError("");
    setSavedReport(null);
    setSavedScores([]);
    setMentorNotes("");
    setRecommendation("");

    try {
      const result = await supabase
        .from("ojt_reports")
        .select(
          "id,period_id,program_id,status,mentor_notes,recommendation,finalized_at,finalized_by"
        )
        .eq("program_id", programId)
        .eq("period_id", periodId)
        .maybeSingle();

      if (result.error) throw result.error;

      const report = result.data;

      if (report) {
        const scoresRes = await supabase
          .from("ojt_report_scores")
          .select("indicator_code,indicator_label,score,score_unit,details")
          .eq("report_id", report.id);

        if (scoresRes.error) throw scoresRes.error;

        setSavedScores(scoresRes.data || []);
        setMentorNotes(report.mentor_notes || "");
        setRecommendation(report.recommendation || "");
      }

      setSavedReport(report);
    } catch (err) {
      setReportError(err?.message || "Gagal membaca rapor tersimpan.");
    } finally {
      setLoadingReport(false);
    }
  }, [programId, periodId]);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === periodId) || null,
    [periods, periodId]
  );

  const calculated = useMemo(() => {
    if (!selectedPeriod || !program) return [];

    const typeMap = new Map();

    types.forEach((type) => {
      typeMap.set(normalize(type.code), type.code);
      typeMap.set(normalize(type.name), type.code);
    });

    const records = achievements.filter(
      (r) =>
        r.activity_date >= selectedPeriod.start_date &&
        r.activity_date <= selectedPeriod.end_date &&
        r.activity_date >= program.start_date &&
        r.activity_date <= program.end_date
    );

    return TARGETS.map((target) => {
      const code =
        target.key === "Training"
          ? typeMap.get("training") || typeMap.get("internaltraining")
          : typeMap.get(normalize(target.key));

      const verified = records.filter(
        (r) => r.type_code === code && normalize(r.status) === "verified"
      );

      const realized =
        target.key === "Fisik"
          ? verified.reduce((sum, r) => {
              const distance = Number(r.distance_km);
              return sum + (Number.isFinite(distance) ? distance : 0);
            }, 0)
          : verified.length;

      return {
        ...target,
        realized,
        percentage: target.target
          ? (realized / target.target) * 100
          : 0,
      };
    });
  }, [selectedPeriod, program, types, achievements]);

  const displayed = useMemo(() => {
    if (!isFinal) return calculated;

    const scoreMap = new Map(
      savedScores.map((s) => [s.indicator_code, s])
    );

    return TARGETS.map((target) => {
      const saved = scoreMap.get(target.key);
      const details = saved?.details || {};
      const realized = saved ? Number(saved.score) : null;

      return {
        ...target,
        target:
          Number.isFinite(Number(details.target))
            ? Number(details.target)
            : target.target,
        realized,
        percentage:
          realized === null
            ? null
            : Number.isFinite(Number(details.percentage))
            ? Number(details.percentage)
            : (realized / target.target) * 100,
      };
    });
  }, [calculated, isFinal, savedScores]);

  const completed = displayed.filter(
    (item) =>
      item.realized !== null &&
      item.realized >= item.target
  ).length;

  const participant = getPerson(program);
  const canView = !isParticipant || isFinal;
  const isBusy = loading || loadingReport || saving;

  async function saveDraft() {
    if (!canEdit || !selectedPeriod || isBusy) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      if (calculated.length !== 6) {
        throw new Error("Enam indikator belum tersedia.");
      }

      const scores = calculated.map((item) => ({
        indicator_code: item.key,
        indicator_label: item.title,
        score: Number(item.realized),
        score_unit: item.unit,
        details: {
          target: item.target,
          percentage: item.percentage,
          period_start: selectedPeriod.start_date,
          period_end: selectedPeriod.end_date,
        },
      }));

      const result = await supabase.rpc("save_ojt_report_draft", {
        p_program_id: programId,
        p_period_id: selectedPeriod.id,
        p_mentor_notes: mentorNotes,
        p_recommendation: recommendation,
        p_scores: scores,
      });

      if (result.error) throw result.error;

      await loadSaved();
      setMessage("Draft rapor berhasil disimpan.");
    } catch (err) {
      setError(err?.message || "Gagal menyimpan Draft.");
    } finally {
      setSaving(false);
    }
  }

  async function finalizeReport() {
    if (!canEdit || !savedReport?.id || isBusy) return;

    const confirmed = window.confirm(
      "Finalisasi Rapor OJT?\n\n" +
      "Pastikan nilai, catatan, dan rekomendasi sudah benar. " +
      "Setelah Final, rapor tidak dapat diedit."
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const result = await supabase.rpc("finalize_ojt_report", {
        p_report_id: savedReport.id,
      });

      if (result.error) throw result.error;

      await loadSaved();
      setMessage("Rapor berhasil difinalisasi dan dikunci.");
    } catch (err) {
      setError(err?.message || "Gagal finalisasi rapor.");
    } finally {
      setSaving(false);
    }
  }

  function changePeriod(value) {
    setMessage("");
    setError("");
    setPeriodId(value);
  }

  return (
    <main className="bw-root">
      <style>{`
        .bw-root,.bw-root *{box-sizing:border-box}
        .bw-root{min-height:100vh;background:#eef3f6;color:#193047;font:13px Arial,Helvetica,sans-serif;padding-bottom:32px}
        .bw-top{background:#092c37;color:#fff;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px}
        .bw-brand{font-size:21px;font-weight:900}
        .bw-brand span{color:#2ec994}
        .bw-container{max-width:1150px;margin:auto;padding:18px}
        .bw-panel{background:#fff;border:1px solid #dce5ec;border-radius:13px;padding:20px;margin-bottom:16px}
        .bw-panel h2{font-size:20px;margin:0 0 9px}
        .bw-muted{font-size:12px;color:#667b89;line-height:1.6}
        .bw-label{display:block;font-size:12px;font-weight:800;margin:13px 0 7px}
        .bw-select,.bw-textarea{width:100%;border:1px solid #cbd8df;border-radius:9px;padding:12px;font:13px Arial;background:#fff;color:#193047}
        .bw-select{max-width:510px}
        .bw-textarea{resize:vertical;min-height:95px;line-height:1.6}
        .bw-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}
        .bw-btn{border:0;border-radius:9px;background:#0b8059;color:#fff;padding:11px 15px;font-size:12px;font-weight:800;cursor:pointer}
        .bw-btn.blue{background:#163d6a}
        .bw-btn.gold{background:#ab7510}
        .bw-btn.light{background:#def0e8;color:#096448}
        .bw-btn:disabled{opacity:.5;cursor:not-allowed}
        .bw-alert{padding:13px;border-radius:9px;margin-bottom:14px;line-height:1.5}
        .bw-alert.error{background:#fff0f0;color:#a52232;border:1px solid #ffd0d0}
        .bw-alert.success{background:#e5f7ed;color:#08734b;border:1px solid #b5e6ca}
        .bw-alert.info{background:#e9f2fa;color:#20527a;border:1px solid #c7ddec}
        .bw-paper{background:#fff;border:1px solid #d7e0e7;padding:24px;box-shadow:0 5px 24px #19304712}
        .bw-paper-header{text-align:center;border-top:5px solid #168f4d;border-bottom:4px solid #0b2c61;padding:15px 8px}
        .bw-paper-header h1{font-size:29px;color:#0b2c61;margin:0}
        .bw-paper-header h2{font-size:14px;color:#168f4d;margin:7px 0}
        .bw-paper-header small{display:block;color:#667b89;font-weight:700}
        .bw-info{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:16px 0}
        .bw-box{border:1px solid #b9c7d2;border-radius:7px;padding:13px;min-width:0}
        .bw-title{display:inline-block;background:#0b2c61;color:#fff;font-size:11px;font-weight:900;padding:6px 11px;margin-bottom:10px}
        .bw-row{display:grid;grid-template-columns:118px 1fr;gap:8px;padding:4px 0;font-size:12px}
        .bw-scroll{overflow-x:auto}
        .bw-table{width:100%;border-collapse:collapse;font-size:12px}
        .bw-table th,.bw-table td{border:1px solid #c9d5df;padding:10px 8px;text-align:center}
        .bw-table th{background:#eaf0f6;font-size:11px}
        .bw-table .bw-category{text-align:left;color:#fff;font-weight:900}
        .bw-tag{display:inline-block;border-radius:20px;padding:6px 10px;background:#edf1f4;color:#6b7b84;font-size:11px;font-weight:800}
        .bw-tag.ok{background:#ddf5e8;color:#087e53}
        .bw-tag.final{background:#dff6e9;color:#087e53}
        .bw-tag.draft{background:#fff1d8;color:#986408}
        .bw-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:15px}
        .bw-stat{background:#f4f8fa;border:1px solid #dbe5ec;padding:17px;text-align:center;font-size:12px}
        .bw-stat strong{display:block;color:#0b2c61;font-size:27px;margin-top:7px}
        .bw-note{border:1px solid #cbd8e1;border-radius:7px;padding:14px;margin-top:17px;font-size:12px;line-height:1.7}
        .bw-note p{white-space:pre-wrap;overflow-wrap:anywhere}
        .bw-editor{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:14px}
        .bw-footer{display:flex;justify-content:space-between;gap:20px;margin-top:30px;color:#6b7c88;font-size:11px}
        @media(max-width:700px){
          .bw-container{padding:9px}
          .bw-paper{padding:12px}
          .bw-info,.bw-editor{grid-template-columns:1fr}
          .bw-stats{grid-template-columns:repeat(2,1fr)}
          .bw-paper-header h1{font-size:22px}
          .bw-table{min-width:650px}
          .bw-footer{flex-direction:column}
        }
        @page{size:A4 landscape;margin:10mm}
        @media print{
          html,body{margin:0!important;background:#fff!important}
          .bw-top,.bw-panel,.bw-alert{display:none!important}
          .bw-root{background:#fff!important;padding:0!important;min-height:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
          .bw-container{max-width:none!important;padding:0!important}
          .bw-paper{padding:0!important;border:0!important;box-shadow:none!important}
          .bw-info{grid-template-columns:1fr 1fr!important}
          .bw-scroll{overflow:visible!important}
          .bw-table{min-width:0!important}
          .bw-stats{grid-template-columns:repeat(3,1fr)!important}
          .bw-paper-header,.bw-box,.bw-note,.bw-footer{break-inside:avoid}
        }
      `}</style>

      <header className="bw-top">
        <div className="bw-brand">
          OJT <span>MineTrack</span>
        </div>
        <button
          type="button"
          className="bw-btn light"
          onClick={() => router.push(isParticipant ? "/dashboard-peserta" : "/rapor")}
        >
          ← Kembali
        </button>
      </header>

      <div className="bw-container">
        {error && <div className="bw-alert error">{error}</div>}
        {message && <div className="bw-alert success">{message}</div>}

        {loading ? (
          <section className="bw-panel">Memuat Rapor OJT...</section>
        ) : !program ? (
          <section className="bw-panel">Data program OJT tidak tersedia.</section>
        ) : (
          <>
            <section className="bw-panel">
              <h2>Rapor Pencapaian 2 Mingguan</h2>
              <p className="bw-muted">
                Penilaian mengikuti periode kalender tanggal 1–14 dan 15–akhir bulan.
                Data pencapaian dihitung dari kegiatan berstatus verified.
              </p>

              <label className="bw-label" htmlFor="bw-period">
                Pilih Periode Penilaian
              </label>

              <select
                id="bw-period"
                className="bw-select"
                value={periodId}
                onChange={(event) => changePeriod(event.target.value)}
                disabled={isBusy}
              >
                {periods.length === 0 && (
                  <option value="">Tidak ada periode tersedia</option>
                )}
                {periods.map((period) => (
                  <option value={period.id} key={period.id}>
                    {period.period_label} · {dateText(period.start_date)}
                    {" – "}
                    {dateText(period.end_date)}
                  </option>
                ))}
              </select>

              <p className="bw-muted">
                Status:{" "}
                <span className={`bw-tag ${savedReport?.status || ""}`}>
                  {loadingReport ? "MEMUAT..." : statusLabel(savedReport?.status)}
                </span>
              </p>

              <div className="bw-actions">
                <button
                  type="button"
                  className="bw-btn light"
                  onClick={loadInitial}
                  disabled={isBusy}
                >
                  Refresh Data
                </button>
                <button
                  type="button"
                  className="bw-btn blue"
                  onClick={() => window.print()}
                  disabled={isBusy || !selectedPeriod || !canView || !!reportError}
                >
                  Cetak / Simpan PDF
                </button>
              </div>
            </section>

            {reportError && (
              <div className="bw-alert error">
                {reportError}
              </div>
            )}

            {loadingReport ? (
              <section className="bw-panel">Memuat status rapor...</section>
            ) : !selectedPeriod ? (
              <section className="bw-panel">
                Tidak ada periode yang sesuai dengan masa OJT peserta.
              </section>
            ) : !canView ? (
              <section className="bw-panel">
                <h2>Rapor Belum Tersedia</h2>
                <p className="bw-muted">
                  Peserta hanya dapat melihat rapor yang telah difinalisasi.
                </p>
              </section>
            ) : (
              <>
                {canEdit && !reportError && (
                  <section className="bw-panel">
                    <h2>Evaluasi Mentor</h2>
                    <p className="bw-muted">
                      Periksa pencapaian sebelum menyimpan Draft.
                      Simpan Draft kembali jika data kegiatan berubah.
                      Finalisasi mengunci nilai terakhir yang tersimpan.
                    </p>

                    <div className="bw-editor">
                      <div>
                        <label className="bw-label" htmlFor="mentor-notes">
                          Catatan Evaluasi Mentor
                        </label>
                        <textarea
                          id="mentor-notes"
                          className="bw-textarea"
                          value={mentorNotes}
                          onChange={(event) => setMentorNotes(event.target.value)}
                          placeholder="Tuliskan hasil evaluasi pencapaian peserta..."
                          disabled={saving}
                        />
                      </div>

                      <div>
                        <label className="bw-label" htmlFor="recommendation">
                          Rekomendasi Tindak Lanjut
                        </label>
                        <textarea
                          id="recommendation"
                          className="bw-textarea"
                          value={recommendation}
                          onChange={(event) => setRecommendation(event.target.value)}
                          placeholder="Tuliskan rekomendasi untuk periode berikutnya..."
                          disabled={saving}
                        />
                      </div>
                    </div>

                    <div className="bw-actions">
                      <button
                        type="button"
                        className="bw-btn"
                        onClick={saveDraft}
                        disabled={isBusy || calculated.length !== 6}
                      >
                        {saving ? "Memproses..." : "Simpan Draft"}
                      </button>

                      <button
                        type="button"
                        className="bw-btn gold"
                        onClick={finalizeReport}
                        disabled={
                          isBusy ||
                          savedReport?.status !== "draft"
                        }
                      >
                        Finalisasi Rapor
                      </button>
                    </div>

                    {savedReport?.status === "draft" && (
                      <p className="bw-muted">
                        Sebelum finalisasi, pastikan perubahan terakhir sudah
                        disimpan melalui tombol Simpan Draft.
                      </p>
                    )}
                  </section>
                )}

                {!isFinal && (
                  <div className="bw-alert info">
                    PRATINJAU — Dokumen belum Final. Angka pencapaian
                    masih mengikuti data kegiatan terkini.
                  </div>
                )}

                <article className="bw-paper">
                  <div className="bw-paper-header">
                    <h1>RAPOR PENCAPAIAN OJT</h1>
                    <h2>PERIODE 2 MINGGUAN</h2>
                    <small>EMERGENCY RESPONSE GROUP · PT BERAU COAL</small>
                  </div>

                  <div className="bw-info">
                    <section className="bw-box">
                      <div className="bw-title">DATA PESERTA</div>
                      {[
                        ["Nama", participant?.full_name || "Peserta OJT"],
                        ["Departemen", participant?.department || "—"],
                        ["Site", program.site || "—"],
                        [
                          "Periode OJT",
                          `${dateText(program.start_date)} – ${dateText(program.end_date)}`,
                        ],
                      ].map(([label, value]) => (
                        <div className="bw-row" key={label}>
                          <strong>{label}</strong>
                          <span>: {value}</span>
                        </div>
                      ))}
                    </section>

                    <section className="bw-box">
                      <div className="bw-title">PERIODE PENILAIAN</div>
                      {[
                        ["Periode", selectedPeriod.period_label],
                        ["Mulai", dateText(selectedPeriod.start_date)],
                        ["Selesai", dateText(selectedPeriod.end_date)],
                        ["Status", statusLabel(savedReport?.status)],
                      ].map(([label, value]) => (
                        <div className="bw-row" key={label}>
                          <strong>{label}</strong>
                          <span>: {value}</span>
                        </div>
                      ))}
                    </section>
                  </div>

                  <section>
                    <div className="bw-title">1. PENILAIAN KOMPETENSI UTAMA</div>

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
                          {displayed.map((item) => {
                            const achieved =
                              item.realized !== null &&
                              item.realized >= item.target;

                            return (
                              <tr key={item.key}>
                                <td
                                  className="bw-category"
                                  style={{ background: item.color }}
                                >
                                  {item.title}
                                </td>
                                <td>
                                  {numberText(item.target)} {item.unit}
                                </td>
                                <td>
                                  {item.realized === null
                                    ? "—"
                                    : numberText(
                                        item.realized,
                                        item.key === "Fisik" ? 3 : 0
                                      )}{" "}
                                  {item.realized === null ? "" : item.unit}
                                </td>
                                <td>
                                  <strong>
                                    {item.percentage === null
                                      ? "—"
                                      : `${numberText(item.percentage, 2)}%`}
                                  </strong>
                                </td>
                                <td>
                                  <span className={`bw-tag ${achieved ? "ok" : ""}`}>
                                    {achieved ? "Tercapai" : "Belum tercapai"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <div className="bw-stats">
                    <div className="bw-stat">
                      Kategori Penilaian
                      <strong>{displayed.length}</strong>
                    </div>
                    <div className="bw-stat">
                      Target Tercapai
                      <strong>{completed}/{displayed.length}</strong>
                    </div>
                    <div className="bw-stat">
                      Belum Tercapai
                      <strong>{displayed.length - completed}</strong>
                    </div>
                  </div>

                  <section className="bw-note">
                    <div className="bw-title">2. CATATAN DAN EVALUASI</div>

                    <p>
                      {completed === displayed.length
                        ? "Seluruh target kompetensi pada periode ini telah tercapai."
                        : `${displayed.length - completed} kategori belum mencapai target pada periode ini.`}
                    </p>

                    <p>
                      <strong>Catatan Mentor:</strong>
                      {" "}
                      {isFinal
                        ? savedReport?.mentor_notes || "Tidak ada catatan."
                        : mentorNotes || "Belum diisi."}
                    </p>

                    <p>
                      <strong>Rekomendasi:</strong>
                      {" "}
                      {isFinal
                        ? savedReport?.recommendation || "Tidak ada rekomendasi."
                        : recommendation || "Belum diisi."}
                    </p>

                    <p>
                      Data yang belum tercatat atau diverifikasi
                      tidak otomatis menunjukkan kegagalan peserta.
                    </p>
                  </section>

                  <footer className="bw-footer">
                    <div>
                      OJT MineTrack · PT Berau Coal
                      <br />
                      Tanggal cetak: {dateText(localToday())}
                    </div>

                    <div>
                      Status: {statusLabel(savedReport?.status)}
                      {savedReport?.finalized_at && (
                        <>
                          <br />
                          Difinalisasi:{" "}
                          {new Date(savedReport.finalized_at).toLocaleString("id-ID")}
                        </>
                      )}
                    </div>
                  </footer>
                </article>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
