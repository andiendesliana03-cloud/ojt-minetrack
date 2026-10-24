
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
    fontWeight: 700,
    cursor: "pointer",
  },
};

function hariIni() {
  const now = new Date();

  const local = new Date(
    now.getTime() -
      now.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 10);
}

function formatTanggal(value) {
  if (!value) return "-";

  const parts = String(value)
    .slice(0, 10)
    .split("-");

  if (parts.length !== 3) return String(value);

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function namaPeserta(item) {
  return item?.peserta?.full_name || "Nama belum tersedia";
}

export default function PraktikMingguan() {
  const router = useRouter();
  const params = useParams();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [daftarProgram, setDaftarProgram] = useState([]);
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

  // Ambil riwayat berdasarkan program peserta.
  async function ambilRiwayat(id) {
    const { data, error: err } = await supabase
      .from("weekly_practice_scores")
      .select(
        "id,program_id,practice_date,practice_name,score,notes,created_at"
      )
      .eq("program_id", id)
      .order("practice_date", {
        ascending: false,
      });

    if (err) throw err;

    return data || [];
  }

  useEffect(() => {
    if (!programId) return;

    let aktif = true;

    async function mulai() {
      setLoading(true);
      setError("");
      setPesan("");
      setProgram(null);
      setRiwayat([]);
      setEditId(null);
      setTanggal(hariIni());
      setNamaPraktik("");
      setNilai("");
      setCatatan("");

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
          data: profil,
          error: profilError,
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profilError) throw profilError;

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman penilaian hanya untuk Mentor ERG."
          );
        }

        // Membaca seluruh program aktif.
        // RLS database menentukan siapa
        // yang boleh membaca data.
        const {
          data: programs,
          error: programsError,
        } = await supabase
          .from("ojt_programs")
          .select(`
            id,
            participant_id,
            site,
            start_date,
            end_date,
            status,
            peserta:profiles!ojt_programs_participant_id_fkey(
              full_name,
              department
            )
          `)
          .eq("status", "active");

        if (programsError) throw programsError;

        const list = (programs || []).sort(
          (a, b) =>
            namaPeserta(a).localeCompare(
              namaPeserta(b),
              "id"
            )
        );

        const pilihan = list.find(
          (item) => item.id === programId
        );

        if (!pilihan) {
          throw new Error(
            "Program peserta tidak ditemukan atau sudah tidak aktif."
          );
        }

        const dataNilai =
          await ambilRiwayat(pilihan.id);

        if (!aktif) return;

        setMentor(profil);
        setDaftarProgram(list);
        setProgram(pilihan);
        setRiwayat(dataNilai);
      } catch (err) {
        if (aktif) {
          setError(
            err.message || "Gagal memuat data."
          );
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

  // Saat peserta dipilih, URL ikut berubah.
  // Ini memastikan nilai dan riwayat
  // hanya menggunakan program yang dipilih.
  function pilihPeserta(id) {
    if (
      !id ||
      id === programId ||
      menyimpan ||
      aksiId
    ) {
      return;
    }

    setError("");
    setPesan("");
    setEditId(null);
    setProgram(null);
    setRiwayat([]);
    setLoading(true);

    router.push(`/praktik/${id}`);
  }

  async function simpanPraktik(event) {
    event.preventDefault();

    if (
      !mentor ||
      !program ||
      program.id !== programId ||
      menyimpan ||
      aksiId
    ) {
      return;
    }

    const angka = Number(nilai);

    if (!tanggal || !namaPraktik.trim()) {
      setError(
        "Tanggal dan jenis praktik wajib diisi."
      );
      return;
    }

    if (
      nilai.trim() === "" ||
      !Number.isFinite(angka) ||
      angka < 0 ||
      angka > 100
    ) {
      setError(
        "Nilai harus antara 0 sampai 100."
      );
      return;
    }

    setMenyimpan(true);
    setError("");
    setPesan("");

    try {
      const {
        data: programAktif,
        error: programError,
      } = await supabase
        .from("ojt_programs")
        .select("id,status")
        .eq("id", program.id)
        .eq("status", "active")
        .maybeSingle();

      if (programError) throw programError;

      if (!programAktif) {
        throw new Error(
          "Program OJT sudah tidak aktif."
        );
      }

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
            .eq("program_id", program.id)
            .select("id")
        : await supabase
            .from("weekly_practice_scores")
            .insert({
              ...input,
              program_id: program.id,
              created_by: mentor.id,
            })
            .select("id");

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error(
          "Nilai praktik tidak berhasil disimpan."
        );
      }

      const dataTerbaru =
        await ambilRiwayat(program.id);

      setRiwayat(dataTerbaru);
      resetForm();

      setPesan(
        sedangEdit
          ? `Nilai ${namaPeserta(program)} berhasil diperbarui.`
          : `Nilai ${namaPeserta(program)} berhasil disimpan.`
      );
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan nilai."
      );
    } finally {
      setMenyimpan(false);
    }
  }

  function editPraktik(item) {
    if (
      !program ||
      item.program_id !== program.id
    ) {
      return;
    }

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
    if (
      !mentor ||
      !program ||
      program.id !== programId ||
      aksiId ||
      menyimpan
    ) {
      return;
    }

    const confirmed = window.confirm(
      `Hapus penilaian ini?\n\n` +
        `Peserta: ${namaPeserta(program)}\n` +
        `Site: ${program.site}\n` +
        `Materi: ${item.practice_name}\n` +
        `Nilai: ${item.score}`
    );

    if (!confirmed) return;

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } =
        await supabase
          .from("weekly_practice_scores")
          .delete()
          .eq("id", item.id)
          .eq("program_id", program.id)
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

      const dataTerbaru =
        await ambilRiwayat(program.id);

      setRiwayat(dataTerbaru);

      setPesan(
        `Nilai ${namaPeserta(program)} berhasil dihapus.`
      );
    } catch (err) {
      setError(
        err.message || "Gagal menghapus nilai."
      );
    } finally {
      setAksiId(null);
    }
  }

  const totalPenilaian = riwayat.length;

  const rataRata = totalPenilaian
    ? riwayat.reduce(
        (total, item) =>
          total + Number(item.score),
        0
      ) / totalPenilaian
    : null;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <h2>Monitoring OJT</h2>
            <p>Memuat daftar peserta dan nilai praktik...</p>
          </section>
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
              {error || "Program tidak ditemukan."}
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
          onClick={() => router.push("/")}
        >
          ← Dashboard Mentor
        </button>

        {/* PILIH NAMA PESERTA */}
        <section
          style={{
            ...styles.card,
            background: "#eff6ff",
            border: "2px solid #93c5fd",
          }}
        >
          <h2>Pilih Peserta OJT</h2>

          <p
            style={{
              color: "#475569",
              lineHeight: 1.7,
            }}
          >
            Pilih nama peserta sebelum memasukkan
            atau mengubah nilai praktik.
          </p>

          <label htmlFor="pilih-peserta">
            <strong>Nama Peserta OJT *</strong>
          </label>

          <select
            id="pilih-peserta"
            value={program.id}
            onChange={(e) =>
              pilihPeserta(e.target.value)
            }
            disabled={menyimpan || Boolean(aksiId)}
            style={{
              ...styles.input,
              fontWeight: 700,
            }}
          >
            {daftarProgram.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {namaPeserta(item)} — {item.site}
              </option>
            ))}
          </select>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #bfdbfe",
              borderRadius: 12,
              padding: 15,
            }}
          >
            <p>
              <strong>Nama Peserta:</strong>{" "}
              {namaPeserta(program)}
            </p>

            <p>
              <strong>Site:</strong>{" "}
              {program.site || "-"}
            </p>

            <p>
              <strong>Departemen:</strong>{" "}
              {program.peserta?.department || "-"}
            </p>

            <p>
              <strong>Periode OJT:</strong>{" "}
              {formatTanggal(program.start_date)}
              {" s.d. "}
              {formatTanggal(program.end_date)}
            </p>

            <p
              style={{
                color: "#15803d",
                fontWeight: 700,
                marginBottom: 0,
              }}
            >
              ✓ Nilai akan disimpan untuk peserta
              yang sedang dipilih.
            </p>
          </div>
        </section>

        {/* RINGKASAN NILAI */}
        <section style={styles.card}>
          <h2>Ringkasan Penilaian Praktik</h2>

          <p>
            Peserta:{" "}
            <strong>{namaPeserta(program)}</strong>
          </p>

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
          <section
            style={styles.card}
            role="alert"
          >
            <p style={{ color: "#dc2626" }}>
              {error}
            </p>
          </section>
        )}

        {pesan && (
          <section
            style={{
              ...styles.card,
              background: "#f0fdf4",
              borderColor: "#86efac",
            }}
            role="status"
          >
            <p
              style={{
                color: "#15803d",
                fontWeight: 700,
              }}
            >
              ✓ {pesan}
            </p>
          </section>
        )}

        {/* FORM PENILAIAN */}
        <section
          style={styles.card}
          id="form-praktik"
        >
          <h2>
            {editId
              ? "Edit Penilaian Praktik"
              : "Input Penilaian Praktik Mingguan"}
          </h2>

          <p
            style={{
              padding: 12,
              background: "#f8fafc",
              borderRadius: 9,
              lineHeight: 1.7,
            }}
          >
            <strong>
              Peserta: {namaPeserta(program)}
            </strong>
            <br />
            Site: {program.site || "-"}
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
              disabled={menyimpan}
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
              disabled={menyimpan}
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
              disabled={menyimpan}
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
              placeholder="Catatan hasil praktik peserta"
              rows={4}
              style={styles.input}
              disabled={menyimpan}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                type="submit"
                disabled={menyimpan || Boolean(aksiId)}
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
                  disabled={menyimpan}
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

        {/* RIWAYAT PER PESERTA */}
        <section style={styles.card}>
          <h2>Riwayat Penilaian Praktik</h2>

          <p style={{ color: "#64748b" }}>
            Riwayat peserta:{" "}
            <strong>{namaPeserta(program)}</strong>
          </p>

          {riwayat.length === 0 && (
            <p>
              Belum ada nilai praktik untuk peserta ini.
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
                <strong>Peserta:</strong>{" "}
                {namaPeserta(program)}
              </p>

              <p>
                <strong>Site:</strong>{" "}
                {program.site || "-"}
              </p>

              <p>
                Tanggal Pelaksanaan:{" "}
                {formatTanggal(item.practice_date)}
              </p>

              <p>
                Catatan Mentor:{" "}
                {item.notes || "-"}
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    editPraktik(item)
                  }
                  disabled={Boolean(aksiId) || menyimpan}
                  style={styles.button}
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    hapusPraktik(item)
                  }
                  disabled={Boolean(aksiId) || menyimpan}
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
