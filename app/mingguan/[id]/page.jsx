
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;

const CATEGORIES = [
  { name: "Fisik", icon: "🏃", aliases: ["fisik"] },
  { name: "Training", icon: "📚", aliases: ["training"] },
  { name: "Sosialisasi", icon: "👥", aliases: ["sosialisasi"] },
  { name: "Coaching", icon: "💬", aliases: ["coaching"] },
  {
    name: "Orientasi Area",
    icon: "🧭",
    aliases: ["orientasi area", "orientasi"],
  },
  { name: "Hazard", icon: "⚠️", aliases: ["hazard"] },
];

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const weekLabel = (week) => `Week ${String(week).padStart(2, "0")}`;

function parseDate(value) {
  if (!value) return null;

  const match = String(value)
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );

  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

function dateKey(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function addDays(date, days) {
  if (!date) return null;
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getWeek(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.floor(
    (date.getTime() - start.getTime()) / 86400000
  );

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

function weekRange(startValue, week) {
  const start = parseDate(startValue);
  if (!start) return null;

  return {
    start: dateKey(addDays(start, (week - 1) * 7)),
    end: dateKey(addDays(start, week * 7 - 1)),
  };
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatNumber(value, digits = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "-";

  return number.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

function average(records) {
  const numbers = records
    .map((item) => Number(item.score))
    .filter((number) => Number.isFinite(number));

  if (!numbers.length) return null;

  return numbers.reduce((sum, number) => sum + number, 0) /
    numbers.length;
}

function percentage(verified, total) {
  if (!total) return 0;
  return Math.round((verified / total) * 100);
}

function isVerified(record) {
  return normalize(record.status) === "verified";
}

function getRole(profile) {
  const role = normalize(profile?.role);

  if (role === "admin") return "admin";
  if (role === "mentor") return "mentor";
  if (["participant", "peserta"].includes(role)) return "participant";

  return null;
}

function resolveCategory(typeCode, types) {
  const item = types.find(
    (type) => normalize(type.code) === normalize(typeCode)
  );

  const labels = [item?.name, typeCode].filter(Boolean);

  return (
    CATEGORIES.find((category) =>
      labels.some((label) =>
        category.aliases.some(
          (alias) => normalize(label) === normalize(alias)
        )
      )
    )?.name || null
  );
}

// PDF dibuat langsung tanpa library eksternal.
// Berkas PDF hanya berisi data minggu yang dipilih.
function createWeeklyPdf(report) {
  const safe = (value) =>
    String(value ?? "-")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");

  const commands = [];
  let y = 802;
  let pageContent = [];

  const pages = [];

  function write(text, x = 46, size = 10, bold = false) {
    if (y < 55) newPage();

    pageContent.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ` +
      `1 0 0 1 ${x} ${y} Tm (${safe(text)}) Tj ET`
    );

    y -= size + 8;
  }

  function line() {
    if (y < 60) newPage();

    pageContent.push(
      `0.8 w 46 ${y} m 549 ${y} l S`
    );

    y -= 15;
  }

  function newPage() {
    pages.push(pageContent.join("\n"));
    pageContent = [];
    y = 802;
  }

  write("OJT MINETRACK - EVALUASI MINGGUAN", 46, 16, true);
  write("MONITORING PER KATEGORI", 46, 11, true);
  line();

  write(`Peserta  : ${report.name}`);
  write(`Site     : ${report.site}`);
  write(`Periode  : ${report.weekLabel}`);
  write(`Tanggal  : ${report.period}`);
  write(`Filter   : ${report.filter}`);
  line();

  write("RINGKASAN ACHIEVEMENT", 46, 12, true);
  write(
    `Total: ${report.total}   Verified: ${report.verified}` +
    `   Pending: ${report.pending}` +
    `   Verifikasi: ${report.progress}%`
  );

  line();
  write("MONITORING KATEGORI", 46, 12, true);

  report.categories.forEach((category) => {
    write(category.name, 46, 11, true);
    write(
      `Total: ${category.total}  |  Verified: ${category.verified}` +
      `  |  Pending: ${category.pending}` +
      `  |  Progress: ${category.progress}%`,
      58,
      9
    );
  });

  line();
  write("RINGKASAN PENILAIAN", 46, 12, true);

  write(
    `Post-Test: ${report.postCount} nilai; ` +
    `rata-rata ${report.postAverage}`
  );
  write(
    `Praktik: ${report.practiceCount} nilai; ` +
    `rata-rata ${report.practiceAverage}`
  );
  write(
    `Samapta: ${report.samaptaCount} catatan; ` +
    `nilai terbaru ${report.samaptaLatest}`
  );

  line();
  write("DETAIL AKTIVITAS", 46, 12, true);

  if (!report.activities.length) {
    write("Belum ada aktivitas pada minggu ini.");
  }

  report.activities.forEach((activity, index) => {
    write(
      `${index + 1}. ${activity.date} | ${activity.category}`,
      46,
      9,
      true
    );

    write(
      `Status: ${activity.status}` +
      (activity.distance ? ` | ${activity.distance} km` : ""),
      58,
      9
    );

    if (activity.description) {
      const text = String(activity.description);

      for (let i = 0; i < text.length; i += 83) {
        write(text.slice(i, i + 83), 58, 8);
      }
    }
  });

  newPage();

  const objects = [null];

  const reserve = () => {
    objects.push("");
    return objects.length - 1;
  };

  const setObject = (id, value) => {
    objects[id] = value;
  };

  const catalogId = reserve();
  const pagesId = reserve();
  const fontRegularId = reserve();
  const fontBoldId = reserve();

  setObject(
    fontRegularId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );

  setObject(
    fontBoldId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  );

  const pageIds = [];

  pages.forEach((content) => {
    const contentId = reserve();
    const pageId = reserve();

    setObject(
      contentId,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );

    setObject(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R ` +
      `/MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontRegularId} 0 R ` +
      `/F2 ${fontBoldId} 0 R >> >> ` +
      `/Contents ${contentId} 0 R >>`
    );

    pageIds.push(pageId);
  });

  setObject(
    pagesId,
    `<< /Type /Pages /Kids [${pageIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageIds.length} >>`
  );

  setObject(
    catalogId,
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefStart = pdf.length;

  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i < objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf +=
    `trailer\n<< /Size ${objects.length} ` +
    `/Root ${catalogId} 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);

  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i) & 255;
  }

  const blob = new Blob([bytes], {
    type: "application/pdf",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `Evaluasi_Mingguan_${report.weekLabel.replace(" ", "_")}.pdf`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EvaluasiMingguanPage() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);

  const [selectedWeek, setSelectedWeek] = useState(1);
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const role = getRole(profile);

  const loadRecords = useCallback(async (id) => {
    const requests = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description," +
          "distance_km,status,verified_by,created_at"
        )
        .eq("program_id", id)
        .order("activity_date", { ascending: false }),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes,created_at")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value"
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

    requests.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
      }
    });

    return {
      types: requests[0].data || [],
      achievements: requests[1].data || [],
      postTests: requests[2].data || [],
      practices: requests[3].data || [],
      samapta: requests[4].data || [],
    };
  }, []);

  const applyRecords = useCallback((records) => {
    setTypes(records.types);
    setAchievements(records.achievements);
    setPostTests(records.postTests);
    setPractices(records.practices);
    setSamapta(records.samapta);
  }, []);

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
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth?.user) {
          router.replace("/login");
          return;
        }

        const user = auth.user;

        const { data: userProfile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        const currentRole = getRole(userProfile);

        if (!currentRole) {
          throw new Error("Akun tidak memiliki akses Evaluasi Mingguan.");
        }

        let query = supabase
          .from("ojt_programs")
          .select(
            "id,participant_id,mentor_id,site,status," +
            "start_date,end_date," +
            "peserta:profiles!ojt_programs_participant_id_fkey" +
            "(full_name,department)"
          )
          .eq("id", programId);

        if (currentRole === "mentor") {
          query = query.eq("mentor_id", user.id);
        }

        if (currentRole === "participant") {
          query = query.eq("participant_id", user.id);
        }

        const { data: ojtProgram, error: programError } =
          await query.maybeSingle();

        if (programError) throw programError;

        if (!ojtProgram) {
          throw new Error(
            "Program tidak ditemukan atau Anda tidak memiliki akses."
          );
        }

        if (!parseDate(ojtProgram.start_date)) {
          throw new Error(
            "Tanggal mulai program OJT tidak valid."
          );
        }

        if (currentRole === "participant") {
          const status = normalize(ojtProgram.status);

          if (!["active", "approved", "aktif"].includes(status)) {
            throw new Error(
              "Evaluasi Mingguan hanya tersedia untuk " +
              "peserta dengan program aktif dan disetujui."
            );
          }
        }

        const records = await loadRecords(programId);

        if (!active) return;

        setProfile(userProfile);
        setProgram(ojtProgram);
        applyRecords(records);

        const currentWeek = getWeek(
          dateKey(new Date()),
          ojtProgram.start_date
        );

        setSelectedWeek(currentWeek || 1);
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat Evaluasi Mingguan.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router, loadRecords, applyRecords]);

  const refresh = useCallback(async () => {
    if (!programId || loading || refreshing || !program) return;

    setRefreshing(true);
    setError("");

    try {
      const records = await loadRecords(programId);
      applyRecords(records);
    } catch (err) {
      setError(err.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }, [
    programId,
    program,
    loading,
    refreshing,
    loadRecords,
    applyRecords,
  ]);

  const period = useMemo(
    () => weekRange(program?.start_date, selectedWeek),
    [program?.start_date, selectedWeek]
  );

  const weeklyAchievements = useMemo(() => {
    return achievements.filter(
      (item) =>
        getWeek(item.activity_date, program?.start_date) ===
        selectedWeek
    );
  }, [achievements, program?.start_date, selectedWeek]);

  const weeklyPostTests = useMemo(() => {
    return postTests.filter(
      (item) =>
        getWeek(item.test_date, program?.start_date) ===
        selectedWeek
    );
  }, [postTests, program?.start_date, selectedWeek]);

  const weeklyPractices = useMemo(() => {
    return practices.filter(
      (item) =>
        getWeek(item.practice_date, program?.start_date) ===
        selectedWeek
    );
  }, [practices, program?.start_date, selectedWeek]);

  const weeklySamapta = useMemo(() => {
    return samapta.filter(
      (item) =>
        getWeek(item.test_date, program?.start_date) ===
        selectedWeek
    );
  }, [samapta, program?.start_date, selectedWeek]);

  const categoryMonitoring = useMemo(() => {
    return CATEGORIES.map((category) => {
      const records = weeklyAchievements.filter(
        (item) =>
          resolveCategory(item.type_code, types) === category.name
      );

      const verified = records.filter(isVerified).length;
      const total = records.length;

      return {
        ...category,
        records,
        total,
        verified,
        pending: records.filter(
          (item) => normalize(item.status) === "pending"
        ).length,
        progress: percentage(verified, total),
      };
    });
  }, [weeklyAchievements, types]);

  const summary = useMemo(() => {
    const total = weeklyAchievements.length;
    const verified = weeklyAchievements.filter(isVerified).length;
    const pending = weeklyAchievements.filter(
      (item) => normalize(item.status) === "pending"
    ).length;

    const sortedSamapta = [...weeklySamapta].sort(
      (a, b) =>
        String(b.test_date).localeCompare(String(a.test_date))
    );

    return {
      total,
      verified,
      pending,
      progress: percentage(verified, total),
      postAverage: average(weeklyPostTests),
      practiceAverage: average(weeklyPractices),
      samaptaLatest: sortedSamapta[0] || null,
    };
  }, [
    weeklyAchievements,
    weeklyPostTests,
    weeklyPractices,
    weeklySamapta,
  ]);

  const activityWeeks = useMemo(() => {
    const weeks = new Set();

    const add = (date) => {
      const week = getWeek(date, program?.start_date);
      if (week !== null) weeks.add(week);
    };

    achievements.forEach((item) => add(item.activity_date));
    postTests.forEach((item) => add(item.test_date));
    practices.forEach((item) => add(item.practice_date));
    samapta.forEach((item) => add(item.test_date));

    return weeks;
  }, [
    achievements,
    postTests,
    practices,
    samapta,
    program?.start_date,
  ]);

  const weekHasActivity =
    weeklyAchievements.length > 0 ||
    weeklyPostTests.length > 0 ||
    weeklyPractices.length > 0 ||
    weeklySamapta.length > 0;

  const visibleCategories = useMemo(() => {
    if (filter === "active") {
      return categoryMonitoring.filter(
        (category) => category.total > 0
      );
    }

    if (filter === "empty") {
      return categoryMonitoring.filter(
        (category) => category.total === 0
      );
    }

    return categoryMonitoring;
  }, [categoryMonitoring, filter]);

  const participantName =
    program?.peserta?.full_name || "Peserta OJT";

  const buildReport = () => {
    const periodText = period
      ? `${formatDate(period.start)} - ${formatDate(period.end)}`
      : "-";

    const filterLabels = {
      all: "Semua Kategori",
      active: "Ada Aktivitas",
      empty: "Belum Ada Aktivitas",
    };

    return {
      name: participantName,
      site: program?.site || "-",
      weekLabel: weekLabel(selectedWeek),
      period: periodText,
      filter: filterLabels[filter] || "Semua Kategori",
      total: summary.total,
      verified: summary.verified,
      pending: summary.pending,
      progress: summary.progress,
      categories: visibleCategories,
      postCount: weeklyPostTests.length,
      postAverage:
        summary.postAverage === null
          ? "-"
          : formatNumber(summary.postAverage, 2),
      practiceCount: weeklyPractices.length,
      practiceAverage:
        summary.practiceAverage === null
          ? "-"
          : formatNumber(summary.practiceAverage, 2),
      samaptaCount: weeklySamapta.length,
      samaptaLatest:
        summary.samaptaLatest?.score == null
          ? "-"
          : formatNumber(summary.samaptaLatest.score, 2),
      activities: visibleCategories.flatMap((category) =>
        category.records.map((item) => ({
          date: formatDate(item.activity_date),
          category: category.name,
          status: item.status || "-",
          description: item.description || "",
          distance:
            category.name === "Fisik" &&
            Number(item.distance_km) > 0
              ? formatNumber(item.distance_km, 3)
              : null,
        }))
      ),
    };
  };

  function downloadPdf() {
    try {
      setError("");
      createWeeklyPdf(buildReport());
    } catch (err) {
      setError(err.message || "Gagal membuat PDF.");
    }
  }

  function printReport() {
    window.print();
  }

  function goBack() {
    router.back();
  }

  const css = `
    .wm-page {
      min-height: 100vh;
      background: #f5f7fb;
      color: #17243b;
      padding: 28px 18px 60px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .wm-shell {
      max-width: 1120px;
      margin: 0 auto;
    }
    .wm-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 22px;
    }
    .wm-eyebrow {
      color: #5274a8;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 7px;
    }
    .wm-title {
      font-size: clamp(23px, 3vw, 31px);
      font-weight: 800;
      margin: 0 0 8px;
    }
    .wm-subtitle {
      color: #69788e;
      font-size: 14px;
      line-height: 1.6;
    }
    .wm-actions {
      display: flex;
      gap: 9px;
      flex-wrap: wrap;
    }
    .wm-button {
      border: 1px solid #d9e2ef;
      border-radius: 11px;
      background: white;
      color: #263d60;
      padding: 11px 15px;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
    }
    .wm-button:hover { background: #eef3fa; }
    .wm-button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }
    .wm-primary {
      background: #174b91;
      border-color: #174b91;
      color: white;
    }
    .wm-primary:hover { background: #113f7d; }
    .wm-card {
      background: white;
      border: 1px solid #e3e9f1;
      border-radius: 17px;
      padding: 22px;
      box-shadow: 0 4px 16px rgba(26,52,88,.035);
    }
    .wm-profile {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .wm-profile-name {
      font-size: 19px;
      font-weight: 800;
    }
    .wm-muted {
      color: #718096;
      font-size: 13px;
      line-height: 1.6;
    }
    .wm-pill {
      border-radius: 30px;
      padding: 7px 12px;
      background: #edf4ff;
      color: #1c5eac;
      font-size: 12px;
      font-weight: 800;
    }
    .wm-weekbar {
      display: flex;
      align-items: center;
      gap: 11px;
      flex-wrap: wrap;
      justify-content: space-between;
    }
    .wm-week-select {
      min-width: 145px;
      border: 1px solid #d8e2ed;
      border-radius: 10px;
      background: #fff;
      padding: 11px;
      font-weight: 750;
      color: #243a5d;
    }
    .wm-controlgroup {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 9px;
    }
    .wm-date {
      margin-top: 10px;
      font-size: 12px;
      color: #77869a;
    }
    .wm-stats {
      display: grid;
      grid-template-columns: repeat(4,minmax(0,1fr));
      gap: 14px;
      margin: 18px 0;
    }
    .wm-stat {
      border: 1px solid #e4eaf3;
      background: #fff;
      padding: 19px;
      border-radius: 15px;
    }
    .wm-stat-label {
      color: #75849a;
      font-size: 12px;
      font-weight: 650;
      margin-bottom: 9px;
    }
    .wm-stat-value {
      font-size: 28px;
      font-weight: 850;
      color: #173e78;
    }
    .wm-stat small {
      display: block;
      margin-top: 5px;
      color: #8492a6;
      font-size: 11px;
    }
    .wm-sectionhead {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 18px;
    }
    .wm-section-title {
      font-size: 18px;
      font-weight: 800;
      margin: 0;
    }
    .wm-category-list {
      display: grid;
      gap: 12px;
    }
    .wm-category {
      border: 1px solid #e3e9f1;
      border-radius: 14px;
      padding: 17px;
      background: #fcfdff;
    }
    .wm-cat-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .wm-cat-name {
      font-weight: 800;
      font-size: 15px;
    }
    .wm-cat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 39px;
      height: 39px;
      border-radius: 11px;
      background: #edf3fb;
      margin-right: 11px;
      font-size: 19px;
    }
    .wm-cat-info {
      display: flex;
      align-items: center;
    }
    .wm-cat-badge {
      color: #537297;
      background: #eef3f9;
      border-radius: 20px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 750;
    }
    .wm-cat-stats {
      display: grid;
      grid-template-columns: repeat(4,minmax(0,1fr));
      gap: 9px;
      margin-bottom: 13px;
    }
    .wm-cat-stat {
      background: #f2f5fa;
      border-radius: 9px;
      text-align: center;
      padding: 10px 5px;
    }
    .wm-cat-stat b {
      display: block;
      font-size: 18px;
      margin-bottom: 5px;
    }
    .wm-cat-stat span {
      font-size: 11px;
      color: #76859a;
    }
    .wm-progress {
      width: 100%;
      height: 9px;
      border-radius: 20px;
      overflow: hidden;
      background: #e5eaf2;
    }
    .wm-progress-fill {
      height: 100%;
      border-radius: 20px;
      background: linear-gradient(90deg,#2263b7,#27a5c5);
    }
    .wm-progress-label {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 11px;
      color: #7a8799;
    }
    .wm-assessments {
      display: grid;
      grid-template-columns: repeat(3,minmax(0,1fr));
      gap: 14px;
      margin-top: 16px;
    }
    .wm-assessment-value {
      font-size: 25px;
      font-weight: 850;
      color: #183e78;
      margin: 12px 0 8px;
    }
    .wm-assessment-title {
      font-size: 15px;
      font-weight: 800;
    }
    .wm-activity {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid #e9edf4;
      padding: 12px 0;
    }
    .wm-activity:last-child { border: none; }
    .wm-activity-title {
      font-size: 13px;
      font-weight: 750;
    }
    .wm-activity-description {
      margin-top: 5px;
      color: #76849a;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .wm-verified { color: #14845a; }
    .wm-pending { color: #bf7e16; }
    .wm-empty {
      padding: 22px;
      text-align: center;
      color: #8491a3;
      font-size: 13px;
      background: #f7f9fc;
      border-radius: 12px;
    }
    .wm-alert {
      background: #fff3f1;
      color: #af392e;
      border: 1px solid #f2d4d0;
      border-radius: 12px;
      padding: 13px 16px;
      margin-bottom: 15px;
      font-size: 13px;
    }
    .wm-footer {
      color: #8c98a8;
      text-align: center;
      font-size: 12px;
      margin-top: 24px;
    }
    .wm-mt { margin-top: 18px; }
    @media(max-width:720px) {
      .wm-page { padding: 15px 11px 45px; }
      .wm-card { padding: 16px; }
      .wm-stats { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .wm-assessments { grid-template-columns: 1fr; }
      .wm-cat-stats { gap: 5px; }
      .wm-cat-stat b { font-size: 16px; }
      .wm-cat-stat span { font-size: 10px; }
      .wm-button { padding: 10px 12px; }
      .wm-actions { width: 100%; }
      .wm-weekbar { align-items: stretch; }
      .wm-controlgroup { width: 100%; }
      .wm-week-select { flex: 1; }
    }
    @media print {
      @page { size: A4; margin: 14mm; }
      body { background: white !important; }
      .wm-page { background: white; padding: 0; }
      .wm-shell { max-width: none; }
      .wm-no-print { display: none !important; }
      .wm-card, .wm-category, .wm-stat {
        box-shadow: none !important;
        break-inside: avoid;
      }
      .wm-stats {
        grid-template-columns: repeat(4,minmax(0,1fr));
      }
      .wm-assessments {
        grid-template-columns: repeat(3,minmax(0,1fr));
      }
    }
  `;

  if (loading) {
    return (
      <main className="wm-page">
        <style>{css}</style>
        <div className="wm-shell">
          <div className="wm-card">
            <h2>OJT MineTrack</h2>
            <p className="wm-muted">
              Memuat Evaluasi Mingguan...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!program) {
    return (
      <main className="wm-page">
        <style>{css}</style>
        <div className="wm-shell">
          <div className="wm-card">
            <h2>Evaluasi Mingguan Tidak Dapat Ditampilkan</h2>
            <p className="wm-alert">
              {error || "Data program tidak tersedia."}
            </p>
            <button className="wm-button" onClick={goBack}>
              ← Kembali
            </button>
          </div>
        </div>
      </main>
    );
  }

  const periodText = period
    ? `${formatDate(period.start)} – ${formatDate(period.end)}`
    : "-";

  return (
    <main className="wm-page">
      <style>{css}</style>

      <div className="wm-shell">
        <header className="wm-top">
          <div>
            <div className="wm-eyebrow">
              OJT MineTrack v2.0
            </div>
            <h1 className="wm-title">
              Evaluasi Mingguan
            </h1>
            <div className="wm-subtitle">
              Monitoring pencapaian dan penilaian berdasarkan
              minggu OJT yang dipilih.
            </div>
          </div>

          <div className="wm-actions wm-no-print">
            <button className="wm-button" onClick={goBack}>
              ← Kembali
            </button>

            <button
              className="wm-button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing ? "Memperbarui..." : "↻ Refresh"}
            </button>

            <button
              className="wm-button"
              onClick={printReport}
            >
              Cetak Rekap
            </button>

            <button
              className="wm-button wm-primary"
              onClick={downloadPdf}
            >
              ↓ Unduh PDF
            </button>
          </div>
        </header>

        {error && <div className="wm-alert">{error}</div>}

        <section className="wm-card">
          <div className="wm-profile">
            <div>
              <div className="wm-muted">Nama Peserta</div>
              <div className="wm-profile-name">
                {participantName}
              </div>
              <div className="wm-muted">
                Site: {program.site || "-"} ·{" "}
                {program.peserta?.department || "OJT"}
              </div>
            </div>

            <span className="wm-pill">
              {role === "admin"
                ? "Admin"
                : role === "mentor"
                ? "Mentor"
                : "Peserta"}
            </span>
          </div>

          <div className="wm-weekbar">
            <div className="wm-controlgroup">
              <button
                className="wm-button wm-no-print"
                disabled={selectedWeek <= 1}
                onClick={() =>
                  setSelectedWeek((week) => Math.max(1, week - 1))
                }
              >
                ← Sebelumnya
              </button>

              <select
                className="wm-week-select wm-no-print"
                value={selectedWeek}
                onChange={(event) =>
                  setSelectedWeek(Number(event.target.value))
                }
              >
                {Array.from(
                  { length: TOTAL_WEEKS },
                  (_, index) => index + 1
                ).map((week) => (
                  <option key={week} value={week}>
                    {weekLabel(week)}
                    {activityWeeks.has(week) ? " •" : ""}
                  </option>
                ))}
              </select>

              <button
                className="wm-button wm-no-print"
                disabled={selectedWeek >= TOTAL_WEEKS}
                onClick={() =>
                  setSelectedWeek((week) =>
                    Math.min(TOTAL_WEEKS, week + 1)
                  )
                }
              >
                Berikutnya →
              </button>

              <strong className="wm-muted">
                {weekLabel(selectedWeek)}
              </strong>
            </div>

            <select
              className="wm-week-select wm-no-print"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">Semua Kategori</option>
              <option value="active">Ada Aktivitas</option>
              <option value="empty">Belum Ada Aktivitas</option>
            </select>
          </div>

          <div className="wm-date">
            Periode: {periodText}
          </div>
        </section>

        <section className="wm-stats">
          <div className="wm-stat">
            <div className="wm-stat-label">
              Total Achievement
            </div>
            <div className="wm-stat-value">
              {summary.total}
            </div>
            <small>{weekLabel(selectedWeek)}</small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Verified
            </div>
            <div className="wm-stat-value">
              {summary.verified}
            </div>
            <small>Sudah diverifikasi</small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Pending
            </div>
            <div className="wm-stat-value">
              {summary.pending}
            </div>
            <small>Menunggu verifikasi</small>
          </div>

          <div className="wm-stat">
            <div className="wm-stat-label">
              Persentase Verifikasi
            </div>
            <div className="wm-stat-value">
              {summary.progress}%
            </div>
            <small>
              Verified / Total Achievement
            </small>
          </div>
        </section>

        <section className="wm-card">
          <div className="wm-sectionhead">
            <div>
              <h2 className="wm-section-title">
                Monitoring per Kategori
              </h2>
              <div className="wm-muted">
                Pencapaian Achievement selama{" "}
                {weekLabel(selectedWeek)}
              </div>
            </div>
            <span className="wm-pill">
              {visibleCategories.length} Kategori
            </span>
          </div>

          {visibleCategories.length === 0 ? (
            <div className="wm-empty">
              Tidak ada kategori sesuai filter.
            </div>
          ) : (
            <div className="wm-category-list">
              {visibleCategories.map((category) => (
                <div
                  className="wm-category"
                  key={category.name}
                >
                  <div className="wm-cat-top">
                    <div className="wm-cat-info">
                      <span className="wm-cat-icon">
                        {category.icon}
                      </span>
                      <div>
                        <div className="wm-cat-name">
                          {category.name}
                        </div>
                        <div className="wm-muted">
                          {category.total
                            ? `${category.total} kegiatan tercatat`
                            : "Belum ada kegiatan"}
                        </div>
                      </div>
                    </div>

                    <span className="wm-cat-badge">
                      {category.progress}% Verified
                    </span>
                  </div>

                  <div className="wm-cat-stats">
                    <div className="wm-cat-stat">
                      <b>{category.total}</b>
                      <span>Total</span>
                    </div>
                    <div className="wm-cat-stat">
                      <b>{category.verified}</b>
                      <span>Verified</span>
                    </div>
                    <div className="wm-cat-stat">
                      <b>{category.pending}</b>
                      <span>Pending</span>
                    </div>
                    <div className="wm-cat-stat">
                      <b>{category.progress}%</b>
                      <span>Progress</span>
                    </div>
                  </div>

                  <div
                    className="wm-progress"
                    role="progressbar"
                    aria-label={`Verifikasi ${category.name}`}
                    aria-valuenow={category.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="wm-progress-fill"
                      style={{
                        width: `${category.progress}%`,
                      }}
                    />
                  </div>

                  <div className="wm-progress-label">
                    <span>Belum terverifikasi</span>
                    <span>
                      {category.verified}/{category.total} Verified
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="wm-assessments">
          <div className="wm-card">
            <div className="wm-assessment-title">
              📘 Post-Test
            </div>
            <div className="wm-assessment-value">
              {summary.postAverage === null
                ? "-"
                : formatNumber(summary.postAverage, 2)}
            </div>
            <div className="wm-muted">
              Rata-rata nilai pada minggu ini
            </div>
            <div className="wm-date">
              {weeklyPostTests.length} nilai tercatat
            </div>
          </div>

          <div className="wm-card">
            <div className="wm-assessment-title">
              📝 Praktik
            </div>
            <div className="wm-assessment-value">
              {summary.practiceAverage === null
                ? "-"
                : formatNumber(summary.practiceAverage, 2)}
            </div>
            <div className="wm-muted">
              Rata-rata nilai pada minggu ini
            </div>
            <div className="wm-date">
              {weeklyPractices.length} penilaian tercatat
            </div>
          </div>

          <div className="wm-card">
            <div className="wm-assessment-title">
              🏃 Samapta
            </div>
            <div className="wm-assessment-value">
              {summary.samaptaLatest?.score == null
                ? "-"
                : formatNumber(
                    summary.samaptaLatest.score,
                    2
                  )}
            </div>
            <div className="wm-muted">
              Nilai catatan terbaru minggu ini
            </div>
            <div className="wm-date">
              {weeklySamapta.length} catatan tercatat
            </div>
          </div>
        </section>

        <section className="wm-card wm-mt">
          <div className="wm-sectionhead">
            <div>
              <h2 className="wm-section-title">
                Riwayat Achievement Mingguan
              </h2>
              <div className="wm-muted">
                Detail kegiatan sesuai minggu dan filter
              </div>
            </div>

            <span className="wm-pill">
              {visibleCategories.reduce(
                (sum, item) => sum + item.total,
                0
              )}{" "}
              Kegiatan
            </span>
          </div>

          {visibleCategories.every(
            (category) => category.records.length === 0
          ) ? (
            <div className="wm-empty">
              Belum ada Achievement sesuai filter pada{" "}
              {weekLabel(selectedWeek)}.
            </div>
          ) : (
            visibleCategories.flatMap((category) =>
              category.records.map((item) => (
                <div
                  className="wm-activity"
                  key={`${category.name}-${item.id}`}
                >
                  <div>
                    <div className="wm-activity-title">
                      {category.icon} {category.name} ·{" "}
                      {formatDate(item.activity_date)}
                    </div>

                    {item.description && (
                      <div className="wm-activity-description">
                        {item.description}
                      </div>
                    )}

                    {category.name === "Fisik" &&
                      Number(item.distance_km) > 0 && (
                        <div className="wm-activity-description">
                          Jarak:{" "}
                          {formatNumber(item.distance_km, 3)} km
                        </div>
                      )}
                  </div>

                  <strong
                    className={
                      isVerified(item)
                        ? "wm-verified"
                        : "wm-pending"
                    }
                    style={{ fontSize: 12 }}
                  >
                    {isVerified(item)
                      ? "Verified"
                      : normalize(item.status) === "pending"
                      ? "Pending"
                      : item.status || "-"}
                  </strong>
                </div>
              ))
            )
          )}
        </section>

        <section className="wm-card wm-mt">
          <h2 className="wm-section-title">
            Kesimpulan Mingguan
          </h2>

          <p className="wm-muted" style={{ marginTop: 12 }}>
            Pada {weekLabel(selectedWeek)} ({periodText}),
            tercatat <b>{summary.total} Achievement</b>,
            terdiri dari <b>{summary.verified} Verified</b>{" "}
            dan <b>{summary.pending} Pending</b>.
            Persentase verifikasi sebesar{" "}
            <b>{summary.progress}%</b>.
          </p>

          <p className="wm-muted">
            {weekHasActivity
              ? "Data yang ditampilkan hanya berasal dari " +
                "minggu terpilih. Ringkasan Post-Test, Praktik, " +
                "dan Samapta mengikuti tanggal masing-masing " +
                "penilaian."
              : "Belum terdapat aktivitas Achievement, " +
                "Post-Test, Praktik, atau Samapta " +
                "pada minggu ini."}
          </p>
        </section>

        <div className="wm-footer">
          OJT MineTrack v2.0 · Evaluasi Mingguan ·{" "}
          {weekLabel(selectedWeek)}
        </div>
      </div>
    </main>
  );
}
