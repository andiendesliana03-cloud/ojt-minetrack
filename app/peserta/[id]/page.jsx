
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;
const CATEGORY_NAMES = [
  "Fisik", "Training", "Sosialisasi",
  "Coaching", "Orientasi Area", "Hazard",
];

const META_START = "[[SIMPER_V2]]";
const META_END = "[[/SIMPER_V2]]";

function today() {
  const d = new Date();
  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function dateText(value) {
  if (!value) return "—";
  const parts = String(value).slice(0, 10).split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : String(value);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value) {
  if (!value) return null;
  const p = String(value).slice(0, 10).split("-").map(Number);
  if (p.length !== 3 || p.some(n => !Number.isInteger(n))) {
    return null;
  }
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] &&
    d.getUTCMonth() === p[1] - 1 &&
    d.getUTCDate() === p[2] ? d : null;
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);
  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );
  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= TOTAL_WEEKS ? week : null;
}

function average(rows) {
  const values = rows
    .filter(r => r.score !== null &&
      r.score !== undefined && r.score !== "")
    .map(r => Number(r.score))
    .filter(Number.isFinite);

  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

function fmt(value) {
  return value == null ? "—" : Number(value).toFixed(2);
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim().split(/\s+/).slice(0, 2)
    .map(s => s[0]).join("").toUpperCase();
}

function simperMeta(notes) {
  const text = String(notes || "");
  const a = text.lastIndexOf(META_START);
  const b = text.lastIndexOf(META_END);
  if (a < 0 || b <= a) return null;

  try {
    const meta = JSON.parse(
      text.slice(a + META_START.length, b)
    );
    return meta?.version === 2 ? meta : null;
  } catch {
    return null;
  }
}

function simperSummary(record) {
  if (!record) {
    return { percentage: 0, released: false };
  }

  const meta = simperMeta(record.notes);
  const first = record.administration_status === "passed";
  const second = record.theory_status === "passed";
  const third = record.practice_status === "passed";

  const fourth =
    first && second && third &&
    meta?.application_status === "approved" &&
    meta?.orientation_status === "completed" &&
    meta?.issuance_status === "issued" &&
    Boolean(record.graduation_date);

  return {
    percentage: [first, second, third, fourth]
      .filter(Boolean).length * 25,
    released: fourth,
  };
}

function samaptaSessions(records) {
  const dates = [...new Set(
    records.map(r => r.test_date).filter(Boolean)
  )].sort();

  const sessions = [];

  dates.forEach(date => {
    const items = records.filter(r => r.test_date === date);

    function score(type) {
      const row = items.find(
        r => normalize(r.test_type) === normalize(type)
      );
      if (row?.score === null ||
          row?.score === undefined ||
          row?.score === "") return null;
      const n = Number(row.score);
      return Number.isFinite(n) ? n : null;
    }

    const a = score("Lari 12 Menit");
    const parts = [
      score("Pull-Up"), score("Push-Up"),
      score("Sit-Up"), score("Shuttle Run"),
    ];

    if (a === null || parts.some(n => n === null)) return;

    const b = parts.reduce((sum, n) => sum + n, 0) / 4;
    const run = items.find(
      r => normalize(r.test_type) === "lari12menit"
    );
    const distance = run?.result_value == null
      ? null : Number(run.result_value);

    sessions.push({
      date,
      a,
      b,
      final: (a + b) / 2,
      distance: Number.isFinite(distance) ? distance : null,
      runPassed:
        distance !== null &&
        Number.isFinite(distance) &&
        distance >= 2600,
    });
  });

  return sessions;
}

function Icon({ name, size = 22 }) {
  const paths = {
    back: <path d="m15 18-6-6 6-6M9 12h12" />,
    arrow: <path d="m9 5 7 7-7 7" />,
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
    calendar: <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18" />
    </>,
    book: <>
      <path d="M12 7c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V6c-3-1-6-1-9 1zM12 7v14" />
    </>,
    refresh: <>
      <path d="M20 11a8 8 0 0 0-14-5L3 9" />
      <path d="M3 3v6h6M4 13a8 8 0 0 0 14 5l3-3" />
    </>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {paths[name] || paths.check}
    </svg>
  );
}

function Progress({ value }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="dp-progress"
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}>
      <span style={{ width: `${safe}%` }} />
    </div>
  );
}

function MenuCard({ icon, title, detail, color, onClick }) {
  return (
    <button type="button" className="dp-menu-card"
      onClick={onClick}>
      <div className="dp-menu-icon"
        style={{ color, background: `${color}15` }}>
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

function MiniStat({ label, value, sub }) {
  return (
    <div className="dp-small-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

export default function DetailPeserta() {
  const params = useParams();
  const router = useRouter();

  const programId = Array.isArray(params?.id)
    ? params.id[0] : params?.id;

  const [mentor, setMentor] = useState(null);
  const [program, setProgram] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [catatan, setCatatan] = useState([]);
  const [postTests, setPostTests] = useState([]);
  const [praktik, setPraktik] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState(null);

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
  const [refreshing, setRefreshing] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyimpanTes, setMenyimpanTes] = useState(false);
  const [aksiId, setAksiId] = useState(null);
  const [aksiTesId, setAksiTesId] = useState(null);
  const [error, setError] = useState("");
  const [pesan, setPesan] = useState("");

  async function fetchRecords() {
    const results = await Promise.all([
      supabase.from("achievement_records")
        .select("id,type_code,activity_date,description,status,verified_by,created_at")
        .eq("program_id", programId)
        .order("activity_date", { ascending: false }),

      supabase.from("post_test_scores")
        .select("id,test_date,score,notes,created_at")
        .eq("program_id", programId)
        .order("test_date", { ascending: false }),

      supabase.from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", programId),

      supabase.from("samapta_records")
        .select("id,test_date,test_type,score,outcome,result_value")
        .eq("program_id", programId),

      supabase.from("simper_records")
        .select("id,administration_status,theory_status,practice_status,status,graduation_date,notes")
        .eq("program_id", programId)
        .maybeSingle(),
    ]);

    const names = [
      "Pencapaian", "Post-Test", "Praktik", "Samapta", "SIMPER"
    ];

    results.forEach((result, i) => {
      if (result.error) {
        throw new Error(`${names[i]}: ${result.error.message}`);
      }
    });

    return {
      catatan: results[0].data || [],
      postTests: results[1].data || [],
      praktik: results[2].data || [],
      samapta: results[3].data || [],
      simper: results[4].data || null,
    };
  }

  function applyRecords(data) {
    setCatatan(data.catatan);
    setPostTests(data.postTests);
    setPraktik(data.praktik);
    setSamapta(data.samapta);
    setSimper(data.simper);
  }

  async function refresh() {
    if (refreshing || loading || !programId) return;
    setRefreshing(true);
    setError("");
    setPesan("");

    try {
      applyRecords(await fetchRecords());
    } catch (err) {
      setError(err.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  async function muatCatatan() {
    const { data, error: err } = await supabase
      .from("achievement_records")
      .select("id,type_code,activity_date,description,status,verified_by,created_at")
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
      setProgram(null);

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
        } = await supabase.from("profiles")
          .select("id,full_name,role")
          .eq("id", user.id).single();

        if (profilError) throw profilError;

        if (profil?.role === "participant" ||
            profil?.role === "peserta") {
          router.replace("/dashboard-peserta");
          return;
        }

        if (profil?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya dapat diakses Mentor."
          );
        }

        const [programResult, kategoriResult, recordResult] =
          await Promise.all([
            supabase.from("ojt_programs")
              .select(`
                id,site,start_date,end_date,status,
                peserta:profiles!ojt_programs_participant_id_fkey(
                  full_name,department
                )
              `)
              .eq("id", programId).single(),

            supabase.from("achievement_types")
              .select("code,name").order("name"),

            fetchRecords(),
          ]);

        if (programResult.error) throw programResult.error;
        if (kategoriResult.error) throw kategoriResult.error;
        if (!aktif) return;

        setMentor(profil);
        setProgram(programResult.data);
        setKategori(kategoriResult.data || []);
        setJenis(kategoriResult.data?.[0]?.code || "");
        applyRecords(recordResult);
      } catch (err) {
        if (aktif) setError(err.message || "Gagal memuat data.");
      } finally {
        if (aktif) setLoading(false);
      }
    }

    mulai();

    return () => { aktif = false; };
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
        verified_by: null,
      };

      const hasil = editId
        ? await supabase.from("achievement_records")
            .update(dataInput)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase.from("achievement_records")
            .insert({ ...dataInput, program_id: programId })
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
      setError(err.message || "Gagal menyimpan pencapaian.");
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
      setError(err.message || "Gagal menghapus pencapaian.");
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
        notes: catatanTes.trim() || null,
      };

      const hasil = editTesId
        ? await supabase.from("post_test_scores")
            .update(dataInput)
            .eq("id", editTesId)
            .eq("program_id", programId)
            .select("id")
        : await supabase.from("post_test_scores")
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
      setError(err.message || "Gagal menghapus Post-Test.");
    } finally {
      setAksiTesId(null);
    }
  }

  const ringkasan = useMemo(() => {
    const codeByName = new Map(
      kategori.map(k => [normalize(k.name), k.code])
    );

    const verifiedCodes = new Set(
      catatan
        .filter(item => item.status === "verified")
        .map(item => item.type_code)
    );

    const doneCategories = CATEGORY_NAMES.filter(name => {
      const code = codeByName.get(normalize(name));
      return code && verifiedCodes.has(code);
    }).length;

    const progress = Math.round(
      doneCategories / CATEGORY_NAMES.length * 100
    );

    const sessions = samaptaSessions(samapta);
    const latest = sessions.length
      ? sessions[sessions.length - 1] : null;

    const weeks = new Set();

    function mark(value) {
      const w = weekOf(value, program?.start_date);
      if (w !== null) weeks.add(w);
    }

    catatan.forEach(r => mark(r.activity_date));
    postTests.forEach(r => mark(r.test_date));
    praktik.forEach(r => mark(r.practice_date));
    samapta.forEach(r => mark(r.test_date));

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
      postAverage: average(postTests),
      practiceAverage: average(praktik),
      samaptaCount: sessions.length,
      samaptaLatest: latest,
      simper: simperSummary(simper),
      activityWeeks: weeks.size,
      activityPct: Math.round(
        weeks.size / TOTAL_WEEKS * 100
      ),
    };
  }, [
    catatan, kategori, postTests, praktik,
    samapta, simper, program,
  ]);

  const nama = program?.peserta?.full_name || "Peserta OJT";

  const menu = [
    {
      key: "pencapaian",
      title: "Pencapaian OJT",
      detail: `${ringkasan.doneCategories} dari 6 kategori`,
      icon: "target",
      color: "#0c976b",
      action: () => bukaPanel("pencapaian"),
    },
    {
      key: "posttest",
      title: "Post-Test",
      detail: `${postTests.length} nilai tercatat`,
      icon: "file",
      color: "#317bd0",
      action: () => bukaPanel("posttest"),
    },
    {
      key: "praktik",
      title: "Praktik Mingguan",
      detail: `${praktik.length} penilaian · rata-rata ${fmt(ringkasan.practiceAverage)}`,
      icon: "book",
      color: "#d49b22",
      action: () => router.push(`/praktik/${programId}`),
    },
    {
      key: "samapta",
      title: "Samapta",
      detail: `${ringkasan.samaptaCount} tes lengkap`,
      icon: "run",
      color: "#139a5b",
      action: () => router.push(`/samapta/${programId}`),
    },
    {
      key: "simper",
      title: "SIMPER",
      detail: `${ringkasan.simper.percentage}% · 4 tahapan`,
      icon: "id",
      color: "#8055ce",
      action: () => router.push(`/simper/${programId}`),
    },
    {
      key: "mingguan",
      title: "Evaluasi Mingguan",
      detail: `${ringkasan.activityWeeks} dari 25 minggu ada aktivitas`,
      icon: "calendar",
      color: "#0894b5",
      action: () => router.push(`/mingguan/${programId}`),
    },
    {
      key: "analisis",
      title: "Grafik Perkembangan",
      detail: "Grafik nilai sepanjang Week 1–25",
      icon: "chart",
      color: "#356fc1",
      action: () => router.push(`/analisis/${programId}`),
    },
    {
      key: "evaluasi",
      title: "Evaluasi Kesiapan",
      detail: "Kelengkapan enam indikator",
      icon: "check",
      color: "#13885b",
      action: () => router.push(`/evaluasi/${programId}`),
    },
    {
      key: "laporan",
      title: "Laporan OJT",
      detail: "Rekapitulasi dan cetak PDF",
      icon: "file",
      color: "#9b6acb",
      action: () => router.push(`/laporan/${programId}`),
    },
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
        <button onClick={() => router.push("/")}>
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
          color: #18372b;
          font-family: Arial, sans-serif;
        }

        .dp-topbar {
          background: #071e25;
          color: #fff;
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

        .dp-brand span { color: #27c991; }

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
          margin: auto;
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
          min-width: 0;
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
          overflow-wrap: anywhere;
        }

        .dp-small-stat small {
          display: block;
          margin-top: 6px;
          font-size: 10px;
          color: #81988a;
        }

        .dp-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .dp-summary-box {
          border: 1px solid #e5ede7;
          background: #f8faf8;
          padding: 14px;
          border-radius: 12px;
        }

        .dp-summary-box span {
          font-size: 11px;
          color: #748a7b;
          display: block;
        }

        .dp-summary-box strong {
          font-size: 21px;
          display: block;
          margin: 9px 0;
          color: #0b8058;
        }

        .dp-summary-box small {
          font-size: 10px;
          color: #829487;
          line-height: 1.5;
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
          background: white;
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
          justify-content: space-between;
          align-items: center;
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

        .dp-button.gray { background: #64748b; }
        .dp-button.red { background: #d03939; }
        .dp-button.blue { background: #317bd0; }

        .dp-button.outline {
          background: #ecf5f0;
          color: #167251;
        }

        .dp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .dp-field-group { margin-bottom: 17px; }

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

        textarea.dp-field { resize: vertical; }

        .dp-history-item {
          border: 1px solid #e1eae5;
          border-radius: 12px;
          background: white;
          padding: 15px;
          margin-bottom: 11px;
        }

        .dp-history-title {
          font-size: 14px;
          font-weight: 900;
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
          .dp-topbar { padding: 15px; }
          .dp-brand { font-size: 18px; }

          .dp-back {
            font-size: 0;
            padding: 9px;
          }

          .dp-container { padding: 12px; }

          .dp-banner {
            padding: 23px 18px;
            min-height: 137px;
            border-radius: 14px;
          }

          .dp-banner h1 { font-size: 24px; }

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

          .dp-profile { gap: 11px; }
          .dp-profile-name { font-size: 16px; }
          .dp-profile-meta { font-size: 11px; }

          .dp-small-stat { padding: 11px 5px; }
          .dp-small-stat strong { font-size: 19px; }
          .dp-small-stat span { font-size: 9px; }

          .dp-summary-grid {
            grid-template-columns: repeat(2,1fr);
          }

          .dp-summary-box { padding: 12px; }
          .dp-summary-box strong { font-size: 19px; }

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

          .dp-menu-name { font-size: 12px; }
          .dp-menu-detail { font-size: 10px; }

          .dp-menu-arrow {
            right: 9px;
            top: 15px;
          }

          .dp-category-grid {
            grid-template-columns: repeat(2,minmax(0,1fr));
          }

          .dp-panel-header h2 { font-size: 17px; }
        }

        @media(max-width:370px) {
          .dp-profile { flex-wrap: wrap; }
          .dp-summary-grid { grid-template-columns: 1fr 1fr; }
          .dp-menu-card { min-height: 146px; }
        }
      `}</style>

      <header className="dp-topbar">
        <div className="dp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button className="dp-back" type="button"
          onClick={() =>
            panel === "menu"
              ? router.push("/")
              : bukaPanel("menu")
          }>
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
          <p>Monitoring Kompetensi dan Evaluasi OJT</p>
        </section>

        <section className="dp-card">
          <div className="dp-profile">
            <div className="dp-avatar">
              {initials(nama)}
            </div>

            <div className="dp-profile-main">
              <div className="dp-profile-name">{nama}</div>
              <div className="dp-profile-meta">
                {program.peserta?.department || "—"}
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
            <span>Progres Pencapaian OJT</span>
            <strong>{ringkasan.progress}%</strong>
          </div>
          <Progress value={ringkasan.progress} />

          <div className="dp-metrics">
            <MiniStat
              label="Total Catatan"
              value={ringkasan.total}
            />
            <MiniStat
              label="Terverifikasi"
              value={ringkasan.verified}
            />
            <MiniStat
              label="Menunggu"
              value={ringkasan.pending}
            />
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
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-section-title">
                  Ringkasan Monitoring Peserta
                </h2>

                <button
                  className="dp-button outline"
                  onClick={refresh}
                  disabled={refreshing}
                  type="button"
                >
                  <Icon name="refresh" size={16} />{" "}
                  {refreshing ? "Memuat..." : "Refresh"}
                </button>
              </div>

              <p className="dp-muted">
                Hasil diperoleh dari catatan peserta ini.
                Kelengkapan monitoring bukan keputusan
                kelulusan atau kesiapan operasional.
              </p>

              <div className="dp-summary-grid">
                <div className="dp-summary-box">
                  <span>Rata-rata Post-Test</span>
                  <strong>{fmt(ringkasan.postAverage)}</strong>
                  <small>{postTests.length} nilai tercatat</small>
                </div>

                <div className="dp-summary-box">
                  <span>Rata-rata Praktik</span>
                  <strong>{fmt(ringkasan.practiceAverage)}</strong>
                  <small>{praktik.length} penilaian</small>
                </div>

                <div className="dp-summary-box">
                  <span>Samapta Terakhir</span>
                  <strong>
                    {fmt(ringkasan.samaptaLatest?.final)}
                  </strong>
                  <small>
                    {ringkasan.samaptaLatest
                      ? ringkasan.samaptaLatest.runPassed
                        ? "Tes lengkap · lari lulus"
                        : "Tes lengkap · lari belum lulus"
                      : "Belum ada tes lengkap"}
                  </small>
                </div>

                <div className="dp-summary-box">
                  <span>Progres SIMPER</span>
                  <strong>{ringkasan.simper.percentage}%</strong>
                  <Progress value={ringkasan.simper.percentage} />
                  <small>
                    {ringkasan.simper.released
                      ? "SIMPER telah terbit"
                      : "Belum seluruh tahap selesai"}
                  </small>
                </div>

                <div className="dp-summary-box">
                  <span>Aktivitas OJT</span>
                  <strong>
                    {ringkasan.activityWeeks}/25
                  </strong>
                  <Progress value={ringkasan.activityPct} />
                  <small>Minggu memiliki aktivitas</small>
                </div>

                <div className="dp-summary-box">
                  <span>Kompetensi Terverifikasi</span>
                  <strong>
                    {ringkasan.doneCategories}/6
                  </strong>
                  <Progress value={ringkasan.progress} />
                  <small>Enam kategori pencapaian</small>
                </div>
              </div>
            </section>

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
          </>
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
                <button type="button"
                  className="dp-button outline"
                  onClick={() => bukaPanel("menu")}>
                  Kembali
                </button>
              </div>

              <form onSubmit={simpanPencapaian}>
                <div className="dp-field-group">
                  <label htmlFor="dp-jenis">
                    Kategori Pencapaian
                  </label>
                  <select id="dp-jenis"
                    className="dp-field"
                    value={jenis}
                    onChange={e => setJenis(e.target.value)}
                    required>
                    {!kategori.length && (
                      <option value="">
                        Belum ada kategori
                      </option>
                    )}
                    {kategori.map(item => (
                      <option key={item.code}
                        value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-tanggal">
                    Tanggal Kegiatan
                  </label>
                  <input id="dp-tanggal"
                    type="date" className="dp-field"
                    value={tanggal}
                    onChange={e => setTanggal(e.target.value)}
                    required />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-deskripsi">
                    Keterangan Pencapaian
                  </label>
                  <textarea id="dp-deskripsi"
                    className="dp-field"
                    value={deskripsi}
                    onChange={e => setDeskripsi(e.target.value)}
                    rows={4}
                    placeholder="Uraikan kegiatan atau pencapaian peserta..."
                    required />
                </div>

                <div className="dp-actions">
                  <button type="submit" className="dp-button"
                    disabled={
                      menyimpan || Boolean(aksiId) ||
                      !kategori.length
                    }>
                    {menyimpan
                      ? "Menyimpan..."
                      : editId
                      ? "Simpan Perubahan"
                      : "Simpan Pencapaian"}
                  </button>

                  {editId && (
                    <button type="button"
                      className="dp-button gray"
                      onClick={resetPencapaian}
                      disabled={menyimpan}>
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
                    <div key={item.code}
                      className={
                        `dp-category ${verified ? "verified" : ""}`
                      }>
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

              {!catatan.length && (
                <p className="dp-muted">
                  Belum ada pencapaian yang diinput.
                </p>
              )}

              {catatan.map(item => (
                <div className="dp-history-item"
                  key={item.id}>
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
                      <button type="button"
                        className="dp-button"
                        disabled={
                          Boolean(aksiId) || menyimpan
                        }
                        onClick={() => verifikasi(item)}>
                        ✓ Verifikasi
                      </button>
                    )}

                    <button type="button"
                      className="dp-button blue"
                      disabled={
                        Boolean(aksiId) || menyimpan
                      }
                      onClick={() => editPencapaian(item)}>
                      Edit
                    </button>

                    <button type="button"
                      className="dp-button red"
                      disabled={
                        Boolean(aksiId) || menyimpan
                      }
                      onClick={() => hapusPencapaian(item)}>
                      {aksiId === item.id
                        ? "Memproses..." : "Hapus"}
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
                <button type="button"
                  className="dp-button outline"
                  onClick={() => bukaPanel("menu")}>
                  Kembali
                </button>
              </div>

              <div className="dp-metrics"
                style={{
                  gridTemplateColumns: "repeat(2,1fr)",
                  marginBottom: 22,
                }}>
                <MiniStat
                  label="Total Post-Test"
                  value={postTests.length}
                />
                <MiniStat
                  label="Rata-rata Nilai"
                  value={fmt(ringkasan.postAverage)}
                />
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
                  <input id="dp-tanggal-tes"
                    className="dp-field"
                    type="date"
                    value={tanggalTes}
                    onChange={e => setTanggalTes(e.target.value)}
                    required />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-nilai-tes">
                    Nilai Post-Test (0–100)
                  </label>
                  <input id="dp-nilai-tes"
                    className="dp-field"
                    type="number" min="0" max="100"
                    step="0.01"
                    value={nilaiTes}
                    onChange={e => setNilaiTes(e.target.value)}
                    placeholder="Contoh: 85"
                    required />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-catatan-tes">
                    Catatan Evaluasi
                  </label>
                  <textarea id="dp-catatan-tes"
                    className="dp-field" rows={3}
                    value={catatanTes}
                    onChange={e => setCatatanTes(e.target.value)}
                    placeholder="Catatan evaluasi peserta..." />
                </div>

                <div className="dp-actions">
                  <button type="submit"
                    className="dp-button"
                    disabled={
                      menyimpanTes || Boolean(aksiTesId)
                    }>
                    {menyimpanTes
                      ? "Menyimpan..."
                      : editTesId
                      ? "Simpan Perubahan Nilai"
                      : "Simpan Nilai Post-Test"}
                  </button>

                  {editTesId && (
                    <button type="button"
                      className="dp-button gray"
                      onClick={resetTes}
                      disabled={menyimpanTes}>
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

              {!postTests.length && (
                <p className="dp-muted">
                  Belum ada nilai Post-Test.
                </p>
              )}

              {postTests.map(item => (
                <div className="dp-history-item"
                  key={item.id}>
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
                    <button type="button"
                      className="dp-button blue"
                      disabled={
                        Boolean(aksiTesId) || menyimpanTes
                      }
                      onClick={() => editPostTest(item)}>
                      Edit
                    </button>

                    <button type="button"
                      className="dp-button red"
                      disabled={
                        Boolean(aksiTesId) || menyimpanTes
                      }
                      onClick={() => hapusPostTest(item)}>
                      {aksiTesId === item.id
                        ? "Menghapus..." : "Hapus"}
                    </button>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        <footer className="dp-footer">
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
