
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const SITES = [
  "LMO",
  "SMO",
  "GMO NORTH",
  "GMO SOUTH",
  "BMO 1",
  "BMO 2",
  "BMO 3",
  "SRN",
  "HO",
];

const ACHIEVEMENTS = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

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
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
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

  const total = scores.reduce(
    (sum, score) => sum + score,
    0
  );

  return (total / scores.length).toFixed(1);
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

function ProgressBar({
  value,
  color = "#2563eb",
}) {
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
          transition: "width 0.3s ease",
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

function normalizeName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export default function MentorDashboard() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [achievementTypes, setAchievementTypes] =
    useState([]);
  const [achievements, setAchievements] =
    useState([]);
  const [postTests, setPostTests] = useState([]);
  const [practices, setPractices] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState([]);

  const [siteFilter, setSiteFilter] =
    useState("ALL");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] = useState("");

  async function fetchDashboard() {
    const [programRes, typeRes] =
      await Promise.all([
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
          .order("start_date", {
            ascending: false,
          }),

        supabase
          .from("achievement_types")
          .select("code,name"),
      ]);

    if (programRes.error) {
      throw new Error(
        `Program OJT: ${programRes.error.message}`
      );
    }

    if (typeRes.error) {
      throw new Error(
        `Kategori Pencapaian: ${typeRes.error.message}`
      );
    }

    const dataPrograms = programRes.data || [];
    const ids = dataPrograms.map(
      (program) => program.id
    );

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
        .select(
          "id,program_id,type_code,status"
        )
        .in("program_id", ids),

      supabase
        .from("post_test_scores")
        .select(
          "id,program_id,score,test_date"
        )
        .in("program_id", ids),

      supabase
        .from("weekly_practice_scores")
        .select(
          "id,program_id,score,practice_date"
        )
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

    // Perbarui data hanya setelah seluruh
    // permintaan Supabase berhasil.
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

        if (profileError) {
          throw profileError;
        }

        if (profile?.role !== "mentor") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (!active) return;

        setMentor(profile);
        await fetchDashboard();
      } catch (err) {
        if (active) {
          setError(
            err.message ||
              "Gagal memuat dashboard."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [router]);

  async function refresh() {
    if (refreshing) return;

    setRefreshing(true);
    setError("");

    try {
      await fetchDashboard();
    } catch (err) {
      setError(
        err.message ||
          "Gagal memperbarui dashboard."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  // Peta kategori pencapaian yang valid.
  const achievementCodeMap = useMemo(() => {
    const map = new Map();

    for (const name of ACHIEVEMENTS) {
      const type = achievementTypes.find(
        (item) =>
          normalizeName(item.name) ===
          normalizeName(name)
      );

      if (type) {
        map.set(name, type.code);
      }
    }

    return map;
  }, [achievementTypes]);

  // Menghitung satu kali untuk setiap program.
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

      // Jika terdapat beberapa catatan SIMPER,
      // utamakan catatan berstatus lulus.
      const sp =
        simperRows.find(
          (row) => row.status === "passed"
        ) ||
        simperRows[0] ||
        null;

      const verifiedCodes = new Set(
        a
          .filter(
            (row) => row.status === "verified"
          )
          .map((row) => row.type_code)
      );

      const verifiedCategories =
        ACHIEVEMENTS.filter((name) => {
          const code =
            achievementCodeMap.get(name);

          return (
            code &&
            verifiedCodes.has(code)
          );
        });

      const achievementProgress = Math.round(
        (verifiedCategories.length / 6) * 100
      );

      const passedStages = sp
        ? [
            sp.administration_status,
            sp.training_status,
            sp.theory_status,
            sp.practice_status,
          ].filter(
            (status) => status === "passed"
          ).length
        : 0;

      const simperProgress =
        sp?.status === "passed"
          ? 100
          : passedStages * 25;

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

  // Filter berdasarkan site dan nama peserta.
  const filteredPrograms = useMemo(() => {
    const keyword = normalizeName(search);

    return programs.filter((program) => {
      const matchSite =
        siteFilter === "ALL" ||
        program.site === siteFilter;

      const participantName =
        normalizeName(
          program.peserta?.full_name
        );

      const matchName =
        !keyword ||
        participantName.includes(keyword);

      return matchSite && matchName;
    });
  }, [programs, siteFilter, search]);

  // Ringkasan mengikuti filter yang dipilih.
  const summary = useMemo(() => {
    const ids = new Set(
      filteredPrograms.map(
        (program) => program.id
      )
    );

    const filteredPostTests = postTests.filter(
      (row) => ids.has(row.program_id)
    );

    const verifiedTotal =
      filteredPrograms.reduce(
        (total, program) => {
          const data =
            participantData[program.id];

          return (
            total +
            (data?.verifiedCategories.length || 0)
          );
        },
        0
      );

    const simperPassed =
      filteredPrograms.filter(
        (program) =>
          participantData[program.id]
            ?.sp?.status === "passed"
      ).length;

    const progressTotal =
      filteredPrograms.reduce(
        (total, program) =>
          total +
          (participantData[program.id]
            ?.achievementProgress || 0),
        0
      );

    const averageProgress =
      filteredPrograms.length
        ? Math.round(
            progressTotal /
              filteredPrograms.length
          )
        : 0;

    return {
      totalPrograms: filteredPrograms.length,
      simperPassed,
      verifiedTotal,
      averageProgress,
      postTestAverage: average(
        filteredPostTests
      ),
    };
  }, [
    filteredPrograms,
    postTests,
    participantData,
  ]);

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
            color: "#ffffff",
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
              <strong>
                {mentor.full_name}
              </strong>
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
              onClick={() =>
                router.push(
                  "/mentor/monitoring-peserta"
                )
              }
              style={{
                ...BUTTON,
                width: "auto",
              }}
            >
              👥 Monitoring Peserta
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/mentor/daftar-peserta"
                )
              }
              style={{
                ...BUTTON,
                width: "auto",
                background: "#7c3aed",
              }}
            >
              ➕ Pendaftaran Peserta
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
              Mengambil data peserta dari
              Supabase.
            </p>
          </section>
        ) : !mentor ? (
          <section style={CARD}>
            Akses Dashboard Mentor tidak tersedia.
          </section>
        ) : (
          <>
            <section style={CARD}>
              <h2 style={{ marginTop: 0 }}>
                Ringkasan Monitoring OJT
              </h2>

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
                  value={summary.totalPrograms}
                  subtitle="Sesuai filter"
                />

                <Stat
                  title="Rata-rata Pencapaian"
                  value={`${summary.averageProgress}%`}
                  subtitle="Enam kategori OJT"
                />

                <Stat
                  title="SIMPER Lulus"
                  value={summary.simperPassed}
                  subtitle="Jumlah program unik"
                />

                <Stat
                  title="Pencapaian Terverifikasi"
                  value={summary.verifiedTotal}
                  subtitle="Kategori yang selesai"
                />

                <Stat
                  title="Rata-rata Post-Test"
                  value={summary.postTestAverage}
                  subtitle="Nilai teori"
                />

                <Stat
                  title="Site Terisi"
                  value={
                    filteredPrograms.filter(
                      (program) =>
                        Boolean(program.site)
                    ).length
                  }
                  subtitle="Program dengan site"
                />
              </div>
            </section>

            <section style={CARD}>
              <h2 style={{ marginTop: 0 }}>
                Filter Monitoring
              </h2>

              <label
                htmlFor="site-filter"
                style={{
                  display: "block",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                Site Penempatan OJT
              </label>

              <select
                id="site-filter"
                value={siteFilter}
                onChange={(event) =>
                  setSiteFilter(
                    event.target.value
                  )
                }
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              >
                <option value="ALL">
                  Semua Site
                </option>

                {SITES.map((site) => (
                  <option
                    key={site}
                    value={site}
                  >
                    {site}
                  </option>
                ))}
              </select>

              <label
                htmlFor="participant-search"
                style={{
                  display: "block",
                  fontWeight: 700,
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                Cari Nama Peserta
              </label>

              <input
                id="participant-search"
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Ketik nama peserta..."
                style={{
                  width: "100%",
                  padding: 13,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: 16,
                  boxSizing: "border-box",
                }}
              />

              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginBottom: 0,
                }}
              >
                Menampilkan{" "}
                <strong>
                  {filteredPrograms.length}
                </strong>{" "}
                dari{" "}
                <strong>
                  {programs.length}
                </strong>{" "}
                program OJT aktif.
              </p>
            </section>

            <h2>Monitoring Per Peserta</h2>

            {filteredPrograms.length === 0 && (
              <section style={CARD}>
                <p>
                  Tidak ada peserta yang
                  sesuai dengan filter.
                </p>
              </section>
            )}

            {filteredPrograms.map((program) => {
              const d =
                participantData[program.id];

              if (!d) return null;

              return (
                <section
                  key={program.id}
                  style={CARD}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "flex-start",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          marginTop: 0,
                          marginBottom: 8,
                        }}
                      >
                        {program.peserta
                          ?.full_name ||
                          "Peserta OJT"}
                      </h2>

                      <p
                        style={{
                          color: "#64748b",
                          margin: "4px 0",
                        }}
                      >
                        {program.peserta
                          ?.department ||
                          "Departemen belum diisi"}
                      </p>

                      <p
                        style={{
                          color: "#475569",
                          fontWeight: 700,
                          margin: "8px 0",
                        }}
                      >
                        Site:{" "}
                        {program.site ||
                          "Belum Ditentukan"}
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
                      {
                        d.verifiedCategories
                          .length
                      }{" "}
                      dari 6 kategori
                      terverifikasi
                    </p>

                    <ProgressBar
                      value={
                        d.achievementProgress
                      }
                      color="#0f766e"
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
                      {ACHIEVEMENTS.map(
                        (name) => {
                          const done =
                            d.verifiedCategories.includes(
                              name
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
                              {done
                                ? "✓ "
                                : "○ "}
                              {name}
                            </span>
                          );
                        }
                      )}
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
                      subtitle={`${d.pt.length} tes`}
                    />

                    <Stat
                      title="Praktik Mingguan"
                      value={average(d.pr)}
                      subtitle={`${d.pr.length} penilaian`}
                    />

                    <Stat
                      title="Samapta Lulus"
                      value={
                        d.passedSamapta
                      }
                      subtitle={`${d.sm.length} tes • ${d.failedSamapta} tidak lulus • rata-rata ${average(d.sm)}`}
                    />

                    <Stat
                      title="Status SIMPER"
                      value={statusLabel(
                        d.sp?.status
                      )}
                      subtitle={`${d.passedStages} dari 4 tahapan lulus`}
                    />
                  </div>

                  <div
                    style={{
                      background: "#f5f3ff",
                      border:
                        "1px solid #ddd6fe",
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 16,
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                      }}
                    >
                      Progres SIMPER
                    </h3>

                    <ProgressBar
                      value={
                        d.simperProgress
                      }
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
