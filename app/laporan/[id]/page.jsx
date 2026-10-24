
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

function normalize(value) {
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

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) return null;

  return date;
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

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  const clean = values
    .map(numberOrNull)
    .filter(v => v !== null);

  if (!clean.length) return null;

  return clean.reduce((a, b) => a + b, 0) / clean.length;
}

function fmt(value) {
  return value === null || value === undefined
    ? "—"
    : Number(value).toFixed(2);
}

function buildWeeks(rows, startDate, dateKey) {
  return Array.from({ length: TOTAL_WEEKS }, (_, index) => {
    const week = index + 1;

    const matches = rows.filter(
      item => weekOf(item[dateKey], startDate) === week
    );

    return {
      week,
      score: average(matches.map(item => item.score)),
      count: matches.length,
      names: [
        ...new Set(
          matches.map(item => item.practice_name).filter(Boolean)
        ),
      ],
    };
  });
}

function getSimperProgress(record) {
  if (!record) {
    return {
      percent: 0,
      stages: [false, false, false, false],
    };
  }

  const notes = String(record.notes || "");
  const startTag = "[[SIMPER_V2]]";
  const endTag = "[[/SIMPER_V2]]";

  const start = notes.lastIndexOf(startTag);
  const end = notes.lastIndexOf(endTag);

  let meta = null;

  if (start >= 0 && end > start) {
    try {
      const value = JSON.parse(
        notes.slice(start + startTag.length, end)
      );
      if (value?.version === 2) meta = value;
    } catch {
      meta = null;
    }
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

function getSamaptaResults(records) {
  const groups = new Map();

  for (const row of records) {
    if (!row.test_date) continue;

    if (!groups.has(row.test_date)) {
      groups.set(row.test_date, []);
    }

    groups.get(row.test_date).push(row);
  }

  const result = [];

  for (const [date, items] of groups.entries()) {
    const findScore = name => {
      const match = items.find(
        item => normalize(item.test_type) === normalize(name)
      );
      return numberOrNull(match?.score);
    };

    const running = findScore("Lari 12 Menit");

    const other = [
      findScore("Pull-Up"),
      findScore("Push-Up"),
      findScore("Sit-Up"),
      findScore("Shuttle Run"),
    ];

    if (running === null || other.some(v => v === null)) {
      continue;
    }

    const b = average(other);

    result.push({
      date,
      final: (running + b) / 2,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function Section({
  number,
  title,
  expanded,
  onToggle,
  children,
}) {
  return (
    <section className="rp-section">
      <button
        type="button"
        className="rp-section-head rp-screen-only"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="rp-section-label">
          <b>{number}</b>
          {title}
        </span>
        <span className="rp-chevron">
          {expanded ? "−" : "+"}
        </span>
      </button>

      <div className="rp-print-only rp-section-title">
        {number}. {title}
      </div>

      <div className={`rp-section-body ${
        expanded ? "" : "rp-collapsed"
      }`}>
        {children}
      </div>
    </section>
  );
}

function PrintWeeks({ title, weeks }) {
  const groups = [];

  for (let i = 0; i < TOTAL_WEEKS; i += 5) {
    groups.push(weeks.slice(i, i + 5));
  }

  return (
    <div className="rp-print-week-section">
      <div className="rp-section-title">{title}</div>

      <table className="rp-print-table">
        <thead>
          <tr>
            <th>NO</th>
            {Array.from({ length: 5 }, (_, i) => (
              <th key={i} colSpan={2}>
                PENILAIAN
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {group.map(item => (
                <FragmentWeek key={item.week} item={item} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentWeek({ item }) {
  return (
    <>
      <td>W{String(item.week).padStart(2, "0")}</td>
      <td>{fmt(item.score)}</td>
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

  const [activeTab, setActiveTab] = useState("post");
  const [selectedWeek, setSelectedWeek] = useState(1);

  const [expanded, setExpanded] = useState({
    kompetensi: false,
    minggu: true,
    samapta: false,
    simper: false,
    catatan: false,
  });

  function toggleSection(name) {
    setExpanded(old => ({
      ...old,
      [name]: !old[name],
    }));
  }

  async function loadRecords(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select("id,type_code,status,activity_date")
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select("id,test_date,test_type,score")
        .eq("program_id", id),

      supabase
        .from("simper_records")
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
          throw new Error("Akun tidak memiliki akses.");
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
          throw new Error("Akses ke rapor peserta lain ditolak.");
        }

        if (!parseDate(program.start_date)) {
          throw new Error("Tanggal mulai OJT tidak valid.");
        }

        const records = await loadRecords(program.id);

        if (!active) return;

        setData({
          profile,
          program,
          ...records,
        });
      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal memuat rapor.");
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
      setData(old => ({
        ...old,
        ...records,
      }));
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
        item => normalize(item.name) === normalize(name)
      );

      const verified = type
        ? achievements.filter(
            item =>
              item.type_code === type.code &&
              item.status === "verified" &&
              weekOf(item.activity_date, program.start_date) !== null
          ).length
        : 0;

      return {
        name,
        verified,
      };
    });

    const verifiedCount = categories.filter(
      item => item.verified > 0
    ).length;

    const postWeeks = buildWeeks(
      post,
      program.start_date,
      "test_date"
    );

    const practiceWeeks = buildWeeks(
      practice,
      program.start_date,
      "practice_date"
    );

    const completeSamapta = getSamaptaResults(samapta);

    const lastSamapta = completeSamapta.length
      ? completeSamapta[completeSamapta.length - 1]
      : null;

    const activeWeeks = new Set();

    [
      ...achievements.map(item => item.activity_date),
      ...post.map(item => item.test_date),
      ...practice.map(item => item.practice_date),
      ...samapta.map(item => item.test_date),
    ].forEach(date => {
      const week = weekOf(date, program.start_date);
      if (week !== null) activeWeeks.add(week);
    });

    return {
      categories,
      verifiedCount,
      postWeeks,
      practiceWeeks,
      postAverage: average(
        postWeeks.map(item => item.score)
      ),
      practiceAverage: average(
        practiceWeeks.map(item => item.score)
      ),
      lastSamapta,
      simperData: getSimperProgress(simper),
      activeWeeks: activeWeeks.size,
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
        <p>{error || "Data belum tersedia."}</p>
        <button onClick={() => router.back()}>
          Kembali
        </button>
      </main>
    );
  }

  const { profile, program } = data;

  const mentor = profile.role === "mentor";

  const participantName =
    program.peserta?.full_name || "Peserta OJT";

  const backPath = mentor
    ? `/peserta/${program.id}`
    : "/dashboard-peserta";

  const selectedData =
    activeTab === "post"
      ? report.postWeeks[selectedWeek - 1]
      : report.practiceWeeks[selectedWeek - 1];

  const simperStages = [
    "Validasi Persyaratan",
    "Ujian Teori",
    "Ujian Praktik",
    "Penerbitan SIMPER",
  ];

  return (
    <main className="rp-root">
      <style>{`
        .rp-root,
        .rp-root * {
          box-sizing: border-box;
        }

        .rp-root {
          min-height: 100vh;
          background: #eef3f0;
          color: #1c372b;
          font-family: Arial, Helvetica, sans-serif;
          overflow-x: clip;
        }

        .rp-topbar {
          background: #082731;
          color: white;
          padding: 11px 13px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .rp-brand {
          font-size: 17px;
          font-weight: 900;
          white-space: nowrap;
        }

        .rp-brand span {
          color: #3fd39b;
        }

        .rp-btn {
          border: none;
          background: #087f5d;
          color: white;
          padding: 10px 12px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          min-width: 0;
        }

        .rp-btn:disabled {
          opacity: .5;
        }

        .rp-back {
          background: #ffffff20;
          border: 1px solid #ffffff35;
        }

        .rp-page {
          max-width: 1050px;
          margin: 0 auto;
          padding: 11px;
          width: 100%;
          min-width: 0;
        }

        .rp-toolbar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          width: 100%;
          margin-bottom: 10px;
        }

        .rp-toolbar .rp-btn {
          width: 100%;
          padding: 11px 8px;
        }

        .rp-paper {
          background: white;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid #dce6df;
          box-shadow: 0 4px 18px #16392910;
          min-width: 0;
        }

        .rp-heading {
          background: #0c2d46;
          border-bottom: 4px solid #d7b568;
          color: white;
          padding: 12px;
          border-radius: 8px;
          display: grid;
          grid-template-columns: 140px 1fr 75px;
          gap: 8px;
          align-items: center;
        }

        .rp-heading-brand {
          font-size: 14px;
          font-weight: 900;
        }

        .rp-heading-brand small {
          display: block;
          font-size: 9px;
          font-weight: 400;
          line-height: 1.4;
          color: #d5e8dd;
          margin-top: 3px;
        }

        .rp-heading-title {
          text-align: center;
        }

        .rp-heading-title strong {
          display: block;
          font-size: 24px;
          letter-spacing: 1px;
        }

        .rp-heading-title small {
          display: block;
          font-size: 10px;
          margin-top: 3px;
        }

        .rp-heading-mark {
          border: 3px solid #d7b568;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          justify-self: end;
          text-align: center;
          font-size: 10px;
          font-weight: 900;
        }

        .rp-profile {
          margin-top: 10px;
          border: 1px solid #dce7df;
          background: #f8faf8;
          border-radius: 10px;
          padding: 11px;
        }

        .rp-profile-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .rp-profile-name {
          font-size: 16px;
          font-weight: 900;
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .rp-site {
          background: #e4f4e9;
          color: #087a51;
          border-radius: 50px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .rp-profile-sub {
          margin-top: 4px;
          font-size: 11px;
          color: #708578;
          line-height: 1.45;
        }

        .rp-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
          margin-top: 10px;
        }

        .rp-stat {
          border: 1px solid #e0e9e2;
          background: white;
          border-radius: 9px;
          padding: 9px 5px;
          text-align: center;
          min-width: 0;
        }

        .rp-stat span {
          display: block;
          color: #708477;
          font-size: 10px;
          margin-bottom: 4px;
        }

        .rp-stat strong {
          font-size: 20px;
          display: block;
          color: #087c57;
          font-weight: 900;
        }

        .rp-section {
          margin-top: 9px;
          border: 1px solid #dce6de;
          border-radius: 10px;
          overflow: hidden;
          background: white;
        }

        .rp-section-head {
          border: 0;
          width: 100%;
          background: #f8faf8;
          color: #193e30;
          padding: 11px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          text-align: left;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          gap: 8px;
        }

        .rp-section-label {
          display: flex;
          gap: 9px;
          align-items: center;
        }

        .rp-section-label b {
          background: #e5f3ea;
          color: #087f5d;
          padding: 5px 8px;
          border-radius: 7px;
          font-size: 11px;
        }

        .rp-chevron {
          font-size: 21px;
          line-height: 1;
          color: #087f5d;
        }

        .rp-section-body {
          padding: 10px;
          border-top: 1px solid #edf1ed;
          min-width: 0;
        }

        .rp-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          background: #e8f0eb;
          border-radius: 9px;
          padding: 4px;
        }

        .rp-tab {
          background: transparent;
          border: 0;
          padding: 10px 6px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 900;
          color: #718477;
          cursor: pointer;
        }

        .rp-tab.active {
          color: white;
          background: #087f5d;
        }

        .rp-week-compact {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 105px;
          gap: 10px;
          align-items: end;
          margin-top: 10px;
        }

        .rp-week-selector {
          min-width: 0;
        }

        .rp-week-selector label {
          display: block;
          color: #73887b;
          font-size: 10px;
          margin-bottom: 5px;
        }

        .rp-week-select {
          width: 100%;
          min-width: 0;
          padding: 10px;
          border: 1px solid #dce7df;
          border-radius: 8px;
          background: white;
          color: #224535;
          font-size: 13px;
        }

        .rp-week-inline-score {
          background: #f5faf6;
          border: 1px solid #dfebe3;
          border-radius: 8px;
          padding: 7px 6px;
          text-align: center;
          min-width: 0;
        }

        .rp-week-inline-score span {
          display: block;
          color: #73887b;
          font-size: 9px;
          white-space: nowrap;
        }

        .rp-week-inline-score strong {
          display: block;
          color: #087f5d;
          font-size: 19px;
          margin-top: 2px;
        }

        .rp-week-meta {
          color: #83978a;
          font-size: 10px;
          margin-top: 7px;
          line-height: 1.45;
        }

        .rp-practice-name {
          color: #335b44;
          background: #f5faf6;
          border: 1px solid #e0eae2;
          padding: 8px 10px;
          margin-top: 9px;
          border-radius: 7px;
          font-size: 11px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .rp-list-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 9px;
          padding: 8px 0;
          font-size: 11px;
          border-bottom: 1px solid #edf1ed;
        }

        .rp-list-row:last-child {
          border-bottom: none;
        }

        .rp-ok {
          color: #087f5d;
          font-weight: 800;
        }

        .rp-pending {
          color: #b07e31;
          font-weight: 800;
        }

        .rp-note {
          color: #687e71;
          font-size: 11px;
          line-height: 1.5;
          margin: 0;
        }

        .rp-small {
          color: #849589;
          font-size: 10px;
          line-height: 1.45;
          margin: 7px 0 0;
        }

        .rp-footer {
          text-align: center;
          color: #839589;
          font-size: 9px;
          padding-top: 9px;
          border-top: 1px solid #e5ede7;
          margin-top: 12px;
        }

        .rp-loading {
          min-height: 100vh;
          background: #eef3f0;
          padding: 25px;
          color: #1c372b;
          font-family: Arial, sans-serif;
        }

        .rp-error {
          padding: 10px;
          margin-bottom: 10px;
          border: 1px solid #efbdbd;
          background: #fff1f1;
          color: #a52c2c;
          border-radius: 8px;
          font-size: 12px;
        }

        .rp-print-only {
          display: none;
        }

        .rp-print-week-section {
          margin-top: 7px;
        }

        .rp-section-title {
          background: #153b72;
          color: white;
          font-size: 10px;
          font-weight: 900;
          padding: 6px 8px;
        }

        .rp-print-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .rp-print-table th,
        .rp-print-table td {
          border: 1px solid #dce7df;
          text-align: center;
          padding: 4px 2px;
          font-size: 8px;
        }

        .rp-print-signature {
          margin-top: 11px;
          font-size: 10px;
          text-align: right;
        }

        .rp-print-signature-space {
          height: 35px;
        }

        @media screen {
          .rp-collapsed {
            display: none;
          }
        }

        @media (max-width: 700px) {
          .rp-heading {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 4px;
          }

          .rp-heading-brand {
            font-size: 12px;
          }

          .rp-heading-brand small {
            display: none;
          }

          .rp-heading-title strong {
            font-size: 21px;
          }

          .rp-heading-mark {
            display: none;
          }

          .rp-page {
            padding: 8px;
          }

          .rp-paper {
            padding: 9px;
          }
        }

        @page {
          size: A4 portrait;
          margin: 5mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .rp-screen-only,
          .rp-topbar,
          .rp-toolbar {
            display: none !important;
          }

          .rp-print-only {
            display: block !important;
          }

          .rp-root {
            min-height: 0 !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .rp-page,
          .rp-paper {
            width: 200mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .rp-heading {
            display: grid !important;
            grid-template-columns: 125px 1fr 65px !important;
            padding: 6px 9px !important;
            gap: 6px !important;
            text-align: initial !important;
          }

          .rp-heading-brand {
            font-size: 11px !important;
          }

          .rp-heading-brand small {
            display: block !important;
            font-size: 7px !important;
          }

          .rp-heading-title strong {
            font-size: 20px !important;
          }

          .rp-heading-title small {
            font-size: 9px !important;
          }

          .rp-heading-mark {
            display: grid !important;
            width: 47px !important;
            height: 47px !important;
            font-size: 9px !important;
          }

          .rp-profile {
            padding: 7px !important;
            margin-top: 6px !important;
          }

          .rp-profile-name {
            font-size: 13px !important;
          }

          .rp-profile-sub {
            font-size: 8px !important;
          }

          .rp-stats {
            grid-template-columns: repeat(3, 1fr) !important;
            margin-top: 6px !important;
            gap: 5px !important;
          }

          .rp-stat {
            padding: 5px !important;
          }

          .rp-stat span {
            font-size: 8px !important;
          }

          .rp-stat strong {
            font-size: 15px !important;
          }

          .rp-section {
            margin-top: 6px !important;
            border-radius: 0 !important;
            break-inside: avoid !important;
          }

          .rp-section-body,
          .rp-collapsed {
            display: block !important;
            padding: 5px !important;
          }

          .rp-section-title {
            font-size: 9px !important;
            padding: 5px 7px !important;
          }

          .rp-print-week-section {
            margin-top: 5px !important;
            break-inside: avoid !important;
          }

          .rp-print-table th,
          .rp-print-table td {
            font-size: 7px !important;
            padding: 3px 1px !important;
          }

          .rp-list-row {
            padding: 4px 0 !important;
            font-size: 8px !important;
          }

          .rp-note {
            font-size: 8px !important;
            line-height: 1.3 !important;
          }

          .rp-small {
            font-size: 7px !important;
            margin: 3px 0 !important;
          }

          .rp-print-bottom {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 7px !important;
          }

          .rp-print-signature {
            font-size: 8px !important;
            margin-top: 6px !important;
          }

          .rp-print-signature-space {
            height: 22px !important;
          }

          .rp-footer {
            font-size: 7px !important;
            padding-top: 4px !important;
            margin-top: 5px !important;
          }
        }
      `}</style>

      <header className="rp-topbar rp-screen-only">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="rp-btn rp-back"
          onClick={() => router.push(backPath)}
        >
          {mentor ? "← Detail Peserta" : "← Dashboard"}
        </button>
      </header>

      <div className="rp-page">
        <div className="rp-toolbar rp-screen-only">
          <button
            type="button"
            className="rp-btn"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? "Memuat..." : "Refresh"}
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
          <div className="rp-error rp-screen-only">
            {error}
          </div>
        )}

        <article className="rp-paper">
          <div className="rp-heading">
            <div className="rp-heading-brand">
              OJT MineTrack
              <small>
                EMERGENCY RESPONSE GROUP
                <br />
                PT BERAU COAL
              </small>
            </div>

            <div className="rp-heading-title">
              <strong>RAPOR OJT</strong>
              <small>ON THE JOB TRAINING</small>
            </div>

            <div className="rp-heading-mark">
              OJT
              <br />
              ERG
            </div>
          </div>

          <div className="rp-profile">
            <div className="rp-profile-top">
              <div className="rp-profile-name">
                {participantName}
              </div>

              <span className="rp-site">
                {program.site || "—"}
              </span>
            </div>

            <div className="rp-profile-sub">
              {program.peserta?.department || "Departemen —"}
              {" · "}
              {dateText(program.start_date)}
              {" – "}
              {dateText(program.end_date)}
            </div>

            <div className="rp-stats">
              <div className="rp-stat">
                <span>Kompetensi</span>
                <strong>{report.verifiedCount}/6</strong>
              </div>

              <div className="rp-stat">
                <span>Post-Test</span>
                <strong>{fmt(report.postAverage)}</strong>
              </div>

              <div className="rp-stat">
                <span>Praktik</span>
                <strong>{fmt(report.practiceAverage)}</strong>
              </div>
            </div>
          </div>

          <Section
            number="1"
            title="Kompetensi Utama"
            expanded={expanded.kompetensi}
            onToggle={() => toggleSection("kompetensi")}
          >
            {report.categories.map(item => (
              <div className="rp-list-row" key={item.name}>
                <span>{item.name}</span>
                <span className={
                  item.verified > 0 ? "rp-ok" : "rp-pending"
                }>
                  {item.verified > 0
                    ? `${item.verified} Terverifikasi`
                    : "Belum"}
                </span>
              </div>
            ))}

            <p className="rp-small">
              Kategori dianggap terpenuhi jika memiliki
              minimal satu kegiatan terverifikasi.
            </p>
          </Section>

          <Section
            number="2"
            title="Penilaian Mingguan"
            expanded={expanded.minggu}
            onToggle={() => toggleSection("minggu")}
          >
            <div className="rp-screen-only">
              <div className="rp-tabs">
                <button
                  type="button"
                  className={`rp-tab ${
                    activeTab === "post" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("post")}
                >
                  Post-Test
                </button>

                <button
                  type="button"
                  className={`rp-tab ${
                    activeTab === "practice" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("practice")}
                >
                  Praktik
                </button>
              </div>

              <div className="rp-week-compact">
                <div className="rp-week-selector">
                  <label htmlFor="rp-select-week">
                    Pilih Minggu
                  </label>

                  <select
                    id="rp-select-week"
                    className="rp-week-select"
                    value={selectedWeek}
                    onChange={event =>
                      setSelectedWeek(Number(event.target.value))
                    }
                  >
                    {Array.from(
                      { length: TOTAL_WEEKS },
                      (_, index) => index + 1
                    ).map(week => (
                      <option key={week} value={week}>
                        Week {String(week).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rp-week-inline-score">
                  <span>
                    {activeTab === "post"
                      ? "Post-Test"
                      : "Praktik"}
                  </span>
                  <strong>{fmt(selectedData?.score)}</strong>
                </div>
              </div>

              <div className="rp-week-meta">
                {selectedData?.count
                  ? `${selectedData.count} catatan penilaian pada minggu ini`
                  : "Belum ada nilai pada minggu ini"}
              </div>

              {activeTab === "practice" &&
                selectedData?.names?.length > 0 && (
                  <div className="rp-practice-name">
                    <strong>Nama Praktik:</strong>
                    <div>{selectedData.names.join(", ")}</div>
                  </div>
                )}
            </div>

            <div className="rp-print-only">
              <PrintWeeks
                title="2. PENILAIAN POST-TEST WEEK 1–25"
                weeks={report.postWeeks}
              />

              <PrintWeeks
                title="3. PENILAIAN PRAKTIK WEEK 1–25"
                weeks={report.practiceWeeks}
              />
            </div>
          </Section>

          <div className="rp-print-bottom">
            <Section
              number="3"
              title="Samapta"
              expanded={expanded.samapta}
              onToggle={() => toggleSection("samapta")}
            >
              <div className="rp-list-row">
                <span>Nilai Samapta Terakhir</span>
                <strong>
                  {fmt(report.lastSamapta?.final)}
                </strong>
              </div>

              <div className="rp-list-row">
                <span>Tanggal Tes</span>
                <strong>
                  {dateText(report.lastSamapta?.date)}
                </strong>
              </div>
            </Section>

            <Section
              number="4"
              title="Progres SIMPER"
              expanded={expanded.simper}
              onToggle={() => toggleSection("simper")}
            >
              {simperStages.map((stage, index) => (
                <div className="rp-list-row" key={stage}>
                  <span>{stage}</span>
                  <span className={
                    report.simperData.stages[index]
                      ? "rp-ok"
                      : "rp-pending"
                  }>
                    {report.simperData.stages[index]
                      ? "Selesai"
                      : "Belum"}
                  </span>
                </div>
              ))}

              <div className="rp-list-row">
                <strong>Total Progres</strong>
                <strong>
                  {report.simperData.percent}%
                </strong>
              </div>
            </Section>
          </div>

          <Section
            number="5"
            title="Catatan & Pengesahan"
            expanded={expanded.catatan}
            onToggle={() => toggleSection("catatan")}
          >
            <p className="rp-note">
              {report.verifiedCount} dari 6 kategori
              kompetensi telah terverifikasi.
              Terdapat aktivitas pada{" "}
              {report.activeWeeks} dari 25 minggu OJT.
              Rapor ini merupakan rekap monitoring,
              bukan penetapan kelulusan akhir.
            </p>

            <div className="rp-print-signature">
              <div>
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString("id-ID")}
              </div>
              <div style={{ marginTop: 7 }}>
                Mengetahui,
              </div>
              <strong>Mentor / Penanggung Jawab</strong>

              <div className="rp-print-signature-space" />

              <div>_____________________</div>
              <strong>
                {mentor
                  ? profile.full_name || "Nama Mentor"
                  : "Nama Penanggung Jawab"}
              </strong>
            </div>
          </Section>

          <footer className="rp-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </footer>
        </article>
      </div>
    </main>
  );
}
