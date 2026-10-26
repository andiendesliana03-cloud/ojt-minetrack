
"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const CATEGORIES = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const COLORS = {
  theory: "#2563eb",
  practice: "#059669",
  samapta: "#f59e0b",
  a: "#2563eb",
  b: "#f59e0b",
  final: "#059669",
};

const WEEK_OPTIONS = [
  { key: "all", label: "Week 1–25" },
  { key: "first", label: "Week 1–13" },
  { key: "second", label: "Week 14–25" },
  { key: "custom", label: "Pilih Minggu" },
];

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
  const date = new Date(Date.UTC(y, m - 1, d));

  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  return date;
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

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
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

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value || "").trim().toLowerCase();
}

function scoreText(value) {
  return value == null || !Number.isFinite(Number(value))
    ? "—"
    : Number(value).toFixed(2);
}

function percentText(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function numberText(value, digits = 0) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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

      return Number.isFinite(value) ? value : null;
    })
    .filter((value) => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function calculateSamapta(records) {
  const byDate = new Map();

  records.forEach((record) => {
    if (!record.test_date) return;

    const date = String(record.test_date).slice(0, 10);

    if (!byDate.has(date)) {
      byDate.set(date, []);
    }

    byDate.get(date).push(record);
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

      return Number.isFinite(value) ? value : null;
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
      components.reduce((sum, value) => sum + value, 0) /
      4;

    results.push({
      date,
      a,
      b,
      final: (a + b) / 2,
    });
  });

  return results.sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

function buildWeeklyData(
  startDate,
  postTests,
  practices,
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
    const week = weekOf(item.test_date, startDate);

    if (!week) return;

    if (!postByWeek.has(week)) {
      postByWeek.set(week, []);
    }

    postByWeek.get(week).push(item);
  });

  practices.forEach((item) => {
    const week = weekOf(item.practice_date, startDate);

    if (!week) return;

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

  // Tetap memakai tes lengkap terakhir pada
  // minggu yang sama, seperti logika sebelumnya.
  samaptaResults.forEach((item) => {
    const week = weekOf(item.date, startDate);

    if (!week) return;

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

function Legend({ series }) {
  return (
    <div className="gr-legend">
      {series.map((item) => (
        <span key={item.key}>
          <i style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  );
}

// ======================================================
// GRAFIK GARIS
// ======================================================

function TrendChart({
  data,
  series,
  title = "Grafik Perkembangan",
  compact = false,
}) {
  const [activeWeek, setActiveWeek] = useState(null);

  const width = 760;
  const height = compact ? 245 : 300;

  const left = 48;
  const right = 22;
  const top = 24;
  const bottom = 43;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const weeks = data.map((item) => item.week);

  const minWeek = weeks.length
    ? Math.min(...weeks)
    : 1;

  const maxWeek = weeks.length
    ? Math.max(...weeks)
    : TOTAL_WEEKS;

  const domainSize = Math.max(1, maxWeek - minWeek);

  const x = (week) =>
    left + ((week - minWeek) / domainSize) * innerWidth;

  const y = (value) =>
    top + ((100 - value) / 100) * innerHeight;

  const ticks = [0, 25, 50, 75, 100];

  const tickWeeks = weeks.filter((week, index) => {
    if (weeks.length <= 10) return true;

    const step = Math.ceil(weeks.length / 7);

    return (
      index === 0 ||
      index === weeks.length - 1 ||
      index % step === 0
    );
  });

  const hasData = series.some((item) =>
    data.some((point) => point[item.key] != null)
  );

  const selected = data.find(
    (item) => item.week === activeWeek
  );

  function chooseWeek(week) {
    setActiveWeek((previous) =>
      previous === week ? null : week
    );
  }

  return (
    <div className="gr-chart-wrap">
      <Legend series={series} />

      <svg
        className="gr-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={title}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#e5eee9"
              strokeDasharray="4 5"
            />

            <text
              x={left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="12"
              fill="#7f9388"
            >
              {tick}
            </text>
          </g>
        ))}

        {tickWeeks.map((week) => (
          <text
            key={week}
            x={x(week)}
            y={height - 14}
            textAnchor="middle"
            fontSize="12"
            fill="#7f9388"
          >
            W{week}
          </text>
        ))}

        {selected && (
          <line
            x1={x(selected.week)}
            x2={x(selected.week)}
            y1={top}
            y2={height - bottom}
            stroke="#94a89e"
            strokeDasharray="5 5"
          />
        )}

        {series.map((item) => {
          const points = data
            .filter((point) => point[item.key] != null)
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
              {segments.map((segment, index) => (
                <polyline
                  key={index}
                  points={segment
                    .map((point) => `${point.x},${point.y}`)
                    .join(" ")}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {points.map((point) => (
                <circle
                  key={point.week}
                  cx={point.x}
                  cy={point.y}
                  r={
                    selected?.week === point.week
                      ? 7
                      : 4.5
                  }
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onClick={() => chooseWeek(point.week)}
                >
                  <title>
                    {item.name} · Week {point.week}
                    {" · "}
                    {scoreText(point.value)}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      {selected && (
        <div className="gr-tooltip">
          <strong>
            Week {String(selected.week).padStart(2, "0")}
          </strong>

          <div className="gr-tooltip-values">
            {series.map((item) => (
              <span key={item.key}>
                <i style={{ background: item.color }} />
                {item.name}:{" "}
                <strong>
                  {scoreText(selected[item.key])}
                </strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <div className="gr-empty">
          Belum ada nilai yang tercatat
          pada periode ini.
        </div>
      )}
    </div>
  );
}

// ======================================================
// GRAFIK BATANG NILAI MINGGUAN
// ======================================================

function BarChart({ data, series }) {
  const width = 760;
  const height = 280;

  const left = 44;
  const right = 20;
  const top = 20;
  const bottom = 43;

  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;

  const y = (value) =>
    top + ((100 - value) / 100) * innerHeight;

  const ticks = [0, 25, 50, 75, 100];

  const groupWidth = data.length
    ? innerWidth / data.length
    : innerWidth;

  const barWidth = Math.min(
    19,
    Math.max(2, (groupWidth - 9) / series.length - 3)
  );

  const hasData = data.some((item) =>
    series.some((s) => item[s.key] != null)
  );

  return (
    <div className="gr-chart-wrap">
      <Legend series={series} />

      <div className="gr-chart-scroll">
        <svg
          className="gr-chart"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Perbandingan nilai per minggu"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={width - right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#e5eee9"
                strokeDasharray="4 5"
              />

              <text
                x={left - 9}
                y={y(tick) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#809489"
              >
                {tick}
              </text>
            </g>
          ))}

          {data.map((point, index) => {
            const centerX =
              left + groupWidth * (index + 0.5);

            return (
              <g key={point.week}>
                {series.map((s, seriesIndex) => {
                  const value = point[s.key];

                  if (value == null) return null;

                  const bounded = Math.max(
                    0,
                    Math.min(100, Number(value))
                  );

                  const groupBarsWidth =
                    series.length * (barWidth + 3);

                  const x =
                    centerX -
                    groupBarsWidth / 2 +
                    seriesIndex * (barWidth + 3);

                  return (
                    <rect
                      key={s.key}
                      x={x}
                      y={y(bounded)}
                      width={barWidth}
                      height={Math.max(
                        0,
                        top + innerHeight - y(bounded)
                      )}
                      rx="3"
                      fill={s.color}
                    >
                      <title>
                        W{point.week} · {s.name}:{" "}
                        {scoreText(value)}
                      </title>
                    </rect>
                  );
                })}

                {(data.length <= 13 ||
                  index % Math.ceil(data.length / 12) === 0 ||
                  index === data.length - 1) && (
                  <text
                    x={centerX}
                    y={height - 14}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#809489"
                  >
                    W{point.week}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {!hasData && (
        <div className="gr-empty">
          Tidak ada nilai pada minggu yang dipilih.
        </div>
      )}
    </div>
  );
}

// ======================================================
// KARTU STATISTIK
// ======================================================

function StatCard({
  icon,
  label,
  value,
  caption,
  tone = "green",
}) {
  return (
    <div className={`gr-stat gr-tone-${tone}`}>
      <div className="gr-stat-icon">
        {icon}
      </div>

      <div className="gr-stat-content">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{caption}</small>
      </div>
    </div>
  );
}

// ======================================================
// PROGRES KOMPETENSI
// Sesuai perhitungan target mingguan Achievement.
// ======================================================

function CompetencyProgress({ items }) {
  return (
    <div className="gr-competency-list">
      {items.map((item) => (
        <div className="gr-competency-row" key={item.name}>
          <div className="gr-competency-name">
            <span>{item.icon}</span>
            <strong>{item.name}</strong>
          </div>

          <div className="gr-competency-middle">
            <div className="gr-competency-track">
              <div
                className="gr-competency-fill"
                style={{
                  width: `${item.percent}%`,
                }}
              />
            </div>

            <small>
              {item.completedWeeks}/25 minggu
              mencapai target
            </small>
          </div>

          <div className="gr-competency-result">
            <strong>{item.percent}%</strong>
            <small>
              {item.verified} kegiatan
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

// ======================================================
// HEATMAP 25 MINGGU
// ======================================================

function Heatmap({
  items,
  selectedWeeks,
  onSelectWeek,
}) {
  return (
    <div>
      <div className="gr-heat-legend">
        <span>
          <i className="heat-done" />
          Target tercapai
        </span>

        <span>
          <i className="heat-progress" />
          Ada progres
        </span>

        <span>
          <i className="heat-empty" />
          Belum ada kegiatan
        </span>
      </div>

      <div className="gr-heat-scroll">
        <div className="gr-heat-table">
          <div className="gr-heat-row">
            <div className="gr-heat-name">
              Kategori
            </div>

            {Array.from(
              { length: TOTAL_WEEKS },
              (_, index) => index + 1
            ).map((week) => (
              <div
                className={
                  "gr-heat-week " +
                  (selectedWeeks.includes(week)
                    ? "chosen"
                    : "")
                }
                key={week}
              >
                {week}
              </div>
            ))}
          </div>

          {items.map((item) => (
            <div className="gr-heat-row" key={item.name}>
              <div className="gr-heat-name">
                {item.name}
              </div>

              {item.weekly.map((week) => {
                const state =
                  week.completed
                    ? "done"
                    : week.achieved > 0
                    ? "progress"
                    : "empty";

                return (
                  <button
                    type="button"
                    key={week.week}
                    className={
                      `gr-heat-cell ${state} ` +
                      (selectedWeeks.includes(week.week)
                        ? "selected"
                        : "")
                    }
                    title={
                      `${item.name} · Week ${week.week}: ` +
                      `${numberText(
                        week.achieved,
                        item.name === "Fisik" ? 3 : 0
                      )} ${item.unit}, ` +
                      `${week.percent}% dari target mingguan`
                    }
                    onClick={() =>
                      onSelectWeek(week.week)
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="gr-hint">
        Heatmap menampilkan seluruh 25 minggu.
        Klik kotak untuk melihat rincian minggu.
        Hanya Achievement terverifikasi yang dihitung.
      </p>
    </div>
  );
}

// ======================================================
// HALAMAN UTAMA
// ======================================================

export default function GrafikPerkembanganOJT() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [viewerRole, setViewerRole] = useState(null);
  const [viewerId, setViewerId] = useState(null);

  const [categories, setCategories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practice, setPractice] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [range, setRange] = useState("all");
  const [customWeeks, setCustomWeeks] = useState([
    1, 2, 3, 4, 5,
  ]);

  const [selectedWeek, setSelectedWeek] = useState(1);

  const [activeTab, setActiveTab] = useState("summary");
  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = normalizeRole(viewerRole);

  const isManager =
    role === "mentor" || role === "admin";

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  // ====================================================
  // DATA SUPABASE
  // ====================================================

  async function fetchData(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,status,distance_km"
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
      if (result.error) throw result.error;
    }

    return {
      categories: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practice: results[3].data || [],
      samapta: results[4].data || [],
    };
  }

  async function verifyAccess() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error(
        "Profil pengguna tidak ditemukan."
      );
    }

    const currentRole = normalizeRole(profile.role);

    const manager = [
      "admin",
      "mentor",
    ].includes(currentRole);

    const participant = [
      "peserta",
      "participant",
    ].includes(currentRole);

    if (!manager && !participant) {
      throw new Error(
        "Akun tidak memiliki izin membuka grafik."
      );
    }

    let query = supabase
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

    if (participant) {
      query = query
        .eq("participant_id", user.id)
        .eq("status", "active");
    }

    const {
      data: programData,
      error: programError,
    } = await query.maybeSingle();

    if (programError) throw programError;

    if (!programData) {
      throw new Error(
        "Program OJT tidak ditemukan atau akses ditolak."
      );
    }

    if (!parseDate(programData.start_date)) {
      throw new Error(
        "Tanggal mulai OJT belum valid."
      );
    }

    return {
      user,
      profile,
      programData,
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
      setViewerId(null);

      try {
        const access = await verifyAccess();

        const data = await fetchData(
          access.programData.id
        );

        if (!active) return;

        setProgram(access.programData);
        setViewerRole(access.profile.role);
        setViewerId(access.user.id);
        applyData(data);

        const current = weekOf(
          new Date().toISOString().slice(0, 10),
          access.programData.start_date
        );

        setSelectedWeek(current || 1);
      } catch (err) {
        if (!active) return;

        setError(
          err?.message ||
          "Gagal memuat Grafik Perkembangan."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [programId]);

  async function refresh() {
    if (!program?.id || refreshing || loading) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      // Periksa lagi hak akses supaya perubahan
      // akun atau kepemilikan tidak menggunakan
      // data lama dari state halaman.
      const access = await verifyAccess();

      if (access.user.id !== viewerId) {
        setProgram(null);
        throw new Error(
          "Akun login berubah. Buka ulang halaman."
        );
      }

      const data = await fetchData(
        access.programData.id
      );

      setProgram(access.programData);
      setViewerRole(access.profile.role);
      applyData(data);
    } catch (err) {
      setProgram(null);

      setError(
        err?.message ||
        "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ====================================================
  // FILTER MINGGU
  // ====================================================

  const selectedWeeks = useMemo(() => {
    if (range === "first") {
      return Array.from(
        { length: 13 },
        (_, index) => index + 1
      );
    }

    if (range === "second") {
      return Array.from(
        { length: 12 },
        (_, index) => index + 14
      );
    }

    if (range === "custom") {
      return [...new Set(customWeeks)]
        .filter(
          (week) =>
            week >= 1 && week <= TOTAL_WEEKS
        )
        .sort((a, b) => a - b);
    }

    return Array.from(
      { length: TOTAL_WEEKS },
      (_, index) => index + 1
    );
  }, [range, customWeeks]);

  function toggleWeek(week) {
    setCustomWeeks((previous) =>
      previous.includes(week)
        ? previous.filter((item) => item !== week)
        : [...previous, week].sort((a, b) => a - b)
    );
  }

  function showWeek(week) {
    setRange("custom");
    setCustomWeeks([week]);
    setSelectedWeek(week);
    setActiveTab("weekly");

    if (typeof document !== "undefined") {
      document.getElementById("gr-weekly")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  function goToSection(section) {
    setActiveTab(section);
    setMobileMenuOpen(false);

    if (typeof document !== "undefined") {
      const ids = {
        summary: "gr-summary",
        scores: "gr-scores",
        competency: "gr-competency",
        weekly: "gr-weekly",
      };

      document.getElementById(ids[section])?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  // ====================================================
  // NILAI TEORI, PRAKTIK, SAMAPTA
  // ====================================================

  const samaptaResults = useMemo(
    () => calculateSamapta(samapta),
    [samapta]
  );

  const weeklyData = useMemo(() => {
    if (!program?.start_date) return [];

    return buildWeeklyData(
      program.start_date,
      postTests,
      practice,
      samaptaResults
    );
  }, [
    program?.start_date,
    postTests,
    practice,
    samaptaResults,
  ]);

  const filteredData = useMemo(
    () =>
      weeklyData.filter((item) =>
        selectedWeeks.includes(item.week)
      ),
    [weeklyData, selectedWeeks]
  );

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

  // ====================================================
  // KOMPETENSI MENGIKUTI HALAMAN ACHIEVEMENT
  //
  // Realisasi mingguan:
  // Fisik    = total km terverifikasi.
  // Lainnya  = jumlah kegiatan terverifikasi.
  //
  // Persentase kategori = rata-rata persentase
  // mingguan selama 25 minggu, dibatasi 100%.
  // ====================================================

  const categoryData = useMemo(() => {
    return CATEGORIES.map((category) => {
      const type = categories.find(
        (item) =>
          normalize(item.name) ===
          normalize(category.name)
      );

      const verifiedRecords = type
        ? achievements.filter(
            (item) =>
              item.type_code === type.code &&
              item.status === "verified" &&
              weekOf(
                item.activity_date,
                program?.start_date
              ) !== null
          )
        : [];

      const weekly = Array.from(
        { length: TOTAL_WEEKS },
        (_, index) => {
          const week = index + 1;

          const matching = verifiedRecords.filter(
            (record) =>
              weekOf(
                record.activity_date,
                program?.start_date
              ) === week
          );

          const achieved =
            category.name === "Fisik"
              ? matching.reduce(
                  (sum, record) =>
                    sum +
                    Math.max(
                      0,
                      Number(record.distance_km) || 0
                    ),
                  0
                )
              : matching.length;

          const percent = Math.min(
            100,
            Math.round(
              (achieved / category.target) * 100
            )
          );

          return {
            week,
            achieved,
            percent,
            completed: achieved >= category.target,
            count: matching.length,
          };
        }
      );

      return {
        ...category,
        code: type?.code,
        verified: verifiedRecords.length,
        weekly,
        completedWeeks: weekly.filter(
          (week) => week.completed
        ).length,
        percent: Math.round(
          weekly.reduce(
            (sum, week) => sum + week.percent,
            0
          ) / TOTAL_WEEKS
        ),
      };
    });
  }, [categories, achievements, program?.start_date]);

  const overall = Math.round(
    categoryData.reduce(
      (sum, item) => sum + item.percent,
      0
    ) / categoryData.length
  );

  const completedCategories = categoryData.filter(
    (item) => item.percent === 100
  ).length;

  const totalVerified = categoryData.reduce(
    (sum, item) => sum + item.verified,
    0
  );

  const weeklySummary = useMemo(
    () =>
      weeklyData.map((item) => {
        const details = categoryData.map((category) => ({
          name: category.name,
          icon: category.icon,
          ...category.weekly[item.week - 1],
        }));

        return {
          ...item,
          details,
          totalActivities: details.reduce(
            (sum, detail) => sum + detail.count,
            0
          ),
          activeCategories: details.filter(
            (detail) => detail.count > 0
          ).length,
        };
      }),
    [weeklyData, categoryData]
  );

  const activeWeekData = weeklySummary.find(
    (item) => item.week === selectedWeek
  );

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const theorySeries = [
    {
      key: "theory",
      name: "Teori (Post-Test)",
      color: COLORS.theory,
    },
    {
      key: "practice",
      name: "Praktik Mingguan",
      color: COLORS.practice,
    },
    {
      key: "final",
      name: "Samapta Akhir",
      color: COLORS.samapta,
    },
  ];

  const samaptaSeries = [
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
  ];

  function printPage() {
    window.print();
  }

  return (
    <main className="gr-root">
      <style>{`
        .gr-root,
        .gr-root * {
          box-sizing: border-box;
        }

        .gr-root {
          min-height: 100vh;
          background: #f3f7f8;
          color: #163b30;
          font-family: Arial, Helvetica, sans-serif;
        }

        .gr-root button,
        .gr-root select {
          font-family: inherit;
        }

        .gr-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 15px 24px;
          background: #071f27;
          color: white;
        }

        .gr-brand {
          font-size: 21px;
          font-weight: 900;
        }

        .gr-brand span {
          color: #2ed09a;
        }

        .gr-top-actions {
          display: flex;
          gap: 9px;
          align-items: center;
        }

        .gr-back {
          border: 1px solid #ffffff35;
          border-radius: 10px;
          background: #ffffff13;
          color: white;
          font-size: 12px;
          font-weight: 800;
          padding: 11px 14px;
          cursor: pointer;
        }

        .gr-container {
          max-width: 1380px;
          margin: auto;
          padding: 18px;
        }

        .gr-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 25px;
          border-radius: 16px;
          margin-bottom: 15px;
          color: white;
          background:
            linear-gradient(
              100deg,
              rgba(6,28,35,.97),
              rgba(3,89,65,.86)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
        }

        .gr-hero small {
          color: #f2ce78;
          font-weight: 900;
          letter-spacing: 1px;
          font-size: 10px;
        }

        .gr-hero h1 {
          margin: 10px 0;
          font-size: 30px;
        }

        .gr-hero p {
          font-size: 13px;
          color: #dcefe7;
          margin: 0;
        }

        .gr-hero-person {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .gr-avatar {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #e2f9ed;
          color: #087d55;
          font-size: 19px;
          font-weight: 900;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }

        .gr-person-name {
          font-size: 14px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .gr-person-meta {
          color: #d8eae2;
          line-height: 1.6;
          font-size: 11px;
          margin-top: 5px;
        }

        .gr-status {
          display: inline-block;
          padding: 7px 11px;
          border-radius: 18px;
          background: #ddfae9;
          color: #067951;
          font-size: 10px;
          font-weight: 900;
          white-space: nowrap;
        }

        .gr-card {
          min-width: 0;
          background: white;
          border: 1px solid #e0eae5;
          border-radius: 15px;
          padding: 19px;
          box-shadow: 0 4px 17px #123b3008;
          margin-bottom: 15px;
        }

        .gr-card h2 {
          margin: 0 0 8px;
          font-size: 17px;
          color: #123b31;
        }

        .gr-subtitle {
          margin: 0 0 15px;
          font-size: 12px;
          line-height: 1.7;
          color: #788e82;
        }

        .gr-hint {
          color: #83968c;
          line-height: 1.7;
          font-size: 11px;
          margin: 13px 0 0;
        }

        .gr-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }

        .gr-tab {
          border: 1px solid #d9e7df;
          background: white;
          color: #577466;
          border-radius: 10px;
          padding: 11px 16px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 800;
        }

        .gr-tab.active {
          background: #0c9467;
          border-color: #0c9467;
          color: white;
        }

        .gr-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }

        .gr-filter {
          border: 1px solid #d9e8df;
          background: white;
          border-radius: 9px;
          color: #537464;
          padding: 10px 13px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .gr-filter.active {
          background: #e1f8eb;
          border-color: #0ba16d;
          color: #087c54;
        }

        .gr-select {
          border: 1px solid #d9e8df;
          background: white;
          border-radius: 9px;
          padding: 10px;
          color: #173e31;
          font-size: 12px;
          min-width: 115px;
        }

        .gr-filter-custom {
          border-top: 1px solid #edf2ef;
          margin-top: 15px;
          padding-top: 15px;
        }

        .gr-week-buttons {
          display: grid;
          grid-template-columns: repeat(13, minmax(0,1fr));
          gap: 6px;
        }

        .gr-week-button {
          border: 1px solid #dce9e1;
          border-radius: 8px;
          padding: 9px 2px;
          background: #f8fbf9;
          color: #456557;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
        }

        .gr-week-button.active {
          background: #0b9567;
          border-color: #0b9567;
          color: white;
        }

        .gr-stats {
          display: grid;
          grid-template-columns: repeat(4,minmax(0,1fr));
          gap: 12px;
          margin-bottom: 15px;
        }

        .gr-stat {
          background: white;
          border: 1px solid #e0eae5;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          gap: 12px;
          align-items: center;
          min-width: 0;
        }

        .gr-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #e4f8ed;
          display: grid;
          place-items: center;
          font-size: 21px;
          flex-shrink: 0;
        }

        .gr-tone-blue .gr-stat-icon {
          background: #eaf1ff;
        }

        .gr-tone-orange .gr-stat-icon {
          background: #fff5e5;
        }

        .gr-stat-content {
          min-width: 0;
        }

        .gr-stat-content span {
          display: block;
          font-size: 11px;
          color: #698276;
          line-height: 1.5;
        }

        .gr-stat-content strong {
          display: block;
          font-size: 24px;
          font-weight: 900;
          color: #087d54;
          margin: 5px 0;
        }

        .gr-tone-blue .gr-stat-content strong {
          color: #2563eb;
        }

        .gr-tone-orange .gr-stat-content strong {
          color: #d88919;
        }

        .gr-stat-content small {
          display: block;
          color: #86978f;
          font-size: 10px;
        }

        .gr-two-col {
          display: grid;
          grid-template-columns: minmax(0,1.4fr) minmax(0,1fr);
          gap: 15px;
          align-items: start;
        }

        .gr-two-col.equal {
          grid-template-columns: repeat(2,minmax(0,1fr));
        }

        .gr-chart-wrap {
          width: 100%;
          min-width: 0;
        }

        .gr-chart {
          display: block;
          width: 100%;
          height: auto;
          margin-top: 13px;
          overflow: visible;
        }

        .gr-chart-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .gr-legend {
          display: flex;
          gap: 13px;
          flex-wrap: wrap;
        }

        .gr-legend span,
        .gr-tooltip-values span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #637d6f;
        }

        .gr-legend i,
        .gr-tooltip-values i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }

        .gr-tooltip {
          background: #f0f8f4;
          border: 1px solid #cdebdc;
          border-radius: 10px;
          padding: 11px 13px;
          margin-top: 10px;
          font-size: 12px;
        }

        .gr-tooltip-values {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 8px;
        }

        .gr-empty {
          padding: 15px;
          border: 1px dashed #dce9e1;
          border-radius: 10px;
          text-align: center;
          color: #7b9084;
          background: #f9fbfa;
          font-size: 12px;
          margin-top: 12px;
        }

        .gr-competency-list {
          display: grid;
          gap: 14px;
          margin-top: 18px;
        }

        .gr-competency-row {
          display: grid;
          grid-template-columns: 155px minmax(0,1fr) 95px;
          align-items: center;
          gap: 13px;
        }

        .gr-competency-name {
          display: flex;
          gap: 9px;
          align-items: center;
          font-size: 12px;
          min-width: 0;
        }

        .gr-competency-middle {
          min-width: 0;
        }

        .gr-competency-track {
          height: 12px;
          background: #e8f0eb;
          border-radius: 20px;
          overflow: hidden;
        }

        .gr-competency-fill {
          height: 100%;
          border-radius: 20px;
          background: linear-gradient(
            90deg,
            #07875c,
            #49c99a
          );
        }

        .gr-competency-middle small {
          display: block;
          color: #8b9c92;
          font-size: 10px;
          margin-top: 5px;
        }

        .gr-competency-result {
          text-align: right;
        }

        .gr-competency-result strong {
          color: #087c55;
          font-size: 15px;
          display: block;
        }

        .gr-competency-result small {
          color: #8b9c92;
          font-size: 10px;
        }

        .gr-heat-legend {
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          margin: 12px 0;
        }

        .gr-heat-legend span {
          display: flex;
          gap: 6px;
          align-items: center;
          color: #738a7c;
          font-size: 10px;
        }

        .gr-heat-legend i {
          width: 11px;
          height: 11px;
          border-radius: 3px;
          display: inline-block;
        }

        .heat-done {
          background: #098c63;
        }

        .heat-progress {
          background: #93e7bb;
        }

        .heat-empty {
          background: #e2ebe5;
        }

        .gr-heat-scroll {
          overflow-x: auto;
          width: 100%;
          padding-bottom: 5px;
        }

        .gr-heat-table {
          min-width: 800px;
          display: grid;
          gap: 5px;
        }

        .gr-heat-row {
          display: grid;
          grid-template-columns:
            105px repeat(25,minmax(0,1fr));
          align-items: center;
          gap: 4px;
        }

        .gr-heat-name {
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .gr-heat-week {
          font-size: 9px;
          text-align: center;
          font-weight: 700;
          color: #637d6d;
          padding: 3px 0;
        }

        .gr-heat-week.chosen {
          color: #078d62;
        }

        .gr-heat-cell {
          min-height: 19px;
          border: 1px solid #dce9e1;
          border-radius: 4px;
          cursor: pointer;
          padding: 0;
        }

        .gr-heat-cell.done {
          background: #098c63;
        }

        .gr-heat-cell.progress {
          background: #93e7bb;
        }

        .gr-heat-cell.empty {
          background: #e6eeea;
        }

        .gr-heat-cell.selected {
          outline: 2px solid #0f9c73;
          outline-offset: 1px;
        }

        .gr-weekly-table-wrap {
          overflow-x: auto;
        }

        .gr-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .gr-table th {
          text-align: left;
          padding: 12px 9px;
          background: #f2f8f5;
          color: #597366;
          white-space: nowrap;
        }

        .gr-table td {
          padding: 12px 9px;
          border-bottom: 1px solid #edf2ef;
          color: #385749;
          white-space: nowrap;
        }

        .gr-table tr.active td {
          background: #eaf9f1;
        }

        .gr-table button {
          border: none;
          background: #e3f7eb;
          color: #087b55;
          border-radius: 7px;
          padding: 7px 9px;
          font-weight: 800;
          cursor: pointer;
        }

        .gr-week-details {
          display: grid;
          gap: 11px;
          margin-top: 14px;
        }

        .gr-week-detail {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 11px 0;
          border-bottom: 1px solid #edf2ef;
          font-size: 12px;
        }

        .gr-week-detail strong {
          color: #087d56;
        }

        .gr-lock {
          padding: 11px 14px;
          background: #eef9f2;
          color: #087b54;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.6;
          margin-bottom: 15px;
        }

        .gr-note {
          padding: 15px;
          border-radius: 12px;
          background: #f1faf5;
          color: #517665;
          font-size: 12px;
          line-height: 1.8;
        }

        .gr-actions {
          display: flex;
          gap: 9px;
          justify-content: flex-end;
          flex-wrap: wrap;
          margin-top: 15px;
        }

        .gr-btn {
          border: none;
          background: #0b9465;
          color: white;
          border-radius: 9px;
          padding: 12px 16px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
        }

        .gr-btn.secondary {
          background: #e8f1eb;
          color: #21664b;
        }

        .gr-btn:disabled {
          opacity: .5;
          cursor: not-allowed;
        }

        .gr-error {
          background: #fff0f0;
          color: #b91c1c;
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 15px;
          font-size: 12px;
          line-height: 1.6;
        }

        .gr-footer {
          color: #8ba093;
          text-align: center;
          font-size: 11px;
          padding: 22px 0;
        }

        @media (max-width: 950px) {
          .gr-stats {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .gr-two-col,
          .gr-two-col.equal {
            grid-template-columns: 1fr;
          }

          .gr-week-buttons {
            grid-template-columns: repeat(9,minmax(0,1fr));
          }
        }

        @media (max-width: 650px) {
          .gr-topbar {
            padding: 13px;
          }

          .gr-brand {
            font-size: 18px;
          }

          .gr-back {
            font-size: 11px;
            padding: 9px;
          }

          .gr-container {
            padding: 11px;
          }

          .gr-hero {
            padding: 19px 16px;
            flex-direction: column;
            align-items: stretch;
          }

          .gr-hero h1 {
            font-size: 23px;
          }

          .gr-hero-person {
            background: #ffffff10;
            border-radius: 11px;
            padding: 10px;
          }

          .gr-avatar {
            width: 44px;
            height: 44px;
            font-size: 16px;
          }

          .gr-card {
            padding: 15px;
            border-radius: 13px;
            margin-bottom: 12px;
          }

          .gr-card h2 {
            font-size: 16px;
          }

          .gr-stats {
            gap: 8px;
          }

          .gr-stat {
            padding: 11px;
            gap: 7px;
          }

          .gr-stat-icon {
            width: 35px;
            height: 35px;
            font-size: 17px;
          }

          .gr-stat-content strong {
            font-size: 21px;
          }

          .gr-stat-content span {
            font-size: 10px;
          }

          .gr-stat-content small {
            font-size: 9px;
          }

          .gr-tabs {
            display: grid;
            grid-template-columns: repeat(4,minmax(0,1fr));
            gap: 5px;
          }

          .gr-tab {
            padding: 10px 3px;
            font-size: 10px;
          }

          .gr-filter {
            padding: 10px 9px;
            font-size: 11px;
          }

          .gr-week-buttons {
            grid-template-columns: repeat(5,minmax(0,1fr));
          }

          .gr-competency-row {
            grid-template-columns:
              95px minmax(0,1fr) 55px;
            gap: 7px;
          }

          .gr-competency-name {
            font-size: 10px;
            gap: 4px;
          }

          .gr-competency-result strong {
            font-size: 13px;
          }

          .gr-competency-result small {
            font-size: 9px;
          }

          .gr-competency-middle small {
            font-size: 9px;
          }
        }

        @page {
          size: A4 landscape;
          margin: 8mm;
        }

        @media print {
          body,
          html {
            background: white !important;
          }

          .gr-topbar,
          .gr-tabs,
          .gr-filter-row,
          .gr-filter-custom,
          .gr-actions {
            display: none !important;
          }

          .gr-root {
            background: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .gr-container {
            max-width: none;
            padding: 0;
          }

          .gr-card {
            box-shadow: none;
            break-inside: avoid;
          }

          .gr-two-col,
          .gr-two-col.equal {
            grid-template-columns:
              repeat(2,minmax(0,1fr));
          }

          .gr-heat-scroll,
          .gr-weekly-table-wrap {
            overflow: visible;
          }
        }
      `}</style>

      <header className="gr-topbar">
        <div className="gr-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="gr-top-actions">
          <button
            className="gr-back"
            type="button"
            onClick={() => router.push(backPath)}
          >
            ← {isManager
              ? "Detail Peserta"
              : "Dashboard Peserta"}
          </button>
        </div>
      </header>

      <div className="gr-container">
        <section className="gr-hero">
          <div>
            <small>
              EMERGENCY RESPONSE GROUP · PT BERAU COAL
            </small>

            <h1>Grafik Perkembangan</h1>

            <p>
              Performance Analytics · 25 Weeks OJT
            </p>
          </div>

          {program && (
            <div className="gr-hero-person">
              <div className="gr-avatar">
                {initials(participantName)}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="gr-person-name">
                  {participantName}
                </div>

                <div className="gr-person-meta">
                  {participant?.department || "—"}
                  {" · "}
                  {program.site || "—"}
                  <br />
                  {formatDate(program.start_date)}
                  {" – "}
                  {formatDate(program.end_date)}
                </div>
              </div>

              <span className="gr-status">
                {program.status === "active"
                  ? "Aktif"
                  : "Tidak Aktif"}
              </span>
            </div>
          )}
        </section>

        {loading ? (
          <section className="gr-card">
            <h2>Memuat Grafik Perkembangan...</h2>
            <p className="gr-hint">
              Mengambil data monitoring dari Supabase.
            </p>
          </section>
        ) : !program ? (
          <section className="gr-card">
            <h2>Grafik Tidak Dapat Ditampilkan</h2>

            <div className="gr-error">
              {error || "Data peserta tidak tersedia."}
            </div>

            <button
              type="button"
              className="gr-btn"
              onClick={() => router.push(backPath)}
            >
              Kembali
            </button>
          </section>
        ) : (
          <>
            <div className="gr-lock">
              🔒 Identitas peserta otomatis.
              Grafik hanya menampilkan data{" "}
              <strong>{participantName}</strong>.
              {!isManager &&
                " Peserta hanya dapat melihat program miliknya."}
            </div>

            {error && (
              <div className="gr-error" role="alert">
                {error}
              </div>
            )}

            <nav className="gr-tabs">
              {[
                ["summary", "Ringkasan"],
                ["scores", "Nilai"],
                ["competency", "Kompetensi"],
                ["weekly", "Aktivitas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    "gr-tab " +
                    (activeTab === key ? "active" : "")
                  }
                  onClick={() => goToSection(key)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <section className="gr-card">
              <h2>Pilih Periode Grafik</h2>

              <div className="gr-filter-row">
                {WEEK_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    className={
                      "gr-filter " +
                      (range === option.key ? "active" : "")
                    }
                    onClick={() => setRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {range === "custom" && (
                <div className="gr-filter-custom">
                  <p className="gr-subtitle">
                    Pilih satu minggu atau beberapa
                    minggu yang ingin dibandingkan.
                  </p>

                  <div className="gr-week-buttons">
                    {Array.from(
                      { length: TOTAL_WEEKS },
                      (_, i) => i + 1
                    ).map((week) => (
                      <button
                        type="button"
                        key={week}
                        className={
                          "gr-week-button " +
                          (customWeeks.includes(week)
                            ? "active"
                            : "")
                        }
                        onClick={() => toggleWeek(week)}
                      >
                        W{String(week).padStart(2, "0")}
                      </button>
                    ))}
                  </div>

                  <div className="gr-actions">
                    <button
                      type="button"
                      className="gr-btn secondary"
                      onClick={() =>
                        setCustomWeeks(
                          Array.from(
                            { length: TOTAL_WEEKS },
                            (_, i) => i + 1
                          )
                        )
                      }
                    >
                      Pilih Semua
                    </button>

                    <button
                      type="button"
                      className="gr-btn secondary"
                      onClick={() => setCustomWeeks([])}
                    >
                      Kosongkan Pilihan
                    </button>
                  </div>
                </div>
              )}

              <p className="gr-hint">
                {selectedWeeks.length} minggu dipilih.
                Filter berlaku pada grafik nilai,
                grafik batang, dan tabel monitoring.
                Progres kompetensi serta heatmap
                tetap menggunakan keseluruhan 25 minggu.
              </p>
            </section>

            <section id="gr-summary">
              <div className="gr-stats">
                <StatCard
                  icon="📘"
                  label="Nilai Teori Terakhir"
                  value={scoreText(theoryLatest)}
                  caption={`${theoryWeeks} minggu memiliki nilai`}
                  tone="blue"
                />

                <StatCard
                  icon="⚙️"
                  label="Nilai Praktik Terakhir"
                  value={scoreText(practiceLatest)}
                  caption={`${practiceWeeks} minggu memiliki nilai`}
                />

                <StatCard
                  icon="🏃"
                  label="Nilai Samapta Terakhir"
                  value={scoreText(samaptaLatest)}
                  caption={`${samaptaWeeks} minggu memiliki tes lengkap`}
                  tone="orange"
                />

                <StatCard
                  icon="📊"
                  label="Progres Achievement OJT"
                  value={percentText(overall)}
                  caption={`${completedCategories} dari 6 kategori mencapai 100%`}
                />
              </div>
            </section>

            <div id="gr-scores">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>
                    Perkembangan Nilai OJT
                  </h2>

                  <p className="gr-subtitle">
                    Grafik garis Teori, Praktik,
                    dan Samapta sesuai periode pilihan.
                  </p>

                  <TrendChart
                    data={filteredData}
                    series={theorySeries}
                    title="Perkembangan nilai OJT"
                  />

                  <p className="gr-hint">
                    Tekan titik nilai untuk melihat
                    rincian. Garis hanya menghubungkan
                    minggu berurutan yang memiliki data.
                  </p>
                </section>

                <section className="gr-card">
                  <h2>
                    Perbandingan Nilai Mingguan
                  </h2>

                  <p className="gr-subtitle">
                    Bandingkan tiga komponen penilaian
                    pada minggu yang dipilih.
                  </p>

                  <BarChart
                    data={filteredData}
                    series={theorySeries}
                  />

                  <p className="gr-hint">
                    Kolom tidak ditampilkan jika
                    nilai pada minggu tersebut
                    belum tersedia.
                  </p>
                </section>
              </div>

              <div className="gr-two-col equal">
                <section className="gr-card">
                  <h2>
                    Perkembangan Nilai Samapta
                  </h2>

                  <p className="gr-subtitle">
                    Perbandingan Nilai A,
                    Nilai B, dan Nilai Akhir.
                  </p>

                  <TrendChart
                    data={filteredData}
                    series={samaptaSeries}
                    title="Perkembangan nilai Samapta"
                    compact
                  />
                </section>

                <section className="gr-card">
                  <h2>
                    Distribusi Nilai Samapta
                  </h2>

                  <p className="gr-subtitle">
                    Perbandingan komponen Samapta
                    untuk setiap minggu yang memiliki
                    tes lengkap.
                  </p>

                  <BarChart
                    data={filteredData}
                    series={samaptaSeries}
                  />
                </section>
              </div>
            </div>

            <section id="gr-competency">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>
                    Pencapaian Enam Kompetensi OJT
                  </h2>

                  <p className="gr-subtitle">
                    Persentase dihitung berdasarkan
                    target mingguan selama 25 minggu,
                    sama dengan halaman Achievement.
                  </p>

                  <CompetencyProgress
                    items={categoryData}
                  />

                  <p className="gr-hint">
                    Jumlah kegiatan dan persentase
                    progres adalah dua ukuran berbeda.
                    Pada kategori Fisik, capaian
                    didasarkan pada jarak kilometer,
                    bukan jumlah kegiatan.
                  </p>
                </section>

                <section className="gr-card">
                  <h2>
                    Ringkasan Achievement
                  </h2>

                  <div className="gr-stats" style={{
                    gridTemplateColumns:
                      "repeat(2,minmax(0,1fr))",
                    marginTop: 14,
                  }}>
                    <StatCard
                      icon="✅"
                      label="Kegiatan Terverifikasi"
                      value={numberText(totalVerified)}
                      caption="Total enam kategori"
                    />

                    <StatCard
                      icon="🎯"
                      label="Kategori Lengkap"
                      value={`${completedCategories}/6`}
                      caption="Progres kategori 100%"
                    />
                  </div>

                  <div className="gr-note">
                    <strong>
                      Informasi Perhitungan
                    </strong>

                    <p>
                      Achievement menggunakan target
                      per minggu. Contohnya, Fisik
                      memiliki target 25 km setiap
                      minggu selama 25 minggu OJT.
                    </p>

                    <p>
                      Nilai progres merupakan
                      rata-rata persentase mingguan
                      yang dihitung dari kegiatan
                      berstatus terverifikasi.
                    </p>
                  </div>
                </section>
              </div>

              <section className="gr-card">
                <h2>
                  Heatmap Aktivitas 25 Minggu
                </h2>

                <p className="gr-subtitle">
                  Visualisasi pencapaian dan
                  keberadaan aktivitas terverifikasi
                  pada seluruh minggu OJT.
                </p>

                <Heatmap
                  items={categoryData}
                  selectedWeeks={selectedWeeks}
                  onSelectWeek={showWeek}
                />
              </section>
            </section>

            <section id="gr-weekly">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>
                    Detail Minggu Terpilih
                  </h2>

                  <p className="gr-subtitle">
                    Nilai dan kegiatan pada minggu
                    yang sedang dipilih.
                  </p>

                  <label
                    htmlFor="gr-selected-week"
                    className="gr-subtitle"
                    style={{ display: "block" }}
                  >
                    Pilih Minggu
                  </label>

                  <select
                    id="gr-selected-week"
                    className="gr-select"
                    value={selectedWeek}
                    onChange={(e) =>
                      setSelectedWeek(Number(e.target.value))
                    }
                  >
                    {Array.from(
                      { length: TOTAL_WEEKS },
                      (_, i) => i + 1
                    ).map((week) => (
                      <option key={week} value={week}>
                        Week {String(week).padStart(2, "0")}
                      </option>
                    ))}
                  </select>

                  {activeWeekData && (
                    <>
                      <div className="gr-week-details">
                        {[
                          ["Nilai Teori", activeWeekData.theory],
                          ["Nilai Praktik", activeWeekData.practice],
                          ["Nilai Samapta A", activeWeekData.a],
                          ["Nilai Samapta B", activeWeekData.b],
                          ["Nilai Samapta Akhir", activeWeekData.final],
                        ].map(([label, value]) => (
                          <div
                            className="gr-week-detail"
                            key={label}
                          >
                            <span>{label}</span>
                            <strong>
                              {scoreText(value)}
                            </strong>
                          </div>
                        ))}

                        <div className="gr-week-detail">
                          <span>
                            Kegiatan Terverifikasi
                          </span>
                          <strong>
                            {activeWeekData.totalActivities}
                          </strong>
                        </div>

                        <div className="gr-week-detail">
                          <span>
                            Kategori Memiliki Kegiatan
                          </span>
                          <strong>
                            {activeWeekData.activeCategories}/6
                          </strong>
                        </div>
                      </div>

                      <h2 style={{ marginTop: 22 }}>
                        Aktivitas Kompetensi
                      </h2>

                      <div className="gr-week-details">
                        {activeWeekData.details.map((item) => (
                          <div
                            className="gr-week-detail"
                            key={item.name}
                          >
                            <span>
                              {item.icon} {item.name}
                            </span>

                            <strong>
                              {item.name === "Fisik"
                                ? `${numberText(item.achieved, 3)} km`
                                : `${item.achieved} kegiatan`}
                              {" · "}
                              {item.percent}%
                            </strong>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>

                <section className="gr-card">
                  <h2>
                    Rekap Nilai Mingguan
                  </h2>

                  <p className="gr-subtitle">
                    Pilih tombol Detail untuk
                    melihat satu minggu tertentu.
                  </p>

                  <div className="gr-weekly-table-wrap">
                    <table className="gr-table">
                      <thead>
                        <tr>
                          <th>Minggu</th>
                          <th>Teori</th>
                          <th>Praktik</th>
                          <th>Samapta</th>
                          <th>Kegiatan</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {weeklySummary
                          .filter((item) =>
                            selectedWeeks.includes(item.week)
                          )
                          .map((item) => (
                            <tr
                              key={item.week}
                              className={
                                selectedWeek === item.week
                                  ? "active"
                                  : ""
                              }
                            >
                              <td>
                                Week {item.week}
                              </td>

                              <td>
                                {scoreText(item.theory)}
                              </td>

                              <td>
                                {scoreText(item.practice)}
                              </td>

                              <td>
                                {scoreText(item.final)}
                              </td>

                              <td>
                                {item.totalActivities}
                              </td>

                              <td>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedWeek(item.week)
                                  }
                                >
                                  Detail
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>

                    {!selectedWeeks.length && (
                      <div className="gr-empty">
                        Pilih minimal satu minggu
                        untuk menampilkan rekap.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            <section className="gr-card">
              <h2>
                Kesimpulan Monitoring
              </h2>

              <div className="gr-note">
                Data Post-Test tersedia pada{" "}
                <strong>{theoryWeeks}</strong> minggu,
                Praktik Mingguan pada{" "}
                <strong>{practiceWeeks}</strong> minggu,
                dan Samapta lengkap pada{" "}
                <strong>{samaptaWeeks}</strong> minggu.

                <p>
                  Jumlah Achievement terverifikasi
                  selama 25 minggu adalah{" "}
                  <strong>{totalVerified}</strong>{" "}
                  kegiatan. Rata-rata progres
                  enam kategori adalah{" "}
                  <strong>{overall}%</strong>.
                </p>

                <p>
                  {completedCategories} dari 6 kategori
                  sudah mencapai progres 100%.
                  Grafik hanya menampilkan data yang
                  tercatat dan tidak memberikan
                  nilai otomatis untuk minggu kosong.
                </p>

                <p>
                  Grafik ini merupakan alat monitoring
                  perkembangan, bukan keputusan
                  kelulusan akhir peserta OJT.
                </p>
              </div>

              <div className="gr-actions">
                <button
                  type="button"
                  className="gr-btn secondary"
                  disabled={refreshing}
                  onClick={refresh}
                >
                  {refreshing
                    ? "Memperbarui..."
                    : "↻ Refresh Data"}
                </button>

                <button
                  type="button"
                  className="gr-btn"
                  onClick={printPage}
                >
                  ↓ Cetak / Simpan Grafik
                </button>
              </div>
            </section>
          </>
        )}

        <footer className="gr-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
