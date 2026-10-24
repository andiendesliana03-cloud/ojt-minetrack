
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

const COLORS = {
  theory: "#2563eb",
  practice: "#0c9870",
  a: "#2563eb",
  b: "#e59a36",
  final: "#0c9870",
};

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

  const [y, m, d] = parts;
  const result = new Date(Date.UTC(y, m - 1, d));

  if (
    result.getUTCFullYear() !== y ||
    result.getUTCMonth() !== m - 1 ||
    result.getUTCDate() !== d
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

  return days < 0
    ? null
    : Math.floor(days / 7) + 1;
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function average(records) {
  const values = records
    .map((record) => {
      if (
        record.score === null ||
        record.score === undefined ||
        record.score === ""
      ) {
        return null;
      }

      const value = Number(record.score);

      return Number.isFinite(value)
        ? value
        : null;
    })
    .filter((value) => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function scoreText(value) {
  return value == null
    ? "—"
    : Number(value).toFixed(2);
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function calculateSamapta(records) {
  const byDate = new Map();

  records.forEach((record) => {
    if (!record.test_date) return;

    if (!byDate.has(record.test_date)) {
      byDate.set(record.test_date, []);
    }

    byDate.get(record.test_date).push(record);
  });

  const results = [];

  byDate.forEach((items, date) => {
    const get = (name) => {
      const record = items.find(
        (item) =>
          normalize(item.test_type) === normalize(name)
      );

      if (
        !record ||
        record.score === null ||
        record.score === undefined ||
        record.score === ""
      ) {
        return null;
      }

      const value = Number(record.score);

      return Number.isFinite(value)
        ? value
        : null;
    };

    const a = get("Lari 12 Menit");

    const components = [
      get("Pull-Up"),
      get("Push-Up"),
      get("Sit-Up"),
      get("Shuttle Run"),
    ];

    if (
      a === null ||
      components.some((value) => value === null)
    ) {
      return;
    }

    const b =
      components.reduce(
        (sum, value) => sum + value,
        0
      ) / 4;

    results.push({
      date,
      a,
      b,
      final: (a + b) / 2,
    });
  });

  return results.sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

function buildWeeklyData(
  startDate,
  postTests,
  practice,
  samaptaResults
) {
  const weeks = Array.from(
    { length: TOTAL_WEEKS },
    (_, index) => ({
      week: index + 1,
      theory: null,
      practice: null,
      a: null,
      b: null,
      final: null,
    })
  );

  const postByWeek = new Map();
  const practiceByWeek = new Map();

  postTests.forEach((item) => {
    const week = weekOf(
      item.test_date,
      startDate
    );

    if (!week || week > TOTAL_WEEKS) return;

    if (!postByWeek.has(week)) {
      postByWeek.set(week, []);
    }

    postByWeek.get(week).push(item);
  });

  practice.forEach((item) => {
    const week = weekOf(
      item.practice_date,
      startDate
    );

    if (!week || week > TOTAL_WEEKS) return;

    if (!practiceByWeek.has(week)) {
      practiceByWeek.set(week, []);
    }

    practiceByWeek.get(week).push(item);
  });

  weeks.forEach((item) => {
    item.theory = average(
      postByWeek.get(item.week) || []
    );

    item.practice = average(
      practiceByWeek.get(item.week) || []
    );
  });

  samaptaResults.forEach((item) => {
    const week = weekOf(item.date, startDate);

    if (!week || week > TOTAL_WEEKS) return;

    const target = weeks[week - 1];

    target.a = item.a;
    target.b = item.b;
    target.final = item.final;
  });

  return weeks;
}

function latestValue(data, key) {
  const available = data.filter(
    (item) => item[key] != null
  );

  return available.length
    ? available[available.length - 1][key]
    : null;
}

function TrendChart({ data, series }) {
  const width = 740;
  const height = 290;

  const left = 47;
  const right = 16;
  const top = 20;
  const bottom = 43;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const x = (week) =>
    left + ((week - 1) / 24) * innerWidth;

  const y = (value) =>
    top + ((100 - value) / 100) * innerHeight;

  const ticks = [0, 25, 50, 75, 100];
  const weekTicks = [1, 5, 9, 13, 17, 21, 25];

  const hasData = series.some((item) =>
    data.some(
      (point) => point[item.key] != null
    )
  );

  return (
    <div className="gr-chart-wrap">
      <div className="gr-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i
              style={{
                background: item.color,
              }}
            />
            {item.name}
          </span>
        ))}
      </div>

      <svg
        className="gr-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Grafik perkembangan nilai sepanjang 25 minggu"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e6eee9"
              strokeDasharray="4 5"
            />
            <text
              x={left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#81938a"
            >
              {tick}
            </text>
          </g>
        ))}

        {weekTicks.map((week) => (
          <text
            key={week}
            x={x(week)}
            y={height - 14}
            textAnchor="middle"
            fontSize="12"
            fill="#81938a"
          >
            W{week}
          </text>
        ))}

        {series.map((item) => {
          const points = data
            .filter(
              (point) =>
                point[item.key] != null
            )
            .map((point) => ({
              x: x(point.week),
              y: y(point[item.key]),
              week: point.week,
              value: point[item.key],
            }));

          const segments = [];
          let current = [];
          let previousWeek = null;

          points.forEach((point) => {
            if (
              previousWeek !== null &&
              point.week !== previousWeek + 1
            ) {
              if (current.length > 1) {
                segments.push(current);
              }

              current = [];
            }

            current.push(point);
            previousWeek = point.week;
          });

          if (current.length > 1) {
            segments.push(current);
          }

          return (
            <g key={item.key}>
              {segments.map(
                (segment, index) => (
                  <polyline
                    key={index}
                    points={segment
                      .map(
                        (point) =>
                          `${point.x},${point.y}`
                      )
                      .join(" ")}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )
              )}

              {points.map((point) => (
                <circle
                  key={point.week}
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                >
                  <title>
                    {item.name} · Week{" "}
                    {point.week} · Nilai{" "}
                    {scoreText(point.value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {!hasData && (
        <div className="gr-empty">
          Belum ada nilai untuk ditampilkan
          pada periode ini.
        </div>
      )}

      <p className="gr-hint">
        Titik menunjukkan nilai yang tercatat.
        Garis hanya menghubungkan minggu
        berurutan yang memiliki nilai.
        Minggu kosong tidak dianggap
        bernilai nol.
      </p>
    </div>
  );
}

function CategoryChart({ items }) {
  const max = Math.max(
    1,
    ...items.map((item) => item.verified)
  );

  return (
    <div className="gr-bars">
      {items.map((item) => (
        <div
          className="gr-bar-row"
          key={item.name}
        >
          <div className="gr-bar-label">
            {item.name}
          </div>

          <div className="gr-bar-track">
            <div
              className="gr-bar-fill"
              style={{
                width: `${
                  (item.verified / max) * 100
                }%`,
              }}
            />
          </div>

          <strong>{item.verified}</strong>
        </div>
      ))}

      <p className="gr-hint">
        Jumlah kegiatan terverifikasi selama
        25 minggu, bukan persentase
        penyelesaian kategori.
      </p>
    </div>
  );
}

function Stat({ label, value, caption }) {
  return (
    <div className="gr-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

export default function GrafikPerkembanganOJT() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [viewerRole, setViewerRole] =
    useState(null);

  const [categories, setCategories] =
    useState([]);

  const [achievements, setAchievements] =
    useState([]);

  const [postTests, setPostTests] =
    useState([]);

  const [practice, setPractice] =
    useState([]);

  const [samapta, setSamapta] =
    useState([]);

  const [range, setRange] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const isMentor = viewerRole === "mentor";

  const backPath = isMentor
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  async function fetchData(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,status"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,score")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,result_value"
        )
        .eq("program_id", id),
    ]);

    for (const result of results) {
      if (result.error) {
        throw result.error;
      }
    }

    return {
      categories: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practice: results[3].data || [],
      samapta: results[4].data || [],
    };
  }

  function applyData(data) {
    setCategories(data.categories);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractice(data.practice);
    setSamapta(data.samapta);
  }

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError("ID program OJT tidak tersedia.");
      return;
    }

    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setProgram(null);
      setViewerRole(null);
      setRange("all");

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
          .select("id,role")
          .eq("id", user.id)
          .single();

        if (!active) return;

        if (profileError || !profile) {
          throw new Error(
            "Profil pengguna tidak ditemukan."
          );
        }

        const mentor =
          profile.role === "mentor";

        setViewerRole(
          mentor ? "mentor" : "peserta"
        );

        // Mentor boleh melihat seluruh peserta.
        // Peserta hanya boleh membuka program
        // yang memiliki participant_id miliknya.

        let programQuery = supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            site,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (!mentor) {
          programQuery = programQuery.eq(
            "participant_id",
            user.id
          );
        }

        const {
          data: programData,
          error: programError,
        } = await programQuery.single();

        if (!active) return;

        if (programError || !programData) {
          throw new Error(
            "Program OJT tidak ditemukan atau " +
            "Anda tidak memiliki izin akses."
          );
        }

        if (
          !mentor &&
          programData.participant_id !== user.id
        ) {
          throw new Error(
            "Anda tidak memiliki izin melihat " +
            "grafik peserta lain."
          );
        }

        if (!parseDate(programData.start_date)) {
          throw new Error(
            "Tanggal mulai OJT belum valid."
          );
        }

        // Supabase RLS tetap memverifikasi
        // hak akses untuk setiap tabel.
        const data = await fetchData(
          programData.id
        );

        if (!active) return;

        setProgram(programData);
        applyData(data);
      } catch (err) {
        if (!active) return;

        setError(
          err?.message ||
          "Gagal memuat Grafik Perkembangan."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId, router]);

  async function refresh() {
    if (
      !program?.id ||
      refreshing ||
      loading
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const data = await fetchData(
        program.id
      );

      applyData(data);
    } catch (err) {
      setError(
        err?.message ||
        "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const samaptaResults = useMemo(
    () => calculateSamapta(samapta),
    [samapta]
  );

  const weeklyData = useMemo(() => {
    if (!program?.start_date) {
      return [];
    }

    return buildWeeklyData(
      program.start_date,
      postTests,
      practice,
      samaptaResults
    );
  }, [
    program,
    postTests,
    practice,
    samaptaResults,
  ]);

  const filteredData = weeklyData.filter(
    (item) => {
      if (range === "first") {
        return item.week <= 13;
      }

      if (range === "second") {
        return item.week >= 14;
      }

      return true;
    }
  );

  const categoryData = useMemo(() => {
    return CATEGORIES.map((name) => {
      const category = categories.find(
        (item) =>
          normalize(item.name) ===
          normalize(name)
      );

      const code = category?.code;

      const verified = code
        ? achievements.filter((item) => {
            const week = weekOf(
              item.activity_date,
              program?.start_date
            );

            return (
              item.type_code === code &&
              item.status === "verified" &&
              week !== null &&
              week >= 1 &&
              week <= TOTAL_WEEKS
            );
          }).length
        : 0;

      return {
        name,
        verified,
      };
    });
  }, [
    categories,
    achievements,
    program,
  ]);

  const theoryLatest = latestValue(
    weeklyData,
    "theory"
  );

  const practiceLatest = latestValue(
    weeklyData,
    "practice"
  );

  const samaptaLatest = latestValue(
    weeklyData,
    "final"
  );

  const theoryWeeks = weeklyData.filter(
    (item) => item.theory != null
  ).length;

  const practiceWeeks = weeklyData.filter(
    (item) => item.practice != null
  ).length;

  const samaptaWeeks = weeklyData.filter(
    (item) => item.final != null
  ).length;

  const participantName =
    program?.peserta?.full_name ||
    "Peserta OJT";

  return (
    <main className="gr-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .gr-root {
          min-height: 100vh;
          background: #f2f6f7;
          color: #173c2f;
          font-family: Arial, Helvetica, sans-serif;
        }

        .gr-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 15px 22px;
          color: #fff;
          background: #09232b;
        }

        .gr-brand {
          font-size: 21px;
          font-weight: 900;
        }

        .gr-brand span {
          color: #30c691;
        }

        .gr-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 13px;
          border: 1px solid #ffffff30;
          background: #ffffff15;
          color: white;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .gr-container {
          max-width: 1100px;
          margin: auto;
          padding: 20px;
        }

        .gr-hero {
          padding: 30px;
          border-radius: 18px;
          margin-bottom: 15px;
          color: white;
          background:
            linear-gradient(
              90deg,
              rgba(6,28,35,.98),
              rgba(5,44,39,.86),
              rgba(5,38,34,.34)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
        }

        .gr-hero small {
          color: #e9c87e;
          font-weight: 800;
          letter-spacing: 1.4px;
          font-size: 10px;
        }

        .gr-hero h1 {
          font-size: 29px;
          margin: 12px 0 8px;
        }

        .gr-hero p {
          font-size: 13px;
          color: #dcece4;
          margin: 0;
        }

        .gr-card {
          background: white;
          border: 1px solid #e1ebe5;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 5px 18px #123d2509;
          min-width: 0;
        }

        .gr-card h2 {
          font-size: 17px;
          margin: 0 0 12px;
        }

        .gr-person {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 15px;
          background: #f5fbf7;
          border: 1px solid #dcefe4;
          border-radius: 13px;
        }

        .gr-avatar {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: #dcf5e7;
          color: #078053;
          font-size: 18px;
          font-weight: 900;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .gr-name {
          font-size: 16px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .gr-person-meta {
          font-size: 11px;
          color: #71897b;
          line-height: 1.8;
          margin-top: 5px;
        }

        .gr-lock {
          background: #effaf3;
          border: 1px solid #d6ebdf;
          color: #0a7e52;
          font-size: 12px;
          border-radius: 11px;
          padding: 12px;
          margin-top: 12px;
          line-height: 1.7;
        }

        .gr-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .gr-stat {
          background: #f6faf7;
          border: 1px solid #e3eee6;
          border-radius: 12px;
          padding: 17px;
          min-width: 0;
        }

        .gr-stat span {
          display: block;
          color: #73897c;
          font-size: 12px;
        }

        .gr-stat strong {
          display: block;
          margin: 10px 0 6px;
          color: #0a8057;
          font-size: 28px;
        }

        .gr-stat small {
          color: #81968a;
          font-size: 11px;
        }

        .gr-filter {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 14px 0;
        }

        .gr-filter button {
          background: white;
          border: 1px solid #d7e6dd;
          color: #607c69;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .gr-filter button.active {
          background: #e3f8eb;
          border-color: #55bc89;
          color: #087e54;
        }

        .gr-chart-wrap {
          width: 100%;
          min-width: 0;
        }

        .gr-chart {
          display: block;
          width: 100%;
          height: auto;
          margin-top: 14px;
        }

        .gr-legend {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
        }

        .gr-legend span {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          color: #607568;
        }

        .gr-legend i {
          width: 11px;
          height: 11px;
          display: inline-block;
          border-radius: 50%;
        }

        .gr-hint {
          color: #84958a;
          font-size: 11px;
          line-height: 1.7;
          margin-top: 14px;
        }

        .gr-empty {
          background: #f7faf8;
          border: 1px dashed #d7e8dd;
          color: #799084;
          border-radius: 10px;
          padding: 15px;
          text-align: center;
          font-size: 12px;
          margin: 10px 0;
        }

        .gr-bars {
          display: grid;
          gap: 17px;
        }

        .gr-bar-row {
          display: grid;
          grid-template-columns: 130px 1fr 35px;
          align-items: center;
          gap: 12px;
          font-size: 12px;
        }

        .gr-bar-label {
          font-weight: 700;
        }

        .gr-bar-track {
          height: 15px;
          border-radius: 20px;
          background: #eaf1eb;
          overflow: hidden;
        }

        .gr-bar-fill {
          height: 100%;
          background: linear-gradient(
            90deg,
            #0a9266,
            #51cba0
          );
          border-radius: 20px;
        }

        .gr-bar-row strong {
          color: #087c54;
          text-align: right;
        }

        .gr-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .gr-btn {
          padding: 11px 15px;
          border: none;
          border-radius: 10px;
          background: #0b9061;
          color: white;
          font-weight: 800;
          font-size: 12px;
          cursor: pointer;
        }

        .gr-btn.secondary {
          color: #315947;
          background: #eaf0ec;
        }

        .gr-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .gr-error {
          padding: 15px;
          color: #b91c1c;
          background: #fff0f0;
          border-radius: 11px;
          margin-bottom: 15px;
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .gr-footer {
          color: #8ca093;
          font-size: 11px;
          text-align: center;
          padding: 20px;
        }

        @media (max-width: 700px) {
          .gr-topbar {
            padding: 13px 15px;
          }

          .gr-brand {
            font-size: 18px;
          }

          .gr-back {
            padding: 9px;
            font-size: 11px;
          }

          .gr-container {
            padding: 12px;
          }

          .gr-hero {
            padding: 24px 17px;
            border-radius: 14px;
          }

          .gr-hero h1 {
            font-size: 23px;
          }

          .gr-card {
            padding: 15px;
            border-radius: 14px;
          }

          .gr-avatar {
            width: 44px;
            height: 44px;
            font-size: 15px;
          }

          .gr-name {
            font-size: 14px;
          }

          .gr-person {
            padding: 12px;
          }

          .gr-stats {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }

          .gr-stat {
            padding: 12px;
          }

          .gr-stat strong {
            font-size: 23px;
          }

          .gr-bar-row {
            grid-template-columns: 105px 1fr 25px;
            gap: 8px;
            font-size: 11px;
          }
        }

        @media print {
          .gr-topbar,
          .gr-filter,
          .gr-actions {
            display: none !important;
          }

          .gr-root {
            background: white;
          }

          .gr-card {
            box-shadow: none;
            break-inside: avoid;
          }

          .gr-container {
            max-width: none;
            padding: 0;
          }
        }
      `}</style>

      <header className="gr-topbar">
        <div className="gr-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="gr-back"
          onClick={() =>
            router.push(backPath)
          }
        >
          {isMentor
            ? "← Detail Peserta"
            : "← Dashboard Peserta"}
        </button>
      </header>

      <div className="gr-container">
        <section className="gr-hero">
          <small>
            EMERGENCY RESPONSE GROUP ·
            PT BERAU COAL
          </small>

          <h1>Grafik Perkembangan</h1>

          <p>
            Performance Analytics ·
            25 Weeks OJT
          </p>
        </section>

        {loading ? (
          <section className="gr-card">
            <h2>Memuat Data Grafik...</h2>

            <p className="gr-hint">
              Mengambil hasil monitoring
              peserta.
            </p>
          </section>
        ) : !program ? (
          <section className="gr-card">
            <h2>
              Grafik Tidak Dapat Ditampilkan
            </h2>

            <div className="gr-error">
              {error ||
                "Data peserta belum tersedia."}
            </div>

            <button
              type="button"
              className="gr-btn"
              onClick={() =>
                router.push(backPath)
              }
            >
              Kembali ke Dashboard
            </button>
          </section>
        ) : (
          <>
            <section className="gr-card">
              <div className="gr-person">
                <div className="gr-avatar">
                  {initials(participantName)}
                </div>

                <div
                  style={{
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <div className="gr-name">
                    {participantName}
                  </div>

                  <div className="gr-person-meta">
                    {program.peserta?.department ||
                      "—"}
                    {" · "}
                    {program.site || "—"}
                    <br />
                    {formatDate(
                      program.start_date
                    )}
                    {" – "}
                    {formatDate(
                      program.end_date
                    )}
                  </div>
                </div>

                <span
                  style={{
                    color: "#0b8056",
                    background: "#dff7e8",
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "8px 10px",
                  }}
                >
                  {program.status === "active"
                    ? "Aktif"
                    : "Tidak Aktif"}
                </span>
              </div>

              <div className="gr-lock">
                🔒 Identitas peserta otomatis.
                Grafik hanya menampilkan data{" "}
                <strong>
                  {participantName}
                </strong>.
                {!isMentor && (
                  <>
                    {" "}
                    Akses peserta dibatasi
                    pada program OJT miliknya.
                  </>
                )}
              </div>
            </section>

            {error && (
              <div
                className="gr-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <section className="gr-card">
              <h2>
                Ringkasan Performance
              </h2>

              <div className="gr-stats">
                <Stat
                  label="Nilai Teori Terakhir"
                  value={scoreText(
                    theoryLatest
                  )}
                  caption={`${theoryWeeks} minggu memiliki nilai`}
                />

                <Stat
                  label="Nilai Praktik Terakhir"
                  value={scoreText(
                    practiceLatest
                  )}
                  caption={`${practiceWeeks} minggu memiliki nilai`}
                />

                <Stat
                  label="Nilai Samapta Terakhir"
                  value={scoreText(
                    samaptaLatest
                  )}
                  caption={`${samaptaWeeks} minggu memiliki tes lengkap`}
                />
              </div>
            </section>

            <section className="gr-card">
              <h2>Periode Grafik</h2>

              <div className="gr-filter">
                {[
                  ["all", "Week 1–25"],
                  ["first", "Week 1–13"],
                  ["second", "Week 14–25"],
                ].map(([key, text]) => (
                  <button
                    type="button"
                    key={key}
                    className={
                      range === key
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setRange(key)
                    }
                  >
                    {text}
                  </button>
                ))}
              </div>

              <p className="gr-hint">
                Filter periode berlaku
                untuk grafik nilai Teori,
                Praktik, dan Samapta.
                Pencapaian kompetensi
                dihitung selama 25 minggu.
              </p>
            </section>

            <section className="gr-card">
              <h2>
                Perkembangan Nilai
                Teori & Praktik
              </h2>

              <TrendChart
                data={filteredData}
                series={[
                  {
                    key: "theory",
                    name: "Post-Test",
                    color: COLORS.theory,
                  },
                  {
                    key: "practice",
                    name: "Praktik Mingguan",
                    color: COLORS.practice,
                  },
                ]}
              />
            </section>

            <section className="gr-card">
              <h2>
                Perkembangan Nilai Samapta
              </h2>

              <TrendChart
                data={filteredData}
                series={[
                  {
                    key: "a",
                    name: "Nilai A",
                    color: COLORS.a,
                  },
                  {
                    key: "b",
                    name: "Nilai B",
                    color: COLORS.b,
                  },
                  {
                    key: "final",
                    name: "Nilai Akhir",
                    color: COLORS.final,
                  },
                ]}
              />
            </section>

            <section className="gr-card">
              <h2>
                Pencapaian Kompetensi OJT
              </h2>

              <CategoryChart
                items={categoryData}
              />
            </section>

            <section className="gr-card">
              <h2>
                Kesimpulan Monitoring
              </h2>

              <p className="gr-hint">
                Data Post-Test tersedia pada{" "}
                <strong>
                  {theoryWeeks}
                </strong>{" "}
                minggu, Praktik Mingguan
                pada{" "}
                <strong>
                  {practiceWeeks}
                </strong>{" "}
                minggu, dan Samapta lengkap
                pada{" "}
                <strong>
                  {samaptaWeeks}
                </strong>{" "}
                minggu.
              </p>

              <p className="gr-hint">
                Grafik hanya merangkum
                catatan yang tersedia.
                Tidak ada nilai otomatis
                untuk minggu kosong.
                Grafik ini bukan keputusan
                kelulusan akhir peserta OJT.
              </p>

              <div className="gr-actions">
                <button
                  type="button"
                  className="gr-btn secondary"
                  disabled={refreshing}
                  onClick={refresh}
                >
                  {refreshing
                    ? "Memuat..."
                    : "Refresh Data"}
                </button>

                <button
                  type="button"
                  className="gr-btn"
                  onClick={() =>
                    window.print()
                  }
                >
                  Cetak / Simpan Grafik
                </button>
              </div>
            </section>
          </>
        )}

        <footer className="gr-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
