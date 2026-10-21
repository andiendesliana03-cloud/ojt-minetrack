
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function PengajuanPesertaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [nama, setNama] = useState("");
  const [alasan, setAlasan] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    async function periksaPengajuan() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/login");
          return;
        }

        setNama(
          user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email ||
            "Peserta OJT"
        );

        const {
          data: pengajuan,
          error: pengajuanError,
        } = await supabase
          .from("participant_registrations")
          .select(
            "full_name, status, rejection_reason, created_at"
          )
          .eq("user_id", user.id)
          .maybeSingle();

        if (pengajuanError) {
          throw pengajuanError;
        }

        if (!aktif) return;

        if (pengajuan) {
          setNama(
            pengajuan.full_name ||
              user.email ||
              "Peserta OJT"
          );

          setStatus(pengajuan.status);
          setAlasan(
            pengajuan.rejection_reason || ""
          );
        } else {
          setStatus("not_submitted");
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
      judul: "Pengajuan Belum Ditemukan",
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
      {/* Background ERG */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          backgroundColor: "#334155",
          backgroundImage:
            'url("/background-erg.png.PNG")',
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
          background:
            "rgba(15,23,42,0.62)",
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
          boxShadow:
            "0 16px 50px rgba(0,0,0,0.25)",
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
            Memeriksa status pengajuan...
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
            Pastikan akun sudah login dan
            kebijakan akses Supabase sudah benar.
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
                <strong>
                  {tampilanStatus.judul}
                </strong>

                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    marginBottom: 0,
                  }}
                >
                  {status === "pending" &&
                    "Pengajuan Anda sedang menunggu pemeriksaan mentor. Akses monitoring akan mengikuti status persetujuan."}

                  {status === "approved" &&
                    "Pengajuan Anda telah disetujui. Silakan kembali ke halaman login untuk melanjutkan."}

                  {status === "rejected" &&
                    "Pengajuan Anda belum disetujui mentor."}

                  {status === "not_submitted" &&
                    "Belum ditemukan pengajuan untuk akun ini. Silakan periksa proses pendaftaran Anda."}
                </p>
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
                <strong>Keterangan mentor</strong>
                <p style={{ marginBottom: 0 }}>
                  {alasan}
                </p>
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
