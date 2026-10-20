
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const card = {
  background: "rgba(255,255,255,0.96)",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 18,
  marginBottom: 16,
};

const input = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  border: "1px solid #cbd5e1",
  borderRadius: 10,
  fontSize: 16,
  marginTop: 8,
  marginBottom: 18,
};

const tombol = {
  border: "none",
  background: "#2563eb",
  color: "white",
  padding: "12px 18px",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
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

export default function MonitoringSamapta() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [riwayat, setRiwayat] = useState([]);

  const [tanggal, setTanggal] = useState(hariIni);
  const [jenis, setJenis] = useState("Push-Up");
  const [hasil, setHasil] = useState("");
  const [satuan, setSatuan] = useState("Repetisi");
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
      .from("samapta_records")
      .select(
        "id,test_date,test_type,result_value,result_unit,score,notes"
      )
      .eq("program_id", programId)
      .order("test_date", { ascending: false });

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

        if (profil?.role !== "mentor") {
          router.replace("/peserta");
          return;
        }

        const { data: dataProgram, error: programError } =
          await supabase
            .from("ojt_programs")
            .select(
              "id,start_date,end_date,status"
            )
            .eq("id", programId)
            .single();

        if (programError) throw programError;

        const { data, error: dataError } =
          await supabase
            .from("samapta_records")
            .select(
              "id,test_date,test_type,result_value,result_unit,score,notes"
            )
            .eq("program_id", programId)
            .order("test_date", { ascending: false });

        if (dataError) throw dataError;

        if (!aktif) return;

        setMentor(profil);
        setProgram(dataProgram);
        setRiwayat(data || []);
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
    setJenis("Push-Up");
    setHasil("");
    setSatuan("Repetisi");
    setNilai("");
    setCatatan("");
  }

  async function simpan(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpan) return;

    const angkaHasil = Number(hasil);
    const angkaNilai =
      nilai.trim() === "" ? null : Number(nilai);

    if (
      !tanggal ||
      !jenis.trim() ||
      !satuan.trim() ||
      hasil.trim() === "" ||
      !Number.isFinite(angkaHasil) ||
      angkaHasil < 0
    ) {
      setError("Periksa kembali data hasil Samapta.");
      return;
    }

    if (
      angkaNilai !== null &&
      (!Number.isFinite(angkaNilai) ||
        angkaNilai < 0 ||
        angkaNilai > 100)
    ) {
      setError("Nilai harus antara 0 sampai 100.");
      return;
    }

    setMenyimpan(true);
    setError("");
    setPesan("");

    try {
      const dataInput = {
        test_date: tanggal,
        test_type: jenis.trim(),
        result_value: angkaHasil,
        result_unit: satuan.trim(),
        score: angkaNilai,
        notes: catatan.trim() || null,
      };

      const hasilQuery = editId
        ? await supabase
            .from("samapta_records")
            .update(dataInput)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("samapta_records")
            .insert({
              ...dataInput,
              program_id: programId,
              created_by: mentor.id,
            })
            .select("id");

      if (hasilQuery.error) throw hasilQuery.error;

      if (!hasilQuery.data?.length) {
        throw new Error("Data Samapta tidak tersimpan.");
      }

      await muatRiwayat();
      resetForm();
      setPesan("Data Samapta berhasil disimpan.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan data.");
    } finally {
      setMenyimpan(false);
    }
  }

  function editData(item) {
    setEditId(item.id);
    setTanggal(item.test_date);
    setJenis(item.test_type);
    setHasil(String(item.result_value));
    setSatuan(item.result_unit);
    setNilai(
      item.score == null ? "" : String(item.score)
    );
    setCatatan(item.notes || "");
    setError("");
    setPesan("");

    document
      .getElementById("form-samapta")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  async function hapusData(item) {
    if (aksiId) return;

    if (
      !window.confirm(
        "Yakin ingin menghapus hasil Samapta ini?"
      )
    ) {
      return;
    }

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("samapta_records")
        .delete()
        .eq("id", item.id)
        .eq("program_id", programId)
        .select("id");

      if (err) throw err;

      if (!data?.length) {
        throw new Error("Data tidak berhasil dihapus.");
      }

      if (editId === item.id) resetForm();

      await muatRiwayat();
      setPesan("Data Samapta berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus data.");
    } finally {
      setAksiId(null);
    }
  }

  const nilaiTersedia = riwayat.filter(
    (item) => item.score !== null
  );

  const rataRata = nilaiTersedia.length
    ? nilaiTersedia.reduce(
        (total, item) => total + Number(item.score),
        0
      ) / nilaiTersedia.length
    : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f1f5f9",
        backgroundImage:
          'linear-gradient(rgba(241,245,249,0.85),rgba(241,245,249,0.94)),url("/background-erg.png.PNG")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        padding: 18,
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <header
          style={{
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 18,
          }}
        >
          <h1>Monitoring Samapta</h1>
          <h3>Emergency Response Group</h3>
          <p>PT Berau Coal 2026</p>
          <small>Monitoring OJT — Dashboard Mentor</small>
        </header>

        <button
          type="button"
          onClick={() =>
            router.push(`/peserta/${programId}`)
          }
          style={{
            ...tombol,
            background: "#475569",
            marginBottom: 18,
          }}
        >
          ← Kembali ke Detail Peserta
        </button>

        {loading ? (
          <section style={card}>
            Memuat data Samapta...
          </section>
        ) : !mentor || !program ? (
          <section style={card}>
            <h2>Data Tidak Dapat Ditampilkan</h2>
            <p style={{ color: "#dc2626" }}>
              {error || "Akses tidak tersedia."}
            </p>
          </section>
        ) : (
          <>
            <section style={card}>
              <h2>Informasi Monitoring</h2>
              <p>
                Mentor: <strong>{mentor.full_name}</strong>
              </p>
              <p>
                Periode OJT:{" "}
                {formatTanggal(program.start_date)} –{" "}
                {formatTanggal(program.end_date)}
              </p>
            </section>

            <section style={card}>
              <h2>Ringkasan Samapta</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: "#eff6ff",
                    padding: 16,
                    borderRadius: 12,
                    textAlign: "center",
                  }}
                >
                  <p>Total Tes</p>
                  <h2>{riwayat.length}</h2>
                </div>

                <div
                  style={{
                    background: "#f0fdf4",
                    padding: 16,
                    borderRadius: 12,
                    textAlign: "center",
                  }}
                >
                  <p>Rata-rata Nilai</p>
                  <h2>
                    {rataRata === null
                      ? "-"
                      : rataRata.toFixed(2)}
                  </h2>
                </div>
              </div>
            </section>

            {error && (
              <section style={card}>
                <p style={{ color: "#dc2626" }}>
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

            <section style={card} id="form-samapta">
              <h2>
                {editId
                  ? "Edit Hasil Samapta"
                  : "Input Hasil Samapta"}
              </h2>

              <form onSubmit={simpan}>
                <label>
                  Tanggal Pelaksanaan
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) =>
                      setTanggal(e.target.value)
                    }
                    required
                    style={input}
                  />
                </label>

                <label>
                  Jenis Tes
                  <select
                    value={jenis}
                    onChange={(e) => {
                      const pilihan = e.target.value;
                      setJenis(pilihan);

                      if (
                        pilihan === "Lari 12 Menit" ||
                        pilihan === "Lari 2.400 Meter"
                      ) {
                        setSatuan("Menit");
                      } else {
                        setSatuan("Repetisi");
                      }
                    }}
                    style={input}
                    required
                  >
                    <option>Push-Up</option>
                    <option>Sit-Up</option>
                    <option>Pull-Up</option>
                    <option>Shuttle Run</option>
                    <option>Lari 12 Menit</option>
                    <option>Lari 2.400 Meter</option>
                    <option>Tes Lainnya</option>
                  </select>
                </label>

                <label>
                  Hasil Pengukuran
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hasil}
                    onChange={(e) =>
                      setHasil(e.target.value)
                    }
                    placeholder="Contoh: 35"
                    required
                    style={input}
                  />
                </label>

                <label>
                  Satuan
                  <select
                    value={satuan}
                    onChange={(e) =>
                      setSatuan(e.target.value)
                    }
                    style={input}
                    required
                  >
                    <option>Repetisi</option>
                    <option>Menit</option>
                    <option>Detik</option>
                    <option>Meter</option>
                    <option>Km</option>
                    <option>Putaran</option>
                  </select>
                </label>

                <label>
                  Nilai Evaluasi (0–100)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={nilai}
                    onChange={(e) =>
                      setNilai(e.target.value)
                    }
                    placeholder="Contoh: 85"
                    style={input}
                  />
                </label>

                <label>
                  Catatan Mentor
                  <textarea
                    value={catatan}
                    onChange={(e) =>
                      setCatatan(e.target.value)
                    }
                    rows={4}
                    placeholder="Catatan hasil tes Samapta..."
                    style={input}
                  />
                </label>

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
                    style={tombol}
                  >
                    {menyimpan
                      ? "Menyimpan..."
                      : editId
                      ? "Simpan Perubahan"
                      : "Simpan Hasil Samapta"}
                  </button>

                  {editId && (
                    <button
                      type="button"
                      onClick={resetForm}
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

            <section style={card}>
              <h2>Riwayat Hasil Samapta</h2>

              {riwayat.length === 0 && (
                <p>Belum ada hasil Samapta tersimpan.</p>
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
                  <h3>{item.test_type}</h3>
                  <p>
                    Tanggal:{" "}
                    {formatTanggal(item.test_date)}
                  </p>
                  <p>
                    Hasil: {item.result_value}{" "}
                    {item.result_unit}
                  </p>
                  <p>
                    Nilai:{" "}
                    {item.score === null
                      ? "-"
                      : item.score}
                  </p>
                  <p>Catatan: {item.notes || "-"}</p>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => editData(item)}
                      disabled={Boolean(aksiId)}
                      style={tombol}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => hapusData(item)}
                      disabled={Boolean(aksiId)}
                      style={{
                        ...tombol,
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
          </>
        )}

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
