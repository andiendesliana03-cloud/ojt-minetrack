
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "rgba(255,255,255,0.96)",
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  marginBottom: 16,
  fontSize: 16,
  fontFamily: "inherit",
  color: "#0f172a",
};

const halaman = {
  minHeight: "100vh",
  padding: 18,
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
  backgroundColor: "#f1f5f9",
  backgroundImage:
    'linear-gradient(rgba(241,245,249,0.82),rgba(241,245,249,0.92)),url("/background-erg.png.PNG")',
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundAttachment: "fixed",
};

function hariIni() {
  const d = new Date();
  const lokal = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return lokal.toISOString().slice(0, 10);
}

function formatTanggal(tanggal) {
  if (!tanggal) return "-";
  const [tahun, bulan, hari] = tanggal.split("-");
  return `${hari}/${bulan}/${tahun}`;
}

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);
  const [postTests, setPostTests] = useState([]);

  const [jenis, setJenis] = useState("");
  const [tanggal, setTanggal] = useState(hariIni);
  const [deskripsi, setDeskripsi] = useState("");
  const [editId, setEditId] = useState(null);

  const [tanggalTes, setTanggalTes] = useState(hariIni);
  const [nilaiTes, setNilaiTes] = useState("");
  const [catatanTes, setCatatanTes] = useState("");
  const [editTesId, setEditTesId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyimpanTes, setMenyimpanTes] = useState(false);
  const [aksiId, setAksiId] = useState(null);
  const [aksiTesId, setAksiTesId] = useState(null);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  async function muatCatatan() {
    const { data, error: err } = await supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,description,status,verified_by,created_at"
      )
      .eq("program_id", programId)
      .order("activity_date", { ascending: false });

    if (err) throw err;
    setCatatan(data || []);
  }

  async function muatPostTests() {
    const { data, error: err } = await supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes,created_at")
      .eq("program_id", programId)
      .order("test_date", { ascending: false });

    if (err) throw err;
    setPostTests(data || []);
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
            "Halaman ini hanya dapat diakses Mentor."
          );
        }

        const { data: dataProgram, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(`
              id,start_date,end_date,status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,department
              )
            `)
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const { data: jenisData, error: jenisError } =
          await supabase
            .from("achievement_types")
            .select("code,name")
            .order("name");

        if (jenisError) throw jenisError;

        const { data: riwayat, error: riwayatError } =
          await supabase
            .from("achievement_records")
            .select(
              "id,type_code,activity_date,description,status,verified_by,created_at"
            )
            .eq("program_id", programId)
            .order("activity_date", { ascending: false });

        if (riwayatError) throw riwayatError;

        const { data: nilai, error: nilaiError } =
          await supabase
            .from("post_test_scores")
            .select("id,test_date,score,notes,created_at")
            .eq("program_id", programId)
            .order("test_date", { ascending: false });

        if (nilaiError) throw nilaiError;

        if (!aktif) return;

        setMentor(profil);
        setProgram(dataProgram);
        setKategori(jenisData || []);
        setCatatan(riwayat || []);
        setPostTests(nilai || []);
        setJenis(jenisData?.[0]?.code || "");
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

  function resetPencapaian() {
    setEditId(null);
    setJenis(kategori[0]?.code || "");
    setTanggal(hariIni());
    setDeskripsi("");
  }

  function resetTes() {
    setEditTesId(null);
    setTanggalTes(hariIni());
    setNilaiTes("");
    setCatatanTes("");
  }

  async function simpanPencapaian(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpan) return;

    if (!jenis || !tanggal || deskripsi.trim().length < 10) {
      setError(
        "Lengkapi data. Keterangan minimal 10 karakter."
      );
      return;
    }

    setMenyimpan(true);
    setError("");
    setPesan("");

    try {
      const dataInput = {
        type_code: jenis,
        activity_date: tanggal,
        description: deskripsi.trim(),
        status: "pending",
        verified_by: null,
      };

      const hasil = editId
        ? await supabase
            .from("achievement_records")
            .update(dataInput)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("achievement_records")
            .insert({
              ...dataInput,
              program_id: programId,
            })
            .select("id");

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error("Pencapaian tidak tersimpan.");
      }

      await muatCatatan();
      resetPencapaian();
      setPesan("Pencapaian berhasil disimpan.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan pencapaian.");
    } finally {
      setMenyimpan(false);
    }
  }

  function editPencapaian(item) {
    setEditId(item.id);
    setJenis(item.type_code);
    setTanggal(item.activity_date);
    setDeskripsi(item.description);
    setError("");
    setPesan("");

    document
      .getElementById("form-pencapaian")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function verifikasi(item) {
    if (!mentor || aksiId) return;

    if (
      !window.confirm(
        "Verifikasi pencapaian ini sebagai Mentor?"
      )
    ) return;

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("achievement_records")
        .update({
          status: "verified",
          verified_by: mentor.id,
        })
        .eq("id", item.id)
        .eq("program_id", programId)
        .eq("status", "pending")
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error("Pencapaian tidak dapat diverifikasi.");
      }

      await muatCatatan();
      setPesan("Pencapaian berhasil diverifikasi.");
    } catch (err) {
      setError(err.message || "Gagal verifikasi.");
    } finally {
      setAksiId(null);
    }
  }

  async function hapusPencapaian(item) {
    if (!mentor || aksiId) return;

    if (
      !window.confirm(
        "Hapus pencapaian ini secara permanen?"
      )
    ) return;

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("achievement_records")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error("Pencapaian tidak terhapus.");
      }

      if (editId === item.id) resetPencapaian();

      await muatCatatan();
      setPesan("Pencapaian berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus pencapaian.");
    } finally {
      setAksiId(null);
    }
  }

  async function simpanPostTest(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpanTes) return;

    const nilai = Number(nilaiTes);

    if (!tanggalTes) {
      setError("Pilih tanggal pelaksanaan Post-Test.");
      return;
    }

    if (
      nilaiTes.trim() === "" ||
      !Number.isFinite(nilai) ||
      nilai < 0 ||
      nilai > 100
    ) {
      setError("Nilai harus antara 0 dan 100.");
      return;
    }

    setMenyimpanTes(true);
    setError("");
    setPesan("");

    try {
      const dataInput = {
        test_date: tanggalTes,
        score: nilai,
        notes: catatanTes.trim() || null,
      };

      const hasil = editTesId
        ? await supabase
            .from("post_test_scores")
            .update(dataInput)
            .eq("id", editTesId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("post_test_scores")
            .insert({
              ...dataInput,
              program_id: programId,
              created_by: mentor.id,
            })
            .select("id");

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error("Nilai tidak berhasil disimpan.");
      }

      await muatPostTests();
      resetTes();
      setPesan("Nilai Post-Test berhasil disimpan.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan Post-Test.");
    } finally {
      setMenyimpanTes(false);
    }
  }

  function editPostTest(item) {
    setEditTesId(item.id);
    setTanggalTes(item.test_date);
    setNilaiTes(String(item.score));
    setCatatanTes(item.notes || "");
    setError("");
    setPesan("");

    document
      .getElementById("form-post-test")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function hapusPostTest(item) {
    if (!mentor || aksiTesId) return;

    if (
      !window.confirm(
        "Hapus nilai Post-Test ini secara permanen?"
      )
    ) return;

    setAksiTesId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("post_test_scores")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error("Nilai tidak terhapus.");
      }

      if (editTesId === item.id) resetTes();

      await muatPostTests();
      setPesan("Nilai Post-Test berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus Post-Test.");
    } finally {
      setAksiTesId(null);
    }
  }

  const totalVerified = catatan.filter(
    (item) => item.status === "verified"
  ).length;

  const totalPending = catatan.filter(
    (item) => item.status === "pending"
  ).length;

  const rataRata = postTests.length
    ? postTests.reduce(
        (jumlah, item) => jumlah + Number(item.score),
        0
      ) / postTests.length
    : null;

  if (loading) {
    return (
      <main style={halaman}>
        <h2>Monitoring OJT</h2>
        <p>Memuat data peserta...</p>
      </main>
    );
  }

  if (!mentor || !program) {
    return (
      <main style={halaman}>
        <section style={card}>
          <h2>Data Tidak Dapat Ditampilkan</h2>
          <p style={{ color: "#b91c1c" }}>
            {error || "Akses tidak tersedia."}
          </p>
          <button
            type="button"
            style={tombol}
            onClick={() => router.push("/")}
          >
            Kembali ke Dashboard
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={halaman}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header
          style={{
            background: "rgba(15,23,42,0.96)",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h1>Monitoring OJT</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>Detail Peserta — Dashboard Mentor</small>
          <p>
            Mentor: <strong>{mentor.full_name}</strong>
          </p>
        </header>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{ ...tombol, marginBottom: 20 }}
        >
          ← Kembali ke Dashboard
        </button>

        <section style={card}>
          <h2>
            {program.peserta?.full_name || "Peserta OJT"}
          </h2>
          <p>
            Departemen:{" "}
            {program.peserta?.department || "-"}
          </p>
          <p>
            Mulai: {formatTanggal(program.start_date)}
          </p>
          <p>
            Selesai: {formatTanggal(program.end_date)}
          </p>
          <p>Status: {program.status}</p>
        </section>

        <section style={card}>
          <h2>Ringkasan Pencapaian</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3,minmax(0,1fr))",
              gap: 10,
            }}
          >
            {[
              ["Total", catatan.length],
              ["Terverifikasi", totalVerified],
              ["Pending", totalPending],
            ].map(([nama, nilai]) => (
              <div
                key={nama}
                style={{
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: 12,
                  textAlign: "center",
                  minWidth: 0,
                }}
              >
                <small>{nama}</small>
                <h2>{nilai}</h2>
              </div>
            ))}
          </div>
        </section>

        {error && (
          <section style={card}>
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                overflowWrap: "anywhere",
              }}
            >
              {error}
            </p>
          </section>
        )}

        {pesan && (
          <section style={card}>
            <p style={{ color: "#15803d" }}>
              {pesan}
            </p>
          </section>
        )}

        <section style={card} id="form-pencapaian">
          <h2>
            {editId
              ? "Edit Pencapaian OJT"
              : "Input Pencapaian OJT"}
          </h2>

          <p style={{ color: "#64748b" }}>
            Input dan verifikasi pencapaian oleh Mentor.
          </p>

          <form onSubmit={simpanPencapaian}>
            <label>Kategori Pencapaian</label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              style={inputStyle}
              required
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

            <label>Tanggal Kegiatan</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              style={inputStyle}
              required
            />

            <label>Keterangan Pencapaian</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              rows={5}
              placeholder="Tuliskan kegiatan atau pencapaian peserta..."
              style={inputStyle}
              required
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
                disabled={menyimpan || !kategori.length}
                style={tombol}
              >
                {menyimpan
                  ? "Menyimpan..."
                  : editId
                  ? "Simpan Perubahan"
                  : "Simpan Pencapaian"}
              </button>

              {editId && (
                <button
                  type="button"
                  onClick={resetPencapaian}
                  style={{
                    ...tombol,
                    background: "#64748b",
                  }}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>
        </section>

        <section style={card} id="form-post-test">
          <h2>Monitoring Post-Test Teori</h2>

          <p style={{ color: "#64748b" }}>
            Input nilai berdasarkan tanggal pelaksanaan
            Post-Test yang sebenarnya.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 12,
              marginBottom: 24,
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
              <small>Total Post-Test</small>
              <h2>{postTests.length}</h2>
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

          <h3>
            {editTesId
              ? "Edit Nilai Post-Test"
              : "Input Nilai Post-Test"}
          </h3>

          <form onSubmit={simpanPostTest}>
            <label htmlFor="tanggal-tes">
              Tanggal Pelaksanaan Post-Test
            </label>
            <input
              id="tanggal-tes"
              type="date"
              value={tanggalTes}
              onChange={(e) => setTanggalTes(e.target.value)}
              required
              style={inputStyle}
            />

            <label htmlFor="nilai-tes">
              Nilai Post-Test (0–100)
            </label>
            <input
              id="nilai-tes"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={nilaiTes}
              onChange={(e) => setNilaiTes(e.target.value)}
              placeholder="Contoh: 85"
              required
              style={inputStyle}
            />

            <label htmlFor="catatan-tes">
              Catatan Evaluasi
            </label>
            <textarea
              id="catatan-tes"
              value={catatanTes}
              onChange={(e) => setCatatanTes(e.target.value)}
              placeholder="Materi ujian atau evaluasi peserta..."
              rows={3}
              style={inputStyle}
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
                disabled={menyimpanTes}
                style={tombol}
              >
                {menyimpanTes
                  ? "Menyimpan..."
                  : editTesId
                  ? "Simpan Perubahan Nilai"
                  : "Simpan Nilai Post-Test"}
              </button>

              {editTesId && (
                <button
                  type="button"
                  onClick={resetTes}
                  style={{
                    ...tombol,
                    background: "#64748b",
                  }}
                >
                  Batal Edit
                </button>
              )}
            </div>
          </form>

          <h3 style={{ marginTop: 28 }}>
            Riwayat Nilai Post-Test
          </h3>

          {postTests.length === 0 && (
            <p>Belum ada nilai Post-Test tersimpan.</p>
          )}

          {postTests.map((item) => (
            <div
              key={item.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <h3>Nilai: {item.score}</h3>
              <p>
                Tanggal Pelaksanaan:{" "}
                {formatTanggal(item.test_date)}
              </p>
              <p>Catatan: {item.notes || "-"}</p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  disabled={Boolean(aksiTesId)}
                  onClick={() => editPostTest(item)}
                  style={tombol}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={Boolean(aksiTesId)}
                  onClick={() => hapusPostTest(item)}
                  style={{
                    ...tombol,
                    background: "#dc2626",
                  }}
                >
                  {aksiTesId === item.id
                    ? "Menghapus..."
                    : "Hapus"}
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* PENILAIAN PRAKTIK MINGGUAN */}
        <section style={card}>
          <h2>Penilaian Praktik Mingguan</h2>

          <p style={{ color: "#64748b" }}>
            Input nilai praktik, tanggal pelaksanaan,
            jenis praktik, dan evaluasi Mentor.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(`/praktik/${programId}`)
            }
            style={{
              ...tombol,
              background: "#0f766e",
              width: "100%",
            }}
          >
            Buka Penilaian Praktik Mingguan →
          </button>
        </section>

        {/* MONITORING SAMAPTA */}
        <section style={card}>
          <h2>Monitoring Samapta</h2>

          <p style={{ color: "#64748b" }}>
            Input hasil tes fisik, nilai evaluasi,
            tanggal pelaksanaan, dan status kelulusan.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(`/samapta/${programId}`)
            }
            style={{
              ...tombol,
              background: "#16a34a",
              width: "100%",
            }}
          >
            🏃 Buka Monitoring Samapta →
          </button>
        </section>

        {/* MONITORING SIMPER */}
        <section style={card}>
          <h2>Monitoring SIMPER</h2>

          <p style={{ color: "#64748b" }}>
            Pantau administrasi, training, ujian teori,
            ujian praktik, pengajuan, dan status
            kelulusan SIMPER peserta OJT.
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(`/simper/${programId}`)
            }
            style={{
              ...tombol,
              background: "#7c3aed",
              width: "100%",
            }}
          >
            🚗 Buka Monitoring SIMPER →
          </button>
        </section>

        <h2>Enam Pencapaian OJT</h2>

        {kategori.map((item) => {
          const daftar = catatan.filter(
            (c) => c.type_code === item.code
          );

          const verified = daftar.filter(
            (c) => c.status === "verified"
          ).length;

          const pending = daftar.filter(
            (c) => c.status === "pending"
          ).length;

          return (
            <section key={item.code} style={card}>
              <h3>{item.name}</h3>
              <p>Total catatan: {daftar.length}</p>
              <p>Terverifikasi: {verified}</p>
              <p>Menunggu: {pending}</p>
            </section>
          );
        })}

        <h2>Riwayat Pencapaian</h2>

        {catatan.length === 0 && (
          <section style={card}>
            Belum ada pencapaian yang diinput.
          </section>
        )}

        {catatan.map((item) => (
          <section key={item.id} style={card}>
            <h3>
              {kategori.find(
                (k) => k.code === item.type_code
              )?.name || item.type_code}
            </h3>

            <p>
              Tanggal: {formatTanggal(item.activity_date)}
            </p>

            <p style={{ overflowWrap: "anywhere" }}>
              {item.description}
            </p>

            <p>
              Status:{" "}
              <strong
                style={{
                  color:
                    item.status === "verified"
                      ? "#15803d"
                      : "#b45309",
                }}
              >
                {item.status === "verified"
                  ? "Terverifikasi"
                  : item.status === "pending"
                  ? "Menunggu Verifikasi"
                  : item.status}
              </strong>
            </p>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {item.status === "pending" && (
                <button
                  type="button"
                  disabled={Boolean(aksiId)}
                  onClick={() => verifikasi(item)}
                  style={{
                    ...tombol,
                    background: "#16a34a",
                  }}
                >
                  {aksiId === item.id
                    ? "Memproses..."
                    : "✓ Verifikasi"}
                </button>
              )}

              <button
                type="button"
                disabled={Boolean(aksiId)}
                onClick={() => editPencapaian(item)}
                style={tombol}
              >
                Edit
              </button>

              <button
                type="button"
                disabled={Boolean(aksiId)}
                onClick={() => hapusPencapaian(item)}
                style={{
                  ...tombol,
                  background: "#dc2626",
                }}
              >
                Hapus
              </button>
            </div>
          </section>
        ))}

        <footer
          style={{
            textAlign: "center",
            padding: 24,
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
