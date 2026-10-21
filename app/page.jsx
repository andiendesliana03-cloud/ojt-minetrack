
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SITES = [
  "LMO", "SMO", "GMO NORTH", "GMO SOUTH",
  "BMO 1", "BMO 2", "BMO 3", "SRN", "HO",
];

const ACHIEVEMENTS = [
  "Fisik", "Training", "Sosialisasi",
  "Coaching", "Orientasi Area", "Hazard",
];

const C = {
  green: "#14532d",
  dark: "#052e16",
  mid: "#166534",
  gold: "#d4a83f",
  goldLight: "#fef3c7",
  bg: "#f3f7f4",
  text: "#17251c",
  muted: "#64748b",
  border: "#e2e8f0",
  white: "#ffffff",
  red: "#b91c1c",
  purple: "#7c3aed",
};

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
  boxShadow: "0 5px 18px rgba(15,45,32,0.05)",
  minWidth: 0,
};

const BUTTON = {
  width: "100%",
  padding: "13px 15px",
  background: C.green,
  color: C.white,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 11,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxSizing: "border-box",
};

const LABEL = {
  display: "block",
  fontWeight: 700,
  fontSize: 13,
  marginBottom: 8,
  color: "#334155",
};

const FIELD = {
  width: "100%",
  padding: 13,
  border: `1px solid ${C.border}`,
  borderRadius: 11,
  background: C.white,
  color: C.text,
  fontSize: 16,
  boxSizing: "border-box",
  outlineColor: C.gold,
};

function average(rows) {
  const scores = rows
    .filter(
      (row) =>
        row.score !== null &&
        row.score !== undefined &&
        row.score !== ""
    )
    .map((row) => Number(row.score))
    .filter((score) => Number.isFinite(score));

  if (!scores.length) return "-";

  return (
    scores.reduce((sum, score) => sum + score, 0) /
    scores.length
  ).toFixed(1);
}

function formatDate(value) {
  if (!value) return "-";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function statusLabel(value) {
  const labels = {
    not_started: "Belum Proses",
    in_progress: "Dalam Proses",
    passed: "Lulus",
    failed: "Tidak Lulus",
    pending: "Menunggu Penilaian",
    pass: "Lulus",
    fail: "Tidak Lulus",
  };
  return labels[value] || value || "Belum Proses";
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function SectionTitle({ children, subtitle }) {
  return (
    <div style={{ marginBottom: 17 }}>
      <h2
        style={{
          fontSize: 18,
          lineHeight: 1.35,
          margin: 0,
          color: C.dark,
          fontWeight: 800,
        }}
      >
        {children}
      </h2>
      {subtitle && (
        <p
          style={{
            color: C.muted,
            fontSize: 12,
            margin: "5px 0 0",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </p>
      )}
      <div
        style={{
          width: 42,
          height: 3,
          background: C.gold,
          borderRadius: 5,
          marginTop: 10,
        }}
      />
    </div>
  );
}

function ProgressBar({ value, color = C.green }) {
  const safe = Math.min(100, Math.max(0, Number(value) || 0));

  return (
    <div
      style={{
        height: 9,
        background: "#e8eee9",
        borderRadius: 20,
        overflow: "hidden",
        marginTop: 9,
      }}
    >
      <div
        style={{
          width: `${safe}%`,
          height: "100%",
          background: color,
          borderRadius: 20,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function Stat({ title, value, subtitle, accent = C.green }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 14,
        minWidth: 0,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 4,
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          background: accent,
        }}
      />
      <div
        style={{
          fontSize: 11,
          color: C.muted,
          fontWeight: 700,
          marginBottom: 8,
          lineHeight: 1.45,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 25,
          lineHeight: 1.2,
          fontWeight: 800,
          color: C.dark,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: 10,
            color: C.muted,
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

function ActionButton({ children, onClick, color = C.green, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...BUTTON,
        background: disabled ? "#94a3b8" : color,
        opacity: disabled ? 0.75 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

export default function MentorDashboard() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [siteFilter, setSiteFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function fetchDashboard() {
    const [programRes, typeRes] = await Promise.all([
      supabase
        .from("ojt_programs")
        .select(`
          id,
          participant_id,
          start_date,
          end_date,
          status,
          site,
          peserta:profiles!ojt_programs_participant_id_fkey(
            full_name,
            department
          )
        `)
        .eq("status", "active")
        .order("start_date", { ascending: false }),

      supabase
        .from("achievement_types")
        .select("code,name"),
    ]);

    if (programRes.error) {
      throw new Error(`Program OJT: ${programRes.error.message}`);
    }

    if (typeRes.error) {
      throw new Error(
        `Kategori Pencapaian: ${typeRes.error.message}`
      );
    }

    const dataPrograms = programRes.data || [];
    const ids = dataPrograms.map((program) => program.id);

    if (!ids.length) {
      setPrograms([]);
      setAchievementTypes(typeRes.data || []);
      setAchievements([]);
      setPostTests([]);
      setPractices([]);
      setSamapta([]);
      setSimper([]);
      return;
    }

    const [
      achievementRes,
      postTestRes,
      practiceRes,
      samaptaRes,
      simperRes,
    ] = await Promise.all([
      supabase
        .from("achievement_records")
        .select("id,program_id,type_code,status")
        .in("program_id", ids),

      supabase
        .from("post_test_scores")
        .select("id,program_id,score,test_date")
        .in("program_id", ids),

      supabase
        .from("weekly_practice_scores")
        .select("id,program_id,score,practice_date")
        .in("program_id", ids),

      supabase
        .from("samapta_records")
        .select("id,program_id,score,outcome,test_date")
        .in("program_id", ids),

      supabase
        .from("simper_records")
        .select(`
          id,
          program_id,
          administration_status,
          training_status,
          theory_status,
          practice_status,
          status,
          graduation_date
        `)
        .in("program_id", ids),
    ]);

    const results = [
      ["Pencapaian", achievementRes],
      ["Post-Test", postTestRes],
      ["Praktik", practiceRes],
      ["Samapta", samaptaRes],
      ["SIMPER", simperRes],
    ];

    for (const [name, result] of results) {
      if (result.error) {
        throw new Error(`${name}: ${result.error.message}`);
      }
    }

    setPrograms(dataPrograms);
    setAchievementTypes(typeRes.data || []);
    setAchievements(achievementRes.data || []);
    setPostTests(postTestRes.data || []);
    setPractices(practiceRes.data || []);
    setSamapta(samaptaRes.data || []);
    setSimper(simperRes.data || []);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
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

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (!active) return;

        setMentor(profile);
        await fetchDashboard();
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat dashboard.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router]);

  async function refresh() {
    if (refreshing || loading) return;

    setRefreshing(true);
    setError("");

    try {
      await fetchDashboard();
    } catch (err) {
      setError(err.message || "Gagal memperbarui dashboard.");
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const achievementCodeMap = useMemo(() => {
    const map = new Map();

    for (const name of ACHIEVEMENTS) {
      const type = achievementTypes.find(
        (item) => normalizeName(item.name) === normalizeName(name)
      );

      if (type) map.set(name, type.code);
    }

    return map;
  }, [achievementTypes]);

  const participantData = useMemo(() => {
    const result = {};

    for (const program of programs) {
      const programId = program.id;

      const a = achievements.filter(
        (row) => row.program_id === programId
      );
      const pt = postTests.filter(
        (row) => row.program_id === programId
      );
      const pr = practices.filter(
        (row) => row.program_id === programId
      );
      const sm = samapta.filter(
        (row) => row.program_id === programId
      );
      const simperRows = simper.filter(
        (row) => row.program_id === programId
      );

      const sp =
        simperRows.find((row) => row.status === "passed") ||
        simperRows[0] ||
        null;

      const verifiedCodes = new Set(
        a
          .filter((row) => row.status === "verified")
          .map((row) => row.type_code)
      );

      const verifiedCategories = ACHIEVEMENTS.filter((name) => {
        const code = achievementCodeMap.get(name);
        return code && verifiedCodes.has(code);
      });

      const achievementProgress = Math.round(
        (verifiedCategories.length / ACHIEVEMENTS.length) * 100
      );

      const passedStages = sp
        ? [
            sp.administration_status,
            sp.training_status,
            sp.theory_status,
            sp.practice_status,
          ].filter((status) => status === "passed").length
        : 0;

      const simperProgress =
        sp?.status === "passed" ? 100 : passedStages * 25;

      const passedSamapta = sm.filter(
        (row) => row.outcome === "pass"
      ).length;

      const failedSamapta = sm.filter(
        (row) => row.outcome === "fail"
      ).length;

      result[programId] = {
        a,
        pt,
        pr,
        sm,
        sp,
        verifiedCategories,
        achievementProgress,
        passedStages,
        simperProgress,
        passedSamapta,
        failedSamapta,
      };
    }

    return result;
  }, [
    programs,
    achievements,
    postTests,
    practices,
    samapta,
    simper,
    achievementCodeMap,
  ]);

  const filteredPrograms = useMemo(() => {
    const keyword = normalizeName(search);

    return programs.filter((program) => {
      const matchSite =
        siteFilter === "ALL" || program.site === siteFilter;

      const participantName = normalizeName(
        program.peserta?.full_name
      );

      return (
        matchSite &&
        (!keyword || participantName.includes(keyword))
      );
    });
  }, [programs, siteFilter, search]);

  const summary = useMemo(() => {
    const ids = new Set(
      filteredPrograms.map((program) => program.id)
    );

    const filteredPostTests = postTests.filter(
      (row) => ids.has(row.program_id)
    );

    const verifiedTotal = filteredPrograms.reduce(
      (total, program) =>
        total +
        (participantData[program.id]?.verifiedCategories.length || 0),
      0
    );

    const simperPassed = filteredPrograms.filter(
      (program) =>
        participantData[program.id]?.sp?.status === "passed"
    ).length;

    const progressTotal = filteredPrograms.reduce(
      (total, program) =>
        total +
        (participantData[program.id]?.achievementProgress || 0),
      0
    );

    const averageProgress = filteredPrograms.length
      ? Math.round(progressTotal / filteredPrograms.length)
      : 0;

    return {
      totalPrograms: filteredPrograms.length,
      simperPassed,
      verifiedTotal,
      averageProgress,
      postTestAverage: average(filteredPostTests),
    };
  }, [filteredPrograms, postTests, participantData]);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "16px 12px 30px",
        background:
          "linear-gradient(180deg,#edf7ef 0%,#f7f9f7 42%,#eef2f7 100%)",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: C.text,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <header
          style={{
            background:
              "linear-gradient(135deg,#052e16 0%,#14532d 58%,#166534 100%)",
            color: C.white,
            padding: "24px 19px",
            borderRadius: 20,
            marginBottom: 20,
            border: `1px solid ${C.gold}`,
            boxShadow: "0 12px 30px rgba(5,46,22,0.16)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "inline-block",
              background: "rgba(212,168,63,0.14)",
              border: "1px solid rgba(212,168,63,0.55)",
              color: "#f8d879",
              padding: "6px 10px",
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.2,
              marginBottom: 14,
            }}
          >
            EMERGENCY RESPONSE GROUP
          </div>

          <h1
            style={{
              margin: "0 0 7px",
              fontSize: 29,
              lineHeight: 1.2,
              fontWeight: 900,
              letterSpacing: -0.6,
              color: "#f5d77c",
            }}
          >
            Monitoring OJT
          </h1>

          <div
            style={{
              fontSize: 13,
              color: "#e2e8f0",
              lineHeight: 1.6,
            }}
          >
            Sistem Monitoring dan Evaluasi OJT
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 12,
              color: "#bbd8c3",
            }}
          >
            PT Berau Coal · 2026
          </div>

          {mentor && (
            <div
              style={{
                marginTop: 19,
                padding: 13,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  color: "#bbd8c3",
                  fontSize: 11,
                  marginBottom: 5,
                }}
              >
                DASHBOARD MENTOR
              </div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                {mentor.full_name || "Mentor"}
              </div>
              <div
                style={{
                  color: "#e2e8f0",
                  fontSize: 11,
                  marginTop: 5,
                }}
              >
                Akses monitoring peserta OJT
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 9,
              marginTop: 18,
            }}
          >
            <ActionButton
              onClick={refresh}
              disabled={refreshing || loading}
              color="#b38a27"
            >
              {refreshing ? "Memperbarui..." : "↻ Refresh Data"}
            </ActionButton>

            <ActionButton
              onClick={() => router.push("/mentor/monitoring-peserta")}
              color="#ffffff"
            >
              <span style={{ color: C.green }}>
                Monitoring Peserta
              </span>
            </ActionButton>

            <ActionButton
              onClick={() => router.push("/mentor/daftar-peserta")}
              color="#1d8050"
            >
              Pendaftaran Peserta
            </ActionButton>

            <ActionButton onClick={logout} color="#334155">
              Keluar Akun
            </ActionButton>
          </div>
        </header>

        {error && (
          <section
            role="alert"
            style={{
              ...CARD,
              border: "1px solid #fecaca",
              background: "#fff7f7",
              color: C.red,
            }}
          >
            <strong>Terjadi masalah saat memuat data</strong>
            <p
              style={{
                marginBottom: 0,
                fontSize: 13,
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          </section>
        )}

        {loading ? (
          <section style={CARD}>
            <div style={{ color: C.green, fontWeight: 800 }}>
              Memuat Dashboard...
            </div>
            <p style={{ color: C.muted, fontSize: 13 }}>
              Mengambil data monitoring dari Supabase.
            </p>
          </section>
        ) : !mentor ? (
          <section style={CARD}>
            Akses Dashboard Mentor tidak tersedia.
          </section>
        ) : (
          <>
            <section style={CARD}>
              <SectionTitle subtitle="Ringkasan mengikuti site dan nama peserta yang dipilih.">
                Ringkasan Monitoring
              </SectionTitle>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                  gap: 10,
                }}
              >
                <Stat
                  title="PESERTA OJT AKTIF"
                  value={summary.totalPrograms}
                  subtitle="Program sesuai filter"
                  accent={C.green}
                />
                <Stat
                  title="RATA-RATA PENCAPAIAN"
                  value={`${summary.averageProgress}%`}
                  subtitle="Enam kategori OJT"
                  accent={C.gold}
                />
                <Stat
                  title="SIMPER LULUS"
                  value={summary.simperPassed}
                  subtitle="Program unik berstatus lulus"
                  accent="#7c3aed"
                />
                <Stat
                  title="PENCAPAIAN TERVERIFIKASI"
                  value={summary.verifiedTotal}
                  subtitle="Kategori yang selesai"
                  accent="#0f766e"
                />
                <Stat
                  title="RATA-RATA POST-TEST"
                  value={summary.postTestAverage}
                  subtitle="Nilai teori peserta"
                  accent="#2563eb"
                />
                <Stat
                  title="SITE TERISI"
                  value={
                    filteredPrograms.filter((program) =>
                      Boolean(program.site)
                    ).length
                  }
                  subtitle="Program dengan site"
                  accent="#b38a27"
                />
              </div>
            </section>

            <section style={CARD}>
              <SectionTitle subtitle="Saring peserta berdasarkan penempatan dan nama.">
                Filter Monitoring
              </SectionTitle>

              <label htmlFor="site-filter" style={LABEL}>
                Site Penempatan OJT
              </label>
              <select
                id="site-filter"
                value={siteFilter}
                onChange={(event) => setSiteFilter(event.target.value)}
                style={FIELD}
              >
                <option value="ALL">Semua Site</option>
                {SITES.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>

              <label
                htmlFor="participant-search"
                style={{ ...LABEL, marginTop: 16 }}
              >
                Cari Nama Peserta
              </label>
              <input
                id="participant-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ketik nama peserta..."
                style={FIELD}
              />

              <div
                style={{
                  marginTop: 14,
                  padding: 11,
                  background: "#f0fdf4",
                  borderRadius: 10,
                  color: C.green,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                Menampilkan <strong>{filteredPrograms.length}</strong> dari{" "}
                <strong>{programs.length}</strong> program OJT aktif.
              </div>
            </section>

            <div style={{ margin: "24px 2px 14px" }}>
              <h2
                style={{
                  fontSize: 20,
                  color: C.dark,
                  margin: 0,
                  fontWeight: 900,
                }}
              >
                Monitoring Per Peserta
              </h2>
              <p
                style={{
                  fontSize: 12,
                  color: C.muted,
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                Progres kompetensi, teori, praktik, Samapta, dan SIMPER.
              </p>
            </div>

            {filteredPrograms.length === 0 && (
              <section style={CARD}>
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 8px",
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 10 }}>
                    ◉
                  </div>
                  <strong>Tidak ada peserta ditemukan</strong>
                  <p
                    style={{
                      color: C.muted,
                      fontSize: 13,
                      marginBottom: 0,
                    }}
                  >
                    Coba pilih semua site atau ubah kata pencarian.
                  </p>
                </div>
              </section>
            )}

            {filteredPrograms.map((program) => {
              const d = participantData[program.id];
              if (!d) return null;

              return (
                <section
                  key={program.id}
                  style={{
                    ...CARD,
                    padding: 0,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "18px 17px",
                      background:
                        "linear-gradient(135deg,#f0fdf4 0%,#ffffff 100%)",
                      borderBottom: `1px solid ${C.border}`,
                      borderTop: `4px solid ${C.gold}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: "#8a6a16",
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: 1,
                            marginBottom: 7,
                          }}
                        >
                          PESERTA OJT
                        </div>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 19,
                            lineHeight: 1.35,
                            color: C.dark,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {program.peserta?.full_name || "Peserta OJT"}
                        </h3>
                        <p
                          style={{
                            color: C.muted,
                            fontSize: 12,
                            margin: "6px 0 0",
                          }}
                        >
                          {program.peserta?.department ||
                            "Departemen belum diisi"}
                        </p>
                      </div>

                      <span
                        style={{
                          background: "#dcfce7",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          borderRadius: 20,
                          padding: "6px 9px",
                          fontSize: 10,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        AKTIF
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 9,
                        marginTop: 15,
                      }}
                    >
                      <div
                        style={{
                          background: "#ffffff",
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            color: C.muted,
                            fontSize: 10,
                            marginBottom: 5,
                          }}
                        >
                          SITE PENEMPATAN
                        </div>
                        <div
                          style={{
                            color: C.green,
                            fontWeight: 800,
                            fontSize: 13,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {program.site || "Belum Ditentukan"}
                        </div>
                      </div>
                      <div
                        style={{
                          background: "#ffffff",
                          border: `1px solid ${C.border}`,
                          borderRadius: 10,
                          padding: 10,
                        }}
                      >
                        <div
                          style={{
                            color: C.muted,
                            fontSize: 10,
                            marginBottom: 5,
                          }}
                        >
                          PERIODE OJT
                        </div>
                        <div
                          style={{
                            color: C.text,
                            fontWeight: 700,
                            fontSize: 11,
                            lineHeight: 1.6,
                          }}
                        >
                          {formatDate(program.start_date)}
                          <br />
                          s.d. {formatDate(program.end_date)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16 }}>
                    <div
                      style={{
                        background: "#f8faf9",
                        border: `1px solid ${C.border}`,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 13,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 14,
                            color: C.dark,
                          }}
                        >
                          Enam Pencapaian OJT
                        </strong>
                        <span
                          style={{
                            color: C.green,
                            fontWeight: 900,
                            fontSize: 15,
                          }}
                        >
                          {d.achievementProgress}%
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          margin: "7px 0 0",
                        }}
                      >
                        {d.verifiedCategories.length} dari 6 kategori
                        terverifikasi
                      </p>

                      <ProgressBar
                        value={d.achievementProgress}
                        color={C.green}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                          gap: 7,
                          marginTop: 14,
                        }}
                      >
                        {ACHIEVEMENTS.map((name) => {
                          const done =
                            d.verifiedCategories.includes(name);

                          return (
                            <div
                              key={name}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 7,
                                padding: "9px 8px",
                                borderRadius: 9,
                                border: `1px solid ${
                                  done ? "#bbf7d0" : "#e2e8f0"
                                }`,
                                background: done ? "#f0fdf4" : "#ffffff",
                                color: done ? "#166534" : "#64748b",
                                fontSize: 11,
                                fontWeight: 700,
                                lineHeight: 1.4,
                                minWidth: 0,
                              }}
                            >
                              <span style={{ fontSize: 13 }}>
                                {done ? "✓" : "○"}
                              </span>
                              <span style={{ overflowWrap: "anywhere" }}>
                                {name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                        gap: 9,
                        marginBottom: 13,
                      }}
                    >
                      <Stat
                        title="POST-TEST TEORI"
                        value={average(d.pt)}
                        subtitle={`${d.pt.length} tes tercatat`}
                        accent="#2563eb"
                      />
                      <Stat
                        title="PRAKTIK MINGGUAN"
                        value={average(d.pr)}
                        subtitle={`${d.pr.length} penilaian`}
                        accent="#0f766e"
                      />
                      <Stat
                        title="SAMAPTA LULUS"
                        value={d.passedSamapta}
                        subtitle={`${d.sm.length} tes · ${d.failedSamapta} tidak lulus`}
                        accent="#16a34a"
                      />
                      <Stat
                        title="STATUS SIMPER"
                        value={statusLabel(d.sp?.status)}
                        subtitle={`${d.passedStages} dari 4 tahapan lulus`}
                        accent={C.purple}
                      />
                    </div>

                    <div
                      style={{
                        background: "#faf5ff",
                        border: "1px solid #e9d5ff",
                        borderRadius: 13,
                        padding: 14,
                        marginBottom: 15,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 13,
                            color: "#581c87",
                          }}
                        >
                          Progres SIMPER
                        </strong>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 900,
                            color: C.purple,
                          }}
                        >
                          {d.simperProgress}%
                        </span>
                      </div>
                      <ProgressBar
                        value={d.simperProgress}
                        color={C.purple}
                      />
                      <p
                        style={{
                          color: "#6b21a8",
                          fontSize: 10,
                          margin: "8px 0 0",
                          lineHeight: 1.5,
                        }}
                      >
                        Progres berdasarkan empat tahapan SIMPER
                        yang berstatus lulus.
                      </p>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 9,
                      }}
                    >
                      <ActionButton
                        onClick={() =>
                          router.push(`/peserta/${program.id}`)
                        }
                        color={C.green}
                      >
                        Lihat Detail Peserta →
                      </ActionButton>

                      <ActionButton
                        onClick={() =>
                          router.push(`/simper/${program.id}`)
                        }
                        color={C.purple}
                      >
                        Monitoring SIMPER →
                      </ActionButton>

                      <ActionButton
                        onClick={() =>
                          router.push(`/samapta/${program.id}`)
                        }
                        color="#15803d"
                      >
                        Monitoring Samapta →
                      </ActionButton>

                      <ActionButton
                        onClick={() =>
                          router.push(`/praktik/${program.id}`)
                        }
                        color="#0f766e"
                      >
                        Penilaian Praktik Mingguan →
                      </ActionButton>
                    </div>
                  </div>
                </section>
              );
            })}
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: "20px 10px",
            color: C.muted,
            fontSize: 11,
            lineHeight: 1.8,
          }}
        >
          <div
            style={{
              width: 45,
              height: 3,
              background: C.gold,
              borderRadius: 5,
              margin: "0 auto 12px",
            }}
          />
          <strong style={{ color: C.green }}>
            OJT MineTrack
          </strong>
          <div>Emergency Response Group</div>
          <div>© 2026 PT Berau Coal</div>
        </footer>
      </div>
    </main>
  );
}
