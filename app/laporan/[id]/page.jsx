
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const CATEGORIES = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

function normal(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value) {
  if (!value) return null;
  const parts = String(value).slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isInteger(n))) {
    return null;
  }
  const [y, m, d] = parts;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
    ? date
    : null;
}

function dateText(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);
  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );
  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

function num(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function avg(values) {
  const clean = values.map(num).filter(v => v !== null);
  return clean.length
    ? clean.reduce((a, b) => a + b, 0) / clean.length
    : null;
}

function fmt(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function weekly(rows, startDate, dateKey) {
  return Array.from({ length: TOTAL_WEEKS }, (_, i) => {
    const week = i + 1;
    const matches = rows.filter(
      row => weekOf(row[dateKey], startDate) === week
    );
    return {
      week,
      score: avg(matches.map(row => row.score)),
      count: matches.length,
      names: matches.map(row => row.practice_name).filter(Boolean),
    };
  });
}

function simperProgress(record) {
  if (!record) return { percent: 0, stages: [false, false, false, false] };

  const text = String(record.notes || "");
  const marker = "[[SIMPER_V2]]";
  const closing = "[[/SIMPER_V2]]";
  const start = text.lastIndexOf(marker);
  const end = text.lastIndexOf(closing);
  let meta = null;

  if (start >= 0 && end > start) {
    try {
      const value = JSON.parse(
        text.slice(start + marker.length, end)
      );
      if (value?.version === 2) meta = value;
    } catch {}
  }

  const validation = record.administration_status === "passed";
  const theory = record.theory_status === "passed";
  const practice = record.practice_status === "passed";
  const released =
    validation &&
    theory &&
    practice &&
    meta?.application_status === "approved" &&
    meta?.orientation_status === "completed" &&
    meta?.issuance_status === "issued" &&
    Boolean(record.graduation_date);

  const stages = [validation, theory, practice, released];

  return {
    percent: stages.filter(Boolean).length * 25,
    stages,
  };
}

function samaptaResults(records) {
  const groups = new Map();

  for (const row of records) {
    if (!row.test_date) continue;
    if (!groups.has(row.test_date)) groups.set(row.test_date, []);
    groups.get(row.test_date).push(row);
  }

  const complete = [];

  for (const [date, items] of groups.entries()) {
    const score = (name) => {
      const item = items.find(
        r => normal(r.test_type) === normal(name)
      );
      return num(item?.score);
    };

    const a = score("Lari 12 Menit");
    const other = [
      score("Pull-Up"),
      score("Push-Up"),
      score("Sit-Up"),
      score("Shuttle Run"),
    ];

    if (a === null || other.some(v => v === null)) continue;

    const b = avg(other);
    complete.push({
      date,
      a,
      b,
      final: (a + b) / 2,
    });
  }

  return complete.sort((a, b) => a.date.localeCompare(b.date));
}

function ScoreTable({ title, data, practice = false }) {
  const chunks = [];

  for (let i = 0; i < TOTAL_WEEKS; i += 5) {
    chunks.push(data.slice(i, i + 5));
  }

  return (
    <section className="rp-section">
      <div className="rp-section-title">{title}</div>
      <table className="rp-table rp-week-table">
        <thead>
          <tr>
            <th>KELOMPOK</th>
            <th>WEEK</th>
            <th>NILAI</th>
            <th>WEEK</th>
            <th>NILAI</th>
            <th>WEEK</th>
            <th>NILAI</th>
            <th>WEEK</th>
            <th>NILAI</th>
            <th>WEEK</th>
            <th>NILAI</th>
          </tr>
        </thead>
        <tbody>
          {chunks.map((chunk, index) => (
            <tr key={index}>
              <td className="rp-group">{index + 1}</td>
              {chunk.map(item => (
                <FragmentWeek
                  key={item.week}
                  item={item}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rp-small">
        {practice
          ? "Nilai merupakan rata-rata seluruh praktik yang tercatat dalam minggu yang sama."
          : "Nilai merupakan rata-rata Post-Test yang tercatat dalam minggu yang sama."}
        {" "}Tanda — berarti belum ada nilai.
      </p>
    </section>
  );
}

function FragmentWeek({ item }) {
  return (
    <>
      <td className="rp-week-number">
        {String(item.week).padStart(2, "0")}
      </td>
      <td className="rp-score">{fmt(item.score)}</td>
    </>
  );
}

export default function RaporOJT() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadRecords(id) {
    const results = await Promise.all([
      supabase.from("achievement_types")
        .select("code,name"),
      supabase.from("achievement_records")
        .select("id,type_code,status,activity_date")
        .eq("program_id", id),
      supabase.from("post_test_scores")
        .select("id,test_date,score")
        .eq("program_id", id),
      supabase.from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", id),
      supabase.from("samapta_records")
        .select("id,test_date,test_type,score")
        .eq("program_id", id),
      supabase.from("simper_records")
        .select(
          "id,administration_status,theory_status,practice_status,graduation_date,notes"
        )
        .eq("program_id", id)
        .maybeSingle(),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    return {
      types: results[0].data || [],
      achievements: results[1].data || [],
      post: results[2].data || [],
      practice: results[3].data || [],
      samapta: results[4].data || [],
      simper: results[5].data || null,
    };
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,role,full_name")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Profil pengguna tidak ditemukan.");
        }

        const mentor = profile.role === "mentor";
        const participant = ["participant", "peserta"].includes(
          profile.role
        );

        if (!mentor && !participant) {
          throw new Error("Role akun tidak diizinkan.");
        }

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            site,
            status,
            start_date,
            end_date,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (participant) {
          query = query.eq("participant_id", user.id);
        }

        const {
          data: program,
          error: programError,
        } = await query.single();

        if (programError || !program) {
          throw new Error(
            "Program OJT tidak ditemukan atau tidak dapat diakses."
          );
        }

        if (!mentor && program.participant_id !== user.id) {
          throw new Error("Anda tidak boleh membaca rapor peserta lain.");
        }

        if (!mentor && program.status !== "active") {
          throw new Error("Program OJT belum aktif.");
        }

        if (!parseDate(program.start_date)) {
          throw new Error("Tanggal mulai OJT tidak valid.");
        }

        const records = await loadRecords(program.id);

        if (!active) return;

        setData({ profile, program, ...records });
      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal memuat rapor OJT.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (!data || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const records = await loadRecords(data.program.id);
      setData(old => ({ ...old, ...records }));
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  const report = useMemo(() => {
    if (!data) return null;

    const {
      program,
      types,
      achievements,
      post,
      practice,
      samapta,
      simper,
    } = data;

    const categories = CATEGORIES.map(name => {
      const type = types.find(
        t => normal(t.name) === normal(name)
      );

      const verified = type
        ? achievements.filter(
            r =>
              r.type_code === type.code &&
              r.status === "verified" &&
              weekOf(r.activity_date, program.start_date) !== null
          ).length
        : 0;

      return { name, verified };
    });

    const verifiedCategories = categories.filter(
      c => c.verified > 0
    ).length;

    const postWeeks = weekly(post, program.start_date, "test_date");
    const practiceWeeks = weekly(
      practice,
      program.start_date,
      "practice_date"
    );

    const samaptaComplete = samaptaResults(samapta);
    const latestSamapta = samaptaComplete.length
      ? samaptaComplete[samaptaComplete.length - 1]
      : null;

    const simperData = simperProgress(simper);

    const activity = new Set();

    [
      ...achievements.map(r => r.activity_date),
      ...post.map(r => r.test_date),
      ...practice.map(r => r.practice_date),
      ...samapta.map(r => r.test_date),
    ].forEach(date => {
      const w = weekOf(date, program.start_date);
      if (w !== null) activity.add(w);
    });

    return {
      categories,
      verifiedCategories,
      pct: Math.round(verifiedCategories / 6 * 100),
      postWeeks,
      practiceWeeks,
      postAverage: avg(postWeeks.map(w => w.score)),
      practiceAverage: avg(practiceWeeks.map(w => w.score)),
      latestSamapta,
      simperData,
      activeWeeks: activity.size,
    };
  }, [data]);

  if (loading) {
    return (
      <main className="rp-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="rp-loading">
        <h2>Rapor Tidak Dapat Ditampilkan</h2>
        <p>{error || "Data tidak tersedia."}</p>
        <button onClick={() => router.back()}>
          Kembali
        </button>
      </main>
    );
  }

  const { profile, program } = data;
  const mentor = profile.role === "mentor";

  const backPath = mentor
    ? `/peserta/${program.id}`
    : "/dashboard-peserta";

  const participantName =
    program.peserta?.full_name || "Peserta OJT";

  return (
    <main className="rp-root">
      <style>{`
        .rp-root, .rp-root * {
          box-sizing: border-box;
        }

        .rp-root {
          min-height: 100vh;
          background: #edf3f0;
          color: #20382e;
          font-family: Arial, Helvetica, sans-serif;
        }

        .rp-topbar {
          background: #09252d;
          color: #fff;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .rp-brand {
          font-size: 19px;
          font-weight: 900;
        }

        .rp-brand span {
          color: #39d19a;
        }

        .rp-btn {
          border: none;
          border-radius: 9px;
          background: #087f59;
          color: white;
          font-size: 12px;
          font-weight: 800;
          padding: 11px 14px;
          cursor: pointer;
        }

        .rp-back {
          background: #ffffff20;
          border: 1px solid #ffffff40;
        }

        .rp-toolbar {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
          justify-content: flex-end;
          padding: 14px 0;
        }

        .rp-paper-area {
          max-width: 1050px;
          margin: 0 auto;
          padding: 0 15px 25px;
        }

        .rp-paper {
          background: white;
          border-radius: 12px;
          border: 1px solid #dce6df;
          padding: 18px;
          box-shadow: 0 5px 18px #16392912;
        }

        .rp-heading {
          display: grid;
          grid-template-columns: 130px 1fr 105px;
          align-items: center;
          gap: 10px;
          background: #0b2941;
          color: white;
          padding: 13px 16px;
          border-bottom: 5px solid #d9b767;
        }

        .rp-identity-mark {
          font-size: 14px;
          font-weight: 900;
          line-height: 1.25;
        }

        .rp-identity-mark small {
          display: block;
          font-size: 9px;
          font-weight: 500;
          margin-top: 4px;
          color: #d8efe4;
        }

        .rp-main-title {
          text-align: center;
        }

        .rp-main-title strong {
          display: block;
          font-size: 26px;
          letter-spacing: 2px;
        }

        .rp-main-title span {
          display: block;
          font-size: 12px;
          margin-top: 4px;
        }

        .rp-mark {
          border: 3px solid #dfbd70;
          border-radius: 50%;
          width: 69px;
          height: 69px;
          display: grid;
          place-items: center;
          justify-self: end;
          font-size: 13px;
          font-weight: 900;
          text-align: center;
        }

        .rp-intro {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 10px;
          margin-top: 11px;
          margin-bottom: 11px;
        }

        .rp-panel {
          border: 1px solid #cfdcd5;
          min-width: 0;
        }

        .rp-panel-title,
        .rp-section-title {
          background: #153b72;
          color: white;
          font-size: 12px;
          font-weight: 900;
          padding: 7px 9px;
          letter-spacing: .2px;
        }

        .rp-panel-content {
          padding: 9px;
          font-size: 11px;
          line-height: 1.55;
        }

        .rp-detail {
          display: grid;
          grid-template-columns: 96px 1fr;
          gap: 5px;
          padding: 3px 0;
        }

        .rp-detail strong {
          color: #244536;
        }

        .rp-section {
          margin: 10px 0;
          border: 1px solid #d4dfd7;
          min-width: 0;
        }

        .rp-table {
          border-collapse: collapse;
          width: 100%;
          table-layout: fixed;
        }

        .rp-table th,
        .rp-table td {
          border: 1px solid #d6e1d9;
          padding: 6px 4px;
          text-align: center;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .rp-table th {
          color: #163a32;
          background: #eaf2ed;
          font-weight: 800;
        }

        .rp-comp-name {
          text-align: left !important;
          font-weight: 700;
        }

        .rp-yes {
          color: #078758;
          font-weight: 900;
        }

        .rp-no {
          color: #a15f21;
          font-weight: 800;
        }

        .rp-week-table th {
          font-size: 9px;
        }

        .rp-week-table td {
          font-size: 10px;
          padding: 5px 3px;
        }

        .rp-week-number {
          background: #f4f8f5;
          font-weight: 800;
        }

        .rp-group {
          color: #73877c;
          font-weight: 800;
        }

        .rp-score {
          font-weight: 800;
        }

        .rp-small {
          margin: 5px 8px;
          font-size: 9px;
          color: #6a7e70;
          line-height: 1.4;
        }

        .rp-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }

        .rp-summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 9px;
        }

        .rp-stat {
          border: 1px solid #dde8df;
          padding: 8px;
          text-align: center;
          border-radius: 5px;
        }

        .rp-stat span {
          display: block;
          font-size: 9px;
          color: #6b8074;
        }

        .rp-stat strong {
          display: block;
          font-size: 18px;
          color: #0a7952;
          margin-top: 5px;
        }

        .rp-status {
          padding: 9px;
          font-size: 11px;
          line-height: 1.5;
        }

        .rp-status div {
          padding: 4px 0;
          border-bottom: 1px solid #edf0ed;
        }

        .rp-notice {
          margin: 10px 0;
          border: 1px solid #eadba7;
          background: #fff9e8;
          padding: 9px 11px;
          color: #705722;
          font-size: 10px;
          line-height: 1.5;
        }

        .rp-signature-area {
          display: grid;
          grid-template-columns: 1fr 170px;
          gap: 14px;
          margin-top: 10px;
          font-size: 10px;
          align-items: end;
        }

        .rp-signature {
          text-align: center;
        }

        .rp-signature-space {
          height: 37px;
        }

        .rp-footer {
          text-align: center;
          font-size: 9px;
          color: #7f9185;
          border-top: 1px solid #e4ebe6;
          padding-top: 7px;
          margin-top: 11px;
        }

        .rp-error {
          border: 1px solid #f1bdbd;
          color: #af2727;
          background: #fff3f3;
          padding: 10px;
          font-size: 12px;
          margin-bottom: 10px;
        }

        .rp-loading {
          min-height: 100vh;
          padding: 25px;
          font-family: Arial, sans-serif;
          background: #edf3f0;
        }

        @media (max-width: 700px) {
          .rp-topbar {
            padding: 12px;
          }

          .rp-paper-area {
            padding: 0 8px 20px;
          }

          .rp-paper {
            padding: 8px;
          }

          .rp-heading {
            grid-template-columns: 1fr 2fr;
            padding: 10px;
          }

          .rp-main-title strong {
            font-size: 19px;
          }

          .rp-mark {
            display: none;
          }

          .rp-intro,
          .rp-bottom {
            grid-template-columns: 1fr;
          }

          .rp-table th,
          .rp-table td {
            font-size: 9px;
            padding: 4px 2px;
          }

          .rp-week-table th,
          .rp-week-table td {
            font-size: 8px;
            padding: 4px 1px;
          }
        }

        /* CETAK A4 — seluruh rapor dalam satu halaman
           selama ukuran dan jumlah catatan memungkinkan. */

        @page {
          size: A4 portrait;
          margin: 5mm;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .rp-no-print {
            display: none !important;
          }

          .rp-root {
            background: white !important;
            min-height: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .rp-paper-area {
            width: 200mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rp-paper {
            width: 200mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .rp-heading {
            display: grid !important;
            grid-template-columns: 125px 1fr 85px !important;
            padding: 7px 10px !important;
            gap: 8px !important;
          }

          .rp-mark {
            display: grid !important;
            width: 55px !important;
            height: 55px !important;
            font-size: 10px !important;
          }

          .rp-main-title strong {
            font-size: 21px !important;
          }

          .rp-main-title span {
            font-size: 9px !important;
          }

          .rp-intro {
            display: grid !important;
            grid-template-columns: 1.1fr 1fr !important;
            gap: 7px !important;
            margin: 6px 0 !important;
          }

          .rp-panel-title,
          .rp-section-title {
            font-size: 9px !important;
            padding: 5px 7px !important;
          }

          .rp-panel-content {
            padding: 5px !important;
            font-size: 8px !important;
            line-height: 1.3 !important;
          }

          .rp-detail {
            grid-template-columns: 70px 1fr !important;
            gap: 3px !important;
            padding: 1px 0 !important;
          }

          .rp-section {
            margin: 6px 0 !important;
            break-inside: avoid;
          }

          .rp-table th,
          .rp-table td {
            font-size: 8px !important;
            padding: 3px 2px !important;
            line-height: 1.15 !important;
          }

          .rp-week-table th,
          .rp-week-table td {
            font-size: 7px !important;
            padding: 3px 1px !important;
          }

          .rp-small {
            font-size: 7px !important;
            margin: 3px 5px !important;
          }

          .rp-bottom {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 7px !important;
            margin-top: 6px !important;
            break-inside: avoid;
          }

          .rp-summary {
            padding: 5px !important;
            gap: 5px !important;
          }

          .rp-stat {
            padding: 5px !important;
          }

          .rp-stat span {
            font-size: 7px !important;
          }

          .rp-stat strong {
            font-size: 13px !important;
            margin-top: 2px !important;
          }

          .rp-status {
            padding: 5px !important;
            font-size: 8px !important;
          }

          .rp-status div {
            padding: 2px 0 !important;
          }

          .rp-notice {
            font-size: 8px !important;
            padding: 5px 7px !important;
            margin: 6px 0 !important;
          }

          .rp-signature-area {
            grid-template-columns: 1fr 140px !important;
            font-size: 8px !important;
            margin-top: 6px !important;
            gap: 8px !important;
            break-inside: avoid;
          }

          .rp-signature-space {
            height: 22px !important;
          }

          .rp-footer {
            font-size: 7px !important;
            padding-top: 4px !important;
            margin-top: 6px !important;
          }
        }
      `}</style>

      <header className="rp-topbar rp-no-print">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>
        <button
          type="button"
          className="rp-btn rp-back"
          onClick={() => router.push(backPath)}
        >
          {mentor ? "← Detail Peserta" : "← Dashboard Peserta"}
        </button>
      </header>

      <div className="rp-paper-area">
        <div className="rp-toolbar rp-no-print">
          <button
            type="button"
            className="rp-btn"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing ? "Memuat..." : "Refresh Data"}
          </button>
          <button
            type="button"
            className="rp-btn"
            onClick={() => window.print()}
          >
            Cetak / Simpan PDF
          </button>
        </div>

        {error && (
          <div className="rp-error rp-no-print">
            {error}
          </div>
        )}

        <article className="rp-paper">
          <div className="rp-heading">
            <div className="rp-identity-mark">
              OJT MineTrack
              <small>
                EMERGENCY RESPONSE GROUP
                <br />
                PT BERAU COAL
              </small>
            </div>

            <div className="rp-main-title">
              <strong>RAPOR OJT</strong>
              <span>ON THE JOB TRAINING</span>
            </div>

            <div className="rp-mark">OJT<br />ERG</div>
          </div>

          <div className="rp-intro">
            <div className="rp-panel">
              <div className="rp-panel-title">DATA PESERTA</div>
              <div className="rp-panel-content">
                <div className="rp-detail">
                  <strong>Nama</strong>
                  <span>{participantName}</span>
                </div>
                <div className="rp-detail">
                  <strong>Site</strong>
                  <span>{program.site || "—"}</span>
                </div>
                <div className="rp-detail">
                  <strong>Departemen</strong>
                  <span>{program.peserta?.department || "—"}</span>
                </div>
                <div className="rp-detail">
                  <strong>Periode</strong>
                  <span>
                    {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </span>
                </div>
                <div className="rp-detail">
                  <strong>Status</strong>
                  <span>
                    {program.status === "active"
                      ? "Aktif"
                      : program.status || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rp-panel">
              <div className="rp-panel-title">KETERANGAN</div>
              <div className="rp-panel-content">
                Rapor ini merupakan rekap otomatis
                perkembangan On the Job Training peserta
                selama 25 minggu. Data bersumber dari
                hasil pencapaian kompetensi, Post-Test,
                praktik, Samapta, dan tahapan SIMPER
                yang tercatat pada OJT MineTrack.
                <br /><br />
                Nilai kosong tidak dianggap nol.
                Rapor ini bukan keputusan kelulusan akhir.
              </div>
            </div>
          </div>

          <section className="rp-section">
            <div className="rp-section-title">
              1. PENILAIAN KOMPETENSI UTAMA
            </div>
            <table className="rp-table">
              <thead>
                <tr>
                  <th>KOMPETENSI</th>
                  {report.categories.map(item => (
                    <th key={item.name}>{item.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="rp-comp-name">Jumlah Terverifikasi</td>
                  {report.categories.map(item => (
                    <td key={item.name}>{item.verified}</td>
                  ))}
                </tr>
                <tr>
                  <td className="rp-comp-name">Status</td>
                  {report.categories.map(item => (
                    <td
                      key={item.name}
                      className={item.verified > 0 ? "rp-yes" : "rp-no"}
                    >
                      {item.verified > 0 ? "Terpenuhi" : "Belum"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="rp-small">
              Satu kategori dinyatakan terpenuhi jika memiliki
              minimal satu aktivitas terverifikasi dalam periode OJT.
            </p>
          </section>

          <ScoreTable
            title="2. PENILAIAN PEMBELAJARAN MINGGUAN (POST-TEST)"
            data={report.postWeeks}
          />

          <ScoreTable
            title="3. PENILAIAN PRAKTIK MINGGUAN"
            data={report.practiceWeeks}
            practice
          />

          <div className="rp-bottom">
            <section className="rp-panel">
              <div className="rp-panel-title">
                4. VALIDASI & PROGRES SIMPER
              </div>
              <div className="rp-status">
                {[
                  "Validasi Persyaratan",
                  "Ujian Teori",
                  "Ujian Praktik",
                  "Penerbitan SIMPER",
                ].map((name, index) => (
                  <div key={name}>
                    <strong>{name}:</strong>{" "}
                    {report.simperData.stages[index]
                      ? "Selesai"
                      : "Belum Selesai"}
                  </div>
                ))}
                <div>
                  <strong>Total:</strong>{" "}
                  {report.simperData.percent}%
                </div>
              </div>
            </section>

            <section className="rp-panel">
              <div className="rp-panel-title">
                5. RINGKASAN MONITORING
              </div>
              <div className="rp-summary">
                <div className="rp-stat">
                  <span>Kompetensi Terpenuhi</span>
                  <strong>{report.verifiedCategories}/6</strong>
                </div>
                <div className="rp-stat">
                  <span>Rata-rata Post-Test Mingguan</span>
                  <strong>{fmt(report.postAverage)}</strong>
                </div>
                <div className="rp-stat">
                  <span>Rata-rata Praktik Mingguan</span>
                  <strong>{fmt(report.practiceAverage)}</strong>
                </div>
                <div className="rp-stat">
                  <span>Nilai Samapta Terakhir</span>
                  <strong>{fmt(report.latestSamapta?.final)}</strong>
                </div>
                <div className="rp-stat">
                  <span>Minggu Ada Aktivitas</span>
                  <strong>{report.activeWeeks}/25</strong>
                </div>
                <div className="rp-stat">
                  <span>Progres SIMPER</span>
                  <strong>{report.simperData.percent}%</strong>
                </div>
              </div>
            </section>
          </div>

          <div className="rp-notice">
            <strong>Catatan:</strong> Rapor memuat pencapaian berdasarkan
            data yang sudah tercatat dan dapat diakses. Nilai akhir,
            pembobotan, predikat, dan keputusan kelulusan resmi
            memerlukan ketentuan penilaian serta persetujuan
            penanggung jawab perusahaan.
          </div>

          <div className="rp-signature-area">
            <div>
              <strong>Catatan Monitoring</strong>
              <div>
                {report.verifiedCategories} dari 6 kompetensi
                terverifikasi; {report.activeWeeks} dari 25
                minggu mempunyai aktivitas.
              </div>
              <div>
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString("id-ID")}
              </div>
            </div>

            <div className="rp-signature">
              <strong>Mengetahui,</strong>
              <div>Mentor / Penanggung Jawab</div>
              <div className="rp-signature-space" />
              <strong>_____________________</strong>
              <div>
                {mentor
                  ? profile.full_name || "Nama Mentor"
                  : "Nama Penanggung Jawab"}
              </div>
            </div>
          </div>

          <footer className="rp-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </footer>
        </article>
      </div>
    </main>
  );
}
