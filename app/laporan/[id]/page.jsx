
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  { key: "Fisik", title: "FISIK", target: 25, unit: "km" },
  { key: "Training", title: "INTERNAL TRAINING", target: 4, unit: "kegiatan" },
  { key: "Sosialisasi", title: "SOSIALISASI", target: 3, unit: "kegiatan" },
  { key: "Orientasi Area", title: "ORIENTASI", target: 2, unit: "kegiatan" },
  { key: "Coaching", title: "COACHING", target: 1, unit: "kegiatan" },
  { key: "Hazard", title: "HAZARD", target: 2, unit: "kegiatan" },
];

const COLORS = [
  "#df4b45",
  "#e7a42a",
  "#e4cb24",
  "#268a4e",
  "#219fc2",
  "#3070d5",
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

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
  ) return null;

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
  ) return null;

  const [year, month, day] = parts;

  const result = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    result.getUTCFullYear() !== year ||
    result.getUTCMonth() !== month - 1 ||
    result.getUTCDate() !== day
  ) return null;

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

  const difference = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  const week = Math.floor(difference / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function average(rows) {
  const values = rows
    .map(row => numberOrNull(row.score))
    .filter(value => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function readSimperMeta(notes) {
  const text = String(notes || "");

  const a = text.lastIndexOf(META_START);
  const b = text.lastIndexOf(META_END);

  if (a < 0 || b <= a) return null;

  try {
    const value = JSON.parse(
      text.slice(a + META_START.length, b)
    );

    return value?.version === 2
      ? value
      : null;
  } catch {
    return null;
  }
}

function splitWeeks(items, size = 7) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function getPredikat(value) {
  if (value === null) {
    return {
      letter: "—",
      label: "Belum ada nilai",
    };
  }

  if (value >= 85) {
    return { letter: "A", label: "SANGAT BAIK" };
  }

  if (value >= 75) {
    return { letter: "B", label: "BAIK" };
  }

  if (value >= 60) {
    return { letter: "C", label: "CUKUP" };
  }

  return { letter: "D", label: "KURANG" };
}

function WeekSelector({
  value,
  onChange,
  from = 1,
}) {
  return (
    <select
      className="rapor-input"
      value={value}
      onChange={event =>
        onChange(Number(event.target.value))
      }
    >
      {Array.from(
        { length: TOTAL_WEEKS - from + 1 },
        (_, index) => index + from
      ).map(week => (
        <option key={week} value={week}>
          Week {pad(week)}
        </option>
      ))}
    </select>
  );
}

function TableTitle({ children }) {
  return (
    <div className="rapor-section-title">
      {children}
    </div>
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

  const [mode, setMode] = useState("range");

  const [singleWeek, setSingleWeek] = useState(3);
  const [fromWeek, setFromWeek] = useState(3);
  const [toWeek, setToWeek] = useState(7);

  const [customWeeks, setCustomWeeks] = useState([
    1, 3, 5,
  ]);

  const [preview, setPreview] = useState(true);

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
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,practice_date,practice_name,score"
        )
        .eq("program_id", id),

      supabase
        .from("simper_records")
        .select(
          "id,administration_status,theory_status,practice_status,status,graduation_date,notes"
        )
        .eq("program_id", id)
        .maybeSingle(),
    ]);

    const names = [
      "Kategori",
      "Pencapaian",
      "Teori",
      "Praktik",
      "SIMPER",
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${names[index]}: ${result.error.message}`
        );
      }
    });

    return {
      types: results[0].data || [],
      achievements: results[1].data || [],
      theory: results[2].data || [],
      practice: results[3].data || [],
      simper: results[4].data || null,
    };
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
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
            "Program OJT tidak ditemukan atau akses ditolak."
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
            err?.message || "Gagal memuat rapor."
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

  async function refresh() {
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
        err?.message || "Gagal memperbarui data."
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
      return Array.from(
        {
          length: Math.max(
            0,
            toWeek - fromWeek + 1
          ),
        },
        (_, index) => fromWeek + index
      );
    }

    return [...new Set(customWeeks)]
      .filter(
        week =>
          week >= 1 &&
          week <= TOTAL_WEEKS
      )
      .sort((a, b) => a - b);
  }, [
    mode,
    singleWeek,
    fromWeek,
    toWeek,
    customWeeks,
  ]);

  function toggleWeek(week) {
    setCustomWeeks(old =>
      old.includes(week)
        ? old.filter(value => value !== week)
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
      simper,
    } = data;

    const codeMap = new Map(
      types.map(item => [
        normalize(item.name),
        item.code,
      ])
    );

    function getCode(key) {
      if (key === "Training") {
        return (
          codeMap.get("training") ||
          codeMap.get("internaltraining")
        );
      }

      return codeMap.get(normalize(key));
    }

    const weekly = selectedWeeks.map(week => {
      const achievementsThisWeek =
        achievements.filter(
          item =>
            weekOf(
              item.activity_date,
              program.start_date
            ) === week
        );

      const activities = TARGETS.map(target => {
        const typeCode = getCode(target.key);

        const matching = typeCode
          ? achievementsThisWeek.filter(
              item =>
                item.type_code === typeCode
            )
          : [];

        const verified = matching.filter(
          item => item.status === "verified"
        );

        let realized = 0;

        if (target.key === "Fisik") {
          const meters = verified.reduce(
            (sum, item) =>
              sum +
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
        };
      });

      return {
        week,
        activities,

        tests: theory.filter(
          item =>
            weekOf(
              item.test_date,
              program.start_date
            ) === week
        ),

        practices: practice.filter(
          item =>
            weekOf(
              item.practice_date,
              program.start_date
            ) === week
        ),
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
          (sum, item) =>
            sum +
            Math.round(item.realized * 1000),
          0
        );

        realized = meters / 1000;
      } else {
        realized = entries.reduce(
          (sum, item) =>
            sum + item.realized,
          0
        );
      }

      const totalTarget =
        target.target * selectedWeeks.length;

      return {
        ...target,
        totalTarget,
        realized,
        percentage: totalTarget > 0
          ? realized / totalTarget * 100
          : 0,
        achieved:
          totalTarget > 0 &&
          realized >= totalTarget,
        hasData: entries.some(
          item => item.recorded > 0
        ),
      };
    });

    const allTests = weekly.flatMap(
      week => week.tests
    );

    const allPractices = weekly.flatMap(
      week => week.practices
    );

    const validScores = [
      ...allTests,
      ...allPractices,
    ]
      .map(item => numberOrNull(item.score))
      .filter(value => value !== null);

    const scoreTotal = validScores.reduce(
      (sum, value) => sum + value,
      0
    );

    const scoreAverage = validScores.length
      ? scoreTotal / validScores.length
      : null;

    const metadata = readSimperMeta(
      simper?.notes
    );

    const validation = {
      kmkop: "Belum terkonfirmasi",
      kmkopValidation: "—",

      practice:
        simper?.practice_status === "passed"
          ? "Lulus (data sistem)"
          : "Belum terkonfirmasi",

      practiceValidation:
        "Perlu konfirmasi",

      orientation:
        metadata?.orientation_status === "completed"
          ? "Selesai (data sistem)"
          : "Belum terkonfirmasi",
    };

    const unfinished = summary.filter(
      item => !item.achieved
    );

    return {
      weekly,
      summary,
      allTests,
      allPractices,
      scoreTotal,
      scoreAverage,
      scoreCount: validScores.length,
      grade: getPredikat(scoreAverage),
      validation,
      unfinished,
    };
  }, [data, selectedWeeks]);

  if (loading) {
    return (
      <main className="rapor-loading">
        Memuat Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="rapor-loading">
        <h2>Rapor Tidak Dapat Ditampilkan</h2>
        <p>
          {error || "Data belum tersedia."}
        </p>

        <button
          onClick={() => router.back()}
        >
          Kembali
        </button>
      </main>
    );
  }

  const { profile, program } = data;

  const participantName =
    program.peserta?.full_name ||
    "Peserta OJT";

  const backPath =
    profile.role === "mentor"
      ? `/peserta/${programId}`
      : "/dashboard-peserta";

  const selectedLabel = selectedWeeks
    .map(week => `Week ${pad(week)}`)
    .join(", ");

  const fisikSummary = report.summary.find(
    item => item.key === "Fisik"
  );

  const runningCount = report.weekly.reduce(
    (sum, week) =>
      sum +
      (
        week.activities.find(
          item => item.key === "Fisik"
        )?.recorded || 0
      ),
    0
  );

  function printReport() {
    if (!selectedWeeks.length) return;

    setPreview(true);

    requestAnimationFrame(() => {
      window.print();
    });
  }

  return (
    <main className="rapor-root">
      <style>{`
        .rapor-root,
        .rapor-root * {
          box-sizing: border-box;
        }

        .rapor-root {
          min-height: 100vh;
          background: #edf3f4;
          color: #152d49;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
        }

        .rapor-loading {
          min-height: 100vh;
          padding: 25px;
          background: #edf3f4;
          color: #152d49;
          font-family: Arial, sans-serif;
        }

        .rapor-topbar {
          background: #092b37;
          color: white;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .rapor-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .rapor-brand span {
          color: #35c995;
        }

        .rapor-container {
          max-width: 1250px;
          margin: 0 auto;
          padding: 15px;
        }

        .rapor-controls {
          background: white;
          border: 1px solid #d7e3e7;
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .rapor-controls h2 {
          font-size: 21px;
          margin: 0 0 6px;
        }

        .rapor-muted {
          color: #677d89;
          line-height: 1.5;
          font-size: 11px;
        }

        .rapor-modes {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin: 17px 0;
        }

        .rapor-modes label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 700;
          cursor: pointer;
        }

        .rapor-options {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 12px;
          max-width: 680px;
        }

        .rapor-options label {
          display: block;
          font-weight: 800;
          font-size: 11px;
          margin-bottom: 6px;
        }

        .rapor-input {
          width: 100%;
          padding: 11px;
          border: 1px solid #cbd9df;
          border-radius: 8px;
          background: white;
          color: #152d49;
          font-size: 14px;
        }

        .rapor-custom {
          display: grid;
          grid-template-columns:
            repeat(13, minmax(0, 1fr));
          gap: 5px;
        }

        .rapor-custom button {
          padding: 9px 2px;
          border-radius: 6px;
          border: 1px solid #cadbdc;
          background: white;
          color: #183846;
          cursor: pointer;
        }

        .rapor-custom button.active {
          background: #07835d;
          color: white;
        }

        .rapor-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .rapor-button {
          border: none;
          background: #07805a;
          color: white;
          font-weight: 800;
          padding: 11px 14px;
          border-radius: 9px;
          font-size: 12px;
          cursor: pointer;
        }

        .rapor-button.secondary {
          background: #173e68;
        }

        .rapor-button.light {
          background: #e8f3ec;
          color: #126d4d;
        }

        .rapor-button:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .rapor-error {
          background: #fff0f0;
          color: #a62332;
          padding: 10px;
          border-radius: 8px;
          margin-top: 9px;
        }

        .rapor-paper {
          background: white;
          padding: 18px;
          border: 1px solid #cbd9e0;
          box-shadow: 0 5px 22px #163d6116;
        }

        .rapor-header {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          text-align: center;
          gap: 12px;
          border-top: 5px solid #209448;
          border-bottom: 5px solid #123c70;
          padding: 14px 10px;
        }

        .rapor-company {
          font-size: 22px;
          font-weight: 900;
          color: #152b43;
          text-align: left;
        }

        .rapor-company span {
          color: #188d45;
        }

        .rapor-header h1 {
          color: #0c2c62;
          font-size: 34px;
          margin: 0;
        }

        .rapor-header h2 {
          color: #188c45;
          margin: 2px 0 8px;
          font-size: 15px;
        }

        .rapor-header small {
          display: block;
          background: #0b2b5c;
          color: white;
          padding: 5px;
          font-size: 10px;
        }

        .rapor-emblem {
          justify-self: center;
          border: 3px solid #d6b255;
          border-radius: 50%;
          width: 75px;
          height: 75px;
          display: grid;
          place-items: center;
          color: #0d2d60;
          font-weight: 900;
          text-align: center;
        }

        .rapor-intro {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 12px 0;
        }

        .rapor-box {
          border: 1px solid #9fadc0;
          border-radius: 5px;
          padding: 10px;
          min-width: 0;
        }

        .rapor-section-title {
          display: inline-block;
          background: #0b2c61;
          color: white;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 13px;
          margin-bottom: 7px;
        }

        .rapor-info {
          display: grid;
          grid-template-columns: 105px 1fr;
          gap: 5px 7px;
          line-height: 1.5;
        }

        .rapor-description {
          font-size: 11px;
          line-height: 1.7;
          margin: 3px 0 9px;
        }

        .rapor-section {
          margin: 13px 0;
          break-inside: avoid-page;
        }

        .rapor-scroll {
          overflow-x: auto;
        }

        .rapor-table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          font-size: 10px;
        }

        .rapor-table th,
        .rapor-table td {
          border: 1px solid #bdc9d5;
          padding: 6px 4px;
          text-align: center;
          overflow-wrap: anywhere;
          vertical-align: middle;
        }

        .rapor-table th {
          background: #eaf0f6;
        }

        .rapor-competence th {
          font-size: 9px;
        }

        .rapor-competence .group {
          color: white;
          font-weight: 900;
        }

        .rapor-weektable td {
          vertical-align: top;
        }

        .rapor-score-item {
          padding: 3px 0;
          border-bottom: 1px solid #edf0f2;
          line-height: 1.45;
        }

        .rapor-score-item:last-child {
          border-bottom: none;
        }

        .rapor-small {
          color: #627588;
          font-size: 10px;
          line-height: 1.5;
          margin: 6px 0;
        }

        .rapor-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }

        .rapor-notes {
          font-size: 11px;
          line-height: 1.65;
          padding: 4px;
        }

        .rapor-numbers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          margin: 8px 0;
        }

        .rapor-number {
          border: 1px solid #dbe4eb;
          background: #f8fafc;
          padding: 12px;
          text-align: center;
        }

        .rapor-number span {
          display: block;
          font-size: 10px;
        }

        .rapor-number strong {
          display: block;
          font-size: 25px;
          margin-top: 6px;
          color: #0a2d62;
        }

        .rapor-predikat {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-top: 10px;
        }

        .rapor-predikat-letter {
          border: 3px solid #1b924d;
          border-radius: 50%;
          color: #0c7a3e;
          font-size: 36px;
          font-weight: 900;
          width: 75px;
          height: 75px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .rapor-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 15px;
          margin-top: 18px;
          font-size: 10px;
          color: #607185;
        }

        .rapor-signature {
          text-align: center;
          min-width: 190px;
        }

        .rapor-sign-space {
          height: 42px;
        }

        @media (max-width: 700px) {
          .rapor-container {
            padding: 8px;
          }

          .rapor-controls {
            padding: 13px;
          }

          .rapor-controls h2 {
            font-size: 18px;
          }

          .rapor-modes {
            flex-direction: column;
            gap: 12px;
          }

          .rapor-custom {
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
          }

          .rapor-paper {
            padding: 9px;
          }

          .rapor-header {
            grid-template-columns: 1fr 2fr;
            gap: 6px;
          }

          .rapor-company {
            font-size: 12px;
          }

          .rapor-header h1 {
            font-size: 22px;
          }

          .rapor-header h2 {
            font-size: 11px;
          }

          .rapor-emblem {
            display: none;
          }

          .rapor-intro {
            grid-template-columns: 1fr;
          }

          .rapor-info {
            grid-template-columns: 90px 1fr;
          }

          .rapor-scroll .rapor-competence {
            min-width: 780px;
          }

          .rapor-scroll .rapor-weektable {
            min-width: 520px;
          }

          .rapor-bottom {
            grid-template-columns: 1fr;
          }

          .rapor-actions .rapor-button {
            flex: 1;
          }
        }

        @page {
          size: A4 landscape;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .rapor-topbar,
          .rapor-controls {
            display: none !important;
          }

          .rapor-root {
            background: white !important;
            min-height: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .rapor-container {
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .rapor-paper {
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .rapor-header {
            grid-template-columns:
              1fr 2fr 1fr !important;
            padding: 8px !important;
          }

          .rapor-company {
            font-size: 17px !important;
          }

          .rapor-header h1 {
            font-size: 27px !important;
          }

          .rapor-header h2 {
            font-size: 13px !important;
          }

          .rapor-emblem {
            display: grid !important;
            width: 57px !important;
            height: 57px !important;
            font-size: 10px !important;
          }

          .rapor-intro {
            grid-template-columns:
              1fr 1fr !important;
            gap: 9px !important;
          }

          .rapor-box {
            padding: 7px !important;
          }

          .rapor-section {
            margin: 8px 0 !important;
          }

          .rapor-section-title {
            font-size: 9px !important;
            padding: 5px 10px !important;
          }

          .rapor-scroll {
            overflow: visible !important;
          }

          .rapor-table,
          .rapor-scroll .rapor-competence,
          .rapor-scroll .rapor-weektable {
            min-width: 0 !important;
            width: 100% !important;
            font-size: 8px !important;
          }

          .rapor-table th,
          .rapor-table td {
            padding: 4px 2px !important;
          }

          .rapor-description,
          .rapor-small,
          .rapor-notes {
            font-size: 9px !important;
            line-height: 1.4 !important;
          }

          .rapor-bottom {
            grid-template-columns:
              1fr 1fr !important;
          }

          .rapor-number strong {
            font-size: 19px !important;
          }

          .rapor-predikat-letter {
            width: 47px !important;
            height: 47px !important;
            font-size: 26px !important;
          }

          .rapor-sign-space {
            height: 28px !important;
          }
        }
      `}</style>

      <header className="rapor-topbar">
        <div className="rapor-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="rapor-button light"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="rapor-container">
        <section className="rapor-controls">
          <h2>Pengaturan Cetak Rapor OJT</h2>

          <p className="rapor-muted">
            Pilih periode laporan. Hanya minggu
            yang dipilih mentor yang dimasukkan
            ke dalam rapor.
          </p>

          <div className="rapor-modes">
            <label>
              <input
                type="radio"
                name="rapor-mode"
                checked={mode === "single"}
                onChange={() =>
                  setMode("single")
                }
              />
              Satu minggu
            </label>

            <label>
              <input
                type="radio"
                name="rapor-mode"
                checked={mode === "range"}
                onChange={() =>
                  setMode("range")
                }
              />
              Rentang beberapa minggu
            </label>

            <label>
              <input
                type="radio"
                name="rapor-mode"
                checked={mode === "custom"}
                onChange={() =>
                  setMode("custom")
                }
              />
              Pilih minggu tertentu
            </label>
          </div>

          {mode === "single" && (
            <div className="rapor-options">
              <div>
                <label>Pilih Minggu</label>

                <WeekSelector
                  value={singleWeek}
                  onChange={setSingleWeek}
                />
              </div>
            </div>
          )}

          {mode === "range" && (
            <div className="rapor-options">
              <div>
                <label>Dari Minggu</label>

                <WeekSelector
                  value={fromWeek}
                  onChange={week => {
                    setFromWeek(week);

                    if (toWeek < week) {
                      setToWeek(week);
                    }
                  }}
                />
              </div>

              <div>
                <label>Sampai Minggu</label>

                <WeekSelector
                  from={fromWeek}
                  value={toWeek}
                  onChange={setToWeek}
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="rapor-custom">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, index) => index + 1
              ).map(week => (
                <button
                  type="button"
                  key={week}
                  className={
                    customWeeks.includes(week)
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    toggleWeek(week)
                  }
                >
                  {pad(week)}
                </button>
              ))}
            </div>
          )}

          <p className="rapor-muted">
            <strong>
              {selectedWeeks.length} minggu dipilih:
            </strong>{" "}
            {selectedLabel ||
              "Belum ada minggu dipilih"}
          </p>

          {error && (
            <div className="rapor-error">
              {error}
            </div>
          )}

          <div className="rapor-actions">
            <button
              type="button"
              className="rapor-button light"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing
                ? "Memuat..."
                : "Refresh Data"}
            </button>

            <button
              type="button"
              className="rapor-button secondary"
              onClick={() =>
                setPreview(old => !old)
              }
            >
              {preview
                ? "Sembunyikan Pratinjau"
                : "Tampilkan Pratinjau"}
            </button>

            <button
              type="button"
              className="rapor-button"
              onClick={printReport}
              disabled={
                refreshing ||
                selectedWeeks.length === 0
              }
            >
              Cetak / Simpan PDF
            </button>
          </div>

          <p className="rapor-muted">
            Format cetak A4 Landscape. Predikat A–D
            menggunakan acuan rentang pada contoh
            rapor, bukan keputusan kelulusan resmi.
          </p>
        </section>

        {preview && selectedWeeks.length > 0 && (
          <article className="rapor-paper">
            <div className="rapor-header">
              <div className="rapor-company">
                BERAU <span>COAL</span>

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 400,
                    marginTop: 5,
                  }}
                >
                  EMERGENCY RESPONSE GROUP
                </div>
              </div>

              <div>
                <h1>RAPOR OJT</h1>
                <h2>ON THE JOB TRAINING</h2>

                <small>
                  PT BERAU COAL ·{" "}
                  {selectedWeeks.length} MINGGU
                </small>
              </div>

              <div className="rapor-emblem">
                OJT
                <br />
                TRAINING
              </div>
            </div>

            <div className="rapor-intro">
              <section className="rapor-box">
                <TableTitle>
                  DATA PESERTA
                </TableTitle>

                <div className="rapor-info">
                  <strong>Nama</strong>
                  <span>: {participantName}</span>

                  <strong>Site</strong>
                  <span>: {program.site || "—"}</span>

                  <strong>Jabatan</strong>
                  <span>: —</span>

                  <strong>Periode OJT</strong>
                  <span>
                    : {dateText(program.start_date)}
                    {" – "}
                    {dateText(program.end_date)}
                  </span>

                  <strong>Departemen</strong>
                  <span>
                    : {program.peserta?.department ||
                      "—"}
                  </span>

                  <strong>Periode Cetak</strong>
                  <span>: {selectedLabel}</span>
                </div>
              </section>

              <section className="rapor-box">
                <TableTitle>
                  KETERANGAN
                </TableTitle>

                <p className="rapor-description">
                  On The Job Training (OJT)
                  merupakan program pelatihan kerja
                  yang bertujuan untuk meningkatkan
                  kompetensi, pengetahuan, keterampilan
                  serta sikap kerja peserta melalui
                  pengalaman langsung di tempat kerja.
                </p>

                <p className="rapor-description">
                  Penilaian ini dilakukan untuk
                  mengetahui pencapaian peserta selama
                  mengikuti program OJT sesuai
                  standar yang ditetapkan perusahaan.
                </p>
              </section>
            </div>

            <section className="rapor-section">
              <TableTitle>
                1. PENILAIAN KOMPETENSI UTAMA
              </TableTitle>

              <div className="rapor-scroll">
                <table className="rapor-table rapor-competence">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ width: 28 }}>
                        NO
                      </th>

                      {TARGETS.map((target, index) => (
                        <th
                          key={target.key}
                          colSpan={3}
                          className="group"
                          style={{
                            background: COLORS[index],
                          }}
                        >
                          {target.title}
                        </th>
                      ))}
                    </tr>

                    <tr>
                      {TARGETS.map(target => (
                        <React.Fragment key={target.key}>
                          <th>TARGET</th>
                          <th>PENCAPAIAN</th>
                          <th>PERSENTASE</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>1</td>

                      {report.summary.map(item => (
                        <React.Fragment key={item.key}>
                          <td>
                            {fmt(item.totalTarget)}
                          </td>

                          <td>
                            {fmt(
                              item.realized,
                              item.key === "Fisik"
                                ? 3
                                : 0
                            )}
                          </td>

                          <td
                            style={{
                              color: item.achieved
                                ? "#087b46"
                                : "#c13940",
                              fontWeight: 900,
                            }}
                          >
                            {fmt(
                              item.percentage,
                              2
                            )}%
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="rapor-small">
                Fisik menggunakan satuan kilometer.
                Komponen lainnya dihitung berdasarkan
                jumlah kegiatan terverifikasi. Target
                disesuaikan dengan{" "}
                {selectedWeeks.length} minggu pilihan.
                Jumlah catatan Fisik:{" "}
                {runningCount}.
              </p>
            </section>

            <section className="rapor-section">
              <TableTitle>
                2. PENILAIAN PEMBELAJARAN MINGGUAN
              </TableTitle>

              {splitWeeks(report.weekly, 7).map(
                (weeks, index) => (
                  <div
                    key={index}
                    className="rapor-scroll"
                    style={{ marginBottom: 7 }}
                  >
                    <table className="rapor-table rapor-weektable">
                      <thead>
                        <tr>
                          <th style={{ width: 48 }}>
                            SITE
                          </th>

                          {weeks.map(item => (
                            <th key={item.week}>
                              WEEK {pad(item.week)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td>
                            {program.site || "—"}
                          </td>

                          {weeks.map(item => (
                            <td key={item.week}>
                              {item.tests.length ? (
                                item.tests.map(test => (
                                  <div
                                    className="rapor-score-item"
                                    key={test.id}
                                  >
                                    {test.notes?.trim() && (
                                      <div>
                                        {test.notes.trim()}
                                      </div>
                                    )}

                                    <strong>
                                      {fmt(
                                        numberOrNull(
                                          test.score
                                        ),
                                        2
                                      )}
                                    </strong>
                                  </div>
                                ))
                              ) : (
                                "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>

            <section className="rapor-section">
              <TableTitle>
                3. PENILAIAN PRAKTEK MINGGUAN
              </TableTitle>

              {splitWeeks(report.weekly, 7).map(
                (weeks, index) => (
                  <div
                    key={index}
                    className="rapor-scroll"
                    style={{ marginBottom: 7 }}
                  >
                    <table className="rapor-table rapor-weektable">
                      <thead>
                        <tr>
                          <th style={{ width: 48 }}>
                            SITE
                          </th>

                          {weeks.map(item => (
                            <th key={item.week}>
                              WEEK {pad(item.week)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        <tr>
                          <td>
                            {program.site || "—"}
                          </td>

                          {weeks.map(item => (
                            <td key={item.week}>
                              {item.practices.length ? (
                                item.practices.map(
                                  practice => (
                                    <div
                                      className="rapor-score-item"
                                      key={practice.id}
                                    >
                                      <div>
                                        {practice.practice_name ||
                                          "Praktek"}
                                      </div>

                                      <strong>
                                        {fmt(
                                          numberOrNull(
                                            practice.score
                                          ),
                                          2
                                        )}
                                      </strong>
                                    </div>
                                  )
                                )
                              ) : (
                                "—"
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </section>

            <section className="rapor-section">
              <TableTitle>
                4. VALIDASI DAN KETERANGAN
              </TableTitle>

              <div className="rapor-scroll">
                <table className="rapor-table">
                  <thead>
                    <tr>
                      <th>NAMA PERSONIL</th>
                      <th>KMKOP</th>
                      <th>VALIDASI</th>
                      <th>PRAKTEK</th>
                      <th>VALIDASI</th>
                      <th>ORIENTASI AREA</th>
                      <th>KETERANGAN</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>{participantName}</td>

                      <td>
                        {report.validation.kmkop}
                      </td>

                      <td>
                        {
                          report.validation
                            .kmkopValidation
                        }
                      </td>

                      <td>
                        {report.validation.practice}
                      </td>

                      <td>
                        {
                          report.validation
                            .practiceValidation
                        }
                      </td>

                      <td>
                        {report.validation.orientation}
                      </td>

                      <td>
                        Perlu konfirmasi validasi
                        persyaratan SIMPER.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="rapor-small">
                Status SIMPER menggunakan data terbaru
                yang tersedia. Riwayat tanggal validasi
                per minggu belum tersedia dalam struktur
                data ini. Status KMKOP tidak otomatis
                disamakan dengan administrasi.
              </p>
            </section>

            <div className="rapor-bottom">
              <section className="rapor-box">
                <TableTitle>
                  CATATAN
                </TableTitle>

                <div className="rapor-notes">
                  {report.unfinished.length > 0 ? (
                    <p>
                      Komponen yang belum memenuhi
                      target periode terpilih:{" "}
                      <strong>
                        {report.unfinished
                          .map(item =>
                            item.key === "Training"
                              ? "Internal Training"
                              : item.title
                          )
                          .join(", ")}
                      </strong>
                      .
                    </p>
                  ) : (
                    <p>
                      Seluruh target enam kompetensi
                      utama pada periode terpilih telah
                      terpenuhi.
                    </p>
                  )}

                  <p>
                    Nilai teori tercatat:{" "}
                    <strong>
                      {report.allTests.length}
                    </strong>
                    . Nilai praktek tercatat:{" "}
                    <strong>
                      {report.allPractices.length}
                    </strong>
                    .
                  </p>

                  <p>
                    Rapor hanya menampilkan data pada
                    minggu pilihan mentor. Ketiadaan
                    nilai atau catatan tidak otomatis
                    berarti peserta gagal.
                  </p>
                </div>
              </section>

              <section className="rapor-box">
                <TableTitle>
                  RINGKASAN HASIL
                </TableTitle>

                <div className="rapor-numbers">
                  <div className="rapor-number">
                    <span>NILAI TOTAL</span>

                    <strong>
                      {report.scoreCount
                        ? fmt(report.scoreTotal, 2)
                        : "—"}
                    </strong>
                  </div>

                  <div className="rapor-number">
                    <span>NILAI RATA-RATA</span>

                    <strong>
                      {fmt(
                        report.scoreAverage,
                        2
                      )}
                    </strong>
                  </div>
                </div>

                <div className="rapor-predikat">
                  <div className="rapor-predikat-letter">
                    {report.grade.letter}
                  </div>

                  <div>
                    <strong>
                      {report.grade.label}
                    </strong>

                    <p className="rapor-small">
                      Keterangan predikat (acuan
                      template):
                    </p>

                    <p className="rapor-small">
                      A = 85–100 (Sangat Baik)
                      <br />
                      B = 75–84,99 (Baik)
                      <br />
                      C = 60–74,99 (Cukup)
                      <br />
                      D = di bawah 60 (Kurang)
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <footer className="rapor-footer">
              <div>
                OJT MineTrack · PT Berau Coal
                <br />
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString(
                  "id-ID"
                )}
              </div>

              <div className="rapor-signature">
                Mengetahui,
                <br />
                Mentor / Penanggung Jawab

                <div className="rapor-sign-space" />

                __________________________
                <br />

                {profile.role === "mentor"
                  ? profile.full_name ||
                    "Nama Mentor"
                  : "Nama Mentor"}
              </div>
            </footer>
          </article>
        )}
      </div>
    </main>
  );
}
