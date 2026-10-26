
"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const CATEGORIES = [
  { code: "Fisik", title: "FISIK", target: 25, unit: "km", color: "#dc4843" },
  { code: "Training", title: "INTERNAL TRAINING", target: 4, unit: "kegiatan", color: "#eca72f" },
  { code: "Coaching", title: "COACHING", target: 1, unit: "kegiatan", color: "#249fc0" },
  { code: "Sosialisasi", title: "SOSIALISASI", target: 3, unit: "kegiatan", color: "#d6b918" },
  { code: "Hazard", title: "HAZARD", target: 2, unit: "kegiatan", color: "#3070d5" },
  { code: "Orientasi Area", title: "ORIENTASI AREA", target: 2, unit: "kegiatan", color: "#258c50" },
];

const clean = (v) =>
  String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const dateText = (v) => {
  const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
};

const fmt = (v, digits = 0) =>
  v == null || !Number.isFinite(Number(v))
    ? "—"
    : Number(v).toLocaleString("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

const mean = (values) => {
  const nums = values
    .filter((v) => v != null && Number.isFinite(Number(v)))
    .map(Number);

  return nums.length
    ? nums.reduce((a, b) => a + b, 0) / nums.length
    : null;
};

function BiweeklyReportContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const requestedPeriod = searchParams.get("period");

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);

  const [report, setReport] = useState(null);
  const [scores, setScores] = useState([]);

  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");

  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);

  const role = String(profile?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isMentor = role === "mentor";
  const isParticipant = ["participant", "peserta"].includes(role);

  const isFinal = report?.status === "final";

  // ADMIN: semua peserta.
  // MENTOR: hanya peserta binaannya.
  // PESERTA: tidak dapat mengedit.
  const canEdit =
    !isFinal &&
    (
      isAdmin ||
      (
        isMentor &&
        program?.mentor_id === profile?.id
      )
    );

  const canView = !isParticipant || isFinal;

  const selectedPeriod = periods.find((p) => p.id === periodId);

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const loadBase = useCallback(async () => {
    const { data: auth, error: authError } =
      await supabase.auth.getUser();

    if (authError || !auth?.user) {
      router.replace("/login");
      return null;
    }

    const uid = auth.user.id;

    const pr = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", uid)
      .single();

    if (pr.error) throw pr.error;

    const currentRole = String(pr.data.role || "").toLowerCase();

    if (
      !["admin", "mentor", "participant", "peserta"].includes(currentRole)
    ) {
      throw new Error("Akses rapor tidak diizinkan.");
    }

    let pq = supabase
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
      pq = pq.eq("mentor_id", uid);
    }

    if (["participant", "peserta"].includes(currentRole)) {
      pq = pq.eq("participant_id", uid);
    }

    const results = await Promise.all([
      pq.single(),

      supabase
        .from("ojt_report_periods")
        .select("id,period_label,start_date,end_date")
        .eq("report_type", "biweekly")
        .order("start_date", { ascending: false }),

      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select("type_code,activity_date,status,distance_km")
        .eq("program_id", programId),

      supabase
        .from("post_test_scores")
        .select("test_date,score")
        .eq("program_id", programId),

      supabase
        .from("weekly_practice_scores")
        .select("practice_date,practice_name,score")
        .eq("program_id", programId),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    const [
      p,
      periodsData,
      typesData,
      achData,
      postData,
      practiceData,
    ] = results.map((x) => x.data);

    return {
      profile: pr.data,
      program: p,

      periods: periodsData.filter(
        (x) =>
          x.start_date <= p.end_date &&
          x.end_date >= p.start_date
      ),

      types: typesData || [],
      achievements: achData || [],
      postTests: postData || [],
      practices: practiceData || [],
    };
  }, [programId, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await loadBase();
      if (!data) return;

      setProfile(data.profile);
      setProgram(data.program);
      setPeriods(data.periods);
      setTypes(data.types);
      setAchievements(data.achievements);
      setPostTests(data.postTests);
      setPractices(data.practices);

      setPeriodId((prev) => {
        if (data.periods.some((x) => x.id === prev)) {
          return prev;
        }

        if (
          data.periods.some((x) => x.id === requestedPeriod)
        ) {
          return requestedPeriod;
        }

        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Makassar",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());

        return (
          data.periods.find(
            (x) =>
              x.start_date <= today &&
              x.end_date >= today
          )?.id ||
          data.periods[0]?.id ||
          ""
        );
      });
    } catch (e) {
      setError(e.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [loadBase, requestedPeriod]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fetchReport = useCallback(
    async (pid) => {
      const res = await supabase
        .from("ojt_reports")
        .select(`
          id,
          status,
          mentor_notes,
          recommendation,
          finalized_at
        `)
        .eq("program_id", programId)
        .eq("period_id", pid)
        .maybeSingle();

      if (res.error) throw res.error;

      let saved = [];

      if (res.data) {
        const sr = await supabase
          .from("ojt_report_scores")
          .select("indicator_code,score,details")
          .eq("report_id", res.data.id);

        if (sr.error) throw sr.error;
        saved = sr.data || [];
      }

      return {
        report: res.data,
        scores: saved,
      };
    },
    [programId]
  );

  useEffect(() => {
    let active = true;

    setReport(null);
    setScores([]);
    setNotes("");
    setRecommendation("");
    setConfirmed(false);
    setDirty(false);

    if (!periodId || !profile) {
      setReportLoading(false);
      return;
    }

    setReportLoading(true);

    (async () => {
      try {
        const result = await fetchReport(periodId);

        if (!active) return;

        setReport(result.report);
        setScores(result.scores);
        setNotes(result.report?.mentor_notes || "");
        setRecommendation(result.report?.recommendation || "");
      } catch (e) {
        if (active) {
          setError(e.message || "Gagal membaca rapor.");
        }
      } finally {
        if (active) setReportLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [periodId, profile?.id, fetchReport]);

  const live = useMemo(() => {
    if (!program || !selectedPeriod) return [];

    const map = new Map();

    types.forEach((t) => {
      map.set(clean(t.code), t.code);
      map.set(clean(t.name), t.code);
    });

    const records = achievements.filter(
      (a) =>
        a.activity_date >= selectedPeriod.start_date &&
        a.activity_date <= selectedPeriod.end_date &&
        a.activity_date >= program.start_date &&
        a.activity_date <= program.end_date
    );

    return CATEGORIES.map((c) => {
      const code =
        c.code === "Training"
          ? map.get("training") ||
            map.get("internaltraining")
          : map.get(clean(c.code));

      const valid = records.filter(
        (a) =>
          code &&
          clean(a.type_code) === clean(code) &&
          clean(a.status) === "verified"
      );

      const realized =
        c.code === "Fisik"
          ? valid.reduce(
              (sum, a) =>
                sum + Math.max(0, Number(a.distance_km) || 0),
              0
            )
          : valid.length;

      return {
        ...c,
        realized,
        percentage: c.target
          ? (realized / c.target) * 100
          : 0,
      };
    });
  }, [
    program,
    selectedPeriod,
    types,
    achievements,
  ]);

  const learning = useMemo(() => {
    if (!selectedPeriod || !program) {
      return { count: 0, average: null };
    }

    const rows = postTests.filter(
      (x) =>
        x.test_date >= selectedPeriod.start_date &&
        x.test_date <= selectedPeriod.end_date &&
        x.test_date >= program.start_date &&
        x.test_date <= program.end_date
    );

    return {
      count: rows.length,
      average: mean(rows.map((x) => x.score)),
    };
  }, [postTests, selectedPeriod, program]);

  const practice = useMemo(() => {
    if (!selectedPeriod || !program) {
      return { count: 0, average: null };
    }

    const rows = practices.filter(
      (x) =>
        x.practice_date >= selectedPeriod.start_date &&
        x.practice_date <= selectedPeriod.end_date &&
        x.practice_date >= program.start_date &&
        x.practice_date <= program.end_date
    );

    return {
      count: rows.length,
      average: mean(rows.map((x) => x.score)),
    };
  }, [practices, selectedPeriod, program]);

  const scoreMap = useMemo(
    () =>
      new Map(
        scores.map((x) => [
          x.indicator_code,
          x,
        ])
      ),
    [scores]
  );

  const displayed = useMemo(() => {
    if (!isFinal) return live;

    return CATEGORIES.map((c) => {
      const s = scoreMap.get(c.code);

      const target =
        s?.details?.target != null &&
        Number(s.details.target) > 0
          ? Number(s.details.target)
          : c.target;

      const realized =
        s?.score == null
          ? null
          : Number(s.score);

      return {
        ...c,
        target,
        realized,
        percentage:
          realized == null
            ? null
            : (realized / target) * 100,
      };
    });
  }, [live, isFinal, scoreMap]);

  const learningValue = isFinal
    ? scoreMap.get("Pembelajaran")?.score ?? null
    : learning.average;

  const practiceValue = isFinal
    ? scoreMap.get("Praktek")?.score ?? null
    : practice.average;

  const learningCount = isFinal
    ? scoreMap.get("Pembelajaran")?.details?.count ?? "—"
    : learning.count;

  const practiceCount = isFinal
    ? scoreMap.get("Praktek")?.details?.count ?? "—"
    : practice.count;

  const completed = displayed.filter(
    (x) =>
      x.realized != null &&
      x.realized >= x.target
  ).length;

  const gradeValues = [
    learningValue,
    practiceValue,
  ]
    .filter(
      (x) =>
        x != null &&
        Number.isFinite(Number(x))
    )
    .map(Number);

  const totalGrade = gradeValues.reduce(
    (a, b) => a + b,
    0
  );

  const averageGrade = mean(gradeValues);

  const predicate =
    averageGrade == null
      ? "Belum ada nilai"
      : averageGrade >= 85
      ? "A"
      : averageGrade >= 75
      ? "B"
      : averageGrade >= 60
      ? "C"
      : "D";

  async function saveDraft() {
    if (
      !canEdit ||
      !selectedPeriod ||
      busy ||
      reportLoading
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const payload = [
        ...live.map((x) => ({
          indicator_code: x.code,
          indicator_label: x.title,
          score: x.realized,
          score_unit: x.unit,
          details: {
            target: x.target,
            percentage: x.percentage,
            period_start: selectedPeriod.start_date,
            period_end: selectedPeriod.end_date,
          },
        })),

        {
          indicator_code: "Pembelajaran",
          indicator_label: "PENILAIAN PEMBELAJARAN",
          score: learning.average,
          score_unit: "nilai",
          details: {
            count: learning.count,
          },
        },

        {
          indicator_code: "Praktek",
          indicator_label: "PENILAIAN PRAKTEK",
          score: practice.average,
          score_unit: "nilai",
          details: {
            count: practice.count,
          },
        },
      ];

      if (payload.length !== 8) {
        throw new Error(
          "Delapan indikator belum lengkap."
        );
      }

      const res = await supabase.rpc(
        "save_ojt_report_draft",
        {
          p_program_id: programId,
          p_period_id: periodId,
          p_mentor_notes: notes,
          p_recommendation: recommendation,
          p_scores: payload,
        }
      );

      if (res.error) throw res.error;

      const result = await fetchReport(periodId);

      setReport(result.report);
      setScores(result.scores);
      setDirty(false);
      setConfirmed(false);
      setMessage("Draft rapor berhasil disimpan.");
    } catch (e) {
      setError(
        e.message || "Gagal menyimpan Draft."
      );
    } finally {
      setBusy(false);
    }
  }

  async function finalizeReport() {
    if (
      !canEdit ||
      !report?.id ||
      !confirmed ||
      dirty ||
      busy
    ) {
      return;
    }

    if (
      !window.confirm(
        "Finalisasi rapor? Setelah Final, nilai tidak dapat diubah."
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const res = await supabase.rpc(
        "finalize_ojt_report",
        {
          p_report_id: report.id,
        }
      );

      if (res.error) throw res.error;

      const result = await fetchReport(periodId);

      setReport(result.report);
      setScores(result.scores);
      setConfirmed(false);
      setMessage(
        "Rapor berhasil difinalisasi."
      );
    } catch (e) {
      setError(
        e.message || "Gagal finalisasi rapor."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bw-root">
      <style>{`
        .bw-root,.bw-root *{box-sizing:border-box}
        .bw-root{min-height:100vh;background:#edf2f6;color:#20364a;font:13px Arial,sans-serif;padding-bottom:35px}
        .bw-top{background:#092d38;color:white;padding:16px 24px;display:flex;justify-content:space-between;align-items:center}
        .bw-brand{font-size:21px;font-weight:900}
        .bw-brand span{color:#37d59c}
        .bw-wrap{max-width:1180px;margin:auto;padding:18px}
        .bw-panel,.bw-paper{background:white;border:1px solid #d6e0e8;border-radius:10px;padding:20px;margin-bottom:16px}
        .bw-panel h2{margin:0 0 10px;font-size:20px}
        .bw-muted{font-size:12px;color:#647889;line-height:1.6}
        .bw-label{display:block;margin:12px 0 7px;font-weight:bold}
        .bw-select,.bw-textarea{width:100%;padding:11px;border:1px solid #c5d3de;border-radius:8px;font:13px Arial;color:#20364a;background:white}
        .bw-select{max-width:550px}
        .bw-textarea{min-height:90px;resize:vertical;line-height:1.5}
        .bw-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
        .bw-btn{border:0;border-radius:8px;background:#07815c;color:white;padding:11px 15px;font-weight:bold;cursor:pointer}
        .bw-btn.secondary{background:#e1f2ea;color:#076647}
        .bw-btn.blue{background:#174b82}
        .bw-btn.danger{background:#a66d10}
        .bw-btn:disabled{opacity:.45;cursor:not-allowed}
        .bw-error,.bw-success,.bw-info{padding:13px;border-radius:8px;margin-bottom:14px}
        .bw-error{background:#fff0f0;color:#a1222d}
        .bw-success{background:#e4f7ec;color:#08794d}
        .bw-info{background:#eaf3fc;color:#24557d}
        .bw-paper{border-radius:0;padding:26px}
        .bw-header{text-align:center;border-top:5px solid #158e4d;border-bottom:4px solid #0a2e61;padding:15px}
        .bw-header h1{font-size:29px;color:#0a2e61;margin:0}
        .bw-header h2{font-size:14px;color:#16894d;margin:7px 0}
        .bw-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:17px 0}
        .bw-card{border:1px solid #c4d0db;padding:13px;border-radius:6px}
        .bw-section{display:inline-block;background:#0b2f62;color:white;font-size:11px;font-weight:900;padding:7px 11px;margin:12px 0 9px}
        .bw-row{display:grid;grid-template-columns:120px 1fr;gap:8px;margin:6px 0;font-size:12px}
        .bw-table{width:100%;border-collapse:collapse;font-size:12px}
        .bw-table th,.bw-table td{border:1px solid #c8d4df;padding:10px;text-align:center}
        .bw-table th{background:#eaf0f6;font-size:11px}
        .bw-category{text-align:left!important;color:white;font-weight:bold}
        .bw-scroll{overflow-x:auto}
        .bw-tag{display:inline-block;background:#eef0f2;padding:6px 10px;border-radius:20px;font-size:11px}
        .bw-tag.ok{background:#dff5e7;color:#08774b}
        .bw-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:15px 0}
        .bw-stat{background:#f0f5f8;padding:15px;text-align:center}
        .bw-stat strong{display:block;font-size:24px;color:#0b2f62;margin-top:7px}
        .bw-note{border:1px solid #cbd8e2;padding:14px;border-radius:6px;line-height:1.6;margin-top:14px}
        .bw-note p{white-space:pre-wrap;overflow-wrap:anywhere}
        .bw-dual{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:15px}
        .bw-confirm{display:flex;align-items:flex-start;gap:8px;margin-top:14px;font-size:12px;line-height:1.5}
        .bw-footer{display:flex;justify-content:space-between;margin-top:25px;font-size:11px;color:#687b89}
        @media(max-width:700px){
          .bw-wrap{padding:9px}
          .bw-paper{padding:12px}
          .bw-info-grid,.bw-dual{grid-template-columns:1fr}
          .bw-summary{grid-template-columns:repeat(2,1fr)}
          .bw-scroll .bw-table{min-width:650px}
          .bw-header h1{font-size:22px}
        }
        @page{size:A4 landscape;margin:10mm}
        @media print{
          body{margin:0!important;background:white!important}
          .bw-top,.bw-panel,.bw-error,.bw-success,.bw-info{display:none!important}
          .bw-root{background:white!important;padding:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
          .bw-wrap{padding:0!important;max-width:none!important}
          .bw-paper{border:0!important;padding:0!important}
          .bw-scroll{overflow:visible!important}
          .bw-info-grid,.bw-dual{grid-template-columns:1fr 1fr!important}
          .bw-summary{grid-template-columns:repeat(3,1fr)!important}
          .bw-header,.bw-card,.bw-note,.bw-footer{break-inside:avoid}
        }
      `}</style>

      <header className="bw-top">
        <div className="bw-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          className="bw-btn secondary"
          onClick={() => router.push("/rapor")}
        >
          ← Kembali
        </button>
      </header>

      <div className="bw-wrap">
        {error && (
          <div className="bw-error">
            {error}
          </div>
        )}

        {message && (
          <div className="bw-success">
            {message}
          </div>
        )}

        {loading ? (
          <section className="bw-panel">
            Memuat data rapor...
          </section>
        ) : !program ? (
          <section className="bw-panel">
            Program OJT tidak ditemukan.
          </section>
        ) : (
          <>
            <section className="bw-panel">
              <h2>Rapor Pencapaian 2 Mingguan</h2>

              <p className="bw-muted">
                Periode tanggal 1–14 dan 15–akhir bulan.
                Admin dan Mentor dapat mengelola rapor
                sesuai hak akses masing-masing.
              </p>

              <label className="bw-label">
                Pilih Periode
              </label>

              <select
                className="bw-select"
                value={periodId}
                disabled={busy || reportLoading}
                onChange={(e) => {
                  setPeriodId(e.target.value);
                  setMessage("");
                }}
              >
                {!periods.length && (
                  <option value="">
                    Tidak ada periode
                  </option>
                )}

                {periods.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.period_label} ·{" "}
                    {dateText(p.start_date)} –{" "}
                    {dateText(p.end_date)}
                  </option>
                ))}
              </select>

              <p className="bw-muted">
                Status:{" "}
                <strong>
                  {reportLoading
                    ? "MEMUAT..."
                    : isFinal
                    ? "FINAL — TERKUNCI"
                    : report?.status === "draft"
                    ? "DRAFT"
                    : "BELUM DIBUAT"}
                </strong>
              </p>

              <div className="bw-actions">
                <button
                  className="bw-btn secondary"
                  onClick={refresh}
                  disabled={busy}
                >
                  Refresh
                </button>

                <button
                  className="bw-btn blue"
                  onClick={() => window.print()}
                  disabled={
                    busy ||
                    reportLoading ||
                    !canView ||
                    !selectedPeriod ||
                    !!error
                  }
                >
                  Cetak / Simpan PDF
                </button>
              </div>
            </section>

            {reportLoading ? (
              <section className="bw-panel">
                Memuat status rapor...
              </section>
            ) : !selectedPeriod ? (
              <section className="bw-panel">
                Periode tidak tersedia.
              </section>
            ) : !canView ? (
              <section className="bw-panel">
                Rapor belum difinalisasi Mentor.
              </section>
            ) : (
              <>
                {canEdit && (
                  <section className="bw-panel">
                    <h2>Evaluasi Mentor / Admin</h2>

                    <p className="bw-muted">
                      Periksa pencapaian dan nilai
                      sebelum menyimpan Draft.
                    </p>

                    <label className="bw-label">
                      Catatan Evaluasi
                    </label>

                    <textarea
                      className="bw-textarea"
                      value={notes}
                      maxLength={5000}
                      onChange={(e) => {
                        setNotes(e.target.value);
                        setDirty(true);
                        setConfirmed(false);
                      }}
                      placeholder="Tuliskan evaluasi peserta..."
                    />

                    <label className="bw-label">
                      Rekomendasi Tindak Lanjut
                    </label>

                    <textarea
                      className="bw-textarea"
                      value={recommendation}
                      maxLength={5000}
                      onChange={(e) => {
                        setRecommendation(e.target.value);
                        setDirty(true);
                        setConfirmed(false);
                      }}
                      placeholder="Tuliskan rekomendasi..."
                    />

                    <div className="bw-actions">
                      <button
                        className="bw-btn"
                        onClick={saveDraft}
                        disabled={busy}
                      >
                        {busy
                          ? "Memproses..."
                          : "Simpan Draft"}
                      </button>
                    </div>

                    {report?.status === "draft" && (
                      <>
                        <label className="bw-confirm">
                          <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) =>
                              setConfirmed(e.target.checked)
                            }
                          />
                          Saya telah memeriksa nilai
                          dan catatan serta memahami
                          bahwa rapor Final tidak
                          dapat diubah.
                        </label>

                        <div className="bw-actions">
                          <button
                            className="bw-btn danger"
                            onClick={finalizeReport}
                            disabled={
                              busy ||
                              !confirmed ||
                              dirty
                            }
                          >
                            Finalisasi Rapor
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}

                {!isFinal && (
                  <div className="bw-info">
                    PRATINJAU — Nilai belum Final
                    dan dapat berubah mengikuti
                    data kegiatan terbaru.
                  </div>
                )}

                <article className="bw-paper">
                  <div className="bw-header">
                    <h1>RAPOR OJT</h1>

                    <h2>
                      ON THE JOB TRAINING ·
                      PERIODE 2 MINGGUAN
                    </h2>

                    <strong>
                      EMERGENCY RESPONSE GROUP ·
                      PT BERAU COAL
                    </strong>
                  </div>

                  <div className="bw-info-grid">
                    <section className="bw-card">
                      <div className="bw-section">
                        DATA PESERTA
                      </div>

                      {[
                        [
                          "Nama",
                          participant?.full_name || "—",
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
                          `${dateText(program.start_date)} – ${dateText(program.end_date)}`,
                        ],
                      ].map(([label, value]) => (
                        <div
                          className="bw-row"
                          key={label}
                        >
                          <strong>{label}</strong>
                          <span>: {value}</span>
                        </div>
                      ))}
                    </section>

                    <section className="bw-card">
                      <div className="bw-section">
                        PERIODE PENILAIAN
                      </div>

                      {[
                        [
                          "Periode",
                          selectedPeriod.period_label,
                        ],
                        [
                          "Mulai",
                          dateText(selectedPeriod.start_date),
                        ],
                        [
                          "Selesai",
                          dateText(selectedPeriod.end_date),
                        ],
                        [
                          "Status",
                          isFinal
                            ? "FINAL"
                            : "PRATINJAU",
                        ],
                      ].map(([label, value]) => (
                        <div
                          className="bw-row"
                          key={label}
                        >
                          <strong>{label}</strong>
                          <span>: {value}</span>
                        </div>
                      ))}
                    </section>
                  </div>

                  <section className="bw-note">
                    <div className="bw-section">
                      KETERANGAN
                    </div>

                    <p>
                      On The Job Training (OJT)
                      merupakan program pengembangan
                      kompetensi, pengetahuan, dan
                      keterampilan peserta. Rapor
                      ini menampilkan hasil
                      penilaian pada periode dua
                      mingguan yang dipilih.
                    </p>
                  </section>

                  <section>
                    <div className="bw-section">
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
                          {displayed.map((item) => {
                            const ok =
                              item.realized != null &&
                              item.realized >= item.target;

                            return (
                              <tr key={item.code}>
                                <td
                                  className="bw-category"
                                  style={{
                                    background: item.color,
                                  }}
                                >
                                  {item.title}
                                </td>

                                <td>
                                  {fmt(item.target)}{" "}
                                  {item.unit}
                                </td>

                                <td>
                                  {fmt(
                                    item.realized,
                                    item.code === "Fisik"
                                      ? 3
                                      : 0
                                  )}{" "}
                                  {item.unit}
                                </td>

                                <td>
                                  {item.percentage == null
                                    ? "—"
                                    : `${fmt(item.percentage, 2)}%`}
                                </td>

                                <td>
                                  <span
                                    className={`bw-tag ${
                                      ok ? "ok" : ""
                                    }`}
                                  >
                                    {item.realized == null
                                      ? "Belum ada nilai"
                                      : ok
                                      ? "Target tercapai"
                                      : "Belum mencapai target"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <p className="bw-muted">
                      Target sementara mengikuti
                      angka template lama dan perlu
                      ditetapkan sebagai target
                      resmi per dua minggu.
                    </p>
                  </section>

                  <div className="bw-summary">
                    <div className="bw-stat">
                      Kategori Dinilai
                      <strong>6</strong>
                    </div>

                    <div className="bw-stat">
                      Target Tercapai
                      <strong>{completed}/6</strong>
                    </div>

                    <div className="bw-stat">
                      Belum Tercapai
                      <strong>{6 - completed}</strong>
                    </div>
                  </div>

                  <section>
                    <div className="bw-section">
                      2. PENILAIAN PEMBELAJARAN
                    </div>

                    <table className="bw-table">
                      <thead>
                        <tr>
                          <th>PERIODE</th>
                          <th>JUMLAH POST-TEST</th>
                          <th>RATA-RATA NILAI</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td>
                            {selectedPeriod.period_label}
                          </td>

                          <td>{learningCount}</td>

                          <td>
                            {fmt(learningValue, 2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <div className="bw-section">
                      3. PENILAIAN PRAKTEK
                    </div>

                    <table className="bw-table">
                      <thead>
                        <tr>
                          <th>PERIODE</th>
                          <th>JUMLAH PENILAIAN</th>
                          <th>RATA-RATA NILAI</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td>
                            {selectedPeriod.period_label}
                          </td>

                          <td>{practiceCount}</td>

                          <td>
                            {fmt(practiceValue, 2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  <div className="bw-dual">
                    <section className="bw-note">
                      <div className="bw-section">
                        CATATAN
                      </div>

                      <p>
                        {6 - completed} kategori
                        kompetensi utama belum
                        mencapai target.
                      </p>

                      <p>
                        <strong>
                          Evaluasi Mentor/Admin:
                        </strong>{" "}
                        {notes || "—"}
                      </p>

                      <p>
                        <strong>
                          Rekomendasi:
                        </strong>{" "}
                        {recommendation || "—"}
                      </p>

                      <p>
                        Data yang belum tercatat
                        atau diverifikasi tidak
                        otomatis menunjukkan
                        kegagalan peserta.
                      </p>
                    </section>

                    <section className="bw-note">
                      <div className="bw-section">
                        RINGKASAN HASIL
                      </div>

                      <div
                        className="bw-summary"
                        style={{
                          gridTemplateColumns: "1fr 1fr",
                        }}
                      >
                        <div className="bw-stat">
                          Nilai Total

                          <strong>
                            {gradeValues.length
                              ? fmt(totalGrade, 2)
                              : "—"}
                          </strong>
                        </div>

                        <div className="bw-stat">
                          Nilai Rata-rata

                          <strong>
                            {fmt(averageGrade, 2)}
                          </strong>
                        </div>
                      </div>

                      <p>
                        <strong>
                          Predikat Sementara:{" "}
                          {predicate}
                        </strong>
                      </p>

                      <p className="bw-muted">
                        Predikat sementara dihitung
                        dari nilai pembelajaran dan
                        praktik yang tersedia.
                        Rumus resmi masih perlu
                        disepakati.
                      </p>
                    </section>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      marginTop: 25,
                      fontSize: 12,
                    }}
                  >
                    Mengetahui,

                    <p>
                      Mentor / Penanggung Jawab
                    </p>

                    <div
                      style={{ height: 48 }}
                    />

                    <strong>
                      __________________________
                    </strong>

                    <p>Mentor OJT</p>
                  </div>

                  <footer className="bw-footer">
                    <div>
                      OJT MineTrack · PT Berau Coal
                    </div>

                    <div>
                      Status:{" "}
                      {isFinal
                        ? "FINAL"
                        : "PRATINJAU"}

                      {report?.finalized_at && (
                        <div>
                          Difinalisasi:{" "}
                          {new Date(
                            report.finalized_at
                          ).toLocaleString("id-ID")}
                        </div>
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

export default function BiweeklyReportPage() {
  return (
    <Suspense fallback={<div>Memuat rapor...</div>}>
      <BiweeklyReportContent />
    </Suspense>
  );
}
