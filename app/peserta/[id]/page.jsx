
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

// ===============================================
// OJT MINETRACK V2.0 — DETAIL PESERTA
// CLEAN ENTERPRISE DESIGN
// GLOBAL CALENDAR WEEK 01–25
// ===============================================

const TARGETS = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "🎓" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "📍" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

function normalize(v) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function roleOf(v) {
  return String(v ?? "").trim().toLowerCase();
}

function parseDate(v) {
  const m = String(v ?? "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m) return null;

  const d = new Date(
    Date.UTC(+m[1], +m[2] - 1, +m[3])
  );

  return (
    d.getUTCFullYear() === +m[1] &&
    d.getUTCMonth() === +m[2] - 1 &&
    d.getUTCDate() === +m[3]
  ) ? d : null;
}

function addDays(v, days) {
  const d = parseDate(v);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const GLOBAL_WEEKS = Array.from(
  { length: 25 },
  (_, i) => {
    const start = i === 0
      ? "2026-09-12"
      : addDays("2026-09-20", (i - 1) * 7);

    return {
      week: i + 1,
      start,
      end: addDays(start, 6),
    };
  }
);

function globalWeekOf(v) {
  const date = String(v ?? "").slice(0, 10);
  if (!parseDate(date)) return null;

  return GLOBAL_WEEKS.find(
    w => date >= w.start && date <= w.end
  )?.week ?? null;
}

function programWeekRange(program, week) {
  const global = GLOBAL_WEEKS[week - 1];

  if (!global || !parseDate(program?.start_date)) {
    return null;
  }

  const begin = String(program.start_date).slice(0, 10);
  const finish = parseDate(program.end_date)
    ? String(program.end_date).slice(0, 10)
    : null;

  const start = global.start > begin
    ? global.start
    : begin;

  const end = finish && finish < global.end
    ? finish
    : global.end;

  return start <= end ? { start, end } : null;
}

function insideProgram(v, program) {
  const date = String(v ?? "").slice(0, 10);

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

  const get = t =>
    parts.find(p => p.type === t)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatDate(v) {
  const d = parseDate(v);
  if (!d) return "—";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function num(v, digits = 2) {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString("id-ID", {
        maximumFractionDigits: digits,
      })
    : "—";
}

function scoreText(v) {
  return v === null || v === undefined || v === ""
    ? "—"
    : num(v, 2);
}

function initials(v) {
  return String(v || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0] || "")
    .join("")
    .toUpperCase();
}

function categoryOf(v) {
  const key = normalize(v);

  if (["fisik", "physical"].includes(key)) return "Fisik";
  if (["training", "internaltraining", "pelatihan"].includes(key)) return "Training";
  if (["sosialisasi", "socialization"].includes(key)) return "Sosialisasi";
  if (["coaching", "pembinaan"].includes(key)) return "Coaching";
  if (["orientasi", "orientasiarea", "areaorientation"].includes(key)) return "Orientasi Area";
  if (["hazard", "hazardidentification", "identifikasibahaya"].includes(key)) return "Hazard";

  return null;
}

function initialWeek(program, records) {
  const available = GLOBAL_WEEKS.filter(
    w => programWeekRange(program, w.week)
  );

  if (!available.length) return 1;

  const today = todayWITA();

  const current = available.find(w => {
    const range = programWeekRange(program, w.week);
    return (
      range &&
      today >= range.start &&
      today <= range.end
    );
  });

  if (current) return current.week;

  const recorded = records
    .filter(r => insideProgram(r.activity_date, program))
    .map(r => globalWeekOf(r.activity_date))
    .filter(w => available.some(a => a.week === w));

  if (recorded.length) return Math.max(...recorded);

  return available.find(w => w.start > today)?.week ||
    available[available.length - 1].week;
}

function averageScore(rows) {
  const numbers = rows
    .map(r => r.score)
    .filter(v => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter(Number.isFinite);

  return numbers.length
    ? numbers.reduce((a, b) => a + b, 0) / numbers.length
    : null;
}

function ProgressBar({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));

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

// ===============================================
// HALAMAN UTAMA
// ===============================================

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const [testDate, setTestDate] = useState(todayWITA());
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

  // =============================================
  // SUPABASE
  // =============================================

  async function fetchRecords(id) {
    const results = await Promise.all([
      supabase
        .from("achievement_records")
        .select("id,type_code,activity_date,distance_km,status")
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
        .select("id,test_date,test_type,score,outcome,result_value")
        .eq("program_id", id),

      supabase
        .from("simper_records")
        .select("id,administration_status,theory_status,practice_status,status,graduation_date,notes")
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

        if (!programData || !parseDate(programData.start_date)) {
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
        setWeek(initialWeek(programData, records.achievements));

      } catch (err) {
        if (active) {
          setError(err?.message || "Gagal memuat data peserta.");
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

  async function refresh() {
    if (refreshing || loading || !manager || !program) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      applyRecords(await fetchRecords(programId));
    } catch (err) {
      setError(err?.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  function openPanel(name) {
    setPanel(name);
    setError("");
    setMessage("");
    setMobileOpen(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // =============================================
  // POST TEST CRUD
  // =============================================

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
    setTestScore("");
    setTestNotes("");
  }

  async function saveTest(event) {
    event.preventDefault();

    if (!manager || !program || savingTest || testActionId) {
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

    setSavingTest(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        test_date: testDate,
        score,
        notes: testNotes.trim() || null,
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

      await reloadTests();
      resetTest();
      setMessage("Post-Test berhasil disimpan.");

    } catch (err) {
      setError(err?.message || "Gagal menyimpan Post-Test.");
    } finally {
      setSavingTest(false);
    }
  }

  function editTest(item) {
    setEditTestId(item.id);
    setTestDate(item.test_date);
    setTestScore(String(item.score));
    setTestNotes(item.notes || "");
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

      if (editTestId === item.id) resetTest();

      await reloadTests();
      setMessage("Post-Test berhasil dihapus.");

    } catch (err) {
      setError(err?.message || "Gagal menghapus Post-Test.");
    } finally {
      setTestActionId(null);
    }
  }

  // =============================================
  // WEEKLY ACHIEVEMENT
  // =============================================

  const availableWeeks = useMemo(
    () => GLOBAL_WEEKS.filter(
      w => programWeekRange(program, w.week)
    ),
    [program]
  );

  const selectedGlobalWeek = GLOBAL_WEEKS[week - 1];
  const selectedProgramRange = programWeekRange(program, week);

  const weekly = useMemo(() => {
    const rows = achievements.filter(item =>
      insideProgram(item.activity_date, program) &&
      globalWeekOf(item.activity_date) === week
    );

    const verified = rows.filter(
      item => roleOf(item.status) === "verified"
    );

    const pending = rows.filter(
      item => roleOf(item.status) === "pending"
    );

    const typeMap = new Map(
      types.map(item => [
        normalize(item.code),
        categoryOf(item.code) || categoryOf(item.name),
      ])
    );

    const categories = TARGETS.map(target => {
      const matched = verified.filter(item => {
        const name =
          typeMap.get(normalize(item.type_code)) ||
          categoryOf(item.type_code);

        return name === target.name;
      });

      const actual = target.name === "Fisik"
        ? matched.reduce((sum, item) => {
            const distance = Number(item.distance_km);

            return sum + (
              Number.isFinite(distance) && distance > 0
                ? Math.round(distance * 1000)
                : 0
            );
          }, 0) / 1000
        : matched.length;

      const percent = Math.min(
        100,
        Math.max(0, (actual / target.target) * 100)
      );

      return {
        ...target,
        actual,
        count: matched.length,
        percent,
        achieved: actual >= target.target,
      };
    });

    return {
      categories,
      overall: categories.reduce(
        (sum, item) => sum + item.percent,
        0
      ) / categories.length,
      achieved: categories.filter(item => item.achieved).length,
      verified: verified.length,
      pending: pending.length,
      total: rows.length,
    };
  }, [achievements, types, program, week]);

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

  // =============================================
  // QUICK ACCESS MENUS
  // SESUAI GAMBAR KEDUA
  // =============================================

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
      subtitle: `${samapta.length} data tes`,
      icon: "🏃",
      tone: "amber",
      route: `/samapta/${programId}`,
    },
    {
      title: "Post-Test",
      subtitle: `${postTests.length} nilai tercatat`,
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
      subtitle: `Week ${String(week).padStart(2, "0")} · ${num(weekly.overall)}%`,
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

  const sidebar = [
    {
      title: "Dashboard",
      icon: "⌂",
      route: "/",
    },
    {
      title: "Peserta OJT",
      icon: "♙",
      route: "/mentor/monitoring-peserta",
    },
    {
      title: "Input Achievement",
      icon: "▤",
      route: `/achievement/${programId}`,
    },
    {
      title: "Monitoring & Penilaian",
      icon: "▥",
      anchor: "dp-modules",
    },
    {
      title: "Evaluasi Kesiapan",
      icon: "✓",
      route: `/evaluasi/${programId}`,
    },
    {
      title: "Rapor OJT",
      icon: "▤",
      route: `/laporan/${programId}`,
    },
    {
      title: "Grafik Perkembangan",
      icon: "▥",
      route: `/analisis/${programId}`,
    },
  ];

  function navigate(item) {
    setMobileOpen(false);

    if (item.route) {
      router.push(item.route);
    } else if (item.anchor) {
      openPanel("dashboard");

      requestAnimationFrame(() => {
        document.getElementById(item.anchor)?.scrollIntoView({
          behavior: "smooth",
        });
      });
    }
  }

  // =============================================
  // LOADING / ERROR
  // =============================================

  if (loading) {
    return (
      <main className="dp-loading">
        <h2>OJT MineTrack</h2>
        <p>Memuat data Detail Peserta...</p>
      </main>
    );
  }

  if (!manager || !program) {
    return (
      <main className="dp-loading">
        <h2>Detail Peserta Tidak Dapat Ditampilkan</h2>
        <p>{error || "Akses tidak tersedia."}</p>

        <button onClick={() => router.push("/")}>
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  // =============================================
  // MAIN UI
  // =============================================

  return (
    <div className="dp-app">
      <style>{css}</style>

      {/* MOBILE OVERLAY */}

      {mobileOpen && (
        <button
          className="dp-overlay"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside className={`dp-sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="dp-brand">
          <strong>
            OJT <span>MineTrack</span>
          </strong>
          <small>v2.0</small>
        </div>

        <nav>
          {sidebar.map((item, index) => (
            <button
              type="button"
              key={item.title}
              className={`dp-nav ${index === 0 ? "active" : ""}`}
              onClick={() => navigate(item)}
            >
              <span className="dp-nav-icon">
                {item.icon}
              </span>
              {item.title}
            </button>
          ))}
        </nav>

        <div className="dp-side-bottom">
          <div className="dp-side-company">
            <strong>Emergency Response Group</strong>
            <span>PT Berau Coal</span>
          </div>

          <small>
            OJT MineTrack v2.0
            {" · "}
            © 2026
          </small>
        </div>
      </aside>

      {/* RIGHT AREA */}

      <div className="dp-right">

        {/* HEADER */}

        <header className="dp-topbar">
          <button
            className="dp-mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            ☰
          </button>

          <div className="dp-top-spacer" />

          <div className="dp-top-account">
            <span className="dp-top-avatar">
              {initials(accountName)}
            </span>

            <div>
              <strong>{accountName}</strong>
              <small>{roleName}</small>
            </div>

            <span className="dp-top-arrow">⌄</span>
          </div>
        </header>

        <main className="dp-content">

          {/* PAGE TITLE */}

          <div className="dp-title-row">
            <div>
              <small>Selamat datang di</small>
              <h1>
                OJT <span>MineTrack</span>
              </h1>
              <p>
                Pantau, catat, dan evaluasi perkembangan
                peserta OJT dengan lebih mudah dan terstruktur.
              </p>
            </div>

            <div className="dp-week-select">
              <span>📅</span>

              <select
                aria-label="Pilih Week Global"
                value={
                  availableWeeks.some(w => w.week === week)
                    ? week
                    : ""
                }
                onChange={event =>
                  setWeek(Number(event.target.value))
                }
              >
                {!availableWeeks.length && (
                  <option value="">
                    Tidak ada Week Global
                  </option>
                )}

                {availableWeeks.map(item => (
                  <option
                    key={item.week}
                    value={item.week}
                  >
                    Week {String(item.week).padStart(2, "0")}
                    {" · "}
                    {formatDate(item.start)}
                    {" – "}
                    {formatDate(item.end)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NOTIFICATION */}

          {error && (
            <div className="dp-alert error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="dp-alert success">
              ✓ {message}
            </div>
          )}

          {/* PROFILE BANNER */}

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
                    <span className="dp-fact-icon">📅</span>

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
                    <span className="dp-fact-icon">♙</span>

                    <div>
                      <small>Mentor</small>
                      <strong>
                        {isAdmin
                          ? "Mentor OJT"
                          : accountName}
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
              {/* ACHIEVEMENT SUMMARY */}

              <section className="dp-achievement">
                <div className="dp-achievement-overview">
                  <div className="dp-week-heading">
                    <span className="dp-big-icon">
                      📊
                    </span>

                    <div>
                      <small>Capaian Achievement</small>
                      <h2>
                        Week {String(week).padStart(2, "0")}
                      </h2>

                      <p>
                        {formatDate(selectedGlobalWeek?.start)}
                        {" – "}
                        {formatDate(selectedGlobalWeek?.end)}
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
                    <strong>{weekly.verified}</strong>
                    <small>Terverifikasi</small>
                  </div>

                  <div className="dp-summary amber">
                    <span>◷</span>
                    <strong>{weekly.pending}</strong>
                    <small>Menunggu</small>
                  </div>

                  <div className="dp-summary blue">
                    <span>▦</span>
                    <strong>{weekly.achieved}/6</strong>
                    <small>Kategori</small>
                  </div>
                </div>

                {selectedProgramRange && (
                  <div className="dp-participant-range">
                    Periode peserta pada Week ini:
                    {" "}
                    {formatDate(selectedProgramRange.start)}
                    {" – "}
                    {formatDate(selectedProgramRange.end)}
                  </div>
                )}

                <div className="dp-category-grid">
                  {weekly.categories.map(item => (
                    <div
                      key={item.name}
                      className="dp-category"
                    >
                      <div className="dp-category-title">
                        <span className="dp-category-icon">
                          {item.icon}
                        </span>
                        <strong>{item.name}</strong>
                      </div>

                      <div className="dp-category-value">
                        {num(item.percent)}%
                      </div>

                      <ProgressBar value={item.percent} />

                      <div className="dp-category-footer">
                        <span>
                          Realisasi:
                          <strong>
                            {num(
                              item.actual,
                              item.name === "Fisik" ? 3 : 0
                            )}
                            {" "}
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
                  Realisasi asli tidak dibatasi,
                  tetapi persentase maksimal 100%.
                  Week mengikuti Kalender Global 01–25.
                </p>
              </section>

              {/* QUICK ACCESS */}

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
                  {menus.map(item => (
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

              {/* ACHIEVEMENT INPUT */}

              <section className="dp-card">
                <div className="dp-section-heading">
                  <div>
                    <h2>Achievement OJT</h2>
                    <p>
                      Input kegiatan dan monitoring
                      Achievement secara terpisah.
                    </p>
                  </div>
                </div>

                <div className="dp-ach-actions">
                  <button
                    onClick={() =>
                      router.push(`/achievement/${programId}`)
                    }
                  >
                    📝 Input Achievement
                    <span>›</span>
                  </button>

                  <button
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

              <button
                className="dp-bottom-back"
                onClick={() => router.push("/")}
              >
                ← Kembali ke Dashboard
              </button>
            </>
          ) : (
            <>
              {/* POST-TEST */}

              <section className="dp-card">
                <div className="dp-section-heading">
                  <div>
                    <h2>Monitoring Post-Test</h2>
                    <p>
                      Input, edit, dan hapus nilai Post-Test.
                    </p>
                  </div>

                  <button
                    className="dp-refresh"
                    onClick={() => openPanel("dashboard")}
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
                  </div>

                  <div>
                    Rata-rata Nilai
                    <strong>
                      {scoreText(averageScore(postTests))}
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
                      onChange={event =>
                        setTestDate(event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Nilai Post-Test (0–100)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={testScore}
                      onChange={event =>
                        setTestScore(event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Catatan Evaluasi
                    <textarea
                      rows={4}
                      value={testNotes}
                      onChange={event =>
                        setTestNotes(event.target.value)
                      }
                      placeholder="Catatan evaluasi..."
                    />
                  </label>

                  <div className="dp-form-actions">
                    <button
                      className="dp-primary"
                      type="submit"
                      disabled={savingTest || Boolean(testActionId)}
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
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="dp-card">
                <h2>Riwayat Post-Test</h2>

                {!postTests.length && (
                  <p className="dp-note">
                    Belum ada Post-Test.
                  </p>
                )}

                {postTests.map(item => (
                  <div
                    className="dp-history"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        Nilai: {scoreText(item.score)}
                      </strong>

                      <small>
                        {formatDate(item.test_date)}
                        {" · "}
                        {globalWeekOf(item.test_date)
                          ? `Week ${String(
                              globalWeekOf(item.test_date)
                            ).padStart(2, "0")}`
                          : "Di luar Kalender Global"}
                      </small>

                      <p>
                        {item.notes || "Tidak ada catatan."}
                      </p>
                    </div>

                    <div className="dp-history-actions">
                      <button
                        className="dp-edit"
                        onClick={() => editTest(item)}
                        disabled={savingTest || Boolean(testActionId)}
                      >
                        Edit
                      </button>

                      <button
                        className="dp-delete"
                        onClick={() => deleteTest(item)}
                        disabled={savingTest || Boolean(testActionId)}
                      >
                        {testActionId === item.id
                          ? "Menghapus..."
                          : "Hapus"}
                      </button>
                    </div>
                  </div>
                ))}
              </section>
            </>
          )}

          <footer className="dp-footer">
            OJT MineTrack v2.0 · Emergency Response Group
            {" · "}
            PT Berau Coal
          </footer>
        </main>
      </div>
    </div>
  );
}

// ===============================================
// STYLE — CLEAN ENTERPRISE
// ===============================================

const css = `
.dp-app,
.dp-app * {
  box-sizing: border-box;
}

.dp-app {
  --green: #07875e;
  --dark: #10243b;
  --muted: #74849a;
  min-height: 100vh;
  background: #f5f8fa;
  color: var(--dark);
  font-family: Arial, Helvetica, sans-serif;
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

/* SIDEBAR */

.dp-sidebar {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  width: 250px;
  background: #fff;
  border-right: 1px solid #e2e9ee;
  display: flex;
  flex-direction: column;
  padding: 22px 15px;
}

.dp-brand {
  padding: 0 8px 28px;
  white-space: nowrap;
}

.dp-brand strong {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -.7px;
}

.dp-brand strong span {
  color: var(--green);
}

.dp-brand small {
  margin-left: 6px;
  color: #81909c;
  font-size: 11px;
}

.dp-sidebar nav {
  display: grid;
  gap: 6px;
}

.dp-nav {
  width: 100%;
  display: flex;
  gap: 14px;
  align-items: center;
  border: 0;
  background: transparent;
  color: #495a6e;
  border-radius: 10px;
  padding: 14px;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}

.dp-nav:hover,
.dp-nav.active {
  background: linear-gradient(90deg,#067f59,#049465);
  color: #fff;
}

.dp-nav-icon {
  width: 21px;
  text-align: center;
  font-size: 19px;
}

.dp-side-bottom {
  margin-top: auto;
  padding: 20px 9px 0;
  border-top: 1px solid #e8edf2;
}

.dp-side-company strong,
.dp-side-company span {
  display: block;
  font-size: 11px;
  line-height: 1.6;
}

.dp-side-company span {
  color: #718198;
}

.dp-side-bottom > small {
  display: block;
  margin-top: 19px;
  color: #8492a2;
  font-size: 10px;
}

/* HEADER */

.dp-right {
  margin-left: 250px;
  min-width: 0;
}

.dp-topbar {
  height: 66px;
  display: flex;
  align-items: center;
  padding: 0 26px;
  background: #fff;
  border-bottom: 1px solid #e2e9ef;
}

.dp-top-spacer {
  flex: 1;
}

.dp-top-account {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dp-top-avatar {
  width: 37px;
  height: 37px;
  border-radius: 50%;
  background: #e0f4e9;
  color: #067d59;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 900;
}

.dp-top-account strong {
  display: block;
  font-size: 12px;
}

.dp-top-account small {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--muted);
}

.dp-top-arrow {
  font-size: 17px;
  color: #8393a3;
}

.dp-mobile-menu {
  display: none;
  border: 0;
  background: transparent;
  font-size: 24px;
}

.dp-content {
  max-width: 1600px;
  margin: auto;
  padding: 25px;
}

/* TITLE */

.dp-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 18px;
  margin-bottom: 19px;
}

.dp-title-row small {
  color: #6f8094;
  font-size: 13px;
}

.dp-title-row h1 {
  margin: 5px 0;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -.8px;
}

.dp-title-row h1 span {
  color: var(--green);
}

.dp-title-row p {
  margin: 0;
  color: #7a899a;
  font-size: 12px;
  line-height: 1.5;
}

.dp-week-select {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 13px;
  background: #fff;
  border: 1px solid #e0e8ee;
  border-radius: 12px;
  max-width: 365px;
}

.dp-week-select select {
  border: 0;
  background: transparent;
  color: #1a3145;
  font-size: 12px;
  font-weight: 800;
  min-width: 0;
  max-width: 315px;
}

/* PROFILE */

.dp-profile {
  display: grid;
  grid-template-columns: minmax(0,1.55fr) minmax(250px,1fr);
  background: #fff;
  border: 1px solid #e4ebf1;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 15px;
  box-shadow: 0 4px 17px #142d4308;
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

.dp-profile-copy {
  min-width: 0;
}

.dp-profile-copy h2 {
  font-size: 25px;
  margin: 0 0 8px;
  overflow-wrap: anywhere;
}

.dp-profile-copy > p {
  font-size: 12px;
  color: #75849a;
  font-weight: 700;
  margin: 0;
}

.dp-profile-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
  margin-top: 23px;
}

.dp-profile-facts > div {
  display: flex;
  gap: 9px;
  align-items: center;
}

.dp-fact-icon {
  font-size: 22px;
}

.dp-profile-facts small {
  display: block;
  color: #8795a4;
  font-size: 10px;
}

.dp-profile-facts strong {
  display: block;
  margin-top: 5px;
  font-size: 11px;
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
  font-size: 12px;
  line-height: 1.7;
  color: #344a62;
}

.dp-profile-accent {
  width: 47px;
  height: 4px;
  border-radius: 10px;
  background: #087c57;
  margin-top: 12px;
}

/* COMMON CARD */

.dp-achievement,
.dp-card {
  background: #fff;
  border: 1px solid #e5ebf1;
  border-radius: 16px;
  padding: 15px;
  margin-bottom: 15px;
  box-shadow: 0 4px 18px #142d4307;
}

/* ACHIEVEMENT */

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

.dp-week-heading small {
  font-size: 12px;
  font-weight: 800;
  color: #07865d;
}

.dp-week-heading h2 {
  margin: 6px 0;
  font-size: 24px;
}

.dp-week-heading p {
  margin: 0;
  font-size: 11px;
  color: #6d7d91;
}

.dp-donut {
  --progress: 0%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(
    #08b77d var(--progress),
    #dcebe5 var(--progress)
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
  background: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.dp-donut strong {
  font-size: 22px;
}

.dp-donut small {
  font-size: 9px;
  text-align: center;
  color: #81909f;
}

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

.dp-participant-range {
  font-size: 11px;
  color: #69857a;
  margin: 0 0 14px;
  padding: 0 4px;
}

.dp-category-grid {
  display: grid;
  grid-template-columns: repeat(6,minmax(0,1fr));
  gap: 9px;
}

.dp-category {
  min-width: 0;
  padding: 13px;
  background: #fff;
  border: 1px solid #e5ebf1;
  border-radius: 11px;
}

.dp-category-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
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

.dp-category-value {
  margin: 13px 0 8px;
  font-size: 19px;
  font-weight: 900;
}

.dp-progress {
  width: 100%;
  height: 9px;
  background: #e1e8ee;
  border-radius: 20px;
  overflow: hidden;
}

.dp-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg,#09b77d,#07875c);
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
  color: #75859a;
}

.dp-category-footer strong {
  color: #273c4e;
  text-align: right;
}

.dp-note {
  color: #8292a1;
  font-size: 11px;
  line-height: 1.65;
  margin-top: 13px;
}

/* MENU */

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
  font-size: 18px;
}

.dp-heading-symbol {
  font-size: 25px;
  color: #07a76f;
}

.dp-section-heading p {
  color: #7c8b9b;
  font-size: 11px;
  margin: 6px 0 0;
}

.dp-refresh {
  border: 1px solid #dce8e2;
  background: #f4fbf6;
  border-radius: 9px;
  padding: 10px 14px;
  color: #087e55;
  font-size: 11px;
  font-weight: 800;
}

.dp-menu-grid {
  display: grid;
  grid-template-columns: repeat(3,minmax(0,1fr));
  gap: 9px;
}

.dp-module {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e2e9f0;
  border-radius: 11px;
  background: #fff;
  text-align: left;
}

.dp-module:hover {
  background: #f8fcfa;
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

.dp-module-text {
  min-width: 0;
  flex: 1;
}

.dp-module-text strong {
  display: block;
  font-size: 12px;
}

.dp-module-text small {
  display: block;
  color: #8090a1;
  font-size: 10px;
  margin-top: 5px;
  line-height: 1.4;
}

.dp-chevron {
  font-size: 23px;
  color: #778b9f;
}

.dp-ach-actions {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 10px;
}

.dp-ach-actions button {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #dde9e1;
  background: #f7fcf9;
  color: #126f50;
  padding: 15px;
  border-radius: 11px;
  font-weight: 800;
  text-align: left;
}

.dp-bottom-back {
  width: 100%;
  padding: 14px;
  background: #eaf2ee;
  color: #2a5b48;
  border: 1px solid #d6e6dd;
  border-radius: 10px;
  font-weight: 800;
}

/* POST TEST */

.dp-post-stats {
  display: grid;
  grid-template-columns: repeat(2,minmax(0,1fr));
  gap: 12px;
  margin-bottom: 21px;
}

.dp-post-stats > div {
  background: #f4faf6;
  border: 1px solid #e0eee5;
  border-radius: 11px;
  padding: 17px;
  font-size: 12px;
  color: #6b7f73;
}

.dp-post-stats strong {
  display: block;
  margin-top: 10px;
  font-size: 26px;
  color: #087b56;
}

.dp-form {
  max-width: 560px;
  display: grid;
  gap: 15px;
  margin-top: 18px;
}

.dp-form label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
}

.dp-form input,
.dp-form textarea {
  width: 100%;
  border: 1px solid #dbe5e9;
  border-radius: 9px;
  padding: 12px;
  font-size: 14px;
}

.dp-form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

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

.dp-secondary {
  background: #e7eef2;
  color: #38516a;
}

.dp-edit {
  background: #277bd2;
  color: #fff;
}

.dp-delete {
  background: #d13c3c;
  color: #fff;
}

.dp-history {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  border-bottom: 1px solid #edf0f3;
  padding: 17px 0;
}

.dp-history small {
  display: block;
  color: #8493a3;
  margin-top: 6px;
  font-size: 11px;
}

.dp-history p {
  color: #526477;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dp-history-actions {
  display: flex;
  align-items: flex-start;
  gap: 7px;
}

/* NOTIFICATION / FOOTER */

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

.dp-footer {
  padding: 25px 0;
  text-align: center;
  color: #98a4b2;
  font-size: 10px;
}

.dp-loading {
  padding: 35px;
  font: 14px Arial, sans-serif;
}

.dp-loading button {
  padding: 12px;
}

.dp-overlay {
  display: none;
}

/* RESPONSIVE */

@media (max-width: 1450px) {
  .dp-category-grid {
    grid-template-columns: repeat(3,minmax(0,1fr));
  }

  .dp-achievement-overview {
    grid-template-columns:
      minmax(180px,1fr)
      125px
      repeat(3,minmax(90px,1fr));
  }

  .dp-donut {
    width: 110px;
    height: 110px;
  }
}

@media (max-width: 1100px) {
  .dp-profile {
    grid-template-columns: 1fr;
  }

  .dp-profile-image {
    min-height: 110px;
  }

  .dp-achievement-overview {
    grid-template-columns: repeat(3,minmax(0,1fr));
  }

  .dp-week-heading {
    grid-column: span 2;
  }

  .dp-menu-grid {
    grid-template-columns: repeat(2,minmax(0,1fr));
  }
}

@media (max-width: 760px) {
  .dp-sidebar {
    transform: translateX(-105%);
    transition: transform .2s;
  }

  .dp-sidebar.open {
    transform: translateX(0);
  }

  .dp-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: #0006;
    border: 0;
    z-index: 45;
  }

  .dp-right {
    margin-left: 0;
  }

  .dp-topbar {
    height: 59px;
    padding: 0 14px;
  }

  .dp-mobile-menu {
    display: block;
  }

  .dp-content {
    padding: 14px 11px;
  }

  .dp-title-row {
    flex-direction: column;
    align-items: stretch;
  }

  .dp-title-row h1 {
    font-size: 26px;
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
    grid-template-columns: repeat(3,minmax(0,1fr));
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
    grid-template-columns: repeat(2,minmax(0,1fr));
  }

  .dp-menu-grid {
    grid-template-columns: 1fr;
  }

  .dp-top-account {
    gap: 7px;
  }

  .dp-top-account strong {
    font-size: 10px;
  }

  .dp-ach-actions {
    grid-template-columns: 1fr;
  }

  .dp-history {
    flex-direction: column;
  }
}

@media (max-width: 400px) {
  .dp-category-grid {
    grid-template-columns: 1fr;
  }

  .dp-profile-info {
    flex-wrap: wrap;
  }

  .dp-profile-facts > div {
    width: 100%;
  }
}

@media print {
  .dp-sidebar,
  .dp-topbar,
  .dp-overlay,
  .dp-refresh,
  .dp-bottom-back,
  .dp-ach-actions,
  .dp-form-actions {
    display: none !important;
  }

  .dp-right {
    margin-left: 0;
  }

  .dp-content {
    max-width: none;
    padding: 0;
  }

  .dp-achievement,
  .dp-profile,
  .dp-card {
    box-shadow: none;
    break-inside: avoid;
  }
}
`;
