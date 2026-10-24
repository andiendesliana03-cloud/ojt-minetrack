
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const GREEN = "#148761";

function today() {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function dateText(value) {
  if (!value) return "-";
  const parts = String(value).slice(0, 10).split("-");
  if (parts.length !== 3) return String(value);
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function Icon({ name, size = 22 }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    users: <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5" />
    </>,
    target: <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>,
    file: <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>,
    check: <path d="m4 12 5 5L20 6" />,
    run: <>
      <circle cx="15" cy="4" r="2" />
      <path d="m13 8-4 4 4 3-2 6M13 8l4 3 4 1M9 12l-5 3M13 15l5 5" />
    </>,
    id: <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6 16c1-3 5-3 6 0M15 10h4M15 14h4" />
    </>,
    chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20V7" />,
    clock: <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l4 2" />
    </>,
    calendar: <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>,
    edit: <>
      <path d="m4 20 4-.8L20 7a2 2 0 0 0-3-3L5 16z" />
    </>,
    trash: <>
      <path d="M4 7h16M9 4h6M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>,
    book: <>
      <path d="M12 7c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V6c-3-1-6-1-9 1zM12 7v14" />
    </>,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.check}
    </svg>
  );
}

function Progress({ value }) {
  const safe = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div className="dp-progress">
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function MenuCard({ icon, title, detail, color, onClick }) {
  return (
    <button
      type="button"
      className="dp-menu-card"
      onClick={onClick}
    >
      <div
        className="dp-menu-icon"
        style={{ color, background: `${color}15` }}
      >
        <Icon name={icon} size={23} />
      </div>

      <div className="dp-menu-name">{title}</div>
      <div className="dp-menu-detail">{detail}</div>

      <div className="dp-menu-arrow">
        <Icon name="arrow" size={16} />
      </div>
    </button>
  );
}

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);
  const [postTests, setPostTests] = useState([]);

  const [panel, setPanel] = useState("menu");

  const [jenis, setJenis] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [deskripsi, setDeskripsi] = useState("");
  const [editId, setEditId] = useState(null);

  const [tanggalTes, setTanggalTes] = useState(today);
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
      setPesan("");
      setPanel("menu");

      try {
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const {
          data: profil,
          error: profilError
        } = await supabase
          .from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id)
          .single();

        if (profilError) throw profilError;

        if (profil?.role === "participant") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya dapat diakses Mentor."
          );
        }

        const [
          programResult,
          kategoriResult,
          catatanResult,
          tesResult
        ] = await Promise.all([
          supabase
            .from("ojt_programs")
            .select(`
              id,site,start_date,end_date,status,
              peserta:profiles!ojt_programs_participant_id_fkey(
                full_name,department
              )
            `)
            .eq("id", programId)
            .single(),

          supabase
            .from("achievement_types")
            .select("code,name")
            .order("name"),

          supabase
            .from("achievement_records")
            .select(
              "id,type_code,activity_date,description,status,verified_by,created_at"
            )
            .eq("program_id", programId)
            .order("activity_date", { ascending: false }),

          supabase
            .from("post_test_scores")
            .select("id,test_date,score,notes,created_at")
            .eq("program_id", programId)
            .order("test_date", { ascending: false })
        ]);

        if (programResult.error) throw programResult.error;
        if (kategoriResult.error) throw kategoriResult.error;
        if (catatanResult.error) throw catatanResult.error;
        if (tesResult.error) throw tesResult.error;

        if (!aktif) return;

        setMentor(profil);
        setProgram(programResult.data);
        setKategori(kategoriResult.data || []);
        setCatatan(catatanResult.data || []);
        setPostTests(tesResult.data || []);
        setJenis(kategoriResult.data?.[0]?.code || "");
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

  function bukaPanel(nama) {
    setPanel(nama);
    setError("");
    setPesan("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetPencapaian() {
    setEditId(null);
    setJenis(kategori[0]?.code || "");
    setTanggal(today());
    setDeskripsi("");
  }

  function resetTes() {
    setEditTesId(null);
    setTanggalTes(today());
    setNilaiTes("");
    setCatatanTes("");
  }

  async function simpanPencapaian(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpan || aksiId) return;

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
        verified_by: null
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
              program_id: programId
            })
            .select("id");

      if (hasil.error) throw hasil.error;

      if (!hasil.data?.length) {
        throw new Error("Pencapaian tidak tersimpan.");
      }

      await muatCatatan();
      resetPencapaian();

      setPesan(
        "Pencapaian berhasil disimpan dan menunggu verifikasi."
      );
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan pencapaian."
      );
    } finally {
      setMenyimpan(false);
    }
  }

  function editPencapaian(item) {
    setEditId(item.id);
    setJenis(item.type_code);
    setTanggal(item.activity_date);
    setDeskripsi(item.description || "");
    setError("");
    setPesan("");
    setPanel("pencapaian");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function verifikasi(item) {
    if (!mentor || aksiId || menyimpan) return;

    if (!window.confirm(
      "Verifikasi pencapaian ini sebagai Mentor?"
    )) return;

    setAksiId(item.id);
    setError("");
    setPesan("");

    try {
      const { data, error: err } = await supabase
        .from("achievement_records")
        .update({
          status: "verified",
          verified_by: mentor.id
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
    if (!mentor || aksiId || menyimpan) return;

    if (!window.confirm(
      "Hapus pencapaian ini secara permanen?"
    )) return;

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
      setError(
        err.message || "Gagal menghapus pencapaian."
      );
    } finally {
      setAksiId(null);
    }
  }

  async function simpanPostTest(e) {
    e.preventDefault();

    if (!mentor || !program || menyimpanTes || aksiTesId) {
      return;
    }

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
        notes: catatanTes.trim() || null
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
              created_by: mentor.id
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
      setError(
        err.message || "Gagal menyimpan Post-Test."
      );
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
    setPanel("posttest");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function hapusPostTest(item) {
    if (!mentor || aksiTesId || menyimpanTes) return;

    if (!window.confirm(
      "Hapus nilai Post-Test ini secara permanen?"
    )) return;

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
      setError(
        err.message || "Gagal menghapus Post-Test."
      );
    } finally {
      setAksiTesId(null);
    }
  }

  const ringkasan = useMemo(() => {
    const verifiedCodes = new Set(
      catatan
        .filter(item => item.status === "verified")
        .map(item => item.type_code)
    );

    const doneCategories = kategori.filter(
      item => verifiedCodes.has(item.code)
    ).length;

    const progress = kategori.length
      ? Math.round(
          (doneCategories / kategori.length) * 100
        )
      : 0;

    const numbers = postTests
      .map(item => Number(item.score))
      .filter(Number.isFinite);

    const rataRata = numbers.length
      ? numbers.reduce((a, b) => a + b, 0) /
        numbers.length
      : null;

    return {
      total: catatan.length,
      verified: catatan.filter(
        item => item.status === "verified"
      ).length,
      pending: catatan.filter(
        item => item.status === "pending"
      ).length,
      doneCategories,
      progress,
      rataRata
    };
  }, [catatan, kategori, postTests]);

  const nama = program?.peserta?.full_name || "Peserta OJT";

  const menu = [
    {
      key: "pencapaian",
      title: "Pencapaian OJT",
      detail: `${ringkasan.doneCategories} dari ${kategori.length} kategori`,
      icon: "target",
      color: "#0c976b",
      action: () => bukaPanel("pencapaian")
    },
    {
      key: "posttest",
      title: "Post-Test",
      detail: `${postTests.length} nilai tercatat`,
      icon: "file",
      color: "#317bd0",
      action: () => bukaPanel("posttest")
    },
    {
      key: "praktik",
      title: "Praktik Mingguan",
      detail: "Input dan riwayat nilai",
      icon: "book",
      color: "#d49b22",
      action: () => router.push(`/praktik/${programId}`)
    },
    {
      key: "samapta",
      title: "Samapta",
      detail: "Tes fisik dan kelulusan",
      icon: "run",
      color: "#139a5b",
      action: () => router.push(`/samapta/${programId}`)
    },
    {
      key: "simper",
      title: "SIMPER",
      detail: "Empat tahapan penilaian",
      icon: "id",
      color: "#8055ce",
      action: () => router.push(`/simper/${programId}`)
    },
    {
      key: "mingguan",
      title: "Evaluasi Mingguan",
      detail: "Monitoring per minggu",
      icon: "calendar",
      color: "#0894b5",
      action: () => router.push(`/mingguan/${programId}`)
    },
    {
      key: "analisis",
      title: "Grafik Perkembangan",
      detail: "Analisis perkembangan OJT",
      icon: "chart",
      color: "#356fc1",
      action: () => router.push(`/analisis/${programId}`)
    },
    {
      key: "evaluasi",
      title: "Evaluasi Kesiapan",
      detail: "Evaluasi hasil OJT",
      icon: "check",
      color: "#13885b",
      action: () => router.push(`/evaluasi/${programId}`)
    },
    {
      key: "laporan",
      title: "Laporan OJT",
      detail: "Rekapitulasi dan PDF",
      icon: "file",
      color: "#9b6acb",
      action: () => router.push(`/laporan/${programId}`)
    }
  ];

  if (loading) {
    return (
      <main className="dp-loading">
        <strong>OJT MineTrack</strong>
        <p>Memuat data peserta...</p>
      </main>
    );
  }

  if (!mentor || !program) {
    return (
      <main className="dp-loading">
        <h2>Data Tidak Dapat Ditampilkan</h2>
        <p>{error || "Akses tidak tersedia."}</p>
        <button
          onClick={() => router.push("/")}
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="dp-root">
      <style>{`
        * { box-sizing: border-box; }

        .dp-root {
          min-height: 100vh;
          background: #f2f6f7;
          color: #172e2a;
          font-family: Arial, Helvetica, sans-serif;
        }

        .dp-loading {
          min-height: 100vh;
          padding: 30px;
          background: #eff5f2;
          font-family: Arial, sans-serif;
          color: #18372b;
        }

        .dp-topbar {
          background: #071e25;
          color: #ffffff;
          padding: 17px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .dp-brand {
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -.5px;
        }

        .dp-brand span {
          color: #27c991;
        }

        .dp-back {
          display: flex;
          align-items: center;
          gap: 7px;
          background: #ffffff13;
          border: 1px solid #ffffff30;
          border-radius: 9px;
          color: white;
          font-weight: 700;
          font-size: 12px;
          padding: 10px 13px;
          cursor: pointer;
        }

        .dp-container {
          max-width: 1130px;
          margin: 0 auto;
          padding: 22px;
        }

        .dp-banner {
          border-radius: 18px;
          overflow: hidden;
          background:
            linear-gradient(
              90deg,
              #061d23ee,
              #07352dcc 68%,
              #07352d70
            ),
            url("/background-erg.png.PNG");
          background-size: cover;
          background-position: center;
          padding: 30px;
          color: white;
          margin-bottom: 18px;
        }

        .dp-banner-label {
          font-size: 10px;
          letter-spacing: 2px;
          font-weight: 800;
          color: #e7bd69;
        }

        .dp-banner h1 {
          font-size: 29px;
          line-height: 1.2;
          margin: 12px 0 7px;
        }

        .dp-banner p {
          color: #d5e9e0;
          margin: 0;
          font-size: 12px;
        }

        .dp-card {
          background: white;
          border: 1px solid #e3ebea;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 17px;
          box-shadow: 0 5px 18px #102e2710;
        }

        .dp-profile {
          display: flex;
          gap: 16px;
          align-items: center;
        }

        .dp-avatar {
          background: #e1f7ea;
          color: #098861;
          border-radius: 16px;
          width: 65px;
          height: 65px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
          font-weight: 900;
          font-size: 22px;
        }

        .dp-profile-main {
          min-width: 0;
          flex: 1;
        }

        .dp-profile-name {
          font-size: 20px;
          font-weight: 900;
          color: #17342d;
          overflow-wrap: anywhere;
        }

        .dp-profile-meta {
          color: #71857b;
          font-size: 12px;
          margin-top: 6px;
          line-height: 1.6;
        }

        .dp-badge {
          display: inline-block;
          background: #dff6e9;
          color: #09784d;
          padding: 7px 11px;
          border-radius: 30px;
          font-weight: 800;
          font-size: 11px;
          white-space: nowrap;
        }

        .dp-divider {
          border: 0;
          border-top: 1px solid #e9efeb;
          margin: 18px 0;
        }

        .dp-progress {
          height: 10px;
          width: 100%;
          background: #e5eeea;
          border-radius: 30px;
          overflow: hidden;
        }

        .dp-progress span {
          display: block;
          height: 100%;
          background: linear-gradient(
            90deg, #25bc87, #0c815c
          );
          border-radius: inherit;
        }

        .dp-progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
          font-size: 12px;
          color: #637c70;
        }

        .dp-progress-header strong {
          color: #087d59;
          font-size: 19px;
        }

        .dp-metrics {
          display: grid;
          grid-template-columns: repeat(3,1fr);
          gap: 10px;
          margin-top: 16px;
        }

        .dp-small-stat {
          background: #f7faf8;
          border: 1px solid #eaf0eb;
          border-radius: 11px;
          padding: 13px;
          text-align: center;
        }

        .dp-small-stat span {
          display: block;
          color: #71877b;
          font-size: 10px;
        }

        .dp-small-stat strong {
          display: block;
          font-size: 22px;
          color: #193e30;
          margin-top: 6px;
        }

        .dp-section-title {
          font-size: 18px;
          color: #17352b;
          margin: 0 0 6px;
          font-weight: 900;
        }

        .dp-muted {
          margin: 0 0 16px;
          color: #819188;
          line-height: 1.6;
          font-size: 12px;
        }

        .dp-menu-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 13px;
        }

        .dp-menu-card {
          text-align: left;
          position: relative;
          cursor: pointer;
          border: 1px solid #e3ebe7;
          border-radius: 14px;
          background: #ffffff;
          padding: 18px;
          min-height: 144px;
          box-shadow: 0 3px 12px #102c2209;
        }

        .dp-menu-card:hover {
          background: #f7fcf9;
          border-color: #9ed7bd;
        }

        .dp-menu-icon {
          width: 43px;
          height: 43px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          margin-bottom: 13px;
        }

        .dp-menu-name {
          font-size: 14px;
          font-weight: 900;
          color: #1d3831;
        }

        .dp-menu-detail {
          color: #809389;
          font-size: 11px;
          margin-top: 6px;
          line-height: 1.5;
        }

        .dp-menu-arrow {
          position: absolute;
          right: 13px;
          top: 17px;
          color: #738d80;
        }

        .dp-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
        }

        .dp-button {
          border: 0;
          background: #118660;
          color: white;
          border-radius: 10px;
          padding: 12px 17px;
          font-weight: 800;
          font-size: 13px;
          cursor: pointer;
        }

        .dp-button:disabled {
          opacity: .55;
          cursor: not-allowed;
        }

        .dp-button.gray {
          background: #64748b;
        }

        .dp-button.red {
          background: #d03939;
        }

        .dp-button.blue {
          background: #317bd0;
        }

        .dp-button.outline {
          background: #ecf5f0;
          color: #167251;
        }

        .dp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dp-field-group {
          margin-bottom: 17px;
        }

        .dp-field-group label {
          display: block;
          font-size: 12px;
          color: #344a40;
          font-weight: 800;
          margin-bottom: 7px;
        }

        .dp-field {
          width: 100%;
          background: white;
          border: 1px solid #d8e3dd;
          border-radius: 10px;
          color: #17352b;
          padding: 12px;
          font-size: 16px;
          font-family: inherit;
        }

        textarea.dp-field {
          resize: vertical;
        }

        .dp-history-item {
          border: 1px solid #e1eae5;
          border-radius: 12px;
          background: #fff;
          padding: 15px;
          margin-bottom: 11px;
        }

        .dp-history-title {
          font-size: 14px;
          font-weight: 900;
          color: #18362b;
        }

        .dp-history-meta {
          color: #788980;
          font-size: 11px;
          margin-top: 6px;
          line-height: 1.6;
        }

        .dp-history-desc {
          font-size: 12px;
          color: #395045;
          margin: 11px 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .dp-history-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-top: 13px;
        }

        .dp-history-actions .dp-button {
          padding: 9px 12px;
          font-size: 11px;
        }

        .dp-category-grid {
          display: grid;
          grid-template-columns: repeat(3,minmax(0,1fr));
          gap: 10px;
        }

        .dp-category {
          border: 1px solid #e3eae6;
          border-radius: 10px;
          padding: 13px;
          background: #f9fbfa;
        }

        .dp-category strong {
          display: block;
          font-size: 12px;
          color: #274237;
        }

        .dp-category small {
          display: block;
          font-size: 11px;
          color: #708779;
          margin-top: 7px;
        }

        .dp-category.verified {
          background: #ecfbf1;
          border-color: #c3ead0;
        }

        .dp-alert {
          border-radius: 11px;
          padding: 14px;
          margin-bottom: 15px;
          font-size: 13px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .dp-alert.error {
          background: #fff0f1;
          border: 1px solid #fecdd3;
          color: #b91c1c;
        }

        .dp-alert.success {
          background: #edfbf2;
          border: 1px solid #bde7ca;
          color: #08784d;
        }

        .dp-footer {
          text-align: center;
          color: #8b9f93;
          padding: 20px 0;
          font-size: 11px;
          line-height: 1.6;
        }

        @media(max-width:760px) {
          .dp-topbar {
            padding: 15px;
          }

          .dp-brand {
            font-size: 18px;
          }

          .dp-back {
            font-size: 0;
            padding: 9px;
          }

          .dp-back svg {
            width: 20px;
            height: 20px;
          }

          .dp-container {
            padding: 12px;
          }

          .dp-banner {
            padding: 23px 18px;
            min-height: 137px;
            border-radius: 14px;
          }

          .dp-banner h1 {
            font-size: 24px;
          }

          .dp-card {
            padding: 15px;
            margin-bottom: 12px;
            border-radius: 14px;
          }

          .dp-avatar {
            width: 48px;
            height: 48px;
            font-size: 17px;
            border-radius: 13px;
          }

          .dp-profile {
            gap: 11px;
          }

          .dp-profile-name {
            font-size: 16px;
          }

          .dp-profile-meta {
            font-size: 11px;
          }

          .dp-small-stat {
            padding: 11px 5px;
          }

          .dp-small-stat strong {
            font-size: 19px;
          }

          .dp-small-stat span {
            font-size: 9px;
          }

          .dp-menu-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
            gap: 9px;
          }

          .dp-menu-card {
            padding: 13px;
            min-height: 130px;
          }

          .dp-menu-icon {
            width: 36px;
            height: 36px;
          }

          .dp-menu-name {
            font-size: 12px;
          }

          .dp-menu-detail {
            font-size: 10px;
          }

          .dp-menu-arrow {
            right: 9px;
            top: 15px;
          }

          .dp-category-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .dp-panel-header h2 {
            font-size: 17px;
          }
        }
      `}</style>

      <header className="dp-topbar">
        <div className="dp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          className="dp-back"
          type="button"
          onClick={() =>
            panel === "menu"
              ? router.push("/")
              : bukaPanel("menu")
          }
        >
          <Icon name="back" size={18} />
          {panel === "menu"
            ? "Dashboard Mentor"
            : "Menu Peserta"}
        </button>
      </header>

      <div className="dp-container">
        <section className="dp-banner">
          <div className="dp-banner-label">
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </div>

          <h1>Detail Peserta OJT</h1>

          <p>
            Monitoring Kompetensi dan Evaluasi OJT
          </p>
        </section>

        <section className="dp-card">
          <div className="dp-profile">
            <div className="dp-avatar">
              {nama
                .split(" ")
                .map(part => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

            <div className="dp-profile-main">
              <div className="dp-profile-name">
                {nama}
              </div>

              <div className="dp-profile-meta">
                {program.peserta?.department || "-"}
                {" · "}
                {program.site || "Site belum diisi"}
                <br />
                {dateText(program.start_date)}
                {" – "}
                {dateText(program.end_date)}
              </div>
            </div>

            <span className="dp-badge">
              {program.status === "active"
                ? "Aktif"
                : program.status}
            </span>
          </div>

          <hr className="dp-divider" />

          <div className="dp-progress-header">
            <span>
              Progres Pencapaian OJT
            </span>

            <strong>{ringkasan.progress}%</strong>
          </div>

          <Progress value={ringkasan.progress} />

          <div className="dp-metrics">
            <div className="dp-small-stat">
              <span>Total Catatan</span>
              <strong>{ringkasan.total}</strong>
            </div>

            <div className="dp-small-stat">
              <span>Terverifikasi</span>
              <strong>{ringkasan.verified}</strong>
            </div>

            <div className="dp-small-stat">
              <span>Menunggu</span>
              <strong>{ringkasan.pending}</strong>
            </div>
          </div>
        </section>

        {error && (
          <div className="dp-alert error" role="alert">
            {error}
          </div>
        )}

        {pesan && (
          <div className="dp-alert success" role="status">
            ✓ {pesan}
          </div>
        )}

        {panel === "menu" && (
          <section className="dp-card">
            <h2 className="dp-section-title">
              Menu Monitoring & Penilaian
            </h2>

            <p className="dp-muted">
              Pilih kegiatan untuk peserta yang sedang dibuka.
            </p>

            <div className="dp-menu-grid">
              {menu.map(item => (
                <MenuCard
                  key={item.key}
                  icon={item.icon}
                  title={item.title}
                  detail={item.detail}
                  color={item.color}
                  onClick={item.action}
                />
              ))}
            </div>
          </section>
        )}

        {panel === "pencapaian" && (
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-section-title">
                  {editId
                    ? "Edit Pencapaian OJT"
                    : "Input Pencapaian OJT"}
                </h2>

                <button
                  type="button"
                  className="dp-button outline"
                  onClick={() => bukaPanel("menu")}
                >
                  Kembali
                </button>
              </div>

              <form onSubmit={simpanPencapaian}>
                <div className="dp-field-group">
                  <label htmlFor="dp-jenis">
                    Kategori Pencapaian
                  </label>

                  <select
                    id="dp-jenis"
                    className="dp-field"
                    value={jenis}
                    onChange={e => setJenis(e.target.value)}
                    required
                  >
                    {kategori.length === 0 && (
                      <option value="">
                        Belum ada kategori
                      </option>
                    )}

                    {kategori.map(item => (
                      <option
                        key={item.code}
                        value={item.code}
                      >
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-tanggal">
                    Tanggal Kegiatan
                  </label>

                  <input
                    id="dp-tanggal"
                    type="date"
                    className="dp-field"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    required
                  />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-deskripsi">
                    Keterangan Pencapaian
                  </label>

                  <textarea
                    id="dp-deskripsi"
                    className="dp-field"
                    value={deskripsi}
                    onChange={e => setDeskripsi(e.target.value)}
                    rows={4}
                    placeholder="Uraikan kegiatan atau pencapaian peserta..."
                    required
                  />
                </div>

                <div className="dp-actions">
                  <button
                    type="submit"
                    className="dp-button"
                    disabled={
                      menyimpan ||
                      Boolean(aksiId) ||
                      !kategori.length
                    }
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
                      className="dp-button gray"
                      onClick={resetPencapaian}
                      disabled={menyimpan}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dp-card">
              <h2 className="dp-section-title">
                Enam Pencapaian OJT
              </h2>

              <p className="dp-muted">
                Kategori dengan catatan terverifikasi
                ditandai hijau.
              </p>

              <div className="dp-category-grid">
                {kategori.map(item => {
                  const daftar = catatan.filter(
                    c => c.type_code === item.code
                  );

                  const verified = daftar.filter(
                    c => c.status === "verified"
                  ).length;

                  const pending = daftar.filter(
                    c => c.status === "pending"
                  ).length;

                  return (
                    <div
                      key={item.code}
                      className={
                        `dp-category ${verified ? "verified" : ""}`
                      }
                    >
                      <strong>
                        {verified ? "✓ " : "○ "}
                        {item.name}
                      </strong>

                      <small>
                        {verified} terverifikasi
                        {" · "}
                        {pending} menunggu
                      </small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="dp-card">
              <h2 className="dp-section-title">
                Riwayat Pencapaian
              </h2>

              <p className="dp-muted">
                {catatan.length} catatan pencapaian
              </p>

              {catatan.length === 0 && (
                <p className="dp-muted">
                  Belum ada pencapaian yang diinput.
                </p>
              )}

              {catatan.map(item => (
                <div
                  className="dp-history-item"
                  key={item.id}
                >
                  <div className="dp-history-title">
                    {kategori.find(
                      k => k.code === item.type_code
                    )?.name || item.type_code}
                  </div>

                  <div className="dp-history-meta">
                    {dateText(item.activity_date)}
                    {" · "}
                    {item.status === "verified"
                      ? "Terverifikasi"
                      : item.status === "pending"
                      ? "Menunggu Verifikasi"
                      : item.status}
                  </div>

                  <p className="dp-history-desc">
                    {item.description}
                  </p>

                  <div className="dp-history-actions">
                    {item.status === "pending" && (
                      <button
                        type="button"
                        className="dp-button"
                        disabled={
                          Boolean(aksiId) || menyimpan
                        }
                        onClick={() => verifikasi(item)}
                      >
                        ✓ Verifikasi
                      </button>
                    )}

                    <button
                      type="button"
                      className="dp-button blue"
                      disabled={
                        Boolean(aksiId) || menyimpan
                      }
                      onClick={() => editPencapaian(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="dp-button red"
                      disabled={
                        Boolean(aksiId) || menyimpan
                      }
                      onClick={() => hapusPencapaian(item)}
                    >
                      {aksiId === item.id
                        ? "Memproses..."
                        : "Hapus"}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {panel === "posttest" && (
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-section-title">
                  Monitoring Post-Test
                </h2>

                <button
                  type="button"
                  className="dp-button outline"
                  onClick={() => bukaPanel("menu")}
                >
                  Kembali
                </button>
              </div>

              <div className="dp-metrics"
                style={{
                  gridTemplateColumns: "repeat(2,1fr)",
                  marginBottom: 22
                }}
              >
                <div className="dp-small-stat">
                  <span>Total Post-Test</span>
                  <strong>{postTests.length}</strong>
                </div>

                <div className="dp-small-stat">
                  <span>Rata-rata Nilai</span>
                  <strong>
                    {ringkasan.rataRata === null
                      ? "—"
                      : ringkasan.rataRata.toFixed(2)}
                  </strong>
                </div>
              </div>

              <h3 className="dp-section-title">
                {editTesId
                  ? "Edit Nilai Post-Test"
                  : "Input Nilai Post-Test"}
              </h3>

              <form onSubmit={simpanPostTest}>
                <div className="dp-field-group">
                  <label htmlFor="dp-tanggal-tes">
                    Tanggal Pelaksanaan
                  </label>

                  <input
                    id="dp-tanggal-tes"
                    className="dp-field"
                    type="date"
                    value={tanggalTes}
                    onChange={e =>
                      setTanggalTes(e.target.value)
                    }
                    required
                  />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-nilai-tes">
                    Nilai Post-Test (0–100)
                  </label>

                  <input
                    id="dp-nilai-tes"
                    className="dp-field"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={nilaiTes}
                    onChange={e =>
                      setNilaiTes(e.target.value)
                    }
                    placeholder="Contoh: 85"
                    required
                  />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-catatan-tes">
                    Catatan Evaluasi
                  </label>

                  <textarea
                    id="dp-catatan-tes"
                    className="dp-field"
                    rows={3}
                    value={catatanTes}
                    onChange={e =>
                      setCatatanTes(e.target.value)
                    }
                    placeholder="Catatan evaluasi peserta..."
                  />
                </div>

                <div className="dp-actions">
                  <button
                    type="submit"
                    className="dp-button"
                    disabled={
                      menyimpanTes || Boolean(aksiTesId)
                    }
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
                      className="dp-button gray"
                      onClick={resetTes}
                      disabled={menyimpanTes}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dp-card">
              <h2 className="dp-section-title">
                Riwayat Nilai Post-Test
              </h2>

              <p className="dp-muted">
                Riwayat khusus peserta ini.
              </p>

              {postTests.length === 0 && (
                <p className="dp-muted">
                  Belum ada nilai Post-Test.
                </p>
              )}

              {postTests.map(item => (
                <div
                  className="dp-history-item"
                  key={item.id}
                >
                  <div className="dp-history-title">
                    Nilai: {item.score}
                  </div>

                  <div className="dp-history-meta">
                    Tanggal: {dateText(item.test_date)}
                  </div>

                  <p className="dp-history-desc">
                    {item.notes || "Tidak ada catatan."}
                  </p>

                  <div className="dp-history-actions">
                    <button
                      type="button"
                      className="dp-button blue"
                      disabled={
                        Boolean(aksiTesId) || menyimpanTes
                      }
                      onClick={() => editPostTest(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="dp-button red"
                      disabled={
                        Boolean(aksiTesId) || menyimpanTes
                      }
                      onClick={() => hapusPostTest(item)}
                    >
                      {aksiTesId === item.id
                        ? "Menghapus..."
                        : "Hapus"}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="dp-footer">
          OJT MineTrack v2.0
          {" · "}
          Emergency Response Group
          {" · "}
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
