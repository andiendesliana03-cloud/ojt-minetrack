
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const tombol = {
  background: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const kategoriNama = {
  Fisik: "Fisik",
  Training: "Training",
  Sosialisasi: "Sosialisasi",
  Coaching: "Coaching",
  "Orientasi Area": "Orientasi Area",
  Hazard: "Hazard",
};

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);

  const [jenis, setJenis] = useState("");
  const [tanggal, setTanggal] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [deskripsi, setDeskripsi] = useState("");

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  async function muatCatatan() {
    const { data, error: err } = await supabase
      .from("achievement_records")
      .select(
        "id, type_code, activity_date, description, status, verified_by, created_at"
      )
      .eq("program_id", programId)
      .order("activity_date", { ascending: false });

    if (err) throw err;
    setCatatan(data || []);
  }

  useEffect(() => {
    if (!programId) return;

    let aktif = true;

    async function mulai() {
      setLoading(true);
      setError("");

      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role")
            .eq("id", auth.user.id)
            .single();

        if (profilError) throw profilError;

        if (profil.role !== "mentor") {
          throw new Error(
            "Halaman input pencapaian hanya untuk Mentor."
          );
        }

        const { data: dataProgram, error: programError } =
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
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const { data: jenisData, error: jenisError } =
          await supabase
            .from("achievement_types")
            .select("*");

        if (jenisError) throw jenisError;

        const daftar = jenisData || [];

        const { data: riwayat, error: riwayatError } =
          await supabase
            .from("achievement_records")
            .select(
              "id, type_code, activity_date, description, status, verified_by, created_at"
            )
            .eq("program_id", programId)
            .order("activity_date", { ascending: false });

        if (riwayatError) throw riwayatError;

        if (!aktif) return;

        setMentor(profil);
        setProgram(dataProgram);
        setKategori(daftar);
        setCatatan(riwayat || []);

        if (daftar.length > 0) {
          setJenis(daftar[0].code);
        }
      } catch (err) {
        if (aktif) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (aktif) setLoading(false);
      }
    }

    mulai();

    return () => {
      aktif = false;
    };
  }, [programId, router]);

  async function simpanPencapaian(e) {
    e.preventDefault();

    if (!mentor || !program) return;

    if (!jenis || !tanggal || !deskripsi.trim()) {
      setError("Semua kolom wajib diisi.");
      return;
    }

    if (deskripsi.trim().length < 10) {
      setError(
        "Keterangan minimal 10 karakter."
      );
      return;
    }

    setMenyimpan(true);
    setError("");
    setPesan("");

    try {
      const { error: simpanError } = await supabase
        .from("achievement_records")
        .insert({
          program_id: programId,
          type_code: jenis,
          activity_date: tanggal,
          description: deskripsi.trim(),
          status: "pending",
          verified_by: null,
        });

      if (simpanError) throw simpanError;

      await muatCatatan();

      setDeskripsi("");
      setPesan(
        "Pencapaian berhasil disimpan. Status: Pending."
      );
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan pencapaian."
      );
    } finally {
      setMenyimpan(false);
    }
  }

  function namaKategori(code) {
    const item = kategori.find(
      (k) => k.code === code
    );

    return (
      item?.name ||
      kategoriNama[code] ||
      code
    );
  }

  const halaman = {
    minHeight: "100vh",
    background: "#f1f5f9",
    padding: 18,
    fontFamily: "Arial, sans-serif",
    color: "#0f172a",
  };

  if (loading) {
    return (
      <main style={halaman}>
        <h2>OJT MineTrack v2.0</h2>
        <p>Memuat data peserta...</p>
      </main>
    );
  }

  if (!mentor || !program) {
    return (
      <main style={halaman}>
        <div style={card}>
          <h2>Data Tidak Dapat Ditampilkan</h2>
          <p style={{ color: "#b91c1c" }}>
            {error}
          </p>
          <button
            style={tombol}
            onClick={() => router.push("/")}
          >
            Kembali
          </button>
        </div>
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
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h1>Detail Peserta OJT</h1>
          <p>OJT MineTrack v2.0</p>
          <small>
            Monitoring dan Input Pencapaian Mentor
          </small>
        </header>

        <button
          style={{
            ...tombol,
            marginBottom: 20,
          }}
          onClick={() => router.push("/")}
        >
          ← Kembali ke Dashboard
        </button>

        <section style={card}>
          <h2>
            {program.peserta?.full_name ||
              "Peserta OJT"}
          </h2>

          <p>
            Departemen:{" "}
            {program.peserta?.department || "-"}
          </p>
          <p>Mulai: {program.start_date}</p>
          <p>Selesai: {program.end_date}</p>
          <p>Status: {program.status}</p>
        </section>

        <section style={card}>
          <h2>Ringkasan Pencapaian</h2>
          <p>Total catatan pencapaian:</p>

          <h1 style={{ fontSize: 36 }}>
            {catatan.length}
          </h1>

          <p>
            Terverifikasi:{" "}
            <strong>
              {
                catatan.filter(
                  (c) => c.status === "verified"
                ).length
              }
            </strong>
          </p>

          <p>
            Menunggu verifikasi:{" "}
            <strong>
              {
                catatan.filter(
                  (c) => c.status === "pending"
                ).length
              }
            </strong>
          </p>
        </section>

        <section style={card}>
          <h2>Input Pencapaian OJT</h2>

          <p style={{ color: "#64748b" }}>
            Penginputan hanya dapat dilakukan
            oleh Mentor.
          </p>

          <form onSubmit={simpanPencapaian}>
            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Kategori Pencapaian
            </label>

            <select
              value={jenis}
              onChange={(e) =>
                setJenis(e.target.value)
              }
              required
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                marginBottom: 18,
                background: "white",
              }}
            >
              {kategori.length === 0 && (
                <option value="">
                  Belum ada kategori
                </option>
              )}

              {kategori.map((item) => (
                <option
                  key={item.code}
                  value={item.code}
                >
                  {item.name}
                </option>
              ))}
            </select>

            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Tanggal Kegiatan
            </label>

            <input
              type="date"
              value={tanggal}
              onChange={(e) =>
                setTanggal(e.target.value)
              }
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                marginBottom: 18,
              }}
            />

            <label
              style={{
                display: "block",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              Keterangan Pencapaian
            </label>

            <textarea
              value={deskripsi}
              onChange={(e) =>
                setDeskripsi(e.target.value)
              }
              placeholder="Tuliskan kegiatan atau pencapaian peserta..."
              rows={5}
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                marginBottom: 18,
                fontFamily: "inherit",
              }}
            />

            {error && (
              <p style={{ color: "#b91c1c" }}>
                {error}
              </p>
            )}

            {pesan && (
              <p style={{ color: "#15803d" }}>
                {pesan}
              </p>
            )}

            <button
              type="submit"
              disabled={
                menyimpan ||
                kategori.length === 0
              }
              style={{
                ...tombol,
                opacity: menyimpan ? 0.6 : 1,
              }}
            >
              {menyimpan
                ? "Menyimpan..."
                : "Simpan Pencapaian"}
            </button>
          </form>
        </section>

        <h2>Enam Pencapaian OJT</h2>

        {kategori.map((item) => {
          const total = catatan.filter(
            (c) => c.type_code === item.code
          ).length;

          const verified = catatan.filter(
            (c) =>
              c.type_code === item.code &&
              c.status === "verified"
          ).length;

          return (
            <section key={item.code} style={card}>
              <h3>{item.name}</h3>
              <p>Total catatan: {total}</p>
              <p>Terverifikasi: {verified}</p>
            </section>
          );
        })}

        <h2>Riwayat Pencapaian</h2>

        {catatan.length === 0 && (
          <section style={card}>
            <p>
              Belum ada pencapaian yang
              diinput.
            </p>
          </section>
        )}

        {catatan.map((item) => (
          <section key={item.id} style={card}>
            <h3>
              {namaKategori(item.type_code)}
            </h3>

            <p>
              Tanggal: {item.activity_date}
            </p>

            <p>{item.description}</p>

            <p>
              Status:{" "}
              <strong>
                {item.status === "verified"
                  ? "Terverifikasi"
                  : item.status === "pending"
                  ? "Menunggu Verifikasi"
                  : item.status}
              </strong>
            </p>
          </section>
        ))}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
            color: "#64748b",
          }}
        >
          OJT MineTrack v2.0 — Mentor
        </footer>
      </div>
    </main>
  );
}
