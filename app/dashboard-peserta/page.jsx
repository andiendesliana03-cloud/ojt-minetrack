
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
  blue: "#315e8a",
  blueBg: "#edf5ff",
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
  textAlign: "center",
};

const secondaryButton = {
  ...primaryButton,
  background: C.white,
  color: C.green,
  border: `1px solid ${C.border}`,
};

const labelStyle = {
  color: C.muted,
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 6,
};

const sectionTitle = {
  color: C.green,
  fontSize: 18,
  fontWeight: 800,
  margin: "0 0 14px",
};

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function statusInfo(access) {
  const statuses = {
    pending: {
      label: "Menunggu Persetujuan",
      color: C.yellow,
      bg: C.yellowBg,
      icon: "◷",
    },
    rejected: {
      label: "Pendaftaran Ditolak",
      color: C.red,
      bg: C.redBg,
      icon: "!",
    },
    approved: {
      label: "Disetujui",
      color: C.green3,
      bg: "#e8f5eb",
      icon: "✓",
    },
    no_program: {
      label: "Belum Aktif",
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
        minWidth: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        cursor: "pointer",
        color: C.text,
      }}
    >
      <span
        aria-hidden="true"
        style={{
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
        }}
      >
        {icon}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontWeight: 800,
            fontSize: 14,
            marginBottom: 5,
          }}
        >
          {title}
        </span>

        <span
          style={{
            display: "block",
            color: C.muted,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {description}
        </span>
      </span>

      <span
        aria-hidden="true"
        style={{ color: C.green3, fontSize: 20 }}
      >
        ›
      </span>
    </button>
  );
}

export default function DashboardPeserta() {
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [program, setProgram] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [access, setAccess] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apiTest, setApiTest] = useState("");
  const [testingApi, setTestingApi] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: p, error: pError } =
          await supabase
            .from("profiles")
            .select("id,full_name,department,role")
            .eq("id", user.id)
            .single();

        if (pError || !p) {
          throw new Error(
            "Profil peserta belum tersedia. Hubungi mentor."
          );
        }

        if (p.role === "mentor") {
          router.replace("/");
          return;
        }

        if (
          p.role !== "participant" &&
          p.role !== "peserta"
        ) {
          throw new Error(
            "Akun tidak memiliki akses peserta."
          );
        }

        const {
          data: registrations,
          error: registrationError,
        } = await supabase
          .from("participant_registrations")
          .select(
            "id,status,rejection_reason,created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

        if (registrationError) {
          throw registrationError;
        }

        const latestRegistration =
          registrations?.[0] || null;

        const {
          data: programs,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(
            "id,participant_id,start_date,end_date,status,site"
          )
          .eq("participant_id", user.id)
          .eq("status", "active")
          .order("start_date", {
            ascending: false,
          })
          .limit(1);

        if (programError) {
          throw programError;
        }

        const activeProgram = programs?.[0] || null;

        let nextAccess = "no_program";

        if (latestRegistration?.status === "pending") {
          nextAccess = "pending";
        } else if (
          latestRegistration?.status === "rejected"
        ) {
          nextAccess = "rejected";
        } else if (
          latestRegistration?.status === "approved" &&
          activeProgram
        ) {
          nextAccess = "approved";
        } else if (!latestRegistration && activeProgram) {
          nextAccess = "approved";
        }

        if (active) {
          setProfile(p);
          setProgram(activeProgram);
          setRegistration(latestRegistration);
          setAccess(nextAccess);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "Gagal memuat data peserta."
          );
          setAccess("error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [router]);

  async function testMentorApi() {
    if (testingApi) return;

    setTestingApi(true);
    setApiTest("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setApiTest(
          "BELUM LULUS: Sesi login tidak ditemukan."
        );
        return;
      }

      const {
        data: currentProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (
        profileError ||
        !currentProfile ||
        currentProfile.role !== "participant"
      ) {
        setApiTest(
          "PENGUJIAN DIHENTIKAN: Gunakan akun Peserta Uji Coba."
        );
        return;
      }

      const listResponse = await fetch(
        "/api/mentor/registrations",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      if (listResponse.status !== 403) {
        if (listResponse.status === 200) {
          setApiTest(
            "GAGAL: API daftar Mentor mengizinkan akses peserta (HTTP 200)."
          );
        } else {
          setApiTest(
            `BELUM TERVERIFIKASI: API daftar Mentor mengembalikan HTTP ${listResponse.status}.`
          );
        }
        return;
      }

      const decisionResponse = await fetch(
        "/api/mentor/registrations/decision",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
          cache: "no-store",
        }
      );

      if (decisionResponse.status === 403) {
        setApiTest(
          "LULUS: API daftar Mentor dan API keputusan Mentor sama-sama menolak akses peserta (HTTP 403)."
        );
      } else if (decisionResponse.status === 200) {
        setApiTest(
          "GAGAL: API keputusan Mentor mengembalikan HTTP 200. Hentikan pengujian dan periksa server."
        );
      } else if (decisionResponse.status === 400) {
        setApiTest(
          "BELUM LULUS: API keputusan Mentor mengembalikan HTTP 400. Periksa urutan validasi server."
        );
      } else if (decisionResponse.status === 401) {
        setApiTest(
          "BELUM LULUS: API keputusan Mentor mengembalikan HTTP 401. Sesi perlu diperiksa."
        );
      } else {
        setApiTest(
          `BELUM TERVERIFIKASI: API keputusan Mentor mengembalikan HTTP ${decisionResponse.status}.`
        );
      }
    } catch {
      setApiTest(
        "BELUM TERVERIFIKASI: Tidak dapat menghubungi API."
      );
    } finally {
      setTestingApi(false);
    }
  }

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) {
        setError("Gagal keluar. Silakan coba kembali.");
        setLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Gagal keluar. Silakan coba kembali.");
      setLoggingOut(false);
    }
  }

  const status = statusInfo(access);

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
          background: `linear-gradient(90deg, ${C.gold}, #f3df9d, ${C.gold})`,
        }}
      />

      <header
        style={{
          background: C.green,
          color: C.white,
          padding: "24px 18px 30px",
          borderRadius: "0 0 26px 26px",
          boxShadow: "0 8px 24px rgba(21,60,46,0.15)",
        }}
      >
        <div style={{ maxWidth: 850, margin: "auto" }}>
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
                  letterSpacing: 0.3,
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
              PESERTA
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
            Pantau Perjalanan OJT Anda
          </h1>

          <p
            style={{
              color: "#d7e4dc",
              fontSize: 13,
              lineHeight: 1.7,
              margin: 0,
              maxWidth: 500,
            }}
          >
            Satu tempat untuk melihat status program,
            perkembangan, dan evaluasi OJT.
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
        {loading && (
          <section style={card} role="status">
            <div
              style={{
                color: C.green,
                fontWeight: 800,
                marginBottom: 6,
              }}
            >
              Memuat dashboard...
            </div>
            <div style={{ color: C.muted, fontSize: 13 }}>
              Memeriksa akun dan status persetujuan Mentor.
            </div>
          </section>
        )}

        {error && (
          <section
            style={{
              ...card,
              background: C.redBg,
              borderColor: "#f1c4bf",
            }}
            role="alert"
          >
            <h2 style={{ color: C.red, fontSize: 17 }}>
              Perlu Perhatian
            </h2>
            <p style={{ lineHeight: 1.6 }}>{error}</p>
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

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={labelStyle}>
                    SELAMAT DATANG
                  </div>
                  <h2
                    style={{
                      color: C.green,
                      fontSize: 19,
                      fontWeight: 850,
                      margin: 0,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {profile.full_name || "Peserta OJT"}
                  </h2>
                  <div
                    style={{
                      color: C.muted,
                      fontSize: 13,
                      marginTop: 5,
                    }}
                  >
                    {profile.department || "Departemen belum diisi"}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  padding: 12,
                  borderRadius: 12,
                  background: status.bg,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: C.white,
                    borderRadius: 50,
                    color: status.color,
                    fontWeight: 900,
                  }}
                >
                  {status.icon}
                </span>

                <span
                  style={{
                    color: status.color,
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {status.label}
                </span>
              </div>
            </section>

            {access === "pending" && (
              <section
                style={{
                  ...card,
                  background: C.yellowBg,
                  borderColor: "#ead8a5",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: C.yellow,
                    fontWeight: 800,
                    letterSpacing: 1,
                  }}
                >
                  STATUS PENDAFTARAN
                </div>
                <h2 style={sectionTitle}>
                  Menunggu Persetujuan Mentor
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    marginBottom: 0,
                  }}
                >
                  Pendaftaran Anda sedang diperiksa oleh
                  Mentor. Monitoring OJT tersedia setelah
                  pendaftaran disetujui dan program aktif.
                </p>
              </section>
            )}

            {access === "rejected" && (
              <section
                style={{
                  ...card,
                  background: C.redBg,
                  borderColor: "#f1c4bf",
                }}
              >
                <h2 style={{ color: C.red, fontSize: 18 }}>
                  Pendaftaran Belum Disetujui
                </h2>
                <p style={{ fontSize: 14, lineHeight: 1.7 }}>
                  Pengajuan Anda belum disetujui Mentor.
                </p>
                {registration?.rejection_reason && (
                  <div
                    style={{
                      background: C.white,
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    <strong>Catatan Mentor:</strong>
                    <div>{registration.rejection_reason}</div>
                  </div>
                )}
              </section>
            )}

            {access === "no_program" && (
              <section style={card}>
                <div
                  style={{
                    color: C.gold,
                    fontSize: 12,
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  INFORMASI PROGRAM
                </div>
                <h2 style={sectionTitle}>
                  Program OJT Belum Aktif
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.8,
                    marginBottom: 0,
                  }}
                >
                  Belum ada program OJT aktif yang dapat
                  diakses. Hubungi Mentor untuk memastikan
                  status pendaftaran dan program Anda.
                </p>
              </section>
            )}

            {access === "approved" && program && (
              <>
                <section style={card}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        background: C.goldLight,
                        color: C.green,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 21,
                      }}
                    >
                      ◈
                    </div>

                    <div>
                      <h2
                        style={{
                          ...sectionTitle,
                          marginBottom: 4,
                        }}
                      >
                        Informasi Program OJT
                      </h2>
                      <div
                        style={{
                          color: C.muted,
                          fontSize: 12,
                        }}
                      >
                        Detail program aktif Anda
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        padding: 14,
                        borderRadius: 13,
                        background: "#f3f6f3",
                      }}
                    >
                      <div style={labelStyle}>SITE</div>
                      <div
                        style={{
                          fontSize: 17,
                          color: C.green,
                          fontWeight: 900,
                        }}
                      >
                        {program.site || "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 14,
                        borderRadius: 13,
                        background: "#f3f6f3",
                      }}
                    >
                      <div style={labelStyle}>STATUS</div>
                      <div
                        style={{
                          fontSize: 15,
                          color: C.green3,
                          fontWeight: 800,
                          textTransform: "capitalize",
                        }}
                      >
                        {program.status}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      border: `1px solid ${C.border}`,
                      borderRadius: 13,
                    }}
                  >
                    <div style={labelStyle}>
                      PERIODE OJT
                    </div>
                    <div
                      style={{
                        color: C.text,
                        fontSize: 14,
                        fontWeight: 750,
                        lineHeight: 1.8,
                      }}
                    >
                      {formatDate(program.start_date)}
                      <span style={{ color: C.gold, margin: "0 8px" }}>
                        →
                      </span>
                      {formatDate(program.end_date)}
                    </div>
                  </div>
                </section>

                <section style={card}>
                  <div
                    style={{
                      color: C.gold,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 1.2,
                      marginBottom: 7,
                    }}
                  >
                    MENU MONITORING
                  </div>
                  <h2 style={sectionTitle}>
                    Perkembangan OJT Saya
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: C.muted,
                      lineHeight: 1.7,
                      marginBottom: 16,
                    }}
                  >
                    Pilih menu di bawah untuk membuka
                    informasi perkembangan dan evaluasi OJT.
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
                        router.push(`/analisis/${program.id}`)
                      }
                    />

                    <MenuCard
                      icon="✓"
                      title="Evaluasi Kesiapan"
                      description="Buka evaluasi kesiapan OJT."
                      onClick={() =>
                        router.push(`/evaluasi/${program.id}`)
                      }
                    />

                    <MenuCard
                      icon="▤"
                      title="Laporan OJT"
                      description="Lihat laporan OJT Anda."
                      onClick={() =>
                        router.push(`/laporan/${program.id}`)
                      }
                    />
                  </div>
                </section>

                <section
                  style={{
                    ...card,
                    background: "#f8faf8",
                  }}
                >
                  <div
                    style={{
                      color: C.gold,
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 1.2,
                      marginBottom: 7,
                    }}
                  >
                    PEMERIKSAAN SISTEM
                  </div>
                  <h2 style={sectionTitle}>
                    Pengujian Keamanan API
                  </h2>
                  <p
                    style={{
                      color: C.muted,
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  >
                    Memeriksa apakah akun peserta ditolak
                    oleh API daftar pendaftaran dan keputusan
                    Mentor. Pengujian ini tidak mengirim
                    tindakan persetujuan.
                  </p>

                  <button
                    type="button"
                    style={{
                      ...primaryButton,
                      background: C.green2,
                    }}
                    onClick={testMentorApi}
                    disabled={testingApi}
                  >
                    {testingApi
                      ? "Menguji API..."
                      : "Jalankan Uji Keamanan API"}
                  </button>

                  {apiTest && (
                    <div
                      role="status"
                      style={{
                        marginTop: 14,
                        padding: 13,
                        borderRadius: 12,
                        background: apiTest.startsWith("LULUS")
                          ? "#e8f5eb"
                          : apiTest.startsWith("GAGAL")
                          ? C.redBg
                          : C.yellowBg,
                        color: apiTest.startsWith("LULUS")
                          ? C.green3
                          : apiTest.startsWith("GAGAL")
                          ? C.red
                          : C.yellow,
                        fontSize: 13,
                        fontWeight: 750,
                        lineHeight: 1.7,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {apiTest}
                    </div>
                  )}
                </section>
              </>
            )}

            <button
              type="button"
              style={{
                ...secondaryButton,
                marginBottom: 18,
              }}
              onClick={logout}
              disabled={loggingOut}
            >
              {loggingOut ? "Sedang keluar..." : "Keluar dari Akun"}
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
              <div
                style={{
                  color: C.green,
                  fontWeight: 900,
                  letterSpacing: 1,
                }}
              >
                OJT MINETRACK v2.0
              </div>
              <div>
                Emergency Response Group · PT Berau Coal 2026
              </div>
              <div>Monitoring dan Evaluasi OJT</div>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
