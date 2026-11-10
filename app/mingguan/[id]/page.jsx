"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useParams,
  usePathname,
  useRouter,
} from "next/navigation";
import { supabase } from "../../../lib/supabase";

/*
 * =====================================================
 * OJT MINETRACK V2.0
 * MONITORING MINGGUAN — LIGHT & DARK MODE
 * =====================================================
 *
 * FITUR YANG DIPERTAHANKAN:
 * - Admin / Mentor / Peserta
 * - Admin Review tanpa peserta aktif
 * - Kalender global Week 01–25
 * - Enam kategori Achievement
 * - Target dan rumus monitoring
 * - Post-Test dan Praktik
 * - Samapta
 * - Filter kategori dan status
 * - Refresh
 * - Cetak / Simpan PDF
 * - Database Supabase tidak diubah
 *
 * TEMA:
 * - Mengikuti data-theme pada elemen HTML
 * - Tidak ada tombol tema di halaman ini
 * - Tombol tema tetap di Dashboard awal
 * - Print / PDF tetap berlatar putih
 */

const TOTAL_WEEKS = 25;
const MS_DAY = 86400000;

// =====================================================
// TARGET ACHIEVEMENT
// =====================================================

const TARGETS = [
  {
    key: "Fisik",
    target: 25,
    unit: "km",
  },
  {
    key: "Training",
    target: 4,
    unit: "kegiatan",
  },
  {
    key: "Coaching",
    target: 1,
    unit: "kegiatan",
  },
  {
    key: "Sosialisasi",
    target: 3,
    unit: "kegiatan",
  },
  {
    key: "Orientasi Area",
    target: 2,
    unit: "kegiatan",
  },
  {
    key: "Hazard",
    target: 2,
    unit: "kegiatan",
  },
];

// =====================================================
// TARGET SAMAPTA
// =====================================================

const SAMAPTA_TARGETS = [
  {
    key: "Lari 12 Menit",
    aliases: ["lari12menit", "lari"],
    target: 2600,
    unit: "m",
    maximum: false,
  },
  {
    key: "Pull-Up",
    aliases: ["pullup"],
    target: 17,
    unit: "kali",
    maximum: false,
  },
  {
    key: "Push-Up",
    aliases: ["pushup"],
    target: 38,
    unit: "kali",
    maximum: false,
  },
  {
    key: "Sit-Up",
    aliases: ["situp"],
    target: 45,
    unit: "kali",
    maximum: false,
  },
  {
    key: "Shuttle Run",
    aliases: ["shuttlerun"],
    target: 15.08,
    unit: "detik",
    maximum: true,
  },
];

// =====================================================
// GENERAL HELPERS
// =====================================================

const pad = (n) => String(n).padStart(2, "0");

const norm = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const numberOrNull = (v) => {
  if (
    v === "" ||
    v === undefined ||
    v === null
  ) {
    return null;
  }

  const n = Number(v);

  return Number.isFinite(n) ? n : null;
};

const fmt = (n, digits = 0) =>
  n === null || n === undefined
    ? "—"
    : Number(n).toLocaleString("id-ID", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

// =====================================================
// DATE HELPERS
// =====================================================

function utcDate(value) {
  if (!value) return null;

  const [year, month, day] = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

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

function dateKey(date) {
  return date
    ? date.toISOString().slice(0, 10)
    : "";
}

function dateLabel(value) {
  const date =
    value instanceof Date
      ? value
      : utcDate(value);

  if (!date) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function moveDays(date, count) {
  return new Date(
    date.getTime() + count * MS_DAY
  );
}

// =====================================================
// KALENDER GLOBAL OJT
//
// WEEK 01 = 12–18 SEPTEMBER 2026
// WEEK 02 = 20–26 SEPTEMBER 2026
// WEEK 03 = 27 SEPTEMBER–03 OKTOBER 2026
// WEEK 25 = 28 FEBRUARI–06 MARET 2027
//
// 19 September tidak termasuk minggu program.
// =====================================================

const GLOBAL_WEEKS = Array.from(
  { length: TOTAL_WEEKS },
  (_, index) => {
    const start =
      index === 0
        ? new Date(Date.UTC(2026, 8, 12))
        : moveDays(
            new Date(Date.UTC(2026, 8, 20)),
            (index - 1) * 7
          );

    const end = moveDays(start, 6);

    return {
      week: index + 1,
      start: dateKey(start),
      end: dateKey(end),
      label:
        `${dateLabel(start)} – ${dateLabel(end)}`,
    };
  }
);

function globalWeekOf(value) {
  const day = String(value || "").slice(
    0,
    10
  );

  return (
    GLOBAL_WEEKS.find(
      (week) =>
        day >= week.start &&
        day <= week.end
    )?.week ?? null
  );
}

// =====================================================
// PERIODE PESERTA
// =====================================================

function withinProgram(date, program) {
  const day = String(date || "").slice(
    0,
    10
  );

  if (!day || !program) return false;

  const start = String(
    program.start_date || ""
  ).slice(0, 10);

  const end = String(
    program.end_date || ""
  ).slice(0, 10);

  return (
    (!start || day >= start) &&
    (!end || day <= end)
  );
}

// =====================================================
// MINGGU BERJALAN
// MENGGUNAKAN WITA — ASIA/MAKASSAR
// =====================================================

function currentGlobalWeek() {
  const parts = new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Makassar",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)
      ?.value || "";

  const local = [
    get("year"),
    get("month"),
    get("day"),
  ].join("-");

  return globalWeekOf(local) || 1;
}

// =====================================================
// AVERAGE SCORES
// =====================================================

function average(rows) {
  const values = rows
    .map((row) => numberOrNull(row.score))
    .filter((value) => value !== null);

  return values.length
    ? values.reduce(
        (sum, n) => sum + n,
        0
      ) / values.length
    : null;
}

// =====================================================
// ROLE
// =====================================================

function roleOf(role) {
  const value = norm(role);

  if (
    [
      "admin",
      "administrator",
      "superadmin",
    ].includes(value)
  ) {
    return "admin";
  }

  if (value === "mentor") {
    return "mentor";
  }

  if (
    [
      "peserta",
      "participant",
    ].includes(value)
  ) {
    return "participant";
  }

  return "unknown";
}

// =====================================================
// PARTICIPANT PROFILE
// =====================================================

function participantName(program) {
  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  return (
    participant?.full_name ||
    "Peserta OJT"
  );
}

function participantDepartment(program) {
  const participant = Array.isArray(
    program?.peserta
  )
    ? program.peserta[0]
    : program?.peserta;

  return (
    participant?.department || "—"
  );
}

// =====================================================
// ACHIEVEMENT SUMMARY
// RUMUS DIPERTAHANKAN
// =====================================================

function achievementSummary(
  records,
  types,
  week,
  program
) {
  const byName = new Map(
    types.map((item) => [
      norm(item.name),
      item.code,
    ])
  );

  const typeCode = (key) =>
    byName.get(norm(key)) ||
    (key === "Training"
      ? byName.get("internaltraining")
      : undefined);

  const weekRecords = records.filter(
    (record) =>
      globalWeekOf(
        record.activity_date
      ) === week &&
      withinProgram(
        record.activity_date,
        program
      )
  );

  return TARGETS.map((target) => {
    const code = typeCode(target.key);

    const matching = code
      ? weekRecords.filter(
          (record) =>
            record.type_code === code
        )
      : [];

    const verified = matching.filter(
      (record) =>
        norm(record.status) ===
        "verified"
    );

    const realized =
      target.key === "Fisik"
        ? verified.reduce(
            (sum, record) =>
              sum +
              Math.round(
                (
                  numberOrNull(
                    record.distance_km
                  ) || 0
                ) * 1000
              ),
            0
          ) / 1000
        : verified.length;

    const recorded = matching.length;

    const pending =
      matching.length - verified.length;

    return {
      ...target,
      realized,
      recorded,
      verified: verified.length,
      pending,
      percent: target.target
        ? (realized / target.target) * 100
        : 0,
      achieved:
        realized >= target.target,
    };
  });
}

// =====================================================
// SAMAPTA SESSIONS
// =====================================================

// ===================================================
// REVIEW METADATA — LEGACY DATA IS VERIFIED
// ===================================================
const POSTTEST_REVIEW_RE = /\[\[OJT_POSTTEST_REVIEW_V1:([\s\S]*?)\]\]/g;
const PRACTICE_REVIEW_RE = /\[\[OJT_PRACTICE_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_REVIEW_RE = /\[\[OJT_SAMAPTA_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_COMPONENTS = ["Lari 12 Menit", "Pull-Up", "Push-Up", "Sit-Up", "Shuttle Run"];

function reviewMeta(notes, regex) {
  let meta = null;
  for (const match of String(notes || "").matchAll(new RegExp(regex.source, "g"))) {
    try { meta = JSON.parse(decodeURIComponent(match[1])); } catch { /* ignore invalid legacy metadata */ }
  }
  return meta;
}

function isOfficialPostTest(record) {
  return reviewMeta(record?.notes, POSTTEST_REVIEW_RE)?.status !== "pending";
}

function isOfficialPractice(record) {
  const meta = reviewMeta(record?.notes, PRACTICE_REVIEW_RE);
  if (meta?.status === "pending") return false;
  return meta?.status === "verified" || (record?.score !== null && record?.score !== undefined);
}

// ===================================================
// SAMAPTA SESSIONS — ONLY COMPLETE, VERIFIED SESSIONS
// ===================================================

function samaptaSessions(records) {
  const dates = [
    ...new Set(
      records
        .map((record) => record.test_date)
        .filter(Boolean)
    ),
  ].sort();

  return dates.flatMap((date) => {
    const matching = records.filter(
      (record) =>
        record.test_date === date
    );
    const names = new Set(matching.map((record) => norm(record.test_type)));
    const complete = matching.length === SAMAPTA_COMPONENTS.length &&
      SAMAPTA_COMPONENTS.every((name) => names.has(norm(name)));
    const pending = matching.some((record) => reviewMeta(record.notes, SAMAPTA_REVIEW_RE)?.status === "pending");
    if (!complete || pending) return [];

    const metrics = SAMAPTA_TARGETS.map(
      (target) => {
        const record = matching.find(
          (item) =>
            target.aliases.includes(
              norm(item.test_type)
            )
        );

        const actual = numberOrNull(
          record?.result_value
        );

        const achieved =
          actual === null
            ? null
            : target.maximum
            ? actual <= target.target
            : actual >= target.target;

        return {
          ...target,
          actual,
          achieved,
        };
      }
    );

    return [{
      date,
      metrics,
      score: average(matching),
    }];
  });
}

function statusLabel(item) {
  if (!item.recorded) {
    return "Belum ada data";
  }

  return item.achieved
    ? "Tercapai"
    : "Belum tercapai";
}

// =====================================================
// UI COMPONENTS
// =====================================================

function EmptyState({
  title,
  children,
}) {
  return (
    <div className="mt-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
}) {
  return (
    <div className="mt-summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function Table({
  columns,
  children,
}) {
  return (
    <div className="mt-table-wrap">
      <table className="mt-table">
        <thead>
          <tr>
            {columns.map(
              (column, index) => (
                <th
                  key={`${column}-${index}`}
                >
                  {column}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// =====================================================
// GLOBAL LIGHT / DARK STYLE
//
// Tema berasal dari:
// html[data-theme="light"]
// html[data-theme="dark"]
//
// Tidak menambahkan tombol tema di halaman ini.
// =====================================================

const STYLES = `
/* =====================================================
   THEME VARIABLES — LIGHT
   ===================================================== */

.mt-root {
  --mt-bg: #f3f7fa;
  --mt-surface: #ffffff;
  --mt-surface-alt: #f1f6f9;

  --mt-text: #163047;
  --mt-heading: #103b52;
  --mt-muted: #61778a;
  --mt-muted-soft: #71879b;

  --mt-border: #dae5ed;
  --mt-border-light: #e4edf2;

  --mt-header: #082c3e;

  --mt-primary: #087c62;
  --mt-primary-hover: #086e58;
  --mt-primary-text: #087447;

  --mt-table-hover: #f8fbfc;

  --mt-input-bg: #ffffff;

  --mt-soft-green: #dff6e9;
  --mt-soft-green-text: #087447;

  --mt-soft-orange: #fff1db;
  --mt-soft-orange-text: #a26300;

  --mt-pill-bg: #edf2f6;
  --mt-pill-text: #566e80;

  --mt-progress-bg: #e7eef2;

  --mt-button-light: #e5f0f1;
  --mt-button-light-text: #164254;

  --mt-shadow: rgba(16, 59, 82, .04);
}

/* =====================================================
   THEME VARIABLES — DARK
   ===================================================== */

:root[data-theme="dark"] .mt-root {
  --mt-bg: #0d171b;
  --mt-surface: #17272b;
  --mt-surface-alt: #203438;

  --mt-text: #edf8f4;
  --mt-heading: #e9faf2;
  --mt-muted: #a5bbb8;
  --mt-muted-soft: #91aaa7;

  --mt-border: #30484b;
  --mt-border-light: #2b4144;

  --mt-header: #081f1d;

  --mt-primary: #087e57;
  --mt-primary-hover: #0b9867;
  --mt-primary-text: #83edb8;

  --mt-table-hover: #20383a;

  --mt-input-bg: #1d3336;

  --mt-soft-green: #214638;
  --mt-soft-green-text: #aaf0c9;

  --mt-soft-orange: #49371f;
  --mt-soft-orange-text: #ffd5a0;

  --mt-pill-bg: #294044;
  --mt-pill-text: #d0e5df;

  --mt-progress-bg: #30484b;

  --mt-button-light: #244039;
  --mt-button-light-text: #b7f4d3;

  --mt-shadow: rgba(0, 0, 0, .20);
}

/* =====================================================
   RESET
   ===================================================== */

.mt-root,
.mt-root * {
  box-sizing: border-box;
}

.mt-root {
  min-height: 100vh;
  background: var(--mt-bg);
  color: var(--mt-text);
  font-family:
    Arial,
    Helvetica,
    sans-serif;
  font-size: 14px;

  transition:
    background-color .2s ease,
    color .2s ease;
}

.mt-root button,
.mt-root input,
.mt-root select {
  font-family: inherit;
}

.mt-root button {
  cursor: pointer;
}

.mt-root button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.mt-root button:focus-visible,
.mt-root select:focus-visible,
.mt-root input:focus-visible {
  outline: 3px solid #47cda0;
  outline-offset: 2px;
}

/* =====================================================
   HEADER
   ===================================================== */

.mt-header {
  background: var(--mt-header);
  color: white;

  padding: 18px 24px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 14px;
  flex-wrap: wrap;
}

.mt-logo {
  font-size: 23px;
  font-weight: 900;
}

.mt-logo span {
  color: #39d3a0;
}

.mt-header small {
  color: #c2d8df;
}

.mt-header strong {
  color: #ffffff;
}

/* =====================================================
   PAGE
   ===================================================== */

.mt-page {
  max-width: 1320px;
  margin: auto;
  padding: 22px;
}

.mt-heading h1 {
  font-size: 27px;
  margin: 0 0 7px;
  color: var(--mt-heading);
}

.mt-heading p {
  color: var(--mt-muted);
  margin: 0 0 20px;
  line-height: 1.6;
}

/* =====================================================
   GRID
   ===================================================== */

.mt-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* =====================================================
   CARD
   ===================================================== */

.mt-card {
  background: var(--mt-surface);
  color: var(--mt-text);

  border: 1px solid var(--mt-border);

  padding: 18px;
  border-radius: 14px;
  margin-bottom: 16px;

  box-shadow:
    0 4px 14px var(--mt-shadow);
}

.mt-summary-card {
  background: var(--mt-surface);

  border: 1px solid var(--mt-border);

  padding: 17px;
  border-radius: 12px;

  display: flex;
  flex-direction: column;
  gap: 8px;

  box-shadow:
    0 4px 14px var(--mt-shadow);
}

.mt-summary-card span {
  font-size: 12px;
  color: var(--mt-muted);
}

.mt-summary-card strong {
  font-size: 25px;
  color: var(--mt-heading);
}

.mt-summary-card small {
  font-size: 11px;
  color: var(--mt-muted-soft);
}

/* =====================================================
   TOOLBAR & FILTER
   ===================================================== */

.mt-toolbar {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}

.mt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  flex: 1;
  min-width: 155px;
}

.mt-field label {
  font-size: 12px;
  font-weight: 700;
  color: var(--mt-text);
}

.mt-field select,
.mt-field input {
  width: 100%;

  background: var(--mt-input-bg);
  color: var(--mt-text);

  border: 1px solid var(--mt-border);

  border-radius: 9px;

  padding: 11px;
  font-size: 13px;
  outline: none;
}

.mt-field input::placeholder {
  color: var(--mt-muted-soft);
  opacity: 1;
}

.mt-field select:focus,
.mt-field input:focus {
  border-color: #119c7b;
}

.mt-field select option {
  background: var(--mt-input-bg);
  color: var(--mt-text);
}

/* =====================================================
   BUTTONS
   ===================================================== */

.mt-button {
  border: 0;

  background: var(--mt-primary);
  color: #ffffff;

  border-radius: 9px;
  padding: 11px 15px;

  font-weight: 700;
  cursor: pointer;
  font-size: 13px;

  transition:
    background-color .2s ease,
    transform .15s ease;
}

.mt-button:hover:not(:disabled) {
  background: var(--mt-primary-hover);
}

.mt-button.dark {
  background: #123f55;
  color: #ffffff;
}

:root[data-theme="dark"] .mt-button.dark {
  background: #0b5b50;
  color: #ffffff;
}

.mt-button.light {
  background: var(--mt-button-light);
  color: var(--mt-button-light-text);
}

.mt-button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

/* =====================================================
   SECTION HEAD
   ===================================================== */

.mt-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 12px;
  flex-wrap: wrap;

  margin-bottom: 13px;
}

.mt-section-head h2 {
  font-size: 18px;
  margin: 0;
  color: var(--mt-heading);
}

.mt-section-head p {
  font-size: 12px;
  color: var(--mt-muted);

  margin: 5px 0 0;
}

/* =====================================================
   TABLE
   ===================================================== */

.mt-table-wrap {
  width: 100%;
  overflow-x: auto;
}

.mt-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
  color: var(--mt-text);
}

.mt-table th,
.mt-table td {
  border-bottom:
    1px solid var(--mt-border-light);

  padding: 12px 10px;

  text-align: left;
  vertical-align: middle;
}

.mt-table th {
  background: var(--mt-surface-alt);
  color: var(--mt-heading);

  font-size: 12px;
  font-weight: 800;
}

.mt-table td {
  font-size: 13px;
  color: var(--mt-text);
}

.mt-table tbody tr:hover {
  background: var(--mt-table-hover);
}

.mt-table td strong {
  color: var(--mt-text);
}

/* =====================================================
   STATUS PILLS
   ===================================================== */

.mt-pill {
  display: inline-block;

  padding: 5px 9px;
  border-radius: 20px;

  background: var(--mt-pill-bg);
  color: var(--mt-pill-text);

  font-weight: 700;
  font-size: 11px;
}

.mt-pill.green {
  background: var(--mt-soft-green);
  color: var(--mt-soft-green-text);
}

.mt-pill.orange {
  background: var(--mt-soft-orange);
  color: var(--mt-soft-orange-text);
}

/* =====================================================
   PROGRESS
   ===================================================== */

.mt-progress {
  height: 8px;
  background: var(--mt-progress-bg);

  border-radius: 20px;
  overflow: hidden;
  min-width: 95px;

  margin-top: 7px;
}

.mt-progress div {
  height: 100%;
  background: #0c9677;

  transition: width .2s ease;
}

:root[data-theme="dark"] .mt-progress div {
  background:
    linear-gradient(
      90deg,
      #13b97c,
      #49e0a1
    );
}

/* =====================================================
   WEEK NAVIGATION
   ===================================================== */

.mt-weeks {
  display: grid;

  grid-template-columns:
    repeat(13, 1fr);

  gap: 7px;
}

.mt-week {
  padding: 9px 3px;

  border:
    1px solid var(--mt-border);

  background: var(--mt-surface);
  color: var(--mt-text);

  border-radius: 8px;

  font-weight: 800;
  cursor: pointer;

  transition:
    background-color .2s ease,
    color .2s ease;
}

.mt-week:hover:not(.selected) {
  background: var(--mt-surface-alt);
}

.mt-week.selected {
  background: #0b8065;
  color: white;
  border-color: #0b8065;
}

:root[data-theme="dark"] .mt-week.selected {
  background: #0c966b;
  color: #ffffff;
  border-color: #0c966b;
}

/* =====================================================
   ERROR
   ===================================================== */

.mt-error {
  color: #a32a37;

  background: #fff0f1;

  border: 1px solid #f3c9cc;

  border-radius: 10px;
  padding: 13px;
  margin-bottom: 15px;
}

:root[data-theme="dark"] .mt-error {
  background: #45252b;
  color: #ffbfc6;
  border-color: #704047;
}

/* =====================================================
   INFO & EMPTY STATE
   ===================================================== */

.mt-info {
  font-size: 12px;
  color: var(--mt-muted);

  line-height: 1.65;
}

.mt-info strong {
  color: var(--mt-text);
}

.mt-empty {
  text-align: center;
  padding: 40px 15px;
  color: var(--mt-muted);
}

.mt-empty h3 {
  color: var(--mt-heading);
  margin-bottom: 8px;
}

.mt-empty p {
  line-height: 1.7;
}

/* =====================================================
   PARTICIPANT DETAILS
   ===================================================== */

.mt-participant {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;

  border-bottom:
    1px solid var(--mt-border-light);

  padding-bottom: 15px;
}

.mt-participant > div {
  flex: 1;
  min-width: 140px;
}

.mt-participant small {
  color: var(--mt-muted-soft);
  display: block;
  margin-bottom: 6px;
}

.mt-participant strong {
  font-size: 14px;
  color: var(--mt-text);
}

/* =====================================================
   REPORT
   ===================================================== */

.mt-report {
  background: var(--mt-bg);
  color: var(--mt-text);
}

.mt-report-title {
  padding: 16px;

  background: #103d55;
  color: #ffffff;

  border-left: 5px solid #28b98c;

  margin-bottom: 15px;
}

.mt-report-title h2 {
  margin: 5px 0;
  color: #ffffff;
}

.mt-report-title small {
  color: #d5f2e8;
}

:root[data-theme="dark"] .mt-report-title {
  background: #073c35;
  border-left-color: #38d5a0;
}

.mt-print-head {
  display: none;
}

/* =====================================================
   TABLET
   ===================================================== */

@media (max-width: 900px) {
  .mt-grid {
    grid-template-columns:
      repeat(2, 1fr);
  }

  .mt-weeks {
    grid-template-columns:
      repeat(7, 1fr);
  }
}

/* =====================================================
   MOBILE
   ===================================================== */

@media (max-width: 600px) {
  .mt-header {
    padding: 15px;
  }

  .mt-page {
    padding: 12px;
  }

  .mt-heading h1 {
    font-size: 22px;
  }

  .mt-grid {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .mt-weeks {
    grid-template-columns:
      repeat(5, 1fr);
  }

  .mt-card {
    padding: 13px;
  }

  .mt-summary-card strong {
    font-size: 21px;
  }

  .mt-toolbar > * {
    width: 100%;
  }

  .mt-week {
    min-height: 39px;
  }

  .mt-header .mt-button {
    width: 100%;
  }
}

/* =====================================================
   PRINT / PDF
   MODE TERANG KHUSUS CETAK
   ===================================================== */

@page {
  size: A4 landscape;
  margin: 10mm;
}

@media print {
  html,
  body {
    background: white !important;
    color: #111111 !important;
    margin: 0 !important;
  }

  .mt-root,
  :root[data-theme="dark"] .mt-root {
    --mt-bg: #ffffff;
    --mt-surface: #ffffff;
    --mt-surface-alt: #f1f6f9;

    --mt-text: #111111;
    --mt-heading: #163047;
    --mt-muted: #546577;
    --mt-muted-soft: #657585;

    --mt-border: #d1d1d1;
    --mt-border-light: #dddddd;

    --mt-soft-green: #e5f5ed;
    --mt-soft-green-text: #087447;

    --mt-soft-orange: #fff1db;
    --mt-soft-orange-text: #975700;

    --mt-pill-bg: #eeeeee;
    --mt-pill-text: #333333;

    --mt-progress-bg: #e5e5e5;

    background: white !important;
    color: #111111 !important;

    min-height: 0 !important;
  }

  .mt-header,
  .mt-no-print {
    display: none !important;
  }

  .mt-page {
    padding: 0 !important;
    max-width: none !important;
  }

  .mt-report {
    background: white !important;
    color: #111111 !important;
  }

  .mt-card,
  .mt-summary-card {
    background: white !important;
    color: #111111 !important;

    box-shadow: none !important;

    border:
      1px solid #d1d1d1 !important;

    break-inside: avoid-page;
  }

  .mt-grid {
    grid-template-columns:
      repeat(4, 1fr) !important;
  }

  .mt-table-wrap {
    overflow: visible !important;
  }

  .mt-table {
    min-width: 0 !important;
    color: #111111 !important;
  }

  .mt-table th,
  .mt-table td {
    font-size: 10px !important;
    padding: 6px !important;
    color: #111111 !important;
    border-bottom-color: #dddddd !important;
  }

  .mt-table th {
    background: #f1f6f9 !important;
  }

  .mt-table td strong,
  .mt-participant strong,
  .mt-summary-card strong,
  .mt-section-head h2,
  .mt-info strong {
    color: #111111 !important;
  }

  .mt-summary-card span,
  .mt-summary-card small,
  .mt-info,
  .mt-section-head p,
  .mt-participant small {
    color: #555555 !important;
  }

  .mt-print-head {
    display: block;
    margin-bottom: 15px;
  }

  .mt-print-head h1 {
    font-size: 23px;
    margin: 0 0 7px;
    color: #111111;
  }

  .mt-print-head p {
    font-size: 11px;
    margin: 0;
    color: #333333;
  }

  .mt-section-head h2 {
    font-size: 15px;
  }

  .mt-progress {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-report-title {
    background: #103d55 !important;
    color: white !important;

    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .mt-report-title h2 {
    color: white !important;
  }

  .mt-pill {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
`;

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function MingguanPage() {
  const router = useRouter();

  const params = useParams();
  const pathname = usePathname();

  const rawId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const adminReview =
    pathname?.replace(/\/+$/, "") ===
      "/mingguan/admin-review" ||
    rawId === "admin-review";

  // ===================================================
  // STATE
  // ===================================================

  const [profile, setProfile] =
    useState(null);

  const [programs, setPrograms] =
    useState([]);

  const [selectedId, setSelectedId] =
    useState(
      adminReview ? "" : rawId || ""
    );

  const [records, setRecords] =
    useState(null);

  const [week, setWeek] =
    useState(1);

  const [category, setCategory] =
    useState("all");

  const [status, setStatus] =
    useState("all");

  const [query, setQuery] =
    useState("");

  const [
    participantQuery,
    setParticipantQuery,
  ] = useState("");

  const [
    programStatus,
    setProgramStatus,
  ] = useState("all");

  const [loading, setLoading] =
    useState(true);

  const [
    recordsLoading,
    setRecordsLoading,
  ] = useState(false);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  // ===================================================
  // CURRENT WEEK
  // ===================================================

  useEffect(() => {
    setWeek(currentGlobalWeek());
  }, []);

  useEffect(() => {
    if (!adminReview && rawId) {
      setSelectedId(rawId);
    }
  }, [adminReview, rawId]);

  // ===================================================
  // LOAD PROGRAMS
  // ===================================================

  const loadPrograms = useCallback(
    async (role, userId) => {
      let request = supabase
        .from("ojt_programs")
        .select(
          "id,participant_id,start_date,end_date,status,site,peserta:profiles!ojt_programs_participant_id_fkey(full_name,department)"
        )
        .order("start_date", {
          ascending: false,
        });

      if (role === "participant") {
        request = request.eq(
          "participant_id",
          userId
        );
      }

      /*
       * Admin:
       * Seluruh program yang diizinkan RLS.
       *
       * Mentor:
       * Mengikuti izin yang berlaku.
       */

      const result = await request;

      if (result.error) {
        throw result.error;
      }

      return result.data || [];
    },
    []
  );

  // ===================================================
  // INITIALIZE AUTH & ACCESS
  // ===================================================

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const auth =
          await supabase.auth.getUser();

        if (
          auth.error ||
          !auth.data?.user
        ) {
          router.replace("/login");
          return;
        }

        const userId =
          auth.data.user.id;

        const result = await supabase
          .from("profiles")
          .select(
            "id,role,full_name"
          )
          .eq("id", userId)
          .single();

        if (result.error) {
          throw result.error;
        }

        const user = result.data;

        const role = roleOf(
          user?.role
        );

        if (role === "unknown") {
          throw new Error(
            "Peran akun tidak diizinkan."
          );
        }

        if (
          adminReview &&
          role !== "admin"
        ) {
          throw new Error(
            "Halaman admin-review hanya untuk Admin."
          );
        }

        const list =
          await loadPrograms(
            role,
            userId
          );

        if (!mounted) return;

        setProfile({
          ...user,
          normalizedRole: role,
        });

        setPrograms(list);

        if (
          !adminReview &&
          rawId
        ) {
          const found = list.find(
            (item) =>
              String(item.id) ===
              String(rawId)
          );

          if (!found) {
            throw new Error(
              "Program tidak ditemukan atau akun tidak mempunyai akses."
            );
          }

          if (
            role === "participant" &&
            String(
              found.participant_id
            ) !== String(userId)
          ) {
            throw new Error(
              "Akses peserta tidak diizinkan."
            );
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.message ||
              "Gagal memuat data program."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
    };
  }, [
    router,
    rawId,
    adminReview,
    loadPrograms,
  ]);

  // ===================================================
  // SELECTED PROGRAM
  // ===================================================

  const selectedProgram = useMemo(
    () =>
      programs.find(
        (item) =>
          String(item.id) ===
          String(selectedId)
      ) || null,
    [programs, selectedId]
  );

  // ===================================================
  // LOAD RECORDS
  // ===================================================

  const loadRecords = useCallback(
    async (id) => {
      const requests =
        await Promise.all([
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
            .select(
              "id,test_date,score,notes"
            )
            .eq("program_id", id)
            .order("test_date"),

          supabase
            .from("weekly_practice_scores")
            .select(
              "id,practice_date,practice_name,score,notes"
            )
            .eq("program_id", id)
            .order("practice_date"),

          supabase
            .from("samapta_records")
            .select(
              "id,test_date,test_type,result_value,score,outcome,notes"
            )
            .eq("program_id", id)
            .order("test_date"),
        ]);

      const labels = [
        "Kategori",
        "Achievement",
        "Post-Test",
        "Praktik",
        "Samapta",
      ];

      requests.forEach(
        (result, index) => {
          if (result.error) {
            throw new Error(
              `${labels[index]}: ${result.error.message}`
            );
          }
        }
      );

      return {
        types:
          requests[0].data || [],
        achievements:
          requests[1].data || [],
        theory:
          requests[2].data || [],
        practice:
          requests[3].data || [],
        samapta:
          requests[4].data || [],
      };
    },
    []
  );

  // ===================================================
  // LOAD SELECTED PROGRAM RECORDS
  // ===================================================

  useEffect(() => {
    let mounted = true;

    async function execute() {
      if (!selectedProgram) {
        setRecords(null);
        setRecordsLoading(false);
        return;
      }

      setRecords(null);
      setRecordsLoading(true);
      setError("");

      try {
        const result =
          await loadRecords(
            selectedProgram.id
          );

        if (mounted) {
          setRecords(result);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err.message ||
              "Gagal memuat evaluasi."
          );
        }
      } finally {
        if (mounted) {
          setRecordsLoading(false);
        }
      }
    }

    execute();

    return () => {
      mounted = false;
    };
  }, [
    selectedProgram,
    loadRecords,
  ]);

  // ===================================================
  // REFRESH DATA
  // ===================================================

  const refresh = useCallback(
    async () => {
      if (!profile || busy) return;

      setBusy(true);
      setError("");

      try {
        const list =
          await loadPrograms(
            profile.normalizedRole,
            profile.id
          );

        setPrograms(list);

        if (selectedId) {
          if (
            !list.some(
              (program) =>
                String(program.id) ===
                String(selectedId)
            )
          ) {
            setRecords(null);
            setSelectedId("");
          } else {
            const next =
              await loadRecords(
                selectedId
              );

            setRecords(next);
          }
        }
      } catch (err) {
        setError(
          err.message ||
            "Refresh gagal."
        );
      } finally {
        setBusy(false);
      }
    },
    [
      profile,
      busy,
      selectedId,
      loadPrograms,
      loadRecords,
    ]
  );

  // ===================================================
  // SELECTED GLOBAL WEEK
  // ===================================================

  const selectedWeek =
    GLOBAL_WEEKS[week - 1];

  // ===================================================
  // REPORT
  // ===================================================

  const report = useMemo(() => {
    if (
      !selectedProgram ||
      !records
    ) {
      return null;
    }

    const achievements =
      records.achievements.filter(
        (record) =>
          globalWeekOf(
            record.activity_date
          ) === week &&
          withinProgram(
            record.activity_date,
            selectedProgram
          )
      );

    const theory =
      records.theory.filter(
        (record) =>
          globalWeekOf(
            record.test_date
          ) === week &&
          withinProgram(
            record.test_date,
            selectedProgram
          ) && isOfficialPostTest(record)
      );

    const practice =
      records.practice.filter(
        (record) =>
          globalWeekOf(
            record.practice_date
          ) === week &&
          withinProgram(
            record.practice_date,
            selectedProgram
          ) && isOfficialPractice(record)
      );

    const samapta =
      samaptaSessions(
        records.samapta.filter(
          (record) =>
            withinProgram(
              record.test_date,
              selectedProgram
            )
        )
      ).filter(
        (session) =>
          globalWeekOf(
            session.date
          ) === week
      );

    const categories =
      achievementSummary(
        records.achievements,
        records.types,
        week,
        selectedProgram
      );

    const categoryCodes =
      new Map(
        records.types.map(
          (item) => [
            item.code,
            item.name,
          ]
        )
      );

    return {
      achievements:
        achievements.map(
          (record) => ({
            ...record,
            typeName:
              categoryCodes.get(
                record.type_code
              ) ||
              record.type_code,
          })
        ),

      theory,
      practice,
      samapta,
      categories,

      theoryAverage:
        average(theory),

      practiceAverage:
        average(practice),

      achievedCount:
        categories.filter(
          (item) =>
            item.achieved
        ).length,

      pendingCount:
        categories.reduce(
          (sum, item) =>
            sum + item.pending,
          0
        ),

      verifiedCount:
        categories.reduce(
          (sum, item) =>
            sum + item.verified,
          0
        ),
    };
  }, [
    records,
    selectedProgram,
    week,
  ]);

  // ===================================================
  // CATEGORY FILTER
  // ===================================================

  const filteredCategories =
    useMemo(() => {
      if (!report) return [];

      return report.categories.filter(
        (item) => {
          if (
            category !== "all" &&
            item.key !== category
          ) {
            return false;
          }

          if (
            status === "achieved" &&
            !item.achieved
          ) {
            return false;
          }

          if (
            status === "pending" &&
            !item.pending
          ) {
            return false;
          }

          if (
            status === "not-achieved" &&
            (
              item.achieved ||
              !item.recorded
            )
          ) {
            return false;
          }

          if (
            status === "empty" &&
            item.recorded
          ) {
            return false;
          }

          if (query.trim()) {
            const haystack =
              norm(item.key);

            if (
              !haystack.includes(
                norm(query)
              )
            ) {
              return false;
            }
          }

          return true;
        }
      );
    }, [
      report,
      category,
      status,
      query,
    ]);

  // ===================================================
  // ACHIEVEMENT FILTER
  // ===================================================

  const filteredAchievements =
    useMemo(() => {
      if (!report) return [];

      return report.achievements.filter(
        (record) => {
          const matchesCategory =
            category === "all" ||
            norm(record.typeName) ===
              norm(category) ||
            (
              category === "Training" &&
              norm(record.typeName) ===
                "internaltraining"
            );

          const matchesStatus =
            status === "all" ||
            (
              status === "pending" &&
              norm(record.status) !==
                "verified"
            ) ||
            (
              status === "achieved" &&
              norm(record.status) ===
                "verified"
            ) ||
            status === "not-achieved";

          const matchesQuery =
            !query.trim() ||
            norm(
              `${record.typeName} ${record.description} ${record.activity_date}`
            ).includes(
              norm(query)
            );

          return (
            matchesCategory &&
            matchesStatus &&
            matchesQuery
          );
        }
      );
    }, [
      report,
      category,
      status,
      query,
    ]);

  // ===================================================
  // PROGRAM FILTER — ADMIN
  // ===================================================

  const filteredPrograms =
    useMemo(() => {
      return programs.filter(
        (program) => {
          const name =
            participantName(program);

          const department =
            participantDepartment(program);

          const matchesSearch =
            !participantQuery.trim() ||
            norm(
              `${name} ${department} ${program.site || ""}`
            ).includes(
              norm(participantQuery)
            );

          const matchesStatus =
            programStatus === "all" ||
            norm(program.status) ===
              norm(programStatus);

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      programs,
      participantQuery,
      programStatus,
    ]);

  // ===================================================
  // PROGRAM STATS
  // ===================================================

  const programStats =
    useMemo(
      () => ({
        total: programs.length,

        active:
          programs.filter(
            (program) =>
              norm(program.status) ===
              "active"
          ).length,

        other:
          programs.filter(
            (program) =>
              norm(program.status) !==
              "active"
          ).length,

        participants:
          new Set(
            programs
              .map(
                (program) =>
                  program.participant_id
              )
              .filter(Boolean)
          ).size,
      }),
      [programs]
    );

  // ===================================================
  // PDF / PRINT
  // ===================================================

  function openPdf() {
    if (
      !selectedProgram ||
      !report ||
      recordsLoading
    ) {
      return;
    }

    window.print();
  }

  // ===================================================
  // BACK TO DASHBOARD
  // ===================================================

  function navigateBack() {
    if (
      profile?.normalizedRole === "participant"
    ) {
      router.push("/dashboard-peserta");
    } else {
      router.push("/");
    }
  }

  // ===================================================
  // LOADING STATE
  // ===================================================

  if (loading) {
    return (
      <main className="mt-root">
        <style>{STYLES}</style>

        <EmptyState title="OJT MineTrack">
          Memuat data dan memeriksa hak
          akses...
        </EmptyState>
      </main>
    );
  }

  // ===================================================
  // ACCESS NOT AVAILABLE
  // ===================================================

  if (!profile) {
    return (
      <main className="mt-root">
        <style>{STYLES}</style>

        <EmptyState title="Akses Tidak Tersedia">
          {error ||
            "Sesi pengguna tidak tersedia."}
        </EmptyState>
      </main>
    );
  }

  // ===================================================
  // RENDER PAGE
  // ===================================================

  return (
    <main className="mt-root">
      <style>{STYLES}</style>

      {/* HEADER */}

      <header className="mt-header mt-no-print">
        <div>
          <div className="mt-logo">
            OJT <span>MineTrack</span>
          </div>

          <small>
            Weekly Monitoring · v2.0
          </small>
        </div>

        <div
          style={{
            textAlign: "right",
          }}
        >
          <strong>
            {profile.full_name ||
              "Pengguna"}
          </strong>

          <div>
            <small>
              {profile.normalizedRole ===
              "admin"
                ? "Administrator"
                : profile.normalizedRole ===
                  "mentor"
                ? "Mentor"
                : "Peserta"}
            </small>
          </div>
        </div>

        <button
          type="button"
          className="mt-button light"
          onClick={navigateBack}
        >
          ← Dashboard
        </button>
      </header>

      <div className="mt-page">

        {/* PAGE TITLE */}

        <div className="mt-heading mt-no-print">
          <h1>
            {adminReview
              ? "Admin Review · Evaluasi Mingguan"
              : "Monitoring Evaluasi Mingguan"}
          </h1>

          <p>
            Program OJT Mingguan &
            Ringkasan Monitoring.
            Kalender global Week 01–25
            digunakan untuk seluruh peserta,
            sedangkan tanggal mulai dan
            akhir program tetap berasal
            dari database masing-masing
            peserta.
          </p>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mt-error mt-no-print">
            {error}
          </div>
        )}

        {/* ============================================
            ADMIN REVIEW
            ============================================ */}

        {adminReview && (
          <>
            <div
              className="mt-grid mt-no-print"
              style={{
                marginBottom: 16,
              }}
            >
              <SummaryCard
                label="Total program"
                value={
                  programStats.total
                }
                description="Seluruh status program"
              />

              <SummaryCard
                label="Program aktif"
                value={
                  programStats.active
                }
                description="Status active"
              />

              <SummaryCard
                label="Status lainnya"
                value={
                  programStats.other
                }
                description="Tidak dibatasi hanya aktif"
              />

              <SummaryCard
                label="Jumlah peserta"
                value={
                  programStats.participants
                }
                description="Peserta unik dalam daftar program"
              />
            </div>

            <section className="mt-card mt-no-print">
              <div className="mt-section-head">
                <div>
                  <h2>
                    Daftar Program OJT
                  </h2>

                  <p>
                    Halaman tetap dapat dibuka
                    sekalipun belum ada peserta
                    yang dipilih atau tidak
                    terdapat program aktif.
                  </p>
                </div>

                <button
                  type="button"
                  className="mt-button light"
                  onClick={refresh}
                  disabled={busy}
                >
                  {busy
                    ? "Memuat..."
                    : "Refresh Data"}
                </button>
              </div>

              {/* ADMIN FILTER */}

              <div
                className="mt-toolbar"
                style={{
                  marginBottom: 14,
                }}
              >
                <div className="mt-field">
                  <label>
                    Cari peserta
                  </label>

                  <input
                    value={
                      participantQuery
                    }
                    onChange={(event) =>
                      setParticipantQuery(
                        event.target.value
                      )
                    }
                    placeholder="Nama, departemen, atau site"
                  />
                </div>

                <div className="mt-field">
                  <label>
                    Status program
                  </label>

                  <select
                    value={
                      programStatus
                    }
                    onChange={(event) =>
                      setProgramStatus(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Semua Status
                    </option>

                    {[
                      ...new Set(
                        programs.map(
                          (program) =>
                            program.status
                        )
                      ),
                    ]
                      .filter(Boolean)
                      .map((value) => (
                        <option
                          key={value}
                          value={norm(value)}
                        >
                          {value}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* PROGRAM TABLE */}

              {filteredPrograms.length ? (
                <Table
                  columns={[
                    "Nama Peserta",
                    "Departemen",
                    "Site",
                    "Periode",
                    "Status",
                    "Aksi",
                  ]}
                >
                  {filteredPrograms.map(
                    (program) => (
                      <tr key={program.id}>
                        <td>
                          <strong>
                            {participantName(
                              program
                            )}
                          </strong>
                        </td>

                        <td>
                          {participantDepartment(
                            program
                          )}
                        </td>

                        <td>
                          {program.site || "—"}
                        </td>

                        <td>
                          {dateLabel(
                            program.start_date
                          )}
                          {" – "}
                          {dateLabel(
                            program.end_date
                          )}
                        </td>

                        <td>
                          <span className="mt-pill">
                            {program.status ||
                              "—"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="mt-button"
                            onClick={() => {
                              setRecords(null);
                              setSelectedId(
                                String(
                                  program.id
                                )
                              );
                              setCategory(
                                "all"
                              );
                              setStatus(
                                "all"
                              );
                              setQuery("");
                            }}
                          >
                            Buka Evaluasi
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </Table>
              ) : (
                <EmptyState title="Belum ada program yang cocok">
                  Ubah filter untuk melihat
                  program lainnya. Tidak
                  ada peserta aktif tidak
                  menghalangi Administrator
                  membuka halaman ini.
                </EmptyState>
              )}
            </section>
          </>
        )}

        {/* ============================================
            PROGRAM TERPILIH — ADMIN
            ============================================ */}

        {adminReview && selectedProgram && (
          <div className="mt-card mt-no-print">
            <div className="mt-section-head">
              <h2>
                Program yang dipilih
              </h2>

              <button
                type="button"
                className="mt-button light"
                onClick={() => {
                  setSelectedId("");
                  setRecords(null);
                }}
              >
                Tutup Detail
              </button>
            </div>

            <strong>
              {participantName(
                selectedProgram
              )}
            </strong>

            <p className="mt-info">
              {participantDepartment(
                selectedProgram
              )}
              {" · "}
              {selectedProgram.site ||
                "Site belum tersedia"}
            </p>
          </div>
        )}

        {/* ============================================
            BELUM ADA PROGRAM TERPILIH
            ============================================ */}

        {!selectedProgram && (
          <section className="mt-card mt-no-print">
            <EmptyState
              title={
                adminReview
                  ? "Panel Admin Review Siap Digunakan"
                  : "Program Tidak Tersedia"
              }
            >
              {adminReview
                ? "Pilih salah satu program pada daftar untuk membuka rincian evaluasi mingguan. Admin tidak diwajibkan memiliki peserta aktif."
                : "Program dengan ID tersebut tidak ditemukan atau akses tidak tersedia."}
            </EmptyState>
          </section>
        )}

        {/* ============================================
            SELECTED PROGRAM CONTENT
            ============================================ */}

        {selectedProgram && (
          <>
            {/* GLOBAL WEEK NAVIGATION */}

            <section className="mt-card mt-no-print">
              <div className="mt-section-head">
                <div>
                  <h2>
                    Kalender Program Global
                  </h2>

                  <p>
                    Week 01 khusus
                    12–18 September 2026.
                    Week 25 berakhir
                    6 Maret 2027.
                  </p>
                </div>
              </div>

              <div className="mt-weeks">
                {GLOBAL_WEEKS.map(
                  (item) => (
                    <button
                      key={item.week}
                      type="button"
                      title={item.label}
                      className={
                        "mt-week" +
                        (
                          week === item.week
                            ? " selected"
                            : ""
                        )
                      }
                      onClick={() =>
                        setWeek(
                          item.week
                        )
                      }
                    >
                      {pad(item.week)}
                    </button>
                  )
                )}
              </div>

              <p className="mt-info">
                <strong>
                  Week {pad(week)}:
                </strong>
                {" "}
                {selectedWeek?.label}
              </p>
            </section>

            {/* ========================================
                FILTER MONITORING
                ======================================== */}

            <section className="mt-card mt-no-print">
              <div className="mt-section-head">
                <div>
                  <h2>
                    Filter Monitoring
                  </h2>

                  <p>
                    Menampilkan data minggu
                    global yang dipilih.
                  </p>
                </div>
              </div>

              <div className="mt-toolbar">
                {/* CATEGORY FILTER */}

                <div className="mt-field">
                  <label>
                    Kategori
                  </label>

                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Semua Kategori
                    </option>

                    {TARGETS.map(
                      (target) => (
                        <option
                          key={target.key}
                          value={target.key}
                        >
                          {target.key ===
                          "Training"
                            ? "Internal Training"
                            : target.key}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* STATUS FILTER */}

                <div className="mt-field">
                  <label>
                    Status
                  </label>

                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      Semua Status
                    </option>

                    <option value="achieved">
                      Tercapai / Terverifikasi
                    </option>

                    <option value="not-achieved">
                      Belum Tercapai
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="empty">
                      Belum Ada Data
                    </option>
                  </select>
                </div>

                {/* SEARCH FILTER */}

                <div className="mt-field">
                  <label>
                    Pencarian
                  </label>

                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(
                        event.target.value
                      )
                    }
                    placeholder="Cari kategori atau kegiatan"
                  />
                </div>

                {/* REFRESH */}

                <button
                  type="button"
                  className="mt-button light"
                  onClick={refresh}
                  disabled={busy}
                >
                  {busy
                    ? "Memuat..."
                    : "Refresh"}
                </button>

                {/* PRINT / PDF */}

                <button
                  type="button"
                  className="mt-button dark"
                  onClick={openPdf}
                  disabled={
                    !report ||
                    recordsLoading
                  }
                >
                  Unduh PDF / Cetak Rekap
                </button>
              </div>
            </section>

            {/* LOADING RECORDS */}

            {recordsLoading && (
              <section className="mt-card">
                <EmptyState title="Memuat Evaluasi">
                  Mengambil Achievement,
                  Post-Test, Praktik,
                  dan Samapta.
                </EmptyState>
              </section>
            )}

            {/* ========================================
                REPORT CONTENT
                ======================================== */}

            {report && (
              <div className="mt-report">

                {/* PRINT HEADER */}

                <div className="mt-print-head">
                  <h1>
                    OJT MineTrack ·
                    Evaluasi Mingguan
                  </h1>

                  <p>
                    PT Berau Coal ·
                    Emergency Response Group
                    {" · "}
                    Week {pad(week)}
                    {" · "}
                    {selectedWeek?.label}
                  </p>
                </div>

                {/* ====================================
                    REPORT HEADER
                    ==================================== */}

                <section className="mt-card">
                  <div className="mt-report-title">
                    <small>
                      PROGRAM OJT MINGGUAN
                    </small>

                    <h2>
                      Week {pad(week)}
                    </h2>

                    <div>
                      {selectedWeek?.label}
                    </div>
                  </div>

                  <div className="mt-participant">
                    <div>
                      <small>
                        Nama peserta
                      </small>

                      <strong>
                        {participantName(
                          selectedProgram
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Departemen
                      </small>

                      <strong>
                        {participantDepartment(
                          selectedProgram
                        )}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Site
                      </small>

                      <strong>
                        {selectedProgram.site ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <small>
                        Periode peserta
                      </small>

                      <strong>
                        {dateLabel(
                          selectedProgram.start_date
                        )}
                        {" – "}
                        {dateLabel(
                          selectedProgram.end_date
                        )}
                      </strong>
                    </div>
                  </div>
                </section>

                {/* ====================================
                    SUMMARY CARDS
                    ==================================== */}

                <div
                  className="mt-grid"
                  style={{
                    marginBottom: 16,
                  }}
                >
                  <SummaryCard
                    label="Kategori tercapai"
                    value={
                      `${report.achievedCount}/6`
                    }
                    description="Target mingguan terverifikasi"
                  />

                  <SummaryCard
                    label="Post-Test"
                    value={fmt(
                      report.theoryAverage,
                      2
                    )}
                    description="Rata-rata nilai teori"
                  />

                  <SummaryCard
                    label="Praktik"
                    value={fmt(
                      report.practiceAverage,
                      2
                    )}
                    description="Rata-rata nilai praktik"
                  />

                  <SummaryCard
                    label="Samapta"
                    value={
                      `${report.samapta.length} sesi`
                    }
                    description="Evaluasi pada minggu terpilih"
                  />
                </div>

                {/* ====================================
                    MONITORING PER KATEGORI
                    ==================================== */}

                <section className="mt-card">
                  <div className="mt-section-head">
                    <div>
                      <h2>
                        Monitoring per Kategori
                      </h2>

                      <p>
                        Enam kategori utama
                        berdasarkan catatan
                        yang telah diverifikasi.
                      </p>
                    </div>
                  </div>

                  <Table
                    columns={[
                      "Kategori",
                      "Target",
                      "Realisasi",
                      "Pencapaian",
                      "Terverifikasi",
                      "Pending",
                      "Status",
                    ]}
                  >
                    {filteredCategories.length ? (
                      filteredCategories.map(
                        (item) => (
                          <tr key={item.key}>
                            <td>
                              <strong>
                                {item.key ===
                                "Training"
                                  ? "Internal Training"
                                  : item.key}
                              </strong>
                            </td>

                            <td>
                              {fmt(item.target)}
                              {" "}
                              {item.unit}
                            </td>

                            <td>
                              {fmt(
                                item.realized,
                                item.key ===
                                  "Fisik"
                                  ? 3
                                  : 0
                              )}
                              {" "}
                              {item.unit}
                            </td>

                            <td>
                              <strong>
                                {fmt(
                                  item.percent,
                                  1
                                )}
                                %
                              </strong>

                              <div className="mt-progress">
                                <div
                                  style={{
                                    width:
                                      `${Math.min(
                                        100,
                                        Math.max(
                                          0,
                                          item.percent
                                        )
                                      )}%`,
                                  }}
                                />
                              </div>
                            </td>

                            <td>
                              {item.verified}
                            </td>

                            <td>
                              {item.pending}
                            </td>

                            <td>
                              <span
                                className={
                                  "mt-pill " +
                                  (
                                    item.achieved
                                      ? "green"
                                      : item.recorded
                                      ? "orange"
                                      : ""
                                  )
                                }
                              >
                                {statusLabel(
                                  item
                                )}
                              </span>
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan={7}>
                          Tidak ada kategori
                          yang sesuai filter.
                        </td>
                      </tr>
                    )}
                  </Table>

                  <p className="mt-info">
                    Target Fisik 25 km,
                    Training 4 kegiatan,
                    Coaching 1 kegiatan,
                    Sosialisasi 3 kegiatan,
                    Orientasi Area 2 kegiatan,
                    dan Hazard 2 kegiatan.
                    Persentase tidak dibatasi
                    100%, sedangkan batang
                    indikator visual dibatasi
                    100%.
                  </p>
                </section>

                {/* ====================================
                    ACHIEVEMENT HISTORY
                    ==================================== */}

                <section className="mt-card">
                  <div className="mt-section-head">
                    <h2>
                      Riwayat Achievement Mingguan
                    </h2>
                  </div>

                  <Table
                    columns={[
                      "Tanggal",
                      "Kategori",
                      "Keterangan",
                      "Realisasi",
                      "Status",
                    ]}
                  >
                    {filteredAchievements.length ? (
                      filteredAchievements.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              {dateLabel(
                                item.activity_date
                              )}
                            </td>

                            <td>
                              {item.typeName}
                            </td>

                            <td>
                              {item.description ||
                                "—"}
                            </td>

                            <td>
                              {norm(
                                item.typeName
                              ) === "fisik" &&
                              item.distance_km !=
                                null
                                ? `${fmt(
                                    item.distance_km,
                                    3
                                  )} km`
                                : "1 kegiatan"}
                            </td>

                            <td>
                              <span
                                className={
                                  "mt-pill " +
                                  (
                                    norm(
                                      item.status
                                    ) ===
                                    "verified"
                                      ? "green"
                                      : "orange"
                                  )
                                }
                              >
                                {norm(
                                  item.status
                                ) === "verified"
                                  ? "Terverifikasi"
                                  : item.status ||
                                    "—"}
                              </span>
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          Belum ada data sesuai
                          filter pada minggu ini.
                        </td>
                      </tr>
                    )}
                  </Table>
                </section>

                {/* ====================================
                    POST TEST
                    ==================================== */}

                <section className="mt-card">
                  <div className="mt-section-head">
                    <h2>
                      Ringkasan Post-Test
                    </h2>
                  </div>

                  <Table
                    columns={[
                      "Tanggal",
                      "Nilai",
                      "Catatan",
                    ]}
                  >
                    {report.theory.length ? (
                      report.theory.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              {dateLabel(
                                item.test_date
                              )}
                            </td>

                            <td>
                              {fmt(
                                item.score,
                                2
                              )}
                            </td>

                            <td>
                              {item.notes ||
                                "—"}
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          Belum ada nilai
                          Post-Test pada
                          minggu ini.
                        </td>
                      </tr>
                    )}
                  </Table>

                  <p className="mt-info">
                    Rata-rata nilai:
                    {" "}
                    {fmt(
                      report.theoryAverage,
                      2
                    )}
                    .
                    Nilai tidak otomatis
                    menentukan kelulusan.
                  </p>
                </section>

                {/* ====================================
                    PRACTICE
                    ==================================== */}

                <section className="mt-card">
                  <div className="mt-section-head">
                    <h2>
                      Ringkasan Praktik
                    </h2>
                  </div>

                  <Table
                    columns={[
                      "Tanggal",
                      "Nama Praktik",
                      "Nilai",
                    ]}
                  >
                    {report.practice.length ? (
                      report.practice.map(
                        (item) => (
                          <tr key={item.id}>
                            <td>
                              {dateLabel(
                                item.practice_date
                              )}
                            </td>

                            <td>
                              {item.practice_name ||
                                "Praktik"}
                            </td>

                            <td>
                              {fmt(
                                item.score,
                                2
                              )}
                            </td>
                          </tr>
                        )
                      )
                    ) : (
                      <tr>
                        <td colSpan={3}>
                          Belum ada nilai Praktik
                          pada minggu ini.
                        </td>
                      </tr>
                    )}
                  </Table>

                  <p className="mt-info">
                    Rata-rata nilai praktik:
                    {" "}
                    {fmt(
                      report.practiceAverage,
                      2
                    )}
                    .
                  </p>
                </section>

                {/* ====================================
