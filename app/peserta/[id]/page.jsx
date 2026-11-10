
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ======================================================
// OJT MINETRACK V2.0
// DETAIL PESERTA — LIGHT / DARK MODE — HEADER REVISED
//
// DIPERTAHANKAN:
// - Database dan nama tabel
// - Rumus Achievement
// - Rumus rata-rata Post-Test
// - Kalender Global Week 01–25
// - Hak akses Admin / Mentor
// - Input, Edit, Hapus Post-Test
// - Dropdown 10 Materi Post-Test
// - Seluruh 9 menu akses cepat
// - Navigasi Praktik, SIMPER, Samapta
// - Tampilan desktop dan mobile
//
// TEMA:
// - Mengikuti html[data-theme]
// - Tidak menambahkan tombol tema
// - Tidak mengubah localStorage atau RootLayout
//
// Nama materi tetap disimpan pada kolom notes.
// Tidak memerlukan migrasi database.
// ======================================================

const POST_TEST_MATERIALS = [
  "HAR",
  "Fire",
  "Hazmat",
  "CSR",
  "Navigasi Darat",
  "Water Rescue",
  "Medical",
  "CSSR",
  "Size Up",
  "RAR",
];

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "🎓" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "📍" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

// ======================================================
// POST-TEST NOTES
// ======================================================

const POSTTEST_REVIEW_RE = /\[\[OJT_POSTTEST_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_REVIEW_RE = /\[\[OJT_SAMAPTA_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_COMPONENTS = ["Lari 12 Menit", "Pull-Up", "Push-Up", "Sit-Up", "Shuttle Run"];

function buildTestNotes(material, description) {
  const cleanMaterial = String(material || "").trim();
  const cleanDescription = String(description || "").trim();

  return cleanDescription
    ? `Materi: ${cleanMaterial}\n${cleanDescription}`
    : `Materi: ${cleanMaterial}`;
}

function readReviewMetadata(value, regex) {
  let metadata = null;
  for (const match of String(value || "").matchAll(new RegExp(regex.source, "g"))) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (parsed && typeof parsed === "object") metadata = parsed;
    } catch {
      // Metadata lama/tidak valid tidak menggagalkan halaman.
    }
  }
  return metadata;
}

function appendReviewMetadata(value, markerName, regex, metadata) {
  const clean = String(value || "").replace(new RegExp(regex.source, "g"), "").trim();
  const marker = `[[${markerName}:${encodeURIComponent(JSON.stringify(metadata))}]]`;
  return [clean, marker].filter(Boolean).join("\n");
}

function isPostTestPending(item) {
  return readReviewMetadata(item?.notes, POSTTEST_REVIEW_RE)?.status === "pending";
}

function isPostTestVerified(item) {
  // Record lama tanpa metadata approval tetap dianggap Verified.
  return !isPostTestPending(item);
}

function isSamaptaPending(record) {
  return readReviewMetadata(record?.notes, SAMAPTA_REVIEW_RE)?.status === "pending";
}

function samaptaSessionCounts(records) {
  const groups = new Map();
  for (const record of records || []) {
    const date = String(record.test_date || "").slice(0, 10);
    if (!date) continue;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(record);
  }

  let verified = 0;
  let pending = 0;
  for (const rows of groups.values()) {
    const names = new Set(rows.map((row) => String(row.test_type || "").toLowerCase().replace(/[^a-z0-9]/g, "")));
    const complete = rows.length === SAMAPTA_COMPONENTS.length && SAMAPTA_COMPONENTS.every((name) => names.has(name.toLowerCase().replace(/[^a-z0-9]/g, "")));
    if (rows.some(isSamaptaPending)) pending += 1;
    else if (complete) verified += 1;
  }
  return { verified, pending };
}

function parseTestNotes(value) {
  const text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(new RegExp(POSTTEST_REVIEW_RE.source, "g"), "");
  const lines = text.split("\n");
  const firstLine = lines[0]?.trim() || "";

  const match = firstLine.match(/^Materi:\s*(.+)$/i);

  if (match) {
    const candidate = match[1].trim();

    if (POST_TEST_MATERIALS.includes(candidate)) {
      return {
        material: candidate,
        description: lines.slice(1).join("\n").trim(),
      };
    }
  }

  return {
    material: "",
    description: text,
  };
}

// ======================================================
// GENERAL HELPERS
// ======================================================

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseDate(value) {
  const match = String(value ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function addDays(value, days) {
  const date = parseDate(value);

  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

// ======================================================
// GLOBAL CALENDAR — 25 WEEKS
// ======================================================

const GLOBAL_WEEKS = Array.from(
  { length: 25 },
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
      (item) => date >= item.start && date <= item.end
    )?.week ?? null
  );
}

function programWeekRange(program, weekNumber) {
  const selected = GLOBAL_WEEKS[Number(weekNumber) - 1];

  if (!selected || !parseDate(program?.start_date)) {
    return null;
  }

  const programStart = String(program.start_date).slice(0, 10);

  const programEnd = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start =
    selected.start > programStart
      ? selected.start
      : programStart;

  const end =
    programEnd && programEnd < selected.end
      ? programEnd
      : selected.end;

  return start <= end ? { start, end } : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);

  if (!parseDate(date) || !parseDate(program?.start_date)) {
    return false;
  }

  return (
    date >= String(program.start_date).slice(0, 10) &&
    (
      !parseDate(program.end_date) ||
      date <= String(program.end_date).slice(0, 10)
    ) &&
    globalWeekOf(date) !== null
  );
}

function todayWITA() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Makassar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value || "";

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

function num(value, digits = 2) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "—";
}

function scoreText(value) {
  return value === null ||
    value === undefined ||
    value === ""
    ? "—"
    : num(value, 2);
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}

function categoryOf(value) {
  const key = normalize(value);

  if (["fisik", "physical"].includes(key)) {
    return "Fisik";
  }

  if (
    ["training", "internaltraining", "pelatihan"].includes(key)
  ) {
    return "Training";
  }

  if (
    ["sosialisasi", "socialization"].includes(key)
  ) {
    return "Sosialisasi";
  }

  if (["coaching", "pembinaan"].includes(key)) {
    return "Coaching";
  }

  if (
    ["orientasi", "orientasiarea", "areaorientation"].includes(key)
  ) {
    return "Orientasi Area";
  }

  if (
    ["hazard", "hazardidentification", "identifikasibahaya"]
      .includes(key)
  ) {
    return "Hazard";
  }

  return null;
}

function initialWeek(program, records) {
  const available = GLOBAL_WEEKS.filter(
    (item) => programWeekRange(program, item.week)
  );

  if (!available.length) return 1;

  const now = todayWITA();

  const current = available.find((item) => {
    const range = programWeekRange(program, item.week);

    return range && now >= range.start && now <= range.end;
  });

  if (current) return current.week;

  const recorded = records
    .filter((item) => insideProgram(item.activity_date, program))
    .map((item) => globalWeekOf(item.activity_date))
    .filter((week) =>
      available.some((item) => item.week === week)
    );

  if (recorded.length) {
    return Math.max(...recorded);
  }

  return (
    available.find((item) => item.start > now)?.week ||
    available[available.length - 1].week
  );
}

function averageScore(rows) {
  const scores = rows
    .map((row) => row.score)
    .filter(
      (value) =>
        value !== null &&
        value !== undefined &&
        value !== ""
    )
    .map(Number)
    .filter(Number.isFinite);

  return scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
}

// ======================================================
// COMPONENTS
// ======================================================

function ProgressBar({ value }) {
  const safe = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div
      className="dp-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safe}
    >
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  subtitle,
  tone = "green",
  onClick,
}) {
  return (
    <button
      type="button"
      className="dp-module"
      onClick={onClick}
    >
      <span className={`dp-module-icon ${tone}`}>
        {icon}
      </span>

      <span className="dp-module-text">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>

      <span className="dp-chevron">›</span>
    </button>
  );
}

// ======================================================
// MAIN PAGE
// ======================================================

export default function DetailPeserta() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [manager, setManager] = useState(null);
  const [program, setProgram] = useState(null);

  const [types, setTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practice, setPractice] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState(null);

  const [week, setWeek] = useState(1);
  const [panel, setPanel] = useState("dashboard");

  // POST-TEST FORM

  const [testDate, setTestDate] = useState(todayWITA());
  const [testMaterial, setTestMaterial] = useState("");
  const [testScore, setTestScore] = useState("");
  const [testNotes, setTestNotes] = useState("");
  const [editTestId, setEditTestId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [testActionId, setTestActionId] = useState(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = roleOf(manager?.role) === "admin";
  const verifiedPostTests = postTests.filter(isPostTestVerified);
  const pendingPostTestCount = postTests.length - verifiedPostTests.length;
  const samaptaSessionSummary = samaptaSessionCounts(samapta);

  // ====================================================
  // SUPABASE — EXISTING QUERIES
  // ====================================================

  async function fetchRecords(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,distance_km,status"
        )
        .eq("program_id", id)
        .order("activity_date", { ascending: false }),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes,created_at")
        .eq("program_id", id)
        .order("test_date", { ascending: false }),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value,notes"
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

    const labels = [
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

    return {
      achievements: results[0].data || [],
      postTests: results[1].data || [],
      practice: results[2].data || [],
      samapta: results[3].data || [],
      simper: results[4].data || null,
    };
  }

  function applyRecords(data) {
    setAchievements(data.achievements);
    setPostTests(data.postTests);
    setPractice(data.practice);
    setSamapta(data.samapta);
    setSimper(data.simper);
  }

  // ====================================================
  // AUTHENTICATION / ACCESS
  // ====================================================

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

        if (profileError) throw profileError;

        const role = roleOf(profile?.role);

        if (["participant", "peserta"].includes(role)) {
          router.replace("/dashboard-peserta");
          return;
        }

        if (!["admin", "mentor"].includes(role)) {
          throw new Error(
            "Halaman hanya tersedia untuk Admin dan Mentor."
          );
        }

        let query = supabase
          .from("ojt_programs")
          .select(`
            id,
            site,
            mentor_id,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("id", programId);

        if (role === "mentor") {
          query = query.eq("mentor_id", user.id);
        }

        const {
          data: programData,
          error: programError,
        } = await query.maybeSingle();

        if (programError) throw programError;

        if (
          !programData ||
          !parseDate(programData.start_date)
        ) {
          throw new Error(
            "Program tidak ditemukan, akses ditolak, atau tanggal mulai tidak valid."
          );
        }

        const [typeResult, records] = await Promise.all([
          supabase
            .from("achievement_types")
            .select("code,name")
            .order("name"),

          fetchRecords(programId),
        ]);

        if (typeResult.error) throw typeResult.error;

        if (!active) return;

        setManager(profile);
        setProgram(programData);
        setTypes(typeResult.data || []);

        applyRecords(records);

        setWeek(
          initialWeek(
            programData,
            records.achievements
          )
        );
      } catch (err) {
        if (active) {
          setError(
            err?.message || "Gagal memuat data peserta."
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

  // ====================================================
  // REFRESH
  // ====================================================

  async function refresh() {
    if (
      refreshing ||
      loading ||
      !manager ||
      !program
    ) {
      return;
    }

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      applyRecords(await fetchRecords(programId));
    } catch (err) {
      setError(
        err?.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openPanel(name) {
    setPanel(name);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ====================================================
  // POST-TEST CRUD
  // ====================================================

  async function reloadTests() {
    const { data, error: err } = await supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes,created_at")
      .eq("program_id", programId)
      .order("test_date", { ascending: false });

    if (err) throw err;

    setPostTests(data || []);
  }

  function resetTest() {
    setEditTestId(null);
    setTestDate(todayWITA());
    setTestMaterial("");
    setTestScore("");
    setTestNotes("");
  }

  async function saveTest(event) {
    event.preventDefault();

    if (
      !manager ||
      !program ||
      savingTest ||
      testActionId
    ) {
      return;
    }

    const score = Number(testScore);

    if (
      !parseDate(testDate) ||
      testScore.trim() === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      setError(
        "Tanggal dan nilai Post-Test harus valid (0–100)."
      );
      return;
    }

    if (!insideProgram(testDate, program)) {
      setError(
        "Tanggal Post-Test harus termasuk Kalender Global dan periode OJT peserta."
      );
      return;
    }

    if (!POST_TEST_MATERIALS.includes(testMaterial)) {
      setError(
        "Silakan pilih materi Post-Test terlebih dahulu."
      );
      return;
    }

    if (
      editTestId &&
      !postTests.some(
        (item) => String(item.id) === String(editTestId)
      )
    ) {
      setError(
        "Data Post-Test yang akan diedit tidak ditemukan."
      );
      return;
    }

    setSavingTest(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        test_date: testDate,
        score,
        notes: appendReviewMetadata(
          buildTestNotes(testMaterial, testNotes),
          "OJT_POSTTEST_REVIEW_V1",
          POSTTEST_REVIEW_RE,
          {
            status: "pending",
            submittedBy: manager.id,
            submittedAt: new Date().toISOString(),
          }
        ),
      };

      const result = editTestId
        ? await supabase
            .from("post_test_scores")
            .update(payload)
            .eq("id", editTestId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("post_test_scores")
            .insert({
              ...payload,
              program_id: programId,
              created_by: manager.id,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error(
          "Post-Test tidak tersimpan. Periksa izin database."
        );
      }

      const wasEditing = Boolean(editTestId);

      await reloadTests();
      resetTest();

      setMessage(
        wasEditing
          ? "Perubahan nilai Post-Test berhasil disimpan."
          : `Nilai Post-Test materi ${testMaterial} berhasil disimpan.`
      );
    } catch (err) {
      setError(
        err?.message || "Gagal menyimpan Post-Test."
      );
    } finally {
      setSavingTest(false);
    }
  }

  function editTest(item) {
    if (savingTest || testActionId) return;

    const parsed = parseTestNotes(item.notes);

    setEditTestId(item.id);
    setTestDate(item.test_date || todayWITA());
    setTestMaterial(parsed.material);

    setTestScore(
      item.score == null ? "" : String(item.score)
    );

    setTestNotes(parsed.description);

    openPanel("posttest");
  }

  async function deleteTest(item) {
    if (
      !manager ||
      !program ||
      savingTest ||
      testActionId ||
      !window.confirm("Hapus nilai Post-Test ini?")
    ) {
      return;
    }

    setTestActionId(item.id);
    setError("");
    setMessage("");

    try {
      const { data, error: err } = await supabase
        .from("post_test_scores")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error(
          "Post-Test tidak terhapus. Periksa izin database."
        );
      }

      if (editTestId === item.id) {
        resetTest();
      }

      await reloadTests();

      setMessage("Post-Test berhasil dihapus.");
    } catch (err) {
      setError(
        err?.message || "Gagal menghapus Post-Test."
      );
    } finally {
      setTestActionId(null);
    }
  }

  // ====================================================
  // GLOBAL WEEK
  // ====================================================

  const availableWeeks = useMemo(
    () =>
      GLOBAL_WEEKS.filter(
        (item) => programWeekRange(program, item.week)
      ),
    [program]
  );

  const selectedGlobalWeek = GLOBAL_WEEKS[week - 1];

  const selectedProgramRange = programWeekRange(
    program,
    week
  );

  // ====================================================
  // WEEKLY ACHIEVEMENT
  // ====================================================

  const weekly = useMemo(() => {
    const rows = achievements.filter(
      (item) =>
        insideProgram(item.activity_date, program) &&
        globalWeekOf(item.activity_date) === week
    );

    const verified = rows.filter(
      (item) => roleOf(item.status) === "verified"
    );

    const pending = rows.filter(
      (item) => roleOf(item.status) === "pending"
    );

    const typeMap = new Map(
      types.map((item) => [
        normalize(item.code),
        categoryOf(item.code) || categoryOf(item.name),
      ])
    );

    const categories = TARGETS.map((target) => {
      const matching = verified.filter((item) => {
        const category =
          typeMap.get(normalize(item.type_code)) ||
          categoryOf(item.type_code);

        return category === target.name;
      });

      const actual =
        target.name === "Fisik"
          ? matching.reduce((sum, item) => {
              const distance = Number(item.distance_km);

              return sum + (
                Number.isFinite(distance) && distance > 0
                  ? Math.round(distance * 1000)
                  : 0
              );
            }, 0) / 1000
          : matching.length;

      const percent = Math.min(
        100,
        Math.max(0, (actual / target.target) * 100)
      );

      return {
        ...target,
        actual,
        count: matching.length,
        percent,
        achieved: actual >= target.target,
      };
    });

    const overall =
      categories.reduce(
        (sum, item) => sum + item.percent,
        0
      ) / categories.length;

    return {
      categories,
      overall,
      achieved: categories.filter(
        (item) => item.achieved
      ).length,
      verified: verified.length,
      pending: pending.length,
      total: rows.length,
    };
  }, [achievements, types, program, week]);

  // ====================================================
  // PARTICIPANT IDENTITY
  // ====================================================

  const participant = Array.isArray(program?.peserta)
    ? program.peserta[0]
    : program?.peserta;

  const participantName =
    participant?.full_name || "Peserta OJT";

  const roleName = isAdmin
    ? "Administrator"
    : "Mentor OJT";

  const accountName =
    manager?.full_name || roleName;

  // ====================================================
  // QUICK ACCESS — 9 MENUS
  // ====================================================

  const menus = [
    {
      title: "Monitoring OJT",
      subtitle: "Seluruh kegiatan pelaksanaan OJT",
      icon: "📊",
      tone: "green",
      route: `/monitoring/${programId}`,
    },
    {
      title: "Samapta",
      subtitle: `${samaptaSessionSummary.verified} sesi Verified · ${samaptaSessionSummary.pending} Pending`,
      icon: "🏃",
      tone: "amber",
      route: `/samapta/${programId}`,
    },
    {
      title: "Post-Test",
      subtitle: `${verifiedPostTests.length} Verified · ${pendingPostTestCount} Pending`,
      icon: "📘",
      tone: "blue",
      panel: "posttest",
    },
    {
      title: "SIMPER",
      subtitle: simper ? "Data tersedia" : "Belum ada data",
      icon: "🪪",
      tone: "purple",
      route: `/simper/${programId}`,
    },
    {
      title: "Praktik Mingguan",
      subtitle: `${practice.length} penilaian`,
      icon: "🛠️",
      tone: "rose",
      route: `/praktik/${programId}`,
    },
    {
      title: "Evaluasi Mingguan",
      subtitle:
        `Week ${String(week).padStart(2, "0")} · ` +
        `${num(weekly.overall)}%`,
      icon: "📅",
      tone: "teal",
      route: `/mingguan/${programId}`,
    },
    {
      title: "Rapor OJT",
      subtitle: "Laporan dan cetak PDF",
      icon: "📄",
      tone: "blue",
      route: `/laporan/${programId}`,
    },
    {
      title: "Grafik Perkembangan",
      subtitle: "Analisis perkembangan",
      icon: "📈",
      tone: "purple",
      route: `/analisis/${programId}`,
    },
    {
      title: "Evaluasi Kesiapan",
      subtitle: "Kelengkapan indikator",
      icon: "✅",
      tone: "green",
      route: `/evaluasi/${programId}`,
    },
  ];

  // ====================================================
  // LOADING / ERROR
  // ====================================================

  if (loading) {
    return (
      <main className="dp-loading">
        <style>{css}</style>

        <h2>OJT MineTrack</h2>
        <p>Memuat Detail Peserta...</p>
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="dp-loading">
        <style>{css}</style>

        <h2>Detail Peserta Tidak Dapat Ditampilkan</h2>

        <p>{error || "Akses tidak tersedia."}</p>

        <button
          type="button"
          onClick={() => router.push("/")}
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  // ====================================================
  // MAIN UI
  // ====================================================

  return (
    <div className="dp-app">
      <style>{css}</style>

      <main className="dp-content">

        {/* ============================================
            ACCOUNT IDENTITY — TOP RIGHT
            ============================================ */}

        <div className="dp-account-corner">
          <div className="dp-top-account">
            <span className="dp-top-avatar">
              {initials(accountName)}
            </span>

            <div>
              <strong>{accountName}</strong>
              <small>{roleName}</small>
            </div>
          </div>
        </div>

        {/* ============================================
            PAGE TITLE
            ============================================ */}

        <div className="dp-title-row">
          <div>
            <small>
              Monitoring Kompetensi dan Evaluasi OJT
            </small>

            <h1>
              Detail <span>Peserta OJT</span>
            </h1>

            <p>
              Pantau, catat, dan evaluasi perkembangan
              peserta OJT secara terstruktur.
            </p>
          </div>

          <div className="dp-title-actions">
            <button
              type="button"
              className="dp-back-button"
              onClick={() =>
                panel === "dashboard"
                  ? router.push("/")
                  : openPanel("dashboard")
              }
            >
              ←{" "}
              {panel === "dashboard"
                ? "Dashboard"
                : "Menu Peserta"}
            </button>

            <div className="dp-week-select">
              <span>📅</span>

              <select
                aria-label="Pilih Week Global"
                value={
                  availableWeeks.some(
                    (item) => item.week === week
                  )
                    ? week
                    : ""
                }
                onChange={(event) =>
                  setWeek(Number(event.target.value))
                }
              >
                {!availableWeeks.length && (
                  <option value="">
                    Tidak ada Week Global
                  </option>
                )}

                {availableWeeks.map((item) => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    Week{" "}
                    {String(item.week).padStart(2, "0")}
                    {" · "}
                    {formatDate(item.start)}
                    {" – "}
                    {formatDate(item.end)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ============================================
            ALERTS
            ============================================ */}

        {error && (
          <div className="dp-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="dp-alert success" role="status">
            ✓ {message}
          </div>
        )}

        {/* ============================================
            PARTICIPANT PROFILE
            ============================================ */}

        <section className="dp-profile">
          <div className="dp-profile-info">
            <div className="dp-big-avatar">
              {initials(participantName)}
            </div>

            <div className="dp-profile-copy">
              <h2>{participantName}</h2>

              <p>
                {participant?.department || "—"}
                {"  |  "}
                {program.site || "—"}
              </p>

              <div className="dp-profile-facts">
                <div>
                  <span className="dp-fact-icon">
                    📅
                  </span>

                  <div>
                    <small>Periode OJT</small>

                    <strong>
                      {formatDate(program.start_date)}
                      {" – "}
                      {formatDate(program.end_date)}
                    </strong>
                  </div>
                </div>

                <div>
                  <span className="dp-fact-icon">
                    ♙
                  </span>

                  <div>
                    <small>Akses Pengelola</small>

                    <strong>
                      {roleName} · {accountName}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="dp-profile-image">
            <span className="dp-profile-badge">
              PESERTA OJT
            </span>

            <p>
              Emergency Response Group
              <br />
              PT Berau Coal
            </p>

            <span className="dp-profile-accent" />
          </div>
        </section>

        {panel === "dashboard" ? (
          <>

            {/* ========================================
                WEEKLY ACHIEVEMENT
                ======================================== */}

            <section className="dp-achievement">
              <div className="dp-achievement-overview">
                <div className="dp-week-heading">
                  <span className="dp-big-icon">
                    📊
                  </span>

                  <div>
                    <small>Capaian Achievement</small>

                    <h2>
                      Week{" "}
                      {String(week).padStart(2, "0")}
                    </h2>

                    <p>
                      {formatDate(
                        selectedGlobalWeek?.start
                      )}
                      {" – "}
                      {formatDate(
                        selectedGlobalWeek?.end
                      )}
                    </p>
                  </div>
                </div>

                <div
                  className="dp-donut"
                  style={{
                    "--progress": `${weekly.overall}%`,
                  }}
                >
                  <div>
                    <strong>
                      {num(weekly.overall)}%
                    </strong>

                    <small>
                      Rata-rata
                      <br />
                      Pencapaian
                    </small>
                  </div>
                </div>

                <div className="dp-summary green">
                  <span>✅</span>
                  <strong>
                    {weekly.verified}
                  </strong>
                  <small>Terverifikasi</small>
                </div>

                <div className="dp-summary amber">
                  <span>◷</span>
                  <strong>
                    {weekly.pending}
                  </strong>
                  <small>Menunggu</small>
                </div>

                <div className="dp-summary blue">
                  <span>▦</span>
                  <strong>
                    {weekly.achieved}/6
                  </strong>
                  <small>Kategori</small>
                </div>
              </div>

              {selectedProgramRange && (
                <div className="dp-participant-range">
                  Periode peserta pada Week ini:{" "}
                  {formatDate(
                    selectedProgramRange.start
                  )}
                  {" – "}
                  {formatDate(
                    selectedProgramRange.end
                  )}
                </div>
              )}

              {!availableWeeks.length && (
                <div className="dp-alert error">
                  Periode peserta tidak beririsan
                  dengan Kalender Global Week 01–25.
                </div>
              )}

              {/* SIX CATEGORIES */}

              <div className="dp-category-grid">
                {weekly.categories.map((item) => (
                  <div
                    className="dp-category"
                    key={item.name}
                  >
                    <div className="dp-category-title">
                      <span className="dp-category-icon">
                        {item.icon}
                      </span>

                      <strong>
                        {item.name}
                      </strong>
                    </div>

                    <div className="dp-category-value">
                      {num(item.percent)}%
                    </div>

                    <ProgressBar
                      value={item.percent}
                    />

                    <div className="dp-category-footer">
                      <span>
                        Realisasi:

                        <strong>
                          {num(
                            item.actual,
                            item.name === "Fisik" ? 3 : 0
                          )}{" "}
                          {item.unit}
                        </strong>
                      </span>

                      <span>
                        Target:

                        <strong>
                          {item.target} {item.unit}
                        </strong>
                      </span>

                      <span>
                        Kegiatan:

                        <strong>
                          {item.count}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <p className="dp-note">
                Hanya kegiatan Verified yang dihitung.
                Realisasi asli tidak dibatasi.
                Persentase setiap kategori maksimal 100%.
                Kalender Global Week 01–25.
              </p>
            </section>

            {/* ========================================
                QUICK ACCESS — 9 MENUS
                ======================================== */}

            <section
              id="dp-modules"
              className="dp-card"
            >
              <div className="dp-section-heading">
                <div>
                  <h2>
                    <span className="dp-heading-symbol">
                      ▦
                    </span>
                    Menu & Akses Cepat
                  </h2>

                  <p>
                    Kelola kegiatan, monitoring,
                    penilaian, dan laporan OJT.
                  </p>
                </div>

                <button
                  type="button"
                  className="dp-refresh"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing
                    ? "Memperbarui..."
                    : "↻ Refresh"}
                </button>
              </div>

              <div className="dp-menu-grid">
                {menus.map((item) => (
                  <ModuleCard
                    key={item.title}
                    icon={item.icon}
                    title={item.title}
                    subtitle={item.subtitle}
                    tone={item.tone}
                    onClick={() =>
                      item.route
                        ? router.push(item.route)
                        : openPanel(item.panel)
                    }
                  />
                ))}
              </div>
            </section>

            {/* ========================================
                ACHIEVEMENT INPUT
                ======================================== */}

            <section className="dp-card">
              <div className="dp-section-heading">
                <div>
                  <h2>Achievement OJT</h2>

                  <p>
                    Input kegiatan dan monitoring
                    Achievement pada halaman terpisah.
                  </p>
                </div>
              </div>

              <div className="dp-ach-actions">
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/achievement/${programId}`
                    )
                  }
                >
                  📝 Input Achievement
                  <span>›</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/achievement/${programId}/monitoring`
                    )
                  }
                >
                  📊 Monitoring Achievement
                  <span>›</span>
                </button>
              </div>
            </section>
          </>
        ) : (
          <>

            {/* ========================================
                POST-TEST FORM
                ======================================== */}

            <section className="dp-card">
              <div className="dp-section-heading">
                <div>
                  <h2>
                    Penilaian Post-Test (Teori)
                  </h2>

                  <p>
                    Pilih materi pembelajaran,
                    masukkan nilai, dan simpan hasil
                    evaluasi peserta.
                  </p>
                </div>

                <button
                  type="button"
                  className="dp-refresh"
                  onClick={() =>
                    openPanel("dashboard")
                  }
                >
                  ← Menu Peserta
                </button>
              </div>

              <div className="dp-post-stats">
                <div>
                  Total Post-Test

                  <strong>
                    {postTests.length}
                  </strong>
                  <small>{verifiedPostTests.length} Verified · {pendingPostTestCount} Pending</small>
                </div>

                <div>
                  Rata-rata Nilai Verified

                  <strong>
                    {scoreText(
                      averageScore(verifiedPostTests)
                    )}
                  </strong>
                </div>
              </div>

              <h3>
                {editTestId
                  ? "Edit Nilai Post-Test"
                  : "Input Nilai Post-Test"}
              </h3>

              <form
                onSubmit={saveTest}
                className="dp-form"
              >
                <label>
                  Tanggal Pelaksanaan

                  <input
                    type="date"
                    value={testDate}
                    onChange={(event) =>
                      setTestDate(
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                {/* 10 MATERIALS */}

                <label>
                  Materi Post-Test (Teori)

                  <select
                    value={testMaterial}
                    onChange={(event) =>
                      setTestMaterial(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      -- Pilih Materi Post-Test --
                    </option>

                    {POST_TEST_MATERIALS.map(
                      (material) => (
                        <option
                          key={material}
                          value={material}
                        >
                          {material}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <p
                  className="dp-note"
                  style={{ margin: "-5px 0 0" }}
                >
                  Tersedia 10 materi Post-Test.
                  Materi yang dipilih akan dicatat
                  bersama nilai dan catatan evaluasi.
                </p>

                <label>
                  Nilai Post-Test (0–100)

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={testScore}
                    onChange={(event) =>
                      setTestScore(
                        event.target.value
                      )
                    }
                    placeholder="Contoh: 85"
                    required
                  />
                </label>

                <label>
                  Catatan Evaluasi

                  <textarea
                    rows={4}
                    value={testNotes}
                    onChange={(event) =>
                      setTestNotes(
                        event.target.value
                      )
                    }
                    placeholder="Catatan evaluasi (opsional)..."
                  />
                </label>

                <div className="dp-form-actions">
                  <button
                    type="submit"
                    className="dp-primary"
                    disabled={
                      savingTest ||
                      Boolean(testActionId)
                    }
                  >
                    {savingTest
                      ? "Menyimpan..."
                      : editTestId
                      ? "Simpan Perubahan"
                      : "Simpan Post-Test"}
                  </button>

                  {editTestId && (
                    <button
                      type="button"
                      className="dp-secondary"
                      onClick={resetTest}
                      disabled={savingTest}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            {/* ========================================
                POST-TEST HISTORY
                ======================================== */}

            <section className="dp-card">
              <h2>Riwayat Post-Test</h2>

              {!postTests.length && (
                <p className="dp-note">
                  Belum ada Post-Test.
                </p>
              )}

              {postTests.map((item) => {
                const parsed = parseTestNotes(item.notes);

                return (
                  <div
                    className="dp-history"
                    key={item.id}
                  >
                    <div>
                      {parsed.material ? (
                        <div className="dp-material-tag">
                          📘 {parsed.material}
                        </div>
                      ) : (
                        <div className="dp-material-tag legacy">
                          Materi belum tercatat
                        </div>
                      )}

                      <span className={`dp-review-status ${isPostTestPending(item) ? "pending" : "verified"}`}>
                        {isPostTestPending(item) ? "Pending Verifikasi Admin" : "Verified"}
                      </span>

                      <strong>
                        Nilai:{" "}
                        {scoreText(item.score)}
                      </strong>

                      <small>
                        {formatDate(item.test_date)}
                        {" · "}
                        {globalWeekOf(item.test_date)
                          ? `Week ${String(
                              globalWeekOf(
                                item.test_date
                              )
                            ).padStart(2, "0")}`
                          : "Di luar Kalender Global"}
                      </small>

                      <p>
                        {parsed.description ||
                          "Tidak ada catatan tambahan."}
                      </p>
                    </div>

                    <div className="dp-history-actions">
                      <button
                        type="button"
                        className="dp-edit"
                        onClick={() =>
                          editTest(item)
                        }
                        disabled={
                          savingTest ||
                          Boolean(testActionId)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="dp-delete"
                        onClick={() =>
                          deleteTest(item)
                        }
                        disabled={
                          savingTest ||
                          Boolean(testActionId)
                        }
                      >
                        {testActionId === item.id
                          ? "Menghapus..."
                          : "Hapus"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* ============================================
            FOOTER
            ============================================ */}

        <footer className="dp-footer">
          OJT MineTrack v2.0 · Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </main>
    </div>
  );
}

// ======================================================
// COMPLETE CSS — LIGHT MODE / DARK MODE
// ======================================================

const css = `
.dp-review-status{display:inline-flex;width:fit-content;margin:5px 0;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:800}
.dp-review-status.pending{background:#574322;color:#ffda91}
.dp-review-status.verified{background:#174a36;color:#a4f0c5}

/* =====================================================
   THEME VARIABLES — LIGHT
   ===================================================== */

.dp-app,
.dp-app *,
.dp-loading,
.dp-loading * {
  box-sizing: border-box;
}

.dp-app,
.dp-loading {
  --green: #07875e;
  --dark: #10243b;
  --muted: #74849a;

  --dp-bg: #f5f8fa;
  --dp-surface: #ffffff;
  --dp-surface-soft: #f4faf6;
  --dp-surface-muted: #edf4f7;

  --dp-text: #10243b;
  --dp-heading: #10243b;
  --dp-muted: #74849a;
  --dp-border: #e2e9ef;
  --dp-border-soft: #edf0f3;

  --dp-input: #ffffff;
  --dp-hover: #f8fcfa;
  --dp-progress-track: #e1e8ee;
  --dp-shadow: rgba(20,45,67,.04);

  min-height: 100vh;
  background: var(--dp-bg);
  color: var(--dp-text);

  font-family: Arial, Helvetica, sans-serif;
}

/* =====================================================
   THEME VARIABLES — DARK
   ===================================================== */

:root[data-theme="dark"] .dp-app,
:root[data-theme="dark"] .dp-loading {
  --green: #4ed3a0;
  --dark: #edf8f4;
  --muted: #a5bbb8;

  --dp-bg: #0d171b;
  --dp-surface: #17272b;
  --dp-surface-soft: #1d3332;
  --dp-surface-muted: #203438;

  --dp-text: #edf8f4;
  --dp-heading: #f0faf6;
  --dp-muted: #a5bbb8;
  --dp-border: #30484b;
  --dp-border-soft: #2a4144;

  --dp-input: #1b3034;
  --dp-hover: #213a3b;
  --dp-progress-track: #314749;
  --dp-shadow: rgba(0,0,0,.18);
}

.dp-app button,
.dp-app input,
.dp-app select,
.dp-app textarea {
  font-family: inherit;
}

.dp-app button {
  cursor: pointer;
}

.dp-app button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

.dp-app button:focus-visible,
.dp-app input:focus-visible,
.dp-app select:focus-visible,
.dp-app textarea:focus-visible {
  outline: 3px solid #67d7bb;
  outline-offset: 2px;
}

/* =====================================================
   ACCOUNT IDENTITY — TOP RIGHT
   ===================================================== */

.dp-account-corner {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 18px;
}

.dp-account-corner .dp-top-account {
  max-width: 100%;
  padding: 9px 13px;

  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 12px;
  box-shadow: 0 3px 12px var(--dp-shadow);
}

.dp-top-account {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dp-top-avatar {
  width: 38px;
  height: 38px;

  flex-shrink: 0;
  display: grid;
  place-items: center;

  border-radius: 50%;
  background: #e0f4e9;
  color: #067d59;

  font-size: 12px;
  font-weight: 900;
}

:root[data-theme="dark"] .dp-top-avatar {
  background: #274f40;
  color: #a9f2cf;
}

.dp-top-account strong,
.dp-top-account small {
  display: block;
  overflow-wrap: anywhere;
}

.dp-top-account strong {
  color: var(--dp-heading);
  font-size: 12px;
}

.dp-top-account small {
  margin-top: 4px;
  font-size: 10px;
  color: var(--dp-muted);
}

/* =====================================================
   CONTENT
   ===================================================== */

.dp-content {
  max-width: 1540px;
  margin: auto;
  padding: 25px 23px;
}

/* =====================================================
   PAGE TITLE
   ===================================================== */

.dp-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;

  gap: 18px;
  margin-bottom: 19px;
}

.dp-title-row small {
  color: var(--dp-muted);
  font-size: 12px;
}

.dp-title-row h1 {
  margin: 5px 0;

  color: var(--dp-heading);
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -.8px;
}

.dp-title-row h1 span {
  color: var(--green);
}

.dp-title-row p {
  margin: 0;
  color: var(--dp-muted);
  font-size: 12px;
  line-height: 1.5;
}

.dp-title-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 9px;
}

.dp-back-button {
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);

  border-radius: 10px;
  color: var(--green);

  padding: 13px;

  font-size: 12px;
  font-weight: 800;
}

.dp-back-button:hover {
  background: var(--dp-surface-soft);
}

.dp-week-select {
  display: flex;
  align-items: center;
  gap: 9px;

  padding: 12px;

  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 11px;

  max-width: 365px;
}

.dp-week-select select {
  border: 0;
  background: transparent;
  color: var(--dp-text);

  font-size: 12px;
  font-weight: 800;

  min-width: 0;
  max-width: 315px;

  color-scheme: light;
}

:root[data-theme="dark"] .dp-week-select select {
  color-scheme: dark;
}

.dp-week-select select option {
  background: var(--dp-input);
  color: var(--dp-text);
}

/* =====================================================
   PARTICIPANT PROFILE
   ===================================================== */

.dp-profile {
  display: grid;

  grid-template-columns:
    minmax(0,1.55fr)
    minmax(250px,1fr);

  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 16px;

  overflow: hidden;
  margin-bottom: 15px;

  box-shadow: 0 4px 17px var(--dp-shadow);
}

.dp-profile-info {
  display: flex;
  align-items: center;
  gap: 25px;

  padding: 23px;
  min-width: 0;
}

.dp-big-avatar {
  width: 105px;
  height: 105px;

  border-radius: 14px;

  background: #dff4e9;
  color: #067b53;

  flex-shrink: 0;

  display: grid;
  place-items: center;

  font-size: 39px;
  font-weight: 900;
}

:root[data-theme="dark"] .dp-big-avatar {
  background: #274f40;
  color: #a9f2cf;
}

.dp-profile-copy {
  min-width: 0;
}

.dp-profile-copy h2 {
  margin: 0 0 8px;
  color: var(--dp-heading);

  font-size: 25px;
  overflow-wrap: anywhere;
}

.dp-profile-copy > p {
  margin: 0;
  color: var(--dp-muted);

  font-size: 12px;
  font-weight: 700;
}

.dp-profile-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;

  margin-top: 23px;
}

.dp-profile-facts > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.dp-fact-icon {
  font-size: 22px;
}

.dp-profile-facts small {
  display: block;
  color: var(--dp-muted);
  font-size: 10px;
}

.dp-profile-facts strong {
  display: block;
  margin-top: 5px;

  color: var(--dp-heading);
  font-size: 11px;

  overflow-wrap: anywhere;
}

.dp-profile-image {
  padding: 23px;

  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;

  background:
    linear-gradient(
      90deg,
      #fff 0%,
      #ffffffd9 28%,
      #ffffff26 100%
    ),
    url("/background-erg.png.PNG") center/cover;
}

:root[data-theme="dark"] .dp-profile-image {
  background:
    linear-gradient(
      90deg,
      rgba(17,36,39,.96) 0%,
      rgba(17,36,39,.82) 42%,
      rgba(10,29,31,.35) 100%
    ),
    url("/background-erg.png.PNG") center/cover;
}

.dp-profile-badge {
  background: #07845b;
  color: #fff;

  border-radius: 5px;
  padding: 7px 11px;

  font-size: 10px;
  font-weight: 900;
}

.dp-profile-image p {
  margin: 13px 0 0;

  color: #344a62;
  font-size: 12px;
  line-height: 1.7;
}

:root[data-theme="dark"] .dp-profile-image p {
  color: #e3f4ef;
}

.dp-profile-accent {
  width: 47px;
  height: 4px;

  border-radius: 10px;
  background: #087c57;

  margin-top: 12px;
}

/* =====================================================
   MAIN CARDS
   ===================================================== */

.dp-achievement,
.dp-card {
  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 16px;

  padding: 15px;
  margin-bottom: 15px;

  color: var(--dp-text);

  box-shadow: 0 4px 18px var(--dp-shadow);
}

.dp-card h2,
.dp-card h3 {
  color: var(--dp-heading);
}

/* =====================================================
   WEEKLY OVERVIEW
   ===================================================== */

.dp-achievement-overview {
  display: grid;

  grid-template-columns:
    minmax(180px,1.4fr)
    145px
    repeat(3,minmax(95px,1fr));

  align-items: center;
  gap: 12px;

  background: #f1fbf6;
  border-radius: 12px;

  padding: 13px;
  margin-bottom: 13px;
}

:root[data-theme="dark"] .dp-achievement-overview {
  background: #1d3932;
}

.dp-week-heading {
  display: flex;
  align-items: center;
  gap: 13px;
}

.dp-big-icon {
  display: grid;
  place-items: center;

  width: 59px;
  height: 59px;

  flex-shrink: 0;
  border-radius: 13px;

  background: #ddf4e8;
  font-size: 27px;
}

:root[data-theme="dark"] .dp-big-icon {
  background: #305745;
}

.dp-week-heading small {
  color: var(--green);
  font-size: 12px;
  font-weight: 800;
}

.dp-week-heading h2 {
  margin: 6px 0;
  color: var(--dp-heading);
  font-size: 24px;
}

.dp-week-heading p {
  margin: 0;
  color: var(--dp-muted);
  font-size: 11px;
}

/* =====================================================
   DONUT PROGRESS
   ===================================================== */

.dp-donut {
  --progress: 0%;

  width: 120px;
  height: 120px;

  border-radius: 50%;

  background: conic-gradient(
    #08b77d var(--progress),
    var(--dp-progress-track) var(--progress)
  );

  display: grid;
  place-items: center;

  padding: 12px;
  margin: auto;
}

.dp-donut > div {
  width: 100%;
  height: 100%;

  border-radius: 50%;

  background: var(--dp-surface);

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.dp-donut strong {
  color: var(--dp-heading);
  font-size: 22px;
}

.dp-donut small {
  color: var(--dp-muted);
  font-size: 9px;
  text-align: center;
}

/* =====================================================
   SUMMARY CARDS
   ===================================================== */

.dp-summary {
  display: grid;
  justify-items: center;

  text-align: center;
  gap: 7px;

  padding: 15px 7px;
  border-radius: 11px;
}

.dp-summary span {
  font-size: 21px;
}

.dp-summary strong {
  font-size: 27px;
}

.dp-summary small {
  font-size: 11px;
}

.dp-summary.green {
  background: #e5f7ed;
  color: #067e57;
}

.dp-summary.amber {
  background: #fff6e8;
  color: #c48111;
}

.dp-summary.blue {
  background: #eaf4ff;
  color: #2876b7;
}

:root[data-theme="dark"] .dp-summary.green {
  background: #214b39;
  color: #a1efbe;
}

:root[data-theme="dark"] .dp-summary.amber {
  background: #49391f;
  color: #f5d191;
}

:root[data-theme="dark"] .dp-summary.blue {
  background: #233d55;
  color: #a4d2ff;
}

.dp-participant-range {
  color: var(--dp-muted);
  font-size: 11px;

  margin: 0 0 14px;
  padding: 0 4px;
}

/* =====================================================
   CATEGORY GRID
   ===================================================== */

.dp-category-grid {
  display: grid;
  grid-template-columns:
    repeat(6,minmax(0,1fr));

  gap: 9px;
}

.dp-category {
  min-width: 0;
  padding: 13px;

  background: var(--dp-surface);
  border: 1px solid var(--dp-border);
  border-radius: 11px;

  color: var(--dp-text);
}

.dp-category-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
}

.dp-category-title strong {
  color: var(--dp-heading);
}

.dp-category-icon {
  display: grid;
  place-items: center;

  font-size: 19px;

  width: 35px;
  height: 35px;

  background: #edf8f2;
  border-radius: 9px;
}

:root[data-theme="dark"] .dp-category-icon {
  background: #2b4c40;
}

.dp-category-value {
  margin: 13px 0 8px;

  color: var(--dp-heading);
  font-size: 19px;
  font-weight: 900;
}

/* =====================================================
   PROGRESS BARS
   ===================================================== */

.dp-progress {
  width: 100%;
  height: 9px;

  background: var(--dp-progress-track);
  border-radius: 20px;
  overflow: hidden;
}

.dp-progress span {
  display: block;
  height: 100%;

  border-radius: inherit;

  background: linear-gradient(
    90deg,
    #09b77d,
    #07875c
  );
}

.dp-category-footer {
  display: grid;
  gap: 7px;
  margin-top: 13px;
}

.dp-category-footer span {
  display: flex;
  justify-content: space-between;
  gap: 5px;

  font-size: 10px;
  color: var(--dp-muted);
}

.dp-category-footer strong {
  color: var(--dp-heading);
  text-align: right;
}

.dp-note {
  color: var(--dp-muted);
  font-size: 11px;
  line-height: 1.65;
  margin-top: 13px;
}

/* =====================================================
   SECTION HEADINGS
   ===================================================== */

.dp-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;

  gap: 12px;
  margin-bottom: 15px;
}

.dp-section-heading h2 {
  margin: 0;

  display: flex;
  align-items: center;
  gap: 10px;

  color: var(--dp-heading);
  font-size: 18px;
}

.dp-heading-symbol {
  font-size: 25px;
  color: var(--green);
}

.dp-section-heading p {
  color: var(--dp-muted);
  font-size: 11px;
  margin: 6px 0 0;
}

.dp-refresh {
  border: 1px solid var(--dp-border);
  background: var(--dp-surface-soft);
  border-radius: 9px;

  padding: 10px 14px;

  color: var(--green);
  font-size: 11px;
  font-weight: 800;
}

.dp-refresh:hover:not(:disabled) {
  background: var(--dp-hover);
}

/* =====================================================
   QUICK ACCESS — 9 MODULES
   ===================================================== */

.dp-menu-grid {
  display: grid;

  grid-template-columns:
    repeat(3,minmax(0,1fr));

  gap: 9px;
}

.dp-module {
  display: flex;
  align-items: center;
  gap: 12px;

  min-width: 0;
  padding: 12px;

  border: 1px solid var(--dp-border);
  border-radius: 11px;

  background: var(--dp-surface);
  color: var(--dp-text);

  text-align: left;
}

.dp-module:hover {
  background: var(--dp-hover);
  border-color: #82cdb0;
}

.dp-module-icon {
  display: grid;
  place-items: center;

  flex-shrink: 0;

  width: 43px;
  height: 43px;

  border-radius: 11px;

  background: #e6f6ed;
  font-size: 21px;
}

.dp-module-icon.amber {
  background: #fff4e3;
}

.dp-module-icon.blue {
  background: #eaf4ff;
}

.dp-module-icon.purple {
  background: #f2eaff;
}

.dp-module-icon.rose {
  background: #ffeaf0;
}

.dp-module-icon.teal {
  background: #e6f6f7;
}

:root[data-theme="dark"] .dp-module-icon.green {
  background: #214b39;
}

:root[data-theme="dark"] .dp-module-icon.amber {
  background: #49391f;
}

:root[data-theme="dark"] .dp-module-icon.blue {
  background: #233d55;
}

:root[data-theme="dark"] .dp-module-icon.purple {
  background: #403455;
}

:root[data-theme="dark"] .dp-module-icon.rose {
  background: #4b2934;
}

:root[data-theme="dark"] .dp-module-icon.teal {
  background: #225054;
}

.dp-module-text {
  min-width: 0;
  flex: 1;
}

.dp-module-text strong {
  display: block;
  color: var(--dp-heading);
  font-size: 12px;
}

.dp-module-text small {
  display: block;

  color: var(--dp-muted);

  font-size: 10px;
  margin-top: 5px;
  line-height: 1.4;
}

.dp-chevron {
  font-size: 23px;
  color: var(--dp-muted);
}

/* =====================================================
   ACHIEVEMENT ACTIONS
   ===================================================== */

.dp-ach-actions {
  display: grid;
  grid-template-columns:
    repeat(2,minmax(0,1fr));

  gap: 10px;
}

.dp-ach-actions button {
  display: flex;
  justify-content: space-between;
  gap: 10px;

  border: 1px solid var(--dp-border);
  background: var(--dp-surface-soft);
  color: var(--green);

  padding: 15px;
  border-radius: 11px;

  font-weight: 800;
  text-align: left;
}

.dp-ach-actions button:hover {
  background: var(--dp-hover);
}

/* =====================================================
   POST-TEST STATISTICS
   ===================================================== */

.dp-post-stats {
  display: grid;

  grid-template-columns:
    repeat(2,minmax(0,1fr));

  gap: 12px;
  margin-bottom: 21px;
}

.dp-post-stats > div {
  background: var(--dp-surface-soft);
  border: 1px solid var(--dp-border);
  border-radius: 11px;

  padding: 17px;

  font-size: 12px;
  color: var(--dp-muted);
}

.dp-post-stats strong {
  display: block;
  margin-top: 10px;

  font-size: 26px;
  color: var(--green);
}

/* =====================================================
   POST-TEST FORM
   ===================================================== */

.dp-form {
  max-width: 560px;

  display: grid;
  gap: 15px;

  margin-top: 18px;
}

.dp-form label {
  display: grid;
  gap: 7px;

  color: var(--dp-heading);
  font-size: 12px;
  font-weight: 800;
}

.dp-form input,
.dp-form select,
.dp-form textarea {
  width: 100%;
  min-width: 0;

  border: 1px solid var(--dp-border);
  border-radius: 9px;

  padding: 12px;
  font-size: 14px;

  background: var(--dp-input);
  color: var(--dp-text);

  color-scheme: light;
}

:root[data-theme="dark"] .dp-form input,
:root[data-theme="dark"] .dp-form select,
:root[data-theme="dark"] .dp-form textarea {
  color-scheme: dark;
}

.dp-form select option {
  background: var(--dp-input);
  color: var(--dp-text);
}

.dp-form input::placeholder,
.dp-form textarea::placeholder {
  color: var(--dp-muted);
  opacity: 1;
}

.dp-form input:focus,
.dp-form select:focus,
.dp-form textarea:focus {
  outline: 2px solid #a0dcc0;
  outline-offset: 1px;
}

.dp-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

/* =====================================================
   POST-TEST BUTTONS
   ===================================================== */

.dp-primary,
.dp-secondary,
.dp-edit,
.dp-delete {
  border: 0;
  border-radius: 9px;

  padding: 11px 15px;

  font-size: 12px;
  font-weight: 800;
}

.dp-primary {
  background: #087e58;
  color: #fff;
}

.dp-primary:hover:not(:disabled) {
  background: #09966a;
}

.dp-secondary {
  background: #e7eef2;
  color: #38516a;
}

:root[data-theme="dark"] .dp-secondary {
  background: #30484b;
  color: #ecf8f5;
}

.dp-edit {
  background: #277bd2;
  color: #fff;
}

.dp-delete {
  background: #d13c3c;
  color: #fff;
}

/* =====================================================
   POST-TEST MATERIAL BADGES
   ===================================================== */

.dp-material-tag {
  display: inline-block;

  margin-bottom: 9px;
  padding: 6px 10px;

  border-radius: 8px;

  background: #eaf4ff;
  color: #246baa;

  font-size: 11px;
  font-weight: 850;
}

.dp-material-tag.legacy {
  background: #f2f4f6;
  color: #718092;
}

:root[data-theme="dark"] .dp-material-tag {
  background: #233d55;
  color: #b2d8ff;
}

:root[data-theme="dark"] .dp-material-tag.legacy {
  background: #304348;
  color: #c7d8d5;
}

/* =====================================================
   POST-TEST HISTORY
   ===================================================== */

.dp-history {
  display: flex;
  justify-content: space-between;
  gap: 15px;

  border-bottom: 1px solid var(--dp-border-soft);
  padding: 17px 0;
}

.dp-history strong {
  color: var(--dp-heading);
}

.dp-history small {
  display: block;
  margin-top: 6px;

  color: var(--dp-muted);
  font-size: 11px;
}

.dp-history p {
  color: var(--dp-muted);
  font-size: 12px;

  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dp-history-actions {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}

/* =====================================================
   ALERTS
   ===================================================== */

.dp-alert {
  padding: 13px;
  border-radius: 10px;

  font-size: 12px;
  margin-bottom: 13px;
}

.dp-alert.error {
  background: #fff0f0;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.dp-alert.success {
  background: #eaf9ef;
  border: 1px solid #c6e9d1;
  color: #087b56;
}

:root[data-theme="dark"] .dp-alert.error {
  background: #45262a;
  border-color: #704349;
  color: #ffbfc8;
}

:root[data-theme="dark"] .dp-alert.success {
  background: #1d4535;
  border-color: #376752;
  color: #b4f5ce;
}

/* =====================================================
   FOOTER
   ===================================================== */

.dp-footer {
  padding: 25px 0;
  text-align: center;

  color: var(--dp-muted);
  font-size: 10px;
}

/* =====================================================
   LOADING / ERROR SCREEN
   ===================================================== */

.dp-loading {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  padding: 35px;

  font-size: 14px;
  text-align: center;
}

.dp-loading h2 {
  color: var(--dp-heading);
}

.dp-loading p {
  color: var(--dp-muted);
  line-height: 1.6;
}

.dp-loading button {
  margin-top: 12px;
  padding: 12px 16px;

  border: 0;
  border-radius: 9px;

  background: #087e58;
  color: white;

  font-weight: 800;
  cursor: pointer;
}

/* =====================================================
   RESPONSIVE — TABLET
   ===================================================== */

@media (max-width:1100px) {
  .dp-category-grid {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .dp-achievement-overview {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
  }

  .dp-week-heading {
    grid-column: span 2;
  }

  .dp-profile {
    grid-template-columns: 1fr;
  }

  .dp-profile-image {
    min-height: 115px;
  }
}

/* =====================================================
   RESPONSIVE — MOBILE
   ===================================================== */

@media (max-width:760px) {
  .dp-content {
    padding: 14px 11px;
  }

  .dp-title-row {
    align-items: stretch;
    flex-direction: column;
  }

  .dp-title-row h1 {
    font-size: 26px;
  }

  .dp-title-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .dp-week-select {
    max-width: none;
    width: 100%;
  }

  .dp-week-select select {
    flex: 1;
    max-width: none;
  }

  .dp-profile-info {
    padding: 16px;
    gap: 12px;
  }

  .dp-big-avatar {
    width: 66px;
    height: 66px;
    font-size: 25px;
  }

  .dp-profile-copy h2 {
    font-size: 19px;
  }

  .dp-profile-facts {
    margin-top: 15px;
    gap: 12px;
  }

  .dp-achievement-overview {
    grid-template-columns:
      repeat(3,minmax(0,1fr));
    gap: 8px;
  }

  .dp-week-heading,
  .dp-donut {
    grid-column: 1 / -1;
  }

  .dp-donut {
    width: 115px;
    height: 115px;
  }

  .dp-summary {
    padding: 12px 5px;
  }

  .dp-summary strong {
    font-size: 22px;
  }

  .dp-summary small {
    font-size: 9px;
  }

  .dp-category-grid {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
  }

  .dp-menu-grid {
    grid-template-columns: 1fr;
  }

  .dp-ach-actions {
    grid-template-columns: 1fr;
  }

  .dp-history {
    flex-direction: column;
  }
}

/* =====================================================
   RESPONSIVE — SMALL MOBILE
   ===================================================== */

@media (max-width:400px) {
  .dp-category-grid {
    grid-template-columns: 1fr;
  }

  .dp-profile-info {
    flex-wrap: wrap;
  }

  .dp-profile-facts > div {
    width: 100%;
  }

  .dp-top-account strong {
    font-size: 10px;
  }
}

/* =====================================================
   PRINT — FORCE LIGHT
   ===================================================== */

@page {
  size: A4 landscape;
  margin: 9mm;
}

@media print {
  html,
  body {
    background: #ffffff !important;
    color: #10243b !important;
  }

  .dp-app,
  :root[data-theme="dark"] .dp-app {
    --green: #07875e;
    --dark: #10243b;
    --muted: #74849a;

    --dp-bg: #ffffff;
    --dp-surface: #ffffff;
    --dp-surface-soft: #f4faf6;
    --dp-surface-muted: #edf4f7;

    --dp-text: #10243b;
    --dp-heading: #10243b;
    --dp-muted: #74849a;
    --dp-border: #e2e9ef;
    --dp-border-soft: #edf0f3;

    --dp-input: #ffffff;
    --dp-hover: #ffffff;
    --dp-progress-track: #e1e8ee;

    background: #ffffff !important;
    color: #10243b !important;
  }

  .dp-account-corner,
  .dp-back-button,
  .dp-refresh,
  .dp-ach-actions,
  .dp-form-actions {
    display: none !important;
  }

  .dp-content {
    max-width: none;
    padding: 0;
  }

  .dp-achievement,
  .dp-profile,
  .dp-card {
    box-shadow: none !important;
    background: white !important;

    break-inside: avoid;
  }

  .dp-progress,
  .dp-progress span,
  .dp-donut,
  .dp-summary {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .dp-profile-copy h2,
  .dp-title-row h1,
  .dp-section-heading h2,
  .dp-category-title strong,
  .dp-category-value,
  .dp-category-footer strong {
    color: #10243b !important;
  }
}
`;
