
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const ALLOWED_SITES = [
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

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [nama, setNama] = useState("");
  const [site, setSite] = useState("");
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  useEffect(() => {
    let aktif = true;

    async function periksaPengajuan() {
      try {
        setLoading(true);
        setError("");
        setPesan("");

        // Menangani kode yang dikirim setelah verifikasi email.
        const params = new URLSearchParams(
          window.location.search
        );
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw new Error(
              "Verifikasi email belum berhasil diproses. Silakan buka tautan verifikasi terbaru dari email Anda."
            );
          }

          // Hapus kode dari alamat setelah diproses.
          window.history.replaceState(
            {},
            "",
            window.location.pathname
          );
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/login");
          return;
        }

        const metadata = user.user_metadata || {};
        const namaAwal =
          metadata.full_name ||
          metadata.name ||
          user.email ||
          "Peserta OJT";

        const siteAwal =
          typeof metadata.site === "string"
            ? metadata.site.trim().toUpperCase()
            : "";

        if (!aktif) return;

        setNama(namaAwal);
        setSite(
          ALLOWED_SITES.includes(siteAwal)
            ? siteAwal
            : ""
        );

        // Periksa apakah pengajuan sudah tersimpan.
        const {
          data: pengajuan,
          error: pengajuanError,
        } = await supabase
          .from("participant_registrations")
          .select(
            "full_name, status, rejection_reason, created_at, site"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (pengajuanError) throw pengajuanError;

        if (!aktif) return;

        if (pengajuan) {
          setNama(pengajuan.full_name || namaAwal);
          setSite(pengajuan.site || siteAwal);
          setStatus(pengajuan.status);
          setAlasan(pengajuan.rejection_reason || "");
          return;
        }

        // Belum ada pengajuan tersimpan.
        setStatus("not_submitted");

        if (!user.email_confirmed_at) {
          setPesan(
            "Silakan verifikasi email terlebih dahulu. Setelah itu, masuk kembali untuk melanjutkan proses pengajuan."
          );
          return;
        }

        if (!ALLOWED_SITES.includes(siteAwal)) {
          setPesan(
            "Site belum ditemukan pada data pendaftaran. Formulir perlu diperiksa sebelum pengajuan dapat diproses."
          );
          return;
        }

        // Memeriksa alur API tanpa menganggap simulasi
        // sebagai pengajuan yang benar-benar tersimpan.
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (!session?.access_token) {
          setPesan(
            "Sesi login tidak tersedia. Silakan login kembali."
          );
          return;
        }

        const response = await fetch(
          "/api/participant/registration",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              full_name: namaAwal,
              site: siteAwal,
            }),
          }
        );

        const hasil = await response.json();

        if (!response.ok) {
          setPesan(
            hasil.error ||
              "Pengajuan belum dapat diproses."
          );
          return;
        }

        if (hasil.dry_run === true) {
          setPesan(
            "Pemeriksaan simulasi berhasil. Pengajuan belum disimpan ke database dan belum dikirim untuk persetujuan Mentor."
          );
          return;
        }

        if (hasil.success && hasil.status) {
          setStatus(hasil.status);
          setPesan(
            hasil.message ||
              "Status pengajuan berhasil diperbarui."
          );

          // Ambil ulang data tersimpan untuk memastikan
          // status dan Site berasal dari database.
          const { data: dataTerbaru, error: refreshError } =
            await supabase
              .from("participant_registrations")
              .select(
                "full_name, status, rejection_reason, site"
              )
              .eq("user_id", user.id)
              .maybeSingle();

          if (refreshError) throw refreshError;

          if (dataTerbaru && aktif) {
            setNama(dataTerbaru.full_name || namaAwal);
            setSite(dataTerbaru.site || siteAwal);
            setStatus(dataTerbaru.status);
            setAlasan(
              dataTerbaru.rejection_reason || ""
            );
          }
        }
      } catch (err) {
        if (aktif) {
          setError(
            err.message ||
              "Gagal memuat status pengajuan."
          );
        }
      } finally {
        if (aktif) setLoading(false);
      }
    }

    periksaPengajuan();

    return () => {
      aktif = false;
    };
  }, [router]);

  async function kembaliLogin() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const warnaStatus = {
    pending: {
      warna: "#92400e",
      latar: "#fef3c7",
      judul: "Menunggu Persetujuan Mentor",
    },
    approved: {
      warna: "#166534",
      latar: "#dcfce7",
      judul: "Pengajuan Disetujui",
    },
    rejected: {
      warna: "#991b1b",
      latar: "#fee2e2",
      judul: "Pengajuan Ditolak",
    },
    not_submitted: {
      warna: "#334155",
      latar: "#e2e8f0",
      judul: "Pengajuan Belum Tersimpan",
    },
  };

  const tampilanStatus = warnaStatus[status];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 16px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#dbeafe",
        position: "relative",
        isolation: "isolate",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          backgroundColor: "#334155",
          backgroundImage: 'url("/background-erg.png.PNG")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          background: "rgba(15,23,42,0.62)",
        }}
      />

      <section
        style={{
          width: "100%",
          maxWidth: 440,
          padding: 24,
          boxSizing: "border-box",
          borderRadius: 20,
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 16px 50px rgba(0,0,0,0.25)",
        }}
      >
        <header
          style={{
            textAlign: "center",
            color: "#ffffff",
            background: "#0f172a",
            borderRadius: 14,
            padding: "24px 16px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              letterSpacing: 3,
              marginBottom: 12,
            }}
          >
            ERG
          </div>

          <h1
            style={{
              fontSize: 23,
              margin: "0 0 10px",
            }}
          >
            Pengajuan Peserta OJT
          </h1>

          <p
            style={{
              fontSize: 13,
              color: "#cbd5e1",
              margin: 0,
            }}
          >
            PT Berau Coal 2026
          </p>
        </header>

        {loading ? (
          <div
            style={{
              textAlign: "center",
              padding: 24,
              color: "#475569",
            }}
          >
            Memeriksa verifikasi email dan status pengajuan...
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{
              padding: 16,
              borderRadius: 12,
              background: "#fee2e2",
              color: "#991b1b",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <strong>Gagal memuat data</strong>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <p
              style={{
                color: "#475569",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Peserta
            </p>

            <p
              style={{
                color: "#0f172a",
                fontWeight: "bold",
                fontSize: 17,
                overflowWrap: "anywhere",
                marginTop: 0,
              }}
            >
              {nama}
            </p>

            <p
              style={{
                color: "#475569",
                fontSize: 14,
                marginBottom: 8,
              }}
            >
              Site pilihan
            </p>

            <p
              style={{
                color: "#0f172a",
                fontWeight: "bold",
                fontSize: 16,
                marginTop: 0,
              }}
            >
              {site || "Belum tersedia"}
            </p>

            {tampilanStatus && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: tampilanStatus.latar,
                  color: tampilanStatus.warna,
                  marginTop: 20,
                  marginBottom: 20,
                }}
              >
                <strong>{tampilanStatus.judul}</strong>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 0,
                  }}
                >
                  {status === "pending" &&
                    "Pengajuan tersimpan dan sedang menunggu pemeriksaan Mentor."}

                  {status === "approved" &&
                    "Pengajuan telah disetujui Mentor. Akses monitoring mengikuti program OJT yang telah ditetapkan."}

                  {status === "rejected" &&
                    "Pengajuan belum disetujui Mentor."}

                  {status === "not_submitted" &&
                    "Belum ada pengajuan yang tersimpan di database."}
                </p>
              </div>
            )}

            {pesan && (
              <div
                role="status"
                style={{
                  padding: 14,
                  border: "1px solid #cbd5e1",
                  borderRadius: 10,
                  marginBottom: 20,
                  color: "#334155",
                  background: "#f8fafc",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                {pesan}
              </div>
            )}

            {status === "rejected" && alasan && (
              <div
                style={{
                  padding: 14,
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  marginBottom: 20,
                  color: "#7f1d1d",
                  fontSize: 14,
                  lineHeight: 1.6,
                }}
              >
                <strong>Keterangan Mentor</strong>
                <p style={{ marginBottom: 0 }}>{alasan}</p>
              </div>
            )}

            {status === "not_submitted" && (
              <button
                type="button"
                onClick={() => router.push("/daftar")}
                style={{
                  width: "100%",
                  padding: 14,
                  border: "none",
                  borderRadius: 10,
                  background: "#2563eb",
                  color: "#ffffff",
                  fontSize: 15,
                  fontWeight: "bold",
                  cursor: "pointer",
                  marginBottom: 12,
                }}
              >
                Ke Halaman Pendaftaran
              </button>
            )}

            <button
              type="button"
              onClick={kembaliLogin}
              style={{
                width: "100%",
                padding: 14,
                border: "none",
                borderRadius: 10,
                background: "#0f172a",
                color: "#ffffff",
                fontSize: 15,
                fontWeight: "bold",
                cursor: "pointer",
                marginTop: 8,
              }}
            >
              Kembali ke Login
            </button>
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            fontSize: 12,
            marginTop: 28,
          }}
        >
          Sistem Monitoring dan Evaluasi OJT
          <p>© 2026 PT Berau Coal</p>
        </footer>
      </section>
    </main>
  );
}
