
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

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  marginBottom: 16,
  fontFamily: "inherit",
  fontSize: 15,
};

function tanggalHariIni() {
  const sekarang = new Date();
  const lokal = new Date(
    sekarang.getTime() -
      sekarang.getTimezoneOffset() * 60000
  );
  return lokal.toISOString().slice(0, 10);
}

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();
  const programId = params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);

  const [jenis, setJenis] = useState("");
  const [tanggal, setTanggal] = useState(tanggalHariIni);
  const [deskripsi, setDeskripsi] = useState("");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [aksiId, setAksiId] = useState(null);

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

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya dapat diakses Mentor."
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
            .select("code, name")
            .order("name");

        if (jenisError) throw jenisError;

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
        setKategori(jenisData || []);
        setCatatan(riwayat || []);

        if (jenisData?.length) {
          setJenis(jenisData[0].code);
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

  function bersihkanForm() {
    setEditId(null);
    setJenis(kategori[0]?.code || "");
    setTanggal(tanggalHariIni());
    setDeskripsi("");
  }

  async function simpanPencapaian(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpan) return;

    if (!jenis || !tanggal || deskripsi.trim().length < 10) {
      setError(
        "Lengkapi semua kolom. Keterangan minimal 10 karakter."
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

      let hasil;

      if (editId) {
        hasil = await supabase
          .from("achievement_records")
          .update(dataInput)
          .eq("id", editId)
          .eq("program_id", programId)
          .select("id");
      } else {
        hasil = await supabase
          .from("achievement_records")
          .insert({
            ...dataInput,
            program_id: programId,
          })
          .select("id");
      }

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error(
          "Data tidak berubah. Periksa izin Mentor."
        );
      }

      const sedangEdit = Boolean(editId);

      await muatCatatan();
      bersihkanForm();

      setPesan(
        sedangEdit
          ? "Pencapaian berhasil diperbarui. Status kembali Pending."
          : "Pencapaian berhasil disimpan. Menunggu verifikasi Mentor."
      );
    } catch (err) {
      setError(err.message || "Gagal menyimpan data.");
    } finally {
      setMenyimpan(false);
    }
  }

  function mulaiEdit(item) {
    setEditId(item.id);
    setJenis(item.type_code);
    setTanggal(item.activity_date);
    setDeskripsi(item.description);
    setError("");
    setPesan("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function verifikasi(item) {
    if (!mentor || aksiId) return;

    const setuju = window.confirm(
      "Verifikasi pencapaian ini sebagai Mentor?"
    );

    if (!setuju) return;

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
        throw new Error(
          "Pencapaian tidak dapat diverifikasi."
        );
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

    const setuju = window.confirm(
      "Yakin ingin menghapus pencapaian ini? Data yang dihapus tidak dapat dikembalikan."
    );

    if (!setuju) return;

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
        throw new Error(
          "Data tidak terhapus. Periksa izin Mentor."
        );
      }

      if (editId === item.id) {
        bersihkanForm();
      }

      await muatCatatan();
      setPesan("Pencapaian berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus data.");
    } finally {
      setAksiId(null);
    }
  }

  function namaKategori(code) {
    return (
      kategori.find((item) => item.code === code)?.name ||
      code
    );
  }

  const totalVerified = catatan.filter(
    (item) => item.status === "verified"
  ).length;

  const totalPending = catatan.filter(
    (item) => item.status === "pending"
  ).length;

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
        <section style={card}>
          <h2>Data Tidak Dapat Ditampilkan</h2>
          <p style={{ color: "#b91c1c" }}>{error}</p>
          <button
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
            background: "#0f172a",
            color: "white",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h1>Detail Peserta OJT</h1>
          <p>OJT MineTrack v2.0</p>
          <small>Monitoring dan Evaluasi Mentor</small>
          <p>
            Mentor: <strong>{mentor.full_name}</strong>
          </p>
        </header>

        <button
          style={{ ...tombol, marginBottom: 20 }}
          onClick={() => router.push("/")}
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
          <p>Mulai: {program.start_date}</p>
          <p>Selesai: {program.end_date}</p>
          <p>Status: {program.status}</p>
        </section>

        <section style={card}>
          <h2>Ringkasan Pencapaian</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
                  padding: 12,
                  borderRadius: 10,
                  textAlign: "center",
                }}
              >
                <small>{nama}</small>
                <h2>{nilai}</h2>
              </div>
            ))}
          </div>
        </section>

        <section style={card}>
          <h2>
            {editId
              ? "Edit Pencapaian OJT"
              : "Input Pencapaian OJT"}
          </h2>

          <p style={{ color: "#64748b" }}>
            Hanya Mentor yang dapat mengelola pencapaian.
          </p>

          <form onSubmit={simpanPencapaian}>
            <label>Kategori Pencapaian</label>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              required
              style={inputStyle}
            >
              {kategori.length === 0 && (
                <option value="">Belum ada kategori</option>
              )}

              {kategori.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>

            <label>Tanggal Kegiatan</label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
              style={inputStyle}
            />

            <label>Keterangan Pencapaian</label>
            <textarea
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Tuliskan kegiatan atau pencapaian peserta..."
              rows={5}
              required
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
                disabled={menyimpan || !kategori.length}
                style={{
                  ...tombol,
                  opacity: menyimpan ? 0.6 : 1,
                }}
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
                  onClick={bersihkanForm}
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

        {error && (
          <section style={card}>
            <p style={{ color: "#b91c1c" }}>{error}</p>
          </section>
        )}

        {pesan && (
          <section style={card}>
            <p style={{ color: "#15803d" }}>{pesan}</p>
          </section>
        )}

        <h2>Enam Pencapaian OJT</h2>

        {kategori.map((item) => {
          const daftar = catatan.filter(
            (c) => c.type_code === item.code
          );

          const verified = daftar.filter(
            (c) => c.status === "verified"
          ).length;

          return (
            <section key={item.code} style={card}>
              <h3>{item.name}</h3>
              <p>Total catatan: {daftar.length}</p>
              <p>Terverifikasi: {verified}</p>
              <p>
                Menunggu: {daftar.length - verified}
              </p>
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
            <h3>{namaKategori(item.type_code)}</h3>
            <p>Tanggal: {item.activity_date}</p>
            <p>{item.description}</p>

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
                flexWrap: "wrap",
                gap: 8,
                marginTop: 14,
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
                onClick={() => mulaiEdit(item)}
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
            color: "#64748b",
          }}
        >
          OJT MineTrack v2.0 — Dashboard Mentor
        </footer>
      </div>
    </main>
  );
}
