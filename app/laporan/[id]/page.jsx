
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  {
    key: "Fisik",
    title: "FISIK",
    target: 25,
    unit: "km",
    color: "#d84542",
  },
  {
    key: "Training",
    title: "INTERNAL TRAINING",
    target: 4,
    unit: "kegiatan",
    color: "#e6a22f",
  },
  {
    key: "Sosialisasi",
    title: "SOSIALISASI",
    target: 3,
    unit: "kegiatan",
    color: "#d9b91b",
  },
  {
    key: "Orientasi Area",
    title: "ORIENTASI",
    target: 2,
    unit: "kegiatan",
    color: "#21834d",
  },
  {
    key: "Coaching",
    title: "COACHING",
    target: 1,
    unit: "kegiatan",
    color: "#199dc1",
  },
  {
    key: "Hazard",
    title: "HAZARD",
    target: 2,
    unit: "kegiatan",
    color: "#286bd0",
  },
];

const SIMPER_START = "[[SIMPER_V2]]";
const SIMPER_END = "[[/SIMPER_V2]]";

function pad(n) {
  return String(n).padStart(2, "0");
}

function normalize(value) {
  return String(value ?? "")
    .trim()
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
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function parseDate(value) {
  if (!value) return null;

  const source = String(value).slice(0, 10);
  const match = source.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const result = new Date(
    Date.UTC(year, month - 1, day)
  );

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

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) /
      86400000
  );

  const week = Math.floor(days / 7) + 1;

  if (week < 1 || week > TOTAL_WEEKS) {
    return null;
  }

  return week;
}

function readSimperMeta(notes) {
  const text = String(notes ?? "");

  const start = text.lastIndexOf(SIMPER_START);
  const end = text.lastIndexOf(SIMPER_END);

  if (start < 0 || end <= start) {
    return null;
  }

  try {
    const raw = text.slice(
      start + SIMPER_START.length,
      end
    );

    const parsed = JSON.parse(raw);

    return parsed?.version === 2
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function getPredikat(average) {
  if (average === null) {
    return {
      letter: "—",
      label: "BELUM ADA NILAI",
    };
  }

  if (average >= 85) {
    return {
      letter: "A",
      label: "SANGAT BAIK",
    };
  }

  if (average >= 75) {
    return {
      letter: "B",
      label: "BAIK",
    };
  }

  if (average >= 60) {
    return {
      letter: "C",
      label: "CUKUP",
    };
  }

  return {
    letter: "D",
    label: "KURANG",
  };
}

function groupWeeks(items, size = 7) {
  const result = [];

  for (
    let index = 0;
    index < items.length;
    index += size
  ) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function WeekSelector({
  value,
  onChange,
  from = 1,
}) {
  const options = Array.from(
    {
      length: TOTAL_WEEKS - from + 1,
    },
    (_, index) => index + from
  );

  return (
    <select
      className="rp-select"
      value={value}
      onChange={(event) =>
        onChange(Number(event.target.value))
      }
    >
      {options.map((week) => (
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

function ScoreCell({ items, type }) {
  if (!items?.length) {
    return <span>—</span>;
  }

  return (
    <div className="rp-scores">
      {items.map((item, index) => {
        const name =
          type === "practice"
            ? item.practice_name
            : item.notes;

        const score = numberOrNull(item.score);

        return (
          <div
            className="rp-score"
            key={item.id ?? index}
          >
            {name &&
              String(name).trim() && (
                <div className="rp-score-name">
                  {String(name).trim()}
                </div>
              )}

            <strong>{fmt(score, 2)}</strong>
          </div>
        );
      })}
    </div>
  );
}

async function getRecords(programId) {
  const results = await Promise.all([
    supabase
      .from("achievement_types")
      .select("code,name"),

    supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,description,distance_km,status"
      )
      .eq("program_id", programId),

    supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes")
      .eq("program_id", programId),

    supabase
      .from("weekly_practice_scores")
      .select(
        "id,practice_date,practice_name,score"
      )
      .eq("program_id", programId),

    supabase
      .from("simper_records")
      .select(
        "id,administration_status,theory_status,practice_status,status,graduation_date,notes"
      )
      .eq("program_id", programId)
      .maybeSingle(),
  ]);

  const labels = [
    "Kategori kegiatan",
    "Pencapaian",
    "Nilai teori",
    "Nilai praktik",
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
    types: results[0].data ?? [],
    achievements: results[1].data ?? [],
    theory: results[2].data ?? [],
    practices: results[3].data ?? [],
    simper: results[4].data ?? null,
  };
}

export default function RaporOJTPage() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const [mode, setMode] = useState("range");

  const [singleWeek, setSingleWeek] =
    useState(1);

  const [fromWeek, setFromWeek] = useState(1);
  const [toWeek, setToWeek] = useState(1);

  const [customWeeks, setCustomWeeks] =
    useState([1]);

  const [preview, setPreview] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!programId) {
        setError("ID program tidak tersedia.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const {
          data: authData,
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authData?.user) {
          router.replace("/login");
          return;
        }

        const userId = authData.user.id;

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("id,role,full_name")
          .eq("id", userId)
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
            "Akun tidak memiliki akses ke rapor."
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
            userId
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
            "Tanggal mulai program OJT belum valid."
          );
        }

        const records = await getRecords(
          programId
        );

        if (!active) return;

        setData({
          profile,
          program,
          ...records,
        });
      } catch (err) {
        if (active) {
          setError(
            err?.message ??
              "Terjadi kesalahan saat memuat rapor."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  async function refreshData() {
    if (!data || refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      const records = await getRecords(
        data.program.id
      );

      setData((previous) => ({
        ...previous,
        ...records,
      }));
    } catch (err) {
      setError(
        err?.message ??
          "Gagal memperbarui data."
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
      const weeks = [];

      for (
        let week = fromWeek;
        week <= toWeek;
        week++
      ) {
        weeks.push(week);
      }

      return weeks;
    }

    return [...new Set(customWeeks)]
      .filter(
        (week) =>
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

  function toggleCustomWeek(week) {
    setCustomWeeks((previous) => {
      if (previous.includes(week)) {
        return previous.filter(
          (item) => item !== week
        );
      }

      return [...previous, week];
    });
  }

  const report = useMemo(() => {
    if (!data) return null;

    const {
      program,
      types,
      achievements,
      theory,
      practices,
      simper,
    } = data;

    const typeMap = new Map();

    types.forEach((item) => {
      if (item.name) {
        typeMap.set(
          normalize(item.name),
          item.code
        );
      }

      if (item.code) {
        typeMap.set(
          normalize(item.code),
          item.code
        );
      }
    });

    function categoryCode(key) {
      if (key === "Training") {
        return (
          typeMap.get("training") ??
          typeMap.get("internaltraining") ??
          null
        );
      }

      return typeMap.get(normalize(key)) ?? null;
    }

    const weekly = selectedWeeks.map(
      (weekNumber) => {
        const weekAchievements =
          achievements.filter(
            (item) =>
              weekOf(
                item.activity_date,
                program.start_date
              ) === weekNumber
          );

        const competency = TARGETS.map(
          (target) => {
            const code = categoryCode(
              target.key
            );

            const matching = code
              ? weekAchievements.filter(
                  (item) =>
                    item.type_code === code
                )
              : [];

            const verified = matching.filter(
              (item) =>
                item.status === "verified"
            );

            let realized = 0;

            if (target.key === "Fisik") {
              const totalMeters =
                verified.reduce(
                  (sum, item) =>
                    sum +
                    Math.round(
                      (
                        numberOrNull(
                          item.distance_km
                        ) ?? 0
                      ) * 1000
                    ),
                  0
                );

              realized = totalMeters / 1000;
            } else {
              realized = verified.length;
            }

            return {
              ...target,
              realized,
              recorded: matching.length,
            };
          }
        );

        const weekTheory = theory.filter(
          (item) =>
            weekOf(
              item.test_date,
              program.start_date
            ) === weekNumber
        );

        const weekPractices =
          practices.filter(
            (item) =>
              weekOf(
                item.practice_date,
                program.start_date
              ) === weekNumber
          );

        return {
          week: weekNumber,
          competency,
          theory: weekTheory,
          practices: weekPractices,
        };
      }
    );

    const competencySummary = TARGETS.map(
      (target) => {
        const entries = weekly.map(
          (week) =>
            week.competency.find(
              (item) =>
                item.key === target.key
            )
        );

        let realized;

        if (target.key === "Fisik") {
          const totalMeters = entries.reduce(
            (sum, item) =>
              sum +
              Math.round(
                item.realized * 1000
              ),
            0
          );

          realized = totalMeters / 1000;
        } else {
          realized = entries.reduce(
            (sum, item) =>
              sum + item.realized,
            0
          );
        }

        const totalTarget =
          target.target *
          selectedWeeks.length;

        const percentage =
          totalTarget > 0
            ? (realized / totalTarget) * 100
            : 0;

        return {
          ...target,
          realized,
          totalTarget,
          percentage,
          achieved:
            totalTarget > 0 &&
            realized >= totalTarget,
          hasData: entries.some(
            (item) => item.recorded > 0
          ),
        };
      }
    );

    const allTheory = weekly.flatMap(
      (week) => week.theory
    );

    const allPractices = weekly.flatMap(
      (week) => week.practices
    );

    const scores = [
      ...allTheory,
      ...allPractices,
    ]
      .map((item) =>
        numberOrNull(item.score)
      )
      .filter((value) => value !== null);

    const scoreTotal = scores.reduce(
      (sum, value) => sum + value,
      0
    );

    const scoreAverage =
      scores.length > 0
        ? scoreTotal / scores.length
        : null;

    const simperMeta = readSimperMeta(
      simper?.notes
    );

    const practiceValidated =
      simper?.practice_status === "passed";

    const orientationValidated =
      simperMeta?.orientation_status ===
      "completed";

    const validation = {
      kmkop: "Belum terkonfirmasi",
      kmkopValidation:
        "Belum terkonfirmasi",

      practice: practiceValidated
        ? "LULUS"
        : "Belum terkonfirmasi",

      practiceValidation:
        practiceValidated
          ? "Sesuai data sistem"
          : "Belum terkonfirmasi",

      orientation: orientationValidated
        ? "SELESAI"
        : "Belum terkonfirmasi",

      description:
        "Status merupakan data SIMPER terakhir. Riwayat validasi per minggu belum tersedia.",
    };

    const incompleteCompetencies =
      competencySummary.filter(
        (item) => !item.achieved
      );

    return {
      weekly,
      competencySummary,
      allTheory,
      allPractices,
      scoreTotal,
      scoreAverage,
      scoreCount: scores.length,
      predikat: getPredikat(scoreAverage),
      validation,
      incompleteCompetencies,
    };
  }, [data, selectedWeeks]);

  function printReport() {
    if (!selectedWeeks.length) return;

    if (!preview) {
      setPreview(true);

      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  }

  if (loading) {
    return (
      <main className="rp-loading">
        Memuat data Rapor OJT...
      </main>
    );
  }

  if (!data || !report) {
    return (
      <main className="rp-loading">
        <h2>Rapor Tidak Dapat Ditampilkan</h2>

        <p>
          {error ||
            "Data rapor belum tersedia."}
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
    program.peserta?.full_name ??
    "Peserta OJT";

  const department =
    program.peserta?.department ?? "—";

  const site = program.site ?? "—";

  const selectedLabel =
    selectedWeeks.map(
      (week) => `Week ${pad(week)}`
    ).join(", ");

  const backPath =
    profile.role === "mentor"
      ? `/peserta/${programId}`
      : "/dashboard-peserta";

  const fisikData =
    report.competencySummary.find(
      (item) => item.key === "Fisik"
    );

  return (
    <main className="rp-root">
      <style>{`
        .rp-root,
        .rp-root * {
          box-sizing: border-box;
        }

        .rp-root {
          min-height: 100vh;
          background: #eef3f4;
          color: #163047;
          font-family: Arial, sans-serif;
          font-size: 12px;
        }

        .rp-loading {
          padding: 25px;
          font-family: Arial, sans-serif;
          color: #17334a;
        }

        .rp-topbar {
          background: #082f39;
          color: white;
          padding: 15px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .rp-brand {
          font-size: 21px;
          font-weight: 900;
        }

        .rp-brand span {
          color: #36c98e;
        }

        .rp-container {
          max-width: 1250px;
          margin: 0 auto;
          padding: 15px;
        }

        .rp-controls {
          background: white;
          border: 1px solid #d6e2e5;
          border-radius: 12px;
          padding: 18px;
          margin-bottom: 16px;
        }

        .rp-controls h2 {
          font-size: 21px;
          margin: 0 0 8px;
        }

        .rp-muted {
          font-size: 11px;
          color: #667c8a;
          line-height: 1.6;
        }

        .rp-modes {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          margin: 18px 0;
        }

        .rp-modes label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-weight: 700;
          cursor: pointer;
        }

        .rp-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          max-width: 620px;
          gap: 12px;
        }

        .rp-field-label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .rp-select {
          width: 100%;
          background: white;
          border: 1px solid #c9d7dc;
          border-radius: 8px;
          padding: 11px;
          color: #163047;
          font-size: 14px;
        }

        .rp-custom-grid {
          display: grid;
          grid-template-columns:
            repeat(13, minmax(0, 1fr));
          gap: 5px;
        }

        .rp-week-button {
          border: 1px solid #cbd8da;
          border-radius: 6px;
          background: white;
          padding: 9px 2px;
          cursor: pointer;
          color: #163047;
        }

        .rp-week-button.active {
          background: #078459;
          color: white;
          border-color: #078459;
        }

        .rp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .rp-button {
          background: #087e59;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 11px 14px;
          cursor: pointer;
          font-weight: 800;
          font-size: 12px;
        }

        .rp-button.secondary {
          background: #173e68;
        }

        .rp-button.light {
          background: #e6f2ec;
          color: #116d49;
        }

        .rp-button:disabled {
          cursor: not-allowed;
          opacity: .5;
        }

        .rp-error {
          background: #fff0f0;
          border: 1px solid #f1c9ca;
          color: #a3272e;
          border-radius: 7px;
          padding: 10px;
          margin-top: 10px;
        }

        .rp-paper {
          background: white;
          border: 1px solid #c5d2dc;
          box-shadow: 0 5px 20px #12345612;
          padding: 18px;
        }

        .rp-header {
          display: grid;
          grid-template-columns: 1fr 2fr 1fr;
          align-items: center;
          gap: 12px;
          padding: 13px 10px;
          border-top: 5px solid #168b40;
          border-bottom: 5px solid #102c63;
          text-align: center;
        }

        .rp-company {
          font-size: 22px;
          font-weight: 900;
          color: #102b48;
          text-align: left;
        }

        .rp-company span {
          color: #189349;
        }

        .rp-header h1 {
          color: #0a2c62;
          font-size: 34px;
          margin: 0;
          line-height: 1.15;
        }

        .rp-header h2 {
          font-size: 15px;
          color: #14803b;
          margin: 4px 0 8px;
        }

        .rp-header small {
          display: block;
          background: #0c2f64;
          color: white;
          padding: 5px;
          font-size: 10px;
        }

        .rp-emblem {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 3px solid #d6b452;
          display: grid;
          place-items: center;
          font-weight: 900;
          justify-self: center;
          color: #0c2f64;
          text-align: center;
        }

        .rp-intro {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 12px 0;
        }

        .rp-box {
          border: 1px solid #9eafbf;
          border-radius: 5px;
          padding: 11px;
          min-width: 0;
        }

        .rp-section-title {
          display: inline-block;
          background: #0a2b61;
          color: white;
          font-weight: 900;
          font-size: 11px;
          padding: 6px 12px;
          margin-bottom: 7px;
        }

        .rp-info {
          display: grid;
          grid-template-columns: 108px 1fr;
          gap: 6px;
          line-height: 1.5;
        }

        .rp-description {
          font-size: 11px;
          line-height: 1.7;
          margin: 4px 0 9px;
        }

        .rp-section {
          margin: 14px 0;
          break-inside: avoid-page;
        }

        .rp-table-scroll {
          overflow-x: auto;
          max-width: 100%;
        }

        .rp-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 10px;
        }

        .rp-table th,
        .rp-table td {
          border: 1px solid #bdcbd6;
          padding: 6px 4px;
          text-align: center;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }

        .rp-table th {
          background: #edf1f6;
        }

        .rp-competency th {
          font-size: 9px;
        }

        .rp-competency .rp-group {
          color: white;
          font-weight: 900;
        }

        .rp-week-table td {
          vertical-align: top;
        }

        .rp-score {
          padding: 4px 1px;
          border-bottom: 1px solid #e9edf2;
          line-height: 1.5;
        }

        .rp-score:last-child {
          border-bottom: none;
        }

        .rp-score-name {
          font-size: 9px;
          margin-bottom: 3px;
        }

        .rp-small {
          font-size: 10px;
          color: #687c8d;
          line-height: 1.5;
          margin: 6px 0;
        }

        .rp-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }

        .rp-notes {
          font-size: 11px;
          line-height: 1.7;
        }

        .rp-numbers {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 8px 0;
        }

        .rp-number {
          background: #f7fafc;
          border: 1px solid #dce5ed;
          padding: 12px;
          text-align: center;
        }

        .rp-number span {
          display: block;
          font-size: 10px;
        }

        .rp-number strong {
          display: block;
          font-size: 25px;
          margin-top: 6px;
          color: #0d3061;
        }

        .rp-predikat {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-top: 11px;
        }

        .rp-grade {
          display: grid;
          place-items: center;
          width: 75px;
          height: 75px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 3px solid #168a49;
          color: #0b7c3f;
          font-weight: 900;
          font-size: 35px;
        }

        .rp-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 15px;
          margin-top: 18px;
          color: #66798a;
          font-size: 10px;
        }

        .rp-signature {
          text-align: center;
          min-width: 190px;
        }

        .rp-sign-space {
          height: 44px;
        }

        @media (max-width: 700px) {
          .rp-container {
            padding: 8px;
          }

          .rp-controls {
            padding: 13px;
          }

          .rp-controls h2 {
            font-size: 18px;
          }

          .rp-modes {
            flex-direction: column;
            gap: 12px;
          }

          .rp-custom-grid {
            grid-template-columns:
              repeat(5, minmax(0, 1fr));
          }

          .rp-actions .rp-button {
            flex: 1;
          }

          .rp-paper {
            padding: 9px;
          }

          .rp-header {
            grid-template-columns: 1fr 2fr;
            gap: 7px;
          }

          .rp-company {
            font-size: 13px;
          }

          .rp-header h1 {
            font-size: 23px;
          }

          .rp-header h2 {
            font-size: 11px;
          }

          .rp-emblem {
            display: none;
          }

          .rp-intro,
          .rp-bottom {
            grid-template-columns: 1fr;
          }

          .rp-info {
            grid-template-columns: 90px 1fr;
          }

          .rp-competency {
            min-width: 800px;
          }

          .rp-week-table {
            min-width: 520px;
          }
        }

        @page {
          size: A4 landscape;
          margin: 8mm;
        }

        @media print {
          html,
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .rp-topbar,
          .rp-controls {
            display: none !important;
          }

          .rp-root {
            background: white !important;
            min-height: 0 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .rp-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          .rp-paper {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .rp-header {
            grid-template-columns:
              1fr 2fr 1fr !important;
            padding: 8px !important;
          }

          .rp-company {
            font-size: 18px !important;
          }

          .rp-header h1 {
            font-size: 28px !important;
          }

          .rp-header h2 {
            font-size: 13px !important;
          }

          .rp-emblem {
            display: grid !important;
            width: 58px !important;
            height: 58px !important;
            font-size: 10px !important;
          }

          .rp-intro,
          .rp-bottom {
            grid-template-columns:
              1fr 1fr !important;
            gap: 9px !important;
          }

          .rp-box {
            padding: 7px !important;
          }

          .rp-section {
            margin: 9px 0 !important;
          }

          .rp-section-title {
            font-size: 9px !important;
            padding: 5px 10px !important;
          }

          .rp-table-scroll {
            overflow: visible !important;
          }

          .rp-table,
          .rp-competency,
          .rp-week-table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 8px !important;
          }

          .rp-table th,
          .rp-table td {
            padding: 4px 2px !important;
          }

          .rp-description,
          .rp-small,
          .rp-notes {
            font-size: 9px !important;
            line-height: 1.4 !important;
          }

          .rp-number strong {
            font-size: 19px !important;
          }

          .rp-grade {
            width: 50px !important;
            height: 50px !important;
            font-size: 26px !important;
          }

          .rp-sign-space {
            height: 27px !important;
          }
        }
      `}</style>

      <header className="rp-topbar">
        <div className="rp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="rp-button light"
          onClick={() => router.push(backPath)}
        >
          ← Kembali
        </button>
      </header>

      <div className="rp-container">
        <section className="rp-controls">
          <h2>Pengaturan Cetak Rapor OJT</h2>

          <p className="rp-muted">
            Pilih minggu yang ingin ditampilkan.
            Seluruh penilaian dan target akan
            mengikuti minggu yang dipilih.
          </p>

          <div className="rp-modes">
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
              Rentang minggu
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
              Minggu tertentu
            </label>
          </div>

          {mode === "single" && (
            <div className="rp-options">
              <div>
                <label className="rp-field-label">
                  Pilih Minggu
                </label>

                <WeekSelector
                  value={singleWeek}
                  onChange={setSingleWeek}
                />
              </div>
            </div>
          )}

          {mode === "range" && (
            <div className="rp-options">
              <div>
                <label className="rp-field-label">
                  Dari Minggu
                </label>

                <WeekSelector
                  value={fromWeek}
                  onChange={(week) => {
                    setFromWeek(week);

                    if (toWeek < week) {
                      setToWeek(week);
                    }
                  }}
                />
              </div>

              <div>
                <label className="rp-field-label">
                  Sampai Minggu
                </label>

                <WeekSelector
                  from={fromWeek}
                  value={toWeek}
                  onChange={setToWeek}
                />
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="rp-custom-grid">
              {Array.from(
                { length: TOTAL_WEEKS },
                (_, index) => index + 1
              ).map((week) => (
                <button
                  key={week}
                  type="button"
                  className={
                    "rp-week-button " +
                    (
                      customWeeks.includes(week)
                        ? "active"
                        : ""
                    )
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

          <p className="rp-muted">
            <strong>
              {selectedWeeks.length} minggu:
            </strong>{" "}
            {selectedLabel ||
              "Belum ada minggu dipilih"}
          </p>

          {error && (
            <div className="rp-error">
              {error}
            </div>
          )}

          <div className="rp-actions">
            <button
              type="button"
              className="rp-button light"
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
                setPreview((previous) => !previous)
              }
            >
              {preview
                ? "Sembunyikan Pratinjau"
                : "Tampilkan Pratinjau"}
            </button>

            <button
              type="button"
              className="rp-button"
              onClick={printReport}
              disabled={
                refreshing ||
                selectedWeeks.length === 0
              }
            >
              Cetak / Simpan PDF
            </button>
          </div>

          <p className="rp-muted">
            Format A4 Landscape. Predikat A–D
            mengikuti acuan pada foto rapor,
            bukan keputusan kelulusan resmi.
          </p>
        </section>

        {preview &&
          selectedWeeks.length > 0 && (
          <article className="rp-paper">
            <div className="rp-header">
              <div className="rp-company">
                BERAU <span>COAL</span>
              </div>

              <div>
                <h1>RAPOR OJT</h1>

                <h2>
                  ON THE JOB TRAINING
                </h2>

                <small>
                  PT. BERAU COAL
                </small>
              </div>

              <div className="rp-emblem">
                OJT
                <br />
                TRAINING
              </div>
            </div>

            <div className="rp-intro">
              <section className="rp-box">
                <SectionTitle>
                  DATA PESERTA
                </SectionTitle>

                <div className="rp-info">
                  <strong>Nama</strong>
                  <span>
                    : {participantName}
                  </span>

                  <strong>Site</strong>
                  <span>: {site}</span>

                  <strong>Jabatan</strong>
                  <span>: —</span>

                  <strong>Periode OJT</strong>
                  <span>
                    : {dateText(
                      program.start_date
                    )}
                    {" – "}
                    {dateText(
                      program.end_date
                    )}
                  </span>

                  <strong>Departemen</strong>
                  <span>
                    : {department}
                  </span>

                  <strong>Minggu Rapor</strong>
                  <span>
                    : {selectedLabel}
                  </span>
                </div>
              </section>

              <section className="rp-box">
                <SectionTitle>
                  KETERANGAN
                </SectionTitle>

                <p className="rp-description">
                  On The Job Training (OJT)
                  merupakan program pelatihan
                  kerja yang bertujuan untuk
                  meningkatkan kompetensi,
                  pengetahuan, keterampilan
                  serta sikap kerja peserta
                  melalui pengalaman langsung
                  di tempat kerja.
                </p>

                <p className="rp-description">
                  Penilaian ini dilakukan untuk
                  mengetahui pencapaian peserta
                  selama mengikuti program OJT
                  sesuai standar yang ditetapkan
                  perusahaan.
                </p>
              </section>
            </div>

            <section className="rp-section">
              <SectionTitle>
                1. PENILAIAN KOMPETENSI UTAMA
              </SectionTitle>

              <div className="rp-table-scroll">
                <table className="rp-table rp-competency">
                  <thead>
                    <tr>
                      <th rowSpan={2}>
                        NO
                      </th>

                      {TARGETS.map((target) => (
                        <th
                          key={target.key}
                          colSpan={3}
                          className="rp-group"
                          style={{
                            background:
                              target.color,
                          }}
                        >
                          {target.title}
                        </th>
                      ))}
                    </tr>

                    <tr>
                      {TARGETS.map((target) => (
                        <React.Fragment
                          key={target.key}
                        >
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

                      {report.competencySummary.map(
                        (item) => (
                          <React.Fragment
                            key={item.key}
                          >
                            <td>
                              {fmt(
                                item.totalTarget
                              )}
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
                                color:
                                  item.achieved
                                    ? "#087b43"
                                    : "#c33740",
                                fontWeight: 900,
                              }}
                            >
                              {fmt(
                                item.percentage,
                                2
                              )}%
                            </td>
                          </React.Fragment>
                        )
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="rp-small">
                Target dihitung berdasarkan{" "}
                {selectedWeeks.length} minggu.
                Fisik menggunakan kilometer,
                sedangkan kompetensi lainnya
                menggunakan jumlah kegiatan
                terverifikasi.
                {fisikData && (
                  <>
                    {" "}Realisasi fisik:{" "}
                    {fmt(
                      fisikData.realized,
                      3
                    )} km.
                  </>
                )}
              </p>
            </section>

            <section className="rp-section">
              <SectionTitle>
                2. PENILAIAN PEMBELAJARAN MINGGUAN
              </SectionTitle>

              {groupWeeks(
                report.weekly,
                7
              ).map((weeks, index) => (
                <div
                  className="rp-table-scroll"
                  key={index}
                  style={{
                    marginBottom: 8,
                  }}
                >
                  <table className="rp-table rp-week-table">
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: 48,
                          }}
                        >
                          SITE
                        </th>

                        {weeks.map(
                          (item) => (
                            <th
                              key={item.week}
                            >
                              WEEK{" "}
                              {pad(item.week)}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>{site}</td>

                        {weeks.map(
                          (item) => (
                            <td
                              key={item.week}
                            >
                              <ScoreCell
                                items={
                                  item.theory
                                }
                                type="theory"
                              />
                            </td>
                          )
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            <section className="rp-section">
              <SectionTitle>
                3. PENILAIAN PRAKTEK MINGGUAN
              </SectionTitle>

              {groupWeeks(
                report.weekly,
                7
              ).map((weeks, index) => (
                <div
                  className="rp-table-scroll"
                  key={index}
                  style={{
                    marginBottom: 8,
                  }}
                >
                  <table className="rp-table rp-week-table">
                    <thead>
                      <tr>
                        <th
                          style={{
                            width: 48,
                          }}
                        >
                          SITE
                        </th>

                        {weeks.map(
                          (item) => (
                            <th
                              key={item.week}
                            >
                              WEEK{" "}
                              {pad(item.week)}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td>{site}</td>

                        {weeks.map(
                          (item) => (
                            <td
                              key={item.week}
                            >
                              <ScoreCell
                                items={
                                  item.practices
                                }
                                type="practice"
                              />
                            </td>
                          )
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </section>

            <section className="rp-section">
              <SectionTitle>
                4. VALIDASI DAN KETERANGAN
              </SectionTitle>

              <div className="rp-table-scroll">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th>
                        NAMA PERSONIL
                      </th>

                      <th>KMKOP</th>
                      <th>VALIDASI</th>
                      <th>PRAKTEK</th>
                      <th>VALIDASI</th>
                      <th>
                        ORIENTASI AREA
                      </th>
                      <th>KETERANGAN</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>
                        {participantName}
                      </td>

                      <td>
                        {
                          report.validation
                            .kmkop
                        }
                      </td>

                      <td>
                        {
                          report.validation
                            .kmkopValidation
                        }
                      </td>

                      <td>
                        {
                          report.validation
                            .practice
                        }
                      </td>

                      <td>
                        {
                          report.validation
                            .practiceValidation
                        }
                      </td>

                      <td>
                        {
                          report.validation
                            .orientation
                        }
                      </td>

                      <td>
                        {
                          report.validation
                            .description
                        }
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="rp-small">
                Data SIMPER menampilkan status
                terbaru yang tersedia dan
                belum dapat dipastikan sebagai
                status historis pada minggu
                yang dipilih.
              </p>
            </section>

            <div className="rp-bottom">
              <section className="rp-box">
                <SectionTitle>
                  CATATAN
                </SectionTitle>

                <div className="rp-notes">
                  {report.incompleteCompetencies
                    .length > 0 ? (
                    <p>
                      Kompetensi yang belum
                      mencapai target pada
                      periode pilihan:{" "}
                      <strong>
                        {report.incompleteCompetencies
                          .map(
                            (item) =>
                              item.title
                          )
                          .join(", ")}
                      </strong>
                      .
                    </p>
                  ) : (
                    <p>
                      Seluruh target kompetensi
                      utama pada periode terpilih
                      telah terpenuhi.
                    </p>
                  )}

                  <p>
                    Jumlah penilaian teori
                    tercatat:{" "}
                    <strong>
                      {
                        report.allTheory
                          .length
                      }
                    </strong>
                    . Jumlah penilaian
                    praktek tercatat:{" "}
                    <strong>
                      {
                        report.allPractices
                          .length
                      }
                    </strong>
                    .
                  </p>

                  <p>
                    Kegiatan dan nilai yang
                    belum tercatat tidak
                    otomatis dinyatakan gagal.
                    Mentor perlu melanjutkan
                    monitoring dan validasi.
                  </p>
                </div>
              </section>

              <section className="rp-box">
                <SectionTitle>
                  RINGKASAN HASIL
                </SectionTitle>

                <div className="rp-numbers">
                  <div className="rp-number">
                    <span>
                      NILAI TOTAL
                    </span>

                    <strong>
                      {report.scoreCount
                        ? fmt(
                            report.scoreTotal,
                            2
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div className="rp-number">
                    <span>
                      NILAI RATA-RATA
                    </span>

                    <strong>
                      {fmt(
                        report.scoreAverage,
                        2
                      )}
                    </strong>
                  </div>
                </div>

                <div className="rp-predikat">
                  <div className="rp-grade">
                    {
                      report.predikat
                        .letter
                    }
                  </div>

                  <div>
                    <strong>
                      {
                        report.predikat
                          .label
                      }
                    </strong>

                    <p className="rp-small">
                      KETERANGAN PREDIKAT
                    </p>

                    <p className="rp-small">
                      85–100 = A
                      (Sangat Baik)
                      <br />
                      75–84,99 = B
                      (Baik)
                      <br />
                      60–74,99 = C
                      (Cukup)
                      <br />
                      Di bawah 60 = D
                      (Kurang)
                    </p>
                  </div>
                </div>

                <p className="rp-small">
                  Nilai total merupakan
                  penjumlahan nilai teori dan
                  praktek yang tersedia pada
                  minggu pilihan. Predikat
                  menggunakan acuan template.
                </p>
              </section>
            </div>

            <footer className="rp-footer">
              <div>
                OJT MineTrack · PT Berau Coal
                <br />
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString(
                  "id-ID"
                )}
              </div>

              <div className="rp-signature">
                Mengetahui,
                <br />
                Mentor / Penanggung Jawab

                <div className="rp-sign-space" />

                __________________________
                <br />

                {profile.role === "mentor"
                  ? profile.full_name ??
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
