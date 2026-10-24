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

const SIMPER_META_START = "[[SIMPER_V2]]";
const SIMPER_META_END = "[[/SIMPER_V2]]";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function dateText(value) {
  if (!value) return "—";

  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

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

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (days < 0) return null;

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

function average(rows) {
  const values = rows
    .map((row) => {
      if (
        row.score === null ||
        row.score === undefined ||
        row.score === ""
      ) {
        return null;
      }

      const n = Number(row.score);
      return Number.isFinite(n) ? n : null;
    })
    .filter((value) => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function averageNumbers(values) {
  const clean = values.filter((value) =>
    Number.isFinite(Number(value))
  );

  if (!clean.length) return null;

  return (
    clean.reduce((sum, value) => sum + Number(value), 0) /
    clean.length
  );
}

function sumScores(rows) {
  return rows.reduce((sum, row) => {
    const value = Number(row?.score);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

function fmt(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function fmtInt(value) {
  return value == null ? "—" : String(Math.round(Number(value)));
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0])
    .join("")
    .toUpperCase();
}

function gradeOf(score) {
  if (score == null) return "—";

  const n = Number(score);

  if (n >= 85) return "A";
  if (n >= 75) return "B";
  if (n >= 60) return "C";
  return "D";
}

function gradeLabel(score) {
  const grade = gradeOf(score);

  if (grade === "A") return "A (SANGAT BAIK)";
  if (grade === "B") return "B (BAIK)";
  if (grade === "C") return "C (CUKUP)";
  if (grade === "D") return "D (KURANG)";
  return "—";
}

function chunkWeeks(items, size = 5) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function parseSimperMetadata(notes) {
  const text = String(notes || "");

  const start = text.lastIndexOf(SIMPER_META_START);
  const end = text.lastIndexOf(SIMPER_META_END);

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const content = text.slice(
      start + SIMPER_META_START.length,
      end
    );

    const metadata = JSON.parse(content);

    return metadata?.version === 2 ? metadata : null;
  } catch {
    return null;
  }
}

function getSimperProgress(simper) {
  if (!simper) {
    return {
      percentage: 0,
      validation: false,
      theory: false,
      practice: false,
      released: false,
      meta: null,
    };
  }

  const meta = parseSimperMetadata(simper.notes);

  const validation =
    simper.administration_status === "passed";

  const theory = simper.theory_status === "passed";
  const practice = simper.practice_status === "passed";

  const released =
    validation &&
    theory &&
    practice &&
    meta?.application_status === "approved" &&
    meta?.orientation_status === "completed" &&
    meta?.issuance_status === "issued" &&
    Boolean(simper.graduation_date);

  const count = [
    validation,
    theory,
    practice,
    released,
  ].filter(Boolean).length;

  return {
    percentage: count * 25,
    validation,
    theory,
    practice,
    released,
    meta,
  };
}

function getSamaptaResults(records) {
  const groups = new Map();

  records.forEach((item) => {
    if (!item.test_date) return;

    if (!groups.has(item.test_date)) {
      groups.set(item.test_date, []);
    }

    groups.get(item.test_date).push(item);
  });

  const results = [];

  groups.forEach((items, testDate) => {
    const findScore = (type) => {
      const item = items.find(
        (row) =>
          normalize(row.test_type) === normalize(type)
      );

      if (
        !item ||
        item.score === null ||
        item.score === undefined ||
        item.score === ""
      ) {
        return null;
      }

      const value = Number(item.score);
      return Number.isFinite(value) ? value : null;
    };

    const a = findScore("Lari 12 Menit");

    const parts = [
      findScore("Pull-Up"),
      findScore("Push-Up"),
      findScore("Sit-Up"),
      findScore("Shuttle Run"),
    ];

    if (
      a === null ||
      parts.some((item) => item === null)
    ) {
      return;
    }

    const b =
      parts.reduce((sum, value) => sum + value, 0) / 4;

    const running = items.find(
      (item) =>
        normalize(item.test_type) === "lari12menit"
    );

    const distance =
      running?.result_value == null
        ? null
        : Number(running.result_value);

    results.push({
      date: testDate,
      a,
      b,
      final: (a + b) / 2,
      distance,
      outcome:
        distance == null
          ? "pending"
          : distance >= 2600
          ? "pass"
          : "fail",
    });
  });

  return results.sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function buildWeeklyPost(startDate, rows) {
  const result = Array.from(
    { length: TOTAL_WEEKS },
    (_, index) => ({
      week: index + 1,
      score: null,
    })
  );

  const grouped = new Map();

  rows.forEach((item) => {
    const week = weekOf(item.test_date, startDate);
    if (!week) return;

    if (!grouped.has(week)) {
      grouped.set(week, []);
    }

    grouped.get(week).push(item);
  });

  result.forEach((item) => {
    item.score = average(grouped.get(item.week) || []);
  });

  return result;
}

function buildWeeklyPractice(startDate, rows) {
  const result = Array.from(
    { length: TOTAL_WEEKS },
    (_, index) => ({
      week: index + 1,
      score: null,
      names: [],
    })
  );

  const grouped = new Map();

  rows.forEach((item) => {
    const week = weekOf(item.practice_date, startDate);
    if (!week) return;

    if (!grouped.has(week)) {
      grouped.set(week, []);
    }

    grouped.get(week).push(item);
  });

  result.forEach((item) => {
    const rowsInWeek = grouped.get(item.week) || [];
    item.score = average(rowsInWeek);
    item.names = rowsInWeek
      .map((row) => row.practice_name)
      .filter(Boolean);
  });

  return result;
}

export default function LaporanMonitoringOJTPage() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function getMonitoringData(programId) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name")
        .order("name"),

      supabase
        .from("achievement_records")
        .select("id,type_code,status,activity_date,description")
        .eq("program_id", programId)
        .order("activity_date"),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes")
        .eq("program_id", programId)
        .order("test_date"),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score,notes")
        .eq("program_id", programId)
        .order("practice_date"),

      supabase
        .from("samapta_records")
        .select("id,test_date,test_type,score,outcome,result_value")
        .eq("program_id", programId)
        .order("test_date"),

      supabase
        .from("simper_records")
        .select(
          "id,status,administration_status,training_status,theory_status,practice_status,application_date,graduation_date,notes"
        )
        .eq("program_id", programId)
        .maybeSingle(),
    ]);

    for (const result of results) {
      if (result.error) throw result.error;
    }

    return {
      types: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
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

    let alive = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profileError || !profile) {
          throw new Error("Profil akun tidak ditemukan.");
        }

        const isMentor = profile.role === "mentor";
        const isParticipant =
          profile.role === "participant" ||
          profile.role === "peserta";

        if (!isMentor && !isParticipant) {
          throw new Error(
            "Akun ini tidak memiliki akses ke laporan OJT."
          );
        }

        const {
          data: program,
          error: programError,
        } = await supabase
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
          .eq("id", programId)
          .single();

        if (programError || !program) {
          throw new Error(
            "Program OJT tidak ditemukan atau tidak dapat diakses."
          );
        }

        if (
          isParticipant &&
          program.participant_id !== user.id
        ) {
          throw new Error(
            "Anda hanya dapat melihat laporan program OJT milik sendiri."
          );
        }

        const monitoring = await getMonitoringData(programId);

        if (!alive) return;

        setData({
          profile,
          program,
          ...monitoring,
        });
      } catch (err) {
        if (alive) {
          setError(
            err.message || "Gagal memuat laporan OJT."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    initialize();

    return () => {
      alive = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (!programId || refreshing || !data) return;

    setRefreshing(true);
    setError("");

    try {
      const monitoring = await getMonitoringData(programId);

      setData((old) => ({
        ...old,
        ...monitoring,
      }));
    } catch (err) {
      setError(
        err.message || "Gagal memperbarui laporan."
      );
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
      postTests,
      practice,
      samapta,
      simper,
    } = data;

    const simperProgress = getSimperProgress(simper);
    const samaptaResults = getSamaptaResults(samapta);
    const latestSamapta = samaptaResults.length
      ? samaptaResults[samaptaResults.length - 1]
      : null;

    const verifiedCodes = new Set(
      achievements
        .filter((item) => item.status === "verified")
        .map((item) => item.type_code)
    );

    const competencyRows = CATEGORIES.map((name) => {
      const type = types.find(
        (item) =>
          normalize(item.name) === normalize(name)
      );

      const code = type?.code;

      const verifiedCount = code
        ? achievements.filter(
            (item) =>
              item.type_code === code &&
              item.status === "verified"
          ).length
        : 0;

      const achieved = verifiedCount > 0 ? 1 : 0;
      const target = 1;
      const percentage = achieved ? 100 : 0;

      return {
        name,
        target,
        achieved,
        percentage,
        verifiedCount,
      };
    });

    const verifiedCount = competencyRows.filter(
      (item) => item.achieved === 1
    ).length;

    const achievementPct = Math.round(
      (verifiedCount / CATEGORIES.length) * 100
    );

    const weeklyPost = buildWeeklyPost(
      program.start_date,
      postTests
    );

    const weeklyPractice = buildWeeklyPractice(
      program.start_date,
      practice
    );

    const weekChunks = chunkWeeks(
      Array.from({ length: TOTAL_WEEKS }, (_, index) => index + 1),
      5
    );

    const totalPost = sumScores(postTests);
    const totalPractice = sumScores(practice);
    const totalSamapta = samaptaResults.reduce(
      (sum, item) => sum + Number(item.final || 0),
      0
    );

    const allScoreCount =
      postTests.filter((item) =>
        Number.isFinite(Number(item.score))
      ).length +
      practice.filter((item) =>
        Number.isFinite(Number(item.score))
      ).length +
      samaptaResults.filter((item) =>
        Number.isFinite(Number(item.final))
      ).length;

    const totalScore =
      totalPost + totalPractice + totalSamapta;

    const averageScore =
      allScoreCount > 0 ? totalScore / allScoreCount : null;

    const finalGrade = gradeOf(averageScore);

    const noteLines = [];

    if (verifiedCount === 6) {
      noteLines.push(
        "Seluruh kategori kompetensi utama telah memiliki verifikasi minimal satu pencapaian."
      );
    } else {
      noteLines.push(
        `Masih terdapat ${6 - verifiedCount} kategori kompetensi utama yang belum terverifikasi.`
      );
    }

    if (postTests.length > 0) {
      noteLines.push(
        `Nilai rata-rata pembelajaran mingguan (Post-Test) adalah ${fmt(
          average(postTests)
        )}.`
      );
    } else {
      noteLines.push(
        "Belum terdapat data Post-Test yang dapat dirangkum."
      );
    }

    if (practice.length > 0) {
      noteLines.push(
        `Nilai rata-rata praktik mingguan adalah ${fmt(
          average(practice)
        )}.`
      );
    } else {
      noteLines.push(
        "Belum terdapat data praktik mingguan yang dapat dirangkum."
      );
    }

    if (latestSamapta) {
      noteLines.push(
        `Tes Samapta lengkap terakhir tercatat pada ${dateText(
          latestSamapta.date
        )} dengan nilai akhir ${fmt(latestSamapta.final)}.`
      );
    } else {
      noteLines.push(
        "Belum terdapat data Samapta lengkap dengan lima komponen."
      );
    }

    if (simperProgress.released) {
      noteLines.push(
        "SIMPER telah terbit dan seluruh tahapan utama dinyatakan lengkap."
      );
    } else {
      noteLines.push(
        `Progres SIMPER saat ini ${simperProgress.percentage}% dan masih memerlukan tindak lanjut pada tahapan yang belum selesai.`
      );
    }

    return {
      simperProgress,
      samaptaResults,
      latestSamapta,
      competencyRows,
      verifiedCount,
      achievementPct,
      weeklyPost,
      weeklyPractice,
      weekChunks,
      totalScore,
      averageScore,
      finalGrade,
      noteLines,
      totalPost,
      totalPractice,
      totalSamapta,
    };
  }, [data]);

  if (loading) {
    return (
      <main className="lo-loading">
        Memuat laporan OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="lo-loading">
        <h2>Laporan Tidak Dapat Ditampilkan</h2>
        <p>{error || "Data belum tersedia."}</p>
        <button onClick={() => router.back()}>
          Kembali
        </button>
      </main>
    );
  }

  const {
    profile,
    program,
    postTests,
    practice,
    simper,
  } = data;

  const participantName =
    program?.peserta?.full_name || "Peserta OJT";

  const backUrl =
    profile.role === "mentor"
      ? `/peserta/${program.id}`
      : "/dashboard-peserta";

  return (
    <main className="lo-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .lo-root {
          min-height: 100vh;
          background: #eef3f1;
          color: #17342b;
          font-family: Arial, Helvetica, sans-serif;
        }

        .lo-topbar {
          background: #08232b;
          color: white;
          padding: 15px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .lo-brand {
          font-size: 22px;
          font-weight: 900;
        }

        .lo-brand span {
          color: #35c993;
        }

        .lo-button {
          border: none;
          border-radius: 10px;
          padding: 11px 15px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          background: #0b9263;
          color: white;
        }

        .lo-button.secondary {
          background: #e8efeb;
          color: #274638;
        }

        .lo-button.back {
          background: rgba(255,255,255,.14);
          color: white;
          border: 1px solid rgba(255,255,255,.28);
        }

        .lo-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .lo-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lo-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 20px;
        }

        .lo-sheet {
          background: white;
          border: 1px solid #dbe6df;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 6px 24px rgba(16, 46, 39, 0.08);
        }

        .lo-header {
          border: 2px solid #dbe4dd;
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 18px;
        }

        .lo-header-top {
          background:
            linear-gradient(
              90deg,
              rgba(7, 45, 38, 0.97),
              rgba(7, 45, 38, 0.92)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
          color: white;
          padding: 18px 20px 16px;
          display: grid;
          grid-template-columns: 170px 1fr 120px;
          gap: 14px;
          align-items: center;
        }

        .lo-logo-box {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .lo-logo-mark {
          width: 58px;
          height: 58px;
          border-radius: 14px;
          background: #e0b95c;
          color: #17342b;
          display: grid;
          place-items: center;
          font-size: 28px;
          font-weight: 900;
          flex-shrink: 0;
        }

        .lo-logo-text {
          min-width: 0;
        }

        .lo-logo-text strong {
          display: block;
          font-size: 17px;
          line-height: 1.2;
        }

        .lo-logo-text span {
          display: block;
          font-size: 10px;
          color: #dbeee5;
          letter-spacing: 1.2px;
          margin-top: 4px;
        }

        .lo-title {
          text-align: center;
        }

        .lo-title h1 {
          margin: 0;
          font-size: 26px;
          line-height: 1.2;
          font-weight: 900;
        }

        .lo-title h2 {
          margin: 6px 0 0;
          font-size: 16px;
          color: #d9efdc;
          font-weight: 700;
        }

        .lo-title p {
          margin: 8px 0 0;
          font-size: 11px;
          color: #f0cb79;
          font-weight: 800;
          letter-spacing: 1.4px;
        }

        .lo-badge-wrap {
          display: flex;
          justify-content: flex-end;
        }

        .lo-badge {
          width: 92px;
          height: 92px;
          border-radius: 50%;
          border: 6px solid #e0b95c;
          background: #0d215a;
          color: white;
          display: grid;
          place-items: center;
          text-align: center;
          font-weight: 900;
          font-size: 12px;
          padding: 8px;
          line-height: 1.2;
          box-shadow: inset 0 0 0 4px #12347c;
        }

        .lo-grid-top {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        .lo-box {
          border: 2px solid #dbe4dd;
          border-radius: 12px;
          overflow: hidden;
        }

        .lo-box-title {
          background: #0b2460;
          color: white;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: .3px;
        }

        .lo-box-content {
          padding: 14px;
        }

        .lo-data-table,
        .lo-table {
          width: 100%;
          border-collapse: collapse;
        }

        .lo-data-table td {
          padding: 9px 0;
          font-size: 14px;
          vertical-align: top;
        }

        .lo-data-table td:first-child {
          width: 140px;
          font-weight: 800;
          color: #17342b;
        }

        .lo-data-table td:nth-child(2) {
          width: 18px;
          text-align: center;
          font-weight: 800;
        }

        .lo-box-content p {
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.7;
          color: #28453b;
        }

        .lo-section {
          margin-bottom: 18px;
        }

        .lo-section-bar {
          background: #0b2460;
          color: white;
          padding: 10px 14px;
          border-radius: 8px 8px 0 0;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: .3px;
        }

        .lo-table-wrap {
          border: 1px solid #d9e2dc;
          border-top: none;
          overflow-x: auto;
          margin-bottom: 12px;
        }

        .lo-table {
          min-width: 720px;
        }

        .lo-table th,
        .lo-table td {
          border: 1px solid #dce4de;
          padding: 9px 8px;
          text-align: center;
          font-size: 12px;
          vertical-align: middle;
        }

        .lo-table th {
          background: #f4f7f5;
          color: #18352c;
          font-weight: 900;
        }

        .lo-table td.left {
          text-align: left;
        }

        .lo-chip-green {
          color: #0b7f55;
          font-weight: 900;
        }

        .lo-chip-red {
          color: #cb3c3c;
          font-weight: 900;
        }

        .lo-week-name {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #29493d;
          margin-bottom: 4px;
        }

        .lo-week-score {
          display: block;
          font-size: 12px;
          font-weight: 900;
          color: #17342b;
        }

        .lo-grid-bottom {
          display: grid;
          grid-template-columns: 1.2fr .95fr;
          gap: 16px;
          margin-bottom: 18px;
        }

        .lo-ket-table {
          width: 100%;
          border-collapse: collapse;
        }

        .lo-ket-table th,
        .lo-ket-table td {
          border: 1px solid #dce4de;
          padding: 9px 8px;
          text-align: center;
          font-size: 12px;
        }

        .lo-ket-table th {
          background: #f4f7f5;
          font-weight: 900;
        }

        .lo-summary {
          padding: 14px;
        }

        .lo-summary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }

        .lo-summary-card {
          border: 1px solid #dce4de;
          border-radius: 10px;
          padding: 12px;
          text-align: center;
        }

        .lo-summary-card span {
          display: block;
          font-size: 11px;
          color: #6c8377;
          margin-bottom: 7px;
          font-weight: 700;
        }

        .lo-summary-card strong {
          display: block;
          font-size: 27px;
          color: #0b2460;
          line-height: 1.2;
        }

        .lo-grade-box {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 12px;
          align-items: stretch;
        }

        .lo-grade-left {
          border: 1px solid #dce4de;
          border-radius: 10px;
          padding: 12px;
          text-align: center;
        }

        .lo-grade-left span {
          display: block;
          font-size: 11px;
          font-weight: 800;
          color: #6c8377;
          margin-bottom: 8px;
        }

        .lo-grade-letter {
          font-size: 60px;
          line-height: 1;
          font-weight: 900;
          color: #0b8d5f;
        }

        .lo-grade-label {
          font-size: 12px;
          font-weight: 800;
          color: #17342b;
          margin-top: 6px;
        }

        .lo-grade-right table {
          width: 100%;
          border-collapse: collapse;
        }

        .lo-grade-right th,
        .lo-grade-right td {
          border: 1px solid #dce4de;
          padding: 8px;
          text-align: center;
          font-size: 11px;
        }

        .lo-grade-right th {
          background: #f4f7f5;
          font-weight: 900;
        }

        .lo-notes {
          border: 1px solid #dce4de;
          border-radius: 12px;
          padding: 14px 16px;
        }

        .lo-notes ul {
          margin: 0;
          padding-left: 18px;
        }

        .lo-notes li {
          margin: 0 0 8px;
          line-height: 1.7;
          font-size: 13px;
          color: #29463b;
        }

        .lo-sign-row {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 16px;
          margin-top: 18px;
          align-items: end;
        }

        .lo-sign-box {
          border: 1px solid #dce4de;
          border-radius: 12px;
          padding: 16px;
          min-height: 165px;
        }

        .lo-sign-box p {
          margin: 0 0 10px;
          font-size: 13px;
          color: #29463b;
          line-height: 1.7;
        }

        .lo-signature {
          text-align: center;
          font-size: 13px;
        }

        .lo-signature .space {
          height: 80px;
        }

        .lo-signature strong {
          display: block;
          margin-top: 8px;
          font-size: 14px;
        }

        .lo-alert {
          margin-bottom: 14px;
          padding: 14px;
          border-radius: 12px;
          background: #fff0f1;
          border: 1px solid #fecdd3;
          color: #b91c1c;
          font-size: 13px;
          line-height: 1.7;
        }

        .lo-footer {
          text-align: center;
          color: #7a9083;
          font-size: 11px;
          padding: 18px 0 4px;
        }

        .lo-loading {
          min-height: 100vh;
          padding: 30px;
          background: #eef3f1;
          color: #18352c;
          font-family: Arial, Helvetica, sans-serif;
        }

        .lo-mobile-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        @media (max-width: 900px) {
          .lo-grid-top,
          .lo-grid-bottom,
          .lo-sign-row,
          .lo-summary-grid,
          .lo-grade-box {
            grid-template-columns: 1fr;
          }

          .lo-header-top {
            grid-template-columns: 1fr;
            text-align: center;
          }

          .lo-logo-box {
            justify-content: center;
          }

          .lo-badge-wrap {
            justify-content: center;
          }
        }

        @media (max-width: 700px) {
          .lo-topbar {
            padding: 13px 15px;
          }

          .lo-brand {
            font-size: 18px;
          }

          .lo-container {
            padding: 12px;
          }

          .lo-sheet {
            padding: 14px;
            border-radius: 14px;
          }

          .lo-box-content p,
          .lo-data-table td {
            font-size: 12px;
          }

          .lo-title h1 {
            font-size: 22px;
          }

          .lo-title h2 {
            font-size: 14px;
          }

          .lo-summary-card strong {
            font-size: 24px;
          }

          .lo-grade-letter {
            font-size: 50px;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          .lo-topbar,
          .lo-mobile-actions {
            display: none !important;
          }

          .lo-root {
            background: white;
          }

          .lo-container {
            max-width: none;
            padding: 0;
          }

          .lo-sheet {
            box-shadow: none;
            border: none;
            border-radius: 0;
            padding: 0;
          }

          .lo-section,
          .lo-box,
          .lo-notes,
          .lo-sign-box {
            break-inside: avoid;
          }

          .lo-table-wrap {
            overflow: visible;
          }

          .lo-header-top,
          .lo-section-bar,
          .lo-box-title {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <header className="lo-topbar">
        <div className="lo-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="lo-button back"
          onClick={() => router.push(backUrl)}
        >
          ← Detail Peserta
        </button>
      </header>

      <div className="lo-container">
        <div className="lo-mobile-actions">
          <button
            type="button"
            className="lo-button secondary"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? "Memuat..." : "Refresh Data"}
          </button>

          <button
            type="button"
            className="lo-button"
            onClick={() => window.print()}
          >
            Cetak / Simpan PDF
          </button>
        </div>

        {error && <div className="lo-alert">{error}</div>}

        <section className="lo-sheet">
          <div className="lo-header">
            <div className="lo-header-top">
              <div className="lo-logo-box">
                <div className="lo-logo-mark">M</div>
                <div className="lo-logo-text">
                  <strong>OJT MineTrack</strong>
                  <span>MONITORING & EVALUATION SYSTEM</span>
                </div>
              </div>

              <div className="lo-title">
                <h1>RAPOR OJT</h1>
                <h2>ON THE JOB TRAINING</h2>
                <p>PT. BERAU COAL</p>
              </div>

              <div className="lo-badge-wrap">
                <div className="lo-badge">
                  OJT
                  <br />
                  TRAINING
                </div>
              </div>
            </div>
          </div>

          <div className="lo-grid-top">
            <div className="lo-box">
              <div className="lo-box-title">
                DATA PESERTA
              </div>

              <div className="lo-box-content">
                <table className="lo-data-table">
                  <tbody>
                    <tr>
                      <td>Nama</td>
                      <td>:</td>
                      <td>{participantName}</td>
                    </tr>
                    <tr>
                      <td>Site</td>
                      <td>:</td>
                      <td>{program.site || "—"}</td>
                    </tr>
                    <tr>
                      <td>Jabatan</td>
                      <td>:</td>
                      <td>Peserta OJT</td>
                    </tr>
                    <tr>
                      <td>Periode OJT</td>
                      <td>:</td>
                      <td>
                        {dateText(program.start_date)}
                        {" – "}
                        {dateText(program.end_date)}
                      </td>
                    </tr>
                    <tr>
                      <td>Departemen</td>
                      <td>:</td>
                      <td>
                        {program.peserta?.department || "—"}
                      </td>
                    </tr>
                    <tr>
                      <td>Status Program</td>
                      <td>:</td>
                      <td>
                        {program.status === "active"
                          ? "Aktif"
                          : program.status || "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lo-box">
              <div className="lo-box-title">
                KETERANGAN
              </div>

              <div className="lo-box-content">
                <p>
                  On The Job Training (OJT) merupakan
                  program pelatihan kerja yang bertujuan
                  untuk meningkatkan kompetensi,
                  pengetahuan, keterampilan, serta sikap
                  kerja peserta melalui pengalaman
                  langsung di tempat kerja.
                </p>

                <p>
                  Laporan ini disusun secara otomatis
                  berdasarkan data monitoring peserta
                  selama program OJT, meliputi pencapaian
                  kompetensi, pembelajaran mingguan,
                  praktik mingguan, Samapta, serta
                  progres SIMPER.
                </p>
              </div>
            </div>
          </div>

          <section className="lo-section">
            <div className="lo-section-bar">
              1. PENILAIAN KOMPETENSI UTAMA
            </div>

            <div className="lo-table-wrap">
              <table className="lo-table">
                <thead>
                  <tr>
                    <th>NO</th>
                    {report.competencyRows.map((item) => (
                      <th key={item.name}>{item.name.toUpperCase()}</th>
                    ))}
                  </tr>
                  <tr>
                    <th></th>
                    {report.competencyRows.map((item) => (
                      <th key={`${item.name}-sub`}>
                        Target / Pencapaian / %
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    {report.competencyRows.map((item) => (
                      <td key={item.name}>
                        <div>
                          {item.target} / {item.achieved} /{" "}
                          <span
                            className={
                              item.percentage === 100
                                ? "lo-chip-green"
                                : "lo-chip-red"
                            }
                          >
                            {item.percentage}%
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                fontSize: 12,
                color: "#647b6e",
                lineHeight: 1.7,
              }}
            >
              Keterangan: target tiap kategori = minimal 1
              pencapaian terverifikasi.
            </div>
          </section>

          <section className="lo-section">
            <div className="lo-section-bar">
              2. PENILAIAN PEMBELAJARAN MINGGUAN
            </div>

            {report.weekChunks.map((chunk, index) => (
              <div className="lo-table-wrap" key={index}>
                <table className="lo-table">
                  <thead>
                    <tr>
                      <th>NO</th>
                      {chunk.map((week) => (
                        <th key={week}>
                          WEEK {String(week).padStart(2, "0")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      {chunk.map((week) => {
                        const item = report.weeklyPost.find(
                          (row) => row.week === week
                        );

                        return (
                          <td key={week}>
                            <span className="lo-week-score">
                              {fmt(item?.score)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <section className="lo-section">
            <div className="lo-section-bar">
              3. PENILAIAN PRAKTIK MINGGUAN
            </div>

            {report.weekChunks.map((chunk, index) => (
              <div className="lo-table-wrap" key={index}>
                <table className="lo-table">
                  <thead>
                    <tr>
                      <th>NO</th>
                      {chunk.map((week) => (
                        <th key={week}>
                          WEEK {String(week).padStart(2, "0")}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>1</td>
                      {chunk.map((week) => {
                        const item = report.weeklyPractice.find(
                          (row) => row.week === week
                        );

                        return (
                          <td key={week}>
                            <span className="lo-week-name">
                              {item?.names?.length
                                ? item.names.join(", ")
                                : "—"}
                            </span>
                            <span className="lo-week-score">
                              {fmt(item?.score)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          <div className="lo-grid-bottom">
            <div>
              <section className="lo-section">
                <div className="lo-section-bar">
                  4. VALIDASI & KETERANGAN
                </div>

                <div className="lo-table-wrap">
                  <table className="lo-ket-table">
                    <thead>
                      <tr>
                        <th>NAMA PERSONEL</th>
                        <th>VALIDASI</th>
                        <th>TEORI</th>
                        <th>PRAKTIK</th>
                        <th>PENERBITAN SIMPER</th>
                        <th>KETERANGAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{participantName}</td>
                        <td>
                          {report.simperProgress.validation
                            ? "DONE"
                            : "BELUM"}
                        </td>
                        <td>
                          {report.simperProgress.theory
                            ? "DONE"
                            : "BELUM"}
                        </td>
                        <td>
                          {report.simperProgress.practice
                            ? "DONE"
                            : "BELUM"}
                        </td>
                        <td>
                          {report.simperProgress.released
                            ? "DONE"
                            : "BELUM"}
                        </td>
                        <td>
                          {report.simperProgress.released
                            ? "SIMPER TERBIT"
                            : "MENUNGGU PROSES LANJUTAN"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="lo-section">
                <div className="lo-section-bar">
                  CATATAN
                </div>

                <div className="lo-notes">
                  <ul>
                    {report.noteLines.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>

            <section className="lo-section">
              <div className="lo-section-bar">
                RINGKASAN HASIL
              </div>

              <div className="lo-summary">
                <div className="lo-summary-grid">
                  <div className="lo-summary-card">
                    <span>NILAI TOTAL</span>
                    <strong>{fmt(report.totalScore)}</strong>
                  </div>

                  <div className="lo-summary-card">
                    <span>NILAI RATA-RATA</span>
                    <strong>{fmt(report.averageScore)}</strong>
                  </div>

                  <div className="lo-summary-card">
                    <span>RATA-RATA POST-TEST</span>
                    <strong>{fmt(average(postTests))}</strong>
                  </div>

                  <div className="lo-summary-card">
                    <span>RATA-RATA PRAKTIK</span>
                    <strong>{fmt(average(practice))}</strong>
                  </div>

                  <div className="lo-summary-card">
                    <span>NILAI SAMAPTA TERAKHIR</span>
                    <strong>
                      {fmt(report.latestSamapta?.final)}
                    </strong>
                  </div>

                  <div className="lo-summary-card">
                    <span>PENCAPAIAN OJT</span>
                    <strong>{report.achievementPct}%</strong>
                  </div>
                </div>

                <div className="lo-grade-box">
                  <div className="lo-grade-left">
                    <span>PREDIKAT</span>
                    <div className="lo-grade-letter">
                      {report.finalGrade}
                    </div>
                    <div className="lo-grade-label">
                      {gradeLabel(report.averageScore)}
                    </div>
                  </div>

                  <div className="lo-grade-right">
                    <table>
                      <thead>
                        <tr>
                          <th>NILAI RATA-RATA</th>
                          <th>PREDIKAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>85 – 100</td>
                          <td>A (SANGAT BAIK)</td>
                        </tr>
                        <tr>
                          <td>75 – 84.99</td>
                          <td>B (BAIK)</td>
                        </tr>
                        <tr>
                          <td>60 – 74.99</td>
                          <td>C (CUKUP)</td>
                        </tr>
                        <tr>
                          <td>&lt; 60</td>
                          <td>D (KURANG)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="lo-sign-row">
            <div className="lo-sign-box">
              <p>
                Laporan ini merupakan hasil rekap otomatis
                dari data monitoring OJT MineTrack.
                Keputusan akhir terkait kelulusan OJT,
                kesiapan operasional, maupun penerbitan
                kewenangan kerja tetap mengikuti evaluasi
                mentor serta ketentuan perusahaan.
              </p>

              <p>
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString("id-ID")}
              </p>

              <p>
                Program aktif:{" "}
                {program.status === "active"
                  ? "Ya"
                  : "Tidak"}
              </p>
            </div>

            <div className="lo-sign-box lo-signature">
              <div>Mengetahui,</div>
              <div>Mentor / Penanggung Jawab</div>
              <div className="space" />
              <strong>
                __________________________
              </strong>
              <div style={{ marginTop: 6 }}>
                {profile.role === "mentor"
                  ? profile.full_name
                  : "Nama Penanggung Jawab"}
              </div>
            </div>
          </div>

          <div className="lo-footer">
            OJT MineTrack v2.0 · Emergency Response Group ·
            PT Berau Coal
          </div>
        </section>
      </div>
    </main>
  );
}
