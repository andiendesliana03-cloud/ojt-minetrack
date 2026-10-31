
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =======================================================
// OJT MINETRACK V2.0
// GRAFIK PERKEMBANGAN - GLOBAL CALENDAR
// =======================================================

const TOTAL_WEEKS = 25;

const CATEGORIES = [
  {
    name: "Fisik",
    target: 25,
    unit: "km",
    icon: "🏃",
    aliases: ["fisik", "physical"],
  },
  {
    name: "Training",
    target: 4,
    unit: "kegiatan",
    icon: "📚",
    aliases: [
      "training",
      "internaltraining",
      "pelatihan",
    ],
  },
  {
    name: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
    icon: "👥",
    aliases: ["sosialisasi", "socialization"],
  },
  {
    name: "Coaching",
    target: 1,
    unit: "kegiatan",
    icon: "💬",
    aliases: ["coaching", "pembinaan"],
  },
  {
    name: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
    icon: "🧭",
    aliases: [
      "orientasi",
      "orientasiarea",
      "areaorientation",
    ],
  },
  {
    name: "Hazard",
    target: 2,
    unit: "kegiatan",
    icon: "⚠️",
    aliases: [
      "hazard",
      "hazardidentification",
      "identifikasibahaya",
    ],
  },
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
  { key: "all", label: "Week 01–25" },
  { key: "first", label: "Week 01–13" },
  { key: "second", label: "Week 14–25" },
  { key: "custom", label: "Pilih Minggu" },
];

// =======================================================
// UTILITIES
// =======================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

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

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
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

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

function scoreText(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percentText(value) {
  return `${numberText(value, 2)}%`;
}

function numberText(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
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
  const numbers = records
    .filter(
      (item) =>
        item.score !== null &&
        item.score !== undefined &&
        item.score !== ""
    )
    .map((item) => Number(item.score))
    .filter(Number.isFinite);

  if (!numbers.length) return null;

  return (
    numbers.reduce((sum, value) => sum + value, 0) /
    numbers.length
  );
}

function cappedPercent(actual, target) {
  if (!(target > 0)) return 0;

  return Math.min(
    100,
    Math.max(0, (actual / target) * 100)
  );
}

// =======================================================
// KALENDER GLOBAL
//
// WEEK 01 = 12-18 SEPTEMBER 2026
// 19 SEPTEMBER 2026 DIKECUALIKAN
// WEEK 02 = 20-26 SEPTEMBER 2026
// WEEK 07 = 25-31 OKTOBER 2026
// WEEK 08 = 01-07 NOVEMBER 2026
// WEEK 25 = 28 FEB-06 MARET 2027
// =======================================================

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? "2026-09-12"
        : addDays("2026-09-20", (index - 1) * 7);

    return {
      week: index + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date)) return null;

  return (
    GLOBAL_WEEKS.find(
      (item) =>
        date >= item.start &&
        date <= item.end
    )?.week ?? null
  );
}

function getGlobalWeek(week) {
  return (
    GLOBAL_WEEKS.find(
      (item) => item.week === Number(week)
    ) || null
  );
}

function programWeekRange(program, week) {
  const global = getGlobalWeek(week);

  if (
    !global ||
    !parseDate(program?.start_date)
  ) {
    return null;
  }

  const startDate = String(program.start_date)
    .slice(0, 10);

  const endDate = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    global.start > startDate
      ? global.start
      : startDate;

  const end =
    endDate && endDate < global.end
      ? endDate
      : global.end;

  if (start > end) return null;

  return { start, end };
}

function availableGlobalWeeks(program) {
  if (!program) return [];

  return GLOBAL_WEEKS.filter(
    (item) =>
      programWeekRange(program, item.week)
  );
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (
    !parseDate(date) ||
    !parseDate(program?.start_date)
  ) {
    return false;
  }

  if (date < String(program.start_date).slice(0, 10)) {
    return false;
  }

  if (
    parseDate(program.end_date) &&
    date > String(program.end_date).slice(0, 10)
  ) {
    return false;
  }

  return globalWeekOf(date) !== null;
}

function initialGlobalWeek(program, records = []) {
  const available = availableGlobalWeeks(program);

  if (!available.length) return 1;

  const now = todayWITA();

  const current = available.find((item) => {
    const range = programWeekRange(
      program,
      item.week
    );

    return (
      range &&
      now >= range.start &&
      now <= range.end
    );
  });

  if (current) return current.week;

  const lastRecorded = records
    .filter((item) =>
      insideProgram(item.activity_date, program)
    )
    .map((item) =>
      globalWeekOf(item.activity_date)
    )
    .filter(Boolean);

  if (lastRecorded.length) {
    return Math.max(...lastRecorded);
  }

  const upcoming = available.find(
    (item) => item.end >= now
  );

  return upcoming
    ? upcoming.week
    : available[available.length - 1].week;
}

// =======================================================
// CATEGORY RESOLVER
// =======================================================

function resolveCategory(typeCode, types) {
  const match = types.find(
    (item) =>
      normalize(item.code) === normalize(typeCode)
  );

  const candidates = [
    typeCode,
    match?.name,
  ].filter(Boolean);

  return (
    CATEGORIES.find((category) =>
      candidates.some((candidate) =>
        category.aliases.some(
          (alias) =>
            normalize(candidate) === normalize(alias)
        )
      )
    )?.name || null
  );
}

function actualAchievement(category, records) {
  if (category.name !== "Fisik") {
    return records.length;
  }

  const meters = records.reduce(
    (sum, item) => {
      const distance = Number(item.distance_km);

      if (
        !Number.isFinite(distance) ||
        distance <= 0
      ) {
        return sum;
      }

      return sum + Math.round(distance * 1000);
    },
    0
  );

  return meters / 1000;
}

// =======================================================
// SAMAPTA
// =======================================================

function calculateSamapta(records) {
  const byDate = new Map();

  records.forEach((record) => {
    if (!parseDate(record.test_date)) return;

    const date = String(record.test_date)
      .slice(0, 10);

    if (!byDate.has(date)) {
      byDate.set(date, []);
    }

    byDate.get(date).push(record);
  });

  const results = [];

  byDate.forEach((items, date) => {
    function get(type) {
      const record = items.find(
        (item) =>
          normalize(item.test_type) === normalize(type)
      );

      if (
        !record ||
        record.score === null ||
        record.score === undefined ||
        record.score === ""
      ) {
        return null;
      }

      const score = Number(record.score);

      return Number.isFinite(score)
        ? score
        : null;
    }

    const a = get("Lari 12 Menit");

    const components = [
      get("Pull-Up"),
      get("Push-Up"),
      get("Sit-Up"),
      get("Shuttle Run"),
    ];

    if (
      a === null ||
      components.some((item) => item === null)
    ) {
      return;
    }

    const b =
      components.reduce(
        (sum, value) => sum + value,
        0
      ) / components.length;

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

// =======================================================
// WEEKLY SCORES
// =======================================================

function buildWeeklyScores(
  program,
  postTests,
  practices,
  samaptaResults
) {
  const weeks = GLOBAL_WEEKS.map((item) => ({
    week: item.week,
    start: item.start,
    end: item.end,
    available: Boolean(
      programWeekRange(program, item.week)
    ),
    theory: null,
    practice: null,
    a: null,
    b: null,
    final: null,
  }));

  const postByWeek = new Map();
  const practiceByWeek = new Map();

  function addRecord(map, record, dateField) {
    if (!insideProgram(record[dateField], program)) {
      return;
    }

    const week = globalWeekOf(record[dateField]);

    if (week === null) return;

    if (!map.has(week)) map.set(week, []);

    map.get(week).push(record);
  }

  postTests.forEach((item) =>
    addRecord(postByWeek, item, "test_date")
  );

  practices.forEach((item) =>
    addRecord(
      practiceByWeek,
      item,
      "practice_date"
    )
  );

  weeks.forEach((item) => {
    if (!item.available) return;

    item.theory = average(
      postByWeek.get(item.week) || []
    );

    item.practice = average(
      practiceByWeek.get(item.week) || []
    );
  });

  // Tes Samapta lengkap terakhir pada minggu
  // yang sama, mengikuti logika sebelumnya.
  samaptaResults.forEach((item) => {
    if (!insideProgram(item.date, program)) {
      return;
    }

    const week = globalWeekOf(item.date);

    if (week === null) return;

    const target = weeks[week - 1];

    if (!target?.available) return;

    target.a = item.a;
    target.b = item.b;
    target.final = item.final;
  });

  return weeks;
}

function latestValue(data, key) {
  const available = data.filter(
    (item) =>
      item.available &&
      item[key] !== null &&
      item[key] !== undefined
  );

  return available.length
    ? available[available.length - 1][key]
    : null;
}

// =======================================================
// CHARTS
// =======================================================

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

  const domainSize = Math.max(
    1,
    maxWeek - minWeek
  );

  const x = (week) =>
    left +
    ((week - minWeek) / domainSize) *
      innerWidth;

  const y = (value) =>
    top +
    ((100 - Math.max(0, Math.min(100, value))) /
      100) *
      innerHeight;

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
    data.some(
      (point) =>
        point.available &&
        point[item.key] != null
    )
  );

  const selected = data.find(
    (item) =>
      item.week === activeWeek &&
      item.available
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
            .filter(
              (point) =>
                point.available &&
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
              {segments.map((segment, index) => (
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
                  onClick={() =>
                    chooseWeek(point.week)
                  }
                >
                  <title>
                    {item.name} ·{" "}
                    {weekLabel(point.week)}
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
            {weekLabel(selected.week)}
          </strong>
          {" · "}
          {formatDate(selected.start)}
          {" – "}
          {formatDate(selected.end)}

          <div className="gr-tooltip-values">
            {series.map((item) => (
              <span key={item.key}>
                <i
                  style={{
                    background: item.color,
                  }}
                />
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
    top +
    ((100 - Math.max(0, Math.min(100, value))) /
      100) *
      innerHeight;

  const ticks = [0, 25, 50, 75, 100];

  const groupWidth = data.length
    ? innerWidth / data.length
    : innerWidth;

  const barWidth = Math.min(
    19,
    Math.max(
      2,
      (groupWidth - 9) / series.length - 3
    )
  );

  const hasData = data.some(
    (item) =>
      item.available &&
      series.some(
        (s) => item[s.key] != null
      )
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
              left +
              groupWidth * (index + 0.5);

            return (
              <g key={point.week}>
                {series.map((s, seriesIndex) => {
                  const value = point[s.key];

                  if (
                    !point.available ||
                    value == null
                  ) {
                    return null;
                  }

                  const bounded = Math.max(
                    0,
                    Math.min(100, Number(value))
                  );

                  const groupBarsWidth =
                    series.length *
                    (barWidth + 3);

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
                        top +
                          innerHeight -
                          y(bounded)
                      )}
                      rx="3"
                      fill={s.color}
                    >
                      <title>
                        {weekLabel(point.week)}
                        {" · "}
                        {s.name}:{" "}
                        {scoreText(value)}
                      </title>
                    </rect>
                  );
                })}

                {(
                  data.length <= 13 ||
                  index %
                    Math.ceil(data.length / 12) ===
                    0 ||
                  index === data.length - 1
                ) && (
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
          Tidak ada nilai pada minggu
          yang dipilih.
        </div>
      )}
    </div>
  );
}

// =======================================================
// STAT CARD
// =======================================================

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

// =======================================================
// COMPETENCY PROGRESS
// =======================================================

function CompetencyProgress({
  items,
  weekCount,
}) {
  return (
    <div className="gr-competency-list">
      {items.map((item) => (
        <div
          className="gr-competency-row"
          key={item.name}
        >
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
              {item.completedWeeks}/{weekCount}
              {" "}minggu aktif mencapai target
            </small>
          </div>

          <div className="gr-competency-result">
            <strong>
              {percentText(item.percent)}
            </strong>
            <small>
              {item.verified} kegiatan
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

// =======================================================
// HEATMAP
// =======================================================

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

        <span>
          <i className="heat-outside" />
          Di luar periode OJT
        </span>
      </div>

      <div className="gr-heat-scroll">
        <div className="gr-heat-table">
          <div className="gr-heat-row">
            <div className="gr-heat-name">
              Kategori
            </div>

            {GLOBAL_WEEKS.map((item) => (
              <div
                key={item.week}
                className={
                  "gr-heat-week " +
                  (
                    selectedWeeks.includes(item.week)
                      ? "chosen"
                      : ""
                  )
                }
              >
                {item.week}
              </div>
            ))}
          </div>

          {items.map((item) => (
            <div
              className="gr-heat-row"
              key={item.name}
            >
              <div className="gr-heat-name">
                {item.name}
              </div>

              {item.weekly.map((week) => {
                const state = !week.available
                  ? "outside"
                  : week.completed
                  ? "done"
                  : week.percent > 0
                  ? "progress"
                  : "empty";

                return (
                  <button
                    type="button"
                    key={week.week}
                    disabled={!week.available}
                    className={
                      `gr-heat-cell ${state} ` +
                      (
                        selectedWeeks.includes(week.week)
                          ? "selected"
                          : ""
                      )
                    }
                    title={
                      `${item.name} · ${weekLabel(week.week)} ` +
                      `(${formatDate(week.start)}–` +
                      `${formatDate(week.end)}): ` +
                      (
                        !week.available
                          ? "Di luar periode OJT"
                          : `${numberText(
                              week.achieved,
                              item.name === "Fisik" ? 3 : 0
                            )} ${item.unit}, ` +
                            `${percentText(week.percent)} dari target`
                      )
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
        Heatmap memakai Kalender Global
        Week 01–25. Minggu di luar periode
        OJT ditandai abu-abu bergaris,
        sedangkan minggu aktif tanpa
        kegiatan tetap bernilai 0%.
        Klik kotak aktif untuk melihat detail.
      </p>
    </div>
  );
}

// =======================================================
// MAIN PAGE
// =======================================================

export default function GrafikPerkembanganOJT() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [program, setProgram] = useState(null);
  const [viewer, setViewer] = useState(null);

  const [categories, setCategories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practice, setPractice] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [range, setRange] = useState("all");
  const [customWeeks, setCustomWeeks] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeTab, setActiveTab] = useState("summary");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = normalizeRole(viewer?.role);

  const isManager =
    role === "admin" ||
    role === "mentor";

  const backPath = isManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  // =====================================================
  // SUPABASE
  // =====================================================

  const fetchData = useCallback(async (id) => {
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

    const labels = [
      "Kategori",
      "Achievement",
      "Post-Test",
      "Praktik",
      "Samapta",
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    });

    return {
      categories: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practice: results[3].data || [],
      samapta: results[4].data || [],
    };
  }, []);

  const verifyAccess = useCallback(async (id) => {
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
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error(
        "Profil pengguna tidak ditemukan."
      );
    }

    const currentRole = normalizeRole(profile.role);

    const manager = ["admin", "mentor"].includes(
      currentRole
    );

    const participant = [
      "participant",
      "peserta",
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
        mentor_id,
        site,
        start_date,
        end_date,
        status,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", id);

    if (currentRole === "mentor") {
      query = query.eq(
        "mentor_id",
        user.id
      );
    }

    if (participant) {
      query = query.eq(
        "participant_id",
        user.id
      );
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
        "Tanggal mulai OJT tidak valid."
      );
    }

    if (
      programData.end_date &&
      !parseDate(programData.end_date)
    ) {
      throw new Error(
        "Tanggal selesai OJT tidak valid."
      );
    }

    if (participant) {
      const status = normalize(programData.status);

      if (
        !["active", "approved", "aktif"].includes(status)
      ) {
        throw new Error(
          "Grafik peserta hanya tersedia untuk program aktif atau disetujui."
        );
      }
    }

    return {
      user,
      profile,
      programData,
    };
  }, []);

  const applyData = useCallback((data) => {
    setCategories(data.categories);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractice(data.practice);
    setSamapta(data.samapta);
  }, []);

  // =====================================================
  // INITIAL LOAD
  // =====================================================

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
      setViewer(null);

      try {
        const access = await verifyAccess(
          programId
        );

        const data = await fetchData(
          access.programData.id
        );

        if (!active) return;

        setProgram(access.programData);
        setViewer(access.profile);
        applyData(data);

        const initialWeek = initialGlobalWeek(
          access.programData,
          data.achievements
        );

        setSelectedWeek(initialWeek);
        setCustomWeeks([initialWeek]);
      } catch (err) {
        if (active) {
          setError(
            err?.message ||
            "Gagal memuat Grafik Perkembangan."
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
  }, [
    programId,
    fetchData,
    verifyAccess,
    applyData,
  ]);

  async function refresh() {
    if (
      !program?.id ||
      loading ||
      refreshing
    ) {
      return;
    }

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess(
        programId
      );

      if (access.user.id !== viewer?.id) {
        throw new Error(
          "Akun login berubah. Buka ulang halaman."
        );
      }

      const data = await fetchData(
        access.programData.id
      );

      setProgram(access.programData);
      setViewer(access.profile);
      applyData(data);

      const allowed = availableGlobalWeeks(
        access.programData
      ).map((item) => item.week);

      if (!allowed.includes(selectedWeek)) {
        setSelectedWeek(
          initialGlobalWeek(
            access.programData,
            data.achievements
          )
        );
      }
    } catch (err) {
      // Jangan terus menampilkan data lama apabila
      // otorisasi atau refresh gagal.
      setProgram(null);
      setError(
        err?.message ||
        "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // =====================================================
  // AVAILABLE WEEKS
  // =====================================================

  const availableWeeks = useMemo(
    () => availableGlobalWeeks(program),
    [program]
  );

  const allowedWeeks = useMemo(
    () => new Set(
      availableWeeks.map((item) => item.week)
    ),
    [availableWeeks]
  );

  const selectedWeeks = useMemo(() => {
    let source = [];

    if (range === "first") {
      source = GLOBAL_WEEKS.slice(0, 13);
    } else if (range === "second") {
      source = GLOBAL_WEEKS.slice(13);
    } else if (range === "custom") {
      source = GLOBAL_WEEKS.filter(
        (item) =>
          customWeeks.includes(item.week)
      );
    } else {
      source = GLOBAL_WEEKS;
    }

    return source
      .map((item) => item.week)
      .filter((week) => allowedWeeks.has(week));
  }, [
    range,
    customWeeks,
    allowedWeeks,
  ]);

  function toggleWeek(week) {
    if (!allowedWeeks.has(week)) return;

    setCustomWeeks((previous) =>
      previous.includes(week)
        ? previous.filter(
            (item) => item !== week
          )
        : [...previous, week].sort(
            (a, b) => a - b
          )
    );
  }

  function showWeek(week) {
    if (!allowedWeeks.has(week)) return;

    setRange("custom");
    setCustomWeeks([week]);
    setSelectedWeek(week);
    setActiveTab("weekly");

    document.getElementById(
      "gr-weekly"
    )?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function goToSection(section) {
    setActiveTab(section);

    const ids = {
      summary: "gr-summary",
      scores: "gr-scores",
      competency: "gr-competency",
      weekly: "gr-weekly",
    };

    document.getElementById(
      ids[section]
    )?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  // =====================================================
  // TEORI / PRAKTIK / SAMAPTA
  // =====================================================

  const samaptaResults = useMemo(
    () => calculateSamapta(samapta),
    [samapta]
  );

  const weeklyData = useMemo(
    () =>
      program
        ? buildWeeklyScores(
            program,
            postTests,
            practice,
            samaptaResults
          )
        : [],
    [
      program,
      postTests,
      practice,
      samaptaResults,
    ]
  );

  const filteredData = useMemo(
    () =>
      weeklyData.filter(
        (item) =>
          item.available &&
          selectedWeeks.includes(item.week)
      ),
    [
      weeklyData,
      selectedWeeks,
    ]
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
    (item) =>
      item.available &&
      item.theory !== null
  ).length;

  const practiceWeeks = weeklyData.filter(
    (item) =>
      item.available &&
      item.practice !== null
  ).length;

  const samaptaWeeks = weeklyData.filter(
    (item) =>
      item.available &&
      item.final !== null
  ).length;

  // =====================================================
  // COMPETENCY DATA
  // =====================================================

  const categoryData = useMemo(() => {
    const verifiedRecords = achievements.filter(
      (item) =>
        normalize(item.status) === "verified" &&
        insideProgram(item.activity_date, program)
    );

    const categorizedRecords = verifiedRecords.map(
      (item) => ({
        ...item,
        resolvedCategory: resolveCategory(
          item.type_code,
          categories
        ),
        globalWeek: globalWeekOf(
          item.activity_date
        ),
      })
    );

    return CATEGORIES.map((category) => {
      const matching = categorizedRecords.filter(
        (item) =>
          item.resolvedCategory === category.name
      );

      const weekly = GLOBAL_WEEKS.map(
        (global) => {
          const available = Boolean(
            programWeekRange(
              program,
              global.week
            )
          );

          const records = available
            ? matching.filter(
                (item) =>
                  item.globalWeek === global.week
              )
            : [];

          const achieved = available
            ? actualAchievement(
                category,
                records
              )
            : 0;

          const percent = available
            ? cappedPercent(
                achieved,
                category.target
              )
            : null;

          return {
            week: global.week,
            start: global.start,
            end: global.end,
            available,
            achieved,
            count: records.length,
            percent,
            completed:
              available &&
              achieved >= category.target,
          };
        }
      );

      const active = weekly.filter(
        (item) => item.available
      );

      const percent = active.length
        ? active.reduce(
            (sum, item) =>
              sum + item.percent,
            0
          ) / active.length
        : 0;

      return {
        ...category,
        verified: matching.length,
        weekly,
        activeWeeks: active.length,
        completedWeeks: active.filter(
          (item) => item.completed
        ).length,
        percent,
      };
    });
  }, [
    achievements,
    categories,
    program,
  ]);

  const totalAvailableWeeks = availableWeeks.length;

  const overall = categoryData.length
    ? categoryData.reduce(
        (sum, category) =>
          sum + category.percent,
        0
      ) / categoryData.length
    : 0;

  const completedCategories = categoryData.filter(
    (item) =>
      item.activeWeeks > 0 &&
      item.completedWeeks === item.activeWeeks
  ).length;

  const totalVerified = categoryData.reduce(
    (sum, item) =>
      sum + item.verified,
    0
  );

  // =====================================================
  // WEEKLY SUMMARY
  // =====================================================

  const weeklySummary = useMemo(
    () =>
      weeklyData.map((item) => {
        const details = categoryData.map(
          (category) => ({
            name: category.name,
            icon: category.icon,
            unit: category.unit,
            target: category.target,
            ...category.weekly[item.week - 1],
          })
        );

        const totalActivities = details.reduce(
          (sum, detail) =>
            sum + detail.count,
          0
        );

        const activeCategories = details.filter(
          (detail) =>
            detail.count > 0
        ).length;

        const completedThisWeek = details.filter(
          (detail) =>
            detail.completed
        ).length;

        const progress = item.available
          ? details.reduce(
              (sum, detail) =>
                sum + (detail.percent || 0),
              0
            ) / CATEGORIES.length
          : null;

        return {
          ...item,
          details,
          totalActivities,
          activeCategories,
          completedThisWeek,
          progress,
        };
      }),
    [
      weeklyData,
      categoryData,
    ]
  );

  const activeWeekData = weeklySummary.find(
    (item) =>
      item.week === selectedWeek &&
      item.available
  );

  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name ||
    "Peserta OJT";

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

  // =====================================================
  // UI
  // =====================================================

  return (
    <main className="gr-root">
      <style>{css}</style>

      <header className="gr-topbar">
        <div className="gr-brand">
          OJT <span>MineTrack</span>
        </div>

        <div className="gr-top-actions">
          <button
            type="button"
            className="gr-back"
            onClick={() =>
              router.push(backPath)
            }
          >
            ←{" "}
            {isManager
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
              Performance Analytics ·
              Kalender Global Week 01–25
            </p>
          </div>

          {program && (
            <div className="gr-hero-person">
              <div className="gr-avatar">
                {initials(participantName)}
              </div>

              <div style={{
                minWidth: 0,
                flex: 1,
              }}>
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

                <div className="gr-person-meta">
                  Dibuka oleh:{" "}
                  {viewer?.full_name || "—"}
                </div>
              </div>

              <span className="gr-status">
                {["active", "approved", "aktif"].includes(
                  normalize(program.status)
                )
                  ? "Aktif"
                  : program.status || "—"}
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
            <h2>
              Grafik Tidak Dapat Ditampilkan
            </h2>

            <div className="gr-error">
              {error || "Data peserta tidak tersedia."}
            </div>

            <button
              type="button"
              className="gr-btn"
              onClick={() =>
                router.push(backPath)
              }
            >
              Kembali
            </button>
          </section>
        ) : (
          <>
            <div className="gr-lock">
              🔒 Grafik menampilkan data program{" "}
              <strong>{participantName}</strong>
              {" "}berdasarkan Kalender Global.
              {!isManager &&
                " Peserta hanya dapat melihat program miliknya."}
              {" "}Periode aktif peserta:
              {" "}
              <strong>
                {totalAvailableWeeks} minggu global
              </strong>.
            </div>

            {error && (
              <div className="gr-error">
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
                    (
                      activeTab === key
                        ? "active"
                        : ""
                    )
                  }
                  onClick={() =>
                    goToSection(key)
                  }
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* FILTER */}

            <section className="gr-card">
              <h2>Pilih Periode Grafik</h2>

              <div className="gr-filter-row">
                {WEEK_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.key}
                    className={
                      "gr-filter " +
                      (
                        range === option.key
                          ? "active"
                          : ""
                      )
                    }
                    onClick={() =>
                      setRange(option.key)
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {range === "custom" && (
                <div className="gr-filter-custom">
                  <p className="gr-subtitle">
                    Pilih minggu global yang ingin
                    dibandingkan. Minggu di luar
                    periode OJT tidak dapat dipilih.
                  </p>

                  <div className="gr-week-buttons">
                    {GLOBAL_WEEKS.map((item) => (
                      <button
                        type="button"
                        key={item.week}
                        disabled={
                          !allowedWeeks.has(item.week)
                        }
                        title={
                          `${weekLabel(item.week)}: ` +
                          `${formatDate(item.start)}–` +
                          `${formatDate(item.end)}`
                        }
                        className={
                          "gr-week-button " +
                          (
                            customWeeks.includes(item.week)
                              ? "active"
                              : ""
                          )
                        }
                        onClick={() =>
                          toggleWeek(item.week)
                        }
                      >
                        W{String(item.week).padStart(2, "0")}
                      </button>
                    ))}
                  </div>

                  <div className="gr-actions">
                    <button
                      type="button"
                      className="gr-btn secondary"
                      onClick={() =>
                        setCustomWeeks(
                          availableWeeks.map(
                            (item) => item.week
                          )
                        )
                      }
                    >
                      Pilih Semua Minggu Aktif
                    </button>

                    <button
                      type="button"
                      className="gr-btn secondary"
                      onClick={() =>
                        setCustomWeeks([])
                      }
                    >
                      Kosongkan Pilihan
                    </button>
                  </div>
                </div>
              )}

              <p className="gr-hint">
                {selectedWeeks.length} minggu aktif
                dipilih dari {totalAvailableWeeks}
                {" "}minggu global program.
                Filter berlaku pada grafik nilai,
                grafik batang, dan tabel.
                Ringkasan keseluruhan serta
                heatmap menggunakan semua minggu
                dalam periode OJT.
              </p>
            </section>

            {/* SUMMARY */}

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
                  caption={`${completedCategories} dari 6 kategori memenuhi semua minggu aktif`}
                />
              </div>
            </section>

            {/* SCORES */}

            <div id="gr-scores">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>Perkembangan Nilai OJT</h2>

                  <p className="gr-subtitle">
                    Grafik Teori, Praktik, dan Samapta
                    pada minggu global terpilih.
                  </p>

                  <TrendChart
                    data={filteredData}
                    series={theorySeries}
                    title="Perkembangan nilai OJT"
                  />

                  <p className="gr-hint">
                    Tekan titik untuk melihat rincian.
                    Garis tidak menyambungkan minggu
                    kosong yang belum memiliki nilai.
                  </p>
                </section>

                <section className="gr-card">
                  <h2>
                    Perbandingan Nilai Mingguan
                  </h2>

                  <p className="gr-subtitle">
                    Perbandingan tiga komponen
                    penilaian setiap minggu.
                  </p>

                  <BarChart
                    data={filteredData}
                    series={theorySeries}
                  />
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
                    Hanya tes Samapta lengkap
                    yang dihitung.
                  </p>

                  <BarChart
                    data={filteredData}
                    series={samaptaSeries}
                  />
                </section>
              </div>
            </div>

            {/* COMPETENCY */}

            <section id="gr-competency">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>
                    Pencapaian Enam Kompetensi
                  </h2>

                  <p className="gr-subtitle">
                    Rata-rata target mingguan
                    hanya pada minggu global yang
                    termasuk periode OJT peserta.
                  </p>

                  <CompetencyProgress
                    items={categoryData}
                    weekCount={totalAvailableWeeks}
                  />

                  <p className="gr-hint">
                    Realisasi Fisik dihitung dalam
                    kilometer. Kategori lain
                    menggunakan jumlah kegiatan.
                    Persentase setiap minggu
                    dibatasi maksimal 100%.
                  </p>
                </section>

                <section className="gr-card">
                  <h2>
                    Ringkasan Achievement
                  </h2>

                  <div className="gr-stats gr-stats-inline">
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
                      caption="Semua minggu aktif mencapai target"
                    />
                  </div>

                  <div className="gr-note">
                    <strong>
                      Informasi Perhitungan
                    </strong>

                    <p>
                      Nomor minggu mengikuti Kalender
                      Global OJT, bukan tanggal mulai
                      masing-masing peserta.
                    </p>

                    <p>
                      Minggu yang berada sebelum tanggal
                      mulai atau setelah tanggal selesai
                      OJT ditandai sebagai di luar
                      periode, bukan 0%.
                    </p>

                    <p>
                      Minggu aktif tanpa kegiatan
                      dihitung 0% untuk Achievement.
                      Perhitungan tidak membulatkan
                      persentase mingguan sebelum
                      mengambil rata-rata.
                    </p>
                  </div>
                </section>
              </div>

              <section className="gr-card">
                <h2>
                  Heatmap Aktivitas 25 Minggu
                </h2>

                <p className="gr-subtitle">
                  Semua Week Global tetap terlihat,
                  dengan pembedaan minggu aktif dan
                  minggu di luar periode peserta.
                </p>

                <Heatmap
                  items={categoryData}
                  selectedWeeks={selectedWeeks}
                  onSelectWeek={showWeek}
                />
              </section>
            </section>

            {/* WEEKLY DETAIL */}

            <section id="gr-weekly">
              <div className="gr-two-col">
                <section className="gr-card">
                  <h2>
                    Detail Minggu Terpilih
                  </h2>

                  <p className="gr-subtitle">
                    Nilai dan realisasi Achievement
                    pada satu minggu global.
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
                    value={
                      allowedWeeks.has(selectedWeek)
                        ? selectedWeek
                        : ""
                    }
                    onChange={(event) =>
                      setSelectedWeek(
                        Number(event.target.value)
                      )
                    }
                  >
                    {!availableWeeks.length && (
                      <option value="">
                        Tidak tersedia
                      </option>
                    )}

                    {availableWeeks.map((item) => (
                      <option
                        key={item.week}
                        value={item.week}
                      >
                        {weekLabel(item.week)}
                        {" · "}
                        {formatDate(item.start)}
                        {" – "}
                        {formatDate(item.end)}
                      </option>
                    ))}
                  </select>

                  {activeWeekData && (
                    <>
                      <p className="gr-hint">
                        {formatDate(activeWeekData.start)}
                        {" – "}
                        {formatDate(activeWeekData.end)}
                      </p>

                      <div className="gr-week-details">
                        {[
                          [
                            "Nilai Teori",
                            scoreText(activeWeekData.theory),
                          ],
                          [
                            "Nilai Praktik",
                            scoreText(activeWeekData.practice),
                          ],
                          [
                            "Nilai Samapta A",
                            scoreText(activeWeekData.a),
                          ],
                          [
                            "Nilai Samapta B",
                            scoreText(activeWeekData.b),
                          ],
                          [
                            "Nilai Samapta Akhir",
                            scoreText(activeWeekData.final),
                          ],
                          [
                            "Kegiatan Terverifikasi",
                            activeWeekData.totalActivities,
                          ],
                          [
                            "Kategori Memiliki Kegiatan",
                            `${activeWeekData.activeCategories}/6`,
                          ],
                          [
                            "Kategori Tercapai",
                            `${activeWeekData.completedThisWeek}/6`,
                          ],
                          [
                            "Progress Achievement",
                            percentText(activeWeekData.progress),
                          ],
                        ].map(([label, value]) => (
                          <div
                            className="gr-week-detail"
                            key={label}
                          >
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>

                      <h2 style={{ marginTop: 22 }}>
                        Aktivitas Kompetensi
                      </h2>

                      <div className="gr-week-details">
                        {activeWeekData.details.map(
                          (item) => (
                            <div
                              className="gr-week-detail"
                              key={item.name}
                            >
                              <span>
                                {item.icon}{" "}
                                {item.name}
                              </span>

                              <strong>
                                {numberText(
                                  item.achieved,
                                  item.name === "Fisik"
                                    ? 3
                                    : 0
                                )}
                                {" "}
                                {item.unit}
                                {" · "}
                                {percentText(item.percent)}
                              </strong>
                            </div>
                          )
                        )}
                      </div>
                    </>
                  )}
                </section>

                <section className="gr-card">
                  <h2>
                    Rekap Nilai Mingguan
                  </h2>

                  <p className="gr-subtitle">
                    Klik Detail untuk melihat
                    minggu terkait.
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
                          <th>Achievement</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {weeklySummary
                          .filter(
                            (item) =>
                              item.available &&
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
                                {weekLabel(item.week)}
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
                                {percentText(item.progress)}
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
                        aktif untuk menampilkan rekap.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </section>

            {/* CONCLUSION */}

            <section className="gr-card">
              <h2>
                Kesimpulan Monitoring
              </h2>

              <div className="gr-note">
                Data Post-Test tersedia pada{" "}
                <strong>{theoryWeeks}</strong>
                {" "}minggu, Praktik pada{" "}
                <strong>{practiceWeeks}</strong>
                {" "}minggu, dan tes Samapta lengkap
                pada{" "}
                <strong>{samaptaWeeks}</strong>
                {" "}minggu.

                <p>
                  Jumlah kegiatan Achievement
                  terverifikasi selama periode OJT
                  adalah{" "}
                  <strong>{totalVerified}</strong>.
                  Rata-rata progres enam kompetensi
                  pada{" "}
                  <strong>
                    {totalAvailableWeeks} minggu aktif
                  </strong>
                  {" "}adalah{" "}
                  <strong>{percentText(overall)}</strong>.
                </p>

                <p>
                  <strong>
                    {completedCategories} dari 6
                  </strong>
                  {" "}kategori telah memenuhi target
                  pada seluruh minggu global yang
                  termasuk periode OJT.
                </p>

                <p>
                  Heatmap menunjukkan keseluruhan
                  25 minggu. Minggu yang berada di
                  luar periode peserta tidak
                  memengaruhi nilai progres.
                </p>

                <p>
                  Grafik merupakan sarana monitoring,
                  bukan keputusan kelulusan akhir.
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
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// =======================================================
// CSS
// =======================================================

const css = `
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

.gr-lock {
  padding: 11px 14px;
  background: #eef9f2;
  color: #087b54;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 15px;
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
  max-width: 100%;
}

.gr-filter-custom {
  border-top: 1px solid #edf2ef;
  margin-top: 15px;
  padding-top: 15px;
}

.gr-week-buttons {
  display: grid;
  grid-template-columns:
    repeat(13,minmax(0,1fr));
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

.gr-week-button:disabled {
  opacity: .3;
  cursor: not-allowed;
  background: #e9eeeb;
}

.gr-stats {
  display: grid;
  grid-template-columns:
    repeat(4,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 15px;
}

.gr-stats-inline {
  grid-template-columns:
    repeat(2,minmax(0,1fr));
  margin-top: 14px;
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
  grid-template-columns:
    minmax(0,1.4fr) minmax(0,1fr);
  gap: 15px;
  align-items: start;
}

.gr-two-col.equal {
  grid-template-columns:
    repeat(2,minmax(0,1fr));
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
  grid-template-columns:
    155px minmax(0,1fr) 95px;
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

.heat-outside {
  background: repeating-linear-gradient(
    45deg,
    #dae1dd,
    #dae1dd 3px,
    #f2f5f3 3px,
    #f2f5f3 6px
  );
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

.gr-heat-cell.outside {
  background: repeating-linear-gradient(
    45deg,
    #dae1dd,
    #dae1dd 3px,
    #f2f5f3 3px,
    #f2f5f3 6px
  );
}

.gr-heat-cell:disabled {
  cursor: not-allowed;
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
  text-align: right;
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
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .gr-two-col,
  .gr-two-col.equal {
    grid-template-columns: 1fr;
  }

  .gr-week-buttons {
    grid-template-columns:
      repeat(9,minmax(0,1fr));
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
    grid-template-columns:
      repeat(4,minmax(0,1fr));
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
    grid-template-columns:
      repeat(5,minmax(0,1fr));
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

  .gr-heat-table {
    min-width: 0;
  }

  .gr-heat-row {
    grid-template-columns:
      105px repeat(25,minmax(0,1fr));
  }
}
`;
