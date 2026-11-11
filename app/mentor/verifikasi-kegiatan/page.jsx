"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// =====================================================
// OJT MINETRACK V2.0
// VERIFIKASI KEGIATAN — ADMIN / MENTOR
//
// Cakupan:
// - Achievement: Fisik, Training, Sosialisasi, Coaching,
//   Orientasi Area, Hazard.
// - Penilaian: Post-Test, Praktik, Samapta.
// - Data Post-Test dan Samapta lama tanpa marker approval
//   diperlakukan sebagai Verified.
// - Data baru dengan marker status=pending menunggu Admin.
// - Praktik mengikuti marker OJT_PRACTICE_REVIEW_V1.
// - Samapta diverifikasi per satu sesi (lima komponen).
// - Kalender global 25 minggu dipertahankan.
// - Tidak menambah tabel/kolom database atau RPC.
// =====================================================

const BUCKET = "achievement-files";
const TOTAL_WEEKS = 25;
const FILE_RE = /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g;
const PRACTICE_RE = /\[\[OJT_PRACTICE_REVIEW_V1:([\s\S]*?)\]\]/g;
const POSTTEST_RE = /\[\[OJT_POSTTEST_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_RE = /\[\[OJT_SAMAPTA_REVIEW_V1:([\s\S]*?)\]\]/g;

const CATEGORY_DEFS = [
  { key: "Fisik", kind: "achievement", icon: "run", color: "#63bfff" },
  { key: "Training", kind: "achievement", icon: "training", color: "#58e4a4" },
  { key: "Sosialisasi", kind: "achievement", icon: "users", color: "#f3ce75" },
  { key: "Coaching", kind: "achievement", icon: "message", color: "#b9a2fc" },
  { key: "Orientasi Area", kind: "achievement", icon: "compass", color: "#ff9d6a" },
  { key: "Hazard", kind: "achievement", icon: "warning", color: "#fa9196" },
  { key: "Post-Test", kind: "posttest", icon: "book", color: "#82b8ff" },
  { key: "Praktik", kind: "praktik", icon: "clipboard", color: "#f3bd6c" },
  { key: "Samapta", kind: "samapta", icon: "run", color: "#8fd4c1" },
];

const SAMAPTA_TYPES = [
  "Lari 12 Menit",
  "Pull-Up",
  "Push-Up",
  "Sit-Up",
  "Shuttle Run",
];

const GLOBAL_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, index) => {
  const startDate = index === 0
    ? new Date(Date.UTC(2026, 8, 12))
    : new Date(Date.UTC(2026, 8, 20 + (index - 1) * 7));
  const endDate = new Date(startDate.getTime());
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  return {
    week: index + 1,
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
});

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizedKey(value) {
  return normalized(value).replace(/[^a-z0-9]/g, "");
}

function roleOf(value) {
  const role = normalizedKey(value);
  if (["admin", "administrator", "superadmin"].includes(role)) return "admin";
  if (role === "mentor") return "mentor";
  return "unknown";
}

function isParticipantRole(value) {
  return ["participant", "peserta"].includes(normalized(value));
}

function isSimulationParticipant(profile) {
  return normalizedKey(profile?.full_name) === "simulasi01";
}

function parseDate(value) {
  const match = String(value ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) return null;
  return date;
}

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date)) return null;
  return GLOBAL_WEEKS.find((week) => date >= week.start && date <= week.end)?.week ?? null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date) || !parseDate(program?.start_date) || globalWeekOf(date) === null) return false;
  const start = String(program.start_date).slice(0, 10);
  const end = parseDate(program.end_date) ? String(program.end_date).slice(0, 10) : null;
  return date >= start && (!end || date <= end);
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", { maximumFractionDigits: digits })
    : "—";
}

function weekLabel(week) {
  return `Week ${String(week).padStart(2, "0")}`;
}

function initials(value) {
  return String(value || "Pengguna")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function categoryOf(value) {
  const key = normalizedKey(value);
  if (["fisik", "physical"].includes(key)) return "Fisik";
  if (["training", "internaltraining", "pelatihan"].includes(key)) return "Training";
  if (["sosialisasi", "socialization"].includes(key)) return "Sosialisasi";
  if (["coaching", "pembinaan"].includes(key)) return "Coaching";
  if (["orientasi", "orientasiarea", "areaorientation"].includes(key)) return "Orientasi Area";
  if (["hazard", "hazardidentification", "identifikasibahaya"].includes(key)) return "Hazard";
  return null;
}

function decodeMeta(raw, regex) {
  const pattern = new RegExp(regex.source, "g");
  let found = null;
  for (const match of String(raw ?? "").matchAll(pattern)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (parsed && typeof parsed === "object") found = parsed;
    } catch {
      // Metadata yang tidak valid tidak boleh membuat halaman gagal dimuat.
    }
  }
  return found;
}

function stripMarker(raw, regex) {
  return String(raw ?? "").replace(new RegExp(regex.source, "g"), "").trim();
}

function stripAllMeta(raw) {
  return String(raw ?? "")
    .replace(new RegExp(FILE_RE.source, "g"), "")
    .replace(new RegExp(PRACTICE_RE.source, "g"), "")
    .replace(new RegExp(POSTTEST_RE.source, "g"), "")
    .replace(new RegExp(SAMAPTA_RE.source, "g"), "")
    .trim();
}

function appendReviewMarker(raw, markerName, regex, meta) {
  const clean = stripMarker(raw, regex);
  const marker = `[[${markerName}:${encodeURIComponent(JSON.stringify(meta))}]]`;
  return [clean, marker].filter(Boolean).join("\n");
}

function reviewStatus(raw, regex, legacyFallback = "verified") {
  const meta = decodeMeta(raw, regex);
  if (meta?.status === "pending") return "pending";
  if (meta?.status === "verified") return "verified";
  return legacyFallback;
}

function parseTestNotes(raw) {
  const text = stripMarker(raw, POSTTEST_RE).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const firstLine = lines[0]?.trim() || "";
  const match = firstLine.match(/^Materi:\s*(.+)$/i);
  return {
    material: match?.[1]?.trim() || "",
    description: match ? lines.slice(1).join("\n").trim() : text,
  };
}

function getEvidence(raw, programId) {
  const meta = decodeMeta(raw, FILE_RE);
  const path = typeof meta?.path === "string" ? meta.path : "";
  if (!path.startsWith(`${programId}/`)) return null;
  return { name: String(meta?.name || "Dokumentasi"), path };
}

function composePracticeNotes(text, evidence, review) {
  const parts = [];
  if (String(text || "").trim()) parts.push(String(text).trim());
  if (evidence?.path) {
    parts.push(`[[OJT_FILE_V1:${encodeURIComponent(JSON.stringify({ name: evidence.name, path: evidence.path }))}]]`);
  }
  if (review) {
    parts.push(`[[OJT_PRACTICE_REVIEW_V1:${encodeURIComponent(JSON.stringify(review))}]]`);
  }
  return parts.join("\n") || null;
}

function getPracticeReview(raw) {
  const meta = decodeMeta(raw, PRACTICE_RE);
  const submittedScore = Number(meta?.submittedScore);
  if (meta?.status !== "pending" || !Number.isFinite(submittedScore) || submittedScore < 0 || submittedScore > 100) {
    return meta?.status === "verified" ? meta : null;
  }
  return { ...meta, submittedScore };
}

function samaptaSessionStatus(rows) {
  const pending = rows.some((row) => reviewStatus(row.notes, SAMAPTA_RE) === "pending");
  const names = new Set(rows.map((row) => normalizedKey(row.test_type)));
  const complete = SAMAPTA_TYPES.every((name) => names.has(normalizedKey(name))) && rows.length === SAMAPTA_TYPES.length;
  if (pending) return { status: "pending", complete };
  return { status: complete ? "verified" : "other", complete };
}

function buildSamaptaSessions(rows, programMap, peopleMap) {
  const grouped = new Map();
  for (const row of rows) {
    const date = String(row.test_date ?? "").slice(0, 10);
    const key = `${row.program_id}::${date}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return [...grouped.entries()].map(([key, items]) => {
    const [programId, date] = key.split("::");
    const program = programMap.get(programId);
    const person = peopleMap.get(program?.participant_id);
    const state = samaptaSessionStatus(items);
    const sortedRows = SAMAPTA_TYPES.map((name) =>
      items.find((row) => normalizedKey(row.test_type) === normalizedKey(name))
    ).filter(Boolean);
    const scores = sortedRows.map((row) => Number(row.score)).filter(Number.isFinite);
    const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;

    return {
      id: `samapta-${programId}-${date}`,
      kind: "samapta",
      category: "Samapta",
      programId,
      date,
      person: person?.full_name || "Peserta OJT",
      department: person?.department || "—",
      site: program?.site || "—",
      status: state.status,
      complete: state.complete,
      rows: sortedRows,
      score: average,
      title: "Samapta",
      details: sortedRows.map((row) => `${row.test_type}: ${formatNumber(row.result_value, 2)} ${row.result_unit || ""} (Skor ${formatNumber(row.score, 2)})`).join("\n"),
      rawNotes: sortedRows[0]?.notes || "",
    };
  });
}

function Icon({ name, size = 20 }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    chart: <path d="M3 21h18M6 17v-5M12 17V7M18 17V3" />,
    file: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    shield: <><path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" /><path d="m8 12 3 3 5-6" /></>,
    run: <><circle cx="15" cy="4" r="2" /><path d="m7 21 4-6 2-4-4-2-3 3M11 15l6 2 3 4M13 11l4-2 3 1" /></>,
    training: <path d="M3 9v6M21 9v6M6 7v10M18 7v10M6 12h12" />,
    message: <path d="M4 4h16v12H9l-5 4V4Z" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 9-2 5-4 1 2-5 4-1Z" /></>,
    warning: <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v5M12 18h.01" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 3h6v5H9zM9 13h6M9 17h5" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" /><path d="M4 4.5v18M8 6h8M8 10h8" /></>,
    refresh: <path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />,
    logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    arrow: <path d="M19 12H5m7-7-7 7 7 7" />,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.check}
    </svg>
  );
}

function StatusBadge({ status }) {
  const label = status === "pending" ? "Pending" : status === "verified" ? "Verified" : "Perlu Pemeriksaan";
  return <span className={`vk-status ${status}`}>{label}</span>;
}

function Progress({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="vk-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}>
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

export default function VerifikasiKegiatanPage() {
  const router = useRouter();
  const busyRef = useRef(false);
  const submissionListRef = useRef(null);
  const [account, setAccount] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [active, setActive] = useState(null);
  const [checked, setChecked] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedSite, setSelectedSite] = useState("all");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const isAdmin = roleOf(account?.role) === "admin";
  const accountName = account?.full_name || "Pengguna";
  const accountRole = isAdmin ? "Administrator" : "Mentor OJT";

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.replace("/login");
        return;
      }

      const user = authData.user;
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const role = roleOf(profile?.role);
      if (!["admin", "mentor"].includes(role)) {
        throw new Error("Halaman Verifikasi Kegiatan hanya tersedia untuk Admin dan Mentor OJT.");
      }
      setAccount({ ...profile, role });

      let programQuery = supabase
        .from("ojt_programs")
        .select("id,participant_id,mentor_id,site,status,start_date,end_date")
        .in("status", ["active", "approved"])
        .order("start_date", { ascending: false });
      if (role === "mentor") programQuery = programQuery.eq("mentor_id", user.id);

      const { data: rawPrograms, error: programError } = await programQuery;
      if (programError) throw new Error(`Program OJT: ${programError.message}`);

      const participantIds = [...new Set((rawPrograms || []).map((program) => program.participant_id).filter(Boolean))];
      if (!participantIds.length) {
        setItems([]);
        setLastUpdated(new Date());
        return;
      }

      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id,full_name,department,role")
        .in("id", participantIds);
      if (peopleError) throw new Error(`Profil peserta: ${peopleError.message}`);

      const peopleMap = new Map((people || []).map((person) => [person.id, person]));
      const programs = (rawPrograms || []).filter((program) => {
        const person = peopleMap.get(program.participant_id);
        return person && isParticipantRole(person.role) && !isSimulationParticipant(person);
      });
      const programMap = new Map(programs.map((program) => [program.id, program]));
      const programIds = programs.map((program) => program.id);

      if (!programIds.length) {
        setItems([]);
        setLastUpdated(new Date());
        return;
      }

      const [typeResult, achievementResult, postResult, practiceResult, samaptaResult] = await Promise.all([
        supabase.from("achievement_types").select("code,name"),
        supabase.from("achievement_records")
          .select("id,program_id,type_code,status,activity_date,description,distance_km,verified_by")
          .in("program_id", programIds),
        supabase.from("post_test_scores")
          .select("id,program_id,test_date,score,notes,created_by,created_at")
          .in("program_id", programIds),
        supabase.from("weekly_practice_scores")
          .select("id,program_id,practice_date,practice_name,score,notes,created_by,created_at")
          .in("program_id", programIds),
        supabase.from("samapta_records")
          .select("id,program_id,test_date,test_type,result_value,result_unit,score,notes,outcome")
          .in("program_id", programIds),
      ]);

      for (const [label, result] of [
        ["Kategori Achievement", typeResult],
        ["Achievement", achievementResult],
        ["Post-Test", postResult],
        ["Praktik", practiceResult],
        ["Samapta", samaptaResult],
      ]) {
        if (result.error) throw new Error(`${label}: ${result.error.message}`);
      }

      const typeMap = new Map();
      (typeResult.data || []).forEach((type) => {
        typeMap.set(normalizedKey(type.code), type.name);
        typeMap.set(normalizedKey(type.name), type.name);
      });

      const makeBase = (programId, date) => {
        const program = programMap.get(programId);
        if (!program || !insideProgram(date, program)) return null;
        const person = peopleMap.get(program.participant_id);
        return {
          programId,
          person: person?.full_name || "Peserta OJT",
          department: person?.department || "—",
          site: program?.site || "—",
        };
      };

      const achievements = (achievementResult.data || []).flatMap((row) => {
        const base = makeBase(row.program_id, row.activity_date);
        if (!base) return [];
        const typeName = typeMap.get(normalizedKey(row.type_code)) || row.type_code || "Achievement";
        const category = categoryOf(typeName) || categoryOf(row.type_code) || "Lainnya";
        const status = ["pending", "verified"].includes(normalized(row.status)) ? normalized(row.status) : "other";
        return [{
          ...base,
          id: row.id,
          kind: "achievement",
          category,
          title: category,
          date: row.activity_date,
          status,
          details: stripAllMeta(row.description),
          distanceKm: row.distance_km,
          rawNotes: row.description || "",
          evidence: getEvidence(row.description, row.program_id),
          verifiedBy: row.verified_by,
        }];
      });

      const postTests = (postResult.data || []).flatMap((row) => {
        const base = makeBase(row.program_id, row.test_date);
        if (!base) return [];
        const parsed = parseTestNotes(row.notes);
        return [{
          ...base,
          id: row.id,
          kind: "posttest",
          category: "Post-Test",
          title: parsed.material || "Post-Test",
          date: row.test_date,
          status: reviewStatus(row.notes, POSTTEST_RE),
          score: row.score,
          details: parsed.description,
          rawNotes: row.notes || "",
        }];
      });

      const practices = (practiceResult.data || []).flatMap((row) => {
        const base = makeBase(row.program_id, row.practice_date);
        if (!base) return [];
        const review = getPracticeReview(row.notes);
        const status = review?.status === "pending"
          ? "pending"
          : normalized(review?.status) === "verified" || (row.score !== null && row.score !== undefined)
            ? "verified"
            : "other";
        return [{
          ...base,
          id: row.id,
          kind: "praktik",
          category: "Praktik",
          title: row.practice_name || "Praktik",
          date: row.practice_date,
          status,
          score: review?.submittedScore ?? row.score,
          details: stripAllMeta(row.notes),
          rawNotes: row.notes || "",
          review,
          evidence: getEvidence(row.notes, row.program_id),
        }];
      });

      const samapta = buildSamaptaSessions(samaptaResult.data || [], programMap, peopleMap)
        .filter((item) => insideProgram(item.date, programMap.get(item.programId)));

      const nextItems = [...achievements, ...postTests, ...practices, ...samapta].sort((a, b) => {
        const dateOrder = String(b.date).localeCompare(String(a.date));
        if (dateOrder) return dateOrder;
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (b.status === "pending" && a.status !== "pending") return 1;
        return String(a.person).localeCompare(String(b.person));
      });

      setItems(nextItems);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || "Gagal memuat data verifikasi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const sites = useMemo(() => [...new Set(items.map((item) => item.site).filter(Boolean))].sort(), [items]);

  const summary = useMemo(() => {
    const verified = items.filter((item) => item.status === "verified").length;
    const pending = items.filter((item) => item.status === "pending").length;
    const other = items.filter((item) => item.status === "other").length;
    return { total: items.length, verified, pending, other, verifiedPercent: items.length ? (verified / items.length) * 100 : 0 };
  }, [items]);

  const categoryCards = useMemo(() => CATEGORY_DEFS.map((category) => {
    const matching = items.filter((item) => item.category === category.key);
    return {
      ...category,
      total: matching.length,
      pending: matching.filter((item) => item.status === "pending").length,
      verified: matching.filter((item) => item.status === "verified").length,
      other: matching.filter((item) => item.status === "other").length,
    };
  }), [items]);

  const chartWeeks = useMemo(() => GLOBAL_WEEKS.map((week) => {
    const matching = items.filter((item) => globalWeekOf(item.date) === week.week);
    const verified = matching.filter((item) => item.status === "verified").length;
    const pending = matching.filter((item) => item.status === "pending").length;
    const other = matching.filter((item) => item.status === "other").length;
    const total = matching.length;
    return {
      ...week,
      total,
      verified,
      pending,
      other,
      verifiedPercent: total ? (verified / total) * 100 : 0,
      pendingPercent: total ? (pending / total) * 100 : 0,
    };
  }), [items]);

  const filteredItems = useMemo(() => items.filter((item) => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (selectedSite !== "all" && item.site !== selectedSite) return false;
    if (selectedWeek && globalWeekOf(item.date) !== selectedWeek) return false;
    if (!search.trim()) return true;
    const haystack = [item.person, item.department, item.site, item.category, item.title, item.details].join(" ").toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  }), [items, selectedCategory, selectedStatus, selectedSite, selectedWeek, search]);

  const activeCategoryStats = useMemo(() => {
    if (selectedCategory === "all") return summary;
    const matching = items.filter((item) => item.category === selectedCategory);
    return {
      total: matching.length,
      pending: matching.filter((item) => item.status === "pending").length,
      verified: matching.filter((item) => item.status === "verified").length,
      other: matching.filter((item) => item.status === "other").length,
    };
  }, [items, selectedCategory, summary]);

  function resetFilters() {
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedSite("all");
    setSelectedWeek(0);
    setSearch("");
  }

  function openCategoryQueue(categoryKey) {
    // Pertahankan pilihan Week ketika kategori diklik.
    setSelectedCategory(categoryKey);
    setSelectedStatus("pending");
    setSelectedSite("all");
    setSearch("");
    requestAnimationFrame(() => {
      submissionListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function openReview(item) {
    setActive(item);
    setChecked(false);
    setPreview(null);
    setError("");
    if (!item.evidence?.path) return;
    setPreviewLoading(true);
    const { data, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.evidence.path, 120);
    if (signedError) setError(`Dokumentasi belum dapat dibuka: ${signedError.message}`);
    else setPreview(data?.signedUrl || null);
    setPreviewLoading(false);
  }

  function updateLocalItem(itemId, patch) {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...patch } : item));
    setActive((current) => current?.id === itemId ? { ...current, ...patch } : current);
  }

  async function verifySession() {
    // Lock busyRef dikelola approve*(), bukan fungsi pemeriksa sesi.
    // Pemeriksaan busyRef di sini membuat semua persetujuan selalu gagal.
    if (!account?.id) {
      throw new Error("Akun belum siap. Muat ulang halaman.");
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user || authData.user.id !== account.id) {
      throw new Error("Sesi login berubah. Silakan login kembali.");
    }
  }

  async function approveAchievement() {
    if (!active || active.kind !== "achievement" || !checked || busyRef.current) return;
    busyRef.current = true;
    setProcessing(active.id);
    setError("");
    setMessage("");
    try {
      await verifySession();
      if (active.category === "Fisik" && !(Number(active.distanceKm) > 0)) {
        throw new Error("Jarak Fisik belum valid. Periksa kembali input Achievement.");
      }
      const { data, error: updateError } = await supabase
        .from("achievement_records")
        .update({ status: "verified", verified_by: account.id })
        .eq("id", active.id)
        .eq("program_id", active.programId)
        .eq("status", "pending")
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Data tidak berubah. Periksa hak akses atau status kegiatan.");
      updateLocalItem(active.id, { status: "verified", verifiedBy: account.id });
      setMessage(`Achievement ${active.person} berhasil diverifikasi.`);
      setActive(null);
    } catch (err) {
      setError(err?.message || "Gagal memverifikasi Achievement.");
    } finally {
      busyRef.current = false;
      setProcessing(null);
    }
  }

  async function approvePractice() {
    if (!active || active.kind !== "praktik" || !checked || busyRef.current) return;
    if (!active.review || active.review.status !== "pending") {
      setError("Pengajuan Praktik tidak memiliki metadata Pending yang valid.");
      return;
    }
    const score = Number(active.review.submittedScore ?? active.score);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError("Nilai pengajuan Praktik tidak valid.");
      return;
    }
    if (!active.evidence?.path) {
      setError("Dokumentasi Praktik belum tercatat. Verifikasi dibatalkan.");
      return;
    }
    busyRef.current = true;
    setProcessing(active.id);
    setError("");
    setMessage("");
    try {
      await verifySession();
      const review = {
        ...active.review,
        status: "verified",
        submittedScore: score,
        approvedScore: score,
        reviewedBy: account.id,
        reviewedAt: new Date().toISOString(),
      };
      const nextNotes = composePracticeNotes(stripAllMeta(active.rawNotes), active.evidence, review);
      const { data, error: updateError } = await supabase
        .from("weekly_practice_scores")
        .update({ score, notes: nextNotes })
        .eq("id", active.id)
        .eq("program_id", active.programId)
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Laporan Praktik tidak berubah atau tidak dapat diverifikasi.");
      updateLocalItem(active.id, { status: "verified", score, review, rawNotes: nextNotes, details: stripAllMeta(nextNotes) });
      setMessage(`Nilai Praktik ${active.person} berhasil diverifikasi.`);
      setActive(null);
    } catch (err) {
      setError(err?.message || "Verifikasi Praktik gagal.");
    } finally {
      busyRef.current = false;
      setProcessing(null);
    }
  }

  async function approvePostTest() {
    if (!active || active.kind !== "posttest" || !checked || busyRef.current) return;
    if (!isAdmin) {
      setError("Persetujuan Post-Test hanya dapat dilakukan oleh Admin.");
      return;
    }
    if (active.status !== "pending") return;
    busyRef.current = true;
    setProcessing(active.id);
    setError("");
    setMessage("");
    try {
      await verifySession();
      const review = {
        status: "verified",
        reviewedBy: account.id,
        reviewedAt: new Date().toISOString(),
      };
      const nextNotes = appendReviewMarker(active.rawNotes, "OJT_POSTTEST_REVIEW_V1", POSTTEST_RE, review);
      const { data, error: updateError } = await supabase
        .from("post_test_scores")
        .update({ notes: nextNotes })
        .eq("id", active.id)
        .eq("program_id", active.programId)
        .select("id");
      if (updateError) throw updateError;
      if (!data?.length) throw new Error("Data Post-Test tidak berubah atau tidak dapat diverifikasi.");
      updateLocalItem(active.id, { status: "verified", rawNotes: nextNotes });
      setMessage(`Post-Test ${active.person} berhasil disetujui.`);
      setActive(null);
    } catch (err) {
      setError(err?.message || "Persetujuan Post-Test gagal.");
    } finally {
      busyRef.current = false;
      setProcessing(null);
    }
  }

  async function approveSamapta() {
    if (!active || active.kind !== "samapta" || !checked || busyRef.current) return;
    if (!isAdmin) {
      setError("Persetujuan Samapta hanya dapat dilakukan oleh Admin.");
      return;
    }
    if (!active.complete || active.rows?.length !== SAMAPTA_TYPES.length) {
      setError("Sesi Samapta belum lengkap. Lima komponen tes harus tersedia sebelum disetujui.");
      return;
    }
    if (active.status !== "pending") return;
    busyRef.current = true;
    setProcessing(active.id);
    setError("");
    setMessage("");
    try {
      await verifySession();
      const reviewedAt = new Date().toISOString();
      for (const row of active.rows) {
        const meta = decodeMeta(row.notes, SAMAPTA_RE) || {};
        const nextNotes = appendReviewMarker(row.notes, "OJT_SAMAPTA_REVIEW_V1", SAMAPTA_RE, {
          ...meta,
          status: "verified",
          reviewedBy: account.id,
          reviewedAt,
        });
        const { data, error: updateError } = await supabase
          .from("samapta_records")
          .update({ notes: nextNotes })
          .eq("id", row.id)
          .eq("program_id", active.programId)
          .select("id");
        if (updateError) throw updateError;
        if (!data?.length) throw new Error(`Komponen ${row.test_type} gagal diperbarui. Muat ulang antrean sebelum mencoba kembali.`);
      }
      setItems((current) => current.map((item) => item.id === active.id ? {
        ...item,
        status: "verified",
        rows: item.rows.map((row) => ({
          ...row,
          notes: appendReviewMarker(row.notes, "OJT_SAMAPTA_REVIEW_V1", SAMAPTA_RE, {
            ...(decodeMeta(row.notes, SAMAPTA_RE) || {}),
            status: "verified",
            reviewedBy: account.id,
            reviewedAt,
          }),
        })),
      } : item));
      setMessage(`Sesi Samapta ${active.person} tanggal ${formatDate(active.date)} berhasil disetujui.`);
      setActive(null);
    } catch (err) {
      setError(err?.message || "Persetujuan Samapta gagal. Jika proses terhenti di tengah, muat ulang data lalu setujui kembali.");
    } finally {
      busyRef.current = false;
      setProcessing(null);
    }
  }

  async function approveActive() {
    if (!active) return;
    if (active.kind === "achievement") return approveAchievement();
    if (active.kind === "praktik") return approvePractice();
    if (active.kind === "posttest") return approvePostTest();
    if (active.kind === "samapta") return approveSamapta();
  }

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Gagal keluar dari akun.");
      setLoggingOut(false);
    }
  }

  const chartMax = Math.max(1, ...chartWeeks.map((week) => week.total));
  function canApproveItem(item) {
    return Boolean(item && item.status === "pending" && (
      item.kind === "achievement" || item.kind === "praktik" ||
      (isAdmin && (item.kind === "posttest" || item.kind === "samapta"))
    ));
  }
  const canApproveActive = canApproveItem(active);

  return (
    <main className="vk-root">
      <style>{css}</style>

      {menuOpen && (
        <button type="button" className="vk-overlay-side" onClick={() => setMenuOpen(false)} aria-label="Tutup sidebar" />
      )}

      <div className="vk-layout">
        <aside className={`mt-sidebar ${menuOpen ? "open" : ""}`}>
          <div>
            <div className="mt-brand">
              <div className="mt-brand-title">OJT <span>MineTrack</span><small> v2.0</small></div>
              <p>Emergency Response Group<br />PT Berau Coal</p>
            </div>

            <nav className="mt-sidebar-nav" aria-label="Navigasi Mentor dan Admin">
              <div className="mt-sidebar-group">
                <div className="mt-menu-label">MENU UTAMA</div>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/"); }}>
                  <Icon name="home" size={19} /><span>Dashboard {isAdmin ? "Admin" : "Mentor"}</span>
                </button>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/mentor/monitoring-peserta"); }}>
                  <Icon name="chart" size={19} /><span>Monitoring Kegiatan</span>
                </button>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/mentor/monitoring-penilaian"); }}>
                  <Icon name="file" size={19} /><span>Monitoring Penilaian</span>
                </button>
                <button type="button" className="mt-nav active" aria-current="page" onClick={() => setMenuOpen(false)}>
                  <Icon name="shield" size={19} /><span>Verifikasi Kegiatan</span>
                </button>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/#jadwal-kegiatan"); }}>
                  <Icon name="calendar" size={19} /><span>Jadwal Kegiatan Mingguan</span>
                </button>
              </div>

              <div className="mt-sidebar-group">
                <div className="mt-menu-label">MANAJEMEN PESERTA</div>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/#daftar-peserta"); }}>
                  <Icon name="users" size={19} /><span>Peserta OJT</span>
                </button>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/mentor/daftar-peserta"); }}>
                  <Icon name="file" size={19} /><span>Pendaftaran Peserta</span>
                </button>
                <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/mentor/persetujuan-peserta"); }}>
                  <Icon name="check" size={19} /><span>Persetujuan Peserta</span>
                </button>
                {isAdmin && (
                  <button type="button" className="mt-nav" onClick={() => { setMenuOpen(false); router.push("/admin/persetujuan-mentor"); }}>
                    <Icon name="check" size={19} /><span>Persetujuan Mentor</span>
                  </button>
                )}
              </div>
            </nav>
          </div>

          <div className="mt-sidebar-bottom">
            <div className="mt-sidebar-user">
              <div className="mt-avatar">{initials(accountName)}</div>
              <div><strong>{accountName}</strong><small>{accountRole} · Profil Akun</small></div>
            </div>
            <button type="button" className="mt-nav" onClick={() => load(true)} disabled={refreshing || loading}>
              <Icon name="refresh" size={19} /><span>{refreshing ? "Memperbarui..." : "Refresh Data"}</span>
            </button>
            <button type="button" className="mt-nav" onClick={logout} disabled={loggingOut}>
              <Icon name="logout" size={19} /><span>{loggingOut ? "Sedang Keluar..." : "Keluar Akun"}</span>
            </button>
          </div>
        </aside>

        <section className="vk-main">
          <div className="vk-mobile-head">
            <strong>OJT <span>MineTrack</span></strong>
            <button type="button" onClick={() => setMenuOpen(true)} aria-label="Buka sidebar"><Icon name="menu" size={22} /></button>
          </div>

          <header className="vk-page-head">
            <div>
              <div className="vk-eyebrow">EMERGENCY RESPONSE GROUP · PT BERAU COAL</div>
              <h1>Verifikasi Kegiatan</h1>
              <p>Persetujuan Achievement, Post-Test, Praktik, dan Samapta peserta OJT.</p>
              <small>Periode Program OJT · 12 Sep 2026 – 06 Mar 2027</small>
            </div>
            <div className="vk-head-actions">
              <div className="vk-account">
                <span className="vk-account-avatar">{initials(accountName)}</span>
                <div><strong>{accountName}</strong><small>{accountRole}</small></div>
              </div>
              <button type="button" className="vk-dashboard-btn" onClick={() => router.push("/")}>
                <Icon name="arrow" size={16} /> Dashboard Utama
              </button>
            </div>
          </header>

          {error && <div className="vk-alert error" role="alert">{error}</div>}
          {message && <div className="vk-alert success" role="status">{message}</div>}

          <section className="vk-section-title">
            <div><h2>Ringkasan Verifikasi</h2><p>Seluruh pengajuan dari program OJT aktif dan disetujui yang dapat dikelola akun ini.</p></div>
            <button type="button" onClick={() => load(true)} disabled={refreshing || loading}><Icon name="refresh" size={16} /> {refreshing ? "Memperbarui..." : "Refresh"}</button>
          </section>

          <section className="vk-summary-grid">
            <article className="vk-summary-card"><small>Total Input</small><strong>{summary.total}</strong><span>Seluruh pengajuan dan sesi penilaian</span></article>
            <article className="vk-summary-card pending"><small>Pending Verifikasi</small><strong>{summary.pending}</strong><span>Menunggu pemeriksaan / persetujuan</span></article>
            <article className="vk-summary-card verified"><small>Terverifikasi</small><strong>{summary.verified}</strong><span>{summary.verifiedPercent.toFixed(1).replace(".", ",")}% dari seluruh input</span><Progress value={summary.verifiedPercent} /></article>
          </section>

          <section className="vk-panel">
            <div className="vk-section-title"><div><h2>Verifikasi per Kategori</h2><p>Pilih kategori untuk melihat jumlah input, Pending, dan Verified.</p></div></div>
            <div className="vk-category-grid">
              {categoryCards.map((card) => (
                <button type="button" key={card.key} className={`vk-category-card ${selectedCategory === card.key ? "selected" : ""}`}
                  onClick={() => openCategoryQueue(card.key)}
                  aria-pressed={selectedCategory === card.key}>
                  <span className="vk-category-icon" style={{ color: card.color }}><Icon name={card.icon} size={23} /></span>
                  <span className="vk-category-name">{card.key}</span>
                  <strong>{card.total}</strong>
                  <small>Total input</small>
                  <span className="vk-category-counts"><em>{card.pending} Pending</em><em>{card.verified} Verified</em></span>
                </button>
              ))}
            </div>
          </section>

          <section className="vk-panel">
            <div className="vk-section-title"><div><h2>Grafik Persentase Verifikasi per Minggu</h2><p>Persentase dihitung dari pengajuan yang masuk pada setiap minggu. Klik batang untuk memfilter minggu.</p></div></div>
            <div className="vk-chart-scroll">
              <div className="vk-chart">
                {chartWeeks.map((week) => {
                  const verifiedHeight = week.total ? (week.verified / week.total) * 100 : 0;
                  const pendingHeight = week.total ? (week.pending / week.total) * 100 : 0;
                  const otherHeight = week.total ? (week.other / week.total) * 100 : 0;
                  const isSelected = selectedWeek === week.week;
                  return (
                    <button type="button" key={week.week} className={`vk-chart-col ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedWeek(isSelected ? 0 : week.week)} aria-pressed={isSelected}
                      title={`${weekLabel(week.week)} · Verified ${week.verified} · Pending ${week.pending} · Total ${week.total}`}>
                      <span className="vk-chart-percent">{week.total ? `${Math.round(week.verifiedPercent)}%` : "—"}</span>
                      <span className="vk-chart-track">
                        <span className="vk-chart-stack">
                          <i className="verified" style={{ height: `${verifiedHeight}%` }} />
                          <i className="pending" style={{ height: `${pendingHeight}%` }} />
                          <i className="other" style={{ height: `${otherHeight}%` }} />
                        </span>
                      </span>
                      <span className="vk-chart-label">W{String(week.week).padStart(2, "0")}</span>
                      <span className="vk-chart-total">{week.total}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="vk-legend"><span><i className="verified" /> Verified</span><span><i className="pending" /> Pending</span><span><i className="other" /> Status lain</span></div>
          </section>

          <section className="vk-panel" id="daftar-pengajuan" ref={submissionListRef}>
            <div className="vk-section-title"><div><h2>Daftar Pengajuan</h2><p>{filteredItems.length} data sesuai kategori dan filter yang dipilih.</p></div></div>
            <div className="vk-filters">
              <label><span>Kategori</span><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}><option value="all">Semua kategori</option>{CATEGORY_DEFS.map((item) => <option key={item.key} value={item.key}>{item.key}</option>)}</select></label>
              <label><span>Status</span><select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}><option value="all">Semua status</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="other">Status lain</option></select></label>
              <label><span>Site</span><select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}><option value="all">Semua site</option>{sites.map((site) => <option key={site} value={site}>{site}</option>)}</select></label>
              <label className="vk-search"><span>Cari peserta / kegiatan</span><input type="search" placeholder="Nama peserta, site, materi..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
              <button type="button" className="vk-reset" onClick={resetFilters}>Reset</button>
            </div>

            {loading ? <div className="vk-empty">Memuat data verifikasi dari Supabase...</div> : !filteredItems.length ? (
              <div className="vk-empty">Tidak ada data yang sesuai dengan filter ini.</div>
            ) : (
              <div className="vk-record-list">
                {filteredItems.map((item) => (
                  <article className="vk-record" key={`${item.kind}-${item.id}`}>
                    <div className="vk-record-main">
                      <div className="vk-record-top"><span className="vk-kind">{item.category}</span><StatusBadge status={item.status} /></div>
                      <h3>{item.title}</h3>
                      <p>{item.person} · {item.department} · {item.site}</p>
                      <small>{formatDate(item.date)} · {globalWeekOf(item.date) ? weekLabel(globalWeekOf(item.date)) : "Di luar kalender"}</small>
                      {item.kind === "posttest" && <p className="vk-record-detail">Nilai Post-Test: <strong>{formatNumber(item.score)}</strong></p>}
                      {item.kind === "praktik" && <p className="vk-record-detail">Nilai Praktik: <strong>{formatNumber(item.score)}</strong></p>}
                      {item.kind === "samapta" && <p className="vk-record-detail">{item.rows.length}/5 komponen · Rata-rata skor: <strong>{formatNumber(item.score)}</strong></p>}
                      {item.kind === "achievement" && item.category === "Fisik" && <p className="vk-record-detail">Jarak: <strong>{formatNumber(item.distanceKm, 3)} km</strong></p>}
                      {item.details && <p className="vk-record-description">{item.details}</p>}
                    </div>
                    <div className="vk-record-actions">
                      <button type="button" className="vk-detail-btn" onClick={() => openReview(item)}>Lihat Detail</button>
                      {canApproveItem(item) && (
                        <button type="button" className="vk-record-verify" onClick={() => openReview(item)}>Verifikasi</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <footer className="vk-footer">
            <span>OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal</span>
            <span>{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })} WITA` : ""}</span>
          </footer>
        </section>
      </div>

      {active && (
        <div className="vk-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !processing) { setActive(null); setPreview(null); } }}>
          <section className="vk-modal" role="dialog" aria-modal="true" aria-labelledby="vk-modal-title">
            <header className="vk-modal-header">
              <div><span className="vk-kind">{active.category}</span><StatusBadge status={active.status} /><h2 id="vk-modal-title">{active.title}</h2><p>{active.person} · {active.department} · {active.site}</p><small>{formatDate(active.date)} · {weekLabel(globalWeekOf(active.date) || 1)}</small></div>
              <button type="button" className="vk-close" onClick={() => { setActive(null); setPreview(null); }} disabled={!!processing} aria-label="Tutup"><Icon name="close" size={20} /></button>
            </header>
            <div className="vk-modal-body">
              {active.kind === "achievement" && active.category === "Fisik" && <div className="vk-detail-line"><span>Jarak kegiatan</span><strong>{formatNumber(active.distanceKm, 3)} km</strong></div>}
              {active.kind === "posttest" && <div className="vk-detail-line"><span>Nilai Post-Test</span><strong>{formatNumber(active.score)}</strong></div>}
              {active.kind === "praktik" && <div className="vk-detail-line"><span>Nilai diajukan</span><strong>{formatNumber(active.score)}</strong></div>}
              {active.kind === "samapta" && (
                <div className="vk-samapta-details">
                  <strong>Rincian lima komponen Samapta</strong>
                  {SAMAPTA_TYPES.map((type) => {
                    const row = active.rows.find((item) => normalizedKey(item.test_type) === normalizedKey(type));
                    return <div key={type}><span>{type}</span><strong>{row ? `${formatNumber(row.result_value, 2)} ${row.result_unit || ""} · Skor ${formatNumber(row.score)}` : "Belum ada data"}</strong></div>;
                  })}
                  {!active.complete && <p className="vk-inline-warning">Sesi belum lengkap. Persetujuan dinonaktifkan sampai lima komponen tersedia.</p>}
                </div>
              )}
              {active.details && <div className="vk-description"><strong>Catatan / Deskripsi</strong><p>{active.details}</p></div>}

              {active.kind === "achievement" && active.evidence && (
                <div className="vk-evidence"><strong>Dokumentasi Pendukung</strong>{previewLoading ? <p>Membuka dokumentasi...</p> : preview ? <a href={preview} target="_blank" rel="noopener noreferrer">Buka {active.evidence.name} ↗</a> : <p>Dokumentasi belum dapat dibuka. Periksa akses Storage.</p>}</div>
              )}
              {active.kind === "praktik" && (
                <div className="vk-evidence"><strong>Dokumentasi Praktik</strong>{previewLoading ? <p>Membuka dokumentasi...</p> : preview ? <a href={preview} target="_blank" rel="noopener noreferrer">Buka {active.evidence?.name || "Dokumentasi"} ↗</a> : <p>{active.evidence ? "Dokumentasi belum dapat dibuka." : "Dokumentasi belum tercatat pada metadata."}</p>}</div>
              )}

              {error && <div className="vk-alert error" role="alert">{error}</div>}
              {active.status === "pending" && (
                <label className="vk-confirm"><input type="checkbox" checked={checked} disabled={!!processing || previewLoading} onChange={(event) => setChecked(event.target.checked)} />Saya sudah memeriksa data dan dokumentasi yang tersedia.</label>
              )}
              {active.kind === "posttest" && !isAdmin && active.status === "pending" && <div className="vk-inline-warning">Post-Test menunggu persetujuan Admin. Mentor dapat melihat detail, tetapi tidak dapat menyetujui.</div>}
              {active.kind === "samapta" && !isAdmin && active.status === "pending" && <div className="vk-inline-warning">Samapta menunggu persetujuan Admin. Mentor dapat melihat detail, tetapi tidak dapat menyetujui.</div>}

              <div className="vk-modal-actions">
                <button type="button" className="vk-secondary" onClick={() => router.push(active.kind === "achievement" ? `/achievement/${active.programId}` : active.kind === "praktik" ? `/praktik/${active.programId}` : active.kind === "posttest" ? `/peserta/${active.programId}` : `/samapta/${active.programId}`)}>Buka Modul Peserta</button>
                {canApproveActive && <button type="button" className="vk-approve" onClick={approveActive} disabled={!checked || !!processing || previewLoading || (active.kind === "praktik" && !active.evidence?.path) || (active.kind === "samapta" && !active.complete)}>{processing ? "Menyimpan..." : "✓ Setujui / Verifikasi"}</button>}
                {active.status === "verified" && <span className="vk-verified-note">Data ini sudah Verified dan masuk perhitungan resmi.</span>}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const css = `
.vk-root,.vk-root *{box-sizing:border-box}
.vk-root{--vk-bg:#0d171b;--vk-panel:#17272b;--vk-surface:#203438;--vk-text:#edf8f4;--vk-muted:#a5bbb8;--vk-border:#30484b;--vk-green:#58e4a4;min-height:100vh;background:var(--vk-bg);color:var(--vk-text);font:14px/1.5 Arial,Helvetica,sans-serif;color-scheme:dark}
:root:not([data-theme="dark"]) .vk-root{--vk-bg:#f1f6f3;--vk-panel:#fff;--vk-surface:#f4f8f6;--vk-text:#183b32;--vk-muted:#627c72;--vk-border:#d5e4dc;--vk-green:#087c58;color-scheme:light}
.vk-root button,.vk-root input,.vk-root select{font:inherit}
.vk-root button{cursor:pointer}
.vk-root button:disabled{opacity:.55;cursor:not-allowed}
.vk-root :focus-visible{outline:2px solid var(--vk-green);outline-offset:2px}
.vk-layout{min-height:100vh}

/* SIDEBAR: MATCH THE MAIN MENTOR / ADMIN DASHBOARD */
.vk-root .mt-sidebar{position:fixed;top:0;bottom:0;left:0;z-index:50;width:255px;padding:20px 14px 15px;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto;color:#fff;background:linear-gradient(170deg,#063c32 0%,#042e29 55%,#03231f 100%);box-shadow:5px 0 22px rgba(0,0,0,.1)}
html[data-theme="dark"] .vk-root .mt-sidebar{background:linear-gradient(170deg,#0b2a26,#071d1b 60%,#061514)}
.vk-root .mt-brand{padding:12px 10px 22px;margin-bottom:9px;border-bottom:1px solid #ffffff25}
.vk-root .mt-brand-title{color:#fff;font-size:23px;font-weight:900;letter-spacing:-.7px;white-space:nowrap}
.vk-root .mt-brand-title span{color:#48dfa7}
.vk-root .mt-brand-title small{color:#b8dbce;font-size:10px;letter-spacing:0}
.vk-root .mt-brand p{margin:9px 0 0;color:#c0ddd0;font-size:11px;line-height:1.7}
.vk-root .mt-sidebar-nav{display:grid;gap:15px;align-content:start}
.vk-root .mt-sidebar-group{display:grid;gap:5px;padding:10px 0 14px;border-bottom:1px solid rgba(207,247,221,.16)}
.vk-root .mt-sidebar-group:last-child{border-bottom:0}
.vk-root .mt-sidebar-group .mt-menu-label{padding:4px 9px 9px;color:#8fe9bd;font-size:9.5px;letter-spacing:1.6px}
.vk-root .mt-menu-label{padding:10px 12px;color:#95cebb;font-size:10px;font-weight:800;letter-spacing:1.1px}
.vk-root .mt-nav{display:flex;align-items:center;gap:12px;width:100%;min-height:42px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:#e5f6ed;text-align:left;font-size:12px;font-weight:700;transition:background .15s ease}
.vk-root .mt-nav svg{flex-shrink:0}
.vk-root .mt-nav span{min-width:0;flex:1}
.vk-root .mt-nav:hover:not(:disabled){background:#ffffff16}
.vk-root .mt-nav.active{color:#fff;background:#07885c;border-color:#ffffff19}
.vk-root .mt-sidebar-bottom{margin-top:24px;padding-top:17px;border-top:1px solid #ffffff25}
.vk-root .mt-sidebar-user{display:flex;align-items:center;gap:11px;min-width:0;padding:12px;margin-bottom:13px;border:1px solid #ffffff22;border-radius:11px;background:#ffffff0e}
.vk-root .mt-sidebar-user>div:last-child{min-width:0}
.vk-root .mt-sidebar-user strong,.vk-root .mt-sidebar-user small{display:block;overflow-wrap:anywhere}
.vk-root .mt-sidebar-user strong{color:#fff;font-size:11px}
.vk-root .mt-sidebar-user small{margin-top:4px;color:#b9d8c9;font-size:10px}
.vk-root .mt-sidebar-bottom .mt-nav{min-height:40px;padding:10px 12px}
.vk-root .mt-sidebar-bottom .mt-nav:last-child{color:#ffd6cd}
.vk-root .mt-avatar{width:38px;height:38px;flex-shrink:0;display:grid;place-items:center;border-radius:50%;background:#d4f4e3;color:#07573d;font-size:12px;font-weight:900}
.vk-overlay-side{display:none}

.vk-main{min-width:0;margin-left:255px;padding:22px;display:grid;gap:16px}
.vk-mobile-head{display:none}
.vk-page-head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;padding:23px;border:1px solid var(--vk-border);border-radius:15px;background:linear-gradient(110deg,#0b302a,#124a3b)}
.vk-eyebrow{font-size:10px;letter-spacing:1.4px;font-weight:800;color:#82e5b5}
.vk-page-head h1{margin:7px 0 5px;font-size:clamp(27px,3vw,39px);line-height:1.15;color:#f2fff8}
.vk-page-head p{margin:0;color:#c2d9ce;font-size:13px}
.vk-page-head>div:first-child>small{display:block;margin-top:12px;color:#a8c9ba;font-size:11px}
.vk-head-actions{display:grid;justify-items:end;gap:12px;margin-left:auto}
.vk-account{display:flex;align-items:center;gap:10px}
.vk-account-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#d4f4e3;color:#07573d;font-weight:900}
.vk-account strong,.vk-account small{display:block}
.vk-account strong{font-size:12px;color:#fff}
.vk-account small{font-size:11px;color:#c2d9ce}
.vk-dashboard-btn,.vk-section-title>button{display:flex;align-items:center;gap:7px;border:1px solid var(--vk-border);border-radius:9px;background:var(--vk-surface);color:var(--vk-text);padding:9px 12px;font-weight:700;font-size:12px}
.vk-dashboard-btn{background:#0b8a60;border-color:#25a979;color:#fff}
.vk-alert{padding:12px 14px;border-radius:9px;font-size:12px;overflow-wrap:anywhere}
.vk-alert.error{background:#46272d;border:1px solid #91515c;color:#ffd6da}
.vk-alert.success{background:#153e30;border:1px solid #327c5e;color:#b7f5d1}
.vk-section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.vk-section-title h2{margin:0;font-size:18px}
.vk-section-title p{margin:4px 0 0;color:var(--vk-muted);font-size:12px}
.vk-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.vk-summary-card,.vk-panel{min-width:0;border:1px solid var(--vk-border);border-radius:13px;background:var(--vk-panel);padding:17px}
.vk-summary-card{display:grid;gap:5px;align-content:start}
.vk-summary-card small{font-size:11px;color:var(--vk-muted)}
.vk-summary-card strong{font-size:31px;line-height:1.2;color:var(--vk-green)}
.vk-summary-card span{font-size:11px;color:var(--vk-muted)}
.vk-summary-card.pending{border-top:2px solid #d7aa55}
.vk-summary-card.pending strong{color:#e7b95d}
.vk-summary-card.verified{border-top:2px solid #36b983}
.vk-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px;margin-top:14px}
.vk-category-card{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:5px 11px;text-align:left;padding:15px;border:1px solid var(--vk-border);border-radius:12px;background:var(--vk-surface);color:var(--vk-text);min-width:0}
.vk-category-card:hover,.vk-category-card.selected{border-color:#21b77c;background:color-mix(in srgb,var(--vk-surface) 82%,#0b9867 18%)}
.vk-category-icon{grid-row:span 3;width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:#28534422}
.vk-category-name{font-weight:800;font-size:13px;overflow-wrap:anywhere}
.vk-category-card>strong{font-size:25px;line-height:1.1;color:var(--vk-green)}
.vk-category-card>small{font-size:10px;color:var(--vk-muted)}
.vk-category-counts{grid-column:1/-1;display:flex;justify-content:space-between;gap:8px;margin-top:7px;padding-top:8px;border-top:1px solid var(--vk-border);font-size:10px}
.vk-category-counts em{font-style:normal;color:#d9ad57}
.vk-category-counts em:last-child{color:#46c98f}
.vk-chart-scroll{overflow-x:auto;margin-top:12px;padding-bottom:5px}
.vk-chart{min-width:850px;display:grid;grid-template-columns:repeat(25,minmax(0,1fr));gap:5px;align-items:end}
.vk-chart-col{min-width:0;display:grid;grid-template-rows:18px 126px 18px 16px;gap:3px;justify-items:center;border:1px solid transparent;border-radius:7px;padding:4px 2px;background:transparent;color:var(--vk-muted)}
.vk-chart-col:hover,.vk-chart-col.selected{background:var(--vk-surface);border-color:#299d72}
.vk-chart-percent{font-size:9px;font-weight:800;color:var(--vk-text)}
.vk-chart-track{width:100%;height:100%;display:flex;align-items:end;justify-content:center;border-bottom:1px solid var(--vk-border);background:repeating-linear-gradient(to top,transparent 0 calc(25% - 1px),var(--vk-border) calc(25% - 1px) 25%)}
.vk-chart-stack{width:min(22px,80%);height:100%;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;border-radius:5px 5px 0 0}
.vk-chart-stack i{display:block;flex:none;min-height:0}
.vk-chart-stack i.verified{background:#42c88e}
.vk-chart-stack i.pending{background:#e5b452}
.vk-chart-stack i.other{background:#de8087}
.vk-chart-label{font-size:9px}
.vk-chart-total{font-size:9px;color:var(--vk-text)}
.vk-legend{display:flex;gap:15px;flex-wrap:wrap;margin-top:10px;color:var(--vk-muted);font-size:11px}
.vk-legend span{display:flex;align-items:center;gap:6px}
.vk-legend i{width:9px;height:9px;border-radius:50%}
.vk-legend i.verified{background:#42c88e}.vk-legend i.pending{background:#e5b452}.vk-legend i.other{background:#de8087}
.vk-filters{display:grid;grid-template-columns:1fr 1fr 1fr minmax(180px,2fr) auto;gap:9px;align-items:end;margin:14px 0;padding-bottom:14px;border-bottom:1px solid var(--vk-border)}
.vk-filters label{display:grid;gap:5px;min-width:0}
.vk-filters label span{font-size:11px;color:var(--vk-muted);font-weight:700}
.vk-filters input,.vk-filters select{width:100%;min-width:0;min-height:39px;padding:9px 10px;border:1px solid var(--vk-border);border-radius:8px;background:var(--vk-surface);color:var(--vk-text);font-size:12px}
.vk-reset{min-height:39px;border:1px solid var(--vk-border);border-radius:8px;background:var(--vk-surface);color:var(--vk-text);padding:8px 12px;font-size:12px;font-weight:700}
.vk-record-list{display:grid;gap:10px}
.vk-record{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:15px;border:1px solid var(--vk-border);border-radius:11px;background:var(--vk-surface)}
.vk-record-main{min-width:0}
.vk-record-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.vk-kind{display:inline-flex;padding:4px 8px;border-radius:6px;background:#23523f;color:#9ce9bd;font-size:10px;font-weight:800}
.vk-status{display:inline-flex;padding:4px 8px;border-radius:6px;font-size:10px;font-weight:800}
.vk-status.pending{background:#574322;color:#ffda91}
.vk-status.verified{background:#174a36;color:#a4f0c5}
.vk-status.other{background:#4a3438;color:#f3c4c8}
.vk-record h3{margin:8px 0 3px;font-size:14px}
.vk-record p{margin:4px 0;color:var(--vk-muted);font-size:11px;overflow-wrap:anywhere}
.vk-record small{color:var(--vk-muted);font-size:10px}
.vk-record-detail{margin-top:7px!important;color:var(--vk-text)!important}
.vk-record-description{max-width:900px;white-space:pre-wrap;line-height:1.5}
.vk-record-actions{flex-shrink:0;display:flex;align-items:center;gap:8px}
.vk-record-actions button{border:1px solid #278b65;border-radius:8px;background:#087c58;color:white;padding:9px 13px;font-size:11px;font-weight:800}
.vk-record-actions .vk-detail-btn{border-color:var(--vk-border);background:transparent;color:var(--vk-text)}
.vk-record-actions .vk-record-verify{border-color:#28a979;background:#087c58;color:#fff}
.vk-empty{padding:38px 12px;text-align:center;color:var(--vk-muted);font-size:12px}
.vk-footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 2px;color:var(--vk-muted);font-size:10px}
.vk-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgba(0,15,13,.76)}
.vk-modal{width:min(100%,680px);max-height:92vh;overflow:auto;border:1px solid var(--vk-border);border-radius:15px;background:var(--vk-panel);box-shadow:0 22px 65px rgba(0,0,0,.35)}
.vk-modal-header{display:flex;justify-content:space-between;gap:15px;padding:19px;border-bottom:1px solid var(--vk-border)}
.vk-modal-header h2{margin:10px 0 5px;font-size:20px}
.vk-modal-header p{margin:0;color:var(--vk-muted);font-size:12px}
.vk-modal-header small{display:block;margin-top:6px;color:var(--vk-muted);font-size:10px}
.vk-close{width:35px;height:35px;display:grid;place-items:center;flex:none;border:1px solid var(--vk-border);border-radius:8px;background:var(--vk-surface);color:var(--vk-text)}
.vk-modal-body{padding:19px}
.vk-detail-line{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border-radius:8px;background:var(--vk-surface);margin-bottom:9px;font-size:12px}
.vk-description,.vk-evidence,.vk-samapta-details{padding:13px;border:1px solid var(--vk-border);border-radius:9px;background:var(--vk-surface);margin-top:11px}
.vk-description strong,.vk-evidence strong,.vk-samapta-details>strong{display:block;font-size:12px}
.vk-description p,.vk-evidence p{margin:7px 0 0;color:var(--vk-muted);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}
.vk-evidence a{display:inline-block;margin-top:8px;color:var(--vk-green);font-size:12px;font-weight:700}
.vk-samapta-details>div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--vk-border);font-size:11px}
.vk-samapta-details>div:last-of-type{border-bottom:0}
.vk-samapta-details>div strong{text-align:right}
.vk-inline-warning{margin-top:10px;padding:10px;border:1px solid #94723d;border-radius:8px;background:#47381f;color:#ffdfa1;font-size:11px}
.vk-confirm{display:flex;align-items:flex-start;gap:9px;margin-top:16px;color:var(--vk-text);font-size:11px;line-height:1.6}
.vk-confirm input{width:17px;height:17px;flex:none;accent-color:#0a9b69}
.vk-modal-actions{display:flex;align-items:center;justify-content:flex-end;gap:9px;flex-wrap:wrap;margin-top:18px}
.vk-secondary,.vk-approve{border:1px solid var(--vk-border);border-radius:8px;padding:10px 13px;font-size:11px;font-weight:800}
.vk-secondary{background:var(--vk-surface);color:var(--vk-text)}
.vk-approve{background:#07885c;border-color:#28a979;color:#fff}
.vk-verified-note{color:var(--vk-green);font-size:11px}
@media(max-width:1200px){.vk-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.vk-search{grid-column:span 2}.vk-reset{justify-self:start}}
@media(max-width:900px){.vk-root .mt-sidebar{width:235px}.vk-main{margin-left:235px}.vk-category-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){
  .vk-root .mt-sidebar{width:275px;transform:translateX(-105%);transition:transform .2s ease;z-index:55}
  .vk-root .mt-sidebar.open{transform:translateX(0)}
  .vk-overlay-side{display:block;position:fixed;inset:0;z-index:54;width:100%;height:100%;border:0;background:rgba(0,20,17,.65)}
  .vk-main{margin-left:0;width:100%;padding:14px}
  .vk-mobile-head{display:flex;align-items:center;justify-content:space-between;min-height:55px;margin:-14px -14px 0;padding:10px 15px;background:#06392e;color:#fff}
  .vk-mobile-head strong{font-size:18px}.vk-mobile-head strong span{color:#53e7a5}
  .vk-mobile-head button{width:36px;height:36px;display:grid;place-items:center;border:1px solid #ffffff35;border-radius:8px;background:#ffffff12;color:#fff}
  .vk-page-head{padding:16px}.vk-head-actions{margin-left:0;justify-items:start}.vk-summary-grid{grid-template-columns:1fr}.vk-filters{grid-template-columns:1fr 1fr}.vk-search{grid-column:span 2}
}
@media(max-width:520px){.vk-category-grid{grid-template-columns:1fr 1fr;gap:7px}.vk-category-card{padding:10px;gap:4px 8px}.vk-category-icon{width:34px;height:34px}.vk-category-name{font-size:11px}.vk-category-card>strong{font-size:21px}.vk-category-counts{font-size:9px}.vk-record{align-items:stretch;flex-direction:column}.vk-record-actions button{width:100%}.vk-modal-actions>*{flex:1}.vk-footer{display:grid}}
`;
