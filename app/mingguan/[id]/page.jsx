
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const FILTERS = [
  ["all", "Semua"],
  ["activity", "Ada Aktivitas"],
  ["empty", "Belum Ada"],
];

function normalizeRole(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value) {
  if (!value) return null;

  const text = String(value).slice(0, 10);
  const parts = text.split("-").map(Number);

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

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function localToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
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

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const difference = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (difference < 0) return null;

  return Math.floor(difference / 7) + 1;
}

function average(items) {
  const values = items
    .map((item) => {
      if (
        item.score === null ||
        item.score === undefined ||
        item.score === ""
      ) {
        return null;
      }

      const value = Number(item.score);

      return Number.isFinite(value) ? value : null;
    })
    .filter((value) => value !== null);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function displayScore(value) {
  return value == null
    ? "—"
    : Number(value).toFixed(2);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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

function activityWeek(date, start) {
  const number = weekOf(date, start);

  return number != null &&
    number >= 1 &&
    number <= TOTAL_WEEKS
    ? number
    : null;
}

function getPracticeDate(item) {
  return (
    item.practice_date ||
    item.test_date ||
    item.activity_date ||
    null
  );
}

function calculateSamapta(items) {
  const dates = [
    ...new Set(
      items
        .map((item) => item.test_date)
        .filter(Boolean)
    ),
  ].sort().reverse();

  for (const date of dates) {
    const records = items.filter(
      (item) => item.test_date === date
    );

    const get = (name) => {
      const found = records.find(
        (item) =>
          normalize(item.test_type) === normalize(name)
      );

      if (
        !found ||
        found.score === null ||
        found.score === undefined
      ) {
        return null;
      }

      const value = Number(found.score);

      return Number.isFinite(value) ? value : null;
    };

    const a = get("Lari 12 Menit");

    const values = [
      get("Pull-Up"),
      get("Push-Up"),
      get("Sit-Up"),
      get("Shuttle Run"),
    ];

    if (
      a !== null &&
      values.every((value) => value !== null)
    ) {
      const b =
        values.reduce((sum, value) => sum + value, 0) /
        4;

      const run = records.find(
        (item) =>
          normalize(item.test_type) === "lari12menit"
      );

      const distance =
        run?.result_value == null
          ? null
          : Number(run.result_value);

      return {
        date,
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
      };
    }
  }

  return null;
}

function getWeekData(
  number,
  startValue,
  categories,
  achievements,
  postTests,
  practice,
  samapta
) {
  const start = parseDate(startValue);

  if (!start) return null;

  const weekStart = addDays(
    start,
    (number - 1) * 7
  );

  const weekEnd = addDays(weekStart, 6);

  const startISO = isoDate(weekStart);
  const endISO = isoDate(weekEnd);

  const inWeek = (date) =>
    Boolean(
      date &&
      String(date).slice(0, 10) >= startISO &&
      String(date).slice(0, 10) <= endISO
    );

  const weekAchievements = achievements.filter(
    (item) => inWeek(item.activity_date)
  );

  const weekPostTests = postTests.filter(
    (item) => inWeek(item.test_date)
  );

  const weekPractice = practice.filter(
    (item) => inWeek(getPracticeDate(item))
  );

  const weekSamapta = samapta.filter(
    (item) => inWeek(item.test_date)
  );

  const categorySummary = CATEGORIES.map((name) => {
    const category = categories.find(
      (item) =>
        normalize(item.name) === normalize(name)
    );

    const matches = category
      ? weekAchievements.filter(
          (item) => item.type_code === category.code
        )
      : [];

    return {
      name,
      total: matches.length,
      verified: matches.filter(
        (item) => item.status === "verified"
      ).length,
      pending: matches.filter(
        (item) => item.status === "pending"
      ).length,
    };
  });

  const samaptaResult = calculateSamapta(
    weekSamapta
  );

  const activityCount =
    weekAchievements.length +
    weekPostTests.length +
    weekPractice.length +
    weekSamapta.length;

  return {
    number,
    startISO,
    endISO,
    achievements: weekAchievements,
    postTests: weekPostTests,
    practice: weekPractice,
    samapta: weekSamapta,
    categorySummary,
    theoryAverage: average(weekPostTests),
    practiceAverage: average(weekPractice),
    samaptaResult,
    verified: weekAchievements.filter(
      (item) => item.status === "verified"
    ).length,
    pending: weekAchievements.filter(
      (item) => item.status === "pending"
    ).length,
    activityCount,
    hasActivity: activityCount > 0,
  };
}

// =====================================================
// VERIFIKASI AKSES — REVISI
//
// Admin:
// Semua program sesuai RLS.
//
// Mentor:
// Hanya program dengan mentor_id = user.id.
//
// Peserta:
// - Hanya participant_id = user.id
// - Program active
// - Persetujuan pendaftaran baru, lama,
//   atau legacy_access yang sah.
//
// Halaman hanya membaca data monitoring.
// =====================================================

async function verifyWeeklyAccess(programId) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { redirect: "/login" };
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
      "Profil akun tidak ditemukan."
    );
  }

  const role = normalizeRole(profile.role);

  const isAdmin = role === "admin";
  const isMentor = role === "mentor";

  const isParticipant = [
    "participant",
    "peserta",
  ].includes(role);

  if (!isAdmin && !isMentor && !isParticipant) {
    throw new Error(
      "Role akun tidak memiliki akses Evaluasi Mingguan."
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
      legacy_access,
      peserta:profiles!ojt_programs_participant_id_fkey(
        full_name,
        department
      )
    `)
    .eq("id", programId);

  if (isMentor) {
    query = query.eq("mentor_id", user.id);
  }

  if (isParticipant) {
    query = query
      .eq("participant_id", user.id)
      .eq("status", "active");
  }

  const {
    data: program,
    error: programError,
  } = await query.maybeSingle();

  if (programError) throw programError;

  if (!program) {
    throw new Error(
      "Program OJT tidak ditemukan atau akun tidak memiliki izin."
    );
  }

  if (!parseDate(program.start_date)) {
    throw new Error(
      "Tanggal mulai OJT belum valid."
    );
  }

  if (isParticipant) {
    // Mendukung pola persetujuan yang sama
    // dengan Dashboard Peserta dan OjtInsights.
    const [
      newRequestResult,
      oldRegistrationResult,
    ] = await Promise.all([
      supabase
        .from("ojt_registration_requests")
        .select("status")
        .eq("participant_id", user.id),

      supabase
        .from("participant_registrations")
        .select("status")
        .eq("user_id", user.id),
    ]);

    if (newRequestResult.error) {
      throw new Error(
        "Gagal memeriksa persetujuan pendaftaran baru: " +
        newRequestResult.error.message
      );
    }

    if (oldRegistrationResult.error) {
      throw new Error(
        "Gagal memeriksa persetujuan pendaftaran lama: " +
        oldRegistrationResult.error.message
      );
    }

    const approvedNew = (
      newRequestResult.data || []
    ).some(
      (item) =>
        normalizeRole(item.status) === "approved"
    );

    const approvedOld = (
      oldRegistrationResult.data || []
    ).some(
      (item) =>
        normalizeRole(item.status) === "approved"
    );

    if (
      !approvedNew &&
      !approvedOld &&
      program.legacy_access !== true
    ) {
      throw new Error(
        "Program OJT belum memiliki persetujuan akses yang sah."
      );
    }
  }

  return {
    userId: user.id,
    profile,
    program,
    role,
  };
}

// =====================================================
// PEMBUAT PDF ASLI TANPA DEPENDENSI TAMBAHAN
// =====================================================
//
// File dibuat dengan format PDF 1.4 standar.
// Menggunakan Helvetica dan halaman A4 portrait.
// Tidak membutuhkan jsPDF, html2canvas, atau API.
//
// Catatan:
// Font PDF standar mendukung karakter Latin dasar.
// Karakter khusus di luar font tersebut dinormalisasi
// untuk menjaga kompatibilitas pembaca PDF.
// =====================================================

function createWeeklyPdf({
  participantName,
  department,
  site,
  startDate,
  endDate,
  selected,
  activeWeeks,
}) {
  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 43;
  const BOTTOM = 60;

  const COLOR = {
    ink: [0.1, 0.23, 0.18],
    muted: [0.43, 0.54, 0.48],
    green: [0.05, 0.53, 0.35],
    light: [0.92, 0.97, 0.94],
    line: [0.87, 0.91, 0.88],
    white: [1, 1, 1],
  };

  const pages = [[]];

  let currentPage = 0;
  let cursor = PAGE_HEIGHT - 107;

  const current = () => pages[currentPage];

  function safe(input) {
    return String(input ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—]/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/•/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[^\x20-\x7E\n]/g, "?");
  }

  function escaped(input) {
    return safe(input)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\n/g, " ");
  }

  function rgb(color) {
    return color
      .map((value) => value.toFixed(3))
      .join(" ");
  }

  function rect(x, y, width, height, color) {
    current().push(
      `${rgb(color)} rg ` +
      `${x.toFixed(2)} ` +
      `${y.toFixed(2)} ` +
      `${width.toFixed(2)} ` +
      `${height.toFixed(2)} re f`
    );
  }

  function line(y) {
    rect(
      MARGIN,
      y,
      PAGE_WIDTH - MARGIN * 2,
      0.6,
      COLOR.line
    );
  }

  function write(
    input,
    x,
    y,
    size = 10,
    bold = false,
    color = COLOR.ink
  ) {
    current().push(
      `BT /${bold ? "F2" : "F1"} ` +
      `${size} Tf ${rgb(color)} rg ` +
      `1 0 0 1 ${x.toFixed(2)} ` +
      `${y.toFixed(2)} Tm ` +
      `(${escaped(input)}) Tj ET`
    );
  }

  function decoratePage(isFirst) {
    rect(
      0,
      PAGE_HEIGHT - 85,
      PAGE_WIDTH,
      85,
      [0.035, 0.14, 0.17]
    );

    write(
      isFirst
        ? "EVALUASI MINGGUAN OJT"
        : "EVALUASI MINGGUAN OJT - LANJUTAN",
      MARGIN,
      PAGE_HEIGHT - 45,
      isFirst ? 19 : 16,
      true,
      COLOR.white
    );

    write(
      "OJT MineTrack v2.0  |  " +
      "Emergency Response Group - PT Berau Coal",
      MARGIN,
      PAGE_HEIGHT - 65,
      9,
      false,
      [0.77, 0.92, 0.84]
    );
  }

  function newPage() {
    pages.push([]);
    currentPage += 1;
    cursor = PAGE_HEIGHT - 107;
    decoratePage(false);
  }

  function need(amount = 25) {
    if (cursor - amount < BOTTOM) {
      newPage();
    }
  }

  function wrap(input, maxWidth, size = 10) {
    const charMax = Math.max(
      12,
      Math.floor(maxWidth / (size * 0.54))
    );

    const parts = safe(input).split("\n");
    const result = [];

    for (const part of parts) {
      const words = part
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      if (!words.length) {
        result.push("");
        continue;
      }

      let buffer = "";

      for (const rawWord of words) {
        const chunks =
          rawWord.match(
            new RegExp(`.{1,${charMax}}`, "g")
          ) || [rawWord];

        for (const word of chunks) {
          if (!buffer) {
            buffer = word;
          } else if (
            (buffer + " " + word).length <= charMax
          ) {
            buffer += " " + word;
          } else {
            result.push(buffer);
            buffer = word;
          }
        }
      }

      if (buffer) {
        result.push(buffer);
      }
    }

    return result;
  }

  function paragraph(
    content,
    {
      size = 10,
      bold = false,
      color = COLOR.ink,
      indent = 0,
      gap = 6,
    } = {}
  ) {
    const lines = wrap(
      content,
      PAGE_WIDTH - MARGIN * 2 - indent,
      size
    );

    for (const part of lines) {
      need(size + 7);

      write(
        part,
        MARGIN + indent,
        cursor,
        size,
        bold,
        color
      );

      cursor -= size + 5;
    }

    cursor -= gap;
  }

  function section(title) {
    need(39);
    cursor -= 6;

    rect(
      MARGIN,
      cursor - 25,
      PAGE_WIDTH - MARGIN * 2,
      29,
      COLOR.light
    );

    write(
      title,
      MARGIN + 10,
      cursor - 15,
      10,
      true,
      COLOR.green
    );

    cursor -= 39;
  }

  function row(label, value) {
    need(21);

    write(
      label,
      MARGIN + 4,
      cursor,
      10,
      false,
      COLOR.muted
    );

    write(
      value,
      MARGIN + 215,
      cursor,
      10,
      true,
      COLOR.ink
    );

    cursor -= 21;
    line(cursor + 8);
  }

  function entry(title, date, details, score) {
    need(48);

    paragraph(
      `${title} | ${date} | Nilai: ${score}`,
      {
        size: 10,
        bold: true,
        gap: 1,
      }
    );

    if (details) {
      paragraph(details, {
        size: 9,
        color: COLOR.muted,
        gap: 5,
      });
    }

    cursor -= 5;
  }

  // ---------------------------------------------------
  // ISI PDF
  // ---------------------------------------------------

  decoratePage(true);

  section("IDENTITAS PESERTA");

  row("Nama peserta", participantName);

  row(
    "Departemen / site",
    `${department} / ${site}`
  );

  row(
    "Periode OJT",
    `${startDate} - ${endDate}`
  );

  row(
    "Minggu evaluasi",
    `Week ${selected.number} ` +
    `(${selected.startISO} - ${selected.endISO})`
  );

  section("RINGKASAN NILAI DAN AKTIVITAS");

  row(
    "Rata-rata teori",
    selected.theoryAverage == null
      ? "Belum ada"
      : Number(selected.theoryAverage).toFixed(2)
  );

  row(
    "Rata-rata praktik",
    selected.practiceAverage == null
      ? "Belum ada"
      : Number(selected.practiceAverage).toFixed(2)
  );

  row(
    "Nilai Samapta",
    selected.samaptaResult?.final == null
      ? "Belum lengkap"
      : Number(
          selected.samaptaResult.final
        ).toFixed(2)
  );

  row(
    "Achievement terverifikasi",
    `${selected.verified} kegiatan`
  );

  row(
    "Achievement pending",
    `${selected.pending} kegiatan`
  );

  row(
    "Cakupan program",
    `${activeWeeks} dari 25 minggu memiliki catatan`
  );

  section("ENAM KATEGORI ACHIEVEMENT");

  selected.categorySummary.forEach((item) => {
    row(
      item.name,
      `${item.total} catatan | ` +
      `${item.verified} verified | ` +
      `${item.pending} pending`
    );
  });

  section("RIWAYAT POST-TEST");

  if (!selected.postTests.length) {
    paragraph(
      "Belum ada Post-Test pada minggu ini."
    );
  }

  selected.postTests.forEach((item) => {
    entry(
      "Post-Test",
      formatDate(item.test_date),
      item.notes,
      displayScore(item.score)
    );
  });

  section("RIWAYAT PRAKTIK MINGGUAN");

  if (!selected.practice.length) {
    paragraph(
      "Belum ada nilai praktik pada minggu ini."
    );
  }

  selected.practice.forEach((item) => {
    entry(
      item.practice_name || "Praktik OJT",
      formatDate(getPracticeDate(item)),
      item.notes,
      displayScore(item.score)
    );
  });

  section("HASIL SAMAPTA");

  if (selected.samaptaResult) {
    row(
      "Tanggal tes",
      formatDate(selected.samaptaResult.date)
    );

    row(
      "Nilai A",
      Number(
        selected.samaptaResult.a
      ).toFixed(2)
    );

    row(
      "Nilai B",
      Number(
        selected.samaptaResult.b
      ).toFixed(2)
    );

    row(
      "Nilai akhir",
      Number(
        selected.samaptaResult.final
      ).toFixed(2)
    );

    row(
      "Status lari",
      selected.samaptaResult.outcome === "pass"
        ? "Lulus"
        : selected.samaptaResult.outcome === "fail"
        ? "Tidak Lulus"
        : "Belum dinilai"
    );
  } else {
    paragraph(
      "Belum ada lima komponen tes Samapta " +
      "lengkap pada minggu ini."
    );
  }

  section("KESIMPULAN MONITORING");

  row(
    "Catatan Achievement",
    String(selected.achievements.length)
  );

  row(
    "Catatan Post-Test",
    String(selected.postTests.length)
  );

  row(
    "Catatan Praktik",
    String(selected.practice.length)
  );

  row(
    "Komponen Samapta",
    String(selected.samapta.length)
  );

  paragraph(
    "Rekap ini merupakan ringkasan otomatis " +
    "catatan OJT. Dokumen ini bukan persetujuan " +
    "atau penilaian akhir mentor.",
    {
      size: 9,
      color: COLOR.muted,
    }
  );

  // ---------------------------------------------------
  // FOOTER PDF DAN NOMOR HALAMAN
  // ---------------------------------------------------

  for (let i = 0; i < pages.length; i++) {
    pages[i].push(
      `${rgb(COLOR.line)} rg ` +
      `${MARGIN} 48 ` +
      `${(PAGE_WIDTH - 2 * MARGIN).toFixed(2)} ` +
      `0.7 re f`
    );

    pages[i].push(
      `BT /F1 8 Tf ${rgb(COLOR.muted)} rg ` +
      `1 0 0 1 ${MARGIN} 33 Tm ` +
      `(Dibuat otomatis oleh OJT MineTrack) Tj ET`
    );

    pages[i].push(
      `BT /F1 8 Tf ${rgb(COLOR.muted)} rg ` +
      `1 0 0 1 ${PAGE_WIDTH - 100} 33 Tm ` +
      `(Halaman ${i + 1} / ${pages.length}) Tj ET`
    );
  }

  // ---------------------------------------------------
  // SERIALISASI DOKUMEN PDF
  // ---------------------------------------------------

  const objects = [null];

  const addObject = (content = "") => {
    objects.push(content);
    return objects.length - 1;
  };

  const catalogId = addObject();
  const pagesId = addObject();

  const regularFontId = addObject(
    "<< /Type /Font /Subtype /Type1 " +
    "/BaseFont /Helvetica " +
    "/Encoding /WinAnsiEncoding >>"
  );

  const boldFontId = addObject(
    "<< /Type /Font /Subtype /Type1 " +
    "/BaseFont /Helvetica-Bold " +
    "/Encoding /WinAnsiEncoding >>"
  );

  const pageIds = [];

  for (const pageContent of pages) {
    const stream =
      pageContent.join("\n") + "\n";

    const contentId = addObject(
      `<< /Length ${stream.length} >>\n` +
      `stream\n${stream}endstream`
    );

    const pageId = addObject(
      `<< /Type /Page ` +
      `/Parent ${pagesId} 0 R ` +
      `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << ` +
      `/F1 ${regularFontId} 0 R ` +
      `/F2 ${boldFontId} 0 R ` +
      `>> >> ` +
      `/Contents ${contentId} 0 R >>`
    );

    pageIds.push(pageId);
  }

  objects[catalogId] =
    `<< /Type /Catalog ` +
    `/Pages ${pagesId} 0 R >>`;

  objects[pagesId] =
    `<< /Type /Pages /Kids [` +
    pageIds.map((id) => `${id} 0 R`).join(" ") +
    `] /Count ${pageIds.length} >>`;

  let output = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

  const offsets = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = output.length;

    output +=
      `${i} 0 obj\n` +
      `${objects[i]}\n` +
      `endobj\n`;
  }

  const xref = output.length;

  output +=
    `xref\n0 ${objects.length}\n` +
    `0000000000 65535 f \n`;

  for (let i = 1; i < objects.length; i++) {
    output +=
      `${String(offsets[i]).padStart(10, "0")} ` +
      `00000 n \n`;
  }

  output +=
    `trailer\n` +
    `<< /Size ${objects.length} ` +
    `/Root ${catalogId} 0 R >>\n` +
    `startxref\n${xref}\n%%EOF`;

  const bytes = new Uint8Array(output.length);

  for (let i = 0; i < output.length; i++) {
    bytes[i] = output.charCodeAt(i) & 255;
  }

  return new Blob([bytes], {
    type: "application/pdf",
  });
}

function makePdfFileName(name, week) {
  const safeName = String(name || "Peserta-OJT")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return (
    `Evaluasi-Mingguan-` +
    `${safeName || "Peserta-OJT"}-` +
    `Week-${String(week).padStart(2, "0")}.pdf`
  );
}

// =====================================================
// KOMPONEN ICON
// =====================================================

function Icon({ name, size = 20 }) {
  const shapes = {
    back: (
      <path d="m15 18-6-6 6-6M9 12h12" />
    ),

    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),

    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),

    check: (
      <path d="m4 12 5 5L20 6" />
    ),

    left: (
      <path d="m15 18-6-6 6-6" />
    ),

    right: (
      <path d="m9 18 6-6-6-6" />
    ),

    chart: (
      <path d="M4 20V12M10 20V5M16 20v-9M22 20V8" />
    ),

    book: (
      <>
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1" />
        <path d="M12 5c3-2 6-2 9-1v15c-3-1-6-1-9 1M12 5v15" />
      </>
    ),

    fitness: (
      <path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12" />
    ),

    print: (
      <>
        <path d="M6 9V3h12v6M6 18H4V9h16v9h-2" />
        <path d="M6 15h12v6H6z" />
      </>
    ),

    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9" />
        <path d="M3 4v5h5M4 13a8 8 0 0 0 14 5l3-3" />
        <path d="M21 20v-5h-5" />
      </>
    ),

    download: (
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 17v4h16v-4" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.check}
    </svg>
  );
}

function Stat({ label, value, sub, icon }) {
  return (
    <div className="wm-stat">
      <div className="wm-stat-top">
        <span>{label}</span>
        <Icon name={icon} size={18} />
      </div>

      <strong>{value}</strong>

      <small>{sub}</small>
    </div>
  );
}

// =====================================================
// HALAMAN EVALUASI MINGGUAN
// =====================================================

export default function EvaluasiMingguanOJT() {
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

  const [week, setWeek] = useState(1);
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [pdfNotice, setPdfNotice] = useState("");

  const requestRef = useRef(0);

  const isParticipant = [
    "participant",
    "peserta",
  ].includes(viewer?.role);

  const backPath = isParticipant
    ? "/dashboard-peserta"
    : programId
    ? `/peserta/${programId}`
    : "/";

  const backText = isParticipant
    ? "Dashboard Peserta"
    : "Detail Peserta";

  async function fetchMonitoringData(id) {
    const [
      categoryResult,
      achievementResult,
      postTestResult,
      practiceResult,
      samaptaResult,
    ] = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,status,description"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,program_id,practice_date,practice_name,score,notes"
        )
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value"
        )
        .eq("program_id", id),
    ]);

    const required = [
      categoryResult,
      achievementResult,
      postTestResult,
      samaptaResult,
    ];

    for (const result of required) {
      if (result.error) {
        throw result.error;
      }
    }

    return {
      categories: categoryResult.data || [],
      achievements: achievementResult.data || [],
      postTests: postTestResult.data || [],
      practice: practiceResult.error
        ? []
        : practiceResult.data || [],
      samapta: samaptaResult.data || [],
      warning: practiceResult.error
        ? "Data Praktik Mingguan belum dapat dimuat: " +
          practiceResult.error.message
        : "",
    };
  }

  function applyData(data) {
    setCategories(data.categories);
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractice(data.practice);
    setSamapta(data.samapta);
    setWarning(data.warning);
  }

  // ===================================================
  // PEMUATAN AWAL — AKSES 3 ROLE
  // ===================================================

  useEffect(() => {
    if (!programId) {
      setLoading(false);
      setError("ID program OJT tidak tersedia.");
      return;
    }

    let active = true;
    const requestId = ++requestRef.current;

    async function initialize() {
      setLoading(true);
      setError("");
      setWarning("");
      setPdfNotice("");
      setProgram(null);
      setViewer(null);
      setWeek(1);
      setFilter("all");

      try {
        const access = await verifyWeeklyAccess(
          programId
        );

        if (
          !active ||
          requestId !== requestRef.current
        ) {
          return;
        }

        if (access.redirect) {
          router.replace(access.redirect);
          return;
        }

        const result = await fetchMonitoringData(
          access.program.id
        );

        if (
          !active ||
          requestId !== requestRef.current
        ) {
          return;
        }

        setViewer({
          id: access.userId,
          role: access.role,
        });

        setProgram(access.program);
        applyData(result);

        const current = weekOf(
          localToday(),
          access.program.start_date
        );

        setWeek(
          Math.min(
            TOTAL_WEEKS,
            Math.max(1, current || 1)
          )
        );
      } catch (err) {
        if (
          active &&
          requestId === requestRef.current
        ) {
          setProgram(null);
          setViewer(null);

          setError(
            err?.message ||
              "Gagal memuat Evaluasi Mingguan."
          );
        }
      } finally {
        if (
          active &&
          requestId === requestRef.current
        ) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [programId, router]);

  // ===================================================
  // REFRESH — VERIFIKASI ULANG AKSES
  // ===================================================

  async function refresh() {
    if (
      !programId ||
      refreshing ||
      loading ||
      !program ||
      !viewer
    ) {
      return;
    }

    const requestId = ++requestRef.current;

    setRefreshing(true);
    setError("");
    setPdfNotice("");

    try {
      const access = await verifyWeeklyAccess(
        programId
      );

      if (requestId !== requestRef.current) {
        return;
      }

      if (access.redirect) {
        setProgram(null);
        setViewer(null);
        router.replace(access.redirect);
        return;
      }

      if (access.userId !== viewer.id) {
        throw new Error(
          "Akun pengguna berubah. Silakan buka ulang Evaluasi Mingguan."
        );
      }

      const data = await fetchMonitoringData(
        access.program.id
      );

      if (requestId !== requestRef.current) {
        return;
      }

      setViewer({
        id: access.userId,
        role: access.role,
      });

      setProgram(access.program);
      applyData(data);
    } catch (err) {
      if (requestId !== requestRef.current) {
        return;
      }

      // Jangan pertahankan data setelah
      // verifikasi akses atau refresh gagal.
      setProgram(null);
      setViewer(null);
      setCategories([]);
      setAchievements([]);
      setPostTests([]);
      setPractice([]);
      setSamapta([]);

      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      if (requestId === requestRef.current) {
        setRefreshing(false);
      }
    }
  }

  const weeks = useMemo(() => {
    if (!program?.start_date) return [];

    return Array.from(
      { length: TOTAL_WEEKS },
      (_, index) =>
        getWeekData(
          index + 1,
          program.start_date,
          categories,
          achievements,
          postTests,
          practice,
          samapta
        )
    ).filter(Boolean);
  }, [
    program,
    categories,
    achievements,
    postTests,
    practice,
    samapta,
  ]);

  const selected = weeks.find(
    (item) => item.number === week
  );

  const activeWeeks = weeks.filter(
    (item) => item.hasActivity
  ).length;

  const emptyWeeks = TOTAL_WEEKS - activeWeeks;

  const activePercentage = Math.round(
    (activeWeeks / TOTAL_WEEKS) * 100
  );

  const visibleWeeks = weeks.filter((item) => {
    if (filter === "activity") return item.hasActivity;
    if (filter === "empty") return !item.hasActivity;
    return true;
  });

  const currentWeek = program?.start_date
    ? weekOf(localToday(), program.start_date)
    : null;

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const totalRecords = selected
    ? selected.achievements.length +
      selected.postTests.length +
      selected.practice.length +
      selected.samapta.length
    : 0;

  // ===================================================
  // FUNGSI UNDUH PDF — DIPERTAHANKAN
  // ===================================================

  function downloadWeeklyPdf() {
    if (!program || !selected) {
      setError(
        "Data minggu belum tersedia untuk dibuat PDF."
      );
      return;
    }

    setError("");
    setPdfNotice("");

    try {
      const pdfBlob = createWeeklyPdf({
        participantName,
        department: participant?.department || "—",
        site: program.site || "—",
        startDate: formatDate(program.start_date),
        endDate: formatDate(program.end_date),
        selected,
        activeWeeks,
      });

      const url = window.URL.createObjectURL(
        pdfBlob
      );

      const link = document.createElement("a");

      link.href = url;
      link.download = makePdfFileName(
        participantName,
        selected.number
      );

      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      link.remove();

      // Beri browser waktu menyelesaikan
      // pembukaan atau pengunduhan Blob.
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);

      setPdfNotice(
        "File PDF telah dibuat dan permintaan " +
        "unduhan dikirim ke browser. " +
        "Periksa folder Unduhan atau aplikasi Files."
      );
    } catch (err) {
      setError(
        "Gagal membuat PDF: " +
        (err?.message || "Terjadi kesalahan.")
      );
    }
  }

  // ===================================================
  // FUNGSI CETAK — DIPERTAHANKAN
  // ===================================================

  function printWeeklyReport() {
    if (!program || !selected) {
      setError(
        "Data minggu belum tersedia untuk dicetak."
      );
      return;
    }

    setError("");

    try {
      if (typeof window.print !== "function") {
        throw new Error(
          "Browser tidak mendukung fitur cetak."
        );
      }

      window.print();
    } catch (err) {
      setError(
        "Gagal membuka cetak: " +
        (err?.message || "Browser tidak mendukung.")
      );
    }
  }

  // ===================================================
  // TAMPILAN HALAMAN
  // ===================================================

  return (
    <main className="wm-root">
      <style>{`
        * {
          box-sizing: border-box;
        }

        .wm-root {
          min-height: 100vh;
          background: #f2f6f7;
          color: #193a2d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .wm-root button {
          font-family: inherit;
        }

        .wm-topbar {
          background: #09232b;
          color: white;
          padding: 15px 22px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }

        .wm-brand {
          font-size: 21px;
          font-weight: 900;
        }

        .wm-brand span {
          color: #36cb98;
        }

        .wm-container {
          max-width: 1100px;
          margin: auto;
          padding: 20px;
        }

        .wm-hero {
          background:
            linear-gradient(
              90deg,
              rgba(6, 28, 35, .98),
              rgba(5, 44, 39, .85),
              rgba(5, 38, 34, .36)
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
          border-radius: 18px;
          color: white;
          padding: 30px;
          margin-bottom: 15px;
        }

        .wm-hero small {
          color: #ebca82;
          font-size: 10px;
          letter-spacing: 1.4px;
          font-weight: 800;
        }

        .wm-hero h1 {
          font-size: 29px;
          margin: 12px 0 8px;
        }

        .wm-hero p {
          color: #d7e9df;
          font-size: 13px;
          margin: 0;
        }

        .wm-card {
          background: #fff;
          border: 1px solid #e1ebe5;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 15px;
          box-shadow: 0 4px 18px #123d2509;
          min-width: 0;
        }

        .wm-card h2 {
          font-size: 17px;
          margin: 0 0 12px;
        }

        .wm-muted {
          color: #73897b;
          font-size: 12px;
          line-height: 1.7;
        }

        .wm-back {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: #ffffff15;
          border: 1px solid #ffffff30;
          border-radius: 10px;
          color: white;
          font-size: 12px;
          font-weight: 800;
          padding: 10px 13px;
          cursor: pointer;
        }

        .wm-person {
          display: flex;
          align-items: center;
          gap: 13px;
          background: #f5fbf7;
          border: 1px solid #dcf0e3;
          border-radius: 13px;
          padding: 15px;
        }

        .wm-avatar {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #dbf5e6;
          color: #078054;
          font-weight: 900;
          font-size: 18px;
        }

        .wm-person-name {
          font-size: 16px;
          font-weight: 900;
          overflow-wrap: anywhere;
        }

        .wm-person-meta {
          font-size: 11px;
          color: #738a7c;
          margin-top: 6px;
          line-height: 1.7;
        }

        .wm-lock {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #effaf3;
          border: 1px solid #d5eede;
          border-radius: 11px;
          color: #0a7c54;
          font-size: 12px;
          line-height: 1.5;
        }

        .wm-pill {
          display: inline-block;
          border-radius: 20px;
          padding: 7px 10px;
          background: #eff2f0;
          color: #6a8073;
          font-size: 10px;
          font-weight: 800;
          white-space: nowrap;
        }

        .wm-pill.active {
          background: #ddf7e7;
          color: #087b51;
        }

        .wm-progress-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .wm-progress-number {
          font-size: 30px;
          font-weight: 900;
          color: #087c53;
        }

        .wm-track {
          height: 11px;
          background: #e4eee7;
          border-radius: 20px;
          overflow: hidden;
          margin: 14px 0 10px;
        }

        .wm-fill {
          height: 100%;
          border-radius: 20px;
          background: linear-gradient(
            90deg, #0d9564, #48c99a
          );
        }

        .wm-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 11px;
          margin-top: 15px;
        }

        .wm-stat {
          border: 1px solid #e5eee8;
          background: #f8faf8;
          border-radius: 12px;
          padding: 15px;
          min-width: 0;
        }

        .wm-stat-top {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          align-items: center;
          color: #72887c;
          font-size: 11px;
        }

        .wm-stat-top svg {
          color: #17855c;
          flex-shrink: 0;
        }

        .wm-stat strong {
          display: block;
          font-size: 25px;
          color: #153e2e;
          margin: 10px 0 7px;
          overflow-wrap: anywhere;
        }

        .wm-stat small {
          color: #86978b;
          font-size: 10px;
          line-height: 1.5;
        }

        .wm-filter {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin: 13px 0;
        }

        .wm-filter button {
          border: 1px solid #d8e7de;
          background: #fff;
          color: #5e7a6b;
          border-radius: 9px;
          padding: 9px 13px;
          font-weight: 800;
          font-size: 11px;
          cursor: pointer;
        }

        .wm-filter button.selected {
          color: #078050;
          background: #e4f8ec;
          border-color: #5cbf90;
        }

        .wm-week-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }

        .wm-week {
          min-width: 0;
          padding: 13px 5px;
          border: 1px solid #e0eae3;
          border-radius: 12px;
          background: #f8faf8;
          color: #234535;
          text-align: center;
          cursor: pointer;
          transition: .15s;
        }

        .wm-week.selected {
          background: #e2f8eb;
          border: 2px solid #0d9a67;
          padding: 12px 4px;
        }

        .wm-week .number {
          font-size: 22px;
          font-weight: 900;
          display: block;
          margin: 5px 0;
        }

        .wm-week .caption {
          font-size: 9px;
          color: #789181;
          font-weight: 800;
        }

        .wm-week .indicator {
          width: 8px;
          height: 8px;
          background: #ccd9d0;
          border-radius: 50%;
          margin: 8px auto 0;
        }

        .wm-week .indicator.has-data {
          background: #10a471;
        }

        .wm-week-current {
          display: inline-block;
          color: #0a8760;
          font-size: 9px;
          font-weight: 900;
          margin-top: 5px;
        }

        .wm-selected-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .wm-selected-head h2 {
          margin: 0;
        }

        .wm-nav {
          display: flex;
          gap: 10px;
          justify-content: space-between;
          margin-top: 15px;
        }

        .wm-btn {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 12px 15px;
          border: 0;
          border-radius: 10px;
          background: #0d9464;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .wm-btn.gray {
          background: #eaf0ec;
          color: #315c45;
        }

        .wm-btn:disabled {
          opacity: .42;
          cursor: not-allowed;
        }

        .wm-section-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .wm-section-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: #e6f7ed;
          color: #0d875b;
        }

        .wm-section-title h2 {
          margin: 0;
        }

        .wm-category-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .wm-category {
          padding: 14px;
          background: #f8faf8;
          border: 1px solid #e7efe9;
          border-radius: 11px;
        }

        .wm-category-title {
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 10px;
        }

        .wm-category-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          font-size: 10px;
          color: #678071;
        }

        .wm-category-stats span {
          background: white;
          border: 1px solid #e7eee9;
          border-radius: 7px;
          padding: 6px;
        }

        .wm-history-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 13px;
          border-bottom: 1px solid #e8efeb;
          padding: 13px 0;
          font-size: 12px;
        }

        .wm-history-item strong {
          display: block;
          color: #224836;
          margin-bottom: 5px;
        }

        .wm-history-item p {
          color: #778c7f;
          line-height: 1.6;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .wm-history-value {
          color: #0b8057;
          font-weight: 900;
          font-size: 15px;
          white-space: nowrap;
        }

        .wm-empty {
          color: #8a9c90;
          padding: 16px;
          text-align: center;
          background: #f8faf8;
          border: 1px dashed #dbe8df;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.7;
        }

        .wm-alert {
          padding: 13px;
          border-radius: 10px;
          margin-bottom: 14px;
          background: #fff3f3;
          color: #b91c1c;
          font-size: 12px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }

        .wm-warning {
          background: #fff8e5;
          color: #865c0d;
        }

        .wm-pdf-notice {
          background: #eaf9f0;
          color: #08774f;
          border: 1px solid #c9ebd8;
        }

        .wm-pdf-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-top: 15px;
        }

        .wm-pdf-actions .wm-btn {
          width: 100%;
        }

        .wm-pdf-help {
          font-size: 11px;
          color: #73897b;
          line-height: 1.7;
          margin-top: 12px;
        }

        .wm-footer {
          padding: 20px;
          text-align: center;
          color: #8a9d90;
          font-size: 11px;
        }

        @media (max-width: 760px) {
          .wm-topbar {
            padding: 13px 15px;
          }

          .wm-brand {
            font-size: 18px;
          }

          .wm-back {
            font-size: 0;
            padding: 9px;
          }

          .wm-container {
            padding: 12px;
          }

          .wm-hero {
            padding: 23px 17px;
            border-radius: 14px;
          }

          .wm-hero h1 {
            font-size: 23px;
          }

          .wm-card {
            padding: 15px;
            border-radius: 14px;
          }

          .wm-person {
            padding: 12px;
          }

          .wm-avatar {
            width: 44px;
            height: 44px;
          }

          .wm-person-name {
            font-size: 14px;
          }

          .wm-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .wm-stat {
            padding: 12px;
          }

          .wm-stat strong {
            font-size: 23px;
          }

          .wm-week-grid {
            grid-template-columns: repeat(5, 1fr);
            gap: 6px;
          }

          .wm-week {
            padding: 10px 2px;
          }

          .wm-week.selected {
            padding: 9px 1px;
          }

          .wm-week .number {
            font-size: 18px;
          }

          .wm-category-grid {
            grid-template-columns: 1fr;
          }

          .wm-pdf-actions {
            grid-template-columns: 1fr;
          }
        }

        /* ==========================================
           CETAK REKAP MINGGUAN - A4 PORTRAIT
           ========================================== */

        @page {
          size: A4 portrait;
          margin: 12mm;
        }

        @media print {
          html,
          body {
            width: auto !important;
            min-width: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .wm-topbar,
          .wm-filter,
          .wm-week-grid,
          .wm-nav,
          .wm-print,
          .wm-refresh,
          .wm-pdf-actions,
          .wm-pdf-help,
          .wm-no-print,
          .wm-footer {
            display: none !important;
          }

          .wm-root {
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            background: white !important;
            color: #193a2d !important;
            overflow: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .wm-container {
            max-width: none !important;
            width: 100% !important;
            min-width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          .wm-hero {
            padding: 14px 16px !important;
            margin-bottom: 9px !important;
            border-radius: 8px !important;
            break-inside: avoid;
            page-break-inside: avoid;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .wm-hero h1 {
            font-size: 19px !important;
            margin: 7px 0 !important;
          }

          .wm-hero p {
            font-size: 10px !important;
          }

          .wm-card {
            padding: 10px 12px !important;
            margin-bottom: 8px !important;
            border-radius: 7px !important;
            box-shadow: none !important;
            min-height: 0 !important;
            height: auto !important;
            overflow: visible !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .wm-card h2 {
            font-size: 13px !important;
            margin-bottom: 8px !important;
            break-after: avoid;
            page-break-after: avoid;
          }

          .wm-person {
            padding: 9px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .wm-avatar {
            width: 35px !important;
            height: 35px !important;
            font-size: 12px !important;
          }

          .wm-person-name {
            font-size: 12px !important;
          }

          .wm-person-meta,
          .wm-muted {
            font-size: 9px !important;
          }

          .wm-lock {
            padding: 7px !important;
            margin-top: 7px !important;
            font-size: 9px !important;
            break-inside: avoid;
          }

          .wm-stats {
            grid-template-columns:
              repeat(4, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .wm-stat {
            padding: 8px !important;
            border-radius: 6px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .wm-stat-top {
            font-size: 9px !important;
          }

          .wm-stat strong {
            font-size: 16px !important;
            margin: 6px 0 !important;
          }

          .wm-stat small {
            font-size: 8px !important;
          }

          .wm-progress-number {
            font-size: 22px !important;
          }

          .wm-track {
            height: 7px !important;
            margin: 7px 0 !important;
          }

          .wm-category-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
            gap: 7px !important;
          }

          .wm-category {
            padding: 8px !important;
            border-radius: 6px !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .wm-category-title {
            font-size: 10px !important;
            margin-bottom: 6px !important;
          }

          .wm-category-stats {
            font-size: 9px !important;
          }

          .wm-category-stats span {
            padding: 4px !important;
          }

          .wm-history-item {
            padding: 8px 0 !important;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .wm-history-item strong,
          .wm-history-value {
            font-size: 10px !important;
          }

          .wm-history-item p {
            font-size: 9px !important;
          }

          .wm-empty {
            padding: 9px !important;
            font-size: 9px !important;
          }

          .wm-section-title {
            margin-bottom: 8px !important;
            break-after: avoid;
          }

          .wm-section-icon {
            width: 29px !important;
            height: 29px !important;
          }

          .wm-alert {
            padding: 9px !important;
            font-size: 9px !important;
            break-inside: auto;
          }
        }
      `}</style>

      <header className="wm-topbar">
        <div className="wm-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="wm-back"
          aria-label={`Kembali ke ${backText}`}
          onClick={() => router.push(backPath)}
        >
          <Icon name="back" size={18} />
          {backText}
        </button>
      </header>

      <div className="wm-container">
        <section className="wm-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>Evaluasi Mingguan OJT</h1>

          <p>
            Monitoring Perkembangan Kompetensi
            Selama 25 Minggu
          </p>
        </section>

        {loading ? (
          <section className="wm-card">
            <h2>Memuat Evaluasi Mingguan...</h2>

            <p className="wm-muted">
              Mengambil data monitoring peserta.
            </p>
          </section>
        ) : !program ? (
          <section className="wm-card">
            <h2>Data Tidak Dapat Ditampilkan</h2>

            <div className="wm-alert">
              {error || "Data peserta belum tersedia."}
            </div>

            <button
              type="button"
              className="wm-btn"
              onClick={() => router.push(backPath)}
            >
              Kembali ke Dashboard
            </button>
          </section>
        ) : (
          <>
            <section className="wm-card">
              <div className="wm-person">
                <div className="wm-avatar">
                  {initials(participantName)}
                </div>

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <div className="wm-person-name">
                    {participantName}
                  </div>

                  <div className="wm-person-meta">
                    {participant?.department || "—"}
                    {" · "}
                    {program.site || "—"}
                    <br />
                    {formatDate(program.start_date)}
                    {" – "}
                    {formatDate(program.end_date)}
                  </div>
                </div>

                <span
                  className={
                    program.status === "active"
                      ? "wm-pill active"
                      : "wm-pill"
                  }
                >
                  {program.status === "active"
                    ? "Aktif"
                    : "Tidak Aktif"}
                </span>
              </div>

              <div className="wm-lock">
                <Icon name="lock" size={17} />

                <span>
                  Peserta otomatis mengikuti program
                  OJT yang telah diverifikasi.
                  Semua data evaluasi hanya untuk{" "}
                  <strong>{participantName}</strong>.
                  {isParticipant &&
                    " Akses Anda bersifat baca saja."}
                </span>
              </div>
            </section>

            {error && (
              <div
                className="wm-alert wm-no-print"
                role="alert"
              >
                {error}
              </div>
            )}

            {warning && (
              <div className="wm-alert wm-warning">
                {warning}
              </div>
            )}

            {pdfNotice && (
              <div
                className="wm-alert wm-pdf-notice wm-no-print"
                role="status"
              >
                {pdfNotice}
              </div>
            )}

            <section className="wm-card">
              <div className="wm-progress-head">
                <div>
                  <h2 style={{ marginBottom: 4 }}>
                    Aktivitas Program OJT
                  </h2>

                  <div className="wm-muted">
                    {activeWeeks} dari 25 minggu
                    memiliki catatan aktivitas
                  </div>
                </div>

                <div className="wm-progress-number">
                  {activePercentage}%
                </div>
              </div>

              <div className="wm-track">
                <div
                  className="wm-fill"
                  style={{
                    width: `${activePercentage}%`,
                  }}
                />
              </div>

              <div className="wm-muted">
                {emptyWeeks} minggu belum memiliki
                catatan aktivitas.
              </div>

              <p className="wm-muted">
                Persentase ini menunjukkan cakupan
                minggu yang memiliki data, bukan
                tingkat kelulusan atau persetujuan
                evaluasi oleh mentor.
              </p>
            </section>

            <section className="wm-card wm-no-print">
              <div className="wm-selected-head">
                <h2>Pilih Minggu Evaluasi</h2>

                <button
                  type="button"
                  className="wm-btn gray wm-refresh"
                  disabled={refreshing}
                  onClick={refresh}
                  title="Muat ulang data"
                >
                  <Icon name="refresh" size={17} />

                  {refreshing
                    ? "Memuat..."
                    : "Refresh"}
                </button>
              </div>

              <p className="wm-muted">
                Week 1 sampai Week 25 dihitung
                setiap tujuh hari dari tanggal
                mulai OJT.
              </p>

              <div className="wm-filter">
                {FILTERS.map(([key, text]) => (
                  <button
                    key={key}
                    type="button"
                    className={
                      filter === key ? "selected" : ""
                    }
                    onClick={() => setFilter(key)}
                  >
                    {text}
                  </button>
                ))}
              </div>

              {visibleWeeks.length === 0 ? (
                <div className="wm-empty">
                  Tidak ada minggu sesuai filter ini.
                </div>
              ) : (
                <div className="wm-week-grid">
                  {visibleWeeks.map((item) => (
                    <button
                      type="button"
                      key={item.number}
                      className={
                        "wm-week" +
                        (item.number === week
                          ? " selected"
                          : "")
                      }
                      onClick={() =>
                        setWeek(item.number)
                      }
                    >
                      <span className="caption">
                        WEEK
                      </span>

                      <span className="number">
                        {item.number}
                      </span>

                      <span className="caption">
                        {item.hasActivity
                          ? "ADA DATA"
                          : "BELUM"}
                      </span>

                      <div
                        className={
                          "indicator" +
                          (item.hasActivity
                            ? " has-data"
                            : "")
                        }
                      />

                      {currentWeek === item.number && (
                        <span className="wm-week-current">
                          SAAT INI
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {selected && (
              <>
                <section className="wm-card">
                  <div className="wm-selected-head">
                    <h2>Ringkasan Week {week}</h2>

                    <span
                      className={
                        selected.hasActivity
                          ? "wm-pill active"
                          : "wm-pill"
                      }
                    >
                      {selected.hasActivity
                        ? "Ada Aktivitas"
                        : "Belum Ada"}
                    </span>
                  </div>

                  <p className="wm-muted">
                    <Icon name="calendar" size={15} />
                    {" "}
                    {formatDate(selected.startISO)}
                    {" – "}
                    {formatDate(selected.endISO)}
                  </p>

                  <div className="wm-stats">
                    <Stat
                      label="Rata-rata Teori"
                      value={displayScore(
                        selected.theoryAverage
                      )}
                      sub={
                        selected.postTests.length +
                        " Post-Test"
                      }
                      icon="book"
                    />

                    <Stat
                      label="Rata-rata Praktik"
                      value={displayScore(
                        selected.practiceAverage
                      )}
                      sub={
                        selected.practice.length +
                        " penilaian"
                      }
                      icon="fitness"
                    />

                    <Stat
                      label="Nilai Samapta"
                      value={displayScore(
                        selected.samaptaResult?.final
                      )}
                      sub={
                        selected.samaptaResult
                          ? formatDate(
                              selected.samaptaResult.date
                            )
                          : "Belum lengkap"
                      }
                      icon="chart"
                    />

                    <Stat
                      label="Terverifikasi"
                      value={selected.verified}
                      sub={
                        selected.pending +
                        " pending"
                      }
                      icon="check"
                    />
                  </div>

                  <div className="wm-nav wm-no-print">
                    <button
                      type="button"
                      className="wm-btn gray"
                      disabled={week <= 1}
                      onClick={() =>
                        setWeek((value) =>
                          Math.max(1, value - 1)
                        )
                      }
                    >
                      <Icon name="left" size={16} />
                      Sebelumnya
                    </button>

                    <button
                      type="button"
                      className="wm-btn"
                      disabled={week >= TOTAL_WEEKS}
                      onClick={() =>
                        setWeek((value) =>
                          Math.min(
                            TOTAL_WEEKS,
                            value + 1
                          )
                        )
                      }
                    >
                      Berikutnya
                      <Icon name="right" size={16} />
                    </button>
                  </div>
                </section>

                <section className="wm-card">
                  <div className="wm-section-title">
                    <div className="wm-section-icon">
                      <Icon name="check" />
                    </div>

                    <h2>Enam Pencapaian OJT</h2>
                  </div>

                  <div className="wm-category-grid">
                    {selected.categorySummary.map(
                      (item) => (
                        <div
                          className="wm-category"
                          key={item.name}
                        >
                          <div className="wm-category-title">
                            {item.name}
                          </div>

                          <div className="wm-category-stats">
                            <span>
                              Total: {item.total}
                            </span>

                            <span>
                              Verified: {item.verified}
                            </span>

                            <span>
                              Pending: {item.pending}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </section>

                <section className="wm-card">
                  <div className="wm-section-title">
                    <div className="wm-section-icon">
                      <Icon name="book" />
                    </div>

                    <h2>Riwayat Post-Test</h2>
                  </div>

                  {!selected.postTests.length ? (
                    <div className="wm-empty">
                      Belum ada Post-Test
                      pada Week {week}.
                    </div>
                  ) : (
                    selected.postTests.map((item) => (
                      <div
                        key={item.id}
                        className="wm-history-item"
                      >
                        <div>
                          <strong>
                            {formatDate(item.test_date)}
                          </strong>

                          <p>
                            {item.notes ||
                              "Tanpa catatan mentor"}
                          </p>
                        </div>

                        <div className="wm-history-value">
                          {displayScore(item.score)}
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="wm-card">
                  <div className="wm-section-title">
                    <div className="wm-section-icon">
                      <Icon name="fitness" />
                    </div>

                    <h2>
                      Riwayat Praktik Mingguan
                    </h2>
                  </div>

                  {!selected.practice.length ? (
                    <div className="wm-empty">
                      Belum ada nilai Praktik
                      pada Week {week}.
                    </div>
                  ) : (
                    selected.practice.map((item) => (
                      <div
                        key={item.id}
                        className="wm-history-item"
                      >
                        <div>
                          <strong>
                            {item.practice_name ||
                              "Praktik OJT"}
                          </strong>

                          <p>
                            {formatDate(
                              item.practice_date
                            )}
                            {" · "}
                            {item.notes ||
                              "Tanpa catatan"}
                          </p>
                        </div>

                        <div className="wm-history-value">
                          {displayScore(item.score)}
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="wm-card">
                  <div className="wm-section-title">
                    <div className="wm-section-icon">
                      <Icon name="chart" />
                    </div>

                    <h2>Hasil Samapta</h2>
                  </div>

                  {selected.samaptaResult ? (
                    <>
                      <div
                        className="wm-stats"
                        style={{
                          gridTemplateColumns:
                            "repeat(3,1fr)",
                        }}
                      >
                        <Stat
                          label="Nilai A"
                          value={displayScore(
                            selected.samaptaResult.a
                          )}
                          sub="Lari 12 Menit"
                          icon="fitness"
                        />

                        <Stat
                          label="Nilai B"
                          value={displayScore(
                            selected.samaptaResult.b
                          )}
                          sub="Empat Tes Fisik"
                          icon="fitness"
                        />

                        <Stat
                          label="Nilai Akhir"
                          value={displayScore(
                            selected.samaptaResult.final
                          )}
                          sub="Rata-rata A & B"
                          icon="chart"
                        />
                      </div>

                      <p className="wm-muted">
                        Tanggal tes:{" "}
                        {formatDate(
                          selected.samaptaResult.date
                        )}
                      </p>

                      <p className="wm-muted">
                        Status lari:{" "}
                        <strong>
                          {selected.samaptaResult.outcome ===
                          "pass"
                            ? "LULUS"
                            : selected.samaptaResult.outcome ===
                              "fail"
                            ? "TIDAK LULUS"
                            : "BELUM DINILAI"}
                        </strong>
                      </p>
                    </>
                  ) : (
                    <div className="wm-empty">
                      Belum ada lima komponen
                      Samapta lengkap
                      pada Week {week}.
                    </div>
                  )}
                </section>

                <section className="wm-card">
                  <div className="wm-section-title">
                    <div className="wm-section-icon">
                      <Icon name="calendar" />
                    </div>

                    <h2>
                      Kesimpulan Monitoring Week {week}
                    </h2>
                  </div>

                  <p className="wm-muted">
                    Total {totalRecords} rekaman
                    aktivitas tersedia pada minggu ini,
                    terdiri dari:
                  </p>

                  <div className="wm-category-grid">
                    {[
                      [
                        "Pencapaian OJT",
                        selected.achievements.length,
                      ],
                      [
                        "Post-Test",
                        selected.postTests.length,
                      ],
                      [
                        "Praktik Mingguan",
                        selected.practice.length,
                      ],
                      [
                        "Komponen Samapta",
                        selected.samapta.length,
                      ],
                    ].map(([name, count]) => (
                      <div
                        className="wm-category"
                        key={name}
                      >
                        <div className="wm-category-title">
                          {name}
                        </div>

                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            color: "#0b855c",
                          }}
                        >
                          {count}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="wm-muted">
                    Rekap ini merupakan ringkasan
                    otomatis dari catatan OJT.
                    Belum merupakan persetujuan
                    atau penilaian akhir mentor.
                  </p>

                  <div className="wm-pdf-actions wm-no-print">
                    <button
                      type="button"
                      className="wm-btn"
                      onClick={downloadWeeklyPdf}
                    >
                      <Icon name="download" size={18} />
                      Unduh PDF Week {week}
                    </button>

                    <button
                      type="button"
                      className="wm-btn gray"
                      onClick={printWeeklyReport}
                    >
                      <Icon name="print" size={18} />
                      Cetak Rekap Week {week}
                    </button>
                  </div>

                  <p className="wm-pdf-help wm-no-print">
                    Gunakan Unduh PDF untuk menyimpan
                    file langsung. Jika dialog cetak
                    tidak muncul di HP, buka file PDF
                    yang telah diunduh melalui browser
                    atau aplikasi Files, lalu pilih
                    Bagikan dan Cetak.
                  </p>
                </section>
              </>
            )}
          </>
        )}

        <footer className="wm-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
