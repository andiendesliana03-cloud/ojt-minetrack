
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

// ====================================================
// OJT MINETRACK V2.0
// EVALUASI KESIAPAN & LAPORAN OJT
//
// AKSES ADMIN PERMANEN TANPA PESERTA:
// /evaluasi/admin-review
// /laporan/admin-review
//
// TIDAK MEMBUAT DATA FIKTIF
// TIDAK MENGUBAH DATABASE
// ====================================================

const TOTAL_WEEKS = 25;
const ADMIN_REVIEW_ID = "admin-review";

const CATEGORIES = [
  { name: "Fisik", target: 25, unit: "km", icon: "🏃" },
  { name: "Training", target: 4, unit: "kegiatan", icon: "📚" },
  { name: "Sosialisasi", target: 3, unit: "kegiatan", icon: "👥" },
  { name: "Coaching", target: 1, unit: "kegiatan", icon: "💬" },
  { name: "Orientasi Area", target: 2, unit: "kegiatan", icon: "🧭" },
  { name: "Hazard", target: 2, unit: "kegiatan", icon: "⚠️" },
];

const INDICATOR_TITLES = [
  "Pencapaian Kompetensi OJT",
  "Post-Test",
  "Praktik Mingguan",
  "Samapta",
  "Penerbitan SIMPER",
  "Cakupan Aktivitas 25 Minggu",
];

const SIMPER_META_START = "[[SIMPER_V2]]";
const SIMPER_META_END = "[[/SIMPER_V2]]";

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value) {
  return String(value ?? "").trim().toLowerCase();
}

function dateText(value) {
  if (!value) return "—";

  const date = String(value).slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? date.split("-").reverse().join("/")
    : "—";
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

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function weekOf(value, startValue) {
  const date = parseDate(value);
  const start = parseDate(startValue);

  if (!date || !start) return null;

  const days = Math.round(
    (date.getTime() - start.getTime()) / 86400000
  );

  if (days < 0) return null;

  const week = Math.floor(days / 7) + 1;

  return week >= 1 && week <= TOTAL_WEEKS
    ? week
    : null;
}

function hasScore(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(Number(value))
  );
}

function average(rows) {
  const values = rows
    .filter((row) => hasScore(row.score))
    .map((row) => Number(row.score));

  if (!values.length) return null;

  return (
    values.reduce((sum, value) => sum + value, 0) /
    values.length
  );
}

function fmt(value) {
  return hasScore(value)
    ? Number(value).toFixed(2)
    : "—";
}

function fmtNumber(value, decimals = 0) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return Number(value).toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function initials(value) {
  return String(value || "Peserta OJT")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((item) => item[0] || "")
    .join("")
    .toUpperCase();
}

function getParticipant(program) {
  if (Array.isArray(program?.peserta)) {
    return program.peserta[0] || null;
  }

  return program?.peserta || null;
}

// ====================================================
// SIMPER V2 / V4
// RUMUS DAN ATURAN LAMA DIPERTAHANKAN
// ====================================================

function parseSimperMetadata(notes) {
  const text = String(notes || "");

  const start = text.lastIndexOf(SIMPER_META_START);
  const end = text.lastIndexOf(SIMPER_META_END);

  if (start < 0 || end <= start) return null;

  try {
    const metadata = JSON.parse(
      text.slice(
        start + SIMPER_META_START.length,
        end
      )
    );

    if (
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      [2, 4].includes(Number(metadata.version))
    ) {
      return metadata;
    }

    return null;
  } catch {
    return null;
  }
}

function getSimperProgress(simper) {
  const empty = {
    percentage: 0,
    completedSteps: 0,
    totalSteps: 3,
    theory: false,
    practice: false,
    orientation: false,
    released: false,
    meta: null,
    legacy: false,
  };

  if (!simper) return empty;

  const meta = parseSimperMetadata(simper.notes);

  const theory =
    normalizeRole(simper.theory_status) === "passed";

  const practice =
    normalizeRole(simper.practice_status) === "passed";

  const orientation =
    normalizeRole(meta?.orientation_status) ===
    "completed";

  const completedSteps = [
    theory,
    practice,
    orientation,
  ].filter(Boolean).length;

  const percentage = [0, 33, 67, 100][completedSteps];

  const released =
    normalizeRole(meta?.issuance_status) === "issued" &&
    Boolean(simper.graduation_date);

  return {
    percentage,
    completedSteps,
    totalSteps: 3,
    theory,
    practice,
    orientation,
    released,
    meta,
    legacy:
      !meta &&
      normalizeRole(simper.status) === "passed",
  };
}

// ====================================================
// SAMAPTA
// RUMUS ASLI DIPERTAHANKAN
// ====================================================

function getSamaptaResults(records) {
  const groups = new Map();

  records.forEach((item) => {
    if (!item.test_date) return;

    const date = String(item.test_date).slice(0, 10);

    if (!groups.has(date)) {
      groups.set(date, []);
    }

    groups.get(date).push(item);
  });

  const results = [];

  groups.forEach((items, testDate) => {
    const findScore = (type) => {
      const item = items.find(
        (row) =>
          normalize(row.test_type) === normalize(type)
      );

      if (!item || !hasScore(item.score)) {
        return null;
      }

      return Number(item.score);
    };

    const a = findScore("Lari 12 Menit");

    const parts = [
      findScore("Pull-Up"),
      findScore("Push-Up"),
      findScore("Sit-Up"),
      findScore("Shuttle Run"),
    ];

    if (
      a === null ||
      parts.some((value) => value === null)
    ) {
      return;
    }

    const b =
      parts.reduce((sum, value) => sum + value, 0) /
      4;

    const running = items.find(
      (item) =>
        normalize(item.test_type) === "lari12menit"
    );

    const distance = hasScore(running?.result_value)
      ? Number(running.result_value)
      : null;

    results.push({
      date: testDate,
      a,
      b,
      final: (a + b) / 2,
      distance,
      outcome:
        distance === null
          ? "pending"
          : distance >= 2600
          ? "pass"
          : "fail",
    });
  });

  return results.sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

// ====================================================
// ACHIEVEMENT
// TARGET KUMULATIF 25 MINGGU
// FORMULA ASLI DIPERTAHANKAN
// ====================================================

function calculateCategories(
  types,
  achievements,
  startDate
) {
  return CATEGORIES.map((category) => {
    const type = types.find(
      (item) =>
        normalize(item.name) ===
          normalize(category.name) ||
        (
          category.name === "Training" &&
          normalize(item.name) === "internaltraining"
        )
    );

    const verifiedRecords = type
      ? achievements.filter(
          (record) =>
            normalize(record.type_code) ===
              normalize(type.code) &&
            normalizeRole(record.status) ===
              "verified" &&
            weekOf(
              record.activity_date,
              startDate
            ) !== null
        )
      : [];

    const weekly = Array.from(
      { length: TOTAL_WEEKS },
      (_, index) => {
        const week = index + 1;

        const matching = verifiedRecords.filter(
          (record) =>
            weekOf(
              record.activity_date,
              startDate
            ) === week
        );

        const achieved =
          category.name === "Fisik"
            ? matching.reduce(
                (sum, record) => {
                  const km = Number(record.distance_km);

                  return sum + (
                    Number.isFinite(km) && km > 0
                      ? km
                      : 0
                  );
                },
                0
              )
            : matching.length;

        return {
          week,
          achieved,
          count: matching.length,
        };
      }
    );

    const totalAchieved = weekly.reduce(
      (sum, item) => sum + item.achieved,
      0
    );

    const percentage = Math.min(
      100,
      Math.round(
        (totalAchieved / category.target) * 100
      )
    );

    return {
      ...category,
      code: type?.code || null,
      verified: verifiedRecords.length,
      weekly,
      percentage,
      completed: totalAchieved >= category.target,
      totalAchieved,
    };
  });
}

// ====================================================
// KOMPONEN UI
// ====================================================

function ProgressBar({
  value,
  color = "#119769",
  unavailable = false,
}) {
  const safeValue =
    !unavailable &&
    Number.isFinite(Number(value))
      ? Math.max(
          0,
          Math.min(100, Number(value))
        )
      : 0;

  return (
    <div className="oi-progress-track">
      {!unavailable && (
        <div
          className="oi-progress-fill"
          style={{
            width: `${safeValue}%`,
            background: color,
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, helper }) {
  return (
    <div className="oi-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function Indicator({
  title,
  detail,
  passed,
  unavailable = false,
}) {
  return (
    <div className="oi-indicator">
      <div
        className={
          passed && !unavailable
            ? "oi-indicator-icon completed"
            : "oi-indicator-icon"
        }
      >
        {unavailable
          ? "—"
          : passed
          ? "✓"
          : "○"}
      </div>

      <div className="oi-indicator-content">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>

      <span
        className={
          passed && !unavailable
            ? "oi-pill completed"
            : "oi-pill"
        }
      >
        {unavailable
          ? "Belum Ada Data"
          : passed
          ? "Terpenuhi"
          : "Belum Terpenuhi"}
      </span>
    </div>
  );
}

function History({
  title,
  rows,
  dateKey,
  nameKey,
}) {
  return (
    <section className="oi-card oi-history-card">
      <h2>{title}</h2>

      {!rows.length ? (
        <div className="oi-empty">
          Belum ada data.
        </div>
      ) : (
        rows.map((item) => (
          <div className="oi-history" key={item.id}>
            <div className="oi-history-info">
              <strong>
                {nameKey
                  ? item[nameKey] || title
                  : dateText(item[dateKey])}
              </strong>

              <span>
                {dateText(item[dateKey])}
              </span>

              {item.notes && (
                <p>{item.notes}</p>
              )}
            </div>

            <div className="oi-history-score">
              {fmt(item.score)}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

// ====================================================
// KOMPONEN UTAMA
// DIPAKAI EVALUASI DAN LAPORAN
// ====================================================

export default function OjtInsights({ id, mode }) {
  const router = useRouter();

  const programId = Array.isArray(id) ? id[0] : id;
  const isReport = mode === "laporan";
  const isAdminReview =
    programId === ADMIN_REVIEW_ID;

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ==================================================
  // QUERY DATA MONITORING ASLI
  // ==================================================

  const getMonitoringData = useCallback(
    async (targetId) => {
      const results = await Promise.all([
        supabase
          .from("achievement_types")
          .select("code,name"),

        supabase
          .from("achievement_records")
          .select(
            "id,type_code,status,activity_date,distance_km"
          )
          .eq("program_id", targetId),

        supabase
          .from("post_test_scores")
          .select("id,test_date,score,notes")
          .eq("program_id", targetId)
          .order("test_date"),

        supabase
          .from("weekly_practice_scores")
          .select(
            "id,practice_date,practice_name,score,notes"
          )
          .eq("program_id", targetId)
          .order("practice_date"),

        supabase
          .from("samapta_records")
          .select(
            "id,test_date,test_type,score,outcome,result_value"
          )
          .eq("program_id", targetId)
          .order("test_date"),

        supabase
          .from("simper_records")
          .select(
            "id,status,administration_status,training_status,theory_status,practice_status,application_date,graduation_date,notes"
          )
          .eq("program_id", targetId)
          .maybeSingle(),
      ]);

      for (const result of results) {
        if (result.error) throw result.error;
      }

      return {
        types: results[0].data || [],
        ach: results[1].data || [],
        post: results[2].data || [],
        practice: results[3].data || [],
        samapta: results[4].data || [],
        simper: results[5].data || null,
      };
    },
    []
  );

  // ==================================================
  // VERIFIKASI AKSES
  //
  // admin-review KHUSUS ROLE ADMIN
  // TIDAK MELAKUKAN QUERY PROGRAM FIKTIF
  //
  // AKSES PROGRAM ASLI DIPERTAHANKAN
  // ==================================================

  const verifyAccess = useCallback(async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error(
        "Sesi login tidak tersedia. Silakan login kembali."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!profile) {
      throw new Error(
        "Profil akun tidak ditemukan."
      );
    }

    const role = normalizeRole(profile.role);

    if (isAdminReview) {
      if (role !== "admin") {
        throw new Error(
          "Tinjauan tanpa peserta hanya dapat dibuka oleh Admin."
        );
      }

      return {
        user,
        profile,
        program: null,
        adminReview: true,
      };
    }

    const isManager =
      role === "admin" || role === "mentor";

    const isParticipant =
      role === "participant" || role === "peserta";

    if (!isManager && !isParticipant) {
      throw new Error(
        "Role akun tidak memiliki akses monitoring OJT."
      );
    }

    let programQuery = supabase
      .from("ojt_programs")
      .select(`
        id,
        participant_id,
        site,
        status,
        start_date,
        end_date,
        legacy_access,
        peserta:profiles!ojt_programs_participant_id_fkey(
          full_name,
          department
        )
      `)
      .eq("id", programId);

    if (isParticipant) {
      programQuery = programQuery.eq(
        "participant_id",
        user.id
      );
    }

    const {
      data: program,
      error: programError,
    } = await programQuery.maybeSingle();

    if (programError) throw programError;

    if (!program) {
      throw new Error(
        "Program OJT tidak ditemukan atau tidak dapat diakses."
      );
    }

    if (!parseDate(program.start_date)) {
      throw new Error(
        "Tanggal mulai program OJT belum valid."
      );
    }

    if (isParticipant) {
      if (program.participant_id !== user.id) {
        throw new Error(
          "Anda hanya dapat melihat program OJT milik sendiri."
        );
      }

      if (
        normalizeRole(program.status) !== "active"
      ) {
        throw new Error(
          "Program OJT belum aktif."
        );
      }

      const [
        newResult,
        oldResult,
      ] = await Promise.all([
        supabase
          .from("ojt_registration_requests")
          .select("status")
          .eq("participant_id", user.id),

        supabase
          .from("participant_registrations")
          .select("status")
          .eq("user_id", user.id),
      ]);

      if (newResult.error) {
        throw new Error(
          "Gagal memeriksa pendaftaran baru: " +
          newResult.error.message
        );
      }

      if (oldResult.error) {
        throw new Error(
          "Gagal memeriksa pendaftaran lama: " +
          oldResult.error.message
        );
      }

      const approvedNew = (
        newResult.data || []
      ).some(
        (item) =>
          normalizeRole(item.status) === "approved"
      );

      const approvedOld = (
        oldResult.data || []
      ).some(
        (item) =>
          normalizeRole(item.status) === "approved"
      );

      if (
        !approvedNew &&
        !approvedOld &&
        program.legacy_access !== true
      ) {
        throw new Error(
          "Program belum memiliki persetujuan akses yang sah."
        );
      }
    }

    return {
      user,
      profile,
      program,
      adminReview: false,
    };
  }, [programId, isAdminReview]);

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    let alive = true;

    async function initialize() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        if (!programId) {
          throw new Error(
            "ID program OJT tidak tersedia."
          );
        }

        const access = await verifyAccess();

        if (!alive) return;

        // Tidak membuat program palsu.
        // Data kosong hanya berfungsi sebagai
        // penanda hasil pemeriksaan akses Admin.
        if (access.adminReview) {
          setData({
            viewerId: access.user.id,
            profile: access.profile,
            program: null,
            adminReview: true,
            types: [],
            ach: [],
            post: [],
            practice: [],
            samapta: [],
            simper: null,
          });

          return;
        }

        const monitoring = await getMonitoringData(
          access.program.id
        );

        if (!alive) return;

        setData({
          viewerId: access.user.id,
          profile: access.profile,
          program: access.program,
          adminReview: false,
          ...monitoring,
        });
      } catch (err) {
        if (!alive) return;

        if (
          String(err?.message || "").includes(
            "Sesi login tidak tersedia"
          )
        ) {
          router.replace("/login");
          return;
        }

        setError(
          err?.message ||
          "Gagal memuat data monitoring OJT."
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    initialize();

    return () => {
      alive = false;
    };
  }, [
    programId,
    verifyAccess,
    getMonitoringData,
    router,
  ]);

  // ==================================================
  // REFRESH & VERIFIKASI ULANG
  // ==================================================

  async function refresh() {
    if (!programId || refreshing || !data) return;

    setRefreshing(true);
    setError("");

    try {
      const access = await verifyAccess();

      if (access.user.id !== data.viewerId) {
        throw new Error(
          "Akun login telah berubah. Buka ulang halaman."
        );
      }

      if (access.adminReview) {
        setData({
          viewerId: access.user.id,
          profile: access.profile,
          program: null,
          adminReview: true,
          types: [],
          ach: [],
          post: [],
          practice: [],
          samapta: [],
          simper: null,
        });

        return;
      }

      const monitoring = await getMonitoringData(
        access.program.id
      );

      setData({
        viewerId: access.user.id,
        profile: access.profile,
        program: access.program,
        adminReview: false,
        ...monitoring,
      });
    } catch (err) {
      setData(null);

      setError(
        err?.message ||
        "Gagal memperbarui data monitoring."
      );
    } finally {
      setRefreshing(false);
    }
  }

  // ==================================================
  // ANALISIS PROGRAM ASLI
  // TIDAK DIHITUNG DALAM ADMIN REVIEW KOSONG
  // ==================================================

  const analysis = useMemo(() => {
    if (!data?.program) return null;

    const {
      program,
      types,
      ach,
      post,
      practice,
      samapta,
      simper,
    } = data;

    const categories = calculateCategories(
      types,
      ach,
      program.start_date
    );

    const achievementPct = Math.round(
      categories.reduce(
        (sum, category) =>
          sum + category.percentage,
        0
      ) / CATEGORIES.length
    );

    const completedCategories = categories.filter(
      (category) => category.completed
    ).length;

    const totalVerified = categories.reduce(
      (sum, category) => sum + category.verified,
      0
    );

    const samaptaResults = getSamaptaResults(samapta);

    const latestSamapta = samaptaResults.length
      ? samaptaResults[samaptaResults.length - 1]
      : null;

    const simperProgress = getSimperProgress(simper);

    const activityWeeks = new Set();

    const markWeek = (value) => {
      const week = weekOf(value, program.start_date);

      if (week !== null) {
        activityWeeks.add(week);
      }
    };

    ach.forEach((item) =>
      markWeek(item.activity_date)
    );

    post.forEach((item) =>
      markWeek(item.test_date)
    );

    practice.forEach((item) =>
      markWeek(item.practice_date)
    );

    samapta.forEach((item) =>
      markWeek(item.test_date)
    );

    const activityCount = activityWeeks.size;

    const validPost = post.filter(
      (item) => hasScore(item.score)
    );

    const validPractice = practice.filter(
      (item) => hasScore(item.score)
    );

    const indicators = [
      {
        title: "Pencapaian Kompetensi OJT",
        detail:
          `${completedCategories} dari 6 kategori ` +
          "mencapai target program",
        ok: completedCategories === 6,
      },
      {
        title: "Post-Test",
        detail:
          `${validPost.length} hasil tes ` +
          "memiliki nilai valid",
        ok: validPost.length > 0,
      },
      {
        title: "Praktik Mingguan",
        detail:
          `${validPractice.length} penilaian ` +
          "memiliki nilai valid",
        ok: validPractice.length > 0,
      },
      {
        title: "Samapta",
        detail: latestSamapta
          ? "Tes lengkap terakhir: " +
            `${dateText(latestSamapta.date)} · ` +
            (
              latestSamapta.outcome === "pass"
                ? "Lari lulus"
                : latestSamapta.outcome === "fail"
                ? "Lari tidak lulus"
                : "Status lari belum tersedia"
            )
          : "Belum ada lima komponen tes lengkap",
        ok: Boolean(latestSamapta),
      },
      {
        title: "Penerbitan SIMPER",
        detail: simperProgress.released
          ? "SIMPER tercatat telah diterbitkan"
          : (
              `${simperProgress.percentage}% progres KMKOP; ` +
              "status penerbitan belum terverifikasi"
            ),
        ok: simperProgress.released,
      },
      {
        title: "Cakupan Aktivitas 25 Minggu",
        detail:
          `${activityCount} dari 25 minggu ` +
          "memiliki catatan aktivitas",
        ok: activityCount === TOTAL_WEEKS,
      },
    ];

    const fulfilled = indicators.filter(
      (item) => item.ok
    ).length;

    const completeness = Math.round(
      (fulfilled / indicators.length) * 100
    );

    return {
      categories,
      achievementPct,
      completedCategories,
      totalVerified,
      theoryAverage: average(post),
      practiceAverage: average(practice),
      samaptaResults,
      latestSamapta,
      simperProgress,
      activityCount,
      activityPct: Math.round(
        (activityCount / TOTAL_WEEKS) * 100
      ),
      indicators,
      fulfilled,
      completeness,
    };
  }, [data]);

  // ==================================================
  // LOADING / ERROR
  // ==================================================

  if (loading) {
    return (
      <main className="oi-loading">
        Memeriksa akses dan memuat data OJT...
      </main>
    );
  }

  if (!data || (!isAdminReview && !analysis)) {
    return (
      <main className="oi-loading">
        <h2>Akses Tidak Tersedia</h2>

        <p>
          {error || "Data belum tersedia."}
        </p>

        <button
          type="button"
          onClick={() => router.push("/dashboard-peserta")}
        >
          Kembali ke Dashboard
        </button>
      </main>
    );
  }

  const {
    program,
    profile,
    post,
    practice,
    simper,
  } = data;

  const review = data.adminReview === true;

  const participant = getParticipant(program);

  const participantName = review
    ? "Belum Ada Peserta"
    : participant?.full_name || "Peserta OJT";

  const role = normalizeRole(profile.role);

  const viewerIsManager =
    role === "mentor" || role === "admin";

  const backPath = review
    ? "/dashboard-peserta"
    : viewerIsManager
    ? `/peserta/${programId}`
    : "/dashboard-peserta";

  const backLabel = review
    ? "← Dashboard Peserta"
    : viewerIsManager
    ? "← Detail Peserta"
    : "← Dashboard Peserta";

  const pageTitle = isReport
    ? "Laporan Monitoring OJT"
    : "Evaluasi Kesiapan OJT";

  const progress = analysis?.simperProgress || null;

  const displayCategories = review
    ? CATEGORIES
    : analysis.categories;

  const displayIndicators = review
    ? INDICATOR_TITLES.map((title) => ({
        title,
        detail:
          "Belum ada data program peserta.",
        ok: false,
      }))
    : analysis.indicators;

  const unavailable = review;

  const displayPct = (value) =>
    unavailable ? "—" : `${value}%`;

  const displayCount = (value) =>
    unavailable ? "—" : String(value);

  const displayStatus = (value) =>
    unavailable
      ? "Belum ada data"
      : value
      ? "Selesai"
      : "Belum Selesai";

  return (
    <main className="oi-root">
      <style>{css}</style>

      <header className="oi-topbar oi-no-print">
        <div className="oi-brand">
          OJT <span>MineTrack</span>
        </div>

        <button
          type="button"
          className="oi-back"
          onClick={() => router.push(backPath)}
        >
          {backLabel}
        </button>
      </header>

      <div className="oi-container">
        <section className="oi-hero">
          <small>
            EMERGENCY RESPONSE GROUP · PT BERAU COAL
          </small>

          <h1>{pageTitle}</h1>

          <p>
            {isReport
              ? "Professional OJT Monitoring Report"
              : "Readiness Assessment · Program OJT 25 Weeks"}
          </p>
        </section>

        {review && (
          <section className="oi-review">
            <strong>
              Tinjauan Permanen Administrator
            </strong>

            <p>
              Halaman ini menampilkan struktur
              {isReport
                ? " Laporan Monitoring"
                : " Evaluasi Kesiapan"}
              {" "}tanpa peserta atau program aktif.
              Semua data monitoring belum tersedia.
              Tidak ada data fiktif ataupun perubahan
              pada database.
            </p>
          </section>
        )}

        <section className="oi-card">
          <div className="oi-person">
            <div className="oi-avatar">
              {review
                ? "—"
                : initials(participantName)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="oi-name">
                {participantName}
              </div>

              <div className="oi-meta">
                {review
                  ? "Data peserta belum tersedia"
                  : participant?.department || "—"}
                {" · "}
                {program?.site || "—"}

                <div>
                  {dateText(program?.start_date)}
                  {" – "}
                  {dateText(program?.end_date)}
                </div>

                {review && (
                  <div>
                    Dibuka oleh Admin:{" "}
                    {profile.full_name || "Administrator"}
                  </div>
                )}
              </div>
            </div>

            <span
              className={
                !review && program?.status === "active"
                  ? "oi-pill completed"
                  : "oi-pill"
              }
            >
              {review
                ? "Belum Ada Program"
                : program?.status === "active"
                ? "Aktif"
                : "Tidak Aktif"}
            </span>
          </div>

          <div className="oi-lock">
            {review ? (
              <>
                🛡 Akses tinjauan hanya tersedia
                untuk Administrator. Tidak ada
                identitas peserta yang digunakan.
              </>
            ) : (
              <>
                🔒 Identitas peserta otomatis dan
                terkunci berdasarkan program OJT.

                {!viewerIsManager && (
                  <>
                    {" "}Akses peserta hanya berlaku
                    untuk program OJT miliknya.
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {error && (
          <div
            className="oi-alert oi-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* RINGKASAN MONITORING */}

        <section className="oi-card">
          <h2>Ringkasan Monitoring</h2>

          <div className="oi-stats">
            <Stat
              label="Progres Achievement OJT"
              value={displayPct(
                analysis?.achievementPct
              )}
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : `${analysis.completedCategories}/6 kategori mencapai target`
              }
            />

            <Stat
              label="Rata-rata Post-Test"
              value={fmt(
                analysis?.theoryAverage
              )}
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : `${post.length} catatan nilai`
              }
            />

            <Stat
              label="Rata-rata Praktik"
              value={fmt(
                analysis?.practiceAverage
              )}
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : `${practice.length} catatan nilai`
              }
            />

            <Stat
              label="Nilai Samapta Terakhir"
              value={fmt(
                analysis?.latestSamapta?.final
              )}
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : `${analysis.samaptaResults.length} tes lengkap`
              }
            />

            <Stat
              label="Progres KMKOP / SIMPER"
              value={
                displayPct(progress?.percentage)
              }
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : `${progress.completedSteps}/3 tahap selesai`
              }
            />

            <Stat
              label="Aktivitas OJT"
              value={
                unavailable
                  ? "—"
                  : `${analysis.activityCount}/25`
              }
              helper={
                unavailable
                  ? "Belum ada data peserta"
                  : "Minggu memiliki catatan"
              }
            />
          </div>
        </section>

        {/* KELENGKAPAN INDIKATOR */}

        <section className="oi-card">
          <div className="oi-progress-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>
                Kelengkapan Indikator Monitoring
              </h2>

              <span className="oi-muted">
                {unavailable
                  ? "Belum ada data untuk dinilai"
                  : `${analysis.fulfilled} dari 6 indikator terpenuhi`}
              </span>
            </div>

            <strong>
              {displayPct(
                analysis?.completeness
              )}
            </strong>
          </div>

          <ProgressBar
            value={analysis?.completeness}
            unavailable={unavailable}
          />

          <p className="oi-description">
            Persentase ini menunjukkan kelengkapan
            enam indikator monitoring, bukan skor
            kesiapan operasional atau keputusan
            kelulusan OJT.
          </p>

          {displayIndicators.map((item) => (
            <Indicator
              key={item.title}
              title={item.title}
              detail={item.detail}
              passed={item.ok}
              unavailable={unavailable}
            />
          ))}

          <div className="oi-alert">
            <strong>
              Kesimpulan Monitoring:
            </strong>

            <p>
              {unavailable
                ? (
                  "Belum ada peserta dan program OJT " +
                  "yang dapat dinilai. Kesimpulan " +
                  "monitoring belum dapat diterbitkan."
                )
                : analysis.fulfilled === 6
                ? (
                  "Seluruh indikator kelengkapan " +
                  "monitoring telah terpenuhi. " +
                  "Kesiapan operasional tetap " +
                  "memerlukan keputusan penanggung jawab."
                )
                : (
                  "Masih terdapat indikator monitoring " +
                  "yang belum terpenuhi. Mentor perlu " +
                  "memeriksa dan menindaklanjuti " +
                  "data atau tahapan yang belum lengkap."
                )}
            </p>

            Kelengkapan indikator tidak otomatis
            menyatakan peserta lulus OJT atau
            berwenang menjalankan tugas operasional.
            Keputusan akhir mengikuti SOP perusahaan.
          </div>
        </section>

        {/* ENAM KOMPETENSI */}

        <section className="oi-card">
          <h2>
            Rincian Pencapaian Kompetensi
          </h2>

          <p className="oi-description">
            Target kumulatif program OJT 25 minggu.
            Hanya aktivitas terverifikasi yang
            dihitung pada program asli.
          </p>

          {displayCategories.map((item) => (
            <div
              className="oi-competency"
              key={item.name}
            >
              <div className="oi-competency-name">
                {item.icon} {item.name}

                <small>
                  Target {item.target} {item.unit}
                </small>
              </div>

              <div className="oi-competency-middle">
                <ProgressBar
                  value={item.percentage}
                  unavailable={unavailable}
                />

                <small>
                  Pencapaian:{" "}
                  {unavailable
                    ? "—"
                    : fmtNumber(
                        item.totalAchieved,
                        item.name === "Fisik" ? 2 : 0
                      )}
                  {" / "}
                  {fmtNumber(item.target)}
                  {" "}
                  {item.unit}
                </small>
              </div>

              <div className="oi-competency-score">
                {displayPct(item.percentage)}

                <small>
                  {unavailable
                    ? "Belum ada data"
                    : `${item.verified} kegiatan terverifikasi`}
                </small>
              </div>
            </div>
          ))}

          <div className="oi-alert">
            <strong>
              Catatan Achievement:
            </strong>

            <p>
              Setiap kategori dihitung dari
              pencapaian kumulatif terhadap
              target program, maksimal 100%.
            </p>

            <p>
              Fisik menggunakan kilometer,
              sedangkan kategori lainnya
              menggunakan jumlah kegiatan
              terverifikasi.
            </p>

            Total kegiatan terverifikasi:{" "}
            <strong>
              {displayCount(
                analysis?.totalVerified
              )}
            </strong>.
          </div>
        </section>

        {/* SIMPER */}

        <section className="oi-card">
          <h2>Rincian Tahapan SIMPER</h2>

          {[
            [
              "KMKOP – Ujian Teori",
              progress?.theory,
            ],
            [
              "KMKOP – Ujian Praktik",
              progress?.practice,
            ],
            [
              "Orientasi Area",
              progress?.orientation,
            ],
          ].map(([title, complete]) => (
            <div className="oi-row" key={title}>
              <span>{title}</span>

              <strong>
                {displayStatus(complete)}
              </strong>
            </div>
          ))}

          <div className="oi-row">
            <span>Progres Tahapan KMKOP</span>

            <strong>
              {displayPct(
                progress?.percentage
              )}
            </strong>
          </div>

          <div className="oi-row">
            <span>Penerbitan SIMPER</span>

            <strong>
              {unavailable
                ? "Belum ada data"
                : progress.released
                ? "Terbit"
                : "Belum Terverifikasi Terbit"}
            </strong>
          </div>

          <div className="oi-row">
            <span>Tanggal Terbit</span>

            <strong>
              {!unavailable && progress?.released
                ? dateText(simper?.graduation_date)
                : "—"}
            </strong>
          </div>

          {!unavailable && progress?.legacy && (
            <div className="oi-alert">
              Terdapat status lulus dari data
              SIMPER lama, tetapi metadata
              penerbitan belum tersedia atau
              belum terverifikasi. Status lama
              tidak otomatis dihitung sebagai
              SIMPER telah terbit.
            </div>
          )}

          <p className="oi-description">
            Penerbitan SIMPER ditampilkan terpisah
            dan tidak menambah persentase tiga
            tahap KMKOP.
          </p>
        </section>

        {/* RIWAYAT DAN PENGESAHAN LAPORAN */}

        {isReport && (
          <>
            <History
              title="Riwayat Post-Test"
              rows={post}
              dateKey="test_date"
            />

            <History
              title="Riwayat Praktik Mingguan"
              rows={practice}
              dateKey="practice_date"
              nameKey="practice_name"
            />

            <section className="oi-card oi-history-card">
              <h2>Riwayat Samapta</h2>

              {!analysis?.samaptaResults?.length ? (
                <div className="oi-empty">
                  Belum ada tes Samapta lengkap.
                </div>
              ) : (
                analysis.samaptaResults.map(
                  (item) => (
                    <div
                      className="oi-history"
                      key={item.date}
                    >
                      <div className="oi-history-info">
                        <strong>
                          {dateText(item.date)}
                        </strong>

                        <span>
                          Nilai A: {fmt(item.a)}
                          {" · "}
                          Nilai B: {fmt(item.b)}
                        </span>

                        <span>
                          Status lari:{" "}
                          {item.outcome === "pass"
                            ? "Lulus"
                            : item.outcome === "fail"
                            ? "Tidak Lulus"
                            : "Belum Dinilai"}
                        </span>
                      </div>

                      <div className="oi-history-score">
                        {fmt(item.final)}
                      </div>
                    </div>
                  )
                )
              )}
            </section>

            <section className="oi-card">
              <h2>Catatan dan Pengesahan</h2>

              <p className="oi-description">
                Laporan ini merupakan rekap otomatis
                data monitoring OJT. Keputusan akhir
                memerlukan pemeriksaan dan pengesahan
                sesuai ketentuan perusahaan.
              </p>

              {unavailable && (
                <div className="oi-alert">
                  Belum ada laporan peserta yang
                  dapat disahkan. Halaman ini hanya
                  digunakan untuk pemeriksaan
                  struktur dokumen oleh Admin.
                </div>
              )}

              <p style={{ fontSize: 12 }}>
                Tanggal cetak:{" "}
                {new Date().toLocaleDateString(
                  "id-ID"
                )}
              </p>

              <div className="oi-signature">
                Mengetahui,

                <p>Mentor / Penanggung Jawab</p>

                <div className="oi-signature-space" />

                <strong>
                  __________________________
                </strong>

                <p>
                  {!unavailable && role === "mentor"
                    ? profile.full_name
                    : "Nama Penanggung Jawab"}
                </p>
              </div>
            </section>
          </>
        )}

        <div className="oi-actions oi-no-print">
          <button
            type="button"
            className="oi-button secondary"
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing
              ? "Memuat..."
              : "Refresh Data"}
          </button>

          {isReport && (
            <button
              type="button"
              className="oi-button"
              onClick={() => window.print()}
            >
              Cetak / Simpan PDF
            </button>
          )}
        </div>

        <footer className="oi-footer">
          OJT MineTrack v2.0 ·
          Emergency Response Group ·
          PT Berau Coal
        </footer>
      </div>
    </main>
  );
}

// ====================================================
// CSS RESPONSIVE & PRINT
// ====================================================

const css = `
.oi-root,
.oi-root * {
  box-sizing: border-box;
}

.oi-root {
  min-height: 100vh;
  background: #f2f6f7;
  color: #183b2d;
  font-family: Arial, Helvetica, sans-serif;
}

.oi-root button {
  font-family: inherit;
}

.oi-topbar {
  background: #09232b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 22px;
}

.oi-brand {
  font-size: 21px;
  font-weight: 900;
}

.oi-brand span {
  color: #35c993;
}

.oi-container {
  max-width: 1050px;
  margin: auto;
  padding: 20px;
}

.oi-hero {
  padding: 30px;
  border-radius: 18px;
  margin-bottom: 15px;
  color: white;
  background:
    linear-gradient(
      90deg,
      rgba(5,27,34,.98),
      rgba(7,43,39,.86),
      rgba(5,36,33,.35)
    ),
    url("/background-erg.png.PNG");
  background-size: cover;
  background-position: center;
}

.oi-hero small {
  color: #ebc87f;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.5px;
}

.oi-hero h1 {
  font-size: 29px;
  margin: 12px 0 8px;
}

.oi-hero p {
  margin: 0;
  font-size: 13px;
  color: #dcebe4;
}

.oi-review {
  background: #e8f7ed;
  border: 1px solid #b5dfc2;
  color: #145b3e;
  border-radius: 13px;
  padding: 16px 18px;
  margin-bottom: 15px;
  font-size: 12px;
  line-height: 1.8;
}

.oi-review strong {
  font-size: 14px;
}

.oi-review p {
  margin: 7px 0 0;
}

.oi-card {
  background: white;
  border: 1px solid #e2ebe5;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 15px;
  box-shadow: 0 4px 17px #123e2609;
  min-width: 0;
}

.oi-card h2 {
  font-size: 17px;
  margin: 0 0 15px;
}

.oi-back {
  border: 1px solid #ffffff35;
  background: #ffffff16;
  color: white;
  border-radius: 10px;
  padding: 10px 13px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.oi-person {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 13px;
  background: #f5fbf7;
  border: 1px solid #deefe4;
  border-radius: 12px;
  padding: 15px;
}

.oi-avatar {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: #dbf5e7;
  color: #087b51;
  font-size: 18px;
  font-weight: 900;
}

.oi-name {
  font-size: 16px;
  font-weight: 900;
  overflow-wrap: anywhere;
}

.oi-meta {
  color: #788b7e;
  font-size: 11px;
  margin-top: 5px;
  line-height: 1.7;
}

.oi-lock {
  background: #effaf3;
  border: 1px solid #d5eddd;
  border-radius: 11px;
  padding: 12px;
  margin-top: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #0c7c54;
}

.oi-stats {
  display: grid;
  grid-template-columns:
    repeat(3,minmax(0,1fr));
  gap: 11px;
}

.oi-stat {
  background: #f7faf8;
  border: 1px solid #e5eee8;
  border-radius: 12px;
  padding: 16px;
  min-width: 0;
}

.oi-stat span {
  color: #748a7c;
  display: block;
  font-size: 11px;
}

.oi-stat strong {
  color: #0b8058;
  display: block;
  font-size: 26px;
  margin: 10px 0 5px;
  overflow-wrap: anywhere;
}

.oi-stat small {
  color: #84978a;
  font-size: 10px;
  line-height: 1.5;
}

.oi-progress-track {
  height: 11px;
  background: #e5eee7;
  border-radius: 20px;
  overflow: hidden;
  margin: 12px 0;
}

.oi-progress-fill {
  height: 100%;
  border-radius: 20px;
  transition: width .2s;
}

.oi-progress-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.oi-progress-head strong {
  font-size: 30px;
  color: #087e55;
}

.oi-muted {
  font-size: 12px;
  color: #758b7c;
}

.oi-description {
  font-size: 12px;
  color: #748b7b;
  line-height: 1.7;
}

.oi-indicator {
  display: flex;
  align-items: center;
  gap: 13px;
  border-bottom: 1px solid #e9efea;
  padding: 14px 0;
}

.oi-indicator-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  background: #edf1ef;
  color: #708375;
  font-size: 19px;
  font-weight: 900;
  flex-shrink: 0;
}

.oi-indicator-icon.completed {
  background: #dcf7e6;
  color: #087d52;
}

.oi-indicator-content {
  flex: 1;
  min-width: 0;
}

.oi-indicator-content strong {
  font-size: 13px;
  display: block;
  margin-bottom: 5px;
}

.oi-indicator-content span {
  font-size: 11px;
  color: #799080;
  line-height: 1.5;
}

.oi-pill {
  background: #edf2ef;
  color: #647a6d;
  padding: 7px 9px;
  border-radius: 20px;
  font-size: 10px;
  font-weight: 800;
  text-align: center;
  flex-shrink: 0;
}

.oi-pill.completed {
  background: #dff7e8;
  color: #087950;
}

.oi-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e8efea;
  font-size: 12px;
}

.oi-row strong {
  color: #0b7f55;
  text-align: right;
}

.oi-alert {
  border-radius: 11px;
  padding: 15px;
  background: #fff8e7;
  border: 1px solid #f0e1b3;
  color: #765b1c;
  font-size: 12px;
  line-height: 1.7;
  margin-top: 15px;
}

.oi-error {
  background: #fff0f1;
  border-color: #fecdd3;
  color: #b91c1c;
}

.oi-history {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid #ebf0ec;
}

.oi-history-info {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.oi-history strong {
  display: block;
  font-size: 12px;
}

.oi-history span,
.oi-history p {
  display: block;
  color: #819286;
  font-size: 11px;
  line-height: 1.6;
  margin: 5px 0 0;
  overflow-wrap: anywhere;
}

.oi-history-score {
  font-weight: 900;
  color: #0b8057;
  font-size: 16px;
  flex-shrink: 0;
}

.oi-empty {
  text-align: center;
  padding: 16px;
  border-radius: 10px;
  background: #f8faf9;
  color: #84968a;
  font-size: 12px;
}

.oi-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 15px;
}

.oi-button {
  background: #0b9465;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 15px;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}

.oi-button.secondary {
  background: #eaf0ec;
  color: #315b46;
}

.oi-button:disabled {
  opacity: .6;
  cursor: not-allowed;
}

.oi-competency {
  display: grid;
  grid-template-columns:
    155px minmax(0,1fr) 95px;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e8efea;
}

.oi-competency-name {
  font-size: 12px;
  font-weight: 800;
}

.oi-competency-name small {
  display: block;
  margin-top: 5px;
  font-size: 10px;
  font-weight: 400;
  color: #819286;
}

.oi-competency .oi-progress-track {
  margin: 0;
}

.oi-competency-middle small {
  display: block;
  font-size: 10px;
  color: #84978a;
  margin-top: 6px;
}

.oi-competency-score {
  text-align: right;
  font-size: 15px;
  font-weight: 900;
  color: #087e55;
}

.oi-competency-score small {
  display: block;
  font-size: 10px;
  color: #84978a;
  font-weight: 400;
  margin-top: 5px;
}

.oi-signature {
  margin-top: 35px;
  font-size: 12px;
}

.oi-signature-space {
  height: 65px;
}

.oi-footer {
  color: #8a9c91;
  font-size: 11px;
  text-align: center;
  padding: 20px;
}

.oi-loading {
  padding: 25px;
  min-height: 100vh;
  background: #f2f6f7;
  color: #173c2e;
  font-family: Arial,sans-serif;
}

.oi-loading button {
  border: 0;
  background: #0b9465;
  color: #fff;
  border-radius: 10px;
  padding: 12px 16px;
  cursor: pointer;
}

@media (max-width: 700px) {
  .oi-topbar {
    padding: 13px 15px;
  }

  .oi-brand {
    font-size: 18px;
  }

  .oi-back {
    padding: 9px;
    font-size: 11px;
  }

  .oi-container {
    padding: 12px;
  }

  .oi-hero {
    padding: 24px 17px;
    border-radius: 14px;
  }

  .oi-hero h1 {
    font-size: 23px;
  }

  .oi-card {
    padding: 15px;
    border-radius: 14px;
  }

  .oi-person {
    padding: 12px;
  }

  .oi-avatar {
    width: 44px;
    height: 44px;
    font-size: 15px;
  }

  .oi-name {
    font-size: 14px;
  }

  .oi-stats {
    grid-template-columns:
      repeat(2,minmax(0,1fr));
    gap: 8px;
  }

  .oi-stat {
    padding: 12px;
  }

  .oi-stat strong {
    font-size: 23px;
  }

  .oi-indicator {
    flex-wrap: wrap;
  }

  .oi-pill {
    margin-left: 50px;
  }

  .oi-competency {
    grid-template-columns:
      100px minmax(0,1fr) 65px;
    gap: 8px;
  }

  .oi-competency-name {
    font-size: 11px;
  }

  .oi-competency-score {
    font-size: 13px;
  }
}

@page {
  size: A4 portrait;
  margin: 12mm;
}

@media print {
  html,
  body {
    width: auto !important;
    min-width: 0 !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }

  .oi-no-print {
    display: none !important;
  }

  .oi-root {
    width: 100% !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    color: #183b2d;
    font-size: 10px;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .oi-container {
    width: 100% !important;
    max-width: none !important;
    min-width: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
  }

  .oi-hero {
    padding: 13px 15px !important;
    margin-bottom: 8px !important;
    border-radius: 8px !important;
    break-inside: avoid;
  }

  .oi-hero h1 {
    font-size: 20px !important;
    margin: 6px 0 !important;
  }

  .oi-hero p {
    font-size: 10px !important;
  }

  .oi-card {
    padding: 10px 12px !important;
    margin-bottom: 8px !important;
    border-radius: 7px !important;
    box-shadow: none !important;
    height: auto !important;
    overflow: visible !important;
    break-inside: auto !important;
  }

  .oi-card h2 {
    font-size: 13px !important;
    margin-bottom: 8px !important;
    break-after: avoid;
  }

  .oi-person,
  .oi-review,
  .oi-stat,
  .oi-indicator,
  .oi-competency,
  .oi-history,
  .oi-signature {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .oi-person {
    padding: 8px !important;
  }

  .oi-avatar {
    width: 35px !important;
    height: 35px !important;
    font-size: 12px !important;
  }

  .oi-name {
    font-size: 12px !important;
  }

  .oi-meta {
    font-size: 9px !important;
  }

  .oi-lock {
    padding: 7px !important;
    margin-top: 7px !important;
    font-size: 9px !important;
  }

  .oi-stats {
    grid-template-columns:
      repeat(3,minmax(0,1fr)) !important;
    gap: 7px !important;
  }

  .oi-stat {
    padding: 8px !important;
  }

  .oi-stat span,
  .oi-stat small {
    font-size: 9px !important;
  }

  .oi-stat strong {
    font-size: 18px !important;
    margin: 5px 0 !important;
  }

  .oi-progress-head strong {
    font-size: 22px !important;
  }

  .oi-progress-track {
    height: 7px !important;
    margin: 7px 0 !important;
  }

  .oi-indicator {
    padding: 7px 0 !important;
    gap: 8px !important;
    flex-wrap: nowrap !important;
  }

  .oi-indicator-icon {
    width: 27px !important;
    height: 27px !important;
    font-size: 13px !important;
  }

  .oi-indicator-content strong {
    font-size: 10px !important;
  }

  .oi-indicator-content span {
    font-size: 9px !important;
  }

  .oi-pill {
    font-size: 8px !important;
    padding: 4px 6px !important;
    margin-left: 0 !important;
  }

  .oi-row {
    padding: 7px 0 !important;
    font-size: 10px !important;
    break-inside: avoid;
  }

  .oi-competency {
    grid-template-columns:
      120px minmax(0,1fr) 75px !important;
    gap: 8px !important;
    padding: 8px 0 !important;
  }

  .oi-competency-name,
  .oi-competency-score {
    font-size: 10px !important;
  }

  .oi-competency-name small,
  .oi-competency-middle small,
  .oi-competency-score small {
    font-size: 8px !important;
  }

  .oi-alert {
    padding: 9px !important;
    margin-top: 8px !important;
    font-size: 9px !important;
  }

  .oi-history {
    padding: 8px 0 !important;
  }

  .oi-history strong,
  .oi-history-score {
    font-size: 10px !important;
  }

  .oi-history span,
  .oi-history p {
    font-size: 9px !important;
  }

  .oi-empty {
    padding: 9px !important;
    font-size: 9px !important;
  }

  .oi-signature {
    margin-top: 14px !important;
    font-size: 10px !important;
  }

  .oi-signature-space {
    height: 40px !important;
  }

  .oi-footer {
    padding: 7px !important;
    font-size: 8px !important;
  }
}
`;
