"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;
const BACKGROUND_IMAGE = "/background-erg.png.PNG";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH", "BMO 1", "BMO 2",
  "BMO 3", "SRN", "PMO", "TSP", "HO",
];

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", color: "#63bfff" },
  { name: "Training", target: 4, unit: "kegiatan", color: "#58e4a4" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", color: "#f3ce75" },
  { name: "Coaching", target: 1, unit: "kegiatan", color: "#b9a2fc" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", color: "#ff9d6a" },
  { name: "Hazard", target: 2, unit: "kegiatan", color: "#a0bbcc" },
];

const STATUSES = [
  { key: "verified", label: "Terverifikasi", color: "#58e4a4" },
  { key: "pending", label: "Pending Verifikasi", color: "#f3ce75" },
  { key: "notDone", label: "Tidak Terlaksana", color: "#fa9196" },
  { key: "other", label: "Status Lain", color: "#a0bbcc" },
];

const normalize = (value) => String(value ?? "").trim().toLowerCase();
const normalizeKey = (value) => normalize(value).replace(/[^a-z0-9]/g, "");
const normalizeSite = (value) => String(value ?? "").trim().toUpperCase();
const weekNumber = (week) => String(week).padStart(2, "0");
const weekLabel = (week) => "Week " + weekNumber(week);
const isActive = (program) =>
  ["active", "approved", "aktif"].includes(normalize(program.status));

function parseDate(value) {
  const match = String(value ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.toISOString().slice(0, 10) === match[0] ? date : null;
}

function addDays(value, days) {
  const date = parseDate(value);
  if (!date) return null;

  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, index) => {
  const start = index === 0 ? "2026-09-12" : addDays("2026-09-20", (index - 1) * 7);
  return { week: index + 1, start, end: addDays(start, 6) };
});

function globalWeekOf(value) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date)) return null;
  return GLOBAL_WEEKS.find((week) => date >= week.start && date <= week.end)?.week ?? null;
}

function programWeekRange(program, weekNumber) {
  const week = GLOBAL_WEEKS[weekNumber - 1];
  if (!week || !parseDate(program?.start_date)) return null;

  const programStart = String(program.start_date).slice(0, 10);
  const programEnd = parseDate(program.end_date) ? String(program.end_date).slice(0, 10) : null;
  const start = week.start > programStart ? week.start : programStart;
  const end = programEnd && programEnd < week.end ? programEnd : week.end;
  return start <= end ? { start, end } : null;
}

function insideProgram(value, program) {
  const date = String(value ?? "").slice(0, 10);
  if (!parseDate(date) || !parseDate(program?.start_date)) return false;

  const start = String(program.start_date).slice(0, 10);
  const end = parseDate(program.end_date) ? String(program.end_date).slice(0, 10) : null;
  return date >= start && (!end || date <= end) && globalWeekOf(date) !== null;
}

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const witaFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Makassar",
});

const updateFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Makassar",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : "—";
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("id-ID", { maximumFractionDigits: digits })
    : "—";
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
  const key = normalizeKey(value);
  if (["fisik", "physical"].includes(key)) return "Fisik";
  if (["training", "internaltraining", "pelatihan"].includes(key)) return "Training";
  if (["sosialisasi", "socialization"].includes(key)) return "Sosialisasi";
  if (["coaching", "pembinaan"].includes(key)) return "Coaching";
  if (["orientasi", "orientasiarea", "areaorientation"].includes(key)) return "Orientasi Area";
  if (["hazard", "hazardidentification", "identifikasibahaya"].includes(key)) return "Hazard";
  return null;
}

function resolveCategory(record, typeMap) {
  return categoryOf(record.type_code) || categoryOf(typeMap.get(normalizeKey(record.type_code)));
}

function averageScore(rows) {
  const values = rows
    .map((item) => item.score)
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);

  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function programLabel(value) {
  const labels = {
    active: "Aktif",
    approved: "Disetujui",
    aktif: "Aktif",
    completed: "Selesai",
    finished: "Selesai",
    pending: "Menunggu",
    cancelled: "Dibatalkan",
  };
  return labels[normalize(value)] || value || "—";
}

function simperLabel(record) {
  if (!record) return "Belum Ada Data";

  const labels = {
    passed: "Lulus",
    failed: "Tidak Lulus",
    in_progress: "Dalam Proses",
    not_started: "Belum Mulai",
    completed: "Selesai",
  };
  return labels[normalize(record.status)] || record.status || "Dalam Proses";
}

function getParticipant(program) {
  return Array.isArray(program?.peserta) ? program.peserta[0] : program?.peserta;
}

function activityValue(rows, categoryName) {
  if (categoryName !== "Fisik") return rows.length;

  const meters = rows.reduce((sum, item) => {
    const km = Number(item.distance_km);
    return sum + (Number.isFinite(km) && km > 0 ? Math.round(km * 1000) : 0);
  }, 0);

  return meters / 1000;
}

// Rumus Achievement asli dengan pilihan cakupan satu minggu.
function calculateProgress(program, records, typeMap, selectedWeek) {
  const eligibleWeeks = GLOBAL_WEEKS.filter(({ week }) =>
    (!selectedWeek || week === selectedWeek) && programWeekRange(program, week)
  );

  const validRecords = records.filter((record) =>
    normalize(record.status) === "verified" &&
    insideProgram(record.activity_date, program) &&
    (!selectedWeek || globalWeekOf(record.activity_date) === selectedWeek)
  );

  const categoryDetails = TARGETS.map((target) => {
    const matching = validRecords.filter((record) => resolveCategory(record, typeMap) === target.name);

    const weekly = eligibleWeeks.map(({ week }) => {
      const rows = matching.filter((record) => globalWeekOf(record.activity_date) === week);
      const amount = activityValue(rows, target.name);
      return {
        amount,
        percent: Math.max(0, Math.min(100, (amount / target.target) * 100)),
        achieved: amount >= target.target,
      };
    });

    const percent = weekly.length
      ? weekly.reduce((sum, item) => sum + item.percent, 0) / weekly.length
      : 0;

    return {
      ...target,
      amount: weekly.reduce((sum, item) => sum + item.amount, 0),
      percent,
      completedWeeks: weekly.filter((item) => item.achieved).length,
    };
  });

  const overall = categoryDetails.reduce((sum, item) => sum + item.percent, 0) / categoryDetails.length;
  const activeWeeks = new Set(validRecords.map((item) => globalWeekOf(item.activity_date)).filter(Boolean)).size;

  return {
    overall,
    categoryDetails,
    verified: validRecords.length,
    activeWeeks,
    eligibleWeeks: eligibleWeeks.length,
    completedCategories: categoryDetails.filter((item) =>
      eligibleWeeks.length > 0 && item.completedWeeks === eligibleWeeks.length
    ).length,
  };
}

function tally(rows) {
  const counts = { total: rows.length, verified: 0, pending: 0, notDone: 0, other: 0 };

  for (const row of rows) {
    const status = normalize(row.status);
    if (status === "verified") counts.verified++;
    else if (status === "pending") counts.pending++;
    else if (["tidakterlaksana", "notdone", "notcompleted", "cancelled"].includes(normalizeKey(status))) counts.notDone++;
    else counts.other++;
  }

  return counts;
}

function percentage(value, total) {
  return total ? formatNumber((value / total) * 100, 1) + "%" : "—";
}

async function fetchAchievements(ids) {
  const rows = [];
  let lastId = null;

  // Baca seluruh kegiatan bertahap untuk menghindari batas baris per respons.
  while (true) {
    let query = supabase
      .from("achievement_records")
      .select("id,program_id,type_code,activity_date,status,distance_km")
      .in("program_id", ids)
      .order("id")
      .limit(500);

    if (lastId !== null) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw new Error("Achievement: " + error.message);
    if (!data?.length) return rows;

    rows.push(...data);
    lastId = data[data.length - 1].id;
  }
}

async function fetchDashboardData(userId, userRole) {
  let query = supabase
    .from("ojt_programs")
    .select(`
      id, participant_id, mentor_id, site, status, start_date, end_date,
      peserta:profiles!ojt_programs_participant_id_fkey(id,full_name,department,role)
    `)
    .order("start_date", { ascending: false });

  if (userRole === "mentor") query = query.eq("mentor_id", userId);

  const [programResult, typeResult] = await Promise.all([
    query,
    supabase.from("achievement_types").select("code,name"),
  ]);

  if (programResult.error) throw new Error("Program OJT: " + programResult.error.message);
  if (typeResult.error) throw new Error("Kategori: " + typeResult.error.message);

  const programs = (programResult.data || [])
    .map((item) => ({ ...item, peserta: getParticipant(item) }))
    .filter(({ peserta, participant_id }) =>
      peserta &&
      peserta.id === participant_id &&
      ["participant", "peserta"].includes(normalize(peserta.role))
    );

  const types = typeResult.data || [];
  const ids = programs.map((item) => item.id);

  if (!ids.length) {
    return { programs, types, achievements: [], postTests: [], practices: [], samapta: [], simper: [] };
  }

  const [achievements, post, practice, fitness, permits] = await Promise.all([
    fetchAchievements(ids),
    supabase.from("post_test_scores").select("id,program_id,test_date,score").in("program_id", ids),
    supabase.from("weekly_practice_scores").select("id,program_id,practice_date,score").in("program_id", ids),
    supabase.from("samapta_records").select("id,program_id,test_date,test_type,score,result_value").in("program_id", ids),
    supabase.from("simper_records").select("id,program_id,status,notes").in("program_id", ids),
  ]);

  for (const [label, result] of [
    ["Post-Test", post], ["Praktik", practice], ["Samapta", fitness], ["SIMPER", permits],
  ]) {
    if (result.error) throw new Error(label + ": " + result.error.message);
  }

  return {
    programs,
    types,
    achievements,
    postTests: post.data || [],
    practices: practice.data || [],
    samapta: fitness.data || [],
    simper: permits.data || [],
  };
}

function ProgressBar({ value, label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="mp-progress" role="progressbar" aria-label={label}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={safe}>
      <span style={{ width: safe + "%" }} />
    </div>
  );
}

function StatCard({ label, value, note, tone, children }) {
  return (
    <article className="mp-stat" data-tone={tone}>
      <small>{label}</small>
      <strong>{value}</strong>
      <small>{note}</small>
      {children}
    </article>
  );
}

function Trend({ weeks, selectedWeek, currentWeek, onSelect }) {
  const peak = Math.max(1, ...weeks.map((week) => week.total));

  return (
    <section className="mp-card">
      <h2>Tren Realisasi Kegiatan per Minggu</h2>
      <p>Pilih batang untuk membuka ringkasan minggu.</p>
      <div className="mp-scroll">
        <div className="mp-trend">
          {weeks.map((week) => {
            const active = week.week === (selectedWeek || currentWeek);
            const label = weekLabel(week.week) + " · " + week.total + " kegiatan";

            return (
              <button key={week.week} type="button" className="mp-column" data-active={active}
                aria-label={label} aria-pressed={selectedWeek === week.week} title={label}
                onClick={() => onSelect(week.week)}>
                <span className="mp-plot">
                  <span className="mp-stack">
                    <small>{week.total}</small>
                    {STATUSES.map(({ key, color }) => (
                      <span key={key} style={{
                        height: (week[key] / peak) * 100 + "%",
                        backgroundColor: color,
                      }} />
                    ))}
                  </span>
                </span>
                <span>W{weekNumber(week.week)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mp-legend">
        {STATUSES
          .filter(({ key }) => key !== "other" || weeks.some((week) => week.other))
          .map(({ key, label, color }) => (
            <span key={key}><i style={{ backgroundColor: color }} />{label}</span>
          ))}
      </div>
    </section>
  );
}

function Distribution({ categories, total }) {
  let end = 0;
  const segments = categories.filter(({ count }) => count).map(({ color, count }) => {
    const start = end;
    end += (count / total) * 100;
    return color + " " + start + "% " + Math.min(end, 100) + "%";
  });

  return (
    <section className="mp-card">
      <h2>Distribusi Kegiatan per Kategori</h2>
      <div className="mp-distribution">
        <div className="mp-donut" aria-hidden="true" style={{
          background: segments.length ? "conic-gradient(" + segments.join(", ") + ")" : "#284740",
        }}>
          <div><strong>{total}</strong><small>Kegiatan</small></div>
        </div>
        <ul className="mp-category-list">
          {categories.map(({ name, color, count }) => (
            <li key={name}>
              <span><i style={{ backgroundColor: color }} />{name}</span>
              <strong>{count}</strong>
              <small>{percentage(count, total)}</small>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function buildMonitoring(programs, data, selectedWeek) {
  const typeMap = new Map(data.types.map(({ code, name }) => [normalizeKey(code), name]));
  const programMap = new Map(programs.map((program) => [program.id, program]));
  const recordsByProgram = new Map(programs.map(({ id }) => [id, []]));
  const recordsByWeek = GLOBAL_WEEKS.map(() => []);

  for (const record of data.achievements) {
    const program = programMap.get(record.program_id);
    if (!program || !insideProgram(record.activity_date, program)) continue;

    recordsByProgram.get(program.id).push(record);
    recordsByWeek[globalWeekOf(record.activity_date) - 1].push(record);
  }

  const weeks = GLOBAL_WEEKS.map((week, index) => ({
    ...week,
    ...tally(recordsByWeek[index]),
    participants: new Set(
      programs.filter((program) => programWeekRange(program, week.week))
        .map((program) => program.participant_id)
    ).size,
  }));

  const scopedPrograms = selectedWeek
    ? programs.filter((program) => programWeekRange(program, selectedWeek))
    : programs;
  const scopedRows = selectedWeek ? recordsByWeek[selectedWeek - 1] : recordsByWeek.flat();
  const totals = tally(scopedRows);
  const activeCount = new Set(
    scopedPrograms.filter(isActive).map(({ participant_id }) => participant_id)
  ).size;

  const distribution = TARGETS.map(({ name, color }) => ({ name, color, count: 0 }));
  const categoryMap = new Map(distribution.map((item) => [item.name, item]));
  const other = { name: "Lainnya", color: "#799a91", count: 0 };

  for (const record of scopedRows) {
    const category = categoryMap.get(resolveCategory(record, typeMap)) || other;
    category.count++;
  }
  if (other.count) distribution.push(other);

  const assessments = (rows, id, dateField) => rows.filter((row) =>
    row.program_id === id && (!selectedWeek || globalWeekOf(row[dateField]) === selectedWeek)
  );

  const roster = scopedPrograms.map((program) => {
    const id = program.id;
    const records = recordsByProgram.get(id);
    const counts = tally(selectedWeek
      ? records.filter((record) => globalWeekOf(record.activity_date) === selectedWeek)
      : records);
    const progress = calculateProgress(program, records, typeMap, selectedWeek);

    const simperRows = data.simper.filter((row) => row.program_id === id);
    const latestSimper =
      simperRows.find((row) => String(row.notes || "").includes("[[SIMPER_V2]]")) ||
      simperRows[0] ||
      null;

    return {
      program,
      counts,
      progress,
      post: averageScore(assessments(data.postTests, id, "test_date")),
      practice: averageScore(assessments(data.practices, id, "practice_date")),
      samapta: assessments(data.samapta, id, "test_date").length,
      simper: simperLabel(latestSimper),
    };
  });

  const eligible = roster.filter(({ progress }) => progress.eligibleWeeks > 0);
  const targetResults = TARGETS.map((target, index) => {
    let amount = 0;
    let targetAmount = 0;
    let sumPercent = 0;

    for (const { progress } of eligible) {
      amount += progress.categoryDetails[index].amount;
      sumPercent += progress.categoryDetails[index].percent;
      targetAmount += target.target * progress.eligibleWeeks;
    }

    return {
      ...target,
      amount,
      targetAmount,
      percent: eligible.length ? sumPercent / eligible.length : 0,
    };
  });

  return { weeks, totals, activeCount, distribution, roster, targetResults };
}

export default function MonitoringKegiatanPage() {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedSite, setSelectedSite] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshInFlight = useRef(false);
  const isAdmin = normalize(account?.role) === "admin";

  const verifyAccess = useCallback(async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error("Profil pengguna tidak ditemukan.");

    const role = normalize(profile.role);

    if (["participant", "peserta"].includes(role)) {
      router.replace("/dashboard-peserta");
      return null;
    }

    if (!["admin", "mentor"].includes(role)) {
      throw new Error("Monitoring Kegiatan hanya tersedia untuk Admin dan Mentor.");
    }

    return { user, profile, role };
  }, [router]);

  const applyData = useCallback((profile, nextData) => {
    setAccount(profile);
    setData(nextData);
    setAccessError(false);
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const access = await verifyAccess();
        if (!access || !active) return;
        const nextData = await fetchDashboardData(access.user.id, access.role);
        if (active) applyData(access.profile, nextData);
      } catch (err) {
        if (!active) return;
        setAccessError(true);
        setError(err?.message || "Gagal memuat Monitoring Kegiatan.");
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();
    return () => { active = false; };
  }, [applyData, verifyAccess]);

  const refresh = useCallback(async (silent = false) => {
    if (!account || loading || refreshInFlight.current) return;

    refreshInFlight.current = true;
    if (!silent) setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess();
      if (!access) return;

      if (access.user.id !== account.id) {
        setAccessError(true);
        setData(null);
        throw new Error("Akun login berubah. Silakan buka ulang halaman.");
      }

      const nextData = await fetchDashboardData(access.user.id, access.role);
      applyData(access.profile, nextData);
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data peserta.");
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [account, applyData, loading, verifyAccess]);

  useEffect(() => {
    if (!account || accessError) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh(true);
    }, 60000);

    return () => clearInterval(interval);
  }, [account, accessError, refresh]);

  const monitoring = useMemo(() => {
    if (!data) return null;

    const keyword = normalize(search);
    const filtered = data.programs.filter((program) => {
      const { full_name, department } = program.peserta;
      const site = normalizeSite(program.site);
      const matchesSearch = normalize((full_name || "") + " " + (department || "")).includes(keyword);
      const matchesSite =
        selectedSite === "ALL" ||
        site === selectedSite ||
        (selectedSite === "UNASSIGNED" && !site);
      const matchesStatus = selectedStatus === "ALL" || normalize(program.status) === selectedStatus;
      return matchesSearch && matchesSite && matchesStatus;
    });

    return buildMonitoring(filtered, data, selectedWeek);
  }, [data, search, selectedSite, selectedStatus, selectedWeek]);

  if (loading || !account || accessError || !monitoring) {
    return (
      <main className="mp-root mp-loading">
        <style>{css}</style>
        <section className="mp-card">
          <small>OJT MineTrack v2.0</small>
          <h1>{loading ? "Monitoring Kegiatan" : "Monitoring Kegiatan Tidak Dapat Ditampilkan"}</h1>
          <p role={loading ? "status" : "alert"}>
            {loading ? "Memuat data Emergency Response Group…" : error || "Akses tidak tersedia."}
          </p>
          {!loading && (
            <button type="button" onClick={() => router.push("/")}>← Kembali ke Dashboard</button>
          )}
        </section>
      </main>
    );
  }

  const { weeks, totals, activeCount, distribution, roster, targetResults } = monitoring;
  const sites = [...new Set([
    ...SITES,
    ...data.programs.map(({ site }) => normalizeSite(site)).filter(Boolean),
  ])];

  const today = witaFormatter.format(lastUpdated);
  const currentWeek = weeks.filter(({ start }) => start <= today).length;
  const period = selectedWeek ? weeks[selectedWeek - 1] : null;
  const periodLabel = period ? weekLabel(period.week) : "All Week";
  const share = (count) =>
    totals.total ? percentage(count, totals.total) + " dari total" : "Belum ada kegiatan";
  const start = period?.start || weeks[0].start;
  const end = period?.end || weeks[TOTAL_WEEKS - 1].end;
  const referenceWeek = selectedWeek || currentWeek;

  const emptyWeeks = weeks.filter((week) =>
    week.end < today && week.participants > 0 && week.total === 0 &&
    (!period || week.week === period.week)
  );

  const leadingCategory = targetResults.reduce((best, item) => item.percent > best.percent ? item : best);

  const menu = [
    ["⌂", isAdmin ? "Dashboard Admin" : "Dashboard Mentor", "/"],
    ["▤", "Monitoring Kegiatan", null],
    ["♙", "Peserta OJT", "/mentor/daftar-peserta"],
    ["▣", "Pendaftaran Peserta", "/mentor/daftar-peserta"],
    ["☑", "Persetujuan Peserta", "/mentor/persetujuan-peserta"],
  ];

  return (
    <main className="mp-root">
      <style>{css}</style>

      <div className="mp-shell">
        <aside className="mp-sidebar">
          <div className="mp-brand">OJT <span>MineTrack</span> <small>v2.0</small></div>
          <p>Emergency Response Group<br />PT Berau Coal</p>
          <h2>Menu {isAdmin ? "Admin" : "Mentor"}</h2>

          <nav aria-label="Menu OJT">
            {menu.map(([icon, label, path]) => (
              <button key={label} type="button" aria-current={!path ? "page" : undefined}
                onClick={path ? () => router.push(path) : undefined}>
                <span aria-hidden="true">{icon}</span>{label}
              </button>
            ))}
          </nav>

          <h2>Pengelolaan OJT</h2>
          <p>Monitoring program dan pencapaian peserta</p>
          <nav aria-label="Aksi halaman">
            <button type="button" onClick={() => refresh()} disabled={refreshing}>
              ↻ {refreshing ? "Memperbarui…" : "Refresh Data"}
            </button>
            <button type="button" onClick={() => router.push("/")}>← Kembali ke Dashboard</button>
          </nav>
        </aside>

        <div className="mp-main">
          <header className="mp-hero">
            <div>
              <div className="mp-kicker">Emergency Response Group · PT Berau Coal</div>
              <h1>Monitoring Kegiatan</h1>
              <p>OJT MineTrack v2.0 · Rekap program, kegiatan, dan pencapaian peserta</p>
              <span className="mp-hero-period">{formatDate(start)} – {formatDate(end)}</span>
            </div>

            <div className="mp-hero-controls">
              <div className="mp-account">
                <span className="mp-avatar" aria-hidden="true">{initials(account.full_name)}</span>
                <div>
                  <strong>{account.full_name || "Pengguna"}</strong>
                  <small>{isAdmin ? "Administrator" : "Mentor OJT"}</small>
                </div>
              </div>

              <div className="mp-week-controls">
                <button type="button" aria-label="Minggu sebelumnya" disabled={referenceWeek <= 1}
                  onClick={() => setSelectedWeek(referenceWeek - 1)}>‹</button>

                <select aria-label="Pilih minggu monitoring" value={selectedWeek}
                  onChange={(event) => setSelectedWeek(Number(event.target.value))}>
                  <option value={0}>All Week</option>
                  {weeks.map(({ week }) => (
                    <option key={week} value={week}>{weekLabel(week)}</option>
                  ))}
                </select>

                <button type="button" aria-label="Minggu berikutnya" disabled={referenceWeek >= TOTAL_WEEKS}
                  onClick={() => setSelectedWeek(referenceWeek + 1)}>›</button>
              </div>
            </div>
          </header>

          {error && <div className="mp-error" role="alert">{error}</div>}

          <div className="mp-heading">
            <div>
              <h2>Ringkasan Monitoring</h2>
              <p>{periodLabel} · {roster.length} dari {data.programs.length} program</p>
            </div>
            <button type="button" onClick={() => refresh()} disabled={refreshing}>
              ↻ {refreshing ? "Memperbarui…" : "Refresh"}
            </button>
          </div>

          <div className="mp-filters">
            <label>
              Cari Peserta
              <input type="search" placeholder="Nama atau departemen…" value={search}
                onChange={(event) => setSearch(event.target.value)} />
            </label>

            <label>
              Site Penempatan
              <select value={selectedSite} onChange={(event) => setSelectedSite(event.target.value)}>
                <option value="ALL">Semua Site</option>
                {sites.map((site) => <option key={site} value={site}>{site}</option>)}
                <option value="UNASSIGNED">Belum Ditentukan</option>
              </select>
            </label>

            <label>
              Status Program
              <select value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
                <option value="ALL">Semua Status</option>
                {["active", "approved", "aktif", "pending", "completed", "finished", "cancelled"].map((status) => (
                  <option key={status} value={status}>
                    {status === "aktif" ? "Aktif (legacy)" : programLabel(status)}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={() => {
              setSearch("");
              setSelectedSite("ALL");
              setSelectedStatus("ALL");
            }}>↺ Reset</button>
          </div>

          <section className="mp-stats" aria-label="Indikator monitoring">
            <StatCard label="Peserta Aktif" value={activeCount} note="Program aktif atau disetujui" />
            <StatCard label="Total Kegiatan" value={totals.total} note={periodLabel} />
            <StatCard label="Terverifikasi" value={totals.verified} note={share(totals.verified)} />
            <StatCard label="Pending Verifikasi" value={totals.pending} tone="amber" note={share(totals.pending)} />
            <StatCard label="Tidak Terlaksana" value={totals.notDone} tone="red" note={share(totals.notDone)} />
            <StatCard label="Progress Program" value={weekNumber(currentWeek) + " / " + TOTAL_WEEKS}
              note={percentage(currentWeek, TOTAL_WEEKS) + " · Minggu sudah dimulai"}>
              <ProgressBar value={(currentWeek / TOTAL_WEEKS) * 100} label="Progress kalender program" />
            </StatCard>
          </section>

          <div className="mp-panels">
            <Trend weeks={weeks} selectedWeek={selectedWeek} currentWeek={currentWeek} onSelect={setSelectedWeek} />
            <Distribution categories={distribution} total={totals.total} />

            <section className="mp-card">
              <h2>Capaian Target per Kategori</h2>
              <p>{periodLabel} · Berdasarkan Achievement terverifikasi</p>

              <ul className="mp-targets">
                {targetResults.map((item) => (
                  <li key={item.name}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{formatNumber(item.amount, 3)} / {item.targetAmount} {item.unit}</small>
                    </div>
                    <ProgressBar value={item.percent} label={"Capaian " + item.name} />
                    <strong>{item.targetAmount ? formatNumber(item.percent, 1) + "%" : "—"}</strong>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mp-card">
            <h2>Rekap Mingguan 25 Week</h2>
            <p>Pilih Week pada tabel untuk membuka rekap minggu tersebut.</p>

            <div className="mp-scroll mp-week-table" role="region" aria-label="Tabel rekap 25 minggu" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>Week</th><th>Periode</th><th>Peserta</th><th>Total Kegiatan</th>
                    <th>Terverifikasi</th><th>Pending</th><th>Tidak Terlaksana</th><th>% Verifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.week} data-active={week.week === (selectedWeek || currentWeek)}>
                      <td>
                        <button type="button" className="mp-link" aria-pressed={selectedWeek === week.week}
                          onClick={() => setSelectedWeek(week.week)}>{weekLabel(week.week)}</button>
                      </td>
                      <td>{formatDate(week.start)} – {formatDate(week.end)}</td>
                      <td>{week.participants}</td>
                      <td>{week.total}</td>
                      <td>{week.verified}</td>
                      <td>{week.pending}</td>
                      <td>{week.notDone}</td>
                      <td>{percentage(week.verified, week.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mp-card">
            <h2>Rekap Pencapaian Peserta</h2>
            <p>{periodLabel} · Progres kompetensi, penilaian, dan status SIMPER program.</p>

            <div className="mp-scroll" role="region" aria-label="Tabel pencapaian peserta" tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    <th>No</th><th>Peserta OJT</th><th>Site</th><th>Periode OJT</th><th>Status</th>
                    <th>Progres Kompetensi</th><th>Total</th><th>Terverifikasi</th><th>Pending</th>
                    <th>Post-Test</th><th>Praktik</th><th>Samapta</th><th>SIMPER</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(({ program, counts, progress, post, practice, samapta, simper }, index) => (
                    <tr key={program.id}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{program.peserta.full_name || "Peserta OJT"}</strong>
                        <small>{program.peserta.department || "—"}</small>
                      </td>
                      <td>{normalizeSite(program.site) || "Belum Ditentukan"}</td>
                      <td>{formatDate(program.start_date)}<small>{formatDate(program.end_date)}</small></td>
                      <td>
                        <span className="mp-badge" data-active={isActive(program)}>
                          {programLabel(program.status)}
                        </span>
                      </td>
                      <td className="mp-progress-cell">
                        <strong>{formatNumber(progress.overall)}%</strong>
                        <ProgressBar value={progress.overall}
                          label={"Progres " + (program.peserta.full_name || "peserta")} />
                        <small>{progress.activeWeeks}/{progress.eligibleWeeks} minggu ada verifikasi</small>
                      </td>
                      <td>{counts.total}</td>
                      <td>{counts.verified}</td>
                      <td>{counts.pending}</td>
                      <td>{post == null ? "—" : formatNumber(post)}</td>
                      <td>{practice == null ? "—" : formatNumber(practice)}</td>
                      <td>{samapta}</td>
                      <td>{simper}</td>
                      <td>
                        <button type="button" className="mp-link"
                          onClick={() => router.push("/peserta/" + program.id)}>Detail →</button>
                      </td>
                    </tr>
                  ))}

                  {!roster.length && (
                    <tr><td colSpan={14}>Tidak ada peserta untuk periode dan filter ini.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mp-card">
            <h2>Insight &amp; Catatan</h2>

            <ul className="mp-insights">
              <li>{totals.pending} kegiatan menunggu verifikasi pada {periodLabel}.</li>
              {totals.other > 0 && <li>{totals.other} kegiatan tercatat dengan status lain.</li>}
              {emptyWeeks.length > 0 && (
                <li>
                  Minggu yang telah berakhir dan belum memiliki input kegiatan{" "}
                  {emptyWeeks.map(({ week }) => weekLabel(week)).join(", ")}.
                </li>
              )}
              {leadingCategory.percent > 0 && (
                <li>
                  Capaian tertinggi pada {periodLabel} adalah {leadingCategory.name}{" "}
                  ({formatNumber(leadingCategory.percent, 1)}%).
                </li>
              )}
              <li>Capaian kategori merata-ratakan persentase Achievement per minggu program dengan batas 100% per minggu. Fisik dihitung dalam km.</li>
              <li>Tidak Terlaksana dihitung dari status kegiatan yang tercatat. Minggu tanpa input dicatat terpisah.</li>
              <li>Kalender global dimulai 12 September 2026 dan berakhir 6 Maret 2027. Tanggal 19 September 2026 berada di luar minggu program.</li>
            </ul>
          </section>

          <footer className="mp-footer">
            <span>OJT MineTrack v2.0 · Emergency Response Group</span>
            <span>Terakhir diperbarui {updateFormatter.format(lastUpdated)} WITA</span>
          </footer>
        </div>
      </div>
    </main>
  );
}

const css = `
.mp-root {
  --bg: #0a1716; --panel: #112723; --surface: #18342d; --line: #2a4d42;
  --ink: #edf9f2; --dim: #a7c3b8; --accent: #74e4b2; --track: #284940;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.5 Arial, Helvetica, sans-serif;
  color-scheme: dark;
}

:root[data-theme="light"] .mp-root {
  --bg: #edf5f0; --panel: #fff; --surface: #f1f8f4; --line: #cde0d6;
  --ink: #173832; --dim: #4f6d63; --accent: #087552; --track: #d4e8de;
  color-scheme: light;
}

.mp-root, .mp-root * { box-sizing: border-box; }
.mp-root h1, .mp-root h2, .mp-root p { margin: 0; }
.mp-root h2 { font-size: 17px; line-height: 1.3; }
.mp-root p { color: var(--dim); }

.mp-root button, .mp-root select, .mp-root input {
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  min-height: 38px;
}

.mp-root button, .mp-root select { cursor: pointer; }
.mp-root button:hover:not(:disabled) { border-color: var(--accent); }
.mp-root button:disabled { opacity: .52; cursor: default; }
.mp-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.mp-shell {
  display: grid;
  grid-template-columns: 216px minmax(0, 1fr);
  max-width: 1920px;
  margin: auto;
}

.mp-sidebar, .mp-hero {
  --surface: #154236; --ink: #edf9f2; --dim: #b3d3c7; --accent: #82edb8; --line: #3a6456;
  color: var(--ink);
  color-scheme: dark;
}

.mp-sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  min-height: 100vh;
  max-height: 100vh;
  overflow: auto;
  background: #102b25;
  border-right: 1px solid var(--line);
  padding: 20px 14px;
}

.mp-brand { font-size: 20px; font-weight: 800; }
.mp-brand span, .mp-brand small { color: var(--accent); }
.mp-brand small { font-size: 10px; }
.mp-sidebar p { margin: 6px 0 16px; font-size: 12px; }
.mp-sidebar h2 {
  border-top: 1px solid var(--line);
  padding-top: 14px;
  margin: 14px 0 8px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: .1em;
  color: var(--dim);
}

.mp-sidebar nav { display: grid; gap: 5px; }
.mp-sidebar nav button { text-align: left; background: transparent; border-color: transparent; }
.mp-sidebar nav button span { display: inline-block; width: 24px; color: var(--accent); }
.mp-sidebar nav button[aria-current="page"] {
  background: var(--surface);
  border-color: var(--line);
  color: var(--accent);
}

.mp-main { display: grid; gap: 16px; min-width: 0; padding: 20px; }

.mp-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  flex-wrap: wrap;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: linear-gradient(105deg, #0d2b27ed, #0d503de0), url("${BACKGROUND_IMAGE}") center / cover;
}

.mp-hero h1 { font-size: clamp(26px, 3vw, 44px); line-height: 1.12; margin: 6px 0; }
.mp-kicker { color: var(--accent); font-size: 11px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
.mp-hero-period { display: inline-block; margin-top: 12px; font-size: 12px; color: var(--dim); }
.mp-hero-controls { display: grid; justify-items: end; gap: 10px; margin-left: auto; max-width: 100%; }
.mp-account { display: flex; align-items: center; gap: 10px; overflow-wrap: anywhere; }
.mp-account small { display: block; color: var(--dim); }
.mp-avatar { background: var(--surface); color: var(--accent); border-radius: 50%; padding: 8px; min-width: 36px; text-align: center; }
.mp-week-controls { display: flex; gap: 6px; }
.mp-week-controls button { min-width: 38px; }

.mp-heading { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.mp-heading p, .mp-card > p { margin-top: 5px; font-size: 12px; }

.mp-filters {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)) auto;
  align-items: end;
  gap: 10px;
}

.mp-filters label { display: grid; min-width: 0; gap: 4px; color: var(--dim); font-size: 12px; }
.mp-filters input, .mp-filters select { width: 100%; min-width: 0; }

.mp-stats { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.mp-stat, .mp-card {
  min-width: 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px;
}

.mp-stat { display: grid; gap: 4px; align-content: start; }
.mp-stat strong { color: var(--accent); font-size: clamp(22px, 2.2vw, 34px); line-height: 1.15; }
.mp-stat small, .mp-root td small { color: var(--dim); }
.mp-stat[data-tone="amber"] { border-top: 2px solid #d5a747; }
.mp-stat[data-tone="red"] { border-top: 2px solid #d86b76; }

.mp-panels { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; }
.mp-panels > :first-child { grid-column: 1 / -1; }
.mp-progress { height: 7px; background: var(--track); border-radius: 10px; overflow: hidden; margin-top: 4px; }
.mp-progress > span { display: block; height: 100%; background: linear-gradient(90deg, #13a97d, #6ee8a4); }

.mp-scroll { overflow: auto; }
.mp-trend {
  min-width: 960px;
  display: grid;
  grid-template-columns: repeat(25, minmax(0, 1fr));
  gap: 3px;
  margin-top: 12px;
}

.mp-root .mp-column {
  background: transparent;
  border-color: transparent;
  font-size: 10px;
  padding: 3px 2px;
  display: grid;
  grid-template-rows: 152px auto;
  gap: 4px;
  color: var(--dim);
}

.mp-root .mp-column[data-active="true"], .mp-root tr[data-active="true"] {
  background: var(--surface);
  color: var(--accent);
}

.mp-plot {
  padding: 18px 3px 0;
  border-bottom: 1px solid var(--line);
  background: repeating-linear-gradient(
    to top, transparent 0 calc(25% - 1px), var(--line) calc(25% - 1px) 25%
  );
}

.mp-stack { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
.mp-stack > * { flex-shrink: 0; }
.mp-stack small { font-size: 10px; color: var(--ink); }

.mp-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; color: var(--dim); font-size: 12px; }
.mp-legend span, .mp-category-list li > span { display: flex; align-items: center; gap: 6px; }
.mp-legend i, .mp-category-list i { width: 9px; height: 9px; border-radius: 50%; flex: none; }

.mp-distribution {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 14px;
}

.mp-donut { width: 112px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; flex: none; }
.mp-donut div {
  width: 78%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: var(--panel);
  display: grid;
  place-content: center;
  text-align: center;
}

.mp-donut strong { font-size: 22px; }
.mp-donut small { font-size: 11px; color: var(--dim); }
.mp-category-list, .mp-targets { list-style: none; margin: 0; padding: 0; }
.mp-category-list { flex: 1 1 160px; }

.mp-category-list li, .mp-targets li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 12px;
}

.mp-category-list small { min-width: 40px; text-align: right; color: var(--dim); }
.mp-targets { margin-top: 8px; }
.mp-targets li { grid-template-columns: minmax(102px, 1fr) minmax(22px, 1fr) minmax(38px, auto); }
.mp-targets small { display: block; color: var(--dim); }
.mp-targets li > strong { text-align: right; color: var(--accent); }

.mp-card > .mp-scroll { margin-top: 10px; }
.mp-week-table { max-height: 382px; }
.mp-root table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 12px; }
.mp-root th, .mp-root td { padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.mp-root th { position: sticky; top: 0; z-index: 1; color: var(--dim); background: var(--surface); }
.mp-root td small { display: block; }
.mp-root tbody tr:hover { background: var(--surface); }
.mp-progress-cell { min-width: 165px; }
.mp-root .mp-link, .mp-badge { color: var(--accent); background: var(--surface); padding: 4px 8px; min-height: 32px; }
.mp-badge { border-radius: 6px; color: var(--dim); }
.mp-badge[data-active="true"] { color: var(--accent); }

.mp-insights { padding-left: 20px; margin: 8px 0 0; color: var(--dim); }
.mp-insights li + li { margin-top: 6px; }
.mp-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--dim); font-size: 12px; }
.mp-error { padding: 10px 12px; border: 1px solid #d86b76; border-radius: 8px; }
.mp-loading { display: grid; place-items: center; padding: 16px; }
.mp-loading .mp-card > * + * { margin-top: 8px; }

@media (min-width: 1540px) {
  .mp-panels { grid-template-columns: minmax(0, 1.6fr) repeat(2, minmax(0, 1fr)); }
  .mp-panels > :first-child { grid-column: auto; }
  .mp-trend { min-width: 720px; }
}

@media (max-width: 1120px) {
  .mp-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 850px) {
  .mp-shell { grid-template-columns: minmax(0, 1fr); }
  .mp-sidebar { position: static; min-height: auto; max-height: none; border-right: 0; }
  .mp-sidebar nav { display: flex; flex-wrap: wrap; }
  .mp-main { padding: 14px; }
}

@media (max-width: 580px) {
  .mp-hero { padding: 14px; }
  .mp-hero-controls { margin-left: 0; justify-items: start; }
  .mp-filters, .mp-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mp-panels { grid-template-columns: minmax(0, 1fr); }
}
`;
