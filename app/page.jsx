
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const CARD = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 18,
  marginBottom: 16,
};

const BUTTON = {
  width: "100%",
  padding: "13px 16px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 10,
  fontWeight: 700,
  cursor: "pointer",
};

const ACHIEVEMENTS = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

function average(rows) {
  const scores = rows
    .map((r) => Number(r.score))
    .filter((n) => Number.isFinite(n));

  if (!scores.length) return "-";

  return (
    scores.reduce((a, b) => a + b, 0) / scores.length
  ).toFixed(1);
}

function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
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

function ProgressBar({ value, color = "#2563eb" }) {
  const safe = Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );

  return (
    <div
      style={{
        height: 10,
        background: "#e2e8f0",
        borderRadius: 20,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          width: `${safe}%`,
          height: "100%",
          background: color,
          borderRadius: 20,
        }}
      />
    </div>
  );
}

function Stat({ title, value, subtitle }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          marginBottom: 8,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>

      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "#64748b",
            marginTop: 5,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}

export default function MentorDashboard() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] =
    useState([]);
  const [achievements, setAchievements] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function fetchDashboard() {
    const [
      programRes,
      typeRes,
    ] = await Promise.all([
      supabase
        .from("ojt_programs")
        .select(`
          id,
          start_date,
          end_date,
          status,
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

    if (programRes.error) throw programRes.error;
    if (typeRes.error) throw typeRes.error;

    const dataPrograms = programRes.data || [];
    const ids = dataPrograms.map((p) => p.id);

    setPrograms(dataPrograms);
    setAchievementTypes(typeRes.data || []);

    if (!ids.length) {
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
        .select(
          "id,program_id,type_code,status"
        )
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
        .select(
          "id,program_id,score,outcome,test_date"
        )
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
        throw new Error(
          `${name}: ${result.error.message}`
        );
      }
    }

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

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (profile?.role !== "mentor") {
          router.replace("/peserta");
          return;
        }

        if (!active) return;

        setMentor(profile);
        await fetchDashboard();
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat dashboard."
          );
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
    setRefreshing(true);
    setError("");

    try {
      await fetchDashboard();
    } catch (err) {
      setError(
        err.message || "Gagal memperbarui data."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const totalPrograms = programs.length;

  const simperPassed = simper.filter(
    (r) => r.status === "passed"
  ).length;

  const totalVerified = achievements.filter(
    (r) => r.status === "verified"
  ).length;

  const overallAverage = average(postTests);

  function getParticipantData(programId) {
    const a = achievements.filter(
      (r) => r.program_id === programId
    );

    const pt = postTests.filter(
      (r) => r.program_id === programId
    );

    const pr = practices.filter(
      (r) => r.program_id === programId
    );

    const sm = samapta.filter(
      (r) => r.program_id === programId
    );

    const sp = simper.find(
      (r) => r.program_id === programId
    );

    const passedStages = sp
      ? [
          sp.administration_status,
          sp.training_status,
          sp.theory_status,
          sp.practice_status,
        ].filter((s) => s === "passed").length
      : 0;

    const simperProgress = passedStages * 25;

    const verifiedCategories = new Set(
      a
        .filter((r) => r.status === "verified")
        .map((r) => r.type_code)
    );

    const achievementProgress = Math.round(
      (verifiedCategories.size / 6) * 100
    );

    return {
      a,
      pt,
      pr,
      sm,
      sp,
      simperProgress,
      passedStages,
      verifiedCategories,
      achievementProgress,
    };
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 18,
        backgroundColor: "#f1f5f9",
        backgroundImage:
          'linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.94)),url("/background-erg.png.PNG")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            background: "#0f172a",
            color: "white",
            padding: 24,
            borderRadius: 18,
            marginBottom: 18,
          }}
        >
          <h1 style={{ marginTop: 0 }}>
            Monitoring OJT
          </h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>

          <p style={{ color: "#cbd5e1" }}>
            Dashboard Monitoring Mentor
          </p>

          {mentor && (
            <p>
              Selamat datang,{" "}
              <strong>{mentor.full_name}</strong>
            </p>
          )}

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || loading}
              style={{
                ...BUTTON,
                width: "auto",
                background: "#0f766e",
              }}
            >
              {refreshing
                ? "Memperbarui..."
                : "↻ Refresh Data"}
            </button>

            <button
              type="button"
              onClick={logout}
              style={{
                ...BUTTON,
                width: "auto",
                background: "#475569",
              }}
            >
              Keluar
            </button>
          </div>
        </header>

        {error && (
          <section style={CARD}>
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          </section>
        )}

        {loading ? (
          <section style={CARD}>
            <h3>Memuat Dashboard...</h3>
            <p>
              Mengambil data peserta dari Supabase.
            </p>
          </section>
        ) : !mentor ? (
          <section style={CARD}>
            Akses Dashboard Mentor tidak tersedia.
          </section>
        ) : (
          <>
            <section style={CARD}>
              <h2>Ringkasan Keseluruhan OJT</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2,minmax(0,1fr))",
                  gap: 12,
                }}
              >
                <Stat
                  title="Peserta OJT Aktif"
                  value={totalPrograms}
                />

                <Stat
                  title="SIMPER Lulus"
                  value={simperPassed}
                />

                <Stat
                  title="Pencapaian Terverifikasi"
                  value={totalVerified}
                />

                <Stat
                  title="Rata-rata Post-Test"
                  value={overallAverage}
                />
              </div>
            </section>

            <h2>Monitoring Per Peserta</h2>

            {programs.length === 0 && (
              <section style={CARD}>
                <p>
                  Belum ada peserta OJT dengan
                  status program aktif.
                </p>
              </section>
            )}

            {programs.map((program) => {
              const d = getParticipantData(program.id);

              const passedSamapta = d.sm.filter(
                (r) => r.outcome === "pass"
              ).length;

              const failedSamapta = d.sm.filter(
                (r) => r.outcome === "fail"
              ).length;

              return (
                <section
                  key={program.id}
                  style={CARD}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          marginTop: 0,
                          marginBottom: 8,
                        }}
                      >
                        {program.peserta?.full_name ||
                          "Peserta OJT"}
                      </h2>

                      <p
                        style={{
                          color: "#64748b",
                          margin: "4px 0",
                        }}
                      >
                        {program.peserta?.department ||
                          "Departemen belum diisi"}
                      </p>

                      <p
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {formatDate(
                          program.start_date
                        )}{" "}
                        –{" "}
                        {formatDate(
                          program.end_date
                        )}
                      </p>
                    </div>

                    <span
                      style={{
                        background: "#dcfce7",
                        color: "#166534",
                        borderRadius: 20,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Aktif
                    </span>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 12,
                    }}
                  >
                    <h3>
                      Enam Pencapaian OJT
                    </h3>

                    <p>
                      {d.verifiedCategories.size} dari
                      6 kategori terverifikasi
                    </p>

                    <ProgressBar
                      value={d.achievementProgress}
                    />

                    <p
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                      }}
                    >
                      {d.achievementProgress}%
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {ACHIEVEMENTS.map((name) => {
                        const type =
                          achievementTypes.find(
                            (t) =>
                              t.name.toLowerCase() ===
                              name.toLowerCase()
                          );

                        const done =
                          type &&
                          d.verifiedCategories.has(
                            type.code
                          );

                        return (
                          <span
                            key={name}
                            style={{
                              padding: "6px 9px",
                              borderRadius: 8,
                              background: done
                                ? "#dcfce7"
                                : "#e2e8f0",
                              color: done
                                ? "#166534"
                                : "#475569",
                              fontSize: 12,
                            }}
                          >
                            {done ? "✓ " : "○ "}
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2,minmax(0,1fr))",
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <Stat
                      title="Post-Test Teori"
                      value={average(d.pt)}
                      subtitle={`${d.pt.length} tes • rata-rata nilai`}
                    />

                    <Stat
                      title="Praktik Mingguan"
                      value={average(d.pr)}
                      subtitle={`${d.pr.length} penilaian • rata-rata nilai`}
                    />

                    <Stat
                      title="Samapta Lulus"
                      value={passedSamapta}
                      subtitle={`${d.sm.length} tes • ${failedSamapta} tidak lulus • rata-rata ${average(d.sm)}`}
                    />

                    <Stat
                      title="Status SIMPER"
                      value={statusLabel(d.sp?.status)}
                      subtitle={`${d.passedStages} dari 4 tahapan lulus`}
                    />
                  </div>

                  <div
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ marginTop: 0 }}>
                      Progres SIMPER
                    </h3>

                    <ProgressBar
                      value={d.simperProgress}
                      color="#7c3aed"
                    />

                    <p
                      style={{
                        textAlign: "right",
                        fontWeight: 700,
                        marginBottom: 0,
                      }}
                    >
                      {d.simperProgress}%
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 9,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/peserta/${program.id}`
                        )
                      }
                      style={BUTTON}
                    >
                      Lihat Detail Peserta →
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/simper/${program.id}`
                        )
                      }
                      style={{
                        ...BUTTON,
                        background: "#7c3aed",
                      }}
                    >
                      Monitoring SIMPER →
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/samapta/${program.id}`
                        )
                      }
                      style={{
                        ...BUTTON,
                        background: "#16a34a",
                      }}
                    >
                      Monitoring Samapta →
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/praktik/${program.id}`
                        )
                      }
                      style={{
                        ...BUTTON,
                        background: "#0f766e",
                      }}
                    >
                      Penilaian Praktik Mingguan →
                    </button>
                  </div>
                </section>
              );
            })}
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
          }}
        >
          Monitoring OJT — Emergency Response Group
          <p>© 2026 PT Berau Coal</p>
        </footer>
      </div>
    </main>
  );
}
