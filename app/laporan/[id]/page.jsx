
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  { key: "Fisik", label: "Fisik", target: 25, unit: "km" },
  { key: "Training", label: "Internal Training", target: 4, unit: "kegiatan" },
  { key: "Coaching", label: "Coaching", target: 1, unit: "kegiatan" },
  { key: "Sosialisasi", label: "Sosialisasi", target: 3, unit: "kegiatan" },
  { key: "Orientasi Area", label: "Orientasi Area", target: 2, unit: "kegiatan" },
  { key: "Hazard", label: "Hazard", target: 2, unit: "kegiatan" },
];

const SAMAPTA_TARGETS = [
  {
    name: "Lari 12 Menit",
    aliases: ["lari12menit", "lari"],
    target: 2600,
    unit: "m",
    lowerBetter: false,
  },
  {
    name: "Pull-Up",
    aliases: ["pullup"],
    target: 17,
    unit: "kali",
    lowerBetter: false,
  },
  {
    name: "Push-Up",
    aliases: ["pushup"],
    target: 38,
    unit: "kali",
    lowerBetter: false,
  },
  {
    name: "Sit-Up",
    aliases: ["situp"],
    target: 45,
    unit: "kali",
    lowerBetter: false,
  },
  {
    name: "Shuttle Run",
    aliases: ["shuttlerun"],
    target: 15.08,
    unit: "detik",
    lowerBetter: true,
  },
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(value, digits = 0) {
  if (value === null || value === undefined) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some(n => !Number.isInteger(n))
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

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
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

function weekDateRange(startValue, week) {
  const start = parseDate(startValue);
  if (!start) return "—";

  const first = new Date(
    start.getTime() +
    (week - 1) * 7 * 86400000
  );

  const last = new Date(
    first.getTime() + 6 * 86400000
  );

  const toDateString = date =>
    new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);

  return (
    `${toDateString(first)} – ${toDateString(last)}`
  );
}

function average(records) {
  const values = records
    .map(item => numberOrNull(item.score))
    .filter(value => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function readSimperMetadata(notes) {
  const text = String(notes || "");

  const startTag = "[[SIMPER_V2]]";
  const endTag = "[[/SIMPER_V2]]";

  const start = text.lastIndexOf(startTag);
  const end = text.lastIndexOf(endTag);

  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(
      text.slice(start + startTag.length, end)
    );

    return parsed?.version === 2
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function buildSamaptaSessions(records) {
  const dates = [
    ...new Set(
      records.map(item => item.test_date).filter(Boolean)
    ),
  ].sort();

  return dates.map(date => {
    const entries = records.filter(
      item => item.test_date === date
    );

    const metrics = SAMAPTA_TARGETS.map(target => {
      const matching = entries.find(
        item =>
          target.aliases.includes(
            normalize(item.test_type)
          )
      );

      const actual = numberOrNull(
        matching?.result_value
      );

      let passed = null;

      if (actual !== null) {
        passed = target.lowerBetter
          ? actual <= target.target
          : actual >= target.target;
      }

      return {
        ...target,
        actual,
        score: numberOrNull(matching?.score),
        passed,
      };
    });

    return {
      date,
      metrics,
      complete: metrics.every(
        metric => metric.actual !== null
      ),
      averageScore: average(entries),
    };
  });
}

function Status({ achieved, hasData = true }) {
  if (!hasData) {
    return (
      <span className="rp-status rp-neutral">
        Belum ada data
      </span>
    );
  }

  return achieved ? (
    <span className="rp-status rp-success">
      Tercapai
    </span>
  ) : (
    <span className="rp-status rp-warning">
      Belum tercapai
    </span>
  );
}

function WeekSelect({
  value,
  onChange,
  minWeek = 1,
}) {
  const weeks = Array.from(
    { length: TOTAL_WEEKS - minWeek + 1 },
    (_, index) => minWeek + index
  );

  return (
    <select
      className="rp-select"
      value={value}
      onChange={event =>
        onChange(Number(event.target.value))
      }
    >
      {weeks.map(week => (
        <option key={week} value={week}>
          Week {pad(week)}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="rp-section-title">
      {children}
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="rp-empty-cell"
      >
        {text}
      </td>
    </tr>
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

  // MODE PEMILIHAN PERIODE RAPOR
  const [mode, setMode] = useState("range");

  // SATU MINGGU
  const [singleWeek, setSingleWeek] = useState(3);

  // RENTANG MINGGU
  const [startWeek, setStartWeek] = useState(3);
  const [endWeek, setEndWeek] = useState(7);

  // MINGGU TERTENTU
  const [customWeeks, setCustomWeeks] = useState([
    1, 3, 5,
  ]);

  // PRATINJAU
  const [showPreview, setShowPreview] = useState(true);

  async function fetchRecords(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description,distance_km,status"
        )
        .eq("program_id", id)
        .order("activity_date"),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes")
        .eq("program_id", id)
        .order("test_date"),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,practice_date,practice_name,score"
        )
        .eq("program_id", id)
        .order("practice_date"),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,result_value,score,outcome"
        )
        .eq("program_id", id)
        .order("test_date"),

      supabase
        .from("simper_records")
        .select(
          "id,administration_status,theory_status,practice_status,status,graduation_date,notes"
        )
        .eq("program_id", id)
        .maybeSingle(),
    ]);

    const labels = [
      "Kategori",
      "Pencapaian",
      "Teori",
      "Praktik",
      "Samapta",
      "SIMPER",
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    });

    return {
      types: results[0].data || [],
      achievements: results[1].data || [],
      theory: results[2].data || [],
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
          data: auth,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !auth?.user) {
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
          throw new Error(
            "Profil pengguna tidak ditemukan."
          );
        }

        const isMentor =
          profile.role === "mentor";

        const isParticipant = [
          "participant",
          "peserta",
        ].includes(profile.role);

        if (!isMentor && !isParticipant) {
          throw new Error(
            "Akun tidak mempunyai akses rapor."
          );
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

        if (isParticipant) {
          query = query.eq(
            "participant_id",
            auth.user.id
          );
        }

        const {
          data: program,
          error: programError,
        } = await query.single();

        if (programError || !program) {
          throw new Error(
            "Program tidak ditemukan atau akses ditolak."
          );
        }

        if (!parseDate(program.start_date)) {
          throw new Error(
            "Tanggal mulai OJT tidak valid."
          );
        }

        const records = await fetchRecords(programId);

        if (!active) return;

        setData({
          profile,
          program,
          ...records,
        });
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat rapor."
          );
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

  async function refreshData() {
    if (!data || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const records = await fetchRecords(
        data.program.id
      );

      setData(old => ({
        ...old,
        ...records,
      }));
    } catch (err) {
      setError(
        err.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const selectedWeeks = useMemo(() => {
    if (mode === "single") {
      return [singleWeek];
    }

    if (mode === "range") {
      const count = Math.max(
        0,
        endWeek - startWeek + 1
      );

      return Array.from(
        { length: count },
        (_, index) => startWeek + index
      );
    }

    return [
      ...new Set(customWeeks),
    ]
      .filter(
        week =>
          week >= 1 &&
          week <= TOTAL_WEEKS
      )
      .sort((a, b) => a - b);
  }, [
    mode,
    singleWeek,
    startWeek,
    endWeek,
    customWeeks,
  ]);

  function toggleCustomWeek(week) {
    setCustomWeeks(old =>
      old.includes(week)
        ? old.filter(item => item !== week)
        : [...old, week]
    );
  }

  const report = useMemo(() => {
    if (!data) return null;

    const {
      program,
      types,
      achievements,
      theory,
      practice,
      samapta,
      simper,
    } = data;

    const typeCodes = new Map(
      types.map(item => [
        normalize(item.name),
        item.code,
      ])
    );

    function getTypeCode(name) {
      if (name === "Training") {
        return (
          typeCodes.get("training") ||
          typeCodes.get("internaltraining")
        );
      }

      return typeCodes.get(normalize(name));
    }

    const allSamaptaSessions =
      buildSamaptaSessions(samapta);

    const weekly = selectedWeeks.map(week => {
      const weekAchievements = achievements.filter(
        item =>
          weekOf(
            item.activity_date,
            program.start_date
          ) === week
      );

      const activities = TARGETS.map(target => {
        const code = getTypeCode(target.key);

        const matching = code
          ? weekAchievements.filter(
              item => item.type_code === code
            )
          : [];

        const verified = matching.filter(
          item => item.status === "verified"
        );

        let realized = 0;

        if (target.key === "Fisik") {
          const meters = verified.reduce(
            (total, item) =>
              total +
              Math.round(
                (numberOrNull(item.distance_km) || 0) *
                  1000
              ),
            0
          );

          realized = meters / 1000;
        } else {
          realized = verified.length;
        }

        return {
          ...target,
          realized,
          recorded: matching.length,
          verifiedCount: verified.length,
          pendingCount: matching.filter(
            item => item.status === "pending"
          ).length,
          achieved: realized >= target.target,
          percentage:
            (realized / target.target) * 100,
        };
      });

      const tests = theory.filter(
        item =>
          weekOf(
            item.test_date,
            program.start_date
          ) === week
      );

      const practices = practice.filter(
        item =>
          weekOf(
            item.practice_date,
            program.start_date
          ) === week
      );

      const samSessions = allSamaptaSessions.filter(
        item =>
          weekOf(
            item.date,
            program.start_date
          ) === week
      );

      return {
        week,
        achievements: weekAchievements,
        activities,
        tests,
        practices,
        samSessions,
        testAverage: average(tests),
        practiceAverage: average(practices),
      };
    });

    const summary = TARGETS.map(target => {
      const entries = weekly.map(
        week =>
          week.activities.find(
            item => item.key === target.key
          )
      );

      let realized;

      if (target.key === "Fisik") {
        const meters = entries.reduce(
          (sum, entry) =>
            sum + Math.round(entry.realized * 1000),
          0
        );

        realized = meters / 1000;
      } else {
        realized = entries.reduce(
          (sum, entry) =>
            sum + entry.realized,
          0
        );
      }

      const targetTotal =
        target.target * selectedWeeks.length;

      return {
        ...target,
        targetTotal,
        realized,
        percentage: targetTotal
          ? (realized / targetTotal) * 100
          : 0,
        achieved:
          targetTotal > 0 &&
          realized >= targetTotal,
        hasData: entries.some(
          entry => entry.recorded > 0
        ),
      };
    });

    const selectedTests = weekly.flatMap(
      item => item.tests
    );

    const selectedPractices = weekly.flatMap(
      item => item.practices
    );

    const metadata = readSimperMetadata(
      simper?.notes
    );

    const simperRequirements = [
      {
        name: "KMKOP",
        status:
          "Belum dapat dipastikan dari struktur data",
      },
      {
        name: "Praktik",
        status:
          simper?.practice_status === "passed"
            ? "Lulus (data sistem)"
            : "Belum terkonfirmasi",
      },
      {
        name: "Orientasi Area",
        status:
          metadata?.orientation_status === "completed"
            ? "Selesai (data sistem)"
            : "Belum terkonfirmasi",
      },
    ];

    return {
      weekly,
      summary,
      theoryAverage: average(selectedTests),
      practiceAverage: average(selectedPractices),
      samaptaSessions: allSamaptaSessions,
      simperRequirements,
    };
  }, [data, selectedWeeks]);

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

  const { program, profile } = data;

  const participantName =
    program.peserta?.full_name ||
    "Peserta OJT";

  const backPath =
    profile.role === "mentor"
      ? `/peserta/${programId}`
      : "/dashboard-peserta";

  const samaptaIndex = new Map(
    report.samaptaSessions.map(
      (session, index) => [
        session.date,
        index + 1,
      ]
    )
  );

  function printReport() {
    if (!selectedWeeks.length) return;

    setShowPreview(true);

    requestAnimationFrame(() => {
      window.print();
    });
  }

  return (
    <main className="rp-root">
      <style>{`
        .rp-root,
        .rp-root * {
          box-sizing: border-box;
        }

        .rp-root {
          min-height: 100vh;
          background: #eef3f3;
          color: #183444;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13px;
        }

        .rp-loading {
          min-height: 100vh;
          padding: 25px;
          background: #eef3f3;
          font-family: Arial, sans-serif;
          color: #183444;
        }

        .rp-topbar {
          background: #092c38;
          color: white;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .rp-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .rp-brand span {
          color: #38c997;
        }

        .rp-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 18px;
        }

        .rp-controls {
          background: white;
          border: 1px solid #dce6e7;
          border-radius: 14px;
          padding: 18px;
          margin-bottom: 15px;
        }

        .rp-controls h2 {
          margin: 0 0 5px;
          font-size: 21px;
          color: #0c3343;
        }

        .rp-hint {
          color: #6c8190;
          font-size: 12px;
          line-height: 1.6;
          margin: 8px 0;
        }

        .rp-radio {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          margin: 18px 0;
        }

        .rp-radio label {
          display: flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
        }

        .rp-fields {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          max-width: 650px;
        }

        .rp-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 800;
        }

        .rp-select {
          width: 100%;
          padding: 11px;
          border: 1px solid #d2e0e2;
          border-radius: 9px;
          background: white;
          color: #183b40;
          font-size: 14px;
        }

        .rp-custom-grid {
          display: grid;
          grid-template-columns: repeat(13, 1fr);
          gap: 5px;
          margin-top: 10px;
        }

        .rp-custom-week {
          border: 1px solid #d4e3e0;
          border-radius: 6px;
          padding: 9px 2px;
          background: white;
          color: #234;
          cursor: pointer;
        }

        .rp-custom-week.active {
          background: #07805c;
          color: white;
          border-color: #07805c;
        }

        .rp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 15px;
        }

        .rp-button {
          border: 0;
          border-radius: 9px;
          padding: 11px 15px;
          background: #087e5b;
          color: white;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .rp-button.secondary {
          background: #10374a;
        }

        .rp-button.outline {
          background: #e6f0eb;
          color: #086e53;
        }

        .rp-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .rp-error {
          color: #a72d2d;
          background: #fff1f1;
          padding: 10px;
          border-radius: 8px;
          margin-top: 10px;
        }

        .rp-print {
          background: white;
          border: 1px solid #dae4e7;
          box-shadow: 0 5px 25px #1232;
          padding: 20px;
          margin: 0 auto;
          min-width: 0;
        }

        .rp-hero {
          background: linear-gradient(
            110deg,
            #062944,
            #143b69
          );
          border-top: 5px solid #20a267;
          color: white;
          padding: 17px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
        }

        .rp-hero h1 {
          margin: 4px 0;
          font-size: 29px;
        }

        .rp-hero-label {
          font-size: 15px;
          font-weight: 900;
        }

        .rp-hero small {
          font-size: 10px;
          letter-spacing: .7px;
        }

        .rp-meta {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1.4fr;
          gap: 12px;
          border: 1px solid #dce5ee;
          padding: 13px;
          margin: 12px 0;
        }

        .rp-meta small {
          display: block;
          color: #68818b;
          margin-bottom: 4px;
        }

        .rp-meta strong {
          overflow-wrap: anywhere;
        }

        .rp-section-title {
          background: #11396b;
          color: white;
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 900;
          margin: 13px 0 6px;
        }

        .rp-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .rp-table th,
        .rp-table td {
          border: 1px solid #ced9e0;
          padding: 7px 6px;
          text-align: left;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        .rp-table th {
          background: #edf3f7;
          font-weight: 800;
        }

        .rp-table .num {
          text-align: right;
        }

        .rp-table .center {
          text-align: center;
        }

        .rp-empty-cell {
          color: #84919b;
          text-align: center !important;
          font-style: italic;
        }

        .rp-status {
          display: inline-block;
          border-radius: 30px;
          padding: 4px 7px;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .rp-success {
          color: #096747;
          background: #dff5e7;
        }

        .rp-warning {
          color: #a42e35;
          background: #ffe5e6;
        }

        .rp-neutral {
          color: #596d7a;
          background: #edf1f5;
        }

        .rp-note {
          font-size: 11px;
          color: #526e7b;
          line-height: 1.55;
          margin: 8px 0;
        }

        .rp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .rp-mini-card {
          border: 1px solid #dae5eb;
          border-radius: 8px;
          padding: 10px;
        }

        .rp-mini-card strong {
          display: block;
          font-size: 20px;
          color: #0b775b;
          margin-top: 5px;
        }

        .rp-week-page {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 3px solid #147950;
        }

        .rp-footer {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 20px;
          margin-top: 16px;
        }

        .rp-signature {
          text-align: center;
          font-size: 11px;
          line-height: 1.5;
        }

        .rp-sign-space {
          height: 40px;
        }

        @media screen and (max-width: 700px) {
          .rp-topbar {
            padding: 12px;
          }

          .rp-brand {
            font-size: 17px;
          }

          .rp-page {
            padding: 9px;
          }

          .rp-controls {
            padding: 13px;
          }

          .rp-radio {
            flex-direction: column;
            gap: 12px;
          }

          .rp-custom-grid {
            grid-template-columns: repeat(5, 1fr);
          }

          .rp-fields {
            grid-template-columns: 1fr 1fr;
          }

          .rp-print {
            padding: 10px;
          }

          .rp-hero {
            padding: 11px;
          }

          .rp-hero h1 {
            font-size: 22px;
          }

          .rp-hero-label {
            font-size: 11px;
          }

          .rp-meta {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .rp-grid {
            grid-template-columns: 1fr;
          }

          .rp-scroll {
            overflow-x: auto;
          }

          .rp-scroll .rp-table {
            min-width: 610px;
          }

          .rp-footer {
            grid-template-columns: 1fr;
          }

          .rp-actions .rp-button {
            flex: 1;
          }
        }

        @page {
          size: A4 landscape;
          margin: 9mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .rp-topbar,
          .rp-controls {
            display: none !important;
          }

          .rp-root {
            min-height: 0 !important;
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .rp-page {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .rp-print {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .rp-hero {
            padding: 9px 12px !important;
          }

          .rp-hero h1 {
            font-size: 23px !important;
          }

          .rp-hero-label {
            font-size: 12px !important;
          }

          .rp-meta {
            grid-template-columns:
              1.5fr 1fr 1fr 1.4fr !important;
            padding: 7px !important;
            margin: 7px 0 !important;
          }

          .rp-section-title {
            font-size: 10px !important;
            margin: 8px 0 4px !important;
            padding: 5px 7px !important;
          }

          .rp-table {
            min-width: 0 !important;
          }

          .rp-table th,
          .rp-table td {
            font-size: 9px !important;
            padding: 4px !important;
          }

          .rp-note {
            font-size: 9px !important;
            margin: 5px 0 !important;
          }

          .rp-grid {
            grid-template-columns:
              1fr 1fr !important;
            gap: 8px !important;
          }

          .rp-mini-card {
            padding: 7px !important;
          }

          .rp-mini-card strong {
            font-size: 15px !important;
          }

          .rp-scroll {
            overflow: visible !important;
          }

          .rp-status {
            font-size: 8px !important;
            padding: 2px 5px !important;
          }

          .rp-week-page {
            break-before: page;
            page-break-before: always;
            margin-top: 0 !important;
            border-top: 0 !important;
            padding-top: 0 !important;
          }

          .rp-footer {
            grid-template-columns:
              1.6fr 1fr !important;
            gap: 15px !important;
          }

          .rp-sign-space {
            height: 35px !important;
          }
        }
      `}</style>

      <header className="rp-topbar">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="rp-button outline"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="rp-page">
        <section className="rp-controls">
          <h2>Cetak Rapor OJT Dinamis</h2>

          <p className="rp-hint">
            Tentukan periode laporan sesuai kebutuhan
            mentor. Pilihan awal adalah Week 03–07.
          </p>

          <div className="rp-radio">
            <label>
              <input
                type="radio"
                name="rp-mode"
                checked={mode === "single"}
                onChange={() => setMode("single")}
              />
              Satu minggu
            </label>

            <label>
              <input
                type="radio"
                name="rp-mode"
                checked={mode === "range"}
                onChange={() => setMode("range")}
              />
              Rentang beberapa minggu
            </label>

            <label>
              <input
                type="radio"
                name="rp-mode"
                checked={mode === "custom"}
                onChange={() => setMode("custom")}
              />
              Pilih minggu tertentu
            </label>
          </div>

          {mode === "single" && (
            <div className="rp-fields">
              <div className="rp-field">
                <label>Pilih Minggu</label>

                <WeekSelect
                  value={singleWeek}
                  onChange={setSingleWeek}
                />
              </div>
            </div>
          )}

          {mode === "range" && (
            <div className="rp-fields">
              <div className="rp-field">
                <label>Dari Minggu</label>

                <WeekSelect
                  value={startWeek}
                  onChange={week => {
                    setStartWeek(week);

                    if (endWeek < week) {
                      setEndWeek(week);
                    }
                  }}
                />
              </div>

              <div className="rp-field">
                <label>Sampai Minggu</label>

                <WeekSelect
                  value={endWeek}
                  minWeek={startWeek}
                  onChange={setEndWeek}
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="rp-custom-grid">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, index) => index + 1
              ).map(week => (
                <button
                  key={week}
                  type="button"
                  className={
                    `rp-custom-week ${
                      customWeeks.includes(week)
                        ? "active"
                        : ""
                    }`
                  }
                  onClick={() =>
                    toggleCustomWeek(week)
                  }
                >
                  {pad(week)}
                </button>
              ))}
            </div>
          )}

          <p className="rp-hint">
            <strong>
              {selectedWeeks.length} minggu dipilih:
            </strong>{" "}
            {selectedWeeks.length
              ? selectedWeeks
                  .map(week => `Week ${pad(week)}`)
                  .join(", ")
              : "Belum ada minggu dipilih"}
          </p>

          {error && (
            <div className="rp-error">
              {error}
            </div>
          )}

          <div className="rp-actions">
            <button
              type="button"
              className="rp-button outline"
              onClick={refreshData}
              disabled={refreshing}
            >
              {refreshing
                ? "Memuat..."
                : "Refresh Data"}
            </button>

            <button
              type="button"
              className="rp-button secondary"
              onClick={() =>
                setShowPreview(old => !old)
              }
            >
              {showPreview
                ? "Sembunyikan Pratinjau"
                : "Tampilkan Pratinjau"}
            </button>

            <button
              type="button"
              className="rp-button"
              disabled={
                !selectedWeeks.length ||
                refreshing
              }
              onClick={printReport}
            >
              Cetak / Simpan PDF
            </button>
          </div>

          <p className="rp-hint">
            Pada dialog cetak browser, pilih
            Simpan sebagai PDF dengan orientasi A4
            Landscape.
          </p>
        </section>

        {showPreview && selectedWeeks.length > 0 && (
          <article className="rp-print">
            <header className="rp-hero">
              <div>
                <div className="rp-hero-label">
                  OJT MineTrack · PT BERAU COAL
                </div>

                <h1>RAPOR OJT</h1>

                <small>
                  ON THE JOB TRAINING
                </small>
              </div>

              <div style={{ textAlign: "right" }}>
                EMERGENCY RESPONSE GROUP
                <br />
                <strong>
                  {selectedWeeks.length} MINGGU
                </strong>
              </div>
            </header>

            <section className="rp-meta">
              <div>
                <small>Nama Peserta</small>
                <strong>{participantName}</strong>
              </div>

              <div>
                <small>Departemen</small>
                <strong>
                  {program.peserta?.department || "—"}
                </strong>
              </div>

              <div>
                <small>Site</small>
                <strong>{program.site || "—"}</strong>
              </div>

              <div>
                <small>Periode OJT</small>
                <strong>
                  {dateText(program.start_date)}
                  {" – "}
                  {dateText(program.end_date)}
                </strong>
              </div>
            </section>

            <p className="rp-note">
              <strong>Periode cetak:</strong>{" "}
              {selectedWeeks
                .map(week => `Week ${pad(week)}`)
                .join(", ")}
              . Penilaian didasarkan pada data
              yang tercatat di Supabase dalam periode
              yang dipilih.
            </p>

            <SectionTitle>
              1. PENILAIAN KOMPETENSI UTAMA
            </SectionTitle>

            <div className="rp-scroll">
              <table className="rp-table">
                <thead>
                  <tr>
                    <th>Komponen</th>
                    <th className="num">Target</th>
                    <th className="num">Realisasi</th>
                    <th className="num">Pencapaian</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {report.summary.map(item => (
                    <tr key={item.key}>
                      <td>{item.label}</td>

                      <td className="num">
                        {fmt(item.targetTotal)}{" "}
                        {item.unit}
                      </td>

                      <td className="num">
                        {fmt(
                          item.realized,
                          item.key === "Fisik" ? 3 : 0
                        )}{" "}
                        {item.unit}
                      </td>

                      <td className="num">
                        {fmt(item.percentage, 1)}%
                      </td>

                      <td>
                        <Status
                          achieved={item.achieved}
                          hasData={item.hasData}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rp-grid">
              <section>
                <SectionTitle>
                  2. PENILAIAN PEMBELAJARAN / TEORI
                </SectionTitle>

                <div className="rp-mini-card">
                  <div>
                    Rata-rata nilai periode terpilih
                  </div>

                  <strong>
                    {fmt(report.theoryAverage, 2)}
                  </strong>

                  <p className="rp-note">
                    Nilai diambil dari Post-Test.
                    Kriteria kelulusan mengikuti
                    standar resmi program OJT.
                  </p>
                </div>
              </section>

              <section>
                <SectionTitle>
                  3. PENILAIAN PRAKTIK
                </SectionTitle>

                <div className="rp-mini-card">
                  <div>
                    Rata-rata nilai periode terpilih
                  </div>

                  <strong>
                    {fmt(report.practiceAverage, 2)}
                  </strong>

                  <p className="rp-note">
                    Nilai diambil dari hasil praktik
                    yang tercatat pada minggu pilihan.
                  </p>
                </div>
              </section>
            </div>

            <div className="rp-grid">
              <section>
                <SectionTitle>
                  4. MONITORING SAMAPTA
                </SectionTitle>

                <div className="rp-scroll">
                  <table className="rp-table">
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
                      {SAMAPTA_TARGETS.map(
                        (target, index) => (
                          <tr key={target.name}>
                            <td>{target.name}</td>

                            <td>
                              {target.lowerBetter
                                ? "≤ "
                                : "≥ "}
                              {fmt(
                                target.target,
                                target.lowerBetter ? 2 : 0
                              )}{" "}
                              {target.unit}
                            </td>

                            {[0, 1, 2].map(period => {
                              const session =
                                report.samaptaSessions[
                                  period
                                ];

                              const actual =
                                session?.metrics[index]
                                  ?.actual;

                              return (
                                <td key={period}>
                                  {actual === null ||
                                  actual === undefined
                                    ? "—"
                                    : fmt(
                                        actual,
                                        target.lowerBetter
                                          ? 2
                                          : 0
                                      )}
                                </td>
                              );
                            })}
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="rp-note">
                  P1–P3 mengikuti tiga tanggal
                  evaluasi pertama yang tercatat.
                  Data di luar minggu pilihan merupakan
                  referensi historis, bukan hasil
                  kegiatan mingguan pada periode cetak.
                </p>
              </section>

              <section>
                <SectionTitle>
                  5. VALIDASI & PERSYARATAN SIMPER
                </SectionTitle>

                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>Komponen</th>
                      <th>Status Tercatat</th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.simperRequirements.map(
                      item => (
                        <tr key={item.name}>
                          <td>{item.name}</td>
                          <td>{item.status}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>

                <p className="rp-note">
                  Status SIMPER merupakan data
                  terbaru yang tersedia. Riwayat
                  perubahan per minggu belum tersedia
                  pada struktur tabel saat ini.
                  KMKOP tidak otomatis disamakan
                  dengan administrasi.
                </p>
              </section>
            </div>

            <div className="rp-footer">
              <div>
                <SectionTitle>
                  CATATAN & RINGKASAN
                </SectionTitle>

                <p className="rp-note">
                  Rapor ini menampilkan pencapaian
                  pada minggu yang dipilih mentor.
                  Target kegiatan hanya dihitung dari
                  catatan terverifikasi. Catatan
                  pending tetap tampil pada rincian,
                  tetapi tidak menambah realisasi.
                  Belum adanya nilai tidak otomatis
                  berarti peserta tidak lulus.
                </p>
              </div>

              <div className="rp-signature">
                Tanggal Cetak:{" "}
                {new Date().toLocaleDateString(
                  "id-ID"
                )}
                <br />
                <br />
                Mengetahui,
                <br />
                Mentor / Penanggung Jawab

                <div className="rp-sign-space" />

                ________________________
                <br />
                {profile.role === "mentor"
                  ? profile.full_name ||
                    "Nama Mentor"
                  : "Nama Mentor"}
              </div>
            </div>

            {report.weekly.map(weekReport => (
              <section
                className="rp-week-page"
                key={weekReport.week}
              >
                <header className="rp-hero">
                  <div>
                    <div className="rp-hero-label">
                      RAPOR OJT · RINCIAN MINGGUAN
                    </div>

                    <h1>
                      WEEK {pad(weekReport.week)}
                    </h1>

                    <small>
                      {weekDateRange(
                        program.start_date,
                        weekReport.week
                      )}
                    </small>
                  </div>

                  <div
                    style={{ textAlign: "right" }}
                  >
                    {participantName}
                    <br />
                    {program.site || "—"}
                  </div>
                </header>

                <SectionTitle>
                  A. TARGET & REALISASI KEGIATAN
                </SectionTitle>

                <div className="rp-scroll">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th>Komponen</th>
                        <th className="num">Target</th>
                        <th className="num">Realisasi</th>
                        <th className="center">
                          Jumlah Catatan
                        </th>
                        <th className="center">
                          Pending
                        </th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {weekReport.activities.map(
                        item => (
                          <tr key={item.key}>
                            <td>{item.label}</td>

                            <td className="num">
                              {fmt(item.target)}{" "}
                              {item.unit}
                            </td>

                            <td className="num">
                              {fmt(
                                item.realized,
                                item.key === "Fisik"
                                  ? 3
                                  : 0
                              )}{" "}
                              {item.unit}
                            </td>

                            <td className="center">
                              {item.recorded}
                            </td>

                            <td className="center">
                              {item.pendingCount}
                            </td>

                            <td>
                              <Status
                                achieved={
                                  item.achieved
                                }
                                hasData={
                                  item.recorded > 0
                                }
                              />
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="rp-grid">
                  <section>
                    <SectionTitle>
                      B. NILAI TEORI / POST-TEST
                    </SectionTitle>

                    <table className="rp-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th className="num">
                            Nilai
                          </th>
                          <th>Catatan</th>
                        </tr>
                      </thead>

                      <tbody>
                        {weekReport.tests.length ? (
                          weekReport.tests.map(
                            item => (
                              <tr key={item.id}>
                                <td>
                                  {dateText(
                                    item.test_date
                                  )}
                                </td>

                                <td className="num">
                                  {fmt(
                                    item.score,
                                    2
                                  )}
                                </td>

                                <td>
                                  {item.notes || "—"}
                                </td>
                              </tr>
                            )
                          )
                        ) : (
                          <EmptyRow
                            colSpan={3}
                            text="Belum ada nilai teori minggu ini"
                          />
                        )}
                      </tbody>
                    </table>
                  </section>

                  <section>
                    <SectionTitle>
                      C. NILAI PRAKTIK MINGGUAN
                    </SectionTitle>

                    <table className="rp-table">
                      <thead>
                        <tr>
                          <th>Keterampilan</th>
                          <th>Tanggal</th>
                          <th className="num">
                            Nilai
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {weekReport.practices.length ? (
                          weekReport.practices.map(
                            item => (
                              <tr key={item.id}>
                                <td>
                                  {item.practice_name ||
                                    "Praktik"}
                                </td>

                                <td>
                                  {dateText(
                                    item.practice_date
                                  )}
                                </td>

                                <td className="num">
                                  {fmt(
                                    item.score,
                                    2
                                  )}
                                </td>
                              </tr>
                            )
                          )
                        ) : (
                          <EmptyRow
                            colSpan={3}
                            text="Belum ada nilai praktik minggu ini"
                          />
                        )}
                      </tbody>
                    </table>
                  </section>
                </div>

                <SectionTitle>
                  D. RIWAYAT KEGIATAN MINGGUAN
                </SectionTitle>

                <div className="rp-scroll">
                  <table className="rp-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Jenis Kegiatan</th>
                        <th>Keterangan</th>
                        <th>Realisasi</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {weekReport.achievements.length ? (
                        weekReport.achievements.map(
                          item => {
                            const type =
                              data.types.find(
                                entry =>
                                  entry.code ===
                                  item.type_code
                              )?.name ||
                              item.type_code;

                            const isFisik =
                              normalize(type) ===
                              "fisik";

                            return (
                              <tr key={item.id}>
                                <td>
                                  {dateText(
                                    item.activity_date
                                  )}
                                </td>

                                <td>{type}</td>

                                <td>
                                  {item.description ||
                                    "—"}
                                </td>

                                <td>
                                  {isFisik
                                    ? item.distance_km !=
                                      null
                                      ? `${fmt(
                                          item.distance_km,
                                          3
                                        )} km`
                                      : "Jarak belum diisi"
                                    : "1 kegiatan"}
                                </td>

                                <td>
                                  {item.status ===
                                  "verified"
                                    ? "Terverifikasi"
                                    : item.status ===
                                      "pending"
                                    ? "Menunggu"
                                    : item.status}
                                </td>
                              </tr>
                            );
                          }
                        )
                      ) : (
                        <EmptyRow
                          colSpan={5}
                          text="Tidak ada kegiatan tercatat pada minggu ini"
                        />
                      )}
                    </tbody>
                  </table>
                </div>

                <SectionTitle>
                  E. SAMAPTA DAN SIMPER MINGGU INI
                </SectionTitle>

                <p className="rp-note">
                  <strong>Samapta:</strong>{" "}
                  {weekReport.samSessions.length
                    ? `${
                        weekReport.samSessions.length
                      } sesi tercatat: ${weekReport.samSessions
                        .map(session =>
                          dateText(session.date)
                        )
                        .join(", ")}.`
                    : "Tidak ada evaluasi Samapta pada minggu ini."}
                </p>

                {weekReport.samSessions.map(
                  session => (
                    <div key={session.date}>
                      <table className="rp-table">
                        <thead>
                          <tr>
                            <th colSpan={3}>
                              {dateText(session.date)}
                              {" · "}
                              Periode tercatat{" "}
                              {samaptaIndex.get(
                                session.date
                              ) || "—"}
                            </th>
                          </tr>

                          <tr>
                            <th>Komponen</th>
                            <th className="num">
                              Hasil Aktual
                            </th>
                            <th>
                              Pencapaian Target Akhir
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {session.metrics.map(
                            metric => (
                              <tr key={metric.name}>
                                <td>
                                  {metric.name}
                                </td>

                                <td className="num">
                                  {metric.actual ===
                                  null
                                    ? "—"
                                    : `${fmt(
                                        metric.actual,
                                        metric.lowerBetter
                                          ? 2
                                          : 0
                                      )} ${
                                        metric.unit
                                      }`}
                                </td>

                                <td>
                                  {metric.passed ===
                                  null
                                    ? "Belum ada data"
                                    : metric.passed
                                    ? "Memenuhi target"
                                    : "Belum memenuhi target"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                <p className="rp-note">
                  <strong>SIMPER:</strong> Status
                  validasi terbaru dapat dilihat pada
                  halaman rekap. Tanggal perubahan
                  tiap komponen SIMPER belum tersedia,
                  sehingga tidak ditetapkan status
                  kelulusan historis per minggu.
                </p>

                <div className="rp-footer">
                  <div>
                    <p className="rp-note">
                      Target kegiatan dihitung dari
                      catatan terverifikasi. Nilai
                      teori dan praktik ditampilkan
                      sesuai data aktual tanpa
                      menetapkan batas kelulusan
                      yang belum tersedia.
                    </p>
                  </div>

                  <div className="rp-signature">
                    Mengetahui,
                    <br />
                    Mentor / Penanggung Jawab

                    <div className="rp-sign-space" />

                    ________________________
                  </div>
                </div>
              </section>
            ))}
          </article>
        )}
      </div>
    </main>
  );
}
