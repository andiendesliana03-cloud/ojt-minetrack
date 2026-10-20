
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f1f5f9",
    backgroundImage:
      'linear-gradient(rgba(241,245,249,0.86),rgba(241,245,249,0.94)),url("/background-erg.png.PNG")',
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
    color: "#0f172a",
    padding: 18,
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: 850,
    margin: "0 auto",
  },
  header: {
    background: "rgba(15,23,42,0.96)",
    color: "#ffffff",
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  card: {
    background: "rgba(255,255,255,0.97)",
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    border: "1px solid #e2e8f0",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: 12,
    marginTop: 6,
    marginBottom: 18,
    borderRadius: 9,
    border: "1px solid #cbd5e1",
    fontSize: 16,
    fontFamily: "inherit",
    background: "#ffffff",
    color: "#0f172a",
  },
  button: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    padding: "12px 17px",
    borderRadius: 9,
    fontWeight: 600,
    cursor: "pointer",
  },
};

function hariIni() {
  const date = new Date();
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function formatTanggal(value) {
  if (!value) return "-";

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export default function PraktikMingguan() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [riwayat, setRiwayat] = useState([]);

  const [tanggal, setTanggal] = useState(hariIni);
  const [namaPraktik, setNamaPraktik] = useState("");
  const [nilai, setNilai] = useState("");
  const [catatan, setCatatan] = useState("");
  const [editId, setEditId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [aksiId, setAksiId] = useState(null);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  async function muatRiwayat() {
    const { data, error: err } = await supabase
      .from("weekly_practice_scores")
      .select(
        "id,practice_date,practice_name,score,notes,created_at"
      )
      .eq("program_id", programId)
      .order("practice_date", { ascending: false });

    if (err) throw err;

    setRiwayat(data || []);
  }

  useEffect(() => {
    if (!programId) return;

    let aktif = true;

    async function mulai() {
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

        const { data: profil, error: profilError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profilError) throw profilError;

        if (profil?.role === "participant") {
          router.replace("/peserta");
          return;
        }

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman penilaian hanya dapat diakses Mentor."
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

        const { data: dataNilai, error: nilaiError } =
          await supabase
            .from("weekly_practice_scores")
            .select(
              "id,practice_date,practice_name,score,notes,created_at"
            )
            .eq("program_id", programId)
            .order("practice_date", { ascending: false });

        if (nilaiError) throw nilaiError;

        if (!aktif) return;

        setMentor(profil);
        setProgram(dataProgram);
        setRiwayat(dataNilai || []);
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

  function resetForm() {
    setEditId(null);
    setTanggal(hariIni());
    setNamaPraktik("");
    setNilai("");
    setCatatan("");
  }

  async function simpanPraktik(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpan) return;

    const angka = Number(nilai);

    if (!tanggal || !namaPraktik.trim()) {
      setError(
        "Tanggal pelaksanaan dan jenis praktik wajib diisi."
      );
      return;
    }

    if (
      nilai.trim() === "" ||
      !Number.isFinite(angka) ||
      angka < 0 ||
      angka > 100
    ) {
      setError("Nilai harus antara 0 sampai 100.");
      return;
    }

    setMenyimpan(true);
    setError("");
    setPesan("");

    try {
      const input = {
        practice_date: tanggal,
        practice_name: namaPraktik.trim(),
        score: angka,
        notes: catatan.trim() || null,
      };

      const sedangEdit = Boolean(editId);

      const hasil = sedangEdit
        ? await supabase
            .from("weekly_practice_scores")
            .update(input)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("weekly_practice_scores")
            .insert({
              ...input,
              program_id: programId,
              created_by: mentor.id,
            })
            .select("id");

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error(
          "Nilai praktik tidak berhasil disimpan."
        );
      }

      await muatRiwayat();
      resetForm();

      setPesan(
        sedangEdit
          ? "Nilai praktik berhasil diperbarui."
          : "Nilai Praktik Mingguan berhasil disimpan."
      );
    } catch (err) {
      setError(err.message || "Gagal menyimpan nilai.");
    } finally {
      setMenyimpan(false);
    }
  }

  function editPraktik(item) {
    setEditId(item.id);
    setTanggal(item.practice_date);
    setNamaPraktik(item.practice_name);
    setNilai(String(item.score));
    setCatatan(item.notes || "");

    setError("");
    setPesan("");

    document
      .getElementById("form-praktik")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function hapusPraktik(item) {
    if (!mentor || aksiId) return;

    if (
      !window.confirm(
        `Yakin ingin menghapus penilaian ${item.practice_name}?`
      )
    ) {
      return;
    }

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("weekly_practice_scores")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error(
          "Nilai praktik tidak berhasil dihapus."
        );
      }

      if (editId === item.id) {
        resetForm();
      }

      await muatRiwayat();
      setPesan("Nilai praktik berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus nilai.");
    } finally {
      setAksiId(null);
    }
  }

  const totalPenilaian = riwayat.length;

  const rataRata = totalPenilaian
    ? riwayat.reduce(
        (total, item) => total + Number(item.score),
        0
      ) / totalPenilaian
    : null;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h2>Monitoring OJT</h2>
          <p>Memuat Penilaian Praktik Mingguan...</p>
        </div>
      </main>
    );
  }

  if (!mentor || !program) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h2>Data Tidak Dapat Ditampilkan</h2>

            <p style={{ color: "#dc2626" }}>
              {error || "Data tidak ditemukan."}
            </p>

            <button
              type="button"
              style={styles.button}
              onClick={() => router.push("/")}
            >
              Kembali ke Dashboard
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1>Monitoring OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <p>Penilaian Praktik Mingguan</p>
          <small>
            Mentor: {mentor.full_name || "Mentor OJT"}
          </small>
        </header>

        <button
          type="button"
          style={{
            ...styles.button,
            marginBottom: 18,
          }}
          onClick={() =>
            router.push(`/peserta/${programId}`)
          }
        >
          ← Kembali ke Detail Peserta
        </button>

        <section style={styles.card}>
          <h2>
            {program.peserta?.full_name || "Peserta OJT"}
          </h2>

          <p>
            Departemen:{" "}
            {program.peserta?.department || "-"}
          </p>

          <p>
            Periode OJT:{" "}
            {formatTanggal(program.start_date)}
            {" - "}
            {formatTanggal(program.end_date)}
          </p>

          <p>Status: {program.status}</p>
        </section>

        <section style={styles.card}>
          <h2>Ringkasan Penilaian Praktik</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                background: "#eff6ff",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}
            >
              <small>Total Penilaian</small>
              <h2>{totalPenilaian}</h2>
            </div>

            <div
              style={{
                background: "#f0fdf4",
                borderRadius: 12,
                padding: 16,
                textAlign: "center",
              }}
            >
              <small>Rata-rata Nilai</small>
              <h2>
                {rataRata === null
                  ? "-"
                  : rataRata.toFixed(2)}
              </h2>
            </div>
          </div>
        </section>

        {error && (
          <section style={styles.card}>
            <p
              role="alert"
              style={{
                color: "#dc2626",
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          </section>
        )}

        {pesan && (
          <section style={styles.card}>
            <p style={{ color: "#15803d" }}>
              {pesan}
            </p>
          </section>
        )}

        <section
          style={styles.card}
          id="form-praktik"
        >
          <h2>
            {editId
              ? "Edit Penilaian Praktik"
              : "Input Penilaian Praktik Mingguan"}
          </h2>

          <p style={{ color: "#64748b" }}>
            Input nilai berdasarkan tanggal pelaksanaan
            praktik yang sebenarnya.
          </p>

          <form onSubmit={simpanPraktik}>
            <label htmlFor="tanggal-praktik">
              Tanggal Pelaksanaan
            </label>

            <input
              id="tanggal-praktik"
              type="date"
              value={tanggal}
              onChange={(e) =>
                setTanggal(e.target.value)
              }
              style={styles.input}
              required
            />

            <label htmlFor="nama-praktik">
              Jenis / Materi Praktik
            </label>

            <input
              id="nama-praktik"
              type="text"
              value={namaPraktik}
              onChange={(e) =>
                setNamaPraktik(e.target.value)
              }
              placeholder="Contoh: Fire Fighting"
              style={styles.input}
              required
            />

            <label htmlFor="nilai-praktik">
              Nilai Praktik (0–100)
            </label>

            <input
              id="nilai-praktik"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={nilai}
              onChange={(e) =>
                setNilai(e.target.value)
              }
              placeholder="Contoh: 90"
              style={styles.input}
              required
            />

            <label htmlFor="catatan-praktik">
              Catatan Evaluasi Mentor
            </label>

            <textarea
              id="catatan-praktik"
              value={catatan}
              onChange={(e) =>
                setCatatan(e.target.value)
              }
              placeholder="Contoh: Penggunaan APAR sudah sesuai prosedur."
              rows={4}
              style={styles.input}
            />

            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="submit"
                disabled={menyimpan}
                style={{
                  ...styles.button,
                  opacity: menyimpan ? 0.6 : 1,
                }}
              >
                {menyimpan
                  ? "Menyimpan..."
                  : editId
                  ? "Simpan Perubahan"
                  : "Simpan Nilai Praktik"}
              </button>

              {editId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    ...styles.button,
                    background: "#64748b",
                  }}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section style={styles.card}>
          <h2>Riwayat Penilaian Praktik</h2>

          {riwayat.length === 0 && (
            <p>
              Belum ada nilai praktik yang tersimpan.
            </p>
          )}

          {riwayat.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <h3>{item.practice_name}</h3>

              <h2>Nilai: {item.score}</h2>

              <p>
                Tanggal Pelaksanaan:{" "}
                {formatTanggal(item.practice_date)}
              </p>

              <p>
                Catatan Mentor: {item.notes || "-"}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  disabled={Boolean(aksiId)}
                  onClick={() =>
                    editPraktik(item)
                  }
                  style={styles.button}
                >
                  Edit
                </button>

                <button
                  type="button"
                  disabled={Boolean(aksiId)}
                  onClick={() =>
                    hapusPraktik(item)
                  }
                  style={{
                    ...styles.button,
                    background: "#dc2626",
                  }}
                >
                  {aksiId === item.id
                    ? "Menghapus..."
                    : "Hapus"}
                </button>
              </div>
            </div>
          ))}
        </section>

        <footer
          style={{
            textAlign: "center",
            padding: 20,
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
