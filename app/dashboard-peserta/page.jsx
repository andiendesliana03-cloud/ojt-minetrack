
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

function formatDate(value) {
  if (!value) return "-";

  const parts = String(value).slice(0, 10).split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

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

function MenuCard({
  icon,
  title,
  description,
  onClick,
}) {
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
      <span
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
        <strong
          style={{
            display: "block",
            marginBottom: 5,
            fontSize: 14,
          }}
        >
          {title}
        </strong>

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
        style={{
          color: C.green3,
          fontSize: 20,
        }}
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
  const [registration, setRegistration] =
    useState(null);

  const [access, setAccess] = useState("loading");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

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
        data: currentProfile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id,full_name,department,role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!currentProfile) {
        throw new Error(
          "Profil peserta tidak tersedia."
        );
      }

      if (currentProfile.role === "mentor") {
        router.replace("/");
        return;
      }

      if (
        currentProfile.role !== "participant" &&
        currentProfile.role !== "peserta"
      ) {
        throw new Error(
          "Akun tidak memiliki akses peserta."
        );
      }

      // 1. Baca seluruh pengajuan sistem baru.
      // Ini adalah jalur utama pendaftaran
      // otomatis OJT MineTrack v2.0.
      const {
        data: newRequests,
        error: newError,
      } = await supabase
        .from("ojt_registration_requests")
        .select(`
          id,
          status,
          rejection_reason,
          site,
          start_date,
          end_date,
          created_at
        `)
        .eq("participant_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (newError) throw newError;

      // 2. Baca pendaftaran sistem lama.
      // Dipertahankan agar peserta lama
      // tidak kehilangan akses.
      const {
        data: oldRequests,
        error: oldError,
      } = await supabase
        .from("participant_registrations")
        .select(`
          id,
          status,
          rejection_reason,
          site,
          created_at
        `)
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(1);

      if (oldError) throw oldError;

      // 3. Baca program aktif peserta.
      // RLS can_view_ojt_program tetap
      // membatasi akses dari database.
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
        .eq("participant_id", user.id)
        .eq("status", "active")
        .order("start_date", {
          ascending: false,
        })
        .limit(1);

      if (programError) throw programError;

      const newList = newRequests || [];
      const oldRegistration = oldRequests?.[0] || null;
      const activeProgram = activePrograms?.[0] || null;

      // Pengajuan baru harus diprioritaskan.
      // Jika tidak ada, gunakan riwayat lama.
      const latestRegistration =
        newList[0] || oldRegistration;

      const hasPendingNew = newList.some(
        (item) => item.status === "pending"
      );

      const hasApprovedNew = newList.some(
        (item) => item.status === "approved"
      );

      const hasApprovedOld =
        oldRegistration?.status === "approved";

      const hasPendingOld =
        oldRegistration?.status === "pending";

      // Akses monitoring membutuhkan
      // program aktif + persetujuan sah.
      // Untuk data lama, legacy_access
      // tetap didukung.
      const approvedProgram =
        !!activeProgram &&
        (
          hasApprovedNew ||
          hasApprovedOld ||
          activeProgram.legacy_access === true
        ) &&
        !hasPendingNew &&
        !hasPendingOld;

      let nextAccess = "no_program";

      if (hasPendingNew || hasPendingOld) {
        nextAccess = "pending";
      } else if (approvedProgram) {
        nextAccess = "approved";
      } else if (
        latestRegistration?.status === "rejected"
      ) {
        nextAccess = "rejected";
      }

      // Jangan menyimpan program untuk
      // ditampilkan jika belum diizinkan.
      setProgram(
        nextAccess === "approved"
          ? activeProgram
          : null
      );

      setProfile(currentProfile);
      setRegistration(latestRegistration || null);
      setAccess(nextAccess);
    } catch (err) {
      setError(
        err.message ||
          "Gagal memuat dashboard peserta."
      );

      setAccess("error");
      setProgram(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
    // Pemeriksaan dijalankan saat halaman dibuka.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error: logoutError } =
        await supabase.auth.signOut();

      if (logoutError) {
        throw logoutError;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError(
        "Gagal keluar. Silakan coba kembali."
      );

      setLoggingOut(false);
    }
  }

  const status = getStatusInfo(access);

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
        {loading && (
          <section style={card}>
            <strong>
              Memeriksa akun dan status OJT...
            </strong>
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
                    SELAMAT DATANG
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
                <span
                  style={{
                    fontSize: 20,
                  }}
                >
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
                  {formatDate(
                    registration?.start_date
                  )}
                  {" s.d. "}
                  {formatDate(
                    registration?.end_date
                  )}
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
                  <strong>Alasan Penolakan:</strong>

                  <p style={{ lineHeight: 1.7 }}>
                    {registration?.rejection_reason ||
                      "Alasan belum tersedia."}
                  </p>
                </div>

                <button
                  type="button"
                  style={primaryButton}
                  onClick={() =>
                    router.push(
                      "/pengajuan-peserta"
                    )
                  }
                >
                  Lihat dan Perbaiki Pengajuan
                </button>
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
                        style={{
                          color: C.green3,
                        }}
                      >
                        Aktif
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      padding: 14,
                      border:
                        `1px solid ${C.border}`,
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
                        router.push(
                          `/analisis/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="✓"
                      title="Evaluasi Kesiapan"
                      description="Buka evaluasi kesiapan OJT."
                      onClick={() =>
                        router.push(
                          `/evaluasi/${program.id}`
                        )
                      }
                    />

                    <MenuCard
                      icon="▤"
                      title="Laporan OJT"
                      description="Lihat laporan OJT Anda."
                      onClick={() =>
                        router.push(
                          `/laporan/${program.id}`
                        )
                      }
                    />
                  </div>
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
              onClick={() =>
                loadDashboard(true)
              }
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
