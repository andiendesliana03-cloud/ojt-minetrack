"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// OJT MINETRACK V2.0 — MONITORING PENILAIAN ADMIN / MENTOR
// Route: app/mentor/monitoring-penilaian/page.jsx
// Read-only monitoring. Tidak mengubah database, skor, marker, atau status verifikasi.

const PAGE_SIZE = 10;
const FETCH_CHUNK = 500;
const POSTTEST_RE = /\[\[OJT_POSTTEST_REVIEW_V1:([\s\S]*?)\]\]/g;
const PRACTICE_RE = /\[\[OJT_PRACTICE_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_RE = /\[\[OJT_SAMAPTA_REVIEW_V1:([\s\S]*?)\]\]/g;
const SAMAPTA_TYPES = ["Lari 12 Menit", "Pull-Up", "Push-Up", "Sit-Up", "Shuttle Run"];
const TABS = [
  { key: "posttest", label: "Post-Test", subtitle: "Penilaian Teori", icon: "book" },
  { key: "praktik", label: "Praktik", subtitle: "Penilaian Praktik", icon: "clipboard" },
  { key: "samapta", label: "Samapta", subtitle: "Kesamaptaan Jasmani", icon: "shield" },
];

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const normalizeKey = (value) => normalize(value).replace(/[^a-z0-9]/g, "");
const normalizeSite = (value) => String(value ?? "").trim().toUpperCase();

function roleOf(value) {
  const role = normalizeKey(value);
  if (["admin", "administrator", "superadmin"].includes(role)) return "admin";
  if (role === "mentor") return "mentor";
  return "unknown";
}

function isParticipantRole(value) {
  return ["participant", "peserta"].includes(normalize(value));
}

function isSimulationParticipant(profile) {
  return normalizeKey(profile?.full_name) === "simulasi01";
}

function parseDate(value) {
  const match = String(value ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("id-ID", { maximumFractionDigits: digits }) : "—";
}

function initials(value) {
  return String(value || "Pengguna").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function decodeMeta(raw, regex) {
  let found = null;
  const pattern = new RegExp(regex.source, "g");
  for (const match of String(raw ?? "").matchAll(pattern)) {
    try {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (parsed && typeof parsed === "object") found = parsed;
    } catch {
      // Marker yang tidak valid diabaikan agar halaman monitoring tetap dapat dibuka.
    }
  }
  return found;
}

function stripMarker(raw, regex) {
  return String(raw ?? "").replace(new RegExp(regex.source, "g"), "").trim();
}

function parsePostTestNotes(raw) {
  const clean = stripMarker(raw, POSTTEST_RE).replace(/\r\n/g, "\n");
  const lines = clean.split("\n");
  const first = lines[0]?.trim() || "";
  const match = first.match(/^Materi:\s*(.+)$/i);
  return {
    material: match?.[1]?.trim() || "Post-Test",
    description: match ? lines.slice(1).join("\n").trim() : clean,
  };
}

function getEvidence(raw, programId) {
  const pattern = /\[\[OJT_FILE_V1:([\s\S]*?)\]\]/g;
  const meta = decodeMeta(raw, pattern);
  const path = typeof meta?.path === "string" ? meta.path : "";
  if (!path.startsWith(`${programId}/`)) return null;
  return { name: String(meta?.name || "Dokumentasi Praktik"), path };
}

function postTestStatus(notes) {
  const meta = decodeMeta(notes, POSTTEST_RE);
  if (meta?.status === "pending") return "pending";
  if (meta?.status === "verified") return "verified";
  // Data historis sebelum marker persetujuan diperlakukan sebagai Verified.
  return "verified";
}

function practiceStatus(row) {
  const meta = decodeMeta(row.notes, PRACTICE_RE);
  if (meta?.status === "pending") return "pending";
  if (meta?.status === "verified" || (row.score !== null && row.score !== undefined)) return "verified";
  return "other";
}

function samaptaStatus(rows) {
  const pending = rows.some((row) => decodeMeta(row.notes, SAMAPTA_RE)?.status === "pending");
  const names = new Set(rows.map((row) => normalizeKey(row.test_type)));
  const complete = SAMAPTA_TYPES.every((name) => names.has(normalizeKey(name))) && rows.length === SAMAPTA_TYPES.length;
  if (pending) return { status: "pending", complete };
  return { status: complete ? "verified" : "other", complete };
}

async function fetchAllRows(table, columns, programIds) {
  const rows = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .in("program_id", programIds)
      .order("id", { ascending: true })
      .range(offset, offset + FETCH_CHUNK - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < FETCH_CHUNK) break;
    offset += FETCH_CHUNK;
  }
  return rows;
}

function buildSamaptaSessions(rows, programMap, peopleMap) {
  const grouped = new Map();
  for (const row of rows) {
    const date = String(row.test_date ?? "").slice(0, 10);
    const key = `${row.program_id}::${date}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return [...grouped.entries()].map(([key, sourceRows]) => {
    const [programId, date] = key.split("::");
    const program = programMap.get(programId);
    const person = peopleMap.get(program?.participant_id);
    const rowsSorted = SAMAPTA_TYPES.map((type) => sourceRows.find((row) => normalizeKey(row.test_type) === normalizeKey(type))).filter(Boolean);
    const state = samaptaStatus(sourceRows);
    const scores = rowsSorted
      .filter((row) => row.score !== null && row.score !== undefined && row.score !== "")
      .map((row) => Number(row.score))
      .filter(Number.isFinite);
    const score = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null;
    return {
      id: `samapta-${programId}-${date}`,
      kind: "samapta",
      programId,
      participantId: program?.participant_id,
      person: person?.full_name || "Peserta OJT",
      department: person?.department || "—",
      site: program?.site || "—",
      date,
      title: "Samapta",
      score,
      status: state.status,
      complete: state.complete,
      rows: rowsSorted,
      verifiedAt: rowsSorted.map((row) => decodeMeta(row.notes, SAMAPTA_RE)?.reviewedAt).find(Boolean) || null,
      details: rowsSorted.map((row) => `${row.test_type}: ${formatNumber(row.result_value, 2)} ${row.result_unit || ""} · Skor ${formatNumber(row.score)}`).join("\n"),
    };
  });
}

async function fetchMonitoringData(user, role) {
  let programQuery = supabase
    .from("ojt_programs")
    .select("id,participant_id,mentor_id,site,status,start_date,end_date")
    .in("status", ["active", "approved"])
    .order("start_date", { ascending: false });
  if (role === "mentor") programQuery = programQuery.eq("mentor_id", user.id);

  const { data: rawPrograms, error: programError } = await programQuery;
  if (programError) throw new Error(`Program OJT: ${programError.message}`);

  const participantIds = [...new Set((rawPrograms || []).map((program) => program.participant_id).filter(Boolean))];
  if (!participantIds.length) return { programs: [], postTests: [], practices: [], samapta: [] };

  const { data: people, error: peopleError } = await supabase
    .from("profiles")
    .select("id,full_name,department,role")
    .in("id", participantIds);
  if (peopleError) throw new Error(`Profil peserta: ${peopleError.message}`);

  const peopleMap = new Map((people || []).map((person) => [person.id, person]));
  const programs = (rawPrograms || []).flatMap((program) => {
    const person = peopleMap.get(program.participant_id);
    if (!person || !isParticipantRole(person.role) || isSimulationParticipant(person)) return [];
    return [{ ...program, peserta: person }];
  });
  const programIds = programs.map((program) => program.id);
  if (!programIds.length) return { programs: [], postTests: [], practices: [], samapta: [] };

  const [postTests, practices, samaptaRows] = await Promise.all([
    fetchAllRows("post_test_scores", "id,program_id,test_date,score,notes,created_by,created_at", programIds),
    fetchAllRows("weekly_practice_scores", "id,program_id,practice_date,practice_name,score,notes,created_by,created_at", programIds),
    fetchAllRows("samapta_records", "id,program_id,test_date,test_type,result_value,result_unit,score,notes,outcome", programIds),
  ]);

  const programMap = new Map(programs.map((program) => [program.id, program]));
  const insideProgram = (date, program) => {
    const day = String(date ?? "").slice(0, 10);
    if (!parseDate(day) || !parseDate(program?.start_date)) return false;
    const start = String(program.start_date).slice(0, 10);
    const end = parseDate(program.end_date) ? String(program.end_date).slice(0, 10) : null;
    return day >= start && (!end || day <= end);
  };
  const validPostTests = postTests.filter((row) => insideProgram(row.test_date, programMap.get(row.program_id))).map((row) => {
    const program = programMap.get(row.program_id);
    const person = peopleMap.get(program?.participant_id);
    const parsed = parsePostTestNotes(row.notes);
    return {
      id: `posttest-${row.id}`,
      sourceId: row.id,
      kind: "posttest",
      programId: row.program_id,
      participantId: program?.participant_id,
      person: person?.full_name || "Peserta OJT",
      department: person?.department || "—",
      site: program?.site || "—",
      date: row.test_date,
      title: parsed.material,
      score: row.score,
      status: postTestStatus(row.notes),
      details: parsed.description,
      notes: row.notes || "",
      createdAt: row.created_at || "",
      review: decodeMeta(row.notes, POSTTEST_RE),
      verifiedAt: decodeMeta(row.notes, POSTTEST_RE)?.reviewedAt || null,
    };
  });

  const validPractices = practices.filter((row) => insideProgram(row.practice_date, programMap.get(row.program_id))).map((row) => {
    const program = programMap.get(row.program_id);
    const person = peopleMap.get(program?.participant_id);
    const review = decodeMeta(row.notes, PRACTICE_RE);
    return {
      id: `praktik-${row.id}`,
      sourceId: row.id,
      kind: "praktik",
      programId: row.program_id,
      participantId: program?.participant_id,
      person: person?.full_name || "Peserta OJT",
      department: person?.department || "—",
      site: program?.site || "—",
      date: row.practice_date,
      title: row.practice_name || "Penilaian Praktik",
      score: review?.submittedScore ?? row.score,
      status: practiceStatus(row),
      details: String(row.notes || "").replace(new RegExp(PRACTICE_RE.source, "g"), "").replace(/\[\[OJT_FILE_V1:[\s\S]*?\]\]/g, "").trim(),
      notes: row.notes || "",
      createdAt: row.created_at || "",
      review,
      verifiedAt: review?.reviewedAt || null,
      evidence: getEvidence(row.notes, row.program_id),
    };
  });

  const validSamaptaRows = samaptaRows.filter((row) => insideProgram(row.test_date, programMap.get(row.program_id)));
  const samapta = buildSamaptaSessions(validSamaptaRows, programMap, peopleMap);
  return { programs, postTests: validPostTests, practices: validPractices, samapta };
}

function Icon({ name, size = 19 }) {
  const paths = {
    home: <path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" />,
    users: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 14a6 6 0 0 1 4 6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18" /></>,
    chart: <path d="M3 21h18M6 17v-5M12 17V7M18 17V3" />,
    file: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
    check: <path d="m4 12 5 5L20 6" />,
    shield: <><path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z" /><path d="m8 12 3 3 5-6" /></>,
    book: <><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" /><path d="M4 4.5v18M8 6h8M8 10h8" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 3h6v5H9zM9 13h6M9 17h5" /></>,
    refresh: <path d="M20 11a8 8 0 0 0-14-5L3 9M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />,
    logout: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="M5 5l14 14M19 5 5 19" />,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 20h16" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrow: <path d="M19 12H5m7-7-7 7 7 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>;
}

function StatusBadge({ status }) {
  const config = {
    verified: { label: "Terverifikasi", className: "verified" },
    pending: { label: "Menunggu", className: "pending" },
    other: { label: "Perlu Pemeriksaan", className: "other" },
    not_started: { label: "Belum Mengikuti", className: "not-started" },
  }[status] || { label: "Perlu Pemeriksaan", className: "other" };
  return <span className={`mp-status ${config.className}`}>{config.label}</span>;
}

export default function MonitoringPenilaianPage() {
  const router = useRouter();
  const refreshLock = useRef(false);
  const [account, setAccount] = useState(null);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("posttest");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [siteFilter, setSiteFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [detailPreview, setDetailPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const isAdmin = account?.role === "admin";
  const accountName = account?.full_name || "Pengguna";
  const accountRole = isAdmin ? "Administrator" : "Mentor OJT";

  const verifyAccess = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
      router.replace("/login");
      return null;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error("Profil pengguna tidak ditemukan.");
    const role = roleOf(profile.role);
    if (!['admin', 'mentor'].includes(role)) {
      router.replace("/dashboard-peserta");
      return null;
    }
    return { user: authData.user, profile: { ...profile, role } };
  }, [router]);

  const load = useCallback(async (silent = false) => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      const access = await verifyAccess();
      if (!access) return;
      const nextData = await fetchMonitoringData(access.user, access.profile.role);
      setAccount(access.profile);
      setData(nextData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || "Gagal memuat Monitoring Penilaian.");
    } finally {
      refreshLock.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [verifyAccess]);

  useEffect(() => { load(false); }, [load]);

  useEffect(() => {
    if (!account) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [account, load]);

  const activePrograms = data?.programs || [];
  const activeEntries = useMemo(() => {
    if (!data) return [];
    if (activeTab === "posttest") return data.postTests;
    if (activeTab === "praktik") return data.practices;
    return data.samapta;
  }, [data, activeTab]);

  const summary = useMemo(() => {
    if (!data) return null;
    const participantIds = new Set(activePrograms.map((program) => program.participant_id));
    const submittedIds = new Set(activeEntries.map((entry) => entry.participantId).filter(Boolean));
    const verified = activeEntries.filter((entry) => entry.status === "verified");
    const pending = activeEntries.filter((entry) => entry.status === "pending");
    const other = activeEntries.filter((entry) => entry.status === "other");
    const scores = verified
      .filter((entry) => entry.score !== null && entry.score !== undefined && entry.score !== "")
      .map((entry) => Number(entry.score))
      .filter(Number.isFinite);
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const activeCount = participantIds.size;
    const attended = submittedIds.size;
    const title = activeTab === "posttest" ? "Post-Test" : activeTab === "praktik" ? "Praktik" : "Samapta";
    const unit = activeTab === "samapta" ? "sesi" : activeTab === "praktik" ? "pengajuan" : "hasil";
    return {
      title,
      unit,
      activeCount,
      attended,
      notStarted: Math.max(0, activeCount - attended),
      pending: pending.length,
      verified: verified.length,
      other: other.length,
      totalEntries: activeEntries.length,
      progress: activeCount ? (attended / activeCount) * 100 : 0,
      average,
      scoreCount: scores.length,
    };
  }, [data, activePrograms, activeEntries, activeTab]);

  const sites = useMemo(() => [...new Set(activePrograms.map((program) => normalizeSite(program.site)).filter(Boolean))].sort(), [activePrograms]);

  const tableRows = useMemo(() => {
    if (!data) return [];
    const programsById = new Map(activePrograms.map((program) => [program.id, program]));
    const represented = new Set(activeEntries.map((entry) => entry.programId));
    const rows = [...activeEntries];
    for (const program of activePrograms) {
      if (represented.has(program.id)) continue;
      const person = program.peserta || {};
      rows.push({
        id: `not-started-${activeTab}-${program.id}`,
        kind: activeTab,
        programId: program.id,
        participantId: program.participant_id,
        person: person.full_name || "Peserta OJT",
        department: person.department || "—",
        site: program.site || "—",
        date: "",
        title: activeTab === "posttest" ? "Belum Mengikuti Post-Test" : activeTab === "praktik" ? "Belum Ada Penilaian Praktik" : "Belum Mengikuti Samapta",
        score: null,
        status: "not_started",
        details: "Belum terdapat data penilaian pada program OJT aktif ini.",
        rows: [],
      });
    }
    return rows.map((row) => {
      const program = programsById.get(row.programId);
      return { ...row, site: row.site || program?.site || "—" };
    }).sort((a, b) => {
      const statusOrder = { pending: 0, other: 1, not_started: 2, verified: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
      return String(b.date || "").localeCompare(String(a.date || "")) || String(a.person).localeCompare(String(b.person));
    });
  }, [data, activePrograms, activeEntries, activeTab]);

  const filteredRows = useMemo(() => {
    const keyword = normalize(search);
    return tableRows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (siteFilter !== "all" && normalizeSite(row.site) !== siteFilter) return false;
      if (dateFrom && (!row.date || row.date < dateFrom)) return false;
      if (dateTo && (!row.date || row.date > dateTo)) return false;
      if (keyword) {
        const haystack = [row.person, row.department, row.site, row.title, row.details, row.score].join(" ").toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [tableRows, search, statusFilter, siteFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [activeTab, search, statusFilter, siteFilter, dateFrom, dateTo]);

  async function openDetail(row) {
    setDetail(row);
    setDetailPreview(null);
    if (!row.evidence?.path) return;
    setPreviewLoading(true);
    const { data: signedData, error: signedError } = await supabase
      .storage.from("achievement-files").createSignedUrl(row.evidence.path, 120);
    if (!signedError) setDetailPreview(signedData?.signedUrl || null);
    setPreviewLoading(false);
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setSiteFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  function exportCsv() {
    const headers = ["No", "Peserta", "Departemen", "Site", "Judul Penilaian", "Nilai", "Tanggal", "Status"];
    const rows = filteredRows.map((row, index) => [index + 1, row.person, row.department, row.site, row.title, row.score ?? "", row.date || "", row.status]);
    const csv = [headers, ...rows].map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Monitoring_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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

  const tabLabel = TABS.find((tab) => tab.key === activeTab)?.label || "Post-Test";
  const periodLabel = "12 Sep 2026 – 06 Mar 2027";

  return (
    <main className="mpen-root">
      <style>{css}</style>
      {menuOpen && <button className="mpen-overlay" type="button" aria-label="Tutup sidebar" onClick={() => setMenuOpen(false)} />}
      <div className="mpen-shell">
        <aside className={`mpen-sidebar ${menuOpen ? "open" : ""}`}>
          <div>
            <div className="mpen-brand">
              <div className="mpen-brand-title">OJT <span>MineTrack</span><small> v2.0</small></div>
              <p>Emergency Response Group<br />PT Berau Coal</p>
            </div>
            <nav className="mpen-nav" aria-label="Navigasi Mentor dan Admin">
              <div className="mpen-nav-group">
                <div className="mpen-nav-label">MENU UTAMA</div>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/"); }}><Icon name="home"/><span>{isAdmin ? "Dashboard Admin" : "Dashboard Mentor"}</span></button>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/mentor/monitoring-peserta"); }}><Icon name="chart"/><span>Monitoring Kegiatan</span></button>
                <button type="button" className="mpen-nav-item active" aria-current="page" onClick={() => setMenuOpen(false)}><Icon name="clipboard"/><span>Monitoring Penilaian</span></button>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/mentor/verifikasi-kegiatan"); }}><Icon name="shield"/><span>Verifikasi Kegiatan</span></button>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/#jadwal-kegiatan"); }}><Icon name="calendar"/><span>Jadwal Kegiatan Mingguan</span></button>
              </div>
              <div className="mpen-nav-group">
                <div className="mpen-nav-label">MANAJEMEN PESERTA</div>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/#daftar-peserta"); }}><Icon name="users"/><span>Peserta OJT</span></button>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/mentor/daftar-peserta"); }}><Icon name="file"/><span>Pendaftaran Peserta</span></button>
                <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/mentor/persetujuan-peserta"); }}><Icon name="check"/><span>Persetujuan Peserta</span></button>
                {isAdmin && <button type="button" className="mpen-nav-item" onClick={() => { setMenuOpen(false); router.push("/admin/persetujuan-mentor"); }}><Icon name="check"/><span>Persetujuan Mentor</span></button>}
              </div>
            </nav>
          </div>
          <div className="mpen-sidebar-bottom">
            <div className="mpen-user"><span>{initials(accountName)}</span><div><strong>{accountName}</strong><small>{accountRole} · Profil Akun</small></div></div>
            <button type="button" className="mpen-nav-item" onClick={() => load(true)} disabled={refreshing || loading}><Icon name="refresh"/><span>{refreshing ? "Memperbarui..." : "Refresh Data"}</span></button>
            <button type="button" className="mpen-nav-item" onClick={logout} disabled={loggingOut}><Icon name="logout"/><span>{loggingOut ? "Sedang Keluar..." : "Keluar / Logout"}</span></button>
          </div>
        </aside>

        <section className="mpen-main">
          <div className="mpen-mobile-head"><strong>OJT <span>MineTrack</span></strong><button type="button" onClick={() => setMenuOpen(true)} aria-label="Buka sidebar"><Icon name="menu" size={22}/></button></div>
          <header className="mpen-page-head">
            <div><div className="mpen-eyebrow">EMERGENCY RESPONSE GROUP · PT BERAU COAL</div><h1>Monitoring Penilaian</h1><p>Monitoring hasil penilaian Peserta OJT (Post-Test, Praktik, dan Samapta).</p></div>
            <div className="mpen-head-actions"><div className="mpen-account"><span>{initials(accountName)}</span><div><strong>{accountName}</strong><small>{accountRole}</small></div></div><button type="button" className="mpen-dashboard" onClick={() => router.push("/")}><Icon name="arrow" size={16}/> Dashboard Utama</button></div>
          </header>

          {error && <div className="mpen-alert error" role="alert">{error}</div>}
          <div className="mpen-tab-row" role="tablist" aria-label="Jenis penilaian">
            {TABS.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={activeTab === tab.key} className={`mpen-tab ${activeTab === tab.key ? "active" : ""}`} onClick={() => { setActiveTab(tab.key); setDetail(null); }}><Icon name={tab.icon} size={18}/><span>{tab.label}</span><small>{tab.subtitle}</small></button>)}
          </div>

          <section className="mpen-content-panel">
            <div className="mpen-section-heading">
              <div><span className="mpen-section-icon"><Icon name={activeTab === "posttest" ? "book" : activeTab === "praktik" ? "clipboard" : "shield"} size={22}/></span><div><h2>Monitoring {tabLabel}</h2><p>{activeTab === "posttest" ? "Evaluasi pengetahuan peserta OJT" : activeTab === "praktik" ? "Pemantauan hasil dan dokumentasi penilaian praktik" : "Pemantauan sesi kesamaptaan dan lima komponen tes"} · Emergency Response Group</p></div></div>
              <div className="mpen-period"><Icon name="calendar" size={17}/><div><small>Periode Program</small><strong>{periodLabel}</strong></div></div>
            </div>

            {loading || !summary ? <div className="mpen-loading">Memuat data penilaian dari Supabase...</div> : (
              <>
                <div className="mpen-summary-grid">
                  <article className="mpen-stat"><span className="mpen-stat-icon blue"><Icon name="users" size={22}/></span><div><small>Peserta Aktif</small><strong>{summary.activeCount}</strong><em>Total peserta program</em></div></article>
                  <article className="mpen-stat"><span className="mpen-stat-icon green"><Icon name="check" size={22}/></span><div><small>Sudah Mengikuti</small><strong>{summary.attended}</strong><em>Peserta unik</em></div></article>
                  <article className="mpen-stat warning"><span className="mpen-stat-icon amber"><Icon name="clock" size={22}/></span><div><small>Menunggu Verifikasi</small><strong>{summary.pending}</strong><em>{summary.unit} berstatus Pending</em></div></article>
                  <article className="mpen-stat verified"><span className="mpen-stat-icon blue"><Icon name="shield" size={22}/></span><div><small>Terverifikasi</small><strong>{summary.verified}</strong><em>{summary.unit} hasil resmi</em></div></article>
                </div>

                <div className="mpen-progress-panel">
                  <div className="mpen-progress-heading"><strong>Progress Pelaksanaan {tabLabel}</strong><strong>{formatNumber(summary.progress, 1)}%</strong></div>
                  <div className="mpen-progress-track"><span style={{ width: `${summary.progress}%` }}/></div>
                  <div className="mpen-progress-foot"><span><b>{summary.attended}</b> dari {summary.activeCount} peserta sudah mengikuti</span><span>{summary.notStarted} peserta belum mengikuti</span></div>
                </div>

                <div className="mpen-secondary-summary">
                  <div><small>Belum Mengikuti</small><strong>{summary.notStarted}</strong></div>
                  <div><small>Perlu Pemeriksaan</small><strong>{summary.other}</strong></div>
                  <div><small>Total {summary.unit}</small><strong>{summary.totalEntries}</strong></div>
                  <div><small>Rata-rata Nilai Resmi</small><strong>{summary.average === null ? "—" : formatNumber(summary.average, 1)}</strong><em>{summary.scoreCount} nilai Verified dihitung</em></div>
                </div>
                <p className="mpen-count-note">Catatan: “Sudah Mengikuti” dan “Belum Mengikuti” menghitung peserta unik. Pending, Verified, dan Total menghitung pengajuan untuk Post-Test/Praktik atau sesi untuk Samapta. Rata-rata hanya menggunakan nilai berstatus Verified.</p>
              </>
            )}
          </section>

          <section className="mpen-table-panel">
            <div className="mpen-table-heading"><div><h2>Daftar Peserta – {tabLabel}</h2><p>Menampilkan status dan hasil penilaian seluruh peserta pada program aktif.</p></div><div className="mpen-table-actions"><label className="mpen-search"><Icon name="search" size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama peserta, site, atau penilaian..."/></label><button type="button" className="mpen-export" onClick={exportCsv} disabled={loading || !filteredRows.length}><Icon name="download" size={16}/> Ekspor</button></div></div>
            <div className="mpen-filters">
              <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Semua Status</option><option value="verified">Terverifikasi</option><option value="pending">Menunggu</option><option value="other">Perlu Pemeriksaan</option><option value="not_started">Belum Mengikuti</option></select></label>
              <label><span>Site / Posisi</span><select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}><option value="all">Semua Site</option>{sites.map((site) => <option key={site} value={site}>{site}</option>)}</select></label>
              <label><span>Dari Tanggal</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)}/></label>
              <label><span>Sampai Tanggal</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)}/></label>
              <button type="button" className="mpen-reset" onClick={resetFilters}>Reset</button>
            </div>

            <div className="mpen-table-wrap">
              <table className="mpen-table">
                <thead><tr><th>No</th><th>Peserta</th><th>Site / Posisi</th><th>{activeTab === "samapta" ? "Rata-rata Skor" : "Nilai"}</th><th>{activeTab === "posttest" ? "Tanggal Post-Test" : activeTab === "praktik" ? "Tanggal Praktik" : "Tanggal Samapta"}</th>{activeTab === "praktik" && <th>Jenis Praktik</th>}{activeTab === "samapta" && <th>Komponen</th>}<th>Status</th><th>Aksi</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={activeTab === "posttest" ? 7 : 8} className="mpen-empty">Memuat data...</td></tr> : pagedRows.length ? pagedRows.map((row, index) => <tr key={row.id}>
                    <td>{(page - 1) * PAGE_SIZE + index + 1}</td>
                    <td><strong>{row.person}</strong><small>{row.department}</small></td>
                    <td>{row.site}</td>
                    <td><strong>{formatNumber(row.score, 1)}</strong></td>
                    <td>{formatDate(row.date)}</td>
                    {activeTab === "praktik" && <td>{row.title}</td>}
                    {activeTab === "samapta" && <td>{row.rows?.length || 0}/5</td>}
                    <td><StatusBadge status={row.status}/></td>
                    <td><button type="button" className="mpen-detail-btn" onClick={() => openDetail(row)}><Icon name="eye" size={15}/> Lihat Detail</button></td>
                  </tr>) : <tr><td colSpan={activeTab === "posttest" ? 7 : 8} className="mpen-empty">Tidak ada data yang sesuai dengan filter.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mpen-table-footer"><span>Menampilkan {filteredRows.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filteredRows.length)} dari {filteredRows.length} data</span><div className="mpen-pagination"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>‹</button><span>Halaman {page} / {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>›</button></div></div>
          </section>

          <footer className="mpen-footer"><span>OJT MineTrack v2.0 · Emergency Response Group · PT Berau Coal</span><span>{lastUpdated ? `Diperbarui ${lastUpdated.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })} WITA` : ""}</span></footer>
        </section>
      </div>

      {detail && <div className="mpen-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><section className="mpen-modal" role="dialog" aria-modal="true" aria-labelledby="mpen-detail-title"><header><div><span className="mpen-modal-kicker">DETAIL PENILAIAN</span><h2 id="mpen-detail-title">{detail.title}</h2><p>{detail.person} · {detail.department} · {detail.site}</p></div><button type="button" onClick={() => setDetail(null)} aria-label="Tutup"><Icon name="close"/></button></header><div className="mpen-modal-body"><div className="mpen-detail-grid"><div><small>Status</small><StatusBadge status={detail.status}/></div><div><small>Tanggal Penilaian</small><strong>{formatDate(detail.date)}</strong></div><div><small>Nilai / Rata-rata Skor</small><strong>{formatNumber(detail.score, 2)}</strong></div><div><small>Jenis</small><strong>{tabLabel}</strong></div></div>
        {activeTab === "samapta" && <div className="mpen-detail-block"><strong>Rincian Lima Komponen Samapta</strong>{SAMAPTA_TYPES.map((type) => { const row = detail.rows?.find((item) => normalizeKey(item.test_type) === normalizeKey(type)); return <div className="mpen-component-row" key={type}><span>{type}</span><strong>{row ? `${formatNumber(row.result_value, 2)} ${row.result_unit || ""} · Skor ${formatNumber(row.score, 2)}` : "Belum ada data"}</strong></div>; })}</div>}
        {activeTab === "praktik" && <div className="mpen-detail-block"><strong>Dokumentasi Praktik</strong>{detail.evidence ? (previewLoading ? <p>Membuka dokumentasi...</p> : detailPreview ? <p>File: {detail.evidence.name}<br/><a className="mpen-evidence-link" href={detailPreview} target="_blank" rel="noopener noreferrer">Buka dokumentasi ↗</a></p> : <p>Dokumentasi tercatat ({detail.evidence.name}), tetapi tautan belum dapat dibuka.</p>) : <p>Dokumentasi tidak tercatat pada metadata pengajuan ini.</p>}</div>}
        {detail.verifiedAt && <div className="mpen-detail-block"><strong>Tanggal Verifikasi</strong><p>{new Date(detail.verifiedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p></div>}
        {detail.details && <div className="mpen-detail-block"><strong>Catatan / Deskripsi</strong><p>{detail.details}</p></div>}
        {detail.status === "pending" && <div className="mpen-readonly-note">Data ini masih menunggu proses persetujuan sesuai kewenangan Admin/Mentor. Perubahan status dilakukan melalui halaman Verifikasi Kegiatan, bukan dari halaman monitoring.</div>}
      </div><footer><button type="button" onClick={() => { setDetail(null); setDetailPreview(null); }}>Tutup</button></footer></section></div>}
    </main>
  );
}

const css = `
.mpen-root,.mpen-root *{box-sizing:border-box}
.mpen-root{--mpen-bg:#0d171b;--mpen-panel:#17272b;--mpen-surface:#203438;--mpen-text:#edf8f4;--mpen-muted:#a5bbb8;--mpen-border:#30484b;--mpen-green:#58e4a4;min-height:100vh;background:var(--mpen-bg);color:var(--mpen-text);font:14px/1.5 Arial,Helvetica,sans-serif;color-scheme:dark}
:root:not([data-theme="dark"]) .mpen-root{--mpen-bg:#f1f6f3;--mpen-panel:#fff;--mpen-surface:#f4f8f6;--mpen-text:#183b32;--mpen-muted:#627c72;--mpen-border:#d5e4dc;--mpen-green:#087c58;color-scheme:light}
.mpen-root button,.mpen-root input,.mpen-root select{font:inherit}.mpen-root button{cursor:pointer}.mpen-root button:disabled{opacity:.55;cursor:not-allowed}.mpen-root :focus-visible{outline:2px solid var(--mpen-green);outline-offset:2px}
.mpen-shell{min-height:100vh}.mpen-sidebar{position:fixed;top:0;bottom:0;left:0;z-index:50;width:255px;padding:20px 14px 15px;display:flex;flex-direction:column;justify-content:space-between;overflow-y:auto;color:#fff;background:linear-gradient(170deg,#063c32 0%,#042e29 55%,#03231f 100%);box-shadow:5px 0 22px rgba(0,0,0,.1)}
html[data-theme="dark"] .mpen-sidebar{background:linear-gradient(170deg,#0b2a26,#071d1b 60%,#061514)}
.mpen-brand{padding:12px 10px 22px;margin-bottom:9px;border-bottom:1px solid #ffffff25}.mpen-brand-title{color:#fff;font-size:23px;font-weight:900;letter-spacing:-.7px;white-space:nowrap}.mpen-brand-title span{color:#48dfa7}.mpen-brand-title small{color:#b8dbce;font-size:10px;letter-spacing:0}.mpen-brand p{margin:9px 0 0;color:#c0ddd0;font-size:11px;line-height:1.7}
.mpen-nav{display:grid;gap:5px}.mpen-nav-group{padding:8px 0 17px;margin-bottom:12px;border-bottom:1px solid #ffffff25}.mpen-nav-label{padding:7px 9px 11px;color:#8acbb3;font-size:10px;font-weight:900;letter-spacing:1.2px}.mpen-nav-item{width:100%;min-height:43px;display:flex;align-items:center;gap:11px;padding:10px;border:0;border-radius:9px;background:transparent;color:#d6e8e0;text-align:left;font-size:12px;font-weight:700}.mpen-nav-item:hover,.mpen-nav-item.active{background:#0b9868;color:#fff}.mpen-nav-item.active{box-shadow:inset 0 0 0 1px #39c891}.mpen-sidebar-bottom{display:grid;gap:6px}.mpen-user{display:flex;align-items:center;gap:10px;margin:0 0 7px;padding:12px;border:1px solid #ffffff22;border-radius:11px;background:#ffffff0c}.mpen-user>span,.mpen-account>span{width:40px;height:40px;display:grid;place-items:center;flex:none;border-radius:50%;background:#d7f4e5;color:#07583e;font-weight:900}.mpen-user strong,.mpen-user small,.mpen-account strong,.mpen-account small{display:block}.mpen-user strong,.mpen-account strong{font-size:12px;color:#fff}.mpen-user small,.mpen-account small{font-size:10px;color:#c0d9ce}
.mpen-main{min-width:0;margin-left:255px;padding:15px 19px 22px;display:grid;gap:13px}.mpen-mobile-head{display:none}.mpen-page-head{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:17px 19px;border:1px solid var(--mpen-border);border-radius:13px;background:linear-gradient(110deg,#0b302a,#124a3b)}.mpen-eyebrow{color:#80e4b6;font-size:10px;font-weight:900;letter-spacing:1.1px}.mpen-page-head h1{margin:3px 0 2px;color:#f5fff9;font-size:29px;line-height:1.2}.mpen-page-head p{margin:0;color:#c4ddd1;font-size:12px}.mpen-head-actions{display:grid;justify-items:end;gap:9px}.mpen-account{display:flex;align-items:center;gap:9px}.mpen-dashboard{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #26aa79;border-radius:9px;background:#07875d;color:#fff;font-size:11px;font-weight:800}
.mpen-alert{padding:11px 13px;border-radius:9px;font-size:12px}.mpen-alert.error{border:1px solid #96535d;background:#47292f;color:#ffd9dd}.mpen-tab-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.mpen-tab{min-height:48px;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid var(--mpen-border);border-radius:9px;background:var(--mpen-panel);color:var(--mpen-text);font-weight:800}.mpen-tab small{color:var(--mpen-muted);font-size:10px;font-weight:500}.mpen-tab.active{border-color:#159b6b;background:#087c58;color:#fff}.mpen-tab.active small{color:#d6f6e8}
.mpen-content-panel,.mpen-table-panel{min-width:0;padding:16px;border:1px solid var(--mpen-border);border-radius:13px;background:var(--mpen-panel)}.mpen-section-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px}.mpen-section-heading>div:first-child{display:flex;align-items:center;gap:12px;min-width:0}.mpen-section-icon{width:46px;height:46px;display:grid;place-items:center;flex:none;border-radius:11px;background:#0b795b;color:#8df0c0}.mpen-section-heading h2{margin:0;font-size:20px}.mpen-section-heading p{margin:2px 0 0;color:var(--mpen-muted);font-size:11px}.mpen-period{display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid var(--mpen-border);border-radius:9px;background:var(--mpen-surface)}.mpen-period small,.mpen-period strong{display:block}.mpen-period small{color:var(--mpen-muted);font-size:9px}.mpen-period strong{font-size:11px}
.mpen-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.mpen-stat{min-width:0;display:flex;align-items:center;gap:11px;padding:13px;border:1px solid var(--mpen-border);border-radius:11px;background:var(--mpen-surface)}.mpen-stat-icon{width:43px;height:43px;display:grid;place-items:center;flex:none;border-radius:10px}.mpen-stat-icon.blue{background:#153d53;color:#83caff}.mpen-stat-icon.green{background:#12533c;color:#6ce5ad}.mpen-stat-icon.amber{background:#55401e;color:#f1c36a}.mpen-stat small,.mpen-stat strong,.mpen-stat em{display:block}.mpen-stat small{color:var(--mpen-muted);font-size:10px;font-weight:700}.mpen-stat strong{font-size:25px;line-height:1.2}.mpen-stat em{margin-top:2px;color:var(--mpen-muted);font-size:9px;font-style:normal}.mpen-stat.warning strong{color:#e6b75b}.mpen-stat.verified strong{color:var(--mpen-green)}
.mpen-progress-panel{margin-top:11px;padding:13px 15px;border:1px solid var(--mpen-border);border-radius:10px;background:var(--mpen-surface)}.mpen-progress-heading,.mpen-progress-foot{display:flex;justify-content:space-between;align-items:center;gap:10px}.mpen-progress-heading strong:first-child{font-size:12px}.mpen-progress-heading strong:last-child{font-size:16px;color:var(--mpen-green)}.mpen-progress-track{height:12px;margin:8px 0;overflow:hidden;border-radius:99px;background:var(--mpen-border)}.mpen-progress-track span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#0aa66f,#45df9f)}.mpen-progress-foot{color:var(--mpen-muted);font-size:10px}.mpen-progress-foot b{color:var(--mpen-green)}
.mpen-secondary-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:10px}.mpen-secondary-summary>div{padding:10px 12px;border:1px solid var(--mpen-border);border-radius:9px;background:var(--mpen-surface)}.mpen-secondary-summary small,.mpen-secondary-summary strong,.mpen-secondary-summary em{display:block}.mpen-secondary-summary small{color:var(--mpen-muted);font-size:9px}.mpen-secondary-summary strong{margin-top:2px;font-size:18px}.mpen-secondary-summary em{color:var(--mpen-muted);font-size:9px;font-style:normal}.mpen-count-note{margin:10px 0 0;color:var(--mpen-muted);font-size:10px;line-height:1.5}.mpen-loading{padding:32px;text-align:center;color:var(--mpen-muted);font-size:12px}
.mpen-table-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.mpen-table-heading h2{margin:0;font-size:19px}.mpen-table-heading p{margin:2px 0 0;color:var(--mpen-muted);font-size:11px}.mpen-table-actions{display:flex;gap:8px;align-items:center}.mpen-search{min-width:250px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface);color:var(--mpen-muted)}.mpen-search input{width:100%;min-height:37px;border:0;outline:none;background:transparent;color:var(--mpen-text);font-size:11px}.mpen-export,.mpen-reset{min-height:37px;padding:8px 11px;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface);color:var(--mpen-text);font-size:11px;font-weight:800}.mpen-export{display:flex;align-items:center;gap:6px;border-color:#32966e}.mpen-filters{display:grid;grid-template-columns:1.1fr 1.1fr 1fr 1fr auto;gap:9px;align-items:end;margin:13px 0;padding-bottom:13px;border-bottom:1px solid var(--mpen-border)}.mpen-filters label{display:grid;gap:5px;min-width:0}.mpen-filters label span{color:var(--mpen-muted);font-size:10px;font-weight:700}.mpen-filters input,.mpen-filters select{width:100%;min-width:0;min-height:37px;padding:8px 9px;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface);color:var(--mpen-text);font-size:11px}
.mpen-table-wrap{width:100%;overflow-x:auto}.mpen-table{width:100%;border-collapse:collapse;min-width:850px}.mpen-table th{padding:10px 9px;background:var(--mpen-surface);color:var(--mpen-muted);font-size:10px;text-align:left;white-space:nowrap}.mpen-table td{padding:10px 9px;border-bottom:1px solid var(--mpen-border);font-size:11px;vertical-align:middle}.mpen-table td strong,.mpen-table td small{display:block}.mpen-table td small{margin-top:2px;color:var(--mpen-muted);font-size:9px}.mpen-status{display:inline-flex;padding:5px 8px;border-radius:7px;font-size:9px;font-weight:800;white-space:nowrap}.mpen-status.verified{background:#174b37;color:#a5f0c7}.mpen-status.pending{background:#584321;color:#ffdb93}.mpen-status.other{background:#4a3438;color:#f2c3c7}.mpen-status.not-started{background:#35434a;color:#cbd5d8}.mpen-detail-btn{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid var(--mpen-border);border-radius:7px;background:var(--mpen-surface);color:var(--mpen-text);font-size:10px;font-weight:700;white-space:nowrap}.mpen-empty{padding:28px!important;text-align:center;color:var(--mpen-muted)}.mpen-table-footer{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;color:var(--mpen-muted);font-size:10px}.mpen-pagination{display:flex;align-items:center;gap:9px}.mpen-pagination button{width:29px;height:29px;border:1px solid var(--mpen-border);border-radius:7px;background:var(--mpen-surface);color:var(--mpen-text)}.mpen-pagination button:disabled{opacity:.4}.mpen-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:5px 2px;color:var(--mpen-muted);font-size:9px}
.mpen-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgba(0,15,13,.76)}.mpen-modal{width:min(100%,620px);max-height:90vh;overflow:auto;border:1px solid var(--mpen-border);border-radius:14px;background:var(--mpen-panel);box-shadow:0 22px 65px rgba(0,0,0,.35)}.mpen-modal>header{display:flex;justify-content:space-between;gap:14px;padding:17px;border-bottom:1px solid var(--mpen-border)}.mpen-modal>header h2{margin:5px 0;font-size:19px}.mpen-modal>header p{margin:0;color:var(--mpen-muted);font-size:11px}.mpen-modal>header button{width:34px;height:34px;display:grid;place-items:center;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface);color:var(--mpen-text)}.mpen-modal-kicker{color:var(--mpen-green);font-size:9px;font-weight:900;letter-spacing:1px}.mpen-modal-body{padding:17px}.mpen-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.mpen-detail-grid>div{display:grid;gap:5px;padding:11px;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface)}.mpen-detail-grid small{color:var(--mpen-muted);font-size:9px}.mpen-detail-grid strong{font-size:12px}.mpen-detail-block{margin-top:12px;padding:12px;border:1px solid var(--mpen-border);border-radius:9px;background:var(--mpen-surface)}.mpen-detail-block>strong{display:block;margin-bottom:8px;font-size:11px}.mpen-detail-block p{margin:0;color:var(--mpen-muted);font-size:11px;white-space:pre-wrap;overflow-wrap:anywhere}.mpen-evidence-link{display:inline-block;margin-top:6px;color:var(--mpen-green);font-weight:800;text-decoration:underline}.mpen-component-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--mpen-border);font-size:10px}.mpen-component-row:last-child{border-bottom:0}.mpen-component-row strong{text-align:right}.mpen-readonly-note{margin-top:12px;padding:10px;border-left:3px solid #d6aa56;border-radius:6px;background:#4b3b21;color:#ffdfa1;font-size:10px}.mpen-modal>footer{display:flex;justify-content:flex-end;padding:0 17px 17px}.mpen-modal>footer button{padding:9px 14px;border:1px solid var(--mpen-border);border-radius:8px;background:var(--mpen-surface);color:var(--mpen-text);font-size:11px;font-weight:800}
@media(max-width:1100px){.mpen-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mpen-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.mpen-reset{justify-self:start}}
@media(max-width:760px){.mpen-sidebar{width:275px;transform:translateX(-105%);transition:transform .2s ease;z-index:55}.mpen-sidebar.open{transform:translateX(0)}.mpen-overlay{display:block;position:fixed;inset:0;z-index:54;width:100%;height:100%;border:0;background:rgba(0,20,17,.65)}.mpen-main{margin-left:0;padding:12px}.mpen-mobile-head{display:flex;align-items:center;justify-content:space-between;min-height:48px;margin:-12px -12px 0;padding:8px 13px;background:#06392e;color:#fff}.mpen-mobile-head strong{font-size:17px}.mpen-mobile-head strong span{color:#53e7a5}.mpen-mobile-head button{width:35px;height:35px;display:grid;place-items:center;border:1px solid #ffffff35;border-radius:8px;background:#ffffff12;color:#fff}.mpen-page-head{align-items:flex-start;padding:14px}.mpen-head-actions{justify-items:start}.mpen-section-heading{align-items:flex-start;flex-direction:column}.mpen-table-heading{align-items:stretch}.mpen-table-actions{width:100%}.mpen-search{flex:1;min-width:0}}
@media(max-width:520px){.mpen-page-head{flex-direction:column}.mpen-tab{flex-direction:column;gap:4px;padding:9px 4px;font-size:11px}.mpen-tab small{font-size:8px}.mpen-summary-grid{grid-template-columns:1fr 1fr;gap:7px}.mpen-stat{padding:9px;gap:8px}.mpen-stat-icon{width:34px;height:34px}.mpen-stat strong{font-size:21px}.mpen-stat small{font-size:9px}.mpen-stat em{font-size:8px}.mpen-secondary-summary{grid-template-columns:1fr 1fr}.mpen-progress-foot{align-items:flex-start;flex-direction:column}.mpen-filters{grid-template-columns:1fr 1fr}.mpen-table-actions{flex-wrap:wrap}.mpen-search{flex-basis:100%}.mpen-export{flex:1;justify-content:center}.mpen-table-footer{align-items:flex-start;flex-direction:column}.mpen-footer{display:grid}.mpen-detail-grid{grid-template-columns:1fr 1fr}}
`;
