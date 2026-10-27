
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const TOTAL_WEEKS = 25;

const TARGETS = [
  { name: "Fisik", target: 25 },
  { name: "Training", target: 4 },
  { name: "Sosialisasi", target: 3 },
  { name: "Coaching", target: 1 },
  { name: "Orientasi Area", target: 2 },
  { name: "Hazard", target: 2 },
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

const C = {
  green: "#153c2e",
  green2: "#205642",
  green3: "#2f7657",
  gold: "#d8b45a",
  goldLight: "#f8f0d9",
  bg: "#f3f6f3",
  white: "#ffffff",
  text: "#20352b",
  muted: "#708078",
  border: "#e0e8e1",
  red: "#b42318",
  redBg: "#fff0ee",
  yellow: "#946200",
  yellowBg: "#fff8e6",
};

const card = {
  background: C.white,
  padding: 20,
  borderRadius: 18,
  border: `1px solid ${C.border}`,
  marginBottom: 16,
  boxShadow: "0 4px 18px rgba(21,60,46,0.045)",
  minWidth: 0,
};

const primaryButton = {
  background: C.green,
  color: C.white,
  border: "1px solid transparent",
  borderRadius: 12,
  padding: "14px 16px",
  fontWeight: 700,
  width: "100%",
  cursor: "pointer",
  fontSize: 14,
};

const secondaryButton = {
  ...primaryButton,
  background: C.white,
  color: C.green,
  border: `1px solid ${C.border}`,
};

function normalize(v) {
  return String(v || "").trim().toLowerCase();
}

function normalizeType(v) {
  return normalize(v).replace(/[^a-z0-9]/g, "");
}

function isParticipantRole(role) {
  return ["participant", "peserta"].includes(normalize(role));
}

function formatDate(value) {
  if (!value) return "-";
  const p = String(value).slice(0, 10).split("-");
  return p.length === 3
    ? `${p[2]}/${p[1]}/${p[0]}`
    : String(value);
}

function parseDate(value) {
  if (!value) return null;
  const p = String(value).slice(0, 10).split("-").map(Number);

  if (p.length !== 3 || p.some(n => !Number.isInteger(n))) {
    return null;
  }

  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));

  return d.getUTCFullYear() === p[0] &&
    d.getUTCMonth() === p[1] - 1 &&
    d.getUTCDate() === p[2]
    ? d
    : null;
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

function clamp(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}

function emptyProgress() {
  return {
    achievement: 0,
    completedCategories: 0,
    activityWeeks: 0,
    activityPercent: 0,
    simper: 0,
    simperCompleted: 0,
    simperIssued: false,
  };
}

// ====================================================
// ACHIEVEMENT
// SAMA DENGAN DASHBOARD MENTOR TAHAP 6.1
// ====================================================

function calculateAchievements(records, types, startDate) {
  const codes = new Map(
    types.map(t => [
      normalizeType(t.name),
      normalizeType(t.code),
    ])
  );

  const verified = records.filter(r =>
    normalize(r.status) === "verified" &&
    weekOf(r.activity_date, startDate) !== null
  );

  const categories = TARGETS.map(item => {
    const code = codes.get(normalizeType(item.name));

    const matching = code
      ? verified.filter(r =>
          normalizeType(r.type_code) === code
        )
      : [];

    let amount = 0;

    if (item.name === "Fisik") {
      amount = matching.reduce((sum, r) => {
        const km = Number(r.distance_km);
        return sum + (
          Number.isFinite(km) && km > 0 ? km : 0
        );
      }, 0);
    } else {
      amount = matching.length;
    }

    return {
      ...item,
      amount,
      progress: clamp((amount / item.target) * 100),
      completed: amount >= item.target,
    };
  });

  const total = categories.reduce(
    (sum, item) => sum + item.progress,
    0
  );

  return {
    progress: Math.round(total / TARGETS.length),
    completed: categories.filter(c => c.completed).length,
  };
}

// ====================================================
// SIMPER V2
// 3 PERSYARATAN, PENERBITAN TERPISAH
// ====================================================

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
    return {
      progress: 0,
      completed: 0,
      issued: false,
    };
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

// ====================================================
// RINGKASAN PER PROGRAM
// ====================================================

function buildProgress(program, data) {
  const achievement = calculateAchievements(
    data.achievements,
    data.types,
    program.start_date
  );

  const chosenSimper =
    data.simper.find(r => parseSimperMetadata(r.notes)) ||
    data.simper[0] ||
    null;

  const simper = calculateSimper(chosenSimper);

  const weeks = new Set();

  function markWeek(date) {
    const week = weekOf(date, program.start_date);
    if (week !== null) weeks.add(week);
  }

  data.achievements.forEach(r => markWeek(r.activity_date));
  data.postTests.forEach(r => markWeek(r.test_date));
  data.practices.forEach(r => markWeek(r.practice_date));
  data.samapta.forEach(r => markWeek(r.test_date));

  return {
    achievement: achievement.progress,
    completedCategories: achievement.completed,
    activityWeeks: weeks.size,
    activityPercent: Math.round(
      (weeks.size / TOTAL_WEEKS) * 100
    ),
    simper: simper.progress,
    simperCompleted: simper.completed,
    simperIssued: simper.issued,
  };
}

// ====================================================
// STATUS PENDAFTARAN
// ====================================================

function getStatusInfo(access) {
  const statuses = {
    pending: {
      label: "Menunggu Persetujuan Mentor",
      color: C.yellow,
      bg: C.yellowBg,
      icon: "◷",
    },
    rejected: {
      label: "Pengajuan Ditolak",
      color: C.red,
      bg: C.redBg,
      icon: "!",
    },
    approved: {
      label: "Program OJT Aktif",
      color: C.green3,
      bg: "#e8f5eb",
      icon: "✓",
    },
    no_program: {
      label: "Belum Ada Program",
      color: C.muted,
      bg: "#edf1ee",
      icon: "○",
    },
    error: {
      label: "Terjadi Kesalahan",
      color: C.red,
      bg: C.redBg,
      icon: "!",
    },
  };

  return statuses[access] || statuses.no_program;
}

// ====================================================
// KOMPONEN MENU ASLI
// ====================================================

function MenuCard({ icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        textAlign: "left",
        padding: 15,
        width: "100%",
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        cursor: "pointer",
        color: C.text,
      }}
    >
      <span style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.goldLight,
        color: C.green,
        borderRadius: 12,
        fontSize: 22,
        fontWeight: 800,
      }}>
        {icon}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <strong style={{
          display: "block",
          marginBottom: 5,
          fontSize: 14,
        }}>
          {title}
        </strong>

        <span style={{
          display: "block",
          color: C.muted,
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {description}
        </span>
      </span>

      <span style={{ color: C.green3, fontSize: 20 }}>
        ›
      </span>
    </button>
  );
}

// ====================================================
// KOMPONEN PROGRES BAR
// ====================================================

function ProgressItem({ title, value, description }) {
  const safe = clamp(value);

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 9,
      }}>
        <strong style={{ fontSize: 13, color: C.text }}>
          {title}
        </strong>

        <strong style={{
          fontSize: 17,
          color: C.green3,
        }}>
          {safe}%
        </strong>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
        style={{
          height: 11,
          width: "100%",
          overflow: "hidden",
          borderRadius: 20,
          background: "#e7eee8",
        }}
      >
        <div style={{
          height: "100%",
          width: `${safe}%`,
          background: `linear-gradient(90deg, ${C.green3}, #45a777)`,
          borderRadius: 20,
        }} />
      </div>

      <div style={{
        fontSize: 11,
        color: C.muted,
        lineHeight: 1.7,
        marginTop: 7,
      }}>
        {description}
      </div>
    </div>
  );
}

// ====================================================
// DASHBOARD PESERTA
// ====================================================

export default function DashboardPeserta() {
  const router = useRouter();

  const [account, setAccount] = useState(null);
  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [registration, setRegistration] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");

  const [access, setAccess] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  // BARU: ringkasan perkembangan.
  const [progress, setProgress] = useState(emptyProgress());

  const requestIdRef = useRef(0);
  const selectedIdRef = useRef("");

  const isAdmin = normalize(account?.role) === "admin";

  function clearDashboard() {
    setProfile(null);
    setProgram(null);
    setRegistration(null);
    setProgress(emptyProgress());
    setAccess("loading");
  }

  // ====================================================
  // DAFTAR PESERTA PREVIEW ADMIN
  // LOGIKA ASLI DIPERTAHANKAN
  // ====================================================

  async function fetchParticipantList() {
    const { data, error: listError } = await supabase
      .from("ojt_programs")
      .select(`
        participant_id,
        site,
        peserta:profiles!ojt_programs_participant_id_fkey(
          id,
          full_name,
          department,
          role
        )
      `)
      .eq("status", "active");

    if (listError) throw listError;

    const unique = new Map();

    (data || []).forEach(item => {
      if (!item.participant_id) return;

      const peserta = Array.isArray(item.peserta)
        ? item.peserta[0]
        : item.peserta;

      if (!peserta || !isParticipantRole(peserta.role)) {
        return;
      }

      if (!unique.has(item.participant_id)) {
        unique.set(item.participant_id, {
          id: item.participant_id,
          full_name: peserta.full_name || "Peserta OJT",
          department: peserta.department || "",
          site: item.site || "",
          role: normalize(peserta.role),
        });
      }
    });

    return [...unique.values()].sort(
      (a, b) => a.full_name.localeCompare(b.full_name)
    );
  }

  // ====================================================
  // PENGAMBILAN PROGRES SATU PROGRAM
  //
  // Data tidak diubah, hanya dibaca.
  // Sesuai target Dashboard Mentor Tahap 6.1.
  // ====================================================

  async function fetchProgramProgress(activeProgram) {
    if (!activeProgram?.id) return emptyProgress();

    const id = activeProgram.id;

    const results = await Promise.all([
      supabase
        .from("achievement_types")
        .select("code,name"),

      supabase
        .from("achievement_records")
        .select(
          "id,program_id,type_code,status,activity_date,distance_km"
        )
        .eq("program_id", id),

      supabase
        .from("post_test_scores")
        .select("id,program_id,test_date")
        .eq("program_id", id),

      supabase
        .from("weekly_practice_scores")
        .select("id,program_id,practice_date")
        .eq("program_id", id),

      supabase
        .from("samapta_records")
        .select("id,program_id,test_date")
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

    return buildProgress(activeProgram, {
      types: results[0].data || [],
      achievements: results[1].data || [],
      postTests: results[2].data || [],
      practices: results[3].data || [],
      samapta: results[4].data || [],
      simper: results[5].data || [],
    });
  }

  // ====================================================
  // PENGAMBILAN DASHBOARD PESERTA
  // ATURAN PERSETUJUAN TETAP DIPERTAHANKAN
  // ====================================================

  async function fetchParticipantDashboard(
    participantId,
    adminPreview = false,
    previewParticipants = []
  ) {
    let currentProfile = null;

    if (adminPreview) {
      const selected = previewParticipants.find(
        item =>
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
      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id,full_name,department,role")
        .eq("id", participantId)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!data) {
        throw new Error("Profil peserta tidak tersedia.");
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
      .select(`
        id,
        participant_id,
        start_date,
        end_date,
        status,
        site,
        legacy_access
      `)
      .eq("participant_id", participantId)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1);

    if (programError) throw programError;

    const activeProgram = activePrograms?.[0] || null;

    // Preview Admin tidak memerlukan
    // pemeriksaan ulang registrasi.
    if (adminPreview) {
      const nextProgress = activeProgram
        ? await fetchProgramProgress(activeProgram)
        : emptyProgress();

      return {
        profile: currentProfile,
        registration: null,
        program: activeProgram,
        access: activeProgram ? "approved" : "no_program",
        progress: nextProgress,
      };
    }

    const { data: newRequests, error: newError } = await supabase
      .from("ojt_registration_requests")
      .select(`
        id,status,rejection_reason,site,
        start_date,end_date,created_at
      `)
      .eq("participant_id", participantId)
      .order("created_at", { ascending: false });

    if (newError) throw newError;

    const { data: oldRequests, error: oldError } = await supabase
      .from("participant_registrations")
      .select(`
        id,status,rejection_reason,site,created_at
      `)
      .eq("user_id", participantId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (oldError) throw oldError;

    const newList = newRequests || [];
    const oldRegistration = oldRequests?.[0] || null;
    const latestNew = newList[0] || null;

    const latestRegistration =
      latestNew && oldRegistration
        ? new Date(latestNew.created_at || 0) >=
          new Date(oldRegistration.created_at || 0)
          ? latestNew
          : oldRegistration
        : latestNew || oldRegistration;

    const hasPendingNew = newList.some(
      item => normalize(item.status) === "pending"
    );

    const hasApprovedNew = newList.some(
      item => normalize(item.status) === "approved"
    );

    const hasApprovedOld =
      normalize(oldRegistration?.status) === "approved";

    const hasPendingOld =
      normalize(oldRegistration?.status) === "pending";

    const approvedProgram =
      !!activeProgram &&
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
      normalize(latestRegistration?.status) === "rejected"
    ) {
      nextAccess = "rejected";
    }

    // Hanya baca progres setelah akses program disetujui.
    const nextProgress = nextAccess === "approved"
      ? await fetchProgramProgress(activeProgram)
      : emptyProgress();

    return {
      profile: currentProfile,
      registration: latestRegistration || null,
      program:
        nextAccess === "approved"
          ? activeProgram
          : null,
      access: nextAccess,
      progress: nextProgress,
    };
  }

  function applyDashboard(data) {
    setProfile(data.profile);
    setRegistration(data.registration);
    setProgram(data.program);
    setProgress(data.progress || emptyProgress());
    setAccess(data.access);
  }

  // ====================================================
  // MEMUAT DASHBOARD
  // ====================================================

  async function loadDashboard(
    isRefresh = false,
    requestedParticipantId = null
  ) {
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

      if (requestId !== requestIdRef.current) return;

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
        .select("id,full_name,department,role")
        .eq("id", user.id)
        .maybeSingle();

      if (requestId !== requestIdRef.current) return;

      if (accountError) throw accountError;

      if (!currentAccount) {
        throw new Error(
          "Profil akun tidak tersedia."
        );
      }

      const role = normalize(currentAccount.role);

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

      setAccount({ ...currentAccount, role });

      if (role === "admin") {
        const list = await fetchParticipantList();

        if (requestId !== requestIdRef.current) return;

        setParticipants(list);

        if (!list.length) {
          selectedIdRef.current = "";
          setSelectedParticipantId("");
          setProfile(null);
          setRegistration(null);
          setProgram(null);
          setProgress(emptyProgress());
          setAccess("no_program");
          return;
        }

        const requestedId =
          requestedParticipantId ||
          selectedIdRef.current;

        const validSelection = list.some(
          item => item.id === requestedId
        );

        const targetId = validSelection
          ? requestedId
          : list[0].id;

        selectedIdRef.current = targetId;
        setSelectedParticipantId(targetId);

        const next = await fetchParticipantDashboard(
          targetId, true, list
        );

        if (requestId !== requestIdRef.current) return;

        applyDashboard(next);
      } else {
        setParticipants([]);
        setSelectedParticipantId("");
        selectedIdRef.current = "";

        const next = await fetchParticipantDashboard(
          user.id, false
        );

        if (requestId !== requestIdRef.current) return;

        applyDashboard(next);
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      clearDashboard();

      setError(
        err?.message || "Gagal memuat Dashboard Peserta."
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
  // PREVIEW ADMIN
  // ====================================================

  async function changePreviewParticipant(id) {
    if (!isAdmin || !id || loading || refreshing) return;

    const requestId = ++requestIdRef.current;

    selectedIdRef.current = id;
    setSelectedParticipantId(id);

    setRefreshing(true);
    setError("");
    clearDashboard();

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (requestId !== requestIdRef.current) return;

      if (authError || !user) {
        clearDashboard();
        router.replace("/login");
        return;
      }

      const {
        data: verifiedAccount,
        error: accountError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (requestId !== requestIdRef.current) return;

      if (accountError) throw accountError;

      if (normalize(verifiedAccount?.role) !== "admin") {
        throw new Error(
          "Hanya Admin yang dapat menggunakan preview peserta."
        );
      }

      const selected = participants.find(
        item =>
          item.id === id &&
          isParticipantRole(item.role)
      );

      if (!selected) {
        throw new Error("Peserta tidak ditemukan.");
      }

      const next = await fetchParticipantDashboard(
        id, true, participants
      );

      if (requestId !== requestIdRef.current) return;

      applyDashboard(next);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;

      setProfile(null);
      setRegistration(null);
      setProgram(null);
      setProgress(emptyProgress());

      setError(
        err?.message || "Gagal mengganti peserta preview."
      );

      setAccess("error");
    } finally {
      if (requestId === requestIdRef.current) {
        setRefreshing(false);
      }
    }
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    requestIdRef.current += 1;

    try {
      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) throw logoutError;

      setAccount(null);
      setParticipants([]);
      setSelectedParticipantId("");
      selectedIdRef.current = "";
      clearDashboard();

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Gagal keluar. Silakan coba kembali.");
      setLoggingOut(false);
    }
  }

  function openParticipantFeature(path) {
    router.push(path);
  }

  const status = getStatusInfo(access);

  // ====================================================
  // TAMPILAN DASHBOARD PESERTA
  // ====================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        paddingBottom: 30,
      }}
    >
      <div
        style={{
          height: 5,
          background:
            `linear-gradient(90deg, ${C.gold}, #f3df9d, ${C.gold})`,
        }}
      />

      <header
        style={{
          background: C.green,
          color: C.white,
          padding: "24px 18px 30px",
          borderRadius: "0 0 26px 26px",
        }}
      >
        <div
          style={{
            maxWidth: 850,
            margin: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: 14,
                background: C.gold,
                color: C.green,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 25,
                fontWeight: 900,
              }}
            >
              M
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 19,
                  fontWeight: 900,
                }}
              >
                OJT MineTrack
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "#d9e6dd",
                  letterSpacing: 1.4,
                  marginTop: 4,
                }}
              >
                MONITORING & EVALUATION SYSTEM
              </div>
            </div>

            <div
              style={{
                border: "1px solid #597769",
                borderRadius: 20,
                padding: "7px 10px",
                color: "#f3df9d",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {isAdmin ? "ADMIN" : "PESERTA"}
            </div>
          </div>

          <div
            style={{
              color: C.gold,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.5,
              marginBottom: 9,
            }}
          >
            DASHBOARD PESERTA
          </div>

          <h1
            style={{
              fontSize: 27,
              lineHeight: 1.25,
              margin: "0 0 9px",
              fontWeight: 850,
            }}
          >
            {isAdmin
              ? "Preview Dashboard Peserta"
              : "Pantau Perjalanan OJT Anda"}
          </h1>

          <p
            style={{
              color: "#d7e4dc",
              fontSize: 13,
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Informasi pendaftaran, perkembangan,
            dan evaluasi OJT dalam satu tempat.
          </p>
        </div>
      </header>

      <div
        style={{
          maxWidth: 850,
          padding: "0 16px",
          margin: "-14px auto 0",
          position: "relative",
        }}
      >
        {isAdmin && (
          <section
            style={{
              ...card,
              background: "#e8f5eb",
              border: "1px solid #b8dfc4",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 23 }}>🛡</span>

              <div>
                <strong
                  style={{
                    color: C.green,
                    fontSize: 15,
                  }}
                >
                  Mode Administrator
                </strong>

                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 4,
                  }}
                >
                  Preview Dashboard Peserta
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: 12,
                lineHeight: 1.7,
                color: C.green2,
              }}
            >
              Kamu sedang masuk sebagai Admin.
              Pilih peserta untuk memeriksa tampilan
              dashboard tanpa mengganti akun.
            </p>

            <label
              htmlFor="admin-participant"
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 800,
                marginBottom: 8,
              }}
            >
              Pilih Peserta OJT
            </label>

            <select
              id="admin-participant"
              value={selectedParticipantId}
              onChange={event =>
                changePreviewParticipant(event.target.value)
              }
              disabled={
                loading ||
                refreshing ||
                !participants.length
              }
              style={{
                width: "100%",
                padding: "13px 12px",
                borderRadius: 11,
                border: `1px solid ${C.border}`,
                background: C.white,
                color: C.text,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              {!participants.length && (
                <option value="">
                  Belum ada peserta aktif
                </option>
              )}

              {participants.map(item => (
                <option key={item.id} value={item.id}>
                  {item.full_name}
                  {item.site ? ` — ${item.site}` : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              style={secondaryButton}
              onClick={() => router.push("/")}
            >
              ← Kembali ke Dashboard Mentor
            </button>

            <p
              style={{
                fontSize: 11,
                color: C.muted,
                lineHeight: 1.7,
                marginBottom: 0,
              }}
            >
              Preview menggunakan data asli.
              Hindari mengubah data produksi
              ketika melakukan pengujian.
            </p>
          </section>
        )}

        {loading && (
          <section style={card}>
            <strong>
              Memeriksa akun dan status OJT...
            </strong>
          </section>
        )}

        {refreshing && (
          <section
            style={{
              ...card,
              padding: 12,
              color: C.green3,
              fontSize: 12,
            }}
          >
            Memperbarui data peserta...
          </section>
        )}

        {error && (
          <section
            role="alert"
            style={{
              ...card,
              background: C.redBg,
              color: C.red,
            }}
          >
            {error}
          </section>
        )}

        {!loading &&
          isAdmin &&
          !participants.length &&
          !error && (
            <section style={card}>
              <h2
                style={{
                  fontSize: 18,
                  color: C.green,
                }}
              >
                Belum Ada Peserta untuk Preview
              </h2>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                Daftar preview diambil dari program
                OJT aktif milik akun peserta.
                Periksa data program dan
                kebijakan RLS jika daftar kosong.
              </p>
            </section>
          )}

        {!loading && profile && (
          <>
            <section style={card}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    flexShrink: 0,
                    borderRadius: 17,
                    background: C.green,
                    color: C.gold,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {(profile.full_name || "P")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div>
                  <div
                    style={{
                      color: C.muted,
                      fontSize: 12,
                    }}
                  >
                    {isAdmin
                      ? "PREVIEW DATA PESERTA"
                      : "SELAMAT DATANG"}
                  </div>

                  <h2
                    style={{
                      color: C.green,
                      fontSize: 19,
                      margin: "5px 0",
                    }}
                  >
                    {profile.full_name ||
                      "Peserta OJT"}
                  </h2>

                  <div
                    style={{
                      color: C.muted,
                      fontSize: 13,
                    }}
                  >
                    {profile.department || "ER & SS"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: 13,
                  borderRadius: 12,
                  background: status.bg,
                  color: status.color,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                <span style={{ fontSize: 20 }}>
                  {status.icon}
                </span>

                {status.label}
              </div>
            </section>

            {access === "pending" && (
              <section
                style={{
                  ...card,
                  background: C.yellowBg,
                }}
              >
                <h2
                  style={{
                    color: C.yellow,
                    fontSize: 18,
                  }}
                >
                  Menunggu Persetujuan Mentor
                </h2>

                <p style={{ lineHeight: 1.8 }}>
                  Pendaftaran OJT sudah tercatat
                  di sistem dan sedang menunggu
                  keputusan mentor.
                </p>

                <p>
                  <strong>Site:</strong>{" "}
                  {registration?.site || "-"}
                </p>

                <p>
                  <strong>Periode:</strong>{" "}
                  {formatDate(registration?.start_date)}
                  {" s.d. "}
                  {formatDate(registration?.end_date)}
                </p>

                <p style={{ lineHeight: 1.7 }}>
                  Kamu dapat login untuk melihat
                  status pendaftaran. Menu monitoring
                  tersedia setelah disetujui mentor.
                </p>
              </section>
            )}

            {access === "rejected" && (
              <section
                style={{
                  ...card,
                  background: C.redBg,
                }}
              >
                <h2
                  style={{
                    color: C.red,
                    fontSize: 18,
                  }}
                >
                  Pengajuan Belum Disetujui
                </h2>

                <p>
                  Mentor telah menolak pengajuan OJT.
                </p>

                <div
                  style={{
                    background: C.white,
                    padding: 14,
                    borderRadius: 12,
                    marginBottom: 16,
                  }}
                >
                  <strong>
                    Alasan Penolakan:
                  </strong>

                  <p style={{ lineHeight: 1.7 }}>
                    {registration?.rejection_reason ||
                      "Alasan belum tersedia."}
                  </p>
                </div>

                {!isAdmin && (
                  <button
                    type="button"
                    style={primaryButton}
                    onClick={() =>
                      router.push("/pengajuan-peserta")
                    }
                  >
                    Lihat dan Perbaiki Pengajuan
                  </button>
                )}
              </section>
            )}

            {access === "no_program" && (
              <section style={card}>
                <h2
                  style={{
                    color: C.green,
                    fontSize: 18,
                  }}
                >
                  Program OJT Belum Aktif
                </h2>

                <p style={{ lineHeight: 1.8 }}>
                  Belum ada program OJT aktif
                  yang dapat diakses.
                </p>

                <p>
                  Jika kamu baru mendaftar,
                  gunakan tombol Perbarui Status
                  untuk melihat keputusan mentor.
                </p>
              </section>
            )}

            {access === "approved" && program && (
              <>
                <section style={card}>
                  <h2
                    style={{
                      color: C.green,
                      fontSize: 18,
                    }}
                  >
                    Informasi Program OJT
                  </h2>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        background: C.bg,
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          color: C.muted,
                          fontSize: 12,
                        }}
                      >
                        SITE
                      </div>

                      <strong
                        style={{
                          color: C.green,
                          fontSize: 17,
                        }}
                      >
                        {program.site || "-"}
                      </strong>
                    </div>

                    <div
                      style={{
                        padding: 14,
                        background: C.bg,
                        borderRadius: 12,
                      }}
                    >
                      <div
                        style={{
                          color: C.muted,
                          fontSize: 12,
                        }}
                      >
                        STATUS
                      </div>

                      <strong
                        style={{ color: C.green3 }}
                      >
                        Aktif
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      border: `1px solid ${C.border}`,
                      borderRadius: 12,
                    }}
                  >
                    <div
                      style={{
                        color: C.muted,
                        fontSize: 12,
                        marginBottom: 8,
                      }}
                    >
                      PERIODE OJT
                    </div>

                    <strong>
                      {formatDate(program.start_date)}
                      {" → "}
                      {formatDate(program.end_date)}
                    </strong>
                  </div>
                </section>

                {/* =====================================
                    BARU: RINGKASAN PERKEMBANGAN OJT
                    ===================================== */}

                <section style={card}>
                  <h2
                    style={{
                      color: C.green,
                      fontSize: 18,
                      margin: "0 0 8px",
                    }}
                  >
                    Ringkasan Perkembangan OJT
                  </h2>

                  <p
                    style={{
                      color: C.muted,
                      fontSize: 12,
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    Progres berdasarkan pencapaian
                    target dan aktivitas program
                    selama 25 minggu.
                  </p>

                  <ProgressItem
                    title="Progres Achievement"
                    value={progress.achievement}
                    description={
                      `${progress.completedCategories} dari 6 kategori mencapai target. ` +
                      "Hanya aktivitas terverifikasi yang dihitung."
                    }
                  />

                  <ProgressItem
                    title="Aktivitas Mingguan"
                    value={progress.activityPercent}
                    description={
                      `${progress.activityWeeks} dari 25 minggu ` +
                      "memiliki catatan aktivitas."
                    }
                  />

                  <ProgressItem
                    title="Progres SIMPER"
                    value={progress.simper}
                    description={
                      `${progress.simperCompleted} dari 3 persyaratan ` +
                      "SIMPER terpenuhi."
                    }
                  />

                  <div
                    style={{
                      marginTop: 17,
                      padding: 12,
                      background: C.bg,
                      borderRadius: 11,
                      fontSize: 12,
                      lineHeight: 1.7,
                      color: C.green2,
                    }}
                  >
                    <strong>Status Penerbitan SIMPER: </strong>
                    {progress.simperIssued
                      ? "Sudah Terbit"
                      : "Belum Terbit"}
                  </div>
                </section>

                {/* =====================================
                    MENU PESERTA ASLI
                    ===================================== */}

                <section style={card}>
                  <h2
                    style={{
                      color: C.green,
                      fontSize: 18,
                    }}
                  >
                    Perkembangan OJT Saya
                  </h2>

                  <p
                    style={{
                      color: C.muted,
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Pilih menu untuk melihat
                    perkembangan dan evaluasi OJT.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <MenuCard
                      icon="↗"
                      title="Grafik Perkembangan"
                      description="Lihat grafik perkembangan OJT."
                      onClick={() =>
                        openParticipantFeature(
                          `/analisis/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="✓"
                      title="Evaluasi Kesiapan"
                      description="Buka evaluasi kesiapan OJT."
                      onClick={() =>
                        openParticipantFeature(
                          `/evaluasi/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="▤"
                      title="Laporan OJT"
                      description="Lihat laporan OJT Anda."
                      onClick={() =>
                        openParticipantFeature(
                          `/laporan/${program.id}`
                        )
                      }
                    />

                    {isAdmin && (
                      <MenuCard
                        icon="▦"
                        title="Evaluasi Mingguan"
                        description="Lihat evaluasi mingguan dan unduh/cetak PDF peserta."
                        onClick={() =>
                          openParticipantFeature(
                            `/mingguan/${program.id}`
                          )
                        }
                      />
                    )}
                  </div>

                  {isAdmin && (
                    <p
                      style={{
                        marginTop: 15,
                        color: C.muted,
                        fontSize: 11,
                        lineHeight: 1.7,
                      }}
                    >
                      Catatan Admin: akses ke menu
                      lanjutan tetap bergantung pada
                      validasi role dan kebijakan RLS
                      masing-masing halaman.
                    </p>
                  )}
                </section>
              </>
            )}

            <button
              type="button"
              style={{
                ...primaryButton,
                background: C.green2,
                marginBottom: 12,
              }}
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
            >
              {refreshing
                ? "Memperbarui..."
                : "Perbarui Status"}
            </button>

            <button
              type="button"
              style={{
                ...secondaryButton,
                marginBottom: 18,
              }}
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut
                ? "Sedang keluar..."
                : "Keluar dari Akun"}
            </button>

            <footer
              style={{
                textAlign: "center",
                padding: "8px 10px 22px",
                color: C.muted,
                fontSize: 11,
                lineHeight: 1.8,
              }}
            >
              <strong
                style={{
                  color: C.green,
                  letterSpacing: 1,
                }}
              >
                OJT MINETRACK v2.0
              </strong>

              <div>
                Emergency Response Group ·
                PT Berau Coal 2026
              </div>

              <div>
                Monitoring dan Evaluasi OJT
              </div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
