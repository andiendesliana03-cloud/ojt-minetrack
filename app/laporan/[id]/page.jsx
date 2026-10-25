
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const WEEKS = 25;

const TARGETS = [
  { key: "fisik", label: "Fisik", target: 25, total: 625, aliases: ["Fisik"] },
  { key: "training", label: "Internal Training", target: 4, total: 100, aliases: ["Internal Training", "Training"] },
  { key: "coaching", label: "Coaching", target: 1, total: 25, aliases: ["Coaching"] },
  { key: "sosialisasi", label: "Sosialisasi", target: 3, total: 75, aliases: ["Sosialisasi"] },
  { key: "orientasi", label: "Orientasi Area", target: 2, total: 50, aliases: ["Orientasi Area", "Orientasi"] },
  { key: "hazard", label: "Hazard", target: 2, total: 50, aliases: ["Hazard"] },
];

const SAMAPTA_TARGETS = [
  { label: "Lari", aliases: ["Lari 12 Menit", "Lari"], value: 2600, unit: "m", rule: "min" },
  { label: "Pull Up", aliases: ["Pull-Up", "Pull Up"], value: 17, unit: "x", rule: "min" },
  { label: "Push Up", aliases: ["Push-Up", "Push Up"], value: 38, unit: "x", rule: "min" },
  { label: "Sit Up", aliases: ["Sit-Up", "Sit Up"], value: 45, unit: "x", rule: "min" },
  { label: "Shuttle Run", aliases: ["Shuttle Run"], value: 15.08, unit: "detik", rule: "max" },
];

const norm = value =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function numeric(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  const valid = values.map(numeric).filter(x => x !== null);
  return valid.length
    ? valid.reduce((sum, x) => sum + x, 0) / valid.length
    : null;
}

function nfmt(value) {
  return value == null
    ? "—"
    : Number(value).toLocaleString("id-ID", {
        maximumFractionDigits: 2,
      });
}

function parseDay(value) {
  const parts = String(value || "")
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(x => !Number.isInteger(x))
  ) return null;

  const date = new Date(
    Date.UTC(parts[0], parts[1] - 1, parts[2])
  );

  return (
    date.getUTCFullYear() === parts[0] &&
    date.getUTCMonth() + 1 === parts[1] &&
    date.getUTCDate() === parts[2]
  ) ? date : null;
}

function displayDate(value) {
  const date = parseDay(value);
  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function weekFrom(value, startValue) {
  const date = parseDay(value);
  const start = parseDay(startValue);
  if (!date || !start) return null;

  const week = Math.floor(
    (date.getTime() - start.getTime()) / 604800000
  ) + 1;

  return week >= 1 && week <= WEEKS ? week : null;
}

function weeklyData(rows, start, dateField) {
  return Array.from({ length: WEEKS }, (_, index) => {
    const items = rows.filter(
      row => weekFrom(row[dateField], start) === index + 1
    );

    return {
      week: index + 1,
      count: items.length,
      average: mean(items.map(row => row.score)),
      names: [
        ...new Set(
          items.map(row => row.practice_name).filter(Boolean)
        ),
      ],
    };
  });
}

function getSimper(record) {
  if (!record) return null;

  let metadata = null;
  const text = String(record.notes || "");
  const opening = "[[SIMPER_V2]]";
  const closing = "[[/SIMPER_V2]]";
  const start = text.lastIndexOf(opening);
  const end = text.lastIndexOf(closing);

  if (start >= 0 && end > start) {
    try {
      metadata = JSON.parse(
        text.slice(start + opening.length, end)
      );
    } catch {
      metadata = null;
    }
  }

  return {
    kmkop:
      record.administration_status === "passed"
        ? "Administrasi selesai; verifikasi KMKOP diperlukan"
        : "Belum terverifikasi",
    praktik:
      record.practice_status === "passed"
        ? "Lulus praktik"
        : "Belum terverifikasi",
    orientasi:
      metadata?.orientation_status === "completed"
        ? "Selesai"
        : "Belum terverifikasi",
    status: record.status || "—",
  };
}

function buildSamapta(records) {
  const groups = new Map();

  for (const row of records) {
    if (!row.test_date) continue;

    if (!groups.has(row.test_date)) {
      groups.set(row.test_date, []);
    }

    groups.get(row.test_date).push(row);
  }

  const sorted = [...groups.entries()].sort(
    (a, b) => a[0].localeCompare(b[0])
  );

  return sorted.map(([date, items], index) => {
    const values = SAMAPTA_TARGETS.map(target => {
      const record = items.find(row =>
        target.aliases.some(
          alias => norm(alias) === norm(row.test_type)
        )
      );

      // Gunakan hasil pengukuran fisik,
      // bukan nilai konversi Samapta.
      const actual = numeric(record?.result_value);

      const met =
        actual === null
          ? null
          : target.rule === "min"
          ? actual >= target.value
          : actual <= target.value;

      return { ...target, actual, met };
    });

    return {
      date,
      index: index + 1,
      values,
      complete: values.every(value => value.met !== null),
      achieved: values.every(value => value.met === true),
    };
  });
}

function Accordion({
  id,
  number,
  title,
  open,
  onToggle,
  children,
}) {
  return (
    <section className="r-section">
      <button
        type="button"
        className="r-section-toggle screen-only"
        onClick={() => onToggle(id)}
        aria-expanded={open}
      >
        <span>
          <b>{number}</b> {title}
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>

      <div className="print-only r-section-title">
        {number}. {title}
      </div>

      <div className={`r-section-content ${
        open ? "" : "collapsed"
      }`}>
        {children}
      </div>
    </section>
  );
}

function PrintWeekly({ title, values, field = "count" }) {
  return (
    <div className="print-only r-print-week">
      <div className="r-section-title">{title}</div>

      <table className="r-table">
        <thead>
          <tr>
            {["Minggu", "1", "2", "3", "4", "5"].map(text => (
              <th key={text}>{text}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, index) => (
            <tr key={index}>
              <th>
                Week {index * 5 + 1}–{index * 5 + 5}
              </th>

              {values
                .slice(index * 5, index * 5 + 5)
                .map(item => (
                  <td key={item.week}>
                    {nfmt(item[field])}
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LaporanOJT() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [week, setWeek] = useState(1);

  const [open, setOpen] = useState({
    monitoring: true,
    teori: false,
    samapta: false,
    simper: false,
    notes: false,
  });

  const toggle = id => {
    setOpen(previous => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  async function recordsFor(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select("id,type_code,status,activity_date,description")
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
        .select("id,test_date,test_type,score,result_value")
        .eq("program_id", id),

      supabase
        .from("simper_records")
        .select(
          "id,status,administration_status,practice_status,notes"
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
      tests: results[2].data || [],
      practice: results[3].data || [],
      samapta: results[4].data || [],
      simper: results[5].data || null,
    };
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        if (!programId) {
          throw new Error("ID program OJT tidak tersedia.");
        }

        const {
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,role,full_name")
          .eq("id", auth.user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Profil tidak ditemukan.");
        }

        const mentor = profile.role === "mentor";
        const participant = ["participant", "peserta"].includes(
          profile.role
        );

        if (!mentor && !participant) {
          throw new Error("Akses ditolak.");
        }

        let request = supabase
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
          request = request.eq(
            "participant_id",
            auth.user.id
          );
        }

        const {
          data: program,
          error: programError,
        } = await request.single();

        if (programError || !program) {
          throw new Error(
            "Program tidak ditemukan atau akses ditolak."
          );
        }

        if (!parseDay(program.start_date)) {
          throw new Error("Tanggal mulai OJT tidak valid.");
        }

        const records = await recordsFor(programId);

        if (mounted) {
          setBundle({
            profile,
            program,
            ...records,
          });
        }
      } catch (error) {
        if (mounted) {
          setError(
            error?.message || "Tidak dapat membuka rapor."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (!bundle || updating) return;

    setUpdating(true);
    setError("");

    try {
      const records = await recordsFor(
        bundle.program.id
      );

      setBundle(previous => ({
        ...previous,
        ...records,
      }));
    } catch (error) {
      setError(
        error?.message || "Gagal memuat pembaruan."
      );
    } finally {
      setUpdating(false);
    }
  }

  const report = useMemo(() => {
    if (!bundle) return null;

    const start = bundle.program.start_date;

    const weeklyActivities = TARGETS.map(target => {
      const matchingCodes = bundle.types
        .filter(type =>
          target.aliases.some(
            alias =>
              norm(type.name) === norm(alias) ||
              norm(type.code) === norm(alias)
          )
        )
        .map(type => type.code);

      const verified = bundle.achievements.filter(
        item =>
          matchingCodes.includes(item.type_code) &&
          item.status === "verified"
      );

      const weeks = Array.from(
        { length: WEEKS },
        (_, index) => ({
          week: index + 1,
          count: verified.filter(
            item =>
              weekFrom(item.activity_date, start) ===
              index + 1
          ).length,
        })
      );

      return {
        ...target,
        weeks,
        mapped: matchingCodes.length > 0,
        totalRecords: weeks.reduce(
          (sum, item) => sum + item.count,
          0
        ),
      };
    });

    const theory = weeklyData(
      bundle.tests,
      start,
      "test_date"
    );

    const practice = weeklyData(
      bundle.practice,
      start,
      "practice_date"
    );

    const samapta = buildSamapta(
      bundle.samapta
    );

    return {
      weeklyActivities,
      theory,
      practice,
      samapta,
      simper: getSimper(bundle.simper),
      theoryAverage: mean(
        theory.map(item => item.average)
      ),
      practiceAverage: mean(
        practice.map(item => item.average)
      ),
    };
  }, [bundle]);

  if (loading) {
    return (
      <main style={{ padding: 24 }}>
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!bundle || !report) {
    return (
      <main style={{ padding: 24 }}>
        <h2>Rapor tidak dapat ditampilkan</h2>
        <p>{error}</p>
        <button onClick={() => router.back()}>
          Kembali
        </button>
      </main>
    );
  }

  const { program, profile } = bundle;
  const mentor = profile.role === "mentor";

  const participantName =
    program.peserta?.full_name || "Peserta OJT";

  const currentTheory =
    report.theory[week - 1];

  const currentPractice =
    report.practice[week - 1];

  const back = mentor
    ? `/peserta/${program.id}`
    : "/dashboard-peserta";

  const latestSamapta =
    report.samapta.length > 0
      ? report.samapta[report.samapta.length - 1]
      : null;

  return (
    <main className="r-root">
      <style>{`
        .r-root, .r-root * {
          box-sizing: border-box;
        }

        .r-root {
          min-height: 100vh;
          background: #edf3ef;
          color: #203a30;
          font-family: Arial, Helvetica, sans-serif;
          overflow-x: clip;
        }

        .r-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          background: #092730;
          padding: 12px;
          color: white;
        }

        .r-brand {
          font-size: 17px;
          font-weight: 900;
        }

        .r-brand em {
          color: #31cb94;
          font-style: normal;
        }

        .r-button {
          border: 0;
          border-radius: 9px;
          background: #087d58;
          color: white;
          padding: 11px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          min-width: 0;
        }

        .r-button:disabled {
          opacity: .5;
        }

        .r-back {
          background: #ffffff22;
          border: 1px solid #ffffff44;
        }

        .r-wrap {
          max-width: 980px;
          margin: auto;
          padding: 10px;
        }

        .r-tools {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 9px;
        }

        .r-tools button {
          width: 100%;
        }

        .r-paper {
          background: white;
          border: 1px solid #dce7de;
          border-radius: 12px;
          padding: 10px;
        }

        .r-head {
          background: #0d3049;
          color: white;
          border-bottom: 4px solid #d5b66f;
          border-radius: 7px;
          padding: 13px;
          text-align: center;
        }

        .r-head strong {
          display: block;
          font-size: 22px;
        }

        .r-head small {
          font-size: 10px;
        }

        .r-company {
          display: block;
          margin-top: 4px;
          font-size: 10px;
          letter-spacing: 1px;
        }

        .r-profile {
          background: #f7faf8;
          border: 1px solid #dfe8e0;
          border-radius: 9px;
          margin-top: 9px;
          padding: 12px;
        }

        .r-name {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 16px;
          font-weight: 900;
        }

        .r-site {
          background: #e0f3e9;
          color: #076b4b;
          border-radius: 30px;
          padding: 5px 9px;
          font-size: 10px;
        }

        .r-muted {
          color: #718678;
          font-size: 11px;
          line-height: 1.5;
          margin-top: 5px;
        }

        .r-stats {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 7px;
          margin-top: 9px;
        }

        .r-stat {
          padding: 9px 4px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid #deeadf;
          background: white;
        }

        .r-stat span {
          display: block;
          font-size: 10px;
          color: #6f8577;
        }

        .r-stat strong {
          display: block;
          margin-top: 3px;
          color: #087e58;
          font-size: 19px;
        }

        .r-section {
          margin-top: 8px;
          border: 1px solid #dce8e0;
          border-radius: 9px;
          overflow: hidden;
          background: white;
        }

        .r-section-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          border: 0;
          background: #f7faf7;
          padding: 11px;
          color: #1c4937;
          font-size: 12px;
          font-weight: 800;
          text-align: left;
          cursor: pointer;
        }

        .r-section-toggle b {
          display: inline-block;
          background: #e3f3e9;
          padding: 4px 8px;
          border-radius: 6px;
          margin-right: 6px;
          color: #087e58;
        }

        .r-section-content {
          padding: 10px;
          border-top: 1px solid #ebefeb;
        }

        .r-week-select {
          width: 100%;
          padding: 10px;
          border: 1px solid #d9e7dd;
          border-radius: 8px;
          background: white;
          color: #193c2c;
          font-size: 13px;
        }

        .r-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-bottom: 1px solid #edf1ed;
          padding: 8px 0;
          font-size: 11px;
        }

        .r-row:last-child {
          border-bottom: 0;
        }

        .r-note {
          margin: 6px 0;
          font-size: 10px;
          line-height: 1.5;
          color: #64776d;
        }

        .r-mini {
          background: #f4f9f5;
          padding: 9px;
          border-radius: 8px;
          font-size: 11px;
          margin-top: 9px;
        }

        .r-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 9px;
        }

        .r-tile {
          border: 1px solid #deebe2;
          border-radius: 8px;
          text-align: center;
          padding: 9px 6px;
        }

        .r-tile small {
          display: block;
          color: #718678;
          font-size: 10px;
        }

        .r-tile strong {
          font-size: 19px;
          color: #087e58;
        }

        .r-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .r-table th,
        .r-table td {
          border: 1px solid #dce6dd;
          padding: 4px 2px;
          font-size: 10px;
          text-align: center;
          overflow-wrap: anywhere;
        }

        .r-table th {
          background: #f1f5f1;
        }

        .r-section-title {
          background: #123b73;
          color: white;
          padding: 6px 8px;
          font-weight: 900;
          font-size: 11px;
        }

        .r-grid-samapta {
          overflow-x: auto;
        }

        .r-grid-samapta .r-table {
          min-width: 480px;
        }

        .r-sign {
          text-align: right;
          margin-top: 12px;
          font-size: 10px;
        }

        .r-sign-space {
          height: 35px;
        }

        .r-footer {
          text-align: center;
          border-top: 1px solid #e3eae4;
          padding-top: 8px;
          margin-top: 13px;
          font-size: 9px;
          color: #7d9283;
        }

        .print-only {
          display: none;
        }

        .r-error {
          background: #fff0f0;
          color: #ae2626;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 10px;
          font-size: 12px;
        }

        @media screen {
          .collapsed {
            display: none;
          }
        }

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

          .screen-only,
          .r-top,
          .r-tools {
            display: none !important;
          }

          .print-only {
            display: block !important;
          }

          .r-root {
            min-height: 0 !important;
            overflow: visible !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .r-wrap,
          .r-paper {
            width: 200mm !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .r-head {
            padding: 5px !important;
          }

          .r-head strong {
            font-size: 18px !important;
          }

          .r-head small,
          .r-company {
            font-size: 8px !important;
          }

          .r-profile {
            padding: 5px !important;
            margin-top: 4px !important;
          }

          .r-name {
            font-size: 12px !important;
          }

          .r-muted {
            font-size: 8px !important;
          }

          .r-stats {
            margin-top: 4px !important;
          }

          .r-stat {
            padding: 4px !important;
          }

          .r-stat span {
            font-size: 7px !important;
          }

          .r-stat strong {
            font-size: 13px !important;
          }

          .r-section {
            margin-top: 5px !important;
            border-radius: 0 !important;
            break-inside: avoid;
          }

          .r-section-content,
          .collapsed {
            display: block !important;
            padding: 5px !important;
          }

          .r-section-title {
            font-size: 9px !important;
            padding: 4px !important;
          }

          .r-note {
            font-size: 7px !important;
            margin: 3px 0 !important;
          }

          .r-row {
            font-size: 8px !important;
            padding: 3px 0 !important;
          }

          .r-table th,
          .r-table td {
            font-size: 7px !important;
            padding: 2px 1px !important;
          }

          .r-two {
            gap: 5px !important;
            margin-top: 3px !important;
          }

          .r-tile {
            padding: 4px !important;
          }

          .r-tile small {
            font-size: 7px !important;
          }

          .r-tile strong {
            font-size: 12px !important;
          }

          .r-grid-samapta {
            overflow: visible !important;
          }

          .r-grid-samapta .r-table {
            min-width: 0 !important;
          }

          .r-print-week {
            margin-top: 4px !important;
            break-inside: avoid;
          }

          .r-sign {
            font-size: 8px !important;
            margin-top: 4px !important;
          }

          .r-sign-space {
            height: 18px !important;
          }

          .r-footer {
            font-size: 7px !important;
            padding-top: 4px !important;
            margin-top: 4px !important;
          }
        }
      `}</style>

      <div className="r-top screen-only">
        <div className="r-brand">
          OJT <em>MineTrack</em>
        </div>

        <button
          className="r-button r-back"
          onClick={() => router.push(back)}
        >
          {mentor ? "← Detail Peserta" : "← Dashboard"}
        </button>
      </div>

      <div className="r-wrap">
        <div className="r-tools screen-only">
          <button
            className="r-button"
            disabled={updating}
            onClick={refresh}
          >
            {updating ? "Memuat..." : "Refresh"}
          </button>

          <button
            className="r-button"
            onClick={() => window.print()}
          >
            Cetak / PDF
          </button>
        </div>

        {error && (
          <div className="r-error screen-only">
            {error}
          </div>
        )}

        <article className="r-paper">
          <div className="r-head">
            <strong>RAPOR OJT</strong>
            <small>ON THE JOB TRAINING</small>
            <span className="r-company">
              PT BERAU COAL · ERG
            </span>
          </div>

          <div className="r-profile">
            <div className="r-name">
              <span>{participantName}</span>
              <span className="r-site">
                {program.site || "—"}
              </span>
            </div>

            <div className="r-muted">
              {program.peserta?.department || "Departemen —"}
              {" · "}
              {displayDate(program.start_date)}
              {" – "}
              {displayDate(program.end_date)}
            </div>

            <div className="r-stats">
              <div className="r-stat">
                <span>Minggu OJT</span>
                <strong>25</strong>
              </div>

              <div className="r-stat">
                <span>Rata-rata Teori</span>
                <strong>
                  {nfmt(report.theoryAverage)}
                </strong>
              </div>

              <div className="r-stat">
                <span>Rata-rata Praktik</span>
                <strong>
                  {nfmt(report.practiceAverage)}
                </strong>
              </div>
            </div>
          </div>

          <Accordion
            id="monitoring"
            number="1"
            title="Monitoring Target Mingguan"
            open={open.monitoring}
            onToggle={toggle}
          >
            <div className="screen-only">
              <select
                className="r-week-select"
                value={week}
                onChange={event =>
                  setWeek(Number(event.target.value))
                }
                aria-label="Pilih minggu"
              >
                {Array.from(
                  { length: WEEKS },
                  (_, index) => (
                    <option
                      value={index + 1}
                      key={index}
                    >
                      Week {String(index + 1).padStart(2, "0")}
                    </option>
                  )
                )}
              </select>

              <p className="r-note">
                Target, jumlah catatan terverifikasi,
                dan target kumulatif hingga Week {week}.
              </p>

              <table className="r-table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th>Target</th>
                    <th>Catatan*</th>
                    <th>Kumulatif Target</th>
                  </tr>
                </thead>

                <tbody>
                  {report.weeklyActivities.map(item => (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td>{item.target}</td>
                      <td>
                        {item.mapped
                          ? item.weeks[week - 1].count
                          : "—"}
                      </td>
                      <td>{item.target * week}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="r-two">
                <div className="r-tile">
                  <small>Teori Week {week}</small>
                  <strong>
                    {nfmt(currentTheory.average)}
                  </strong>
                </div>

                <div className="r-tile">
                  <small>Praktik Week {week}</small>
                  <strong>
                    {nfmt(currentPractice.average)}
                  </strong>
                </div>
              </div>

              {currentPractice.names.length > 0 && (
                <p className="r-note">
                  <b>Materi Praktik:</b>{" "}
                  {currentPractice.names.join(", ")}
                </p>
              )}
            </div>

            <p className="r-note">
              *Catatan menunjukkan jumlah aktivitas
              berstatus verified, bukan otomatis jumlah
              poin fisik atau realisasi target. Status
              tercapai belum ditentukan sampai satuan
              pencapaian dikonfirmasi.
            </p>

            <div className="print-only">
              <table className="r-table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th>Target / Minggu</th>
                    <th>Target 25 Minggu</th>
                    <th>Catatan Verified</th>
                  </tr>
                </thead>

                <tbody>
                  {report.weeklyActivities.map(item => (
                    <tr key={item.key}>
                      <td>{item.label}</td>
                      <td>{item.target}</td>
                      <td>{item.total}</td>
                      <td>
                        {item.mapped
                          ? item.totalRecords
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <table className="r-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Fisik</th>
                    <th>Training</th>
                    <th>Coaching</th>
                    <th>Sosialisasi</th>
                    <th>Orientasi</th>
                    <th>Hazard</th>
                  </tr>
                </thead>

                <tbody>
                  {Array.from(
                    { length: WEEKS },
                    (_, index) => (
                      <tr key={index}>
                        <th>{index + 1}</th>

                        {report.weeklyActivities.map(item => (
                          <td key={item.key}>
                            {item.mapped
                              ? item.weeks[index].count
                              : "—"}
                          </td>
                        ))}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </Accordion>

          <Accordion
            id="teori"
            number="2"
            title="Penilaian Teori dan Praktik"
            open={open.teori}
            onToggle={toggle}
          >
            <p className="r-note">
              Penilaian mengikuti materi dan jadwal OJT.
              Standar nilai kelulusan numerik tidak
              ditetapkan dalam dokumen acuan.
            </p>

            <div className="screen-only">
              <div className="r-two">
                <div className="r-tile">
                  <small>Teori — Week {week}</small>
                  <strong>
                    {nfmt(currentTheory.average)}
                  </strong>
                </div>

                <div className="r-tile">
                  <small>Praktik — Week {week}</small>
                  <strong>
                    {nfmt(currentPractice.average)}
                  </strong>
                </div>
              </div>

              <p className="r-note">
                Pilih Week pada bagian Monitoring Target
                Mingguan untuk melihat minggu lainnya.
              </p>
            </div>

            <PrintWeekly
              title="REKAP NILAI TEORI WEEK 1–25"
              values={report.theory}
              field="average"
            />

            <PrintWeekly
              title="REKAP NILAI PRAKTIK WEEK 1–25"
              values={report.practice}
              field="average"
            />
          </Accordion>

          <Accordion
            id="samapta"
            number="3"
            title="Samapta — Tiga Periode"
            open={open.samapta}
            onToggle={toggle}
          >
            <p className="r-note">
              Periode 1: baseline; Periode 2: evaluasi
              progres; Periode 3: evaluasi akhir.
              Target akhir dibandingkan dengan hasil
              pengukuran fisik, bukan skor konversi.
            </p>

            <div className="r-grid-samapta">
              <table className="r-table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th>Target Akhir</th>
                    <th>P1</th>
                    <th>P2</th>
                    <th>P3</th>
                  </tr>
                </thead>

                <tbody>
                  {SAMAPTA_TARGETS.map((target, index) => (
                    <tr key={target.label}>
                      <td>{target.label}</td>
                      <td>
                        {target.rule === "max" ? "≤" : "≥"}
                        {nfmt(target.value)} {target.unit}
                      </td>

                      {[0, 1, 2].map(period => (
                        <td key={period}>
                          {nfmt(
                            report.samapta[period]
                              ?.values[index]?.actual
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="r-note">
              Hasil diurutkan berdasarkan tanggal dan
              tiga periode pertama ditampilkan. Jika
              hasil pengukuran belum tersimpan pada
              result_value, nilainya ditampilkan —.
            </p>

            <div className="r-mini">
              Evaluasi akhir:{" "}
              <b>
                {report.samapta.length < 3
                  ? "Belum ada tiga periode tercatat"
                  : report.samapta[2].complete
                  ? report.samapta[2].achieved
                    ? "Target Samapta tercapai"
                    : "Target Samapta belum tercapai"
                  : "Data pengukuran belum lengkap"}
              </b>
            </div>

            {latestSamapta && (
              <p className="r-note">
                Tes terakhir tercatat:{" "}
                {displayDate(latestSamapta.date)}.
                Penomoran periode mengikuti urutan
                tanggal dan perlu diperiksa jika
                terdapat tes ulang.
              </p>
            )}
          </Accordion>

          <Accordion
            id="simper"
            number="4"
            title="Persyaratan SIMPER"
            open={open.simper}
            onToggle={toggle}
          >
            <p className="r-note">
              Dokumen mensyaratkan KMKOP tervalidasi,
              Praktik tervalidasi, dan Orientasi Area
              selesai serta tervalidasi.
            </p>

            <div className="r-row">
              <span>KMKOP</span>
              <b>
                {report.simper?.kmkop ||
                  "Belum ada data"}
              </b>
            </div>

            <div className="r-row">
              <span>Praktik</span>
              <b>
                {report.simper?.praktik ||
                  "Belum ada data"}
              </b>
            </div>

            <div className="r-row">
              <span>Orientasi Area</span>
              <b>
                {report.simper?.orientasi ||
                  "Belum ada data"}
              </b>
            </div>

            <p className="r-note">
              Status kelulusan SIMPER belum ditentukan
              otomatis karena pemetaan validasi KMKOP
              perlu dipastikan sesuai data sistem.
              Status basis data:{" "}
              {report.simper?.status || "—"}.
            </p>
          </Accordion>

          <Accordion
            id="notes"
            number="5"
            title="Catatan dan Pengesahan"
            open={open.notes}
            onToggle={toggle}
          >
            <p className="r-note">
              Monitoring dilaksanakan setiap minggu
              dengan membandingkan target dan data
              pencapaian. Nilai yang belum tersedia
              ditampilkan —. Ketentuan kelulusan
              teori, praktik, dan validasi KMKOP
              mengikuti standar program OJT.
            </p>

            <div className="r-sign">
              <div>Mengetahui,</div>
              <b>Mentor / Penanggung Jawab</b>
              <div className="r-sign-space" />
              _________________________
              <div>
                {mentor
                  ? profile.full_name || "Nama Mentor"
                  : "Nama Penanggung Jawab"}
              </div>
            </div>
          </Accordion>

          <div className="r-footer">
            OJT MineTrack v2.0 · Emergency Response Group
            · PT Berau Coal
          </div>
        </article>
      </div>
    </main>
  );
}
