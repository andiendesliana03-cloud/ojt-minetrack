
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

const kategori = [
  "Fisik",
  "Training",
  "Sosialisasi",
  "Coaching",
  "Orientasi Area",
  "Hazard",
];

const card = {
  background: "rgba(255,255,255,0.94)",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
};

const tombol = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: "bold",
};

const halaman = {
  minHeight: "100vh",
  backgroundImage:
    'linear-gradient(rgba(241,245,249,0.82), rgba(241,245,249,0.93)), url("/background-erg.png")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
  backgroundRepeat: "no-repeat",
  padding: 18,
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
};

export default function Home() {
  const router = useRouter();

  const [mentor, setMentor] = useState(null);
  const [memeriksaLogin, setMemeriksaLogin] = useState(true);
  const [peserta, setPeserta] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    async function periksaLogin() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role, department")
            .eq("id", user.id)
            .single();

        if (profilError) throw profilError;

        if (!profil || profil.role !== "mentor") {
          if (aktif) {
            setError(
              "Akun ini bukan Mentor. Dashboard Mentor tidak dapat diakses."
            );
            setMemeriksaLogin(false);
          }
          return;
        }

        if (aktif) {
          setMentor(profil);
          setMemeriksaLogin(false);
        }
      } catch (err) {
        if (aktif) {
          setError(err.message || "Gagal memeriksa akun.");
          setMemeriksaLogin(false);
        }
      }
    }

    periksaLogin();

    return () => {
      aktif = false;
    };
  }, [router]);

  async function ambilPeserta() {
    setLoading(true);
    setError("");

    try {
      const { data, error: queryError } =
        await supabase
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
          .order("start_date", {
            ascending: false,
          });

      if (queryError) throw queryError;

      setPeserta(data || []);
    } catch (err) {
      setError(
        err.message || "Gagal mengambil data peserta."
      );
      setPeserta([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mentor) {
      ambilPeserta();
    }
  }, [mentor]);

  async function keluar() {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  if (memeriksaLogin) {
    return (
      <main style={halaman}>
        <h2>Monitoring OJT</h2>
        <p>Memeriksa sesi login...</p>
      </main>
    );
  }

  if (!mentor) {
    return (
      <main style={halaman}>
        <div
          style={{
            maxWidth: 500,
            margin: "60px auto",
          }}
        >
          <div style={card}>
            <h2>Akses Dashboard Mentor</h2>

            <p style={{ color: "#b91c1c" }}>
              {error || "Akses tidak diizinkan."}
            </p>

            <button
              type="button"
              onClick={keluar}
              style={tombol}
            >
              Keluar dan Login Ulang
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={halaman}>
      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            background: "rgba(15,23,42,0.94)",
            color: "#ffffff",
            borderRadius: 16,
            padding: 24,
            marginBottom: 24,
            border:
              "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <h1
            style={{
              fontSize: 30,
              marginBottom: 12,
            }}
          >
            Monitoring OJT
          </h1>

          <p
            style={{
              fontSize: 18,
              marginBottom: 10,
            }}
          >
            Emergency Response Group
          </p>

          <small>
            PT Berau Coal 2026 — Dashboard Mentor
          </small>

          <div style={{ marginTop: 20 }}>
            <p>
              Login sebagai:{" "}
              <strong>
                {mentor.full_name}
              </strong>
            </p>

            <small>
              Departemen:{" "}
              {mentor.department || "-"}
            </small>
          </div>

          <button
            type="button"
            onClick={keluar}
            style={{
              ...tombol,
              background: "#dc2626",
              marginTop: 18,
            }}
          >
            Logout
          </button>
        </header>

        <h2>Ringkasan Monitoring</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2, minmax(0, 1fr))",
            gap: 12,
            marginBottom: 26,
          }}
        >
          {[
            [
              "Peserta Aktif",
              loading ? "..." : peserta.length,
            ],
            ["Pencapaian OJT", "6 Kategori"],
            ["Post-Test", "Selasa & Kamis"],
            ["Praktik", "Mingguan"],
            ["Samapta", "Monitoring"],
            ["SIMPER", "Monitoring"],
          ].map(([judul, nilai]) => (
            <div key={judul} style={card}>
              <p
                style={{
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                {judul}
              </p>

              <strong>{nilai}</strong>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2>
            Daftar Peserta OJT Aktif
          </h2>

          <button
            type="button"
            onClick={ambilPeserta}
            disabled={loading}
            style={{
              ...tombol,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading
              ? "Memuat..."
              : "Refresh Data"}
          </button>
        </div>

        {loading && (
          <p>Memuat data peserta...</p>
        )}

        {error && (
          <p style={{ color: "#b91c1c" }}>
            Gagal mengambil data: {error}
          </p>
        )}

        {!loading &&
          !error &&
          peserta.length === 0 && (
            <div style={card}>
              Belum ada peserta yang dapat
              ditampilkan.
            </div>
          )}

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {peserta.map((item) => (
            <div
              key={item.id}
              style={card}
            >
              <h3>
                {item.peserta?.full_name ||
                  "Peserta OJT"}
              </h3>

              <p>
                Departemen:{" "}
                {item.peserta?.department ||
                  "-"}
              </p>

              <p>
                Mulai: {item.start_date}
              </p>

              <p>
                Selesai: {item.end_date}
              </p>

              <p>
                Status: {item.status}
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/peserta/${item.id}`
                  )
                }
                style={{
                  ...tombol,
                  width: "100%",
                  marginTop: 12,
                }}
              >
                Lihat Detail Peserta
              </button>
            </div>
          ))}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Enam Pencapaian OJT
        </h2>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {kategori.map(
            (nama, index) => (
              <div
                key={nama}
                style={card}
              >
                <small>
                  Pencapaian {index + 1}
                </small>

                <h3>{nama}</h3>

                <p>
                  Monitoring pencapaian
                  peserta
                </p>
              </div>
            )
          )}
        </div>

        <h2 style={{ marginTop: 28 }}>
          Monitoring Penilaian
        </h2>

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >
          {[
            [
              "Post-Test Teori",
              "Setiap Selasa dan Kamis",
            ],
            [
              "Praktik Mingguan",
              "Evaluasi setiap minggu",
            ],
            [
              "Samapta",
              "Monitoring selama OJT",
            ],
            [
              "SIMPER",
              "Monitoring proses dan kelulusan",
            ],
          ].map(
            ([nama, keterangan]) => (
              <div
                key={nama}
                style={card}
              >
                <h3>{nama}</h3>

                <p>{keterangan}</p>

                <small>
                  Data penilaian belum
                  ditampilkan
                </small>
              </div>
            )
          )}
        </div>

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
            fontWeight: 600,
          }}
        >
          Monitoring OJT — Emergency Response
          Group — PT Berau Coal 2026
        </footer>
      </div>
    </main>
  );
}
