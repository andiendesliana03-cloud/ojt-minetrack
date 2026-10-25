
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const TOTAL_WEEKS = 25;
const TARGET_FISIK = 25;

const CATEGORY_TARGETS = [
  { name: "Fisik", target: 25, unit: "km" },
  { name: "Training", target: 4, unit: "kegiatan" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan" },
  { name: "Coaching", target: 1, unit: "kegiatan" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan" },
  { name: "Hazard", target: 2, unit: "kegiatan" },
];

function today() {
  const d = new Date();
  return new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function dateText(value) {
  if (!value) return "—";
  return String(value)
    .slice(0, 10)
    .split("-")
    .reverse()
    .join("/");
}

function fmtKm(value) {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function fmtScore(value) {
  return value === null || value === undefined
    ? "—"
    : Number(value).toFixed(2);
}

function initials(name) {
  return String(name || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function parseDate(value) {
  if (!value) return null;

  const parts = String(value)
    .slice(0, 10)
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    parts.some((n) => !Number.isInteger(n))
  ) {
    return null;
  }

  const [year, month, day] = parts;
  const d = new Date(Date.UTC(year, month - 1, day));

  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }

  return d;
}

function weekOf(dateValue, startValue) {
  const date = parseDate(dateValue);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const week =
    Math.floor(
      (date.getTime() - start.getTime()) / 604800000
    ) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function average(rows) {
  const values = rows
    .map((row) => row.score)
    .filter((value) => value !== null && value !== "")
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function Progress({ value }) {
  const percent = Math.min(
    100,
    Math.max(0, Number(value) || 0)
  );

  return (
    <div className="dp-progress">
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function Stat({ label, value, detail }) {
  return (
    <div className="dp-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
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
  const [praktik, setPraktik] = useState([]);
  const [samapta, setSamapta] = useState([]);
  const [simper, setSimper] = useState(null);

  const [panel, setPanel] = useState("menu");
  const [jenis, setJenis] = useState("");
  const [tanggal, setTanggal] = useState(today());
  const [deskripsi, setDeskripsi] = useState("");
  const [fisikKm, setFisikKm] = useState("0");
  const [fisikMeter, setFisikMeter] = useState("0");
  const [editId, setEditId] = useState(null);

  const [tanggalTes, setTanggalTes] = useState(today());
  const [nilaiTes, setNilaiTes] = useState("");
  const [catatanTes, setCatatanTes] = useState("");
  const [editTesId, setEditTesId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTest, setSavingTest] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [testActionId, setTestActionId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const fisikType = kategori.find(
    (item) => normalize(item.name) === "fisik"
  );

  const isFisik =
    Boolean(fisikType) && jenis === fisikType.code;

  const km = Number(fisikKm);
  const meter = Number(fisikMeter);

  const distanceValid =
    fisikKm !== "" &&
    fisikMeter !== "" &&
    Number.isInteger(km) &&
    Number.isInteger(meter) &&
    km >= 0 &&
    km <= 100 &&
    meter >= 0 &&
    meter <= 999 &&
    (km > 0 || meter > 0);

  const distance = distanceValid
    ? Number((km + meter / 1000).toFixed(3))
    : null;

  async function fetchRecords() {
    const results = await Promise.all([
      supabase
        .from("achievement_records")
        .select(
          "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
        )
        .eq("program_id", programId)
        .order("activity_date", { ascending: false }),

      supabase
        .from("post_test_scores")
        .select("id,test_date,score,notes,created_at")
        .eq("program_id", programId)
        .order("test_date", { ascending: false }),

      supabase
        .from("weekly_practice_scores")
        .select("id,practice_date,practice_name,score")
        .eq("program_id", programId),

      supabase
        .from("samapta_records")
        .select(
          "id,test_date,test_type,score,outcome,result_value"
        )
        .eq("program_id", programId),

      supabase
        .from("simper_records")
        .select(
          "id,administration_status,theory_status,practice_status,status,graduation_date,notes"
        )
        .eq("program_id", programId)
        .maybeSingle(),
    ]);

    const labels = [
      "Pencapaian",
      "Post-Test",
      "Praktik",
      "Samapta",
      "SIMPER",
    ];

    results.forEach((result, index) => {
      if (result.error) {
        throw new Error(
          `${labels[index]}: ${result.error.message}`
        );
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

  function applyRecords(records) {
    setCatatan(records.catatan);
    setPostTests(records.postTests);
    setPraktik(records.praktik);
    setSamapta(records.samapta);
    setSimper(records.simper);
  }

  async function refresh() {
    if (refreshing || loading || !programId) return;

    setRefreshing(true);
    setError("");
    setMessage("");

    try {
      applyRecords(await fetchRecords());
    } catch (err) {
      setError(err.message || "Gagal memperbarui data.");
    } finally {
      setRefreshing(false);
    }
  }

  async function reloadAchievements() {
    const { data, error: err } = await supabase
      .from("achievement_records")
      .select(
        "id,type_code,activity_date,description,distance_km,status,verified_by,created_at"
      )
      .eq("program_id", programId)
      .order("activity_date", { ascending: false });

    if (err) throw err;
    setCatatan(data || []);
  }

  async function reloadTests() {
    const { data, error: err } = await supabase
      .from("post_test_scores")
      .select("id,test_date,score,notes,created_at")
      .eq("program_id", programId)
      .order("test_date", { ascending: false });

    if (err) throw err;
    setPostTests(data || []);
  }

  useEffect(() => {
    if (!programId) {
      setError("ID program tidak tersedia.");
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);
      setError("");
      setMessage("");
      setPanel("menu");
      setProgram(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("id,full_name,role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (
          profile?.role === "participant" ||
          profile?.role === "peserta"
        ) {
          router.replace("/dashboard-peserta");
          return;
        }

        if (profile?.role !== "mentor") {
          throw new Error(
            "Halaman ini hanya dapat diakses Mentor."
          );
        }

        const [programResult, typesResult, records] =
          await Promise.all([
            supabase
              .from("ojt_programs")
              .select(`
                id,
                site,
                start_date,
                end_date,
                status,
                peserta:profiles!ojt_programs_participant_id_fkey(
                  full_name,
                  department
                )
              `)
              .eq("id", programId)
              .single(),

            supabase
              .from("achievement_types")
              .select("code,name")
              .order("name"),

            fetchRecords(),
          ]);

        if (programResult.error) {
          throw programResult.error;
        }

        if (typesResult.error) {
          throw typesResult.error;
        }

        if (!active) return;

        setMentor(profile);
        setProgram(programResult.data);
        setKategori(typesResult.data || []);
        setJenis(typesResult.data?.[0]?.code || "");
        applyRecords(records);
      } catch (err) {
        if (active) {
          setError(err.message || "Gagal memuat data.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [programId, router]);

  function openPanel(name) {
    setPanel(name);
    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetAchievement() {
    setEditId(null);
    setJenis(kategori[0]?.code || "");
    setTanggal(today());
    setDeskripsi("");
    setFisikKm("0");
    setFisikMeter("0");
  }

  function resetTest() {
    setEditTesId(null);
    setTanggalTes(today());
    setNilaiTes("");
    setCatatanTes("");
  }

  async function saveAchievement(event) {
    event.preventDefault();

    if (!mentor || !program || saving || actionId) return;

    if (!jenis || !tanggal) {
      setError("Pilih kategori dan tanggal kegiatan.");
      return;
    }

    if (weekOf(tanggal, program.start_date) === null) {
      setError(
        "Tanggal harus berada dalam periode Week 01–25 OJT."
      );
      return;
    }

    if (isFisik && !distanceValid) {
      setError(
        "Masukkan jarak kilometer dan meter yang valid."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        type_code: jenis,
        activity_date: tanggal,
        description: deskripsi.trim(),
        distance_km: isFisik ? distance : null,
        status: "pending",
        verified_by: null,
      };

      const result = editId
        ? await supabase
            .from("achievement_records")
            .update(payload)
            .eq("id", editId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("achievement_records")
            .insert({
              ...payload,
              program_id: programId,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error("Pencapaian tidak berhasil disimpan.");
      }

      await reloadAchievements();
      resetAchievement();

      setMessage(
        "Pencapaian berhasil disimpan dan menunggu verifikasi."
      );
    } catch (err) {
      setError(err.message || "Gagal menyimpan pencapaian.");
    } finally {
      setSaving(false);
    }
  }

  function editAchievement(item) {
    setEditId(item.id);
    setJenis(item.type_code);
    setTanggal(item.activity_date);
    setDeskripsi(item.description || "");

    const totalMeter = Math.round(
      Number(item.distance_km || 0) * 1000
    );

    setFisikKm(String(Math.floor(totalMeter / 1000)));
    setFisikMeter(String(totalMeter % 1000));

    openPanel("pencapaian");
  }

  async function verifyAchievement(item) {
    if (!mentor || actionId || saving) return;

    const itemFisik =
      Boolean(fisikType) &&
      item.type_code === fisikType.code;

    if (
      itemFisik &&
      (!Number.isFinite(Number(item.distance_km)) ||
        Number(item.distance_km) <= 0)
    ) {
      setError(
        "Jarak Fisik harus diisi sebelum diverifikasi."
      );
      return;
    }

    if (!window.confirm("Verifikasi pencapaian ini?")) {
      return;
    }

    setActionId(item.id);
    setError("");
    setMessage("");

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

      await reloadAchievements();
      setMessage("Pencapaian berhasil diverifikasi.");
    } catch (err) {
      setError(err.message || "Gagal verifikasi.");
    } finally {
      setActionId(null);
    }
  }

  async function deleteAchievement(item) {
    if (!mentor || actionId || saving) return;

    if (
      !window.confirm(
        "Hapus pencapaian ini secara permanen?"
      )
    ) {
      return;
    }

    setActionId(item.id);
    setError("");
    setMessage("");

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

      if (editId === item.id) resetAchievement();

      await reloadAchievements();
      setMessage("Pencapaian berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus pencapaian.");
    } finally {
      setActionId(null);
    }
  }

  async function saveTest(event) {
    event.preventDefault();

    if (!mentor || savingTest || testActionId) return;

    const score = Number(nilaiTes);

    if (
      !tanggalTes ||
      nilaiTes.trim() === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      setError("Nilai Post-Test harus antara 0–100.");
      return;
    }

    setSavingTest(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        test_date: tanggalTes,
        score,
        notes: catatanTes.trim() || null,
      };

      const result = editTesId
        ? await supabase
            .from("post_test_scores")
            .update(payload)
            .eq("id", editTesId)
            .eq("program_id", programId)
            .select("id")
        : await supabase
            .from("post_test_scores")
            .insert({
              ...payload,
              program_id: programId,
              created_by: mentor.id,
            })
            .select("id");

      if (result.error) throw result.error;

      if (!result.data?.length) {
        throw new Error("Nilai tidak berhasil disimpan.");
      }

      await reloadTests();
      resetTest();
      setMessage("Nilai Post-Test berhasil disimpan.");
    } catch (err) {
      setError(err.message || "Gagal menyimpan Post-Test.");
    } finally {
      setSavingTest(false);
    }
  }

  function editTest(item) {
    setEditTesId(item.id);
    setTanggalTes(item.test_date);
    setNilaiTes(String(item.score));
    setCatatanTes(item.notes || "");
    openPanel("posttest");
  }

  async function deleteTest(item) {
    if (!mentor || savingTest || testActionId) return;

    if (
      !window.confirm("Hapus nilai Post-Test ini?")
    ) {
      return;
    }

    setTestActionId(item.id);
    setError("");
    setMessage("");

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

      if (editTesId === item.id) resetTest();

      await reloadTests();
      setMessage("Nilai Post-Test berhasil dihapus.");
    } catch (err) {
      setError(err.message || "Gagal menghapus Post-Test.");
    } finally {
      setTestActionId(null);
    }
  }

  const summary = useMemo(() => {
    const verified = catatan.filter(
      (item) => item.status === "verified"
    );

    const pending = catatan.filter(
      (item) => item.status === "pending"
    );

    const fisikCode = kategori.find(
      (item) => normalize(item.name) === "fisik"
    )?.code;

    const validFisik = verified.filter(
      (item) =>
        item.type_code === fisikCode &&
        item.distance_km != null &&
        Number.isFinite(Number(item.distance_km)) &&
        weekOf(
          item.activity_date,
          program?.start_date
        ) !== null
    );

    const totalMeters = validFisik.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.distance_km) * 1000),
      0
    );

    const achievedWeeks = Array.from(
      { length: TOTAL_WEEKS },
      (_, index) => index + 1
    ).filter((week) => {
      const meters = validFisik
        .filter(
          (item) =>
            weekOf(
              item.activity_date,
              program?.start_date
            ) === week
        )
        .reduce(
          (sum, item) =>
            sum +
            Math.round(Number(item.distance_km) * 1000),
          0
        );

      return meters >= TARGET_FISIK * 1000;
    }).length;

    const categoryCount = CATEGORY_TARGETS.filter(
      (target) => {
        const type = kategori.find(
          (item) =>
            normalize(item.name) === normalize(target.name)
        );

        return (
          type &&
          verified.some(
            (item) => item.type_code === type.code
          )
        );
      }
    ).length;

    const activeWeeks = new Set();

    const addWeek = (date) => {
      const week = weekOf(date, program?.start_date);
      if (week !== null) activeWeeks.add(week);
    };

    catatan.forEach((item) => addWeek(item.activity_date));
    postTests.forEach((item) => addWeek(item.test_date));
    praktik.forEach((item) => addWeek(item.practice_date));
    samapta.forEach((item) => addWeek(item.test_date));

    return {
      total: catatan.length,
      verified: verified.length,
      pending: pending.length,
      categoryCount,
      progress: Math.round((categoryCount / 6) * 100),
      totalKm: totalMeters / 1000,
      achievedWeeks,
      activeWeeks: activeWeeks.size,
      postAverage: average(postTests),
      practiceAverage: average(praktik),
    };
  }, [
    catatan,
    kategori,
    postTests,
    praktik,
    samapta,
    program,
  ]);

  const nama =
    program?.peserta?.full_name || "Peserta OJT";

  const menus = [
    {
      title: "Monitoring Penilaian OJT",
      desc: "Buka 10 poin penilaian dan riwayat per minggu",
      icon: "📊",
      route: `/monitoring/${programId}`,
      featured: true,
    },
    {
      title: "Input Pencapaian",
      desc: "Input, edit, dan verifikasi kegiatan",
      icon: "📝",
      panel: "pencapaian",
    },
    {
      title: "Post-Test",
      desc: `${postTests.length} nilai tercatat`,
      icon: "📚",
      panel: "posttest",
    },
    {
      title: "Praktik Mingguan",
      desc: `${praktik.length} penilaian`,
      icon: "🛠️",
      route: `/praktik/${programId}`,
    },
    {
      title: "Samapta",
      desc: "Monitoring hasil tes kesamaptaan",
      icon: "🏃",
      route: `/samapta/${programId}`,
    },
    {
      title: "SIMPER",
      desc: "Monitoring tahapan SIMPER",
      icon: "🪪",
      route: `/simper/${programId}`,
    },
    {
      title: "Evaluasi Mingguan",
      desc: "Monitoring Week 01–25",
      icon: "📅",
      route: `/mingguan/${programId}`,
    },
    {
      title: "Grafik Perkembangan",
      desc: "Analisis perkembangan peserta",
      icon: "📈",
      route: `/analisis/${programId}`,
    },
    {
      title: "Evaluasi Kesiapan",
      desc: "Evaluasi kelengkapan indikator",
      icon: "✅",
      route: `/evaluasi/${programId}`,
    },
    {
      title: "Laporan OJT",
      desc: "Rapor dan cetak PDF",
      icon: "📄",
      route: `/laporan/${programId}`,
    },
  ];

  if (loading) {
    return (
      <main className="dp-loading">
        <h2>OJT MineTrack</h2>
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
        * {
          box-sizing: border-box;
        }

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
          color: white;
          padding: 17px 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
        }

        .dp-brand {
          font-size: 20px;
          font-weight: 900;
        }

        .dp-brand span {
          color: #27c991;
        }

        .dp-back {
          background: #ffffff18;
          border: 1px solid #ffffff30;
          border-radius: 9px;
          color: white;
          padding: 11px 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .dp-container {
          max-width: 1130px;
          margin: auto;
          padding: 22px;
        }

        .dp-banner {
          border-radius: 18px;
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

        .dp-banner small {
          color: #e7bd69;
          font-weight: 800;
          letter-spacing: 1.5px;
        }

        .dp-banner h1 {
          font-size: 29px;
          margin: 12px 0 7px;
        }

        .dp-banner p {
          color: #d5e9e0;
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
          flex: 1;
          min-width: 0;
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
          background: #dff6e9;
          color: #09784d;
          padding: 7px 11px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 800;
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
            90deg,
            #25bc87,
            #0c815c
          );
          border-radius: inherit;
        }

        .dp-progress-heading {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .dp-progress-heading strong {
          color: #087d59;
        }

        .dp-metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin-top: 16px;
        }

        .dp-stat {
          background: #f7faf8;
          border: 1px solid #eaf0eb;
          border-radius: 11px;
          padding: 13px;
          text-align: center;
          min-width: 0;
        }

        .dp-stat small {
          display: block;
          color: #71877b;
          font-size: 11px;
          line-height: 1.5;
        }

        .dp-stat strong {
          display: block;
          font-size: 21px;
          color: #193e30;
          margin: 7px 0;
          overflow-wrap: anywhere;
        }

        .dp-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }

        .dp-title {
          font-size: 18px;
          color: #17352b;
          margin: 0 0 12px;
          font-weight: 900;
        }

        .dp-muted {
          color: #819188;
          font-size: 12px;
          line-height: 1.6;
          margin: 0 0 16px;
        }

        .dp-menu-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 13px;
        }

        .dp-menu {
          text-align: left;
          position: relative;
          cursor: pointer;
          border: 1px solid #e3ebe7;
          border-radius: 14px;
          background: white;
          padding: 18px;
          min-height: 145px;
          font-family: inherit;
        }

        .dp-menu:hover {
          background: #f7fcf9;
          border-color: #9ed7bd;
        }

        .dp-menu.featured {
          background: #eaf8f0;
          border: 2px solid #58bc8e;
        }

        .dp-menu-icon {
          font-size: 25px;
          margin-bottom: 12px;
        }

        .dp-menu-name {
          font-size: 14px;
          font-weight: 900;
          color: #1d3831;
        }

        .dp-menu-desc {
          color: #809389;
          font-size: 11px;
          margin-top: 7px;
          line-height: 1.5;
        }

        .dp-menu-arrow {
          position: absolute;
          right: 14px;
          top: 15px;
          font-size: 24px;
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
          min-width: 0;
        }

        .dp-distance-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        textarea.dp-field {
          resize: vertical;
        }

        .dp-distance-total {
          background: #e8f8ef;
          border: 1px solid #bce7ce;
          border-radius: 12px;
          padding: 14px;
          margin-top: 13px;
        }

        .dp-distance-total span {
          display: block;
          font-size: 11px;
          color: #56796a;
        }

        .dp-distance-total strong {
          display: block;
          font-size: 26px;
          color: #087e57;
          margin: 7px 0;
        }

        .dp-history {
          border: 1px solid #e1eae5;
          border-radius: 12px;
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
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.6;
        }

        .dp-history-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 13px;
        }

        .dp-history-actions .dp-button {
          padding: 9px 12px;
          font-size: 11px;
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
        }

        @media (max-width: 760px) {
          .dp-topbar {
            padding: 15px;
          }

          .dp-brand {
            font-size: 18px;
          }

          .dp-back {
            font-size: 12px;
            padding: 9px;
          }

          .dp-container {
            padding: 12px;
          }

          .dp-banner {
            padding: 23px 18px;
          }

          .dp-banner h1 {
            font-size: 24px;
          }

          .dp-card {
            padding: 15px;
            margin-bottom: 12px;
          }

          .dp-avatar {
            width: 48px;
            height: 48px;
            font-size: 17px;
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

          .dp-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dp-stat {
            padding: 11px 6px;
          }

          .dp-stat strong {
            font-size: 18px;
          }

          .dp-menu-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .dp-menu {
            padding: 13px;
            min-height: 132px;
          }

          .dp-menu-name {
            font-size: 12px;
          }

          .dp-menu-desc {
            font-size: 10px;
          }

          .dp-title {
            font-size: 17px;
          }

          .dp-distance-total strong {
            font-size: 23px;
          }
        }
      `}</style>

      <header className="dp-topbar">
        <div className="dp-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="dp-back"
          onClick={() =>
            panel === "menu"
              ? router.push("/")
              : openPanel("menu")
          }
        >
          ← {panel === "menu" ? "Dashboard" : "Menu Peserta"}
        </button>
      </header>

      <div className="dp-container">
        <section className="dp-banner">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>
          <h1>Detail Peserta OJT</h1>
          <p>Monitoring Kompetensi dan Evaluasi OJT</p>
        </section>

        <section className="dp-card">
          <div className="dp-profile">
            <div className="dp-avatar">
              {initials(nama)}
            </div>

            <div className="dp-profile-main">
              <div className="dp-profile-name">
                {nama}
              </div>

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

          <div className="dp-progress-heading">
            <span>Kategori yang Memiliki Verifikasi</span>
            <strong>{summary.categoryCount}/6</strong>
          </div>

          <Progress value={summary.progress} />

          <div className="dp-metrics">
            <Stat
              label="Total Catatan"
              value={summary.total}
            />
            <Stat
              label="Terverifikasi"
              value={summary.verified}
            />
            <Stat
              label="Menunggu"
              value={summary.pending}
            />
          </div>
        </section>

        {error && (
          <div className="dp-alert error" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="dp-alert success" role="status">
            ✓ {message}
          </div>
        )}

        {panel === "menu" && (
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-title">
                  Ringkasan Monitoring Peserta
                </h2>

                <button
                  type="button"
                  className="dp-button outline"
                  onClick={refresh}
                  disabled={refreshing}
                >
                  {refreshing ? "Memuat..." : "↻ Refresh"}
                </button>
              </div>

              <p className="dp-muted">
                Ringkasan berdasarkan data peserta.
                Kategori yang memiliki verifikasi belum
                tentu telah mencapai target mingguannya.
              </p>

              <div className="dp-summary">
                <Stat
                  label="Rata-rata Post-Test"
                  value={fmtScore(summary.postAverage)}
                  detail={`${postTests.length} nilai`}
                />

                <Stat
                  label="Rata-rata Praktik"
                  value={fmtScore(summary.practiceAverage)}
                  detail={`${praktik.length} penilaian`}
                />

                <Stat
                  label="Catatan Samapta"
                  value={samapta.length}
                  detail="Hasil tes tercatat"
                />

                <Stat
                  label="Data SIMPER"
                  value={simper ? "Tersedia" : "Belum ada"}
                />

                <Stat
                  label="Minggu dengan Aktivitas"
                  value={`${summary.activeWeeks}/25`}
                />

                <Stat
                  label="Kategori Terverifikasi"
                  value={`${summary.categoryCount}/6`}
                />

                <Stat
                  label="Total Fisik Terverifikasi"
                  value={`${fmtKm(summary.totalKm)} km`}
                  detail="Target keseluruhan 625 km"
                />

                <Stat
                  label="Minggu Fisik Tercapai"
                  value={`${summary.achievedWeeks}/25`}
                  detail="Target 25 km per minggu"
                />
              </div>
            </section>

            <section className="dp-card">
              <h2 className="dp-title">
                Menu Monitoring & Penilaian
              </h2>

              <p className="dp-muted">
                Klik Monitoring Penilaian OJT untuk
                melihat kategori penilaian secara
                terpisah dan memilih minggu monitoring.
              </p>

              <div className="dp-menu-grid">
                {menus.map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`dp-menu ${
                      item.featured ? "featured" : ""
                    }`}
                    onClick={() =>
                      item.route
                        ? router.push(item.route)
                        : openPanel(item.panel)
                    }
                  >
                    <div className="dp-menu-icon">
                      {item.icon}
                    </div>

                    <div className="dp-menu-name">
                      {item.title}
                    </div>

                    <div className="dp-menu-desc">
                      {item.desc}
                    </div>

                    <span className="dp-menu-arrow">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {panel === "pencapaian" && (
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-title">
                  {editId
                    ? "Edit Pencapaian OJT"
                    : "Input Pencapaian OJT"}
                </h2>

                <button
                  type="button"
                  className="dp-button outline"
                  onClick={() => openPanel("menu")}
                >
                  Kembali
                </button>
              </div>

              <form onSubmit={saveAchievement}>
                <div className="dp-field-group">
                  <label htmlFor="dp-jenis">
                    Kategori Pencapaian
                  </label>

                  <select
                    id="dp-jenis"
                    className="dp-field"
                    value={jenis}
                    onChange={(event) =>
                      setJenis(event.target.value)
                    }
                    required
                  >
                    {!kategori.length && (
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
                    onChange={(event) =>
                      setTanggal(event.target.value)
                    }
                    required
                  />

                  <p
                    className="dp-muted"
                    style={{
                      marginTop: 7,
                      marginBottom: 0,
                    }}
                  >
                    {weekOf(
                      tanggal,
                      program.start_date
                    ) !== null
                      ? `Week ${String(
                          weekOf(
                            tanggal,
                            program.start_date
                          )
                        ).padStart(2, "0")}`
                      : "Pilih tanggal dalam 25 minggu OJT."}
                  </p>
                </div>

                {isFisik && (
                  <div className="dp-field-group">
                    <label>Jarak Tempuh Fisik</label>

                    <div className="dp-distance-grid">
                      <div>
                        <label htmlFor="dp-km">
                          Kilometer (km)
                        </label>

                        <select
                          id="dp-km"
                          className="dp-field"
                          value={fisikKm}
                          onChange={(event) =>
                            setFisikKm(event.target.value)
                          }
                        >
                          {Array.from(
                            { length: 101 },
                            (_, index) => (
                              <option
                                key={index}
                                value={index}
                              >
                                {index} km
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="dp-meter">
                          Tambahan Meter (m)
                        </label>

                        <input
                          id="dp-meter"
                          className="dp-field"
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="999"
                          step="1"
                          value={fisikMeter}
                          onChange={(event) =>
                            setFisikMeter(event.target.value)
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="dp-distance-total">
                      <span>Total Jarak Kegiatan</span>

                      <strong>
                        {distance === null
                          ? "—"
                          : fmtKm(distance)}{" "}
                        km
                      </strong>

                      <span>
                        Target 25 km per minggu.
                        Jarak dihitung setelah
                        diverifikasi Mentor.
                      </span>
                    </div>
                  </div>
                )}

                <div className="dp-field-group">
                  <label htmlFor="dp-deskripsi">
                    Keterangan Pencapaian (Opsional)
                  </label>

                  <textarea
                    id="dp-deskripsi"
                    className="dp-field"
                    rows={4}
                    value={deskripsi}
                    onChange={(event) =>
                      setDeskripsi(event.target.value)
                    }
                    placeholder={
                      isFisik
                        ? "Contoh: Latihan lari pagi."
                        : "Catatan kegiatan jika diperlukan..."
                    }
                  />
                </div>

                <div className="dp-actions">
                  <button
                    type="submit"
                    className="dp-button"
                    disabled={
                      saving ||
                      Boolean(actionId) ||
                      !kategori.length
                    }
                  >
                    {saving
                      ? "Menyimpan..."
                      : editId
                      ? "Simpan Perubahan"
                      : "Simpan Pencapaian"}
                  </button>

                  {editId && (
                    <button
                      type="button"
                      className="dp-button gray"
                      onClick={resetAchievement}
                      disabled={saving}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dp-card">
              <h2 className="dp-title">
                Lihat Hasil Monitoring
              </h2>

              <p className="dp-muted">
                Monitoring 25 minggu sekarang dibuka
                melalui halaman terpisah. Pilih kategori
                Fisik atau kategori lainnya untuk
                melihat hasil dan riwayat kegiatan.
              </p>

              <button
                type="button"
                className="dp-button"
                onClick={() =>
                  router.push(`/monitoring/${programId}`)
                }
              >
                Buka Monitoring Penilaian →
              </button>
            </section>

            <section className="dp-card">
              <h2 className="dp-title">
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

              {catatan.map((item) => {
                const minggu = weekOf(
                  item.activity_date,
                  program.start_date
                );

                return (
                  <div
                    className="dp-history"
                    key={item.id}
                  >
                    <div className="dp-history-title">
                      {kategori.find(
                        (k) =>
                          k.code === item.type_code
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

                      {minggu !== null && (
                        <>
                          {" · Week "}
                          {String(minggu).padStart(2, "0")}
                        </>
                      )}
                    </div>

                    {item.description && (
                      <p className="dp-history-desc">
                        {item.description}
                      </p>
                    )}

                    {item.distance_km != null && (
                      <div className="dp-history-meta">
                        Jarak Fisik:{" "}
                        <strong>
                          {fmtKm(item.distance_km)} km
                        </strong>
                      </div>
                    )}

                    <div className="dp-history-actions">
                      {item.status === "pending" && (
                        <button
                          type="button"
                          className="dp-button"
                          disabled={
                            Boolean(actionId) || saving
                          }
                          onClick={() =>
                            verifyAchievement(item)
                          }
                        >
                          ✓ Verifikasi
                        </button>
                      )}

                      <button
                        type="button"
                        className="dp-button blue"
                        disabled={
                          Boolean(actionId) || saving
                        }
                        onClick={() =>
                          editAchievement(item)
                        }
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="dp-button red"
                        disabled={
                          Boolean(actionId) || saving
                        }
                        onClick={() =>
                          deleteAchievement(item)
                        }
                      >
                        {actionId === item.id
                          ? "Memproses..."
                          : "Hapus"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {panel === "posttest" && (
          <>
            <section className="dp-card">
              <div className="dp-panel-header">
                <h2 className="dp-title">
                  Monitoring Post-Test
                </h2>

                <button
                  type="button"
                  className="dp-button outline"
                  onClick={() => openPanel("menu")}
                >
                  Kembali
                </button>
              </div>

              <div
                className="dp-metrics"
                style={{
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  marginBottom: 22,
                }}
              >
                <Stat
                  label="Total Post-Test"
                  value={postTests.length}
                />

                <Stat
                  label="Rata-rata Nilai"
                  value={fmtScore(summary.postAverage)}
                />
              </div>

              <h3 className="dp-title">
                {editTesId
                  ? "Edit Nilai Post-Test"
                  : "Input Nilai Post-Test"}
              </h3>

              <form onSubmit={saveTest}>
                <div className="dp-field-group">
                  <label htmlFor="dp-test-date">
                    Tanggal Pelaksanaan
                  </label>

                  <input
                    id="dp-test-date"
                    className="dp-field"
                    type="date"
                    value={tanggalTes}
                    onChange={(event) =>
                      setTanggalTes(event.target.value)
                    }
                    required
                  />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-test-score">
                    Nilai Post-Test (0–100)
                  </label>

                  <input
                    id="dp-test-score"
                    className="dp-field"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={nilaiTes}
                    onChange={(event) =>
                      setNilaiTes(event.target.value)
                    }
                    required
                  />
                </div>

                <div className="dp-field-group">
                  <label htmlFor="dp-test-notes">
                    Catatan Evaluasi
                  </label>

                  <textarea
                    id="dp-test-notes"
                    className="dp-field"
                    rows={3}
                    value={catatanTes}
                    onChange={(event) =>
                      setCatatanTes(event.target.value)
                    }
                    placeholder="Catatan evaluasi peserta..."
                  />
                </div>

                <div className="dp-actions">
                  <button
                    type="submit"
                    className="dp-button"
                    disabled={
                      savingTest ||
                      Boolean(testActionId)
                    }
                  >
                    {savingTest
                      ? "Menyimpan..."
                      : editTesId
                      ? "Simpan Perubahan Nilai"
                      : "Simpan Nilai Post-Test"}
                  </button>

                  {editTesId && (
                    <button
                      type="button"
                      className="dp-button gray"
                      onClick={resetTest}
                      disabled={savingTest}
                    >
                      Batal Edit
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="dp-card">
              <h2 className="dp-title">
                Riwayat Nilai Post-Test
              </h2>

              {!postTests.length && (
                <p className="dp-muted">
                  Belum ada nilai Post-Test.
                </p>
              )}

              {postTests.map((item) => (
                <div
                  className="dp-history"
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
                        Boolean(testActionId) ||
                        savingTest
                      }
                      onClick={() => editTest(item)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="dp-button red"
                      disabled={
                        Boolean(testActionId) ||
                        savingTest
                      }
                      onClick={() => deleteTest(item)}
                    >
                      {testActionId === item.id
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
          OJT MineTrack v2.0 · Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}
