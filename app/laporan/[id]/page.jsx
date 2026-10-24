
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

  const [year, month, day] = parts;
  const result = new Date(Date.UTC(year, month - 1, day));

  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) {
    return null;
  }

  return result;
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
  const valid = values
    .map(numberOrNull)
    .filter(value => value !== null);

  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
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

  const startTag = "[[SIMPER_V2]]";
  const endTag = "[[/SIMPER_V2]]";
  const notes = String(record.notes || "");

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

    const others = [
      findScore("Pull-Up"),
      findScore("Push-Up"),
      findScore("Sit-Up"),
      findScore("Shuttle Run"),
    ];

    if (
      running === null ||
      others.some(value => value === null)
    ) {
      continue;
    }

    const b = average(others);

    result.push({
      date,
      a: running,
      b,
      final: (running + b) / 2,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function StatCard({ label, value, detail }) {
  return (
    <div className="rp-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Section({ title, children, expanded, onToggle, number }) {
  return (
    <section className="rp-section">
      <button
        type="button"
        className="rp-section-head rp-screen-only"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span>
          <b>{number}</b>
          {title}
        </span>
        <span className="rp-chevron">
          {expanded ? "−" : "+"}
        </span>
      </button>

      <div className="rp-section-title rp-print-only">
        {number}. {title}
      </div>

      <div className={`rp-section-body ${expanded ? "" : "rp-collapsed"}`}>
        {children}
      </div>
    </section>
  );
}

function PrintWeekTable({ title, weeks }) {
  const groups = [];

  for (let i = 0; i < TOTAL_WEEKS; i += 5) {
    groups.push(weeks.slice(i, i + 5));
  }

  return (
    <section className="rp-print-section">
      <div className="rp-section-title">{title}</div>

      <table className="rp-table rp-week-table">
        <thead>
          <tr>
            <th>GRUP</th>
            {Array.from({ length: 5 }, (_, index) => (
              <th key={index} colSpan={2}>
                MINGGU {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              {group.map(item => (
                <FragmentWeek key={item.week} item={item} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function FragmentWeek({ item }) {
  return (
    <>
      <td className="rp-week-label">
        W{String(item.week).padStart(2, "0")}
      </td>
      <td className="rp-week-value">{fmt(item.score)}</td>
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
          throw new Error("Profil tidak ditemukan.");
        }

        const mentor = profile.role === "mentor";
        const participant = ["participant", "peserta"].includes(
          profile.role
        );

        if (!mentor && !participant) {
          throw new Error("Akun tidak diizinkan.");
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
          throw new Error(
            "Anda tidak memiliki akses ke rapor peserta ini."
          );
        }

        if (!parseDate(program.start_date)) {
          throw new Error("Tanggal mulai OJT tidak valid.");
        }

        const records = await loadRecords(program.id);

        if (!active) return;

        setData({ profile, program, ...records });
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
        item => normalize(item.name) === normalize(name)
      );

      const verified = type
        ? achievements.filter(
            item =>
              item.type_code === type.code &&
              item.status === "verified" &&
              weekOf(
                item.activity_date,
                program.start_date
              ) !== null
          ).length
        : 0;

      return { name, verified };
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

    const samaptaComplete = getSamaptaResults(samapta);

    const lastSamapta = samaptaComplete.length
      ? samaptaComplete[samaptaComplete.length - 1]
      : null;

    const simperData = getSimperProgress(simper);

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
      postAverage: average(postWeeks.map(item => item.score)),
      practiceAverage: average(
        practiceWeeks.map(item => item.score)
      ),
      lastSamapta,
      simperData,
      activeWeeks: activeWeeks.size,
    };
  }, [data]);

  if (loading) {
    return <main className="rp-loading">Memuat Rapor OJT...</main>;
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
          color: #1b342a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .rp-topbar {
          background: #082731;
          color: white;
          padding: 13px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .rp-brand {
          font-size: 18px;
          font-weight: 900;
        }

        .rp-brand span {
          color: #3dd49b;
        }

        .rp-btn {
          background: #087b59;
          border: 0;
          color: white;
          border-radius: 9px;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .rp-btn:disabled {
          opacity: .55;
        }

        .rp-back {
          background: #ffffff22;
          border: 1px solid #ffffff30;
        }

        .rp-page {
          max-width: 1050px;
          margin: auto;
          padding: 14px;
        }

        .rp-toolbar {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-bottom: 12px;
        }

        .rp-paper {
          background: white;
          padding: 16px;
          border-radius: 13px;
          border: 1px solid #dbe4de;
          box-shadow: 0 5px 18px #16392910;
        }

        .rp-heading {
          background: #0d2e48;
          color: white;
          border-bottom: 4px solid #d7b667;
          padding: 14px;
          display: grid;
          grid-template-columns: 140px 1fr 80px;
          gap: 10px;
          align-items: center;
          border-radius: 7px;
        }

        .rp-heading-brand {
          font-size: 15px;
          font-weight: 900;
        }

        .rp-heading-brand small {
          display: block;
          margin-top: 4px;
          font-size: 9px;
          color: #cfe5dc;
          line-height: 1.5;
        }

        .rp-heading-title {
          text-align: center;
        }

        .rp-heading-title strong {
          display: block;
          font-size: 25px;
          letter-spacing: 1px;
        }

        .rp-heading-title small {
          display: block;
          margin-top: 4px;
          font-size: 11px;
        }

        .rp-heading-mark {
          width: 63px;
          height: 63px;
          border: 3px solid #d7b667;
          border-radius: 50%;
          display: grid;
          place-items: center;
          text-align: center;
          font-weight: 900;
          font-size: 11px;
          justify-self: end;
        }

        .rp-profile {
          border: 1px solid #dce7df;
          border-radius: 10px;
          padding: 13px;
          margin-top: 12px;
          background: #f8fbf9;
        }

        .rp-profile-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .rp-profile-name {
          font-size: 17px;
          font-weight: 900;
        }

        .rp-profile-site {
          background: #e5f4eb;
          color: #07704c;
          border-radius: 100px;
          font-weight: 800;
          font-size: 10px;
          padding: 6px 10px;
        }

        .rp-profile-sub {
          margin-top: 5px;
          color: #678174;
          font-size: 11px;
          line-height: 1.5;
        }

        .rp-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 9px;
          margin-top: 12px;
        }

        .rp-stat {
          background: white;
          border: 1px solid #dce7df;
          border-radius: 10px;
          padding: 11px 7px;
          text-align: center;
          min-width: 0;
        }

        .rp-stat span {
          display: block;
          font-size: 10px;
          color: #6b8174;
          margin-bottom: 5px;
        }

        .rp-stat strong {
          display: block;
          font-size: 23px;
          font-weight: 900;
          color: #0b7957;
        }

        .rp-stat small {
          display: block;
          color: #8a9a8e;
          font-size: 9px;
          margin-top: 4px;
        }

        .rp-section {
          margin-top: 11px;
          border: 1px solid #dae6de;
          border-radius: 10px;
          overflow: hidden;
          background: white;
        }

        .rp-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 13px;
          border: none;
          background: #f9fbf9;
          color: #183d30;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          text-align: left;
        }

        .rp-section-head > span:first-child {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .rp-section-head b {
          background: #e7f3eb;
          color: #087b59;
          border-radius: 7px;
          padding: 5px 8px;
          font-size: 11px;
        }

        .rp-chevron {
          color: #087b59;
          font-size: 22px;
          line-height: 1;
        }

        .rp-section-body {
          padding: 13px;
          border-top: 1px solid #e8eee9;
        }

        .rp-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #eaf0ec;
          padding: 4px;
          border-radius: 9px;
        }

        .rp-tab {
          border: 0;
          border-radius: 7px;
          background: transparent;
          padding: 10px;
          font-weight: 800;
          font-size: 12px;
          color: #73867b;
          cursor: pointer;
        }

        .rp-tab.active {
          background: #087b59;
          color: white;
        }

        .rp-week-control {
          display: flex;
          gap: 9px;
          align-items: center;
          justify-content: space-between;
          margin: 12px 0;
        }

        .rp-week-btn {
          background: #eaf4ed;
          color: #087b59;
          border: none;
          border-radius: 9px;
          font-size: 18px;
          font-weight: 900;
          width: 42px;
          height: 42px;
          cursor: pointer;
        }

        .rp-week-btn:disabled {
          opacity: .3;
        }

        .rp-week-center {
          text-align: center;
          flex: 1;
        }

        .rp-week-center strong {
          display: block;
          font-size: 18px;
          color: #13392c;
        }

        .rp-week-center small {
          display: block;
          margin-top: 3px;
          color: #718779;
          font-size: 10px;
        }

        .rp-week-select {
          width: 100%;
          padding: 10px;
          border: 1px solid #d8e7dd;
          border-radius: 8px;
          color: #244537;
          background: white;
          font-size: 12px;
        }

        .rp-week-result {
          padding: 14px;
          border: 1px solid #e1eae3;
          background: #f9fbf9;
          border-radius: 10px;
          margin-top: 12px;
          text-align: center;
        }

        .rp-week-result span {
          display: block;
          color: #75877b;
          font-size: 11px;
        }

        .rp-week-result strong {
          display: block;
          font-size: 34px;
          color: #087b59;
          margin: 5px 0;
        }

        .rp-week-result small {
          display: block;
          font-size: 10px;
          color: #7c9083;
          line-height: 1.5;
        }

        .rp-practice-name {
          margin-top: 9px;
          padding-top: 9px;
          border-top: 1px solid #dae5dc;
          text-align: left;
          font-size: 11px;
          color: #385c49;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .rp-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .rp-table th,
        .rp-table td {
          border: 1px solid #dce7df;
          padding: 7px 5px;
          text-align: center;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .rp-table th {
          background: #eef5f0;
          font-weight: 900;
        }

        .rp-ok {
          color: #078557;
          font-weight: 800;
        }

        .rp-pending {
          color: #a27226;
          font-weight: 700;
        }

        .rp-list-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 9px 0;
          gap: 12px;
          font-size: 12px;
          border-bottom: 1px solid #edf1ed;
        }

        .rp-list-row:last-child {
          border-bottom: none;
        }

        .rp-note {
          font-size: 11px;
          line-height: 1.65;
          color: #64786b;
          margin: 0;
        }

        .rp-small {
          font-size: 10px;
          color: #76897b;
          line-height: 1.5;
          margin: 8px 0 0;
        }

        .rp-print-only {
          display: none;
        }

        .rp-footer {
          font-size: 10px;
          color: #839487;
          text-align: center;
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #e5ece6;
        }

        .rp-loading {
          padding: 25px;
          min-height: 100vh;
          background: #eef3f0;
          color: #18382b;
          font-family: Arial, sans-serif;
        }

        .rp-error {
          padding: 12px;
          border: 1px solid #eebbbb;
          border-radius: 9px;
          background: #fff1f1;
          color: #b52c2c;
          font-size: 12px;
          margin-bottom: 12px;
        }

        @media screen {
          .rp-collapsed {
            display: none;
          }
        }

        @media (max-width: 700px) {
          .rp-topbar {
            padding: 12px;
          }

          .rp-page {
            padding: 9px;
          }

          .rp-paper {
            padding: 10px;
            border-radius: 10px;
          }

          .rp-heading {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 5px;
            padding: 12px;
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

          .rp-stat strong {
            font-size: 20px;
          }
        }

        /* CETAK RAPOR LENGKAP A4 PORTRAIT */

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

          .rp-page {
            width: 200mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rp-paper {
            width: 200mm !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .rp-heading {
            display: grid !important;
            grid-template-columns: 125px 1fr 75px !important;
            text-align: initial !important;
            padding: 6px 10px !important;
            gap: 6px !important;
          }

          .rp-heading-brand {
            font-size: 11px !important;
          }

          .rp-heading-brand small {
            display: block !important;
            font-size: 7px !important;
          }

          .rp-heading-title strong {
            font-size: 21px !important;
          }

          .rp-heading-title small {
            font-size: 9px !important;
          }

          .rp-heading-mark {
            display: grid !important;
            width: 48px !important;
            height: 48px !important;
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
            margin-top: 2px !important;
          }

          .rp-stats {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5px !important;
            margin-top: 6px !important;
          }

          .rp-stat {
            padding: 5px !important;
          }

          .rp-stat span {
            font-size: 8px !important;
            margin-bottom: 2px !important;
          }

          .rp-stat strong {
            font-size: 15px !important;
          }

          .rp-stat small {
            font-size: 7px !important;
            margin-top: 1px !important;
          }

          .rp-section {
            margin-top: 6px !important;
            border-radius: 0 !important;
            break-inside: avoid !important;
          }

          .rp-section-title {
            padding: 5px 7px !important;
            font-size: 9px !important;
            background: #153b72 !important;
            color: white !important;
            font-weight: 900 !important;
          }

          .rp-section-body,
          .rp-collapsed {
            display: block !important;
            padding: 5px !important;
            border-top: none !important;
          }

          .rp-table th,
          .rp-table td {
            padding: 3px 2px !important;
            font-size: 8px !important;
            line-height: 1.15 !important;
          }

          .rp-print-section {
            margin-top: 6px !important;
            border: 1px solid #dce7df !important;
            break-inside: avoid !important;
          }

          .rp-week-table th,
          .rp-week-table td {
            font-size: 7px !important;
            padding: 3px 1px !important;
          }

          .rp-small {
            font-size: 7px !important;
            margin: 3px 0 !important;
          }

          .rp-list-row {
            padding: 4px 0 !important;
            font-size: 8px !important;
          }

          .rp-note {
            font-size: 8px !important;
            line-height: 1.3 !important;
          }

          .rp-footer {
            font-size: 7px !important;
            margin-top: 5px !important;
            padding-top: 4px !important;
          }

          .rp-print-bottom {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 7px !important;
          }

          .rp-print-signature {
            font-size: 8px !important;
            text-align: right !important;
            padding-top: 8px !important;
          }

          .rp-print-signature-space {
            height: 22px !important;
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
            Cetak / PDF
          </button>
        </div>

        {error && (
          <div className="rp-error rp-screen-only">{error}</div>
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

              <span className="rp-profile-site">
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
              <StatCard
                label="Kompetensi"
                value={`${report.verifiedCount}/6`}
              />

              <StatCard
                label="Post-Test"
                value={fmt(report.postAverage)}
                detail="Rata-rata per minggu"
              />

              <StatCard
                label="Praktik"
                value={fmt(report.practiceAverage)}
                detail="Rata-rata per minggu"
              />
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
                <span
                  className={
                    item.verified > 0 ? "rp-ok" : "rp-pending"
                  }
                >
                  {item.verified > 0
                    ? `${item.verified} Terverifikasi`
                    : "Belum"}
                </span>
              </div>
            ))}

            <p className="rp-small">
              Kategori terpenuhi jika mempunyai minimal
              satu aktivitas terverifikasi dalam periode OJT.
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
                  className={`rp-tab ${
                    activeTab === "post" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("post")}
                  type="button"
                >
                  Post-Test
                </button>

                <button
                  className={`rp-tab ${
                    activeTab === "practice" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("practice")}
                  type="button"
                >
                  Praktik
                </button>
              </div>

              <div className="rp-week-control">
                <button
                  type="button"
                  className="rp-week-btn"
                  disabled={selectedWeek === 1}
                  onClick={() =>
                    setSelectedWeek(old => Math.max(1, old - 1))
                  }
                >
                  ‹
                </button>

                <div className="rp-week-center">
                  <strong>
                    Week {String(selectedWeek).padStart(2, "0")}
                  </strong>
                  <small>Dari 25 minggu OJT</small>
                </div>

                <button
                  type="button"
                  className="rp-week-btn"
                  disabled={selectedWeek === TOTAL_WEEKS}
                  onClick={() =>
                    setSelectedWeek(old =>
                      Math.min(TOTAL_WEEKS, old + 1)
                    )
                  }
                >
                  ›
                </button>
              </div>

              <select
                className="rp-week-select"
                value={selectedWeek}
                onChange={event =>
                  setSelectedWeek(Number(event.target.value))
                }
                aria-label="Pilih minggu OJT"
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

              <div className="rp-week-result">
                <span>
                  {activeTab === "post"
                    ? "Nilai Post-Test"
                    : "Nilai Praktik"}
                </span>

                <strong>{fmt(selectedData?.score)}</strong>

                <small>
                  {selectedData?.count
                    ? `${selectedData.count} catatan penilaian`
                    : "Belum ada nilai pada minggu ini"}
                </small>

                {activeTab === "practice" &&
                  selectedData?.names?.length > 0 && (
                    <div className="rp-practice-name">
                      <strong>Nama Praktik:</strong>
                      <div>
                        {selectedData.names.join(", ")}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            <div className="rp-print-only">
              <PrintWeekTable
                title="2. PENILAIAN POST-TEST WEEK 1–25"
                weeks={report.postWeeks}
              />

              <PrintWeekTable
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
                <strong>{fmt(report.lastSamapta?.final)}</strong>
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
                  <span
                    className={
                      report.simperData.stages[index]
                        ? "rp-ok"
                        : "rp-pending"
                    }
                  >
                    {report.simperData.stages[index]
                      ? "Selesai"
                      : "Belum"}
                  </span>
                </div>
              ))}

              <div className="rp-list-row">
                <strong>Total Progres</strong>
                <strong>{report.simperData.percent}%</strong>
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
              Terdapat {report.verifiedCount} dari 6 kategori
              kompetensi yang terverifikasi. Rapor ini merupakan
              ringkasan otomatis data OJT dan bukan keputusan
              kelulusan akhir. Nilai serta predikat kelulusan
              resmi mengikuti ketentuan perusahaan.
            </p>

            <div className="rp-print-signature">
              <p className="rp-note" style={{ marginTop: 10 }}>
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString("id-ID")}
              </p>

              <strong>Mengetahui,</strong>
              <div>Mentor / Penanggung Jawab</div>

              <div className="rp-print-signature-space" />

              <div>______________________</div>
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
