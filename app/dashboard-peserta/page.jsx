
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const card = {
  background: "#ffffff",
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  marginBottom: 16,
};

const button = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "14px 16px",
  fontWeight: 700,
  width: "100%",
  cursor: "pointer",
  marginBottom: 10,
};

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
        } else if (latestRegistration?.status === "rejected") {
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

      // Verifikasi role terlebih dahulu.
      const {
        data: currentProfile,
        error: currentProfileError,
      } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (
        currentProfileError ||
        !currentProfile ||
        currentProfile.role !== "participant"
      ) {
        setApiTest(
          "PENGUJIAN DIHENTIKAN: Login dengan akun Peserta Uji Coba."
        );
        return;
      }

      // Kirim sesi peserta ke API mentor.
      const response = await fetch(
        "/api/mentor/registrations",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      if (response.status === 403) {
        setApiTest(
          "LULUS: API menolak akses peserta (HTTP 403)."
        );
      } else if (response.status === 200) {
        setApiTest(
          "GAGAL: API mengizinkan akses peserta (HTTP 200). Hentikan pengujian dan periksa server."
        );
      } else if (response.status === 401) {
        setApiTest(
          "BELUM LULUS: API mengembalikan HTTP 401. Sesi perlu diperiksa."
        );
      } else {
        setApiTest(
          `BELUM TERVERIFIKASI: API mengembalikan HTTP ${response.status}.`
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
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        padding: 18,
        fontFamily: "Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div
        style={{
          maxWidth: 800,
          margin: "auto",
        }}
      >
        <header
          style={{
            ...card,
            background: "#0f172a",
            color: "#ffffff",
          }}
        >
          <h1>Dashboard Peserta OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
        </header>

        {loading && (
          <section style={card}>
            Memeriksa status persetujuan mentor...
          </section>
        )}

        {error && (
          <section style={card}>
            <h3 style={{ color: "#dc2626" }}>
              Gagal Memuat Data
            </h3>
            <p>{error}</p>
          </section>
        )}

        {!loading && profile && (
          <>
            <section style={card}>
              <h2>
                {profile.full_name || "Peserta OJT"}
              </h2>

              <p>
                Departemen: {profile.department || "-"}
              </p>

              <p>
                Status Akses:{" "}
                <strong>
                  {access === "pending"
                    ? "Menunggu Persetujuan"
                    : access === "rejected"
                    ? "Pendaftaran Ditolak"
                    : access === "approved"
                    ? "Disetujui"
                    : "Belum Aktif"}
                </strong>
              </p>
            </section>

            {access === "pending" && (
              <section
                style={{
                  ...card,
                  background: "#fffbeb",
                  borderColor: "#fcd34d",
                }}
              >
                <h2>⏳ Menunggu Persetujuan Mentor</h2>
                <p>
                  Pendaftaran Anda telah tercatat dan
                  sedang menunggu pemeriksaan mentor.
                </p>
                <p>
                  Dashboard monitoring OJT akan tersedia
                  setelah mentor menyetujui pendaftaran
                  dan mengaktifkan program Anda.
                </p>
              </section>
            )}

            {access === "rejected" && (
              <section
                style={{
                  ...card,
                  background: "#fef2f2",
                  borderColor: "#fecaca",
                }}
              >
                <h2>❌ Pendaftaran Ditolak</h2>
                <p>
                  Pengajuan pendaftaran Anda belum
                  disetujui mentor.
                </p>

                {registration?.rejection_reason && (
                  <p>
                    Alasan: {registration.rejection_reason}
                  </p>
                )}
              </section>
            )}

            {access === "no_program" && (
              <section style={card}>
                <h2>Program OJT Belum Aktif</h2>
                <p>
                  Belum ada program OJT aktif yang dapat
                  diakses.
                </p>
                <p>
                  Jika pendaftaran sudah disetujui,
                  silakan hubungi mentor untuk memastikan
                  program telah dibuat.
                </p>
              </section>
            )}

            {access === "approved" && program && (
              <>
                <section style={card}>
                  <h2>Informasi Program OJT</h2>
                  <p>Site: {program.site || "-"}</p>
                  <p>Status: {program.status}</p>
                  <p>
                    Periode: {program.start_date}
                    {" sampai "}
                    {program.end_date}
                  </p>
                </section>

                <section style={card}>
                  <h2>Pengujian Keamanan API</h2>
                  <p>
                    Pengujian ini memeriksa apakah akun
                    peserta ditolak oleh API khusus mentor.
                  </p>

                  <button
                    type="button"
                    style={{
                      ...button,
                      background: "#7c3aed",
                    }}
                    onClick={testMentorApi}
                    disabled={testingApi}
                  >
                    {testingApi
                      ? "Menguji API..."
                      : "Uji Akses API Mentor"}
                  </button>

                  {apiTest && (
                    <p
                      role="status"
                      style={{
                        fontWeight: 700,
                        overflowWrap: "anywhere",
                        color: apiTest.startsWith("LULUS")
                          ? "#15803d"
                          : "#b91c1c",
                      }}
                    >
                      {apiTest}
                    </p>
                  )}
                </section>

                <section style={card}>
                  <h2>Monitoring Saya</h2>
                  <p>
                    Pilih menu untuk melihat perkembangan
                    OJT Anda.
                  </p>

                  <button
                    style={button}
                    onClick={() =>
                      router.push(`/analisis/${program.id}`)
                    }
                  >
                    📊 Grafik Perkembangan OJT
                  </button>

                  <button
                    style={{
                      ...button,
                      background: "#16a34a",
                    }}
                    onClick={() =>
                      router.push(`/evaluasi/${program.id}`)
                    }
                  >
                    ✓ Evaluasi Kesiapan OJT
                  </button>

                  <button
                    style={{
                      ...button,
                      background: "#7c3aed",
                    }}
                    onClick={() =>
                      router.push(`/laporan/${program.id}`)
                    }
                  >
                    📄 Laporan OJT Saya
                  </button>
                </section>
              </>
            )}

            <button
              style={{
                ...button,
                background: "#475569",
              }}
              onClick={logout}
            >
              Keluar
            </button>
          </>
        )}
      </div>
    </main>
  );
}
