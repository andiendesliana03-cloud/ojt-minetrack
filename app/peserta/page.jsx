
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const card = {
  background: "rgba(255,255,255,0.95)",
  padding: 18,
  borderRadius: 14,
  marginBottom: 14,
  border: "1px solid #e2e8f0",
};

const tombol = {
  padding: "12px 18px",
  border: "none",
  borderRadius: 10,
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: "bold",
  cursor: "pointer",
};

const halaman = {
  minHeight: "100vh",
  padding: 18,
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
  backgroundColor: "#f1f5f9",
  backgroundImage:
    'linear-gradient(rgba(241,245,249,0.75), rgba(241,245,249,0.9)), url("/background-erg.png.PNG")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

export default function DashboardPeserta() {
  const router = useRouter();

  const [profil, setProfil] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aktif = true;

    async function muatData() {
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
          data: dataProfil,
          error: profilError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, role, department"
          )
          .eq("id", user.id)
          .single();

        if (profilError) {
          throw profilError;
        }

        if (dataProfil.role === "mentor") {
          router.replace("/");
          return;
        }

        if (dataProfil.role !== "participant") {
          throw new Error(
            "Akun ini tidak memiliki akses Peserta OJT."
          );
        }

        const {
          data: dataProgram,
          error: programError,
        } = await supabase
          .from("ojt_programs")
          .select(
            "id, start_date, end_date, status, site"
          )
          .eq("participant_id", user.id)
          .eq("status", "active")
          .order("start_date", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

        if (programError) {
          throw programError;
        }

        const {
          data: jenisData,
          error: jenisError,
        } = await supabase
          .from("achievement_types")
          .select("code, name")
          .order("name");

        if (jenisError) {
          throw jenisError;
        }

        let riwayat = [];

        if (dataProgram) {
          const {
            data,
            error: riwayatError,
          } = await supabase
            .from("achievement_records")
            .select(
              "id, type_code, activity_date, description, status"
            )
            .eq("program_id", dataProgram.id)
            .order("activity_date", {
              ascending: false,
            });

          if (riwayatError) {
            throw riwayatError;
          }

          riwayat = data || [];
        }

        if (!aktif) return;

        setProfil(dataProfil);
        setProgram(dataProgram);
        setKategori(jenisData || []);
        setCatatan(riwayat);
      } catch (err) {
        if (aktif) {
          setError(
            err.message || "Gagal memuat data."
          );
        }
      } finally {
        if (aktif) {
          setLoading(false);
        }
      }
    }

    muatData();

    return () => {
      aktif = false;
    };
  }, [router]);

  async function logout() {
    const { error: logoutError } =
      await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  const verified = catatan.filter(
    (item) => item.status === "verified"
  ).length;

  const pending = catatan.filter(
    (item) => item.status === "pending"
  ).length;

  const sitePenempatan =
    program?.site || "Belum ditentukan";

  if (loading) {
    return (
      <main style={halaman}>
        <h2>Monitoring OJT</h2>
        <p>Memuat Dashboard Peserta...</p>
      </main>
    );
  }

  if (!profil) {
    return (
      <main style={halaman}>
        <section style={card}>
          <h2>Dashboard Peserta</h2>

          <p style={{ color: "#b91c1c" }}>
            {error || "Akses tidak tersedia."}
          </p>

          <button
            onClick={logout}
            style={tombol}
          >
            Keluar dan Login Ulang
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={halaman}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            background:
              "rgba(15,23,42,0.95)",
            color: "#ffffff",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h1>Monitoring OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>Dashboard Peserta OJT</small>

          <p style={{ marginTop: 22 }}>
            Selamat datang,{" "}
            <strong>
              {profil.full_name}
            </strong>
          </p>

          <button
            onClick={logout}
            style={{
              ...tombol,
              background: "#dc2626",
              marginTop: 12,
            }}
          >
            Logout
          </button>
        </header>

        {error && (
          <section style={card}>
            <p style={{ color: "#b91c1c" }}>
              {error}
            </p>
          </section>
        )}

        <section style={card}>
          <h2>Informasi Peserta</h2>

          <p>
            Nama:{" "}
            <strong>
              {profil.full_name}
            </strong>
          </p>

          <p>
            Departemen:{" "}
            {profil.department || "-"}
          </p>

          <p>
            Site Penempatan:{" "}
            <strong
              style={{
                color: program?.site
                  ? "#1d4ed8"
                  : "#b45309",
              }}
            >
              {sitePenempatan}
            </strong>
          </p>

          <p>Role: Peserta OJT</p>
        </section>

        {!program ? (
          <section style={card}>
            <h3>Program OJT</h3>

            <p>
              Belum ada program OJT aktif
              yang terhubung dengan akun ini.
            </p>
          </section>
        ) : (
          <>
            <section style={card}>
              <h2>Program OJT Aktif</h2>

              <p>
                Nama Peserta:{" "}
                <strong>
                  {profil.full_name}
                </strong>
              </p>

              <p>
                Site:{" "}
                <strong>
                  {sitePenempatan}
                </strong>
              </p>

              <p>
                Mulai: {program.start_date}
              </p>

              <p>
                Selesai: {program.end_date}
              </p>

              <p>
                Status: {program.status}
              </p>
            </section>

            <h2>Ringkasan Pencapaian</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: 10,
                marginBottom: 20,
              }}
            >
              {[
                ["Total", catatan.length],
                ["Terverifikasi", verified],
                ["Pending", pending],
              ].map(([judul, nilai]) => (
                <div
                  key={judul}
                  style={{
                    ...card,
                    textAlign: "center",
                    padding: 12,
                  }}
                >
                  <small>{judul}</small>
                  <h2>{nilai}</h2>
                </div>
              ))}
            </div>

            <h2>Enam Pencapaian OJT</h2>

            {kategori.map((item) => {
              const daftar = catatan.filter(
                (c) =>
                  c.type_code === item.code
              );

              const selesai = daftar.filter(
                (c) =>
                  c.status === "verified"
              ).length;

              return (
                <section
                  key={item.code}
                  style={card}
                >
                  <h3>{item.name}</h3>

                  <p>
                    Nama: {profil.full_name}
                  </p>

                  <p>
                    Site: {sitePenempatan}
                  </p>

                  <p>
                    Total catatan:{" "}
                    {daftar.length}
                  </p>

                  <p>
                    Terverifikasi: {selesai}
                  </p>

                  <p>
                    Menunggu verifikasi:{" "}
                    {
                      daftar.filter(
                        (c) =>
                          c.status === "pending"
                      ).length
                    }
                  </p>
                </section>
              );
            })}

            <h2>Riwayat Pencapaian</h2>

            {catatan.length === 0 && (
              <section style={card}>
                Belum ada pencapaian
                yang tercatat.
              </section>
            )}

            {catatan.map((item) => (
              <section
                key={item.id}
                style={card}
              >
                <h3>
                  {kategori.find(
                    (k) =>
                      k.code ===
                      item.type_code
                  )?.name ||
                    item.type_code}
                </h3>

                <p>
                  Nama:{" "}
                  {profil.full_name}
                </p>

                <p>
                  Site: {sitePenempatan}
                </p>

                <p>
                  Tanggal:{" "}
                  {item.activity_date}
                </p>

                <p>
                  {item.description}
                </p>

                <p>
                  Status:{" "}
                  <strong>
                    {item.status ===
                    "verified"
                      ? "Terverifikasi"
                      : item.status ===
                        "pending"
                      ? "Menunggu Verifikasi"
                      : item.status}
                  </strong>
                </p>
              </section>
            ))}
          </>
        )}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#475569",
          }}
        >
          Monitoring OJT —
          Emergency Response Group

          <p>PT Berau Coal 2026</p>
        </footer>
      </div>
    </main>
  );
}
