"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// DASHBOARD PESERTA — MONITORING TERINTEGRASI
//
// - Light / Dark Mode global
// - Tombol tema hanya pada Dashboard awal
// - Admin preview tetap menggunakan akun Admin
// - Pilihan peserta, menu, dan minggu dipulihkan
// - Monitoring dan riwayat Achievement dalam satu halaman
// - Rumus progres dan approval dipertahankan
// - Tidak mengubah struktur database Supabase
//
// PERBAIKAN DOKUMENTASI ACHIEVEMENT:
// - Metadata OJT_FILE_V1 tidak tampil sebagai teks
// - Deskripsi kegiatan tetap ditampilkan
// - Nama file dokumentasi ditampilkan
// - Tombol Lihat Bukti menggunakan Supabase Storage
// - Cetak PDF tidak menampilkan metadata mentah
// ======================================================

const TOTAL_WEEKS = 25;
const BACKGROUND_IMAGE = "/background-erg.png.PNG";
const THEME_KEY = "ojt-minetrack-theme";
const VIEW_KEY = "ojt-minetrack-participant-view-v2";

const TARGETS = [
  { name: "Fisik", target: 25, icon: "run" },
  { name: "Training", target: 4, icon: "training" },
  { name: "Sosialisasi", target: 3, icon: "users" },
  { name: "Coaching", target: 1, icon: "message" },
  { name: "Orientasi Area", target: 2, icon: "compass" },
  { name: "Hazard", target: 2, icon: "warning" },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const MENUS = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "jadwal", label: "Jadwal Kegiatan", icon: "calendar" },
  { id: "monitoring", label: "Monitoring Mingguan", icon: "chart" },
  { id: "achievement", label: "Achievement OJT", icon: "trophy" },
  { id: "hasil", label: "Hasil Post-Test & Praktik", icon: "file" },
  { id: "simper", label: "Status SIMPER", icon: "shield" },
  { id: "rapor", label: "Rapor & Evaluasi", icon: "file" },
];

// Menu pengisian mandiri. URL mengikuti rute input Mentor yang sudah ada.
// Hanya dipakai pada program milik akun Peserta OJT yang login.
const INPUT_MENUS = [
  { id: "achievement", label: "Input Achievement", icon: "trophy", route: (id) => `/achievement/${id}` },
  { id: "posttest", label: "Input Post-Test", icon: "file", route: (id) => `/mingguan/${id}` },
  { id: "praktik", label: "Input Praktik", icon: "tools", route: (id) => `/praktik/${id}` },
  { id: "samapta", label: "Input Samapta", icon: "run", route: (id) => `/samapta/${id}` },
];

const PAGE_TITLES = {
  dashboard: "Dashboard Peserta OJT",
  jadwal: "Jadwal Kegiatan",
  monitoring: "Monitoring Mingguan",
  achievement: "Achievement OJT",
  hasil: "Hasil Post-Test & Praktik",
  simper: "Status SIMPER",
  rapor: "Rapor & Evaluasi",
  profil: "Profil Akun",
};

// ======================================================
// PERBAIKAN DOKUMENTASI ACHIEVEMENT
//
// Mengikuti format dari halaman Input Achievement.
// Tidak memerlukan kolom database tambahan.
// ======================================================

const ACHIEVEMENT_BUCKET = "achievement-files";
const ACHIEVEMENT_FILE_MARKER = "[[OJT_FILE_V1:";

/**
 * Pisahkan teks deskripsi dengan metadata lampiran.
 *
 * Format penyimpanan dari Input Achievement:
 *
 * Deskripsi kegiatan
 * [[OJT_FILE_V1:<encoded JSON>]]
 *
 * JSON memuat:
 * {
 *   name: "nama-file.jpg",
 *   path: "program-id/file.jpg"
 * }
 *
 * Metadata dihapus hanya dari tampilan.
 * Nilai asli database tidak diubah.
 */
function parseAchievementDescription(raw) {
  const source = String(raw ?? "");
  let file = null;

  // Hilangkan seluruh penanda metadata yang lengkap.
  const cleaned = source.replace(
    /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g,
    (_match, encoded) => {
      try {
        const metadata = JSON.parse(
          decodeURIComponent(encoded)
        );

        if (
          metadata &&
          typeof metadata === "object" &&
          !Array.isArray(metadata) &&
          typeof metadata.path === "string" &&
          metadata.path.trim()
        ) {
          file = {
            name:
              typeof metadata.name === "string" &&
              metadata.name.trim()
                ? metadata.name.trim()
                : "Dokumentasi Achievement",
            path: metadata.path.trim(),
          };
        }
      } catch {
        // Metadata tidak valid tetap disembunyikan
        // agar tidak muncul sebagai kode mentah.
      }

      return "";
    }
  );

  // Antisipasi metadata tidak lengkap yang tidak
  // mempunyai penutup "]]".
  const markerIndex = cleaned.indexOf(
    ACHIEVEMENT_FILE_MARKER
  );

  const description = (
    markerIndex >= 0
      ? cleaned.slice(0, markerIndex)
      : cleaned
  ).trim();

  return {
    description,
    file,
  };
}

// ======================================================
// JADWAL WEEK 08–15
// Tanggal, kegiatan, dan materi dipertahankan.
// Deskripsi panjang ditampilkan bila dibuka.
// ======================================================

const WEEKLY_SCHEDULE = [
  // Jadwal Week 07 yang tercantum dalam Excel Link Andien.xlsx.
  // Materi tidak disebutkan dalam Excel, sehingga judulnya mengikuti tanggal.
  {
    id: "w07-tue-posttest",
    week: 7,
    start: "2026-10-27",
    end: "2026-10-27",
    type: "Post-Test",
    title: "Post-Test Selasa, 27 Oktober 2026",
    description: "Akses sesuai jadwal pada tanggal yang ditetapkan.",
    icon: "clipboard",
  },
  {
    id: "w07-thu-posttest",
    week: 7,
    start: "2026-10-29",
    end: "2026-10-29",
    type: "Post-Test",
    title: "Post-Test Kamis, 29 Oktober 2026",
    description: "Akses sesuai jadwal pada tanggal yang ditetapkan.",
    icon: "clipboard",
  },
  {
    id: "w08-navigation",
    week: 8,
    start: "2026-11-03",
    end: "2026-11-03",
    type: "Post-Test",
    title: "Post Test Navigasi Darat",
    description:
      "Evaluasi kompas, pembacaan peta, penentuan arah, dan koordinat.",
    icon: "compass",
  },
  {
    id: "w08-water",
    week: 8,
    start: "2026-11-05",
    end: "2026-11-05",
    type: "Post-Test",
    title: "Post Test Water Rescue",
    description:
      "Evaluasi keselamatan perairan, penyelamatan korban, dan penggunaan peralatan rescue.",
    icon: "water",
  },
  {
    id: "w08-tog",
    week: 8,
    start: "2026-11-01",
    end: "2026-11-07",
    type: "Praktik",
    title: "Praktik Donning & Doffing TOG",
    description:
      "Praktik penggunaan dan pelepasan Turnout Gear sesuai prosedur. Pelaksanaan mengikuti jadwal site.",
    icon: "vest",
  },
  {
    id: "w09-medical",
    week: 9,
    start: "2026-11-10",
    end: "2026-11-10",
    type: "Post-Test",
    title: "Post Test Materi Medical",
    description:
      "Evaluasi scene size-up, primary assessment, penanganan awal korban, bantuan hidup dasar, trauma, stabilisasi, dan evakuasi medis.",
    icon: "medical",
  },
  {
    id: "w09-cssr",
    week: 9,
    start: "2026-11-12",
    end: "2026-11-12",
    type: "Post-Test",
    title: "Post Test Materi CSSR",
    description:
      "Evaluasi bahaya struktur runtuh, prosedur keselamatan, pencarian dan penyelamatan korban, serta penggunaan peralatan CSSR.",
    icon: "rescue",
  },
  {
    id: "w09-extrication",
    week: 9,
    start: "2026-11-08",
    end: "2026-11-14",
    type: "Praktik",
    title: "Praktik Ekstrikasi Ram, Spreader & Cutter",
    description:
      "Praktik penggunaan peralatan hidraulik Ram, Spreader, dan Cutter. Pelaksanaan mengikuti jadwal site.",
    icon: "tools",
  },
  {
    id: "w10-sizeup",
    week: 10,
    start: "2026-11-17",
    end: "2026-11-17",
    type: "Post-Test",
    title: "Post Test Materi Scene Size Up",
    description:
      "Evaluasi identifikasi bahaya, penilaian situasi awal, prioritas penanganan, kebutuhan sumber daya, dan sistem komando.",
    icon: "clipboard",
  },
  {
    id: "w10-rar",
    week: 10,
    start: "2026-11-19",
    end: "2026-11-19",
    type: "Post-Test",
    title: "Post Test Materi RAR",
    description:
      "Evaluasi Road Accident Rescue, pengamanan lokasi, stabilisasi kendaraan, teknik ekstrikasi, penggunaan peralatan rescue, dan evakuasi.",
    icon: "rescue",
  },
  {
    id: "w10-cpr",
    week: 10,
    start: "2026-11-15",
    end: "2026-11-21",
    type: "Praktik",
    title: "Praktik CPR & AED",
    description:
      "Praktik bantuan hidup dasar, teknik CPR, penggunaan AED, koordinasi tim, dan evaluasi sesuai prosedur. Jadwal mengikuti site.",
    icon: "medical",
  },
  {
    id: "w11-har",
    week: 11,
    start: "2026-11-24",
    end: "2026-11-24",
    type: "Post-Test",
    title: "Post Test Materi HAR",
    description:
      "Evaluasi High Angle Rescue, identifikasi bahaya ketinggian, anchor dan belay, rope rescue, serta pengangkatan dan penurunan korban.",
    icon: "rope",
  },
  {
    id: "w11-fire",
    week: 11,
    start: "2026-11-26",
    end: "2026-11-26",
    type: "Post-Test",
    title: "Post Test Materi Fire",
    description:
      "Evaluasi klasifikasi dan bahaya kebakaran, teknik pemadaman, penggunaan APAR dan peralatan fire fighting, serta keselamatan.",
    icon: "fire",
  },
  {
    id: "w11-patient",
    week: 11,
    start: "2026-11-22",
    end: "2026-11-28",
    type: "Praktik",
    title: "Praktik Patient Assessment (Trauma)",
    description:
      "Praktik scene size-up, primary assessment, secondary assessment, trauma management, dan patient handover. Jadwal mengikuti site.",
    icon: "medical",
  },
  {
    id: "w12-hazmat",
    week: 12,
    start: "2026-12-01",
    end: "2026-12-01",
    type: "Post-Test",
    title: "Post Test Materi Hazmat",
    description:
      "Evaluasi identifikasi bahan berbahaya, karakteristik bahaya, penggunaan APD, penanganan insiden HAZMAT, dan pengendalian risiko.",
    icon: "warning",
  },
  {
    id: "w12-csr",
    week: 12,
    start: "2026-12-03",
    end: "2026-12-03",
    type: "Post-Test",
    title: "Post Test Materi CSR",
    description:
      "Evaluasi Confined Space Rescue, bahaya ruang terbatas, prosedur keselamatan, akses dan evakuasi korban, serta penggunaan peralatan rescue.",
    icon: "rescue",
  },
  {
    id: "w12-spinal",
    week: 12,
    start: "2026-11-29",
    end: "2026-12-05",
    type: "Praktik",
    title: "Praktik Spinal Immobilization",
    description:
      "Praktik penanganan korban dengan dugaan cedera tulang belakang menggunakan teknik dan peralatan imobilisasi. Jadwal mengikuti site.",
    icon: "medical",
  },
  {
    id: "w13-navigation",
    week: 13,
    start: "2026-12-08",
    end: "2026-12-08",
    type: "Post-Test",
    title: "Post Test Materi Navigasi Darat",
    description:
      "Evaluasi kompas, GPS, pembacaan peta topografi, penentuan arah dan koordinat, serta perencanaan rute aman.",
    icon: "compass",
  },
  {
    id: "w13-water",
    week: 13,
    start: "2026-12-10",
    end: "2026-12-10",
    type: "Post-Test",
    title: "Post Test Materi Water Rescue",
    description:
      "Evaluasi keselamatan perairan, penggunaan peralatan rescue, serta metode Reach, Throw, Row, dan Go.",
    icon: "water",
  },
  {
    id: "w13-knots",
    week: 13,
    start: "2026-12-06",
    end: "2026-12-12",
    type: "Praktik",
    title: "Praktik Simpul (Rescue Knots)",
    description:
      "Praktik Figure Eight Knot, Bowline Knot, Clove Hitch, Double Fisherman's Knot, Prusik Knot, serta pemeriksaan simpul dan keselamatan.",
    icon: "rope",
  },
  {
    id: "w14-medical",
    week: 14,
    start: "2026-12-15",
    end: "2026-12-15",
    type: "Post-Test",
    title: "Post Test Materi Medical",
    description:
      "Evaluasi scene size-up, primary assessment, bantuan hidup dasar, trauma management, stabilisasi, dan evakuasi medis.",
    icon: "medical",
  },
  {
    id: "w14-cssr",
    week: 14,
    start: "2026-12-17",
    end: "2026-12-17",
    type: "Post-Test",
    title: "Post Test Materi CSSR",
    description:
      "Evaluasi bahaya struktur runtuh, teknik pencarian dan penyelamatan korban, stabilisasi struktur, serta keselamatan operasi.",
    icon: "rescue",
  },
  {
    id: "w14-ma",
    week: 14,
    start: "2026-12-13",
    end: "2026-12-19",
    type: "Praktik",
    title: "Praktik Mechanical Advantage (MA)",
    description:
      "Praktik Basic Mechanical Advantage, sistem 3:1 dan 5:1, Anchor & Pulley System, koordinasi hauling dan lowering, serta keselamatan.",
    icon: "tools",
  },
  {
    id: "w15-sizeup",
    week: 15,
    start: "2026-12-22",
    end: "2026-12-22",
    type: "Post-Test",
    title: "Post Test Materi Scene Size Up",
    description:
      "Evaluasi identifikasi bahaya, penilaian situasi, prioritas penanganan, kebutuhan sumber daya, sistem komando, dan pengendalian risiko.",
    icon: "clipboard",
  },
  {
    id: "w15-rar",
    week: 15,
    start: "2026-12-24",
    end: "2026-12-24",
    type: "Post-Test",
    title: "Post Test Materi RAR",
    description:
      "Evaluasi pengamanan lokasi kecelakaan, stabilisasi kendaraan, akses dan ekstrikasi korban, serta koordinasi penanganan medis dan evakuasi.",
    icon: "rescue",
  },
  {
    id: "w15-scba",
    week: 15,
    start: "2026-12-20",
    end: "2026-12-26",
    type: "Praktik",
    title: "Praktik SCBA",
    description:
      "Praktik identifikasi komponen SCBA, inspeksi, pemeriksaan facepiece, air management, prosedur darurat, serta pengembalian peralatan.",
    icon: "shield",
  },
];

// ======================================================
// HELPERS
// ======================================================

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeType(value) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return ["participant", "peserta"].includes(normalize(role));
}

function initials(value) {
  return (
    String(value || "Peserta")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase() || "P"
  );
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
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

function addDays(value, count) {
  const date = parseDate(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShort(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((item) => item.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function getGlobalWeek(number) {
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > TOTAL_WEEKS
  ) {
    return null;
  }

  if (number === 1) {
    return {
      number,
      start: "2026-09-12",
      end: "2026-09-18",
    };
  }

  const start = addDays("2026-09-20", (number - 2) * 7);
  return { number, start, end: addDays(start, 6) };
}

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date)) return null;

  for (let i = 1; i <= TOTAL_WEEKS; i++) {
    const week = getGlobalWeek(i);
    if (date >= week.start && date <= week.end) return i;
  }

  return null;
}

function getCurrentGlobalWeek() {
  const today = todayWITA();
  const matched = globalWeekOf(today);

  if (matched !== null) return matched;
  if (today < "2026-09-12") return 1;
  if (today > "2027-03-06") return TOTAL_WEEKS;

  return 1;
}

// Rumus minggu program peserta dipertahankan.
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

function weekLabel(value) {
  return `Week ${String(value).padStart(2, "0")}`;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function scoreText(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  });
}

function amountText(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 3,
  });
}

function averageScores(records) {
  const values = records
    .map((record) => record.score)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function emptyProgress() {
  return {
    achievement: 0,
    completedCategories: 0,
    categories: [],
    activityWeeks: 0,
    activityPercent: 0,
    simper: 0,
    simperCompleted: 0,
    simperIssued: false,
  };
}

function emptyWeeklyData() {
  return {
    types: [],
    achievements: [],
    postTests: [],
    practices: [],
    samapta: [],
  };
}

// ======================================================
// ACHIEVEMENT — RUMUS ASAL DIPERTAHANKAN
// ======================================================

function calculateAchievements(records, types, startDate) {
  const codes = new Map(
    types.map((type) => [
      normalizeType(type.name),
      normalizeType(type.code),
    ])
  );

  const verified = records.filter(
    (record) =>
      normalize(record.status) === "verified" &&
      weekOf(record.activity_date, startDate) !== null
  );

  const categories = TARGETS.map((target) => {
    const code = codes.get(normalizeType(target.name));

    const matching = code
      ? verified.filter(
          (record) => normalizeType(record.type_code) === code
        )
      : [];

    let amount = 0;

    if (target.name === "Fisik") {
      amount = matching.reduce((sum, record) => {
        const km = Number(record.distance_km);

        return (
          sum +
          (Number.isFinite(km) && km > 0 ? km : 0)
        );
      }, 0);
    } else {
      amount = matching.length;
    }

    return {
      ...target,
      amount,
      progress: clamp((amount / target.target) * 100),
      completed: amount >= target.target,
    };
  });

  const total = categories.reduce(
    (sum, category) => sum + category.progress,
    0
  );

  return {
    progress: Math.round(total / TARGETS.length),
    completed: categories.filter(
      (category) => category.completed
    ).length,
    categories,
  };
}

function parseSimperMetadata(notes) {
  const text = String(notes || "");
  const start = text.lastIndexOf(META_START);
  const end = text.lastIndexOf(META_END);

  if (start < 0 || end <= start) return null;

  try {
    const data = JSON.parse(
      text.slice(start + META_START.length, end)
    );

    return data &&
      typeof data === "object" &&
      !Array.isArray(data)
      ? data
      : null;
  } catch {
    return null;
  }
}

function calculateSimper(record) {
  if (!record) {
    return { progress: 0, completed: 0, issued: false };
  }

  const meta = parseSimperMetadata(record.notes);

  const steps = [
    record.theory_status === "passed",
    record.practice_status === "passed",
    meta?.orientation_status === "completed",
  ];

  const completed = steps.filter(Boolean).length;

  return {
    progress: Math.round((completed / 3) * 100),
    completed,
    issued: meta?.issuance_status === "issued",
  };
}

function buildProgress(program, data) {
  const achievement = calculateAchievements(
    data.achievements,
    data.types,
    program.start_date
  );

  const selectedSimper =
    data.simper.find(
      (record) => parseSimperMetadata(record.notes)
    ) ||
    data.simper[0] ||
    null;

  const simper = calculateSimper(selectedSimper);
  const weeks = new Set();

  function markWeek(date) {
    const week = weekOf(date, program.start_date);
    if (week !== null) weeks.add(week);
  }

  data.achievements.forEach((record) =>
    markWeek(record.activity_date)
  );

  data.postTests.forEach((record) =>
    markWeek(record.test_date)
  );

  data.practices.forEach((record) =>
    markWeek(record.practice_date)
  );

  data.samapta.forEach((record) =>
    markWeek(record.test_date)
  );

  return {
    achievement: achievement.progress,
    completedCategories: achievement.completed,
    categories: achievement.categories,
    activityWeeks: weeks.size,
    activityPercent: Math.round(
      (weeks.size / TOTAL_WEEKS) * 100
    ),
    simper: simper.progress,
    simperCompleted: simper.completed,
    simperIssued: simper.issued,
  };
}

function getStatusInfo(access) {
  return {
    pending: "Menunggu Persetujuan Mentor",
    rejected: "Pengajuan Ditolak",
    approved: "Program OJT Aktif",
    no_program: "Belum Ada Program",
    error: "Terjadi Kesalahan",
  }[access] || "Memuat...";
}

// ======================================================
// PEMULIHAN TAMPILAN
// ======================================================

function viewStorageKey(accountId) {
  return `${VIEW_KEY}:${accountId}`;
}

function readSavedView(accountId) {
  try {
    const raw = sessionStorage.getItem(
      viewStorageKey(accountId)
    );

    const value = raw ? JSON.parse(raw) : null;

    return value && typeof value === "object"
      ? value
      : {};
  } catch {
    return {};
  }
}

function validPage(value) {
  return Object.prototype.hasOwnProperty.call(
    PAGE_TITLES,
    value
  );
}

function validWeek(value) {
  const number = Number(value);

  return (
    Number.isInteger(number) &&
    number >= 1 &&
    number <= TOTAL_WEEKS
  );
}

// ======================================================
// ICON & UI
// ======================================================

function Icon({ name, size = 20 }) {
  const paths = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v12h14V9M9 21v-8h6v8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),
    chart: (
      <path d="M3 21h18M6 17v-5M12 17V7M18 17V3" />
    ),
    trophy: (
      <>
        <path d="M7 3h10v7a5 5 0 0 1-10 0V3Z" />
        <path d="M7 5H4v3a4 4 0 0 0 4 4M17 5h3v3a4 4 0 0 1-4 4M12 15v5M8 21h8" />
      </>
    ),
    file: (
      <>
        <path d="M6 2h8l5 5v15H6z" />
        <path d="M14 2v5h5M9 12h7M9 16h7" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6" />
      </>
    ),
    check: <path d="m4 12 5 5L20 6" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
      </>
    ),
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m15 9-2 5-4 1 2-5 4-1Z" />
      </>
    ),
    run: (
      <>
        <circle cx="15" cy="4" r="2" />
        <path d="m7 21 4-6 2-4-4-2-3 3M11 15l6 2 3 4M13 11l4-2 3 1" />
      </>
    ),
    training: (
      <path d="M3 9v6M21 9v6M6 7v10M18 7v10M6 12h12" />
    ),
    message: (
      <path d="M4 4h16v12H9l-5 4V4Z" />
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2L12 3Z" />
        <path d="M12 9v5M12 18h.01" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M5 5l1 1M18 18l1 1M2 12h2M20 12h2M5 19l1-1M18 6l1-1" />
      </>
    ),
    moon: (
      <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />
    ),
    water: (
      <path d="M2 8c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 15c3-3 5 3 8 0s5 3 8 0 4 0 4 0" />
    ),
    medical: (
      <>
        <path d="M4 7h16v14H4zM9 7V4h6v3M12 11v7M8.5 14.5h7" />
      </>
    ),
    tools: (
      <path d="M14 7a5 5 0 0 0-7 7L2 19l3 3 5-5a5 5 0 0 0 7-7M14 7l4-4 3 3-4 4" />
    ),
    rescue: (
      <path d="M3 20h18M5 20V9l6-5 6 5v11M13 11l-3 5h4l-2 4" />
    ),
    rope: (
      <path d="M5 6c2-4 7-4 9 0s-2 7-5 7-5 3-3 6 7 3 9 0M16 5c4-1 6 2 5 5s-4 4-6 3" />
    ),
    vest: (
      <path d="m8 3 4 3 4-3 4 4v14H4V7l4-4ZM8 3v18M16 3v18M4 13h16" />
    ),
    clipboard: (
      <>
        <rect x="5" y="5" width="14" height="16" rx="2" />
        <path d="M9 3h6v5H9zM9 13h6M9 17h5" />
      </>
    ),
    fire: (
      <path d="M12 22c-5 0-8-4-8-9 0-4 3-7 5-10 0 4 3 5 4 8 2-2 3-4 3-6 4 4 5 7 5 10 0 4-4 7-9 7Z" />
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
      {paths[name] || paths.info}
    </svg>
  );
}

function ProgressBar({ value }) {
  const safe = clamp(value);

  return (
    <div
      className="dp-progress"
      role="progressbar"
      aria-label="Progres pencapaian"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function WeekSelector({ week, onChange, weeksWithData }) {
  return (
    <div className="dp-week-nav">
      <button
        type="button"
        disabled={week <= 1}
        onClick={() => onChange(week - 1)}
        aria-label="Minggu sebelumnya"
      >
        <Icon name="left" size={17} />
      </button>

      <select
        value={week}
        onChange={(event) =>
          onChange(Number(event.target.value))
        }
        aria-label="Pilih minggu OJT"
      >
        {Array.from(
          { length: TOTAL_WEEKS },
          (_, i) => i + 1
        ).map((number) => (
          <option key={number} value={number}>
            {weekLabel(number)}
            {weeksWithData.has(number)
              ? " · Ada catatan"
              : ""}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={week >= TOTAL_WEEKS}
        onClick={() => onChange(week + 1)}
        aria-label="Minggu berikutnya"
      >
        <Icon name="right" size={17} />
      </button>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="dp-empty">{children}</div>;
}

function Table({ columns, children }) {
  return (
    <div className="dp-table-wrap">
      <table className="dp-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="dp-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}


// ======================================================
// AKSES POST-TEST BERJADWAL (WITA)
// Link dan password tidak disimpan di kode browser.
// Keduanya diberikan oleh Edge Function posttest-access
// hanya pada tanggal ujian dan kepada Peserta aktif.
// ======================================================
const POST_TEST_DATES_FROM_EXCEL = ["2026-10-27", "2026-10-29", "2026-11-03", "2026-11-05", "2026-11-10", "2026-11-12", "2026-11-17", "2026-11-19", "2026-11-24", "2026-11-26", "2026-12-01", "2026-12-03"];

function PostTestAccess({ activity, programId, canAccess }) {
  const [dateNow, setDateNow] = useState(todayWITA());
  const [credentials, setCredentials] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refreshDate = () => setDateNow(todayWITA());
    refreshDate();
    const timer = window.setInterval(refreshDate, 30000);
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);

  // Sembunyikan kredensial jika halaman melewati tengah malam WITA
  // atau pengguna memilih jadwal berbeda.
  useEffect(() => {
    setCredentials(null);
    setMessage("");
  }, [dateNow, activity.start, programId]);

  if (normalizeType(activity.type) !== "posttest") return null;

  const date = activity.start;
  const known = activity.start === activity.end &&
    POST_TEST_DATES_FROM_EXCEL.includes(date);

  if (!known) {
    return (
      <p className="dp-posttest-note">
        Link dan password Post-Test belum tercantum pada data Excel.
      </p>
    );
  }

  if (dateNow !== date) {
    return (
      <p className="dp-posttest-note" role="status">
        {dateNow < date
          ? `Link dan password tersedia pada ${formatDate(date)}, pukul 00.00–23.59 WITA.`
          : "Masa akses link dan password Post-Test telah berakhir."}
      </p>
    );
  }

  if (!canAccess || !programId) {
    return (
      <p className="dp-posttest-note">
        Hanya Peserta OJT aktif yang dapat membuka link dan password.
        Admin Preview tidak membuka akses ujian.
      </p>
    );
  }

  async function showLink() {
    if (busy || dateNow !== date || !canAccess) return;
    setBusy(true);
    setMessage("");
    setCredentials(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "posttest-access",
        { body: { date, programId } }
      );
      if (error) {
        let detail = error.message || "Fungsi Post-Test tidak dapat dihubungi.";
        try {
          const responseData = await error.context?.json?.();
          if (responseData?.message) detail = responseData.message;
        } catch {}
        throw new Error(detail);
      }
      if (!data?.available) {
        throw new Error(
          data?.message || "Link belum tersedia pada tanggal ini."
        );
      }
      if (!/^https:\/\//.test(data.url || "") || !data.password) {
        throw new Error("Data link atau password Post-Test belum lengkap.");
      }
      setCredentials({
        url: data.url,
        password: String(data.password)
      });
    } catch (err) {
      setMessage(err?.message || "Tidak dapat membuka link Post-Test.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dp-posttest-box dp-no-print">
      <strong>Post-Test tersedia hari ini (WITA)</strong>
      <p className="dp-posttest-note">
        Klik tombol berikut untuk memperoleh link dan password.
      </p>
      {!credentials ? (
        <button
          type="button"
          className="dp-button"
          onClick={showLink}
          disabled={busy}
        >
          {busy ? "Memeriksa jadwal..." : "Tampilkan Link & Password"}
        </button>
      ) : (
        <div className="dp-posttest-credentials">
          <a
            className="dp-button"
            href={credentials.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Kerjakan Post-Test
          </a>
          <div className="dp-posttest-pass">
            <span>Password ujian:</span>
            <code>{credentials.password}</code>
          </div>
        </div>
      )}
      {message && <p className="dp-posttest-error" role="alert">{message}</p>}
    </div>
  );
}

function ActivityItem({ activity, programId, canAccessPostTest }) {
  return (
    <div className="dp-activity">
      <span className="dp-activity-icon">
        <Icon name={activity.icon} size={23} />
      </span>

      <div>
        <strong>{activity.title}</strong>

        <small>
          {activity.start === activity.end
            ? formatDate(activity.start)
            : `${formatShort(activity.start)} – ${formatDate(
                activity.end
              )}`}
          {" · "}
          {activity.type}
        </small>

        <details className="dp-schedule-detail">
          <summary>Materi</summary>
          <p>{activity.description}</p>
          <PostTestAccess
            activity={activity}
            programId={programId}
            canAccess={canAccessPostTest}
          />
        </details>
      </div>
    </div>
  );
}

function CategoryCards({ categories }) {
  return (
    <div className="dp-category-grid">
      {categories.map((item) => (
        <div className="dp-category" key={item.name}>
          <div className="dp-category-title">
            <Icon name={item.icon} size={21} />
            <strong>{item.name}</strong>
          </div>

          <h3>{Math.round(item.progress)}%</h3>

          <ProgressBar value={item.progress} />

          <small>
            {amountText(item.amount)} / {item.target}
            {item.name === "Fisik"
              ? " km"
              : " kegiatan"}
          </small>
        </div>
      ))}
    </div>
  );
}

// ======================================================
// RIWAYAT ACHIEVEMENT — REVISI DOKUMENTASI
//
// Komponen ini digunakan pada:
// 1. Achievement OJT > Lihat Riwayat
// 2. Monitoring Mingguan > Lihat Detail Data
// 3. Rapor & Evaluasi > Evaluasi Mingguan
//
// Semua tabel menggunakan perbaikan yang sama.
// ======================================================

function AchievementHistory({ records, types }) {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const [openingId, setOpeningId] = useState(null);
  const [fileError, setFileError] = useState("");

  const typeName = (record) =>
    types.find(
      (type) =>
        normalizeType(type.code) ===
        normalizeType(record.type_code)
    )?.name ||
    record.type_code ||
    "—";

  // ====================================================
  // BUKA BUKTI DOKUMENTASI
  //
  // Tautan Supabase Storage ditandatangani sementara.
  // Tidak menggunakan public URL untuk bucket privat.
  // ====================================================

  async function openAchievementEvidence(item, file) {
    if (!file?.path || openingId !== null) return;

    setOpeningId(item.id);
    setFileError("");

    // Buka tab pada interaksi klik untuk mengurangi
    // risiko pemblokiran popup pada browser mobile.
    const tab = window.open("about:blank", "_blank");

    try {
      const {
        data,
        error: signedError,
      } = await supabase.storage
        .from(ACHIEVEMENT_BUCKET)
        .createSignedUrl(file.path, 600);

      if (signedError) {
        throw signedError;
      }

      const url = data?.signedUrl;

      if (
        !url ||
        !/^https?:\/\//i.test(url)
      ) {
        throw new Error(
          "Tautan dokumentasi tidak tersedia atau tidak valid."
        );
      }

      if (!tab || tab.closed) {
        throw new Error(
          "Browser memblokir tab dokumentasi. " +
          "Izinkan popup untuk membuka bukti."
        );
      }

      tab.location.replace(url);
    } catch (err) {
      if (tab && !tab.closed) {
        tab.close();
      }

      setFileError(
        `Dokumentasi gagal dibuka: ${
          err?.message || "File tidak tersedia."
        }`
      );
    } finally {
      setOpeningId(null);
    }
  }

  const visible = records
    .filter(
      (record) =>
        (category === "all" ||
          normalizeType(record.type_code) ===
            normalizeType(category)) &&
        (status === "all" ||
          normalize(record.status) === status)
    )
    .slice()
    .sort((a, b) =>
      String(b.activity_date || "").localeCompare(
        String(a.activity_date || "")
      )
    );

  return (
    <div className="dp-history">
      <div className="dp-filter-row dp-no-print">
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
          aria-label="Filter kategori"
        >
          <option value="all">
            Semua kategori
          </option>

          {types.map((type) => (
            <option
              key={type.code}
              value={type.code}
            >
              {type.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
          aria-label="Filter status"
        >
          <option value="all">
            Semua status
          </option>
          <option value="verified">
            Verified
          </option>
          <option value="pending">
            Pending
          </option>
        </select>
      </div>

      {fileError && (
        <div
          className="dp-alert error dp-no-print"
          role="alert"
        >
          {fileError}
        </div>
      )}

      <Table
        columns={[
          "Tanggal",
          "Kategori",
          "Kegiatan",
          "Realisasi",
          "Status",
        ]}
      >
        {visible.length ? (
          visible.map((item) => {
            const name = typeName(item);

            const fisik =
              normalizeType(name) === "fisik" ||
              normalizeType(item.type_code) === "fisik";

            // ==================================================
            // PERBAIKAN UTAMA:
            // Jangan gunakan item.description secara langsung.
            // ==================================================

            const achievementDetail =
              parseAchievementDescription(
                item.description
              );

            const cleanDescription =
              achievementDetail.description;

            const evidenceFile =
              achievementDetail.file;

            return (
              <tr key={item.id}>
                <td className="dp-nowrap">
                  {formatDate(item.activity_date)}
                </td>

                <td>{name}</td>

                <td className="dp-description">
                  <div className="dp-achievement-description">
                    {cleanDescription || "—"}
                  </div>

                  {evidenceFile && (
                    <div className="dp-evidence">
                      <div className="dp-evidence-name">
                        <span aria-hidden="true">📎</span>
                        <span>
                          {evidenceFile.name}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="dp-evidence-button dp-no-print"
                        disabled={openingId !== null}
                        onClick={() =>
                          openAchievementEvidence(
                            item,
                            evidenceFile
                          )
                        }
                        title={`Buka ${evidenceFile.name}`}
                      >
                        {openingId === item.id
                          ? "Membuka..."
                          : "Lihat Bukti"}
                      </button>
                    </div>
                  )}
                </td>

                <td className="dp-nowrap">
                  {fisik
                    ? item.distance_km == null ||
                      item.distance_km === ""
                      ? "—"
                      : `${amountText(
                          item.distance_km
                        )} km`
                    : "1 kegiatan"}
                </td>

                <td>
                  <span
                    className={`dp-badge ${
                      normalize(item.status) ===
                      "verified"
                        ? "verified"
                        : "pending"
                    }`}
                  >
                    {normalize(item.status) ===
                    "verified"
                      ? "Verified"
                      : normalize(item.status) ===
                        "pending"
                      ? "Pending"
                      : item.status || "—"}
                  </span>
                </td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={5}>
              Belum ada data sesuai filter.
            </td>
          </tr>
        )}
      </Table>
    </div>
  );
}

function ScoreTable({ records, practice = false }) {
  const sorted = records.slice().sort((a, b) =>
    String(
      practice ? b.practice_date : b.test_date
    ).localeCompare(
      String(
        practice ? a.practice_date : a.test_date
      )
    )
  );

  return (
    <Table
      columns={["Tanggal", "Kegiatan", "Nilai"]}
    >
      {sorted.length ? (
        sorted.map((item) => (
          <tr key={item.id}>
            <td className="dp-nowrap">
              {formatDate(
                practice
                  ? item.practice_date
                  : item.test_date
              )}
            </td>

            <td className="dp-description">
              {practice
                ? item.practice_name || "Praktik OJT"
                : item.notes || "Post-Test"}
            </td>

            <td>
              <strong>
                {scoreText(item.score)}
              </strong>
            </td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan={3}>
            Belum ada nilai.
          </td>
        </tr>
      )}
    </Table>
  );
}

// ======================================================
// DASHBOARD
// ======================================================

export default function DashboardPeserta() {
  const router = useRouter();

  const [theme, setTheme] = useState("light");

  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [
    selectedParticipantId,
    setSelectedParticipantId,
  ] = useState("");

  const [access, setAccess] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [inputError, setInputError] = useState("");

  // Form pengisian Achievement secara mandiri.
  const [ownCategory, setOwnCategory] = useState("");
  const [ownDate, setOwnDate] = useState(todayWITA());
  const [ownDescription, setOwnDescription] = useState("");
  const [ownDistance, setOwnDistance] = useState("");
  const [ownFile, setOwnFile] = useState(null);
  const [ownSaving, setOwnSaving] = useState(false);
  const [ownMessage, setOwnMessage] = useState("");
  const ownFileInputRef = useRef(null);
  const [error, setError] = useState("");

  const [progress, setProgress] = useState(
    emptyProgress()
  );

  const [weeklyData, setWeeklyData] = useState(
    emptyWeeklyData()
  );

  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [page, setPage] = useState("dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);

  const [resultTab, setResultTab] = useState("posttest");
  const [reportTab, setReportTab] = useState("evaluasi");

  const [monitorDetail, setMonitorDetail] =
    useState(false);

  const [
    achievementHistory,
    setAchievementHistory,
  ] = useState(false);

  const currentWeekRef = useRef(1);
  const requestIdRef = useRef(0);
  const selectedIdRef = useRef("");
  const restoredViewRef = useRef(false);

  const isAdmin = normalize(account?.role) === "admin";

  const hasActiveProgram =
    access === "approved" &&
    Boolean(program?.id) &&
    Boolean(profile);

  const canInputOwnData =
    !isAdmin &&
    isParticipantRole(account?.role) &&
    hasActiveProgram &&
    program?.participant_id === account?.id;

  const ownAvailableTypes = weeklyData.types.filter((type) =>
    TARGETS.some((target) => normalizeType(target.name) === normalizeType(type.name))
  );
  const ownSelectedType =
    ownAvailableTypes.find((type) => type.code === ownCategory) ||
    ownAvailableTypes[0] ||
    null;


  // ====================================================
  // THEME
  // ====================================================

  useEffect(() => {
    const readTheme = () => {
      setTheme(
        document.documentElement.getAttribute(
          "data-theme"
        ) === "dark"
          ? "dark"
          : "light"
      );
    };

    readTheme();

    const observer = new MutationObserver(readTheme);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  function toggleTheme() {
    const next =
      theme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute(
      "data-theme",
      next
    );

    document.documentElement.style.colorScheme =
      next;

    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Tema tetap diterapkan.
    }

    setTheme(next);
  }

  // ====================================================
  // MINGGU WITA
  // ====================================================

  useEffect(() => {
    const initial = getCurrentGlobalWeek();

    currentWeekRef.current = initial;
    setCurrentWeek(initial);

    const syncWeek = () => {
      const latest = getCurrentGlobalWeek();

      if (latest !== currentWeekRef.current) {
        currentWeekRef.current = latest;
        setCurrentWeek(latest);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncWeek();
      }
    };

    window.addEventListener("focus", syncWeek);

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    const interval = window.setInterval(
      syncWeek,
      60000
    );

    return () => {
      window.removeEventListener("focus", syncWeek);

      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );

      window.clearInterval(interval);
    };
  }, []);

  // ====================================================
  // SIMPAN TAMPILAN PER AKUN
  // ====================================================

  useEffect(() => {
    if (
      !account?.id ||
      loading ||
      refreshing ||
      error ||
      !restoredViewRef.current
    ) {
      return;
    }

    try {
      sessionStorage.setItem(
        viewStorageKey(account.id),
        JSON.stringify({
          participantId: isAdmin
            ? selectedParticipantId
            : "",
          page,
          week: selectedWeek,
          resultTab,
          reportTab,
          monitorDetail,
          achievementHistory,
        })
      );
    } catch {
      // Tidak memengaruhi akses atau data.
    }
  }, [
    account?.id,
    isAdmin,
    selectedParticipantId,
    page,
    selectedWeek,
    resultTab,
    reportTab,
    monitorDetail,
    achievementHistory,
    loading,
    refreshing,
    error,
  ]);

  // ====================================================
  // FETCH PESERTA PREVIEW ADMIN
  // ====================================================

  async function fetchParticipantList() {
    const {
      data,
      error: listError,
    } = await supabase
      .from("ojt_programs")
      .select(`
        participant_id,
        site,
        peserta:profiles!ojt_programs_participant_id_fkey(
          id,full_name,department,role
        )
      `)
      .eq("status", "active");

    if (listError) throw listError;

    const unique = new Map();

    (data || []).forEach((item) => {
      if (!item.participant_id) return;

      const peserta = Array.isArray(item.peserta)
        ? item.peserta[0]
        : item.peserta;

      if (
        !peserta ||
        !isParticipantRole(peserta.role)
      ) {
        return;
      }

      if (!unique.has(item.participant_id)) {
        unique.set(item.participant_id, {
          id: item.participant_id,
          full_name:
            peserta.full_name || "Peserta OJT",
          department: peserta.department || "",
          site: item.site || "",
          role: normalize(peserta.role),
        });
      }
    });

    return [...unique.values()].sort((a, b) =>
      a.full_name.localeCompare(b.full_name)
    );
  }

  // ====================================================
  // FETCH DATA
  // ====================================================

  async function fetchProgramProgress(activeProgram) {
    if (!activeProgram?.id) {
      return {
        progress: emptyProgress(),
        weekly: emptyWeeklyData(),
      };
    }

    const id = activeProgram.id;

    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,status,activity_date,distance_km,description"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select(
          "id,program_id,test_date,score,notes"
        )
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,program_id,practice_date,practice_name,score"
        )
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,program_id,test_date,test_type,outcome,result_value,score"
        )
        .eq("program_id", id),

      supabase
        .from("simper_records")
        .select(
          "id,program_id,theory_status,practice_status,status,notes"
        )
        .eq("program_id", id),
    ]);

    const labels = [
      "Kategori Achievement",
      "Achievement",
      "Post-Test",
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

    const data = {
      types: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practices: results[3].data || [],
      samapta: results[4].data || [],
      simper: results[5].data || [],
    };

    return {
      progress: buildProgress(activeProgram, data),
      weekly: {
        types: data.types,
        achievements: data.achievements,
        postTests: data.postTests,
        practices: data.practices,
        samapta: data.samapta,
      },
    };
  }

  // ====================================================
  // PROFIL & APPROVAL — LOGIKA ASAL
  // ====================================================

  async function fetchParticipantDashboard(
    participantId,
    adminPreview = false,
    previewParticipants = []
  ) {
    let currentProfile = null;

    if (adminPreview) {
      const selected = previewParticipants.find(
        (item) =>
          item.id === participantId &&
          isParticipantRole(item.role)
      );

      if (!selected) {
        throw new Error(
          "Peserta tidak tersedia dalam daftar preview."
        );
      }

      currentProfile = {
        id: selected.id,
        full_name: selected.full_name,
        department: selected.department,
        role: selected.role,
      };
    } else {
      const {
        data,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,department,role")
        .eq("id", participantId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        throw new Error(
          "Profil peserta tidak tersedia."
        );
      }

      if (!isParticipantRole(data.role)) {
        throw new Error(
          "Akun tidak terdaftar sebagai Peserta OJT."
        );
      }

      currentProfile = data;
    }

    const {
      data: activePrograms,
      error: programError,
    } = await supabase
      .from("ojt_programs")
      .select(
        "id,participant_id,start_date,end_date,status,site,legacy_access"
      )
      .eq("participant_id", participantId)
      .eq("status", "active")
      .order("start_date", {
        ascending: false,
      })
      .limit(1);

    if (programError) throw programError;

    const activeProgram =
      activePrograms?.[0] || null;

    if (adminPreview) {
      const bundle = activeProgram
        ? await fetchProgramProgress(activeProgram)
        : {
            progress: emptyProgress(),
            weekly: emptyWeeklyData(),
          };

      return {
        profile: currentProfile,
        registration: null,
        program: activeProgram,
        access: activeProgram
          ? "approved"
          : "no_program",
        progress: bundle.progress,
        weekly: bundle.weekly,
      };
    }

    const {
      data: newRequests,
      error: newError,
    } = await supabase
      .from("ojt_registration_requests")
      .select(
        "id,status,rejection_reason,site,start_date,end_date,created_at"
      )
      .eq("participant_id", participantId)
      .order("created_at", {
        ascending: false,
      });

    if (newError) throw newError;

    const {
      data: oldRequests,
      error: oldError,
    } = await supabase
      .from("participant_registrations")
      .select(
        "id,status,rejection_reason,site,created_at"
      )
      .eq("user_id", participantId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1);

    if (oldError) throw oldError;

    const newList = newRequests || [];
    const oldRegistration =
      oldRequests?.[0] || null;

    const latestNew = newList[0] || null;

    const latestRegistration =
      latestNew && oldRegistration
        ? new Date(latestNew.created_at || 0) >=
          new Date(oldRegistration.created_at || 0)
          ? latestNew
          : oldRegistration
        : latestNew || oldRegistration;

    const hasPendingNew = newList.some(
      (item) =>
        normalize(item.status) === "pending"
    );

    const hasApprovedNew = newList.some(
      (item) =>
        normalize(item.status) === "approved"
    );

    const hasApprovedOld =
      normalize(oldRegistration?.status) ===
      "approved";

    const hasPendingOld =
      normalize(oldRegistration?.status) ===
      "pending";

    const approvedProgram =
      Boolean(activeProgram) &&
      (
        hasApprovedNew ||
        hasApprovedOld ||
        activeProgram.legacy_access === true
      );

    let nextAccess = "no_program";

    if (approvedProgram) {
      nextAccess = "approved";
    } else if (hasPendingNew || hasPendingOld) {
      nextAccess = "pending";
    } else if (
      normalize(latestRegistration?.status) ===
      "rejected"
    ) {
      nextAccess = "rejected";
    }

    const bundle =
      nextAccess === "approved"
        ? await fetchProgramProgress(activeProgram)
        : {
            progress: emptyProgress(),
            weekly: emptyWeeklyData(),
          };

    return {
      profile: currentProfile,
      registration:
        latestRegistration || null,
      program:
        nextAccess === "approved"
          ? activeProgram
          : null,
      access: nextAccess,
      progress: bundle.progress,
      weekly: bundle.weekly,
    };
  }

  function clearDashboard() {
    setProfile(null);
    setProgram(null);
    setRegistration(null);
    setProgress(emptyProgress());
    setWeeklyData(emptyWeeklyData());
    setAccess("loading");
  }

  function applyDashboard(data) {
    setProfile(data.profile);
    setRegistration(data.registration);
    setProgram(data.program);

    setProgress(
      data.progress || emptyProgress()
    );

    setWeeklyData(
      data.weekly || emptyWeeklyData()
    );

    setAccess(data.access);
  }

  // ====================================================
  // LOAD & RESTORE
  // ====================================================

  async function loadDashboard(isRefresh = false) {
    const requestId = ++requestIdRef.current;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      clearDashboard();
    }

    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (authError || !user) {
        setAccount(null);
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";
        clearDashboard();

        router.replace("/login");
        return;
      }

      const {
        data: currentAccount,
        error: accountError,
      } = await supabase
        .from("profiles")
        .select(
          "id,full_name,department,role"
        )
        .eq("id", user.id)
        .maybeSingle();

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (accountError) throw accountError;

      if (!currentAccount) {
        throw new Error(
          "Profil akun tidak tersedia."
        );
      }

      const role = normalize(
        currentAccount.role
      );

      if (role === "mentor") {
        setAccount(null);
        clearDashboard();
        router.replace("/");
        return;
      }

      if (
        role !== "admin" &&
        !isParticipantRole(role)
      ) {
        throw new Error(
          "Akun tidak memiliki akses Dashboard Peserta."
        );
      }

      const saved = readSavedView(user.id);

      if (!restoredViewRef.current) {
        const params = new URLSearchParams(
          window.location.search
        );

        const savedPage =
          params.get("page") || saved.page;

        const savedWeek =
          params.get("week") || saved.week;

        setPage(
          validPage(savedPage)
            ? savedPage
            : "dashboard"
        );

        setSelectedWeek(
          validWeek(savedWeek)
            ? Number(savedWeek)
            : getCurrentGlobalWeek()
        );

        setResultTab(
          saved.resultTab === "praktik"
            ? "praktik"
            : "posttest"
        );

        setReportTab(
          saved.reportTab === "rapor"
            ? "rapor"
            : "evaluasi"
        );

        setMonitorDetail(
          saved.monitorDetail === true
        );

        setAchievementHistory(
          saved.achievementHistory === true
        );

        if (role === "admin") {
          const requested =
            params.get("participant") ??
            saved.participantId ??
            "";

          selectedIdRef.current =
            typeof requested === "string"
              ? requested
              : "";
        }

        restoredViewRef.current = true;
      }

      setAccount({
        ...currentAccount,
        role,
        email: user.email || "",
      });

      const latestWeek =
        getCurrentGlobalWeek();

      currentWeekRef.current = latestWeek;
      setCurrentWeek(latestWeek);

      if (role === "admin") {
        const list =
          await fetchParticipantList();

        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        setParticipants(list);

        const requestedId =
          selectedIdRef.current;

        const selected = list.find(
          (item) => item.id === requestedId
        );

        // Jangan pindah ke peserta lain otomatis.
        if (!selected) {
          selectedIdRef.current = "";
          setSelectedParticipantId("");
          clearDashboard();
          setAccess("no_program");
          return;
        }

        setSelectedParticipantId(
          selected.id
        );

        const next =
          await fetchParticipantDashboard(
            selected.id,
            true,
            list
          );

        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        applyDashboard(next);
      } else {
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";

        const next =
          await fetchParticipantDashboard(
            user.id,
            false
          );

        if (
          requestId !== requestIdRef.current
        ) {
          return;
        }

        applyDashboard(next);
      }
    } catch (err) {
      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      clearDashboard();

      setError(
        err?.message ||
          "Gagal memuat Dashboard Peserta."
      );

      setAccess("error");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard();

    return () => {
      requestIdRef.current += 1;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ====================================================
  // ADMIN PREVIEW
  // ====================================================

  async function changePreviewParticipant(id) {
    if (
      !isAdmin ||
      loading ||
      refreshing
    ) {
      return;
    }

    const requestId =
      ++requestIdRef.current;

    selectedIdRef.current = id;
    setSelectedParticipantId(id);
    setRefreshing(true);
    setError("");
    setMonitorDetail(false);
    setAchievementHistory(false);
    clearDashboard();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (authError || !user) {
        setAccount(null);
        router.replace("/login");
        return;
      }

      if (user.id !== account?.id) {
        throw new Error(
          "Akun login berubah. Silakan muat ulang halaman."
        );
      }

      const {
        data: verifiedAccount,
        error: accountError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      if (accountError) throw accountError;

      if (
        normalize(verifiedAccount?.role) !==
        "admin"
      ) {
        throw new Error(
          "Hanya Admin yang dapat menggunakan tinjauan peserta."
        );
      }

      if (!id) {
        setAccess("no_program");
        return;
      }

      const list =
        await fetchParticipantList();

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      setParticipants(list);

      const selected = list.find(
        (item) =>
          item.id === id &&
          isParticipantRole(item.role)
      );

      if (!selected) {
        throw new Error(
          "Peserta tidak ditemukan."
        );
      }

      const next =
        await fetchParticipantDashboard(
          id,
          true,
          list
        );

      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      applyDashboard(next);
    } catch (err) {
      if (
        requestId !== requestIdRef.current
      ) {
        return;
      }

      clearDashboard();

      setError(
        err?.message ||
          "Gagal mengganti peserta tinjauan."
      );

      setAccess("error");
    } finally {
      if (
        requestId === requestIdRef.current
      ) {
        setRefreshing(false);
      }
    }
  }

  // ====================================================
  // LOGOUT & NAVIGATION
  // ====================================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    requestIdRef.current += 1;

    try {
      const {
        error: logoutError,
      } = await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      try {
        if (account?.id) {
          sessionStorage.removeItem(
            viewStorageKey(account.id)
          );
        }
      } catch {}

      setAccount(null);
      setParticipants([]);
      setSelectedParticipantId("");
      selectedIdRef.current = "";
      clearDashboard();

      router.replace("/login");
      router.refresh();
    } catch {
      setError(
        "Gagal keluar. Silakan coba kembali."
      );

      setLoggingOut(false);
    }
  }

  function navigatePage(nextPage) {
    if (!validPage(nextPage)) return;

    if (nextPage === "dashboard") {
      const latest =
        getCurrentGlobalWeek();

      currentWeekRef.current = latest;
      setCurrentWeek(latest);
    }

    setPage(nextPage);
    setMobileMenu(false);

    const url = new URL(
      window.location.href
    );

    url.searchParams.delete("page");
    url.searchParams.delete("week");
    url.searchParams.delete("participant");

    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // Akses pengisian hanya untuk program sendiri. Admin Preview tetap baca-saja.
  // Aturan Supabase RLS dan izin di halaman tujuan wajib tetap memeriksa identitas.
  async function openOwnInput(kind) {
    const item = INPUT_MENUS.find((entry) => entry.id === kind);
    if (!item || !canInputOwnData || openingInput) return;

    // Achievement tersedia langsung di dashboard, tanpa halaman Mentor.
    if (kind === "achievement") {
      setOwnMessage("");
      navigatePage("achievement");
      return;
    }

    setInputError("");
    setOpeningInput(kind);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const user = authData?.user;
      if (authError || !user || user.id !== account?.id) {
        throw new Error("Sesi akun berubah. Silakan login ulang.");
      }

      // Pastikan ID program yang akan dibuka adalah milik Peserta aktif ini.
      const { data: ownProgram, error: programError } = await supabase
        .from("ojt_programs")
        .select("id")
        .eq("id", program.id)
        .eq("participant_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (programError) throw programError;
      if (!ownProgram?.id) {
        throw new Error("Program OJT aktif milik akun ini tidak ditemukan.");
      }

      // Simpan posisi dashboard sebelum pindah ke halaman input.
      try {
        sessionStorage.setItem(
          viewStorageKey(user.id),
          JSON.stringify({
            participantId: "",
            page,
            week: selectedWeek,
            resultTab,
            reportTab,
            monitorDetail,
            achievementHistory,
          })
        );
      } catch {}

      router.push(item.route(ownProgram.id));
    } catch (err) {
      setInputError(err?.message || "Halaman input gagal dibuka.");
      setOpeningInput("");
    }
  }

  // Simpan ke tabel yang sama agar rekap dan webhook Drive tetap dapat bekerja.
  // Semua hasil input peserta otomatis PENDING, verifikasi tetap dilakukan Mentor.
  async function saveOwnAchievement(event) {
    event.preventDefault();
    if (!canInputOwnData || ownSaving) return;

    setInputError("");
    setOwnMessage("");

    const selectedCode = ownSelectedType?.code || "";
    const selectedType = ownSelectedType;
    const isFisik = normalizeType(selectedType?.name) === "fisik";
    const distance = Number(ownDistance);

    if (!selectedType || !TARGETS.some((target) => normalizeType(target.name) === normalizeType(selectedType.name))) {
      setInputError("Kategori Achievement tidak valid.");
      return;
    }
    if (!parseDate(ownDate) || globalWeekOf(ownDate) === null || weekOf(ownDate, program.start_date) === null) {
      setInputError("Tanggal harus berada dalam periode 25 minggu OJT.");
      return;
    }
    if (!ownDescription.trim()) {
      setInputError("Deskripsi kegiatan wajib diisi.");
      return;
    }
    if (isFisik && (!Number.isFinite(distance) || distance <= 0 || distance > 100)) {
      setInputError("Jarak Fisik harus lebih dari 0 sampai 100 km.");
      return;
    }
    if (ownFile && (ownFile.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(ownFile.type))) {
      setInputError("Dokumentasi harus JPG, PNG, WEBP, atau PDF dan maksimal 5 MB.");
      return;
    }

    setOwnSaving(true);
    let uploadedPath = "";
    let createdRecord = false;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user || authData.user.id !== account.id) {
        throw new Error("Sesi peserta tidak valid. Silakan login ulang.");
      }

      const { data: ownProgram, error: ownProgramError } = await supabase
        .from("ojt_programs")
        .select("id")
        .eq("id", program.id)
        .eq("participant_id", authData.user.id)
        .eq("status", "active")
        .maybeSingle();
      if (ownProgramError) throw ownProgramError;
      if (!ownProgram?.id) throw new Error("Program aktif milik peserta tidak ditemukan.");

      let description = ownDescription.trim();
      if (ownFile) {
        const safeFileName = ownFile.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-90) || "dokumentasi";
        const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
        uploadedPath = `${program.id}/${authData.user.id}/${uniqueId}-${safeFileName}`;
        const { error: uploadError } = await supabase.storage
          .from(ACHIEVEMENT_BUCKET)
          .upload(uploadedPath, ownFile, { upsert: false, contentType: ownFile.type });
        if (uploadError) throw new Error(`Gagal upload dokumentasi: ${uploadError.message}`);
        description += `
[[OJT_FILE_V1:${encodeURIComponent(JSON.stringify({ name: ownFile.name, path: uploadedPath }))}]]`;
      }

      const { data: saved, error: insertError } = await supabase
        .from("achievement_records")
        .insert({
          program_id: ownProgram.id,
          type_code: selectedCode,
          activity_date: ownDate,
          description,
          distance_km: isFisik ? Number(distance.toFixed(3)) : null,
          status: "pending",
          verified_by: null,
        })
        .select("id");

      if (insertError || !saved?.length) {
        throw insertError || new Error("Data kegiatan tidak berhasil disimpan.");
      }
      createdRecord = true;

      const refreshed = await fetchProgramProgress(program);
      setProgress(refreshed.progress);
      setWeeklyData(refreshed.weekly);
      setOwnDescription("");
      setOwnDistance("");
      setOwnFile(null);
      if (ownFileInputRef.current) ownFileInputRef.current.value = "";
      setAchievementHistory(true);
      setOwnMessage("Achievement berhasil dikirim dengan status Pending. Menunggu verifikasi Mentor.");
    } catch (err) {
      // Berusaha bersihkan file jika record belum berhasil dibuat.
      // Jika cleanup ditolak oleh policy, file tetap aman pada Storage.
      if (uploadedPath && !createdRecord) {
        try { await supabase.storage.from(ACHIEVEMENT_BUCKET).remove([uploadedPath]); } catch {}
      }
      setInputError(err?.message || "Gagal menyimpan Achievement.");
    } finally {
      setOwnSaving(false);
    }
  }

  function openFeature(path) {
    if (
      !hasActiveProgram ||
      !path
    ) {
      return;
    }

    try {
      sessionStorage.setItem(
        viewStorageKey(account.id),
        JSON.stringify({
          participantId: isAdmin
            ? selectedParticipantId
            : "",
          page,
          week: selectedWeek,
          resultTab,
          reportTab,
          monitorDetail,
          achievementHistory,
        })
      );
    } catch {}

    router.push(path);
  }

  // ====================================================
  // DATA TAMPILAN — KALENDER GLOBAL
  // ====================================================

  function getWeekRecords(weekNumber) {
    const achievements =
      weeklyData.achievements.filter(
        (item) =>
          globalWeekOf(item.activity_date) ===
          weekNumber
      );

    const postTests =
      weeklyData.postTests.filter(
        (item) =>
          globalWeekOf(item.test_date) ===
          weekNumber
      );

    const practices =
      weeklyData.practices.filter(
        (item) =>
          globalWeekOf(item.practice_date) ===
          weekNumber
      );

    const samapta =
      weeklyData.samapta.filter(
        (item) =>
          globalWeekOf(item.test_date) ===
          weekNumber
      );

    return {
      achievements,
      postTests,
      practices,
      samapta,
      total:
        achievements.length +
        postTests.length +
        practices.length +
        samapta.length,
      verifiedAchievements:
        achievements.filter(
          (item) =>
            normalize(item.status) ===
            "verified"
        ).length,
      pendingAchievements:
        achievements.filter(
          (item) =>
            normalize(item.status) ===
            "pending"
        ).length,
      average: averageScores([
        ...postTests,
        ...practices,
      ]),
    };
  }

  const dashboardWeekInfo =
    getGlobalWeek(currentWeek);

  const selectedWeekInfo =
    getGlobalWeek(selectedWeek);

  const dashboardSchedule =
    WEEKLY_SCHEDULE.filter(
      (item) =>
        item.week === currentWeek
    );

  const selectedSchedule =
    WEEKLY_SCHEDULE.filter(
      (item) =>
        item.week === selectedWeek
    );

  const dashboardWeekly =
    getWeekRecords(currentWeek);

  const selectedWeekly =
    getWeekRecords(selectedWeek);

  const weeksWithData = new Set();

  if (hasActiveProgram) {
    const mark = (date) => {
      const number = globalWeekOf(date);

      if (number !== null) {
        weeksWithData.add(number);
      }
    };

    weeklyData.achievements.forEach(
      (item) => mark(item.activity_date)
    );

    weeklyData.postTests.forEach(
      (item) => mark(item.test_date)
    );

    weeklyData.practices.forEach(
      (item) => mark(item.practice_date)
    );

    weeklyData.samapta.forEach(
      (item) => mark(item.test_date)
    );
  }

  const categories = progress.categories.length
    ? progress.categories
    : TARGETS.map((item) => ({
        ...item,
        amount: 0,
        progress: 0,
        completed: false,
      }));

  const weeklyAchievement =
    calculateAchievements(
      selectedWeekly.achievements,
      weeklyData.types,
      program?.start_date
    );

  const weeklyCategories =
    weeklyAchievement.categories.map(
      (item) => {
        const type = weeklyData.types.find(
          (entry) =>
            normalizeType(entry.name) ===
            normalizeType(item.name)
        );

        const matching = type
          ? selectedWeekly.achievements.filter(
              (record) =>
                normalizeType(
                  record.type_code
                ) ===
                normalizeType(type.code)
            )
          : [];

        return {
          ...item,
          total: matching.length,
          verified: matching.filter(
            (record) =>
              normalize(record.status) ===
              "verified"
          ).length,
          pending: matching.filter(
            (record) =>
              normalize(record.status) ===
              "pending"
          ).length,
        };
      }
    );

  const allScores = [
    ...weeklyData.postTests,
    ...weeklyData.practices,
  ];

  const overallScore =
    averageScores(allScores);

  const participantName =
    profile?.full_name ||
    (
      isAdmin
        ? "Pilih peserta"
        : account?.full_name
    ) ||
    "Peserta OJT";

  const showContent =
    !loading &&
    !refreshing &&
    !error &&
    hasActiveProgram;

  // ====================================================
  // MONITORING DALAM DASHBOARD
  // ====================================================

  function renderWeeklyReport() {
    return (
      <section className="dp-panel">
        <div className="dp-section-head">
          <h2>Monitoring Mingguan</h2>

          <WeekSelector
            week={selectedWeek}
            onChange={setSelectedWeek}
            weeksWithData={weeksWithData}
          />
        </div>

        <div className="dp-week-info">
          <strong>
            {weekLabel(selectedWeek)}
          </strong>

          <span>
            {formatDate(selectedWeekInfo?.start)}
            {" – "}
            {formatDate(selectedWeekInfo?.end)}
          </span>
        </div>

        <div className="dp-stat-grid four">
          <Stat
            label="Achievement"
            value={
              selectedWeekly.achievements.length
            }
          />

          <Stat
            label="Post-Test · Rata-rata"
            value={scoreText(
              averageScores(
                selectedWeekly.postTests
              )
            )}
          />

          <Stat
            label="Praktik · Rata-rata"
            value={scoreText(
              averageScores(
                selectedWeekly.practices
              )
            )}
          />

          <Stat
            label="Catatan Samapta"
            value={
              selectedWeekly.samapta.length
            }
          />
        </div>

        <Table
          columns={[
            "Kategori",
            "Realisasi / Target",
            "Verified",
            "Pending",
            "Progres",
          ]}
        >
          {weeklyCategories.map((item) => (
            <tr key={item.name}>
              <td>
                <strong>
                  {item.name}
                </strong>
              </td>

              <td>
                {amountText(item.amount)} /{" "}
                {item.target}
                {item.name === "Fisik"
                  ? " km"
                  : " kegiatan"}
              </td>

              <td>{item.verified}</td>
              <td>{item.pending}</td>

              <td className="dp-progress-cell">
                {Math.round(item.progress)}%

                <ProgressBar
                  value={item.progress}
                />
              </td>
            </tr>
          ))}
        </Table>

        <div className="dp-inline-summary">
          <span>
            Total:{" "}
            <strong>
              {selectedWeekly.achievements.length}
            </strong>
          </span>

          <span>
            Verified:{" "}
            <strong>
              {selectedWeekly.verifiedAchievements}
            </strong>
          </span>

          <span>
            Pending:{" "}
            <strong>
              {selectedWeekly.pendingAchievements}
            </strong>
          </span>
        </div>

        <div className="dp-buttons dp-no-print">
          <button
            type="button"
            className="dp-button"
            aria-expanded={monitorDetail}
            onClick={() =>
              setMonitorDetail(
                (old) => !old
              )
            }
          >
            {monitorDetail
              ? "Tutup Detail"
              : "Lihat Detail Data"}
          </button>

          <button
            type="button"
            className="dp-button secondary"
            onClick={() =>
              window.print()
            }
          >
            Cetak / Simpan PDF
          </button>
        </div>

        {monitorDetail && (
          <div className="dp-detail-stack">
            <section>
              <h3>
                Riwayat Achievement
              </h3>

              <AchievementHistory
                key={`weekly-${program.id}-${selectedWeek}`}
                records={
                  selectedWeekly.achievements
                }
                types={
                  weeklyData.types
                }
              />
            </section>

            <section>
              <h3>Post-Test</h3>

              <ScoreTable
                records={
                  selectedWeekly.postTests
                }
              />
            </section>

            <section>
              <h3>Praktik</h3>

              <ScoreTable
                records={
                  selectedWeekly.practices
                }
                practice
              />
            </section>

            <section>
              <h3>Samapta</h3>

              <Table
                columns={[
                  "Tanggal",
                  "Periode",
                  "Jenis Tes",
                  "Hasil",
                  "Nilai",
                ]}
              >
                {selectedWeekly.samapta.length
                  ? selectedWeekly.samapta.map(
                      (item) => (
                        <tr key={item.id}>
                          <td className="dp-nowrap">
                            {formatDate(
                              item.test_date
                            )}
                          </td>

                          <td>
                            {item.test_type || "—"}
                          </td>

                          <td>
                            {item.outcome || "—"}
                          </td>

                          <td>
                            {scoreText(
                              item.result_value
                            )}
                          </td>

                          <td>
                            {scoreText(
                              item.score
                            )}
                          </td>
                        </tr>
                      )
                    )
                  : (
                    <tr>
                      <td colSpan={5}>
                        Belum ada hasil Samapta.
                      </td>
                    </tr>
                  )}
              </Table>
            </section>
          </div>
        )}
      </section>
    );
  }

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="dp-app">
      <style>{dashboardCSS}</style>

      <header className="dp-topbar">
        <button
          type="button"
          className="dp-mobile-trigger"
          onClick={() =>
            setMobileMenu(
              (old) => !old
            )
          }
          aria-label={
            mobileMenu
              ? "Tutup menu"
              : "Buka menu"
          }
          aria-expanded={mobileMenu}
        >
          <Icon
            name={
              mobileMenu
                ? "close"
                : "menu"
            }
            size={23}
          />
        </button>

        <button
          type="button"
          className="dp-brand"
          onClick={() =>
            navigatePage("dashboard")
          }
        >
          OJT <span>MineTrack</span>{" "}
          <small>v2.0</small>
        </button>

        <span className="dp-top-description">
          Emergency Response & Safety System
        </span>

        <div className="dp-user">
          <span className="dp-avatar">
            {initials(
              account?.full_name
            )}
          </span>

          <div>
            <strong>
              {account?.full_name ||
                "Pengguna"}
            </strong>

            <small>
              {isAdmin
                ? "Administrator"
                : "Peserta OJT"}
            </small>
          </div>
        </div>
      </header>

      <div className="dp-layout">
        <aside
          className={`dp-sidebar ${
            mobileMenu ? "open" : ""
          }`}
        >
          <div className="dp-sidebar-brand">
            <div>⛰</div>

            <strong>
              OJT <span>MineTrack</span>{" "}
              <small>v2.0</small>
            </strong>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>
          </div>

          <small className="dp-menu-label">
            MENU PESERTA
          </small>

          <nav>
            {MENUS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`dp-menu ${
                  page === item.id
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  navigatePage(item.id)
                }
                aria-current={
                  page === item.id
                    ? "page"
                    : undefined
                }
              >
                <Icon name={item.icon} />

                <span>
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          {canInputOwnData && (
            <>
              <small className="dp-menu-label">INPUT KEGIATAN</small>
              <nav aria-label="Input kegiatan OJT mandiri">
                {INPUT_MENUS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="dp-menu"
                    disabled={Boolean(openingInput)}
                    onClick={() => openOwnInput(item.id)}
                  >
                    <Icon name={item.icon} />
                    <span>{openingInput === item.id ? "Membuka..." : item.label}</span>
                    <Icon name="arrow" size={14} />
                  </button>
                ))}
              </nav>
            </>
          )}

          <div className="dp-sidebar-bottom">
            <button
              type="button"
              className={`dp-menu ${
                page === "profil"
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                navigatePage("profil")
              }
            >
              <Icon name="user" />
              Profil Akun
            </button>

            <button
              type="button"
              className="dp-menu"
              disabled={loggingOut}
              onClick={logout}
            >
              <Icon name="logout" />

              {loggingOut
                ? "Sedang keluar..."
                : "Keluar Akun"}
            </button>
          </div>
        </aside>

        {mobileMenu && (
          <button
            type="button"
            className="dp-overlay"
            onClick={() =>
              setMobileMenu(false)
            }
            aria-label="Tutup menu"
          />
        )}

        <main className="dp-main">
          {inputError && (
            <div className="dp-alert error dp-no-print" role="alert">
              {inputError}
            </div>
          )}
          <div className="dp-page-heading dp-no-print">
            <div>
              <h1>
                {PAGE_TITLES[page]}
              </h1>

              {profile &&
                page !== "dashboard" && (
                  <p>
                    {profile.full_name}
                    {" · "}
                    {program?.site || "—"}
                  </p>
                )}
            </div>

            <div className="dp-buttons">
              {page !== "dashboard" && (
                <button
                  type="button"
                  className="dp-small-button"
                  onClick={() =>
                    navigatePage(
                      "dashboard"
                    )
                  }
                >
                  <Icon
                    name="left"
                    size={16}
                  />
                  <span>Dashboard</span>
                </button>
              )}

              {page === "dashboard" && (
                <button
                  type="button"
                  className="dp-small-button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark"
                      ? "Aktifkan mode terang"
                      : "Aktifkan mode gelap"
                  }
                >
                  <Icon
                    name={
                      theme === "dark"
                        ? "sun"
                        : "moon"
                    }
                    size={18}
                  />

                  <span>
                    {theme === "dark"
                      ? "Mode Terang"
                      : "Mode Gelap"}
                  </span>
                </button>
              )}

              <button
                type="button"
                className="dp-small-button"
                disabled={
                  loading ||
                  refreshing
                }
                onClick={() =>
                  loadDashboard(true)
                }
              >
                <Icon
                  name="refresh"
                  size={17}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {loading && (
            <div
              className="dp-alert"
              role="status"
            >
              Memuat Dashboard Peserta...
            </div>
          )}

          {refreshing && (
            <div
              className="dp-alert"
              role="status"
            >
              Memperbarui data...
            </div>
          )}

          {error && (
            <div
              className="dp-alert error"
              role="alert"
            >
              {error}
            </div>
          )}

          {isAdmin && (
            <section className="dp-admin-preview dp-no-print">
              <label htmlFor="dp-preview">
                <Icon
                  name="shield"
                  size={18}
                />
                Tinjauan Peserta
              </label>

              <select
                id="dp-preview"
                value={
                  selectedParticipantId
                }
                disabled={
                  loading ||
                  refreshing
                }
                onChange={(event) =>
                  changePreviewParticipant(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Pilih peserta
                </option>

                {participants.map(
                  (item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.full_name}
                      {item.site
                        ? ` — ${item.site}`
                        : ""}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                className="dp-small-button"
                onClick={() =>
                  router.push("/")
                }
              >
                Dashboard Admin
              </button>
            </section>
          )}

          {!loading &&
            !refreshing &&
            !error &&
            !hasActiveProgram && (
              <section className="dp-panel">
                {isAdmin &&
                !profile ? (
                  <EmptyState>
                    {participants.length
                      ? "Pilih peserta untuk melihat data OJT."
                      : "Belum ada peserta dengan program aktif."}
                  </EmptyState>
                ) : (
                  <>
                    <h2>
                      {getStatusInfo(
                        access
                      )}
                    </h2>

                    {access ===
                      "pending" && (
                      <p className="dp-muted">
                        {registration?.site ||
                          "—"}
                        {" · "}
                        {formatDate(
                          registration?.start_date
                        )}
                        {" – "}
                        {formatDate(
                          registration?.end_date
                        )}
                      </p>
                    )}

                    {access ===
                      "rejected" && (
                      <>
                        <p>
                          {registration
                            ?.rejection_reason ||
                            "Alasan belum tersedia."}
                        </p>

                        {!isAdmin && (
                          <button
                            type="button"
                            className="dp-button"
                            onClick={() =>
                              router.push(
                                "/pengajuan-peserta"
                              )
                            }
                          >
                            Perbaiki Pengajuan
                          </button>
                        )}
                      </>
                    )}

                    {access ===
                      "no_program" && (
                      <p className="dp-muted">
                        Belum ada program OJT aktif.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

          {showContent && (
            <>
              <div className="dp-print-heading">
                <h1>
                  OJT MineTrack ·{" "}
                  {PAGE_TITLES[page]}
                </h1>

                <p>
                  {participantName}
                  {" · "}
                  {program.site || "—"}
                </p>
              </div>

              {/* ======================================
                  DASHBOARD
                  ====================================== */}

              {page === "dashboard" && (
                <>
                  <section
                    className="dp-hero"
                    style={{
                      backgroundImage: `linear-gradient(100deg,rgba(0,55,42,.97),rgba(0,87,57,.87),rgba(0,70,56,.45)),url("${BACKGROUND_IMAGE}")`,
                    }}
                  >
                    <small>
                      EMERGENCY RESPONSE GROUP ·
                      PT BERAU COAL
                    </small>

                    <h2>
                      {participantName}
                    </h2>

                    <p>
                      {profile.department ||
                        "—"}
                      {" · "}
                      {program.site ||
                        "—"}
                    </p>

                    <span>
                      {weekLabel(
                        currentWeek
                      )}
                      {" · "}
                      {formatDate(
                        dashboardWeekInfo?.start
                      )}
                      {" – "}
                      {formatDate(
                        dashboardWeekInfo?.end
                      )}
                    </span>
                  </section>

                  {canInputOwnData && (
                    <section className="dp-panel dp-input-panel dp-no-print">
                      <div className="dp-section-head">
                        <div>
                          <h2>Input Kegiatan Saya</h2>
                          <p className="dp-input-subtitle">
                            Catat capaian OJT pada program sendiri. Verifikasi tetap oleh Mentor.
                          </p>
                        </div>
                      </div>
                      <div className="dp-input-grid">
                        {INPUT_MENUS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="dp-input-card"
                            disabled={Boolean(openingInput)}
                            onClick={() => openOwnInput(item.id)}
                          >
                            <Icon name={item.icon} size={23} />
                            <span>{openingInput === item.id ? "Membuka..." : item.label}</span>
                            <Icon name="arrow" size={16} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="dp-stat-grid">
                    <Stat
                      label="Minggu Program"
                      value={`${weekLabel(
                        currentWeek
                      )} / 25`}
                    />

                    <Stat
                      label="Progres OJT"
                      value={`${progress.activityPercent}%`}
                    />

                    <Stat
                      label="Status SIMPER"
                      value={
                        progress.simperIssued
                          ? "Sudah Terbit"
                          : progress.simperCompleted ===
                            3
                          ? "Persyaratan Terpenuhi"
                          : "Belum Dipenuhi"
                      }
                    />
                  </div>

                  <div className="dp-columns">
                    <section className="dp-panel">
                      <div className="dp-section-head">
                        <h2>
                          Jadwal Minggu Ini
                        </h2>

                        <span className="dp-muted">
                          {weekLabel(
                            currentWeek
                          )}
                        </span>
                      </div>

                      {dashboardSchedule.length ? (
                        dashboardSchedule.map(
                          (item) => (
                            <ActivityItem
                              key={item.id}
                              activity={item}
                              programId={program?.id}
                              canAccessPostTest={canInputOwnData}
                            />
                          )
                        )
                      ) : (
                        <EmptyState>
                          Belum ada jadwal.
                        </EmptyState>
                      )}

                      <button
                        type="button"
                        className="dp-button secondary full"
                        onClick={() =>
                          navigatePage(
                            "jadwal"
                          )
                        }
                      >
                        Semua Jadwal

                        <Icon
                          name="arrow"
                          size={16}
                        />
                      </button>
                    </section>

                    <section className="dp-panel">
                      <div className="dp-section-head">
                        <h2>
                          Ringkasan Mingguan
                        </h2>

                        <span className="dp-muted">
                          {weekLabel(
                            currentWeek
                          )}
                        </span>
                      </div>

                      <div className="dp-stat-grid two">
                        <Stat
                          label="Rata-rata Nilai"
                          value={scoreText(
                            dashboardWeekly.average
                          )}
                        />

                        <Stat
                          label="Catatan Minggu Ini"
                          value={
                            dashboardWeekly.total
                          }
                        />
                      </div>

                      <button
                        type="button"
                        className="dp-button secondary full"
                        onClick={() => {
                          setSelectedWeek(
                            currentWeek
                          );

                          navigatePage(
                            "monitoring"
                          );
                        }}
                      >
                        Monitoring Mingguan

                        <Icon
                          name="arrow"
                          size={16}
                        />
                      </button>

                      <div className="dp-subheading">
                        <h3>
                          Achievement Program
                        </h3>

                        <button
                          type="button"
                          className="dp-text-button"
                          onClick={() =>
                            navigatePage(
                              "achievement"
                            )
                          }
                        >
                          Detail
                        </button>
                      </div>

                      <CategoryCards
                        categories={
                          categories
                        }
                      />
                    </section>
                  </div>
                </>
              )}

              {/* ======================================
                  JADWAL KEGIATAN
                  ====================================== */}

              {page === "jadwal" && (
                <section className="dp-panel">
                  <div className="dp-section-head">
                    <h2>
                      Jadwal Kegiatan
                    </h2>

                    <WeekSelector
                      week={
                        selectedWeek
                      }
                      onChange={
                        setSelectedWeek
                      }
                      weeksWithData={
                        weeksWithData
                      }
                    />
                  </div>

                  <div className="dp-week-info">
                    <strong>
                      {weekLabel(
                        selectedWeek
                      )}
                    </strong>

                    <span>
                      {formatDate(
                        selectedWeekInfo?.start
                      )}
                      {" – "}
                      {formatDate(
                        selectedWeekInfo?.end
                      )}
                    </span>
                  </div>

                  {selectedSchedule.length ? (
                    selectedSchedule.map(
                      (item) => (
                        <ActivityItem
                          key={item.id}
                          activity={item}
                          programId={program?.id}
                          canAccessPostTest={canInputOwnData}
                        />
                      )
                    )
                  ) : (
                    <EmptyState>
                      Belum ada jadwal untuk minggu ini.
                    </EmptyState>
                  )}
                </section>
              )}

              {/* ======================================
                  MONITORING
                  ====================================== */}

              {page === "monitoring" &&
                renderWeeklyReport()}

              {/* ======================================
                  ACHIEVEMENT OJT
                  ====================================== */}

              {page === "achievement" && (
                <section className="dp-panel">
                  <div className="dp-section-head">
                    <h2>
                      Achievement Program
                    </h2>

                    <strong className="dp-total">
                      {progress.achievement}%
                    </strong>
                  </div>

                  {canInputOwnData && (
                    <form className="dp-self-form dp-no-print" onSubmit={saveOwnAchievement}>
                      <h3>Input Achievement Saya</h3>
                      <p>Isi kegiatan sendiri. Data baru berstatus Pending hingga diverifikasi Mentor.</p>
                      <div className="dp-self-grid">
                        <label>
                          Kategori
                          <select
                            required
                            value={ownSelectedType?.code || ""}
                            onChange={(event) => setOwnCategory(event.target.value)}
                          >
                            {ownAvailableTypes.map((type) => (
                                <option key={type.code} value={type.code}>{type.name}</option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Tanggal Pelaksanaan
                          <input type="date" required value={ownDate} onChange={(event) => setOwnDate(event.target.value)} />
                        </label>
                      </div>
                      {normalizeType(ownSelectedType?.name) === "fisik" && (
                        <label>
                          Jarak Fisik (km)
                          <input type="number" min="0.001" max="100" step="0.001" required value={ownDistance} onChange={(event) => setOwnDistance(event.target.value)} placeholder="Contoh: 3.250" />
                        </label>
                      )}
                      <label>
                        Deskripsi Kegiatan
                        <textarea required rows={3} value={ownDescription} onChange={(event) => setOwnDescription(event.target.value)} placeholder="Jelaskan kegiatan yang telah dilakukan..." />
                      </label>
                      <label>
                        Foto / Dokumen Pendukung (maksimal 5 MB)
                        <input ref={ownFileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setOwnFile(event.target.files?.[0] || null)} />
                      </label>
                      <button type="submit" className="dp-button" disabled={ownSaving}>
                        {ownSaving ? "Menyimpan..." : "Kirim Achievement Saya"}
                      </button>
                      {ownMessage && <div className="dp-alert" role="status">{ownMessage}</div>}
                    </form>
                  )}

                  <ProgressBar
                    value={
                      progress.achievement
                    }
                  />

                  <CategoryCards
                    categories={
                      categories
                    }
                  />

                  {canInputOwnData && (
                    <div className="dp-buttons dp-no-print dp-input-shortcut">
                      <button
                        type="button"
                        className="dp-button"
                        disabled={Boolean(openingInput)}
                        onClick={() => openOwnInput("achievement")}
                      >
                        <Icon name="trophy" size={17} />
                        Input Achievement Saya
                      </button>
                    </div>
                  )}

                  <div className="dp-buttons dp-no-print">
                    <button
                      type="button"
                      className="dp-button"
                      onClick={() =>
                        setAchievementHistory(
                          (old) => !old
                        )
                      }
                      aria-expanded={
                        achievementHistory
                      }
                    >
                      {achievementHistory
                        ? "Tutup Riwayat"
                        : "Lihat Riwayat"}
                    </button>

                    <button
                      type="button"
                      className="dp-button secondary"
                      onClick={() =>
                        navigatePage(
                          "monitoring"
                        )
                      }
                    >
                      Rekap Mingguan
                    </button>
                  </div>

                  {achievementHistory && (
                    <div className="dp-detail-stack">
                      <AchievementHistory
                        key={`all-${program.id}`}
                        records={
                          weeklyData.achievements
                        }
                        types={
                          weeklyData.types
                        }
                      />
                    </div>
                  )}
                </section>
              )}

              {/* ======================================
                  HASIL POST-TEST & PRAKTIK
                  ====================================== */}

              {page === "hasil" && (
                <section className="dp-panel">
                  <div className="dp-section-head">
                    <h2>
                      Hasil Penilaian
                    </h2>

                    <div className="dp-tabs">
                      <button
                        type="button"
                        className={
                          resultTab === "posttest"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setResultTab(
                            "posttest"
                          )
                        }
                      >
                        Post-Test
                      </button>

                      <button
                        type="button"
                        className={
                          resultTab === "praktik"
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setResultTab(
                            "praktik"
                          )
                        }
                      >
                        Praktik
                      </button>
                    </div>
                  </div>

                  {canInputOwnData && (
                    <div className="dp-buttons dp-no-print dp-input-shortcut">
                      <button
                        type="button"
                        className="dp-button"
                        disabled={Boolean(openingInput)}
                        onClick={() => openOwnInput("posttest")}
                      >
                        Input Post-Test Saya
                      </button>
                      <button
                        type="button"
                        className="dp-button secondary"
                        disabled={Boolean(openingInput)}
                        onClick={() => openOwnInput("praktik")}
                      >
                        Input Praktik Saya
                      </button>
                    </div>
                  )}

                  <div className="dp-stat-grid two">
                    <Stat
                      label="Rata-rata Seluruh Nilai"
                      value={scoreText(
                        overallScore
                      )}
                    />

                    <Stat
                      label="Penilaian Tercatat"
                      value={
                        allScores.length
                      }
                    />
                  </div>

                  <ScoreTable
                    records={
                      resultTab ===
                      "posttest"
                        ? weeklyData.postTests
                        : weeklyData.practices
                    }
                    practice={
                      resultTab ===
                      "praktik"
                    }
                  />
                </section>
              )}

              {/* ======================================
                  SIMPER
                  ====================================== */}

              {page === "simper" && (
                <section className="dp-panel">
                  <div className="dp-section-head">
                    <h2>
                      Status SIMPER
                    </h2>

                    <strong className="dp-total">
                      {progress.simper}%
                    </strong>
                  </div>

                  <ProgressBar
                    value={
                      progress.simper
                    }
                  />

                  <div className="dp-profile-rows">
                    <div>
                      <span>
                        Persyaratan Terpenuhi
                      </span>

                      <strong>
                        {progress.simperCompleted}
                        /3
                      </strong>
                    </div>

                    <div>
                      <span>
                        Penerbitan
                      </span>

                      <strong>
                        {progress.simperIssued
                          ? "Sudah Terbit"
                          : "Belum Terbit"}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dp-button full"
                    onClick={() =>
                      openFeature(
                        `/simper/${program.id}`
                      )
                    }
                  >
                    Detail SIMPER

                    <Icon
                      name="arrow"
                      size={16}
                    />
                  </button>
                </section>
              )}

              {/* ======================================
                  RAPOR & EVALUASI
                  ====================================== */}

              {page === "rapor" && (
                <>
                  <div className="dp-tabs dp-report-tabs dp-no-print">
                    <button
                      type="button"
                      className={
                        reportTab ===
                        "evaluasi"
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setReportTab(
                          "evaluasi"
                        )
                      }
                    >
                      Evaluasi Mingguan
                    </button>

                    <button
                      type="button"
                      className={
                        reportTab ===
                        "rapor"
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        setReportTab(
                          "rapor"
                        )
                      }
                    >
                      Rapor OJT
                    </button>
                  </div>

                  {reportTab ===
                  "evaluasi" ? (
                    renderWeeklyReport()
                  ) : (
                    <section className="dp-panel">
                      <h2>
                        Rapor OJT
                      </h2>

                      <div className="dp-stat-grid four">
                        <Stat
                          label="Achievement"
                          value={`${progress.achievement}%`}
                        />

                        <Stat
                          label="Minggu Beraktivitas"
                          value={`${progress.activityWeeks}/25`}
                        />

                        <Stat
                          label="SIMPER"
                          value={`${progress.simper}%`}
                        />

                        <Stat
                          label="Rata-rata Nilai"
                          value={scoreText(
                            overallScore
                          )}
                        />
                      </div>

                      <button
                        type="button"
                        className="dp-button full"
                        onClick={() =>
                          openFeature(
                            `/laporan/${program.id}`
                          )
                        }
                      >
                        Buka Rapor OJT

                        <Icon
                          name="arrow"
                          size={16}
                        />
                      </button>
                    </section>
                  )}

                  <div className="dp-buttons dp-no-print">
                    <button
                      type="button"
                      className="dp-button secondary"
                      onClick={() =>
                        openFeature(
                          `/analisis/${program.id}`
                        )
                      }
                    >
                      Grafik Perkembangan
                    </button>

                    <button
                      type="button"
                      className="dp-button secondary"
                      onClick={() =>
                        openFeature(
                          `/evaluasi/${program.id}`
                        )
                      }
                    >
                      Evaluasi Kesiapan
                    </button>
                  </div>
                </>
              )}

              {/* ======================================
                  PROFIL
                  ====================================== */}

              {page === "profil" && (
                <section className="dp-panel">
                  <div className="dp-profile-heading">
                    <span className="dp-avatar large">
                      {initials(
                        participantName
                      )}
                    </span>

                    <div>
                      <h2>
                        {participantName}
                      </h2>

                      <p className="dp-muted">
                        {isAdmin
                          ? "Tinjauan Peserta"
                          : "Peserta OJT"}
                      </p>
                    </div>
                  </div>

                  <div className="dp-profile-rows">
                    {[
                      [
                        "Departemen",
                        profile.department || "—",
                      ],
                      [
                        "Site Penempatan",
                        program.site || "—",
                      ],
                      [
                        "Periode OJT",
                        `${formatDate(
                          program.start_date
                        )} – ${formatDate(
                          program.end_date
                        )}`,
                      ],
                      [
                        "Status Program",
                        getStatusInfo(
                          access
                        ),
                      ],
                      [
                        "Email Akun Login",
                        isAdmin
                          ? "Tidak ditampilkan dalam preview"
                          : account?.email || "—",
                      ],
                    ].map(
                      ([label, value]) => (
                        <div key={label}>
                          <span>
                            {label}
                          </span>

                          <strong>
                            {value}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}
            </>
          )}

          <footer className="dp-footer">
            OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal
          </footer>
        </main>
      </div>
    </div>
  );
}

// ======================================================
// CSS
// Prefix dp- menghindari benturan dengan halaman detail.
// ======================================================

const dashboardCSS = `
  .dp-app {
    color-scheme: light;
    --dp-bg: #f2f7fb;
    --dp-surface: #ffffff;
    --dp-soft: #f5faf7;
    --dp-text: #14283a;
    --dp-muted: #5d7281;
    --dp-border: #dce7eb;
    --dp-accent: #087947;
    --dp-tint: #e7f8ef;
    --dp-green: #07572d;
    --dp-topbar: #003e35;
    --dp-shadow: 0 5px 20px rgba(20,59,58,.05);
    --dp-error-bg: #fff0f0;
    --dp-error-border: #efbfc4;
    --dp-error-text: #a02635;
    --dp-orange-bg: #fff1df;
    --dp-orange-text: #915500;
  }

  html[data-theme="dark"] .dp-app {
    color-scheme: dark;
    --dp-bg: #0d171b;
    --dp-surface: #17272b;
    --dp-soft: #203438;
    --dp-text: #edf8f4;
    --dp-muted: #a5bbb8;
    --dp-border: #30484b;
    --dp-accent: #83edb8;
    --dp-tint: #203b35;
    --dp-green: #8ff0bb;
    --dp-topbar: #081f1d;
    --dp-shadow: 0 5px 20px rgba(0,0,0,.18);
    --dp-error-bg: #42242c;
    --dp-error-border: #7a414c;
    --dp-error-text: #ffc3cb;
    --dp-orange-bg: #49371f;
    --dp-orange-text: #ffd6a2;
  }

  .dp-app,
  .dp-app * {
    box-sizing: border-box;
  }

  .dp-app {
    min-height: 100vh;
    background: var(--dp-bg);
    color: var(--dp-text);
    font-family: Arial, Helvetica, sans-serif;
    line-height: 1.5;
  }

  .dp-self-form { display: flex; flex-direction: column; gap: 12px; margin: 16px 0 20px; background: var(--dp-soft); border: 1px solid var(--dp-border); border-radius: 12px; padding: 16px; }
  .dp-self-form h3 { margin: 0; }
  .dp-self-form p { margin: 0; color: var(--dp-muted); font-size: 12px; }
  .dp-self-form label { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: bold; }
  .dp-self-form input, .dp-self-form textarea, .dp-self-form select { width: 100%; border: 1px solid var(--dp-border); background: var(--dp-surface); color: var(--dp-text); border-radius: 8px; padding: 10px 12px; font: inherit; }
  .dp-self-form input[type="file"] { font-size: 12px; }
  .dp-self-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  @media (max-width: 600px) { .dp-self-grid { grid-template-columns: 1fr; } }
  .dp-input-panel { margin-bottom: 18px; }
  .dp-input-subtitle { margin: 5px 0 0; color: var(--dp-muted); font-size: 12px; }
  .dp-input-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .dp-input-card { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--dp-soft); color: var(--dp-text); border: 1px solid var(--dp-border); border-radius: 12px; min-height: 72px; padding: 12px; font-weight: 700; text-align: left; }
  .dp-input-card:hover:not(:disabled) { border-color: var(--dp-accent); background: var(--dp-tint); }
  .dp-input-card > span { flex: 1; }
  .dp-input-shortcut { margin: 16px 0; }
  @media (max-width: 1000px) { .dp-input-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 520px) { .dp-input-grid { grid-template-columns: 1fr; } }

  .dp-app button,
  .dp-app select {
    font-family: inherit;
  }

  .dp-app button {
    cursor: pointer;
    touch-action: manipulation;
  }

  .dp-app button:disabled {
    opacity: .55;
    cursor: not-allowed;
  }

  .dp-app button:focus-visible,
  .dp-app select:focus-visible,
  .dp-app summary:focus-visible {
    outline: 3px solid #48bca2;
    outline-offset: 3px;
  }

  .dp-app select {
    background: var(--dp-surface);
    color: var(--dp-text);
    border: 1px solid var(--dp-border);
    border-radius: 9px;
    padding: 10px;
    min-height: 40px;
    font-size: 12px;
  }

  .dp-app select option {
    background: var(--dp-surface);
    color: var(--dp-text);
  }

  .dp-app h2,
  .dp-app h3 {
    color: var(--dp-text);
  }

  .dp-topbar {
    position: sticky;
    top: 0;
    z-index: 60;
    min-height: 64px;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 12px 24px;
    background: var(--dp-topbar);
    color: #ffffff;
  }

  .dp-brand {
    border: 0;
    background: transparent;
    color: #ffffff;
    font-size: 20px;
    font-weight: 900;
    white-space: nowrap;
  }

  .dp-brand span {
    color: #59dfa0;
  }

  .dp-brand small {
    font-size: 10px;
    color: #d7eee3;
  }

  .dp-top-description {
    border-left: 1px solid #ffffff44;
    padding-left: 17px;
    font-size: 12px;
    color: #cfe8de;
  }

  .dp-user {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .dp-user > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dp-user strong,
  .dp-user small {
    display: block;
  }

  .dp-user strong {
    font-size: 12px;
  }

  .dp-user small {
    font-size: 10px;
    color: #cce9d9;
    margin-top: 3px;
  }

  .dp-avatar {
    width: 37px;
    height: 37px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #d8f6e6;
    color: #075b43;
    font-weight: 900;
  }

  .dp-avatar.large {
    width: 60px;
    height: 60px;
    font-size: 22px;
  }

  .dp-mobile-trigger {
    display: none;
  }

  .dp-layout {
    display: flex;
    min-height: calc(100vh - 64px);
  }

  .dp-sidebar {
    position: sticky;
    top: 64px;
    align-self: flex-start;
    width: 250px;
    height: calc(100vh - 64px);
    flex-shrink: 0;
    overflow-y: auto;
    background: linear-gradient(
      165deg,
      #004d3f,
      #00352f 55%,
      #002a27
    );
    color: #ffffff;
    padding: 24px 14px;
    z-index: 50;
  }

  html[data-theme="dark"] .dp-sidebar {
    background: linear-gradient(
      165deg,
      #092c28,
      #081f1d 55%,
      #061614
    );
  }

  .dp-sidebar-brand {
    text-align: center;
    padding: 0 6px 22px;
    border-bottom: 1px solid #ffffff29;
  }

  .dp-sidebar-brand > div {
    font-size: 42px;
  }

  .dp-sidebar-brand > strong {
    font-size: 21px;
    white-space: nowrap;
  }

  .dp-sidebar-brand > strong span {
    color: #f4d45e;
  }

  .dp-sidebar-brand > strong small {
    font-size: 9px;
  }

  .dp-sidebar-brand p {
    font-size: 11px;
    color: #c9e9dd;
  }

  .dp-menu-label {
    display: block;
    margin: 24px 12px 12px;
    color: #b9d8cc;
    font-size: 10px;
    letter-spacing: 1px;
    font-weight: 800;
  }

  .dp-sidebar nav {
    display: grid;
    gap: 6px;
  }

  .dp-menu {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    padding: 11px 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #f1fff9;
    text-align: left;
    font-size: 12px;
    font-weight: 700;
  }

  .dp-menu svg {
    flex-shrink: 0;
  }

  .dp-menu.active {
    background: #078b59;
  }

  .dp-sidebar-bottom {
    border-top: 1px solid #ffffff2d;
    margin-top: 25px;
    padding-top: 16px;
  }

  .dp-overlay {
    display: none;
  }

  .dp-main {
    min-width: 0;
    flex: 1;
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 23px;
  }

  .dp-page-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .dp-page-heading > div:first-child {
    min-width: 0;
  }

  .dp-page-heading h1 {
    margin: 0;
    color: var(--dp-text);
    font-size: 26px;
    line-height: 1.3;
  }

  .dp-page-heading p {
    margin: 6px 0 0;
    color: var(--dp-muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .dp-buttons {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 9px;
  }

  .dp-small-button,
  .dp-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;
    border: 1px solid var(--dp-border);
    border-radius: 9px;
    background: var(--dp-surface);
    color: var(--dp-accent);
    padding: 10px 13px;
    font-size: 12px;
    font-weight: 800;
  }

  .dp-small-button {
    font-size: 11px;
  }

  .dp-button {
    background: #078653;
    color: #ffffff;
    border-color: #078653;
  }

  .dp-button.secondary {
    background: var(--dp-tint);
    color: var(--dp-accent);
    border-color: var(--dp-border);
  }

  .dp-button.full {
    width: 100%;
    margin-top: 16px;
  }

  .dp-admin-preview {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px;
    margin-bottom: 18px;
    border: 1px solid var(--dp-border);
    border-radius: 12px;
    background: var(--dp-tint);
  }

  .dp-admin-preview label {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--dp-green);
    font-size: 12px;
    font-weight: 800;
  }

  .dp-admin-preview select {
    flex: 1;
    min-width: 180px;
    max-width: 100%;
  }

  .dp-alert {
    padding: 14px;
    margin-bottom: 15px;
    border: 1px solid var(--dp-border);
    border-radius: 10px;
    background: var(--dp-tint);
    color: var(--dp-green);
    font-size: 12px;
  }

  .dp-alert.error {
    background: var(--dp-error-bg);
    border-color: var(--dp-error-border);
    color: var(--dp-error-text);
    overflow-wrap: anywhere;
  }

  .dp-panel {
    min-width: 0;
    padding: 21px;
    margin-bottom: 17px;
    border: 1px solid var(--dp-border);
    border-radius: 14px;
    background: var(--dp-surface);
    box-shadow: var(--dp-shadow);
  }

  .dp-panel > h2 {
    margin: 0 0 15px;
    font-size: 20px;
  }

  .dp-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }

  .dp-section-head h2 {
    margin: 0;
    font-size: 19px;
  }

  .dp-hero {
    padding: 26px;
    margin-bottom: 17px;
    border-radius: 14px;
    background-size: cover;
    background-position: center;
    color: #ffffff;
  }

  .dp-hero > small {
    color: #f1cf77;
    font-size: 10px;
    font-weight: 800;
  }

  .dp-hero h2 {
    color: #ffffff;
    font-size: 27px;
    margin: 12px 0 6px;
    overflow-wrap: anywhere;
  }

  .dp-hero p {
    color: #d6ece1;
    font-size: 13px;
    margin: 0 0 14px;
  }

  .dp-hero > span {
    color: #e0f4e8;
    font-size: 12px;
  }

  .dp-stat-grid {
    display: grid;
    grid-template-columns:
      repeat(3,minmax(0,1fr));
    gap: 12px;
    margin: 0 0 17px;
  }

  .dp-stat-grid.two {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .dp-stat-grid.four {
    grid-template-columns:
      repeat(4,minmax(0,1fr));
  }

  .dp-stat {
    min-width: 0;
    padding: 16px;
    background: var(--dp-soft);
    border: 1px solid var(--dp-border);
    border-radius: 11px;
  }

  .dp-stat small {
    display: block;
    color: var(--dp-muted);
    font-size: 11px;
  }

  .dp-stat strong {
    display: block;
    margin-top: 8px;
    color: var(--dp-green);
    font-size: 23px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .dp-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 17px;
  }

  .dp-week-nav {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .dp-week-nav button {
    min-width: 36px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1px solid var(--dp-border);
    border-radius: 8px;
    background: var(--dp-surface);
    color: var(--dp-accent);
  }

  .dp-week-nav select {
    max-width: 210px;
    font-weight: 700;
  }

  .dp-week-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    padding: 14px;
    margin-bottom: 15px;
    border-radius: 10px;
    background: var(--dp-tint);
  }

  .dp-week-info strong {
    color: var(--dp-green);
    font-size: 18px;
  }

  .dp-week-info span {
    color: var(--dp-muted);
    font-size: 12px;
  }

  .dp-progress {
    width: 100%;
    height: 8px;
    margin-top: 8px;
    overflow: hidden;
    border-radius: 20px;
    background: var(--dp-border);
  }

  .dp-progress > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #0b9c64;
  }

  html[data-theme="dark"] .dp-progress > span {
    background: #43d499;
  }

  .dp-progress-cell {
    min-width: 110px;
  }

  .dp-category-grid {
    display: grid;
    grid-template-columns:
      repeat(3,minmax(0,1fr));
    gap: 10px;
    margin: 16px 0;
  }

  .dp-category {
    min-width: 0;
    padding: 14px;
    border: 1px solid var(--dp-border);
    border-radius: 11px;
  }

  .dp-category-title {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--dp-accent);
  }

  .dp-category-title svg {
    flex-shrink: 0;
  }

  .dp-category-title strong {
    font-size: 11px;
    color: var(--dp-text);
  }

  .dp-category h3 {
    color: var(--dp-green);
    font-size: 25px;
    margin: 10px 0;
  }

  .dp-category > small {
    display: block;
    color: var(--dp-muted);
    margin-top: 9px;
    font-size: 10px;
  }

  .dp-total {
    color: var(--dp-green);
    font-size: 29px;
  }

  .dp-subheading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-top: 20px;
  }

  .dp-subheading h3 {
    font-size: 14px;
    margin: 0;
  }

  .dp-text-button {
    padding: 6px;
    border: 0;
    background: transparent;
    color: var(--dp-accent);
    font-size: 12px;
    font-weight: 800;
  }

  .dp-activity {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border-bottom: 1px solid var(--dp-border);
    padding: 15px 0;
  }

  .dp-activity:last-of-type {
    border-bottom: 0;
  }

  .dp-activity-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    background: var(--dp-tint);
    color: var(--dp-accent);
    border-radius: 10px;
  }

  .dp-activity > div {
    min-width: 0;
  }

  .dp-activity strong {
    display: block;
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .dp-activity small {
    display: block;
    color: var(--dp-muted);
    font-size: 11px;
    margin-top: 5px;
  }

  .dp-posttest-box {
    margin-top: 11px;
    padding: 13px;
    background: var(--dp-tint);
    border: 1px solid var(--dp-border);
    border-radius: 10px;
  }
  .dp-posttest-box > strong { font-size: 12px; }
  .dp-posttest-note {
    color: var(--dp-muted);
    font-size: 11px;
    line-height: 1.6;
    margin: 8px 0;
  }
  .dp-posttest-credentials {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
  }
  .dp-posttest-pass {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
  }
  .dp-posttest-pass code {
    background: var(--dp-surface);
    border: 1px solid var(--dp-border);
    color: var(--dp-text);
    border-radius: 7px;
    padding: 10px;
    user-select: text;
    overflow-wrap: anywhere;
  }
  .dp-posttest-error {
    font-size: 11px;
    color: #c83e49;
  }

  .dp-schedule-detail {
    margin-top: 6px;
    font-size: 11px;
    color: var(--dp-muted);
  }

  .dp-schedule-detail summary {
    width: fit-content;
    cursor: pointer;
    color: var(--dp-accent);
  }

  .dp-schedule-detail p {
    margin: 7px 0 0;
    line-height: 1.7;
  }

  .dp-table-wrap {
    width: 100%;
    overflow-x: auto;
  }

  .dp-table {
    width: 100%;
    min-width: 540px;
    border-collapse: collapse;
    font-size: 12px;
  }

  .dp-table th,
  .dp-table td {
    padding: 12px 10px;
    border-bottom: 1px solid var(--dp-border);
    text-align: left;
    vertical-align: middle;
    color: var(--dp-text);
  }

  .dp-table th {
    background: var(--dp-soft);
    color: var(--dp-muted);
    font-size: 11px;
  }

  .dp-table .dp-description {
    min-width: 160px;
    max-width: 380px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .dp-nowrap {
    white-space: nowrap;
  }

  /* ====================================================
     PERBAIKAN DOKUMENTASI ACHIEVEMENT
     Mengikuti warna Light / Dark Mode global.
     ==================================================== */

  .dp-achievement-description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.65;
  }

  .dp-evidence {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    padding: 10px;
    border: 1px solid var(--dp-border);
    border-radius: 9px;
    background: var(--dp-soft);
    white-space: normal;
  }

  .dp-evidence-name {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    width: 100%;
    color: var(--dp-muted);
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .dp-evidence-name span:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .dp-evidence-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 32px;
    padding: 7px 11px;
    border: 1px solid var(--dp-border);
    border-radius: 7px;
    background: var(--dp-tint);
    color: var(--dp-accent);
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }

  .dp-evidence-button:hover:not(:disabled) {
    border-color: var(--dp-accent);
  }

  .dp-evidence-button:disabled {
    opacity: .55;
  }

  /* ====================================================
     LANJUTAN CSS ASLI
     ==================================================== */

  .dp-inline-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    padding: 15px 0;
    color: var(--dp-muted);
    font-size: 12px;
  }

  .dp-inline-summary strong {
    color: var(--dp-text);
  }

  .dp-detail-stack {
    display: grid;
    gap: 25px;
    border-top: 1px solid var(--dp-border);
    margin-top: 20px;
    padding-top: 20px;
  }

  .dp-detail-stack h3 {
    font-size: 15px;
    margin: 0 0 12px;
  }

  .dp-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .dp-filter-row select {
    min-width: 140px;
  }

  .dp-badge {
    display: inline-block;
    padding: 5px 8px;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 800;
  }

  .dp-badge.verified {
    background: var(--dp-tint);
    color: var(--dp-green);
  }

  .dp-badge.pending {
    background: var(--dp-orange-bg);
    color: var(--dp-orange-text);
  }

  .dp-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    background: var(--dp-soft);
    border-radius: 9px;
    padding: 4px;
  }

  .dp-tabs button {
    border: 0;
    border-radius: 7px;
    padding: 10px 12px;
    background: transparent;
    color: var(--dp-muted);
    font-size: 11px;
    font-weight: 800;
  }

  .dp-tabs button.selected {
    background: #078653;
    color: #ffffff;
  }

  .dp-report-tabs {
    width: fit-content;
    margin-bottom: 16px;
  }

  .dp-profile-heading {
    display: flex;
    align-items: center;
    gap: 15px;
    padding-bottom: 15px;
  }

  .dp-profile-heading h2 {
    margin: 0;
    font-size: 21px;
    overflow-wrap: anywhere;
  }

  .dp-profile-heading p {
    margin: 5px 0 0;
  }

  .dp-profile-rows > div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 0;
    border-bottom: 1px solid var(--dp-border);
    font-size: 12px;
  }

  .dp-profile-rows span {
    color: var(--dp-muted);
  }

  .dp-profile-rows strong {
    text-align: right;
    overflow-wrap: anywhere;
  }

  .dp-empty {
    text-align: center;
    padding: 28px 12px;
    color: var(--dp-muted);
    font-size: 12px;
  }

  .dp-muted {
    color: var(--dp-muted);
    font-size: 12px;
  }

  .dp-footer {
    padding: 22px 0;
    margin-top: 22px;
    border-top: 1px solid var(--dp-border);
    text-align: center;
    color: var(--dp-muted);
    font-size: 10px;
  }

  .dp-print-heading {
    display: none;
  }

  @media (hover:hover) {
    .dp-menu:hover:not(.active) {
      background: #ffffff15;
    }

    .dp-small-button:hover {
      background: var(--dp-tint);
    }

    .dp-button:hover {
      filter: brightness(.95);
    }
  }

  @media (max-width:1200px) {
    .dp-sidebar {
      width: 230px;
    }

    .dp-main {
      padding: 17px;
    }

    .dp-columns {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width:850px) {
    .dp-top-description {
      display: none;
    }

    .dp-category-grid {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }

    .dp-stat-grid.four {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
    }

    .dp-admin-preview select {
      flex-basis: 100%;
    }

    .dp-page-heading {
      flex-wrap: wrap;
    }
  }

  @media (max-width:700px) {
    .dp-topbar {
      min-height: 64px;
      gap: 8px;
      padding: 10px 12px;
    }

    .dp-brand {
      font-size: 17px;
    }

    .dp-mobile-trigger {
      display: grid;
      place-items: center;
      padding: 5px;
      border: 0;
      background: transparent;
      color: #ffffff;
    }

    .dp-user {
      gap: 7px;
      max-width: 45%;
    }

    .dp-user strong {
      font-size: 10px;
    }

    .dp-user small {
      font-size: 9px;
    }

    .dp-avatar {
      width: 30px;
      height: 30px;
      font-size: 11px;
    }

    .dp-sidebar {
      position: fixed;
      top: 64px;
      bottom: 0;
      left: 0;
      height: calc(100vh - 64px);
      width: 270px;
      transform: translateX(-105%);
      transition: transform .2s ease;
      z-index: 55;
    }

    .dp-sidebar.open {
      transform: translateX(0);
    }

    .dp-overlay {
      display: block;
      position: fixed;
      inset: 64px 0 0;
      width: 100%;
      z-index: 54;
      border: 0;
      background: #001b1780;
    }

    .dp-main {
      padding: 12px;
    }

    .dp-page-heading h1 {
      font-size: 21px;
    }

    .dp-page-heading > .dp-buttons {
      margin-left: auto;
    }

    .dp-small-button {
      padding: 9px;
    }

    .dp-panel {
      padding: 15px;
      border-radius: 12px;
    }

    .dp-section-head h2 {
      font-size: 17px;
    }

    .dp-section-head {
      align-items: stretch;
    }

    .dp-week-nav {
      width: 100%;
    }

    .dp-week-nav select {
      max-width: none;
      flex: 1;
      min-width: 0;
    }

    .dp-stat-grid {
      grid-template-columns:
        repeat(2,minmax(0,1fr));
      gap: 8px;
    }

    .dp-stat {
      padding: 12px;
    }

    .dp-stat strong {
      font-size: 20px;
    }

    .dp-hero {
      padding: 20px;
    }

    .dp-hero h2 {
      font-size: 23px;
    }

    .dp-category {
      padding: 12px;
    }

    .dp-admin-preview {
      gap: 10px;
    }

    .dp-admin-preview select {
      min-width: 0;
      width: 100%;
    }

    .dp-profile-rows > div {
      flex-wrap: wrap;
    }

    .dp-profile-rows strong {
      text-align: left;
    }
  }

  @media (max-width:390px) {
    .dp-user {
      max-width: 42%;
    }

    .dp-user .dp-avatar {
      display: none;
    }

    .dp-brand small {
      display: none;
    }

    .dp-category-title {
      align-items: flex-start;
    }

    .dp-category-title strong {
      font-size: 10px;
    }

    .dp-small-button span {
      display: none;
    }
  }

  @media (prefers-reduced-motion:reduce) {
    .dp-sidebar {
      transition: none;
    }
  }

  @media print {
    @page {
      size: A4 landscape;
      margin: 10mm;
    }

    html,
    body {
      background: #ffffff !important;
    }

    .dp-app,
    html[data-theme="dark"] .dp-app {
      color-scheme: light;
      --dp-bg: #ffffff;
      --dp-surface: #ffffff;
      --dp-soft: #f3f6f4;
      --dp-text: #172b24;
      --dp-muted: #52685d;
      --dp-border: #ccd8d1;
      --dp-accent: #087947;
      --dp-tint: #e7f8ef;
      --dp-green: #07572d;
      --dp-orange-bg: #fff1df;
      --dp-orange-text: #915500;
      --dp-shadow: none;
      min-height: 0;
    }

    .dp-topbar,
    .dp-sidebar,
    .dp-overlay,
    .dp-no-print,
    .dp-footer,
    .dp-week-nav,
    .dp-button,
    .dp-text-button {
      display: none !important;
    }

    .dp-layout {
      display: block;
      min-height: 0;
    }

    .dp-main {
      padding: 0;
      max-width: none;
    }

    .dp-print-heading {
      display: block;
      margin-bottom: 15px;
    }

    .dp-print-heading h1 {
      font-size: 20px;
      margin: 0 0 6px;
    }

    .dp-print-heading p {
      font-size: 12px;
      margin: 0;
    }

    .dp-panel {
      box-shadow: none;
    }

    .dp-table-wrap {
      overflow: visible;
    }

    .dp-table {
      min-width: 0;
    }

    .dp-table th,
    .dp-table td {
      padding: 8px;
      font-size: 10px;
    }

    .dp-table thead {
      display: table-header-group;
    }

    .dp-table tr {
      break-inside: avoid;
    }

    .dp-stat-grid.four {
      grid-template-columns:
        repeat(4,minmax(0,1fr));
    }

    .dp-category-grid {
      grid-template-columns:
        repeat(3,minmax(0,1fr));
    }

    .dp-stat,
    .dp-category {
      break-inside: avoid;
    }

    .dp-progress,
    .dp-badge,
    .dp-week-info {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    /* Dokumentasi ditampilkan sebagai nama file
       tanpa tombol pada hasil cetak PDF. */

    .dp-evidence {
      background: #f3f6f4;
      border-color: #ccd8d1;
      break-inside: avoid;
    }

    .dp-evidence-name {
      color: #52685d;
      font-size: 9px;
    }

    .dp-evidence-button {
      display: none !important;
    }
  }
`;
